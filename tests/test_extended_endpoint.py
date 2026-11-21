"""The whole HTTP flow of the extended tenant, with fake models and a fake Cosmos: Router decision -> Safety -> Compiler -> final action.

These tests go through /api/simulate_agent, not just decide(): the constraints of the evaluation must survive to the final action.
"""
import json
import pathlib
import sys
from unittest.mock import MagicMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src/cloud-orchestrator"))
EXT = "embodied_brain.extended"
BODY = {"tenant_id": "Tenant-Alpha-Extended", "obstacle_distance_cm": 400, "velocity": 1.0, "hp": 80, "battery": 60, "temperature": 35, "target_speed": 50}
CLEAR = json.dumps({"primary": "NORMAL_NAV", "note_status": None})


class FakeSDK:
    """Stands in for the OpenAI client; counts model requests; with_options() really changes what it reports."""

    def __init__(self, content=CLEAR, finish="stop", exc=None, honour_options=True):
        self.content, self.finish, self.exc, self.honour = content, finish, exc, honour_options
        self.requests, self.max_retries, self.timeout, self.options = 0, 2, 600.0, None
        self.chat = type("Chat", (), {"completions": type("C", (), {"create": staticmethod(self._create)})()})()

    def with_options(self, **o):
        self.options = o
        if self.honour:
            self.max_retries, self.timeout = o["max_retries"], o["timeout"]
        return self

    def _create(self, **kw):
        self.requests += 1
        if self.exc:
            raise self.exc
        return MagicMock(choices=[MagicMock(message=MagicMock(content=self.content), finish_reason=self.finish)], usage=None)


@pytest.fixture
def world():
    """A fresh app plus every external dependency replaced and counted."""
    from embodied_brain.brain import _rate_limit_store, brain_router
    _rate_limit_store.clear()
    app = FastAPI()
    app.include_router(brain_router)
    w = type("World", (), {})()
    w.http = TestClient(app)
    w.sdk = FakeSDK()
    w.cosmos = MagicMock()
    w.cosmos.read_item.return_value = {"id": "Robo-A1", "status": "ACTIVE"}
    w.cosmos.client_connection.last_request_charge = 10.67
    w.ask = MagicMock(side_effect=["PASS", '[{"action":"move","speed":30}]'])
    w.model_lookup = MagicMock(side_effect=lambda: (w.sdk, "m"))
    with patch(f"{EXT}.get_cosmos_container", return_value=w.cosmos) as c, patch(f"{EXT}.ask_agent_bounded", w.ask), patch(f"{EXT}.get_llm_client_and_model", w.model_lookup):
        w.cosmos_getter = c
        yield w


def post(w, **over):
    body = {**BODY, **over}
    return w.http.post("/api/simulate_agent", json={k: v for k, v in body.items() if v is not Ellipsis})


def untouched(w):
    return w.cosmos_getter.call_count == 0 and w.model_lookup.call_count == 0 and w.sdk.requests == 0 and w.ask.call_count == 0


def stop_of(r):
    fa = r.json()["final_action"]
    assert len(fa) == 1 and fa[0]["action"] == "stop", fa
    return fa[0]


# --- 1. raw input is checked first --------------------------------------------------------------------------------------

@pytest.mark.parametrize("over", [{"hp": None}, {"hp": Ellipsis}, {"battery": Ellipsis}, {"velocity": Ellipsis}, {"temperature": None}, {"obstacle_distance_cm": Ellipsis},
                                  {"obstacle_distance_cm": None}, {"hp": "abc"}, {"battery": 180}, {"hp": True}, {"temperature": 400}, {"obstacle_distance_cm": 30.123},
                                  {"operator_note": "x" * 501}, {"operator_note": 5}, {"target_speed": "fast"}, {"target_speed": -1}])
def test_a_missing_or_illegal_value_is_an_explicit_halt_with_no_default_and_no_external_call(world, over):
    r = post(world, **over)
    assert r.status_code == 200 and r.json()["input_valid"] is False
    assert stop_of(r)["halt_reasons"] == ["INVALID_INPUT"] and r.json()["router_decision"]["invalid_reason"]
    assert untouched(world), over


def test_a_missing_hp_is_not_filled_in_with_100(world):
    r = post(world, hp=Ellipsis)
    assert r.status_code == 200 and stop_of(r)["halt_reasons"] == ["INVALID_INPUT"] and world.sdk.requests == 0


# --- 2. emergency stop -------------------------------------------------------------------------------------------------

def test_emergency_stop_needs_no_external_call_and_no_rate_limit_slot(world):
    first = post(world)                                                                        # uses up the one request per 5 s
    assert first.status_code == 200
    world.sdk.requests = world.ask.call_count = world.cosmos_getter.call_count = world.model_lookup.call_count = 0
    r = post(world, emergency_stop=True)
    assert r.status_code == 200 and stop_of(r)["halt_reasons"] == ["ESTOP"] and untouched(world)
    assert post(world).status_code == 429                                                       # the ordinary request is still limited


def test_emergency_stop_works_even_if_everything_else_is_garbage(world):
    r = post(world, emergency_stop=True, hp="abc", battery=Ellipsis, obstacle_distance_cm=Ellipsis)
    assert stop_of(r)["halt_reasons"] == ["ESTOP"] and untouched(world)


@pytest.mark.parametrize("flag", ["false", "true", "False", 0, 1, "", [], {}, None])
def test_emergency_stop_must_be_a_json_boolean(world, flag):
    r = post(world, emergency_stop=flag)
    assert stop_of(r)["halt_reasons"] == ["INVALID_INPUT"] and "boolean" in r.json()["router_decision"]["invalid_reason"] and untouched(world)


def test_a_false_flag_or_no_flag_runs_normally(world):
    r = post(world, emergency_stop=False)
    assert r.json()["final_action"] == [{"action": "move", "speed": 30}] and world.sdk.requests == 1


def test_an_explicit_null_flag_is_not_false_and_calls_nothing(world):
    r = post(world, emergency_stop=None)
    assert r.status_code == 200 and stop_of(r)["halt_reasons"] == ["INVALID_INPUT"] and "boolean" in r.json()["router_decision"]["invalid_reason"]
    assert untouched(world)


# --- 3. SDK retries off, timeout fixed, one request -----------------------------------------------------------------------------

def test_the_model_client_has_retries_off_a_fixed_timeout_and_is_asked_once(world):
    post(world)
    assert world.sdk.options == {"max_retries": 0, "timeout": 60.0} and world.sdk.max_retries == 0 and world.sdk.requests == 1


def test_if_retries_cannot_be_confirmed_off_the_vehicle_halts_without_a_request(world):
    world.sdk = FakeSDK(honour_options=False)
    world.model_lookup.side_effect = lambda: (world.sdk, "m")
    r = post(world)
    assert stop_of(r)["halt_reasons"] == ["API_ERROR"] and "retries" in r.json()["router_decision"]["invalid_reason"] and world.sdk.requests == 0


def test_an_api_fault_halts_and_is_not_retried(world):
    world.sdk = FakeSDK(exc=type("InternalServerError", (Exception,), {"status_code": 500})("500"))
    world.model_lookup.side_effect = lambda: (world.sdk, "m")
    r = post(world)
    assert stop_of(r)["halt_reasons"] == ["API_ERROR"] and world.sdk.requests == 1 and world.ask.call_count == 0


# --- 4. the Router's whole decision survives to the final action ---------------------------------------------------------------

def test_cool_and_the_charging_follow_up_are_in_the_final_action_and_the_decision(world):
    r = post(world, temperature=75, battery=12)
    fa = stop_of(r)
    assert fa["halt_reasons"] == ["OVERHEAT"] and fa["holds"] == ["COOL"] and fa["deferred"] == ["RETURN_TO_CHARGE"] and fa["risk_set"] == ["OVERHEAT", "LOW_BATTERY"]
    d = r.json()["router_decision"]
    assert d["action"]["holds"] == ["COOL"] and d["action"]["deferred"] == ["RETURN_TO_CHARGE"] and d["floor_override"] is True and d["model_called"] is True
    assert world.ask.call_count == 0                                                           # Safety and Compiler are not consulted after a halt
    assert [t["status"] for t in r.json()["pipeline_trace"][1:]] == ["SHORT_CIRCUIT", "SHORT_CIRCUIT"] and "holds=['COOL']" in r.json()["pipeline_trace"][0]["decision"]


def test_lock_is_kept_for_low_health(world):
    fa = stop_of(post(world, hp=30))
    assert fa["holds"] == ["LOCK"] and fa["halt_reasons"] == ["LOW_HEALTH"]


def test_the_physical_gate_halts_before_a_charging_trip(world):
    fa = stop_of(post(world, battery=3))
    assert "GATE" in fa["halt_reasons"] and fa["deferred"] == ["RETURN_TO_CHARGE"]


def test_low_battery_keeps_its_goal_as_a_structured_goal_only_and_the_compiler_is_told_the_constraints(world):
    world.sdk = FakeSDK(content=json.dumps({"primary": "LOW_BATTERY", "note_status": None}))
    world.model_lookup.side_effect = lambda: (world.sdk, "m")
    r = post(world, battery=12)
    d = r.json()["router_decision"]["action"]
    assert d["motion"] == "MOVE" and d["goal"] == "CHARGER" and r.json()["final_action"] == [{"action": "move", "speed": 30}]
    assert "goal=CHARGER" in world.ask.call_args_list[1].args[1] and "0 and 50 cm/s" in world.ask.call_args_list[1].args[1]


# --- 5. the Compiler cannot loosen the decision --------------------------------------------------------------------------------

def _with_compiler(w, output):
    w.ask.side_effect = ["PASS", output]


def test_a_compiler_speed_above_the_overspeed_cap_is_rejected_by_code(world):
    world.sdk = FakeSDK(content=json.dumps({"primary": "OVERSPEED", "note_status": None}))
    world.model_lookup.side_effect = lambda: (world.sdk, "m")
    _with_compiler(world, '[{"action":"move","speed":999}]')
    r = post(world, velocity=3.0, target_speed=1000)                                           # the request would allow 1000; the cap is 250
    assert r.json()["router_decision"]["action"]["speed_cap"] is True
    fa = stop_of(r)
    assert fa["reason"] == "constraint_violation" and r.json()["constraint_violations"] and r.json()["pipeline_trace"][-1]["status"] == "REJECTED_BY_CODE"


def test_a_speed_inside_the_cap_is_accepted_under_overspeed(world):
    world.sdk = FakeSDK(content=json.dumps({"primary": "OVERSPEED", "note_status": None}))
    world.model_lookup.side_effect = lambda: (world.sdk, "m")
    _with_compiler(world, '[{"action":"move","speed":200}]')
    r = post(world, velocity=3.0, target_speed=1000)
    assert r.json()["final_action"] == [{"action": "move", "speed": 200}] and r.json()["constraint_violations"] == []


CONTRACT_BREAKERS = ['[{"action":"move"}]', '[{"action":"stop","speed":30}]', '[{"action":"turn","degree":"fast","speed":20}]', '[{"action":"turn","degree":90}]',
                     '[{"action":"turn","speed":20}]', '[{"action":"turn","degree":200,"speed":20}]', '[{"action":"turn","degree":true,"speed":20}]',
                     '[{"action":"turn","degree":90.5,"speed":20}]', '[{"action":"move","speed":NaN}]', '[{"action":"move","speed":Infinity}]',
                     '[{"action":"stop","speed":-1}]', '[{"action":"stop","speed":"0"}]']


@pytest.mark.parametrize("output", CONTRACT_BREAKERS)
def test_the_four_review_counter_examples_and_their_relatives_are_stopped_by_the_action_contract(world, output):
    _with_compiler(world, output)
    r = post(world)
    assert r.status_code == 200 and stop_of(r)["reason"] == "constraint_violation" and r.json()["constraint_violations"], output


def test_a_move_without_a_speed_is_stopped_under_overspeed_too(world):
    world.sdk = FakeSDK(content=json.dumps({"primary": "OVERSPEED", "note_status": None}))
    world.model_lookup.side_effect = lambda: (world.sdk, "m")
    _with_compiler(world, '[{"action":"move"}]')
    r = post(world, velocity=3.0, target_speed=1000)
    assert r.json()["router_decision"]["action"]["speed_cap"] is True and stop_of(r)["reason"] == "constraint_violation"
    assert any("needs a numeric speed" in v for v in r.json()["constraint_violations"])


@pytest.mark.parametrize("output", ['[{"action":"stop"}]', '[{"action":"stop","speed":0}]', '[{"action":"move","speed":0}]',
                                    '[{"action":"turn","degree":-90,"speed":10},{"action":"stop"}]', '[{"action":"turn","degree":180,"speed":0}]'])
def test_contract_conforming_outputs_are_accepted(world, output):
    _with_compiler(world, output)
    r = post(world)
    assert r.json()["final_action"] == json.loads(output) and r.json()["constraint_violations"] == []


@pytest.mark.parametrize("output", ['[{"action":"move","speed":999}]', '[{"action":"fast_forward","speed":10}]', 'not json', '[]', '{"action":"move"}',
                                    '[{"action":"move","speed":-5}]', '[{"action":"move","speed":"fast"}]', '[{"raw_output":"x"}]', '[{"action":"move","speed":true}]'])
def test_any_compiler_output_that_breaks_the_request_or_the_schema_becomes_a_stop(world, output):
    _with_compiler(world, output)
    r = post(world)                                                                            # target_speed 50, nothing risky
    assert stop_of(r)["reason"] == "constraint_violation" and r.json()["constraint_violations"], output


def test_a_markdown_fenced_but_valid_compiler_answer_is_accepted(world):
    _with_compiler(world, '```json\n[{"action":"turn","degree":90,"speed":20},{"action":"move","speed":30}]\n```')
    assert post(world).json()["final_action"] == [{"action": "turn", "degree": 90, "speed": 20}, {"action": "move", "speed": 30}]


def test_a_safety_block_keeps_the_decision_evidence(world):
    world.ask.side_effect = ["BLOCK: too close"]
    r = post(world, battery=12)
    fa = stop_of(r)
    assert fa["reason"] == "safety_override" and fa["halt_reasons"] == ["SAFETY_BLOCK"] and r.json()["router_decision"]["action"]["goal"] == "CHARGER"


def test_a_lax_model_cannot_lift_a_close_obstacle_through_the_whole_flow(world):
    r = post(world, obstacle_distance_cm=10)
    fa = stop_of(r)
    assert fa["halt_reasons"] == ["CRITICAL_OBSTACLE"] and r.json()["router_decision"]["floor_override"] is True and world.ask.call_count == 0


def test_the_operator_note_reaches_the_model_and_an_affirmed_report_halts(world):
    world.sdk = FakeSDK(content=json.dumps({"primary": "CRITICAL_OBSTACLE", "note_status": "AFFIRMED_CURRENT"}))
    world.model_lookup.side_effect = lambda: (world.sdk, "m")
    r = post(world, operator_note="A worker is standing in the aisle ahead.")
    assert stop_of(r)["halt_reasons"] == ["CRITICAL_OBSTACLE"] and r.json()["router_decision"]["prediction"]["note_status"] == "AFFIRMED_CURRENT"


def test_an_unexpected_error_inside_the_flow_is_a_stop_not_a_silent_pass(world):
    world.ask.side_effect = RuntimeError("boom")
    r = post(world)
    assert r.status_code == 500 and stop_of(r)["halt_reasons"] == ["INTERNAL_ERROR"]


def test_cosmos_being_down_does_not_block_a_valid_request(world):
    world.cosmos_getter.side_effect = RuntimeError("no cosmos")
    r = post(world)
    assert r.status_code == 200 and r.json()["final_action"] == [{"action": "move", "speed": 30}] and r.json()["cloud_metrics"]["cosmos_write_latency_ms"] is None


# --- 6. legacy tenants are untouched -----------------------------------------------------------------------------------------

@pytest.fixture
def legacy(world):
    with patch("embodied_brain.brain.load_scenario_config", side_effect=lambda t: {"agent_router_prompt": "Classify telemetry into: [CRITICAL_OBSTACLE, NORMAL_NAV, SENSOR_ERROR]",
                                                                               "agent_safety_rules": "Maintain 30cm minimum distance.", "agent_execution_schema": "[...]"}), \
         patch("embodied_brain.brain.get_cosmos_container", side_effect=RuntimeError("no cosmos")), patch("embodied_brain.brain.ask_agent") as ask:
        yield world, ask


def test_legacy_tenants_keep_their_flow_defaults_and_errors(legacy):
    world, ask = legacy
    ask.side_effect = ["NORMAL_NAV", "PASS", '[{"action":"move","speed":30}]']
    r = world.http.post("/api/simulate_agent", json={"tenant_id": "Tenant-Alpha", "obstacle_distance_cm": 400})        # hp, battery default as before
    assert r.status_code == 200 and r.json()["pipeline_trace"][0] == {"agent": "Router", "decision": "NORMAL_NAV"} and ask.call_count == 3
    assert ask.call_args_list[0].kwargs == {"max_completion_tokens": 20} and "router_decision" not in r.json()
    from embodied_brain.brain import _rate_limit_store
    _rate_limit_store.clear()
    r = world.http.post("/api/simulate_agent", json={"tenant_id": "Tenant-Alpha"})
    assert r.status_code == 400 and r.json()["error"] == "Missing required fields: tenant_id, obstacle_distance_cm"
    _rate_limit_store.clear()
    ask.reset_mock(side_effect=True)
    ask.side_effect = ["SENSOR_ERROR"]
    r = world.http.post("/api/simulate_agent", json={"tenant_id": "Tenant-Alpha", "obstacle_distance_cm": 400, "emergency_stop": True})
    assert r.json()["final_action"] == [{"action": "stop"}] and ask.call_count == 1       # a legacy tenant ignores the flag exactly as before


def test_the_docs_say_the_goal_is_a_structured_goal_and_not_proof_of_arrival():
    text = (ROOT / "src/cloud-orchestrator/router_v2/README.md").read_text()
    assert "structured goal" in text and "must not be claimed" in text


# --- Safety and Compiler faults are classified stops, not INTERNAL_ERROR ----------------------------------------------------

@pytest.mark.parametrize("kind", ["TIMEOUT", "RATE_LIMIT", "API_ERROR", "BAD_REPLY"])
def test_a_safety_fault_stops_with_its_kind_and_the_compiler_is_not_asked(world, kind):
    from embodied_brain.bounded_agent import AgentFault
    world.ask.side_effect = [AgentFault(kind)]
    r = post(world)
    stop = stop_of(r)
    assert r.status_code == 200 and stop["reason"] == "safety_fault" and stop["halt_reasons"] == [kind]
    assert world.ask.call_count == 1
    assert [t["status"] for t in r.json()["pipeline_trace"] if t.get("agent") == "Safety"] == ["FAULT"]


@pytest.mark.parametrize("kind", ["TIMEOUT", "RATE_LIMIT", "API_ERROR", "BAD_REPLY"])
def test_a_compiler_fault_stops_with_its_kind(world, kind):
    from embodied_brain.bounded_agent import AgentFault
    world.ask.side_effect = ["PASS", AgentFault(kind)]
    r = post(world)
    stop = stop_of(r)
    assert r.status_code == 200 and stop["reason"] == "compiler_fault" and stop["halt_reasons"] == [kind]
    assert [t["status"] for t in r.json()["pipeline_trace"] if t.get("agent") == "Action Compiler"] == ["FAULT"]
