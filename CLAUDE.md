# CLAUDE.md — operating instructions for AI agents in this repo

You are implementing **TWIN**, Ali Alzein's digital self. Read this file fully before doing anything.

## 1. Read order (mandatory, once per session)

1. `README.md`
2. `CONTEXT.md` (glossary — use these terms exactly)
3. `docs/11-roadmap.md` → find the current phase (see `docs/STATUS.md`, create it in Phase 0)
4. The spec docs the current phase references
5. `docs/adr/` — never contradict an accepted ADR; propose a new ADR if you must change one

## 2. Process rules

- **Plan before code.** Every phase task starts with a short written plan (files to touch, tests to write). Use `/writing-plans` (superpowers) for anything > 30 minutes of work.
- **Grill when unsure.** If a spec is ambiguous, run `/grill-with-docs` with Ali instead of guessing. Facts are your job; decisions are Ali's.
- **TDD.** Red → green → refactor. No implementation without a failing test first for logic code. UI/shader code: visual check + snapshot/perf test.
- **Small steps, frequent commits.** Conventional commits (`feat:`, `fix:`, `docs:`, `test:`, `chore:`).
- **Verify before claiming done.** Run the project's lint/typecheck/tests and paste real output. Never say "should work".
- **Update `docs/STATUS.md`** at the end of every work session: what shipped, what's next, blockers.
- **Update `CONTEXT.md`** whenever a new domain term is introduced or resolved.
- **Write an ADR** (`docs/adr/NNNN-title.md`) when a decision is (a) hard to reverse, (b) non-obvious, and (c) will be questioned later.

## 3. Hard boundaries (never violate)

- **Raw corpus stays local.** Nothing under `corpus/raw/` or `corpus/derived/` is ever uploaded, committed, logged, or sent to a cloud API in bulk. Only PII-scrubbed *snippets* selected by retrieval may enter a cloud prompt. See `docs/10-security-privacy.md`.
- **No secrets in code or docs.** Use `.env` (gitignored) and `sops`-encrypted files. `.env.example` lists every variable.
- **Persona Core changes are human-approved.** The agent may propose edits to `persona/core.yaml` via the Review Inbox; it never auto-applies them.
- **The Twin discloses it is an AI** when talking to anyone other than Ali (Phase 8 guest mode).
- **No new cloud vendor** without an ADR.

## 4. Stack (do not drift)

- Web: Next.js (App Router) · React 19 · TypeScript strict · Tailwind + CSS tokens (light/dark) · React Three Fiber v9 · `three/webgpu` + TSL · Zustand · Supabase JS.
- Python services: Python 3.12 · `uv` · FastAPI · Pydantic v2 · LiveKit Agents · Graphiti · Unsloth/TRL · pytest.
- Data: Supabase Postgres + pgvector · FalkorDB (Graphiti backend) · Redis.
- Monorepo: pnpm workspaces + Turborepo; Python services each own a `pyproject.toml`.

## 5. Quality bars

- TypeScript: `strict`, no `any` without a comment, ESLint + Prettier clean.
- Python: `ruff` + `mypy --strict` clean.
- Avatar: 60 fps desktop / 30 fps mid-range Android at the configured particle count; no frame > 33 ms in a 60-second idle→speak cycle.
- Voice: median end-of-speech → first audio ≤ 1.2 s (Phase 6 target), ≤ 0.8 s (Phase 8).
- Every phase has an exit gate in `docs/11-roadmap.md`. Gates are tests, not opinions.

## 6. When you finish a task

Report in this shape: **What changed** (files) · **How verified** (commands + output) · **What's next** · **Open questions for Ali**.
