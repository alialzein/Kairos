import { describe, expect, it } from "vitest";
import { FrameStats, percentile } from "./frametime";

describe("percentile", () => {
  it("interpolates on a sorted array", () => {
    expect(percentile([1, 2, 3, 4], 0.5)).toBe(2.5);
    expect(percentile([10], 0.95)).toBe(10);
    expect(percentile([], 0.5)).toBe(0);
  });
});

describe("FrameStats", () => {
  it("keeps a bounded window and reports p50/p95", () => {
    const s = new FrameStats(4);
    [16, 16, 33, 16, 16].forEach((ms) => s.push(ms));
    expect(s.count).toBe(4);
    expect(s.p50).toBe(16);
    expect(s.p95).toBeGreaterThan(16);
    s.reset();
    expect(s.count).toBe(0);
  });
});
