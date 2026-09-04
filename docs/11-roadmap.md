# 11 — Roadmap: phases, tasks, exit gates

Two tracks run in parallel after Phase 0. **Track A — Mind** (identity, brain, memory, style, voice). **Track B — Body** (avatar, mobile). The agent works one phase at a time per track; Ali may run two agent sessions (one per track) in separate git worktrees.

Each task lists: files to create/touch · tests · done-when. The agent expands tasks into 2–5 minute steps with `/writing-plans` before coding.

**Stages (ADR-0014).** Phases 0 → A4 and B5 run in the *home stage*: everything on Ali's gaming PC, local Reasoner via Ollama, no paid service. **Phase C — Cloud move** (below, after Track B) is the switch to Vercel + Supabase cloud + VPS; it can start any time after A2 and is recommended after A4.

`docs/STATUS.md` template:

```
# STATUS
Current phase: A0 / B-
Last session: <date> — <what shipped>
Next: <task id>
Blockers: <open question ids>
Gate history: A0 ✅ 2026-..., ...
```

---

## Phase 0 — Foundations (Track A+B, ~1 week)

Goal: an empty but fully wired monorepo where every service runs, tests pass, CI is green, and secrets/privacy rails exist.

| ID | Task | Files | Tests / done-when |
|---|---|---|---|
| 0.1 | Monorepo scaffold: pnpm workspaces + Turborepo; `apps/web` (Next.js, TS strict, Tailwind, token CSS light/dark), `packages/shared`, `packages/config` | `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `apps/web/*`, `packages/*` | `pnpm build && pnpm lint && pnpm typecheck` green |
| 0.2 | Python services scaffold with `uv`: `services/brain`, `services/memory`, `services/voice`, `services/trainer`, `services/style` each with FastAPI hello (voice: worker stub), `ruff`, `mypy --strict`, `pytest` | `services/*/pyproject.toml`, `services/*/src/...`, `services/*/tests/test_health.py` | `uv run pytest` green in each; `/health` returns 200 |
| 0.3 | Docker Compose for VPS profile (brain, memory, voice, redis, falkordb, caddy) and PC profile (style, trainer) | `infra/docker-compose.yml`, `infra/docker-compose.pc.yml`, `infra/Caddyfile` | `docker compose config` valid; `docker compose up` all healthy locally |
| 0.4 | Supabase project + migrations tooling (`supabase` CLI); initial migration with tables from `08-data-model.md` §1 + pgvector | `supabase/migrations/0001_init.sql`, `supabase/config.toml` | Migration applies on a fresh local Supabase; RLS policies tested with 2 users |
| 0.5 | Auth: Supabase Auth in web app, Owner allowlist, JWT verification middleware in Python services | `apps/web/src/lib/auth/*`, `services/brain/src/brain/auth.py` | Test: request without JWT → 401; owner JWT → 200; guest JWT → 403 on owner routes |
| 0.6 | Shared contracts: `AvatarState`, `TurnEvent`, `TurnRequest` (zod) + Pydantic mirrors; OpenAPI codegen script | `packages/shared/src/*`, `services/brain/src/brain/schemas.py`, `scripts/gen-api.sh` | Contract test: sample payloads validate on both sides |
| 0.7 | Privacy rails: `corpus/` structure + `.gitignore`; CI check that fails on staged `corpus/**`; `.env.example`; sops+age setup doc | `corpus/README.md`, `.github/workflows/ci.yml`, `.env.example`, `docs/runbooks/secrets.md` | CI fails on a test commit that stages `corpus/x.txt`; passes otherwise |
| 0.8 | CI: lint/typecheck/test for TS and Python; Docker build; Vercel preview | `.github/workflows/ci.yml` | Green on main |
| 0.9 | Observability skeleton: OpenTelemetry in brain with per-stage spans; local Langfuse (compose profile `obs`) | `services/brain/src/brain/telemetry.py`, `infra/docker-compose.obs.yml` | A `/turn` stub emits a trace with 5 stages |
| 0.10 | Docs hygiene: `docs/STATUS.md`, `docs/plans/`, ADR template, `persona/` folder with empty `core.yaml` skeleton from `04-identity-model.md` §3 | `docs/STATUS.md`, `docs/adr/0000-template.md`, `persona/core.yaml` | Files exist; `core.yaml` validates against `persona/schema.json` |
| 0.11 | `identity.yaml` with `TWIN_NAME = Kairos`, wake phrase "Hey Kairos", palette; a `pnpm twin:rename <name>` script that updates all references | `packages/config/identity.yaml`, `scripts/rename.ts` | Script run changes name in web title, prompt template, and wake config |

**Exit gate A0/B0**: CI green; `docker compose up` (VPS profile) healthy on the PC; auth tests pass; privacy CI check proven; STATUS.md initialized. *("Vercel preview deploys" moved to Phase C task C.1 by ADR-0014.)*

---

## Track A — Mind

### Phase A1 — Corpus + Interviews (~2–3 weeks, Ali's time-bound)

Goal: all decided sources ingested locally, scrubbed and labeled; Interviewer Agent built; 3–5 h of interviews recorded and transcribed; voice reference audio captured.

| ID | Task | Files | Done-when |
|---|---|---|---|
| A1.1 | Ingestion framework: `Source` adapter interface, `Message` model, run manifest | `services/trainer/src/trainer/ingest/{base,models,manifest}.py`, tests | Unit tests with fixture exports |
| A1.2 | Adapters: Claude export, ChatGPT export, markdown/docx/pdf/txt docs, social CSV, mbox + Gmail API (sent+inbox, work account) | `ingest/adapters/{claude,chatgpt,docs,social,gmail}.py` | Each adapter: fixture → expected `Message[]` test |
| A1.3 | Scrubber: secrets, PII, pseudonymization with local mapping | `ingest/scrub.py`, `tests/test_scrub.py` | Golden tests: 50 hand-made cases incl. Arabic numerals/phones |
| A1.4 | Sessionize + label (register, audience, lang_mix, topics) using a **local** model via Ollama first, Reasoner allowed only on scrubbed text behind a flag | `ingest/{sessionize,label}.py` | Label accuracy ≥ 90% on a 100-item hand-labeled sample |
| A1.5 | Derived outputs: parquet + jsonl builders incl. `sft_rewrite` neutral-paraphrase generator | `ingest/derive/*.py` | Schema tests; counts in manifest |
| A1.6 | Interview Protocol as data: modules, prompts, coverage tracker | `services/trainer/src/trainer/interview/protocol.yaml` | Loads; coverage tracker unit tests |
| A1.7 | Interviewer Agent (Reasoner-driven, adaptive follow-ups, language mirroring) + web page `/interview` with recording (MediaRecorder, WAV 48k) and live transcript | `services/brain/src/brain/interviewer.py`, `apps/web/src/app/(owner)/interview/*` | 15-min dry run; audio saved to PC via local upload target; transcript json |
| A1.8 | Local transcription (whisper-large-v3 class multilingual) with diarization off (single speaker) and language tags per segment | `services/trainer/src/trainer/transcribe.py` | WER spot-check on 5 min ≤ 15% ar, ≤ 10% en |
| A1.9 | Voice recording page `/dev/record` with read scripts en/ar, level meter, take manager | `apps/web/src/app/(owner)/dev/record/*`, `services/trainer/voice/scripts/*` | ≥ 60 min usable audio in `corpus/voice/` |
| A1.10 | Ali does the interviews (3–5 h) and recordings | — | `corpus/interviews/*` complete; held-out 20% of M5/M8 tagged |

**Exit gate A1**: manifest shows all sources with scrub reports; egress audit proves zero outbound bytes during ingestion; ≥ 3 h interview transcripts; ≥ 60 min voice audio; held-out eval items exported to `eval_items`.

### Phase A2 — Persona Core v1 + Brain v1 + Twin Eval v1 (~2 weeks)

Goal: text chat with the Twin that already feels like Ali using Persona Core + Style Exemplars; a measured Fidelity Score.

| ID | Task | Files | Done-when |
|---|---|---|---|
| A2.1 | Persona Extraction: evidence → structured proposals per schema section, with source spans and confidence | `services/trainer/src/trainer/persona/extract.py`, `persona/prompts/extract_*.md` | Produces `persona/proposals/v1.yaml`; schema-valid |
| A2.2 | Review UI: proposal diff viewer, accept/edit/reject per leaf; merge → `core.yaml` v1 + changelog | `apps/web/src/app/(owner)/persona/*`, `services/memory/src/memory/persona_api.py` | Ali approves v1 |
| A2.3 | Persona prompt renderer (compact ≤ 2.5k tokens) + register/language directives | `services/brain/src/brain/persona_prompt.py` | Token budget test; snapshot test |
| A2.4 | Style Exemplar index: embed + upload allowlisted `exemplars.jsonl` → `style_exemplars`; retrieval API | `services/trainer/.../exemplars/upload.py`, `services/memory/.../exemplars.py` | Retrieval returns register/language-filtered top-k in < 80 ms |
| A2.5 | Brain `/turn` (SSE): context assembly (Persona Core + working memory + exemplars), Reasoner streaming, memory-candidate extraction stub, provider abstraction — `ollama` provider first (home stage, ADR-0014; `REASONER_PROVIDER`, `OLLAMA_BASE_URL`, `REASONER_MODEL`); frontier providers with fallback order arrive in Phase C behind the same interface | `services/brain/src/brain/{turn,context,providers/*}.py` | Integration test with mocked provider; latency spans; `/health` reports Reasoner availability |
| A2.6 | Chat UI (owner): streaming, session list, feedback buttons, provenance panel ("why"), lite-mode badge | `apps/web/src/app/(owner)/chat/*` | E2E Playwright: send → streamed reply → feedback stored |
| A2.7 | Twin Eval v1: item bank loader, runner (config matrix), LLM-judge with rubrics (the local model in the home stage; every score records `judge`), Fidelity computation, dashboard radar | `services/trainer/src/trainer/eval/*`, `apps/web/src/app/(owner)/eval/*` | First run recorded; smoke subset wired into CI |
| A2.8 | Ali's test-retest: re-answer 60 held-out items two weeks after interviews | — | `ali_answer_retest` populated |

**Exit gate A2**: Fidelity ≥ 0.70 on `reasoner+exemplars` (local judge, ADR-0014; re-measured with a frontier judge in Phase C task C.6); chat p50 first-token ≤ 1.5 s; Persona Core v1 approved; CI eval smoke passing.

### Phase A3 — Living Memory (~2 weeks)

| ID | Task | Files | Done-when |
|---|---|---|---|
| A3.1 | Graphiti on FalkorDB with custom ontology; memory service CRUD + search(as_of) | `services/memory/src/memory/{graph,ontology}.py` | Temporal test: fact A valid → contradicted → `as_of` queries correct |
| A3.2 | Episodic store (pgvector) + session summaries | `services/memory/.../episodes.py` | Retrieval tests |
| A3.3 | Post-turn extractor → Memory Candidates with sensitivity classifier; auto-accept rules; Redis buffer on outage | `services/brain/.../extract.py`, `services/memory/.../candidates.py` | Rule tests for each branch in `05` §3 |
| A3.4 | Review Inbox UI + audit log viewer + delete/forget flows | `apps/web/src/app/(owner)/memory/*` | E2E: approve, reject, edit, delete cascades |
| A3.5 | Context assembly upgrade: semantic + episodic + policies with token budgeting and provenance tags | `services/brain/.../context.py` | Budget tests; provenance appears in UI |
| A3.6 | Reflection worker (consolidate, contradictions, policy induction, persona drift proposals, exemplar refresh, report card) | `workers/reflection/*` | Runs on a fixture day; produces proposals + report |
| A3.7 | Connectors v1: Gmail (work), notes folder; scheduled on PC; emit candidates | `workers/connectors/{gmail,notes}.py` | Dry run yields candidates; no raw text leaves PC |

**Exit gate A3**: the self-learning test in `05` §9 passes automatically; memory precision ≥ 0.9 / recall ≥ 0.8 on the Phase 3 item set; Fidelity (memory axis) improves vs A2.

### Phase A4 — Style Engine (~2 weeks, GPU)

| ID | Task | Files | Done-when |
|---|---|---|---|
| A4.1 | ADR: base model + VRAM plan — Q2 resolved: RTX 5070 12 GB, train locally (Blackwell/sm_120 needs CUDA 12.8+ builds of torch and Unsloth) | `docs/adr/00xx-style-base-model.md` | Accepted |
| A4.2 | Dataset builder: mix rewrite/reply, balance registers/languages, 10% holdout, dataset hash | `services/trainer/src/trainer/train/dataset.py` | Stats report; hash in `training_runs` |
| A4.3 | QLoRA training script (Unsloth + TRL), config YAML, resumable, nightly-schedulable, logs to `training_runs` | `services/trainer/src/trainer/train/{sft,config}.py`, `configs/sft_v1.yaml` | Adapter produced; eval loss curve saved |
| A4.4 | Style service: serve base+adapter (vLLM or Ollama), `/v1/chat/completions`, health endpoint, Tailscale-only | `services/style/*` | Rewrite call p50 ≤ 300 ms for 40 tokens |
| A4.5 | Brain style pass: sentence-chunked streaming rewrite, register gating, circuit breaker → lite mode, meaning-preservation sampler | `services/brain/.../style.py` | Tests: pass-through on outage; preservation ≥ 95% on sample |
| A4.6 | Eval ablation runs: reasoner-only vs +exemplars vs +style vs style-only | — | Report in dashboard |
| A4.7 | Blind human test #1 (5 raters × 20 pairs) | `docs/reports/blind-test-1.md` | Result recorded |

**Exit gate A4**: Fidelity ≥ 0.80 with style pass; lexical/syntactic axes improve ≥ 15% over A2; blind test ≥ 35%; no latency regression beyond +300 ms first token.

### Phase A6 — Voice (~2–3 weeks) *(numbered to align with the overall order; B5 runs before it)*

Home-stage note (ADR-0014): A6.1's bake-off also measures the free local stack on the PC's GPU — faster-whisper (large-v3-turbo) STT, Piper/Kokoro TTS, F5-TTS/XTTS-v2 for the clone (`docs/07` §4.2 fallback), self-hosted `livekit-server` in compose. Paid voice vendors (ADR-0006, Deepgram, LiveKit Cloud) are cloud-stage choices confirmed by ADR at A6.1.

| ID | Task | Files | Done-when |
|---|---|---|---|
| A6.1 | STT bake-off on Ali's recordings (Deepgram, ElevenLabs Scribe, local whisper) → ADR | `docs/reports/stt-bakeoff.md`, ADR | WER table; choice made |
| A6.2 | LiveKit Cloud project; token endpoint in brain; web client (mic permission, session UI, energy meter) | `apps/web/src/voice/*`, `services/brain/.../livekit_token.py` | Web ↔ echo agent works |
| A6.3 | Voice worker: VAD/turn detection, STT stream, brain client, sentence chunker, TTS stream, barge-in, avatar events, per-stage tracing | `services/voice/src/voice/*` | Recorded-audio fixture tests: barge-in, mixed-language turn |
| A6.4 | Wake phrase: Porcupine web SDK, custom keyword trained, sensitivity + VAD confirmation, indicator + kill switch | `apps/web/src/wake/*`, `packages/config/identity.yaml` | False accepts < 1/hour in a 4-hour room test; detection ≥ 95% at 2 m |
| A6.5 | Voice Clone: instant clone for bring-up; professional clone from full set; MOS eval | `docs/reports/voice-clone-eval.md` | Similarity MOS ≥ 4.0 en, ≥ 3.8 ar |
| A6.6 | Text fallback + provider health UI | — | Simulated outage test |

**Exit gate A6**: median end-of-speech → first audio ≤ 1.2 s; barge-in works; wake phrase metrics met; Ali rates 20 voice turns "sounds like me" ≥ 4/5 average.

### Phase A8 — Evolution + Guest mode + Autonomy (ongoing)

| ID | Task | Done-when |
|---|---|---|
| A8.1 | Feedback → DPO pairs → weekly adapter refresh gated by eval | Two cycles completed; Fidelity non-decreasing |
| A8.2 | Guest mode: invite links, disclosure, sensitivity filter, guest-safe memory rules, rate limits | Guest E2E; boundary probes pass |
| A8.3 | Boundary classifier on outputs | Eval boundary axis = 100% |
| A8.4 | Latency tuning to ≤ 0.8 s (preemptive generation, sentence-1 skip, region) | Measured |
| A8.5 | More connectors (calendar, WhatsApp export), preservation export (full portable bundle) | Runbook + test restore |
| A8.6 | Blind human test #2 | ≥ 40% |

---

## Track B — Body

### Phase B5 — Avatar (~3 weeks; can start right after Phase 0)

| ID | Task | Files | Done-when |
|---|---|---|---|
| B5.1 | R3F v9 + WebGPU canvas with WebGL fallback; tier detection + FPS probe | `apps/web/src/avatar/{AvatarCanvas,tier}.ts(x)` | Renders on desktop Chrome (WebGPU) and Safari/Android (WebGL) |
| B5.2 | Shape generators + GLB point sampler script (humanoid bust, orb, nebula, ring, core, spine, waves) | `apps/web/src/avatar/sim/targets/*`, `scripts/sample-glb.ts` | Deterministic outputs; snapshot tests of first 100 points |
| B5.3 | TSL compute simulation: morph mix, curl noise, forces, audio uniforms, pointer repulsion; sprite material + additive blend | `apps/web/src/avatar/sim/*` | Visual check; frame-time p95 within tier budget |
| B5.4 | State machine + tween table (`packages/config/avatar.ts`) driven by `TurnEvent`s and local audio analysis | `apps/web/src/avatar/useAvatarState.ts` | Unit tests for transitions incl. OFFLINE from any state |
| B5.5 | Post-processing (bloom, aberration on WAKING, vignette) | `apps/web/src/avatar/post/*` | Toggleable per tier |
| B5.6 | `/dev/avatar` playground with Leva controls + state stepper + audio file injector | `apps/web/src/app/(owner)/dev/avatar/*` | Ali tunes look; token values committed |
| B5.7 | Integrate into chat page: Avatar hero, status ring, transcript ribbon, drawer; light/dark tokens | `apps/web/src/app/(owner)/page.tsx` | E2E: send message → THINKING → SPEAKING (TTS or synthetic energy) → IDLE |
| B5.8 | Perf CI: Playwright frame sampling on fixed profile; baseline recorded | `apps/web/tests/perf/avatar.spec.ts` | Regression > 15% fails CI |

**Exit gate B5**: 60 fps desktop / 30 fps on Ali's phone at tier settings; all 7 states visually approved by Ali; reduced-motion respected; perf CI green.

### Phase B7 — Mobile (~2 weeks; after A6 and B5)

| ID | Task | Files | Done-when |
|---|---|---|---|
| B7.1 | PWA: manifest, service worker (offline shell), install prompt, safe-area layout, mobile audio unlock handling | `apps/web/public/manifest.json`, `apps/web/src/pwa/*` | Lighthouse PWA pass; installs on Android + iOS |
| B7.2 | Capacitor project wrapping the Next.js static export; splash/icons; deep links | `apps/mobile/*` | Debug APK runs the app |
| B7.3 | Native wake-phrase plugin (Porcupine Android SDK, foreground service, notification) | `apps/mobile/plugins/wake/*` | Wake works with screen off |
| B7.4 | Mic/WebRTC permissions + background audio behavior on Android | — | Voice session survives screen off 5 min |
| B7.5 | OTA updates for the web layer (Capgo or similar) — ADR | — | One OTA update delivered |
| B7.6 | Release: signed APK, Play internal testing track (optional) | `docs/runbooks/release-android.md` | Installed on Ali's phone |

**Exit gate B7**: APK installed; wake → voice turn works on phone; Avatar at Mid tier ≥ 30 fps; PWA works on iOS Safari (voice via tap-to-talk if wake unsupported).

---

## Phase C — Cloud move (ADR-0014; any time after A2, recommended after A4)

Goal: the proven home-stage Twin runs in the cloud stage (ADR-0008, ADR-0013) with a frontier Reasoner, without code changes beyond the provider layer.

| ID | Task | Files | Done-when |
|---|---|---|---|
| C.1 | Vercel project import (`apps/web`), env vars, preview on PRs — steps in `docs/plans/phase-0.md` Task 11 Step 2 | — | Preview URL renders `/login` |
| C.2 | Supabase cloud project: `supabase link` + `db push`; redirect allowlist; email signups off once the owner exists; services switch to `SUPABASE_JWKS_URL` | `supabase/config.toml`, `.env` | Migration applied; pgTAP green against the linked project |
| C.3 | VPS deploy on Hetzner Falkenstein incl. the edge-hardening checklist — `docs/plans/phase-0.md` Task 16 | `docs/runbooks/deploy-vps.md` | `https://api.<domain>/brain/health` over TLS |
| C.4 | Reasoner provider switch: decide Q4 (primary + fallback frontier API) by ADR; implement providers behind the A2.5 interface; only scrubbed payloads may leave | `services/brain/src/brain/providers/*`, ADR | Provider tests; egress audit shows only allowlisted payloads |
| C.5 | Tailscale PC ↔ VPS for style/trainer (ADR-0008) | `infra/docker-compose.pc.yml` | VPS reaches style `/health` over Tailscale only |
| C.6 | Re-run Twin Eval with the frontier judge; record local vs frontier scores side by side | `docs/reports/eval-judge-comparison.md` | Report committed; gates re-checked |
| C.7 | Voice vendors (ElevenLabs, Deepgram, LiveKit Cloud) only if A6 chose them by ADR | — | Per that ADR |

**Exit gate C**: web on Vercel, services on the VPS, data on Supabase cloud; owner sign-in works end to end; egress audit proves zero corpus bytes leave the PC; Fidelity with the frontier judge meets the A2/A4 gate values.

---

## Order of execution (recommended)

`0` → `A1` (Ali-time heavy; start `B5` in parallel) → `A2` → `A3` → `A4` → `C` (cloud move, when Ali decides) → `A6` → `B7` → `A8` (ongoing).

## Time estimate

Roughly 4–5 months of part-time work with agents, dominated by A1 (Ali's interviews), A4 (training iterations), and B5 (visual polish). Phases are sized so any single phase can be re-planned without touching the others.
