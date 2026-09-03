from fastapi.testclient import TestClient

from memory.main import create_app


def test_health_returns_ok_and_service_name() -> None:
    client = TestClient(create_app())
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "memory"}


def test_metrics_is_prometheus_text() -> None:
    client = TestClient(create_app())
    response = client.get("/metrics")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/plain")
    assert b"python_info" in response.content
