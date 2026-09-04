import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { BufferGeometry, Mesh } from "three";
import { boundsOf } from "./sampler";
import type { BustMesh } from "./targets/humanoid";

export async function loadBust(url = "/avatar/bust.glb"): Promise<BustMesh> {
  const gltf = await new GLTFLoader().loadAsync(url);
  let geometry: BufferGeometry | null = null;
  gltf.scene.traverse((o) => {
    if ((o as Mesh).isMesh && !geometry) geometry = (o as Mesh).geometry;
  });
  if (!geometry) throw new Error("bust.glb has no mesh");
  const g = geometry as BufferGeometry;
  const positions = new Float32Array(g.getAttribute("position").array as ArrayLike<number>);
  const index = g.getIndex();
  const indices = index
    ? new Uint32Array(index.array as ArrayLike<number>)
    : Uint32Array.from({ length: positions.length / 3 }, (_, i) => i);
  return { positions, indices, bounds: boundsOf(positions) };
}
