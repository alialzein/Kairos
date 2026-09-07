import { sceneConfig } from "./sceneConfig";

/** Vertical fov (degrees) that gives a fixed horizontal fov at the given aspect:
 *  fov = 2·atan(tan(hfov/2) / aspect). Ali, round 2 item 1: framing must be aspect-independent
 *  (a ~1:1 viewport cropped the sides); 54° horizontal reproduces round 1's 32° at 16:9. */
export function verticalFov(hfovDeg: number, aspect: number): number {
  const halfH = (hfovDeg * Math.PI) / 360;
  return (2 * Math.atan(Math.tan(halfH) / Math.max(aspect, 1e-6)) * 180) / Math.PI;
}

/** The vertical fov for the current window (16:9 when there is no window — SSR / tests). The
 *  sprite-size conversions read it once at build time. */
export function currentVerticalFov(): number {
  const aspect =
    typeof window === "undefined" || window.innerHeight === 0
      ? 16 / 9
      : window.innerWidth / window.innerHeight;
  return verticalFov(sceneConfig.camera.hfov, aspect);
}
