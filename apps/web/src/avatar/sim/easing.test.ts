import { describe, expect, it } from "vitest";
import { EASINGS } from "./easing";

describe("EASINGS", () => {
  it.each(Object.keys(EASINGS) as (keyof typeof EASINGS)[])(
    "%s maps 0→0 and 1→1 monotonically",
    (name) => {
      const f = EASINGS[name];
      expect(f(0)).toBeCloseTo(0);
      expect(f(1)).toBeCloseTo(1);
      let prev = 0;
      for (let t = 0; t <= 1.0001; t += 0.05) {
        const v = f(Math.min(1, t));
        expect(v).toBeGreaterThanOrEqual(prev - 1e-9);
        prev = v;
      }
    },
  );
});
