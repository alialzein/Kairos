import { ZERO_ENERGY, type Energy } from "./energy";
import { synthEnergy } from "./synth";

export type EnergyMode = "none" | "synth" | "file" | "mic";
export const ENERGY_MODES: readonly EnergyMode[] = ["none", "synth", "file", "mic"];

export function energyForMode(mode: EnergyMode, tSeconds: number, live: Energy | null): Energy {
  switch (mode) {
    case "synth":
      return synthEnergy(tSeconds);
    case "file":
    case "mic":
      return live ?? ZERO_ENERGY;
    default:
      return ZERO_ENERGY;
  }
}
