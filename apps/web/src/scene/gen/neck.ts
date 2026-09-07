import { QuadraticBezierCurve3, Vector3 } from "three";
import type { Rng } from "@/avatar/sim/random";

export interface NeckParams {
  jawY: number;
  jawXs: number[];
  nodeY: number;
  /** y of each strand's bezier control point (plan: 0.75) */
  controlY: number;
  /** control x = jawX · this (plan: 0.6): how far the strands bow inward */
  controlXFactor: number;
  /** the neck cylinder the strands hug: z = sqrt(r² − x²) + lift */
  neckRadius: number;
  /** how far in front of the cylinder the strands sit (plan: 0.02) */
  lift: number;
  /** points sampled per strand (plan: 40) */
  points: number;
  /** Phase 10.4 (Ali): bead sprites sampled per strand along the same bezier */
  strandPoints: number;
  /** sternum node: number of cluster points, their spread, spoke count and length */
  node: { points: number; spread: number; spokes: number; spokeLength: number };
}

export interface NeckCircuit {
  /** strands + spokes as fat-line segment pairs [ax ay az bx by bz, ...] */
  segments: Float32Array;
  /** Phase 10.4 (Ali): bead positions along each strand (xyz, strands × strandPointCount) */
  strandPoints: Float32Array;
  strandPointCount: number;
  /** cluster points around the sternum node (xyz) */
  nodePoints: Float32Array;
  /** the node position */
  node: [number, number, number];
  strandCount: number;
}

/** z on the neck cylinder in front of the axis for a given x. */
export const neckZ = (x: number, r: number, lift: number): number =>
  Math.sqrt(Math.max(r * r - x * x, 0)) + lift;

/**
 * Hand-authored, symmetric neck circuitry (docs/plans/scene-plan.md Phase 5): one quadratic
 * bezier per jaw x from (jawX, jawY) through the control point (jawX·0.6, controlY) to the
 * sternum node (0, nodeY), each sample lifted onto the neck cylinder by its x; plus a small
 * point cluster and `spokes` short radiating segments at the node. Deterministic for a given rng.
 *
 * Phase 10.4 (Ali): each strand is sampled a second time at `strandPoints` positions along the
 * same curve (same cylinder lift) for the bead sprites that ride over the line.
 */
export function neckCircuit(p: NeckParams, rng: Rng): NeckCircuit {
  const nodeZ = neckZ(0, p.neckRadius, p.lift);
  const node: [number, number, number] = [0, p.nodeY, nodeZ];
  const perStrand = p.points - 1;
  const segments = new Float32Array((p.jawXs.length * perStrand + p.node.spokes) * 6);
  const beadCount = Math.max(0, Math.floor(p.strandPoints));
  const strandPoints = new Float32Array(p.jawXs.length * beadCount * 3);
  let s = 0;
  let strand = 0;
  const put = (a: Vector3, b: Vector3) => {
    segments.set([a.x, a.y, a.z, b.x, b.y, b.z], s * 6);
    s++;
  };
  for (const jawX of p.jawXs) {
    const curve = new QuadraticBezierCurve3(
      new Vector3(jawX, p.jawY, 0),
      new Vector3(jawX * p.controlXFactor, p.controlY, 0),
      new Vector3(0, p.nodeY, 0),
    );
    const pts = curve.getPoints(perStrand);
    for (const v of pts) v.z = neckZ(v.x, p.neckRadius, p.lift);
    for (let i = 0; i + 1 < pts.length; i++)
      put(pts[i] ?? new Vector3(), pts[i + 1] ?? new Vector3());
    if (beadCount > 0) {
      const beads = beadCount === 1 ? [curve.getPoint(0)] : curve.getPoints(beadCount - 1);
      for (let i = 0; i < beadCount; i++) {
        const v = beads[i] ?? new Vector3();
        const o = (strand * beadCount + i) * 3;
        strandPoints[o] = v.x;
        strandPoints[o + 1] = v.y;
        strandPoints[o + 2] = neckZ(v.x, p.neckRadius, p.lift);
      }
    }
    strand++;
  }
  const centre = new Vector3(...node);
  for (let k = 0; k < p.node.spokes; k++) {
    const a = (k / p.node.spokes) * Math.PI * 2;
    const end = new Vector3(
      Math.cos(a) * p.node.spokeLength,
      p.nodeY + Math.sin(a) * p.node.spokeLength,
      nodeZ,
    );
    put(centre, end);
  }
  const nodePoints = new Float32Array(p.node.points * 3);
  for (let i = 0; i < p.node.points; i++) {
    const a = rng() * Math.PI * 2;
    const r = Math.sqrt(rng()) * p.node.spread;
    nodePoints[i * 3] = Math.cos(a) * r;
    nodePoints[i * 3 + 1] = p.nodeY + Math.sin(a) * r;
    nodePoints[i * 3 + 2] = nodeZ;
  }
  return {
    segments,
    strandPoints,
    strandPointCount: beadCount,
    nodePoints,
    node,
    strandCount: p.jawXs.length,
  };
}
