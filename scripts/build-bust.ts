/**
 * Builds apps/web/public/avatar/bust.glb from the MakeHuman base mesh (CC0 1.0).
 * Deterministic: pinned commit, fixed crop height. Run: pnpm build:bust
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { Accessor, Document, NodeIO, Primitive } from "@gltf-transform/core";
import { cropByAbsX, cropByY, normalizeBust, parseObj, triangulate } from "./lib/obj";

const COMMIT = "3c701a8e52f09e69922e8b598d23be2d7dfc49e3";
const SOURCE = `https://raw.githubusercontent.com/makehumancommunity/makehuman/${COMMIT}/makehuman/data/3dobjs/base.obj`;
/** MakeHuman units are decimetres; the shoulder line sits near y ≈ 5.7, the chest at ≈ 4.6. */
const Y_CUT = 4.4;
/** MakeHuman decimetres: the shoulder line is ≈ ±2.0; anything wider is the upper arm of the A-pose figure. */
const X_CUT = 2.2;
const OUT_DIR = "apps/web/public/avatar";

const res = await fetch(SOURCE);
if (!res.ok) throw new Error(`download failed: ${res.status} ${SOURCE}`);
const obj = parseObj(await res.text(), { group: "body" });
const cropped = cropByAbsX(cropByY(obj, Y_CUT), X_CUT);
if (cropped.faces.length === 0) {
  throw new Error(`crop removed every face (Y_CUT=${Y_CUT}, X_CUT=${X_CUT}); loosen the cuts`);
}
const indices = triangulate(cropped.faces);
const { positions, bounds } = normalizeBust(cropped.positions);

// gltf-transform types `Accessor.Type` / `Primitive.Mode` as `Record<string, ...>`, which
// `noUncheckedIndexedAccess` widens to `... | undefined`; the runtime values are fixed string/
// number constants (checked in node_modules/@gltf-transform/core/dist/index.js), so the `??`
// fallback never actually triggers. `setArray` is typed for `TypedArray<ArrayBuffer>` specifically,
// while our arrays are the wider `TypedArray<ArrayBufferLike>` inferred from obj.ts's bare
// `Float32Array`/`Uint32Array` return types; both really do wrap a plain `ArrayBuffer`.
const doc = new Document();
const buffer = doc.createBuffer();
const pos = doc
  .createAccessor("POSITION")
  .setType(Accessor.Type.VEC3 ?? "VEC3")
  .setArray(positions as Float32Array<ArrayBuffer>)
  .setBuffer(buffer);
const idx = doc
  .createAccessor("INDEX")
  .setType(Accessor.Type.SCALAR ?? "SCALAR")
  .setArray(indices as Uint32Array<ArrayBuffer>)
  .setBuffer(buffer);
const prim = doc
  .createPrimitive()
  .setMode(Primitive.Mode.TRIANGLES ?? 4)
  .setAttribute("POSITION", pos)
  .setIndices(idx);
const mesh = doc.createMesh("bust").addPrimitive(prim);
const node = doc.createNode("bust").setMesh(mesh);
doc.createScene("bust").addChild(node);

mkdirSync(OUT_DIR, { recursive: true });
const glb = await new NodeIO().writeBinary(doc);
writeFileSync(`${OUT_DIR}/bust.glb`, glb);
writeFileSync(
  `${OUT_DIR}/bust.json`,
  JSON.stringify(
    {
      source: SOURCE,
      commit: COMMIT,
      licence: "CC0-1.0 (MakeHuman assets, license.txt §C)",
      yCut: Y_CUT,
      xCut: X_CUT,
      vertices: positions.length / 3,
      triangles: indices.length / 3,
      bounds,
    },
    null,
    2,
  ) + "\n",
);
writeFileSync(
  `${OUT_DIR}/bust.LICENSE.txt`,
  [
    "bust.glb — derived from the MakeHuman base mesh (makehuman/data/3dobjs/base.obj),",
    `commit ${COMMIT}, cropped to head + neck + shoulders and normalised by scripts/build-bust.ts.`,
    "The MakeHuman assets, including the base mesh, are released under CC0 1.0 Universal",
    "(https://github.com/makehumancommunity/makehuman/blob/master/makehuman/license.txt, section C).",
    "No rights reserved.",
    "",
  ].join("\n"),
);
console.log(
  `bust.glb: ${positions.length / 3} vertices, ${indices.length / 3} triangles, ${glb.byteLength} bytes`,
);
