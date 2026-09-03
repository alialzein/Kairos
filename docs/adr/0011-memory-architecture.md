# 0011 — Graphiti temporal graph + pgvector episodes + versioned Persona Core

- **Status**: accepted
- **Date**: 2026-09-03
- **Deciders**: Ali (decision interview with Claude)

## Context
Facts about a person change over time; temporal graphs (Graphiti) lead on that. Zep's hosted product is optional; Graphiti is open source. A git-versioned YAML vault keeps the canonical identity portable.

## Decision
Semantic memory in Graphiti on FalkorDB; episodic in Supabase pgvector; procedural policies in Postgres; Persona Core in git with human-approved proposals; nightly Reflection worker.

## Consequences
Two datastores to run; provenance and validity windows available for the UI and evals.

## Alternatives considered
- Mem0 only — rejected: weaker temporal reasoning.
- Letta runtime — rejected: couples memory to an agent runtime we don't otherwise need.
