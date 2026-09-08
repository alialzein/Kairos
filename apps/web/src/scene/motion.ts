import { sceneConfig, type SceneConfig } from "./sceneConfig";

export type ReducedMotion = SceneConfig["motion"]["reducedMotion"];

/** Whether the scene animates: "auto" follows the OS `prefers-reduced-motion`, "reduce" holds
 *  the scene still, "full" animates regardless (Phase 9, reduced-motion for the shader
 *  animations; the HUD dot already honours the media query in CSS). */
export function motionEnabled(setting: ReducedMotion, prefersReduced: boolean): boolean {
  if (setting === "reduce") return false;
  if (setting === "full") return true;
  return !prefersReduced;
}

/** The OS preference, false when there is no window (SSR) or no matchMedia. */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Device pixel ratio for the canvas (plan Phase 9: cap at `dprCap` below `dprCapWidth` px,
 *  `dprMax` above — the plan's `dpr={[1, 2]}`). */
export function dprFor(width: number, devicePixelRatio: number, perf: SceneConfig["perf"]): number {
  const cap = width < perf.dprCapWidth ? perf.dprCap : perf.dprMax;
  return Math.max(1, Math.min(devicePixelRatio, cap));
}

/** Any sprite/vertex count scaled by `mobileCountFactor` below `mobileWidth` px (Phase 12.7:
 *  "halve every count on mobile" — the budget rule of the glow phase). Pure: the width is the
 *  caller's, so the same helper serves the layers, the tests and `pointBudget`. */
export function mobileCount(width: number, count: number, perf: SceneConfig["perf"]): number {
  return width < perf.mobileWidth ? Math.round(count * perf.mobileCountFactor) : count;
}

/** Landscape columns per side: `cols` scaled by `mobileCountFactor` below `mobileWidth` px
 *  (plan Phase 9: "halve landscape.cols on mobile"). Kept under its own name because the
 *  landscape halves a grid dimension, not a point count — the factor is the same. */
export function landscapeCols(width: number, cols: number, perf: SceneConfig["perf"]): number {
  return mobileCount(width, cols, perf);
}

/** The count this page load should build: `mobileCount` at the current viewport width, against
 *  the live `sceneConfig.perf`. SSR-safe — with no `window` (server render, node tests) it is the
 *  configured count. The one helper every layer calls; layers pass the result into their
 *  generator as an override (`{ ...cfg, count: sceneCount(cfg.count) }`), never by mutating
 *  `sceneConfig`. Read once at build time, like `sceneMotionEnabled`. */
export function sceneCount(count: number): number {
  const scaled = scaledCount(count, sceneConfig.particles.countScale);
  if (typeof window === "undefined") return scaled;
  return mobileCount(window.innerWidth, scaled, sceneConfig.perf);
}

/** A sprite count × `particles.countScale` (Phase 14: the approved density, locked at 1),
 *  applied before the mobile halving. Pure. */
export function scaledCount(count: number, countScale: number): number {
  return Math.round(count * countScale);
}

/** Sprites this config draws at a given viewport width, per layer and in total — the Phase 12
 *  budget rule ("~300k points total on desktop, halve every count on mobile") made checkable.
 *  Counted exactly the way each layer builds it:
 *  - landscape: both sides of a `cols + 1` × `rows` node grid, plus the surface dust and the
 *    crest dust per side (`cols` halves through `landscapeCols`, the dust through `mobileCount`);
 *  - shell / dust / plume / stars: their own counts; rings: `count` rings × `perRing` beads;
 *  - neck: `jawXs.length` strands × `perStrand` beads + the nucleus disc + its one core sprite.
 *  The neck's sub-branch beads are EXCLUDED: their number is rng-dependent (each strand grows
 *  `branches.perStrand` branches, recursed to `branches.depth`, beaded at `beadsPerUnit` along a
 *  length drawn from `branches.length`), so no pure function of the config can state it. They are
 *  a few thousand sprites at the shipped values — the headroom under 300k absorbs them. */
export function pointBudget(
  cfg: SceneConfig,
  width: number,
): {
  landscape: number;
  shell: number;
  rings: number;
  neck: number;
  dust: number;
  plume: number;
  stars: number;
  total: number;
} {
  // every sprite count: × countScale (Phase 14), then the mobile factor — as `sceneCount` does
  const n = (count: number) =>
    mobileCount(width, scaledCount(count, cfg.particles.countScale), cfg.perf);
  const l = cfg.landscape;
  const cols = landscapeCols(width, l.cols, cfg.perf);
  const landscape = 2 * ((cols + 1) * l.rows + n(l.dust.count) + n(l.crest.dust.count));
  const shell = n(cfg.bust.shell.count);
  const rings = cfg.rings.count * n(cfg.rings.points.perRing);
  const neck =
    cfg.neck.jawXs.length * n(cfg.neck.strandPoints.perStrand) + n(cfg.neck.nucleus.points) + 1;
  const dust = n(cfg.dust.ambient.count);
  const plume = n(cfg.dust.plume.count);
  const stars = n(cfg.stars.count);
  const total = landscape + shell + rings + neck + dust + plume + stars;
  return { landscape, shell, rings, neck, dust, plume, stars, total };
}

/** The scene's answer for this page load: config setting + OS preference. Read once at build
 *  time by each animated layer (the OS preference does not change mid-session in practice). */
export function sceneMotionEnabled(): boolean {
  return motionEnabled(sceneConfig.motion.reducedMotion, prefersReducedMotion());
}
