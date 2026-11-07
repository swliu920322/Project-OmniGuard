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
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation

ALLOWED_LABELS = ("CRITICAL_OBSTACLE", "NORMAL_NAV", "SENSOR_ERROR")

# B = the historical benchmark path, P = the business router as brain.py's HTTP path calls it.
CONDITIONS = ("B", "P")

MAX_COMPLETION_TOKENS = 20  # what both original call sites pass to ask_agent
# The real canary showed that the served model is a REASONING model: it ignored max_completion_tokens=20
# (67 completion tokens, 58 of them reasoning). max_tokens does cap reasoning plus text, so the runner adds
# it to every request as a spending guard. It is the only change to the original request, and it is recorded.
SAFETY_MAX_TOKENS = 1024
OUTPUT_TOKEN_BOUND = SAFETY_MAX_TOKENS  # reserved output tokens per call; checked against the reported usage
TEMPERATURE = 0.0  # ask_agent's default, which both original call sites use
# Allowance for the chat template's special tokens and role markers (begin/end markers, one per message).
# The real overhead is a few tokens; this is deliberately generous, and the runner checks the API's
# reported prompt_tokens against the bound after every call.
CHAT_OVERHEAD_TOKENS = 64
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


class BoundViolation(Exception):
    """The API reported more usage than the bound we reserved: the budget model is wrong."""

    def __init__(self, reason: str):
        super().__init__(reason)
        self.reason = reason


def input_token_upper_bound(system_prompt: str, user_input: str) -> int:
    """An upper bound on the prompt tokens of one call, with a stated assumption.

    Assumption: every token covers at least one byte of the text, which holds for byte-level BPE
    tokenizers, so tokens <= UTF-8 bytes. Template and special tokens are covered by a fixed
    allowance (CHAT_OVERHEAD_TOKENS). It is not a guess about typical text: it is the worst case.
    The runner compares the API's reported prompt_tokens with this bound after every call and
    stops the run, flagged, if it is ever exceeded.
    """
    return len(system_prompt.encode("utf-8")) + len(user_input.encode("utf-8")) + CHAT_OVERHEAD_TOKENS


MAX_PLAUSIBLE_USD = Decimal(1000)  # a cap or a per-million price above this is a typo here, and would void the cap


def parse_usd(text) -> Decimal:
    """A finite amount above zero and not absurdly large, in US dollars, or ValueError."""
    try:
        value = Decimal(str(text).strip())
    except (InvalidOperation, ValueError) as exc:
        raise ValueError(f"not a number: {text!r}") from exc
    if not value.is_finite() or value <= 0:
        raise ValueError(f"must be a finite amount above zero: {text!r}")
    if value > MAX_PLAUSIBLE_USD:
        raise ValueError(f"above the sanity ceiling of {MAX_PLAUSIBLE_USD}: {text!r}")
    return value


@dataclass(frozen=True)
class Pricing:
    """USD per million tokens. The input rate is applied to EVERY prompt token (cache-miss price,
    the highest), so cache hits can only make the real bill lower."""

    input_per_mtok: Decimal
    output_per_mtok: Decimal
    source: str

    @property
    def input_per_token(self) -> Decimal:
        return self.input_per_mtok / Decimal(1_000_000)

    @property
    def output_per_token(self) -> Decimal:
        return self.output_per_mtok / Decimal(1_000_000)

    def cost(self, prompt_tokens: int, completion_tokens: int) -> Decimal:
        return prompt_tokens * self.input_per_token + completion_tokens * self.output_per_token

    def as_dict(self) -> dict:
        return {
            "input_usd_per_mtok": str(self.input_per_mtok),
            "output_usd_per_mtok": str(self.output_per_mtok),
            "source": self.source,
            "input_rate_applied_to": "every prompt token (cache-miss price, the highest)",
        }


@dataclass(frozen=True)
class Reservation:
    """What one call may use at most. Held until the call settles; kept for good if it never does."""

    input_bound: int
    output_bound: int
    usd: Decimal

    @property
    def tokens(self) -> int:
        return self.input_bound + self.output_bound


class BudgetGuard:
    """Hard caps on requests, tokens and dollars, all checked before a request is sent.

    reserve() books the worst case for the call about to be sent. settle() replaces that booking
    with what the API reported, or keeps it when nothing was reported (a failed call, a missing
    usage field, an interrupted run), so unknown usage never frees budget. If the reported usage
    is higher than the booking, the bound was wrong: the overrun is booked as it really was and
    BoundViolation is raised so the run stops at once.
    """

    def __init__(self, max_calls: int, max_tokens: int, max_usd: Decimal, pricing: Pricing):
        self.max_calls = max_calls
        self.max_tokens = max_tokens
        self.max_usd = max_usd
        self.pricing = pricing
        self.calls_started = 0
        self.tokens_committed = 0
        self.usd_committed = Decimal(0)

    def reserve(self, input_bound: int, output_bound: int) -> Reservation:
        usd = input_bound * self.pricing.input_per_token + output_bound * self.pricing.output_per_token
        resv = Reservation(input_bound, output_bound, usd)
        if self.calls_started + 1 > self.max_calls:
            raise BudgetExceeded(f"call cap {self.max_calls} reached")
        if self.tokens_committed + resv.tokens > self.max_tokens:
            raise BudgetExceeded(
                f"token cap {self.max_tokens} would be exceeded "
                f"({self.tokens_committed} committed + {resv.tokens} worst case for the next call)"
            )
        if self.usd_committed + usd > self.max_usd:
            raise BudgetExceeded(
                f"usd cap {self.max_usd} would be exceeded "
                f"({self.usd_committed:.6f} committed + {usd:.6f} worst case for the next call)"
            )
        self.calls_started += 1
        self.tokens_committed += resv.tokens
        self.usd_committed += usd
        return resv

    def settle(self, resv: Reservation, usage: dict | None) -> None:
        prompt = (usage or {}).get("prompt_tokens")
        completion = (usage or {}).get("completion_tokens")
        if not isinstance(prompt, int) or not isinstance(completion, int):
            return  # nothing reliable reported: the reservation stays
        actual_usd = self.pricing.cost(prompt, completion)
        self.tokens_committed += (prompt + completion) - resv.tokens
        self.usd_committed += actual_usd - resv.usd
        if prompt > resv.input_bound or completion > resv.output_bound or actual_usd > resv.usd:
            raise BoundViolation(
                f"reported usage ({prompt} prompt + {completion} completion tokens) is above the reserved bound "
                f"({resv.input_bound} + {resv.output_bound})"
            )

    def snapshot(self) -> dict:
        return {
            "max_calls": self.max_calls,
            "max_tokens": self.max_tokens,
            "max_usd": str(self.max_usd),
            "calls_started": self.calls_started,
            "tokens_committed": self.tokens_committed,
            "usd_committed": f"{self.usd_committed:.6f}",
            "pricing": self.pricing.as_dict(),
        }


# ---------------------------------------------------------------- parsing
def parse_label(reply: str | None) -> str | None:
    """The benchmark's rule: strip and upper-case, then compare for equality. No fuzzy matching."""
    if reply is None:
        return None
    return reply.strip().upper()


def reasoning_tokens(usage: dict | None) -> int | None:
    details = (usage or {}).get("completion_tokens_details") or {}
    value = details.get("reasoning_tokens")
    return value if isinstance(value, int) else None


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
        entry["finish_reasons"] = {k: sum(1 for r in recs if r.get("finish_reason") == k) for k in sorted({r.get("finish_reason") for r in recs if r.get("finish_reason")})}
        entry["truncated_replies"] = sum(1 for r in recs if r.get("finish_reason") == "length")
        entry["completion_tokens_reported"] = sum(r["usage"]["completion_tokens"] for r in recs if isinstance((r.get("usage") or {}).get("completion_tokens"), int))
        entry["reasoning_tokens_reported"] = sum(reasoning_tokens(r.get("usage")) or 0 for r in recs)
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
