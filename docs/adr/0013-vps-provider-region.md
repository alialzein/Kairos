# 0013 — VPS provider and region: Hetzner Cloud, Falkenstein

- **Status**: accepted
- **Date**: 2026-09-03
- **Deciders**: Ali

## Context
ADR-0008 puts the always-on services (brain, memory, voice, redis, falkordb, caddy) on one VPS and defers the provider/region to open question Q10. Candidates: Hetzner (Falkenstein or Helsinki) and DigitalOcean (Frankfurt). Target size ~4 vCPU / 8 GB / 80 GB. Measured expectation Lebanon ↔ Germany ≈ 60–90 ms.

## Decision
Hetzner Cloud, Falkenstein (fsn1), CX32-class (4 vCPU / 8 GB / 80 GB), Ubuntu 24.04, Docker Compose behind Caddy (automatic TLS), Tailscale for the private link to Ali's PC, Hetzner nightly backups enabled. Deploy steps live in `docs/plans/phase-0.md` Task 16 and, once run, in `docs/runbooks/deploy-vps.md`.

## Consequences
EU data residency for scrubbed memories; lowest monthly cost for the spec; one provider to operate. LiveKit region penalty is measured in Phase A6 (its own ADR trigger). Moving providers later is a compose re-deploy plus a DNS change, so this is cheap to revisit.

## Alternatives considered
- Hetzner Helsinki — same price and spec; ~30 ms worse to Lebanon.
- DigitalOcean Frankfurt — 3–6× the monthly cost for the same spec; nicer UI, not needed for a solo operator.
