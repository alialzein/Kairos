import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import { LineSegments2 } from "three/addons/lines/webgpu/LineSegments2.js";
import {
  attribute,
  float,
  hash,
  instanceIndex,
  length,
  mix,
  select,
  sin,
  smoothstep,
  time,
  uniform,
  vec3,
} from "three/tsl";
import {
  AdditiveBlending,
  InstancedBufferAttribute,
  Line2NodeMaterial,
  Vector3,
  type InterleavedBuffer,
  type InterleavedBufferAttribute,
  type Node,
} from "three/webgpu";
import { ANCHORS } from "../sim/canonical";
import type { UniformValues } from "../sim/frame";
import type { Palette } from "../sim/palette";
import type { SimUniforms } from "../sim/uniforms";
import { createLineDeformer } from "./deform";
import type { Contours } from "./slice";

export interface LineBust {
  mesh: LineSegments2;
  /** CPU vertex deformations for the current frame (jaw, listen ripple, thinking twist, offline fray). */
  update(dt: number, v: UniformValues, timeS: number): void;
  dispose(): void;
}

const c3 = (c: { r: number; g: number; b: number }) => vec3(c.r, c.g, c.b);

/** Wireframe bust: the sliced contour loops drawn as fat lines.
 *  Colour/opacity/reveal are TSL; the fat-line material derives its vertices from the
 *  instanceStart/instanceEnd interleaved buffer, so geometry animation is a CPU rewrite of that
 *  buffer (lines/deform.ts). */
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
  const segX = float(attribute("segX") as unknown as Node<"float">);

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
  // vein zone (L4): the torso contours dim along the spine column so the orange lightning tree
  // between throat and chest node has contrast, as in the reference
  const veinZone = smoothstep(0.2, 0.05, mid.x.abs())
    .mul(smoothstep(0.24, 0.1, mid.y))
    .mul(smoothstep(-0.46, -0.32, mid.y))
    .mul(facing);
  // where the orange lives the lines get DIMMER, not brighter: dense additive stacking on the
  // face front otherwise sums to white and erases the hue; CoreFill supplies the warm glow.
  // u.tint carries OFFLINE's red.
  material.colorNode = base
    .mul(u.brightness)
    .mul(u.tint)
    .mul(1.5)
    .mul(wave)
    .mul(float(1).sub(coreGlow.mul(0.35)))
    .mul(float(1).sub(veinZone.mul(0.55)));
  // reveal sweep (L8): during WAKING each segment appears when the linear assembly progress
  // passes its x-based delay (same mapping as the particle kernel, so both layers sweep together)
  const xNorm = segX.mul(0.4).add(0.5).clamp(0, 1);
  const delay = xNorm.mul(0.55).add(hash(instanceIndex.add(11)).mul(0.15));
  const reveal = select(
    u.assemble.greaterThan(0),
    smoothstep(delay, delay.add(0.3), u.assemble),
    float(1),
  );
  material.opacityNode = u.shade.mul(0.92).mul(reveal);

  const mesh = new LineSegments2(geometry, material);
  mesh.frustumCulled = false;

  // ---- CPU deformation (lines/deform.ts) ------------------------------------------------
  // the interleaved buffer wraps contours.segments itself (setPositions does not copy), so the
  // deformer snapshots its own base and rewrites the live array per frame
  const startAttr = geometry.getAttribute("instanceStart") as InterleavedBufferAttribute;
  const buffer = startAttr.data as InterleavedBuffer;
  const deformer = createLineDeformer(buffer.array as Float32Array);
  const update = (_dt: number, v: UniformValues, timeS: number): void => {
    if (deformer.update(v, timeS)) buffer.needsUpdate = true;
  };

  return {
    mesh,
    update,
    dispose: () => {
      geometry.dispose();
      material.dispose();
    },
  };
}
