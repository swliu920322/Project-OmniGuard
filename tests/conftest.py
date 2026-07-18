import os
import sys
import json
import pytest
from unittest.mock import MagicMock, patch

SRC_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "src", "cloud-orchestrator")
sys.path.insert(0, SRC_DIR)

SCENARIO_REGISTRY_PATH = os.path.join(SRC_DIR, "scenario_registry.json")


@pytest.fixture
def scenario_registry():
    with open(SCENARIO_REGISTRY_PATH, "r") as f:
        return json.load(f)


@pytest.fixture
def mock_cosmos_container():
    container = MagicMock()
    container.read_item.return_value = {
        "id": "Robo-A1",
        "tenant_id": "Tenant-Alpha",
        "status": "ACTIVE"
    }
    container.upsert_item.return_value = None
    conn = MagicMock()
    conn.last_request_charge = 10.67
    container.client_connection = conn
    return container


@pytest.fixture
def mock_utils(monkeypatch, mock_cosmos_container):
    import embodied_brain.utils as utils
    monkeypatch.setattr(utils, "get_cosmos_container", lambda: mock_cosmos_container)
    monkeypatch.setattr(utils, "send_c2d_message", MagicMock())
    return utils


@pytest.fixture
def mock_brain_deps(monkeypatch, mock_cosmos_container):
    import embodied_brain.brain as brain
    mock_ask = MagicMock()
    monkeypatch.setattr(brain, "ask_agent", mock_ask)
    monkeypatch.setattr(brain, "get_cosmos_container", lambda: mock_cosmos_container)
    monkeypatch.setattr(brain, "send_c2d_message", MagicMock())
    return brain, mock_ask
