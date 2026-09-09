// CI runs the scene on the WebGL2 backend: the runner's SwiftShader WebGPU device is lost
// ("destroyed", not by us) ~100 ms after creation, on every page, before anything renders (bisect
// on ci/scene-bisect, runs 34098121956 / 34136858023 / 34137480858, 2026-09-07). WebGL2 renders on
// the runner at 1-10 fps. Elsewhere the page picks its own backend.

/** a `/bench/scene` URL with the CI backend choice applied: `webgl=1` on CI only */
export const sceneUrl = (query = "") => {
  const params = [query, process.env.CI ? "webgl=1" : ""].filter(Boolean).join("&");
  return params ? `/bench/scene?${params}` : "/bench/scene";
};
