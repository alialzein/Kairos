# 0012 — Persona name: Kairos

- **Status**: accepted
- **Date**: 2026-09-03
- **Deciders**: Ali

## Context
The Twin needs a name that works as a spoken wake phrase in English and for Arabic speakers, is 2–3 syllables with strong consonants, and is not a common word. Candidates evaluated: Astra, Kairos, Elara, Sirius, Aether, Orion, Kael.

## Decision
The persona is named **Kairos** (Greek: "the right, opportune moment"). Wake phrase: "Hey Kairos"; Arabic rendering كايروس. `packages/config/identity.yaml` sets `TWIN_NAME: Kairos`. The repo/system is still called TWIN; Kairos is the persona users address.

## Consequences
All user-facing copy, the Reasoner identity block, the wake-word model, and the PWA/APK names use Kairos. The rename script (`pnpm twin:rename`) remains for future changes. The Interviewer Agent introduces itself as Kairos.

## Alternatives considered
- Astra — strongest wake-word phonetics; passed over for meaning (Kairos matches a twin that *decides* like Ali).
- Sirius / Orion — collide with "Siri"/"serious" and a brand name.
- Elara / Aether — weaker detection phonetics or real-word collision.
- Nyx / Kael — too short for reliable wake detection.
