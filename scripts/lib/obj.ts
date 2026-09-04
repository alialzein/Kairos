export interface ObjMesh {
  positions: Float32Array; // xyz interleaved
  faces: number[][]; // 0-based vertex indices, 3 or 4 per face
}
export interface Bounds {
  min: [number, number, number];
  max: [number, number, number];
}

/** Minimal OBJ reader: `v` and `f` lines, one `g` group kept, other data ignored. */
export function parseObj(text: string, opts: { group: string }): ObjMesh {
  const allVerts: number[] = [];
  const faces: number[][] = [];
  let current = "";
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith("v ")) {
      const [, x, y, z] = line.split(/\s+/);
      allVerts.push(Number(x), Number(y), Number(z));
    } else if (line.startsWith("g ")) {
      current = line.slice(2).trim();
    } else if (line.startsWith("f ") && current === opts.group) {
      faces.push(
        line
          .slice(2)
          .trim()
          .split(/\s+/)
          .map((tok) => Number(tok.split("/")[0]) - 1),
      );
    }
  }
  return compact({ positions: new Float32Array(allVerts), faces });
}

/** Keep only vertices referenced by faces; re-index faces. */
function compact(m: ObjMesh): ObjMesh {
  const map = new Map<number, number>();
  const out: number[] = [];
  const faces = m.faces.map((f) =>
    f.map((vi) => {
      let ni = map.get(vi);
      if (ni === undefined) {
        ni = map.size;
        map.set(vi, ni);
        out.push(
          m.positions[vi * 3] ?? 0,
          m.positions[vi * 3 + 1] ?? 0,
          m.positions[vi * 3 + 2] ?? 0,
        );
      }
      return ni;
    }),
  );
  return { positions: new Float32Array(out), faces };
}

export function cropByY(m: ObjMesh, yMin: number): ObjMesh {
  const keep = m.faces.filter((f) =>
    f.every((vi) => (m.positions[vi * 3 + 1] ?? -Infinity) >= yMin),
  );
  return compact({ positions: m.positions, faces: keep });
}

export function triangulate(faces: number[][]): Uint32Array {
  const out: number[] = [];
  for (const f of faces) {
    for (let i = 1; i + 1 < f.length; i++) out.push(f[0] ?? 0, f[i] ?? 0, f[i + 1] ?? 0);
  }
  return new Uint32Array(out);
}

export function boundsOf(p: Float32Array): Bounds {
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < p.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      const v = p[i + k] ?? 0;
      if (v < (min[k] ?? 0)) min[k] = v;
      if (v > (max[k] ?? 0)) max[k] = v;
    }
  }
  return { min, max };
}

/** Canonical bust space: x/z centred, y mapped to [-0.9, 0.9], uniform scale. */
export function normalizeBust(p: Float32Array): { positions: Float32Array; bounds: Bounds } {
  const b = boundsOf(p);
  const cx = (b.min[0] + b.max[0]) / 2;
  const cy = (b.min[1] + b.max[1]) / 2;
  const cz = (b.min[2] + b.max[2]) / 2;
  const s = 1.8 / (b.max[1] - b.min[1]);
  const out = new Float32Array(p.length);
  for (let i = 0; i < p.length; i += 3) {
    out[i] = ((p[i] ?? 0) - cx) * s;
    out[i + 1] = ((p[i + 1] ?? 0) - cy) * s;
    out[i + 2] = ((p[i + 2] ?? 0) - cz) * s;
  }
  return { positions: out, bounds: boundsOf(out) };
}
