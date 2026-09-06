import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const TIER = "mid";
const BASELINE = "tests/perf/baseline.ci.json";
const OUT = "test-results/perf.json";
const TOLERANCE = 1.15; // docs/11 B5.8: regression > 15 % fails

interface Baseline {
  backend: string;
  tier: string;
  p95: number;
  p50: number;
  recordedAt: string;
  runner: string;
}

test("avatar frame time on the bench page stays within 15 % of the CI baseline", async ({
  page,
}) => {
  await page.goto(`/bench/avatar?tier=${TIER}`);
  await page.waitForFunction(() => window.__twinAvatar?.ready === true, null, { timeout: 60_000 });
  await page.waitForTimeout(2000); // warm-up
  await page.waitForTimeout(5000);
  const s = await page.evaluate(() => window.__twinAvatar);
  expect(s?.stats.count ?? 0).toBeGreaterThan(30);
  const result: Baseline = {
    backend: s?.backend ?? "unknown",
    tier: TIER,
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
    "baseline missing — run the avatar job once with UPDATE_BASELINE=1 and commit it",
  ).toBe(true);
  const base = JSON.parse(readFileSync(BASELINE, "utf8")) as Baseline;
  expect(result.backend, "backend changed since the baseline; re-record it").toBe(base.backend);
  expect(result.p95, `p95 ${result.p95} ms vs baseline ${base.p95} ms`).toBeLessThanOrEqual(
    base.p95 * TOLERANCE,
  );
});
