/** Canonical bust space (from scripts/lib/obj.ts normalizeBust): y in [-0.9, 0.9], x/z centred. */
export const ANCHORS = {
  head: [0, 0.45, 0.02],
  chest: [0, -0.25, 0.12],
  earL: [-0.28, 0.42, 0],
  earR: [0.28, 0.42, 0],
  face: [0, 0.4, 0.3],
  // measured from bust.glb (glb-probe, 2026-09-06): socket z dips to ~0.33 at |x| 0.10–0.15
  // beside the ~0.43 nose bridge; lips protrude to z ≈ 0.45 around y 0.27
  eyeL: [-0.12, 0.44, 0.35],
  eyeR: [0.12, 0.44, 0.35],
  mouth: [0, 0.27, 0.44],
  // the head core cluster used to sit at `head` (eye level) — its bloom eclipsed the eyes;
  // raised toward the crown so the face features keep their own contrast
  coreHead: [0, 0.58, -0.02],
} as const satisfies Record<string, readonly [number, number, number]>;

export type Vec3 = readonly [number, number, number];
