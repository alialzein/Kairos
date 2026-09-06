"use client";
import { useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { Color, DoubleSide, Group, Mesh, MeshBasicNodeMaterial, RingGeometry } from "three/webgpu";
import { ringSpecs } from "./gen/rings";
import { sceneConfig } from "./sceneConfig";

/**
 * Phase 6 — thin concentric rings behind the head (docs/plans/scene-plan.md Phase 6): one
 * RingGeometry annulus per ring (160 segments) in a group at rings.center, facing the camera,
 * `palette.line` at an opacity that fades outward. The opaque bust in front occludes them
 * naturally. The renderer's 4× MSAA keeps the ~2 px annuli smooth (the plan's "no aliased
 * LineBasicMaterial circles" rule).
 */
export function Rings() {
  const scene = useThree((s) => s.scene);
  const group = useMemo(() => {
    const { rings, palette } = sceneConfig;
    const g = new Group();
    g.position.set(...rings.center);
    const color = new Color(palette.line);
    for (const spec of ringSpecs(rings)) {
      const material = new MeshBasicNodeMaterial({
        color,
        transparent: true,
        opacity: spec.opacity,
        side: DoubleSide,
        depthWrite: false,
      });
      material.fog = false;
      const mesh = new Mesh(
        new RingGeometry(spec.radius, spec.radius + rings.thickness, 160),
        material,
      );
      g.add(mesh);
    }
    return g;
  }, []);

  useEffect(() => {
    scene.add(group);
    return () => {
      scene.remove(group);
      for (const child of group.children) {
        const mesh = child as Mesh<RingGeometry, MeshBasicNodeMaterial>;
        mesh.geometry.dispose();
        mesh.material.dispose();
      }
    };
  }, [scene, group]);
  return null;
}
