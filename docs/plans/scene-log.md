# Scene plan — implementation log (avatar look v3, "Neural Bust")

Plan: `docs/plans/scene-plan.md` (Ali's `SCENE_PLAN.md`, 2026-09-06). Branch `b5-30-scene`,
built 2026-09-06 in a separate worktree (`C:\Users\USER\Dev\Kairos-scene`) so the parallel L9
session's checkout was never touched. One commit per phase (`scene: phase N — <name>`).

**How to look at it:** `pnpm dev` in `apps/web`, then `/bench/scene` (public bench page, like
`/bench/avatar`). Query params: `?phase=N` shows the scene as it was at the end of phase N,
`?only=bust,contours` / `?off=post,hud` isolate layers, `?webgl=1` forces the WebGL2 backend, and
`?set=contours.frequency:60,post.bloomThreshold:0.4,core.center:0|1.3|0.5` applies any
`sceneConfig` value for one page load — that is the per-property feedback loop from the plan
("apply exactly the change named, re-screenshot") without editing code. The checkbox bar at
the bottom-left toggles layers (each toggle reloads the page).

Screenshots (1280×800, headed Chrome on the RTX 5070, WebGPU): `docs/screens/`.

## Stack adaptation (the plan's "adapt the API but keep the phases, values and acceptance criteria")

The repo renders with `three/webgpu` + TSL (CLAUDE.md §4); drei, `@react-three/postprocessing`
and GLSL `ShaderMaterial` do not run on the WebGPU renderer, so:

| Plan | Here |
| --- | --- |
| drei `<Stars>` | instanced sprites inside the view cone (`gen/stars.ts`) |
| `shaderMaterial` (GLSL) | `MeshBasicNodeMaterial` with the same maths in TSL (`ContourMaterial.ts`) |
| drei `<Billboard>` + CanvasTexture gradient | three `Sprite` with the radial gradient computed in TSL |
| drei `<Line>` | `LineSegments2` + `Line2NodeMaterial` (fat lines, px width) |
| `lineBasicMaterial` (landscape) | `LineBasicNodeMaterial` (1 px), as planned |
| `<EffectComposer><Bloom/><Vignette/>` | three `RenderPipeline` + `BloomNode` + TSL vignette (`Effects.tsx`) |
| `simplex-noise` | the repo's seeded simplex (`avatar/sim/noise.ts`) — no new dependency |
| CSS gradient behind a transparent canvas | the same gradient drawn in-scene (`Background.tsx`, flag `background`) so bloom and the vignette composite over it; the container keeps the CSS gradient while the renderer boots |
| `toneMapping: ACESFilmic` + `toneMapped: false` on every material | tone mapping **off** (`flat`). three/webgpu tone-maps the whole frame once and ignores `material.toneMapped`; since the plan turns it off on every visible material, "off" is its actual intent and the palette hexes reach the screen as written |

No package was added. An adversarial design review (30 agents) of these adaptations ran before
coding; its confirmed findings that changed the build are listed under the phases below.

## Phase log

### Phase 0 — setup and baseline (`b2766d4`)
`apps/web/src/scene/` tree with `sceneConfig.ts` (the plan's constants verbatim + layer flags),
empty layer stubs in one R3F Canvas, `/bench/scene`, layer selection helper (4 tests), e2e smoke.
`docs/screens/00-baseline.png` = the current avatar (ultra, LISTENING) for comparison.

### Phase 1 — background, camera, stars (`076e67d`, follow-up `704ed5f`)
Look for: navy gradient (dark top → lighter bottom), ~400 faint 2 px stars, nothing else.
- Camera: position/fov from config, `lookAt` on mount.
- Stars are placed inside the camera's view cone, so `stars.count` is the on-screen count (drei
  scatters over a full sphere and only ~4 % land in view). `stars.size` is a world size (0.08 ≈
  2 px at 60 units).
- Follow-up: `flat` (see table) and renderer-factory guards (idempotent per canvas, no store write
  during the async init window — the ledger's canvas-isolation rule).

### Phase 2 — bust geometry (`fcd9506`)
Look for: clean symmetric silhouette, head in the upper part, shoulders to ±1.55, chest cut by the
frame bottom (`phase-2.png`).
- Source = the repo's bust mesh (`/avatar/bust.glb`, the plan's preferred GLB path), welded, scaled
  ×1.6 (head 1.2 units tall, centre at y 1.45), face front at z ≈ 0.5. The mesh's cropped upper
  arms had jagged boundary loops; `straightenArmCrops` pulls each onto one slanted line per side and
  the bottom crop is dragged below the frame (7 tests).
- The plan's primitive fallback is implemented and switchable (`bust.source = "primitives"`); next
  to the mesh it read as a pawn on a saucer, so the mesh is the default.
- **Flag for Ali:** the mesh carries a nose, lips, eye sockets and ears (no hair); the plan asked
  for no facial geometry. They show as small wiggles in the contour lines. Switching to
  `"primitives"` removes them (and the human proportions).

### Phase 3 — contour-line shader (`b0fb14f`)
Look for: continuous cyan slices across head, neck and shoulders with no offset at mesh
boundaries, dark navy fill between them, brighter silhouette edges (`phase-3.png`).
- Line-for-line TSL port of the plan's fragment shader; every value is a live uniform.
- `core.center` y 1.5 → **1.3**: the mesh's face (eyes ≈ 1.35, mouth ≈ 1.08) sits lower than a
  sphere's centre, so the tint is centred on the eyes/nose.
- `contours.frequency` 90 → **45** (decided in Phase 8, see there).
- Verified on the WebGL2 fallback too (`?webgl=1`).

### Phase 4 — face core glow (`00386a4`)
Look for: a small warm glow on the face, about a third of the head width, lines visible over it,
nothing yellow (`phase-4.png`).
- Sprite at `core.center` with z pushed to 0.72 (`core.glow.z`), just in front of the nose tip
  (0.61) so the depth test never clips it. Opacity and scale breathe on the same `time` expression
  as the shader tint.

### Phase 5 — neck circuitry (`e2550d0`)
Look for: six thin gold strands from under the jaw converging on one node at the sternum, with a
small spark cluster and six spokes (`phase-5.png`).
- Mesh-fitted values (plan: jawY 1.02 / controlY 0.75 / nodeY 0.42 for the sphere head): chin
  bottom ≈ 0.89 and sternum notch ≈ 0.12 → `jawY 0.95`, `nodeY 0.15`, `controlY 0.59`.
- Strands are not `transparent` (a transparent fat line costs a per-frame framebuffer copy); the
  plan's 0.9 opacity is folded into the colour. The cluster's `pointSize` 0.02 is in
  PointsMaterial units and converted to a sprite size with tan(fov/2) (review finding: a sprite of
  world size 0.02 would be 3.5× too large).

### Phase 6 — rings (`7fa8f72`)
Look for: nine thin, complete, smooth circles behind the head, even spacing, fading outward,
inner ring just outside the head (`phase-6.png`). RingGeometry annuli, 4× MSAA keeps them smooth.

### Phase 7 — landscape network (`7a5ba8a`)
Look for: wireframe ridges on both sides, peaks near neck height, denser toward the edges, blue
with gold edges along the ridge tops, nothing over the bust (`phase-7.png`).
- Exactly the plan's grid/noise/falloff/dropout/gold rules (3 tests). Points and 1 px lines as
  planned; `pointSize` converted like the neck cluster.
- Tuning note: the "top 10 % of edges by mean y" rule concentrates the gold on the single tallest
  ridge. If Ali wants gold spread along every crest, the rule would become per-column maxima —
  a plan change, not applied.

### Phase 8 — post-processing and HUD (`30d9142`)
Look for: lines, rings, strands and landscape glowing softly, fill and background not blooming,
corners darkened, `STATUS: LISTENING` top-right with a slow-pulsing dot (`phase-8.png`).
- Bloom keys are three-native: `bloomStrength` (three sums five mip blurs with weight total 3.0,
  so pmndrs intensity 1.3 ≈ 0.43), `bloomRadius` 0.8, `bloomThreshold`/`bloomSmoothing` port 1:1,
  `bloomResolutionScale` 1 (three's default 0.5 box-averages the thin lines under the threshold).
- Vignette: pmndrs' default technique, colour only with alpha pinned to 1 (otherwise a
  premultiplied canvas fades the corners to the page colour instead of darkening).
- **Tuning applied to meet the acceptance** (plan originals in config comments; the plan values
  are in `docs/screens/phase-8-alt-plan-values.png`): at frequency 90 the 0.7 px lines bloomed into
  a solid cyan haze and, on three's linear-luminance threshold, gold (0.54), rings (≤ 0.25) and the
  blue landscape (0.13) never crossed 0.55. `contours.frequency` 90 → 45, `bloomStrength` 0.43 →
  0.25, `bloomThreshold` 0.55 → 0.3. Everything is one `?set=` away from any other value.
- HUD: DOM, 11 px mono, 0.18 em, `palette.line` at 75 %, 6 px dot with a 2 s pulse (off under
  `prefers-reduced-motion`).

### Phase 9 — motion and performance (after Ali's Phase 8 approval, 2026-09-07)
Look for: the camera easing ±0.05 sideways over 12 s with the composition fixed, the gold ridge
edges shimmering, the rings breathing 3 % with a phase offset between them, a dashed pulse
travelling down two of the neck strands, the contour lines drifting up, the core breathing
(`docs/screens/feedback-1/phase-9.png` — a still; run `/bench/scene` for the motion).
- Everything is a uniform, scale or camera update in `useFrame`; nothing is allocated per frame
  (the shimmer is TSL `time`, no JS at all).
- Reduced motion: `motion.reducedMotion` "auto" follows the OS preference; "reduce"/"full"
  force it (`?set=motion.reducedMotion:reduce` shows the still scene). The HUD dot already
  honoured the media query in CSS.
- Performance: dpr ≤ 1.5 below 1000 px wide (≤ 2 above — the plan's `[1, 2]`), landscape
  columns halved below 768 px (verified: 600 px at dpr 3 → a 900×1350 canvas, p50 5 ms).
- Config: `sceneConfig.motion` (cameraDrift, goldShimmer, ringBreath, neckPulse) and
  `sceneConfig.perf`; helpers in `scene/motion.ts` (3 tests).

### Review follow-up (`da55fc1`)
A second adversarial review (plan-fidelity, quality, perf and correctness lenses, each finding
re-verified by a skeptic) ran on the finished branch. Applied: every remaining literal moved into
`sceneConfig` with the plan's value (landscape ridge octaves / falloff / row sink, star jitter and
tint, glow scale pulse, neck control factor, ring segments — so `?set=landscape.falloff:1.6|2.2`
now works as the plan's feedback example expects); the four palette colours became shader
uniforms; one shared sprite helper (`scene/tsl.ts`) replaced three copies; a frame-stats publish
that fired every frame once its window filled; explicit disposal of the post render targets; the
e2e now asserts scene frames, not the page's own loop. Visual output unchanged.

The correctness lens (re-run 2026-09-07 after a usage-limit failure) added: `?set=` overrides
are applied in the browser only (the bench page is also server-rendered, and a server-side
mutation of the config singleton would have leaked one request's overrides into the next);
`ready` waits for the bust mesh to be in the scene and a failed mesh load is reported as
`error`; the WebGPU renderer is disposed on unmount (deferred by a tick so React StrictMode's
dev double-mount keeps a live renderer); the `@/scene` barrel no longer re-exports the
client-only canvas; the e2e fails on page errors and, on CI, waits for 30 scene frames.

### CI backend (2026-09-07)
The page-error assertion turned the CI scene smoke red (147 errors: `Instance dropped in
popErrorScope` once per pipeline compiling, then a `createBuffer … mappedAtCreation` failure per
frame). Three throwaway bisect runs on GitHub's runner (34098121956, 34136858023, 34137480858)
showed the cause is the runner, not the scene: the SwiftShader WebGPU device is lost with reason
`destroyed` 40–140 ms after creation — no JavaScript `destroy()` call (traced with an init
script), every layer set including a lone background quad, with or without MSAA, headless shell
or new headless, with or without the explicit SwiftShader adapter flag, and `/bench/avatar`
too. No WebGPU frame has ever rendered on CI; WebGL2 renders there (ready in 4.5–7 s, ~10 fps).
Applied: the smoke runs `?webgl=1` on CI (elsewhere the page picks its backend), MSAA became
`sceneConfig.render.antialias` (`?set=render.antialias:false`), and a device lost by the browser
is reported as the scene's `error` (our own dispose stays silent). Not applied, for Ali: the
avatar's CI e2e and perf baseline measured the same dead device. Follow-up: Playwright runs one
worker on CI — SwiftShader is CPU-bound, and with two browsers the smoke fell to 3 fps while the
perf spec's p95 (compared with a baseline) drifted 16 % over it; the smoke now waits for frame
progress instead of asserting a rate after a fixed sleep.

## Feedback round 1 (Ali, 2026-09-07) — applied exactly, one commit and screenshot per phase

Screenshots: `docs/screens/feedback-1/phase-N.png` and `camera.png`.

- **Phase 2 — eyes.** Asked: hide every GLB node matching /eye|cornea|iris|teeth|tongue/; if
  baked in, say so first. Finding (reported before anything else): the GLB is one node, one
  mesh, one primitive (4934 vertices, no materials) — nothing to hide. Ali chose geometry.
  What the mesh actually has (measured): lids at canonical z ≈ 0.38 with an open slit between
  y 0.352 and 0.389, and an eyeball surface 0.13 behind it; the white almonds were the slit
  (edge-on lid ledges saturate the contour anti-aliasing, and the eyeball shows through).
  Smoothing cannot close a hole — a Taubin pass and a 150-iteration membrane both left the eyes
  untouched, and even collapsing the whole head kept them. Applied: `flattenCavity` fits a
  quadric to the outer skin inside the eye box, lays the lids onto it (feathered) and parks the
  eyeball 0.004 behind it, so the slit is a flush patch with edge-on walls
  (`bust.glb.cavities`, 2 tests). Ears untouched. A faint closed-lid trace remains at the eye
  corners; a wider box or more recess did not change it — flag for round 2 if it matters.
- **Phase 3.** `lineWidth` 0.10 → 0.05; `rimStrength` 0.6 → 0.9 (the shader literal is now a
  config key). Colour: line/fill/edge were already the exact hexes; the green cast came from
  the plan shader's ×1.8 line boost pushing #35C8FF past white — now `contours.lineBoost`, set
  to 0 so the line is exactly #35C8FF (bloom comes from the threshold alone).
- **Phase 5.** Chin bottom measured on the mesh at world y 0.70 (front profile at |x| < 0.05:
  nose tip 0.99, lips 0.86, chin 0.80, underside 0.70) → `jawY` 0.67; control point
  (0.6·x, midpoint y = 0.41); sternum node doubled (points 20, spread 0.06, spokes 0.10,
  point size 0.04).
- **Phase 6.** Count was already 9 and the outer radius 0.9 + 8·0.25 = 2.9; `opacityFrom`
  0.5 → 0.4, `opacityTo` 0.06 → 0.03.
- **Phase 7.** `amplitude` 1.6 → 1.0, ridge `lowScale` 0.55 → 0.35, `dropout` 0.35 → 0.55,
  `pointSize` 0.025 → 0.04, `pointOpacity` 0.9. The blue tiles bottom-left were the bench's
  layer checkbox bar: removed (layers stay switchable by query).
- **Phase 8.** Confirmed: the pipeline mounts with `layers.post`, tone mapping is off for the
  whole frame (`flat`) which is what `toneMapped=false` on every material achieves. Intensity
  1.6 → three strength 0.533 (÷ 3.0 mip weight), threshold 0.4.
- **Camera.** z 5.5 → 6.0.

## Feedback round 2 (Ali, 2026-09-07) — applied exactly, one commit and screenshot per item

Screenshots: `docs/screens/feedback-2/`.

1. **Framing.** Fixed horizontal FOV: `camera.hfov` 54 replaces `fov` 32; the vertical fov is
   re-derived on every resize, fov = 2·atan(tan(27°)/aspect) (32.0° at 16:9, so round-1
   framing at z 6.0 is unchanged). The sprite-size conversions and the star cone read the
   derived fov at build. `item-1-16x9.png` and `item-1-half.png`: the landscape is visible in
   both. Side effect to know: at half width the taller vertical fov shows the bust's bottom
   edge (skirtTo −1.6); one config value if it should stay below the frame.
2. **Phase 7.** `baseY` −0.6 → −0.2, `amplitude` 1.0 → 1.4. Gold: the plan's "top 10 % by y" is
   replaced — 10 % of the kept edges are drawn without replacement with probability
   ∝ (normalized height)², from the same seeded rng (deterministic); gold now scatters across
   the peaks on both sides. `item-2.png`.
3. **Phase 5.** `controlXFactor` 0.6 → 1.3 (bow outward along the neck), `controlY` stays at the
   midpoint, `jawXs` × 0.75. `item-3.png`.
4. Eyes (closed-lid trace) and rings: left as they are, per Ali.

Decisions recorded from this round: the scene stays on the bench until round 2 is approved and
#29 merges; wiring the seven avatar states is its own PR afterwards; the scene replaces look v2
(no v2 approval pass; `/dev/avatar` goes when the states PR lands); the phone gate is Ali's
later, not blocking; the CI WebGL2 re-baseline is a separate PR after #29; B5 close-out and
Track A wait. Process: Phase 9 shipped ahead of Phase 8's approval — kept, but every next phase
now waits for approval.

## Feedback round 3 (Ali, 2026-09-07) — Phase 7 rebuilt as a heightfield

Screenshots: `docs/screens/feedback-3/phase-7-16x9.png`, `phase-7-half.png`.

- Grid per side 36 × 14 (zStart −0.5, zStep −0.35). Height is two octaves of the seeded noise
  sampled continuously over world (x, z), never per row index:
  h = noise2D(x·0.35, z·0.35)·0.7 + noise2D(x·0.9, z·0.9)·0.25.
- y = baseY + (zStart − z)·slope + max(h, 0)·amplitude·falloff(|x|) with baseY −1.2, slope 0.2,
  amplitude 1.4: the far rows are the peaks (about neck height), the near rows drop below the
  frame. Dropout 0.55, the height² gold sampling and the |x| falloff are unchanged.
- Bottom fade: every vertex carries smoothstep(fade[0], fade[1], y) (config `fade`
  [−1.2, −0.4]) multiplied into the line and point opacities, so the surface fades out at the
  bottom instead of ending on a line (a `fade` attribute on the lines, a per-point opacity on
  the sprites). 5 generator tests incl. "a vertex's height does not depend on the row count".
- Bust `skirtTo` −1.6 → −3.0 (the bottom edge never shows at any aspect); face core `radius`
  0.35 → 0.42 (the optional single value).
- Check at 16:9 and half width: no vertical spikes, no flat bottom line, peaks around neck
  height, terrain sloping toward the viewer on both sides.

## Phase 10 (Ali, 2026-09-07) — particle pass

PR #29 was already merged when this arrived, so Phase 10 is its own branch/PR (`b5-31-particles`).
Same scene, different rendering per layer: the reference is built from glowing particles
(nodes) with short thin edges. One commit + screenshot per item, `docs/screens/phase-10/`.

Shared: every point layer draws one soft sprite — a radial-gradient disc (`softDisc()` in
`tsl.ts`: 1 − clamp(length(uv − 0.5)·2, 0, 1), the TSL equivalent of Ali's 64 px canvas
radial gradient, so no texture upload and it runs on both backends), transparent, depth writes
off, additive, size-attenuated, never tone mapped, per-point sizes where they vary. Ali's point
sizes are starting values ("keep the ratios, tune the scale"): `particles.sizeScale` (3)
multiplies all of them — at 1× the landscape nodes were ~2 px at this depth and the edges
dominated.

1. **10.1 Landscape → plexus network.** `10-1.png`. Nodes: the round-3 heightfield positions
   (cols 36 → 42 so 43 × 14 = 602 nodes per side ≈ Ali's ~600) jittered ±0.06 in x/z, the height
   sampled at the jittered (x, z) so nodes sit on the surface. Edges: the grid rule and the
   dropout are gone; each node links to its k ∈ {2, 3} nearest neighbours on its side, max
   length 0.35, undirected pairs deduplicated — long edges cannot exist. Nodes 0.03–0.07
   (×sizeScale) at opacity 0.9, edges 0.25. Gold: the 12 % highest nodes (probability ∝
   height², without replacement) at 1.5× size; an edge with two gold endpoints is gold (keeps
   `goldOpacity` + the Phase 9 shimmer). Sprinkle: 300 tiny points per side (0.015, opacity 0.5)
   within 0.15 of a height²-weighted node, no edges. Because the row spacing (0.35) equals the
   max edge length, edges chain along the ridges: beaded ridge lines, as accepted. 8 generator
   tests.

2. **10.2 Bust particle shell.** `10-2.png`. `MeshSurfaceSampler` over the bust mesh
   (`gen/shell.ts`, seeded): 25,000 soft sprites with the sampled normals, pushed 0.01–0.04 off
   the skin, sizes 0.01–0.025 (×sizeScale). Alpha = 0.15 + 0.85·fresnel with the contour
   shader's own fresnel per particle (sampled normal · view direction, `fresnelPower`), so the
   cloud is bright where the surface turns away and nearly invisible over the face; colour is
   the line colour tinted toward the core colour by the contour shader's core falloff (no pulse
   — a pulsing mist would flicker). Depth-tested against the opaque bust, drawn after it. New
   layer `shell` (phase 10; `?off=shell`). The contour mesh is unchanged. 5 sampler tests.
   @types/three 0.185.4 lacks `setRandomGenerator` on the sampler (runtime has it since r150):
   typed by intersection, commented.

3. **10.3 Beaded contour lines.** `10-3-on.png` / `10-3-off.png`. In the contour shader:
   bead = 0.5 + 0.5·sin(worldX·140 + floor(coord)·1.7); line ×= mix(0.35, 1,
   smoothstep(0.2, 0.8, bead)). `contours.beads` {enabled, frequency 140, min 0.35}; the
   toggle is a float uniform, so `?set=contours.beads.enabled:false` restores the plain line
   exactly. Strings of dots up close, continuous from a distance; the face still reads.

4. **10.4 Rings + neck.** `10-4.png`. Rings: the annuli at ×0.6 (`rings.geometryOpacity`),
   250 soft sprites per ring along the circle with ±0.03 radial jitter (size 0.02, opacity
   fading with the ring; children of each ring mesh so the Phase 9 breathing carries them), and
   ~400 faint drifting points in a 3.5-unit disc around the head (`rings.drift`: the shared
   sprite with a per-point sine wander on TSL time — the drei Sparkles equivalent on WebGPU;
   still under reduced motion; depth-tested so the bust occludes them). Neck: 60 gold beads per
   strand (0.02–0.03) over the fat line, whose folded-in opacity drops 0.9 → 0.3; the sternum
   node is a 40-point cluster with one bright core sprite (`neck.node.core`). Generator tests
   for ring/drift points and strand beads.

Not touched, per Ali: camera, colours, bloom, HUD. Frame time with every layer on stayed at the
display cap (p50 5.0 ms / p95 ≤ 7.6 ms on the RTX 5070 during the screenshots).

## Phase 11 (Ali, 2026-09-07) — density pass

Still on PR #30, not merged until Ali approves the 11.4 screenshot. Ali's verdict on Phase 10:
structure right, particle counts ~10× too low, and `particles.sizeScale` 3 hid it. Global:
sizeScale 3 → 1.5 — "density makes the glow, not point size". Budget: total points under
~150k, one object per sub-layer, no per-frame allocations; p50 frame time reported after 11.4.
One commit + screenshot per item, `docs/screens/phase-11/`.

1. **11.1 Landscape.** `11-1.png`. Grid 36 × 14 → 160 × 40 per side (12,880 nodes, jitter
   kept; `zStep` −0.1167 keeps the z range), k-nearest edges max 0.35 → 0.12 at opacity 0.12
   (the kNN moved to a grid hash: 110 ms for both sides), node size ÷2, gold 12 % → 8 %,
   amplitude 2.0 × (0.5 + 0.5·smoothstep(1.2, 4.0, |x|)) replacing the old |x| falloff so the
   ridges rise to head height at the frame edges, bottom fade only in y −0.75..−0.45 (nothing
   else fades), dust 300 → 4,000 per side within 0.25 of the surface (uniform over nodes; size
   0.01, alpha 0.4). One value Ali did not name: `baseY` −1.2 → −0.7 — with the new fade window
   the near 30 rows were fully transparent and the sides still emptied below the shoulders;
   the base now sits at the frame's bottom edge and the slope fills each side. Observation for
   Ali: nodes with h ≤ 0 sit on the base plane, so the grid's far edge shows as a faint
   straight horizon at the plateau level; letting negative h dip (a valley term) would break
   it if wanted.

   Frame-time note: this Chrome session's rAF is capped at 60 Hz (16.7 ms p50 even with only
   background + stars; the display reports 200 Hz), so p50 is measured with vsync off from
   here on: full scene 0.8 ms p50 / 1.5 ms p95 after 11.1.

2. **11.2 Bust shell + line contrast.** `11-2.png`. Shell 25k → 80k points, size ×0.5,
   alpha = 0.03 + 0.6·fresnel (`alphaMin` / new `alphaRim`; was 0.15 + 0.85): a soft mist at
   the silhouette, no visible dots; tint static, no pulse (agreed). Fill #041634 → #020C22,
   lineWidth 0.05 → 0.04. Sampling 80k points: ~20 ms. Full scene 0.8 ms p50 (vsync off).

3. **11.3 Neck circuitry → branching.** `11-3.png`. Each strand grows 2–3 sub-branches
   (`neck.branches`): short beziers 0.12–0.3 long leaving at 30–70 % of the strand, rotated
   0.5–1.1 rad outward/down from the tangent, lifted onto the neck cylinder like the strands, a
   bright bead (`endBead`) at every branch point and tip. Beads per strand 60 → 120 with random
   brightness 0.5–1.0, bead size ×0.7, the fat line's folded-in opacity 0.3 → 0.15. 16
   branches, 1,457 neck sprites in 5 instanced draws. Note: the outermost branch tips pass the
   neck radius and flatten onto the shoulders (the cylinder lift clamps at |x| ≥ 0.2).

4. **11.4 Global dust + crown plume.** `11-4.png`. New layer `dust` (phase 11): 2,500
   drifting points in a 6 × 4 × 3 box around the bust (size 0.01, alpha 0.35, the Phase 10
   drift on TSL time; the old 400-point disc left `Rings`), and the crown plume — 1,500 points
   in a cone above the head (base radius 0.25 at the crown y 2.09, top radius 0.1, rising 1.2
   units over 6 s with per-particle speed jitter and a small wobble), alpha = smoothstep(0,
   0.08, t)·(1 − t) so particles fade in at the base and out with height, respawn by `fract`.
   No per-frame JS; frozen at the seeded phases under reduced motion.

Budget after 11.4 (sprites): landscape 20,880 (12,880 nodes + 8,000 dust) · shell 80,000 ·
neck 1,457 · ring beads 2,250 · dust 2,500 · plume 1,500 · stars 400 = **108,987** (< 150k).
Objects per layer: landscape 5 (blue/gold nodes, dust, blue/gold edges), shell 1, neck 6
(solid + pulse fat lines, strand/branch/end beads, cluster + core), rings 9 annuli + 9 bead
sprites (children, so they breathe), dust 2. Frame time on the RTX 5070 at 1280 × 720, vsync
off: **p50 0.6 ms**, p95 6.1 ms (rAF under the 60 Hz cap of this Chrome session: 16.7 ms).
WebGL2 fallback renders the same picture with no page errors.

CI after 11.4 (run 34157122820): the scene smoke booted and kept rendering on the runner's
software WebGL2, but its CI-only wait for 30 sampled frames timed out — SwiftShader cannot push
~109k additive sprites through 30 frames in 60 s. The full-scene test keeps the "keeps
rendering" progress check; the frame-stats check moved to the light phase-1 page, where it still
proves the stats window publishes. Verified locally with `CI=1` on a production build.

## Phase 12 (Ali, 2026-09-08) — glow & emphasis pass

Still on PR #30, not merged until Ali approves the 12.7 screenshot. Structure approved; this
round is brightness, contrast and count. Budget ~300k points on desktop, every count halved on
mobile; p50 reported after 12.7. One commit + screenshot per item, `docs/screens/phase-12/`.

1. **12.1 Bloom & contrast.** `12-1.png`. HDR buffer explicit: `pass(scene, camera, { type:
   HalfFloatType })` AND `WebGPURenderer({ outputBufferType: HalfFloatType })` — PassNode
   defaults to half-float but `setup()` overwrites the pass texture type with the renderer's
   output buffer type on every build, so the renderer option is the one that sticks; BloomNode's
   own targets are hard-coded half-float. Bloom strength 0.533 → 0.733 (intensity 2.2 ÷ 3),
   threshold 0.4 → 0.3, radius 0.8 → 1.0: BloomNode's radius is a 0..1 mix over the mip
   weights that mirrors completely at 1, so Ali's ×1.3 (1.04) would only extrapolate 4 %
   outside the documented range — set to the maximum instead. Fill #020C22 → #010818, edge
   #9BE9FF → #C8F4FF, line multiplier 1.0 → 1.4 (`lineBoost` 0.4). No tone mapping; > 1 values
   survive to bloom and clip only when written to the 8-bit canvas. Screenshot: lines and
   particles glow, dark stays dark, the line cores read pale cyan-white (no green cast).

2. **12.2 Landscape ridge lines.** `12-2.png`. Crest nodes = per column the top 15 % by
   height (`landscape.crest`): size ×1.6, colour ×2, crest–crest edges colour ×2 — colour
   multipliers, never opacity > 1, so they feed bloom on the half-float buffer (per-point
   `brightness` on the shared sprite, a `brightness` attribute on the edge lines). Grid 160 × 40
   → 200 × 60 per side (12,060 nodes ≈ Ali's 12,000; `zStep` −0.0771 keeps the z range), edge
   alpha 0.12 → 0.10. Gold = 50 % of the crest nodes (replaces the height² 8 % draw; the
   generation dropped from ~1 s to 112 ms), plus 1,500 gold dust per side within 0.1 of a crest
   node. Counts: 24,120 nodes (3,618 crest, 1,809 gold), 38,911 edges, 8,000 dust, 3,000 gold
   dust.

3. **12.3 Silhouette halo.** `12-3.png`. `BustHalo.ts`: the same bust geometry drawn again
   at scale 1.015 about its bounding-box centre (a scale about the origin would lift the crown
   and widen the shoulders unevenly), back faces only, additive, no depth writes, #9BE9FF,
   alpha = pow(1 − |n·v|, 2)·0.9 (abs, because back-face normals point away from the camera).
   New layer `halo` (phase 12; `?off=halo`). Shell 80k → 120k, `alphaRim` 0.6 → 0.9, base
   0.03. The outline is now the brightest element with a soft halo.

4. **12.4 Face core.** `12-4.png`. `core.radius` 0.42 → 0.5; the glow sprite's "opacity
   ×1.5" applied as a colour multiplier (`core.glow.brightness` 1.5 — opacity caps at 1, the
   half-float buffer carries the rest into bloom); lines inside the inner 40 % of the core
   (`core.hot.radius`) mix toward `palette.coreHot` #FFE2B0, so the centre reads white-hot and
   the edge orange; the fill tint stays orange. The shell's warm tint shares `core.radius` and
   widens with it.

5. **12.5 Rings → particle rings.** `12-5.png`. Beads per ring 250 → 1,500 with
   noise-driven density: angles are rejection-sampled with probability floor + (1 − floor)·
   (0.5 + 0.5·noise(cos θ·3, sin θ·3, ring)) — sampled on the unit circle so there is no seam
   at 2π (`rings.points.density`); bead brightness 0.5–1.2 as a colour multiplier; the annuli
   at ×0.4 (`geometryOpacity` 0.24), a faint guide line under the beads. 13,500 beads,
   acceptance ratio 0.56, per-ring max/min bin density 2–3.9×.

6. **12.6 Neck + sternum nucleus.** `12-6.png`. Two extra strands per side (`jawXs` now ten,
   out to ±0.27) on a 0.3 lift cylinder (`neck.cylinderRadius`: the mesh neck is wider than the
   primitives' 0.2, so the outer strands still wrap instead of flattening behind the surface);
   sub-branches grow sub-branches (`branches.depth` 2, `branches.sub`: 1–2 per branch at 40–80
   %, half the parent length, same lift/beads/end beads; depth 1 reproduces Phase 11.3 exactly);
   bead brightness ×1.3 as a colour multiplier (0.65–1.3). The sternum node became a nucleus
   (`neck.nucleus`): 300 points in a 0.08 disc, blue-white `palette.edge` inside 0.05 at ×2.5,
   gold ring outside at ×1.6 (a `colorMix` option on the shared sprite), plus the ×3 core
   sprite; the strands still end in it. 23 + 35 branches, 3,414 neck sprites in 7 draws.

7. **12.7 Ambient.** `12-7.png`. Dust 2,500 → 8,000 with size variance ×3 (`sizeJitter`
   [0.2, 2.2] — the ±0.4 spread becomes ±1.2, clamped so no sprite vanishes); crown plume
   1,500 → 5,000, base radius 0.35, height 1.6, colour ×1.5 (`plume.brightness`). Mobile:
   every count is halved below `perf.mobileWidth` through one helper (`sceneCount` /
   `mobileCount`; `perf.mobileColsFactor` became `mobileCountFactor`) — landscape columns and
   dust, shell, ring beads, neck beads + nucleus, dust, plume, stars — passed to the generators
   as config overrides, never by mutating `sceneConfig`.

Budget after 12.7 (`pointBudget()` in `motion.ts`, branch beads excluded as rng-dependent):
desktop **183,521** sprites (landscape 35,120 · shell 120,000 · rings 13,500 · neck 1,501 ·
dust 8,000 · plume 5,000 · stars 400), mobile 91,821 — under Ali's ~300k. Frame time on the
RTX 5070 at 1280 × 720, vsync off: **p50 0.8 ms**, p95 1.3 ms (400 × 800 mobile-width
window: 0.7 / 1.1 ms). WebGL2 fallback renders the same picture, no page errors.

## Phase 13 (Ali, 2026-09-08) — final balance pass

Still on PR #30, not merged until Ali approves the 13.3 screenshot. One commit + screenshot
per item, `docs/screens/phase-13/`. p50 at 1080p and at 1.5× dpr reported after 13.3; if p50
> 12 ms the 13.2/13.3 counts drop 30 %.

1. **13.1 Bust contrast (reduce).** `13-1.png`. Line multiplier 1.4 → 1.0 (`lineBoost` 0,
   bust only — particle brightnesses stay), lineWidth 0.04 → 0.03, halo alpha 0.9 → 0.45,
   shell rim alpha 0.9 → 1.0 (the outline glow comes from particles, the halo mesh backs it),
   core white-hot mix 40 % → 25 % of the radius. Dark navy between the lines again, orange core.

2. **13.2 Mountain slopes → particle mass.** `13-2.png`. Edge alpha 0.10 → 0.05; slope dust
   4,000 → 15,000 per side, size 0.008–0.015 per point, alpha 0.35, anchors drawn ∝ normalised
   height (prefix sums + binary search, ε 1e-3 so the lowest rows are not empty: the higher
   half of the nodes holds 71 % of the dust); nodes 200 × 60 → 230 × 70 per side (16,170;
   `zStep` −0.06594 keeps the z range). Crest gold unchanged. 65,340 landscape sprites, 189 ms
   to generate; desktop budget 213,741.

3. **13.3 Ambient around the head.** `13-3.png`. Dust 8,000 → 20,000 with density falling off
   from the head centre (`dust.ambient.focus`: a box candidate at distance d is kept with
   probability 1 / (1 + (d / falloff)²), falloff 1; rejection sampling, acceptance 0.21, the
   0–0.5 shell 5.9× denser than the 2–3 shell) — misty inside the rings, sparse corners. Crown
   plume 5,000 → 7,500, same cone.

Budget after 13.3 (`pointBudget()`): desktop **228,241** sprites (landscape 65,340 · shell
120,000 · rings 13,500 · neck 1,501 · dust 20,000 · plume 7,500 · stars 400), mobile 114,191.
Frame time on the RTX 5070, vsync off, every layer on: **1920 × 1080 at dpr 1: p50 0.8 ms /
p95 1.1 ms; at dpr 1.5: p50 1.2 ms / p95 1.4 ms** — far under Ali's 12 ms bar, so the 13.2 /
13.3 counts stay. (This Chrome session's rAF is capped at 60 Hz; with vsync on every
measurement reads 16.7 ms regardless of content.)

## Phase 14 (Ali, 2026-09-08) — bust interior, last look round

Still on PR #30; Ali gives the merge after 14.2. One commit + screenshot per item,
`docs/screens/phase-14/`. Particle density is approved at the scale of the Phase 13.3
screenshot (desktop counts, scale 1): locked as the default (`particles.countScale`), and the
bench's `?set=` overrides no longer apply in production builds.

1. **14.1 Selective bloom.** `14-1.png`. Ali wrote it in pmndrs terms (Selection/Select +
   SelectiveBloom), which cannot run on the WebGPU renderer (GLSL passes; CLAUDE.md §4). The
   equivalent with three's MRT: the scene pass gets a second half-float attachment `bloomSrc`
   that every material fills with its colour by default (a material's `mrtNode` merges with the
   pass's — NodeMaterial.js:572 / MRTNode.js:151); the bust contour material writes black into
   it and `bloom()` reads that attachment with the same strength/radius/threshold. One finding
   from the sources: extra MRT attachments default to NO blending per target
   (WebGPUPipelineUtils.js:147, WebGLState.js:297), so without an explicit
   `setBlendMode("bloomSrc", MaterialBlending)` every additive sprite would have overwritten the
   bloom source instead of adding into it. `post.selectiveBloom` toggles the whole path. Gaps
   between the contour lines are dark navy on the head sides, neck and shoulders; the glow
   comes from the outline, core and neck. WebGL2 fallback renders it too.

2. **14.2 Line texture.** `14-2.png`. Contour frequency "90 → 75" in the plan's units: the
   plan's 90 is this config's 45 (Phase 3 note), so the same ratio, 45 → 37.5; bead floor
   0.35 → 0.6; shell base alpha 0.03 → 0. Crisp fine lines, dark between them, the silhouette
   still particle-lit.

Density lock: the approved counts are `particles.countScale` 1, applied by `sceneCount` and
`pointBudget` before the mobile halving (`scaledCount`); the bench's `?set=` overrides are
ignored in production builds (`NODE_ENV`), the layer params stay for CI's smoke and the
fallback probe. Frame time at that scale, 1920 × 1080, dpr 1, vsync off: **p50 0.8 ms**,
p95 1.1 ms. Desktop budget unchanged at 228,241 sprites.

## Seven-state wiring (Ali, 2026-09-08) — follow-up PR 1, branch `b5-32-states`

Step A: the state table — names, order and triggers from look v2's machine
(`packages/shared/src/avatar.ts`, `avatar/state/machine.ts`; timings `packages/config/src/avatar.ts`),
every state a delta from LISTENING (frozen as merged) on existing knobs only: core colour /
intensity / pulse, ring breathing, plume fraction / speed, neck pulse speed / brightness, contour
scroll, mountain gold brightness, dust drift, HUD text + dot. Approved with three changes: IDLE
core ×0.45 in dim amber #C97F3A with 6 s ring breathing ("warm but resting" vs LISTENING "lit");
DORMANT → OFFLINE uses the normal OFFLINE-in transition; OFFLINE keeps its 0.5 s alarm flicker
but is a steady red core under reduced motion. The three v2 gaps (speech-end, failure/recovery,
LISTENING → IDLE decay) stay out — listed in STATUS under "Brain integration follow-ups".

Step B: `scene/states.ts` — a pure `SceneStateEngine` (tween ≤ 600 ms ease-in-out cubic; WAKING a
1.2 s one-shot sequence; OFFLINE a 400 ms freeze then 600 ms; SPEAKING adds `energy.mid`; reduced
motion = instant, no flicker) → `stateUniforms.ts` (accumulated phases so a rate change never
jumps: `pulsePhase`, `scrollOffset`, `plumeClock`) → `SceneStateDriver` (one `useFrame`, no
allocations) → the layers multiply their config values by the uniforms (identity = the merged
look). HUD follows `useAvatarStore.state`. Bench: `?state=NAME`, Space / arrows cycle, `?demo=1`
auto-cycles DORMANT → WAKING → LISTENING → THINKING → SPEAKING → IDLE → OFFLINE → IDLE at 5 s,
`?hold=<s>` pins the clock for stills. Stills in `docs/screens/states/`, one commit per state.

Stills (`docs/screens/states/`, one commit per state, `?state=NAME` on the bench):
- `listening.png` — the identity row; pixel-matched against main with motion off (max delta 16/255).
- `dormant.png` — deep blue core at ×0.3, 6 s pulse, breathing/scroll/neck pulse off, plume 20 %.
- `idle.png` — dim amber #C97F3A at ×0.45 (Ali's change: "warm but resting"), 4 s pulse, 6 s breath.
- `waking.png` (`&hold=0.5`) — mid-flare: white-hot ×2 at 0.6 s, HUD `ASSEMBLING… 42%`; every rate
  high for the 1.2 s (contour scroll ×6 = the reveal sweep), then the 600 ms LISTENING settle.
- `thinking.png` — amber #FFB347 ×1.3, 1.2 s throb at double amplitude (the still caught a trough).
- `speaking.png` — hot #FF7A1A ×1.2; on the bench energy is 0 unless `?demo=1` feeds the synthetic
  phrases (the probe read core intensity 2.0 mid-phrase).
- `offline.png` (`&hold=1.6`) — after the 400 ms freeze and 600 ms tween: red #FF4D4D ×0.5 with
  the 0.5 s alarm; steady red under reduced motion because the driver never advances the phase.

Two caps against Ali's table: WAKING's plume ×1.5 and SPEAKING's ×1.3 are clamped to the built
count (the plume is built at LISTENING's 7,500 and shown as a fraction); the rest is verbatim.
Reduced motion keeps the pulse amplitude and freezes the phase, so the still core stays at the
merged 1 − pulseAmount instead of brightening.

Verification (2026-09-09): unit tests 234 (20 engine tests), typecheck, lint (the known warning),
prettier; production build + the scene smoke in CI mode 3/3 (boot + keeps rendering, layer params,
`?state=OFFLINE` HUD); `?demo=1` probed for 42 s on the dev server: DORMANT → WAKING → LISTENING →
THINKING → SPEAKING → IDLE → OFFLINE → IDLE → (loop) at 5 s per state, no page errors.

## Follow-up 3 (Ali, 2026-09-09) — look v2 removed, the owner home is the scene

Branch `b5-34-scene-home`. The owner home (`apps/web/src/app/(owner)/page.tsx`) now renders
`scene/SceneStage.tsx`: the Neural Bust canvas with its own HUD as the status readout, the two-line
transcript ribbon, the chat drawer that runs demo turns until the Brain arrives (Phase A2), and
click-to-wake on the canvas wrapper (WAKE; barge-in while SPEAKING; the 350 ms wake cue). The stage
keeps the canvas-isolation shape (memoized canvas layer, stable callbacks, a memoized `layers`
prop) and `useAvatarState` keeps owning the timed transitions. `/bench/scene?stage=1` shows the same
component without signing in; `&demo=1` there runs one demo turn on ready (the B5.7 e2e).

Removed: the look v2 renderer (`AvatarCanvas`, `AvatarStage`, `StatusRing`, the avatar `Hud`,
`lines/`, `post/`, the particle `sim/`), `tier.ts`, `/dev/avatar` (Leva playground), `/bench/avatar`
and the `leva` dependency. Kept: what the scene imports (`sim/{random,noise,bust,sampler}`,
`telemetry/frametime`, `state/{store,machine}`, `audio/{energy,synth}`) and what the brain hookup
needs (`useAvatarState`, `demo/driver`, `audio/cue`, the mic path `audio/{analyser,energyMode,
useEnergyInput}`). The avatar store shrank to state / since / log / energy / assemble.

CI: the perf gate moves from the avatar bench to `/bench/scene` (every layer, LISTENING — the
shipped profile, recorded in the baseline's new `profile` field), sampling 30 rendered frames;
`tests/perf/baseline.ci.json` re-recorded on the runner. The avatar smoke and demo specs are
replaced by `tests/e2e/stage-demo.spec.ts` (demo turn WAKING → THINKING → SPEAKING → IDLE with the
ribbon and the scene HUD; click-to-wake DORMANT → WAKING → LISTENING) on the light
`only=background,hud` layer set. Playwright's readiness probe moved to the scene bench.

Stills (`docs/screens/follow-up-3/`, the stage on the bench at 1600×900): `home-dormant.png` (the
home as it opens: DORMANT, the wake hint in the ribbon, chat toggle top-left, HUD top-right) and
`home-after-demo-turn.png` (after `?demo=1`: the reply in the ribbon, STATUS: IDLE, dim amber core).

## Verification (2026-09-06)
`pnpm format:check`, `pnpm lint`, `pnpm typecheck`, unit tests (27 new in `src/scene`), e2e 5/5 on a
production build (avatar smoke + demo, scene smoke incl. HUD) on WebGPU; WebGL2 fallback boot
checked by screenshot. Frame time on the RTX 5070 with every layer on: p50 5.0 ms / p95 5.2 ms
(the display's 200 Hz cap; the scene is nowhere near the budget). Phone: not measured (needs the
LAN firewall rules, see STATUS).

## Open questions for Ali
1. Bust: keep the mesh (human, with nose/ears) or the plan's smooth primitives (`bust.source`)?
2. Line density: 45 (default) vs the plan's 90 — `?set=contours.frequency:90`.
3. Bloom: strength 0.25 / threshold 0.3 vs the plan's 0.43 / 0.55 (alt screenshot).
4. Gold ridge edges: single tallest ridge (plan rule) or spread per crest?
5. Where to mount it: `/bench/scene` and the playground only for now; swapping the owner home's
   avatar to this scene means giving it the seven states (the plan is a static LISTENING look).

## Brain-integration dispatches (2026-09-09) — branch `b5-35-brain-dispatch`

The three gaps STATUS listed under "Brain integration follow-ups" — the seven-state table has the
edges, nothing dispatched them. All three are local stand-ins with the same shape the brain hookup
(Phase A2) will keep; none of them changes the scene or the canvas.

**SPEECH_END (LISTENING → THINKING).** `avatar/audio/speechEnd.ts` is a pure `SpeechEndDetector`
over the smoothed mic `energy.mid`: `mid >= SPEECH_END.threshold` for `minSpeechS` confirms an
utterance, then `mid < threshold` for `silenceS` ends it, returning true exactly once. Values
(`packages/config/src/avatar.ts`): threshold 0.08, minSpeechS 0.3, silenceS 0.8. Why those: docs/06
§4 feeds LISTENING from the mic's band energy and docs/07-voice-spec.md §1 asks for a 300 ms VAD
confirmation of speech after the wake phrase, so the confirm window reuses that number; 0.08 sits
above the analyser's room-tone floor on the smoothed 0..1 mid band, and 0.8 s of silence is the
usual end-of-turn pause without cutting into a mid-sentence breath. `useSpeechEnd` runs it from
`useAvatarStore.subscribe` — not the selector hook — because energy lands every animation frame and
a hook would re-render the stage, and with it the canvas's parent, 60 times a second; the detector
is reset whenever the Avatar leaves LISTENING.

**The mic.** `SceneStage` now calls `useEnergyInput(state === "LISTENING" ? "mic" : "none", null)`:
open only while the Avatar is listening, never in DORMANT and never mid-turn. `useEnergyInput` was
hardened for that — a failed `setup()` (getUserMedia denied, no capture device, no `AudioContext`)
is caught, warned about once per page and left at ZERO energy instead of becoming an unhandled
rejection, and a device that finishes opening after teardown is handed straight back. Without that
the e2e (headless Chromium, no microphone, run fails on any page error) would go red the moment a
click-to-wake reached LISTENING.

**FAILURE / RECOVER (OFFLINE).** docs/03 §7: a brain whose Reasoner is unavailable puts the UI in
OFFLINE. The brain has no CORS middleware, so the browser cannot call its `/health` — the poll goes
through a new Next route handler, `app/api/health/route.ts` (`force-dynamic`), which probes
`BRAIN_URL/health` server-side with `cache: "no-store"` and a 3 s `AbortSignal.timeout`, and answers
`{ configured, ok }` — never the URL itself. The fetch is `lib/health/probe.ts`'s
`probeBrain(fetchImpl, url)` so it is unit-testable with a fake fetch (ok body / non-200 / wrong
body / non-JSON / refused / aborted). `useBrainHealth` polls it every `HEALTH_POLL.intervalS` (15 s,
first poll immediate), skips a poll while `document.hidden` (a throttled background tab is not
evidence that the brain is down), stops for the page's life when the route says `configured: false`,
and feeds `HealthTracker`: FAILURE once after 2 consecutive bad probes, RECOVER on the first good
one afterwards. Two, not one, so a single dropped request cannot dissolve the Avatar. Everything
lives in refs — a poll never re-renders the stage. Only a *parsed* answer moves the tracker: the
auth proxy's redirect to `/login`, a 500 or an offline page say something about the web app, not
about the brain, and must not force OFFLINE.

**LISTENING → IDLE.** `avatar/state/timers.ts` (`timedEventFor`) now holds all three timed edges of
docs/06 §3 as data — WAKING → WAKE_DONE (1.2 s), IDLE → INACTIVITY (90 s) and the new LISTENING →
INACTIVITY (`LISTENING_TIMEOUT_S` = 30 s). `useAvatarState` reads the table and keeps its one
non-table rule unchanged: a THINK arriving during DORMANT/WAKING is queued and re-dispatched when
the wake completes.

Deviations / notes: `/api/health` deliberately sits behind the auth proxy like every other
non-public path, so on the public bench (`/bench/scene?stage=1`) and in the e2e the poll is
redirected to `/login`; the client ignores that unreadable answer, and the server logs one
"NEXT_PUBLIC_SUPABASE_URL … not set" line per page in environments with no Supabase env (CI and any
worktree without `.env.local`). Tests stay green; the noise is pre-existing proxy behaviour, not new
failure handling.

Open question for Ali: `LISTENING_TIMEOUT_S` = 30 s and the VAD thresholds (0.08 / 0.3 s / 0.8 s)
are proposed defaults — docs/06 §3 numbers only IDLE's 90 s and the specs give no energy threshold.
Both are one-line changes in `packages/config/src/avatar.ts`.
