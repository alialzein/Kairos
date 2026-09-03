"""OpenTelemetry wiring: per-stage Turn spans, exported to Langfuse (OTLP/HTTP) when configured."""

import base64

from fastapi import FastAPI
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import SpanProcessor, TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor

from brain.settings import Settings


def langfuse_processor(settings: Settings) -> SpanProcessor | None:
    if not (
        settings.langfuse_host and settings.langfuse_public_key and settings.langfuse_secret_key
    ):
        return None
    auth = base64.b64encode(
        f"{settings.langfuse_public_key}:{settings.langfuse_secret_key}".encode()
    ).decode()
    exporter = OTLPSpanExporter(
        endpoint=f"{settings.langfuse_host.rstrip('/')}/api/public/otel/v1/traces",
        headers={"Authorization": f"Basic {auth}", "x-langfuse-ingestion-version": "4"},
    )
    return BatchSpanProcessor(exporter)


def configure_tracing(
    app: FastAPI, settings: Settings, span_processor: SpanProcessor | None = None
) -> TracerProvider:
    provider = TracerProvider(resource=Resource.create({"service.name": settings.service_name}))
    processor = span_processor or langfuse_processor(settings)
    if processor is not None:
        provider.add_span_processor(processor)
    FastAPIInstrumentor.instrument_app(
        app, tracer_provider=provider, excluded_urls="health,metrics"
    )
    app.state.tracer_provider = provider
    return provider
