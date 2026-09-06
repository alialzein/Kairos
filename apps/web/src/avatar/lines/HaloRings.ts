import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import { LineSegments2 } from "three/addons/lines/webgpu/LineSegments2.js";
import { atan, attribute, float, select, sin, time, vec3 } from "three/tsl";
import {
  AdditiveBlending,
  InstancedBufferAttribute,
  Line2NodeMaterial,
  type Node,
} from "three/webgpu";
import type { Palette } from "../sim/palette";
import type { SimUniforms } from "../sim/uniforms";
import { HALO_RINGS, haloRingSegments } from "./halo";

export interface HaloRings {
  mesh: LineSegments2;
  dispose(): void;
}

/** Dashed halo rings behind the head (look v2, L5). One fat-line object; the dash pattern
 *  per ring comes from a per-segment ring attribute, and each ring's dashes drift in its own
 *  direction (offsetNode reads the per-segment direction). A slow angular shimmer sweeps
 *  around; everything fades with the humanoid weight. */
export function createHaloRings(u: SimUniforms, palette: Palette): HaloRings {
  const g = haloRingSegments();
  const geometry = new LineSegmentsGeometry();
  geometry.setPositions(g.segments);
  geometry.setAttribute("segRing", new InstancedBufferAttribute(g.segRing, 1));
  geometry.setAttribute("segDir", new InstancedBufferAttribute(g.segDir, 1));

  const material = new Line2NodeMaterial({
    linewidth: 1.6,
    worldUnits: false,
    dashed: true,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: AdditiveBlending,
  });
  const segRing = float(attribute("segRing") as unknown as Node<"float">);
  const segDir = float(attribute("segDir") as unknown as Node<"float">);
  // per-ring dash/gap via nested selects (four rings)
  const pick = (key: "dash" | "gap") => {
    let node: Node<"float"> = float(HALO_RINGS[0]?.[key] ?? 0.05);
    for (let k = 1; k < HALO_RINGS.length; k++) {
      node = select(segRing.greaterThan(k - 0.5), float(HALO_RINGS[k]?.[key] ?? 0.05), node);
    }
    return node;
  };
  material.dashSizeNode = pick("dash");
  material.gapSizeNode = pick("gap");
  material.offsetNode = time.mul(0.08).mul(segDir);

  const start = vec3(attribute("instanceStart") as unknown as Node<"vec3">);
  const angle = atan(start.y.sub(0.42), start.x);
  const shimmer = float(0.55).add(sin(angle.mul(2).add(time.mul(0.6))).mul(0.45));
  const cyan = vec3(palette.lineCyan.r, palette.lineCyan.g, palette.lineCyan.b);
  material.colorNode = cyan.mul(u.brightness).mul(float(0.9).add(shimmer.mul(1.3)));
  // outer rings fainter
  material.opacityNode = u.shade.mul(float(0.95).sub(segRing.mul(0.12)));

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
