# 10 — Security, privacy, and ethics

## 1. Data boundary (the rule everything else serves)

| Data class | Where it may exist | May reach cloud LLM? |
|---|---|---|
| Raw corpus (exports, emails, audio) | Ali's PC only, encrypted at rest | **Never** |
| Derived corpus (parquet, SFT jsonl) | Ali's PC only | **Never** |
| Style Exemplars (scrubbed, ≤ 60 words) | PC → Postgres `style_exemplars` | Yes, top-k per turn |
| Persona Core | git (private repo) + Brain memory | Yes, compact rendering every turn |
| Memories (facts/episodes), scrubbed | Postgres/FalkorDB on VPS | Yes, retrieved subsets |
| Conversation turns | Postgres | Yes (they are the conversation) |
| Voice reference audio | PC (Supabase Storage only if Ali opts in) | Only to the TTS vendor for cloning, under consent |
| Secrets/API keys | `.env`, sops | Never |

Enforcement: (1) CI check blocks any staged path under `corpus/`; (2) the trainer's uploader has an allowlist of exactly one artifact (`exemplars.jsonl`); (3) egress audit in Phase 1 gate: run ingestion with a network monitor and prove zero outbound bytes; (4) scrubber runs before *any* LLM labeling call, even for local models, so pipeline behavior doesn't depend on locality.

Home stage (ADR-0014): the Reasoner is local, so the third column is moot until Phase C — nothing leaves the PC. Enforcement (1)–(4) is built and tested in the home stage anyway so the cloud stage inherits it unchanged.

## 2. Scrubbing rules

- Secrets (regex + entropy): drop line.
- Phone numbers, national IDs, card numbers, addresses: replace with typed placeholders.
- Third-party names: consistent pseudonyms (`PERSON_n`) with a local-only mapping table; Ali's name and public figures kept.
- High-sensitivity topics (health, HR cases, salaries, legal): tagged; excluded from exemplars and from Guest-visible memory by default.

## 3. Access control

- Supabase Auth; Owner = Ali's account only (allowlist by user id). Guests (Phase 8) via invite links with expiry.
- Services (on the PC in the home stage, on the VPS in the cloud stage) accept only JWTs minted by Supabase; internal service-to-service calls use a shared secret over the Docker network; PC services reachable from the VPS only over Tailscale.
- Dashboard actions on memory/persona are audit-logged with before/after.

## 4. Secrets management

- `.env.example` lists every variable; real values in `.env` (gitignored) and `secrets.enc.yaml` (sops + age). Rotate on any suspected leak. No secrets in Vercel preview envs beyond public keys.

## 5. Consent and voice/likeness ethics

- Voice Clone: Ali records the vendor consent statement; the clone is used only via the Twin.
- Guests always hear/see "You're talking to Ali's AI twin, not Ali" at session start; the Twin re-states it if asked "are you Ali?".
- The Twin never makes commitments (money, contracts, dates, HR decisions) on Ali's behalf — enforced by Persona Core `boundaries` + a boundary classifier on outputs (Phase 8) + eval boundary probes.

## 6. Abuse and prompt injection

- Retrieved memories and connector content are treated as untrusted data in the prompt (wrapped, labeled, instructions inside them ignored by directive + tested).
- Guest inputs cannot trigger memory writes above `low` sensitivity and never Persona proposals.
- Rate limits per session; kill switch env flag disables Guest mode and voice instantly.

## 7. Backups and deletion

- Postgres: Supabase PITR/daily; FalkorDB snapshot nightly to object storage (encrypted); corpus: Ali's own backup discipline (recommend an encrypted external drive + versioned cloud backup of the encrypted archive only).
- "Delete everything" runbook: drop cloud tables, purge vendor voice clone, wipe VPS volumes, keep local corpus.
- Home stage: nightly `pnpm supabase db dump` plus a FalkorDB volume snapshot to the encrypted external drive; there is no cloud copy by design.
