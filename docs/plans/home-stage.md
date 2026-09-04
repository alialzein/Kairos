# Home stage — implementation plan (docs, config, no application code)

> **For agentic workers:** This plan is executed inline by the controlling agent (documentation-only change; no subagents). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record ADR-0014 (home stage) and make every document, glossary entry, env template and runbook consistent with it, so that a fresh session starts Phase A1/B5 in the home stage and never tries to deploy to Vercel/Hetzner before Phase C.

**Spec:** `docs/plans/home-stage-design.md` · `docs/adr/0014-home-stage.md`.

**Constraints:** no application code changes; no accepted ADR contradicted (amend/scope only); Prettier ignores Markdown, so wording is free-form but tables must stay valid GitHub Markdown; `.env.example` gains only placeholders (no secrets); the pre-commit corpus check must stay clean.

## Task 1 — Decision record and spec

- [x] `docs/adr/0014-home-stage.md` (accepted, dated 2026-09-04)
- [x] `docs/plans/home-stage-design.md` (approved design, sections 1–12)
- [x] Amended-by / scope lines in `docs/adr/0002`, `0003`, `0008`, `0013`

## Task 2 — Specs and glossary

- [x] `docs/03-architecture.md`: §0 Stages with the home-stage diagram; §1 retitled "cloud stage"; §6 home-stage infra bullet; §7 "PC off" row
- [x] `docs/11-roadmap.md`: stages note; Phase 0 gate wording; A2.5 / A2.7 / A2 gate / A4.1 / A6 notes; new Phase C table + gate; order of execution
- [x] `docs/12-repo-and-tooling.md`: §6 environments table (home / dev-laptop / preview / prod); §7 PC checklist
- [x] `docs/13-open-questions.md`: Q2 resolved (RTX 5070 12 GB), Q4 resolved for the home stage
- [x] `docs/02`, `docs/05`, `docs/07`, `docs/10`, `README.md`: single-line stage references
- [x] `CONTEXT.md`: Reasoner redefined; Stage, Home stage, Cloud stage, Lite mode added

## Task 3 — Config and runbooks

- [x] `.env.example`: reasoner block (`REASONER_PROVIDER`, `OLLAMA_BASE_URL`, `REASONER_MODEL`, `EMBEDDING_MODEL`)
- [x] `docs/runbooks/local-dev.md`: "Home stage on the gaming PC" section (one-time setup, run, LAN access, model alternatives)
- [x] `docs/STATUS.md`, `docs/reports/phase-0-execution.md`, `docs/plans/phase-0.md` Task 16: cloud steps moved to Phase C

## Task 4 — Verify and commit

- [x] `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm check:corpus --tracked` all exit 0 (paste output in the commit body)
- [x] `git commit -m "docs(adr): 0014 home stage — free local v1 on the gaming PC, cloud move becomes Phase C"` and push (gh account `alialzein`, R26)
