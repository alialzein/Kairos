"""TWIN brain: orchestrator (Reasoner + Style Engine + memory)."""

from typing import Annotated

from fastapi import Depends, FastAPI, Response
from opentelemetry.sdk.trace import SpanProcessor
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest

from brain.auth import Claims, JwtVerifier, require_owner
from brain.schemas import TurnEvent, TurnRequest
from brain.settings import Settings
from brain.telemetry import configure_tracing
from brain.turn import run_turn_stub

SERVICE_NAME = "brain"


def create_app(
    settings: Settings | None = None, span_processor: SpanProcessor | None = None
) -> FastAPI:
    settings = settings or Settings()
    app = FastAPI(title=f"twin-{SERVICE_NAME}", version="0.0.1")
    app.state.settings = settings
    app.state.verifier = JwtVerifier(
        secret=settings.supabase_jwt_secret,
        jwks_url=settings.supabase_jwks_url,
        audience=settings.jwt_audience,
    )
    provider = configure_tracing(app, settings, span_processor)
    tracer = provider.get_tracer("brain")

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok", "service": SERVICE_NAME}

    @app.get("/metrics")
    def metrics() -> Response:
        return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)

    @app.get("/owner/ping")
    def owner_ping(claims: Annotated[Claims, Depends(require_owner)]) -> dict[str, object]:
        return {"ok": True, "sub": claims.sub}

    @app.post("/turn", response_model=list[TurnEvent])
    def turn(request: TurnRequest, _: Annotated[Claims, Depends(require_owner)]) -> list[TurnEvent]:
        return run_turn_stub(tracer, request)

    return app
