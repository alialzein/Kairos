import { expect, test } from "@playwright/test";
import { avatarUrl } from "../helpers/benchUrl";

test("bench page boots the particle system and keeps rendering real frames", async ({ page }) => {
  // the ready wait plus the frame-time window below can each take a minute of software WebGL2
  test.setTimeout(180_000);
  await page.goto(avatarUrl("tier=low"));
  await page.waitForFunction(() => window.__twinAvatar?.ready === true, null, { timeout: 60_000 });
  const first = await page.evaluate(() => window.__twinAvatar);
  if (process.env.CI) expect(first?.backend).toBe("webgl");
  else expect(["webgpu", "webgl"]).toContain(first?.backend);
  // a lost WebGPU device is the failure this whole job used to measure: the page reports ready and
  // its rAF loop keeps ticking while nothing renders
  expect(first?.error ?? null).toBeNull();
  expect(first?.tier).toBe("low");
  // keeps rendering: progress of RENDERED frames, not the bench's own rAF counter — the canvas
  // publishes its frame-time window every 30 frames, so 30 is one full window. Progress, not a
  // rate: software WebGL2 on the runner manages 1-10 fps.
  await page.waitForFunction(() => (window.__twinAvatar?.stats.count ?? 0) >= 30, null, {
    timeout: 60_000,
  });
});

test("state can be forced through the query string", async ({ page }) => {
  await page.goto(avatarUrl("tier=low&state=THINKING"));
  await page.waitForFunction(() => window.__twinAvatar?.state === "THINKING");
});
