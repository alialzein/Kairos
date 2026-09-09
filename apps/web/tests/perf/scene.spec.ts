import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { sceneUrl } from "../helpers/benchUrl";

const BASELINE = "tests/perf/baseline.ci.json";
const OUT = "test-results/perf.json";
const TOLERANCE = 1.15; // docs/11 B5.8: regression > 15 % fails
/** rendered frames to sample before reading the window (the canvas publishes every 30) */
const SAMPLE_FRAMES = 30;

interface Baseline {
  backend: string;
  /** the fixed profile: the merged scene, every layer on, LISTENING */
  profile: string;
  p95: number;
  p50: number;
  recordedAt: string;
  runner: string;
}

/**
 * B5.8 on the Neural Bust (follow-up 3): the shipped scene — every layer, the LISTENING look — is
 * the fixed profile. Software WebGL2 on the runner draws it at well under one frame a second, so
 * the numbers are meaningless in absolute terms (docs/plans/phase-b5.md D9) and only a relative
 * regression against the recorded baseline fails.
 */
test("scene frame time on the bench page stays within 15 % of the CI baseline", async ({
  page,
}) => {
  // the ready wait plus SAMPLE_FRAMES of the full scene on software WebGL2 take minutes
  test.setTimeout(600_000);
  await page.goto(sceneUrl());
  await page.waitForFunction(() => window.__twinScene?.ready === true, null, { timeout: 120_000 });
  // sample by rendered frames, not wall clock: the canvas keeps a 240-frame window and publishes
  // it every 30 frames, so waiting for a count fills it with real frames on any speed of device
  await page.waitForFunction((n) => (window.__twinScene?.stats.count ?? 0) >= n, SAMPLE_FRAMES, {
    timeout: 420_000,
  });
  const s = await page.evaluate(() => window.__twinScene);
  expect(s?.error ?? null, "renderer reported an error while sampling").toBeNull();
  expect(s?.stats.count ?? 0).toBeGreaterThanOrEqual(SAMPLE_FRAMES);
  const result: Baseline = {
    backend: s?.backend ?? "unknown",
    profile: "scene:all-layers:LISTENING",
    p95: Number(s?.stats.p95.toFixed(2)),
    p50: Number(s?.stats.p50.toFixed(2)),
    recordedAt: new Date().toISOString(),
    runner: process.env.RUNNER_OS ? "ubuntu-latest" : "local",
  };
  mkdirSync("test-results", { recursive: true });
  writeFileSync(OUT, JSON.stringify(result, null, 2));
  test.info().annotations.push({ type: "perf", description: JSON.stringify(result) });

  if (process.env.UPDATE_BASELINE === "1") {
    writeFileSync(BASELINE, JSON.stringify(result, null, 2) + "\n");
    return;
  }
  if (!process.env.CI) return; // local numbers are not comparable with the runner's
  expect(
    existsSync(BASELINE),
    "baseline missing — run the CI workflow once with update_baseline=true and commit the artifact",
  ).toBe(true);
  const base = JSON.parse(readFileSync(BASELINE, "utf8")) as Baseline;
  expect(result.backend, "backend changed since the baseline; re-record it").toBe(base.backend);
  expect(result.profile, "profile changed since the baseline; re-record it").toBe(base.profile);
  expect(result.p95, `p95 ${result.p95} ms vs baseline ${base.p95} ms`).toBeLessThanOrEqual(
    base.p95 * TOLERANCE,
  );
});
