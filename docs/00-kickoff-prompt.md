# Kickoff prompt for Claude Code

Copy everything below the line into Claude Code, from the repo root, after installing the skills listed in `docs/12-repo-and-tooling.md`.

---

You are starting the TWIN project. This repo contains a complete plan and no code.

1. Read `CLAUDE.md`, then `README.md`, then `CONTEXT.md`.
2. Read `docs/11-roadmap.md` in full. We are at **Phase 0**.
3. Read `docs/12-repo-and-tooling.md` and `docs/03-architecture.md`.
4. Read `docs/13-open-questions.md`. For any question tagged **[blocks Phase 0]**, ask me now using `/grill-me` (one round, recommended answers attached). Do not ask about questions that block later phases.
5. Create `docs/STATUS.md` with the phase tracker template from the roadmap.
6. Use `/writing-plans` to produce `docs/plans/phase-0.md`: bite-sized tasks with file paths and tests, derived from the Phase 0 task list. Show it to me. Do not write code until I approve the plan.
7. After approval, execute Phase 0 task by task with TDD, committing after each task, and stop at the Phase 0 exit gate with the gate results pasted.

Rules: never touch `corpus/`, never add a cloud vendor without an ADR, keep `CONTEXT.md` and `docs/STATUS.md` current.
