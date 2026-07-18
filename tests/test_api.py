import azure.functions as func
import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client():
    from function_app import fastapi_app
    return TestClient(fastapi_app)


class TestFastApiSetup:
    def test_app_title(self):
        from function_app import fastapi_app
        assert fastapi_app.title == "Project-OmniGuard Serverless API Hub"
        assert fastapi_app.version == "1.0.0"

    def test_cors_wildcard_origin(self, client):
        response = client.options(
            "/api/simulate_agent",
            headers={
                "Origin": "https://example.com",
                "Access-Control-Request-Method": "POST",
            },
        )
        assert response.status_code == 200
        assert response.headers.get("access-control-allow-origin") == "*"

    def test_cors_any_origin(self, client):
        response = client.options(
            "/api/simulate_agent",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "GET",
            },
        )
        assert response.status_code == 200
        assert response.headers.get("access-control-allow-origin") == "*"


class TestRouteRegistration:
    def test_brain_routes_registered(self, client):
        response = client.post("/api/simulate_agent", json={})
        assert response.status_code in (400, 429)

    def test_brain_routes_registered_trailing_slash(self, client):
        response = client.post("/api/simulate_agent/", json={})
        assert response.status_code in (400, 429)

    def test_brain_routes_exists(self, client):
        response = client.get("/api/simulate_agent")
        assert response.status_code == 405

    def test_unknown_route_404(self, client):
        response = client.get("/api/nonexistent")
        assert response.status_code == 404


class TestMiddleware:
    def test_cors_headers_on_preflight(self, client):
        response = client.options(
            "/api/simulate_agent",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "POST",
            },
        )
        assert response.headers.get("access-control-allow-origin") == "*"

    def test_cors_not_on_non_cors_request(self, client):
        response = client.get("/api/simulate_agent")
        assert "access-control-allow-origin" not in response.headers


class TestAsgiFunctionApp:
    def test_asgi_app_created(self):
        from function_app import app
        assert app is not None

    def test_auth_level_anonymous(self):
        from function_app import app
        assert app.auth_level == func.AuthLevel.ANONYMOUS
