import { ROLE_SPLIT } from "@twin/config";
import { mulberry32 } from "../random";
import { Region } from "../sampler";
import { core } from "./core";
import { humanoid, type BustMesh } from "./humanoid";
import { nebula } from "./nebula";
import { orb } from "./orb";
import { ring } from "./ring";
import { spine } from "./spine";
import { waves } from "./waves";

export interface Targets {
  n: number;
  coreEnd: number;
  spineEnd: number;
  humanoid: Float32Array;
  orb: Float32Array;
  nebula: Float32Array;
  ring: Float32Array;
  regions: Uint8Array;
  spineT: Float32Array;
  waves: Float32Array;
}

function concat(a: Float32Array, b: Float32Array, c: Float32Array): Float32Array {
  const out = new Float32Array(a.length + b.length + c.length);
  out.set(a, 0);
  out.set(b, a.length);
  out.set(c, a.length + b.length);
  return out;
}

export function buildTargets(opts: {
  n: number;
  waves: number;
  seed: number;
  bust: BustMesh;
}): Targets {
  const { n, seed, bust } = opts;
  const coreEnd = Math.round(n * ROLE_SPLIT.core);
  const spineEnd = coreEnd + Math.round(n * ROLE_SPLIT.spine);
  const main = n - spineEnd;
  const corePts = core(coreEnd, mulberry32(seed + 1));
  const sp = spine(spineEnd - coreEnd, mulberry32(seed + 2));
  const hu = humanoid(main, mulberry32(seed + 3), bust);
  const regions = new Uint8Array(n).fill(Region.CHEST);
  regions.set(hu.regions, spineEnd);
  const spineT = new Float32Array(n);
  spineT.set(sp.t, coreEnd);
  return {
    n,
    coreEnd,
    spineEnd,
    humanoid: concat(corePts, sp.positions, hu.positions),
    orb: concat(corePts, sp.positions, orb(main, mulberry32(seed + 4))),
    nebula: concat(corePts, sp.positions, nebula(main, mulberry32(seed + 5))),
    ring: concat(corePts, sp.positions, ring(main, mulberry32(seed + 6))),
    regions,
    spineT,
    waves: waves(opts.waves, mulberry32(seed + 7)),
  };
}

function pick(
  src: Float32Array,
  start: number,
  end: number,
  count: number,
  stride = 3,
): Float32Array {
  const avail = end - start;
  const out = new Float32Array(count * stride);
  for (let i = 0; i < count; i++) {
    const j = start + Math.floor((i * avail) / count);
    for (let k = 0; k < stride; k++) out[i * stride + k] = src[j * stride + k] ?? 0;
  }
  return out;
}

/** Every k-th point per segment, so a lower tier keeps the same look and role proportions. */
export function strided(t: Targets, n2: number): Targets {
  const coreEnd = Math.round(n2 * ROLE_SPLIT.core);
  const spineEnd = coreEnd + Math.round(n2 * ROLE_SPLIT.spine);
  const main = n2 - spineEnd;
  const seg = (a: Float32Array) =>
    concat(
      pick(a, 0, t.coreEnd, coreEnd),
      pick(a, t.coreEnd, t.spineEnd, spineEnd - coreEnd),
      pick(a, t.spineEnd, t.n, main),
    );
  const regions = new Uint8Array(n2);
  const spineT = new Float32Array(n2);
  const r1 = pick(Float32Array.from(t.regions), 0, t.coreEnd, coreEnd, 1),
    r2 = pick(Float32Array.from(t.regions), t.coreEnd, t.spineEnd, spineEnd - coreEnd, 1),
    r3 = pick(Float32Array.from(t.regions), t.spineEnd, t.n, main, 1);
  regions.set(r1, 0);
  regions.set(r2, coreEnd);
  regions.set(r3, spineEnd);
  spineT.set(pick(t.spineT, t.coreEnd, t.spineEnd, spineEnd - coreEnd, 1), coreEnd);
  const wavesN = Math.round((t.waves.length / 3) * (n2 / t.n));
  return {
    n: n2,
    coreEnd,
    spineEnd,
    humanoid: seg(t.humanoid),
    orb: seg(t.orb),
    nebula: seg(t.nebula),
    ring: seg(t.ring),
    regions,
    spineT,
    waves: pick(t.waves, 0, t.waves.length / 3, wavesN),
  };
}
