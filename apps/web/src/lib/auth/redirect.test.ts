import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/auth/redirect";

describe("safeNextPath", () => {
  it("passes through same-origin absolute paths", () => {
    expect(safeNextPath("/")).toBe("/");
    expect(safeNextPath("/chat?x=1")).toBe("/chat?x=1");
  });

  it("rejects off-origin and scheme-relative targets, falling back to /", () => {
    expect(safeNextPath("https://evil.com")).toBe("/");
    expect(safeNextPath("//evil.com")).toBe("/");
    expect(safeNextPath("javascript:alert(1)")).toBe("/");
    expect(safeNextPath("")).toBe("/");
    expect(safeNextPath(null)).toBe("/");
  });
});
