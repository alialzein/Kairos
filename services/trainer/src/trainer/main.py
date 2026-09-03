"""TWIN trainer: ingestion, persona extraction, training, eval."""

from fastapi import FastAPI, Response
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest

SERVICE_NAME = "trainer"


def create_app() -> FastAPI:
    app = FastAPI(title=f"twin-{SERVICE_NAME}", version="0.0.1")

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok", "service": SERVICE_NAME}

    @app.get("/metrics")
    def metrics() -> Response:
        return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)

    return app
