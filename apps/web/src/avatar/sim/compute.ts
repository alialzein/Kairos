import {
  Fn,
  float,
  hash,
  instanceIndex,
  instancedArray,
  length,
  mix,
  mx_noise_vec3,
  normalize,
  oneMinus,
  select,
  shapeCircle,
  sin,
  smoothstep,
  step,
  time,
  deltaTime,
  uint,
  vec3,
  vec4,
  uniform,
} from "three/tsl";
import {
  AdditiveBlending,
  Sprite,
  SpriteNodeMaterial,
  Vector3,
  type ComputeNode,
} from "three/webgpu";
import { SHAPE_ID } from "@twin/config";
import { ANCHORS } from "./canonical";
import { packTargets } from "./pack";
import type { Palette } from "./palette";
import type { Targets } from "./targets";
import type { SimUniforms } from "./uniforms";

export interface Sim {
  sprite: Sprite;
  init: ComputeNode;
  update: ComputeNode;
  dispose(): void;
}

const v3 = (a: readonly [number, number, number]) => new Vector3(a[0], a[1], a[2]);

export function createSim(targets: Targets, u: SimUniforms, palette: Palette): Sim {
  const n = targets.n;
  u.coreEnd.value = targets.coreEnd;
  u.spineEnd.value = targets.spineEnd;

  const positions = instancedArray(n, "vec3");
  const velocities = instancedArray(n, "vec3");
  const tAll = instancedArray(packTargets(targets), "vec4");
  // kept for the material only (face glow, spine gradient) — never read inside the compute kernel.
  const regions = instancedArray(Float32Array.from(targets.regions), "float");
  const spineT = instancedArray(targets.spineT, "float");

  const headAnchor = uniform(v3(ANCHORS.head));
  const faceAnchor = uniform(v3(ANCHORS.face));
  const earL = uniform(v3(ANCHORS.earL));
  const earR = uniform(v3(ANCHORS.earR));

  // shape id → target position for this particle (0 HUMANOID, 1 ORB, 2 NEBULA, 3 RING — SHAPE_ID in @twin/config)
  const shapeAt = (id: ReturnType<typeof float>) =>
    tAll.element(instanceIndex.add(uint(n).mul(id.toUint()))).xyz;
  const roleOf = () => {
    const fi = float(instanceIndex);
    return select(
      fi.lessThan(u.coreEnd),
      float(0),
      select(fi.lessThan(u.spineEnd), float(1), float(2)),
    );
  };

  const init = Fn(() => {
    // float(<number literal>) resolves to the `ConstNode` overload while shapeAt's parameter type is
    // inferred as the `ConvertNode` overload (same VarNode<"float", ...> shape at runtime, TSL doesn't
    // distinguish them) — same kind of @types/three overload-narrowing gap as shapeCircle() above.
    const nebulaId = float(SHAPE_ID.NEBULA) as unknown as Parameters<typeof shapeAt>[0];
    positions.element(instanceIndex).assign(shapeAt(nebulaId));
    velocities.element(instanceIndex).assign(vec3(0));
  })().compute(n);

  const update = Fn(() => {
    const i = instanceIndex;
    const pos = positions.element(i);
    const vel = velocities.element(i);
    const seed = hash(i);
    const role = roleOf();
    const isMain = role.equal(2);

    const target = mix(
      shapeAt(float(u.shapeA)),
      shapeAt(float(u.shapeB)),
      smoothstep(0, 1, u.morph),
    ).toVar();
    // ORB breathing (±3 % over 4 s) — main particles only
    const breath = float(1).add(
      u.breathing.mul(sin(time.mul(Math.PI / 2))).mul(select(isMain, 1, 0)),
    );
    target.mulAssign(breath);

    const dt = deltaTime.min(0.033);
    const flow = mx_noise_vec3(
      pos.mul(u.noiseScale).add(vec3(seed.mul(10), time.mul(0.15), 0)),
    ).mul(u.turbulence.mul(u.noiseAmp));
    // THINKING: vortex around the head
    const rel = pos.sub(headAnchor);
    const rxz = length(rel.xz).max(0.05);
    const tangent = vec3(rel.z.negate(), 0, rel.x).div(rxz);
    const vortex = tangent.mul(u.vortex.mul(2.5)).mul(smoothstep(0.9, 0.0, length(rel)));
    // pointer: repel (hover) or attract (long press) on the z = 0 plane
    const dp = pos.xy.sub(u.pointer.xy);
    const dl = length(dp).max(0.001);
    const push = vec3(dp.div(dl), 0)
      .mul(smoothstep(u.pointerRadius, 0, dl))
      .mul(u.pointerStrength.mul(3));
    // SPEAKING: face region pulses outward with mid energy (region lives in tAll's w component —
    // every block carries the same value, so the HUMANOID block, i.e. plain `i`, always has it).
    const isFace = tAll.element(i).w.equal(1);
    const fromFace = pos.sub(faceAnchor);
    const pulse = normalize(fromFace)
      .mul(u.speak.mul(0.8))
      .mul(select(isFace, 1, 0.1));
    // LISTENING: particles near the ears pull inward with mic energy
    const ear = select(pos.x.lessThan(0), earL, earR);
    const toEar = ear.sub(pos);
    const earPull = toEar.mul(u.listen.mul(2)).mul(smoothstep(0.6, 0.0, length(toEar)));

    const acc = target
      .sub(pos)
      .mul(u.spring)
      .add(flow)
      .add(vortex)
      .add(push)
      .add(pulse)
      .add(earPull);
    vel.assign(vel.mul(u.damping).add(acc.mul(dt)).mul(oneMinus(u.freeze)));
    pos.addAssign(vel.mul(dt));
  })().compute(n);

  const material = new SpriteNodeMaterial();
  material.positionNode = positions.toAttribute();
  const role = roleOf();
  const seed = hash(instanceIndex.add(7));
  const roleSize = select(role.equal(0), float(2.4), select(role.equal(1), float(1.5), float(1)));
  const sparkle = float(1).add(u.treble.mul(step(0.9, seed)).mul(1.5));
  material.scaleNode = u.size
    .mul(roleSize)
    .mul(float(0.7).add(seed.mul(0.6)))
    .mul(sparkle);

  const p = positions.element(instanceIndex);
  const depth = smoothstep(-0.6, 0.6, p.z);
  const mainColor = mix(
    vec3(palette.deep.r, palette.deep.g, palette.deep.b),
    vec3(palette.particle.r, palette.particle.g, palette.particle.b),
    seed.mul(0.6).add(depth.mul(0.4)),
  );
  const coreColor = mix(
    vec3(palette.core.r, palette.core.g, palette.core.b),
    vec3(palette.coreHot.r, palette.coreHot.g, palette.coreHot.b),
    u.coreHeat,
  )
    .mul(u.corePulse.mul(1.5).add(0.5))
    .mul(float(1).add(u.bass.mul(0.8)));
  const spineColor = mix(
    vec3(palette.spineFrom.r, palette.spineFrom.g, palette.spineFrom.b),
    vec3(palette.spineTo.r, palette.spineTo.g, palette.spineTo.b),
    spineT.element(instanceIndex),
  );
  const faceGlow = select(regions.element(instanceIndex).equal(1), u.speak.mul(1.2), float(0));
  const color = select(
    role.equal(0),
    coreColor,
    select(role.equal(1), spineColor, mainColor.mul(float(1).add(faceGlow))),
  );
  material.colorNode = vec4(color.mul(u.brightness).mul(u.tint), 1);
  // shapeCircle() is typed as the bare `Node` (no "float" literal type param) in @types/three 0.185.4,
  // so it is missing the arithmetic proxy methods (.mul etc.) that every other TSL scalar carries.
  // Reify it through float() (a real scalar node) to restore them; runtime shape is identical.
  const circleMask = float(shapeCircle() as unknown as Parameters<typeof float>[0]);
  material.opacityNode = circleMask.mul(u.alpha).mul(select(role.equal(0), float(1), float(0.7)));
  material.transparent = true;
  material.depthWrite = false;
  material.blending = AdditiveBlending;

  const sprite = new Sprite(material);
  sprite.count = n;
  sprite.frustumCulled = false;

  return {
    sprite,
    init,
    update,
    dispose: () => {
      material.dispose();
    },
  };
}
