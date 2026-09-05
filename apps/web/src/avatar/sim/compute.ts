import {
  Fn,
  float,
  hash,
  instanceIndex,
  instancedArray,
  instancedBufferAttribute,
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
  vec2,
  vec3,
  vec4,
  uniform,
} from "three/tsl";
import {
  AdditiveBlending,
  InstancedBufferAttribute,
  Sprite,
  SpriteNodeMaterial,
  Vector3,
  type ComputeNode,
  type Node,
} from "three/webgpu";
import { SHAPE_ID } from "@twin/config";
import { ANCHORS } from "./canonical";
import { packRegionSpine, packShape } from "./pack";
import type { Palette } from "./palette";
import type { Targets } from "./targets";
import type { SimUniforms } from "./uniforms";

export interface Sim {
  sprite: Sprite;
  init: ComputeNode;
  update: ComputeNode;
  /** Upload the morph endpoints' target blocks. Call every frame; no-op unless a shape changed. */
  setShapes(shapeA: number, shapeB: number): void;
  dispose(): void;
}

const v3 = (a: readonly [number, number, number]) => new Vector3(a[0], a[1], a[2]);

export function createSim(targets: Targets, u: SimUniforms, palette: Palette): Sim {
  const n = targets.n;
  u.coreEnd.value = targets.coreEnd;
  u.spineEnd.value = targets.spineEnd;

  const blocks: Float32Array[] = [];
  blocks[SHAPE_ID.HUMANOID] = packShape(targets.humanoid, targets.regions, n);
  blocks[SHAPE_ID.ORB] = packShape(targets.orb, targets.regions, n);
  blocks[SHAPE_ID.NEBULA] = packShape(targets.nebula, targets.regions, n);
  blocks[SHAPE_ID.RING] = packShape(targets.ring, targets.regions, n);
  const nebula = blocks[SHAPE_ID.NEBULA] as Float32Array;

  const positions = instancedArray(n, "vec3");
  const velocities = instancedArray(n, "vec3");
  // Morph endpoint slots — each holds one shape's block, rewritten from the CPU by setShapes().
  // Slots (fixed-index reads) instead of one packed multi-block buffer indexed by
  // `instanceIndex + n·shapeId`: three's WebGL2 fallback runs compute as transform feedback, where
  // a storage read at a computed cross-particle index silently degrades to an attribute read at the
  // particle's own index — every shape came back as block 0 (the HUMANOID bust). The kernel's four
  // storage buffers (positions, velocities, targetA, targetB) sit within WebGL2's guaranteed limit
  // of 4 transform-feedback varyings even if the backend counts read-only buffers.
  const targetA = instancedArray(nebula.slice(), "vec4");
  const targetB = instancedArray(nebula.slice(), "vec4");
  let shapeIdA = SHAPE_ID.NEBULA as number;
  let shapeIdB = SHAPE_ID.NEBULA as number;
  const upload = (slot: typeof targetA, shapeId: number): void => {
    const block = blocks[shapeId];
    if (!block) return;
    const attribute = slot.value as InstancedBufferAttribute;
    (attribute.array as Float32Array).set(block);
    attribute.needsUpdate = true;
  };
  const setShapes = (shapeA: number, shapeB: number): void => {
    if (shapeA !== shapeIdA) {
      shapeIdA = shapeA;
      upload(targetA, shapeA);
    }
    if (shapeB !== shapeIdB) {
      shapeIdB = shapeB;
      upload(targetB, shapeB);
    }
  };

  // static per-particle data the material reads: x = region, y = spine gradient position. A real
  // InstancedBufferAttribute, not a storage buffer — the WebGL2 NodeBuilder's storage-as-attribute
  // render path miscompiled intermittently (undeclared nodeAttribute / dimension mismatch).
  // instancedBufferAttribute() is typed as the bare `Node` in @types/three 0.185.4 (same
  // overload-narrowing gap as shapeCircle() below); reify through vec2() to restore swizzles.
  const regionSpine = vec2(
    instancedBufferAttribute(
      new InstancedBufferAttribute(packRegionSpine(targets.regions, targets.spineT, n), 2),
    ) as unknown as Node<"vec2">,
  );

  const headAnchor = uniform(v3(ANCHORS.head));
  const faceAnchor = uniform(v3(ANCHORS.face));
  const earL = uniform(v3(ANCHORS.earL));
  const earR = uniform(v3(ANCHORS.earR));

  const roleOf = () => {
    const fi = float(instanceIndex);
    return select(
      fi.lessThan(u.coreEnd),
      float(0),
      select(fi.lessThan(u.spineEnd), float(1), float(2)),
    );
  };

  const init = Fn(() => {
    positions.element(instanceIndex).assign(targetB.element(instanceIndex).xyz);
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
      targetA.element(i).xyz,
      targetB.element(i).xyz,
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
    // SPEAKING: face region pulses outward with mid energy (region lives in the slots' w component)
    const isFace = targetA.element(i).w.equal(1);
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
  const posAttr = positions.toAttribute();
  material.positionNode = posAttr;
  const role = roleOf();
  const seed = hash(instanceIndex.add(7));
  const roleSize = select(role.equal(0), float(2.4), select(role.equal(1), float(1.5), float(1)));
  const sparkle = float(1).add(u.treble.mul(step(0.9, seed)).mul(1.5));
  material.scaleNode = u.size
    .mul(roleSize)
    .mul(float(0.7).add(seed.mul(0.6)))
    .mul(sparkle);

  const depth = smoothstep(-0.6, 0.6, posAttr.z);
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
    regionSpine.y,
  );
  const faceGlow = select(regionSpine.x.equal(1), u.speak.mul(1.2), float(0));
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
    setShapes,
    dispose: () => {
      material.dispose();
    },
  };
}
