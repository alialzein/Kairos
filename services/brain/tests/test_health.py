from fastapi.testclient import TestClient

from brain.main import create_app
from brain.settings import Settings


def test_health_returns_ok_and_service_name() -> None:
    client = TestClient(create_app(Settings(_env_file=None, supabase_jwt_secret="x" * 32)))
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "brain"}


def test_metrics_is_prometheus_text() -> None:
    client = TestClient(create_app(Settings(_env_file=None, supabase_jwt_secret="x" * 32)))
    response = client.get("/metrics")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/plain")
    assert b"python_info" in response.content
