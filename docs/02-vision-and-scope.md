# 02 — Vision and scope

## Vision

A digital self of Ali that:

1. **Thinks like Ali** — reasons with his values, decision heuristics, and knowledge of his life and work.
2. **Writes and speaks like Ali** — his lexicon, rhythm, code-switching, humor, register per audience; in his own voice.
3. **Remembers and evolves** — learns from every conversation and from Ali's ongoing data streams; its picture of Ali stays current as Ali changes.
4. **Is embodied** — a live GPU-particle humanoid that reacts to sound, presence, and speech; wakes on a spoken phrase.
5. **Is available everywhere** — web (desktop + mobile PWA), later Android APK.

## Non-goals (explicit)

- Not a general chatbot with a nickname. If it cannot answer as Ali would, it says so as Ali would ("ما بعرف, let me check").
- Not autonomous action on Ali's accounts in Phase 1–7 (no sending emails, no purchases). Action tools are Phase 8+ and each needs an ADR.
- Not deception. Guests are always told they are talking to an AI twin.
- Not a photoreal avatar. The Avatar is abstract particles by design.

## Phased purpose

| Phase | Purpose | Primary user |
|---|---|---|
| 1–5 | Personal assistant that thinks like Ali | Owner only |
| 6–7 | Same, with voice and mobile | Owner only |
| 8 | Twin others can talk to (guest mode, disclosed) | Owner + Guests |
| 9+ | Long-term preservation (export, portability, successor models) | Owner |

## Success criteria (product level)

- **Fidelity**: Twin Eval Fidelity Score ≥ 0.80 by end of Phase 4; ≥ 0.85 by Phase 8 (1.0 = Ali's own test-retest).
- **Blind test**: in a "which reply is real Ali" test with 5 people who know him, the Twin is picked as real ≥ 40% of the time by Phase 8.
- **Latency**: text first-token ≤ 1.5 s; voice first-audio ≤ 1.2 s (Phase 6), ≤ 0.8 s (Phase 8).
- **Avatar**: 60 fps desktop, 30 fps mid-range Android, at production particle counts.
- **Self-learning**: a fact Ali tells the Twin today is used correctly tomorrow without manual entry (Phase 3 gate).
- **Privacy**: zero raw corpus bytes leave Ali's machines (verified by network egress audit in Phase 1 gate).

## Constraints

- Solo builder (Ali) + AI agents. Plan favors clear module boundaries so agents can work in parallel tracks.
- Budget-conscious: the home stage costs nothing (ADR-0014). In the cloud stage, spend is limited to Reasoner API, ElevenLabs, LiveKit Cloud (or self-host), Vercel, one VPS.
- Ali's PC doubles as gaming rig: training jobs must be schedulable (nightly) and interruptible.
