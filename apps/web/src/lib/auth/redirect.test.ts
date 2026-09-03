import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/auth/redirect";

const MALICIOUS_INPUTS = [
  "/\\evil.com",
  "/\\\\evil.com",
  "/\\/evil.com",
  "//evil.com",
  "https://evil.com",
  "javascript:alert(1)",
];

describe("safeNextPath", () => {
  it("passes through same-origin absolute paths", () => {
    expect(safeNextPath("/")).toBe("/");
    expect(safeNextPath("/chat?x=1")).toBe("/chat?x=1");
    expect(safeNextPath("/chat?x=1#top")).toBe("/chat?x=1#top");
  });

  it("normalises dot segments within the same origin", () => {
    expect(safeNextPath("/../x")).toBe("/x");
  });

  it("leaves a percent-encoded backslash alone (it's not a path separator)", () => {
    expect(safeNextPath("/%5Cevil.com")).toBe("/%5Cevil.com");
  });

  it("rejects off-origin, scheme-relative, and backslash-smuggled targets, falling back to /", () => {
    expect(safeNextPath("https://evil.com")).toBe("/");
    expect(safeNextPath("//evil.com")).toBe("/");
    expect(safeNextPath("javascript:alert(1)")).toBe("/");
    expect(safeNextPath("")).toBe("/");
    expect(safeNextPath(null)).toBe("/");
    expect(safeNextPath("/\\evil.com")).toBe("/");
    expect(safeNextPath("/\\\\evil.com")).toBe("/");
    expect(safeNextPath("/\\/evil.com")).toBe("/");
  });

  it("never resolves off the app's own origin, even for malicious input", () => {
    for (const input of MALICIOUS_INPUTS) {
      const resolved = new URL(safeNextPath(input), "http://localhost:3000");
      expect(resolved.origin).toBe("http://localhost:3000");
    }
  });
});
