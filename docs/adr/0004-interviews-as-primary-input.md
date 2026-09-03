# 0004 — Structured recorded interviews (3–5 h) as the primary identity input

- **Status**: accepted
- **Date**: 2026-09-03
- **Deciders**: Ali (decision interview with Claude)

## Context
Stanford/DeepMind result: interview transcripts yield the most faithful individual agents (85% of test-retest), beating demographics and self-written bios.

## Decision
Build an Interviewer Agent and a 9-module Interview Protocol; Ali records 3–5 hours in Arabic and English. 20% of opinion/scenario items are held out for evaluation. The same sessions capture voice-clone audio.

## Consequences
Ali's time is the critical path for Phase A1. Interviews are repeatable yearly to refresh Persona Core.

## Alternatives considered
- Documents only — rejected: weaker identity signal, no held-out ground truth.
