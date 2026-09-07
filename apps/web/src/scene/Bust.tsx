"use client";
import { useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import { type BufferGeometry, Color, FrontSide, Mesh, MeshBasicNodeMaterial } from "three/webgpu";
import { loadBust } from "@/avatar/sim/bust";
import { createBustHalo } from "./BustHalo";
import { createBustShell } from "./BustShell";
import { createContourMaterial } from "./ContourMaterial";
import { meshBust, primitiveBust } from "./gen/bustGeometry";
import { sceneMotionEnabled } from "./motion";
import { sceneConfig } from "./sceneConfig";
import { useSceneStore } from "./store";

/**
 * Phases 2 + 3 — the bust. Geometry per `sceneConfig.bust.source`: the repo's smooth bust mesh
 * (welded + smooth normals, scaled into scene units) or the plan's primitive fallback.
 * Phase 2 material: flat `palette.fill` so only the silhouette shows. `contours` (Phase 3)
 * swaps in the contour-line material; false keeps this flat fill for comparison.
 * `shell` (Phase 10.2) adds the particle shell sampled over the same geometry (BustShell.ts)
 * on top of the mesh, which is unchanged either way. `halo` (Phase 12.3) adds the back-face rim
 * glow over the same geometry again (BustHalo.ts) — also its own object, so either toggle is
 * independent of the mesh.
 * Reports `bustReady` to the store once the mesh is in the scene (the canvas's `ready` waits
 * for it) and `error` if the mesh fails to load.
 */
export function Bust({
  contours,
  shell,
  halo,
}: {
  contours: boolean;
  shell: boolean;
  halo: boolean;
}) {
  const scene = useThree((s) => s.scene);
  const [geometry, setGeometry] = useState<BufferGeometry | null>(() =>
    sceneConfig.bust.source === "primitives" ? primitiveBust(sceneConfig.bust) : null,
  );
  const owned = useRef<BufferGeometry | null>(geometry);

  // glb path: async load, then weld/scale/offset (see gen/bustGeometry.ts)
  useEffect(() => {
    if (sceneConfig.bust.source !== "glb") return;
    let cancelled = false;
    loadBust(sceneConfig.bust.glb.url).then(
      (raw) => {
        if (cancelled) return;
        const g = meshBust(raw.positions, raw.indices, sceneConfig.bust.glb);
        owned.current = g;
        setGeometry(g);
      },
      (e: unknown) => {
        if (cancelled) return;
        console.error("scene: bust mesh failed to load", e);
        useSceneStore.getState().setError(`bust: ${e instanceof Error ? e.message : String(e)}`);
      },
    );
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
    if (contours) {
      const { material, uniforms } = createContourMaterial(sceneConfig);
      // Phase 9: the slow upward line drift is motion — still under reduced motion
      if (!sceneMotionEnabled()) uniforms.scrollSpeed.value = 0;
      return material;
    }
    const m = new MeshBasicNodeMaterial({ color: new Color(sceneConfig.palette.fill) });
    m.side = FrontSide;
    return m;
  }, [contours]);
  useEffect(() => () => material.dispose(), [material]);

  useEffect(() => {
    if (!geometry) return;
    const mesh = new Mesh(geometry, material);
    scene.add(mesh);
    useSceneStore.getState().setBustReady(true);
    return () => {
      scene.remove(mesh);
      useSceneStore.getState().setBustReady(false);
    };
  }, [scene, geometry, material]);

  // Phase 10.2 — the particle shell over the same geometry, its own object so toggling it
  // never rebuilds the mesh
  useEffect(() => {
    if (!geometry || !shell) return;
    const built = createBustShell(geometry, sceneConfig);
    scene.add(built.sprite);
    return () => {
      scene.remove(built.sprite);
      built.dispose();
    };
  }, [scene, geometry, shell]);

  // Phase 12.3 — the silhouette halo, the same geometry drawn back-face-only just outside the
  // mesh (BustHalo.ts); its own object for the same reason as the shell
  useEffect(() => {
    if (!geometry || !halo) return;
    const built = createBustHalo(geometry, sceneConfig);
    scene.add(built.mesh);
    return () => {
      scene.remove(built.mesh);
      built.dispose();
    };
  }, [scene, geometry, halo]);
  return null;
}
