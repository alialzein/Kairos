import { describe, expect, it } from "vitest";
import { ANCHORS } from "./canonical";

describe("ANCHORS", () => {
  it("head above chest, ears symmetric, face in front", () => {
    expect(ANCHORS.head[1]).toBeGreaterThan(ANCHORS.chest[1]);
    expect(ANCHORS.earL[0]).toBeCloseTo(-ANCHORS.earR[0]);
    expect(ANCHORS.face[2]).toBeGreaterThan(ANCHORS.head[2]);
  });
  it("eyes symmetric on the face front, mouth centred below them", () => {
    expect(ANCHORS.eyeL[0]).toBeCloseTo(-ANCHORS.eyeR[0]);
    expect(ANCHORS.eyeL[1]).toBeCloseTo(ANCHORS.eyeR[1]);
    expect(ANCHORS.eyeL[2]).toBeGreaterThan(ANCHORS.head[2]);
    expect(ANCHORS.mouth[0]).toBeCloseTo(0);
    expect(ANCHORS.mouth[1]).toBeLessThan(ANCHORS.eyeL[1]);
    expect(ANCHORS.mouth[2]).toBeGreaterThan(ANCHORS.eyeL[2]);
  });
});
