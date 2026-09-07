"use client";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { Color, DoubleSide, Group, Mesh, MeshBasicNodeMaterial, RingGeometry } from "three/webgpu";
import { mulberry32 } from "@/avatar/sim/random";
import { currentVerticalFov } from "./framing";
import { ringPoints, ringSpecs } from "./gen/rings";
import { sceneMotionEnabled } from "./motion";
import { sceneConfig } from "./sceneConfig";
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
    const beadSize = spriteSizeForPointSize(rings.points.size * particles.sizeScale, fov);
    for (const spec of ringSpecs(rings)) {
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
      const beads = createPointSprites({
        points: ringPoints(
          spec,
          {
            perRing: rings.points.perRing,
            radialJitter: rings.points.radialJitter,
            thickness: rings.thickness,
          },
          beadRng,
        ),
        size: beadSize,
        color: palette.line,
        opacity: (rings.points.opacity * spec.opacity) / rings.opacityFrom,
      });
      sprites.push(beads);
      mesh.add(beads.sprite); // bead positions are ring-local: they breathe with the ring
      meshes.push(mesh);
      group.add(mesh);
    }

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
  // motion
  const breath = useMemo(() => {
    const b = sceneConfig.motion.ringBreath;
    return sceneMotionEnabled() && b.amount > 0 && b.period > 0
      ? { amount: b.amount, omega: (Math.PI * 2) / b.period, stagger: b.stagger }
      : null;
  }, []);
  useFrame(({ clock }) => {
    if (!breath) return;
    const t = clock.elapsedTime * breath.omega;
    built.meshes.forEach((mesh, i) => {
      mesh.scale.setScalar(1 + breath.amount * 0.5 * (1 + Math.sin(t + i * breath.stagger)));
    });
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
