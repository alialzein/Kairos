import {
  cameraPosition,
  distance,
  float,
  floor,
  fract,
  fwidth,
  mix,
  normalWorld,
  oneMinus,
  positionWorld,
  sin,
  smoothstep,
  time,
  uniform,
  vec3,
} from "three/tsl";
import { Color, FrontSide, MeshBasicNodeMaterial, Vector3 } from "three/webgpu";
import type { SceneConfig } from "./sceneConfig";

/** Every sceneConfig input of the contour shader — the contours/core numbers and the four
 *  palette colours — as a uniform. Nothing writes them at runtime yet: the bench tunes through
 *  `?set=` before the material is built (BenchScene), but a live panel could drive these. */
export function createContourUniforms(cfg: SceneConfig) {
  const { contours, core, palette } = cfg;
  // colours as linear-rgb Vector3 uniforms: @types/three types uniform(Color) as a "color" node
  // that vec3()/mix() overloads reject
  const rgb = (hex: string) => {
    const c = new Color(hex);
    return new Vector3(c.r, c.g, c.b);
  };
  return {
    frequency: uniform(contours.frequency),
    lineWidth: uniform(contours.lineWidth),
    fresnelPower: uniform(contours.fresnelPower),
    rimStrength: uniform(contours.rimStrength),
    lineBoost: uniform(contours.lineBoost),
    scrollSpeed: uniform(contours.scrollSpeed),
    beadFrequency: uniform(contours.beads.frequency),
    beadMin: uniform(contours.beads.min),
    // the toggle is a float uniform, not a branch, so the bench can flip it at runtime like the rest
    beadOn: uniform(contours.beads.enabled ? 1 : 0),
    coreCenter: uniform(new Vector3(...core.center)),
    coreRadius: uniform(core.radius),
    pulseSpeed: uniform(core.pulseSpeed),
    pulseAmount: uniform(core.pulseAmount),
    lineColor: uniform(rgb(palette.line)),
    fillColor: uniform(rgb(palette.fill)),
    edgeColor: uniform(rgb(palette.edge)),
    coreColor: uniform(rgb(palette.core)),
  };
}
export type ContourUniforms = ReturnType<typeof createContourUniforms>;

export interface ContourMaterial {
  material: MeshBasicNodeMaterial;
  uniforms: ContourUniforms;
}

/**
 * Phase 3 — the contour-line surface (docs/plans/scene-plan.md Phase 3), a line-for-line TSL
 * port of the plan's GLSL fragment shader: horizontal world-space slices (`fract(y·frequency)`)
 * anti-aliased with `fwidth`, a fresnel rim, and a pulsing warm core that tints lines and fill
 * near `core.center`. World-space y keeps the lines continuous across the whole mesh. Opaque,
 * front faces only, unlit; `time` is TSL's elapsed-seconds node (the plan's `uTime`).
 *
 * Phase 10.3 (Ali) beads the lines: each one is modulated along world x at
 * `contours.beads.frequency` with a per-slice phase shift, dipping to `contours.beads.min` between
 * dots, so the contours read as strings of dots up close and stay continuous from a distance.
 *
 * float()/vec3() wrappers reify intermediate nodes: @types/three 0.185.4 narrows some TSL
 * overloads (mix(vec3, vec3, float), smoothstep with uniform edges) to `never` — the same gap
 * lines/LineBust.ts works around.
 */
export function createContourMaterial(cfg: SceneConfig): ContourMaterial {
  const u = createContourUniforms(cfg);

  // horizontal slices, anti-aliased
  const coord = float(positionWorld.y.mul(u.frequency).add(time.mul(u.scrollSpeed)));
  const slice = float(fract(coord));
  const d = float(slice.sub(0.5).abs());
  const aa = float(fwidth(coord)).mul(0.75);
  const lineWidth = float(u.lineWidth);
  const line = float(oneMinus(smoothstep(lineWidth, lineWidth.add(aa), d)));

  // beads: a high-frequency ripple along world x, phase-shifted per slice, dimming each line to
  // `beadMin` between dots. beadOn = 0 restores the plain line exactly.
  const bead = float(0.5).add(
    float(sin(positionWorld.x.mul(u.beadFrequency).add(floor(coord).mul(1.7)))).mul(0.5),
  );
  const beadMul = float(
    mix(float(u.beadMin), float(1), float(smoothstep(float(0.2), float(0.8), bead))),
  );
  const lineBeaded = line.mul(float(mix(float(1), beadMul, float(u.beadOn))));

  // rim light
  const viewDir = vec3(cameraPosition.sub(positionWorld).normalize());
  const facing = float(vec3(normalWorld).normalize().dot(viewDir)).max(0);
  const fres = float(oneMinus(facing)).pow(float(u.fresnelPower));

  // warm core on the face, pulsing
  const coreDist = float(distance(positionWorld, u.coreCenter));
  const coreFall = float(oneMinus(smoothstep(float(0), float(u.coreRadius), coreDist)));
  const pulse = float(oneMinus(u.pulseAmount)).add(
    float(u.pulseAmount).mul(sin(time.mul(u.pulseSpeed))),
  );
  const coreW = coreFall.mul(pulse);

  const lineColor = vec3(u.lineColor);
  const coreColor = vec3(u.coreColor);
  const lineCol = vec3(mix(lineColor, coreColor, coreW));
  const fill = vec3(mix(vec3(u.fillColor), coreColor.mul(0.35), coreW.mul(0.7)));
  const col = vec3(mix(fill, lineCol, lineBeaded))
    .add(vec3(u.edgeColor).mul(fres).mul(float(u.rimStrength)))
    .mul(lineBeaded.mul(float(u.lineBoost)).add(1)); // plan: ×1.8 on lines (bloom); 0 = exact hex

  const material = new MeshBasicNodeMaterial();
  material.colorNode = col;
  material.side = FrontSide;
  material.fog = false;
  return { material, uniforms: u };
}
