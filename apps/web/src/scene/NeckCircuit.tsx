"use client";
import { useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import { LineSegments2 } from "three/addons/lines/webgpu/LineSegments2.js";
import { float, instanceIndex, instancedArray, shapeCircle, vec3, vec4 } from "three/tsl";
import {
  AdditiveBlending,
  Color,
  Line2NodeMaterial,
  Sprite,
  SpriteNodeMaterial,
} from "three/webgpu";
import { mulberry32 } from "@/avatar/sim/random";
import { neckCircuit } from "./gen/neck";
import { sceneConfig } from "./sceneConfig";

/**
 * Phase 5 — gold circuitry from the jaw to the sternum node (docs/plans/scene-plan.md Phase 5).
 * Six hand-authored bezier strands + six radiating spokes as one fat-line object
 * (LineSegments2 + Line2NodeMaterial, the drei <Line> equivalent; linewidth in px) drawn with
 * depthTest off and renderOrder 10 so they always sit on top of the bust; the sternum node is a
 * small instanced sprite cluster. Everything comes from sceneConfig.neck.
 */
export function NeckCircuit() {
  const scene = useThree((s) => s.scene);
  const built = useMemo(() => {
    const { neck, bust, palette, camera } = sceneConfig;
    const circuit = neckCircuit(
      {
        jawY: neck.jawY,
        jawXs: neck.jawXs,
        nodeY: neck.nodeY,
        controlY: neck.controlY,
        neckRadius: bust.neckRadius,
        lift: neck.lift,
        points: neck.points,
        node: neck.node,
      },
      mulberry32(neck.seed),
    );
    const gold = new Color(palette.gold);
    const goldNode = vec3(gold.r, gold.g, gold.b);

    const geometry = new LineSegmentsGeometry();
    geometry.setPositions(circuit.segments);
    // Not `transparent`: a transparent Line2NodeMaterial composites in-shader against a per-frame
    // framebuffer copy (plus a mip chain); over the dark bust `gold × 0.9` is the same colour as
    // 90 % opacity, so the plan's opacity is folded into the colour instead.
    const lineMaterial = new Line2NodeMaterial({
      linewidth: neck.lineWidth,
      worldUnits: false,
      depthTest: false,
      depthWrite: false,
    });
    lineMaterial.colorNode = goldNode.mul(neck.opacity);
    const lines = new LineSegments2(geometry, lineMaterial);
    lines.renderOrder = 10;
    lines.frustumCulled = false;

    const pointMaterial = new SpriteNodeMaterial();
    pointMaterial.positionNode = instancedArray(circuit.nodePoints, "vec3").element(instanceIndex);
    // plan sizes are PointsMaterial units (px = size · H/2 / depth, no fov term); a sprite of
    // world size s covers s · H/2 / (depth · tan(fov/2)) px, so s = size · tan(fov/2)
    pointMaterial.scaleNode = float(neck.node.pointSize * Math.tan((camera.fov * Math.PI) / 360));
    pointMaterial.colorNode = vec4(goldNode, 1);
    // shapeCircle is typed as a bare Node in @types/three 0.185.4 (same gap as lines/Sparks.ts)
    pointMaterial.opacityNode = float(shapeCircle() as unknown as Parameters<typeof float>[0]);
    pointMaterial.transparent = true;
    pointMaterial.depthTest = false;
    pointMaterial.depthWrite = false;
    pointMaterial.blending = AdditiveBlending;
    const points = new Sprite(pointMaterial);
    points.count = neck.node.points;
    points.renderOrder = 11;
    points.frustumCulled = false;

    return {
      lines,
      points,
      dispose() {
        geometry.dispose();
        lineMaterial.dispose();
        pointMaterial.dispose();
      },
    };
  }, []);

  useEffect(() => {
    scene.add(built.lines, built.points);
    return () => {
      scene.remove(built.lines, built.points);
      built.dispose();
    };
  }, [scene, built]);
  return null;
}
