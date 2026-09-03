"""TWIN brain: orchestrator (Reasoner + Style Engine + memory)."""

from typing import Annotated

from fastapi import Depends, FastAPI, Response
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest

from brain.auth import Claims, JwtVerifier, require_owner
from brain.settings import Settings

SERVICE_NAME = "brain"


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings()
    app = FastAPI(title=f"twin-{SERVICE_NAME}", version="0.0.1")
    app.state.settings = settings
    app.state.verifier = JwtVerifier(
        secret=settings.supabase_jwt_secret,
        jwks_url=settings.supabase_jwks_url,
        audience=settings.jwt_audience,
    )

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok", "service": SERVICE_NAME}

    @app.get("/metrics")
    def metrics() -> Response:
        return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)

    @app.get("/owner/ping")
    def owner_ping(claims: Annotated[Claims, Depends(require_owner)]) -> dict[str, object]:
        return {"ok": True, "sub": claims.sub}

    return app
