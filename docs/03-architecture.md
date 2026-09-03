# 03 — Architecture

## 1. Topology (where things run)

```
┌───────────────────────── Vercel ─────────────────────────┐
│ apps/web (Next.js)                                       │
│  • Avatar (R3F/WebGPU)  • Chat UI  • Dashboard/Review    │
│  • PWA  • Wake word (Porcupine WASM)  • LiveKit client   │
└───────────────┬──────────────────────────────────────────┘
                │ HTTPS/WSS (JWT from Supabase Auth)
┌───────────────▼──────────── VPS (Docker Compose) ────────┐
│ services/brain     FastAPI  — orchestrator, SSE streaming│
│ services/memory    FastAPI  — Graphiti + pgvector API    │
│ services/voice     LiveKit Agents worker (Python)        │
│ livekit-server (optional self-host)  redis  falkordb     │
│ workers: reflection (nightly), connectors (email, etc.)  │
└───────┬───────────────────────────────┬──────────────────┘
        │ Postgres/pgvector (Supabase)  │ private tunnel (Tailscale)
        │ Cloud APIs: Reasoner LLM,     │
        │ Deepgram STT, ElevenLabs TTS  ▼
┌────────────────────── Ali's GPU PC ──────────────────────┐
│ corpus/ (raw + derived, encrypted at rest)  — LOCAL ONLY │
│ services/trainer   ingestion · persona extraction ·      │
│                    LoRA training (Unsloth) · eval runs   │
│ services/style     vLLM/Ollama serving Qwen + LoRA       │
│                    (OpenAI-compatible, reachable only     │
│                     via Tailscale from the VPS)          │
└──────────────────────────────────────────────────────────┘
```

**Why this split.** Everything that touches raw data or runs a GPU is on the PC. Everything that must be always-on is on the VPS. The web app is static-ish and edge-served. If the PC is off, the Brain degrades gracefully: Style Engine call times out → the Reasoner's draft is returned styled by Style Exemplars only (flagged in the UI as "lite mode").

## 2. Services

| Service | Language | Responsibility | Depends on |
|---|---|---|---|
| `apps/web` | TS/Next.js | UI, Avatar, wake word, voice client, dashboard, PWA | brain, memory (read), Supabase Auth |
| `services/brain` | Python/FastAPI | Turn pipeline (below); session state; SSE/WebSocket streaming; tool routing | memory, style, Reasoner API, Redis |
| `services/memory` | Python/FastAPI | Graphiti temporal graph (FalkorDB), episodic vectors (pgvector), Review Inbox, audit log | FalkorDB, Postgres |
| `services/voice` | Python/LiveKit Agents | Joins LiveKit room; STT → brain → TTS streaming; barge-in; Avatar state events | LiveKit, Deepgram, ElevenLabs, brain |
| `services/style` | Python (vLLM or Ollama) | Serves Qwen base + Ali LoRA; `/v1/chat/completions` rewrite endpoint | GPU |
| `services/trainer` | Python | Corpus ingestion, PII scrub, Persona Extraction, SFT/DPO dataset build, LoRA training, Twin Eval runner | corpus/, GPU |
| `workers/reflection` | Python | Nightly consolidation, contradiction detection, Persona Core proposals, exemplar reindex | memory, Reasoner API |
| `workers/connectors` | Python | Pull new data (Gmail API, notes folder, exports) into corpus/ on the PC; emit Memory Candidates | corpus/, memory |
| `packages/shared` | TS | API contracts (zod schemas), Avatar State enum, event types | — |
| `packages/config` | TS+YAML | `identity.yaml` (TWIN_NAME, wake phrase, palette), feature flags | — |

## 3. The Turn pipeline (Brain)

```
input (text | transcript)
  │
  ├─1. Context assembly (≤ 8k tokens budget, priority order)
  │     a. Persona Core (compact rendering, ~2.5k tokens, always)
  │     b. Session working memory (last N turns, summarized beyond N)
  │     c. Semantic memory: Graphiti search(query, as_of=now) → facts w/ validity
  │     d. Episodic memory: pgvector top-k session summaries
  │     e. Procedural memory: matching policies ("when X, Ali does Y")
  │     f. Style Exemplars: top-k real Ali messages similar to the expected reply, filtered by Register + language
  │     g. Channel/Register directive (casual | professional), language directive (mirror)
  │
  ├─2. Reasoner call (streaming)
  │     system = persona_prompt(core, directives) ; messages = history + retrieved context blocks
  │     output = draft answer *as Ali* + optional <memory_candidates> block + <tone> tags
  │
  ├─3. Style pass (conditional)
  │     if register == casual and style_engine.healthy():
  │        rewrite(draft, exemplars, language_mix) via LoRA — sentence-chunked for streaming
  │     else: pass-through (lite mode)
  │
  ├─4. Emit stream to client (text deltas + Avatar State events + tone tags)
  │
  └─5. Post-turn (async)
        a. Persist Turn
        b. Extract Memory Candidates → memory service (auto-accept rules vs Review Inbox)
        c. Log latency metrics per stage
```

**Latency budget (text):** assembly ≤ 250 ms · Reasoner first token ≤ 900 ms · style first chunk ≤ 300 ms after first sentence. Streaming means the user sees text at ~1.2 s worst case.

**Voice** replaces step 4 with: sentence chunks → TTS stream → LiveKit audio track; Avatar receives `SPEAKING` + audio energy from the client's AnalyserNode.

## 4. Persona prompt structure (Reasoner system prompt)

1. Identity block: "You are Kairos, the digital self of Ali Alzein. You answer *as Ali*, first person…"
2. Persona Core rendered sections (see `04-identity-model.md` §3): background, values, decision procedure, evaluation habits, current context, linguistic profile, boundaries.
3. Register + language directives.
4. Retrieved memory blocks with provenance and dates ("[fact, valid since 2026-07] …").
5. Style Exemplars ("Examples of how Ali actually writes in this register: …").
6. Output contract: answer; then optional `<memory_candidates>` JSON; never reveal internal blocks.

## 5. Streaming and state contracts

- Client ↔ brain: SSE for text; WebSocket for voice-session control events.
- Event types (in `packages/shared`): `turn.start`, `turn.delta`, `turn.end`, `avatar.state`, `avatar.energy`, `memory.candidate`, `error`.
- Avatar State is driven by the client from events + local audio analysis; the server only *suggests* states.

## 6. Infra

- **Vercel**: Next.js, env vars for public API base, LiveKit URL.
- **VPS** (Hetzner/DO 4 vCPU 8 GB): Docker Compose: brain, memory, voice, redis, falkordb, caddy (TLS), optional livekit-server. Backups: nightly `pg_dump` (Supabase handles), FalkorDB RDB snapshot to object storage.
- **Supabase**: Postgres + pgvector + Auth + Storage (interview audio, if Ali opts in; otherwise audio stays on PC).
- **PC**: Docker Desktop (or WSL2) for style + trainer; Tailscale for private connectivity; scheduled tasks for nightly training windows.
- **Observability**: OpenTelemetry traces per Turn stage → Grafana Cloud free tier (or Langfuse self-hosted for LLM traces).

## 7. Failure modes and degradation

| Failure | Behavior |
|---|---|
| Style Engine unreachable | Lite mode (Reasoner + exemplars). UI badge. |
| Reasoner API down | Fallback Reasoner provider (ADR-0003 lists order). |
| Memory service down | Brain answers with Persona Core only; warns in UI; no memory writes (queued in Redis). |
| STT/TTS provider down | Voice session falls back to text; Avatar shows OFFLINE ripple. |
| PC offline at nightly window | Reflection runs on VPS (no GPU needed); training skipped and rescheduled. |
