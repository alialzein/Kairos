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
  reporter: CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: { baseURL: BASE, headless: true, trace: "retain-on-failure" },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"], launchOptions: { args: gpuArgs } } },
  ],
  webServer: {
    command: `pnpm exec next start -p ${PORT}`,
    url: `${BASE}/bench/avatar?tier=low`,
    reuseExistingServer: !CI,
    timeout: 180_000,
  },
});
