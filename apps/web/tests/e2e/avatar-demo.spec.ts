import { expect, test } from "@playwright/test";
import { avatarUrl } from "../helpers/benchUrl";

test("a demo turn drives THINKING → SPEAKING → IDLE on the stage", async ({ page }) => {
  await page.goto(avatarUrl("tier=low&demo=1"));
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
  // HUD chrome (look v2, L7) tracks the state
  await expect(page.locator("[data-hud]")).toContainText("status: idle");
  await expect(page.locator("[data-hud-assembling]")).toHaveCount(0);
});
