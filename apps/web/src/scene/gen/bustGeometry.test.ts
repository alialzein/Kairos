import { Box3, type BufferAttribute } from "three";
import { describe, expect, it } from "vitest";
import { sceneConfig } from "../sceneConfig";
import {
  boundaryVertices,
  flattenCavity,
  meshBust,
  primitiveBust,
  straightenArmCrops,
} from "./bustGeometry";

describe("primitiveBust", () => {
  const b = sceneConfig.bust;
  const g = primitiveBust(b, 32);
  const box = new Box3().setFromBufferAttribute(g.getAttribute("position") as BufferAttribute);

  it("is one indexed, smooth-normal geometry", () => {
    expect(g.getIndex()).not.toBeNull();
    expect(g.getAttribute("normal")).toBeDefined();
    expect(g.getAttribute("uv")).toBeUndefined();
    expect((g.getIndex()?.count ?? 0) % 3).toBe(0);
  });
  it("spans from the crown to below the chest and is left/right symmetric", () => {
    expect(box.max.y).toBeCloseTo(b.headCenter[1] + b.headRadius * b.headScaleY, 5);
    expect(box.min.y).toBeCloseTo(b.chestCenter[1] - b.chestSize[1] / 2, 5);
    expect(box.max.x).toBeCloseTo(b.shoulderRadii[0], 5);
    expect(box.min.x).toBeCloseTo(-b.shoulderRadii[0], 5);
  });
  it("hangs the neck cylinder between neckBottom and neckTop", () => {
    const p = g.getAttribute("position");
    let top = 0;
    let bottom = 0;
    for (let i = 0; i < p.count; i++) {
      const r = Math.hypot(p.getX(i), p.getZ(i));
      const y = p.getY(i);
      // the cylinder's rim rings: radius neckRadius at neckTop, 1.15·neckRadius at neckBottom
      if (Math.abs(y - b.neckTop) < 1e-6 && Math.abs(r - b.neckRadius) < 1e-6) top++;
      if (Math.abs(y - b.neckBottom) < 1e-6 && Math.abs(r - b.neckRadius * 1.15) < 1e-6) bottom++;
    }
    expect(top).toBeGreaterThanOrEqual(48);
    expect(bottom).toBeGreaterThanOrEqual(48);
  });
});

describe("meshBust", () => {
  it("welds duplicate vertices, scales and offsets, and computes normals", () => {
    // two triangles sharing an edge, with the shared vertices duplicated (triangle soup)
    const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]);
    const indices = new Uint32Array([0, 1, 2, 3, 4, 5]);
    const g = meshBust(positions, indices, { scale: 2, offset: [0, 1, 0] });
    expect(g.getAttribute("position").count).toBe(4);
    const box = new Box3().setFromBufferAttribute(g.getAttribute("position") as BufferAttribute);
    expect(box.min.y).toBeCloseTo(1);
    expect(box.max.y).toBeCloseTo(3);
    expect(box.max.x).toBeCloseTo(2);
    const n = g.getAttribute("normal");
    expect(Math.abs(n.getZ(0))).toBeCloseTo(1);
  });
  it("straightens a jagged arm-crop boundary onto one slanted line per side", () => {
    // right side: a vertical strip of quads whose outer (boundary) edge zigzags in x
    const ys = [-0.3, -0.45, -0.6, -0.75, -0.9];
    const outer = [0.8, 0.86, 0.82, 0.9, 0.85];
    const positions: number[] = [];
    for (let k = 0; k < ys.length; k++)
      positions.push(0.5, ys[k] ?? 0, 0, outer[k] ?? 0, ys[k] ?? 0, 0);
    const indices: number[] = [];
    for (let k = 0; k + 1 < ys.length; k++) {
      const a = k * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    const pos = Float32Array.from(positions);
    straightenArmCrops(pos, indices, { xMin: 0.7, yMin: -0.95, yMax: -0.2 });
    // top band keeps the widest top x (0.8 at −0.3), bottom band the widest bottom x (0.85 at −0.9)
    const outerX = ys.map((_, k) => pos[k * 2 * 3 + 3] ?? 0);
    expect(outerX[0]).toBeCloseTo(0.8, 5);
    expect(outerX[4]).toBeCloseTo(0.85, 5);
    for (let k = 1; k < 4; k++) {
      const t = (-0.3 - (ys[k] ?? 0)) / 0.6;
      expect(outerX[k]).toBeCloseTo(0.8 + 0.05 * t, 5);
    }
    // the inner column is not on the crop boundary in the zone (|x| ≤ xMin) and stays put
    for (let k = 0; k < ys.length; k++) expect(pos[k * 2 * 3] ?? 0).toBe(0.5);
    // the left side is handled independently and mirrors the right
    const mirrored = Float32Array.from(positions, (v, i) => (i % 3 === 0 ? -v : v));
    straightenArmCrops(mirrored, indices, { xMin: 0.7, yMin: -0.95, yMax: -0.2 });
    for (let k = 0; k < ys.length; k++) {
      expect(mirrored[k * 2 * 3 + 3]).toBeCloseTo(-(pos[k * 2 * 3 + 3] ?? 0), 5);
      expect(mirrored[k * 2 * 3]).toBe(-0.5);
    }
  });
  it("finds boundary vertices as the endpoints of single-triangle edges", () => {
    const b = boundaryVertices([0, 1, 2, 1, 3, 2], 4);
    expect(Array.from(b)).toEqual([1, 1, 1, 1]);
    const inner = boundaryVertices([0, 1, 2, 0, 2, 3, 0, 3, 1, 1, 3, 2], 4); // closed tetrahedron
    expect(Array.from(inner)).toEqual([0, 0, 0, 0]);
  });
  it("drags the vertices below skirtBelow down to skirtTo before scaling", () => {
    const positions = new Float32Array([0, -0.9, 0, 1, -0.9, 0, 0, 0.5, 0]);
    const indices = new Uint32Array([0, 1, 2]);
    const g = meshBust(positions, indices, {
      scale: 2,
      offset: [0, 0, 0],
      skirtBelow: -0.85,
      skirtTo: -1.5,
    });
    const p = g.getAttribute("position");
    expect(p.getY(0)).toBeCloseTo(-3);
    expect(p.getY(1)).toBeCloseTo(-3);
    expect(p.getY(2)).toBeCloseTo(1);
  });
});

describe("flattenCavity", () => {
  /** an outer skin on the quadric z = 0.4 − 0.5x² − 0.3(y − 0.4)² with a slit, an eyeball sheet
   *  0.13 behind it, and skin outside the box */
  const skin = (x: number, y: number) => 0.4 - 0.5 * x * x - 0.3 * (y - 0.4) ** 2;
  const build = () => {
    const pts: number[] = [];
    const kind: string[] = [];
    for (let x = -0.3; x <= 0.3; x += 0.01) {
      for (let y = 0.2; y <= 0.55; y += 0.01) {
        const ax = Math.abs(x);
        const inBox = ax >= 0.04 && ax <= 0.22 && y >= 0.3 && y <= 0.46;
        const inSlit = inBox && ax > 0.08 && ax < 0.18 && y > 0.352 && y < 0.389;
        if (inSlit) {
          pts.push(x, y, 0.25); // eyeball seen through the slit
          kind.push("eye");
        } else {
          const lid = inBox && Math.abs(y - 0.37) < 0.03 ? 0.01 : 0; // lid fold relief
          pts.push(x, y, skin(x, y) + lid);
          kind.push(inBox ? "outer" : "outside");
        }
      }
    }
    return { positions: Float32Array.from(pts), kind };
  };
  const cavity = {
    yMin: 0.3,
    yMax: 0.46,
    xMin: 0.04,
    xMax: 0.22,
    zMin: 0.2,
    sheetZ: 0.33,
    recess: 0.004,
    feather: 0.03,
  };
  it("lays the lids on the fitted skin, parks the eyeball just behind it, leaves the outside", () => {
    const { positions, kind } = build();
    const before = positions.slice();
    const moved = flattenCavity(positions, cavity);
    expect(moved).toBeGreaterThan(0);
    for (let i = 0; i < kind.length; i++) {
      const x = positions[i * 3] ?? 0;
      const y = positions[i * 3 + 1] ?? 0;
      const z = positions[i * 3 + 2] ?? 0;
      const ax = Math.abs(x);
      const edge = Math.min(ax - 0.04, 0.22 - ax, y - 0.3, 0.46 - y);
      if (kind[i] === "outside") expect(z).toBe(before[i * 3 + 2]);
      else if (edge >= 0.03 && kind[i] === "eye")
        expect(Math.abs(z - (skin(x, y) - 0.004))).toBeLessThan(0.008);
      else if (edge >= 0.03) expect(Math.abs(z - skin(x, y))).toBeLessThan(0.008);
    }
  });
  it("does nothing without an outer sheet to fit", () => {
    const positions = Float32Array.from([0.1, 0.4, 0.25, 0.12, 0.4, 0.25]);
    expect(flattenCavity(positions, cavity)).toBe(0);
  });
});
