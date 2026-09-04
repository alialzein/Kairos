# Home stage design — the free, local first version (2026-09-04)

Design approved by Ali on 2026-09-04 (brainstorming session). Decision record: `docs/adr/0014-home-stage.md`. Implementation plan: `docs/plans/home-stage.md`.

## 1. Goal

Version 1 of the Twin runs entirely on Ali's gaming PC, costs nothing, and sends nothing to any cloud. When Ali is satisfied, the same code moves to the cloud stage (Vercel + Supabase cloud + VPS) by changing environment values and running Phase C — not by changing code.

Scope of v1 = roadmap Phase A1 (corpus + interviews) and A2 (Persona Core + Brain + Twin Eval), with B5 (avatar) in parallel; A3 and A4 continue in the home stage. Voice (A6) and the cloud move (Phase C) come after.

## 2. Stages

| Stage | Web | Services | Data | Reasoner | Cost |
|---|---|---|---|---|---|
| **home** (now) | `pnpm dev` on the PC | compose on the PC (+ `pc` + `obs` profiles) | Supabase local (CLI) on the PC | Ollama on the PC (`qwen3.5:9b`) | 0 |
| **cloud** (Phase C) | Vercel | VPS compose (ADR-0008/0013) + PC over Tailscale | Supabase cloud | frontier API (ADR-0003, Q4) | Reasoner API, VPS, voice vendors |

A stage is a set of `.env` values. Code never branches on "stage"; it reads provider names and URLs.

## 3. Home-stage topology

```
┌──────────── Ali's gaming PC · Windows 11 · RTX 5070 12 GB · 32 GB DDR5 ────────────┐
│                                                                                     │
│  laptop / phone ──LAN (Tailscale optional)──▶ apps/web  `next dev -H 0.0.0.0` :3000 │
│                                                   │ HTTP + SSE, Supabase JWT        │
│  Docker Desktop (WSL2 backend)                    ▼                                 │
│   compose: caddy :80 ─▶ brain :8000 · memory :8001 · voice :8002 · redis · falkordb │
│   pc profile: style :8003 · trainer :8004 (CUDA)   obs profile: langfuse :3001      │
│   supabase local (CLI): api :54321 · db :54322 · studio :54323 · mailpit :54324     │
│                                                                                     │
│  Ollama (native Windows, CUDA) :11434 ◀── brain (host.docker.internal) / trainer    │
│     Reasoner: qwen3.5:9b (alt qwen3:14b) · embeddings: bge-m3                       │
│                                                                                     │
│  corpus/ raw + derived — LOCAL ONLY, never leaves this machine                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
Outbound traffic: none to any LLM, voice, hosting or database vendor.
```

## 4. Components and interfaces

| Unit | Does | Used through | Depends on | Home-stage value |
|---|---|---|---|---|
| Reasoner provider (`services/brain`, task A2.5) | streams a draft answer as Ali | `Provider.stream(messages, system) -> async iterator[delta]` | `REASONER_PROVIDER`, `OLLAMA_BASE_URL`, `REASONER_MODEL` | `ollama`, `http://host.docker.internal:11434`, `qwen3.5:9b` |
| Embedder (`services/trainer`, memory) | vectors for exemplars and episodes | `embed(texts) -> list[vector]` | `EMBEDDING_MODEL` | `bge-m3` (sentence-transformers, or Ollama `bge-m3`) |
| Graphiti (A3) | temporal facts | Graphiti client with an OpenAI-compatible LLM + embedder | Ollama `/v1` endpoint | same model as the Reasoner |
| LLM judge (A2.7) | scores Twin Eval items | eval runner config | Reasoner provider | local model, results labelled `judge=local` |
| Web | UI, avatar, dashboard | browser on the LAN | Supabase local URL + publishable key | `http://<pc-ip>:54321` |
| Supabase local | Postgres, pgvector, Auth, Mailpit | `pnpm supabase start` | Docker Desktop | migrations unchanged |

Nothing else changes: contracts, auth, RLS, privacy rails, telemetry are stage-independent already.

## 5. Configuration (`.env.example`)

```
REASONER_PROVIDER=ollama
OLLAMA_BASE_URL=http://host.docker.internal:11434
REASONER_MODEL=qwen3.5:9b
EMBEDDING_MODEL=bge-m3
```

Ollama must listen on all interfaces for containers to reach it (`OLLAMA_HOST=0.0.0.0:11434` as a Windows user environment variable). When `brain` runs via `uv` instead of compose, `OLLAMA_BASE_URL=http://localhost:11434`.

## 6. Turn data flow (home stage)

1. Browser on the laptop → `http://<pc-ip>:3000` → web server on the PC → `POST /turn` on brain (caddy :80) with the Supabase JWT.
2. Brain assembles context (Persona Core, working memory, exemplars from Supabase local) and streams from Ollama over the Docker host gateway.
3. Deltas stream back over SSE; post-turn persistence goes to Supabase local; traces go to Langfuse on the PC.

No step crosses the PC's network boundary except the LAN hop from the laptop's browser.

## 7. Dropped from v1, deferred to Phase C or A6

Vercel, Supabase cloud, Hetzner VPS, Tailscale PC↔VPS, sops (plain `.env` is enough on one machine), frontier Reasoner APIs, ElevenLabs, Deepgram, LiveKit Cloud. Voice A6 keeps its bake-off and gains a free local candidate stack: faster-whisper (CUDA) STT, Piper or Kokoro TTS, F5-TTS/XTTS-v2 for the clone, self-hosted `livekit-server` in compose.

## 8. Privacy

Unchanged rules, stricter reality: in the home stage nothing leaves the PC. The scrubber (A1.3), uploader allowlist and egress audit (A1 gate) are built and tested anyway, so the cloud stage inherits proven rails and pipeline behaviour never depends on locality.

## 9. Evaluation

A2.7's LLM judge is the local model. Gate thresholds stay as written but every recorded score carries `judge=local`. Phase C task C.6 re-runs the item bank with a frontier judge and records both before the provider switch.

## 10. Error handling and degradation (home stage)

| Failure | Behaviour |
|---|---|
| Ollama down or model not pulled | brain `/health` reports `reasoner: unavailable`; `/turn` returns a typed `error` event; UI shows OFFLINE |
| Ollama slow (model spilled to RAM) | latency spans show it; runbook says switch `REASONER_MODEL` to a smaller tag |
| PC asleep | everything is down; acceptable for an owner-only v1 |
| Laptop cannot reach the PC | firewall rules for 3000/54321/80 on the Private profile; Tailscale as the off-LAN path |

## 11. Files touched by this change

New: `docs/adr/0014-home-stage.md`, `docs/plans/home-stage-design.md` (this file), `docs/plans/home-stage.md`.
Edited: `README.md`, `CONTEXT.md`, `.env.example`, `docs/02`, `docs/03`, `docs/05`, `docs/07`, `docs/10`, `docs/11`, `docs/12`, `docs/13`, `docs/STATUS.md`, `docs/runbooks/local-dev.md`, `docs/reports/phase-0-execution.md`, `docs/plans/phase-0.md` (Task 16 note), `docs/adr/0002`, `0003`, `0008`, `0013` (amended-by / scope lines).
No application code changes; the first code consumer of the new env values is task A2.5.

## 12. Verification

`pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm check:corpus --tracked` stay green (no code changed; `.env.example` is a turbo global dependency so caches are invalidated). On the PC, the runbook's home-stage section is the acceptance test: `docker compose ps` all healthy, `pnpm supabase test db` green, `ollama ps` shows the model on the GPU, first owner sign-in from the laptop.
