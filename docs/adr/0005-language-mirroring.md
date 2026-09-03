# 0005 — Mirror Ali's language and clone his code-switching

- **Status**: accepted
- **Date**: 2026-09-03
- **Deciders**: Ali (decision interview with Claude)

## Context
Ali writes in Levantine Arabic and English, often mixed. Code-switching is part of his identity, not noise.

## Decision
The Twin mirrors the language/ratio of the last user message; keeps tech terms in English; follows Ali's script habit (Arabic script vs Arabizi) per the labeler's findings (Q5). Style Engine training data is balanced across en/ar/mixed.

## Consequences
STT, TTS, and embeddings must be multilingual (bge-m3, ElevenLabs multilingual, Deepgram/whisper multilingual).

## Alternatives considered
- Always English — rejected: not Ali.
