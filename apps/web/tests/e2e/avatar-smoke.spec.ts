import { expect, test } from "@playwright/test";

test("bench page boots the particle system on WebGPU or WebGL and keeps rendering", async ({
  page,
}) => {
  await page.goto("/bench/avatar?tier=low");
  await page.waitForFunction(() => window.__twinAvatar?.ready === true, null, { timeout: 60_000 });
  const first = await page.evaluate(() => window.__twinAvatar);
  expect(["webgpu", "webgl"]).toContain(first?.backend);
  expect(first?.tier).toBe("low");
  await page.waitForTimeout(1500);
  const later = await page.evaluate(() => window.__twinAvatar);
  expect((later?.frames ?? 0) - (first?.frames ?? 0)).toBeGreaterThan(20);
});

test("state can be forced through the query string", async ({ page }) => {
  await page.goto("/bench/avatar?tier=low&state=THINKING");
  await page.waitForFunction(() => window.__twinAvatar?.state === "THINKING");
});
