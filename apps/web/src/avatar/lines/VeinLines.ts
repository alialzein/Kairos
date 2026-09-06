import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import { LineSegments2 } from "three/addons/lines/webgpu/LineSegments2.js";
import { attribute, float, mix, sin, time, vec3 } from "three/tsl";
import {
  AdditiveBlending,
  InstancedBufferAttribute,
  Line2NodeMaterial,
  type Node,
} from "three/webgpu";
import type { Palette } from "../sim/palette";
import type { SimUniforms } from "../sim/uniforms";
import type { VeinTree } from "./veins";

export interface VeinLines {
  mesh: LineSegments2;
  dispose(): void;
}

/** Orange energy veins (look v2, L4): dashed fat lines whose dash pattern travels downward
 *  (the pulse) while a brightness wave runs along the path distance; brighter with the core
 *  pulse and bass, warmer with coreHeat, fading with the humanoid weight. */
export function createVeinLines(tree: VeinTree, u: SimUniforms, palette: Palette): VeinLines {
  const geometry = new LineSegmentsGeometry();
  geometry.setPositions(tree.segments);
  geometry.setAttribute("segT", new InstancedBufferAttribute(tree.segT, 1));
  geometry.setAttribute("segGen", new InstancedBufferAttribute(tree.segGen, 1));

  const material = new Line2NodeMaterial({
    linewidth: 2.8,
    worldUnits: false,
    dashed: true,
    dashSize: 0.07,
    gapSize: 0.018,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: AdditiveBlending,
  });
  // the dash offset grows with time so dashes flow from the throat toward the chest
  material.offsetNode = time.mul(-0.35);

  const segT = float(attribute("segT") as unknown as Node<"float">);
  const segGen = float(attribute("segGen") as unknown as Node<"float">);
  const pulse = float(0.55).add(sin(segT.mul(9).sub(time.mul(2.2))).mul(0.45));
  const warm = mix(
    vec3(palette.coreLine.r, palette.coreLine.g, palette.coreLine.b),
    vec3(palette.coreLineHot.r, palette.coreLineHot.g, palette.coreLineHot.b),
    u.coreHeat.mul(0.6).add(segGen.mul(0.15)),
  );
  material.colorNode = warm
    .mul(u.brightness)
    .mul(float(0.9).add(u.corePulse.mul(0.7)).add(u.bass.mul(0.6)))
    .mul(pulse)
    .mul(3.4);
  // thinner generations fade a little so the trunk dominates
  material.opacityNode = u.shade.mul(float(1).sub(segGen.mul(0.18)));

  const mesh = new LineSegments2(geometry, material);
  mesh.computeLineDistances();
  mesh.frustumCulled = false;
  return {
    mesh,
    dispose: () => {
      geometry.dispose();
      material.dispose();
    },
  };
}
