import { energyFrom, smoothEnergy, ZERO_ENERGY, type Energy } from "./energy";

export interface EnergySource {
  read(): Energy;
  dispose(): void;
}

export function createEnergySource(
  ctx: AudioContext,
  node: AudioNode,
  fftSize = 1024,
): EnergySource {
  const analyser = ctx.createAnalyser();
  analyser.fftSize = fftSize;
  analyser.smoothingTimeConstant = 0.6;
  node.connect(analyser);
  const data = new Uint8Array(analyser.frequencyBinCount);
  let prev = ZERO_ENERGY;
  return {
    read() {
      analyser.getByteFrequencyData(data);
      prev = smoothEnergy(prev, energyFrom(data, ctx.sampleRate, fftSize));
      return prev;
    },
    dispose() {
      node.disconnect(analyser);
    },
  };
}

export async function micSource(ctx: AudioContext): Promise<{ node: AudioNode; stop(): void }> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const node = ctx.createMediaStreamSource(stream);
  return { node, stop: () => stream.getTracks().forEach((t) => t.stop()) };
}

export async function fileSource(
  ctx: AudioContext,
  file: File,
): Promise<{ node: AudioNode; start(): void; stop(): void }> {
  const buffer = await ctx.decodeAudioData(await file.arrayBuffer());
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  src.connect(ctx.destination);
  return { node: src, start: () => src.start(), stop: () => src.stop() };
}
