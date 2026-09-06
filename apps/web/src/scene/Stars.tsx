"use client";
import { useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import {
  float,
  hash,
  instanceIndex,
  instancedArray,
  mix,
  shapeCircle,
  vec3,
  vec4,
} from "three/tsl";
import { AdditiveBlending, Color, Sprite, SpriteNodeMaterial } from "three/webgpu";
import { mulberry32 } from "@/avatar/sim/random";
import { starPositions } from "./gen/stars";
import { sceneConfig } from "./sceneConfig";

/**
 * Phase 1 — faint starfield far behind the scene. Adapts drei `<Stars>` (a GLSL points material,
 * which the WebGPU renderer cannot run) to one instanced sprite draw: static positions on a shell
 * inside the view cone, hashed per-star brightness, no twinkle. Must stay barely visible.
 */
export function Stars() {
  const scene = useThree((s) => s.scene);
  const sprite = useMemo(() => {
    const { stars, camera, palette } = sceneConfig;
    const points = starPositions(
      {
        count: stars.count,
        radius: stars.radius,
        depth: stars.depth,
        fovDeg: camera.fov,
        aspect: stars.aspect,
        camera: camera.position,
      },
      mulberry32(stars.seed),
    );
    const material = new SpriteNodeMaterial();
    material.positionNode = instancedArray(points, "vec3").element(instanceIndex);
    const h = hash(instanceIndex.add(3));
    material.scaleNode = float(stars.size).mul(float(0.6).add(h.mul(0.8)));
    const line = new Color(palette.line);
    const tint = mix(vec3(1, 1, 1), vec3(line.r, line.g, line.b), 0.35);
    material.colorNode = vec4(tint, 1);
    // shapeCircle is typed as a bare Node in @types/three 0.185.4 (same gap as lines/Sparks.ts)
    material.opacityNode = float(shapeCircle() as unknown as Parameters<typeof float>[0])
      .mul(float(stars.opacity))
      .mul(float(0.5).add(h.mul(0.5)));
    material.transparent = true;
    material.depthWrite = false;
    material.blending = AdditiveBlending;
    const s = new Sprite(material);
    s.count = stars.count;
    s.frustumCulled = false;
    return s;
  }, []);

  useEffect(() => {
    scene.add(sprite);
    return () => {
      scene.remove(sprite);
      sprite.material.dispose();
    };
  }, [scene, sprite]);
  return null;
}
