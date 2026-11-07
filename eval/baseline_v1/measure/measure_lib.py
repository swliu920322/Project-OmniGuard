"""Pure helpers for the baseline-A measurement (eval-baseline-v1).

Nothing here imports the original implementation or touches the network, so it can be unit-tested
in-process. The runner (run_baseline_a.py) imports the original code in its own process.
"""
from __future__ import annotations

import csv
import hashlib
import json
import math
import os
import secrets
from datetime import datetime, timezone

ALLOWED_LABELS = ("CRITICAL_OBSTACLE", "NORMAL_NAV", "SENSOR_ERROR")

# B = the historical benchmark path, P = the business router as brain.py's HTTP path calls it.
CONDITIONS = ("B", "P")

MAX_COMPLETION_TOKENS = 20  # what both original call sites pass to ask_agent
TEMPERATURE = 0.0  # ask_agent's default, which both original call sites use
CHARS_PER_TOKEN = 3  # deliberately pessimistic, only used for the pre-request budget check
REQUEST_OVERHEAD_TOKENS = 8  # chat-format overhead added to every estimate
SDK_TIMEOUT_S = 60.0

# If any of these is set, the run refuses to start: they would let the original code reach real
# devices or storage.
FORBIDDEN_ENV = (
    "IotHubServiceConnectionString",
    "IotHubEventHubConnectionString",
    "IOTHUB_DEVICE_CONNECTION_STRING",
    "COSMOS_ENDPOINT",
    "COSMOS_KEY",
)

RESPONSE_HEADERS_KEPT = ("x-request-id", "date", "retry-after", "content-type")


# ---------------------------------------------------------------- hashing
def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_text(text: str) -> str:
    return sha256_bytes(text.encode("utf-8"))


def sha256_file(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 16), b""):
            h.update(chunk)
    return h.hexdigest()


# ---------------------------------------------------------------- inputs
def build_input(condition: str, row: dict) -> str:
    """The user message the router receives, copied from the original call sites.

    B  benchmark.py (lines 111-115): raw CSV values, no X, no device.
    P  brain.py HTTP path (lines 229-234, 298): velocity float, hp/battery/temperature cast with
       int(), X included, device id "Simulated-Device". The int() casts drop decimals (39.6 -> 39).
    """
    if condition == "B":
        return (
            f"Telemetry: Distance: {row['obstacle']}cm, "
            f"Velocity: {row['velocity']}m/s, HP: {row['hp']}, "
            f"Battery: {row['battery']}%, Temp: {row['temperature']}C."
        )
    if condition == "P":
        velocity = float(row["velocity"])
        hp = int(float(row["hp"]))
        battery = int(float(row["battery"]))
        temperature = int(float(row["temperature"]))
        current_x = float(row["x"])
        return (
            f"Telemetry: Distance: {row['obstacle']}cm, X: {current_x}, Velocity: {velocity}m/s, "
            f"HP: {hp}, Battery: {battery}%, Temp: {temperature}C, Device: Simulated-Device."
        )
    raise ValueError(f"unknown condition {condition!r}")


def load_rows(csv_path: str, limit: int | None = None) -> list[dict]:
    with open(csv_path, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    return rows[:limit] if limit else rows


def plan_order(n_rows: int) -> list[tuple[int, int, str]]:
    """(seq, row_index, condition) for every call, B and P interleaved per row.

    The condition that goes first alternates by row, so neither systematically runs first and any
    drift of the model over the run affects both conditions alike.
    """
    plan = []
    seq = 0
    for i in range(n_rows):
        order = CONDITIONS if i % 2 == 0 else tuple(reversed(CONDITIONS))
        for cond in order:
            plan.append((seq, i, cond))
            seq += 1
    return plan


# ---------------------------------------------------------------- budget
class BudgetExceeded(Exception):
    """Raised BEFORE a request is sent when it could break a cap."""

    def __init__(self, reason: str):
        super().__init__(reason)
        self.reason = reason


def estimate_tokens(system_prompt: str, user_input: str, max_completion_tokens: int = MAX_COMPLETION_TOKENS) -> int:
    """Worst-case tokens for one call: pessimistic input estimate + the completion cap."""
    chars = len(system_prompt) + len(user_input)
    return math.ceil(chars / CHARS_PER_TOKEN) + REQUEST_OVERHEAD_TOKENS + max_completion_tokens


class BudgetGuard:
    """Hard caps on the number of requests and on tokens, checked before each request.

    Finished calls count with the token usage the API reported; calls that failed (usage unknown)
    count with their worst-case estimate, so a failure never frees budget.
    """

    def __init__(self, max_calls: int, max_tokens: int):
        self.max_calls = max_calls
        self.max_tokens = max_tokens
        self.calls_started = 0
        self.tokens_committed = 0

    def before(self, worst_case_tokens: int) -> None:
        if self.calls_started + 1 > self.max_calls:
            raise BudgetExceeded(f"call cap {self.max_calls} reached")
        if self.tokens_committed + worst_case_tokens > self.max_tokens:
            raise BudgetExceeded(
                f"token cap {self.max_tokens} would be exceeded "
                f"({self.tokens_committed} committed + {worst_case_tokens} worst case for the next call)"
            )
        self.calls_started += 1
        self.tokens_committed += worst_case_tokens  # reserved until the real usage is known

    def settle(self, reserved: int, actual_total_tokens: int | None) -> None:
        """Replace the reservation with the reported usage, if the API reported one."""
        if actual_total_tokens is not None:
            self.tokens_committed += actual_total_tokens - reserved

    def snapshot(self) -> dict:
        return {
            "max_calls": self.max_calls,
            "max_tokens": self.max_tokens,
            "calls_started": self.calls_started,
            "tokens_committed": self.tokens_committed,
        }


# ---------------------------------------------------------------- parsing
def parse_label(reply: str | None) -> str | None:
    """The benchmark's rule: strip and upper-case, then compare for equality. No fuzzy matching."""
    if reply is None:
        return None
    return reply.strip().upper()


def contains_sensor_error(reply: str | None) -> bool:
    """brain.py's rule (lines 109 and 305): a substring test on the upper-cased reply."""
    return reply is not None and "SENSOR_ERROR" in reply.upper()


# ---------------------------------------------------------------- summary
def _outcome(record: dict) -> str:
    """Column of the confusion matrix: a real label, INVALID (not a label) or ERROR (no reply)."""
    if record.get("error"):
        return "ERROR"
    label = record.get("parsed_label")
    return label if label in ALLOWED_LABELS else "INVALID"


def summarize(records: list[dict], rows: list[dict]) -> dict:
    """Counts per condition. Failures and invalid replies stay in the denominator as wrong."""
    by_cond: dict = {}
    for cond in CONDITIONS:
        recs = [r for r in records if r["condition"] == cond]
        sub = {
            "all_rows_started": recs,
            "rows_reaching_router": [r for r in recs if rows[r["row_index"]]["gate_decision"] != "HALT"],
        }
        entry: dict = {"calls_started": len(recs)}
        for name, items in sub.items():
            correct = sum(1 for r in items if _outcome(r) == rows[r["row_index"]]["expected_label"])
            entry[name] = {
                "n": len(items),
                "correct": correct,
                "failed_calls": sum(1 for r in items if r.get("error")),
                "invalid_replies": sum(1 for r in items if _outcome(r) == "INVALID"),
                "accuracy": round(correct / len(items), 4) if items else None,
            }
        confusion: dict = {}
        for r in recs:
            gold = rows[r["row_index"]]["expected_label"]
            confusion.setdefault(gold, {}).setdefault(_outcome(r), 0)
            confusion[gold][_outcome(r)] += 1
        entry["confusion_legacy_gold_x_outcome"] = confusion
        entry["substring_sensor_error_replies"] = sum(1 for r in recs if contains_sensor_error(r.get("reply")))
        entry["models_seen"] = sorted({r["response_model"] for r in recs if r.get("response_model")})
        usage = [r["usage"]["total_tokens"] for r in recs if r.get("usage") and r["usage"].get("total_tokens") is not None]
        entry["tokens_reported"] = sum(usage)
        entry["calls_without_usage"] = len(recs) - len(usage)
        by_cond[cond] = entry

    # Rows whose legacy label disagrees with the 30 cm safety rule: tagged critical but >= 30 cm.
    label_issue = sum(
        1 for r in rows if r["expected_label"] == "CRITICAL_OBSTACLE" and float(r["obstacle"]) >= 30
    )
    all_models = sorted({m for c in by_cond.values() for m in c["models_seen"]})
    return {
        "conditions": by_cond,
        "legacy_label_rows_critical_at_or_above_30cm": label_issue,
        "distinct_response_models": all_models,
        "model_drift_flag": len(all_models) > 1,
    }


# ---------------------------------------------------------------- run directory and files
def utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ")


def make_run_dir(root: str, mode: str) -> str:
    """A new directory that did not exist before. Never reuses or overwrites a previous run."""
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    path = os.path.join(root, f"{stamp}_{mode}_{secrets.token_hex(4)}")
    os.makedirs(path, exist_ok=False)
    return path


def write_json(path: str, obj) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=2, sort_keys=True)
        f.write("\n")


def write_sha256sums(run_dir: str) -> str:
    """Hash every file in the run directory (except the list itself); returns the list's path."""
    names = sorted(n for n in os.listdir(run_dir) if n != "SHA256SUMS" and os.path.isfile(os.path.join(run_dir, n)))
    out = os.path.join(run_dir, "SHA256SUMS")
    with open(out, "w", encoding="utf-8") as f:
        for n in names:
            f.write(f"{sha256_file(os.path.join(run_dir, n))}  {n}\n")
    return out


def verify_run_dir(run_dir: str) -> list[str]:
    """Problems found (empty list = the directory matches its SHA256SUMS exactly)."""
    sums = os.path.join(run_dir, "SHA256SUMS")
    if not os.path.isfile(sums):
        return ["SHA256SUMS missing"]
    problems, listed = [], set()
    with open(sums, encoding="utf-8") as f:
        for line in f:
            digest, name = line.rstrip("\n").split("  ", 1)
            listed.add(name)
            path = os.path.join(run_dir, name)
            if not os.path.isfile(path):
                problems.append(f"missing: {name}")
            elif sha256_file(path) != digest:
                problems.append(f"hash mismatch: {name}")
    present = {n for n in os.listdir(run_dir) if n != "SHA256SUMS" and os.path.isfile(os.path.join(run_dir, n))}
    problems += [f"not listed: {n}" for n in sorted(present - listed)]
    return problems
