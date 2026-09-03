# 0009 — PWA first, Android APK via Capacitor later

- **Status**: accepted
- **Date**: 2026-09-03
- **Deciders**: Ali (decision interview with Claude)

## Context
The UI is WebGL/WebGPU either way; Capacitor reuses the Next.js build. Only background wake-word listening needs native code.

## Decision
Ship as PWA in Phase B7.1; wrap with Capacitor for the APK with a native Porcupine plugin; OTA updates for the web layer.

## Consequences
No React Native codebase to maintain; iOS remains PWA (tap-to-talk) unless an ADR adds an iOS build.

## Alternatives considered
- Expo/React Native — rejected: second UI codebase for no gain since the Avatar is WebGL anyway.
