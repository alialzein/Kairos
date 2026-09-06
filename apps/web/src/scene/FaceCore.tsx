"use client";
import { useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { float, oneMinus, sin, time, uv, vec4 } from "three/tsl";
import { AdditiveBlending, Color, Sprite, SpriteNodeMaterial } from "three/webgpu";
import { sceneConfig } from "./sceneConfig";

/**
 * Phase 4 — the warm glow bloom picks up on the face (docs/plans/scene-plan.md Phase 4). One
 * billboard (a three Sprite: camera-facing by construction, the drei <Billboard> equivalent)
 * just in front of the face surface with a radial gradient — `palette.core` at alpha `glow.alpha`
 * in the centre fading linearly to transparent at the edge, the CanvasTexture gradient of the
 * plan computed in the shader instead. Additive, no depth write. Opacity and scale breathe on
 * TSL `time` with `core.pulseSpeed`/`pulseAmount`, the same expression the contour shader uses,
 * so the tint and the glow pulse together.
 */
export function FaceCore() {
  const scene = useThree((s) => s.scene);
  const sprite = useMemo(() => {
    const { core, palette } = sceneConfig;
    const material = new SpriteNodeMaterial();
    const c = new Color(palette.core);
    const r = float(uv().sub(0.5).mul(2).length());
    const pulse = float(oneMinus(core.pulseAmount)).add(
      float(core.pulseAmount).mul(sin(time.mul(core.pulseSpeed))),
    );
    material.colorNode = vec4(c.r, c.g, c.b, 1);
    material.opacityNode = float(oneMinus(r)).clamp(0, 1).mul(core.glow.alpha).mul(pulse);
    material.scaleNode = float(core.glow.size).mul(
      float(1).add(
        float(core.pulseAmount)
          .mul(0.5)
          .mul(sin(time.mul(core.pulseSpeed))),
      ),
    );
    material.transparent = true;
    material.blending = AdditiveBlending;
    material.depthWrite = false;
    material.toneMapped = false;
    const s = new Sprite(material);
    s.position.set(core.center[0], core.center[1], core.glow.z);
    s.renderOrder = 5;
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
