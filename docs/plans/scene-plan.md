# Scene Plan — Neural Bust (match the reference image)

Target: the reference image `reference.png` (glowing contour-line bust, warm face core, gold neck circuitry, concentric rings, wireframe mountain network on both sides, bloom, "STATUS: LISTENING" HUD).
Stack: React Three Fiber + drei + @react-three/postprocessing + three. If the project uses something else, adapt the API but keep the phases, values and acceptance criteria.

---

## 0. Rules for the agent (read before doing anything)

1. Read this whole file first. Reply with a short per-phase list of the files you will touch and what you will change. **No code yet.** Wait for "go".
2. One phase per commit. Commit message: `scene: phase N — <name>`.
3. Do the phases in order. Do not merge, skip, or start the next phase before the current one is approved.
4. Only touch the files that belong to the current phase. No refactoring, renaming, or "cleanup" elsewhere.
5. Every tunable number (colors, sizes, positions, frequencies, opacities) lives in `src/scene/sceneConfig.ts`. No magic numbers inside components.
6. Every layer has an on/off flag in `sceneConfig.layers` so it can be isolated for comparison.
7. After each phase: stop, list what changed, say what to look for in the screenshot, then wait. If you can capture a screenshot yourself, save it to `docs/screens/phase-N.png`; otherwise ask me for one.
8. If a target element can't be matched with the approach below, say so and propose an alternative. Never silently substitute something different.
9. Never remove or degrade a previous phase's result to make a later phase work.

---

## 1. Gap analysis — reference vs current build

| Element | Reference (target) | Current build (problem) |
|---|---|---|
| Background | Dark navy vertical gradient, faint tiny stars | Pure black |
| Bust shape | Smooth bald humanoid bust, symmetric, clean silhouette | Lumpy, blobby, uneven outline |
| Contour lines | Dense, continuous, evenly spaced horizontal slices; cyan; edges glow brighter (rim light); dark navy fill between lines | Sparse, broken, noisy white lines; gaps; cloudy fill |
| Face core | Small warm orange radial glow centered on the face; lines still visible over it | Large yellow cloud filling the head |
| Neck | Gold branching lines converging from the jaw to a node at the sternum | Tangled orange wireframe blob |
| Rings | Thin, complete, smooth concentric circles behind the head; even spacing; fade outward | Dashed, broken, uneven, mostly missing |
| Sides | Wireframe mountain ridges: points connected by edges, blue with a few gold highlighted edges | Scattered dots + random orange dashed strokes |
| Glow | Everything bright is bloomed | No post-processing, flat look |
| HUD | Small cyan "STATUS: LISTENING" text top-right | None |

---

## 2. Scene constants (put these in `sceneConfig.ts`)

**Units:** 1 unit ≈ head height. Bust centered on x = 0.

```ts
export const sceneConfig = {
  layers: { stars: true, bust: true, contours: true, core: true, neck: true, rings: true, landscape: true, post: true, hud: true },

  camera: { position: [0, 1.0, 5.5], fov: 32, lookAt: [0, 1.05, 0] },

  palette: {
    bgTop: '#020B1F',
    bgBottom: '#082041',
    fill: '#041634',        // bust interior between lines
    line: '#35C8FF',        // contour lines
    edge: '#9BE9FF',        // rim highlight
    core: '#FF9A3C',        // face glow
    gold: '#FFC247',        // neck circuitry + landscape highlights
    landscape: '#2FA8FF',
  },

  bust: {
    headCenter: [0, 1.45, 0], headRadius: 0.5, headScaleY: 1.2,
    neckRadius: 0.2, neckTop: 1.05, neckBottom: 0.75,
    shoulderCenter: [0, 0.25, 0], shoulderRadii: [1.5, 0.5, 0.55],
    chestCenter: [0, -0.45, 0], chestSize: [2.0, 1.0, 1.0],
  },

  contours: { frequency: 90, lineWidth: 0.10, fresnelPower: 2.5, scrollSpeed: 0.05 },

  core: { center: [0, 1.5, 0.45], radius: 0.35, pulseSpeed: 1.5, pulseAmount: 0.15 },

  neck: { jawY: 1.02, jawXs: [-0.22, -0.14, -0.06, 0.06, 0.14, 0.22], nodeY: 0.42, lineWidth: 1.5 },

  rings: { center: [0, 1.45, -1.3], count: 9, innerRadius: 0.9, step: 0.25, thickness: 0.008, opacityFrom: 0.5, opacityTo: 0.06 },

  landscape: { xStart: 1.2, xEnd: 4.0, cols: 70, rows: 6, zStart: -0.5, zStep: -0.4, baseY: -0.6, amplitude: 1.6, dropout: 0.35, goldRatio: 0.1, pointSize: 0.025 },

  post: { bloomIntensity: 1.3, bloomThreshold: 0.55, bloomSmoothing: 0.3, vignetteDarkness: 0.7 },
};
```

Component tree (create these files under `src/scene/`):

```
<Canvas>
  <SceneCamera />
  <Stars />              Phase 1
  <Bust />               Phase 2 + 3 (geometry + contour material)
  <FaceCore />           Phase 4
  <NeckCircuit />        Phase 5
  <Rings />              Phase 6
  <Landscape />          Phase 7
  <Effects />            Phase 8
</Canvas>
<Hud />                  Phase 8 (plain DOM, outside the Canvas)
```

---

## Phase 0 — Setup and baseline

**Do**
- Confirm installed: `three`, `@react-three/fiber`, `@react-three/drei`, `@react-three/postprocessing`, `simplex-noise`. Install what's missing.
- Create `src/scene/sceneConfig.ts` with the constants above.
- Create the component files as empty stubs that render nothing, wired into the tree with the layer flags.
- Save a screenshot of the current scene as `docs/screens/00-baseline.png`.

**Acceptance:** app builds and runs, scene tree in place, nothing visually different yet.

---

## Phase 1 — Background, camera, stars

**Do**
- `<Canvas dpr={[1, 2]} gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping }}>` with CSS on the canvas container: `background: linear-gradient(180deg, #020B1F 0%, #082041 100%)`.
- Camera: `PerspectiveCamera` from config (position, fov). Call `lookAt(config.camera.lookAt)` once on mount.
- Stars: drei `<Stars radius={60} depth={20} count={400} factor={1.2} fade />` or `<Sparkles>` with size ~0.6. Opacity around 0.3. Must be barely visible.

**Acceptance:** navy gradient, subtle stars, nothing else. Stars should not be distracting — if they are, halve the count.

**Don't:** use a black background, or bright/large stars.

---

## Phase 2 — Bust geometry

**Do**
- Preferred: load a smooth, bald, symmetric humanoid bust GLB (head + neck + shoulders, high poly, no facial detail needed) via `useGLTF`. Scale so head height ≈ 1 unit and head center sits at `bust.headCenter`.
- Fallback if no model: build procedurally from primitives using the config values:
  - Head: `SphereGeometry(headRadius, 96, 96)` scaled `[1, headScaleY, 1]` at `headCenter`.
  - Neck: `CylinderGeometry(neckRadius, neckRadius * 1.15, neckTop - neckBottom, 48)` between `neckBottom` and `neckTop`.
  - Shoulders: `SphereGeometry(1, 96, 48)` scaled to `shoulderRadii` at `shoulderCenter`.
  - Chest: `BoxGeometry(...chestSize)` at `chestCenter` (extends below the frame on purpose).
  - Overlapping meshes are fine — the contour shader is per-fragment in world space and bloom hides seams. Optionally merge with `mergeGeometries` from `three/examples/jsm/utils/BufferGeometryUtils.js`.
- Temporary material: `meshBasicMaterial color={palette.fill}` so only the silhouette is visible.

**Acceptance:** clean, symmetric silhouette. Head occupies roughly the top third of the frame, shoulders span most of the width, chest is cut off by the bottom edge. Compare the outline against the reference.

**Don't:** add ears, eyes, hair, or any facial geometry. Don't use low segment counts (visible facets).

---

## Phase 3 — Contour-line shader (this is the core look)

**Do**
- Create `ContourMaterial` with drei `shaderMaterial` (or `THREE.ShaderMaterial`) and apply it to every bust mesh. Opaque, `side: THREE.FrontSide`, `toneMapped: false`.
- Uniforms come from `sceneConfig.contours`, `sceneConfig.core`, `sceneConfig.palette`. Update `uTime` in `useFrame`.
- Use **world-space y** for the slices so lines stay continuous across head, neck and shoulders.

Vertex shader:
```glsl
varying vec3 vWorldPos;
varying vec3 vNormal;
varying vec3 vViewDir;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  vViewDir = normalize(cameraPosition - wp.xyz);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
```

Fragment shader:
```glsl
uniform float uFrequency;    // contours.frequency
uniform float uLineWidth;    // contours.lineWidth (fraction of one slice, 0..0.5)
uniform float uFresnelPower; // contours.fresnelPower
uniform float uScrollSpeed;  // contours.scrollSpeed
uniform float uTime;
uniform vec3  uLineColor;    // palette.line
uniform vec3  uFillColor;    // palette.fill
uniform vec3  uEdgeColor;    // palette.edge
uniform vec3  uCoreColor;    // palette.core
uniform vec3  uCoreCenter;   // core.center (world space)
uniform float uCoreRadius;   // core.radius
uniform float uPulseSpeed;
uniform float uPulseAmount;
varying vec3 vWorldPos;
varying vec3 vNormal;
varying vec3 vViewDir;

void main() {
  // horizontal slices, anti-aliased
  float coord = vWorldPos.y * uFrequency + uTime * uScrollSpeed;
  float slice = fract(coord);
  float d = abs(slice - 0.5);
  float aa = fwidth(coord) * 0.75;
  float line = 1.0 - smoothstep(uLineWidth, uLineWidth + aa, d);

  // rim light
  float fres = pow(1.0 - max(dot(normalize(vNormal), normalize(vViewDir)), 0.0), uFresnelPower);

  // warm core on the face, pulsing
  float core = 1.0 - smoothstep(0.0, uCoreRadius, distance(vWorldPos, uCoreCenter));
  core *= (1.0 - uPulseAmount) + uPulseAmount * sin(uTime * uPulseSpeed);

  vec3 lineCol = mix(uLineColor, uCoreColor, core);
  vec3 fill    = mix(uFillColor, uCoreColor * 0.35, core * 0.7);
  vec3 col     = mix(fill, lineCol, line);
  col += uEdgeColor * fres * 0.6;
  col *= 1.0 + line * 0.8;   // push lines above the bloom threshold

  gl_FragColor = vec4(col, 1.0);
}
```

**Acceptance**
- Lines are continuous cyan, no gaps, no noise, evenly spaced, thin.
- Interior between lines is dark navy, not cloudy or white.
- Silhouette edges are visibly brighter than the center (fresnel).
- Lines run straight across head → neck → shoulders with no offset at mesh boundaries.
- Tuning guide: lines too sparse → raise `frequency` (90 → 120–140); too thick → lower `lineWidth` (0.10 → 0.06); edges too bright → raise `fresnelPower`.

**Don't:** use transparency, additive blending, or wireframe mode for the bust. Don't use a texture for the lines.

---

## Phase 4 — Face core glow

**Do**
- The shader already tints lines/fill orange near `core.center`. This phase adds the soft glow that bloom picks up.
- Add a drei `<Billboard>` at `core.center` (z slightly in front of the face surface) with a `PlaneGeometry(0.9, 0.9)` and a `meshBasicMaterial` using a **radial gradient CanvasTexture** (center `palette.core` at alpha 0.9 → transparent at the edge). `transparent`, `blending: THREE.AdditiveBlending`, `depthWrite: false`, `toneMapped: false`.
- Pulse its opacity/scale in `useFrame` with the same `pulseSpeed` so it breathes together with the shader tint.

**Acceptance:** small warm glow centered on the face, roughly a third of the head width, fading softly, contour lines still visible over it. Nothing yellow, nothing filling the whole head.

**Don't:** use a point light (it will flatten the contours). Don't put the glow behind the head.

---

## Phase 5 — Neck circuitry

**Do**
- Build 6 strands with drei `<Line>`: each starts at `(jawXs[i], neck.jawY)` and ends at the sternum node `(0, neck.nodeY)`. Use a `QuadraticBezierCurve3` per strand with the control point at `(jawXs[i] * 0.6, 0.75)` so strands curve inward before converging. 40 points per strand.
- z for each point: `sqrt(max(neckRadius² - x², 0)) + 0.02` (hugs the neck cylinder). Render with `depthTest={false}` and `renderOrder={10}` so the strands always draw on top of the bust and never z-fight.
- Material: `color={palette.gold}`, `lineWidth={neck.lineWidth}`, `transparent`, `opacity={0.9}`, `toneMapped={false}`.
- Sternum node: a small `Points` cluster (8–12 points, size 0.02) at `(0, nodeY, z)` plus 6 short radiating segments (length 0.05) — this is the small "spark" at the bottom of the neck in the reference.
- Optional (only if everything above is approved): a slow traveling pulse using `dashed` + animated `dashOffset` on 1–2 strands.

**Acceptance:** thin gold veins converging from the jaw to a single node at the sternum, clearly visible, glowing under bloom (checked again in Phase 8). No tangled wireframe.

**Don't:** generate random paths. Keep it hand-authored and symmetric.

---

## Phase 6 — Rings

**Do**
- Group at `rings.center` (behind the head). For `i in 0..count-1`: radius `r = innerRadius + i * step`, `<mesh><ringGeometry args={[r, r + thickness, 160]} /><meshBasicMaterial color={palette.line} transparent opacity={lerp(opacityFrom, opacityTo, i/(count-1))} toneMapped={false} side={THREE.DoubleSide} depthWrite={false} /></mesh>`.
- Rings face the camera (no tilt). The bust is in front of them and occludes them naturally.
- Optional after approval: every ring slowly scales 1.0 → 1.03 → 1.0 over ~6 s with a per-ring phase offset, plus a few tiny sprites sitting on two of the rings.

**Acceptance:** thin, complete, perfectly smooth circles; even spacing; opacity fades outward; inner ring sits just outside the head silhouette. No dashes, no broken arcs.

**Don't:** use `LineBasicMaterial` circles (aliased) or `TorusGeometry` (too thick).

---

## Phase 7 — Landscape network (both sides)

**Do**
- Generate a point grid per side with `simplex-noise` (`createNoise2D`, seeded so it's stable between reloads):

```
for side in [-1, +1]:
  for i in 0..cols:   x = side * (xStart + (i / cols) * (xEnd - xStart))
    for j in 0..rows: z = zStart + j * zStep
      ridge   = noise2D(x * 0.55, j * 0.7) * 0.7 + noise2D(x * 1.6, j * 0.7) * 0.25
      falloff = smoothstep(1.2, 2.2, abs(x))          // keeps the ridges off the bust
      y       = baseY + max(ridge, 0) * amplitude * falloff - j * 0.05
```

- Edges: connect `(i,j)→(i+1,j)`, `(i,j)→(i,j+1)`, `(i,j)→(i+1,j+1)`, dropping `dropout` (35%) of them with a seeded random so the mesh looks organic, not like a grid.
- Gold edges: the top `goldRatio` (10%) of edges by average y (the ridge tops) go into a second `LineSegments` with `palette.gold`.
- Render:
  - `<points>` — `pointsMaterial size={pointSize} color={palette.landscape} transparent opacity={0.8} sizeAttenuation blending={AdditiveBlending} depthWrite={false}`.
  - `<lineSegments>` blue — `lineBasicMaterial color={palette.landscape} transparent opacity={0.35} blending={AdditiveBlending} depthWrite={false}`.
  - `<lineSegments>` gold — same, `color={palette.gold}`, `opacity={0.8}`.
  - All `toneMapped={false}`.

**Acceptance:** glowing wireframe mountain ridges flanking the bust, peaks reaching roughly neck height, lower and denser toward the outer edges, mostly blue with scattered gold edges along the ridge tops. Ridges must not overlap the bust silhouette.

**Don't:** use scattered unconnected dots, random dashed strokes, or a flat regular grid.

---

## Phase 8 — Post-processing and HUD

**Do**
- `Effects`: `<EffectComposer><Bloom intensity={post.bloomIntensity} luminanceThreshold={post.bloomThreshold} luminanceSmoothing={post.bloomSmoothing} mipmapBlur /><Vignette offset={0.3} darkness={post.vignetteDarkness} /></EffectComposer>`.
- Verify every bright material has `toneMapped={false}` so its color reaches the bloom pass at full value.
- `Hud`: a plain DOM `div`, absolutely positioned inside the same container as the Canvas, top-right (`top: 24px; right: 28px`), `pointer-events: none`. Text `STATUS: LISTENING`, monospace, 11px, `letter-spacing: 0.18em`, `color: #35C8FF`, `opacity: 0.75`, preceded by a 6px dot with a slow opacity pulse (2 s). Respect `prefers-reduced-motion` (no pulse).

**Acceptance**
- Contour lines, rings, gold strands and landscape all glow softly; the dark fill and background do not bloom (if they do, raise `bloomThreshold`).
- Corners slightly darkened by the vignette.
- HUD text visible but quiet.
- Side-by-side with the reference: same read at a glance.

**Don't:** stack extra effects (chromatic aberration, noise, god rays). Bloom + vignette only.

---

## Phase 9 — Motion and performance (optional, only after Phase 8 is approved)

- Contour lines drift very slowly upward (`scrollSpeed` 0.05 → adjust to taste; 0 disables).
- Face core breathes (already wired via `pulseSpeed`).
- Camera drifts ±0.05 on x over ~12 s (sine in `useFrame`), so the scene feels alive without ever moving the composition.
- Landscape: no per-frame vertex updates; if a shimmer is wanted, animate the gold `opacity` between 0.6 and 0.9 slowly.
- Performance: cap `dpr` at 1.5 below 1000px width; halve `landscape.cols` on mobile; all `useFrame` work must be uniform updates only — no per-frame allocations.

---

## Final acceptance checklist (compare against `reference.png`)

- [ ] Navy gradient background with faint stars
- [ ] Smooth symmetric bust; chest cut by the frame bottom
- [ ] Dense, continuous, cyan horizontal contour lines; dark navy fill; bright rim edges
- [ ] Small warm orange core on the face; lines visible over it; subtle pulse
- [ ] Gold strands converging from the jaw to a sternum node
- [ ] 9 thin complete rings behind the head, fading outward
- [ ] Wireframe mountain networks on both sides, blue with gold ridge edges, clear of the bust
- [ ] Bloom on all bright elements, vignette, no other effects
- [ ] "STATUS: LISTENING" top-right
- [ ] Every value adjustable from `sceneConfig.ts`; every layer toggleable

---

## How feedback will arrive

Feedback after each phase is per-property, in this form:

- `Phase 3: lines too sparse → frequency 90 → 130`
- `Phase 7: ridges overlap the shoulders → falloff start 1.2 → 1.6`
- `Phase 8: background is blooming → bloomThreshold 0.55 → 0.7`

Apply exactly the change named, re-screenshot, and report. Do not re-interpret the whole reference when a single value is being tuned.
