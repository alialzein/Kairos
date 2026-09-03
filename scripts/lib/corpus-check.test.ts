import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { offendingPaths, stagedPaths, trackedCorpusPaths } from "./corpus-check";

function tempRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), "twin-corpus-"));
  const git = (...args: string[]) => execFileSync("git", args, { cwd: dir, stdio: "pipe" });
  git("init", "-q", "-b", "main");
  git("config", "user.email", "t@test.local");
  git("config", "user.name", "t");
  mkdirSync(join(dir, "corpus", "raw"), { recursive: true });
  writeFileSync(join(dir, "corpus", "README.md"), "# corpus\n");
  writeFileSync(join(dir, "corpus", "raw", "x.txt"), "secret\n");
  return dir;
}

describe("offendingPaths", () => {
  it("flags everything under corpus/ except the README", () => {
    expect(
      offendingPaths([
        "corpus/README.md",
        "corpus/raw/x.txt",
        "docs/a.md",
        "corpus/derived/m.parquet",
      ]),
    ).toEqual(["corpus/raw/x.txt", "corpus/derived/m.parquet"]);
  });
});

describe("git-backed checks", () => {
  it("sees a staged raw file as both staged and tracked", () => {
    const dir = tempRepo();
    execFileSync("git", ["add", "-f", "corpus/README.md", "corpus/raw/x.txt"], { cwd: dir });
    expect(offendingPaths(stagedPaths(dir))).toEqual(["corpus/raw/x.txt"]);
    expect(offendingPaths(trackedCorpusPaths(dir))).toEqual(["corpus/raw/x.txt"]);
  });
  it("sees a tracked raw file after commit", () => {
    const dir = tempRepo();
    execFileSync("git", ["add", "-f", "corpus/raw/x.txt"], { cwd: dir });
    execFileSync("git", ["commit", "-q", "-m", "oops"], { cwd: dir });
    expect(offendingPaths(trackedCorpusPaths(dir))).toEqual(["corpus/raw/x.txt"]);
  });
});
