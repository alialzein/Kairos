import { uniform } from "three/tsl";
import { Vector3 } from "three";
import type { UniformValues } from "./frame";

export function createSimUniforms() {
  return {
    morph: uniform(1),
    turbulence: uniform(0.15),
    brightness: uniform(0.35),
    tint: uniform(new Vector3(1, 1, 1)),
    corePulse: uniform(0.3),
    coreHeat: uniform(0.3),
    breathing: uniform(0),
    vortex: uniform(0),
    bass: uniform(0),
    mid: uniform(0),
    treble: uniform(0),
    speak: uniform(0),
    listen: uniform(0),
    freeze: uniform(0),
    spring: uniform(12),
    damping: uniform(0.9),
    noiseScale: uniform(1.6),
    noiseAmp: uniform(0.9),
    size: uniform(0.012),
    alpha: uniform(0.85),
    pointer: uniform(new Vector3()),
    pointerStrength: uniform(0),
    pointerRadius: uniform(0.5),
    coreEnd: uniform(0),
    spineEnd: uniform(0),
    shade: uniform(0),
  };
}
export type SimUniforms = ReturnType<typeof createSimUniforms>;

// shapeA/shapeB are not uniforms: the kernel reads morph targets from the slot buffers that
// Sim.setShapes() uploads (see sim/compute.ts).
export function writeUniforms(u: SimUniforms, v: UniformValues): void {
  u.morph.value = v.morph;
  u.turbulence.value = v.turbulence;
  u.brightness.value = v.brightness;
  u.tint.value.set(v.tint[0], v.tint[1], v.tint[2]);
  u.corePulse.value = v.corePulse;
  u.coreHeat.value = v.coreHeat;
  u.breathing.value = v.breathing;
  u.vortex.value = v.vortex;
  u.bass.value = v.bass;
  u.mid.value = v.mid;
  u.treble.value = v.treble;
  u.speak.value = v.speak;
  u.listen.value = v.listen;
  u.freeze.value = v.freeze;
  u.spring.value = v.spring;
  u.damping.value = v.damping;
  u.noiseScale.value = v.noiseScale;
  u.noiseAmp.value = v.noiseAmp;
  u.size.value = v.size;
  u.alpha.value = v.alpha;
  u.pointer.value.set(v.pointer[0], v.pointer[1], v.pointer[2]);
  u.pointerStrength.value = v.pointerStrength;
  u.pointerRadius.value = v.pointerRadius;
  u.shade.value = v.shade;
}
