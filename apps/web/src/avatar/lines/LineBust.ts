import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import { LineSegments2 } from "three/addons/lines/webgpu/LineSegments2.js";
import {
  attribute,
  float,
  length,
  mix,
  sin,
  smoothstep,
  step,
  time,
  uniform,
  vec3,
} from "three/tsl";
import {
  AdditiveBlending,
  InstancedBufferAttribute,
  Line2NodeMaterial,
  Vector3,
  type Node,
} from "three/webgpu";
import { ANCHORS } from "../sim/canonical";
import type { Palette } from "../sim/palette";
import type { SimUniforms } from "../sim/uniforms";
import type { Contours } from "./slice";

export interface LineBust {
  mesh: LineSegments2;
  dispose(): void;
}

const c3 = (c: { r: number; g: number; b: number }) => vec3(c.r, c.g, c.b);

/** Wireframe bust: the sliced contour loops drawn as fat lines.
 *  L1: static geometry, cyan, fades with the humanoid weight.
 *  L2: the face-front portion of every line blends to the orange core by distance from the core
 *  anchor (the reference's "orange striations" are the same lines recoloured), and a slow
 *  brightness wave travels along each loop so the wireframe reads as alive. All TSL — the
 *  fat-line material derives vertices from instanceStart/instanceEnd, so geometry animation
 *  (jaw, twist, fray) is a CPU buffer update in L8, not positionNode. */
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

  // segment midpoint in model space (the bust sits at the origin) — attribute() is typed as the
  // bare Node in @types/three 0.185.4, reify through vec3()/float() like sim/compute.ts does
  const start = vec3(attribute("instanceStart") as unknown as Node<"vec3">);
  const end = vec3(attribute("instanceEnd") as unknown as Node<"vec3">);
  const mid = start.add(end).mul(0.5);
  const segT = float(attribute("segT") as unknown as Node<"float">);
  const segSlice = float(attribute("segSlice") as unknown as Node<"float">);

  const faceCore = uniform(new Vector3(ANCHORS.face[0], ANCHORS.face[1] - 0.1, 0.2));
  // orange core: strongest at the face centre, only on camera-facing (z > 0) parts of the loops,
  // breathing with the core pulse and warming with coreHeat (THINKING)
  const facing = smoothstep(-0.05, 0.22, mid.z);
  const coreGlow = smoothstep(0.5, 0.06, length(mid.sub(faceCore)))
    .mul(facing)
    .mul(float(0.7).add(u.corePulse.mul(0.4)));
  const warm = mix(c3(palette.coreLine), c3(palette.coreLineHot), u.coreHeat);
  // saturate toward orange quickly (pow 0.6) so the face front reads orange, not peach
  const base = mix(c3(palette.lineCyan), warm, coreGlow.pow(0.6));
  // slow wave along each loop, phase-shifted per slice so it spirals up the bust
  const wave = float(0.78).add(
    sin(
      segT
        .mul(Math.PI * 6)
        .sub(time.mul(1.4))
        .add(segSlice.mul(0.35)),
    ).mul(0.22),
  );
  // keep the orange under the bloom threshold (3.5 in HDR) — above it the striations bloom to
  // white and read as a lamp, not as orange lines
  // where the orange lives the lines get DIMMER, not brighter: dense additive stacking on the
  // face front otherwise sums to white and erases the hue; CoreFill supplies the warm glow
  material.colorNode = base
    .mul(u.brightness)
    .mul(1.5)
    .mul(wave)
    .mul(float(1).sub(coreGlow.mul(0.35)));
  // accessories (glasses loops, segSlice = -1) sit brighter and whiter than the contour mesh so
  // they read through the dense lines and the orange fill
  const accessory = step(float(-0.5), segSlice.negate()); // 1 when segSlice < 0
  material.opacityNode = u.shade.mul(0.92);
  material.colorNode = mix(
    material.colorNode as unknown as Node<"vec3">,
    vec3(0.85, 0.97, 1).mul(u.brightness).mul(2.2),
    accessory,
  );

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
