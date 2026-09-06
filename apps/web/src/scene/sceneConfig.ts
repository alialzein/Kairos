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
    scrollSpeed: number;
  };
  core: {
    center: Vec3;
    radius: number;
    pulseSpeed: number;
    pulseAmount: number;
    /** Phase 4 glow billboard: plane size (plan 0.9), z just in front of the face surface
     *  (the mesh's nose tip is at z ≈ 0.61), centre alpha */
    glow: { size: number; z: number; alpha: number };
  };
  neck: {
    jawY: number;
    jawXs: number[];
    nodeY: number;
    /** y of each strand's bezier control point (plan: 0.75, between jaw and node) */
    controlY: number;
    /** fat-line width in CSS px (drei <Line lineWidth>) */
    lineWidth: number;
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
  };
  landscape: {
    xStart: number;
    xEnd: number;
    cols: number;
    rows: number;
    zStart: number;
    zStep: number;
    baseY: number;
    amplitude: number;
    dropout: number;
    goldRatio: number;
    pointSize: number;
  };
  post: {
    bloomIntensity: number;
    bloomThreshold: number;
    bloomSmoothing: number;
    vignetteDarkness: number;
  };
  /** Phase 1 starfield. Adapted from drei `<Stars radius depth count factor>`: stars are placed
   *  inside the camera's view cone (not a full sphere) so `count` is the number actually on
   *  screen, and `size` is a world-space sprite size at `radius` (≈ 2 px at 800 px tall). */
  stars: {
    count: number;
    radius: number;
    depth: number;
    size: number;
    opacity: number;
    /** widest aspect ratio the cone must cover */
    aspect: number;
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

  contours: { frequency: 90, lineWidth: 0.1, fresnelPower: 2.5, scrollSpeed: 0.05 },

  // plan: [0, 1.5, 0.45] for the sphere head; the mesh's face (eyes y ≈ 1.35, mouth ≈ 1.08)
  // sits lower than a sphere's centre, so the glow is centred on it at y 1.3
  core: {
    center: [0, 1.3, 0.45],
    radius: 0.35,
    pulseSpeed: 1.5,
    pulseAmount: 0.15,
    glow: { size: 0.9, z: 0.72, alpha: 0.9 },
  },

  // plan: jawY 1.02 / controlY 0.75 / nodeY 0.42 for the sphere-head bust. On the mesh the chin
  // bottom is at y ≈ 0.89 and the sternum notch at ≈ 0.12, so the strands start under the jaw at
  // 0.95, converge at 0.15, and the control point keeps the plan's 45 % position between them.
  neck: {
    jawY: 0.95,
    jawXs: [-0.22, -0.14, -0.06, 0.06, 0.14, 0.22],
    nodeY: 0.15,
    controlY: 0.59,
    lineWidth: 1.5,
    opacity: 0.9,
    lift: 0.02,
    points: 40,
    node: { points: 10, spread: 0.03, spokes: 6, spokeLength: 0.05, pointSize: 0.02 },
    seed: 5,
  },

  rings: {
    center: [0, 1.45, -1.3],
    count: 9,
    innerRadius: 0.9,
    step: 0.25,
    thickness: 0.008,
    opacityFrom: 0.5,
    opacityTo: 0.06,
  },

  landscape: {
    xStart: 1.2,
    xEnd: 4.0,
    cols: 70,
    rows: 6,
    zStart: -0.5,
    zStep: -0.4,
    baseY: -0.6,
    amplitude: 1.6,
    dropout: 0.35,
    goldRatio: 0.1,
    pointSize: 0.025,
  },

  post: { bloomIntensity: 1.3, bloomThreshold: 0.55, bloomSmoothing: 0.3, vignetteDarkness: 0.7 },

  stars: { count: 400, radius: 60, depth: 20, size: 0.08, opacity: 0.3, aspect: 2.2, seed: 2026 },
};
