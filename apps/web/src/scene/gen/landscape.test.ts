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
      expect(y).toBeGreaterThanOrEqual(cfg.baseY - (cfg.rows - 1) * 0.05 - 1e-6);
      expect(y).toBeLessThanOrEqual(cfg.baseY + cfg.amplitude + 1e-6);
      expect(z).toBeLessThanOrEqual(cfg.zStart + 1e-9);
    }
  });
  it("keeps roughly (1 − dropout) of the candidate edges and routes the top goldRatio to gold", () => {
    const keptCount = m.blueCount + m.goldCount;
    expect(keptCount / full).toBeGreaterThan(1 - cfg.dropout - 0.06);
    expect(keptCount / full).toBeLessThan(1 - cfg.dropout + 0.06);
    expect(m.goldCount).toBe(Math.round(keptCount * cfg.goldRatio));
    expect(m.blue.length).toBe(m.blueCount * 6);
    expect(m.gold.length).toBe(m.goldCount * 6);
    const meanY = (a: Float32Array, k: number) => ((a[k * 6 + 1] ?? 0) + (a[k * 6 + 4] ?? 0)) / 2;
    let minGold = Infinity;
    for (let k = 0; k < m.goldCount; k++) minGold = Math.min(minGold, meanY(m.gold, k));
    for (let k = 0; k < m.blueCount; k++)
      expect(meanY(m.blue, k)).toBeLessThanOrEqual(minGold + 1e-9);
  });
  it("rises with |x| (the falloff keeps the ridges off the bust) and is deterministic", () => {
    const inner = landscape({ ...cfg, cols: 1, xStart: 1.2, xEnd: 1.2 }, () => 1, mulberry32(3));
    for (let p = 0; p < inner.pointCount; p++) {
      const j = p % cfg.rows;
      expect(inner.points[p * 3 + 1]).toBeCloseTo(cfg.baseY - j * 0.05, 5);
    }
    const a = landscape(cfg, noise2D, mulberry32(4));
    const b = landscape(cfg, noise2D, mulberry32(4));
    expect(Array.from(a.blue)).toEqual(Array.from(b.blue));
    expect(Array.from(a.gold)).toEqual(Array.from(b.gold));
  });
});
