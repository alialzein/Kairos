"use client";
import { useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { float, oneMinus, sin, uv, vec3, vec4 } from "three/tsl";
import { AdditiveBlending, Sprite, SpriteNodeMaterial } from "three/webgpu";
import { sceneConfig } from "./sceneConfig";
import { stateUniforms } from "./stateUniforms";

/**
 * Phase 4 — the warm glow bloom picks up on the face (docs/plans/scene-plan.md Phase 4). One
 * billboard (a three Sprite: camera-facing by construction, the drei <Billboard> equivalent)
 * just in front of the face surface with a radial gradient — `palette.core` at alpha `glow.alpha`
 * in the centre fading linearly to transparent at the edge, the CanvasTexture gradient of the
 * plan computed in the shader instead. Additive, no depth write. Both breathe on TSL `time` with
 * `core.pulseSpeed`: the opacity uses the contour shader's pulse expression (amplitude
 * `pulseAmount`), the scale swings by `pulseAmount · glow.scalePulse` around 1, so tint and glow
 * pulse together.
 *
 * Phase 12.4 (Ali): the sprite is 1.5× brighter. `glow.brightness` multiplies the *colour*, not
 * the opacity — opacity is capped at 1, while the half-float scene buffer (Phase 12.1) carries a
 * colour > 1 straight into bloom.
 *
 * b5-32 (seven-state wiring): the colour is the state driver's `coreColor · coreIntensity` and the
 * breathing runs off its accumulated `pulsePhase` × the state's `corePulseAmount` instead of TSL
 * `time · core.pulseSpeed`. Reduced motion is the driver's job now: it never advances the phase
 * (so the wave stays sin(0) = 0, as it did) and the engine forces the amplitude to 0.
 */
export function FaceCore() {
  const scene = useThree((s) => s.scene);
  const sprite = useMemo(() => {
    const { core } = sceneConfig;
    const su = stateUniforms;
    const material = new SpriteNodeMaterial();
    const r = float(uv().sub(0.5).mul(2).length());
    const wave = sin(su.pulsePhase);
    const amount = float(core.pulseAmount).mul(su.corePulseAmount);
    const pulse = float(oneMinus(amount)).add(amount.mul(wave));
    material.colorNode = vec4(
      vec3(vec3(su.coreColor).mul(core.glow.brightness)).mul(su.coreIntensity),
      1,
    );
    material.opacityNode = float(oneMinus(r)).clamp(0, 1).mul(core.glow.alpha).mul(pulse);
    material.scaleNode = float(core.glow.size).mul(
      float(1).add(amount.mul(core.glow.scalePulse).mul(wave)),
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
