"""The formal evaluation entry, exercised on SYNTHETIC fixtures built from the public dev material (never on the private acceptance data)."""
import argparse
import copy
import json
import pathlib
import sys
from collections import Counter

import pytest

ROOT = pathlib.Path(__file__).resolve().parents[1]
for sub in ("eval/spec", "eval/formal", "eval/baseline_b", "eval/baseline_v1/measure", "src/cloud-orchestrator"):
    sys.path.insert(0, str(ROOT / sub))
import evaluate as E  # noqa: E402
import fake_model as FM  # noqa: E402
import prompt_b as P  # noqa: E402
import run_formal as F  # noqa: E402

DEV_PATH = ROOT / "eval/dev/dev_set.jsonl"
DEV = [json.loads(line) for line in DEV_PATH.read_text().splitlines()]
STRESS = [json.loads(line) for line in (ROOT / "eval/dev/stress/stress_dev.jsonl").read_text().splitlines()]
MARK = "ZZ-FIXTURE-"


def _jl(rows):
    return "".join(json.dumps(r, ensure_ascii=False, sort_keys=True) + "\n" for r in rows)


def ns(fx=None, **kw):
    base = dict(acceptance_dir=fx.dir if fx else None, data=None, expect_sha256=None, stress_data=None, stress_expect_sha256=None)
    return argparse.Namespace(**{**base, **kw})


@pytest.fixture
def fx(tmp_path):
    """A fake acceptance directory (+ its manifest) made of renamed dev records and dev stress cases."""
    d = tmp_path / "acc"
    d.mkdir()
    test = [{"id": f"{MARK}T{i:03d}", "telemetry": r["telemetry"], "note": r["note"], "note_status": r["note_status"]} for i, r in enumerate(DEV)]
    stress = [{"id": f"{MARK}S{i:03d}", "type": c["type"], "telemetry": c["telemetry"], "note": c["note"], "note_status": c["note_status"]} for i, c in enumerate(STRESS)]
    (d / "test_set.jsonl").write_text(_jl(test))
    (d / "stress_cases.jsonl").write_text(_jl(stress))
    man = {"version": "fixture", "M": len(test), "class_counts": dict(Counter(r["gold"]["primary"] for r in DEV)), "noted_records": sum(1 for r in DEV if r["note"]),
           "note_status_counts": dict(Counter(r["note_status"] for r in DEV if r["note"])), "stress_records": len(stress),
           "stress_type_counts": {str(k): v for k, v in Counter(c["type"] for c in STRESS).items()},
           "sha256": {"test_set.jsonl": F.sha(str(d / "test_set.jsonl")), "stress_cases.jsonl": F.sha(str(d / "stress_cases.jsonl")), "spec_SHA256SUMS": F.sha(str(ROOT / "eval/spec/SHA256SUMS"))},
           "baseline_B_prompt_sha256": F.L.sha256_text(P.SYSTEM_PROMPT)}
    (tmp_path / "manifest.json").write_text(json.dumps(man))
    w = type("W", (), {})()
    w.dir, w.manifest, w.tmp, w.test, w.stress, w.man, w.n = str(d), str(tmp_path / "manifest.json"), tmp_path, test, stress, man, 0
    return w


def run_cli(fx, suite, extra=(), plan="none", mode="dry-run"):
    fx.n += 1
    priv, pub = str(fx.tmp / f"priv_{fx.n}"), str(fx.tmp / f"pub_{fx.n}")
    code = F.main(["run", "--suite", suite, "--mode", mode, "--acceptance-dir", fx.dir, "--manifest", fx.manifest, "--private-out", priv, "--public-out", pub,
                   "--skip-freeze-check", "--fault-plan", plan, *extra])
    privs = sorted(pathlib.Path(priv).iterdir()) if pathlib.Path(priv).exists() else []
    pubs = sorted(pathlib.Path(pub).iterdir()) if pathlib.Path(pub).exists() else []
    return code, privs, pubs


# --- the real manifest and the freeze -------------------------------------------------------------------------------------------

def test_the_frozen_manifest_matches_this_repository():
    m = F.load_manifest()
    assert (m["N"], m["M"], m["state"]) == (6, 300, "frozen_data_not_evaluated") and m["X"] is None and m["Y"] is None
    assert m["sha256"]["spec_SHA256SUMS"] == F.sha(str(ROOT / "eval/spec/SHA256SUMS"))
    assert m["baseline_B_prompt_sha256"] == F.L.sha256_text(P.SYSTEM_PROMPT)


def test_code_freeze_covers_the_files_that_decide_a_result_and_detects_any_change(tmp_path, monkeypatch):
    for f in ("eval/baseline_b/prompt_b.py", "eval/baseline_b/evaluate.py", "eval/formal/run_formal.py", "eval/spec/reference_labeler.py", "eval/spec/rule_control.py",
              "src/cloud-orchestrator/router_v2/pipeline.py"):
        assert f in F.FROZEN_FILES
    monkeypatch.setattr(F, "FREEZE", str(tmp_path / "CODE_FREEZE.json"))
    with pytest.raises(SystemExit, match="missing"):
        F.check_code_freeze()
    assert F.main(["freeze"]) == 0 and F.check_code_freeze() == F.code_hashes()
    real = F.code_hashes
    monkeypatch.setattr(F, "code_hashes", lambda: {**real(), "eval/baseline_b/prompt_b.py": "0" * 64})
    with pytest.raises(SystemExit, match="prompt_b.py"):
        F.check_code_freeze()


def test_the_committed_freeze_matches_the_files_now():
    frz = ROOT / "eval/formal/CODE_FREEZE.json"
    assert frz.exists(), "run `python eval/formal/run_formal.py freeze` and commit it"
    assert F.check_code_freeze() == F.code_hashes()
    assert json.loads(frz.read_text())["baseline_B_prompt_sha256"] == F.L.sha256_text(P.SYSTEM_PROMPT)


def test_the_dev_runner_is_the_accepted_version():
    import hashlib
    now = hashlib.sha256((ROOT / "eval/baseline_b/run_dev_eval.py").read_bytes()).hexdigest()
    assert now.startswith("714f54fbba04180d")                                                      # the hash reported when a15c870 was accepted
    sums = {line.split("  ", 1)[1]: line.split("  ", 1)[0] for line in (ROOT / "eval/baseline_b/SHA256SUMS").read_text().splitlines()}
    assert sums["run_dev_eval.py"] == now


# --- data: path + expected SHA-256, checked first -------------------------------------------------------------------------------

def test_an_explicit_data_file_needs_its_expected_hash_and_is_checked_before_use(fx, capsys):
    man = F.load_manifest(fx.manifest)
    with pytest.raises(SystemExit, match="expected SHA-256"):
        F.load_data(ns(data=str(DEV_PATH)), man, need=("main",))
    with pytest.raises(SystemExit, match="does not match the expected SHA-256 .nothing was read"):
        F.load_data(ns(data=str(DEV_PATH), expect_sha256="0" * 64), man, need=("main",))
    dev_sha = F.sha(str(DEV_PATH))
    test, _, frozen = F.load_data(ns(data=str(DEV_PATH), expect_sha256=dev_sha), man, need=("main",))
    assert len(test) == 180 and frozen == {"main": False}                                          # the public dev set runs without the manifest's counts, and is not 'frozen'
    assert [r["rendered_input"] for r in test] == [r["rendered_input"] for r in DEV]               # the default dev material still renders byte for byte
    with pytest.raises(SystemExit, match="no main data given"):
        F.load_data(ns(), man, need=("main",))


def test_a_non_frozen_file_never_counts_as_the_formal_measurement(fx):
    sha_ = F.sha(str(DEV_PATH))
    code, privs, pubs = run_cli(fx, "main", extra=["--data", str(DEV_PATH), "--expect-sha256", sha_])
    s = json.loads((privs[0] / "summary.json").read_text())
    assert code == 0 and s["is_measurement"] is False
    assert json.loads((privs[0] / "config.json").read_text())["data_is_frozen_acceptance_file"] is False
    assert json.loads((pubs[0] / "public_summary.json").read_text())["data_is_frozen_acceptance_file"] is False


def test_check_format_reports_counts_only(fx, capsys):
    assert F.main(["check-format", "--acceptance-dir", fx.dir, "--manifest", fx.manifest]) == 0
    out = capsys.readouterr().out
    assert json.loads(out)["test_records"] == 180 and MARK not in out and "match the expected SHA-256" in out and json.loads(out)["is_the_frozen_acceptance_data"] == {"main": True, "stress": True}


def test_a_changed_private_file_is_refused_without_echoing_it(fx):
    p = pathlib.Path(fx.dir) / "test_set.jsonl"
    p.write_text(p.read_text() + "\n")
    with pytest.raises(SystemExit, match="expected SHA-256") as e:
        F.main(["check-format", "--acceptance-dir", fx.dir, "--manifest", fx.manifest])
    assert MARK not in str(e.value)


def _refreeze(fx, rows, name="test_set.jsonl"):
    (pathlib.Path(fx.dir) / name).write_text(_jl(rows))
    fx.man["sha256"][name] = F.sha(str(pathlib.Path(fx.dir) / name))
    pathlib.Path(fx.manifest).write_text(json.dumps(fx.man))


def test_bad_records_and_counts_are_refused_without_echoing_them(fx):
    for mutate, needle in [(lambda r: r[1].update(id=r[0]["id"]), "duplicate"), (lambda r: r[0].update(note="   "), "note"), (lambda r: r[2].pop("telemetry"), "telemetry"),
                           (lambda r: r[3]["telemetry"].update(battery_pct=180), "input contract"), (lambda r: r[4].update(gold={"primary": "OVERHEAT"}), "recomputed"),
                           (lambda r: r[5].update(note_status="IRRELEVANT" if r[5]["note_status"] != "IRRELEVANT" else "NEGATED"), "counts")]:
        rows = copy.deepcopy(fx.test)
        mutate(rows)
        _refreeze(fx, rows)
        with pytest.raises(SystemExit, match=needle) as e:
            F.load_data(ns(fx), F.load_manifest(fx.manifest), need=("main",))
        assert MARK not in str(e.value)


def test_gold_is_recomputed_from_telemetry_and_status_never_taken_from_the_file(fx):
    test, _, _ = F.load_data(ns(fx), F.load_manifest(fx.manifest), need=("main",))
    assert [r["gold"]["primary"] for r in test] == [r["gold"]["primary"] for r in DEV] and test[0]["rendered_input"] == DEV[0]["rendered_input"]


# --- real-mode refusals -----------------------------------------------------------------------------------------------------------

REAL = ["run", "--suite", "main", "--mode", "real", "--usd-cap", "0.25", "--price-input-per-mtok", "0.33", "--price-output-per-mtok", "1.33", "--price-source", "x",
        "--authorized-by", "me", "--model-identity", "m", "--max-calls", "300", "--max-tokens", "600000"]


def test_real_runs_refuse_without_the_switch_a_clean_tree_a_frozen_tag_or_a_private_dir_outside_the_repo(monkeypatch, capsys, tmp_path):
    assert F.main(["run", "--suite", "main", "--mode", "real"]) == 2
    monkeypatch.delenv("BASELINE_B_AUTHORIZED", raising=False)
    assert F.main(REAL) == 2 and "BASELINE_B_AUTHORIZED=yes" in capsys.readouterr().err
    monkeypatch.setenv("BASELINE_B_AUTHORIZED", "yes")
    monkeypatch.setattr(F.RUN, "git", lambda *a: "M file" if a[0] == "status" else "abc")
    assert F.main(REAL) == 2 and "clean working tree" in capsys.readouterr().err
    monkeypatch.setattr(F.RUN, "git", lambda *a: "" if a[0] == "status" else ("aaa" if a[-1].startswith("tag") else "bbb"))
    assert F.main(REAL + ["--frozen-tag", "tag-x", "--private-out", str(tmp_path)]) == 2 and "frozen-tag" in capsys.readouterr().err
    monkeypatch.setattr(F.RUN, "git", lambda *a: "" if a[0] == "status" else "same")
    assert F.main(REAL + ["--frozen-tag", "t", "--private-out", str(ROOT / "eval" / "x")]) == 2 and "outside the repository" in capsys.readouterr().err


# --- main suite ---------------------------------------------------------------------------------------------------------------------

def test_main_dry_run_keeps_records_private_and_publishes_no_id_input_or_reply(fx):
    code, privs, pubs = run_cli(fx, "main")
    priv, pub = privs[0], pubs[0]
    assert code == 0 and F.L.verify_run_dir(str(priv)) == []
    calls = [json.loads(x) for x in (priv / "calls.jsonl").read_text().splitlines()]
    assert len(calls) == 180 and all(c["request"]["max_tokens"] == 2048 and c["request"]["temperature"] == 0 for c in calls)
    assert any(MARK in c["id"] for c in calls) and "Telemetry:" in (priv / "calls.jsonl").read_text()
    public = "".join(p.read_text() for p in pub.iterdir())
    assert MARK not in public and "Telemetry:" not in public and "Operator note" not in public
    s = json.loads((pub / "public_summary.json").read_text())
    assert s["metrics_withheld"] and s["private_calls_sha256"] == F.sha(str(priv / "calls.jsonl")) and s["is_measurement"] is False
    assert s["prompt_sha256"] == F.L.sha256_text(P.SYSTEM_PROMPT) and s["spec_version"] == "1.0" and "wrong" in s["scoring_policy"]
    cfg = json.loads((priv / "config.json").read_text())
    assert cfg["request_settings"]["temperature"] == 0 and cfg["request_settings"]["sdk_max_retries"] == 0 and "none" in cfg["request_settings"]["local_result_cache"]
    assert cfg["baseline"]["prompt_version"] == "B-1.0" and cfg["repo_head"] and set(cfg["code_hashes"]) == set(F.FROZEN_FILES)


def test_no_local_cache_every_record_reaches_the_client(fx):
    _, privs, _ = run_cli(fx, "main")
    s = json.loads((privs[0] / "summary.json").read_text())
    assert s["requests_that_reached_the_client"] == s["planned"] == 180 == s["calls_recorded"]
    src = pathlib.Path(F.__file__).read_text()
    assert "ask_agent" not in src.split('"""', 2)[2].replace("`ask_agent`'s cache is not used", "").replace("ask_agent's cache is not used", "")


def test_public_view_drops_every_record_id():
    calls = [{"id": "ZZ1", "prediction": {"primary": "NORMAL_NAV", "note_status": "NEGATED"}, "finish_reason": "stop", "error": None}]
    rec = copy.deepcopy(next(r for r in DEV if r["note_status"] == "AFFIRMED_CURRENT" and r["gold"]["telemetry_risks"] == []))
    rec["id"] = "ZZ1"
    m = E.evaluate([rec], calls)
    assert m["safety"]["missed_halt_ids"] == ["ZZ1"]
    pv = F.public_view(m)
    assert "missed_halt_ids" not in pv["safety"] and "ZZ1" not in json.dumps(pv) and m["safety"]["missed_halt_ids"] == ["ZZ1"]


def test_failures_stay_wrong_and_success_only_sits_next_to_the_main_figure(fx):
    _, privs, _ = run_cli(fx, "main", plan='{"3": "rate_limit", "9": "timeout"}')
    s = json.loads((privs[0] / "summary.json").read_text())
    assert s["metrics"]["primary"]["all_started"]["errors"] == 2 and s["metrics"]["primary"]["all_started"]["n"] == 180
    assert s["success_only_primary"]["n"] == 178 and "NEXT TO the main figure" in s["success_only_primary"]["note"]


def test_r1_and_r2_are_scored_on_the_same_records_with_no_model_call(fx):
    _, privs, _ = run_cli(fx, "main")
    rc = json.loads((privs[0] / "summary.json").read_text())["rule_controls"]
    assert set(rc) == {"R1", "R2"} and rc["R1"]["primary"]["all_started"]["n"] == rc["R2"]["primary"]["all_started"]["n"] == 180
    # the controls match the offline report on the same material (the fixture's records are the dev records)
    ref = json.loads((ROOT / "eval/dev/rule_control/report.json").read_text())["controls"]
    for v in ("R1", "R2"):
        assert rc[v]["primary"]["all_started"]["correct"] == ref[v]["dev_all"]["primary_correct"]


def test_the_rules_suite_runs_without_a_client_and_publishes_both_controls(fx, monkeypatch):
    monkeypatch.setattr(F, "make_client", lambda *a, **k: (_ for _ in ()).throw(AssertionError("the rules suite must not create a client")))
    code, _, _ = run_cli(fx, "rules")
    pubs = sorted((fx.tmp / "pub_1").iterdir())
    s = json.loads((pubs[0] / "public_summary.json").read_text())
    assert code == 0 and set(s["controls"]) == {"R1", "R2"} and "no model call" in s["note"] and MARK not in json.dumps(s)


def test_the_call_cap_and_ctrl_c_are_handled_like_the_dev_runner(fx):
    code, privs, _ = run_cli(fx, "main", extra=["--max-calls", "7"])
    assert json.loads((privs[0] / "summary.json").read_text())["status"] == "stopped_early" and len(list(open(privs[0] / "calls.jsonl"))) == 7
    code, privs, _ = run_cli(fx, "main", plan='{"4": "interrupt"}')
    last = json.loads(open(privs[0] / "calls.jsonl").read().splitlines()[-1])
    assert code == 130 and last["status"] == "in_flight_at_interruption" and F.L.verify_run_dir(str(privs[0])) == []
    s = json.loads((privs[0] / "summary.json").read_text())
    assert s["metrics"]["primary"]["all_started"]["interrupted"] == 1 and s["metrics"]["not_started"] == 176


# --- two independent runs and the gate ------------------------------------------------------------------------------------------------

def test_twice_makes_two_separate_runs_and_applies_the_gate(fx):
    code, privs, pubs = run_cli(fx, "main", extra=["--twice"])
    assert code == 0 and len(privs) == 2 and privs[0] != privs[1]
    for p in privs:
        assert F.L.verify_run_dir(str(p)) == [] and json.loads((p / "summary.json").read_text())["requests_that_reached_the_client"] == 180
    repro = [p for p in pubs if p.name.startswith("reproducibility_")]
    res = json.loads(repro[0].read_text())
    assert res["prediction_agreement"] == 1.0 and res["accuracy_difference_points"] == 0.0 and res["passes"] is True and res["verdict"] == "PASSED"
    assert MARK not in json.dumps(res)


def test_twice_reports_not_passed_when_the_runs_disagree_and_keeps_failures(fx, monkeypatch):
    plans = iter([{}, {i: "rate_limit" for i in range(2, 12)}])                                       # run 2 has 10 failed calls: about 5.6 % disagreement

    def make(args, real):
        from fake_model import FakeClient
        return FakeClient(faults=next(plans)).with_options(max_retries=0, timeout=60.0), "fake-model-b", ""

    monkeypatch.setattr(F, "make_client", make)
    code, privs, pubs = run_cli(fx, "main", extra=["--twice"])
    assert code == 4
    res = json.loads([p for p in pubs if p.name.startswith("reproducibility_")][0].read_text())
    assert res["passes"] is False and res["verdict"] == "NOT PASSED" and res["prediction_agreement"] < 0.98 and res["errors_b"] == 10 and res["errors_a"] == 0


def test_a_first_run_that_does_not_complete_stops_the_second(fx):
    code, privs, _ = run_cli(fx, "main", extra=["--twice"], plan='{"4": "interrupt"}')
    assert code == 130 and len(privs) == 1


def test_compare_refuses_runs_made_with_different_code_or_data(fx):
    _, a, _ = run_cli(fx, "main")
    _, b, _ = run_cli(fx, "main")
    cfg = json.loads((b[0] / "config.json").read_text())
    cfg["code_hashes"]["eval/baseline_b/prompt_b.py"] = "0" * 64
    (b[0] / "config.json").write_text(json.dumps(cfg))
    with pytest.raises(SystemExit, match="not comparable"):
        F.main(["compare", "--run-a", str(a[0]), "--run-b", str(b[0]), "--acceptance-dir", fx.dir, "--manifest", fx.manifest])


# --- stress suite --------------------------------------------------------------------------------------------------------------------------

def test_stress_dry_run_sends_requests_only_for_cases_a_model_should_see_and_reports_each_error_kind_apart(fx):
    code, privs, pubs = run_cli(fx, "stress")
    assert code == 0
    st = json.loads((privs[0] / "summary.json").read_text())["stress"]
    t, by = st["total"], st["by_type"]
    for ty in ("1", "2"):
        assert by[ty]["model_requests"] == 0 and by[ty]["input_rejected_as_expected"] == by[ty]["cases"], ty
    for ty in ("10", "11"):
        assert by[ty]["model_requests"] == 0 and by[ty]["injected_fault_halts_as_expected"] == by[ty]["cases"], ty
    assert by["9"]["input_rejected_as_expected"] == 4 and by["9"]["model_requests"] == 2
    assert t["input_rejected_as_expected"] == 16 and t["injected_fault_halts_as_expected"] == 12 and t["model_requests"] == 38 == t["started"] - 28
    assert {"missed_halt", "needless_halt", "model_unusable_replies", "model_wrong_primary", "interface_errors"} <= set(t)
    public = "".join(p.read_text() for p in pubs[0].iterdir())
    assert MARK not in public and "Telemetry:" not in public


def test_stress_interface_errors_and_unusable_replies_are_counted_apart_from_wrong_labels(fx):
    # the 3rd and 7th model requests fail (interface errors); the 12th returns prose (an unusable reply)
    _, privs, _ = run_cli(fx, "stress", plan='{"3": "rate_limit", "7": "timeout", "12": "prose"}')
    t = json.loads((privs[0] / "summary.json").read_text())["stress"]["total"]
    assert t["interface_errors"] == 2 and t["model_unusable_replies"] == 1
    assert t["needless_halt"] + t["missed_halt"] >= 0 and t["input_rejected_as_expected"] == 16


def test_stress_budget_cap_stops_before_sending(fx):
    _, privs, _ = run_cli(fx, "stress", extra=["--max-calls", "5"])
    s = json.loads((privs[0] / "summary.json").read_text())
    assert s["status"] == "stopped_early" and s["requests_that_reached_the_client"] == 5


# --- the offline budget -----------------------------------------------------------------------------------------------------------------------

def test_plan_lists_requests_tokens_and_cost_bounds_without_any_private_data(capsys):
    assert F.main(["plan"]) == 0
    out = json.loads(capsys.readouterr().out)
    prog = out["programme"]
    assert prog["main_runs"] == 2 and prog["records_per_main_run"] == 300 and prog["r1_r2_requests"] == 0
    assert prog["stress_model_requests_upper_bound"] == 35 and prog["stress_no_request_cases_at_least"] == 20 and prog["total_model_requests_upper_bound"] == 635
    th, ex = out["theoretical_upper_bound"], out["expected_from_the_dev_run"]
    assert th["tokens"] > 635 * 2048 and float(th["usd"]) > float(out["proposed_caps"]["combined"]["usd"])        # the bound is above the caps: the caps are what is spent
    lo, hi = (float(x) for x in ex["usd_for_the_programme"].split(" to "))
    assert 0.25 < lo < hi < float(out["proposed_caps"]["combined"]["usd"]) and "estimate" in ex["caveat"]
    caps = out["proposed_caps"]
    assert caps["combined"] == {"max_calls": 640, "max_tokens": 1_300_000, "usd": "0.55"} and "stopped_early" in caps["how_they_work"]


def test_plan_with_files_gives_exact_numbers_and_prints_no_record(fx, capsys):
    assert F.main(["plan", "--acceptance-dir", fx.dir, "--manifest", fx.manifest]) == 0
    out = capsys.readouterr().out
    assert MARK not in out and json.loads(out)["exact_from_the_given_files"]["stress_model_requests"] == 38
