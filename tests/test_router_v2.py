"""Backend router_v2: same rules, same prompt, same parser and same decisions as the evaluation path; opt-in wiring into brain.py."""
import hashlib
import importlib.util
import json
import pathlib
import sys
import time
from unittest.mock import MagicMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

ROOT = pathlib.Path(__file__).resolve().parents[1]
for sub in ("src/cloud-orchestrator", "eval/spec", "eval/baseline_b"):
    sys.path.insert(0, str(ROOT / sub))
import evaluate as E  # noqa: E402
import prompt_b as PB  # noqa: E402
import reference_labeler as RL  # noqa: E402
import run_dev_eval as RUN  # noqa: E402
import router_v2 as V  # noqa: E402
from router_v2 import pipeline as PL, prompt as VP, rules as VR  # noqa: E402
V.pipeline = PL

DEV = [json.loads(line) for line in (ROOT / "eval/dev/dev_set.jsonl").read_text().splitlines()]


def _sha(path):
    return hashlib.sha256(pathlib.Path(path).read_bytes()).hexdigest()


def test_the_backend_rules_are_byte_identical_to_the_frozen_spec_code():
    assert _sha(ROOT / "src/cloud-orchestrator/router_v2/rules.py") == _sha(ROOT / "eval/spec/reference_labeler.py")


def test_the_backend_prompt_is_the_b10_prompt_and_its_parser_agrees_on_a_corpus():
    assert VP.SYSTEM_PROMPT == PB.SYSTEM_PROMPT and VP.PROMPT_VERSION == "B-1.0"
    assert hashlib.sha256(VP.SYSTEM_PROMPT.encode()).hexdigest() == "9247896719b66e139d0155f6f48716805805e6ba3ceec356c8264ee2b3d4a609"
    corpus = ['{"primary":"NORMAL_NAV","note_status":null}', '{"primary":"OVERHEAT","primary":"NORMAL_NAV","note_status":null}',
              '```json\n{}\n```', 'prose', '', None, '{"primary":"NORMAL_NAV"}', '{"primary":"LOW_BATTERY","note_status":"NEGATED"}',
              '{"primary":"HARDWARE_FAULT","note_status":null}', '["x"]', '{"primary":"NORMAL_NAV","note_status":"MAYBE"}'] + \
             [json.dumps({"primary": p, "note_status": s}) for p in RL.CLASSES for s in [None, *RL.NOTE_STATUSES]]
    for c in corpus:
        assert VP.parse_reply(c) == PB.parse_reply(c), c
    assert VP.build_messages("x") == PB.build_messages("x")


def _reply_variants(rec):
    gold = {"primary": rec["gold"]["primary"], "note_status": rec["note_status"]}
    return [json.dumps(gold), json.dumps({"primary": "NORMAL_NAV", "note_status": None}),
            json.dumps({"primary": "OVERSPEED", "note_status": rec["note_status"]}), "The class is NORMAL_NAV.",
            json.dumps({"primary": gold["primary"]}), json.dumps({"primary": gold["primary"], "note_status": "NEGATED" if rec["note"] else None})]


def test_backend_and_evaluation_paths_give_identical_executed_actions_for_every_dev_record_and_reply_variant():
    for rec in DEV:
        for content in _reply_variants(rec):
            backend = V.decide(rec["telemetry"], rec["note"], lambda s, u, c=content: V.ModelReply(content=c, finish_reason="stop"))["executed"]
            cap = {"request": {}, "response": {"choices": [{"finish_reason": "stop", "message": {"content": content}}], "usage": None, "model": "m"}}
            ev = E.executed(RUN.build_call_record(1, rec, cap), rec)
            assert backend == ev, (rec["id"], content)


def test_the_model_sees_the_same_text_and_the_request_has_the_baseline_b_shape():
    rec = DEV[0]
    seen = {}

    class Client:
        class chat:
            class completions:
                @staticmethod
                def create(**kw):
                    seen.update(kw)
                    return MagicMock(choices=[MagicMock(message=MagicMock(content=json.dumps({"primary": "LOW_HEALTH", "note_status": "IRRELEVANT"})), finish_reason="stop")], usage=None)

    out = V.decide(rec["telemetry"], rec["note"], V.openai_model_call(Client, "deepseek-v4-flash"))
    assert out["user_input"] == rec["rendered_input"]
    assert seen == {"model": "deepseek-v4-flash", "messages": PB.build_messages(rec["rendered_input"]), "temperature": 0, "max_tokens": 2048}
    assert out["executed"]["valid"] and out["executed"]["primary"] == "LOW_HEALTH"


def test_invalid_input_never_reaches_the_model_and_halts():
    calls = []
    bad_inputs = [({"distance_cm": -5, "velocity_ms": 1, "hp": 80, "battery_pct": 60, "temperature_c": 35}, None),
                  ({"distance_cm": 30, "velocity_ms": 1, "hp": 80, "battery_pct": 180, "temperature_c": 35}, None),
                  ({}, None), ({"distance_cm": 30, "velocity_ms": 1, "hp": None, "battery_pct": 60, "temperature_c": 35}, None),
                  ({"distance_cm": 30, "velocity_ms": 1, "hp": 80, "battery_pct": 60, "temperature_c": 35}, "x" * 501),
                  ({"distance_cm": 30, "velocity_ms": 1, "hp": 80, "battery_pct": 60, "temperature_c": 35}, 123),
                  ({"distance_cm": 30.123, "velocity_ms": 1, "hp": 80, "battery_pct": 60, "temperature_c": 35}, None)]  # 3 decimals
    for rec, note in bad_inputs:
        out = V.decide(rec, note, lambda s, u: calls.append(u))
        assert out["model_called"] is False and out["executed"]["action"]["motion"] == "HALT" and "invalid_reason" in out, (rec, note)
        assert out["executed"]["action"]["halt_reasons"][0] == "INVALID_INPUT"
    assert calls == []


def test_faults_truncation_and_unparseable_replies_halt():
    rec = DEV[2]
    for fault in RL.FAULTS:
        out = V.decide(rec["telemetry"], rec["note"], lambda s, u, f=fault: V.ModelReply(fault=f))
        assert out["model_called"] and out["executed"]["action"]["halt_reasons"][0] == fault
    cut = V.decide(rec["telemetry"], rec["note"], lambda s, u: V.ModelReply(content=json.dumps({"primary": "NORMAL_NAV", "note_status": rec["note_status"]}), finish_reason="length"))
    assert cut["executed"]["valid"] is False and "finish_reason" in cut["parse_error"]
    assert V.pipeline.fault_of(type("RateLimitError", (Exception,), {"status_code": 429})()) == "RATE_LIMIT"
    assert V.pipeline.fault_of(type("APITimeoutError", (Exception,), {})()) == "TIMEOUT"
    assert V.pipeline.fault_of(RuntimeError("x")) == "API_ERROR"


def test_the_adapter_turns_exceptions_into_faults_and_never_retries():
    n = {"calls": 0}

    class Boom:
        class chat:
            class completions:
                @staticmethod
                def create(**kw):
                    n["calls"] += 1
                    raise type("InternalServerError", (Exception,), {"status_code": 500})("500")

    out = V.decide(DEV[2]["telemetry"], DEV[2]["note"], V.openai_model_call(Boom, "m"))
    assert out["executed"]["action"]["halt_reasons"] == ["API_ERROR"] and n["calls"] == 1


def test_a_lax_model_cannot_lift_a_telemetry_risk_and_the_stop_flag_wins():
    lax = lambda s, u: V.ModelReply(content=json.dumps({"primary": "NORMAL_NAV", "note_status": None}), finish_reason="stop")
    close = {"distance_cm": 10, "velocity_ms": 1, "hp": 80, "battery_pct": 60, "temperature_c": 35}
    assert V.decide(close, None, lax)["executed"]["action"]["motion"] == "HALT"
    clear = {**close, "distance_cm": 400}
    assert V.decide(clear, None, lax)["executed"]["action"]["motion"] == "MOVE"
    assert V.decide(clear, None, lax, estop=True)["executed"]["action"]["halt_reasons"] == ["ESTOP"]


# --- opt-in wiring in brain.py ----------------------------------------------------------------------------------------

EXT_CONFIG = {"router_mode": "extended", "agent_router_prompt": "unused", "agent_safety_rules": "Maintain 30cm minimum distance.",
              "agent_execution_schema": "[{'action': 'stop'|'turn'|'move', 'degree': int, 'speed': int}]"}
LEGACY_CONFIG = {"agent_router_prompt": "Classify telemetry into: [CRITICAL_OBSTACLE, NORMAL_NAV, SENSOR_ERROR]",
                 "agent_safety_rules": "Maintain 30cm minimum distance.", "agent_execution_schema": "[...]"}


@pytest.fixture
def api():
    from embodied_brain.brain import brain_router, _rate_limit_store
    _rate_limit_store.clear()
    app = FastAPI()
    app.include_router(brain_router)
    return TestClient(app)


def _post(api, config, body, model_reply=None, legacy_replies=None):
    from embodied_brain import brain
    with patch.object(brain, "load_scenario_config", return_value=config), patch.object(brain, "get_cosmos_container", side_effect=RuntimeError("no cosmos")), \
         patch.object(brain, "get_llm_client_and_model", return_value=(object(), "m")), \
         patch("router_v2.openai_model_call", return_value=model_reply or (lambda s, u: V.ModelReply(fault="API_ERROR"))), \
         patch.object(brain, "ask_agent", side_effect=legacy_replies or ["NORMAL_NAV", "PASS", '[{"action":"move","speed":30}]']) as ask:
        r = api.post("/api/simulate_agent", json=body)
    return r, ask


BODY = {"tenant_id": "T", "obstacle_distance_cm": 400, "velocity": 1.0, "hp": 80, "battery": 60, "temperature": 35}


def test_extended_tenant_through_the_http_endpoint(api):
    lax = lambda s, u: V.ModelReply(content=json.dumps({"primary": "NORMAL_NAV", "note_status": None}), finish_reason="stop")
    r, ask = _post(api, EXT_CONFIG, {**BODY, "obstacle_distance_cm": 10}, lax)
    body = r.json()
    assert r.status_code == 200 and body["final_action"] == [{"action": "stop"}]
    assert body["pipeline_trace"][0]["decision"].startswith("CRITICAL_OBSTACLE | motion=HALT") and "floor_override=True" in body["pipeline_trace"][0]["decision"]
    assert [t["status"] for t in body["pipeline_trace"][1:]] == ["SHORT_CIRCUIT", "SHORT_CIRCUIT"] and ask.call_count == 0


def test_extended_tenant_continues_to_safety_and_compiler_when_nothing_halts(api):
    ok = lambda s, u: V.ModelReply(content=json.dumps({"primary": "NORMAL_NAV", "note_status": None}), finish_reason="stop")
    r, ask = _post(api, EXT_CONFIG, BODY, ok, legacy_replies=["PASS", '[{"action":"move","speed":30}]'])
    body = r.json()
    assert r.status_code == 200 and body["final_action"] == [{"action": "move", "speed": 30}] and ask.call_count == 2
    assert "motion=MOVE" in body["pipeline_trace"][0]["decision"]


def test_extended_tenant_uses_the_operator_note_and_the_stop_flag(api):
    seen = {}

    def model(s, u):
        seen["user"] = u
        return V.ModelReply(content=json.dumps({"primary": "CRITICAL_OBSTACLE", "note_status": "AFFIRMED_CURRENT"}), finish_reason="stop")

    r, _ = _post(api, EXT_CONFIG, {**BODY, "operator_note": "A worker is standing in the aisle ahead."}, model)
    assert r.json()["final_action"] == [{"action": "stop"}] and seen["user"].endswith("Operator note: A worker is standing in the aisle ahead.")
    from embodied_brain.brain import _rate_limit_store
    _rate_limit_store.clear()
    r, _ = _post(api, EXT_CONFIG, {**BODY, "emergency_stop": True}, lambda s, u: V.ModelReply(content=json.dumps({"primary": "NORMAL_NAV", "note_status": None}), finish_reason="stop"))
    assert r.json()["final_action"] == [{"action": "stop"}] and "ESTOP" in r.json()["pipeline_trace"][0]["decision"]


def test_extended_tenant_with_an_api_fault_or_bad_input_stops_and_a_bad_input_is_not_sent(api):
    r, _ = _post(api, EXT_CONFIG, BODY)                                    # the model call fails
    assert r.json()["final_action"] == [{"action": "stop"}] and "halt_reasons=['API_ERROR']" in r.json()["pipeline_trace"][0]["decision"]
    from embodied_brain.brain import _rate_limit_store
    _rate_limit_store.clear()
    called = []
    r, _ = _post(api, EXT_CONFIG, {**BODY, "battery": 180}, lambda s, u: called.append(u))
    assert r.json()["final_action"] == [{"action": "stop"}] and called == [] and "model_called=False" in r.json()["pipeline_trace"][0]["decision"]


def test_legacy_tenants_are_untouched_by_the_extended_wiring(api):
    r, ask = _post(api, LEGACY_CONFIG, BODY)
    body = r.json()
    assert r.status_code == 200 and body["pipeline_trace"][0] == {"agent": "Router", "decision": "NORMAL_NAV"} and ask.call_count == 3
    first_call = ask.call_args_list[0]
    assert first_call.args[0] == LEGACY_CONFIG["agent_router_prompt"] and first_call.kwargs == {"max_completion_tokens": 20}
    from embodied_brain.brain import _rate_limit_store
    _rate_limit_store.clear()
    r, ask = _post(api, LEGACY_CONFIG, BODY, legacy_replies=["SENSOR_ERROR"])
    assert r.json()["final_action"] == [{"action": "stop"}] and ask.call_count == 1                      # the old short-circuit still works


def test_the_registry_has_the_opt_in_tenant_and_the_old_tenants_have_no_router_mode(scenario_registry):
    assert scenario_registry["Tenant-Alpha-Extended"]["router_mode"] == "extended"
    assert "router_mode" not in scenario_registry["Tenant-Alpha"] and "router_mode" not in scenario_registry["Tenant-Beta"]
