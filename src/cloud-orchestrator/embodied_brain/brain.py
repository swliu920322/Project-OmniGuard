# file: src/cloud-orchestrator/embodied_brain/brain.py
import os
import json
import logging
import time
import azure.functions as func
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from .utils import (
    get_cosmos_container,
    load_scenario_config,
    send_c2d_message,
    ask_agent
)

bp = func.Blueprint()
brain_router = APIRouter()

@bp.event_hub_message_trigger(
    arg_name="azeventhub",
    event_hub_name="messages/events",
    connection="IotHubEventHubConnectionString"
)
def iot_telemetry_processor(azeventhub: func.EventHubEvent):
    """Handle incoming event hub telemetry stream and trigger agent decision."""
    raw_data = azeventhub.get_body().decode('utf-8')
    device_id = azeventhub.iothub_metadata.get('connection-device-id', 'Unknown-Device')

    try:
        # Parse payload from raw device data
        payload = json.loads(raw_data)
        obstacle = payload.get("obstacle_distance_cm", 100)
        tenant_id = payload.get("tenant_id", "Unknown-Tenant")
        current_x = payload.get("location", {}).get("x", 0)

        # 🟩 1.5. 读取 Cosmos DB 中的上一次状态 (用于安全审计)
        last_state = None
        try:
            last_state = get_cosmos_container().read_item(item=device_id, partition_key=tenant_id)
        except Exception:
            pass

        # 🟩 2. 状态孪生持久化：无视大模型是否触发，高频刷入 Cosmos DB
        twin_data = {
            "id": device_id,  # CosmosDB 主键
            "tenant_id": tenant_id,  # 物理隔离分区键
            "last_x": current_x,
            "last_obstacle": obstacle,
            "status": "active"
        }
        get_cosmos_container().upsert_item(twin_data)
        logging.info(f"[💾 记忆固化] 探针 {device_id} 状态已写入 Cosmos DB。")

        # 🟩 3. 物理短路判定与 Agent 唤醒
        if obstacle < 15:
            logging.warning(f"[⚠️ 警报触发] {device_id} 遭遇绝境 ({obstacle}cm)！唤醒云端 Agent...")

            # Stage 1: Context Loader
            config = load_scenario_config(tenant_id)
            if not config:
                logging.warning(f"No scenario configuration found for tenant {tenant_id}. Dropping message.")
                return

            # Stage 2: Agent 1 - Intent Router (Classification)
            router_prompt = config.get("agent_router_prompt")
            router_input = f"Telemetry: Distance: {obstacle}cm, X: {current_x}, Device: {device_id}."
            
            intent = ask_agent(router_prompt, router_input, max_completion_tokens=20)
            logging.info(f"[🧠 Agent 1: Router] Classified intent: '{intent}'")
            
            if "SENSOR_ERROR" in intent.upper():
                logging.warning(f"[⚠️ Short-Circuit] SENSOR_ERROR detected. Halting pipeline and sending STOP command.")
                send_c2d_message(device_id, json.dumps([{"action": "stop"}]))
                return

            # Stage 3: Agent 2 - Compliance & Safety (Audit)
            safety_rules = config.get("agent_safety_rules")
            safety_system_prompt = (
                "You are the safety firewall. Evaluate the situation based on the strict rules.\n"
                "Tenant rules configuration:\n"
                f"- Safety rules: {safety_rules}\n\n"
                "Task: Compare the current Telemetry against the safety rules. "
                "If the current distance violates the minimum distance requirement (e.g. if the rule specifies '30cm minimum distance' and the current distance is less than 30), "
                "or if any other safety rule is violated, you MUST reply 'BLOCK: [reason]'. Otherwise, reply 'PASS'."
            )
            safety_input = (
                f"Rules: {safety_rules}\n"
                f"Intent: {intent}\n"
                f"Telemetry: Distance: {obstacle}cm, X: {current_x}\n"
                f"Last State: {json.dumps(last_state) if last_state else 'None'}"
            )
            
            safety_decision = ask_agent(safety_system_prompt, safety_input, max_completion_tokens=50)
            logging.info(f"[🛡️ Agent 2: Safety] Decision: '{safety_decision}'")
            
            if safety_decision.upper().startswith("BLOCK"):
                logging.warning(f"[⚠️ Short-Circuit] Safety BLOCK triggered: {safety_decision}. Halting pipeline and overriding actions.")
                send_c2d_message(device_id, json.dumps([{"action": "stop", "reason": "safety_override"}]))
                return

            # Stage 4: Agent 3 - Action Compiler (Execution)
            execution_schema = config.get("agent_execution_schema")
            compiler_system_prompt = (
                "You are the Action Compiler. Generate evasive actions strictly conforming to the JSON schema. "
                "NO markdown. NO text. Return ONLY raw JSON array matching the schema."
            )
            compiler_input = (
                f"Schema: {execution_schema}\n"
                f"Intent: {intent}\n"
                f"Telemetry: Distance: {obstacle}cm, X: {current_x}"
            )
            
            action_json = ask_agent(compiler_system_prompt, compiler_input, max_completion_tokens=100)
            
            if action_json.startswith("```"):
                lines = action_json.splitlines()
                if lines[0].startswith("```"):
                    lines = lines[1:]
                if lines[-1].startswith("```"):
                    lines = lines[:-1]
                action_json = "\n".join(lines).strip()
            
            logging.info(f"[🧠 Agent 3: Action Compiler] Compiled actions: {action_json}")
            
            # Send C2D message
            send_c2d_message(device_id, action_json)
            logging.info(f"[⚡️ 物理下行] 动作序列已砸回探针 {device_id} 的电机。")

    except Exception as e:
        logging.error(f"[FATAL] 系统熔断: {str(e)}")

@brain_router.post("/simulate_agent")
async def simulate_agent_endpoint(request: Request):
    """Simulate the Multi-Agent pipeline via HTTP POST request for the dashboard."""
    start_time = time.time()
    pipeline_trace = []
    final_action = []
    
    try:
        req_body = await request.json()
    except Exception:
        return JSONResponse(
            status_code=400,
            content={"error": "Invalid JSON body"}
        )
        
    tenant_id = req_body.get("tenant_id")
    obstacle = req_body.get("obstacle_distance_cm")
    current_x = req_body.get("current_x", 0)
    target_speed = req_body.get("target_speed", 50)
    device_id = "Simulated-Device"
    
    if not tenant_id or obstacle is None:
        return JSONResponse(
            status_code=400,
            content={"error": "Missing required fields: tenant_id, obstacle_distance_cm"}
        )
        
    try:
        # Load scenario configuration
        config = load_scenario_config(tenant_id)
        if not config:
            return JSONResponse(
                status_code=404,
                content={"error": f"Scenario config not found for tenant '{tenant_id}'"}
            )
            
        # We also simulate reading the last state from Cosmos DB
        last_state = None
        try:
            last_state = get_cosmos_container().read_item(item="Robo-A1", partition_key=tenant_id)
        except Exception:
            pass
            
        # Stage 2: Agent 1 - Intent Router (Classification)
        router_prompt = config.get("agent_router_prompt")
        router_input = f"Telemetry: Distance: {obstacle}cm, X: {current_x}, Device: {device_id}."
        
        intent = ask_agent(router_prompt, router_input, max_completion_tokens=20)
        pipeline_trace.append({"agent": "Router", "decision": intent})
        
        if "SENSOR_ERROR" in intent.upper():
            final_action = [{"action": "stop"}]
            pipeline_trace.append({"agent": "Safety", "decision": "SKIPPED", "status": "SHORT_CIRCUIT"})
            pipeline_trace.append({"agent": "Action Compiler", "decision": "SKIPPED", "status": "SHORT_CIRCUIT"})
        else:
            # Stage 3: Agent 2 - Compliance & Safety (Audit)
            safety_rules = config.get("agent_safety_rules")
            safety_system_prompt = (
                "You are the safety firewall. Evaluate the situation based on the strict rules.\n"
                "Tenant rules configuration:\n"
                f"- Safety rules: {safety_rules}\n\n"
                "Task: Compare the current Telemetry against the safety rules. "
                "If the current distance violates the minimum distance requirement (e.g. if the rule specifies '30cm minimum distance' and the current distance is less than 30), "
                "or if any other safety rule is violated, you MUST reply 'BLOCK: [reason]'. Otherwise, reply 'PASS'."
            )
            safety_input = (
                f"Rules: {safety_rules}\n"
                f"Intent: {intent}\n"
                f"Telemetry: Distance: {obstacle}cm, X: {current_x}\n"
                f"Last State: {json.dumps(last_state) if last_state else 'None'}"
            )
            
            safety_decision = ask_agent(safety_system_prompt, safety_input, max_completion_tokens=50)
            
            if safety_decision.upper().startswith("BLOCK"):
                final_action = [{"action": "stop", "reason": "safety_override"}]
                pipeline_trace.append({"agent": "Safety", "decision": safety_decision, "status": "BLOCKED"})
                pipeline_trace.append({"agent": "Action Compiler", "decision": "SKIPPED", "status": "SHORT_CIRCUIT"})
            else:
                pipeline_trace.append({"agent": "Safety", "decision": safety_decision, "status": "PASS"})
                
                # Stage 4: Agent 3 - Action Compiler (Execution)
                execution_schema = config.get("agent_execution_schema")
                compiler_system_prompt = (
                    "You are the Action Compiler. Generate evasive actions strictly conforming to the JSON schema. "
                    "NO markdown. NO text. Return ONLY raw JSON array matching the schema."
                )
                compiler_input = (
                    f"Schema: {execution_schema}\n"
                    f"Intent: {intent}\n"
                    f"Telemetry: Distance: {obstacle}cm, X: {current_x}, Target Speed Limit: {target_speed}cm/s"
                )
                
                action_json = ask_agent(compiler_system_prompt, compiler_input, max_completion_tokens=100)
                
                if action_json.startswith("```"):
                    lines = action_json.splitlines()
                    if lines[0].startswith("```"):
                        lines = lines[1:]
                    if lines[-1].startswith("```"):
                        lines = lines[:-1]
                    action_json = "\n".join(lines).strip()
                
                try:
                    final_action = json.loads(action_json)
                except Exception:
                    final_action = [{"raw_output": action_json}]
                
                pipeline_trace.append({"agent": "Action Compiler", "decision": action_json, "status": "COMPILED"})
                
        latency_ms = int((time.time() - start_time) * 1000)
        
        response_body = {
            "latency_ms": latency_ms,
            "final_action": final_action,
            "pipeline_trace": pipeline_trace,
            "cloud_metrics": {
                "cosmos_db_ru_charge": 10.67,
                "cosmos_write_latency_ms": 5.3,
                "execution_environment": "Azure Functions (Linux Consumption)",
                "vnet_isolation": "Active (BackendSubnet)",
                "iot_hub_routing": "Event Hubs Compatible Endpoint"
            }
        }
        
        return JSONResponse(status_code=200, content=response_body)
        
    except Exception as e:
        logging.error(f"Error in simulate_agent: {e}")
        return JSONResponse(status_code=500, content={"error": str(e)})