"use client";
import { useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { mix, positionGeometry, uv, vec3, vec4 } from "three/tsl";
import { Color, Mesh, MeshBasicNodeMaterial, PlaneGeometry } from "three/webgpu";
import { sceneConfig } from "./sceneConfig";

/**
 * Phase 1 — the navy vertical gradient, drawn in-scene as a full-screen quad (clip-space vertex
 * node, no depth) instead of only as CSS behind a transparent canvas: the Phase 8 post pipeline
 * composites bloom and the vignette over an opaque frame, so the gradient has to be part of that
 * frame. The container keeps the same CSS gradient for the moment before the renderer is up.
 */
export function Background() {
  const scene = useThree((s) => s.scene);
  const mesh = useMemo(() => {
    const top = new Color(sceneConfig.palette.bgTop);
    const bottom = new Color(sceneConfig.palette.bgBottom);
    const material = new MeshBasicNodeMaterial();
    // PlaneGeometry(2, 2) already spans NDC; emit it as the clip-space position directly
    material.vertexNode = vec4(positionGeometry.xy, 0.5, 1);
    material.colorNode = mix(vec3(bottom.r, bottom.g, bottom.b), vec3(top.r, top.g, top.b), uv().y);
    material.depthTest = false;
    material.depthWrite = false;
    material.fog = false;
    const m = new Mesh(new PlaneGeometry(2, 2), material);
    m.frustumCulled = false;
    m.renderOrder = -1000;
    return m;
  }, []);

  useEffect(() => {
    scene.add(mesh);
    return () => {
      scene.remove(mesh);
      mesh.geometry.dispose();
      mesh.material.dispose();
    };
  }, [scene, mesh]);
  return null;
}
