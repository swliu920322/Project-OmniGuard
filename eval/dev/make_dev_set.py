"""Generate the dev set (180 records) from a seed. No model is called; nothing here reads or writes the test set.

    python eval/dev/make_dev_set.py            # writes dev_set.jsonl, families.json, dev_report.json, COVERAGE_REPORT.md
    python eval/dev/make_dev_set.py --check    # regenerates in memory and compares with the files on disk

Only family ids that eval/spec/family.py assigns to "dev" are used. Gold labels are computed by
eval/spec/reference_labeler.py; note clauses and their bases come from the banks below.
"""
from __future__ import annotations

import argparse
import json
import pathlib
import random
import sys
from collections import Counter

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "spec"))
import family as F  # noqa: E402
import reference_labeler as R  # noqa: E402
import rule_control as C  # noqa: E402

DEV_SEED = 20261108
RISK = {"O": "CRITICAL_OBSTACLE", "H": "OVERHEAT", "L": "LOW_HEALTH", "B": "LOW_BATTERY", "S": "OVERSPEED"}
FIELD = {"O": "distance_cm", "H": "temperature_c", "L": "hp", "B": "battery_pct", "S": "velocity_ms"}
EQUAL = {"distance_cm": 30, "temperature_c": 60, "velocity_ms": 2.5, "battery_pct": 20, "hp": 50}
NEAR_SAFE = {"distance_cm": 30.01, "temperature_c": 59.99, "velocity_ms": 2.49, "battery_pct": 20.01, "hp": 50.01}
# violating values; the first entry of each is the decimal boundary used by the boundary families
VIOLATING = {
    "distance_cm": [29.99, 29, 25, 10, 5, 0, 20, 15],
    "temperature_c": [60.01, 60.1, 61, 75, 90, 65.5, 100, 80],
    "velocity_ms": [2.51, 2.6, 3, 4, 2.75, 3.5, 2.55, 5],
    "battery_pct": [19.99, 19, 15, 10, 8, 12.5, 17, 9],
    "hp": [49.99, 49, 35, 20, 10, 40, 45, 25],
}
GATE_VALUES = {"hp": [0, 0, 0], "battery_pct": [0, 3, 4.99, 3.5]}  # hp <= 0 or battery < 5: the router is skipped
SAFE_CHOICES = {"distance_cm": [30.5, 31, 35, 40, 50, 75, 100, 150, 200, 300, 400, 500, 800, 1200],
                "velocity_ms": [0.2, 0.5, 0.8, 1, 1.2, 1.5, 1.8, 2, 2.2, 2.4],
                "temperature_c": [20, 25, 30, 35, 40, 45, 50, 55, 58.5, 59.5],
                "battery_pct": [20.5, 25, 30, 40, 50, 60, 75, 85, 95, 100],
                "hp": [51, 55, 60, 70, 80, 90, 100]}

STATUSES = ["AFFIRMED_CURRENT", "UNCERTAIN", "NEGATED", "HISTORICAL", "HYPOTHETICAL", "IRRELEVANT"]
REASON = {
    "AFFIRMED_CURRENT": "reports the person or obstacle as present now",
    "UNCERTAIN": "reports it with doubt",
    "NEGATED": "says the person or obstacle is not there",
    "HISTORICAL": "describes an earlier event, not the current state",
    "HYPOTHETICAL": "states a condition or an instruction, not an observation",
    "IRRELEVANT": "is not about a person or obstacle ahead",
}
# BANK[status][i] = (English, Chinese, mixed); index i is the same meaning in the three languages
BANK = {
    "AFFIRMED_CURRENT": [
        ("a worker is standing in the aisle ahead", "前面通道里有工人在站着", "worker 正站在前面的通道里"),
        ("a pallet is blocking the path", "有一个货盘挡住了路", "pallet 正挡着前面的路"),
        ("someone is crossing in front of the vehicle", "有人正在车前面穿行", "someone 正在车前面穿行"),
        ("a box has fallen in the lane ahead", "前方车道上掉了一个箱子", "前方车道上掉了一个 box"),
        ("a person is standing at the junction", "路口站着一个行人", "路口站着一个 person"),
        ("an obstacle is blocking the aisle", "通道里有障碍物挡着", "aisle 里有 obstacle 挡着"),
    ],
    "UNCERTAIN": [
        ("maybe someone is ahead", "可能前面有人", "maybe 前面有人"),
        ("there might be a box in the lane, not sure", "车道里也许有个箱子，不确定", "车道里 might 有个 box"),
        ("possibly a worker near the junction", "路口附近或许有工人", "路口附近 possibly 有 worker"),
        ("it could be a person behind the shelf", "货架后面可能是个行人", "货架后面 could be 个 person"),
        ("perhaps something is blocking the aisle", "也许有东西挡着通道", "perhaps 有东西挡着 aisle"),
        ("someone may be ahead, I cannot tell", "前面可能有人，我看不清", "someone may be 在前面，看不清"),
    ],
    "NEGATED": [
        ("no one is ahead", "前方没有人", "前方 no one"),
        ("the aisle is clear", "通道是空的", "aisle 是 clear 的"),
        ("nobody is in the lane now", "车道里现在没人", "车道里 nobody 了"),
        ("there is no obstacle on the path", "路上没有障碍物", "path 上没有 obstacle"),
        ("the path is clear", "路径畅通", "path 已经 clear"),
        ("the worker has left the aisle", "工人已经离开通道", "worker 已经 left 通道"),
    ],
    "HISTORICAL": [
        ("a worker was in the aisle earlier", "刚才通道里有工人", "刚才 aisle 里有 worker"),
        ("a pallet was blocking the path an hour ago", "一小时前有货盘挡过路", "一小时前 pallet 挡过路"),
        ("someone crossed the lane before", "之前有人穿过车道", "之前有 someone 穿过车道"),
        ("a box was in the lane previously", "之前车道上有过一个箱子", "之前车道上有过 box"),
        ("a person was at the junction earlier", "刚刚路口有个行人", "刚刚路口有个 person"),
        ("the path was blocked this morning", "早上路被挡过", "早上 path was blocked"),
    ],
    "HYPOTHETICAL": [
        ("if someone steps in front, stop the vehicle", "如果有人出现在前面就停车", "if 有人出现在前面就停车"),
        ("if a pallet blocks the path, wait", "如果货盘挡路就等待", "如果 pallet 挡路就等待"),
        ("in case a worker appears, slow down", "万一有工人出现就减速", "万一 worker 出现就减速"),
        ("unless the aisle is blocked, continue", "要是通道被挡住就报告", "要是 aisle 被挡住就报告"),
        ("if a box falls, report it", "如果有箱子掉落就通知我", "if 有 box 掉落就通知我"),
        ("if a person shows up, stop", "假如有行人出现请停下", "假如 person 出现请停下"),
    ],
    "IRRELEVANT": [
        ("shift change is at 3 pm", "下午三点交班", "shift change 在下午三点"),
        ("charging dock 2 is free", "二号充电桩空闲", "charging dock 2 空闲"),
        ("the floor was cleaned yesterday", "地面昨天清洁过", "地面昨天 cleaned"),
        ("maintenance starts at 18:00", "维护从十八点开始", "maintenance 从 18:00 开始"),
        ("please log the delivery time", "请记录送货时间", "请 log 送货时间"),
        ("wifi is slow near gate 4", "四号门附近网络很慢", "gate 4 附近 wifi 很慢"),
    ],
}
# multi-clause notes: [(status, bank index)] in order, joined by CONNECTOR; the combined status is the target
MULTI = {
    "AFFIRMED_CURRENT": [("NEGATED", 3), ("AFFIRMED_CURRENT", 3)],
    "UNCERTAIN": [("NEGATED", 4), ("UNCERTAIN", 3)],
    "NEGATED": [("HISTORICAL", 4), ("NEGATED", 3)],
    "HISTORICAL": [("HISTORICAL", 3), ("HYPOTHETICAL", 4)],
    "HYPOTHETICAL": [("HYPOTHETICAL", 3), ("IRRELEVANT", 4)],
    "IRRELEVANT": [("IRRELEVANT", 3), ("IRRELEVANT", 4)],
}
CONNECTOR = {  # (en, zh, mixed)
    "AFFIRMED_CURRENT": (", but ", "，但", "，但"), "UNCERTAIN": (", but ", "，但", "，但"),
    "NEGATED": (", and now ", "，现在", "，现在"),
    "HISTORICAL": ("; ", "；", "；"), "HYPOTHETICAL": ("; ", "；", "；"), "IRRELEVANT": ("; ", "；", "；"),
}
LANGS = ["en", "zh", "mixed"]

# --- the slot plan: (class, telemetry pattern) per note status, in order; position p gets language LANGS[p % 3];
# positions 3, 4, 5 are multi-clause (one per language); positions 0 and 1 are a translation pair (same family) ------
def _slots(*parts):
    return [(c, p) for c, ps in parts for p in ps]

CO, NO, OH, LH, LB, OS = "CRITICAL_OBSTACLE", "NORMAL_NAV", "OVERHEAT", "LOW_HEALTH", "LOW_BATTERY", "OVERSPEED"
NOTE_SLOTS = {
    "AFFIRMED_CURRENT": _slots((CO, ["", "", "", "", "", "O", "O", "H", "B", "S", "OH", "LB"])),
    "UNCERTAIN": _slots((CO, ["", "", "", "", "", "O", "O", "L", "S", "OB", "OS", "HS"])),
    "NEGATED": _slots((NO, ["", ""]), (OH, ["H", "HS"]), (LH, ["L", "LB"]), (LB, ["B", "B"]), (OS, ["S"]), (CO, ["O", "OL", "OH"])),
    "HISTORICAL": _slots((NO, ["", "", ""]), (OH, ["H", "HB"]), (LH, ["L", "LS"]), (LB, ["B", "B", "BS"]), (OS, ["S", "S"])),
    "HYPOTHETICAL": _slots((NO, ["", ""]), (OH, ["H", "H", "HL"]), (LH, ["L", "L"]), (LB, ["B", "B"]), (OS, ["S", "S", "S"])),
    "IRRELEVANT": _slots((NO, ["", ""]), (OH, ["H", "HLBS"]), (LH, ["L", "L", "LBS"]), (LB, ["B", "BS"]), (OS, ["S", "S", "S"])),
}
# records without a note: (class, pattern, special)
def _plain(cls, pattern, n, special=None):
    return [(cls, pattern, special)] * n

NO_NOTE = (
    [(NO, "", s) for s in ["eq_distance_cm", "eq_temperature_c", "eq_velocity_ms", "eq_battery_pct", "eq_hp", "eq_all",
                           "near_distance_cm", "near_temperature_c", "near_velocity_ms", "near_battery_pct", "near_hp"]]
    + _plain(NO, "", 10)
    + [(CO, "O", "boundary_distance_cm"), (CO, "OHLB", None), (CO, "OBS", None)]
    + [(OH, "H", "boundary_temperature_c")] + _plain(OH, "H", 11) + [(OH, "HL", "gate_hp"), (OH, "HL", None), (OH, "HB", "gate_battery_pct"),
       (OH, "HB", None)] + _plain(OH, "HS", 2) + _plain(OH, "HLB", 1) + _plain(OH, "HBS", 2)
    + [(LH, "L", "boundary_hp")] + [(LH, "L", "gate_hp")] * 3 + _plain(LH, "L", 9) + [(LH, "LB", "gate_battery_pct")] + _plain(LH, "LB", 2)
    + _plain(LH, "LS", 3) + _plain(LH, "LBS", 2)
    + [(LB, "B", "boundary_battery_pct")] + [(LB, "B", "gate_battery_pct")] * 3 + _plain(LB, "B", 13) + _plain(LB, "BS", 4)
    + [(OS, "S", "boundary_velocity_ms")] + _plain(OS, "S", 20)
)
BOUNDARY_FIELDS = ["distance_cm", "temperature_c", "velocity_ms", "battery_pct", "hp"]


def build_specs() -> list[dict]:
    specs = []
    for status in STATUSES:
        singles = Counter()
        for pos, (cls, pattern) in enumerate(NOTE_SLOTS[status]):
            lang, multi = LANGS[pos % 3], pos in (3, 4, 5)
            idx = 3 if multi else singles[lang]
            if not multi:
                singles[lang] += 1
            specs.append({"cls": cls, "pattern": pattern, "status": status, "lang": lang, "multi": multi, "idx": idx,
                          "pos": pos, "special": None})
    for cls, pattern, special in NO_NOTE:
        specs.append({"cls": cls, "pattern": pattern, "status": None, "lang": None, "multi": False, "idx": None, "pos": None,
                      "special": special})
    return specs


def note_for(status: str, lang: str, multi: bool, idx: int) -> tuple[str, list[dict]]:
    li = LANGS.index(lang)
    parts = [(s, i) for s, i in MULTI[status]] if multi else [(status, idx)]
    clauses = [{"text": BANK[s][i][li], "status": s, "basis": f"{s}: this clause {REASON[s]}"} for s, i in parts]
    text = CONNECTOR[status][li].join(c["text"] for c in clauses)
    text = (text[0].upper() + text[1:] + ".") if lang == "en" else text + "。"
    return text, clauses


class Gen:
    def __init__(self, seed: int):
        self.rng = random.Random(seed)
        self.cycle = {f: 0 for f in VIOLATING}
        self.gate_cycle = {f: 0 for f in GATE_VALUES}

    def safe(self, field: str, allow_equal: bool = True) -> float:
        if allow_equal and self.rng.random() < 0.10:
            return EQUAL[field]
        return self.rng.choice(SAFE_CHOICES[field])

    def violating(self, field: str) -> float:
        i = self.cycle[field]
        self.cycle[field] += 1
        return VIOLATING[field][1 + (i % (len(VIOLATING[field]) - 1))]  # [0] is reserved for the boundary families

    def gate(self, field: str) -> float:
        i = self.gate_cycle[field]
        self.gate_cycle[field] += 1
        return GATE_VALUES[field][i % len(GATE_VALUES[field])]

    def telemetry(self, spec: dict) -> dict:
        t = {f: self.safe(f) for f in VIOLATING}
        sp = spec["special"] or ""
        for letter in spec["pattern"]:
            f = FIELD[letter]
            if sp == f"gate_{f}":
                t[f] = self.gate(f)
            elif sp == f"boundary_{f}":
                t[f] = VIOLATING[f][0]
            else:
                t[f] = self.violating(f)
        if sp.startswith("eq_"):
            for f in (BOUNDARY_FIELDS if sp == "eq_all" else [sp[3:]]):
                t[f] = EQUAL[f]
        if sp.startswith("near_"):
            t[sp[5:]] = NEAR_SAFE[sp[5:]]
        return t


def generate(seed: int = DEV_SEED) -> tuple[list[dict], dict]:
    gen = Gen(seed)
    specs = build_specs()
    for s in specs:
        s["telemetry"] = gen.telemetry(s)
    # boundary families: equality, near-safe and violating member of one threshold share every other field
    group_of: dict[int, str] = {}
    for k, f in enumerate(BOUNDARY_FIELDS):
        eq = next(i for i, s in enumerate(specs) if s["special"] == f"eq_{f}")
        near = next(i for i, s in enumerate(specs) if s["special"] == f"near_{f}")
        viol = next(i for i, s in enumerate(specs) if s["special"] == f"boundary_{f}")
        base = dict(specs[eq]["telemetry"])
        # the base is safe in every other field (safe() never fires a risk) and exactly at the threshold in `f`
        base[f] = EQUAL[f]
        specs[eq]["telemetry"] = base
        specs[near]["telemetry"] = {**base, f: NEAR_SAFE[f]}
        specs[viol]["telemetry"] = {**base, f: VIOLATING[f][0]}
        for i in (eq, near, viol):
            group_of[i] = f"boundary:{f}"
    # translation pairs: positions 0 and 1 of one status share family and telemetry (same meaning, en and zh)
    for status in STATUSES:
        a, b = [i for i, s in enumerate(specs) if s["status"] == status and s["pos"] in (0, 1)]
        specs[b]["telemetry"] = dict(specs[a]["telemetry"])
        group_of[a] = group_of[b] = f"pair:{status}"
    # families -> ids from the dev pool only
    groups: dict[str, list[int]] = {}
    for i in range(len(specs)):
        groups.setdefault(group_of.get(i, f"single:{i}"), []).append(i)
    dev_pool = F.pool_by_split()["dev"]
    chosen = gen.rng.sample(dev_pool, len(groups))
    fam_of = {}
    for (key, members), fid in zip(sorted(groups.items()), chosen):
        for i in members:
            fam_of[i] = (fid, key)
    # records
    order = list(range(len(specs)))
    gen.rng.shuffle(order)
    records = []
    for n, i in enumerate(order, 1):
        s = specs[i]
        note, clauses = (None, [])
        if s["status"]:
            note, clauses = note_for(s["status"], s["lang"], s["multi"], s["idx"])
            assert R.combine_clause_statuses([c["status"] for c in clauses]) == s["status"], (n, clauses)
        gold = R.compose(s["telemetry"], s["status"])
        assert gold["valid"] and gold["primary"] == s["cls"], (n, s, gold["primary"])
        expect = [r for r in R.PRIORITY if r in {RISK[x] for x in s["pattern"]} or (r == "CRITICAL_OBSTACLE" and s["status"] in R.NOTE_RISK_STATUSES)]
        assert expect == gold["risk_set"], (n, s)
        records.append({
            "id": f"DEV-{n:03d}", "split": "dev", "spec_version": R.SPEC_VERSION, "family_id": fam_of[i][0],
            "family_kind": fam_of[i][1].split(":")[0], "telemetry": s["telemetry"], "note": note,
            "language": s["lang"], "multi_clause": bool(s["multi"]), "clauses": clauses, "note_status": s["status"],
            "rendered_input": R.render_telemetry(s["telemetry"], note),
            "gold": {"primary": gold["primary"], "risk_set": gold["risk_set"], "telemetry_risks": gold["telemetry_risks"],
                     "gate": gold["gate"], "action": gold["action"], "source_disagreement": gold["note"]["source_disagreement"]},
            "special": s["special"],
        })
    families = {}
    for r in records:
        families.setdefault(r["family_id"], {"kind": r["family_kind"], "records": []})["records"].append(r["id"])
    return records, {"seed": seed, "spec_version": R.SPEC_VERSION, "salt": F.SALT, "families": dict(sorted(families.items()))}


def jsonl(records: list[dict]) -> str:
    return "".join(json.dumps(r, ensure_ascii=False, sort_keys=True) + "\n" for r in records)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true", help="regenerate in memory and compare with the files on disk")
    args = ap.parse_args()
    records, fams = generate()
    outs = {"dev_set.jsonl": jsonl(records), "families.json": json.dumps(fams, ensure_ascii=False, indent=1, sort_keys=True) + "\n"}
    import dev_report  # noqa: E402
    report = dev_report.build(records, fams)
    outs["dev_report.json"] = json.dumps(report, ensure_ascii=False, indent=1, sort_keys=True) + "\n"
    outs["COVERAGE_REPORT.md"] = dev_report.markdown(report)
    if args.check:
        bad = [n for n, t in outs.items() if (HERE / n).read_text() != t]
        print("regenerated files identical" if not bad else f"DIFFERENT: {bad}")
        raise SystemExit(1 if bad else 0)
    for n, t in outs.items():
        (HERE / n).write_text(t)
    print(f"wrote {len(records)} records, {len(fams['families'])} families")


if __name__ == "__main__":
    sys.path.insert(0, str(HERE))
    main()
