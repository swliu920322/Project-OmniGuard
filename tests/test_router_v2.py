"""Backend router_v2: same rules, same prompt, same parser and same decisions as the evaluation path; opt-in wiring into brain.py."""
import hashlib
import pytest
import importlib.util
import json
import pathlib
import sys
from unittest.mock import MagicMock


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


def test_the_registry_has_the_opt_in_tenant_and_the_old_tenants_have_no_router_mode(scenario_registry):
    assert scenario_registry["Tenant-Alpha-Extended"]["router_mode"] == "extended"
    assert "router_mode" not in scenario_registry["Tenant-Alpha"] and "router_mode" not in scenario_registry["Tenant-Beta"]


def test_validate_actions_never_loosens_a_halt_or_a_speed_cap():
    move = {"motion": "MOVE", "speed_cap": False}
    capped = {"motion": "MOVE_LIMITED", "speed_cap": True}
    halt = {"motion": "HALT", "speed_cap": False}
    assert V.validate_actions([{"action": "move", "speed": 50}], move, 50) == []
    assert V.validate_actions([{"action": "move", "speed": 51}], move, 50)                       # above the request's own limit
    assert V.validate_actions([{"action": "move", "speed": 250}], capped, 1000) == []
    assert V.validate_actions([{"action": "move", "speed": 251}], capped, 1000)                  # above 2.5 m/s once OVERSPEED is on
    assert V.validate_actions([{"action": "move", "speed": 10}], halt, 50)                       # only stop is allowed while halted
    assert V.validate_actions([{"action": "stop"}], halt, 50) == []
    for bad in (None, [], {}, "x", [{"speed": 1}], [{"action": "spray_water"}], [None]):
        assert V.validate_actions(bad, move, 50), bad


def test_the_action_contract_per_action():
    move = {"motion": "MOVE", "speed_cap": False}
    v = lambda a: V.validate_actions(a, move, 100)
    assert v([{"action": "move"}]) and v([{"action": "stop", "speed": 30}]) and v([{"action": "turn", "degree": "fast", "speed": 20}])        # the three review counter-examples
    assert v([{"action": "turn", "degree": 90}]) and v([{"action": "turn", "speed": 5}]) and v([{"action": "turn", "degree": 181, "speed": 5}])
    assert v([{"action": "turn", "degree": -181, "speed": 5}]) and v([{"action": "turn", "degree": True, "speed": 5}]) and v([{"action": "turn", "degree": 1.5, "speed": 5}])
    assert v([{"action": "move", "speed": float("nan")}]) and v([{"action": "move", "speed": float("inf")}]) and v([{"action": "stop", "speed": float("nan")}])
    assert v([{"action": "stop"}]) == [] and v([{"action": "stop", "speed": 0}]) == [] and v([{"action": "move", "speed": 0}]) == []
    assert v([{"action": "turn", "degree": -180, "speed": 100}, {"action": "turn", "degree": 180, "speed": 0}]) == []
    assert V.validate_actions([{"action": "backward", "speed": 1}], move, 100, allowed=("stop", "backward"))      # no contract for it, even if a tenant lists it


def test_no_retry_client_checks_that_the_settings_took_effect():
    class Ok:
        max_retries, timeout = 2, 600.0

        def with_options(self, **o):
            self.max_retries, self.timeout = o["max_retries"], o["timeout"]
            return self

    c = V.no_retry_client(Ok(), 30.0)
    assert c.max_retries == 0 and c.timeout == 30.0

    class Ignores(Ok):
        def with_options(self, **o):
            return self

    with pytest.raises(RuntimeError):
        V.no_retry_client(Ignores())
    with pytest.raises(RuntimeError):
        V.no_retry_client(object().__class__.__new__(type("NoOptions", (), {"with_options": lambda self, **o: self})))
