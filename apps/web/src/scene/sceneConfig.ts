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
  core: { center: Vec3; radius: number; pulseSpeed: number; pulseAmount: number };
  neck: { jawY: number; jawXs: number[]; nodeY: number; lineWidth: number };
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
}

export const sceneConfig: SceneConfig = {
  layers: {
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

  core: { center: [0, 1.5, 0.45], radius: 0.35, pulseSpeed: 1.5, pulseAmount: 0.15 },

  neck: { jawY: 1.02, jawXs: [-0.22, -0.14, -0.06, 0.06, 0.14, 0.22], nodeY: 0.42, lineWidth: 1.5 },

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
};
