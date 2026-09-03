# Local dev runbook

## Windows

`pnpm gen:api` needs Git Bash on PATH ahead of the WSL launcher; until then run
`& "C:\Program Files\Git\bin\bash.exe" scripts/gen-api.sh` from the repo root.

## Services in a container (VPS profile: brain, memory, voice, redis, falkordb, caddy)

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
