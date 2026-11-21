"""Which bad Compiler outputs does the code layer (router_v2.pipeline.validate_actions) stop? One example per category, no model.

The Compiler is a model and can write anything; validate_actions is the code that checks its action list against the Router's decision and the
action contract before anything leaves the endpoint. This lists the categories with an example each and what the code says, so the coverage can be read,
and so a category that stops being caught shows up as a failing test. It says nothing about how often a real model writes any of these.

    python3 -I eval/action_contract_coverage.py        # writes eval/ACTION_CONTRACT_COVERAGE.md
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src/cloud-orchestrator"))
from router_v2.pipeline import DEFAULT_ALLOWED_ACTIONS, validate_actions  # noqa: E402

GO = {"motion": "GO", "speed_cap": False}
GO_CAPPED = {"motion": "GO", "speed_cap": True}
HALT = {"motion": "HALT", "speed_cap": False}
TARGET = 100  # cm/s

# (category, actions, decision action, allowed actions, must be stopped)
CASES = [
    ("not a list: None", None, GO, DEFAULT_ALLOWED_ACTIONS, True),
    ("not a list: an object", {"action": "stop"}, GO, DEFAULT_ALLOWED_ACTIONS, True),
    ("empty list", [], GO, DEFAULT_ALLOWED_ACTIONS, True),
    ("an item that is not an object", ["stop"], GO, DEFAULT_ALLOWED_ACTIONS, True),
    ("an unknown action", [{"action": "fly", "speed": 10}], GO, DEFAULT_ALLOWED_ACTIONS, True),
    ("an action the tenant does not allow", [{"action": "move", "speed": 10}], GO, ("stop",), True),
    ("any action but stop while the decision is HALT", [{"action": "move", "speed": 10}], HALT, DEFAULT_ALLOWED_ACTIONS, True),
    ("stop with a positive speed", [{"action": "stop", "speed": 30}], GO, DEFAULT_ALLOWED_ACTIONS, True),
    ("stop with a non-numeric speed", [{"action": "stop", "speed": "0"}], GO, DEFAULT_ALLOWED_ACTIONS, True),
    ("move without a speed", [{"action": "move"}], GO, DEFAULT_ALLOWED_ACTIONS, True),
    ("move with a negative speed", [{"action": "move", "speed": -5}], GO, DEFAULT_ALLOWED_ACTIONS, True),
    ("move above the request's target speed", [{"action": "move", "speed": TARGET + 1}], GO, DEFAULT_ALLOWED_ACTIONS, True),
    ("move above 250 cm/s while the decision caps speed", [{"action": "move", "speed": 251}], GO_CAPPED, DEFAULT_ALLOWED_ACTIONS, True),
    ("move with a boolean speed", [{"action": "move", "speed": True}], GO, DEFAULT_ALLOWED_ACTIONS, True),
    ("move with a NaN speed", [{"action": "move", "speed": float("nan")}], GO, DEFAULT_ALLOWED_ACTIONS, True),
    ("turn without a degree", [{"action": "turn", "speed": 10}], GO, DEFAULT_ALLOWED_ACTIONS, True),
    ("turn with a degree outside -180..180", [{"action": "turn", "degree": 181, "speed": 10}], GO, DEFAULT_ALLOWED_ACTIONS, True),
    ("turn with a non-integer degree", [{"action": "turn", "degree": 12.5, "speed": 10}], GO, DEFAULT_ALLOWED_ACTIONS, True),
    ("turn without a speed", [{"action": "turn", "degree": 30}], GO, DEFAULT_ALLOWED_ACTIONS, True),
    ("a valid stop", [{"action": "stop"}], GO, DEFAULT_ALLOWED_ACTIONS, False),
    ("a valid stop under HALT", [{"action": "stop", "speed": 0}], HALT, DEFAULT_ALLOWED_ACTIONS, False),
    ("a valid move inside the target speed", [{"action": "move", "speed": 50}], GO, DEFAULT_ALLOWED_ACTIONS, False),
    ("a valid move exactly at the target speed", [{"action": "move", "speed": TARGET}], GO_CAPPED, DEFAULT_ALLOWED_ACTIONS, False),
    ("a valid turn", [{"action": "turn", "degree": -90, "speed": 20}], GO, DEFAULT_ALLOWED_ACTIONS, False),
]


def run(cases=CASES):
    rows = []
    for name, actions, decision, allowed, must_stop in cases:
        problems = validate_actions(actions, decision, TARGET, allowed)
        rows.append({"category": name, "must_be_stopped": must_stop, "stopped": bool(problems), "ok": bool(problems) == must_stop, "message": problems[0] if problems else ""})
    return rows


def render(rows):
    stop = [r for r in rows if r["must_be_stopped"]]
    keep = [r for r in rows if not r["must_be_stopped"]]
    L = ["# 动作合约：代码层能挡住哪几类坏输出\n",
         "由 `action_contract_coverage.py` 生成，**离线，没有调用模型**。Compiler 是模型，可能写出任何东西；`validate_actions` 是把它的动作列表对照 Router 的决定和动作合约的代码。",
         "这张表列出每一类坏输出的一个例子和代码的反应，**不说明真实模型多常写出它们**。\n",
         f"## 应当被挡住的（{sum(r['ok'] for r in stop)}/{len(stop)} 被挡住）\n", "| 类别 | 被挡住 | 代码的说法 |", "|---|---|---|"]
    L += [f"| {r['category']} | {'是' if r['stopped'] else '**否**'} | {r['message'][:90].replace('|', '/')} |" for r in stop]
    L += ["", f"## 应当被接受的（{sum(r['ok'] for r in keep)}/{len(keep)} 被接受）\n", "| 类别 | 被接受 |", "|---|---|"]
    L += [f"| {r['category']} | {'是' if not r['stopped'] else '**否**'} |" for r in keep]
    L += ["", "## 局限", "- 每类只有一个例子，不是穷尽；合约本身是仿真约定（见 `validate_actions` 的文档字符串）。",
          "- 被挡住的结果是停车（`REJECTED_BY_CODE`），所以最坏情况是多停，不是放行。",
          "- Safety 的回复只看是否以 `BLOCK` 开头；任何别的文字都当作通过，这一点没有在这里覆盖。"]
    return "\n".join(L) + "\n"


def main(argv=None):
    rows = run()
    out = Path(argv[0]) if argv else ROOT / "eval/ACTION_CONTRACT_COVERAGE.md"
    out.write_text(render(rows), encoding="utf-8")
    bad = [r["category"] for r in rows if not r["ok"]]
    print("written", out, "| categories not behaving as expected:", bad or "none")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
