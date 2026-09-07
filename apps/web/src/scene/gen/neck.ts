import { QuadraticBezierCurve3, Vector3 } from "three";
import type { Rng } from "@/avatar/sim/random";

/** Phase 12.6 (Ali): the sub-branches a branch grows of its own (`NeckBranchParams.sub`). */
export interface NeckSubBranchParams {
  /** inclusive range the per-branch sub-branch count is drawn from (plan: {1, 2}) */
  perBranch: [number, number];
  /** bezier parameter of the parent branch the sub-branch leaves at (plan: 40–80 %) */
  at: [number, number];
  /** sub-branch length = parent length · this (plan: 0.5) */
  lengthFactor: number;
}

/** Phase 11.3 (Ali): the sub-branches leaving each strand (see `NeckParams.branches`). */
export interface NeckBranchParams {
  /** inclusive range the per-strand branch count is drawn from (plan: {2, 3}) */
  perStrand: [number, number];
  /** bezier parameter the branch leaves its strand at (plan: 30–70 % of the strand) */
  at: [number, number];
  /** branch length in world units (plan: 0.12–0.3) */
  length: [number, number];
  /** radians the branch direction is rotated from the strand's local tangent, toward
   *  outward/down (plan: 0.5–1.1) — redrawn for every branch at every depth */
  angle: [number, number];
  /** beads sampled per world unit of branch length, so branches bead like the strands */
  beadsPerUnit: number;
  /** Phase 12.6 (Ali): how many levels of branch the recursion grows. 1 = Phase 11.3 (strand →
   *  branch, `sub` unused and never drawn from); 2 = branches grow their own sub-branches. */
  depth: number;
  /** Phase 12.6 (Ali): the sub-branches of a branch — only read when `depth` > 1 */
  sub: NeckSubBranchParams;
}

/** Phase 12.6 (Ali): the sternum nucleus the gold nerves feed into. */
export interface NeckNucleusParams {
  /** points scattered over the disc (plan: 300) */
  points: number;
  /** disc radius in world units (plan: 0.08) */
  radius: number;
  /** points inside this radius are the blue-white core; the rest are the gold outer ring */
  coreRadius: number;
  /** colour multiplier of the core points — > 1 so the nucleus blooms */
  coreBrightness: number;
  /** colour multiplier of the ring points */
  ringBrightness: number;
  /** radiating spokes at the node and their length */
  spokes: number;
  spokeLength: number;
}

export interface NeckParams {
  jawY: number;
  jawXs: number[];
  nodeY: number;
  /** y of each strand's bezier control point (plan: 0.75) */
  controlY: number;
  /** control x = jawX · this (plan: 0.6): how far the strands bow inward */
  controlXFactor: number;
  /** the neck cylinder the strands hug: z = sqrt(r² − x²) + lift. Phase 12.6: this is
   *  `neck.cylinderRadius` (0.3), not the primitives' `bust.neckRadius` (0.2) — the outer
   *  strands sit at |x| 0.27 and would otherwise flatten onto z = lift. */
  neckRadius: number;
  /** how far in front of the cylinder the strands sit (plan: 0.02) */
  lift: number;
  /** points sampled per strand (plan: 40) */
  points: number;
  /** Phase 10.4 (Ali): bead sprites sampled per strand along the same bezier */
  strandPoints: number;
  /** Phase 11.3 (Ali): per-bead brightness multiplier drawn uniformly from this range.
   *  Phase 12.6: [0.65, 1.3] — > 1 is a colour multiplier that feeds bloom. */
  strandBrightness: [number, number];
  /** Phase 11.3 (Ali): the sub-branches leaving each strand */
  branches: NeckBranchParams;
  /** Phase 12.6 (Ali): the sternum nucleus (replaces the Phase 5 `node` cluster) */
  nucleus: NeckNucleusParams;
}

export interface NeckCircuit {
  /** strands + spokes as fat-line segment pairs [ax ay az bx by bz, ...] */
  segments: Float32Array;
  /** Phase 10.4 (Ali): bead positions along each strand (xyz, strands × strandPointCount) */
  strandPoints: Float32Array;
  strandPointCount: number;
  /** Phase 11.3: one brightness multiplier per strand bead, same order as `strandPoints` */
  strandBrightness: Float32Array;
  /** Phase 11.3: the sub-branches as their own fat-line segment pairs (same layout as
   *  `segments`, `BRANCH_LINE_SEGMENTS` pairs per branch) — kept apart so `segments` stays
   *  strands + spokes and the pulse strand indexing does not move. Phase 12.6: the depth-2
   *  sub-branches are folded in here too. */
  branchSegments: Float32Array;
  /** Phase 11.3: bead positions along the branches (xyz), branch by branch — in the same order
   *  as `endPoints`, so a branch's beads can be cut back out of the flat array by its length */
  branchPoints: Float32Array;
  branchPointCount: number;
  /** Phase 11.3: one brightness multiplier per branch bead, same order as `branchPoints` */
  branchBrightness: Float32Array;
  /** Phase 11.3: the two bright beads of every branch (xyz), [branch point on the parent, tip] */
  endPoints: Float32Array;
  endPointCount: number;
  /** Phase 12.6: the nucleus disc at the sternum node (xyz) */
  nucleusPoints: Float32Array;
  /** Phase 12.6: 0 = blue-white core, 1 = gold ring, one per nucleus point */
  nucleusMix: Float32Array;
  /** Phase 12.6: colour multiplier per nucleus point (core / ring), > 1 so it blooms */
  nucleusBrightness: Float32Array;
  /** the node position */
  node: [number, number, number];
  strandCount: number;
}

/** fat-line segments drawn per sub-branch */
const BRANCH_LINE_SEGMENTS = 12;

/** z on the neck cylinder in front of the axis for a given x. */
export const neckZ = (x: number, r: number, lift: number): number =>
  Math.sqrt(Math.max(r * r - x * x, 0)) + lift;

/**
 * Hand-authored, symmetric neck circuitry (docs/plans/scene-plan.md Phase 5): one quadratic
 * bezier per jaw x from (jawX, jawY) through the control point (jawX·0.6, controlY) to the
 * sternum node (0, nodeY), each sample lifted onto the neck cylinder by its x; plus the nucleus
 * disc and `spokes` short radiating segments at the node. Deterministic for a given rng.
 *
 * Phase 10.4 (Ali): each strand is sampled a second time at `strandPoints` positions along the
 * same curve (same cylinder lift) for the bead sprites that ride over the line.
 *
 * Phase 11.3 (Ali) — "gold nerves/veins, not a harp": every strand grows `branches.perStrand`
 * sub-branches. A branch leaves its parent curve at parameter t ∈ `branches.at`, runs `length`
 * world units along the parent's tangent rotated by `angle` radians away from x = 0 (so it points
 * outward and down; the strand tangent runs jaw → node, i.e. downward), and bends gently off it —
 * a quadratic bezier from the origin to the tip with the control point half a length along the
 * tangent. Branches are beaded at `beadsPerUnit`, and the branch point and the tip both get a
 * bright end bead (`endPoints`). All of it is lifted onto the same neck cylinder.
 *
 * Phase 12.6 (Ali): the branching is recursive to `branches.depth` levels — each branch grows
 * `branches.sub.perBranch` sub-branches of its own, leaving at `sub.at` of the parent branch and
 * `sub.lengthFactor` × its length, drawn exactly the same way and folded into the same
 * `branchSegments` / `branchPoints` / `endPoints` arrays. At `depth: 1` nothing under `sub` is
 * read or drawn from, so a depth-1 call reproduces Phase 11.3 bit for bit.
 *
 * Rng order (deterministic per seed): for each strand in `jawXs` order — one brightness draw per
 * strand bead, then the branch count, then for each branch t, length, angle, one brightness draw
 * per bead of that branch and then (only when depth allows) that branch's own sub-branch count
 * followed by the same sequence per sub-branch. A branch's sub-branch draws therefore come AFTER
 * all of the branch's own draws, depth-first. After all strands, the nucleus (angle, radius per
 * nucleus point).
 */
export function neckCircuit(p: NeckParams, rng: Rng): NeckCircuit {
  const nodeZ = neckZ(0, p.neckRadius, p.lift);
  const node: [number, number, number] = [0, p.nodeY, nodeZ];
  const perStrand = p.points - 1;
  const segments = new Float32Array((p.jawXs.length * perStrand + p.nucleus.spokes) * 6);
  const beadCount = Math.max(0, Math.floor(p.strandPoints));
  const strandPoints = new Float32Array(p.jawXs.length * beadCount * 3);
  const strandBrightness = new Float32Array(p.jawXs.length * beadCount);
  const branchSegmentList: number[] = [];
  const branchPointList: number[] = [];
  const branchBrightnessList: number[] = [];
  const endPointList: number[] = [];
  const b = p.branches;
  const [brightMin, brightMax] = p.strandBrightness;
  const bright = () => brightMin + rng() * (brightMax - brightMin);
  const lift = (v: Vector3) => {
    v.z = neckZ(v.x, p.neckRadius, p.lift);
    return v;
  };
  let s = 0;
  let strand = 0;
  /** branches whose origin sits on the scene's axis alternate sides instead of picking one */
  let axisParity = 0;
  const put = (a: Vector3, z: Vector3) => {
    segments.set([a.x, a.y, a.z, z.x, z.y, z.z], s * 6);
    s++;
  };

  /**
   * One branch leaving `parent` at bezier parameter `t`, then — while `depth` allows — its own
   * sub-branches. `parent` is always still in the xy plane: the cylinder lift is applied to the
   * emitted samples only, never to the curves the recursion walks.
   */
  const growBranch = (
    parent: QuadraticBezierCurve3,
    t: number,
    length: number,
    angle: number,
    depth: number,
  ): void => {
    const origin = parent.getPoint(t); // still in the xy plane: the lift comes last
    const tangent = parent.getTangent(t); // unit, jaw → node (downward)
    // the tangent rotated by ±angle about z; the sign that turns it away from x = 0 wins
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const rotate = (sign: number) =>
      new Vector3(
        tangent.x * cos - sign * tangent.y * sin,
        sign * tangent.x * sin + tangent.y * cos,
        0,
      );
    const outward =
      Math.abs(origin.x) > 1e-6 ? Math.sign(origin.x) : axisParity++ % 2 === 0 ? 1 : -1;
    const plus = rotate(1);
    const minus = rotate(-1);
    const direction = plus.x * outward >= minus.x * outward ? plus : minus;
    if (direction.y > 0) direction.y = -direction.y; // never up, whatever the tangent does
    const tip = origin.clone().addScaledVector(direction, length);
    const control = origin.clone().addScaledVector(tangent, length * 0.5);
    const branch = new QuadraticBezierCurve3(origin.clone(), control, tip);
    const linePts = branch.getPoints(BRANCH_LINE_SEGMENTS);
    for (const v of linePts) lift(v);
    for (let i = 0; i + 1 < linePts.length; i++) {
      const a = linePts[i] ?? new Vector3();
      const z = linePts[i + 1] ?? new Vector3();
      branchSegmentList.push(a.x, a.y, a.z, z.x, z.y, z.z);
    }
    const beads = Math.max(4, Math.round(length * b.beadsPerUnit));
    for (const v of branch.getPoints(beads - 1)) {
      branchPointList.push(v.x, v.y, neckZ(v.x, p.neckRadius, p.lift));
      branchBrightnessList.push(bright());
    }
    endPointList.push(
      origin.x,
      origin.y,
      neckZ(origin.x, p.neckRadius, p.lift),
      tip.x,
      tip.y,
      neckZ(tip.x, p.neckRadius, p.lift),
    );
    if (depth <= 1) return;
    const sub = b.sub;
    const count = sub.perBranch[0] + Math.floor(rng() * (sub.perBranch[1] - sub.perBranch[0] + 1));
    for (let k = 0; k < count; k++) {
      const at = sub.at[0] + rng() * (sub.at[1] - sub.at[0]);
      const a = b.angle[0] + rng() * (b.angle[1] - b.angle[0]);
      growBranch(branch, at, length * sub.lengthFactor, a, depth - 1);
    }
  };

  for (const jawX of p.jawXs) {
    const curve = new QuadraticBezierCurve3(
      new Vector3(jawX, p.jawY, 0),
      new Vector3(jawX * p.controlXFactor, p.controlY, 0),
      new Vector3(0, p.nodeY, 0),
    );
    const pts = curve.getPoints(perStrand);
    for (const v of pts) lift(v);
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
      for (let i = 0; i < beadCount; i++) strandBrightness[strand * beadCount + i] = bright();
    }
    const count = b.perStrand[0] + Math.floor(rng() * (b.perStrand[1] - b.perStrand[0] + 1));
    for (let k = 0; k < count; k++) {
      const t = b.at[0] + rng() * (b.at[1] - b.at[0]);
      const length = b.length[0] + rng() * (b.length[1] - b.length[0]);
      const angle = b.angle[0] + rng() * (b.angle[1] - b.angle[0]);
      growBranch(curve, t, length, angle, b.depth);
    }
    strand++;
  }

  const centre = new Vector3(...node);
  for (let k = 0; k < p.nucleus.spokes; k++) {
    const a = (k / p.nucleus.spokes) * Math.PI * 2;
    const end = new Vector3(
      Math.cos(a) * p.nucleus.spokeLength,
      p.nodeY + Math.sin(a) * p.nucleus.spokeLength,
      nodeZ,
    );
    put(centre, end);
  }

  // Phase 12.6: the nucleus — a uniform disc (r = radius·√u), blue-white inside `coreRadius` and
  // gold beyond it, both bright enough to bloom on the half-float buffer
  const n = p.nucleus;
  const nucleusPoints = new Float32Array(n.points * 3);
  const nucleusMix = new Float32Array(n.points);
  const nucleusBrightness = new Float32Array(n.points);
  for (let i = 0; i < n.points; i++) {
    const a = rng() * Math.PI * 2;
    const r = Math.sqrt(rng()) * n.radius;
    nucleusPoints[i * 3] = Math.cos(a) * r;
    nucleusPoints[i * 3 + 1] = p.nodeY + Math.sin(a) * r;
    nucleusPoints[i * 3 + 2] = nodeZ;
    const isCore = r < n.coreRadius;
    nucleusMix[i] = isCore ? 0 : 1;
    nucleusBrightness[i] = isCore ? n.coreBrightness : n.ringBrightness;
  }

  return {
    segments,
    strandPoints,
    strandPointCount: beadCount,
    strandBrightness,
    branchSegments: Float32Array.from(branchSegmentList),
    branchPoints: Float32Array.from(branchPointList),
    branchPointCount: branchPointList.length / 3,
    branchBrightness: Float32Array.from(branchBrightnessList),
    endPoints: Float32Array.from(endPointList),
    endPointCount: endPointList.length / 3,
    nucleusPoints,
    nucleusMix,
    nucleusBrightness,
    node,
    strandCount: p.jawXs.length,
  };
}
