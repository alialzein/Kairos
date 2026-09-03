# Local dev runbook

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
