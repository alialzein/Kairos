# 06 — Avatar spec (GPU particle humanoid)

Reference: the three screenshots Ali provided — a blue point-cloud humanoid bust on a dark field, amber/orange energy core in the head/chest, luminous "spine" lines, concentric halo rings, mountain-like particle waves in the background, bloom. Ours must match that mood and exceed it in liveliness. Research basis: `01-research.md` D1–D5.

## 1. Tech stack

- React Three Fiber v9 + `three/webgpu` (`WebGPURenderer`, WebGL fallback automatic) + TSL for all shaders.
- Particle simulation entirely on GPU: TSL **compute** nodes over `instancedArray` buffers (positions, velocities, seeds, morph weights). No per-particle CPU work.
- Post: TSL bloom (threshold tuned so only core + spine bloom), subtle chromatic aberration on WAKING only, vignette.
- Rendering: `SpriteNodeMaterial` / points with additive blending, size attenuation, soft circular sprite, depth write off.
- Quality tiers (auto-detected via `navigator.gpu`, `deviceMemory`, and a 2-second FPS probe):

| Tier | Particles | Background waves | Bloom | Target |
|---|---|---|---|---|
| Ultra (desktop WebGPU) | 400k | yes | yes | 60 fps |
| High (desktop WebGL / high-end phone) | 150k | yes | yes | 60/45 fps |
| Mid (mid-range Android) | 60k | reduced | cheap | 30 fps |
| Low / reduced-motion | 20k static frame | no | no | — |

## 2. Morph targets (shapes)

All targets are precomputed point sets of equal length N (max tier), stored as `Float32Array` textures/buffers; lower tiers sample a stride.

| Target | Source | Notes |
|---|---|---|
| `HUMANOID` | Point sample of a stylized head + shoulders bust mesh (GLB, ~10k tris; generic, non-photoreal; sourced from an open-license base mesh or sculpted in Blender). Surface + volumetric jitter (0–4 mm) for the cloud look. | Includes attribute `region ∈ {head, face, neck, chest, shoulders}` per point for localized effects. |
| `ORB` | Fibonacci sphere with 3 nested shells | IDLE form |
| `NEBULA` | Curl-noise scattered volume | DORMANT form |
| `RING` | Torus + halo discs | Transitional flourish (WAKING) |
| `CORE` | Small dense sphere at head/chest anchor | Always present as a sub-system (5% of particles), amber |
| `SPINE` | Polyline down neck→chest with branching (like the screenshot's glowing tendrils) | Sub-system, 2% of particles, amber→blue gradient |
| `WAVES` | Two heightfield sheets left/right, low-frequency noise | Background sub-system, separate lower-count buffer |

Morphing: `pos = mix(targetA, targetB, smoothstep(t))` in the compute node, plus curl-noise displacement scaled by `turbulence`, plus state-specific forces.

## 3. Avatar State machine

```
DORMANT ──wake phrase / click──▶ WAKING ──(1.2s)──▶ LISTENING
   ▲                                                   │ end of speech
   │ 90s no activity                                   ▼
 IDLE ◀──────── turn end ────────── SPEAKING ◀── THINKING (first token)
   │
   └── network/provider failure ──▶ OFFLINE (from any state)
```

| State | Shape | Turbulence | Core | Color/mood | Extra |
|---|---|---|---|---|---|
| DORMANT | NEBULA | 0.15 | dim, slow 6s pulse | desaturated blue, low brightness | particles drift; pointer parallax only |
| IDLE | ORB (breathing scale ±3%, 4s) | 0.25 | soft pulse 3s | blue, medium | occasional "thought sparks" (small bursts) |
| WAKING | ORB → RING flash → HUMANOID | 0.9 → 0.3 | flare to 100% | white-blue flash, chromatic aberration | 1.2 s; sound cue |
| LISTENING | HUMANOID | 0.2 + mic energy × 0.4 | brightens with mic RMS | blue with amber warming | particles near "ears" pull inward with mic energy; halo rings ripple outward per voice onset |
| THINKING | HUMANOID with swirl vortex around head | 0.6 | rapid 1.2s pulse | blue, core more orange | spine lines animate upward (data flowing) |
| SPEAKING | HUMANOID | 0.3 + audio bands | bass→core scale, mid→chest wave, treble→sparkle | full palette | mouth/face region emits outward pulses synced to TTS energy; subtle head sway |
| OFFLINE | HUMANOID freezes → dissolves to NEBULA over 2s | 0.8 then 0.1 | red-tinted, flickering | grey-blue | status text |

Transitions are tweened (`easeInOutCubic`, durations 0.4–1.2 s). All state parameters live in `packages/config/avatar.ts` as a single typed table so designers/agents can tune without touching shaders.

## 4. Inputs to the simulation (uniforms)

| Uniform | Source | Range |
|---|---|---|
| `uState`, `uStateT` | client state machine | enum, 0–1 |
| `uMorph` | tween | 0–1 |
| `uTurbulence` | state table | 0–1 |
| `uAudioBass/Mid/Treble` | Web Audio `AnalyserNode` on mic (LISTENING) or TTS output (SPEAKING), smoothed | 0–1 |
| `uPointer` | mouse/touch, with repulsion radius | NDC |
| `uPresence` | (Phase 8) MediaPipe face/hand landmarks → head yaw/pitch, hand proximity | — |
| `uTime` | clock | s |

## 5. Design tokens (light/dark, Ali's CSS-token approach)

```
--twin-bg:            #05070d   (light theme: #f4f6fb with inverted particle palette — decide in Phase 5 grill)
--twin-particle:      #2f9bff
--twin-particle-deep: #0a3d7a
--twin-core:          #ffb347
--twin-core-hot:      #ff7a1a
--twin-spine:         #ffd28a → #2f9bff
--twin-halo:          rgba(80,160,255,0.35)
--twin-offline:       #ff4d4d
```

UI chrome around the Avatar is minimal: a status ring (state color), transcript ribbon at the bottom, chat drawer (slide-in), settings gear. Typography and spacing tokens reuse Ali's TeamsOps token system conventions.

## 6. Interactions

- Click/tap Avatar → wake (same as wake phrase).
- Pointer/touch near particles → gentle repulsion; long-press → attract (fun, cheap).
- Scroll/gesture (mobile): pinch to zoom camera within limits; double-tap to reset.
- Phase 8: webcam presence — Avatar turns its "head" toward Ali; open-palm gesture = mute; wave = wake.

## 7. Performance rules

- One draw call for the main cloud; one for background waves; one for post.
- `devicePixelRatio` capped at 1.5 on mobile, 2 on desktop.
- Pause simulation when tab hidden; reduce tier when `battery.charging === false && level < 0.2`.
- Frame-time telemetry (p50/p95) reported to the dashboard; perf test in CI using Playwright + `requestAnimationFrame` sampling on a fixed headless GPU profile (baseline numbers recorded in Phase 5).

## 8. Phase 5 deliverables

1. `apps/web/src/avatar/` — `AvatarCanvas.tsx`, `useAvatarState.ts`, `sim/compute.ts` (TSL), `sim/targets/*.ts` (shape generators + GLB sampler script), `post/`, `audio/analyser.ts`.
2. Storybook-like `/dev/avatar` page with Leva controls for every uniform and a state stepper.
3. Perf report and tier thresholds committed.
