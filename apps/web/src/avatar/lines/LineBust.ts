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
import { jawOffset, jawOpen } from "../sim/jaw";
import { makeNoise } from "../sim/noise";
import type { Palette } from "../sim/palette";
import type { SimUniforms } from "../sim/uniforms";
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
 *  buffer from the base positions, restricted to per-region index sets so idle frames cost
 *  nothing and THINKING (head twist) touches only the head. */
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

  // ---- CPU deformation ------------------------------------------------------------------
  const startAttr = geometry.getAttribute("instanceStart") as InterleavedBufferAttribute;
  const buffer = startAttr.data as InterleavedBuffer;
  const live = buffer.array as Float32Array;
  const baseSeg = contours.segments; // never mutated
  const vertexCount = baseSeg.length / 3; // each segment endpoint is a "vertex" at offset i*3
  // per-region vertex index sets, from base positions
  const mouthSet: number[] = [];
  const earSet: number[] = [];
  const headSet: number[] = [];
  for (let i = 0; i < vertexCount; i++) {
    const x = baseSeg[i * 3] ?? 0,
      y = baseSeg[i * 3 + 1] ?? 0,
      z = baseSeg[i * 3 + 2] ?? 0;
    const dm = Math.hypot(x - ANCHORS.mouth[0], y - ANCHORS.mouth[1], z - ANCHORS.mouth[2]);
    if (dm < 0.3 && y - ANCHORS.mouth[1] < 0.05) mouthSet.push(i);
    const dl = Math.hypot(x - ANCHORS.earL[0], y - ANCHORS.earL[1], z - ANCHORS.earL[2]);
    const dr = Math.hypot(x - ANCHORS.earR[0], y - ANCHORS.earR[1], z - ANCHORS.earR[2]);
    if (Math.min(dl, dr) < 0.4) earSet.push(i);
    if (y > 0.2) headSet.push(i);
  }
  const noise = makeNoise(23);
  // vertices written last frame — restored from base before this frame's effects are applied,
  // so no effect can outlive its state (no per-effect bookkeeping to get wrong)
  const touched = new Uint8Array(vertexCount);
  let touchedAny = false;

  const write = (i: number, x: number, y: number, z: number): void => {
    live[i * 3] = x;
    live[i * 3 + 1] = y;
    live[i * 3 + 2] = z;
    touched[i] = 1;
  };

  const update = (_dt: number, v: UniformValues, timeS: number): void => {
    const open = jawOpen(timeS, v.speak);
    const wantJaw = open > 0.002;
    const wantEar = v.listen > 0.01;
    const wantHead = v.vortex > 0.01;
    // OFFLINE: fray while frozen/dissolving (freeze = 1 during the hold, tint red afterwards)
    const fray = v.freeze > 0 ? 0.02 : v.tint[0] > 0.9 && v.tint[2] < 0.6 ? 0.045 : 0;
    const wantFray = fray > 0;
    let dirty = false;

    if (touchedAny) {
      for (let i = 0; i < vertexCount; i++) {
        if (touched[i]) {
          live[i * 3] = baseSeg[i * 3] ?? 0;
          live[i * 3 + 1] = baseSeg[i * 3 + 1] ?? 0;
          live[i * 3 + 2] = baseSeg[i * 3 + 2] ?? 0;
          touched[i] = 0;
        }
      }
      touchedAny = false;
      dirty = true;
    }

    if (wantFray) {
      // fray touches everything: noise displacement from base
      for (let i = 0; i < vertexCount; i++) {
        const x = baseSeg[i * 3] ?? 0,
          y = baseSeg[i * 3 + 1] ?? 0,
          z = baseSeg[i * 3 + 2] ?? 0;
        const n = noise(x * 5 + timeS * 0.8, y * 5, z * 5);
        write(
          i,
          x + n * fray,
          y + noise(y * 5, z * 5 + timeS * 0.6, x * 5) * fray,
          z + n * fray * 0.5,
        );
      }
      touchedAny = true;
      dirty = true;
    } else {
      // thinking twist: rotate the head around the vertical axis, more with height
      if (wantHead) {
        const k = v.vortex * 0.35;
        for (const i of headSet) {
          const x = baseSeg[i * 3] ?? 0,
            y = baseSeg[i * 3 + 1] ?? 0,
            z = baseSeg[i * 3 + 2] ?? 0;
          const a = (y - 0.2) * k * Math.sin(timeS * 1.3);
          const c = Math.cos(a),
            sn = Math.sin(a);
          write(i, x * c - z * sn, y, x * sn + z * c);
        }
        touchedAny = true;
        dirty = true;
      }
      // listen ripple: radial waves from the nearer ear (on top of whatever is already written)
      if (wantEar) {
        for (const i of earSet) {
          const x = live[i * 3] ?? 0,
            y = live[i * 3 + 1] ?? 0,
            z = live[i * 3 + 2] ?? 0;
          const ear = x < 0 ? ANCHORS.earL : ANCHORS.earR;
          const dx = x - ear[0],
            dy = y - ear[1],
            dz = z - ear[2];
          const d = Math.hypot(dx, dy, dz) || 1;
          const amp = 0.012 * v.listen * Math.max(0, 1 - d / 0.4) * Math.sin(d * 40 - timeS * 8);
          write(i, x + (dx / d) * amp, y + (dy / d) * amp, z + (dz / d) * amp);
        }
        touchedAny = true;
        dirty = true;
      }
      // jaw: shared formula with the particle kernel (from base — the mouth is never twisted)
      if (wantJaw) {
        for (const i of mouthSet) {
          const x = baseSeg[i * 3] ?? 0,
            y = baseSeg[i * 3 + 1] ?? 0,
            z = baseSeg[i * 3 + 2] ?? 0;
          const [ox, oy, oz] = jawOffset(x, y, z, open);
          write(i, x + ox, y + oy, z + oz);
        }
        touchedAny = true;
        dirty = true;
      }
    }
    if (dirty) buffer.needsUpdate = true;
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
