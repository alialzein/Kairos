# 08 — Data model

## 1. Postgres (Supabase) — cloud, scrubbed data only

```sql
-- auth handled by Supabase Auth; profiles mirrors owner/guest role
profiles(id uuid pk → auth.users, role text check (role in ('owner','guest')), display_name, created_at)

sessions(id uuid pk, user_id → profiles, channel text, register text, started_at, ended_at, summary text, summary_embedding vector(1024))

turns(id uuid pk, session_id → sessions, idx int, role text check (role in ('user','twin')), text text,
      lang_mix jsonb, reasoner_draft text, style_applied bool, latency jsonb, created_at)

episodes(id uuid pk, session_id, text text, embedding vector(1024), importance real, sensitivity text,
         valid_from timestamptz, created_at, source text, audit_id → audit_log)

policies(id uuid pk, trigger text, action text, evidence jsonb, confidence real, status text, created_at, superseded_by uuid)

memory_candidates(id uuid pk, kind text, payload jsonb, sensitivity text, confidence real, status text
                  check (status in ('pending','accepted','rejected','edited')), source_turn → turns, decided_by, decided_at)

persona_proposals(id uuid pk, version_from int, diff_yaml text, evidence jsonb, status text, created_at, decided_at)

feedback(id uuid pk, turn_id → turns, rating int check (rating in (-1,1)), correction text, created_at)

style_exemplars(id uuid pk, text text, embedding vector(1024), register text, lang_mix jsonb, topics text[], source_ref text, active bool)

audit_log(id bigserial pk, actor text, action text, entity text, entity_id text, before jsonb, after jsonb, reason text, at timestamptz)

eval_items(id uuid pk, axis text, prompt text, ali_answer text, ali_answer_retest text, held_out bool, created_at)
eval_runs(id uuid pk, started_at, config jsonb, fidelity_score real, axis_scores jsonb, notes text)
eval_results(run_id → eval_runs, item_id → eval_items, twin_answer text, score real, judge jsonb)

training_runs(id uuid pk, kind text, base_model text, dataset_hash text, config jsonb, metrics jsonb, adapter_path text, started_at, ended_at, status text)

provider_health(provider text pk, healthy bool, last_check timestamptz, note text)
```

Indexes: HNSW on all `embedding` columns; `turns(session_id, idx)`; `memory_candidates(status)`; `audit_log(at)`.
RLS: owner sees everything; guests see only their own sessions/turns; no guest access to memory tables.

## 2. FalkorDB — Graphiti temporal graph

Managed by Graphiti; ontology in `05-memory-and-evolution.md` §2. Custom entity/edge type definitions live in `services/memory/ontology.py` (Pydantic models passed to Graphiti). Group id = `ali`.

## 3. Redis

- `session:{id}:working` — recent turns + rolling summary (TTL 24 h)
- `queue:memory_candidates` — buffered writes if memory service is down
- `health:*` — provider circuit-breaker state

## 4. Local corpus store (PC only, never synced)

```
corpus/
  raw/<source_id>/...           # untouched exports, audio
  derived/messages.parquet      # unified, labeled, scrubbed
  derived/ali_texts.parquet
  derived/sft_reply.jsonl
  derived/sft_rewrite.jsonl
  derived/exemplars.jsonl       # the only thing that gets uploaded (to style_exemplars)
  derived/persona_evidence.jsonl
  interviews/<session>/audio.wav + transcript.json
  voice/<take>.wav
  manifest.json                 # source_id, hash, consent, channel, counts, scrub report
```

Encrypted at rest (age or OS full-disk encryption); `.gitignore`d; a CI check fails if any path under `corpus/` is ever staged.

## 5. Persona files (git)

```
persona/
  core.yaml                     # current approved Persona Core
  CHANGELOG.md                  # version history
  proposals/YYYY-MM-DD-*.yaml   # pending diffs (also mirrored in persona_proposals table)
  prompts/                      # persona prompt templates (Reasoner system prompt, extractor, interviewer)
```

## 6. Shared TypeScript contracts (`packages/shared`)

- `AvatarState` enum; `TurnEvent` union; `TurnRequest{ text, channel, register?, session_id }`; `MemoryCandidate`; `Feedback`.
- Generated OpenAPI client for brain/memory from FastAPI schemas (`pnpm gen:api`).
