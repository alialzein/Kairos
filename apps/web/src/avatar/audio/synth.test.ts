import { describe, expect, it } from "vitest";
import { synthEnergy } from "./synth";

describe("synthEnergy", () => {
  it("is deterministic, bounded, speech-like (bursts with pauses)", () => {
    expect(synthEnergy(1.234)).toEqual(synthEnergy(1.234));
    let sum = 0,
      zeros = 0,
      n = 0;
    for (let t = 0; t < 10; t += 0.01, n++) {
      const e = synthEnergy(t);
      for (const v of [e.bass, e.mid, e.treble]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
      sum += e.mid;
      if (e.mid === 0) zeros++;
    }
    expect(sum / n).toBeGreaterThan(0.2);
    expect(sum / n).toBeLessThan(0.8);
    expect(zeros / n).toBeGreaterThan(0.1); // pauses exist
  });
});
