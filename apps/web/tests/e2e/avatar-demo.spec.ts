import { expect, test } from "@playwright/test";

test("a demo turn drives THINKING → SPEAKING → IDLE on the stage", async ({ page }) => {
  await page.goto("/bench/avatar?tier=low&demo=1");
  await page.waitForFunction(() => window.__twinAvatar?.ready === true, null, { timeout: 60_000 });
  await page.waitForFunction(
    () => {
      const log = window.__twinAvatar?.log ?? [];
      const i = log.indexOf("SPEAKING");
      return i > 0 && log.slice(i).includes("IDLE");
    },
    null,
    { timeout: 30_000 },
  );
  const log = await page.evaluate(() => window.__twinAvatar?.log ?? []);
  expect(log.indexOf("THINKING")).toBeLessThan(log.indexOf("SPEAKING"));
  await expect(page.locator("[data-ribbon] p").last()).toContainText("kairos:");
  await expect(page.locator("[data-status-ring=IDLE]")).toBeVisible();
});
