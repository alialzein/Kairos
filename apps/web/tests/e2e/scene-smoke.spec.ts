import { expect, test } from "@playwright/test";

test("scene bench page boots on WebGPU or WebGL and keeps rendering", async ({ page }) => {
  await page.goto("/bench/scene");
  await page.waitForFunction(() => window.__twinScene?.ready === true, null, { timeout: 60_000 });
  const first = await page.evaluate(() => window.__twinScene);
  expect(["webgpu", "webgl"]).toContain(first?.backend);
  await page.waitForTimeout(2000);
  const later = await page.evaluate(() => window.__twinScene);
  // `ready` is set by the scene's own first frame; the frame-time window (stats.count) is not
  // asserted because local headless Chromium accumulates no frame stats on this PC (ledger,
  // "PC session": the perf spec has the same limitation; CI SwiftShader does report them)
  expect((later?.frames ?? 0) - (first?.frames ?? 0)).toBeGreaterThan(10);
  // HUD chrome (Phase 8) is plain DOM beside the canvas
  await expect(page.locator("[data-scene-hud]")).toHaveText(/status: listening/i);
});

test("layers can be switched from the query string", async ({ page }) => {
  await page.goto("/bench/scene?phase=1");
  await page.waitForFunction(() => window.__twinScene?.ready === true, null, { timeout: 60_000 });
  const layers = await page.evaluate(() => window.__twinScene?.layers);
  expect(layers).toMatchObject({ stars: true, bust: false, post: false, hud: false });
});
