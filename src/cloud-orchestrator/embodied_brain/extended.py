# file: src/cloud-orchestrator/embodied_brain/extended.py
"""HTTP flow of the opt-in extended tenant (router_mode "extended"): spec 1.0 router, prompt B-1.0, code constraints kept to the end.

Order, so that nothing external is touched before it has to be:
 1. emergency stop (a strict boolean) -> stop at once, zero external calls;
 2. raw input check, no defaults and no int() casts -> a bad request is an explicit HALT result, zero external calls;
 3. only then Cosmos (best effort) and the model, with SDK retries off and a fixed timeout;
 4. the Router's whole decision (motion, goal, speed cap, COOL/LOCK holds, deferred follow-ups) is kept and returned; Safety and Compiler may
    only make the result stricter: the Compiler's actions are validated against the decision in code before they leave.
Legacy tenants never come through here.

`goal` (for example CHARGER) is a structured goal carried through the decision. Nothing here checks a path or a destination, so it is not
evidence that the vehicle reaches the charger.
"""
import json
import logging
import os
import time

from fastapi.responses import JSONResponse

from .utils import ask_agent, get_cosmos_container, get_llm_client_and_model, load_scenario_config

ROUTER_FIELDS = (("distance_cm", "obstacle_distance_cm"), ("velocity_ms", "velocity"), ("hp", "hp"), ("battery_pct", "battery"), ("temperature_c", "temperature"))
SDK_TIMEOUT_S = 60.0


def extended_tenant_config(tenant_id):
    """The tenant's config if it is an extended tenant, else None. Reads the local registry only."""
    try:
        cfg = load_scenario_config(tenant_id) if isinstance(tenant_id, str) and tenant_id else None
    except Exception:  # noqa: BLE001
        return None
    return cfg if cfg and cfg.get("router_mode") == "extended" else None


def _stop(reason, halt_reasons=None, holds=None, deferred=None, **extra):
    return [{"action": "stop", "reason": reason, "halt_reasons": halt_reasons or [reason], "holds": holds or [], "deferred": deferred or [], **extra}]


def _metrics(t1=0, t2=0, t3=0, cosmos=None):
    cosmos = cosmos or {}
    return {"cosmos_db_ru_charge": cosmos.get("ru"), "cosmos_write_latency_ms": cosmos.get("write_ms"), "cosmos_read_latency_ms": cosmos.get("read_ms"),
            "agent_1_latency_ms": t1, "agent_2_latency_ms": t2, "agent_3_latency_ms": t3,
            "execution_environment": "azure-functions" if os.environ.get("WEBSITE_INSTANCE_ID") else "local"}


def _respond(start, final_action, trace, decision, input_valid=True, violations=None, status=200, metrics=None):
    body = {"latency_ms": int((time.time() - start) * 1000), "final_action": final_action, "pipeline_trace": trace, "router_decision": decision,
            "input_valid": input_valid, "constraint_violations": violations or [], "cloud_metrics": metrics or _metrics()}
    return JSONResponse(status_code=status, content=body)


def _decision_view(res: dict) -> dict:
    ex, act = res["executed"], res["executed"]["action"]
    return {"valid": ex.get("valid", False), "primary": ex.get("primary"), "risk_set": ex.get("risk_set", []), "added_risks": ex.get("added_risks", []),
            "forced_by": ex.get("forced_by", []), "floor_override": ex.get("floor_override"), "action": act, "model_called": res.get("model_called", False),
            "prediction": res.get("prediction"), "parse_error": res.get("parse_error"), "fault": res.get("fault"), "invalid_reason": res.get("invalid_reason")}


def _halt(start, reasons, text, trace=None, **kw):
    action = {"motion": "HALT", "goal": "NONE", "speed_cap": False, "halt_reasons": reasons, "holds": [], "deferred": []}
    decision = {"valid": False, "primary": None, "risk_set": [], "added_risks": [], "forced_by": [], "floor_override": None, "action": action, "model_called": False,
                "prediction": None, "parse_error": None, "fault": None, "invalid_reason": text}
    t = (trace or []) + [{"agent": "Router", "decision": f"HALT | {reasons} | {text}", "status": "SHORT_CIRCUIT"},
                         {"agent": "Safety", "decision": "SKIPPED", "status": "SHORT_CIRCUIT"}, {"agent": "Action Compiler", "decision": "SKIPPED", "status": "SHORT_CIRCUIT"}]
    return _respond(start, _stop(reasons[0], reasons), t, decision, **kw)


def estop_response(start):
    """Emergency stop: no model, no Cosmos, no other external call."""
    return _halt(start, ["ESTOP"], "emergency_stop flag set")


async def simulate_extended(req_body: dict, tenant_id: str, config: dict, start_time: float):
    from router_v2 import decide, no_retry_client, openai_model_call, precheck, validate_actions, DEFAULT_ALLOWED_ACTIONS

    trace = []
    try:
        flag = req_body.get("emergency_stop", False)          # absent means false; an explicit null or any non-boolean is an input error
        if flag is True:
            return estop_response(start_time)
        if not isinstance(flag, bool):
            return _halt(start_time, ["INVALID_INPUT"], "emergency_stop must be a JSON boolean", input_valid=False)
        rec = {name: req_body.get(src) for name, src in ROUTER_FIELDS}      # missing stays None: never defaulted, never cast
        note = req_body.get("operator_note")
        target_speed = req_body.get("target_speed", 50)
        bad = precheck(rec, note)
        if bad is None and (isinstance(target_speed, bool) or not isinstance(target_speed, (int, float)) or target_speed != target_speed or target_speed < 0):
            bad = f"target_speed={target_speed!r} is not a non-negative number"
        if bad is not None:
            return _halt(start_time, ["INVALID_INPUT"], bad, input_valid=False)

        # --- external dependencies start here ---
        cosmos = {}
        twin = {"id": "Robo-A1", "tenant_id": tenant_id, "status": "ACTIVE" if rec["hp"] > 0 else "DEADLOCK",
                "telemetry": {"x_coord": req_body.get("current_x", 0), "y_coord": 15.0, "velocity_m_s": rec["velocity_ms"]},
                "hardware_state": {"hp": rec["hp"], "battery_pct": rec["battery_pct"], "temperature_c": rec["temperature_c"]},
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
        last_state = None
        try:
            t0 = time.time()
            container = get_cosmos_container()
            container.upsert_item(twin)
            ru = getattr(container.client_connection, "last_request_charge", None)
            cosmos["write_ms"], cosmos["ru"] = int((time.time() - t0) * 1000), ru if isinstance(ru, (int, float)) else None
            t0 = time.time()
            last_state = container.read_item(item="Robo-A1", partition_key=tenant_id)
            cosmos["read_ms"] = int((time.time() - t0) * 1000)
        except Exception as ce:  # noqa: BLE001 - Cosmos is best effort in the simulator
            logging.warning(f"Cosmos unavailable for the extended tenant: {ce}")

        t0 = time.time()
        try:
            client, model_name = get_llm_client_and_model()
            call = openai_model_call(no_retry_client(client, SDK_TIMEOUT_S), model_name)
        except Exception as exc:  # noqa: BLE001 - no usable client: the vehicle halts
            return _halt(start_time, ["API_ERROR"], f"model client unavailable or retries cannot be disabled: {exc}", metrics=_metrics(cosmos=cosmos))
        res = decide(rec, note, call)
        t1 = int((time.time() - t0) * 1000)
        dec = _decision_view(res)
        act = dec["action"]
        trace.append({"agent": "Router", "decision": f"{dec['primary'] or 'INVALID'} | motion={act['motion']} | goal={act['goal']} | speed_cap={act['speed_cap']} | "
                      f"holds={act['holds']} | deferred={act['deferred']} | halt_reasons={act['halt_reasons']} | floor_override={dec['floor_override']} | "
                      f"model_called={dec['model_called']}"})
        if act["motion"] == "HALT":
            trace += [{"agent": "Safety", "decision": "SKIPPED", "status": "SHORT_CIRCUIT"}, {"agent": "Action Compiler", "decision": "SKIPPED", "status": "SHORT_CIRCUIT"}]
            return _respond(start_time, _stop(act["halt_reasons"][0], act["halt_reasons"], act["holds"], act["deferred"], risk_set=dec["risk_set"]),
                            trace, dec, metrics=_metrics(t1, cosmos=cosmos))

        # Safety (may only make it stricter)
        intent = dec["primary"]
        safety_rules = config.get("agent_safety_rules")
        telem = (f"Telemetry: Distance: {rec['distance_cm']}cm, X: {req_body.get('current_x', 0)}, Velocity: {rec['velocity_ms']}m/s, HP: {rec['hp']}, "
                 f"Battery: {rec['battery_pct']}%, Temp: {rec['temperature_c']}C")
        safety_system = ("You are the Swarm Strategist and Safety Firewall. Evaluate the situation based on the strict rules and safety risks.\n"
                         "Tenant rules configuration:\n" f"- Safety rules: {safety_rules}\n\n"
                         "Task: Compare the current Telemetry against the safety rules. If any safety rule is violated, you MUST reply 'BLOCK: [reason]'. Otherwise, reply 'PASS'.")
        t0 = time.time()
        safety_decision = ask_agent(safety_system, f"Rules: {safety_rules}\nIntent: {intent}\n{telem}\nLast State: {json.dumps(last_state, default=str) if last_state else 'None'}", max_completion_tokens=50)
        t2 = int((time.time() - t0) * 1000)
        if safety_decision.upper().startswith("BLOCK"):
            trace += [{"agent": "Safety", "decision": safety_decision, "status": "BLOCKED"}, {"agent": "Action Compiler", "decision": "SKIPPED", "status": "SHORT_CIRCUIT"}]
            return _respond(start_time, _stop("safety_override", ["SAFETY_BLOCK"], act["holds"], act["deferred"]), trace, dec, metrics=_metrics(t1, t2, cosmos=cosmos))
        trace.append({"agent": "Safety", "decision": safety_decision, "status": "PASS"})

        # Compiler, then the code checks its result against the Router's decision
        cap = min(target_speed, 250) if act["speed_cap"] else target_speed
        constraints = (f"Constraints enforced by code after you answer: motion={act['motion']}; goal={act['goal']}; speed must be between 0 and {cap} cm/s; "
                       f"allowed actions {list(config.get('allowed_actions') or DEFAULT_ALLOWED_ACTIONS)}.")
        compiler_system = ("You are the Action Compiler. Generate evasive actions strictly conforming to the JSON schema. "
                           "NO markdown. NO text. Return ONLY raw JSON array matching the schema.")
        t0 = time.time()
        action_json = ask_agent(compiler_system, f"Schema: {config.get('agent_execution_schema')}\nIntent: {intent} (Strategist decided: {safety_decision})\n"
                                f"{telem}, Target Speed Limit: {target_speed}cm/s\n{constraints}", max_completion_tokens=100)
        t3 = int((time.time() - t0) * 1000)
        text = action_json.strip()
        if text.startswith("```"):
            lines = text.splitlines()[1:]
            text = "\n".join(lines[:-1] if lines and lines[-1].startswith("```") else lines).strip()
        try:
            actions = json.loads(text)
        except Exception:  # noqa: BLE001
            actions = None
        violations = validate_actions(actions, act, target_speed, tuple(config.get("allowed_actions") or DEFAULT_ALLOWED_ACTIONS))
        if violations:
            trace.append({"agent": "Action Compiler", "decision": action_json, "status": "REJECTED_BY_CODE"})
            return _respond(start_time, _stop("constraint_violation", ["CONSTRAINT_VIOLATION"], act["holds"], act["deferred"], violations=violations), trace, dec,
                            violations=violations, metrics=_metrics(t1, t2, t3, cosmos))
        trace.append({"agent": "Action Compiler", "decision": action_json, "status": "COMPILED"})
        return _respond(start_time, actions, trace, dec, metrics=_metrics(t1, t2, t3, cosmos))
    except Exception as e:  # noqa: BLE001 - fail safe: an unexpected error is a stop, not a silent pass
        logging.error(f"Error in the extended simulate_agent flow: {e}")
        return _halt(start_time, ["INTERNAL_ERROR"], str(e), trace=trace, status=500)
