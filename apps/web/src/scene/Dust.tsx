"use client";
import { useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import {
  float,
  fract,
  instanceIndex,
  instancedArray,
  mix,
  sin,
  smoothstep,
  time,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import { AdditiveBlending, Sprite, SpriteNodeMaterial } from "three/webgpu";
import { mulberry32 } from "@/avatar/sim/random";
import { currentVerticalFov } from "./framing";
import { boxPoints, plumeSeeds } from "./gen/dust";
import { sceneCount, sceneMotionEnabled } from "./motion";
import { sceneConfig } from "./sceneConfig";
import { colorVec3, createPointSprites, softDisc, spriteSizeForPointSize } from "./tsl";

/**
 * Phase 11.4 (Ali) — "ambient particle life everywhere, strongest above the head". Two objects,
 * both driven entirely by TSL `time` (no per-frame JS, nothing allocated per frame):
 *
 * 1. `dust.ambient` — the global dust volume: `count` soft sprites uniform in a 6 × 4 × 3 box
 *    around the bust (gen/dust.ts `boxPoints`), each wandering on the shared Phase 10 sprite's
 *    per-point `drift` offset. depthTest on, so the bust occludes the points behind it.
 * 2. `dust.plume` — the crown plume: `count` sprites in a cone rooted at the crown, rising to
 *    `height` while the cone narrows `baseRadius` → `topRadius`. Each particle carries a lane on
 *    the unit disc, a rise phase and a speed (gen/dust.ts `plumeSeeds`); the rise is
 *    `fract(time · speed / period + phase)`, so respawn at the base is free and the cone is full
 *    at every instant. Alpha fades in over the first 8 % of the rise (respawn never pops) and
 *    out to nothing at the tip. Its own SpriteNodeMaterial (the BustShell.ts pattern) because
 *    the shared `createPointSprites` only offers static positions plus the xy drift.
 *
 * Under reduced motion both hold still: the ambient layer drops its `drift`, and the plume
 * freezes at `t = phase` with a static per-particle wobble, so the cone still reads as a spray.
 *
 * Phase 12.7 (Ali) — the ambient pass of the glow phase: 8,000 dust points over ×3 the size
 * spread and a 5,000-point plume out of a wider, taller cone at `plume.brightness`× its colour.
 * Both counts go through `sceneCount`, so a mobile viewport builds half of each.
 *
 * float()/vec2()/vec3() wrappers reify intermediate nodes for the same reason as BustShell.ts:
 * @types/three 0.185.4 narrows some TSL overloads (mix, smoothstep) to `never`.
 */
export function Dust() {
  const scene = useThree((s) => s.scene);
  const built = useMemo(() => {
    const { dust, palette, particles } = sceneConfig;
    const fov = currentVerticalFov();
    const motion = sceneMotionEnabled();

    // Phase 12.7: every count halves below `perf.mobileWidth` — the config object is never
    // mutated, the halved count rides in as an override
    const a = { ...dust.ambient, count: sceneCount(dust.ambient.count) };
    const ambient = createPointSprites({
      points: boxPoints(a, mulberry32(a.seed)),
      size: spriteSizeForPointSize(a.pointSize * particles.sizeScale, fov),
      color: palette.line,
      opacity: a.opacity,
      sizeJitter: a.sizeJitter,
      opacityJitter: a.opacityJitter,
      depthTest: true,
      ...(motion ? { drift: { amount: a.drift.amount, period: a.drift.period } } : {}),
    });

    const p = { ...dust.plume, count: sceneCount(dust.plume.count) };
    const seeds = plumeSeeds(p, mulberry32(p.seed));
    const lane = vec2(instancedArray(seeds.disc, "vec2").element(instanceIndex));
    const phase = float(instancedArray(seeds.phase, "float").element(instanceIndex));
    const speed = float(instancedArray(seeds.speed, "float").element(instanceIndex));
    // rise 0 → 1 → wrap; still (each particle parked at its seeded height) under reduced motion
    const t = motion ? float(fract(time.mul(speed).div(p.period).add(phase))) : phase;
    const radius = float(mix(float(p.baseRadius), float(p.topRadius), t));
    // lateral sway; frozen to a per-particle constant offset under reduced motion
    const swayPhase = phase.mul(Math.PI * 2);
    const wobble = float(p.wobble).mul(sin(motion ? swayPhase.add(time.mul(0.7)) : swayPhase));

    const material = new SpriteNodeMaterial();
    material.positionNode = vec3(
      float(p.crown[0]).add(lane.x.mul(radius)).add(wobble),
      float(p.crown[1]).add(t.mul(p.height)),
      float(p.crown[2]).add(lane.y.mul(radius)),
    );
    material.scaleNode = float(spriteSizeForPointSize(p.pointSize * particles.sizeScale, fov));
    // a hotter spray than the contour cyan: palette.line mixed 30 % toward white, times
    // `brightness` (Phase 12.7) — a colour multiplier, so > 1 reaches bloom on the half-float
    // buffer instead of clipping the way an opacity above 1 would
    const spray = vec3(mix(colorVec3(palette.line), vec3(1, 1, 1), float(0.3)));
    material.colorNode = vec4(vec3(spray.mul(float(p.brightness))), 1);
    material.opacityNode = softDisc()
      .mul(p.opacity)
      .mul(float(smoothstep(float(0), float(0.08), t)))
      .mul(float(1).sub(t));
    material.transparent = true;
    material.depthTest = true;
    material.depthWrite = false;
    material.blending = AdditiveBlending;
    material.toneMapped = false;

    const plume = new Sprite(material);
    plume.count = seeds.phase.length;
    plume.frustumCulled = false;

    return {
      objects: [ambient.sprite, plume] as const,
      dispose() {
        ambient.dispose();
        material.dispose();
      },
    };
  }, []);

  useEffect(() => {
    scene.add(...built.objects);
    return () => {
      scene.remove(...built.objects);
      built.dispose();
    };
  }, [scene, built]);
  return null;
}
