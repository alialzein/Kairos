import { execFileSync } from "node:child_process";

const ALLOWED = new Set(["corpus/README.md"]);

export function offendingPaths(paths: string[]): string[] {
  return paths
    .map((p) => p.replaceAll("\\", "/"))
    .filter((p) => p.startsWith("corpus/") && !ALLOWED.has(p));
}

function git(cwd: string, args: string[]): string[] {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).split(/\r?\n/).filter(Boolean);
}

export function stagedPaths(cwd: string = process.cwd()): string[] {
  return git(cwd, ["diff", "--cached", "--name-only", "--diff-filter=ACMR"]);
}

export function trackedCorpusPaths(cwd: string = process.cwd()): string[] {
  return git(cwd, ["ls-files", "--", "corpus"]);
}
