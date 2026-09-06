import { describe, expect, it } from "vitest";
import { halo, HALO_CENTER, HALO_RADII } from "./halo";
import { mulberry32 } from "../random";

describe("halo", () => {
  it("returns n points on thin rings behind the head, deterministic per seed", () => {
    const a = halo(3000, mulberry32(5));
    const b = halo(3000, mulberry32(5));
    expect(a.length).toBe(9000);
    expect(Array.from(a.slice(0, 30))).toEqual(Array.from(b.slice(0, 30)));
    const rMin = Math.min(...HALO_RADII) - 0.08;
    const rMax = Math.max(...HALO_RADII) + 0.08;
    for (let i = 0; i < 300; i++) {
      const x = a[i * 3] ?? 0;
      const y = a[i * 3 + 1] ?? 0;
      const z = a[i * 3 + 2] ?? 0;
      const r = Math.hypot(x - HALO_CENTER[0], y - HALO_CENTER[1]);
      expect(r).toBeGreaterThan(rMin);
      expect(r).toBeLessThan(rMax);
      expect(z).toBeLessThan(-0.4); // behind the bust
    }
  });
});
