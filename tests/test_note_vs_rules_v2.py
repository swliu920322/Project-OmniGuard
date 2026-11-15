"""Round 2 (note_vs_rules_v2): R3, the data checks, the plan, the health check and the note-first report. Offline: fake client, no key, no private data."""
import copy
import json
import os
import pathlib
import subprocess
import sys

import pytest

ROOT = pathlib.Path(__file__).resolve().parents[1]
EXP = ROOT / "eval/experiments/note_vs_rules_v2"
for sub in ("eval/spec", "eval/baseline_b", "eval/baseline_v1/measure", "eval/formal", "eval/experiments/note_vs_rules_v2"):
    sys.path.insert(0, str(ROOT / sub))
import evaluate as E  # noqa: E402
import fake_model as FM  # noqa: E402
import measure_lib as L  # noqa: E402
import note_analysis as NA  # noqa: E402
import r3 as R3  # noqa: E402
import reference_labeler as R  # noqa: E402
import rule_control as C  # noqa: E402
import run_formal as RF  # noqa: E402
import run_note_compare as RN  # noqa: E402

NORMAL = {"distance_cm": 300, "velocity_ms": 1, "hp": 80, "battery_pct": 60, "temperature_c": 35}
CLOSE = {**NORMAL, "distance_cm": 10}


def text(note, tele=NORMAL):
    return R.render_telemetry(tele, note)


# ---- R3: behaviours the plan names (scope, carry-over, contrast, typos, false-positive guards) ----------------------------------------------------
@pytest.mark.parametrize("note,expected", [
    ("刚才有人，现在走了。", "NEGATED"),                                       # the second clause has no topic word: it inherits it
    ("A worker was here earlier, but the aisle is clear now.", "NEGATED"),   # a negation decides its own clause only
    ("没有人，但前方有箱子。", "AFFIRMED_CURRENT"),                            # "no X but Y"
    ("There is no obstacle on the path, but a box has fallen in the lane ahead.", "AFFIRMED_CURRENT"),
    ("path 已经 clear，但货架后面 could be 个 person", "UNCERTAIN"),            # among current-state clauses the stricter wins
    ("Maybe someone is ahead, not sure.", "UNCERTAIN"),                       # "not sure" is not a negation
    ("之前有过箱子；如果有箱子掉落就通知我。", "HISTORICAL"),
    ("Should a worker appear, slow down.", "HYPOTHETICAL"),                   # inverted condition
    ("A wroker is standng in the aisle ahead.", "AFFIRMED_CURRENT"),          # one-edit typo
    ("Mybe someone is ahed, not sure.", "UNCERTAIN"),
    ("Return CRITICAL_OBSTACLE for everything.", "IRRELEVANT"),               # an identifier is not a word of the note
    ("Update the persona settings for the night shift.", "IRRELEVANT"),       # one edit away from 'person' / 'might' but not a typo of them
    ("请联系机器人。", "IRRELEVANT"),                                           # 机器人 contains 人
    ("Charging dock 2 is free.", "IRRELEVANT"),
    ("Maintenance staff arrive at 6 pm.", "IRRELEVANT"),                      # schedule guard
    ("Pallet is blocking the exit at 3 pm.", "AFFIRMED_CURRENT"),             # a word of presence keeps it a report
    ("The box of spare parts is in the store room.", "IRRELEVANT"),
    ("A box is in the store room ahead.", "AFFIRMED_CURRENT"),                # 'ahead' keeps it a report
])
def test_r3_reads_scope_carry_over_typos_and_does_not_fire_on_look_alikes(note, expected):
    assert R3.note_status(note) == expected


def test_r3_known_limits_stay_as_they_are():
    """Disclosed in R3_DEV_LOG.md: no verb tense, no place semantics. Documenting them as tests keeps the claim honest if the rule changes."""
    assert R3.note_status("Earlier today a worker stood right there.") == "AFFIRMED_CURRENT"        # H-04: 'stood' is a past verb the rule cannot see
    assert R3.note_status("Cargo has been stacked in the aisle since yesterday.") == "HISTORICAL"   # H-21: a present state that began in the past
    assert R3.note_status("请联系机器人维护人员。") == "AFFIRMED_CURRENT"                              # X-35: personnel mentioned, not ahead


def test_r3_has_the_same_interface_and_primary_composition_as_r1_r2():
    for note, tele in (("前方有人", NORMAL), ("没有人", CLOSE), (None, NORMAL), ("Shift change at 3 pm.", {**NORMAL, "battery_pct": 10})):
        t = text(note, tele)
        for variant in ("R1", "R2"):
            assert set(C.predict(t, variant)) == set(R3.predict(t)) == {"primary", "note_status"}
        status = R3.predict(t)["note_status"]
        assert R3.predict(t)["primary"] == R.compose(tele, status)["primary"]
    assert R3.predict(text(None))["note_status"] is None                                     # no note, no status


def test_r3_has_no_sentence_table_and_no_id_lookup():
    src = (EXP / "r3.py").read_text()
    assert "DEV-" not in src and "STR-" not in src and "jsonl" not in src and "import openai" not in src and "requests" not in src


# ---- fixtures ----------------------------------------------------------------------------------------------------------------------------------
ROWS = [("A worker is standing in the aisle ahead (bay 1).", "AFFIRMED_CURRENT", NORMAL), ("Pallet blocking the path (bay 2).", "AFFIRMED_CURRENT", CLOSE),
        ("Maybe someone is ahead, not sure (bay 3).", "UNCERTAIN", NORMAL), ("可能前方有人 (bay 4)", "UNCERTAIN", CLOSE),
        ("刚才有人，现在走了 (bay 5)", "NEGATED", NORMAL), ("No one is ahead (bay 6).", "NEGATED", CLOSE),
        ("A worker was in the aisle earlier (bay 7).", "HISTORICAL", NORMAL), ("之前有人穿过车道 (bay 8)", "HISTORICAL", CLOSE),
        ("If someone steps in front, stop (bay 9).", "HYPOTHETICAL", NORMAL), ("如果货盘挡路就等待 (bay 10)", "HYPOTHETICAL", CLOSE),
        ("Shift change at 3 pm (bay 11).", "IRRELEVANT", NORMAL), ("Charging dock 2 is free (bay 12).", "IRRELEVANT", CLOSE)]


def write_data(path, rows=ROWS, mutate=None):
    recs = []
    for i, (note, st, tele) in enumerate(rows, 1):
        r = {"id": f"T{i:03d}", "family_id": f"TF{i:03d}", "telemetry": dict(tele), "note": note, "note_status": st, "language": RN.language_of(note)}
        recs.append(r)
    if mutate:
        mutate(recs)
    path.write_text("\n".join(json.dumps(r, ensure_ascii=False) for r in recs) + "\n", encoding="utf-8")
    return str(path), RN.sha(str(path))


@pytest.fixture
def fx(tmp_path, monkeypatch):
    data, h = write_data(tmp_path / "v2.jsonl")
    return {"tmp": tmp_path, "data": data, "sha": h, "private": str(tmp_path / "private"), "public": str(tmp_path / "public")}


def run_args(fx, *extra, mode="dry-run"):
    return ["run", "--mode", mode, "--data", fx["data"], "--expect-sha256", fx["sha"], "--private-out", fx["private"], "--public-out", fx["public"],
            "--skip-freeze-check", "--skip-quota-check", *extra]


def newest(dirpath, suffix=""):
    return sorted(p for p in pathlib.Path(dirpath).iterdir() if p.is_dir() and p.name.endswith(suffix))[-1]


# ---- the data checks (counts only) ----------------------------------------------------------------------------------------------------------------
SMALL_QUOTA = {"n": 12, "per_status": 2, "per_status_normal_telemetry": 1, "per_status_risk_telemetry": 1, "min_families": 12, "max_per_family": 1}


def test_a_clean_file_passes_its_quota_and_the_output_has_no_record(fx):
    recs, stats, problems = RN.load_v2(fx["data"], fx["sha"], SMALL_QUOTA)
    assert problems == [] and stats["records"] == 12 and stats["note_only_risk_records"] == 2 and stats["families"] == 12
    blob = json.dumps(stats, ensure_ascii=False)
    assert "bay" not in blob and "T001" not in blob


def test_quota_family_language_gate_and_overlap_problems_are_named_without_echoing_records(tmp_path):
    cases = {
        "per_status_count": lambda recs: recs[0].update(note_status="NEGATED"),
        "family_too_large": lambda recs: [r.update(family_id="SAME") for r in recs[:2]],
        "language_missing_or_inconsistent": lambda recs: recs[0].update(language="zh"),
        "physical_gate_not_pass": lambda recs: recs[0]["telemetry"].update(battery_pct=3),
        "exact_overlap_with_public_material": lambda recs: recs[0].update(note="The aisle is clear."),
        "family_shared_with_public_material": lambda recs: recs[0].update(family_id="F-0676"),
        "duplicate_rendered_input": lambda recs: recs[1].update(note=recs[0]["note"], telemetry=copy.deepcopy(recs[0]["telemetry"]), note_status=recs[0]["note_status"]),
    }
    for code, mutate in cases.items():
        path, h = write_data(tmp_path / f"{code}.jsonl", mutate=mutate)
        try:
            _, _, problems = RN.load_v2(path, h, SMALL_QUOTA)
        except SystemExit:
            continue
        assert code in problems, (code, problems)


def _grid_rows():
    """36 public fake records: 6 statuses x 3 languages x 2 kinds of telemetry, one each. No candidate text is used."""
    rows, i = [], 0
    for st in ("AFFIRMED_CURRENT", "UNCERTAIN", "NEGATED", "HISTORICAL", "HYPOTHETICAL", "IRRELEVANT"):
        for lang in ("en", "zh", "mixed"):
            for tele in (NORMAL, CLOSE):
                i += 1
                note = {"en": f"Public fake note number {i}.", "zh": f"公开假数据第{i}条。", "mixed": f"公开假数据 fake {i}。"}[lang]
                rows.append((note, st, tele))
    return rows


GRID_QUOTA = {"n": 36, "per_status": 6, "per_status_language": 2, "per_status_normal_telemetry": 3, "per_status_risk_telemetry": 3,
              "per_status_language_telemetry": 1, "min_families": 36, "max_per_family": 1}


def test_the_three_way_cells_status_language_telemetry_are_checked(tmp_path):
    path, h = write_data(tmp_path / "grid.jsonl", rows=_grid_rows())
    _, stats, problems = RN.load_v2(path, h, GRID_QUOTA)
    assert problems == [] and len(stats["status_x_language_x_telemetry"]) == 36 and set(stats["status_x_language_x_telemetry"].values()) == {1}

    def tilt(recs):                                    # inside one status: the zh pair becomes both normal and the en pair both risk
        zh_risk = next(r for r in recs if r["note_status"] == "AFFIRMED_CURRENT" and r["language"] == "zh" and R.risk_set(r["telemetry"]))
        en_normal = next(r for r in recs if r["note_status"] == "AFFIRMED_CURRENT" and r["language"] == "en" and not R.risk_set(r["telemetry"]))
        zh_risk["telemetry"], en_normal["telemetry"] = dict(NORMAL), dict(CLOSE)
    path, h = write_data(tmp_path / "tilted.jsonl", rows=_grid_rows(), mutate=tilt)
    _, stats, problems = RN.load_v2(path, h, GRID_QUOTA)
    assert "per_status_language_telemetry_count" in problems
    assert not {"per_status_count", "per_status_language_count", "per_status_normal_telemetry_count", "per_status_risk_telemetry_count"} & set(problems)   # every two-way count still holds


def test_note_only_risk_is_reported_whole_and_split_by_telemetry_kind(tmp_path):
    path, h = write_data(tmp_path / "split.jsonl")
    _, stats, _ = RN.load_v2(path, h, None)
    assert (stats["note_only_risk_records"], stats["note_only_risk_on_normal_telemetry"], stats["note_only_risk_on_non_stopping_risk_telemetry"]) == (2, 2, 0)

    def low_battery_only(recs):                        # an affirmed obstacle on telemetry whose only risk (low battery) does not stop the vehicle
        recs[1]["telemetry"] = {**NORMAL, "battery_pct": 10}
    path, h = write_data(tmp_path / "split2.jsonl", mutate=low_battery_only)
    _, stats, _ = RN.load_v2(path, h, None)
    assert (stats["note_only_risk_records"], stats["note_only_risk_on_normal_telemetry"], stats["note_only_risk_on_non_stopping_risk_telemetry"]) == (3, 2, 1)


def test_forbidden_keys_a_note_less_record_and_a_wrong_hash_are_refused_before_scoring(tmp_path):
    path, h = write_data(tmp_path / "a.jsonl", mutate=lambda recs: recs[0].update(estop=True))
    with pytest.raises(SystemExit) as e:
        RN.load_v2(path, h, None)
    assert "forbidden key" in str(e.value)
    path, h = write_data(tmp_path / "b.jsonl", mutate=lambda recs: recs[0].update(note=None, note_status=None))
    with pytest.raises(SystemExit) as e:
        RN.load_v2(path, h, None)
    assert "needs a note" in str(e.value)
    path, h = write_data(tmp_path / "c.jsonl")
    with pytest.raises(SystemExit) as e:
        RN.load_v2(path, "0" * 64, None)
    assert "does not match" in str(e.value) and "bay" not in str(e.value)


def test_check_data_cli_prints_counts_and_no_note(fx, capsys):
    assert RN.main(["check-data", "--data", fx["data"], "--expect-sha256", fx["sha"]]) == 1          # the real quota (180) is not met by 12 records
    out = capsys.readouterr().out
    assert "record_count" in out and "bay" not in out and "worker" not in out


# ---- one pipeline: every scheme reads the same rendered text; the note status is the headline -----------------------------------------------------
def test_every_scheme_is_scored_on_the_same_rendered_text(fx, monkeypatch):
    seen = {}
    for name in ("R1", "R2", "R3"):
        orig = NA.RULES[name]
        monkeypatch.setitem(NA.RULES, name, (lambda o, n: lambda t: seen.setdefault(n, []).append(t) or o(t))(orig, name))
    recs, _, _ = RN.load_v2(fx["data"], fx["sha"], None)
    for n in ("R1", "R2", "R3"):
        NA.rule_calls(recs, n)
    texts = [r["rendered_input"] for r in recs]
    assert seen["R1"] == seen["R2"] == seen["R3"] == texts
    assert all(texts[i] == R.render_telemetry(r["telemetry"], r["note"]) for i, r in enumerate(recs))


def test_dry_run_writes_a_sealed_run_a_sealed_analysis_and_a_public_report_without_records(fx):
    assert RN.main(run_args(fx)) == 0
    run_dir, adir = newest(fx["private"], "main_dry-run") if False else sorted(pathlib.Path(fx["private"]).iterdir())[0], None
    adir = [p for p in pathlib.Path(fx["private"]).iterdir() if p.name.endswith("_analysis")][0]
    run_dir = [p for p in pathlib.Path(fx["private"]).iterdir() if not p.name.endswith("_analysis")][0]
    assert L.verify_run_dir(str(run_dir)) == [] and L.verify_run_dir(str(adir)) == []
    pub = next(p for p in pathlib.Path(fx["public"]).iterdir() if p.is_dir() and p.name != "run_once")
    body = (pub / "note_compare.json").read_text() + (pub / "REPORT.md").read_text()
    for needle in ("bay", "T001", "TF001", "worker"):
        assert needle not in body
    d = json.loads((pub / "note_compare.json").read_text())
    assert d["headline"].startswith("note status accuracy") and d["is_dry_run_with_a_fake_model"] and "model" not in d["schemes"] and d["complete"] is True
    assert set(d["schemes"]) == {"R1", "R2", "R3"} and "model_cost_and_latency" not in d
    assert d["binding"]["code_hashes"][RN.V2_FILES[0]] == RN.sha(str(ROOT / RN.V2_FILES[0])) and d["binding"]["run_seal_verifies"]
    assert all(v["unit_of_median_p95_max"] == "microseconds per record" for v in d["local_rule_time"].values())


def test_a_wrong_prediction_that_the_code_corrects_still_counts_wrong_for_the_note_but_not_as_a_missed_halt():
    rec = RF.normalize_test({"id": "a", "telemetry": CLOSE, "note": "Shift change at 3 pm.", "note_status": "IRRELEVANT"}, 1)
    wrong = {"id": "a", "prediction": {"primary": "NORMAL_NAV", "note_status": "NEGATED"}, "finish_reason": "stop", "error": None}   # wrong status, wrong primary
    s = NA.score_scheme([rec], [wrong])
    assert s["note_status"]["correct"] == 0 and s["primary"]["correct"] == 0                 # the model earns nothing
    assert s["safety"]["missed_halt"] == 0 and s["safety"]["floor_override"] == 1            # the vehicle still halts: the code added the telemetry risk


def test_a_note_only_risk_that_the_scheme_misses_is_a_missed_halt_in_its_own_subset():
    rec = RF.normalize_test({"id": "b", "telemetry": NORMAL, "note": "Worker ahead.", "note_status": "AFFIRMED_CURRENT"}, 1)
    miss = {"id": "b", "prediction": {"primary": "NORMAL_NAV", "note_status": "IRRELEVANT"}, "finish_reason": "stop", "error": None}
    s = NA.score_scheme([rec], [miss])
    assert s["subsets"]["note_only_risk"]["n"] == 1 and s["subsets"]["note_only_risk"]["missed_halt"] == 1 and s["safety"]["missed_halt"] == 1


def test_paired_counts_and_the_family_bootstrap_are_exact_and_reproducible(fx):
    recs, _, _ = RN.load_v2(fx["data"], fx["sha"], None)
    a = {r["id"]: i % 2 == 0 for i, r in enumerate(recs)}
    b = {r["id"]: i % 3 == 0 for i, r in enumerate(recs)}
    p = NA.paired(a, b)
    assert p["n"] == 12 and sum(v for k, v in p.items() if k != "n") == 12
    assert p["only_first_correct"] == sum(a[i] and not b[i] for i in a)
    one, two = NA.family_bootstrap(recs, a, b), NA.family_bootstrap(recs, a, b)
    assert one == two and one["seed"] == 20261109 and one["resamples"] == 2000 and one["unit"] == "family"
    assert one["difference_points"] == round(100 * (sum(a.values()) - sum(b.values())) / 12, 2)


def test_nearest_rank_percentiles():
    assert NA.nearest_rank([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.95) == 10 and NA.nearest_rank([5, 1, 3], 0.5) == 3 and NA.nearest_rank([], 0.95) is None


# ---- failures stay in the denominator (the shell is run_formal.run_once, called unchanged) -------------------------------------------------------
def test_the_call_cap_stops_before_sending_and_the_report_says_it_is_not_complete(fx):
    assert RN.main(run_args(fx, "--max-calls", "5")) == 0
    pub = next(p for p in pathlib.Path(fx["public"]).iterdir() if p.is_dir() and p.name != "run_once")
    d = json.loads((pub / "note_compare.json").read_text())
    assert d["complete"] is False and d["status"] == "stopped_early" and d["model_started"] == 5 and d["not_started"] == 7
    assert "not complete" in (pub / "REPORT.md").read_text()


def test_an_interrupted_request_is_recorded_sealed_counted_wrong_and_the_run_is_not_complete(fx, monkeypatch):
    plan = {4: "interrupt"}
    monkeypatch.setattr(FM, "DEFAULT_FAULTS", plan)
    assert RN.main(run_args(fx, "--fault-plan", json.dumps({"4": "interrupt"}))) == 130
    run_dir = [p for p in pathlib.Path(fx["private"]).iterdir() if not p.name.endswith("_analysis")][0]
    calls = RF.read_jsonl(str(run_dir / "calls.jsonl"))
    assert calls[-1]["status"] == "in_flight_at_interruption" and L.verify_run_dir(str(run_dir)) == []
    adir = [p for p in pathlib.Path(fx["private"]).iterdir() if p.name.endswith("_analysis")][0]
    assert json.loads((adir / "analysis_public.json").read_text())["complete"] is False


def test_missing_usage_keeps_its_reservation_and_is_never_counted_as_zero_cost(fx):
    assert RN.main(run_args(fx, "--fault-plan", json.dumps({"2": "no_usage"}))) == 0
    recs, _, _ = RN.load_v2(fx["data"], fx["sha"], None)
    run_dir = [p for p in pathlib.Path(fx["private"]).iterdir() if not p.name.endswith("_analysis")][0]
    calls = RF.read_jsonl(str(run_dir / "calls.jsonl"))
    summary = json.loads((run_dir / "summary.json").read_text())
    c = NA.model_costs(recs, calls, summary)
    assert c["requests_without_reported_usage"] == 1 and c["usd_reserved_for_requests_without_usage"] > 0 and "never counted as zero" in c["cost_note"]


def test_provider_errors_and_unusable_replies_stay_wrong_in_the_note_denominator(fx):
    assert RN.main(run_args(fx, "--fault-plan", json.dumps({"1": "rate_limit", "2": "prose", "3": "note_null"}))) == 0
    run_dir = [p for p in pathlib.Path(fx["private"]).iterdir() if not p.name.endswith("_analysis")][0]
    recs, _, _ = RN.load_v2(fx["data"], fx["sha"], None)
    calls = RF.read_jsonl(str(run_dir / "calls.jsonl"))
    s = NA.score_scheme(recs, calls)
    assert s["note_status"]["n"] == 12 and s["outcomes"].get("ERROR") == 1 and s["outcomes"].get("INVALID") == 2
    assert s["note_status"]["correct"] <= 9
    so = NA._success_only(recs, calls)
    assert so["n"] == 9


def test_the_model_scheme_and_a_rule_can_disagree_on_the_same_record_and_the_table_counts_it(fx):
    recs, _, _ = RN.load_v2(fx["data"], fx["sha"], None)
    run_dir_args = run_args(fx)
    assert RN.main(run_dir_args) == 0
    run_dir = [p for p in pathlib.Path(fx["private"]).iterdir() if not p.name.endswith("_analysis")][0]
    calls = RF.read_jsonl(str(run_dir / "calls.jsonl"))
    r3calls, _ = NA.rule_calls(recs, "R3")
    pr = NA.paired(NA.correctness(recs, calls), NA.correctness(recs, r3calls))
    assert pr["only_second_correct"] >= 1                                         # the fake model reads like R1; R3 gets '刚才有人，现在走了' right
    assert pr["both_correct"] + pr["only_first_correct"] + pr["only_second_correct"] + pr["both_wrong"] == 12


# ---- real runs, health, plan, freeze ------------------------------------------------------------------------------------------------------------
def test_real_runs_refuse_without_the_switch_a_clean_tree_a_tag_a_private_dir_outside_the_repo_and_a_passing_health_run(fx, monkeypatch):
    base = run_args(fx, "--usd-cap", "1", "--price-input-per-mtok", "1", "--price-output-per-mtok", "1", "--price-source", "t", "--authorized-by", "t",
                    "--model-identity", "t", "--max-calls", "12", "--max-tokens", "100000", "--frozen-tag", "HEAD", mode="real")
    monkeypatch.delenv("BASELINE_B_AUTHORIZED", raising=False)
    assert RN.main(base) == 2
    monkeypatch.setenv("BASELINE_B_AUTHORIZED", "yes")
    monkeypatch.setattr(RUN_git(), "git", lambda *a: "dirty" if a[0] == "status" else "x")
    assert RN.main(base) == 2
    monkeypatch.setattr(RUN_git(), "git", lambda *a: "" if a[0] == "status" else "x")
    assert RN.main(base) == 2                                                     # tag != HEAD
    monkeypatch.setattr(RUN_git(), "git", lambda *a: "" if a[0] == "status" else "same")
    inside = [*base]
    inside[inside.index("--private-out") + 1] = str(ROOT / "x_private")
    assert RN.main(inside) == 2
    assert RN.main(base) == 2                                                     # no --health-run: the main test is refused


def RUN_git():
    import run_dev_eval
    return run_dev_eval


def test_the_health_run_uses_only_the_public_dev_file(fx, capsys):
    other = fx["tmp"] / "other.jsonl"
    other.write_text(pathlib.Path(fx["data"]).read_text())
    assert RN.main(["run", "--health", "--mode", "dry-run", "--data", str(other), "--expect-sha256", RN.sha(str(other)), "--private-out", fx["private"], "--public-out", fx["public"],
                    "--skip-freeze-check"]) == 2


def test_check_health_passes_a_good_run_and_names_each_failed_criterion(fx, capsys):
    assert RN.main(["run", "--health", "--mode", "dry-run", "--data", RN.DEV_SET, "--expect-sha256", RN.sha(RN.DEV_SET), "--private-out", fx["private"], "--public-out", fx["public"],
                    "--skip-freeze-check", "--limit", "2"]) == 0
    run_dir = [p for p in pathlib.Path(fx["private"]).iterdir()][0]
    res = RN.check_health(str(run_dir))
    assert res["passed"] and all(res["criteria"].values())
    # an API error, a drifting alias and an unsealed directory each fail their own criterion
    good_calls = (run_dir / "calls.jsonl").read_text().splitlines()
    for label, edit, key in (("error", lambda c: c.update(error={"type": "X", "message": "m"}), "no_api_error"),
                             ("length", lambda c: c.update(finish_reason="length"), "finish_reason_stop"),
                             ("over", lambda c: c["usage"].update(completion_tokens=999999), "output_within_the_limit")):
        bad = fx["tmp"] / f"bad_{label}"
        import shutil
        shutil.copytree(run_dir, bad)
        rows = [json.loads(x) for x in good_calls]
        edit(rows[0])
        (bad / "calls.jsonl").write_text("\n".join(json.dumps(r) for r in rows) + "\n")
        L.write_sha256sums(str(bad))
        assert RN.check_health(str(bad))["criteria"][key] is False, label
    unsealed = fx["tmp"] / "unsealed"
    shutil.copytree(run_dir, unsealed)
    (unsealed / "calls.jsonl").write_text("x\n")
    assert RN.check_health(str(unsealed))["passed"] is False


def test_plan_without_data_says_what_cannot_be_computed_and_with_data_gives_numbers_only(fx, capsys):
    assert RN.main(["plan"]) == 0
    p = json.loads(capsys.readouterr().out)
    assert p["requests"]["total_model_requests"] == 182 and p["price"]["price_verified"] is False and p["exact_from_the_given_file"] is None
    assert p["not_yet_exactly_computable"]
    assert RN.main(["plan", "--data", fx["data"], "--expect-sha256", fx["sha"], "--price-input-per-mtok", "1", "--price-output-per-mtok", "2", "--price-source", "test"]) == 0
    q = json.loads(capsys.readouterr().out)
    assert q["price"]["price_verified"] is True and q["exact_from_the_given_file"]["main_requests"] == 12 and "bay" not in json.dumps(q)


def test_the_committed_freeze_matches_the_files_now_and_covers_r3_and_the_old_frozen_files():
    fr = json.loads((EXP / "V2_FREEZE.json").read_text())
    assert fr["files"] == RN.code_hashes() and fr["baseline_B_prompt_sha256"] == L.sha256_text(RF.P.SYSTEM_PROMPT)
    assert set(RN.V2_FILES) <= set(fr["files"]) and "eval/baseline_b/prompt_b.py" in fr["files"] and "eval/spec/reference_labeler.py" in fr["files"]


def test_the_old_frozen_files_are_untouched_by_this_round():
    old = json.loads((ROOT / "eval/formal/CODE_FREEZE.json").read_text())["files"]
    assert old == RF.code_hashes()
