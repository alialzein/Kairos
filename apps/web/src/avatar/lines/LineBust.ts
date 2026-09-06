import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import { LineSegments2 } from "three/addons/lines/webgpu/LineSegments2.js";
import { vec3 } from "three/tsl";
import { AdditiveBlending, InstancedBufferAttribute, Line2NodeMaterial } from "three/webgpu";
import type { Palette } from "../sim/palette";
import type { SimUniforms } from "../sim/uniforms";
import type { Contours } from "./slice";

export interface LineBust {
  mesh: LineSegments2;
  dispose(): void;
}

/** Wireframe bust (L1): the sliced contour loops drawn as fat lines. Static geometry for now;
 *  colour/opacity are TSL and follow the sim uniforms (fade in with the humanoid weight).
 *  Per-segment instanced attributes (slice, t, x) ride along for later tasks (reveal, flow). */
export function createLineBust(contours: Contours, u: SimUniforms, palette: Palette): LineBust {
  const geometry = new LineSegmentsGeometry();
  geometry.setPositions(contours.segments);
  geometry.setAttribute("segSlice", new InstancedBufferAttribute(contours.segSlice, 1));
  geometry.setAttribute("segT", new InstancedBufferAttribute(contours.segT, 1));
  geometry.setAttribute("segX", new InstancedBufferAttribute(contours.segX, 1));

  const material = new Line2NodeMaterial({
    linewidth: 1.6,
    worldUnits: false,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: AdditiveBlending,
  });
  const cyan = vec3(palette.lineCyan.r, palette.lineCyan.g, palette.lineCyan.b);
  material.colorNode = cyan.mul(u.brightness).mul(1.6);
  material.opacityNode = u.shade.mul(0.9);

  const mesh = new LineSegments2(geometry, material);
  mesh.frustumCulled = false;
  return {
    mesh,
    dispose: () => {
      geometry.dispose();
      material.dispose();
    },
  };
}
