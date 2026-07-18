import os
import json
import time
import base64
import hmac
import hashlib
from unittest.mock import MagicMock, patch
from urllib.parse import quote

import pytest


class TestLoadScenarioConfig:
    def test_found(self, scenario_registry):
        from embodied_brain.utils import load_scenario_config
        config = load_scenario_config("Tenant-Alpha")
        assert config == scenario_registry["Tenant-Alpha"]
        assert config["scenario"] == "Data Center Patrol"

    def test_fallback_to_alpha(self):
        from embodied_brain.utils import load_scenario_config
        config = load_scenario_config("Tenant-Unknown")
        assert config is not None
        assert config["scenario"] == "Data Center Patrol"

    @patch("embodied_brain.utils.os.path.exists", return_value=False)
    def test_missing_file(self, mock_exists):
        from embodied_brain.utils import load_scenario_config
        config = load_scenario_config("Tenant-Alpha")
        assert config is None

    @patch("builtins.open", side_effect=OSError("Permission denied"))
    def test_read_error(self, mock_open):
        from embodied_brain.utils import load_scenario_config
        config = load_scenario_config("Tenant-Alpha")
        assert config is None


class TestGenerateSasToken:
    def test_token_format(self):
        from embodied_brain.utils import generate_sas_token
        uri = "test-uri.test/devices/test-device"
        key = base64.b64encode(b"fake-key-12345").decode("utf-8")
        token = generate_sas_token(uri, key, "iothubowner", expiry=3600)
        assert token.startswith("SharedAccessSignature ")
        assert "sr=" in token
        assert "sig=" in token
        assert "se=" in token
        assert "skn=iothubowner" in token

    def test_token_components(self):
        from embodied_brain.utils import generate_sas_token
        uri = "myhub.azure-devices.net/devices/mydev"
        key = base64.b64encode(b"supersecretkey").decode("utf-8")
        token = generate_sas_token(uri, key, "myPolicy", expiry=3600)
        parts = token[len("SharedAccessSignature "):].split("&")
        token_dict = {}
        for p in parts:
            k, v = p.split("=", 1)
            token_dict[k] = v
        assert token_dict["skn"] == "myPolicy"
        assert token_dict["sr"] == quote(uri)
        assert "sig" in token_dict
        assert "se" in token_dict
        se = int(token_dict["se"])
        now = int(time.time())
        assert se > now
        assert se <= now + 3600 + 5


class TestGetCosmosContainer:
    @patch.dict(os.environ, {"COSMOS_ENDPOINT": "", "COSMOS_KEY": ""})
    def test_missing_env(self):
        import embodied_brain.utils as utils
        utils._cosmos_container = None
        with pytest.raises(ValueError, match="Cosmos DB environment variables missing"):
            utils.get_cosmos_container()

    def test_success(self):
        from embodied_brain.utils import get_cosmos_container
        import embodied_brain.utils as utils
        orig = utils._cosmos_container
        utils._cosmos_container = None
        expected_endpoint = "https://test.documents.azure.com:443/"
        expected_key = "dGVzdC1rZXk="
        with patch.dict(os.environ, {"COSMOS_ENDPOINT": expected_endpoint,
                                     "COSMOS_KEY": expected_key}):
            with patch("embodied_brain.utils.CosmosClient") as MockCosmos:
                mock_client = MagicMock()
                mock_db = MagicMock()
                mock_container = MagicMock()
                MockCosmos.return_value = mock_client
                mock_client.get_database_client.return_value = mock_db
                mock_db.get_container_client.return_value = mock_container

                container = get_cosmos_container()
                assert container == mock_container
                MockCosmos.assert_called_once_with(
                    expected_endpoint,
                    credential=expected_key
                )
                mock_client.get_database_client.assert_called_once_with("OmniGuardDB")
                mock_db.get_container_client.assert_called_once_with("DeviceTwins")

        utils._cosmos_container = orig


class TestAskAgent:
    def test_cache_hit(self):
        from embodied_brain.utils import ask_agent, _ask_agent_cache, _ask_agent_cache_lock
        _ask_agent_cache.clear()
        cache_key = ("prompt", "input", 100, 0.0)
        _ask_agent_cache[cache_key] = ("cached_result", time.time())

        with patch("embodied_brain.utils.get_llm_client") as mock_get_client:
            result = ask_agent("prompt", "input")
            assert result == "cached_result"
            mock_get_client.assert_not_called()

    def test_cache_expired(self):
        from embodied_brain.utils import ask_agent, _ask_agent_cache, _ask_agent_cache_lock
        _ask_agent_cache.clear()
        cache_key = ("prompt", "input", 100, 0.0)
        _ask_agent_cache[cache_key] = ("stale_result", time.time() - 100)

        with patch("embodied_brain.utils.get_llm_client") as mock_get_client:
            mock_client = MagicMock()
            mock_response = MagicMock()
            mock_choice = MagicMock()
            mock_choice.message.content = "  fresh_result  "
            mock_response.choices = [mock_choice]
            mock_client.chat.completions.create.return_value = mock_response
            mock_get_client.return_value = mock_client

            result = ask_agent("prompt", "input")
            assert result == "fresh_result"
            mock_get_client.assert_called_once()

    def test_cache_max_size(self):
        from embodied_brain.utils import ask_agent, _ask_agent_cache, _ask_agent_cache_lock, ASK_AGENT_CACHE_MAX_SIZE
        _ask_agent_cache.clear()
        for i in range(ASK_AGENT_CACHE_MAX_SIZE):
            _ask_agent_cache[(f"p{i}", "input", 100, 0.0)] = (f"result{i}", time.time())
        assert len(_ask_agent_cache) == ASK_AGENT_CACHE_MAX_SIZE

        with patch("embodied_brain.utils.get_llm_client") as mock_get_client:
            mock_client = MagicMock()
            mock_response = MagicMock()
            mock_choice = MagicMock()
            mock_choice.message.content = "  new_result  "
            mock_response.choices = [mock_choice]
            mock_client.chat.completions.create.return_value = mock_response
            mock_get_client.return_value = mock_client
            from embodied_brain.utils import ASK_AGENT_CACHE_MAX_SIZE
            ask_agent("new_prompt", "new_input")
            assert len(_ask_agent_cache) == ASK_AGENT_CACHE_MAX_SIZE
            assert ("p0", "input", 100, 0.0) not in _ask_agent_cache
