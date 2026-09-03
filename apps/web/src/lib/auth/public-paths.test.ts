import { describe, expect, it } from "vitest";
import { isPublicPath } from "@/lib/auth/public-paths";

describe("isPublicPath", () => {
  it("treats /login and /auth (and their sub-paths) as public", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/login/")).toBe(true);
    expect(isPublicPath("/auth/confirm")).toBe(true);
  });

  it("does not match paths that merely share the prefix as a string", () => {
    expect(isPublicPath("/loginfoo")).toBe(false);
    expect(isPublicPath("/authors")).toBe(false);
    expect(isPublicPath("/")).toBe(false);
  });
});
