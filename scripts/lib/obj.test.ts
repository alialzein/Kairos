import { describe, expect, it } from "vitest";
import { cropByAbsX, cropByY, normalizeBust, parseObj, triangulate } from "./obj";

const CUBE = `
g body
v -1 -1 -1
v 1 -1 -1
v 1 1 -1
v -1 1 -1
v -1 -1 1
v 1 -1 1
v 1 1 1
v -1 1 1
f 1/1/1 2/2/2 3/3/3 4/4/4
f 5/1/1 6/2/2 7/3/3 8/4/4
f 1/1/1 5/2/2 8/3/3 4/4/4
g helper-tights
v 0 9 0
v 1 9 0
v 0 9 1
f 9 10 11
`;

describe("parseObj", () => {
  it("keeps only the requested group and re-indexes its vertices", () => {
    const m = parseObj(CUBE, { group: "body" });
    expect(m.positions.length).toBe(8 * 3);
    expect(m.faces).toHaveLength(3);
    expect(m.faces[0]).toEqual([0, 1, 2, 3]);
  });
});

describe("cropByY", () => {
  it("drops faces with any vertex below yMin and compacts vertices", () => {
    const m = parseObj(CUBE, { group: "body" });
    const c = cropByY(m, 0.5);
    expect(c.faces).toHaveLength(0); // every cube face touches y = -1
    const top = cropByY({ positions: m.positions, faces: [[2, 3, 7, 6]] }, 0.5);
    expect(top.faces).toEqual([[0, 1, 2, 3]]);
    expect(top.positions.length).toBe(4 * 3);
  });
});

describe("cropByAbsX", () => {
  it("drops faces with any vertex outside |x| <= xMax and compacts vertices", () => {
    const m = parseObj(CUBE, { group: "body" });
    const c = cropByAbsX(m, 0.5);
    expect(c.faces).toHaveLength(0); // every cube face spans x = ±1
    const narrow = cropByAbsX(
      {
        positions: new Float32Array([-0.4, 0, 0, 0.4, 0, 0, 0.4, 1, 0, -0.4, 1, 0]),
        faces: [[0, 1, 2, 3]],
      },
      0.5,
    );
    expect(narrow.faces).toEqual([[0, 1, 2, 3]]);
    expect(narrow.positions.length).toBe(4 * 3);
  });
});

describe("triangulate", () => {
  it("fans quads into two triangles and keeps triangles", () => {
    expect(
      Array.from(
        triangulate([
          [0, 1, 2, 3],
          [4, 5, 6],
        ]),
      ),
    ).toEqual([0, 1, 2, 0, 2, 3, 4, 5, 6]);
  });
});

describe("normalizeBust", () => {
  it("centres x/z and maps y to [-0.9, 0.9] preserving aspect", () => {
    const pos = new Float32Array([-2, 0, 0, 2, 0, 0, 0, 4, 0, 0, 0, 1]);
    const { positions, bounds } = normalizeBust(pos);
    expect(bounds.max[1]).toBeCloseTo(0.9);
    expect(bounds.min[1]).toBeCloseTo(-0.9);
    expect(positions[0]).toBeCloseTo(-0.9); // x scaled by the same factor as y (4 → 1.8)
    const cx = (bounds.min[0] + bounds.max[0]) / 2;
    expect(cx).toBeCloseTo(0);
  });

  it("refuses an empty mesh instead of producing NaN", () => {
    expect(() => normalizeBust(new Float32Array())).toThrow(/empty/);
  });
});
