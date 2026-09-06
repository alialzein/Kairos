"use client";
import { useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { mulberry32 } from "@/avatar/sim/random";
import { starPositions } from "./gen/stars";
import { sceneConfig } from "./sceneConfig";
import { createPointSprites } from "./tsl";

/**
 * Phase 1 — faint starfield far behind the scene. Adapts drei `<Stars>` (a GLSL points material,
 * which the WebGPU renderer cannot run) to one instanced sprite draw: static positions on a shell
 * inside the view cone, hashed per-star size/opacity jitter, no twinkle. Must stay barely visible.
 */
export function Stars() {
  const scene = useThree((s) => s.scene);
  const built = useMemo(() => {
    const { stars, camera, palette } = sceneConfig;
    const points = starPositions(
      {
        count: stars.count,
        radius: stars.radius,
        depth: stars.depth,
        fovDeg: camera.fov,
        aspect: stars.aspect,
        camera: camera.position,
        margin: stars.margin,
      },
      mulberry32(stars.seed),
    );
    return createPointSprites({
      points,
      size: stars.size,
      color: palette.line,
      tint: stars.tint,
      opacity: stars.opacity,
      sizeJitter: stars.sizeJitter,
      opacityJitter: stars.opacityJitter,
    });
  }, []);

  useEffect(() => {
    scene.add(built.sprite);
    return () => {
      scene.remove(built.sprite);
      built.dispose();
    };
  }, [scene, built]);
  return null;
}
