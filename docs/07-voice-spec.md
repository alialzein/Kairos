# 07 — Voice spec: wake word, real-time pipeline, voice clone

Research basis: `01-research.md` E1–E5.

## 1. Wake phrase

- Engine: **Picovoice Porcupine** (on-device). Web SDK (WASM) in `apps/web`; Android SDK inside a Capacitor plugin (Phase 7) with a foreground service so listening survives screen-off.
- Phrase: `"Hey Kairos"` (English; Arabic variant "يا كايروس" if an Arabic model is available) — 3–4 syllables total is optimal. Arabic-language model: check Porcupine console for Arabic; if unavailable, the English phrase is trained and Ali's Arabic-accented English is tested (Porcupine accepts a test mic in the console). Track in `13-open-questions.md`.
- Behavior: detection → `AvatarState.WAKING` → open LiveKit session (or resume) → LISTENING. False-accept mitigation: require sensitivity ≤ 0.5 and a 300 ms VAD confirmation of speech after the phrase.
- Privacy: audio never leaves the device until after wake; UI shows a persistent "listening for wake phrase" indicator with a one-tap off switch.
- Free-tier limits on Picovoice are per-user monthly; single-user usage fits. Re-check at Phase 6 (ADR if a paid plan is needed).

## 2. Real-time pipeline (cascaded, streaming)

```
Browser/Mobile (LiveKit client, WebRTC)
   │ mic track
   ▼
LiveKit room ──▶ services/voice (LiveKit Agents worker, Python)
                  ├─ VAD + turn detector (LiveKit bundled model, multilingual)
                  ├─ STT stream (Deepgram Nova-3 multilingual  |  bake-off alt: ElevenLabs Scribe, whisper-large-v3 on PC)
                  ├─ Brain client: POST /turn (stream) with channel=voice, register=casual
                  ├─ Sentence chunker → TTS stream (ElevenLabs, Voice Clone, Flash/Turbo model for latency; Multilingual v2 for quality mode)
                  └─ audio track back to room; emits avatar.state + energy hints
```

- Barge-in: user speech during SPEAKING → cancel TTS + Brain generation, keep partial transcript in working memory as "interrupted".
- Language: STT set to auto-detect between ar + en with code-switch tolerance; Brain mirrors; TTS model must handle mixed-script input (ElevenLabs multilingual does).
- Text fallback: if voice providers fail twice in a session, switch to text input with the same session id.

**Home stage (ADR-0014).** Until Phase C no paid voice vendor is used. The A6.1 bake-off measures, on the PC's GPU, faster-whisper (large-v3-turbo) for STT, Piper or Kokoro for TTS and F5-TTS/XTTS-v2 (§4.2 fallback) for the clone, with `livekit-server` self-hosted in compose; the results decide by ADR whether the cloud stage keeps ElevenLabs, Deepgram and LiveKit Cloud.

### Latency budget (end of user speech → first audio)

| Stage | Target |
|---|---|
| Turn detection | ≤ 200 ms |
| STT final | ≤ 250 ms |
| Brain first sentence (Reasoner streaming + optional style rewrite of sentence 1) | ≤ 500 ms |
| TTS first audio | ≤ 150 ms |
| Network (Lebanon ↔ EU VPS/LiveKit) | ≤ 150 ms |
| **Total** | **≤ 1.2 s (Phase 6), ≤ 0.8 s (Phase 8 after tuning)** |

Tuning levers for Phase 8: preemptive generation on interim transcripts, skip style rewrite for the first sentence, self-host STT on PC, LiveKit region selection.

## 3. LiveKit deployment

- Home stage: `livekit-server` self-hosted in compose on the PC (free, LAN latency).
- Cloud stage, Phase 6: LiveKit Cloud (free tier) for speed; region nearest Lebanon.
- ADR trigger to self-host `livekit-server` on the VPS: cost > free tier, or latency measurements show cloud region penalty > 80 ms.

## 4. Voice Clone (Ali's voice, Arabic + English)

### 4.1 Recording protocol (done during interview sessions)

- Mic: cardioid USB/XLR condenser or a good dynamic; pop filter; 48 kHz / 24-bit WAV; quiet room, soft furnishings; 30 cm from mic; no processing/noise gate.
- Material: ≥ 15 min English + ≥ 15 min Arabic of *read* script (varied sentences, questions, exclamations, numbers, tech terms, names) **plus** ≥ 30 min of natural interview speech. Total ≥ 60 min usable.
- Script lives in `services/trainer/voice/scripts/{en,ar}.md`; recorder page in the web app `/dev/record` with level meter and take management; files stay on the PC (or Supabase Storage only if Ali opts in).
- Consent: record the vendor-required consent statement in both languages.

### 4.2 Cloning

- Phase 6 start: **Instant Voice Clone** (1–3 min) for pipeline bring-up.
- Phase 6 end: **Professional Voice Clone** (ElevenLabs) from the full set; evaluate with 10 sentences per language rated by Ali and two friends (MOS-style 1–5 on similarity/naturalness).
- Fallback/self-host path (documented, not built unless needed): F5-TTS or XTTS-v2 on the PC with the same reference audio.

### 4.3 Usage rules

- The Voice Clone is used only by the Twin, only through `services/voice`, only for Owner sessions until Phase 8 guest mode (where the Twin verbally discloses it is an AI at session start).
- Never used to generate content Ali hasn't approved for external distribution.

## 5. Phase 6 deliverables

1. `services/voice/` — LiveKit Agents worker with pluggable STT/TTS providers, latency tracing per stage, barge-in tests (recorded audio fixtures).
2. `apps/web` — voice session UI, wake-phrase engine, permission flows, provider status.
3. STT bake-off report on Ali's recordings (WER for en, ar, mixed).
4. Voice Clone evaluation report.
