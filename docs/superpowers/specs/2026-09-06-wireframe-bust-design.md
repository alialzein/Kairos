# Wireframe Bust — avatar look v2 (design spec)

Date: 2026-09-06 · Owner: Ali Alzein · Status: approved (brainstorm session, this date)

## Goal

Make the Kairos avatar match Ali's reference image (viral particle-humanoid post): a bust drawn as
~40–60 tightly spaced, crisp, glowing cyan **contour lines** that follow the surface; the same lines
turn **orange** across the face front (the "core striations"); an orange **lightning-tree spine**
runs from the throat to a snowflake node at the chest; **dashed concentric halo rings** sit behind the
head with a plume of sparks rising above it; a full-width **mountain range** carries orange lightning
veins along its ridges over a dense starfield; a monospace **HUD** reads `STATUS: LISTENING`.

Decisions taken with Ali:

1. **Fidelity: replicate 1:1.** The awake bust is line-drawn; the current dust bust is demoted to a
   faint under-layer.
2. **Likeness stays.** Contour lines trace Ali's hairstyle and glasses (beard remains dust).
3. **Lines for the bust, particles for the rest.** DORMANT galaxy, IDLE orb, dissolve/assemble
   effects keep today's particle system. The line layer fades in with the humanoid weight.
4. **Rendering approach A: real 3D line geometry** — CPU mesh slicing → closed loops → three.js
   `LineSegments2` + `Line2NodeMaterial` (TSL-driven, native dashes). Rejected: particles-on-lines
   (never crisp) and screen-space contours (flat, no dashes, poor bloom fit).

## Architecture

New module `apps/web/src/avatar/lines/`, sharing `SimUniforms` with the particle sim.

| Unit | Kind | Does | Depends on |
|---|---|---|---|
| `slice.ts` | pure, tested | Cuts a `BustMesh` with N horizontal planes (default 60, y ∈ [−0.55, 0.9]) into closed loops; drops loops < 8 verts; resamples each loop to even arc spacing (~0.012). Emits packed line-segment positions + per-vertex attrs: slice index, arc t (0..1), loop id, outward dir (from loop centroid). | `BustMesh` |
| `likenessMesh.ts` | pure, tested | Applies the hairstyle lift (same rules as `targets/likeness.ts`, on mesh vertices) so particles and lines agree; emits glasses loops (two superellipse rims, bridge, temples) as extra polylines with a `glasses` flag. | `canonical.ts` anchors |
| `veins.ts` | pure, tested | Deterministic branching polylines: spine tree (throat → chest node, 3–4 generations, jitter), chest snowflake (6-fold spokes + sub-branches), mountain ridge veins (walk along heightfield crests from `targets/waves.ts`). | `Rng` |
| `LineBust.ts` | three object | `LineSegments2` + `Line2NodeMaterial` for contour + glasses loops. TSL: position flow (slow drift along arc t, noise sway), jaw offset (shared helper with the kernel), vortex twist, offline fray; color = mix(cyan, orange, coreGlow(dist to face anchor)) · brightness · shade; reveal gate by x against `assemble`. | `slice`, `likenessMesh`, uniforms |
| `VeinLines.ts` | three object | Spine tree + chest node, orange, dashed pulse travelling via animated `dashOffset`, timed to `corePulse`; fades with shade. | `veins` |
| `HaloRings.ts` | three object | Three dashed rings (replaces the point rings from polish T3) + a small sprite **spark plume** above the head (upward drift, treble-driven rate). | existing halo anchors |
| `RidgeVeins.ts` | three object | Ridge polylines over the mountain range with orange lightning pulses (dash offset), sparse and slow. | `veins`, `targets/waves` |
| `Starfield.ts` | three object | ~5k static tiny points far behind everything. | — |
| HUD (`AvatarStage.tsx`) | React | Top-right `STATUS: <STATE>` and `ASSEMBLING… NN%` during WAKING (from the linear assemble value), system monospace stack, uppercase, tracked. | store |

`AvatarCanvas.ParticleSystem` instantiates the line objects next to the sprites and disposes them
with the same lifecycle. Main-particle opacity gains a factor `1 − 0.75·shade` so dust stays faint
under the lines (beard/hair dust included).

Palette additions (`sim/palette.ts`): `lineCyan #35c8ff`, `lineDim #1467b8`, `coreLine #ff8c1a`,
`coreLineHot #ffd27a`; background darkened to `#050a18`.

## Data flow / states

- `shade` (existing): line layers' opacity. 0 in DORMANT/IDLE/OFFLINE-end; 1 when the bust is assembled.
- `assemble` (existing linear WAKING progress): per-vertex reveal `smoothstep(xNorm·0.55 + jitter, +0.3, assemble)` — the lines draw in left→right in sync with the particle sweep; the HUD percentage is this value.
- `speak`: orange core brightness pulse + jaw offset on mouth-region lines (same formula as the particle kernel, extracted to `lines/tsl.ts`).
- `listen`: radial ripple from the ear anchors (small amplitude, decays with distance).
- `vortex` (THINKING): loops rotate around the head axis by `vortex · (y − 0.2) · 0.35` rad and flow speed ×3.
- OFFLINE: tint → `palette.offline`, fray noise amplitude ramps 0 → 0.06 over the freeze, then shade → 0.
- `corePulse` / `bass`: vein pulse brightness; `treble`: spark plume emission.

## Performance & fallback

Budget: ≤ 15k line segments total, ≤ 5k plume+star sprites. Present on every tier (Low tier
renders its single static frame as today). First task verifies `Line2NodeMaterial` under
`forceWebGL`; on failure the layer swaps to `LineBasicNodeMaterial` (1 px) automatically and logs
once. Perf CI 15 % gate unchanged.

## Error handling

- Degenerate slices (open or tiny loops): skipped; slicer never throws on a valid mesh.
- Missing mesh / zero loops: line layer not created, particles render as today.
- Uniform/attribute mismatches surface in the existing e2e smoke (backend boots, keeps rendering).

## Testing

- Unit (vitest): `slice` (loop closure, monotonic slice heights, even spacing, determinism, tiny
  fixture), `likenessMesh` (lift raises scalp verts only; glasses loops on the rim plane),
  `veins` (tree connectivity, bounds, determinism, snowflake symmetry).
- E2E: existing smoke; new assertion that the HUD reads `STATUS: LISTENING` after wake.
- Visual: headed-Chrome (foregrounded) screenshots vs the reference at every task; final
  side-by-side for Ali's approval (L9).

## Build order

L1 slicer + static cyan line bust (shade fade, WebGL2 check) → L2 orange core gradient + flow +
dimmed dust + palette → L3 likeness in lines (mesh lift + glasses loops) → L4 vein spine + chest
node → L5 dashed halo + spark plume + starfield → L6 mountain ridge veins → L7 HUD chrome →
L8 state behaviors (reveal sweep, thinking twist, offline fray, speak jaw, listen ripple) →
L9 Ali approval pass and tuning.

## Out of scope

Likeness v2 (true face mesh from photos — needs side photos + ML dep approval); camera/gesture
tracking; sound design; longer WAKING duration (a separate state-machine decision for Ali).
