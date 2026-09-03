import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { renameTwin } from "./lib/rename.ts";

const name = process.argv[2];
if (!name) {
  console.error("usage: pnpm twin:rename <NewName>");
  process.exit(2);
}
const root = fileURLToPath(new URL("..", import.meta.url));
const { changed } = renameTwin(root, name);
execSync("pnpm --filter @twin/config gen", { stdio: "inherit", cwd: root });
changed.push("packages/config/src/identity.generated.ts");
console.log(`renamed twin to ${name}; changed:\n  ${changed.join("\n  ")}`);
console.log(
  "Manual follow-ups: wake_phrase.ar in packages/config/identity.yaml, ADR-0012 supersession, wake-word model (Phase A6).",
);
