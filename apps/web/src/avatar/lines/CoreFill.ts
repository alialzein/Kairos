import { float, mix, smoothstep, uv, vec3, vec4 } from "three/tsl";
import { AdditiveBlending, Sprite, SpriteNodeMaterial } from "three/webgpu";
import { ANCHORS } from "../sim/canonical";
import type { Palette } from "../sim/palette";
import type { SimUniforms } from "../sim/uniforms";

export interface CoreFill {
  sprite: Sprite;
  dispose(): void;
}

/** Soft orange glow behind the face (look v2, L2): one radial-gradient billboard at the face
 *  centre, kept under the bloom threshold so it reads as a warm interior fill (the reference's
 *  orange face) rather than a lamp. Breathes with the core pulse, warms with coreHeat, fades
 *  with the humanoid weight. */
export function createCoreFill(u: SimUniforms, palette: Palette): CoreFill {
  const material = new SpriteNodeMaterial();
  const c = uv().sub(0.5).mul(2);
  const r = c.length();
  // tighter horizontally than vertically: the face is taller than wide
  const falloff = smoothstep(1, 0.05, r.mul(float(1).add(c.y.abs().mul(0.15))));
  const warm = mix(
    vec3(palette.coreLine.r, palette.coreLine.g, palette.coreLine.b),
    vec3(palette.coreLineHot.r, palette.coreLineHot.g, palette.coreLineHot.b),
    u.coreHeat,
  );
  material.colorNode = vec4(
    warm
      .mul(u.brightness)
      .mul(float(0.55).add(u.corePulse.mul(0.45)))
      .mul(1.9),
    1,
  );
  material.opacityNode = falloff.pow(1.4).mul(u.shade).mul(0.95);
  material.transparent = true;
  material.depthWrite = false;
  material.depthTest = false;
  material.blending = AdditiveBlending;
  const sprite = new Sprite(material);
  sprite.position.set(ANCHORS.face[0], ANCHORS.face[1] - 0.09, 0.1);
  sprite.scale.set(0.72, 0.92, 1);
  sprite.renderOrder = -1; // behind the lines
  return { sprite, dispose: () => material.dispose() };
}
