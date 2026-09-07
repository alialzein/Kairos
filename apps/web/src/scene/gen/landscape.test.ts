import { describe, expect, it } from "vitest";
import { makeNoise } from "@/avatar/sim/noise";
import { mulberry32 } from "@/avatar/sim/random";
import { sceneConfig } from "../sceneConfig";
import { landscape } from "./landscape";

const cfg = sceneConfig.landscape;
const n3 = makeNoise(1);
const noise2D = (x: number, y: number) => n3(x, y, 0);

describe("landscape", () => {
  const m = landscape(cfg, noise2D, mulberry32(2));
  const cols = cfg.cols + 1;
  // candidate edges per side: right, down and diagonal neighbours where they exist
  const full = 2 * ((cols - 1) * cfg.rows + cols * (cfg.rows - 1) + (cols - 1) * (cfg.rows - 1));

  it("builds a (cols+1) × rows grid per side inside [xStart, xEnd], clear of the bust", () => {
    expect(m.pointCount).toBe(2 * cols * cfg.rows);
    expect(m.points.length).toBe(m.pointCount * 3);
    for (let p = 0; p < m.pointCount; p++) {
      const ax = Math.abs(m.points[p * 3] ?? 0);
      const y = m.points[p * 3 + 1] ?? 0;
      const z = m.points[p * 3 + 2] ?? 0;
      expect(ax).toBeGreaterThanOrEqual(cfg.xStart - 1e-9);
      expect(ax).toBeLessThanOrEqual(cfg.xEnd + 1e-9);
      // Float32Array storage: compare at float32 precision
      expect(y).toBeGreaterThanOrEqual(cfg.baseY - (cfg.rows - 1) * cfg.rowSink - 1e-6);
      expect(y).toBeLessThanOrEqual(cfg.baseY + cfg.amplitude + 1e-6);
      expect(z).toBeLessThanOrEqual(cfg.zStart + 1e-9);
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
    // probability ∝ height²: gold sits clearly higher than blue on average, but not only on top
    expect(avg(m.gold, m.goldCount)).toBeGreaterThan(avg(m.blue, m.blueCount) + 0.2);
    // ...and scatters: both sides, and many distinct columns per side (the old rule gave one spike)
    const columns = { left: new Set<number>(), right: new Set<number>() };
    for (let k = 0; k < m.goldCount; k++) {
      const x = m.gold[k * 6] ?? 0;
      const i = Math.round(((Math.abs(x) - cfg.xStart) / (cfg.xEnd - cfg.xStart)) * cfg.cols);
      (x < 0 ? columns.left : columns.right).add(i);
    }
    expect(columns.left.size).toBeGreaterThan(8);
    expect(columns.right.size).toBeGreaterThan(8);
  });
  it("rises with |x| (the falloff keeps the ridges off the bust) and is deterministic", () => {
    const x0 = cfg.falloff[0];
    const inner = landscape({ ...cfg, cols: 1, xStart: x0, xEnd: x0 }, () => 1, mulberry32(3));
    for (let p = 0; p < inner.pointCount; p++) {
      const j = p % cfg.rows;
      expect(inner.points[p * 3 + 1]).toBeCloseTo(cfg.baseY - j * cfg.rowSink, 5);
    }
    // the falloff, ridge weights and row sink come from the config: with the falloff fully open
    // and unit noise the height is amplitude × (lowWeight + highWeight)
    const open = landscape(
      { ...cfg, cols: 1, xStart: x0, xEnd: x0, falloff: [0, 1] },
      () => 1,
      mulberry32(3),
    );
    const w = cfg.ridge.lowWeight + cfg.ridge.highWeight;
    for (let p = 0; p < open.pointCount; p++) {
      const j = p % cfg.rows;
      expect(open.points[p * 3 + 1]).toBeCloseTo(
        cfg.baseY + cfg.amplitude * w - j * cfg.rowSink,
        5,
      );
    }
    const a = landscape(cfg, noise2D, mulberry32(4));
    const b = landscape(cfg, noise2D, mulberry32(4));
    expect(Array.from(a.blue)).toEqual(Array.from(b.blue));
    expect(Array.from(a.gold)).toEqual(Array.from(b.gold));
  });
});
