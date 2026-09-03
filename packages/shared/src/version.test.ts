import { describe, expect, it } from "vitest";
import { CONTRACTS_VERSION } from "./index";

describe("@twin/shared", () => {
  it("exports a semver contracts version", () => {
    expect(CONTRACTS_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
