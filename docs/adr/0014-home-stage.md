# 0014 — Home stage: the first version runs entirely on Ali's PC with a local Reasoner and zero paid services

- **Status**: accepted
- **Date**: 2026-09-04
- **Deciders**: Ali (decision interview with Claude, 2026-09-04)

## Context
Ali wants the first version to cost nothing and to run on his own hardware; the move to Vercel + Supabase cloud + a VPS comes later, once the local version is proven. His gaming PC (Windows 11, RTX 5070 12 GB GDDR7, 32 GB DDR5) serves a 9B–14B model at 4-bit on CUDA with room for context, and trains a 7–8B QLoRA (this resolves Q2). ADR-0002 and ADR-0003 assume a frontier cloud Reasoner; ADR-0008 and ADR-0013 assume Vercel and Hetzner. "Raw corpus stays local" rules out free GPU notebooks (Colab/Kaggle) for training, because derived data would leave the machine. The laptop (Core Ultra 7, Arc iGPU, no CUDA) is where code is written; it is not a runtime.

## Decision
Introduce deployment **stages**, selected by `.env`, never by code.

- **Home stage (now).** Every component runs on the gaming PC: `apps/web` via `pnpm dev`; the compose stack (brain, memory, voice stub, redis, falkordb, caddy) plus the `pc` profile (style, trainer) and the `obs` profile (Langfuse); Supabase local via the CLI (Postgres + pgvector + Auth + Mailpit); Ollama installed natively on Windows serving the Reasoner — `qwen3.5:9b` by default, `qwen3:14b` as the alternative; bge-m3 embeddings locally. The laptop and the phone reach the PC over the LAN (Tailscale free plan optional for off-LAN). No paid service, no cloud API, zero egress.
- **Cloud stage (Phase C, later).** Exactly ADR-0008 + ADR-0013 (Vercel, Supabase cloud, Hetzner Falkenstein, Tailscale to the PC) with a frontier Reasoner per ADR-0003; the provider order (Q4) is decided by ADR at that point.
- The Brain's provider layer (task A2.5) implements `REASONER_PROVIDER=ollama` first; frontier providers sit behind the same interface and are added in Phase C. The scrubber, uploader allowlist and egress audit are still built in the home stage because the cloud stage depends on them, and because pipeline behaviour must not depend on locality (docs/10 §1 enforcement item 4).

## Consequences
- Easier: nothing leaves the PC; no vendor accounts; one machine to operate; Phase A4 training stays free and local; the Vercel/Supabase-cloud/Hetzner tasks stop blocking the roadmap.
- Harder: the local model reasons less well than a frontier model, so Fidelity measured with the local LLM judge is labelled "local judge" and re-measured with a frontier judge in Phase C before the switch; availability equals PC uptime (acceptable for an owner-only v1); Graphiti extraction (A3) runs on the local model and may need a larger model or more retries.
- Must do now: docs 02/03/05/07/10/11/12/13, `CONTEXT.md`, `.env.example`, the local-dev runbook and `STATUS.md` updated; Phase 0 Task 16 and the Vercel/Supabase-cloud steps move to Phase C; A6.1's bake-off adds the free local voice stack (faster-whisper, Piper/Kokoro, F5-TTS/XTTS-v2, self-hosted `livekit-server`).
- ADR-0002 and ADR-0003 are amended (the Reasoner is local in the home stage); ADR-0008 and ADR-0013 are scoped to the cloud stage. None is superseded; the cloud design is kept intact for Phase C.

## Alternatives considered
- Free-tier cloud APIs (Groq, Gemini) as the Reasoner — rejected for v1: new vendors need ADRs, free quotas change without notice, and some free tiers may use prompts for training.
- Run on the laptop — rejected: CPU-only inference on an Arc iGPU and no training path; Ali chose the PC.
- Rewrite the docs as local-only — rejected: it discards the approved cloud design; stages keep both without contradiction.
