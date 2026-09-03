from collections.abc import Callable

from fastapi.testclient import TestClient
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter

from brain.main import create_app
from brain.settings import Settings
from tests.conftest import OWNER_ID

STAGES = ["turn.assemble_context", "turn.reason", "turn.style", "turn.emit", "turn.post_turn"]


def _client_with_exporter(settings: Settings) -> tuple[TestClient, InMemorySpanExporter]:
    exporter = InMemorySpanExporter()
    app = create_app(settings, span_processor=SimpleSpanProcessor(exporter))
    return TestClient(app), exporter


def test_turn_stub_emits_five_stage_spans(settings: Settings, mint: Callable[..., str]) -> None:
    client, exporter = _client_with_exporter(settings)
    body = {"text": "hi", "channel": "web", "session_id": "3f2b4c1e-8a7d-4c5e-9b1a-2d3e4f5a6b7c"}
    r = client.post("/turn", json=body, headers={"Authorization": f"Bearer {mint(OWNER_ID)}"})
    assert r.status_code == 200
    events = r.json()
    assert events[0]["type"] == "turn.start"
    assert events[-1] == {"type": "avatar.state", "state": "IDLE"}

    spans = {s.name: s for s in exporter.get_finished_spans()}
    for stage in STAGES:
        assert stage in spans, f"missing span {stage}"
    server_span = next(s for s in spans.values() if s.parent is None)
    assert server_span.name == "POST /turn"
    for stage in STAGES:
        parent = spans[stage].parent
        assert parent is not None and parent.span_id == server_span.context.span_id


def test_turn_requires_owner(settings: Settings, mint: Callable[..., str]) -> None:
    client, _ = _client_with_exporter(settings)
    body = {"text": "hi", "channel": "web", "session_id": "3f2b4c1e-8a7d-4c5e-9b1a-2d3e4f5a6b7c"}
    assert client.post("/turn", json=body).status_code == 401
    guest = "22222222-2222-2222-2222-222222222222"
    assert (
        client.post(
            "/turn", json=body, headers={"Authorization": f"Bearer {mint(guest)}"}
        ).status_code
        == 403
    )


def test_turn_rejects_invalid_body(settings: Settings, mint: Callable[..., str]) -> None:
    client, _ = _client_with_exporter(settings)
    r = client.post(
        "/turn",
        json={"text": "", "channel": "web"},
        headers={"Authorization": f"Bearer {mint(OWNER_ID)}"},
    )
    assert r.status_code == 422
