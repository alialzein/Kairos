# 04 — Identity model: how the Twin becomes Ali

Four layers, each answering a different question. Research basis: `01-research.md` A1–A4, B1–B4.

| Layer | Answers | Built from | Lives in |
|---|---|---|---|
| 1. Corpus | What evidence do we have? | Exports, docs, emails, interviews | `corpus/` (PC, local) |
| 2. Persona Core | Who is Ali? (structured) | Persona Extraction + Ali's review | `persona/core.yaml` (git, versioned) |
| 3. Style Engine + Exemplars | How does Ali sound? | SFT/DPO on Ali's real messages | LoRA on PC; exemplar index in pgvector |
| 4. Living Memory | What is true *now*? | Conversations, connectors, Reflection | See `05-memory-and-evolution.md` |

## 1. Corpus pipeline (`services/trainer/ingest`)

### 1.1 Sources (decided)

| Source | Format | Channel | Register | Notes |
|---|---|---|---|---|
| Claude export | JSON | `ai-chat` | mixed | Ali's turns only are "Ali text"; assistant turns are context |
| ChatGPT export | JSON | `ai-chat` | mixed | same |
| Notes / docs | md, docx, pdf, txt | `docs` | mixed | Specs, proposals, one-pagers → professional register |
| Social posts | text/CSV | `social` | casual | Public voice |
| Work emails | mbox / Gmail API | `email` | professional | Sent-by-Ali only for style; threads for context |
| Interviews | audio → transcript | `interview` | casual | Highest weight for Persona Extraction |
| (later) WhatsApp/Telegram | txt/JSON | `chat` | casual | If Ali decides to add; best casual-style source |

### 1.2 Pipeline stages

```
raw/  ──▶ normalize ──▶ scrub ──▶ sessionize ──▶ label ──▶ derived/
```

1. **normalize**: each source adapter (one module per source) → unified `Message{id, source_id, ts, author∈{ali, other, assistant}, text, lang_mix, thread_id, recipients_role}`.
2. **scrub**: detect + tag secrets (API keys, passwords), phone numbers, IDs, third-party PII. Secrets are *dropped*; third-party PII is *pseudonymized* consistently (`<PERSON_12>`) so relationships survive without leaking names to cloud. Ali's own name stays.
3. **sessionize**: split by gap > 6 h or thread change; merge consecutive same-author messages.
4. **label** (LLM-assisted, local model or Reasoner on scrubbed text): `register` (casual/professional), `audience` (self, colleague, client, friend, family, public), `language_mix` (en / ar / mixed with ratio), `topics[]`, `contains_opinion`, `contains_decision`.
5. **derived/** outputs:
   - `messages.parquet` — all labeled messages
   - `ali_texts.parquet` — Ali-authored only (style corpus)
   - `sft_reply.jsonl` — (context → Ali reply) pairs, ShareGPT format
   - `sft_rewrite.jsonl` — (neutral paraphrase → Ali original) pairs, see §4.2
   - `exemplars.jsonl` — short, high-signal Ali messages for the Style Exemplar index (≤ 60 words, scrubbed)
   - `persona_evidence.jsonl` — extracted claims with source spans, for Persona Extraction

Quality gates: dedupe, drop messages < 3 words for SFT, language-ID sanity, manual spot-check sample of 100.

## 2. Interview Protocol (3–5 hours, Arabic + English)

Run by the **Interviewer Agent** (Phase 1 deliverable) in the web app with recording; transcribed locally (whisper-large-v3 or equivalent multilingual STT on the PC) to keep audio + transcript in the corpus. Ali speaks however he naturally speaks; the agent asks in the language Ali used last.

Sessions of ~45 min. The agent follows a module, asks adaptive follow-ups ("why?", "give me an example", "what would you have done if…"), and tracks coverage so nothing is skipped.

| Module | Minutes | Goal | Sample prompts |
|---|---|---|---|
| M1 Life story | 40 | Background timeline, places, turning points | "Walk me through your life from childhood to today, stopping at the moments that changed you." |
| M2 Work & decisions | 45 | Decision procedure; how he leads, escalates, negotiates | "Tell me about a hard call at B-Pal and how you decided." "When do you push back vs. comply?" |
| M3 Values & beliefs | 35 | What he optimizes for; what he refuses | "What would you never do for money?" "What do people misunderstand about you?" |
| M4 Relationships & social style | 30 | Register per audience, conflict style, humor | "How do you talk to a client vs. a friend vs. HR?" |
| M5 Opinions bank | 40 | Stances with confidence, on 40 domains (tech, AI, work, Lebanon, money, family, religion-if-willing, health…) | Rapid-fire: "Position, confidence 1–5, one-line why." |
| M6 Routines & preferences | 20 | Daily life, food, gaming, travel, tools | "Describe a normal Tuesday." |
| M7 Language & expression | 20 | Signature phrases, when he switches to Arabic, emoji habits, cursing threshold | "Say the same message to your team, then to your friend." |
| M8 Scenarios | 30 | Behavior chains (A5): what he'd *do* | "Your CEO moves you to another department tomorrow — first 3 actions?" |
| M9 Future & fears | 20 | Goals, anxieties, what the Twin should never say on his behalf | "What do you want to be true in 5 years?" |

Also captured in the same sessions: **voice-clone material** — see `07-voice-spec.md` §4 (mic, room, read-aloud script in both languages, 15 min each language).

Held-out set: 20% of M5 and M8 items are *not* fed to the Twin; they become Twin Eval items (`09-evaluation.md`).

## 3. Persona Core schema (`persona/core.yaml`)

Structured per A2 (BDE) and extended. Every leaf has `confidence`, `sources[]` (span ids), `updated_at`. Compact rendering ≈ 2.5k tokens goes into every Reasoner call; the full file can be larger.

```yaml
meta: { version: 1, twin_name: "Kairos", updated_at: 2026-09-03 }
identity:
  name: Ali Alzein
  age_bracket, location: Lebanon (Baabda area), languages: [Levantine Arabic, English]
  roles: [Solutions Support Team Leader @ B-Pal / Monty Mobile, builder of TeamsOps/Vesta/ScriptLauncher]
background:            # timeline of key facts
  - { period, fact, why_it_matters }
values:                # ranked, with tension notes
  - { value: "ownership / build it yourself", rank: 1, evidence, tension_with: "delegation" }
decision_procedure:    # how Ali decides (the "D" in BDE)
  default_heuristics: [ "prototype before proposing", "document then escalate", ... ]
  risk_posture, speed_vs_quality, who_he_consults, what_triggers_escalation
evaluation:            # how Ali judges things/people/work (the "E")
  what_impresses_him, what_annoys_him, quality_bar_examples
opinions:              # stance bank
  - { topic, stance, confidence: 1-5, reasoning, as_of, stability: stable|drifting }
relationships:         # pseudonymized where needed
  - { id: PERSON_12, role: "HR contact", how_ali_treats_them, register }
current_context:       # volatile; refreshed by Reflection
  projects, active_conflicts, priorities_this_quarter
routines_preferences:
  daily, food, gaming, tools, travel
linguistic_profile:
  english: { tone, sentence_length, formatting_habits, signature_phrases[] }
  arabic:  { dialect: Levantine (Lebanese), script: Arabic | Arabizi?, signature_phrases[] }
  code_switching: { triggers: [emotion, emphasis, jokes, tech-terms stay English], typical_ratio_casual, typical_ratio_professional }
  emoji_and_punctuation, cursing_threshold, humor_style
registers:
  casual: { description, exemplar_ids[] }
  professional: { description, exemplar_ids[] }
boundaries:            # what the Twin must never claim/say as Ali
  - "never commit Ali to money, contracts, or dates"
  - "never disclose salary/HR details of others"
unknowns: []           # things the Twin should admit it doesn't know about Ali
```

**Governance.** `persona/core.yaml` is in git. Persona Extraction and Reflection write to `persona/proposals/*.yaml`; Ali approves in the Review Inbox → merged with a version bump and changelog. Ali can also edit by hand.

## 4. Style Engine (local LoRA)

### 4.1 Model and training

- **Base**: Qwen (Instruct, 7–8B class, strong Arabic + English). Exact version chosen at Phase 4 start (ADR).
- **Method**: QLoRA (4-bit base, r=16–32, all linear layers) via Unsloth + TRL. ~1–3 epochs, ≤ 2 hours on a 12 GB+ consumer GPU. If Ali's GPU < 12 GB → rent (RunPod/Vast) for the training job only; serve at 4-bit locally (~6 GB).
- **Serving**: vLLM (if VRAM allows) or Ollama with adapter merged; OpenAI-compatible endpoint; only reachable over Tailscale.

### 4.2 Two training tasks in one adapter

1. **Reply SFT** — `sft_reply.jsonl`: given scrubbed context (prior messages, register, language directive) → Ali's actual reply. Teaches turn-taking, length, code-switching.
2. **Rewrite SFT** — `sft_rewrite.jsonl`: given a *neutral, de-styled paraphrase* of one of Ali's real messages (generated by an LLM, same meaning, "assistant voice") → Ali's original. Teaches the exact job the Brain needs: rewrite a Reasoner draft into Ali's voice **without changing meaning**. This is the primary task.

Prompt template (rewrite): `[REGISTER=casual][LANG=mixed ar/en 40/60]\nRewrite in Ali's voice, keep every fact:\n<draft>` → `<ali_text>`.

### 4.3 Data volume targets

- ≥ 1,500 rewrite pairs, ≥ 1,000 reply pairs, balanced across registers and languages; hold out 10% for eval.

### 4.4 Guardrails

- Meaning-preservation check: after rewrite, an NLI/LLM-judge confirms no facts added/removed on a sampled 5% of turns; violations logged and used as negatives for DPO.
- The Style Engine never sees Persona Core secrets; it only sees the draft + exemplars.

### 4.5 Continuous improvement (Phase 8)

- Feedback pairs (Twin's reply vs Ali's correction) → DPO on the adapter, weekly; gated by Twin Eval not regressing.

## 5. Style Exemplar index

- `exemplars.jsonl` → embeddings (multilingual model, e.g. `bge-m3`) → pgvector table `style_exemplars` with `register`, `lang_mix`, `topics`.
- Retrieval: by semantic similarity to the *user input + Reasoner draft intent*, filtered by register/language; top 5–8; max 400 tokens.
- These are the only Ali-authored raw texts that reach the cloud Reasoner, already scrubbed, ≤ 60 words each.

## 6. Language and code-switching rules (Brain directives)

- Mirror the language of the last user message; if mixed, mirror the ratio.
- Tech terms stay in English regardless (observed habit — verify in M7).
- Arabic script vs Arabizi: follow the user's input form; default per `linguistic_profile.arabic.script`.
- Professional register (email/client): English unless the counterpart writes Arabic.
