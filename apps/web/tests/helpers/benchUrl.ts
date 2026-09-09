// CI runs the avatar on the WebGL2 backend: the runner's SwiftShader WebGPU device is lost
// ("destroyed", not by us) ~100 ms after creation, on every page, before anything renders — the
// perf baseline recorded on 2026-09-06 measured that dead device (bisect on ci/scene-bisect, runs
// 34098121956 / 34136858023 / 34137480858, 2026-09-07). WebGL2 renders on the runner at 1-10 fps.
// Elsewhere the page picks its own backend. Same rule as tests/e2e/scene-smoke.spec.ts.

/** a `/bench/avatar` URL with the CI backend choice applied: `&webgl=1` on CI only */
export const avatarUrl = (query: string) =>
  `/bench/avatar?${query}${process.env.CI ? "&webgl=1" : ""}` as const;
