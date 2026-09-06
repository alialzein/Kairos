import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import { LineSegments2 } from "three/addons/lines/webgpu/LineSegments2.js";
import { attribute, float, sin, time, vec3 } from "three/tsl";
import {
  AdditiveBlending,
  InstancedBufferAttribute,
  Line2NodeMaterial,
  type Node,
} from "three/webgpu";
import type { Palette } from "../sim/palette";
import type { SimUniforms } from "../sim/uniforms";
import type { VeinTree } from "./veins";

export interface RidgeVeins {
  mesh: LineSegments2;
  dispose(): void;
}

/** Orange lightning along the mountain ridges (look v2, L6): dashed fat lines riding the
 *  crests. Each vein flares in its own slow pseudo-random bursts (product-of-sines envelope,
 *  phase from the vein index) over a faint always-on ember, with the dash pattern flowing along
 *  the vein. Background layer: independent of the avatar state. */
export function createRidgeVeins(tree: VeinTree, u: SimUniforms, palette: Palette): RidgeVeins {
  const geometry = new LineSegmentsGeometry();
  geometry.setPositions(tree.segments);
  geometry.setAttribute("segT", new InstancedBufferAttribute(tree.segT, 1));
  geometry.setAttribute("segGen", new InstancedBufferAttribute(tree.segGen, 1));

  const material = new Line2NodeMaterial({
    linewidth: 1.8,
    worldUnits: false,
    dashed: true,
    dashSize: 0.09,
    gapSize: 0.04,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: AdditiveBlending,
  });
  material.offsetNode = time.mul(-0.45);

  const segT = float(attribute("segT") as unknown as Node<"float">);
  const vein = float(attribute("segGen") as unknown as Node<"float">);
  const phase = vein.mul(1.7);
  const flash = sin(time.mul(0.23).add(phase))
    .mul(sin(time.mul(0.37).add(2).add(phase.mul(0.6))))
    .max(0)
    .pow(3);
  // a spark travels along the vein during a flash
  const travel = float(0.6).add(sin(segT.mul(7).sub(time.mul(3))).mul(0.4));
  const warm = vec3(palette.coreLineHot.r, palette.coreLineHot.g, palette.coreLineHot.b);
  const ember = vec3(palette.coreLine.r, palette.coreLine.g, palette.coreLine.b);
  material.colorNode = ember.mul(1.1).add(warm.mul(flash).mul(travel).mul(3.6)).mul(u.brightness);
  material.opacityNode = float(0.9);

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
