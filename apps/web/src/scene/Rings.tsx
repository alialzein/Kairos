"use client";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { Color, DoubleSide, Group, Mesh, MeshBasicNodeMaterial, RingGeometry } from "three/webgpu";
import { makeNoise } from "@/avatar/sim/noise";
import { mulberry32 } from "@/avatar/sim/random";
import { currentVerticalFov } from "./framing";
import { ringPoints, ringSpecs } from "./gen/rings";
import { sceneCount, sceneMotionEnabled } from "./motion";
import { sceneConfig } from "./sceneConfig";
import { currentLook } from "./states";
import { createPointSprites, spriteSizeForPointSize, type PointSprites } from "./tsl";

/**
 * Phase 6 — thin concentric rings behind the head (docs/plans/scene-plan.md Phase 6): one
 * RingGeometry annulus per ring (`rings.segments` theta segments) in a group at rings.center,
 * facing the camera, `palette.line` at an opacity that fades outward. The opaque bust in front
 * occludes them naturally. The renderer's 4× MSAA keeps the ~2 px annuli smooth (the plan's
 * "no aliased LineBasicMaterial circles" rule).
 *
 * Phase 10.4 (Ali) — "rings look beaded, not drawn": each annulus drops to
 * `rings.geometryOpacity` of its opacity and carries `rings.points.perRing` soft sprites
 * scattered along its circle (±`radialJitter` radially), added as a CHILD of the ring mesh so the
 * Phase 9 breathing scale carries the beads too; bead opacity fades with the ring (the innermost
 * ring's beads sit at the full `points.opacity`).
 *
 * Phase 11.4 (Ali) — the drifting dust that used to live here (`rings.drift`) moved out to its
 * own `dust` layer (Dust.tsx), which covers the whole scene instead of a disc around the head.
 *
 * Phase 12.5 (Ali) — "rings, not lines with dots": the annuli drop again to
 * `rings.geometryOpacity` (×0.4) and each carries 1,500 beads whose angles are rejection-sampled
 * against a noise density field (`rings.points.density`), so every ring has its own dense and
 * sparse arcs; each bead draws a colour multiplier from `rings.points.brightness` (> 1 feeds
 * bloom). One noise field and one rng are shared by all the rings — the ring index walks the
 * field's third axis — so the pattern differs per ring and the whole layer stays deterministic.
 */
export function Rings() {
  const scene = useThree((s) => s.scene);
  const built = useMemo(() => {
    const { rings, palette, particles } = sceneConfig;
    const fov = currentVerticalFov();
    const group = new Group();
    group.position.set(...rings.center);
    const color = new Color(palette.line);
    const meshes: Mesh<RingGeometry, MeshBasicNodeMaterial>[] = [];
    const sprites: PointSprites[] = [];
    const beadRng = mulberry32(rings.points.seed);
    const beadNoise = makeNoise(rings.points.noiseSeed);
    const beadSize = spriteSizeForPointSize(rings.points.size * particles.sizeScale, fov);
    ringSpecs(rings).forEach((spec, i) => {
      const material = new MeshBasicNodeMaterial({
        color,
        transparent: true,
        opacity: spec.opacity * rings.geometryOpacity,
        side: DoubleSide,
        depthWrite: false,
      });
      material.fog = false;
      const mesh = new Mesh(
        new RingGeometry(spec.radius, spec.radius + rings.thickness, rings.segments),
        material,
      );
      const bead = ringPoints(
        spec,
        {
          perRing: sceneCount(rings.points.perRing), // Phase 12.7: half the beads on mobile
          radialJitter: rings.points.radialJitter,
          thickness: rings.thickness,
          density: rings.points.density,
          brightness: rings.points.brightness,
        },
        i,
        beadNoise,
        beadRng,
      );
      const beads = createPointSprites({
        points: bead.points,
        brightness: bead.brightness,
        size: beadSize,
        color: palette.line,
        opacity: (rings.points.opacity * spec.opacity) / rings.opacityFrom,
      });
      sprites.push(beads);
      mesh.add(beads.sprite); // bead positions are ring-local: they breathe with the ring
      meshes.push(mesh);
      group.add(mesh);
    });

    return {
      objects: [group] as const,
      meshes,
      dispose() {
        for (const mesh of meshes) {
          mesh.geometry.dispose();
          mesh.material.dispose();
        }
        for (const s of sprites) s.dispose();
      },
    };
  }, []);
  // Phase 9 (plan Phase 6 optional): every ring breathes 1 → 1 + amount → 1 over `period`
  // with a per-ring phase offset; scale-only updates, nothing allocated; still under reduced
  // motion.
  // b5-32 (seven-state wiring): the rate and the amount are the state driver's — `ringBreathPeriod`
  // seconds per breath, `motion.ringBreath.amount × look.ringBreathAmount` deep. The phase is
  // ACCUMULATED (`+= 2π/period · dt`) rather than `elapsedTime · 2π/period`, so a state that
  // changes the period never jumps the scale mid-breath. At the LISTENING identity the
  // accumulation is `elapsedTime · 2π/motion.ringBreath.period` and the amount is the config's.
  const breath = useMemo(() => {
    const b = sceneConfig.motion.ringBreath;
    return sceneMotionEnabled() && b.amount > 0 && b.period > 0
      ? { amount: b.amount, stagger: b.stagger }
      : null;
  }, []);
  const phase = useRef(0);
  useFrame((_, delta) => {
    if (!breath) return;
    const look = currentLook;
    if (look.ringBreathPeriod > 0) phase.current += ((Math.PI * 2) / look.ringBreathPeriod) * delta;
    const t = phase.current;
    const amount = breath.amount * look.ringBreathAmount;
    const meshes = built.meshes;
    for (let i = 0; i < meshes.length; i++) {
      meshes[i]?.scale.setScalar(1 + amount * 0.5 * (1 + Math.sin(t + i * breath.stagger)));
    }
  });

  useEffect(() => {
    scene.add(...built.objects);
    return () => {
      scene.remove(...built.objects);
      built.dispose();
    };
  }, [scene, built]);
  return null;
}
