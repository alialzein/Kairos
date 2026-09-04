# 12 — Repo layout, languages, tooling

## 1. Languages (decided)

| Layer | Language | Why |
|---|---|---|
| Web app, Avatar, dashboard, mobile shell | **TypeScript** (Next.js App Router, React 19, R3F v9, TSL) | Ali's existing stack; single codebase for web + PWA + Capacitor |
| Brain, memory, voice, trainer, workers | **Python 3.12** | ML/voice ecosystems (Unsloth, TRL, Graphiti, LiveKit Agents) are Python-first |
| Shaders | **TSL** (JS-authored, compiles to WGSL/GLSL) | One source for WebGPU + WebGL |
| Infra | Docker Compose, Caddy, GitHub Actions, Supabase CLI | Solo-friendly |

## 2. Monorepo layout

```
twin/
  README.md  CLAUDE.md  CONTEXT.md
  docs/                      # this plan + STATUS.md + plans/ + reports/ + runbooks/ + adr/
  persona/                   # core.yaml, schema.json, proposals/, prompts/, CHANGELOG.md
  corpus/                    # LOCAL ONLY (gitignored except README.md)
  apps/
    web/                     # Next.js
    mobile/                  # Capacitor (Phase B7)
  packages/
    shared/                  # zod contracts, enums, generated API client
    config/                  # identity.yaml, avatar.ts (state table), feature flags
  services/
    brain/  memory/  voice/  style/  trainer/     # Python, each with pyproject.toml
  workers/
    reflection/  connectors/                       # Python
  infra/
    docker-compose.yml  docker-compose.pc.yml  docker-compose.obs.yml  Caddyfile
  supabase/
    migrations/  config.toml
  scripts/                   # gen-api.sh, rename.ts, sample-glb.ts, egress-audit.sh
  .github/workflows/ci.yml
  .env.example  .gitignore  pnpm-workspace.yaml  turbo.json  package.json
```

## 3. Tooling

- **JS**: pnpm, Turborepo, ESLint (flat config), Prettier, Vitest (unit), Playwright (E2E + perf), Leva (dev controls), Zustand (state), zod.
- **Python**: uv, ruff, mypy --strict, pytest (+ pytest-asyncio), pydantic v2, FastAPI, httpx, OpenTelemetry SDK.
- **ML**: Unsloth, TRL/PEFT, datasets, sentence-transformers (bge-m3), vLLM or Ollama, faster-whisper.
- **Voice**: livekit-agents + plugins (deepgram, elevenlabs, silero), Picovoice Porcupine SDKs.
- **Data**: Supabase (Postgres + pgvector + Auth + Storage), FalkorDB, Redis, Graphiti.
- **Obs**: OpenTelemetry → Langfuse (self-host) for LLM traces; Grafana Cloud optional.
- **Secrets**: sops + age.
- **Diagrams**: Mermaid in docs.

## 4. Skills to install (before kickoff)

```bash
# mattpocock — install the whole set so grill-with-docs has its dependencies
npx skills add https://github.com/mattpocock/skills

# obra superpowers (Claude Code plugin)
/plugin marketplace add obra/superpowers-marketplace
/plugin install superpowers@superpowers-marketplace
```

Usage policy: `/grill-with-docs` for any spec ambiguity or new decision (writes `CONTEXT.md` + ADRs); `/brainstorming` → `/writing-plans` → `/execute-plan` for each phase task; `/systematic-debugging` when stuck; `/code-review` before each phase gate; `/wayfinder` (mattpocock) for multi-session continuity alongside `docs/STATUS.md`.

## 5. Conventions

- Branch per phase task: `a2-05-brain-turn`; PR template requires: tests run + output, docs touched, ADR link if any.
- Conventional commits. Squash-merge to `main`; `main` always deployable to Vercel preview.
- ADR file name `NNNN-kebab-title.md`, statuses: proposed / accepted / superseded.
- Every service exposes `/health` and `/metrics`.
- Feature flags in `packages/config/flags.ts`, mirrored to Python via env.

## 6. Environments

| Env | Web | Services | Data |
|---|---|---|---|
| home (ADR-0014, now — on the gaming PC) | `pnpm dev` (`-H 0.0.0.0` for the LAN) | `docker compose up` (+ `pc` + `obs` profiles); Ollama native on CUDA | local Supabase (CLI) |
| dev (laptop) | lint, typecheck, tests, CI only — not a runtime | — | fixtures |
| preview (Phase C) | Vercel preview | VPS staging compose project | Supabase staging project |
| prod (Phase C) | Vercel prod | VPS prod | Supabase prod |

## 7. Ali's PC setup checklist

- Windows 11 · current NVIDIA Game Ready driver · Docker Desktop with the WSL2 backend (free for personal use) · Ollama for Windows (latest; RTX 50-series needs a recent build) with `ollama pull qwen3.5:9b` and `OLLAMA_HOST=0.0.0.0:11434` so containers can reach it · Node 24 + pnpm 11 (`corepack enable`) · `uv` (pins Python 3.12) · Git · Tailscale only for off-LAN access · disk ≥ 100 GB free for corpus + models. Step-by-step: `docs/runbooks/local-dev.md` → "Home stage on the gaming PC".
- Scheduled window for training (Task Scheduler / cron) that skips if a game process is running (`pubg` check) — keeps Ali's FPS safe.
