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
  "core",
  "neck",
  "rings",
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
    mobileColsFactor: number;
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
     *  threshold"); it pushed #35C8FF past white into green-cyan, so Ali's "line must be exactly
     *  #35C8FF" sets it to 0 — bloom now comes from the threshold alone */
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
     *  fraction of `pulseAmount` (the opacity pulses at the full amount) */
    glow: { size: number; z: number; alpha: number; scalePulse: number };
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
     *  Phase 10.4: the line under the beads */
    opacity: number;
    /** how far in front of the neck cylinder the strands sit (plan: 0.02) */
    lift: number;
    /** samples per strand (plan: 40) */
    points: number;
    /** Phase 10.4 (Ali): each strand becomes `perStrand` gold beads over the line — per-bead
     *  size drawn uniformly from `size` (PointsMaterial units × `particles.sizeScale`) */
    strandPoints: { perStrand: number; size: [number, number]; opacity: number };
    /** sternum node: cluster points + spread, radiating spokes + length, point size in
     *  PointsMaterial units (plan: 0.02; converted to a sprite size at render time), and
     *  (Phase 10.4) one bright `core` sprite at the node centre, same units */
    node: {
      points: number;
      spread: number;
      spokes: number;
      spokeLength: number;
      pointSize: number;
      core: { size: number; opacity: number };
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
    /** Phase 10.4: the annuli at ×0.6 under the beads */
    geometryOpacity: number;
    /** Phase 10.4 (Ali): `perRing` beads scattered along each ring at the mid-annulus radius
     *  ± `radialJitter`, `size` in PointsMaterial units × `particles.sizeScale`, `opacity`
     *  fading with the ring it rides on */
    points: {
      perRing: number;
      radialJitter: number;
      size: number;
      opacity: number;
      seed: number;
    };
    /** Phase 10.4 (Ali): faint dust drifting around the head — `count` points in a disc of
     *  `radius` in x/y around `bust.headCenter`, z uniform in `depth` relative to its z. Each
     *  point drifts by up to `amount` world units on a per-point-hashed sine of TSL time with
     *  period `period` seconds; still under reduced motion. (drei `<Sparkles>` has no WebGPU
     *  equivalent in this repo, so it is the shared Phase 10 sprite with a drift offset.) */
    drift: {
      count: number;
      radius: number;
      size: number;
      opacity: number;
      depth: [number, number];
      amount: number;
      period: number;
      seed: number;
    };
  };
  landscape: {
    xStart: number;
    xEnd: number;
    /** number of x intervals per side: cols + 1 points, x reaching xEnd (plan `0..cols`) */
    cols: number;
    /** exact row count (Phase 11.1: 40 rows, z from zStart back by zStep) */
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
    /** share of all nodes that turn gold, drawn ∝ (normalized height)² without replacement; an
     *  edge with two gold endpoints is a gold edge */
    goldRatio: number;
    /** gold nodes draw at this multiple of their own size (Ali: 1.5×) */
    goldSizeFactor: number;
    goldOpacity: number;
    /** Phase 11.1 (Ali): surface dust — tiny unconnected points per side, each within `radius`
     *  of a node picked uniformly at random (not by height: it is surface dust, not ridge dust) */
    dust: { count: number; size: number; opacity: number; radius: number };
    /** simplex noise seed for the ridges and rng seed for the jitter, sizes, k, gold and dust */
    noiseSeed: number;
    seed: number;
  };
  post: {
    /** three BloomNode.strength — NOT pmndrs `intensity`: three sums five mip blurs with a
     *  fixed weight total of 3.0 and adds linearly, so the plan's intensity 1.3 ≈ 0.43 */
    bloomStrength: number;
    /** BloomNode radius (0..1 mip re-weighting; pmndrs' radius is a different quantity) */
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
    core: true,
    neck: true,
    rings: true,
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
  perf: { dprCapWidth: 1000, dprCap: 1.5, dprMax: 2, mobileWidth: 768, mobileColsFactor: 0.5 },

  // Ali's starting sizes (landscape nodes 0.03–0.07) were ~2 px at this depth: edges dominated.
  // ×3 made the nodes the hero (docs/screens/phase-10/10-1.png); ratios unchanged.
  // Phase 11.1 (Ali): 3 → 1.5 — "density makes the glow, not point size".
  particles: { sizeScale: 1.5 },

  palette: {
    bgTop: "#020B1F",
    bgBottom: "#082041",
    fill: "#020C22", // Phase 11.2 (Ali): was #041634 — the bust read as a solid teal block
    line: "#35C8FF",
    edge: "#9BE9FF",
    core: "#FF9A3C",
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
    shell: {
      count: 80000,
      push: [0.01, 0.04],
      size: [0.005, 0.0125],
      alphaMin: 0.03,
      alphaRim: 0.6,
      opacity: 1,
      seed: 13,
    },
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
  contours: {
    frequency: 45,
    lineWidth: 0.04,
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
    radius: 0.42, // round 3 (optional, single value): 0.35 → 0.42
    pulseSpeed: 1.5,
    pulseAmount: 0.15,
    glow: { size: 0.9, z: 0.72, alpha: 0.9, scalePulse: 0.5 },
  },

  // plan: jawY 1.02 / controlY 0.75 / nodeY 0.42 for the sphere-head bust. On the mesh the chin
  // bottom is at y ≈ 0.89 and the sternum notch at ≈ 0.12, so the strands start under the jaw at
  // 0.95, converge at 0.15, and the control point keeps the plan's 45 % position between them.
  // Ali round 1 Phase 5: strands start at the chin bottom (measured world y 0.70 → jawY 0.67),
  // control point (x·0.6, midpoint y), sternum node doubled (points, spread, spokes, size)
  neck: {
    jawY: 0.67,
    // round 2 item 3: jaw x scaled by 0.75, control x 0.6·x → 1.3·x (bow outward along the neck)
    jawXs: [-0.165, -0.105, -0.045, 0.045, 0.105, 0.165],
    nodeY: 0.15,
    controlY: 0.41,
    controlXFactor: 1.3,
    lineWidth: 1.5,
    opacity: 0.3,
    lift: 0.02,
    points: 40,
    strandPoints: { perStrand: 60, size: [0.02, 0.03], opacity: 1 },
    node: {
      points: 40,
      spread: 0.06,
      spokes: 6,
      spokeLength: 0.1,
      pointSize: 0.04,
      core: { size: 0.12, opacity: 1 },
    },
    seed: 5,
  },

  // Ali round 1 Phase 6: 9 rings, outer radius 0.9 + 8·0.25 = 2.9 (≤ 2.9), opacity 0.4 → 0.03
  // Phase 10.4 (Ali): the annuli drop to ×0.6 and carry 250 beads each; 400 drifting dust
  // points fill a 3.5-unit disc around the head
  rings: {
    center: [0, 1.45, -1.3],
    count: 9,
    innerRadius: 0.9,
    step: 0.25,
    thickness: 0.008,
    opacityFrom: 0.4,
    opacityTo: 0.03,
    segments: 160,
    geometryOpacity: 0.6,
    points: { perRing: 250, radialJitter: 0.03, size: 0.02, opacity: 1, seed: 17 },
    drift: {
      count: 400,
      radius: 3.5,
      size: 0.03,
      opacity: 0.25,
      depth: [-1.3, 0.2],
      amount: 0.06,
      period: 8,
      seed: 19,
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
  landscape: {
    xStart: 1.2,
    xEnd: 4.0,
    cols: 160,
    rows: 40,
    zStart: -0.5,
    // 13·0.35/39: rows 14 → 40 over the same z range, far row at z ≈ −5.05 as in round 3
    zStep: -0.1167,
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
    edgeOpacity: 0.12,
    goldRatio: 0.08,
    goldSizeFactor: 1.5,
    goldOpacity: 0.8,
    dust: { count: 4000, size: 0.01, opacity: 0.4, radius: 0.25 },
    noiseSeed: 7,
    seed: 11,
  },

  // plan: bloomIntensity 1.3 (pmndrs ≈ strength 0.43 after ÷ 3.0 mip-weight total) and
  // threshold 0.55. With three's linear-luminance bloom those numbers haze the whole bust while
  // gold (0.54), rings (≤ 0.25) and the blue landscape (0.13) never cross the threshold; strength
  // 0.25 / threshold 0.3 give the plan's "everything bright glows softly, fill and background do
  // not" (alt at the plan values: docs/screens/phase-8-alt-plan-values.png). radius 0.8 mirrors
  // pmndrs' coarse-heavy mipmap default.
  post: {
    // Ali round 1 Phase 8: intensity 1.6 → strength 1.6 / 3.0 = 0.53 (see the key's comment)
    bloomStrength: 0.533,
    bloomRadius: 0.8,
    bloomThreshold: 0.4,
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
