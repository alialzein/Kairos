"""Phase 0 stub of the Turn pipeline (docs/03 §3): emits the five stage spans and canned events."""

from uuid import uuid4

from opentelemetry.trace import Tracer

from brain.schemas import (
    AvatarState,
    AvatarStateEvent,
    TurnDelta,
    TurnEnd,
    TurnEvent,
    TurnRequest,
    TurnStart,
)


def run_turn_stub(tracer: Tracer, request: TurnRequest) -> list[TurnEvent]:
    turn_id = uuid4()
    events: list[TurnEvent] = [
        TurnStart(type="turn.start", turn_id=turn_id, session_id=request.session_id),
        AvatarStateEvent(type="avatar.state", state=AvatarState.THINKING),
    ]
    with tracer.start_as_current_span("turn.assemble_context") as span:
        span.set_attribute("twin.channel", request.channel)
        span.set_attribute("twin.register", request.register or "casual")
    with tracer.start_as_current_span("turn.reason"):
        draft = f"[stub reasoner echo] {request.text}"
    with tracer.start_as_current_span("turn.style") as span:
        span.set_attribute("twin.style_applied", False)
    with tracer.start_as_current_span("turn.emit"):
        events.append(AvatarStateEvent(type="avatar.state", state=AvatarState.SPEAKING))
        events.append(TurnDelta(type="turn.delta", turn_id=turn_id, text=draft))
    with tracer.start_as_current_span("turn.post_turn"):
        events.append(
            TurnEnd(type="turn.end", turn_id=turn_id, style_applied=False, latency_ms={"stub": 0.0})
        )
    events.append(AvatarStateEvent(type="avatar.state", state=AvatarState.IDLE))
    return events
