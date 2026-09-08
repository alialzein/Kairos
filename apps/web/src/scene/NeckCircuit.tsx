"use client";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import { LineSegments2 } from "three/addons/lines/webgpu/LineSegments2.js";
import { Line2NodeMaterial } from "three/webgpu";
import { mulberry32 } from "@/avatar/sim/random";
import { currentVerticalFov } from "./framing";
import { neckCircuit } from "./gen/neck";
import { sceneCount, sceneMotionEnabled } from "./motion";
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
 * `strandPoints.size`, seeded off `neck.seed`); the sternum cluster grows (Phase 12.6: into
 * `neck.nucleus`) and gains one bright core sprite at its centre. All three sprite layers keep
 * depthTest off
 * and sit above the lines (renderOrder 11 / 12). Static — no per-frame work beyond the dashes.
 *
 * Phase 11.3 (Ali) — "gold nerves/veins, not a harp": `neck.branches` sub-branches leave every
 * strand (see gen/neck.ts). Their fat lines join the solid line object (one draw, the pulse
 * strands keep their own), their beads are one more sprite layer, and the bright bead at each
 * branch point and tip is a third. Strand and branch beads are dimmed per bead by the generator's
 * brightness draws, so the circuitry reads as nerves rather than an even string of lights.
 *
 * Phase 12.6 (Ali) — "a glowing nucleus at the sternum fed by gold nerves": 10 strands on a wider
 * `neck.cylinderRadius` cylinder, branches recursed to `branches.depth` 2, and the per-bead
 * brightness moved from `opacities` to `brightness` (a colour multiplier: > 1 feeds the Phase 12.1
 * bloom on the half-float buffer, which an opacity never could). The sternum cluster becomes
 * `neck.nucleus` — one draw of 300 sprites mixed per point from `palette.edge` at the core to
 * `palette.gold` at the rim — under the same hot core sprite, now blue-white at `core.brightness`.
 */
export function NeckCircuit() {
  const scene = useThree((s) => s.scene);
  const built = useMemo(() => {
    const { neck, palette } = sceneConfig;
    const circuit = neckCircuit(
      {
        jawY: neck.jawY,
        jawXs: neck.jawXs,
        nodeY: neck.nodeY,
        controlY: neck.controlY,
        controlXFactor: neck.controlXFactor,
        neckRadius: neck.cylinderRadius,
        lift: neck.lift,
        points: neck.points,
        // Phase 12.7: half the beads and half the nucleus on mobile (the branch counts are
        // structural, not density — they stay)
        strandPoints: sceneCount(neck.strandPoints.perStrand),
        strandBrightness: neck.strandPoints.brightness,
        branches: neck.branches,
        nucleus: { ...neck.nucleus, points: sceneCount(neck.nucleus.points) },
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
    // Phase 11.3: the sub-branches are never pulsed, so they ride in the solid object — one draw
    const solidPositions = new Float32Array(solid.length + circuit.branchSegments.length);
    solidPositions.set(solid);
    solidPositions.set(circuit.branchSegments, solid.length);
    const geometry = new LineSegmentsGeometry();
    geometry.setPositions(solidPositions);
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
    const drawSizes = (count: number) => {
      const sizes = new Float32Array(count);
      for (let i = 0; i < count; i++) sizes[i] = sizeMin + beadRng() * (sizeMax - sizeMin);
      return sizes;
    };
    // strand beads first, then the branch beads: one stream, so both layers stay deterministic
    const beadSizes = drawSizes(circuit.strandPointCount * circuit.strandCount);
    const branchSizes = drawSizes(circuit.branchPointCount);
    const beads = createPointSprites({
      points: circuit.strandPoints,
      size: spriteSizeForPointSize(particles.sizeScale, fov),
      sizes: beadSizes,
      color: palette.gold,
      opacity: neck.strandPoints.opacity,
      // Phase 12.6: the per-bead 0.65–1.3 draw is a COLOUR multiplier now, not an opacity — the
      // bright half of the range overdrives the bead into the bloom instead of clipping at white
      brightness: circuit.strandBrightness,
      depthTest: false,
      renderOrder: 11,
    });

    // Phase 11.3: the beads along the sub-branches — same sizes, same brightness treatment
    const branchBeads = createPointSprites({
      points: circuit.branchPoints,
      size: spriteSizeForPointSize(particles.sizeScale, fov),
      sizes: branchSizes,
      color: palette.gold,
      opacity: neck.strandPoints.opacity,
      brightness: circuit.branchBrightness,
      depthTest: false,
      renderOrder: 11,
    });

    // Phase 11.3: the bright bead at every branch point and every branch tip
    const endBeads = createPointSprites({
      points: circuit.endPoints,
      size: spriteSizeForPointSize(neck.branches.endBead.size * particles.sizeScale, fov),
      color: palette.gold,
      opacity: neck.branches.endBead.opacity,
      depthTest: false,
      renderOrder: 12,
    });

    // Phase 12.6: the nucleus — one draw over the sternum node, mixed per point from the
    // blue-white core colour to gold at the rim and multiplied past 1 so it blooms
    const nucleus = createPointSprites({
      points: circuit.nucleusPoints,
      size: spriteSizeForPointSize(neck.nucleus.pointSize, fov),
      color: palette.edge,
      colorMix: { to: palette.gold, mix: circuit.nucleusMix },
      brightness: circuit.nucleusBrightness,
      opacity: 1,
      depthTest: false,
      renderOrder: 11,
    });

    // one bright sprite at the node centre — the nucleus's hot core
    const core = createPointSprites({
      points: Float32Array.from(circuit.node),
      size: spriteSizeForPointSize(neck.nucleus.core.size * particles.sizeScale, fov),
      color: palette.edge,
      opacity: neck.nucleus.core.opacity,
      brightness: Float32Array.of(neck.nucleus.core.brightness),
      depthTest: false,
      renderOrder: 12,
    });

    const sprites = [
      beads.sprite,
      branchBeads.sprite,
      endBeads.sprite,
      nucleus.sprite,
      core.sprite,
    ];
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
        branchBeads.dispose();
        endBeads.dispose();
        nucleus.dispose();
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
