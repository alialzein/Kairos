import { describe, expect, it } from "vitest";
import { SHAPE_ID } from "@twin/config";
import { ZERO_ENERGY } from "../audio/energy";
import { computeFrame, initialMemory, type FrameInput } from "./frame";

const base: FrameInput = {
  state: "IDLE",
  since: 0,
  now: 0,
  dt: 1 / 60,
  energy: ZERO_ENERGY,
  pointer: { x: 0, y: 0, active: false, strength: 1 },
  tuning: {},
};

function run(inputs: FrameInput[]) {
  let mem = initialMemory("DORMANT");
  const out = [];
  for (const i of inputs) {
    const r = computeFrame(i, mem);
    mem = r.memory;
    out.push(r.values);
  }
  return out;
}

describe("computeFrame", () => {
  it("IDLE targets the ORB with breathing and the IDLE turbulence", () => {
    const [v] = run([base]);
    expect(v?.shapeB).toBe(SHAPE_ID.ORB);
    expect(v?.turbulence).toBeCloseTo(0.25);
    expect(v?.breathing).toBeCloseTo(0.03);
  });
  it("WAKING flashes the RING first, then the HUMANOID, and enables aberration", () => {
    const frames = run([
      { ...base, state: "WAKING", now: 0.0, since: 0 },
      { ...base, state: "WAKING", now: 0.2, since: 0 },
      { ...base, state: "WAKING", now: 0.9, since: 0 },
    ]);
    expect(frames[0]?.shapeB).toBe(SHAPE_ID.RING);
    expect(frames[2]?.shapeB).toBe(SHAPE_ID.HUMANOID);
    expect(frames[0]?.aberration).toBeGreaterThan(0);
  });
  it("SPEAKING feeds mid energy into `speak`; LISTENING into `listen`; others zero", () => {
    const e = { bass: 0.2, mid: 0.8, treble: 0.4 };
    const [sp, li, th] = run([
      { ...base, state: "SPEAKING", energy: e },
      { ...base, state: "LISTENING", energy: e },
      { ...base, state: "THINKING", energy: e },
    ]);
    expect(sp?.speak).toBeCloseTo(0.8 * 0.5);
    expect(sp?.listen).toBe(0);
    expect(li?.listen).toBeCloseTo(0.8 * 0.4);
    expect(th?.speak).toBe(0);
    expect(th?.vortex).toBe(1);
  });
  it("OFFLINE freezes for 0.4 s, then dissolves toward the NEBULA over 2 s with a red tint", () => {
    const [a, b] = run([
      { ...base, state: "OFFLINE", since: 0, now: 0.1 },
      { ...base, state: "OFFLINE", since: 0, now: 0.6 },
    ]);
    expect(a?.freeze).toBe(1);
    expect(b?.freeze).toBe(0);
    expect(b?.shapeB).toBe(SHAPE_ID.NEBULA);
    expect(b?.tint[0]).toBeGreaterThan(b?.tint[2] ?? 1);
  });
  it("tuning overrides win over the state table", () => {
    const [v] = run([{ ...base, tuning: { turbulence: 0.9, size: 0.02 } }]);
    expect(v?.turbulence).toBe(0.9);
    expect(v?.size).toBe(0.02);
  });
  it("core pulse oscillates between the state's min and max", () => {
    const vals = run([0, 0.5, 1, 1.5, 2, 2.5, 3].map((now) => ({ ...base, now })));
    for (const v of vals) {
      expect(v.corePulse).toBeGreaterThanOrEqual(0.45 - 1e-6);
      expect(v.corePulse).toBeLessThanOrEqual(0.75 + 1e-6);
    }
  });
});
