"use client";
import { useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  LineBasicNodeMaterial,
  LineSegments,
} from "three/webgpu";
import { makeNoise } from "@/avatar/sim/noise";
import { mulberry32 } from "@/avatar/sim/random";
import { landscape } from "./gen/landscape";
import { landscapeCols, sceneMotionEnabled } from "./motion";
import { sceneConfig } from "./sceneConfig";
import { float, sin, time } from "three/tsl";
import { createPointSprites, spriteSizeForPointSize } from "./tsl";

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
    const { landscape: base, palette, camera, perf, motion } = sceneConfig;
    // Phase 9 perf: half the columns on mobile widths
    const cols =
      typeof window === "undefined" ? base.cols : landscapeCols(window.innerWidth, base.cols, perf);
    const l = { ...base, cols };
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
    // Phase 9: gold shimmer — opacity between from and to on TSL time (no per-frame JS work);
    // the plan's "if a shimmer is wanted, animate the gold opacity between 0.6 and 0.9 slowly"
    const { goldShimmer } = motion;
    if (sceneMotionEnabled() && goldShimmer.period > 0) {
      const mid = (goldShimmer.from + goldShimmer.to) / 2;
      const half = (goldShimmer.to - goldShimmer.from) / 2;
      gold.material.opacityNode = float(mid).add(
        sin(time.mul((Math.PI * 2) / goldShimmer.period)).mul(half),
      );
    }
    const points = createPointSprites({
      points: mesh.points,
      size: spriteSizeForPointSize(l.pointSize, camera.fov),
      color: palette.landscape,
      opacity: l.pointOpacity,
    });

    return {
      objects: [blue, gold, points.sprite] as const,
      dispose() {
        blue.geometry.dispose();
        blue.material.dispose();
        gold.geometry.dispose();
        gold.material.dispose();
        points.dispose();
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
