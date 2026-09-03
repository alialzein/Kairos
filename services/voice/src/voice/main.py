"""TWIN voice: LiveKit Agents worker (Phase 0 stub)."""

import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Response
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest

from voice.worker import Heartbeat

SERVICE_NAME = "voice"


def create_app() -> FastAPI:
    heartbeat = Heartbeat()
    stop = asyncio.Event()

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        task = asyncio.create_task(heartbeat.run(stop))
        try:
            yield
        finally:
            stop.set()
            await task

    app = FastAPI(title=f"twin-{SERVICE_NAME}", version="0.0.1", lifespan=lifespan)

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok", "service": SERVICE_NAME}

    @app.get("/metrics")
    def metrics() -> Response:
        return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)

    return app
