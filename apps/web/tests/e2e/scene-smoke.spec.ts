import { expect, test } from "@playwright/test";

test("scene bench page boots on WebGPU or WebGL and keeps rendering", async ({ page }) => {
  await page.goto("/bench/scene");
  await page.waitForFunction(() => window.__twinScene?.ready === true, null, { timeout: 60_000 });
  const first = await page.evaluate(() => window.__twinScene);
  expect(["webgpu", "webgl"]).toContain(first?.backend);
  await page.waitForTimeout(2000);
  const later = await page.evaluate(() => window.__twinScene);
  expect((later?.frames ?? 0) - (first?.frames ?? 0)).toBeGreaterThan(10);
});

test("layers can be switched from the query string", async ({ page }) => {
  await page.goto("/bench/scene?phase=1");
  await page.waitForFunction(() => window.__twinScene?.ready === true, null, { timeout: 60_000 });
  const layers = await page.evaluate(() => window.__twinScene?.layers);
  expect(layers).toMatchObject({ stars: true, bust: false, post: false, hud: false });
});
