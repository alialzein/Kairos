# 0006 — Ali's own cloned voice via ElevenLabs Professional Voice Clone

- **Status**: accepted
- **Date**: 2026-09-03
- **Deciders**: Ali (decision interview with Claude)

## Context
ElevenLabs leads on cloning fidelity and supports Arabic; Cartesia leads on latency but Arabic isn't top-tier. Professional cloning needs 30+ min clean audio.

## Decision
Record ≥ 60 min (read script + natural speech, both languages) during interviews. Instant clone for pipeline bring-up; Professional clone for production. Self-host fallback (F5-TTS/XTTS-v2) documented. Consent statement recorded.

## Consequences
Vendor dependency for TTS; monthly cost; a documented path off-vendor exists.

## Alternatives considered
- Synthetic voice — rejected: not Ali.
- Self-host only — deferred: quality/latency in Arabic unproven; revisit if cost or privacy demands.
