import { describe, expect, it } from "vitest";
import {
  dprFor,
  landscapeCols,
  mobileCount,
  motionEnabled,
  pointBudget,
  scaledCount,
} from "./motion";
import { sceneConfig, type SceneConfig } from "./sceneConfig";

const perf: SceneConfig["perf"] = {
  dprCapWidth: 1000,
  dprCap: 1.5,
  dprMax: 2,
  mobileWidth: 768,
  mobileCountFactor: 0.5,
};

describe("motion helpers (Phase 9)", () => {
  it("motionEnabled follows the OS preference on auto and the config otherwise", () => {
    expect(motionEnabled("auto", false)).toBe(true);
    expect(motionEnabled("auto", true)).toBe(false);
    expect(motionEnabled("reduce", false)).toBe(false);
    expect(motionEnabled("full", true)).toBe(true);
  });
  it("dprFor caps the pixel ratio below the width threshold and at dprMax above it", () => {
    expect(dprFor(800, 3, perf)).toBe(1.5);
    expect(dprFor(800, 1, perf)).toBe(1);
    expect(dprFor(1400, 3, perf)).toBe(2);
    expect(dprFor(1400, 1.25, perf)).toBe(1.25);
  });
  it("landscapeCols halves the columns on mobile widths", () => {
    expect(landscapeCols(500, 70, perf)).toBe(35);
    expect(landscapeCols(768, 70, perf)).toBe(70);
    expect(landscapeCols(1200, 71, perf)).toBe(71);
  });
});

describe("mobileCount (Phase 12.7)", () => {
  it("halves every count below the mobile width and leaves it alone above it", () => {
    expect(mobileCount(500, 8000, perf)).toBe(4000);
    expect(mobileCount(767, 120000, perf)).toBe(60000);
    expect(mobileCount(768, 8000, perf)).toBe(8000);
    expect(mobileCount(1440, 8000, perf)).toBe(8000);
  });
  it("rounds the halved count to a whole number of sprites", () => {
    expect(mobileCount(500, 301, perf)).toBe(151); // 150.5 → 151
    expect(mobileCount(500, 121, perf)).toBe(61); // 60.5 → 61
    expect(mobileCount(500, 1, perf)).toBe(1); // 0.5 → 1: a layer never vanishes entirely
    expect(mobileCount(500, 0, perf)).toBe(0);
  });
  it("uses the same factor as landscapeCols", () => {
    expect(landscapeCols(500, 200, perf)).toBe(mobileCount(500, 200, perf));
  });
});

describe("pointBudget (Phase 12.7)", () => {
  it("stays under the 300k desktop sprite budget and halves on mobile", () => {
    const desktop = pointBudget(sceneConfig, 1440);
    const mobile = pointBudget(sceneConfig, 400);
    console.log("point budget desktop (1440 px):", JSON.stringify(desktop));
    console.log("point budget mobile (400 px):", JSON.stringify(mobile));

    expect(desktop.total).toBeLessThan(300_000);
    expect(desktop.total).toBe(
      desktop.landscape +
        desktop.shell +
        desktop.rings +
        desktop.neck +
        desktop.dust +
        desktop.plume +
        desktop.stars,
    );
    // half, up to the landscape grid's rounding: halving `cols` keeps the +1 column of the
    // `cols + 1` grid on both sides (2 · rows extra nodes) and the nucleus/core round up
    const slack = 2 * sceneConfig.landscape.rows + 4;
    expect(Math.abs(mobile.total - desktop.total / 2)).toBeLessThanOrEqual(slack);
  });
  it("scales every sprite count by particles.countScale (Phase 14: locked at 1)", () => {
    expect(sceneConfig.particles.countScale).toBe(1);
    expect(scaledCount(1000, 1)).toBe(1000);
    expect(scaledCount(1000, 0.5)).toBe(500);
    expect(scaledCount(301, 0.5)).toBe(151);
    const full = pointBudget(sceneConfig, 1440);
    const half = pointBudget(
      { ...sceneConfig, particles: { ...sceneConfig.particles, countScale: 0.5 } },
      1440,
    );
    // the landscape grid is a dimension, not a sprite count: it does not scale, the rest halves
    const grid = 2 * (sceneConfig.landscape.cols + 1) * sceneConfig.landscape.rows;
    expect(half.total - grid).toBeLessThanOrEqual((full.total - grid) / 2 + 4);
    expect(half.total - grid).toBeGreaterThanOrEqual((full.total - grid) / 2 - 4);
    expect(half.shell).toBe(sceneConfig.bust.shell.count / 2);
  });
  it("counts each layer the way the layer builds it", () => {
    const b = pointBudget(sceneConfig, 1440);
    const l = sceneConfig.landscape;
    expect(b.landscape).toBe(2 * ((l.cols + 1) * l.rows + l.dust.count + l.crest.dust.count));
    expect(b.shell).toBe(sceneConfig.bust.shell.count);
    expect(b.rings).toBe(sceneConfig.rings.count * sceneConfig.rings.points.perRing);
    expect(b.neck).toBe(
      sceneConfig.neck.jawXs.length * sceneConfig.neck.strandPoints.perStrand +
        sceneConfig.neck.nucleus.points +
        1,
    );
    expect(b.dust).toBe(sceneConfig.dust.ambient.count);
    expect(b.plume).toBe(sceneConfig.dust.plume.count);
    expect(b.stars).toBe(sceneConfig.stars.count);
  });
});
