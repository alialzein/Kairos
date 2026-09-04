# 0002 — Hybrid privacy: cloud reasoning, local raw data and style model

- **Status**: accepted
- **Date**: 2026-09-03
- **Deciders**: Ali (decision interview with Claude)
- **Amended by**: ADR-0014 — in the home stage the Reasoner is local (Ollama) and nothing leaves the PC; the cloud boundary below applies from Phase C.

## Context
Best reasoning quality comes from frontier cloud models. Ali's raw exports, emails, interview audio and the fine-tuned style model are the most sensitive assets.

## Decision
Raw and derived corpus, training, and the Style Engine live only on Ali's PC. The cloud Reasoner receives Persona Core, retrieved scrubbed memories, and ≤ 60-word scrubbed Style Exemplars. Enforced by CI checks, an uploader allowlist, and an egress audit gate in Phase A1.

## Consequences
Requires the PC (or a rented GPU) for training and a Tailscale link for style calls; the Brain must degrade to lite mode when the PC is offline.

## Alternatives considered
- Fully local — rejected: reasoning quality and latency too low for a daily assistant.
- Fully cloud — rejected: unacceptable exposure of raw personal data.
