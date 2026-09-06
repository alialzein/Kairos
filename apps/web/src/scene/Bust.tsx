"use client";
import { useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import { type BufferGeometry, Color, FrontSide, Mesh, MeshBasicNodeMaterial } from "three/webgpu";
import { loadBust } from "@/avatar/sim/bust";
import { createContourMaterial } from "./ContourMaterial";
import { meshBust, primitiveBust } from "./gen/bustGeometry";
import { sceneConfig } from "./sceneConfig";

/**
 * Phases 2 + 3 — the bust. Geometry per `sceneConfig.bust.source`: the repo's smooth bust mesh
 * (welded + smooth normals, scaled into scene units) or the plan's primitive fallback.
 * Phase 2 material: flat `palette.fill` so only the silhouette shows. `contours` (Phase 3)
 * swaps in the contour-line material; false keeps this flat fill for comparison.
 */
export function Bust({ contours }: { contours: boolean }) {
  const scene = useThree((s) => s.scene);
  const [geometry, setGeometry] = useState<BufferGeometry | null>(() =>
    sceneConfig.bust.source === "primitives" ? primitiveBust(sceneConfig.bust) : null,
  );
  const owned = useRef<BufferGeometry | null>(geometry);

  // glb path: async load, then weld/scale/offset (see gen/bustGeometry.ts)
  useEffect(() => {
    if (sceneConfig.bust.source !== "glb") return;
    let cancelled = false;
    void loadBust(sceneConfig.bust.glb.url).then((raw) => {
      if (cancelled) return;
      const g = meshBust(raw.positions, raw.indices, sceneConfig.bust.glb);
      owned.current = g;
      setGeometry(g);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(
    () => () => {
      owned.current?.dispose();
      owned.current = null;
    },
    [],
  );

  const material = useMemo(() => {
    if (contours) return createContourMaterial(sceneConfig).material;
    const m = new MeshBasicNodeMaterial({ color: new Color(sceneConfig.palette.fill) });
    m.side = FrontSide;
    return m;
  }, [contours]);
  useEffect(() => () => material.dispose(), [material]);

  useEffect(() => {
    if (!geometry) return;
    const mesh = new Mesh(geometry, material);
    scene.add(mesh);
    return () => {
      scene.remove(mesh);
    };
  }, [scene, geometry, material]);
  return null;
}
