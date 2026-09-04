export interface Energy {
  bass: number;
  mid: number;
  treble: number;
}
export const ZERO_ENERGY: Energy = { bass: 0, mid: 0, treble: 0 };
export const BANDS = { bass: [60, 250], mid: [250, 2000], treble: [2000, 8000] } as const;

export function binRange(
  sampleRate: number,
  fftSize: number,
  loHz: number,
  hiHz: number,
): [number, number] {
  const hzPerBin = sampleRate / fftSize;
  const last = fftSize / 2 - 1;
  return [
    Math.min(last, Math.max(0, Math.floor(loHz / hzPerBin))),
    Math.min(last, Math.max(0, Math.ceil(hiHz / hzPerBin))),
  ];
}

export function bandEnergy(
  freq: Uint8Array,
  sampleRate: number,
  fftSize: number,
  loHz: number,
  hiHz: number,
): number {
  const [a, b] = binRange(sampleRate, fftSize, loHz, hiHz);
  let sum = 0;
  for (let i = a; i <= b; i++) sum += freq[i] ?? 0;
  return sum / ((b - a + 1) * 255);
}

export function energyFrom(freq: Uint8Array, sampleRate: number, fftSize: number): Energy {
  return {
    bass: bandEnergy(freq, sampleRate, fftSize, BANDS.bass[0], BANDS.bass[1]),
    mid: bandEnergy(freq, sampleRate, fftSize, BANDS.mid[0], BANDS.mid[1]),
    treble: bandEnergy(freq, sampleRate, fftSize, BANDS.treble[0], BANDS.treble[1]),
  };
}

/** Fast attack, slow release — keeps the Avatar from flickering on every frame. */
export function smooth(prev: number, next: number, attack = 0.5, release = 0.12): number {
  return next > prev ? prev + (next - prev) * attack : prev + (next - prev) * release;
}

export function smoothEnergy(prev: Energy, next: Energy): Energy {
  return {
    bass: smooth(prev.bass, next.bass),
    mid: smooth(prev.mid, next.mid),
    treble: smooth(prev.treble, next.treble),
  };
}
