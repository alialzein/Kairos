/** Canonical bust space (from scripts/lib/obj.ts normalizeBust): y in [-0.9, 0.9], x/z centred. */
export const ANCHORS = {
  head: [0, 0.45, 0.02],
  chest: [0, -0.25, 0.12],
  earL: [-0.28, 0.42, 0],
  earR: [0.28, 0.42, 0],
  face: [0, 0.4, 0.3],
} as const satisfies Record<string, readonly [number, number, number]>;

export type Vec3 = readonly [number, number, number];
