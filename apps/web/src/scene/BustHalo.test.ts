import { describe, expect, it } from "vitest";
import { SphereGeometry, Vector3 } from "three/webgpu";
import { createBustHalo } from "./BustHalo";
import { sceneConfig } from "./sceneConfig";

/** Phase 12.3 — the halo grows about the geometry's own centre, not the world origin: a sphere
 *  translated up to y 1.45 (roughly where the bust's head sits) must stay concentric, i.e. its
 *  centre must not move when the copy is scaled. */
describe("createBustHalo", () => {
  it("scales about the geometry's bounding-box centre", () => {
    const g = new SphereGeometry(0.5, 8, 6).translate(0, 1.45, 0);
    const { mesh, dispose } = createBustHalo(g, sceneConfig);
    const { scale } = sceneConfig.bust.halo;

    // the centre comes back through float32 positions, hence the 1e-6 tolerance on y
    expect(mesh.scale.x).toBeCloseTo(scale, 10);
    expect(mesh.position.x).toBeCloseTo(0, 10);
    expect(mesh.position.y).toBeCloseTo(1.45 * (1 - scale), 6);
    expect(mesh.position.z).toBeCloseTo(0, 10);
    // the transform is a scale about the centre: the centre maps to itself
    mesh.updateMatrixWorld(true);
    expect(mesh.localToWorld(new Vector3(0, 1.45, 0)).y).toBeCloseTo(1.45, 6);
    // shared, never copied
    expect(mesh.geometry).toBe(g);

    dispose();
    g.dispose();
  });
});
