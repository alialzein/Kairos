import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from brain.schemas import TURN_EVENT_ADAPTER, AvatarState, TurnRequest

FIXTURES = Path(__file__).resolve().parents[3] / "packages" / "shared" / "fixtures"


def _load(name: str) -> object:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


def test_avatar_states_match_context_md() -> None:
    assert [s.value for s in AvatarState] == [
        "DORMANT",
        "IDLE",
        "WAKING",
        "LISTENING",
        "THINKING",
        "SPEAKING",
        "OFFLINE",
    ]


def test_valid_turn_request_fixture() -> None:
    req = TurnRequest.model_validate(_load("turn_request.valid.json"))
    assert req.channel == "web"
    assert req.register == "casual"


def test_invalid_turn_request_fixtures() -> None:
    bad_payloads = _load("turn_request.invalid.json")
    assert isinstance(bad_payloads, list)
    for bad in bad_payloads:
        with pytest.raises(ValidationError):
            TurnRequest.model_validate(bad)


def test_turn_event_fixtures_roundtrip() -> None:
    events = _load("turn_events.valid.json")
    assert isinstance(events, list)
    for raw in events:
        event = TURN_EVENT_ADAPTER.validate_python(raw)
        dumped = TURN_EVENT_ADAPTER.dump_python(event, mode="json")
        assert dumped["type"] == raw["type"]
        assert TURN_EVENT_ADAPTER.validate_python(dumped) == event
