import { describe, expect, it } from "vitest";
import { isOwner, parseOwnerIds } from "@/lib/auth/owner";

describe("owner allowlist", () => {
  it("parses a comma-separated list, trimming and dropping blanks", () => {
    expect([...parseOwnerIds(" a , b,,c ")]).toEqual(["a", "b", "c"]);
    expect(parseOwnerIds(undefined).size).toBe(0);
  });
  it("only allows ids in the list", () => {
    const owners = parseOwnerIds("11111111-1111-1111-1111-111111111111");
    expect(isOwner("11111111-1111-1111-1111-111111111111", owners)).toBe(true);
    expect(isOwner("22222222-2222-2222-2222-222222222222", owners)).toBe(false);
    expect(isOwner(undefined, owners)).toBe(false);
  });
});
