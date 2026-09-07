import { expect, test } from "@playwright/test";

test("scene bench page boots on WebGPU or WebGL and keeps rendering", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/bench/scene");
  // `ready` is set by the scene's own first frame once the bust mesh is in the scene
  await page.waitForFunction(() => window.__twinScene?.ready === true, null, { timeout: 60_000 });
  const first = await page.evaluate(() => window.__twinScene);
  expect(["webgpu", "webgl"]).toContain(first?.backend);
  expect(first?.error ?? null).toBeNull();
  await page.waitForTimeout(2000);
  const later = await page.evaluate(() => window.__twinScene);
  expect((later?.frames ?? 0) - (first?.frames ?? 0)).toBeGreaterThan(10);
  // scene frames (the canvas publishes its frame-time window every 30 frames): CI only, because
  // local headless Chromium accumulates no frame stats on this PC (ledger, "PC session" — the
  // perf spec has the same limitation)
  if (process.env.CI)
    await page.waitForFunction(() => (window.__twinScene?.stats.count ?? 0) >= 30, null, {
      timeout: 30_000,
    });
  expect(errors).toEqual([]);
  // HUD chrome (Phase 8) is plain DOM beside the canvas
  await expect(page.locator("[data-scene-hud]")).toHaveText(/status: listening/i);
});

test("layers can be switched from the query string", async ({ page }) => {
  await page.goto("/bench/scene?phase=1");
  await page.waitForFunction(() => window.__twinScene?.ready === true, null, { timeout: 60_000 });
  const layers = await page.evaluate(() => window.__twinScene?.layers);
  expect(layers).toMatchObject({ stars: true, bust: false, post: false, hud: false });
});
