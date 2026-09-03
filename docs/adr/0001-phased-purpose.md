# 0001 — Phased purpose: assistant → twin-for-others → preservation

- **Status**: accepted
- **Date**: 2026-09-03
- **Deciders**: Ali (decision interview with Claude)

## Context
Ali wants all three uses. Each implies different users, tone rules, and privacy exposure.

## Decision
Build for the Owner-only personal assistant first (Phases 1–7). Add Guest mode with mandatory AI disclosure in Phase 8. Treat long-term preservation (portable export bundle, successor-model migration) as a Phase 8+ deliverable.

## Consequences
Data model has roles from day one; Guest-facing sensitivity filtering is designed in but not built until A8. Avoids overbuilding access control early.

## Alternatives considered
- Build twin-for-others first — rejected: highest risk, lowest personal value initially.
