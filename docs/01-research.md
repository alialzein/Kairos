# 01 — Research findings (September 2026)

Every architectural choice in this plan traces to a finding below. Paraphrased; follow the links for detail.

## A. Cloning a person with an LLM — what works

| # | Finding | Implication for TWIN | Source |
|---|---|---|---|
| A1 | Agents built from ~2-hour qualitative **interview transcripts** replicated real people's survey answers at 85% of the person's own two-week test-retest consistency; ~15 points better than demographic/persona-only agents, and less biased. | Interviews are the highest-value input. Build an Interviewer Agent and an Interview Protocol. Normalize Fidelity Score to Ali's own test-retest. | Park et al., *Generative Agent Simulations of 1,000 People* (Stanford/DeepMind, 2024) — https://hai.stanford.edu/news/ai-agents-simulate-1052-individuals-personalities-impressive-accuracy |
| A2 | Compressing transcripts into summaries barely hurts accuracy; the bottleneck is **structure**, not volume. A schema of Background / Decision procedure / Evaluation (BDE) beats unstructured summaries. | Persona Core is a structured schema, not a blob of text. | Ye, Deng, Candogan, *Beyond Raw Transcripts* (Chicago Booth, June 2026) — https://papers.ssrn.com/sol3/papers.cfm?abstract_id=6945099 |
| A3 | Across a dozen persona-simulation approaches, structured text/JSON personas in-context (~70–72%) matched or beat a 500-sample fine-tune (~69.6%); random = 59%, human test-retest = 81.7%. | Don't expect fine-tuning to carry *facts* or *opinions*. Fine-tune for style only. | Twin-2K-500 (2025) — https://arxiv.org/pdf/2505.17479 |
| A4 | Persona fidelity decomposes into six capabilities: opinion consistency, memory recall, logical reasoning, lexical fidelity, persona tone, syntactic style. | These six are the Twin Eval axes. | TwinVoice benchmark (2025) — https://arxiv.org/pdf/2510.25536 |
| A5 | Behavior-chain simulation (what the person would *do* next, not just say) is a distinct, harder capability. | Add scenario/decision items to the eval bank, not only opinion items. | BehaviorChain (ACL 2025) — https://aclanthology.org/2025.findings-acl.813/ |
| A6 | Second Me (open source, Apache-2.0) implements a local "AI self" with hierarchical memory modeling and a synth → filter → SFT → DPO training pipeline on Qwen2.5 via llama.cpp. | Reference architecture to read, not adopt wholesale. Their DPO-from-feedback idea is reused in Phase 8. | https://github.com/mindverse/Second-Me · paper https://arxiv.org/html/2503.08102v1 |

## B. Fine-tuning vs prompting vs retrieval

| # | Finding | Implication | Source |
|---|---|---|---|
| B1 | 2026 consensus: Prompt → RAG → thin LoRA/QLoRA → distill. Fine-tune for *form* (style, format, behavior), not facts. Adapters drift when hosted base models update; plan revalidation. | Style Engine = LoRA on an open model we host ourselves (no base-model drift). Facts live in memory. | https://bigdataboutique.com/blog/fine-tuning-llms-when-rag-isnt-enough |
| B2 | Fine-tuning a 7B model on personal chat history captures style and recurring topics well but has no life context. | Style Engine must be paired with Persona Core + memory retrieval. | https://hackernoon.com/i-fine-tuned-an-llm-with-my-telegram-chat-history-heres-what-i-learned |
| B3 | Toolchain: Unsloth (consumer GPU speed), Axolotl (YAML pipelines), TRL (SFT/DPO/ORPO). ~500–1000 curated examples + a single consumer GPU is enough for a style adapter. | Trainer service uses Unsloth + TRL; runs on Ali's PC. | https://dev.to/jangwook_kim_e31e7291ad98/fine-tune-llms-with-lora-and-qlora-2026-guide-33lf |
| B4 | Doppelganger: open pipeline that ingests chat exports → PII scan → ShareGPT SFT → LoRA (LLaMA-Factory). | Reuse its ingestion/sessionizing ideas for the Corpus pipeline. | https://github.com/NotYuSheng/Doppelganger |

## C. Memory and self-evolution

| # | Finding | Implication | Source |
|---|---|---|---|
| C1 | Graphiti (Zep's open-source temporal knowledge graph) tracks fact-validity windows; Zep scored 63.8% vs Mem0 49% on LongMemEval temporal questions. Zep Community Edition is deprecated — self-host **Graphiti** directly on Neo4j/FalkorDB/Kuzu. | Semantic memory = Graphiti on FalkorDB (lightweight, Docker-friendly). | https://particula.tech/blog/agent-memory-frameworks-tested-mem0-zep-letta-cognee-2026 · https://www.developersdigest.tech/blog/best-ai-agent-memory-providers-2026 |
| C2 | Mem0 = easiest personalization API; Letta = OS-style self-managed memory; markdown vault + semantic search = most portable. Most deployments combine a canonical vault with a transient layer. | Persona Core is a versioned YAML "vault" in git; Episodic memory in pgvector; Semantic in Graphiti. | https://fountaincity.tech/resources/blog/agent-memory-knowledge-systems-compared/ |
| C3 | Treat memory extraction as a *write* with owner, retention, and audit trail; never store secrets/unredacted PII in retrievable memory. | Review Inbox + audit log + PII scrubber on the write path. | https://www.puppyone.ai/en/blog/best-ai-agent-memory-platforms |
| C4 | Self-evolving agents: experiences are concretized into natural-language policies and distilled into an evolving skill library (induce → reuse → refine); introspective reflection refines memory without external feedback. | Nightly Reflection job produces Procedural memory ("policies") and Persona Core proposals. | Survey, April 2026 — https://arxiv.org/html/2605.06716v1 |
| C5 | Online evolution of agentic memory from continuous feedback is an active research line (Live-Evo, Memory-R1). | Feedback → preference pairs → periodic DPO on the Style Engine (Phase 8). | https://arxiv.org/pdf/2602.02369 |

## D. Avatar (GPU particles)

| # | Finding | Implication | Source |
|---|---|---|---|
| D1 | CPU particle updates cap ~50k; WebGPU compute pushes to millions. TSL compiles to WGSL and GLSL from one source. `instancedArray` keeps buffers on GPU. | Particle sim in TSL compute; one codebase for WebGPU + WebGL fallback. | https://www.utsubo.com/blog/threejs-best-practices-100-tips |
| D2 | React Three Fiber v9 supports an async `gl` prop for `WebGPURenderer`, which falls back to WebGL automatically. ~95% of browsers are WebGPU-capable. | R3F v9 + `three/webgpu`. | https://blog.maximeheckel.com/posts/field-guide-to-tsl-and-webgpu/ · https://www.utsubo.com/blog/webgpu-threejs-migration-guide |
| D3 | Rendering 3D models as hundreds of thousands of particles with smooth morphs between shapes is a documented TSL/WebGPU pattern. | Humanoid bust ↔ orb ↔ nebula morph targets. | https://wawasensei.dev/courses/react-three-fiber/lessons/tsl-gpgpu |
| D4 | Three-VFX: WebGPU compute particle system for R3F with turbulence, attractors, curve-based size/opacity, WebGL fallback. | Candidate library for emitters/bursts; core humanoid sim is custom. | https://github.com/mustache-dev/Three-VFX |
| D5 | Audio-reactive particles use Web Audio frequency bands (bass/mid/treble) to drive motion, bursts, color. | SPEAKING state driven by an AnalyserNode on the TTS stream. | https://audioreactivevisuals.com/particle-systems.html |

## E. Voice

| # | Finding | Implication | Source |
|---|---|---|---|
| E1 | Picovoice Porcupine: on-device custom wake words trained in seconds (type-to-train), SDKs for Web (WASM), Android, iOS, React Native, Python. openWakeWord is the open alternative but needs ML work per word. | Porcupine for web + Android wake phrase. Verify Arabic availability; English phrase fallback. | https://picovoice.ai/docs/porcupine/ · https://picovoice.ai/blog/complete-guide-to-wake-word/ |
| E2 | Two architectures: speech-to-speech (fast, opaque) vs cascaded STT→LLM→TTS (inspectable, swappable). Cascaded is still the production default when you need control. | Cascaded — required to inject Persona Core, memory, and the Voice Clone. | https://huggingface.co/blog/dvalle08/voice-agent-latency-playbook · https://www.reactify-solutions.com/articles/voice-ai-agents-production-2026 |
| E3 | LiveKit Agents (WebRTC-native, adaptive turn detection, Python + Node SDKs, self-host or cloud) vs Pipecat (Python pipeline control, v1.0 April 2026). | LiveKit Agents (Python) — WebRTC to browser/mobile for free, turn detection built in. | https://www.dograh.com/feeds/blog/pipecat-livekit-agents · https://inworld.ai/resources/vapi-vs-pipecat-vs-livekit |
| E4 | Latency floor: STT partials ~150 ms (Deepgram Nova-3), TTS first-audio 40–75 ms (Cartesia, ElevenLabs Flash). | Sub-second turn is achievable with streaming. | https://www.reactify-solutions.com/articles/voice-ai-agents-production-2026 |
| E5 | ElevenLabs leads on cloning fidelity and lists Arabic; Cartesia leads on latency but Arabic is not top-tier. Instant clone from 30 s–3 min; professional clone needs 30+ min studio-quality audio; consent step required by all vendors. F5-TTS (MIT) / XTTS-v2 are self-host fallbacks. | ElevenLabs Professional Voice Clone. Record during interviews. Self-host fallback documented. | https://futureagi.com/blog/elevenlabs-vs-cartesia-tts-2026/ · https://nisai.dev/guides/ai-voice-tts-2026/ · https://www.codesota.com/speech/best-for-voice-cloning |

## F. Web + mobile

| # | Finding | Implication | Source |
|---|---|---|---|
| F1 | Next.js + Capacitor suits web-first teams needing web + mobile from one codebase; Expo suits mobile-first native UI. Our UI is WebGL/WebGPU either way, which runs in a WebView. Capacitor has a strong OTA-update ecosystem. | PWA first; Capacitor wraps the same Next.js build for the APK. Native plugin only for background wake word. | https://nextnative.dev/comparisons/nextjs-vs-expo · https://www.otakit.app/blog/react-native-vs-capacitor |

## G. Process skills

| # | Finding | Use | Source |
|---|---|---|---|
| G1 | mattpocock **grill-with-docs**: relentless interview that writes `CONTEXT.md` glossary + ADRs as decisions resolve. Requires sibling skills `grilling` and `domain-modeling`. Flow: /grill-with-docs → /to-spec → /to-tickets → /implement → /code-review. | Used for every spec ambiguity. Install the whole set. | https://github.com/mattpocock/skills |
| G2 | obra **superpowers**: brainstorming (no code until design agreed), writing-plans (2–5 min tasks with tests first), TDD enforcement, systematic-debugging, subagent-driven development. | Default execution methodology. | https://github.com/obra/superpowers |

## H. Things the research did **not** settle (tracked in `13-open-questions.md`)

- Arabic wake-word availability in Porcupine.
- Best STT for Levantine Arabic + English code-switched speech (Deepgram vs ElevenLabs Scribe vs Whisper-large-v3 self-hosted) — needs a bake-off on Ali's own recordings.
- Ali's GPU VRAM (determines 7–8B QLoRA locally vs rented GPU).
- WebGPU availability inside Android WebView on Ali's target phone (fallback is WebGL, so not blocking).
