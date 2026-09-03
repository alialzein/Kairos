import { execFileSync } from "node:child_process";

const ALLOWED = "corpus/README.md";

export function offendingPaths(paths: string[]): string[] {
  return paths
    .map((p) => p.replaceAll("\\", "/"))
    .filter((p) => {
      const lower = p.toLowerCase();
      return (lower === "corpus" || lower.startsWith("corpus/")) && p !== ALLOWED;
    });
}

function git(cwd: string, args: string[]): string[] {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).split("\0").filter(Boolean);
}

export function stagedPaths(cwd: string = process.cwd()): string[] {
  return git(cwd, ["diff", "--cached", "--name-only", "--diff-filter=ACMRT", "-z"]);
}

export function trackedPaths(cwd: string = process.cwd()): string[] {
  return git(cwd, ["ls-files", "-z"]);
}

export function rangePaths(range: string, cwd: string = process.cwd()): string[] {
  return git(cwd, ["diff", "--name-only", "--diff-filter=ACMRT", "-z", range]);
}
