import { defineConfig, devices } from "@playwright/test";

const CI = !!process.env.CI;
const PORT = 3100;
export const BASE = `http://localhost:${PORT}`;

/** SwiftShader flags let headless Chromium on a GPU-less runner still run WebGL2 (and WebGPU where the build allows). */
const gpuArgs = CI
  ? [
      "--enable-unsafe-webgpu",
      "--enable-features=Vulkan,UnsafeWebGPU",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
      "--ignore-gpu-blocklist",
    ]
  : ["--enable-unsafe-webgpu", "--ignore-gpu-blocklist"];

export default defineConfig({
  testDir: "tests",
  timeout: 90_000,
  retries: CI ? 1 : 0,
  // one worker on the runner: SwiftShader is CPU-bound, so a second browser halves both the perf
  // spec's frame rate (its p95 is compared with a baseline) and the scene smoke's
  workers: CI ? 1 : undefined,
  reporter: CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: { baseURL: BASE, headless: true, trace: "retain-on-failure" },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"], launchOptions: { args: gpuArgs } } },
  ],
  webServer: {
    command: `pnpm exec next start -p ${PORT}`,
    // the readiness probe must not boot a doomed WebGPU device: on the runner SwiftShader's device
    // is lost ~100 ms after creation (see tests/helpers/benchUrl.ts), and `?webgl=1` is the same
    // backend the specs use there. Harmless locally — it only decides which backend this one probe
    // page renders with, and nothing asserts on it.
    url: `${BASE}/bench/avatar?tier=low&webgl=1`,
    reuseExistingServer: !CI,
    timeout: 180_000,
  },
});
