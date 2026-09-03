# 0007 — Particle humanoid bust, morphing to orb when idle

- **Status**: accepted
- **Date**: 2026-09-03
- **Deciders**: Ali (decision interview with Claude)

## Context
Reference screenshots show a point-cloud humanoid with amber core and blue particles. Always-humanoid feels heavy when idle; abstract-only loses the 'someone is there' quality.

## Decision
Default form is the humanoid bust in LISTENING/THINKING/SPEAKING; ORB in IDLE; NEBULA in DORMANT. Morphs are GPU-side TSL compute; quality tiers protect mobile.

## Consequences
Requires a stylized bust mesh asset and a GLB point sampler; state table is the single tuning surface.

## Alternatives considered
- Humanoid always — rejected: visual fatigue.
- Orb only — rejected: loses the reference's identity.
