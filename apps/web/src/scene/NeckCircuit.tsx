"use client";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import { LineSegments2 } from "three/addons/lines/webgpu/LineSegments2.js";
import { Line2NodeMaterial } from "three/webgpu";
import { mulberry32 } from "@/avatar/sim/random";
import { currentVerticalFov } from "./framing";
import { neckCircuit } from "./gen/neck";
import { sceneMotionEnabled } from "./motion";
import { sceneConfig } from "./sceneConfig";
import { colorVec3, createPointSprites, spriteSizeForPointSize } from "./tsl";

/**
 * Phase 5 — gold circuitry from the jaw to the sternum node (docs/plans/scene-plan.md Phase 5).
 * Six hand-authored bezier strands + six radiating spokes as one fat-line object
 * (LineSegments2 + Line2NodeMaterial, the drei <Line> equivalent; linewidth in px) drawn with
 * depthTest off and renderOrder 10 so they always sit on top of the bust; the sternum node is a
 * small instanced sprite cluster. Everything comes from sceneConfig.neck.
 *
 * Phase 10.4 (Ali) — "strands look beaded, not drawn": the fat lines drop to `neck.opacity` 0.3
 * and `neck.strandPoints.perStrand` gold beads ride over each strand (per-bead sizes drawn from
 * `strandPoints.size`, seeded off `neck.seed`); the sternum cluster grows to `node.points` 40 and
 * gains one bright `node.core` sprite at its centre. All three sprite layers keep depthTest off
 * and sit above the lines (renderOrder 11 / 12). Static — no per-frame work beyond the dashes.
 */
export function NeckCircuit() {
  const scene = useThree((s) => s.scene);
  const built = useMemo(() => {
    const { neck, bust, palette } = sceneConfig;
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
        strandPoints: neck.strandPoints.perStrand,
        node: neck.node,
      },
      mulberry32(neck.seed),
    );

    // Phase 9 (plan Phase 5 optional): the strands listed in motion.neckPulse are drawn dashed
    // with a moving dash offset — a slow travelling pulse; the rest stay solid. Still (all
    // solid) under reduced motion. Segment layout: strand k = segments [k·per, (k+1)·per).
    const { neckPulse } = sceneConfig.motion;
    const per = neck.points - 1;
    const pulseStrands = sceneMotionEnabled()
      ? neckPulse.strands.filter((k) => k >= 0 && k < circuit.strandCount)
      : [];
    const isPulse = (segment: number) =>
      segment < circuit.strandCount * per && pulseStrands.includes(Math.floor(segment / per));
    const total = circuit.segments.length / 6;
    const solid: number[] = [];
    const pulsed: number[] = [];
    for (let s = 0; s < total; s++) {
      const target = isPulse(s) ? pulsed : solid;
      for (let c = 0; c < 6; c++) target.push(circuit.segments[s * 6 + c] ?? 0);
    }
    const geometry = new LineSegmentsGeometry();
    geometry.setPositions(Float32Array.from(solid));
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

    let pulse: {
      lines: LineSegments2;
      material: Line2NodeMaterial;
      geometry: LineSegmentsGeometry;
    } | null = null;
    if (pulsed.length) {
      const pulseGeometry = new LineSegmentsGeometry();
      pulseGeometry.setPositions(Float32Array.from(pulsed));
      const pulseMaterial = new Line2NodeMaterial({
        linewidth: neck.lineWidth,
        worldUnits: false,
        dashed: true,
        dashSize: neckPulse.dash,
        gapSize: neckPulse.gap,
        depthTest: false,
        depthWrite: false,
      });
      pulseMaterial.colorNode = colorVec3(palette.gold).mul(neck.opacity);
      const pulseLines = new LineSegments2(pulseGeometry, pulseMaterial);
      pulseLines.computeLineDistances(); // cumulative world distance per segment, for the dashes
      pulseLines.renderOrder = 10;
      pulseLines.frustumCulled = false;
      pulse = { lines: pulseLines, material: pulseMaterial, geometry: pulseGeometry };
    }

    // the beads over the strands: per-bead PointsMaterial sizes from a stream seeded off
    // neck.seed (the node cluster owns `neck.seed` itself), converted through the shared unit
    const fov = currentVerticalFov();
    const { particles } = sceneConfig;
    const beadRng = mulberry32(neck.seed + 1);
    const [sizeMin, sizeMax] = neck.strandPoints.size;
    const beadSizes = new Float32Array(circuit.strandPoints.length / 3);
    for (let i = 0; i < beadSizes.length; i++)
      beadSizes[i] = sizeMin + beadRng() * (sizeMax - sizeMin);
    const beads = createPointSprites({
      points: circuit.strandPoints,
      size: spriteSizeForPointSize(particles.sizeScale, fov),
      sizes: beadSizes,
      color: palette.gold,
      opacity: neck.strandPoints.opacity,
      depthTest: false,
      renderOrder: 11,
    });

    const cluster = createPointSprites({
      points: circuit.nodePoints,
      size: spriteSizeForPointSize(neck.node.pointSize, fov),
      color: palette.gold,
      opacity: 1,
      depthTest: false,
      renderOrder: 11,
    });

    // one bright sprite at the node centre — the cluster's hot core
    const core = createPointSprites({
      points: Float32Array.from(circuit.node),
      size: spriteSizeForPointSize(neck.node.core.size * particles.sizeScale, fov),
      color: palette.gold,
      opacity: neck.node.core.opacity,
      depthTest: false,
      renderOrder: 12,
    });

    const sprites = [beads.sprite, cluster.sprite, core.sprite];
    return {
      objects: pulse ? [lines, pulse.lines, ...sprites] : [lines, ...sprites],
      pulse,
      speed: neckPulse.speed,
      dispose() {
        geometry.dispose();
        lineMaterial.dispose();
        pulse?.geometry.dispose();
        pulse?.material.dispose();
        beads.dispose();
        cluster.dispose();
        core.dispose();
      },
    };
  }, []);
  // the dash offset is added to the line distance in the shader, so decreasing it moves the
  // dashes toward increasing distance: from the jaw to the sternum node
  const pulseMaterial = useRef(built.pulse?.material ?? null);
  useFrame((_, delta) => {
    const m = pulseMaterial.current;
    if (m) m.dashOffset -= built.speed * delta;
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
