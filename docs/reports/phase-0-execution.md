# Phase 0 execution report (2026-09-03)

How `docs/plans/phase-0.md` was executed, every decision the agent took on Ali's behalf, and what is left for Ali. Written by the controlling agent at the exit gate; the per-task briefs, reports and review diffs lived in the git-ignored `.superpowers/sdd/phase-0/` workspace and were deleted after this report was committed (the git history is the record).

## Outcome

| Item | Result |
|---|---|
| Roadmap tasks 0.1–0.11 | all implemented (plan Tasks 1–14), 30 commits on `main` from `db371a3` to the exit-gate commit |
| Process | one implementer subagent per task, an independent spec + quality review after each, scoped re-reviews per fix round, one whole-branch final review, one fix wave |
| Fix rounds | Task 7 ×1, Task 5 ×1, Task 10 ×1 (+1 pre-review), Task 11 ×1, Task 12 ×1, Task 14 ×2, Task 8 ×3, final wave ×1 |
| CI | green on every push since Task 11: last run https://github.com/alialzein/Kairos/actions/runs/33782973057 (privacy · lint/typecheck/test/build · codegen drift · compose build + healthy stack · migration + pgTAP 9/9) |
| Privacy proof | job "corpus must never be tracked" went RED on a PR that tracked `corpus/raw/x.txt`: https://github.com/alialzein/Kairos/actions/runs/33760172580 (PR #1, closed, branch deleted) |
| Local gate run (2026-09-03) | `pnpm install --frozen-lockfile · format:check · lint · typecheck · test · build · check:corpus --tracked` all exit 0; web 13 tests, scripts 10, shared 6, config 3, brain 24, trainer 5, voice 3, memory/style 2 each |
| Not verifiable on this laptop | Docker Desktop absent → `docker compose up`, `supabase start`/`test db`, the magic-link login and the Langfuse trace were only exercised in CI (compose + pgTAP) or not at all (login flow, Langfuse UI). Vercel preview not created. |

## Ali's open steps (in order)

> Superseded on 2026-09-04 by ADR-0014 (home stage): steps 1–2 now happen on the gaming PC per `docs/runbooks/local-dev.md` → "Home stage on the gaming PC"; steps 3–5 (Vercel, Supabase cloud, Hetzner) moved to roadmap Phase C; step 6 is unchanged.

1. Install Docker Desktop (plan P3), then follow `docs/runbooks/local-dev.md`: `.env` from `.env.example` with `SUPABASE_JWT_SECRET`, `docker compose -f infra/docker-compose.yml up -d --build --wait`, `pnpm supabase start`, `pnpm supabase test db`.
2. First sign-in: `ALLOW_SIGNUP=true` once, magic link via Mailpit, promote yourself in Studio, put your `auth.users.id` in `OWNER_USER_IDS` in BOTH `apps/web/.env.local` and the repo-root `.env`, set `ALLOW_SIGNUP=false`.
3. Vercel: import `alialzein/Kairos`, root directory `apps/web`, env vars per plan Task 11 Step 2 → preview URL is the last exit-gate evidence.
4. Supabase cloud: `pnpm supabase link --project-ref <ref>` + `db push`; add `https://<vercel-domain>/auth/confirm` to the redirect allowlist; disable "Enable email signups" once the owner exists.
5. Task 16 (Hetzner Falkenstein, ADR-0013) including the new Step 3b edge-hardening checklist.
6. One-line follow-up parked by the final review: add `< /dev/null` to the two `pnpm` calls inside `.githooks/pre-push` (multi-ref pushes), knowing CI now runs the privacy job on every branch push.

## Rulings (decisions taken on Ali's behalf — each with what it costs if wrong)

Pre-flight and process:
- **R1** `.superpowers/` ignored by Prettier, ESLint and git. Cost: none.
- **R2** `@types/node` added to `@twin/shared` devDependencies. Cost: none.
- **R3** All five Python services run in uvicorn factory mode (`<name>.main:create_app --factory`), no module-level `app` — brain's `create_app()` fails closed without a JWT secret and must not run at import. Cost: one CMD line per service.
- **R4** `@twin/config` ships a generated `identity` constant (`identity.generated.ts`, `pnpm --filter @twin/config gen`, drift-checked in CI); the web imports the constant, never reads YAML. Cost: one generated file.
- **R5** Implementers never push; the controller pushes after each clean review. Cost: none.
- **R6** Every commit ends with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. Cost: none.
- **R7** `next` is a root devDependency and the root ESLint config sets `settings.react.version` — `eslint-config-next` requires `next` at the root and pnpm never hoists it. Cost: one redundant root dependency.
- **R8** `.prettierignore` excludes `**/*.md` (Prettier governs code, not the hand-written docs). Cost: markdown style drift only.
- **R9** Root `package.json` has `"type": "module"` (silences Vitest's CJS-loader warning). Cost: one line.
- **R10** Web `typecheck` = `next typegen && tsc --noEmit`; `next-env.d.ts` git-ignored. Cost: a few seconds per typecheck.
- **R11** Web Vitest config is `vitest.config.mts`. Cost: a rename.
- **R12** `pnpm format` runs after scaffolding so Prettier owns generated formatting. Cost: none.
- **R13** Execution order 7 → 9 → 10 → 5 → 6 → 11 → 12 → 13 → 14 → 8 → 15 because Docker is absent locally; CI validates compose and Supabase. Cost: fix loops driven by CI output instead of local output.
- **R14** `pnpm gen:api` stays `bash scripts/gen-api.sh`; on this Windows machine run it via Git Bash explicitly (`bash` on PATH is the WSL launcher). Cost: a script alias later.
- **R16** `.githooks/*` and `scripts/gen-api.sh` committed with mode 100755. Cost: none.
- **R24** A new task may be dispatched while a CI watch for the previous task is still running, as long as no implementer is active and the files are disjoint. Cost: an interleaved fix round.
- **R26** Every push switches gh to `alialzein` first and restores the previous account afterwards (a push was refused once because the work account was active). Cost: an extra gh switch.

Brain / auth:
- **R15** Keep the spec-mandated `register` field name; silence exactly pydantic's shadowing warning with a message-scoped filter placed below the imports. Cost: three lines.
- Task 7 ruling: `jwt.decode` requires `sub`, `exp`, `aud` (docs/10 §3 — only Supabase-minted tokens are accepted); the pydantic mypy plugin runs with `init_typed = true`. Cost: none.

Privacy rails:
- **R17** "Tracked" means the git index (`git ls-files`), so a staged corpus file already counts. Cost: one assertion.
- **R18** `.githooks/pre-push` added as a second preventive gate. Cost: one small file.
- **R19** NUL-delimited git output (non-ASCII filenames were invisible to the check), case-insensitive `corpus/` prefix, `--diff-filter=ACMRT`, isolated git config and temp-dir cleanup in the tests. Cost: a few lines.
- **R36** (parked) `< /dev/null` on the in-loop `pnpm` calls in the pre-push hook and the "blob added then removed within one push" gap are left as a follow-up; CI on every branch push is the backstop. Cost: a multi-ref push could skip the local hook for later refs.

Infra / CI / data:
- **R20** Brain stays fail-closed; the runbook requires a populated `.env` before `docker compose up`; CI writes a throwaway secret (**R21**). Cost: one doc line + one CI step.
- **R22** `astral-sh/setup-uv` pinned to `@v10.0.1` (no floating `v10` tag exists); caddy gets a healthcheck. Cost: two lines.
- **R23** pgTAP `throws_ok` uses the 4-argument form (the 3-argument form treats the description as the expected message). Cost: one line; the message string is Postgres-version specific.
- **R25** `gen-api.sh` writes the OpenAPI JSON with LF from Python; `.gitattributes` normalises to LF (Windows CRLF broke the codegen drift check). Cost: a one-file renormalisation.
- **R35** Edge hardening (docs/openapi off in production, `/metrics` not routed publicly, non-root `USER`, digest pins) deferred to Task 16 as a checklist step. Cost: none until a domain is bound.

Web:
- **R27** `identityPath()` is lazy; importing `@twin/config` has no side effects in the Next bundle. Cost: one exported name.
- **R28** `renameTwin` validates and regex-escapes the current name; quoted dates in YAML are preserved and tested. Cost: two lines.
- **R29 / R32 / R33** `safeNextPath` (three rounds): same-origin path only — single leading `/`, no backslash/CR/LF/tab, parse against a sentinel origin, reject `//`-prefixed normalised paths, re-parse the returned value the way the call site will. Property-tested over 14 malicious inputs; two reviewers probed ~70 payloads. Cost: none.
- **R30** `/auth/confirm` handles both PKCE `?code=` and `token_hash`+`type` (the default Supabase email template + `@supabase/ssr` deliver `?code=`). Cost: one branch.
- **R31** Sign-up is gated by `ALLOW_SIGNUP` (default false); first sign-in procedure in the runbook. Cost: one env flag.

Final review fix wave:
- **R34** In one commit: `OWNER_USER_IDS` documented as shared by web and services; `turbo.json` `globalDependencies` (fixtures, persona, `.env.example`) so cached Python suites cannot return a false green; zod and Pydantic both strict on unknown keys with invalid fixtures on both sides; pgTAP asserts a guest cannot self-promote and `anon` sees nothing (plan(9)); missing-`exp` JWT test; privacy CI job on every branch push and a pre-push hook that checks the pushed range (`check:corpus --range`); brain logs the owner-allowlist size at startup. Cost: one CI run.

## Deferred minors (triaged by the final review)

Fix in Phase A2: TestClient deprecation warnings (`httpx2`), `WWW-Authenticate` on 401, `PyJWKClient` timeout, Langfuse web/worker healthchecks, `format: date` enforcement and `additionalProperties: false` in the persona schema, redundant `turns_session_idx` (next migration), `profiles` owner update policy, proxy redirect cookie handling + `?next=` wiring, per-page auth checks as the `(owner)` group grows, `createBrowserSupabase` needs build-time `NEXT_PUBLIC_*` when first used, sign-out route, `TracerProvider.shutdown()` on SIGTERM, scoping `env_file` secrets per compose service, `@twin/shared` export path for the generated client, `pnpm twin:rename` stale "Kairos" strings (login page copy, `persona/core.yaml` projects, trainer test literal).
Fix in Phase B5: `--twin-spine-*` tokens in `@theme inline`; `vitest.config.mts` needs jsdom + `.tsx`.
Fix in Task 16: R35 checklist; pin `ghcr.io/astral-sh/uv` and the minio image by digest; obs profile is LOCAL ONLY (hardcoded passwords).
Dropped: eslint peer-version warnings, cosmetic ordering, five verbatim service scaffolds (plan-mandated), caddy `down -v` not `if: always()` (ephemeral runners), the defensive second re-parse in `safeNextPath`, HS256 `getUser` round-trip (local only).

## Incidents

- Push of `796fa05` was refused (403 for `alizein-mm`): gh's active account had been switched outside this session → R26.
- Two implementers committed with a red check (Task 10's test, Task 14's build) instead of reporting; both were caught by the controller/review and fixed in the next round.
- Opus reviewers were overloaded (HTTP 529) for Task 6; the review ran on Sonnet.
