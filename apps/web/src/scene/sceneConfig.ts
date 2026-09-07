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
  camera: { position: Vec3; fov: number; lookAt: Vec3; near: number; far: number };
  render: {
    /** 4× MSAA on the scene pass (the fat lines and the thin rings need it for smooth edges);
     *  off = 1 sample. `?set=render.antialias:false` on the bench */
    antialias: boolean;
  };
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
     *  fill; where strands cross contour lines they cover them instead of letting 10 % through */
    opacity: number;
    /** how far in front of the neck cylinder the strands sit (plan: 0.02) */
    lift: number;
    /** samples per strand (plan: 40) */
    points: number;
    /** sternum node: cluster points + spread, radiating spokes + length, point size in
     *  PointsMaterial units (plan: 0.02; converted to a sprite size at render time) */
    node: {
      points: number;
      spread: number;
      spokes: number;
      spokeLength: number;
      pointSize: number;
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
  };
  landscape: {
    xStart: number;
    xEnd: number;
    /** number of x intervals per side: cols + 1 points, x reaching xEnd (plan `0..cols`) */
    cols: number;
    /** exact row count. The plan's `0..rows` could also read as rows + 1 (7 rows, z to −2.9);
     *  6 rows are built — Ali's call if the deeper grid is wanted */
    rows: number;
    zStart: number;
    zStep: number;
    baseY: number;
    amplitude: number;
    /** smoothstep edges on |x| that keep the ridges off the bust: [start, end] (plan 1.2, 2.2;
     *  the plan's feedback example "falloff start 1.2 → 1.6" tunes `falloff[0]`) */
    falloff: [number, number];
    /** y dropped per row going back (plan 0.05) */
    rowSink: number;
    /** two-octave ridge: noise2D(x·lowScale, j·rowScale)·lowWeight +
     *  noise2D(x·highScale, j·rowScale)·highWeight (plan 0.55/0.7, 1.6/0.25, row 0.7) */
    ridge: {
      lowScale: number;
      lowWeight: number;
      highScale: number;
      highWeight: number;
      rowScale: number;
    };
    dropout: number;
    goldRatio: number;
    /** PointsMaterial units (px = size · H/2 / depth); converted to a sprite size at render time */
    pointSize: number;
    pointOpacity: number;
    blueOpacity: number;
    goldOpacity: number;
    /** simplex noise seed for the ridges and rng seed for the edge dropout */
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
    core: true,
    neck: true,
    rings: true,
    landscape: true,
    post: true,
    hud: true,
  },

  camera: { position: [0, 1.0, 5.5], fov: 32, lookAt: [0, 1.05, 0], near: 0.1, far: 200 },

  render: { antialias: true },

  palette: {
    bgTop: "#020B1F",
    bgBottom: "#082041",
    fill: "#041634",
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
      skirtTo: -1.6,
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
  contours: {
    frequency: 45,
    lineWidth: 0.05,
    fresnelPower: 2.5,
    rimStrength: 0.9,
    lineBoost: 0,
    scrollSpeed: 0.05,
  },

  // plan: [0, 1.5, 0.45] for the sphere head; the mesh's face (eyes y ≈ 1.35, mouth ≈ 1.08)
  // sits lower than a sphere's centre, so the glow is centred on it at y 1.3
  core: {
    center: [0, 1.3, 0.45],
    radius: 0.35,
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
    jawXs: [-0.22, -0.14, -0.06, 0.06, 0.14, 0.22],
    nodeY: 0.15,
    controlY: 0.41,
    controlXFactor: 0.6,
    lineWidth: 1.5,
    opacity: 0.9,
    lift: 0.02,
    points: 40,
    node: { points: 20, spread: 0.06, spokes: 6, spokeLength: 0.1, pointSize: 0.04 },
    seed: 5,
  },

  // Ali round 1 Phase 6: 9 rings, outer radius 0.9 + 8·0.25 = 2.9 (≤ 2.9), opacity 0.4 → 0.03
  rings: {
    center: [0, 1.45, -1.3],
    count: 9,
    innerRadius: 0.9,
    step: 0.25,
    thickness: 0.008,
    opacityFrom: 0.4,
    opacityTo: 0.03,
    segments: 160,
  },

  // Ali round 1 Phase 7: amplitude 1.6 → 1.0, ridge lowScale 0.55 → 0.35 (broader peaks),
  // dropout 0.35 → 0.55, points 0.025 → 0.04 at opacity 0.9
  landscape: {
    xStart: 1.2,
    xEnd: 4.0,
    cols: 70,
    rows: 6,
    zStart: -0.5,
    zStep: -0.4,
    baseY: -0.6,
    amplitude: 1.0,
    falloff: [1.2, 2.2],
    rowSink: 0.05,
    ridge: { lowScale: 0.35, lowWeight: 0.7, highScale: 1.6, highWeight: 0.25, rowScale: 0.7 },
    dropout: 0.55,
    goldRatio: 0.1,
    pointSize: 0.04,
    pointOpacity: 0.9,
    blueOpacity: 0.35,
    goldOpacity: 0.8,
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
    bloomStrength: 0.25,
    bloomRadius: 0.8,
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
