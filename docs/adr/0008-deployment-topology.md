# 0008 — Vercel + VPS Docker + Ali's GPU PC

- **Status**: accepted
- **Date**: 2026-09-03
- **Deciders**: Ali (decision interview with Claude)
- **Scope**: cloud stage only (ADR-0014). The home stage runs everything on Ali's PC; this topology is reached by roadmap Phase C.

## Context
Always-on services need a VPS; GPU work must stay local for privacy and cost; the web app is best served from the edge.

## Decision
apps/web on Vercel; brain/memory/voice/workers on one VPS via Docker Compose behind Caddy; style/trainer on Ali's PC reachable only over Tailscale. LiveKit Cloud first, self-host by ADR if needed.

## Consequences
Two places to operate; compose profiles keep it manageable. Region choice per Q10.

## Alternatives considered
- Everything on VPS — rejected: GPU cost and raw-data exposure.
- Everything on PC via tunnel — rejected: availability tied to a gaming PC.
