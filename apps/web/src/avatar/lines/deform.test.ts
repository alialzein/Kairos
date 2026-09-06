import { describe, expect, it } from "vitest";
import { ANCHORS } from "../sim/canonical";
import { JAW } from "../sim/jaw";
import { createLineDeformer, type DeformValues } from "./deform";

// a tiny "bust": one segment endpoint per region of interest (flat xyz, like Contours.segments)
const POINTS: Record<string, [number, number, number]> = {
  chin: [0, ANCHORS.mouth[1] - 0.08, ANCHORS.mouth[2]],
  forehead: [0, 0.7, 0.35],
  crownSide: [0.25, 0.85, 0],
  ear: [ANCHORS.earL[0], ANCHORS.earL[1], ANCHORS.earL[2]],
  torso: [0.3, -0.4, 0.2],
};
const NAMES = Object.keys(POINTS);
const make = (): Float32Array => {
  const a = new Float32Array(NAMES.length * 3);
  NAMES.forEach((n, i) => a.set(POINTS[n] ?? [0, 0, 0], i * 3));
  return a;
};
const at = (a: Float32Array, name: string): [number, number, number] => {
  const i = NAMES.indexOf(name) * 3;
  return [a[i] ?? 0, a[i + 1] ?? 0, a[i + 2] ?? 0];
};
const orig = (name: string): [number, number, number] => at(make(), name);
const idle: DeformValues = { speak: 0, listen: 0, vortex: 0, freeze: 0, tint: [1, 1, 1] };

describe("createLineDeformer", () => {
  it("does nothing while no effect is active", () => {
    const live = make();
    const d = createLineDeformer(live);
    expect(d.update(idle, 1)).toBe(false);
    expect(Array.from(live)).toEqual(Array.from(make()));
  });

  it("restores every vertex from the base once an effect ends (live is the GPU buffer)", () => {
    const live = make();
    const d = createLineDeformer(live);
    d.update({ ...idle, vortex: 1 }, 1.2);
    expect(at(live, "crownSide")).not.toEqual(orig("crownSide"));
    expect(d.update(idle, 1.3)).toBe(true); // the restore is itself a buffer change
    expect(Array.from(live)).toEqual(Array.from(make()));
    expect(d.update(idle, 1.4)).toBe(false);
  });

  it("never accumulates: the same inputs give the same vertices frame after frame", () => {
    const live = make();
    const d = createLineDeformer(live);
    d.update({ ...idle, vortex: 1 }, 1.2);
    const first = Array.from(live);
    for (let i = 0; i < 60; i++) d.update({ ...idle, vortex: 1 }, 1.2);
    expect(Array.from(live)).toEqual(first);
    const [x, , z] = at(live, "crownSide");
    // a rotation about the head axis keeps the point on its circle (radius preserved)
    const [ox, , oz] = orig("crownSide");
    expect(Math.hypot(x, z - d.headAxisZ)).toBeCloseTo(Math.hypot(ox, oz - d.headAxisZ), 5);
  });

  it("THINKING turns the head about its own axis and leaves the torso alone", () => {
    const live = make();
    const d = createLineDeformer(live);
    d.update({ ...idle, vortex: 1 }, Math.PI / 2 / 1.3); // sin(t·1.3) = 1 → peak turn
    const [x, y] = at(live, "crownSide");
    expect(y).toBeCloseTo(0.85);
    expect(Math.abs(x - 0.25)).toBeGreaterThan(1e-4);
    expect(Math.abs(x - 0.25)).toBeLessThan(0.05); // a small turn, not a spin
    expect(at(live, "torso")).toEqual(orig("torso"));
  });

  it("SPEAKING drops the chin by the shared jaw formula, forehead untouched", () => {
    const live = make();
    const d = createLineDeformer(live);
    d.update({ ...idle, speak: 1 }, Math.PI / 2 / JAW.rate); // jaw fully open
    expect(at(live, "chin")[1]).toBeLessThan(orig("chin")[1] - 0.05);
    expect(at(live, "forehead")).toEqual(orig("forehead"));
  });

  it("LISTENING ripples only near the ears; OFFLINE frays everything red", () => {
    const live = make();
    const d = createLineDeformer(live);
    d.update({ ...idle, listen: 1 }, 0.3);
    expect(at(live, "ear")).not.toEqual(orig("ear"));
    expect(at(live, "torso")).toEqual(orig("torso"));
    d.update({ ...idle, tint: [1, 0.45, 0.45] }, 0.3);
    for (const n of NAMES) expect(at(live, n)).not.toEqual(orig(n));
  });
});
