# 0010 — TypeScript for product surfaces, Python for ML and voice

- **Status**: accepted
- **Date**: 2026-09-03
- **Deciders**: Ali (decision interview with Claude)

## Context
Ali's stack is TS/Next.js/Supabase; ML and voice-agent ecosystems are Python-first.

## Decision
Strict boundary: everything a user touches is TypeScript; everything that trains, evaluates, remembers, or streams voice is Python. Contracts shared via zod + OpenAPI codegen.

## Consequences
Two toolchains; CI covers both. No Python in the web app; no TS in ML pipelines.

## Alternatives considered
- All TypeScript — rejected: Unsloth/TRL/Graphiti/LiveKit Agents maturity is in Python.
- All Python (Streamlit-style UI) — rejected: Avatar and mobile need the web stack.
