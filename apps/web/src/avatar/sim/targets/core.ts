import { ANCHORS } from "../canonical";
import { randomInSphere, type Rng } from "../random";

/** Dense amber core: 60 % in the head anchor, 40 % in the chest anchor (docs/06 §2 CORE). */
export function core(n: number, rng: Rng): Float32Array {
  const out = new Float32Array(n * 3);
  const headCount = Math.round(n * 0.6);
  for (let i = 0; i < n; i++) {
    const head = i < headCount;
    const anchor = head ? ANCHORS.head : ANCHORS.chest;
    const [x, y, z] = randomInSphere(rng, head ? 0.09 : 0.11);
    out[i * 3] = anchor[0] + x;
    out[i * 3 + 1] = anchor[1] + y;
    out[i * 3 + 2] = anchor[2] + z;
  }
  return out;
}
