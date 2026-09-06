"use client";
import { useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import { LineSegments2 } from "three/addons/lines/webgpu/LineSegments2.js";
import { Line2NodeMaterial } from "three/webgpu";
import { mulberry32 } from "@/avatar/sim/random";
import { neckCircuit } from "./gen/neck";
import { sceneConfig } from "./sceneConfig";
import { colorVec3, createPointSprites, spriteSizeForPointSize } from "./tsl";

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
        controlXFactor: neck.controlXFactor,
        neckRadius: bust.neckRadius,
        lift: neck.lift,
        points: neck.points,
        node: neck.node,
      },
      mulberry32(neck.seed),
    );

    const geometry = new LineSegmentsGeometry();
    geometry.setPositions(circuit.segments);
    // Not `transparent`: a transparent Line2NodeMaterial composites in-shader against a per-frame
    // framebuffer copy (plus a mip chain); `neck.opacity` is folded into the colour instead (see
    // its comment in sceneConfig).
    const lineMaterial = new Line2NodeMaterial({
      linewidth: neck.lineWidth,
      worldUnits: false,
      depthTest: false,
      depthWrite: false,
    });
    lineMaterial.colorNode = colorVec3(palette.gold).mul(neck.opacity);
    const lines = new LineSegments2(geometry, lineMaterial);
    lines.renderOrder = 10;
    lines.frustumCulled = false;

    const cluster = createPointSprites({
      points: circuit.nodePoints,
      size: spriteSizeForPointSize(neck.node.pointSize, camera.fov),
      color: palette.gold,
      opacity: 1,
      depthTest: false,
      renderOrder: 11,
    });

    return {
      objects: [lines, cluster.sprite] as const,
      dispose() {
        geometry.dispose();
        lineMaterial.dispose();
        cluster.dispose();
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
