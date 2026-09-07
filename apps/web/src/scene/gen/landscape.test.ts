import { describe, expect, it } from "vitest";
import { makeNoise } from "@/avatar/sim/noise";
import { mulberry32 } from "@/avatar/sim/random";
import { sceneConfig } from "../sceneConfig";
import { landscape } from "./landscape";

const cfg = sceneConfig.landscape;
const n3 = makeNoise(1);
const noise2D = (x: number, y: number) => n3(x, y, 0);

describe("landscape (round 3: a heightfield)", () => {
  const m = landscape(cfg, noise2D, mulberry32(2));
  const cols = cfg.cols + 1;
  // candidate edges per side: right, down and diagonal neighbours where they exist
  const full = 2 * ((cols - 1) * cfg.rows + cols * (cfg.rows - 1) + (cols - 1) * (cfg.rows - 1));
  const zFar = cfg.zStart + (cfg.rows - 1) * cfg.zStep;

  it("builds a (cols+1) × rows grid per side inside [xStart, xEnd], sloping up toward the back", () => {
    expect(m.pointCount).toBe(2 * cols * cfg.rows);
    expect(m.points.length).toBe(m.pointCount * 3);
    expect(m.pointFade.length).toBe(m.pointCount);
    for (let p = 0; p < m.pointCount; p++) {
      const ax = Math.abs(m.points[p * 3] ?? 0);
      const y = m.points[p * 3 + 1] ?? 0;
      const z = m.points[p * 3 + 2] ?? 0;
      expect(ax).toBeGreaterThanOrEqual(cfg.xStart - 1e-9);
      expect(ax).toBeLessThanOrEqual(cfg.xEnd + 1e-9);
      expect(y).toBeGreaterThanOrEqual(cfg.baseY - 1e-6);
      expect(y).toBeLessThanOrEqual(
        cfg.baseY + (cfg.zStart - zFar) * cfg.slope + cfg.amplitude + 1e-6,
      );
      expect(z).toBeLessThanOrEqual(cfg.zStart + 1e-9);
      expect(z).toBeGreaterThanOrEqual(zFar - 1e-6);
    }
    // the slope: the far row sits higher than the near row on average
    const rowMean = (j: number) => {
      let s = 0;
      for (let side = 0; side < 2; side++)
        for (let i = 0; i < cols; i++)
          s += m.points[(side * cols * cfg.rows + i * cfg.rows + j) * 3 + 1] ?? 0;
      return s / (2 * cols);
    };
    expect(rowMean(cfg.rows - 1)).toBeGreaterThan(rowMean(0) + 0.5);
  });
  it("is the formula: baseY + (zStart − z)·slope + max(h, 0)·amplitude·falloff, with the noise over world (x, z)", () => {
    const x0 = cfg.falloff[0];
    // at the falloff start the ridge term is 0: pure base + slope per row
    const inner = landscape({ ...cfg, cols: 1, xStart: x0, xEnd: x0 }, () => 1, mulberry32(3));
    for (let p = 0; p < inner.pointCount; p++) {
      const j = p % cfg.rows;
      const z = cfg.zStart + j * cfg.zStep;
      expect(inner.points[p * 3 + 1]).toBeCloseTo(cfg.baseY + (cfg.zStart - z) * cfg.slope, 5);
    }
    // falloff fully open, unit noise: + amplitude × (lowWeight + highWeight)
    const open = landscape(
      { ...cfg, cols: 1, xStart: x0, xEnd: x0, falloff: [0, 1] },
      () => 1,
      mulberry32(3),
    );
    const w = cfg.ridge.lowWeight + cfg.ridge.highWeight;
    for (let p = 0; p < open.pointCount; p++) {
      const j = p % cfg.rows;
      const z = cfg.zStart + j * cfg.zStep;
      expect(open.points[p * 3 + 1]).toBeCloseTo(
        cfg.baseY + (cfg.zStart - z) * cfg.slope + cfg.amplitude * w,
        5,
      );
    }
    // continuous over (x, z): a vertex's height does not depend on how many rows the grid has
    const half = landscape({ ...cfg, rows: Math.floor(cfg.rows / 2) }, noise2D, mulberry32(2));
    for (let i = 0; i < cols; i++)
      for (let j = 0; j < Math.floor(cfg.rows / 2); j++)
        expect(half.points[((i * half.pointCount) / 2 / cols + j) * 3 + 1]).toBeCloseTo(
          m.points[(i * cfg.rows + j) * 3 + 1] ?? 0,
          6,
        );
  });
  it("fades out at the bottom: smoothstep(fade[0], fade[1], y) per vertex and per edge endpoint", () => {
    expect(m.blueFade.length).toBe(m.blueCount * 2);
    expect(m.goldFade.length).toBe(m.goldCount * 2);
    for (let p = 0; p < m.pointCount; p++) {
      const y = m.points[p * 3 + 1] ?? 0;
      const f = m.pointFade[p] ?? -1;
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThanOrEqual(1);
      if (y <= cfg.fade[0]) expect(f).toBe(0);
      if (y >= cfg.fade[1]) expect(f).toBe(1);
    }
    for (let k = 0; k < m.blueCount; k++) {
      const ya = m.blue[k * 6 + 1] ?? 0;
      if (ya >= cfg.fade[1]) expect(m.blueFade[k * 2]).toBe(1);
      if (ya <= cfg.fade[0]) expect(m.blueFade[k * 2]).toBe(0);
    }
  });
  it("keeps roughly (1 − dropout) of the candidate edges; gold is goldRatio of them, height-weighted and scattered", () => {
    const keptCount = m.blueCount + m.goldCount;
    expect(keptCount / full).toBeGreaterThan(1 - cfg.dropout - 0.06);
    expect(keptCount / full).toBeLessThan(1 - cfg.dropout + 0.06);
    expect(m.goldCount).toBe(Math.round(keptCount * cfg.goldRatio));
    expect(m.blue.length).toBe(m.blueCount * 6);
    expect(m.gold.length).toBe(m.goldCount * 6);
    const meanY = (a: Float32Array, k: number) => ((a[k * 6 + 1] ?? 0) + (a[k * 6 + 4] ?? 0)) / 2;
    const avg = (a: Float32Array, n: number) => {
      let s = 0;
      for (let k = 0; k < n; k++) s += meanY(a, k);
      return s / n;
    };
    expect(avg(m.gold, m.goldCount)).toBeGreaterThan(avg(m.blue, m.blueCount) + 0.2);
    const columns = { left: new Set<number>(), right: new Set<number>() };
    for (let k = 0; k < m.goldCount; k++) {
      const x = m.gold[k * 6] ?? 0;
      const i = Math.round(((Math.abs(x) - cfg.xStart) / (cfg.xEnd - cfg.xStart)) * cfg.cols);
      (x < 0 ? columns.left : columns.right).add(i);
    }
    expect(columns.left.size).toBeGreaterThan(8);
    expect(columns.right.size).toBeGreaterThan(8);
  });
  it("is deterministic for a given noise and seed", () => {
    const a = landscape(cfg, noise2D, mulberry32(4));
    const b = landscape(cfg, noise2D, mulberry32(4));
    expect(Array.from(a.blue)).toEqual(Array.from(b.blue));
    expect(Array.from(a.gold)).toEqual(Array.from(b.gold));
    expect(Array.from(a.pointFade)).toEqual(Array.from(b.pointFade));
  });
});
