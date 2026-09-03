# 05 — Memory and evolution (self-learning)

Research basis: `01-research.md` C1–C5.

## 1. Memory layers

| Layer | Store | Time horizon | Written by | Read when |
|---|---|---|---|---|
| Working | Redis (session) | minutes–hours | Brain | Every turn |
| Episodic | Postgres `episodes` + pgvector | forever | Post-turn extractor, connectors | Semantic similarity to the input |
| Semantic | Graphiti on FalkorDB (temporal graph) | forever, with validity windows | Post-turn extractor, connectors, Reflection | Entity/temporal queries ("who", "when", "still?") |
| Procedural | Postgres `policies` | until superseded | Reflection, Feedback | Matched by trigger conditions |
| Persona Core | `persona/core.yaml` (git) | slow-changing | Persona Extraction, Reflection proposals, Ali | Always |

## 2. Graphiti ontology (Semantic layer)

Entity types: `Person`, `Organization`, `Project`, `Tool`, `Place`, `Topic`, `Belief`, `Preference`, `Event`, `Commitment`.
Edge examples (all with `valid_from`, `valid_to`, `source`, `confidence`): `WORKS_AT`, `LEADS`, `BUILDS`, `USES`, `PREFERS`, `BELIEVES`, `DISAGREES_WITH`, `PLANS`, `HAPPENED_AT`, `KNOWS`.

Temporal semantics: a new contradicting fact *closes* the old edge (`valid_to = now`) rather than deleting it. The Brain queries `as_of=now` by default; Reflection and evals can query history.

## 3. Write path

```
Turn ends
  └─ Extractor (Reasoner, JSON schema) → Memory Candidates[]
        { kind: fact|episode|preference|policy|persona_change,
          text, entities[], valid_from, confidence, sensitivity, source_turn }
        │
        ├─ Auto-accept if: kind ∈ {episode, fact} AND confidence ≥ 0.8 AND sensitivity == low
        ├─ Review Inbox if: persona_change OR sensitivity ≥ medium OR contradicts existing fact
        └─ Drop if: secret detected, or about a Guest's private info without consent
  └─ Audit log row for every accept/reject/edit (who, when, why)
```

Sensitivity classes: `low` (routines, tools, opinions on tech), `medium` (relationships, work conflicts), `high` (health, money, HR, legal). High is never auto-accepted and never sent to Guests.

## 4. Read path (context assembly)

Given the input and session:

1. Entity linking on the input (names, projects) → Graphiti `search(query, center_nodes, as_of=now, limit=12)`.
2. pgvector top-k (k=6) episodes by embedding, re-ranked by recency decay.
3. Policies whose `trigger` matches (keyword/embedding) → top 3.
4. Token budget enforced in priority: Persona Core > policies > semantic facts > episodes.

Every retrieved item carries `[source, date]` in the prompt so the Reasoner can reason about staleness and the UI can show "why did it say that?" (provenance panel).

## 5. Reflection (nightly worker)

Runs on the VPS at 03:00 Beirut time; no GPU needed.

1. **Consolidate**: summarize the day's sessions into episodes; merge near-duplicate facts.
2. **Contradiction scan**: for each new fact, find conflicting edges → close old edge or open a Review item if ambiguous.
3. **Policy induction**: from repeated patterns ("Ali always answers X with Y", corrections) → propose `policies` (natural-language rules with trigger + action + evidence).
4. **Persona drift detection**: compare recent opinions/behaviors with `persona/core.yaml`; produce `persona/proposals/YYYY-MM-DD.yaml` with diffs and evidence.
5. **Exemplar refresh**: add high-signal new Ali messages (from Feedback corrections and connectors) to the Style Exemplar index.
6. **Report**: dashboard card "What I learned yesterday" + Review Inbox count.

## 6. Feedback loop

UI on every Twin reply: 👍 / 👎 / "I'd have said…" (free text). Stored as `feedback` rows:

- 👎 + correction → (a) immediate Procedural memory candidate, (b) DPO pair `(chosen = correction, rejected = twin_reply)` for the Style Engine (Phase 8), (c) Twin Eval regression item.
- 👍 → positive exemplar (optionally added to index).

## 7. Connectors (ongoing self-learning from Ali's life)

Run on the PC (data stays local), emit scrubbed Memory Candidates to the memory service:

| Connector | Cadence | What it yields |
|---|---|---|
| Gmail (sent + received, work) | hourly | Professional-register texts, commitments, relationships |
| Notes folder / Obsidian-style vault | on change | Docs, decisions |
| Claude/ChatGPT export re-import | manual | New reasoning traces, projects |
| Calendar (read-only) | hourly | Events → episodes and current_context |

Each connector: `pull()` → normalize → scrub → label → candidates. Same pipeline as ingestion.

## 8. Forgetting and correction

- Ali can delete any memory from the dashboard; deletion cascades to embeddings and closes graph edges; audit logged.
- "Forget everything about <topic>" = bulk close + reindex.
- Retention default: episodes summarized after 90 days (raw turn text kept locally only).

## 9. Phase 3 exit test (self-learning proof)

Day 1: Ali tells the Twin three new facts (one low, one medium sensitivity, one contradicting an old fact). Day 2 (after Reflection): the Twin uses all three correctly in fresh sessions; the contradiction is resolved in favor of the new fact; the medium one appeared in the Review Inbox and was approved. Automated as an integration test with a mocked clock.
