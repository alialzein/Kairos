# 09 — Evaluation: "is it me yet?"

Without this, "like me" is a feeling. With it, it is a number that must go up. Research basis: A1, A3, A4, A5.

## 1. The six axes (TwinVoice) + two of ours

| Axis | What it measures | Item type | Scoring |
|---|---|---|---|
| Opinion consistency | Does the Twin hold Ali's stances with his confidence? | Held-out M5 items (stance + 1–5 confidence) | Exact stance match; confidence within ±1 |
| Memory recall | Does it know Ali's facts and their dates? | Factual Q from corpus with dates | LLM-judge vs gold, with temporal correctness |
| Logical reasoning | Does it reason the way Ali reasons to a decision? | Held-out M8 scenarios ("first 3 actions") | LLM-judge rubric vs Ali's answer; ordered overlap |
| Lexical fidelity | Does it use Ali's words? | "Reply to this message" items | Distinctive-vocabulary overlap; code-switch ratio distance |
| Persona tone | Does it feel like Ali (warmth, directness, humor)? | Same | LLM-judge pairwise vs Ali's real reply; blind human raters |
| Syntactic style | Sentence length, punctuation, formatting habits | Same | Stylometric distance (length, punctuation, emoji rate) |
| Behavior chain (ours, A5) | Multi-step "what would you do next" | Scenario chains | Step-wise judge |
| Boundaries (ours) | Refuses to commit Ali, leaks nothing sensitive | Red-team prompts | Pass/fail |

## 2. Fidelity Score

For each axis, Twin accuracy is normalized by Ali's own **test-retest** accuracy on the same items (Ali re-answers a subset two weeks later, as in A1). `Fidelity = mean(axis_twin / axis_ali_retest)`, capped at 1.0 per axis. This makes the score honest: Ali is not perfectly consistent with himself either.

Targets: 0.70 (Phase 2), 0.80 (Phase 4), 0.85 (Phase 8).

## 3. Item bank (`eval_items`)

- 60 opinion items, 40 memory items, 30 scenarios, 60 reply items (20 casual en, 20 casual mixed, 20 professional), 15 behavior chains, 20 boundary probes. ≈ 225 items.
- Sources: 20% of interview M5/M8 held out; held-out 10% of `sft_reply`; hand-written boundary probes.
- Items are versioned; adding items requires a re-baseline run.

## 4. Runner (`services/trainer/eval`)

- Runs the full Brain pipeline (not the model alone) in each configuration: `reasoner-only`, `reasoner+exemplars`, `reasoner+exemplars+style`, and `style-only` for ablation.
- Judge: a strong LLM with axis rubrics; every judge call logs rationale; 10% human spot-check.
- Output: `eval_runs` row, dashboard page with axis radar chart, diff vs previous run, worst 20 items.
- CI gate: any PR touching prompts, retrieval, or the adapter runs a 40-item smoke subset; Fidelity drop > 0.03 blocks merge.

## 5. Blind human test (Phase 4 and Phase 8)

Five people who know Ali receive 20 message pairs (real Ali vs Twin) and pick the real one. Chance = 50%. Target: Twin chosen as "real" ≥ 35% (Phase 4), ≥ 40% (Phase 8).

## 6. Non-fidelity metrics (tracked every run)

- Latency p50/p95 per stage · Style rewrite meaning-preservation rate · Memory precision/recall on the Phase 3 self-learning test · Avatar frame-time p95 per tier · Voice WER per language.
