"use client";
import { useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { float, oneMinus, sin, time, uv, vec4 } from "three/tsl";
import { AdditiveBlending, Sprite, SpriteNodeMaterial } from "three/webgpu";
import { sceneConfig } from "./sceneConfig";
import { colorVec3 } from "./tsl";

/**
 * Phase 4 — the warm glow bloom picks up on the face (docs/plans/scene-plan.md Phase 4). One
 * billboard (a three Sprite: camera-facing by construction, the drei <Billboard> equivalent)
 * just in front of the face surface with a radial gradient — `palette.core` at alpha `glow.alpha`
 * in the centre fading linearly to transparent at the edge, the CanvasTexture gradient of the
 * plan computed in the shader instead. Additive, no depth write. Both breathe on TSL `time` with
 * `core.pulseSpeed`: the opacity uses the contour shader's pulse expression (amplitude
 * `pulseAmount`), the scale swings by `pulseAmount · glow.scalePulse` around 1, so tint and glow
 * pulse together.
 */
export function FaceCore() {
  const scene = useThree((s) => s.scene);
  const sprite = useMemo(() => {
    const { core, palette } = sceneConfig;
    const material = new SpriteNodeMaterial();
    const r = float(uv().sub(0.5).mul(2).length());
    const wave = sin(time.mul(core.pulseSpeed));
    const pulse = float(oneMinus(core.pulseAmount)).add(float(core.pulseAmount).mul(wave));
    material.colorNode = vec4(colorVec3(palette.core), 1);
    material.opacityNode = float(oneMinus(r)).clamp(0, 1).mul(core.glow.alpha).mul(pulse);
    material.scaleNode = float(core.glow.size).mul(
      float(1).add(float(core.pulseAmount * core.glow.scalePulse).mul(wave)),
    );
    material.transparent = true;
    material.blending = AdditiveBlending;
    material.depthWrite = false;
    const s = new Sprite(material);
    s.position.set(core.center[0], core.center[1], core.glow.z);
    return s;
  }, []);

  useEffect(() => {
    scene.add(sprite);
    return () => {
      scene.remove(sprite);
      sprite.material.dispose();
    };
  }, [scene, sprite]);
  return null;
}
