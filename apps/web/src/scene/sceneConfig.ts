/**
 * Scene v3 — "Neural Bust" (docs/plans/scene-plan.md). Every tunable number of the scene lives
 * here (plan rule 5); every layer has an on/off flag (rule 6). Units: 1 ≈ head height, bust
 * centred on x = 0, +y up, camera looks down −z.
 *
 * Stack note: the plan was written for drei + @react-three/postprocessing + GLSL; this repo renders
 * with three/webgpu + TSL (CLAUDE.md §4), so the values keep the plan's meaning but a few carry
 * adapted units — each is commented where it differs.
 */

export type Vec3 = [number, number, number];

export const LAYER_NAMES = [
  "background",
  "stars",
  "bust",
  "contours",
  "shell",
  "halo",
  "core",
  "neck",
  "rings",
  "dust",
  "landscape",
  "post",
  "hud",
] as const;
export type LayerName = (typeof LAYER_NAMES)[number];
export type Layers = Record<LayerName, boolean>;

export interface SceneConfig {
  layers: Layers;
  /** `hfov`: fixed horizontal field of view; the vertical fov is derived per aspect on every
   *  resize (round 2 item 1). 54° = the plan's fov 32 at 16:9. */
  camera: { position: Vec3; hfov: number; lookAt: Vec3; near: number; far: number };
  render: {
    /** 4× MSAA on the scene pass (the fat lines and the thin rings need it for smooth edges);
     *  off = 1 sample. `?set=render.antialias:false` on the bench */
    antialias: boolean;
  };
  /** Phase 9 — motion (docs/plans/scene-plan.md Phase 9 + the optional items of Phases 5/6,
   *  approved by Ali 2026-09-07). Periods in seconds. Everything here stops under reduced motion. */
  motion: {
    /** "auto": follow the OS `prefers-reduced-motion`; "reduce": always still; "full": always
     *  animate. `?set=motion.reducedMotion:reduce` previews the still scene */
    reducedMotion: "auto" | "reduce" | "full";
    /** camera x = ±x over `period` (plan: ±0.05 over ~12 s) */
    cameraDrift: { x: number; period: number };
    /** landscape gold opacity between from and to (plan: 0.6..0.9, slow) */
    goldShimmer: { from: number; to: number; period: number };
    /** rings scale 1 → 1 + amount → 1 over `period`, `stagger` radians between rings (plan
     *  Phase 6 optional: 1.03 over ~6 s) */
    ringBreath: { amount: number; period: number; stagger: number };
    /** plan Phase 5 optional: a travelling pulse on 1–2 strands — those strands are drawn
     *  dashed (dash/gap in world units) with the dash offset moving at `speed` units/s */
    neckPulse: { strands: number[]; dash: number; gap: number; speed: number };
  };
  /** Phase 9 — performance (plan: dpr ≤ 1.5 below 1000 px, half the landscape columns on
   *  mobile). Widths in CSS px. */
  perf: {
    dprCapWidth: number;
    dprCap: number;
    dprMax: number;
    mobileWidth: number;
    /** Phase 12.7 (Ali): halve every count on mobile — landscape columns, bust shell, ring beads,
     *  neck beads via `motion.ts` `sceneCount`, dust, plume, stars. Was `mobileColsFactor`, which
     *  only the landscape read; the glow phase's counts make every layer heavy enough to need it. */
    mobileCountFactor: number;
  };
  /** Phase 10 (Ali): every point layer shares one soft sprite; the spec's point sizes are
   *  starting values ("keep the ratios, tune the scale") — this multiplies all of them */
  particles: { sizeScale: number };
  palette: {
    bgTop: string;
    bgBottom: string;
    /** bust interior between lines */
    fill: string;
    /** contour lines */
    line: string;
    /** rim highlight */
    edge: string;
    /** face glow */
    core: string;
    /** Phase 12.4: the white-hot centre of the face core (see `core.hot`) */
    coreHot: string;
    /** neck circuitry + landscape highlights */
    gold: string;
    landscape: string;
  };
  bust: {
    /** "glb": the repo's smooth bust mesh (preferred per the plan); "primitives": sphere + cylinder
     *  + ellipsoid + box fallback built from the values below */
    source: "glb" | "primitives";
    /** canonical bust space (y ∈ [−0.9, 0.9], head ≈ 0.75 tall) → scene units; the jagged
     *  cropped-arm boundary below `skirtBelow` is pulled down to `skirtTo` (canonical y) */
    glb: {
      url: string;
      scale: number;
      offset: Vec3;
      /** boundary vertices with |x| > xMin and y ∈ [yMin, yMax] are the jagged upper-arm crops,
       *  straightened onto one slanted line per side */
      armCrop: { xMin: number; yMin: number; yMax: number };
      skirtBelow: number;
      skirtTo: number;
      /** cavities closed in the mesh (canonical units): the eye slits — the GLB bakes lids with
       *  an open slit and an eyeball 0.13 behind them into its single mesh (no eye node to hide;
       *  Ali, feedback round 1 Phase 2 — the reference has no eyes). The lids are laid onto a
       *  quadric fitted to the surrounding skin and the eyeball is parked `recess` behind it.
       *  Ears are untouched. */
      cavities: {
        yMin: number;
        yMax: number;
        xMin: number;
        xMax: number;
        zMin: number;
        sheetZ: number;
        recess: number;
        feather: number;
      }[];
    };
    /** Phase 10.2 (Ali): particle shell — `count` points sampled over the bust surface, pushed
     *  `push` along the sampled normal, drawn as soft sprites of a random `size` (PointsMaterial
     *  units, scaled by `particles.sizeScale`). Alpha = `alphaMin` + `alphaRim`·fresnel (the
     *  contour shader's fresnel, `contours.fresnelPower`), so the cloud is bright at the silhouette
     *  and nearly invisible on the front — the glowing edge mist of the reference — times
     *  `opacity`. `seed` drives the sampler and the push/size draws. */
    shell: {
      count: number;
      push: [number, number];
      size: [number, number];
      alphaMin: number;
      /** alpha = alphaMin + alphaRim · fresnel; Phase 10 had 0.15 + 0.85, Phase 11.2 0.03 + 0.6 */
      alphaRim: number;
      opacity: number;
      seed: number;
    };
    /** Phase 12.3 (Ali): rim glow — the bust duplicated at `scale` (about the geometry's bounding
     *  box centre, so the copy grows evenly instead of drifting up off the origin), back faces
     *  only, additive and depth-write free, drawn in `color` with
     *  alpha = pow(1 − |n·v|, `fresnelPower`) · `alpha`. Only the silhouette survives that curve,
     *  so the outline is the brightest thing in the frame with a soft halo around it. */
    halo: { scale: number; color: string; alpha: number; fresnelPower: number };
    headCenter: Vec3;
    headRadius: number;
    headScaleY: number;
    neckRadius: number;
    neckTop: number;
    neckBottom: number;
    shoulderCenter: Vec3;
    shoulderRadii: Vec3;
    chestCenter: Vec3;
    chestSize: Vec3;
  };
  contours: {
    /** slices per world unit of y */
    frequency: number;
    /** fraction of one slice (0..0.5) */
    lineWidth: number;
    fresnelPower: number;
    /** rim = edge · fresnel · this (plan shader literal 0.6; Ali round 1: 0.9) */
    rimStrength: number;
    /** lines are multiplied by 1 + this (plan shader literal 0.8, "push lines above the bloom
     *  threshold"). Round 1: at 0.8 the lines read green-cyan, so Ali's "line must be exactly
     *  #35C8FF" set it to 0 — the cast was the *display* clipping the boosted #35C8FF's blue
     *  channel (blue is already at 1.0, so only green could still rise), not the shader.
     *  Phase 12.1 (Ali): "line brightness multiplier 1.0 → 1.4" → 0.4, with the half-float scene
     *  buffer (Effects.tsx) so the > 1 values reach bloom's bright pass instead of being clipped
     *  before it. */
    lineBoost: number;
    scrollSpeed: number;
    /** Phase 10.3 (Ali): beaded contour lines — each line is modulated along world x by
     *  `0.5 + 0.5·sin(x·frequency + floor(slice)·1.7)`, remapped through
     *  `mix(min, 1, smoothstep(0.2, 0.8, bead))`, so the lines read as strings of dots up close
     *  and stay continuous from a distance. `?set=contours.beads.enabled:false` for the off shot */
    beads: { enabled: boolean; frequency: number; min: number };
  };
  core: {
    center: Vec3;
    radius: number;
    pulseSpeed: number;
    pulseAmount: number;
    /** Phase 4 glow billboard: plane size (plan 0.9), z just in front of the face surface
     *  (the mesh's nose tip is at z ≈ 0.61), centre alpha, and the scale-pulse amplitude as a
     *  fraction of `pulseAmount` (the opacity pulses at the full amount).
     *  `brightness` — Phase 12.4: sprite opacity ×1.5 — applied as a colour multiplier because
     *  opacity is capped at 1 and the half-float buffer carries > 1 into bloom */
    glow: { size: number; z: number; alpha: number; brightness: number; scalePulse: number };
    /** Phase 12.4: lines inside the inner `radius` fraction of the core mix toward
     *  `palette.coreHot` (white-hot centre, orange edge) */
    hot: { radius: number };
  };
  neck: {
    jawY: number;
    jawXs: number[];
    nodeY: number;
    /** y of each strand's bezier control point (plan: 0.75, between jaw and node) */
    controlY: number;
    /** control x = jawX · this (plan: 0.6): how far the strands bow inward */
    controlXFactor: number;
    /** fat-line width in CSS px (drei <Line lineWidth>) */
    lineWidth: number;
    /** plan: material `transparent, opacity 0.9`. Applied as a multiplier on `palette.gold`
     *  instead — the fat-line material stays opaque because a transparent Line2NodeMaterial
     *  composites against a per-frame framebuffer copy + mip chain. Identical over the dark
     *  fill; where strands cross contour lines they cover them instead of letting 10 % through.
     *  Phase 10.4: the line under the beads. Phase 11.3: 0.3 → 0.15 — with the branches and
     *  twice the beads the strands must read as nerves, and the line is only their trace */
    opacity: number;
    /** Phase 12.6 (Ali): the mesh neck is wider than the primitives' 0.2 (`bust.neckRadius`); the
     *  strands hug a 0.3 cylinder so the outer strands still wrap. Everything the neck generator
     *  lifts — strands, branches, node — uses this radius, not `bust.neckRadius`. */
    cylinderRadius: number;
    /** how far in front of the neck cylinder the strands sit (plan: 0.02) */
    lift: number;
    /** samples per strand (plan: 40) */
    points: number;
    /** Phase 10.4 (Ali): each strand becomes `perStrand` gold beads over the line — per-bead
     *  size drawn uniformly from `size` (PointsMaterial units × `particles.sizeScale`).
     *  Phase 11.3: 60 → 120 beads at ×0.7 the size, each dimmed by a per-bead multiplier drawn
     *  uniformly from `brightness` (× `opacity`), so the strands twinkle instead of reading as
     *  one even string */
    strandPoints: {
      perStrand: number;
      size: [number, number];
      opacity: number;
      brightness: [number, number];
    };
    /** Phase 11.3 (Ali): every strand sprouts `perStrand` (inclusive range) short sub-branches —
     *  gold nerves, not a harp. Each leaves its strand at a bezier parameter drawn from `at`
     *  (30–70 % of the strand's length), runs `length` world units and is beaded like the
     *  strands. `angle` = radians the branch direction is rotated from the strand's local
     *  tangent toward outward/down (the tangent runs jaw → node, i.e. downward; the rotation
     *  sign is the one that turns it away from x = 0). `beadsPerUnit` = bead density along a
     *  branch — 120 beads over a ≈0.6-unit strand ≈ 200/unit, so branches bead like strands.
     *  `endBead` = the bright bead at each branch tip and at each branch point (size in
     *  PointsMaterial units × `particles.sizeScale`).
     *  Phase 12.6 (Ali): "sub-branches get their own sub-branches" — `depth` levels of branch,
     *  each branch growing `sub.perBranch` of its own at `sub.at` of its length and
     *  `sub.lengthFactor` × its length (so 0.06–0.15). `depth: 1` is Phase 11.3 exactly. */
    branches: {
      perStrand: [number, number];
      at: [number, number];
      length: [number, number];
      angle: [number, number];
      beadsPerUnit: number;
      depth: number;
      sub: { perBranch: [number, number]; at: [number, number]; lengthFactor: number };
      endBead: { size: number; opacity: number };
    };
    /** Phase 12.6 (Ali): the sternum node is a nucleus — `points` points over a disc of `radius`,
     *  blue-white (`palette.edge`) inside `coreRadius` and gold (`palette.gold`) beyond it, each
     *  half carrying its own colour multiplier (`coreBrightness` / `ringBrightness`, > 1 so the
     *  nucleus blooms). `pointSize` is in PointsMaterial units (converted to a sprite size at
     *  render time), `spokes`/`spokeLength` are the radiating segments, and `core` is the single
     *  hot sprite at the centre (size in the same units, `brightness` its colour multiplier). */
    nucleus: {
      points: number;
      radius: number;
      coreRadius: number;
      coreBrightness: number;
      ringBrightness: number;
      pointSize: number;
      spokes: number;
      spokeLength: number;
      core: { size: number; opacity: number; brightness: number };
    };
    seed: number;
  };
  rings: {
    center: Vec3;
    count: number;
    innerRadius: number;
    step: number;
    thickness: number;
    opacityFrom: number;
    opacityTo: number;
    /** RingGeometry theta segments (plan: 160) */
    segments: number;
    /** Phase 10.4: the annuli at ×0.6 under the beads.
     *  Phase 12.5: ×0.4 — a faint guide line under the beads */
    geometryOpacity: number;
    /** Phase 10.4 (Ali): `perRing` beads scattered along each ring at the mid-annulus radius
     *  ± `radialJitter`, `size` in PointsMaterial units × `particles.sizeScale`, `opacity`
     *  fading with the ring it rides on.
     *  Phase 12.5 (Ali): "rings read as particle rings with a faint guide line, not lines with
     *  dots" — 250 → 1,500 beads per ring, no longer at a uniform angle:
     *  - `brightness` = per-bead COLOUR multiplier range, drawn uniformly per bead (a value > 1
     *    feeds bloom on the half-float buffer, Phase 12.1, which an opacity > 1 never could).
     *  - `density` = the angular density field. An angle θ is accepted with probability
     *    `floor + (1 − floor)·(0.5 + 0.5·noise(cos θ·scale, sin θ·scale, ringIndex))`, so some
     *    arcs come out dense and some sparse. The noise is sampled on the unit circle, not on θ,
     *    which keeps the field continuous across 2π (noise(θ) would leave a seam at the wrap);
     *    `scale` = how many dense/sparse lobes fit round a ring, `floor` = the sparsest arc's
     *    share of the peak density.
     *  - `noiseSeed` seeds that field (one field shared by every ring, walked along its third
     *    axis by the ring index); `seed` seeds the angle/radius/brightness draws. */
    points: {
      perRing: number;
      radialJitter: number;
      size: number;
      opacity: number;
      brightness: [number, number];
      density: { scale: number; floor: number };
      noiseSeed: number;
      seed: number;
    };
  };
  /** Phase 11.4 (Ali): ambient particle life everywhere, strongest above the head. Two
   *  sub-layers, one object each, both animated entirely on TSL `time` (no per-frame JS) and
   *  both still under reduced motion. Replaces the Phase 10.4 `rings.drift` disc. */
  dust: {
    /** Phase 11.4 (Ali): the global dust volume — `count` points uniform in an axis-aligned box
     *  of full extent `size` (6 × 4 × 3) centred on `center`, drawn as the shared Phase 10 soft
     *  sprite at `pointSize` (PointsMaterial units × `particles.sizeScale`) and `opacity`, with
     *  per-point size/opacity multipliers from `sizeJitter` / `opacityJitter`. Each point
     *  wanders up to `drift.amount` world units on a per-point-hashed sine of TSL time with
     *  period `drift.period` seconds; `seed` places the points. depthTest stays on so the bust
     *  occludes the points behind it. */
    ambient: {
      center: Vec3;
      size: Vec3;
      count: number;
      pointSize: number;
      opacity: number;
      sizeJitter: [number, number];
      opacityJitter: [number, number];
      drift: { amount: number; period: number };
      seed: number;
    };
    /** Phase 11.4 (Ali): the crown plume — the particle spray above the head. `count` points in
     *  a cone rooted at `crown`, rising `height` world units while its radius goes `baseRadius`
     *  → `topRadius`. Each particle rises over `period / speed` seconds (its speed drawn from
     *  `speedJitter`), wraps back to the base, and sways `wobble` world units sideways; alpha
     *  fades in over the first 8 % of the rise (so respawn never pops) and out to nothing at the
     *  tip. `seed` draws the lanes, phases and speeds. */
    plume: {
      crown: Vec3;
      baseRadius: number;
      topRadius: number;
      height: number;
      period: number;
      speedJitter: [number, number];
      wobble: number;
      count: number;
      pointSize: number;
      opacity: number;
      /** Phase 12.7 (Ali): plume brightness ×1.5. A COLOUR multiplier, not an opacity — the scene
       *  buffer is half-float (Phase 12.1), so a value > 1 feeds bloom's bright pass instead of
       *  clipping at white, which is what makes the spray above the head read as glowing. */
      brightness: number;
      seed: number;
    };
  };
  landscape: {
    xStart: number;
    xEnd: number;
    /** number of x intervals per side: cols + 1 points, x reaching xEnd (plan `0..cols`) */
    cols: number;
    /** exact row count (Phase 13.2: 70 rows, z from zStart back by zStep) */
    rows: number;
    zStart: number;
    zStep: number;
    /** y = baseY + (zStart − z)·slope + max(h, 0)·amplitude·(0.5 + 0.5·smoothstep(rise, |x|))
     *  (round 3 heightfield: far rows are the peaks, near rows drop below the frame) */
    baseY: number;
    amplitude: number;
    slope: number;
    /** the only fade in the layer: vertex opacity × smoothstep(fade[0], fade[1], y), sitting on
     *  the bottom edge of the frame so the surface fills each side down to it (Phase 11.1) */
    fade: [number, number];
    /** Phase 11.1 (Ali): the ridges keep rising toward the frame edges instead of being cut off
     *  near the bust — the height is scaled by 0.5 + 0.5·smoothstep(rise[0], rise[1], |x|), so
     *  half height beside the bust and full (head-height) peaks by |x| = rise[1]. Replaces the
     *  round-3 |x| falloff smoothstep(1.2, 2.2, |x|), which flattened everything inside 2.2. */
    rise: [number, number];
    /** two-octave ridge sampled continuously over world (x, z), never per row index:
     *  h = noise2D(x·lowScale, z·lowScale)·lowWeight + noise2D(x·highScale, z·highScale)·highWeight
     *  (round 3: 0.35/0.7 + 0.9/0.25) */
    ridge: { lowScale: number; lowWeight: number; highScale: number; highWeight: number };
    /** Phase 10.1 (Ali): plexus network — the grid is only where a node starts. Each node is
     *  jittered by ±`jitter` in x and z (seeded) and re-sampled on the heightfield, then joined
     *  to its k nearest neighbours on the same side, k drawn per node from
     *  [neighbors[0], neighbors[1]] inclusive, skipping candidates farther than `maxEdge` world
     *  units — so no long edges and no grid reading. */
    jitter: number;
    /** inclusive range the per-node neighbour count k is drawn from (Ali: {2, 3}) */
    neighbors: [number, number];
    /** longest edge in world units (Phase 11.1: 0.12 — the denser grid needs shorter edges or
     *  it reads as a solid mesh) */
    maxEdge: number;
    /** per-node size range, PointsMaterial units (px = size · H/2 / depth); converted to a sprite
     *  size at render time. Nodes are the hero, edges are hints (Ali) */
    nodeSize: [number, number];
    nodeOpacity: number;
    edgeOpacity: number;
    /** Phase 12.2 (Ali): the ridge lines. Per column (one side, one x index) the top `ratio` of
     *  that column's nodes by y are *crest* nodes — the skyline of the range. They draw at
     *  `sizeFactor`× their own size and at `brightness`× their colour, and an edge whose two
     *  endpoints are both crest carries the same colour multiplier, so the ridges read as bright
     *  flowing lines over a dimmer dense slope. `brightness` is a COLOUR multiplier, never an
     *  opacity: the scene buffer is half-float (Phase 12.1), so values > 1 survive to bloom's
     *  bright pass instead of clipping at 1. `goldShare` of the crest nodes turn gold (drawn
     *  uniformly by the rng — this replaces Phase 11.1's height²-weighted `goldRatio` walk over
     *  every node, so all gold now sits on the skyline), and `dust.count` gold points per side
     *  sit within `dust.radius` of a crest node at `dust.size` / `dust.opacity`. */
    crest: {
      ratio: number;
      sizeFactor: number;
      brightness: number;
      goldShare: number;
      dust: { count: number; size: number; opacity: number; radius: number };
    };
    /** gold nodes draw at this multiple of their own size (Ali: 1.5×), on top of
     *  `crest.sizeFactor` — every gold node is a crest node */
    goldSizeFactor: number;
    goldOpacity: number;
    /** Phase 11.1 (Ali): slope dust — tiny unconnected points per side, each within `radius` of
     *  an anchor node. Phase 13.2 (Ali) turned the slopes into particle mass: the count is the
     *  layer's biggest, `size` is a per-point uniform range (PointsMaterial units, like
     *  `nodeSize`) instead of one shared size, and the anchor is no longer picked uniformly — it
     *  is drawn with probability ∝ its normalised height (y − minY)/(maxY − minY) over that
     *  side's nodes, so the mass gathers under the crests and thins out down the slope. */
    dust: { count: number; size: [number, number]; opacity: number; radius: number };
    /** simplex noise seed for the ridges and rng seed for the jitter, sizes, k, gold and the two
     *  dust passes */
    noiseSeed: number;
    seed: number;
  };
  post: {
    /** three BloomNode.strength — NOT pmndrs `intensity`: three sums five mip blurs with a
     *  fixed weight total of 3.0 and adds linearly, so the plan's intensity 1.3 ≈ 0.43 */
    bloomStrength: number;
    /** BloomNode radius: a 0..1 mix factor over the five mip weights, not a pixel radius (pmndrs'
     *  radius is a different quantity). BloomNode.js:426 is
     *  `lerpBloomFactor(factor, radius) = mix(factor, 1.2 - factor, radius)` over
     *  factors [1, 0.8, 0.6, 0.4, 0.2], so radius only shifts weight from the fine mips to the
     *  coarse ones; the weights sum to 3.0 at *every* radius, which is why `bloomStrength`'s
     *  ÷ 3.0 mapping is independent of it. */
    bloomRadius: number;
    /** luminance threshold + smoothstep width — port 1:1 from the plan */
    bloomThreshold: number;
    bloomSmoothing: number;
    /** bright-pass resolution: 1 thresholds per full-res pixel like pmndrs; three's default
     *  0.5 box-averages the sub-pixel contour lines under the threshold (cheaper) */
    bloomResolutionScale: number;
    /** pmndrs Vignette offset / darkness */
    vignetteOffset: number;
    vignetteDarkness: number;
  };
  /** Phase 8 DOM readout */
  hud: {
    text: string;
    top: number;
    right: number;
    fontSize: number;
    letterSpacing: string;
    opacity: number;
    dotSize: number;
  };
  /** Phase 1 starfield. Adapted from drei `<Stars radius depth count factor>`: stars are placed
   *  inside the camera's view cone (not a full sphere) so `count` is the number actually on
   *  screen, and `size` is a world-space sprite size at `radius` (≈ 2 px at 800 px tall). */
  stars: {
    count: number;
    radius: number;
    depth: number;
    size: number;
    /** opacity of the brightest star (see opacityJitter) */
    opacity: number;
    /** widest aspect ratio the cone must cover */
    aspect: number;
    /** cone widening beyond the frustum (1 = exact) */
    margin: number;
    /** per-star multipliers hashed by instance index — drei's `factor` randomises size 0.5..1
     *  internally; the opacity jitter and the cyan tint are this port's additions */
    sizeJitter: [number, number];
    opacityJitter: [number, number];
    /** 1 = palette.line, 0 = white */
    tint: number;
    seed: number;
  };
}

export const sceneConfig: SceneConfig = {
  layers: {
    background: true,
    stars: true,
    bust: true,
    contours: true,
    shell: true,
    halo: true,
    core: true,
    neck: true,
    rings: true,
    dust: true,
    landscape: true,
    post: true,
    hud: true,
  },

  // Ali round 1: z 5.5 → 6.0 to give the rings and head some air
  camera: { position: [0, 1.0, 6.0], hfov: 54, lookAt: [0, 1.05, 0], near: 0.1, far: 200 },

  render: { antialias: true },

  motion: {
    reducedMotion: "auto",
    cameraDrift: { x: 0.05, period: 12 },
    goldShimmer: { from: 0.6, to: 0.9, period: 9 },
    ringBreath: { amount: 0.03, period: 6, stagger: 0.7 },
    neckPulse: { strands: [1, 4], dash: 0.05, gap: 0.5, speed: 0.3 },
  },
  perf: { dprCapWidth: 1000, dprCap: 1.5, dprMax: 2, mobileWidth: 768, mobileCountFactor: 0.5 },

  // Ali's starting sizes (landscape nodes 0.03–0.07) were ~2 px at this depth: edges dominated.
  // ×3 made the nodes the hero (docs/screens/phase-10/10-1.png); ratios unchanged.
  // Phase 11.1 (Ali): 3 → 1.5 — "density makes the glow, not point size".
  particles: { sizeScale: 1.5 },

  palette: {
    bgTop: "#020B1F",
    bgBottom: "#082041",
    // Phase 11.2 (Ali): fill was #041634 — the bust read as a solid teal block.
    // Phase 12.1 (Ali): fill #020C22 → #010818 and edge #9BE9FF → #C8F4FF — darker interior, a
    // colder/brighter rim, so the boosted lines have more contrast to bloom out of.
    fill: "#010818",
    line: "#35C8FF",
    edge: "#C8F4FF",
    core: "#FF9A3C",
    coreHot: "#FFE2B0", // Phase 12.4 (Ali): the white-hot centre of the face core
    gold: "#FFC247",
    landscape: "#2FA8FF",
  },

  bust: {
    source: "glb",
    // scale 1.6: head 0.75 → 1.2 tall; offset: head centre (0, 0.5) → (0, 1.45), face front z ≈ 0.5
    glb: {
      url: "/avatar/bust.glb",
      scale: 1.6,
      offset: [0, 0.65, -0.2],
      armCrop: { xMin: 0.6, yMin: -0.89, yMax: -0.2 },
      skirtBelow: -0.75,
      skirtTo: -3.0, // round 3: the bottom edge never shows at any aspect
      // eye slits: lids at z ≈ 0.38, slit y 0.352–0.389, eyeball at z ≈ 0.245 (measured)
      cavities: [
        {
          yMin: 0.3,
          yMax: 0.46,
          xMin: 0.04,
          xMax: 0.22,
          zMin: 0.2,
          sheetZ: 0.33,
          recess: 0.004,
          feather: 0.03,
        },
      ],
    },
    // Phase 11.2 (Ali): the density pass on the shell — "a soft glowing mist at the silhouette,
    // not visible dots". 25k → 80k points at half the size (0.01–0.025 → 0.005–0.0125), and the
    // alpha curve drops on both ends (0.15 + 0.85·fresnel → 0.03 + 0.6·fresnel) so the front face
    // stays readable and the rim glows without the individual sprites showing. No pulse: the
    // shell tint is static (Ali).
    // Phase 12.3 (Ali): the shell backs the halo up — 80k → 120k points and the rim alpha
    // 0.6 → 0.9, so the mist at the silhouette is as dense and bright as the glow it sits under.
    // The base alpha stays 0.03: the front face must not fill in.
    shell: {
      count: 120000,
      push: [0.01, 0.04],
      size: [0.005, 0.0125],
      alphaMin: 0.03,
      // Phase 13.1 (Ali): rim alpha 0.9 → 1.0 — the outline glow comes from the particles
      alphaRim: 1.0,
      opacity: 1,
      seed: 13,
    },
    // Phase 13.1 (Ali): halo alpha 0.9 → 0.45 — the halo mesh backs the particle outline, not the reverse
    halo: { scale: 1.015, color: "#9BE9FF", alpha: 0.45, fresnelPower: 2 },
    headCenter: [0, 1.45, 0],
    headRadius: 0.5,
    headScaleY: 1.2,
    neckRadius: 0.2,
    neckTop: 1.05,
    neckBottom: 0.75,
    shoulderCenter: [0, 0.25, 0],
    shoulderRadii: [1.5, 0.5, 0.55],
    chestCenter: [0, -0.45, 0],
    chestSize: [2.0, 1.0, 1.0],
  },

  // plan: frequency 90. At this camera 90 slices/unit are 0.7 px lines that bloom into a solid
  // cyan haze (docs/screens/phase-8-alt-plan-values.png); 45 matches the reference's ~45 lines
  // on the head and keeps dark fill between them (Phase 3/8 acceptance).
  // Ali round 1 Phase 3: lineWidth 0.10 → 0.05, rim 0.6 → 0.9, exact line colour (boost 0)
  // Phase 11.2 (Ali): lineWidth 0.05 → 0.04 with the darker `palette.fill` — the lines must be
  // visibly separated by dark, not merge into one teal block.
  // Phase 12.1 (Ali): lineBoost 0 → 0.4 (multiplier 1.4) — see the key's comment.
  // Phase 13.1 (Ali): the bust read as a solid bright block — lineBoost back to 0 (multiplier
  // 1.0, on the bust only; particle brightnesses stay) and lineWidth 0.04 → 0.03 so the interior
  // is dark navy between the lines again.
  contours: {
    frequency: 45,
    lineWidth: 0.03,
    fresnelPower: 2.5,
    rimStrength: 0.9,
    lineBoost: 0,
    scrollSpeed: 0.05,
    beads: { enabled: true, frequency: 140, min: 0.35 },
  },

  // plan: [0, 1.5, 0.45] for the sphere head; the mesh's face (eyes y ≈ 1.35, mouth ≈ 1.08)
  // sits lower than a sphere's centre, so the glow is centred on it at y 1.3
  core: {
    center: [0, 1.3, 0.45],
    // round 3 (optional, single value): 0.35 → 0.42. Phase 12.4 (Ali): 0.42 → 0.5 — the core
    // dominates the mid-face
    radius: 0.5,
    pulseSpeed: 1.5,
    pulseAmount: 0.15,
    glow: { size: 0.9, z: 0.72, alpha: 0.9, brightness: 1.5, scalePulse: 0.5 },
    // Phase 13.1 (Ali): white-hot mix 40 % → 25 % of the core radius — the centre reads
    // gold-orange, not yellow-white
    hot: { radius: 0.25 },
  },

  // plan: jawY 1.02 / controlY 0.75 / nodeY 0.42 for the sphere-head bust. On the mesh the chin
  // bottom is at y ≈ 0.89 and the sternum notch at ≈ 0.12, so the strands start under the jaw at
  // 0.95, converge at 0.15, and the control point keeps the plan's 45 % position between them.
  // Ali round 1 Phase 5: strands start at the chin bottom (measured world y 0.70 → jawY 0.67),
  // control point (x·0.6, midpoint y), sternum node doubled (points, spread, spokes, size)
  // Phase 12.6 (Ali): 2 extra strands per side (10), further out on the neck; depth-2 branches;
  // bead brightness ×1.3; the sternum node becomes a blooming nucleus fed by the gold nerves.
  neck: {
    jawY: 0.67,
    // round 2 item 3: jaw x scaled by 0.75, control x 0.6·x → 1.3·x (bow outward along the neck)
    // Phase 12.6: ±0.22 and ±0.27 added outside the original six
    jawXs: [-0.27, -0.22, -0.165, -0.105, -0.045, 0.045, 0.105, 0.165, 0.22, 0.27],
    nodeY: 0.15,
    controlY: 0.41,
    controlXFactor: 1.3,
    lineWidth: 1.5,
    opacity: 0.15, // Phase 11.3 (Ali): was 0.3 — the beads and branches carry the strand now
    cylinderRadius: 0.3, // Phase 12.6: the strands' cylinder, wider than bust.neckRadius (0.2)
    lift: 0.02,
    points: 40,
    // Phase 11.3 (Ali): 60 → 120 beads, size ×0.7, brightness per bead
    // Phase 12.6 (Ali): brightness ×1.3 (0.5–1.0 → 0.65–1.3) and applied as a colour multiplier,
    // so the top of the range is above 1 and feeds the bloom instead of just fading the bead
    strandPoints: { perStrand: 120, size: [0.014, 0.021], opacity: 1, brightness: [0.65, 1.3] },
    branches: {
      perStrand: [2, 3],
      at: [0.3, 0.7],
      length: [0.12, 0.3],
      angle: [0.5, 1.1],
      beadsPerUnit: 200,
      depth: 2,
      sub: { perBranch: [1, 2], at: [0.4, 0.8], lengthFactor: 0.5 },
      endBead: { size: 0.05, opacity: 1 },
    },
    nucleus: {
      points: 300,
      radius: 0.08,
      coreRadius: 0.05,
      coreBrightness: 2.5,
      ringBrightness: 1.6,
      pointSize: 0.02,
      spokes: 6,
      spokeLength: 0.1,
      core: { size: 0.12, opacity: 1, brightness: 3 },
    },
    seed: 5,
  },

  // Ali round 1 Phase 6: 9 rings, outer radius 0.9 + 8·0.25 = 2.9 (≤ 2.9), opacity 0.4 → 0.03
  // Phase 10.4 (Ali): the annuli drop to ×0.6 and carry 250 beads each (Phase 11.4 moved the
  // drifting dust out to its own `dust` layer)
  // Phase 12.5 (Ali): "rings → particle rings" — 250 → 1,500 beads per ring with a noise-driven
  // angular density (dense arcs and sparse ones) and a 0.5–1.2 per-bead brightness, over an
  // annulus dimmed ×0.4 (0.6 → 0.24): the beads are the ring now, the line is only its guide.
  rings: {
    center: [0, 1.45, -1.3],
    count: 9,
    innerRadius: 0.9,
    step: 0.25,
    thickness: 0.008,
    opacityFrom: 0.4,
    opacityTo: 0.03,
    segments: 160,
    geometryOpacity: 0.24,
    points: {
      perRing: 1500,
      radialJitter: 0.03,
      size: 0.02,
      opacity: 1,
      brightness: [0.5, 1.2],
      density: { scale: 3, floor: 0.15 },
      noiseSeed: 29,
      seed: 17,
    },
  },

  // Phase 11.4 (Ali): the density pass on the air itself — 2,500 dust points in a 6 × 4 × 3
  // box around the bust (the Phase 10.4 400-point disc on `rings.drift` was too sparse to read
  // as atmosphere), plus a 1,500-point plume spraying out of the crown. The crown y is the
  // canonical head top 0.9 × `bust.glb.scale` 1.6 + `bust.glb.offset` y 0.65 = 2.09.
  // Phase 12.7 (Ali): the ambient pass of the glow phase — "a visible particle plume above the
  // head, dust everywhere". Dust 2,500 → 8,000 at ×3 the size variance, so the haze has near
  // specks and far ones instead of one uniform grain; the plume 1,500 → 5,000 out of a wider
  // base (0.25 → 0.35) and half a unit higher (1.2 → 1.6) at ×1.5 the colour. Both counts —
  // like every count in the scene — halve below `perf.mobileWidth` (motion.ts `sceneCount`).
  dust: {
    ambient: {
      center: [0, 0.8, -0.4],
      size: [6, 4, 3],
      count: 8000,
      pointSize: 0.01,
      opacity: 0.35,
      // Phase 12.7: size variance ×3 — the ±0.4 spread becomes ±1.2, clamped at 0.2 so no
      // sprite vanishes
      sizeJitter: [0.2, 2.2],
      opacityJitter: [0.5, 1],
      drift: { amount: 0.08, period: 12 },
      seed: 19,
    },
    plume: {
      crown: [0, 2.09, 0],
      baseRadius: 0.35,
      topRadius: 0.1,
      height: 1.6,
      period: 6,
      speedJitter: [0.7, 1.3],
      wobble: 0.04,
      count: 5000,
      pointSize: 0.015,
      opacity: 0.6,
      brightness: 1.5,
      seed: 23,
    },
  },

  // Ali round 1 Phase 7: amplitude 1.6 → 1.0, ridge lowScale 0.55 → 0.35 (broader peaks),
  // points 0.025 → 0.04 at opacity 0.9
  // Phase 10.1 (Ali): plexus network — jitter 0.06 breaks the grid, k ∈ {2, 3} nearest
  // neighbours replace the grid-neighbour rule and the dropout, gold at 1.5× its own size.
  // Phase 11.1 (Ali): the density pass — "density makes the glow, not point size". The grid goes
  // 42 × 14 → 160 × 40 (6,440 nodes per side); the z range is unchanged, so zStep drops to
  // 13·0.35/39 = −0.1167 and the far row still lands at z ≈ −5.05 with the same slope
  // contribution. Shorter edges (0.35 → 0.12) and fainter ones (0.25 → 0.12) keep the denser
  // grid from reading as a solid mesh, nodes halve (0.03–0.07 → 0.015–0.035) and gold drops
  // 12 % → 8 %; amplitude 1.4 → 2.0 under the new `rise` factor pushes the outer ridges up to
  // head height; the bottom fade tightens to the frame edge and the dust goes 300 → 4,000 per
  // side within 0.25 of the surface.
  // Phase 12.2 (Ali): the ridge lines — "bright flowing ridge lines on a dimmer dense slope".
  // The grid goes 160 × 40 → 200 × 60 (201 × 60 = 12,060 nodes per side, Ali's 12,000); the z
  // range is unchanged again, so zStep drops to 13·0.35/59 = −0.0771 and the far row still lands
  // at z ≈ −5.05. Edges fade 0.12 → 0.10 so the extra density stays a haze, and the new `crest`
  // block carries the emphasis: the top 15 % of every column at 1.6× size and 2× colour, half of
  // them gold, plus 1,500 gold dust per side hugging the skyline. `goldRatio` is gone — gold is
  // a share of the crest now, not a height²-weighted draw over the whole surface.
  landscape: {
    xStart: 1.2,
    xEnd: 4.0,
    cols: 230,
    rows: 70,
    zStart: -0.5,
    // −13·0.35/69: rows 60 → 70 over the same z range, far row at z ≈ −5.05 as in round 3.
    // Phase 13.2 (Ali): 16,000 nodes per side — (230 + 1) × 70 = 16,170, and the z step shrinks
    // with the row count so the range the rows cover is exactly the one round 3 framed.
    zStep: -0.06594,
    // round 3: a heightfield sloping down toward the viewer; peaks around neck height
    // Phase 11.1: base at the frame's bottom edge (y ≈ −0.86 at the near row) so the slope fills
    // each side from the bottom up; at −1.2 the near 30 rows sat under the fade window
    baseY: -0.7,
    amplitude: 2.0,
    slope: 0.2,
    fade: [-0.75, -0.45],
    rise: [1.2, 4.0],
    ridge: { lowScale: 0.35, lowWeight: 0.7, highScale: 0.9, highWeight: 0.25 },
    jitter: 0.06,
    neighbors: [2, 3],
    maxEdge: 0.12,
    nodeSize: [0.015, 0.035],
    nodeOpacity: 0.9,
    // Phase 13.2 (Ali): 0.10 → 0.05 — the edges are hints under the particle mass now
    edgeOpacity: 0.05,
    crest: {
      ratio: 0.15,
      sizeFactor: 1.6,
      brightness: 2,
      goldShare: 0.5,
      dust: { count: 1500, size: 0.01, opacity: 0.6, radius: 0.1 },
    },
    goldSizeFactor: 1.5,
    goldOpacity: 0.8,
    // Phase 13.2 (Ali): 4,000 → 15,000 per side, per-point size range, alpha 0.4 → 0.35
    dust: { count: 15000, size: [0.008, 0.015], opacity: 0.35, radius: 0.25 },
    noiseSeed: 7,
    seed: 11,
  },

  // plan: bloomIntensity 1.3 (pmndrs ≈ strength 0.43 after ÷ 3.0 mip-weight total) and
  // threshold 0.55. With three's linear-luminance bloom those numbers haze the whole bust while
  // gold (0.54), rings (≤ 0.25) and the blue landscape (0.13) never cross the threshold; strength
  // 0.25 / threshold 0.3 give the plan's "everything bright glows softly, fill and background do
  // not" (alt at the plan values: docs/screens/phase-8-alt-plan-values.png). radius 0.8 mirrors
  // pmndrs' coarse-heavy mipmap default.
  // Phase 12.1 (Ali): "bloomIntensity 1.6 → 2.2, threshold 0.4 → 0.3, bloom radius ×1.3", with the
  // scene buffer made explicitly half-float (Effects.tsx) so the boosted lines feed bloom unclipped.
  post: {
    // Ali round 1 Phase 8: intensity 1.6 → strength 1.6 / 3.0 = 0.53 (see the key's comment)
    // Phase 12.1 (Ali): intensity 2.2 → strength 2.2 / 3.0 = 0.733
    bloomStrength: 0.733,
    // Ali asked for radius ×1.3 (0.8 → 1.04); capped at BloomNode's documented maximum of 1.
    // 1.0 is already the *full mirror* of the mip weights — [1, .8, .6, .4, .2] becomes
    // [.2, .4, .6, .8, 1], the coarsest possible bias, i.e. the widest glow this control can make.
    // Above 1 the shader's `mix` is not clamped, so 1.04 would extrapolate 4 % past the mirror
    // (finest-mip weight 0.2 → 0.168, coarsest 1.0 → 1.032) — outside the documented [0,1] range,
    // and a change too small to see. Wider glow beyond this needs strength/threshold, not radius.
    bloomRadius: 1,
    bloomThreshold: 0.3,
    bloomSmoothing: 0.3,
    bloomResolutionScale: 1,
    vignetteOffset: 0.3,
    vignetteDarkness: 0.7,
  },

  hud: {
    text: "STATUS: LISTENING",
    top: 24,
    right: 28,
    fontSize: 11,
    letterSpacing: "0.18em",
    opacity: 0.75,
    dotSize: 6,
  },

  stars: {
    count: 400,
    radius: 60,
    depth: 20,
    size: 0.08,
    opacity: 0.3,
    aspect: 2.2,
    margin: 1.1,
    sizeJitter: [0.6, 1.4],
    opacityJitter: [0.5, 1],
    tint: 0.35,
    seed: 2026,
  },
};
