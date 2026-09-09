import { expect, test } from "@playwright/test";
import { sceneUrl } from "../helpers/benchUrl";

test("scene bench page boots on WebGPU or WebGL and keeps rendering", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(sceneUrl());
  // `ready` is set by the scene's own first frame once the bust mesh is in the scene
  await page.waitForFunction(() => window.__twinScene?.ready === true, null, { timeout: 60_000 });
  const first = await page.evaluate(() => window.__twinScene);
  expect(["webgpu", "webgl"]).toContain(first?.backend);
  expect(first?.error ?? null).toBeNull();
  // keeps rendering: the page's own loop advances (progress, not a rate — software WebGL2 on
  // the runner manages 1-10 fps)
  await page.waitForFunction(
    (f0) => (window.__twinScene?.frames ?? 0) > f0 + 10,
    first?.frames ?? 0,
    { timeout: 60_000 },
  );
  // (the frame-stats window is checked on the light phase-1 page below: after Phase 11 the full
  // scene is ~109k sprites, and software WebGL2 on the runner cannot sample 30 of its frames
  // inside the timeout — run 34157122820)
  expect(errors).toEqual([]);
  // HUD chrome (Phase 8) is plain DOM beside the canvas
  await expect(page.locator("[data-scene-hud]")).toHaveText(/status: listening/i);
});

test("layers can be switched from the query string", async ({ page }) => {
  await page.goto(sceneUrl("phase=1"));
  await page.waitForFunction(() => window.__twinScene?.ready === true, null, { timeout: 60_000 });
  const layers = await page.evaluate(() => window.__twinScene?.layers);
  expect(layers).toMatchObject({ stars: true, bust: false, post: false, hud: false });
  // the canvas publishes its frame-time window every 30 frames: CI only, because local headless
  // Chromium accumulates no frame stats on this PC (ledger, "PC session" — the perf spec has the
  // same limitation); checked here on the light page so it measures the window, not the runner
  if (process.env.CI)
    await page.waitForFunction(() => (window.__twinScene?.stats.count ?? 0) >= 30, null, {
      timeout: 60_000,
    });
});

// b5-32 (seven-state wiring): `?state=NAME` forces the avatar state before the canvas mounts, the
// HUD reads that state's row and the bench publishes it. `?only=background,hud` keeps the page
// light enough for software WebGL2 on the runner — the driver mounts inside the Canvas regardless
// of which layers are on, so the state still reaches `window.__twinScene`.
test("?state= drives the HUD readout and the published state", async ({ page }) => {
  await page.goto(sceneUrl("only=background,hud&state=OFFLINE"));
  await page.waitForFunction(() => window.__twinScene?.ready === true, null, { timeout: 60_000 });
  await expect(page.locator("[data-scene-hud]")).toHaveText(/status: offline/i);
  expect(await page.evaluate(() => window.__twinScene?.state)).toBe("OFFLINE");
});
