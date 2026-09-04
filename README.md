# TWIN — Ali's Digital Self

> **Kairos** — a self-learning AI that thinks, decides, writes and speaks like Ali Alzein, rendered as a live GPU-particle humanoid, with voice, wake word, web + mobile.

This folder is the **complete pre-implementation plan**. Nothing here is code yet. The plan was produced after a research pass (see `docs/01-research.md`) and a decision interview (see `docs/adr/`). It is written so that an AI coding agent (Claude Code) can execute it phase by phase without guessing.

## How to use this folder

1. Create the repo (`twin`), copy this whole folder into its root.
2. Install the planning/process skills (see `docs/12-repo-and-tooling.md` → "Skills").
3. Open Claude Code in the repo and paste the kickoff prompt from `docs/00-kickoff-prompt.md`.
4. The agent reads `CLAUDE.md` first, then the docs in numeric order, then starts **Phase 0** in `docs/11-roadmap.md`.
5. Every phase ends with an exit gate. Do not start the next phase until the gate passes.

## Document map

| File | What it is |
|---|---|
| `CLAUDE.md` | Operating instructions for the AI agent working in this repo |
| `CONTEXT.md` | Glossary — the shared vocabulary (grill-with-docs style) |
| `docs/00-kickoff-prompt.md` | The exact prompt to give Claude Code to begin |
| `docs/01-research.md` | Research findings + sources that justify every architectural choice |
| `docs/02-vision-and-scope.md` | What we are building, for whom, in what order |
| `docs/03-architecture.md` | System architecture, services, request flow, infra topology |
| `docs/04-identity-model.md` | How the Twin becomes "Ali": corpus, interviews, Persona Core schema, style LoRA |
| `docs/05-memory-and-evolution.md` | Memory layers, write/read paths, nightly reflection, self-learning loop |
| `docs/06-avatar-spec.md` | Particle humanoid: states, shaders, performance budgets, design tokens |
| `docs/07-voice-spec.md` | Wake word, real-time voice pipeline, voice cloning |
| `docs/08-data-model.md` | Postgres schema, vector store, temporal graph ontology, local corpus store |
| `docs/09-evaluation.md` | The "is it me yet?" harness — metrics, item bank, targets |
| `docs/10-security-privacy.md` | Data boundaries, secrets, consent, abuse prevention |
| `docs/11-roadmap.md` | Phases, tasks with file paths, acceptance criteria, exit gates |
| `docs/12-repo-and-tooling.md` | Monorepo layout, languages, tooling, CI, skills |
| `docs/13-open-questions.md` | Things Ali must still answer before the affected phase starts |
| `docs/adr/*.md` | Architecture Decision Records (one per hard decision) |

## Decisions already made (summary)

- **Purpose**: personal assistant that thinks like Ali → twin others can talk to → long-term preservation of his mind. Phased.
- **Privacy**: hybrid. A local Reasoner (Ollama) in the home stage, a frontier cloud LLM in the cloud stage; **raw data and the style model never leave Ali's machines**.
- **Brain composition**: frontier model drafts as Ali → local LoRA "style engine" rewrites in Ali's voice.
- **Inputs**: Claude/ChatGPT history, notes/docs/social posts, work emails, plus 3–5 hours of structured recorded interviews (Arabic + English).
- **Language**: mirror Ali's language and clone his Levantine-Arabic/English code-switching.
- **Voice**: Ali's own cloned voice (30+ min recordings, both languages).
- **Avatar**: humanoid particle bust (like the reference screenshots) that morphs to an orb when idle.
- **Deployment**: two stages (ADR-0014). **Home stage first**: everything on Ali's gaming PC with a local Reasoner, zero paid services. **Cloud stage later** (Phase C): Vercel (web) + VPS Docker (Python services) + Ali's GPU PC (training, style model serving).
- **Mobile**: PWA first, Android APK via Capacitor later.
- **Name**: **Kairos** (Greek: "the right moment"). Wake phrase: "Hey Kairos" / "يا كايروس". See ADR-0012.

## Languages

- **TypeScript** — all product surfaces (web, avatar, dashboard, mobile shell).
- **Python** — all ML and voice (ingestion, persona extraction, training, evals, memory service, voice agent).
