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
