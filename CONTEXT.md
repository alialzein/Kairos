# CONTEXT.md — glossary

Terms are used exactly as defined here, in code, docs, and conversation. Add a term the moment it is resolved. No implementation details here.

| Term | Meaning |
|---|---|
| **Ali** | Ali Alzein, the person being cloned. The only *Owner*. |
| **Twin** | The AI system as a whole, acting as Ali. Its persona name is **Kairos** (`TWIN_NAME = "Kairos"`), wake phrase "Hey Kairos". |
| **Owner** | The authenticated Ali. The only role that can edit Persona Core, approve memory, and access the corpus. |
| **Guest** | Anyone else talking to the Twin (Phase 8). Always told they are talking to an AI. |
| **Corpus** | All raw source material about Ali: exports, documents, emails, interview recordings/transcripts. Local-only. |
| **Corpus Source** | One import (e.g. "Claude export 2026-09"). Has a channel, audience, language mix, and consent flag. |
| **Interview** | A structured, recorded Q&A session between Ali and the Interviewer Agent, following the Interview Protocol. |
| **Interviewer Agent** | The Twin's sub-agent that conducts Interviews with adaptive follow-ups. |
| **Persona Core** | The versioned, human-approved structured representation of who Ali is (`persona/core.yaml`). Always in the Brain's context. |
| **Persona Extraction** | The pipeline that proposes Persona Core content from the Corpus. |
| **Style Exemplar** | A short, PII-scrubbed real message by Ali, indexed for retrieval as a few-shot example of his voice. |
| **Style Engine** | The local LoRA-adapted open model that rewrites drafts into Ali's voice. |
| **Reasoner** | The LLM that drafts the Twin's answer with Persona Core + memories in context. A local Ollama model in the Home stage; a frontier cloud model in the Cloud stage. |
| **Lite mode** | The Brain answering without the Style Engine: Reasoner + Style Exemplars only. Shown as a badge in the UI. |
| **Brain** | The orchestrator service: assembles context, calls Reasoner, calls Style Engine, writes memory. |
| **Turn** | One user input → one Twin response, in text or voice. |
| **Session** | A sequence of Turns with one continuous context. |
| **Memory Layer** | One of: Working, Episodic, Semantic (temporal graph), Procedural, Persona Core. |
| **Memory Candidate** | A proposed long-term memory extracted from a Session, awaiting auto-accept or Owner review. |
| **Review Inbox** | Dashboard queue of Memory Candidates and Persona Core change proposals. |
| **Reflection** | The nightly job that consolidates memory, detects contradictions, and proposes Persona Core updates. |
| **Feedback** | Owner reaction to a Turn: 👍/👎, or a correction ("I'd have said …"). Feeds evaluation and training. |
| **Twin Eval** | The evaluation harness measuring how close the Twin is to Ali on six axes (see `docs/09-evaluation.md`). |
| **Fidelity Score** | The Twin Eval headline number, normalized to Ali's own test-retest consistency (1.0 = as consistent as Ali with himself). |
| **Avatar** | The particle humanoid/orb rendered in the web app. |
| **Avatar State** | One of DORMANT, IDLE, WAKING, LISTENING, THINKING, SPEAKING, OFFLINE. |
| **Wake Phrase** | The spoken phrase that moves the Avatar from DORMANT/IDLE to LISTENING. |
| **Voice Clone** | Ali's cloned TTS voice (Arabic + English). |
| **Voice Pipeline** | Wake → STT → Brain → TTS, streamed. |
| **Channel** | Where a Turn happens: `web`, `voice`, `mobile`, `guest`. Affects register (casual vs professional). |
| **Register** | The tone the Twin uses: `casual` (Ali's chat voice) or `professional` (Ali's client/HR voice). |
| **Code-switching** | Ali's habit of mixing Levantine Arabic and English within a message. Cloned, not normalized. |
| **Stage** | Where the Twin runs, selected by `.env` values and never by code: Home stage or Cloud stage (ADR-0014). |
| **Home stage** | The first version: every component on Ali's gaming PC, local Reasoner, no paid service, zero egress. |
| **Cloud stage** | Vercel + Supabase cloud + VPS with a frontier Reasoner, per ADR-0008/0013. Reached by roadmap Phase C. |
| **Tier** | Look v2's per-device quality level (Ultra/High/Mid/Low). Retired with look v2 (follow-up 3, 2026-09-09): the Neural Bust scales by `sceneConfig.perf` alone — a dpr cap and every particle count halved below `perf.mobileWidth`. The `TIERS` table in `packages/config` is dormant data. |
| **Bench page** | Retired with look v2 (`/bench/avatar`, follow-up 3). The **Scene bench** below is the one public bench now. |
| **Health poll** | The owner home asking the web app's `/api/health` every 15 s whether the Brain answers. That route probes `BRAIN_URL/health` server-side (the Brain sends no CORS headers); two consecutive bad probes send `FAILURE` (Avatar → OFFLINE), the next good one `RECOVER`. Unset `BRAIN_URL` = no polling. |
| **Demo turn** | A synthetic Turn (canned reply text + synthetic energy) that drives the Avatar through THINKING → SPEAKING → IDLE until the Brain's `/turn` exists (Phase A2). |
| **Neural Bust scene** | Avatar look v3 (`docs/plans/scene-plan.md`, log in `docs/plans/scene-log.md`): a standalone R3F scene under `apps/web/src/scene/` — opaque contour-line bust, face core, neck circuitry, rings, landscape, bloom, HUD — every value in `sceneConfig.ts`, every layer behind a flag. Wired to the seven Avatar States since PR #31 (`scene/states.ts`, LISTENING = the merged config) and the owner home since follow-up 3 (`scene/SceneStage.tsx`: canvas + HUD, transcript ribbon, chat drawer running Demo turns, click-to-wake). Look v2 (the wireframe bust, `/dev/avatar`, `/bench/avatar`) is removed. |
| **Scene bench** | `/bench/scene`: public page rendering the Neural Bust scene, driven by query parameters — layers `phase` / `only` / `off`, backend `webgl=1` (CI passes it: the runner has no working WebGPU), tuning `set` (`sceneConfig` overrides for one page load, development builds only), states `state=NAME` / `demo=1` (auto-cycle) / `hold=<s>` (pinned clock for stills), and `stage=1` (the owner home's stage on the bench; with `demo=1` it runs one Demo turn). Used by the e2e smoke, the stage e2e, the perf gate and the screenshots in `docs/screens/`. Shows no persona or user data. |
