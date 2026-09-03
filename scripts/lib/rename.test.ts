import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { renameTwin } from "./rename";

function fakeRepo(): string {
  const root = mkdtempSync(join(tmpdir(), "twin-rename-"));
  mkdirSync(join(root, "packages", "config"), { recursive: true });
  mkdirSync(join(root, "persona", "prompts"), { recursive: true });
  writeFileSync(
    join(root, "packages", "config", "identity.yaml"),
    '# keep me\ntwin_name: Kairos\nwake_phrase:\n  en: Hey Kairos\n  ar: يا كايروس\npalette:\n  bg: "#05070d"\n',
  );
  writeFileSync(
    join(root, "persona", "core.yaml"),
    'meta: { version: 1, twin_name: Kairos, updated_at: "2026-09-03" }\nidentity:\n  name: Ali Alzein\n',
  );
  writeFileSync(
    join(root, "persona", "prompts", "reasoner_system.md"),
    "You are Kairos, the digital self of Ali Alzein. Kairos never lies. Kairosity is not a word.\n",
  );
  return root;
}

describe("renameTwin", () => {
  it("rewrites identity, persona core and the prompt template", () => {
    const root = fakeRepo();
    const result = renameTwin(root, "Astra");
    expect(result.changed.sort()).toEqual(
      [
        "packages/config/identity.yaml",
        "persona/core.yaml",
        "persona/prompts/reasoner_system.md",
      ].sort(),
    );
    const identity = readFileSync(join(root, "packages", "config", "identity.yaml"), "utf8");
    expect(identity).toContain("# keep me");
    expect(identity).toContain("twin_name: Astra");
    expect(identity).toContain("en: Hey Astra");
    expect(identity).toContain("ar: يا كايروس"); // Arabic rendering is a human decision
    const core = readFileSync(join(root, "persona", "core.yaml"), "utf8");
    expect(core).toContain("twin_name: Astra");
    expect(core).toContain('updated_at: "2026-09-03"'); // date stays quoted
    const prompt = readFileSync(join(root, "persona", "prompts", "reasoner_system.md"), "utf8");
    expect(prompt).toContain("You are Astra, the digital self");
    expect(prompt).toContain("Astra never lies");
    expect(prompt).toContain("Kairosity"); // whole-word replacement only
  });
  it("rejects names that are not a single capitalised word", () => {
    expect(() => renameTwin(fakeRepo(), "two words")).toThrow();
    expect(() => renameTwin(fakeRepo(), "")).toThrow();
  });
  it("rejects an invalid existing name in identity.yaml", () => {
    const root = fakeRepo();
    writeFileSync(
      join(root, "packages", "config", "identity.yaml"),
      '# keep me\ntwin_name: "Kai.ros"\nwake_phrase:\n  en: Hey Kairos\n  ar: يا كايروس\npalette:\n  bg: "#05070d"\n',
    );
    expect(() => renameTwin(root, "Astra")).toThrow();
  });
});
