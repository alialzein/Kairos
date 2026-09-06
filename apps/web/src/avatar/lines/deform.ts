import { ANCHORS } from "../sim/canonical";
import { jawOffset, jawOpen } from "../sim/jaw";
import { makeNoise } from "../sim/noise";

/** CPU vertex deformation for the fat-line bust (look v2, L8). The fat-line material takes its
 *  vertices from the instanceStart/instanceEnd interleaved buffer, so state behaviours are a
 *  rewrite of that buffer from a private snapshot of the base positions. Pure JS, no three. */

export interface DeformValues {
  speak: number;
  listen: number;
  vortex: number;
  freeze: number;
  tint: readonly [number, number, number];
}

export interface LineDeformer {
  /** Write this frame's positions into the live buffer. Returns true when the buffer changed. */
  update(v: DeformValues, timeS: number): boolean;
  /** z of the head's own vertical axis (mean z of the head vertices) */
  readonly headAxisZ: number;
}

/** THINKING: peak whole-head turn, radians. Kept small on purpose: the loops are see-through,
 *  and turning them shifts each loop's front and back halves in opposite directions, so the
 *  deep ear-level loops shear into visible slivers well before the turn reads as a turn. */
export const TURN_RAD = 0.09;
const TURN_RATE = 1.3;
const NECK_Y0 = 0.2;
const NECK_Y1 = 0.4;

/** `live` is the geometry's own array — three's LineSegmentsGeometry.setPositions keeps the
 *  Float32Array it is given rather than copying it — so the base is snapshotted here. Reading
 *  the base back out of the live array would make every effect accumulate frame after frame. */
export function createLineDeformer(live: Float32Array): LineDeformer {
  const base = Float32Array.from(live);
  const vertexCount = base.length / 3;
  const mouthSet: number[] = [];
  const earSet: number[] = [];
  const headSet: number[] = [];
  let headAxisZ = 0;
  for (let i = 0; i < vertexCount; i++) {
    const x = base[i * 3] ?? 0,
      y = base[i * 3 + 1] ?? 0,
      z = base[i * 3 + 2] ?? 0;
    const dm = Math.hypot(x - ANCHORS.mouth[0], y - ANCHORS.mouth[1], z - ANCHORS.mouth[2]);
    if (dm < 0.3 && y - ANCHORS.mouth[1] < 0.05) mouthSet.push(i);
    const dl = Math.hypot(x - ANCHORS.earL[0], y - ANCHORS.earL[1], z - ANCHORS.earL[2]);
    const dr = Math.hypot(x - ANCHORS.earR[0], y - ANCHORS.earR[1], z - ANCHORS.earR[2]);
    if (Math.min(dl, dr) < 0.4) earSet.push(i);
    if (y > NECK_Y0) {
      headSet.push(i);
      headAxisZ += z;
    }
  }
  headAxisZ = headSet.length ? headAxisZ / headSet.length : 0;
  const noise = makeNoise(23);
  // vertices written last frame — restored from base before this frame's effects are applied,
  // so no effect can outlive its state (no per-effect bookkeeping to get wrong)
  const touched = new Uint8Array(vertexCount);
  let touchedAny = false;

  const write = (i: number, x: number, y: number, z: number): void => {
    live[i * 3] = x;
    live[i * 3 + 1] = y;
    live[i * 3 + 2] = z;
    touched[i] = 1;
  };

  const update = (v: DeformValues, timeS: number): boolean => {
    const open = jawOpen(timeS, v.speak);
    const wantJaw = open > 0.002;
    const wantEar = v.listen > 0.01;
    const wantHead = v.vortex > 0.01;
    // OFFLINE: fray while frozen/dissolving (freeze = 1 during the hold, tint red afterwards)
    const fray = v.freeze > 0 ? 0.02 : v.tint[0] > 0.9 && v.tint[2] < 0.6 ? 0.045 : 0;
    const wantFray = fray > 0;
    let dirty = false;

    if (touchedAny) {
      for (let i = 0; i < vertexCount; i++) {
        if (touched[i]) {
          live[i * 3] = base[i * 3] ?? 0;
          live[i * 3 + 1] = base[i * 3 + 1] ?? 0;
          live[i * 3 + 2] = base[i * 3 + 2] ?? 0;
          touched[i] = 0;
        }
      }
      touchedAny = false;
      dirty = true;
    }

    if (wantFray) {
      // fray touches everything: noise displacement from base
      for (let i = 0; i < vertexCount; i++) {
        const x = base[i * 3] ?? 0,
          y = base[i * 3 + 1] ?? 0,
          z = base[i * 3 + 2] ?? 0;
        const n = noise(x * 5 + timeS * 0.8, y * 5, z * 5);
        write(
          i,
          x + n * fray,
          y + noise(y * 5, z * 5 + timeS * 0.6, x * 5) * fray,
          z + n * fray * 0.5,
        );
      }
      touchedAny = true;
      dirty = true;
    } else {
      // thinking: a small whole-head turn about the head's own axis, blended in over the neck so
      // the head stays attached to the shoulders (a per-height twist slid the dense loops apart)
      if (wantHead) {
        const k = v.vortex * TURN_RAD * Math.sin(timeS * TURN_RATE);
        for (const i of headSet) {
          const x = base[i * 3] ?? 0,
            y = base[i * 3 + 1] ?? 0,
            z = (base[i * 3 + 2] ?? 0) - headAxisZ;
          const neck = Math.min(1, Math.max(0, (y - NECK_Y0) / (NECK_Y1 - NECK_Y0)));
          const a = neck * neck * (3 - 2 * neck) * k;
          const c = Math.cos(a),
            sn = Math.sin(a);
          write(i, x * c - z * sn, y, x * sn + z * c + headAxisZ);
        }
        touchedAny = true;
        dirty = true;
      }
      // listen ripple: radial waves from the nearer ear (on top of whatever is already written)
      if (wantEar) {
        for (const i of earSet) {
          const x = live[i * 3] ?? 0,
            y = live[i * 3 + 1] ?? 0,
            z = live[i * 3 + 2] ?? 0;
          const ear = x < 0 ? ANCHORS.earL : ANCHORS.earR;
          const dx = x - ear[0],
            dy = y - ear[1],
            dz = z - ear[2];
          const d = Math.hypot(dx, dy, dz) || 1;
          const amp = 0.012 * v.listen * Math.max(0, 1 - d / 0.4) * Math.sin(d * 40 - timeS * 8);
          write(i, x + (dx / d) * amp, y + (dy / d) * amp, z + (dz / d) * amp);
        }
        touchedAny = true;
        dirty = true;
      }
      // jaw: shared formula with the particle kernel (from base — the mouth is never turned)
      if (wantJaw) {
        for (const i of mouthSet) {
          const x = base[i * 3] ?? 0,
            y = base[i * 3 + 1] ?? 0,
            z = base[i * 3 + 2] ?? 0;
          const [ox, oy, oz] = jawOffset(x, y, z, open);
          write(i, x + ox, y + oy, z + oz);
        }
        touchedAny = true;
        dirty = true;
      }
    }
    return dirty;
  };

  return { update, headAxisZ };
}
