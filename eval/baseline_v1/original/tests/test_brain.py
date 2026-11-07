import json
import time
from unittest.mock import MagicMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient


BRAIN_MODULE = "embodied_brain.brain"


def _mock_container():
    c = MagicMock()
    c.read_item.return_value = {
        "id": "Robo-A1", "tenant_id": "Tenant-Alpha", "status": "ACTIVE"
    }
    c.upsert_item.return_value = None
    conn = MagicMock()
    conn.last_request_charge = 10.67
    c.client_connection = conn
    return c


SAMPLE_CONFIG = {
    "agent_router_prompt": "Classify telemetry into: [CRITICAL_OBSTACLE, NORMAL_NAV, SENSOR_ERROR]",
    "agent_safety_rules": "Maintain 30cm minimum distance.",
    "agent_execution_schema": "[{'action': 'stop'|'turn'|'move', 'degree': int, 'speed': int}]"
}

MOCK_CONTAINER = _mock_container()
GET_COSMOS_PATCH = f"{BRAIN_MODULE}.get_cosmos_container"


@pytest.fixture
def app():
    from embodied_brain.brain import brain_router, _rate_limit_store
    _rate_limit_store.clear()
    app = FastAPI()
    app.include_router(brain_router)
    return app


@pytest.fixture
def client(app):
    return TestClient(app)


class TestCheckRateLimit:
    def test_first_request_allowed(self):
        from embodied_brain.brain import _check_rate_limit, _rate_limit_store
        _rate_limit_store.clear()
        assert _check_rate_limit("1.2.3.4") is True

    def test_exceeded_blocked(self):
        from embodied_brain.brain import _check_rate_limit, _rate_limit_store, RATE_LIMIT_MAX_REQUESTS
        _rate_limit_store.clear()
        for _ in range(RATE_LIMIT_MAX_REQUESTS):
            assert _check_rate_limit("1.2.3.4") is True
        assert _check_rate_limit("1.2.3.4") is False

    def test_different_ips_independent(self):
        from embodied_brain.brain import _check_rate_limit, _rate_limit_store, RATE_LIMIT_MAX_REQUESTS
        _rate_limit_store.clear()
        for _ in range(RATE_LIMIT_MAX_REQUESTS):
            _check_rate_limit("1.2.3.4")
        assert _check_rate_limit("5.6.7.8") is True

    def test_window_expires(self):
        from embodied_brain.brain import _check_rate_limit, _rate_limit_store, RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW
        _rate_limit_store.clear()
        for _ in range(RATE_LIMIT_MAX_REQUESTS):
            _check_rate_limit("1.2.3.4")
        cutoff = time.time() - RATE_LIMIT_WINDOW - 1
        _rate_limit_store["1.2.3.4"] = [cutoff]
        assert _check_rate_limit("1.2.3.4") is True


BRAIN_MODULE = "embodied_brain.brain"

class TestSimulateAgentEndpoint:
    def test_invalid_json(self, client):
        response = client.post("/api/simulate_agent", data="not json", headers={"Content-Type": "application/json"})
        assert response.status_code == 400
        assert response.json()["error"] == "Invalid JSON body"

    @patch(f"{BRAIN_MODULE}.load_scenario_config")
    @patch(GET_COSMOS_PATCH, return_value=MOCK_CONTAINER)
    @patch(f"{BRAIN_MODULE}.send_c2d_message")
    @patch(f"{BRAIN_MODULE}.ask_agent")
    def test_missing_fields(self, mock_ask, mock_send, mock_cosmos, mock_config, client):
        response = client.post("/api/simulate_agent", json={})
        assert response.status_code == 400
        assert "Missing required fields" in response.json()["error"]

    @patch(f"{BRAIN_MODULE}.load_scenario_config", return_value=None)
    @patch(GET_COSMOS_PATCH, return_value=MOCK_CONTAINER)
    @patch(f"{BRAIN_MODULE}.send_c2d_message")
    @patch(f"{BRAIN_MODULE}.ask_agent")
    def test_tenant_not_found(self, mock_ask, mock_send, mock_cosmos, mock_load, client):
        response = client.post("/api/simulate_agent", json={
            "tenant_id": "Unknown-Tenant", "obstacle_distance_cm": 10
        })
        assert response.status_code == 404

    @patch(f"{BRAIN_MODULE}.load_scenario_config", return_value=SAMPLE_CONFIG)
    @patch(GET_COSMOS_PATCH, return_value=MOCK_CONTAINER)
    @patch(f"{BRAIN_MODULE}.send_c2d_message")
    @patch(f"{BRAIN_MODULE}.ask_agent")
    @patch(f"{BRAIN_MODULE}._check_rate_limit", return_value=False)
    def test_rate_limited(self, mock_rate, mock_ask, mock_send, mock_cosmos, mock_config, client):
        response = client.post("/api/simulate_agent", json={
            "tenant_id": "Tenant-Alpha", "obstacle_distance_cm": 10
        })
        assert response.status_code == 429
        assert "Rate limit exceeded" in response.json()["error"]

    @patch(f"{BRAIN_MODULE}.load_scenario_config", return_value=SAMPLE_CONFIG)
    @patch(GET_COSMOS_PATCH, return_value=MOCK_CONTAINER)
    @patch(f"{BRAIN_MODULE}.send_c2d_message")
    @patch(f"{BRAIN_MODULE}.ask_agent")
    def test_hp_deadlock(self, mock_ask, mock_send, mock_cosmos, mock_config, client):
        response = client.post("/api/simulate_agent", json={
            "tenant_id": "Tenant-Alpha", "obstacle_distance_cm": 10, "hp": 0
        })
        assert response.status_code == 200
        body = response.json()
        assert body["final_action"] == [{"action": "offline_lock"}]
        assert any("SHORT_CIRCUIT" in t["status"] for t in body["pipeline_trace"])

    @patch(f"{BRAIN_MODULE}.load_scenario_config", return_value=SAMPLE_CONFIG)
    @patch(GET_COSMOS_PATCH, return_value=MOCK_CONTAINER)
    @patch(f"{BRAIN_MODULE}.send_c2d_message")
    @patch(f"{BRAIN_MODULE}.ask_agent")
    def test_low_battery(self, mock_ask, mock_send, mock_cosmos, mock_config, client):
        response = client.post("/api/simulate_agent", json={
            "tenant_id": "Tenant-Alpha", "obstacle_distance_cm": 10, "battery": 3
        })
        assert response.status_code == 200
        body = response.json()
        assert body["final_action"] == [{"action": "emergency_halt", "reason": "battery_depleted"}]

    @patch(f"{BRAIN_MODULE}.load_scenario_config", return_value=SAMPLE_CONFIG)
    @patch(GET_COSMOS_PATCH, return_value=MOCK_CONTAINER)
    @patch(f"{BRAIN_MODULE}.send_c2d_message")
    @patch(f"{BRAIN_MODULE}.ask_agent", return_value="SENSOR_ERROR")
    def test_sensor_error_short_circuit(self, mock_ask, mock_send, mock_cosmos, mock_config, client):
        response = client.post("/api/simulate_agent", json={
            "tenant_id": "Tenant-Alpha", "obstacle_distance_cm": 10
        })
        assert response.status_code == 200
        body = response.json()
        assert body["final_action"] == [{"action": "stop"}]
        trace = body["pipeline_trace"]
        assert any(t["agent"] == "Router" for t in trace)
        assert any(t.get("status") == "SHORT_CIRCUIT" for t in trace)

    @patch(f"{BRAIN_MODULE}.load_scenario_config", return_value=SAMPLE_CONFIG)
    @patch(GET_COSMOS_PATCH, return_value=MOCK_CONTAINER)
    @patch(f"{BRAIN_MODULE}.send_c2d_message")
    @patch(f"{BRAIN_MODULE}.ask_agent")
    def test_safety_block(self, mock_ask, mock_send, mock_cosmos, mock_config, client):
        mock_ask.side_effect = ["CRITICAL_OBSTACLE", "BLOCK: distance violates 30cm minimum"]
        response = client.post("/api/simulate_agent", json={
            "tenant_id": "Tenant-Alpha", "obstacle_distance_cm": 10
        })
        assert response.status_code == 200
        body = response.json()
        assert body["final_action"] == [{"action": "stop", "reason": "safety_override"}]
        traces = body["pipeline_trace"]
        assert any(t["agent"] == "Safety" and t["status"] == "BLOCKED" for t in traces)

    @patch(f"{BRAIN_MODULE}.load_scenario_config", return_value=SAMPLE_CONFIG)
    @patch(GET_COSMOS_PATCH, return_value=MOCK_CONTAINER)
    @patch(f"{BRAIN_MODULE}.send_c2d_message")
    @patch(f"{BRAIN_MODULE}.ask_agent")
    def test_full_pipeline(self, mock_ask, mock_send, mock_cosmos, mock_config, client):
        mock_ask.side_effect = [
            "CRITICAL_OBSTACLE",
            "PASS",
            '[{"action": "turn", "degree": 90, "speed": 20}]'
        ]
        response = client.post("/api/simulate_agent", json={
            "tenant_id": "Tenant-Alpha",
            "obstacle_distance_cm": 10,
            "current_x": 5,
            "target_speed": 30,
            "velocity": 1.2,
            "hp": 80,
            "battery": 70,
            "temperature": 42
        })
        assert response.status_code == 200
        body = response.json()
        assert body["final_action"] == [{"action": "turn", "degree": 90, "speed": 20}]
        trace = body["pipeline_trace"]
        assert any(t["agent"] == "Router" for t in trace)
        assert any(t["agent"] == "Safety" and t["status"] == "PASS" for t in trace)
        assert any(t["agent"] == "Action Compiler" and t["status"] == "COMPILED" for t in trace)
        assert body["latency_ms"] >= 0
        assert body["cloud_metrics"]["agent_1_latency_ms"] >= 0

    @patch(f"{BRAIN_MODULE}.load_scenario_config", return_value=SAMPLE_CONFIG)
    @patch(GET_COSMOS_PATCH, return_value=MOCK_CONTAINER)
    @patch(f"{BRAIN_MODULE}.send_c2d_message")
    @patch(f"{BRAIN_MODULE}.ask_agent",
           return_value='```json\n[{"action": "turn", "degree": 90}]\n```')
    def test_code_fence_cleaning(self, mock_ask, mock_send, mock_cosmos, mock_config, client):
        response = client.post("/api/simulate_agent", json={
            "tenant_id": "Tenant-Alpha", "obstacle_distance_cm": 10
        })
        assert response.status_code == 200
        body = response.json()
        assert body["final_action"] == [{"action": "turn", "degree": 90}]

    @patch(f"{BRAIN_MODULE}.load_scenario_config", return_value=SAMPLE_CONFIG)
    @patch(GET_COSMOS_PATCH,
           side_effect=Exception("Cosmos write failed"))
    @patch(f"{BRAIN_MODULE}.send_c2d_message")
    @patch(f"{BRAIN_MODULE}.ask_agent",
           return_value="CRITICAL_OBSTACLE")
    def test_cosmos_failure_graceful(self, mock_ask, mock_send, mock_cosmos, mock_config, client):
        response = client.post("/api/simulate_agent", json={
            "tenant_id": "Tenant-Alpha", "obstacle_distance_cm": 10
        })
        assert response.status_code == 200

    @patch(f"{BRAIN_MODULE}.load_scenario_config", return_value=SAMPLE_CONFIG)
    @patch(GET_COSMOS_PATCH, return_value=MOCK_CONTAINER)
    @patch(f"{BRAIN_MODULE}.send_c2d_message")
    @patch(f"{BRAIN_MODULE}.ask_agent")
    def test_override_config(self, mock_ask, mock_send, mock_cosmos, mock_config, client):
        mock_ask.side_effect = [
            "OVERRIDE_CLASS",
            "PASS",
            '[{"action": "move", "speed": 50}]'
        ]
        response = client.post("/api/simulate_agent", json={
            "tenant_id": "Tenant-Alpha",
            "obstacle_distance_cm": 10,
            "override_config": {
                "agent_router_prompt": "Classify as override",
                "agent_safety_rules": "Override safety",
                "agent_execution_schema": "[{'action': 'move'}]"
            }
        })
        assert response.status_code == 200
        assert mock_ask.call_count == 3
        router_call = mock_ask.mock_calls[0]
        assert "Classify as override" in router_call.args[0]
