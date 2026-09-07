// SSR-safe surface only. `SceneCanvas` pulls three/webgpu + addons and must be imported through
// `dynamic(() => import("@/scene/SceneCanvas"), { ssr: false })` (see app/bench/scene/BenchScene).
export { sceneConfig, LAYER_NAMES } from "./sceneConfig";
export type { Layers, LayerName, SceneConfig } from "./sceneConfig";
export { layersFromQuery, LAYER_PHASE } from "./layers";
export { applyOverrides } from "./overrides";
export { useSceneStore } from "./store";
