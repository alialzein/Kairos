import { offendingPaths, stagedPaths, trackedCorpusPaths } from "./lib/corpus-check.ts";

const mode = process.argv[2];
if (mode !== "--staged" && mode !== "--tracked") {
  console.error("usage: check-corpus --staged | --tracked");
  process.exit(2);
}
const paths = mode === "--staged" ? stagedPaths() : trackedCorpusPaths();
const bad = offendingPaths(paths);
if (bad.length > 0) {
  console.error(
    `corpus/ must never enter git (docs/10 §1). Offending ${mode.slice(2)} paths:\n  ${bad.join("\n  ")}`,
  );
  process.exit(1);
}
console.log(`corpus check (${mode.slice(2)}): clean`);
