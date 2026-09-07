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

/** Landscape columns per side: `cols` scaled by `mobileColsFactor` below `mobileWidth` px
 *  (plan Phase 9: "halve landscape.cols on mobile"). */
export function landscapeCols(width: number, cols: number, perf: SceneConfig["perf"]): number {
  return width < perf.mobileWidth ? Math.round(cols * perf.mobileColsFactor) : cols;
}

/** The scene's answer for this page load: config setting + OS preference. Read once at build
 *  time by each animated layer (the OS preference does not change mid-session in practice). */
export function sceneMotionEnabled(): boolean {
  return motionEnabled(sceneConfig.motion.reducedMotion, prefersReducedMotion());
}
