import { describe, expect, it } from "vitest";
import { ANCHORS } from "./canonical";

describe("ANCHORS", () => {
  it("head above chest, ears symmetric, face in front", () => {
    expect(ANCHORS.head[1]).toBeGreaterThan(ANCHORS.chest[1]);
    expect(ANCHORS.earL[0]).toBeCloseTo(-ANCHORS.earR[0]);
    expect(ANCHORS.face[2]).toBeGreaterThan(ANCHORS.head[2]);
  });
});
