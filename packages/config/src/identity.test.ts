import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadIdentity } from "./identity";
import { identity } from "./identity.generated";

describe("identity.yaml", () => {
  it("loads the committed identity", () => {
    const id = loadIdentity();
    expect(id.twin_name).toBe("Kairos");
    expect(id.wake_phrase.en).toBe("Hey Kairos");
    expect(id.palette.bg).toBe("#05070d");
    expect(id.palette.particle).toBe("#2f9bff");
  });
  it("rejects a malformed file", () => {
    const dir = mkdtempSync(join(tmpdir(), "twin-identity-"));
    const bad = join(dir, "identity.yaml");
    writeFileSync(bad, "twin_name: 42\n");
    expect(() => loadIdentity(bad)).toThrow();
  });
  it("generated constant matches identity.yaml", () => {
    expect(identity).toEqual(loadIdentity());
  });
});
