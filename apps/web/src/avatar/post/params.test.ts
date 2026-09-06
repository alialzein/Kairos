import { describe, expect, it } from "vitest";
import { bloomParams } from "./params";

describe("bloomParams", () => {
  it("full bloom blooms only the core and spine (high threshold), cheap is weaker, off is null", () => {
    expect(bloomParams("off", {})).toBeNull();
    const full = bloomParams("full", {});
    const cheap = bloomParams("cheap", {});
    expect(full?.threshold).toBeGreaterThanOrEqual(0.7);
    expect(cheap?.strength).toBeLessThan(full?.strength ?? 0);
    expect(cheap?.radius).toBeLessThan(full?.radius ?? 0);
  });
  it("tuning overrides strength and threshold", () => {
    expect(bloomParams("full", { bloomStrength: 2, bloomThreshold: 0.2 })).toMatchObject({
      strength: 2,
      threshold: 0.2,
    });
  });
});
