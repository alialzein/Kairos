import { offendingPaths, rangePaths, stagedPaths, trackedPaths } from "./lib/corpus-check.ts";

const mode = process.argv[2];
if (mode !== "--staged" && mode !== "--tracked" && mode !== "--range") {
  console.error("usage: check-corpus --staged | --tracked | --range <base>..<head>");
  process.exit(2);
}
if (mode === "--range" && !process.argv[3]) {
  console.error("usage: check-corpus --staged | --tracked | --range <base>..<head>");
  process.exit(2);
}
const label = mode.slice(2);
const paths =
  mode === "--staged"
    ? stagedPaths()
    : mode === "--tracked"
      ? trackedPaths()
      : rangePaths(process.argv[3]!);
const bad = offendingPaths(paths);
if (bad.length > 0) {
  console.error(
    `corpus/ must never enter git (docs/10 §1). Offending ${label} paths:\n  ${bad.join("\n  ")}`,
  );
  process.exit(1);
}
console.log(`corpus check (${label}): clean`);
