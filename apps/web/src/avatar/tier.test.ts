import { describe, expect, it } from "vitest";
import { baseTier, frameBudgetMs, parseTierOverride, stepDown, tierFromProbe } from "./tier";

describe("baseTier", () => {
  const desktop = { webgpu: true, mobile: false, reducedMotion: false };
  it("desktop WebGPU → ultra, desktop WebGL → high", () => {
    expect(baseTier(desktop)).toBe("ultra");
    expect(baseTier({ ...desktop, webgpu: false })).toBe("high");
  });
  it("mobile WebGPU → high, mobile WebGL → mid", () => {
    expect(baseTier({ ...desktop, mobile: true })).toBe("high");
    expect(baseTier({ ...desktop, mobile: true, webgpu: false })).toBe("mid");
  });
  it("low device memory caps at mid; low battery steps down once", () => {
    expect(baseTier({ ...desktop, deviceMemory: 4 })).toBe("mid");
    expect(baseTier({ ...desktop, batteryLow: true })).toBe("high");
    expect(baseTier({ ...desktop, mobile: true, webgpu: false, batteryLow: true })).toBe("low");
  });
  it("reduced motion always → low", () => {
    expect(baseTier({ ...desktop, reducedMotion: true })).toBe("low");
  });
});

describe("stepDown / probe", () => {
  it("steps one tier and stops at low", () => {
    expect(stepDown("ultra")).toBe("high");
    expect(stepDown("low")).toBe("low");
  });
  it("keeps the tier when p95 is within 125 % of the budget, else steps down once", () => {
    expect(frameBudgetMs("ultra")).toBeCloseTo(16.67, 1);
    expect(frameBudgetMs("mid")).toBeCloseTo(33.33, 1);
    expect(tierFromProbe("ultra", 20)).toBe("ultra");
    expect(tierFromProbe("ultra", 22)).toBe("high");
    expect(tierFromProbe("mid", 45)).toBe("low");
    expect(tierFromProbe("low", 500)).toBe("low");
  });
});

describe("parseTierOverride", () => {
  it("accepts ?tier=<valid>, ignores anything else", () => {
    expect(parseTierOverride("?tier=mid")).toBe("mid");
    expect(parseTierOverride("?x=1&tier=ULTRA")).toBe("ultra");
    expect(parseTierOverride("?tier=potato")).toBeNull();
    expect(parseTierOverride("")).toBeNull();
  });
});
