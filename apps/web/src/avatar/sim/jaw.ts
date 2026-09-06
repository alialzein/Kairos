import { ANCHORS } from "./canonical";

/** The talking jaw (polish T1 → look v2 L8): one set of constants shared by the particle
 *  kernel (TSL, sim/compute.ts) and the line bust's CPU updater (lines/LineBust.ts), so the
 *  dust and the wireframe move as one mouth. */
export const JAW = {
  /** open/close oscillation, rad/s */
  rate: 9,
  /** maximum drop in canonical units at full speech energy */
  drop: 0.09,
  /** radial falloff from the mouth anchor: full inside rInner, zero beyond rOuter */
  rOuter: 0.26,
  rInner: 0.06,
  /** vertical band below the mouth: full below yBot, zero above yTop (relative to the anchor) */
  yTop: 0.03,
  yBot: -0.05,
  /** forward component of the drop (z = drop × forward) */
  forward: 0.3,
} as const;

const smoothstep = (e0: number, e1: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/** Open/close amount 0..1 for a given time and speech energy. */
export function jawOpen(timeS: number, speak: number): number {
  return speak * (Math.sin(timeS * JAW.rate) * 0.5 + 0.5);
}

/** Displacement [dx, dy, dz] of a point at (x, y, z) for a given open amount — mirrors the
 *  kernel: drop = open · JAW.drop · smoothstep(rOuter→rInner, dist) · smoothstep(yTop→yBot, dy). */
export function jawOffset(x: number, y: number, z: number, open: number): [number, number, number] {
  const dx = x - ANCHORS.mouth[0];
  const dy = y - ANCHORS.mouth[1];
  const dz = z - ANCHORS.mouth[2];
  const dist = Math.hypot(dx, dy, dz);
  const radial = smoothstep(JAW.rOuter, JAW.rInner, dist);
  const band = smoothstep(JAW.yTop, JAW.yBot, dy);
  const drop = open * JAW.drop * radial * band;
  if (drop === 0) return [0, 0, 0]; // avoid -0 (a real zero keeps deep-equality checks honest)
  return [0, -drop, drop * JAW.forward];
}
