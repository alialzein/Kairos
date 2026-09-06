"use client";
import { useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { float, instanceIndex, instancedArray, shapeCircle, vec4 } from "three/tsl";
import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  LineBasicNodeMaterial,
  LineSegments,
  Sprite,
  SpriteNodeMaterial,
} from "three/webgpu";
import { makeNoise } from "@/avatar/sim/noise";
import { mulberry32 } from "@/avatar/sim/random";
import { landscape } from "./gen/landscape";
import { sceneConfig } from "./sceneConfig";

/**
 * Phase 7 — wireframe mountain networks on both sides (docs/plans/scene-plan.md Phase 7): the
 * generator's grid points as one instanced sprite draw, and its kept edges as two 1 px
 * LineSegments (blue, and the gold ridge tops), all additive with depth writes off. The seeded
 * ridge noise is the repo's simplex (sim/noise.ts, noise2D(x, y) = noise3(x, y, 0)) instead of
 * the simplex-noise package, so no new dependency. Static: no per-frame work.
 */
export function Landscape() {
  const scene = useThree((s) => s.scene);
  const built = useMemo(() => {
    const { landscape: l, palette, camera } = sceneConfig;
    const n3 = makeNoise(l.noiseSeed);
    const mesh = landscape(l, (x, y) => n3(x, y, 0), mulberry32(l.seed));

    const lines = (segments: Float32Array, hex: string, opacity: number) => {
      const geometry = new BufferGeometry();
      geometry.setAttribute("position", new Float32BufferAttribute(segments, 3));
      const material = new LineBasicNodeMaterial({
        color: new Color(hex),
        transparent: true,
        opacity,
        blending: AdditiveBlending,
        depthWrite: false,
      });
      material.fog = false;
      const obj = new LineSegments(geometry, material);
      obj.frustumCulled = false;
      return obj;
    };
    const blue = lines(mesh.blue, palette.landscape, l.blueOpacity);
    const gold = lines(mesh.gold, palette.gold, l.goldOpacity);

    const c = new Color(palette.landscape);
    const pointMaterial = new SpriteNodeMaterial();
    pointMaterial.positionNode = instancedArray(mesh.points, "vec3").element(instanceIndex);
    // plan size is PointsMaterial units (no fov term); sprite world size = size · tan(fov/2)
    pointMaterial.scaleNode = float(l.pointSize * Math.tan((camera.fov * Math.PI) / 360));
    pointMaterial.colorNode = vec4(c.r, c.g, c.b, 1);
    // shapeCircle is typed as a bare Node in @types/three 0.185.4 (same gap as lines/Sparks.ts)
    pointMaterial.opacityNode = float(shapeCircle() as unknown as Parameters<typeof float>[0]).mul(
      l.pointOpacity,
    );
    pointMaterial.transparent = true;
    pointMaterial.depthWrite = false;
    pointMaterial.blending = AdditiveBlending;
    const points = new Sprite(pointMaterial);
    points.count = mesh.pointCount;
    points.frustumCulled = false;

    return {
      objects: [blue, gold, points] as const,
      dispose() {
        blue.geometry.dispose();
        blue.material.dispose();
        gold.geometry.dispose();
        gold.material.dispose();
        pointMaterial.dispose();
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
