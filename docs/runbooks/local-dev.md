# Local dev runbook

## Home stage on the gaming PC (ADR-0014)

The first version runs entirely on the PC (Windows 11, RTX 5070 12 GB, 32 GB RAM): web, services,
Supabase local and the Reasoner. Nothing is paid and nothing leaves the machine. The laptop is for
coding only: push to `main`, then on the PC `git pull` and restart what changed.

### One-time setup (PC)

1. Current NVIDIA Game Ready driver.
2. Docker Desktop with the WSL2 backend (free for personal use). Check: `docker run --rm hello-world`.
3. Ollama for Windows, latest release (RTX 50-series / Blackwell needs a recent build). Set a user
   environment variable `OLLAMA_HOST=0.0.0.0:11434` (so containers can reach it) and restart Ollama, then:

   ```powershell
   ollama pull qwen3.5:9b
   ollama run qwen3.5:9b "Say hi in Arabic and English"   # streams fast
   ollama ps                                               # PROCESSOR column shows 100% GPU, not CPU
   ```

   Alternatives: `qwen3:14b` (9 GB, tighter fit with context); experiment only: `qwen3.5:35b` (MoE,
   24 GB, spills into RAM). Change `REASONER_MODEL` in `.env` to switch.
4. Node 24 (`corepack enable` provides pnpm 11), `uv`, Git.
5. `git clone https://github.com/alialzein/Kairos.git` then `pnpm install --frozen-lockfile`.
6. `.env` from `.env.example` (see "Prerequisite" below): `SUPABASE_JWT_SECRET` from `pnpm supabase status`,
   the reasoner block as shipped (`REASONER_PROVIDER=ollama`, `OLLAMA_BASE_URL=http://host.docker.internal:11434`),
   `OWNER_USER_IDS` after the first sign-in.
7. Windows Firewall: allow inbound TCP 3000, 54321 and 80 on the Private profile if the laptop or the
   phone should reach the PC.

### Run

```powershell
pnpm supabase start
docker compose -f infra/docker-compose.yml -f infra/docker-compose.obs.yml --profile obs up -d --build --wait   # drop the obs parts to skip Langfuse
pnpm --filter @twin/web exec next dev -H 0.0.0.0                                                               # reachable from the LAN
```

From the laptop open `http://<pc-ip>:3000`. For magic links to work from the laptop, set
`NEXT_PUBLIC_SITE_URL=http://<pc-ip>:3000` and `NEXT_PUBLIC_SUPABASE_URL=http://<pc-ip>:54321` in
`apps/web/.env.local`, and add `http://<pc-ip>:3000/auth/confirm` to `additional_redirect_urls` in
`supabase/config.toml`. Off-LAN access later: Tailscale (free personal plan) on both machines, same
URLs with the Tailscale IP.

Acceptance (paste into `docs/STATUS.md` gate history): `docker compose ps` all healthy,
`pnpm supabase test db` green, `ollama ps` shows the model on the GPU, first owner sign-in from the laptop.

## Windows

`pnpm gen:api` needs Git Bash on PATH ahead of the WSL launcher; until then run
`& "C:\Program Files\Git\bin\bash.exe" scripts/gen-api.sh` from the repo root.

## Services in a container (VPS profile: brain, memory, voice, redis, falkordb, caddy)

### Prerequisite: `.env` with a JWT secret

Before running `up -d --build --wait` below, create `.env` and set a JWT secret:

```powershell
Copy-Item .env.example .env
```

```bash
cp .env.example .env
```

Then set `SUPABASE_JWT_SECRET` in `.env` to the value `pnpm supabase status` prints as "JWT secret" —
or, if Supabase isn't running, to any string of at least 32 characters (brain only needs *a* secret to
start; tokens are only minted once Supabase is actually running).

`brain` refuses to start without `SUPABASE_JWT_SECRET` or `SUPABASE_JWKS_URL` by design (fail closed),
and `voice`/`caddy` both wait for `brain` to report healthy, so an empty `.env` here means the whole
VPS profile never comes up. CI provides its own throwaway secret in the docker job.

```powershell
docker compose -f infra/docker-compose.yml config -q     # exit 0, no output
docker compose -f infra/docker-compose.pc.yml config -q   # exit 0
docker compose -f infra/docker-compose.yml up -d --build --wait   # "Container twin-brain-1 Healthy" … for all 6
docker compose -f infra/docker-compose.yml ps             # STATUS column shows (healthy) for brain/memory/voice/redis/falkordb, running for caddy
curl.exe -s http://localhost/brain/health                 # {"status":"ok","service":"brain"}
curl.exe -s http://localhost/memory/health                # {"status":"ok","service":"memory"}
curl.exe -s http://localhost/voice/health                 # {"status":"ok","service":"voice"}
curl.exe -s http://localhost/                             # twin edge ok
docker compose -f infra/docker-compose.pc.yml up -d --build --wait
curl.exe -s http://localhost:8003/health ; curl.exe -s http://localhost:8004/health
docker compose -f infra/docker-compose.pc.yml down ; docker compose -f infra/docker-compose.yml down
```

A service can also be run directly with `uv` instead of Docker — every service starts in uvicorn
factory mode, e.g.:

```powershell
uv run uvicorn brain.main:create_app --factory --port 8000
```

`brain` requires `SUPABASE_JWT_SECRET` (or `SUPABASE_JWKS_URL`) in `.env` — it raises at startup
without one of those.

## Web + Supabase

```powershell
pnpm dev
pnpm supabase start
```

### First sign-in

Magic-link sign-up is closed by default (`ALLOW_SIGNUP=false`), so the very first account has to be
created deliberately:

1. In `apps/web/.env.local`, set `ALLOW_SIGNUP=true`.
2. Restart `pnpm --filter @twin/web dev`, go to http://localhost:3000/login, and sign in with your
   email via the magic link.
3. Promote yourself to owner in Studio (http://127.0.0.1:54323) — see `supabase/seed.sql` for the
   `profiles` shape — then copy your `auth.users.id`.
4. Put that id in `OWNER_USER_IDS` in `apps/web/.env.local`; also set `OWNER_USER_IDS` in the
   repo-root `.env` (the compose services read it from there), then
   `docker compose -f infra/docker-compose.yml up -d`. Both must match.
5. Set `ALLOW_SIGNUP` back to `false` and restart dev.

On a cloud project, also turn off "Enable email signups" under Authentication → Providers once the
owner account exists — `ALLOW_SIGNUP` only gates the app's own `signInWithOtp` call, not the Supabase
project setting.

## Ports

| service | port |
| --- | --- |
| web | 3000 |
| brain | 8000 |
| memory | 8001 |
| voice | 8002 |
| style | 8003 |
| trainer | 8004 |
| caddy | 80 |
| supabase api | 54321 |
| db | 54322 |
| studio | 54323 |
| mailpit | 54324 |
| langfuse | 3001 |
