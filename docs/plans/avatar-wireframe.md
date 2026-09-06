# Avatar look v2 — "Wireframe Bust" implementation plan

Spec: `docs/superpowers/specs/2026-09-06-wireframe-bust-design.md` (approved by Ali 2026-09-06).
Supersedes the visual goals of `avatar-polish.md` T2/T3 (ribbons/halo points → real lines).

Rules: one task = one branch (`b5-2N-*`) = one PR; TDD for pure logic; visual proof = foregrounded
headed-Chrome screenshot vs the reference (`scratchpad/faceshot.mjs` pattern with `bringToFront`);
`pnpm format:check` + lint + typecheck + unit + e2e before push; rulings → `phase-b5-ledger.md`
("Wireframe" section). Perf CI 15 % gate must stay green on every PR.

Library facts (verified in node_modules, three 0.185.1): `Line2NodeMaterial` exported from
`three/webgpu`; `LineSegments2` at `three/addons/lines/webgpu/LineSegments2.js` (typed);
`LineSegmentsGeometry.setPositions(flat xyz pairs)`; dashes via `dashed:true` + `dashSize`,
`gapSize`, `dashOffset`/`offsetNode`, `dashScaleNode`. The material derives vertices from the
`instanceStart`/`instanceEnd` instanced attributes — **`positionNode` is not the deformation
hook**. Therefore: colour/opacity/reveal/dash = TSL (custom per-segment instanced attributes read
via `attribute('name')`); vertex deformation (jaw, twist, fray, flow) = CPU typed-array update of
the positions buffer each frame (≤ 15k segments → < 1 ms).

## Tasks

### L1 — slicer + static line bust
Files: `lines/slice.ts` (+test), `lines/LineBust.ts`, `AvatarCanvas.tsx` (add/dispose),
`sim/palette.ts` (lineCyan/lineDim/coreLine/coreLineHot, bg #050a18), `sim/compute.ts`
(main-particle opacity × (1 − 0.75·shade)).
Slicer: planes at `y = -0.55 … 0.9` (N=60); per triangle, intersect with plane → segment; chain
segments into loops by endpoint proximity (grid hash, ε 1e-4); drop loops < 8 verts; resample to
spacing 0.012; output `{ positions: Float32Array (segment pairs), segAttrs: { slice, t, loop, x } }`.
Tests (tiny fixture): every loop closed (first==last within ε), slice heights monotonic, spacing
within ±30 % of target, deterministic, no NaN, degenerate input (3 verts) → zero loops, no throw.
LineBust: `LineSegments2` + `Line2NodeMaterial({ linewidth: 1.6, worldUnits: false, transparent,
blending: Additive, depthWrite: false })`; colorNode = lineCyan · brightness; opacityNode = shade.
Check: `?webgl=1` bench boots and draws lines; if not, fallback to `LineBasicNodeMaterial` path
(implement the switch only if the check fails). Screenshot LISTENING at ultra.

### L2 — orange core gradient + flow + dust dim
Files: `lines/LineBust.ts`, `lines/tsl.ts` (shared helpers), `sim/compute.ts`.
colorNode = mix(lineCyan, mix(coreLine, coreLineHot, coreHeat), coreGlow) where coreGlow =
smoothstep(0.42, 0.12, dist(segMid, faceAnchor)) · (0.6 + 0.4·corePulse) · front-facing weight
(segment outward dir · +z). Flow: CPU shifts each loop's sample phase by `t += 0.03·dt` (loops
slowly circulate) — implement the CPU updater (`LineBust.update(dt, values)`) here with flow only.
Screenshot vs reference: face-front orange striations, cyan silhouette.

### L3 — likeness in lines
Files: `lines/likenessMesh.ts` (+test), `lines/slice.ts` (accept extra polylines), `targets/index.ts`
(particles derive from the lifted mesh too), `targets/likeness.ts` (drop the in-place scalp lift,
keep donors/beard/glasses dust or remove glasses dust — decide: remove glasses dust once lines carry them).
Tests: lift raises only scalp verts (y > 0.55, non-face); glasses loops closed on the rim plane;
determinism. Screenshot: hair silhouette + glasses drawn as lines.

### L4 — vein spine + chest node
Files: `lines/veins.ts` (+test), `lines/VeinLines.ts`, `AvatarCanvas.tsx`.
Generator: `spineTree(rng)` from throat (0, 0.16, 0.30) to chest node (0, −0.25, 0.30): trunk with
3 generations of side branches (angle ±25–50°, length ×0.55, jitter), all points projected onto
z = 0.28..0.32 (in front of the torso lines); `chestNode(rng)`: 6 spokes (60° apart, length 0.09)
each with 2 sub-branches. Tests: connectivity (every branch starts on its parent), bounds, symmetry
of the node (|x| pairs), determinism. Material: dashed, dashSize 0.05, gapSize 0.03, offsetNode =
−time·0.5 (pulse travels downward), colour coreLineHot · (0.7 + 0.6·corePulse) · shade.

### L5 — dashed halo rings + spark plume + starfield
Files: `lines/HaloRings.ts` (replaces `sim/haloSystem.ts` + `targets/halo.ts` → delete, update
tests), `lines/Starfield.ts`, `sim/plumeSystem.ts`, `AvatarCanvas.tsx`.
Rings: 4 circles r 0.62/0.80/0.98/1.16 at z −0.62 (96 segments each), dashed with per-ring
dashSize/gapSize (0.06/0.04, 0.03/0.05, 0.08/0.08, 0.02/0.06), slow counter-rotating dashOffsets,
opacity 0.35–0.6 · shade. Plume: 1.5k sprites spawned in a cone above the crown (y 0.85 →
1.5), lifetime 2 s, upward drift + noise, emission ∝ 0.3 + treble; alpha fades with age.
Starfield: 5k points, z −3..−6, size 0.003, brightness hashed, static. Screenshot vs reference.

### L6 — mountain ridge veins
Files: `lines/veins.ts` (`ridgeVeins(waves heightfield)`), `lines/RidgeVeins.ts`, `targets/waves.ts`
(export the noise/ridge function so veins follow real crests), tests for crest-following (vein
points lie within 0.03 of the heightfield). Material: dashed pulses, sparse (6–8 veins), orange,
brightness gated by the existing flash envelope. Screenshot vs reference (lightning along ridges).

### L7 — HUD chrome
Files: `avatar/AvatarStage.tsx`, `avatar/Hud.tsx` (+e2e assertion in `avatar-demo.spec.ts`).
Top-right block, system mono stack (`ui-monospace, "Cascadia Mono", "JetBrains Mono", Menlo,
monospace`), 11–12 px, uppercase, letter-spacing 0.18em, cyan at 70 % opacity: `STATUS: LISTENING`
(state name), second line `ASSEMBLING… 56%` only while WAKING (Math.round(assemble·100) from the
store — expose `assemble` via the frame store write), small tick marks left of the text. Respect
`prefers-reduced-motion` (no blinking). E2E: after wake, HUD text equals `STATUS: LISTENING`.

### L8 — state behaviours on the lines
Files: `lines/LineBust.ts` (CPU updater), `lines/tsl.ts`, `sim/frame.ts` (expose what's missing).
Reveal: per-segment attr `xNorm`; opacity × smoothstep(xNorm·0.55 + jitter, +0.3, assemble) when
assemble > 0. Jaw: shared JS formula (mouth anchor, 9 rad/s, speak) applied to mouth-region
vertices — same constants as the kernel (extract to `sim/jaw.ts`, unit-test equality). Listen:
radial ripple from ear anchors (amp 0.01, decays 0.35). Thinking: rotate loops around the head
axis by vortex·(y−0.2)·0.35 rad, flow ×3. Offline: fray noise 0 → 0.06 over the freeze, tint →
palette.offline via colorNode mix on a `freeze`/offline uniform. Screenshots per state.

### L9 — Ali approval pass
Playground session over the seven states with the reference side by side; bake tuned constants;
record approval in STATUS gate history; open questions: longer WAKING for a slower assembly;
likeness v2.

## Exit gate
Side-by-side with the reference judged "professional" by Ali; perf CI green; phone 30 fps unchanged.
