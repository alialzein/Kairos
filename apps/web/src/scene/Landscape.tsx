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
import { currentVerticalFov } from "./framing";
import { landscape } from "./gen/landscape";
import { landscapeCols, sceneCount, sceneMotionEnabled } from "./motion";
import { sceneConfig } from "./sceneConfig";
import { attribute, float, sin, time } from "three/tsl";
import { colorVec3, createPointSprites, spriteSizeForPointSize } from "./tsl";

/**
 * Phase 7 — wireframe mountain networks on both sides (docs/plans/scene-plan.md Phase 7), rebuilt
 * in Phase 10.1 (Ali) as a plexus network: nodes first, edges second. Six objects — blue node
 * sprites (per-node sizes), gold node sprites at goldSizeFactor×, unconnected surface dust, the
 * gold ridge dust, and the k-nearest-neighbour edges as two 1 px LineSegments (blue hints, and the
 * gold peaks) — all additive with depth writes off. The seeded ridge noise is the repo's simplex
 * (sim/noise.ts, noise2D(x, y) = noise3(x, y, 0)) instead of the simplex-noise package, so no new
 * dependency. Static: no per-frame work. Phase 11.1 (Ali) was a density pass on the generator
 * alone; Phase 12.2 (Ali) adds the ridge lines — 12,060 nodes per side, and the generator's crest
 * (the top 15 % of every column) carries a per-node / per-endpoint COLOUR multiplier, so the
 * skyline draws bigger and brighter than 1 and feeds bloom on the half-float buffer (Phase 12.1)
 * while the slope stays a dim haze. Opacity is never used for emphasis: it cannot exceed 1.
 */
export function Landscape() {
  const scene = useThree((s) => s.scene);
  const built = useMemo(() => {
    const { landscape: base, palette, perf, motion, particles } = sceneConfig;
    // Phase 9 perf: half the columns on mobile widths
    const cols =
      typeof window === "undefined" ? base.cols : landscapeCols(window.innerWidth, base.cols, perf);
    // Phase 12.7: the two dust passes halve on mobile too — overrides of the config object,
    // never a mutation of `sceneConfig`
    const l = {
      ...base,
      cols,
      dust: { ...base.dust, count: sceneCount(base.dust.count) },
      crest: {
        ...base.crest,
        dust: { ...base.crest.dust, count: sceneCount(base.crest.dust.count) },
      },
    };
    const n3 = makeNoise(l.noiseSeed);
    const mesh = landscape(l, (x, y) => n3(x, y, 0), mulberry32(l.seed));

    // round 3: every vertex carries the generator's bottom fade (smoothstep on y) — the
    // surface fades out at the bottom instead of ending on a line
    // float(): @types/three 0.185.4 types attribute() too loosely for the mul overloads
    const fadeAttr = float(attribute("fade", "float") as unknown as Parameters<typeof float>[0]);
    // Phase 12.2: the crest emphasis rides the colour, not the opacity — a crest–crest edge is
    // drawn at brightness× its palette colour, so it clears bloom's threshold on the half-float
    // buffer while the rest of the network stays a dim haze
    const brightAttr = float(
      attribute("brightness", "float") as unknown as Parameters<typeof float>[0],
    );
    const lines = (
      segments: Float32Array,
      fade: Float32Array,
      brightness: Float32Array,
      hex: string,
      opacity: number,
    ) => {
      const geometry = new BufferGeometry();
      geometry.setAttribute("position", new Float32BufferAttribute(segments, 3));
      geometry.setAttribute("fade", new Float32BufferAttribute(fade, 1));
      geometry.setAttribute("brightness", new Float32BufferAttribute(brightness, 1));
      const material = new LineBasicNodeMaterial({
        color: new Color(hex),
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
      });
      material.fog = false;
      material.colorNode = colorVec3(hex).mul(brightAttr);
      material.opacityNode = float(opacity).mul(fadeAttr);
      const obj = new LineSegments(geometry, material);
      obj.frustumCulled = false;
      return obj;
    };
    const blue = lines(
      mesh.blue,
      mesh.blueFade,
      mesh.blueBrightness,
      palette.landscape,
      l.edgeOpacity,
    );
    const gold = lines(mesh.gold, mesh.goldFade, mesh.goldBrightness, palette.gold, l.goldOpacity);
    // Phase 9: gold shimmer — opacity between from and to on TSL time (no per-frame JS work);
    // the plan's "if a shimmer is wanted, animate the gold opacity between 0.6 and 0.9 slowly"
    const { goldShimmer } = motion;
    if (sceneMotionEnabled() && goldShimmer.period > 0) {
      const mid = (goldShimmer.from + goldShimmer.to) / 2;
      const half = (goldShimmer.to - goldShimmer.from) / 2;
      gold.material.opacityNode = float(mid)
        .add(sin(time.mul((Math.PI * 2) / goldShimmer.period)).mul(half))
        .mul(fadeAttr);
    }
    // the generator's node sizes are PointsMaterial units, so the sprite size is the unit
    // conversion factor for a PointsMaterial size of 1 (× the Phase 10 scale) and the per-node
    // sizes do the rest
    const unit = spriteSizeForPointSize(particles.sizeScale, currentVerticalFov());
    const nodes = createPointSprites({
      points: mesh.nodes,
      size: unit,
      sizes: mesh.nodeSizes,
      color: palette.landscape,
      opacity: l.nodeOpacity,
      opacities: mesh.nodeFade,
      brightness: mesh.nodeBrightness,
    });
    const goldNodes = createPointSprites({
      points: mesh.goldNodes,
      size: unit,
      sizes: mesh.goldNodeSizes,
      color: palette.gold,
      opacity: l.nodeOpacity,
      opacities: mesh.goldNodeFade,
      brightness: mesh.goldNodeBrightness,
    });
    const dust = createPointSprites({
      points: mesh.dust,
      size: spriteSizeForPointSize(l.dust.size * particles.sizeScale, currentVerticalFov()),
      color: palette.landscape,
      opacity: l.dust.opacity,
      opacities: mesh.dustFade,
    });
    // Phase 12.2: the gold ridge dust — the same soft sprite, hugging the crest at its own size
    // and opacity (no brightness multiplier: it is a haze around the ridge, not the ridge)
    const goldDust = createPointSprites({
      points: mesh.goldDust,
      size: spriteSizeForPointSize(l.crest.dust.size * particles.sizeScale, currentVerticalFov()),
      color: palette.gold,
      opacity: l.crest.dust.opacity,
      opacities: mesh.goldDustFade,
    });

    return {
      objects: [blue, gold, nodes.sprite, goldNodes.sprite, dust.sprite, goldDust.sprite] as const,
      dispose() {
        blue.geometry.dispose();
        blue.material.dispose();
        gold.geometry.dispose();
        gold.material.dispose();
        nodes.dispose();
        goldNodes.dispose();
        dust.dispose();
        goldDust.dispose();
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
