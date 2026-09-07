import type { Rng } from "@/avatar/sim/random";
import type { SceneConfig } from "../sceneConfig";

export type Noise2D = (x: number, y: number) => number;

export interface LandscapeMesh {
  /** grid vertices, xyz, both sides */
  points: Float32Array;
  /** kept edges as segment pairs [ax ay az bx by bz, ...], minus the gold ones */
  blue: Float32Array;
  /** `goldRatio` of the kept edges drawn at random with probability ∝ (normalized height)²,
   *  same layout — gold scatters across the peaks on both sides (Ali, round 2 item 2) */
  gold: Float32Array;
  pointCount: number;
  blueCount: number;
  goldCount: number;
}

const smoothstep = (e0: number, e1: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/**
 * Wireframe mountain networks flanking the bust (docs/plans/scene-plan.md Phase 7). Per side a
 * `cols + 1` × `rows` grid (x from xStart to xEnd inclusive, z stepping back by zStep) whose
 * height is a two-octave ridge (`ridge`) from the seeded noise, clamped ≥ 0, scaled by amplitude
 * and a falloff that keeps it off the bust (smoothstep(falloff[0], falloff[1], |x|)), sinking
 * `rowSink` per row. Edges
 * connect (i,j)→(i+1,j), (i,j)→(i,j+1), (i,j)→(i+1,j+1) with `dropout` of them removed by the
 * seeded rng so the mesh reads organic, not as a grid; `goldRatio` of the kept edges are drawn
 * (without replacement, same rng) with probability ∝ (normalized mean height)², so gold
 * scatters over every peak instead of the single tallest ridge (Ali, round 2 item 2 — replaces
 * the plan's "top 10 % by y"). Deterministic for a given noise + rng.
 */
export function landscape(l: SceneConfig["landscape"], noise2D: Noise2D, rng: Rng): LandscapeMesh {
  const cols = l.cols + 1;
  const rows = l.rows;
  const perSide = cols * rows;
  const points = new Float32Array(2 * perSide * 3);
  const index = (side: number, i: number, j: number) => side * perSide + i * rows + j;
  for (let side = 0; side < 2; side++) {
    const sign = side === 0 ? -1 : 1;
    for (let i = 0; i < cols; i++) {
      const x = sign * (l.xStart + (i / l.cols) * (l.xEnd - l.xStart));
      for (let j = 0; j < rows; j++) {
        const z = l.zStart + j * l.zStep;
        const { ridge: r } = l;
        const ridge =
          noise2D(x * r.lowScale, j * r.rowScale) * r.lowWeight +
          noise2D(x * r.highScale, j * r.rowScale) * r.highWeight;
        const falloff = smoothstep(l.falloff[0], l.falloff[1], Math.abs(x));
        const y = l.baseY + Math.max(ridge, 0) * l.amplitude * falloff - j * l.rowSink;
        const k = index(side, i, j) * 3;
        points[k] = x;
        points[k + 1] = y;
        points[k + 2] = z;
      }
    }
  }
  // candidate edges in a fixed order, then a seeded keep/drop per edge
  const kept: [number, number][] = [];
  for (let side = 0; side < 2; side++) {
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const a = index(side, i, j);
        const candidates: [number, number][] = [];
        if (i + 1 < cols) candidates.push([a, index(side, i + 1, j)]);
        if (j + 1 < rows) candidates.push([a, index(side, i, j + 1)]);
        if (i + 1 < cols && j + 1 < rows) candidates.push([a, index(side, i + 1, j + 1)]);
        for (const e of candidates) if (rng() >= l.dropout) kept.push(e);
      }
    }
  }
  const meanY = (e: [number, number]) =>
    ((points[e[0] * 3 + 1] ?? 0) + (points[e[1] * 3 + 1] ?? 0)) * 0.5;
  const heights = kept.map(meanY);
  const minH = Math.min(...heights);
  const maxH = Math.max(...heights);
  const span = maxH - minH || 1;
  const weight = heights.map((h) => ((h - minH) / span) ** 2);
  const goldCount = Math.round(kept.length * l.goldRatio);
  const isGold = new Uint8Array(kept.length);
  // weighted sampling without replacement: each draw walks the remaining weight mass
  let remaining = weight.reduce((a, w) => a + w, 0);
  for (let r = 0; r < goldCount && remaining > 0; r++) {
    let target = rng() * remaining;
    let pick = -1;
    for (let k = 0; k < kept.length; k++) {
      if (isGold[k]) continue;
      target -= weight[k] ?? 0;
      if (target <= 0) {
        pick = k;
        break;
      }
    }
    if (pick < 0)
      for (let k = kept.length - 1; k >= 0; k--)
        if (!isGold[k] && (weight[k] ?? 0) > 0) {
          pick = k;
          break;
        }
    if (pick < 0) break;
    isGold[pick] = 1;
    remaining -= weight[pick] ?? 0;
  }
  const blue = new Float32Array((kept.length - goldCount) * 6);
  const gold = new Float32Array(goldCount * 6);
  let b = 0;
  let g = 0;
  kept.forEach((e, k) => {
    const target = isGold[k] ? gold : blue;
    const at = isGold[k] ? g++ : b++;
    for (let c = 0; c < 3; c++) {
      target[at * 6 + c] = points[e[0] * 3 + c] ?? 0;
      target[at * 6 + 3 + c] = points[e[1] * 3 + c] ?? 0;
    }
  });
  return {
    points,
    blue,
    gold,
    pointCount: 2 * perSide,
    blueCount: kept.length - goldCount,
    goldCount,
  };
}
