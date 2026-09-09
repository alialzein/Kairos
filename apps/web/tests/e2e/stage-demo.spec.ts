import { expect, test } from "@playwright/test";
import { sceneUrl } from "../helpers/benchUrl";

// The owner home's stage on the public bench (`?stage=1`, follow-up 3). `only=background,hud`
// keeps the canvas light enough for software WebGL2 on the runner — the state machine, the ribbon
// and the HUD do not depend on which layers draw.
const STAGE = "stage=1&only=background,hud";

test("a demo turn drives THINKING → SPEAKING → IDLE on the stage (B5.7)", async ({ page }) => {
  await page.goto(sceneUrl(`${STAGE}&demo=1`));
  await page.waitForFunction(() => window.__twinScene?.ready === true, null, { timeout: 60_000 });
  await page.waitForFunction(
    () => {
      const log = window.__twinScene?.log ?? [];
      const i = log.indexOf("SPEAKING");
      return i > 0 && log.slice(i).includes("IDLE");
    },
    null,
    { timeout: 30_000 },
  );
  const log = await page.evaluate(() => window.__twinScene?.log ?? []);
  // from DORMANT the turn wakes first (the queued THINK survives the 1.2 s wake)
  expect(log.indexOf("WAKING")).toBeLessThan(log.indexOf("THINKING"));
  expect(log.indexOf("THINKING")).toBeLessThan(log.indexOf("SPEAKING"));
  await expect(page.locator("[data-ribbon] p").last()).toContainText("kairos:");
  await expect(page.locator("[data-stage=scene]")).toHaveAttribute("data-state", "IDLE");
  // the scene's HUD is the stage's status readout
  await expect(page.locator("[data-scene-hud]")).toHaveText(/status: idle/i);
  await expect(page.locator("[data-scene-hud-assembling]")).toHaveCount(0);
});

test("clicking the avatar wakes it: DORMANT → WAKING → LISTENING", async ({ page }) => {
  await page.goto(sceneUrl(STAGE));
  await page.waitForFunction(() => window.__twinScene?.ready === true, null, { timeout: 60_000 });
  expect(await page.evaluate(() => window.__twinScene?.state)).toBe("DORMANT");
  await page.locator("[data-stage-canvas]").click({ position: { x: 200, y: 200 } });
  await page.waitForFunction(() => window.__twinScene?.state === "LISTENING", null, {
    timeout: 10_000,
  });
  const log = await page.evaluate(() => window.__twinScene?.log ?? []);
  expect(log).toEqual(["DORMANT", "WAKING", "LISTENING"]);
  await expect(page.locator("[data-scene-hud]")).toHaveText(/status: listening/i);
});
