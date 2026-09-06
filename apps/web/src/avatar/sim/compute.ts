import {
  Fn,
  clamp,
  dot,
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

  // Bust surface normals (zeros for core/spine) — static like regionSpine, material-only.
  const bustNormal = vec3(
    instancedBufferAttribute(
      new InstancedBufferAttribute(targets.humanoidNormals, 3),
    ) as unknown as Node<"vec3">,
  );

  const headAnchor = uniform(v3(ANCHORS.head));
  const faceAnchor = uniform(v3(ANCHORS.face));
  const earL = uniform(v3(ANCHORS.earL));
  const earR = uniform(v3(ANCHORS.earR));
  const eyeL = uniform(v3(ANCHORS.eyeL));
  const eyeR = uniform(v3(ANCHORS.eyeR));
  const mouthAnchor = uniform(v3(ANCHORS.mouth));

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

    // Directional assembly (avatar-polish T5): during WAKING each particle's morph progress is
    // delayed by its destination x (left first) plus a little per-particle jitter, so the bust
    // visibly assembles in a sweep across the frame instead of all at once.
    const mGlobal = smoothstep(0, 1, u.morph);
    const xNorm = targetB.element(i).x.mul(0.4).add(0.5).clamp(0, 1);
    const delay = xNorm.mul(0.55).add(seed.mul(0.15));
    // u.assemble is the LINEAR waking progress (0 outside WAKING) — the eased morph saturates
    // too fast for per-particle delays to read as a sweep
    const mSweep = smoothstep(delay, delay.add(0.3), u.assemble);
    const target = mix(
      targetA.element(i).xyz,
      targetB.element(i).xyz,
      select(u.assemble.greaterThan(0), mSweep, mGlobal),
    ).toVar();
    // ORB breathing (±3 % over 4 s) — main particles only
    const breath = float(1).add(
      u.breathing.mul(sin(time.mul(Math.PI / 2))).mul(select(isMain, 1, 0)),
    );
    target.mulAssign(breath);
    // SPEAKING: the jaw talks — the region below the mouth anchor drops down-and-forward with
    // an open/close oscillation scaled by speech energy. Displacing the TARGET (not a force)
    // keeps the chin moving as one coherent piece instead of churning particles into fuzz.
    const dm = target.sub(mouthAnchor);
    const open = u.speak.mul(sin(time.mul(9)).mul(0.5).add(0.5));
    const jawDrop = open
      .mul(0.09)
      .mul(smoothstep(0.26, 0.06, length(dm)))
      .mul(smoothstep(0.03, -0.05, dm.y));
    target.addAssign(vec3(0, jawDrop.negate(), jawDrop.mul(0.3)));

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
    // gentle face shimmer only — with sustained speech energy a strong outward pulse dissolved
    // the whole head into fuzz; the jaw below carries the visible talking motion instead
    const pulse = normalize(fromFace)
      .mul(u.speak.mul(0.3))
      .mul(select(isFace, 1, 0.05));
    // LISTENING: particles near the ears pull inward with mic energy (tight radius — 0.6
    // covered the whole head and made the entire face throb with the energy envelope)
    const ear = select(pos.x.lessThan(0), earL, earR);
    const toEar = ear.sub(pos);
    const earPull = toEar.mul(u.listen.mul(2)).mul(smoothstep(0.35, 0.0, length(toEar)));

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
  // rare, subtle glints — at 10 % share × 2.5 size the additive cloud read as all-over fuzz
  // whenever live audio carried treble
  const sparkle = float(1).add(u.treble.mul(step(0.96, seed)).mul(0.7));
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
  // Fake key light: the additive cloud has no shading, so shallow relief (eye sockets, nose,
  // lips) reads as a flat glow. A Lambert term against the sampled bust normal restores it —
  // front-upper-left key, dark falloff doubling as ambient occlusion for back-facing particles.
  // u.shade fades the effect in only while the morph target is the HUMANOID; other shapes'
  // particles keep uniform brightness. Core also dims with shade: its bloom flooding through
  // the head is what erased the face.
  const keyDir = normalize(vec3(-0.5, 0.6, 0.62));
  const lambert = clamp(dot(bustNormal, keyDir), 0, 1);
  const lit = mix(float(1), float(0.15).add(lambert.mul(1.2)), u.shade);
  // The head core ball (first 60 % of core particles, docs/06 §2) sits at eye level inside the
  // skull; additive blending ignores occlusion, so at full brightness it floods the face. Dim it
  // hard while humanoid, keep the chest core hot so the amber still reads through the torso.
  // Look v2: while the line bust is up its orange striations ARE the core, so the particle
  // lamps (crown/throat) and the spine column step far back — they were blowing the face to white.
  const isHeadCore = float(instanceIndex).lessThan(u.coreEnd.mul(0.6));
  const coreDim = mix(float(1), select(isHeadCore, float(0.04), float(0.1)), u.shade);
  const spineDim = mix(float(1), float(0.1), u.shade);
  // Defined eyes: darken the socket bowl around each measured eye anchor and light a small
  // cool pupil at its centre — both gated by shade so non-humanoid shapes are untouched.
  const dEye = length(posAttr.sub(eyeL)).min(length(posAttr.sub(eyeR)));
  const socket = smoothstep(0.11, 0.05, dEye);
  const pupil = smoothstep(0.055, 0.02, dEye);
  const eyeShade = mix(float(1), float(0.25), socket.mul(u.shade));
  const pupilGlow = vec3(0.55, 0.85, 1).mul(pupil).mul(u.shade).mul(6);
  // Streamline ribbons (avatar-polish T2): thin glowing contour bands wrap the bust like
  // topographic flow-lines, drifting slowly upward with a slight forward tilt so they read
  // as motion. Pure brightness modulation on main particles, gated by shade — the eye/mouth
  // region is masked out so the face features keep their own contrast.
  const bandPhase = posAttr.y.mul(7).add(posAttr.z.mul(1.5)).sub(time.mul(0.35));
  const bandWave = sin(bandPhase.mul(Math.PI * 2))
    .mul(0.5)
    .add(0.5);
  const faceMask = oneMinus(smoothstep(0.3, 0.14, dEye));
  const ribbon = smoothstep(0.84, 0.97, bandWave).mul(u.shade).mul(faceMask);
  const color = select(
    role.equal(0),
    coreColor.mul(coreDim),
    select(
      role.equal(1),
      spineColor.mul(spineDim),
      mainColor
        .mul(float(1).add(faceGlow))
        .mul(lit)
        .mul(eyeShade)
        .mul(float(1).add(ribbon.mul(2.2)))
        .add(pupilGlow),
    ),
  );
  // Energy conservation across tiers: the cloud is additive, so at high particle counts thousands
  // of overlapping sprites sum past white and erase all colour texture (ultra looked like a white
  // blob while mid kept its blues). Scale per-particle light so total emitted light stays roughly
  // constant relative to the mid tier; core/spine keep full brightness so the amber still reads.
  const densityScale = Math.min(1, Math.max(0.3, Math.sqrt(60_000 / n)));
  const perParticle = select(role.equal(2), float(densityScale), float(1));
  material.colorNode = vec4(color.mul(u.brightness).mul(u.tint).mul(perParticle), 1);
  // shapeCircle() is typed as the bare `Node` (no "float" literal type param) in @types/three 0.185.4,
  // so it is missing the arithmetic proxy methods (.mul etc.) that every other TSL scalar carries.
  // Reify it through float() (a real scalar node) to restore them; runtime shape is identical.
  const circleMask = float(shapeCircle() as unknown as Parameters<typeof float>[0]);
  // Look v2: while the bust is assembled the fat-line layer carries it; main-particle dust dims
  // to 25 % underneath (a few sparks remain, as in the reference). Core/spine keep their alpha.
  // core lamps + spine sprites fade OUT with the line bust (their stacked sprites cross the bloom
  // threshold even at a few % colour, and the reference has no lamps — the vein lines take over)
  const dustDim = select(role.equal(2), oneMinus(u.shade.mul(0.85)), oneMinus(u.shade));
  material.opacityNode = circleMask
    .mul(u.alpha)
    .mul(select(role.equal(0), float(1), float(0.7)))
    .mul(dustDim);
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
