# 0003 — Brain = frontier Reasoner drafts as Ali, local LoRA Style Engine rewrites

- **Status**: accepted
- **Date**: 2026-09-03
- **Deciders**: Ali (decision interview with Claude)

## Context
Research (01-research A3, B1, B2): in-context structured personas match or beat small fine-tunes on facts/opinions; fine-tuning excels at style; style-only models lack life context.

## Decision
Two-stage Turn pipeline: Reasoner (frontier API, Persona Core + memory + exemplars in context) produces the draft; Style Engine (Qwen-class + Ali LoRA, trained mainly on rewrite pairs) rewrites casual-register drafts. Professional register bypasses the Style Engine unless evals show benefit. Provider order for the Reasoner is configured per open question Q4.

## Consequences
Adds a rewrite hop (+≤300 ms) on casual turns; meaning-preservation sampling is mandatory; ablation evals compare all configurations every run.

## Alternatives considered
- LoRA primary, frontier for hard tasks — rejected for Phase 1: routing complexity and weaker reasoning on the common path.
- Frontier only with persona prompt — kept as lite mode fallback; not chosen as target because lexical/syntactic fidelity plateaus.
