import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { offendingPaths, stagedPaths, trackedPaths } from "./corpus-check";

const dirs: string[] = [];

function gitIn(dir: string, ...args: string[]): string {
  return execFileSync("git", args, {
    cwd: dir,
    stdio: "pipe",
    encoding: "utf8",
    env: {
      ...process.env,
      GIT_CONFIG_GLOBAL: join(dir, "nonexistent-gitconfig"),
      GIT_CONFIG_SYSTEM: join(dir, "nonexistent-gitconfig"),
    },
  });
}

function tempRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), "twin-corpus-"));
  dirs.push(dir);
  gitIn(dir, "init", "-q", "-b", "main");
  gitIn(dir, "config", "user.email", "t@test.local");
  gitIn(dir, "config", "user.name", "t");
  gitIn(dir, "config", "core.autocrlf", "false");
  mkdirSync(join(dir, "corpus", "raw"), { recursive: true });
  writeFileSync(join(dir, "corpus", "README.md"), "# corpus\n");
  writeFileSync(join(dir, "corpus", "raw", "x.txt"), "secret\n");
  return dir;
}

afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

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

  it("flags everything under corpus/ regardless of case, and a bare corpus entry", () => {
    expect(
      offendingPaths(["Corpus/raw/a.txt", "corpus", "corpus/readme.md", "corpus/README.md"]),
    ).toEqual(["Corpus/raw/a.txt", "corpus", "corpus/readme.md"]);
  });
});

describe("git-backed checks", () => {
  it("sees a staged raw file as both staged and tracked", () => {
    const dir = tempRepo();
    gitIn(dir, "add", "-f", "corpus/README.md", "corpus/raw/x.txt");
    expect(offendingPaths(stagedPaths(dir))).toEqual(["corpus/raw/x.txt"]);
    expect(offendingPaths(trackedPaths(dir))).toEqual(["corpus/raw/x.txt"]);
  });

  it("sees a tracked raw file after commit", () => {
    const dir = tempRepo();
    gitIn(dir, "add", "-f", "corpus/raw/x.txt");
    gitIn(dir, "commit", "-q", "-m", "oops");
    expect(offendingPaths(trackedPaths(dir))).toEqual(["corpus/raw/x.txt"]);
  });

  it("sees a non-ASCII corpus filename when staged and when tracked", () => {
    const dir = tempRepo();
    writeFileSync(join(dir, "corpus", "raw", "محادثات.txt"), "secret\n");
    gitIn(dir, "add", "-f", "corpus/raw/محادثات.txt");
    expect(offendingPaths(stagedPaths(dir))).toEqual(["corpus/raw/محادثات.txt"]);
    gitIn(dir, "commit", "-q", "-m", "oops2");
    expect(offendingPaths(trackedPaths(dir))).toEqual(["corpus/raw/محادثات.txt"]);
  });
});
