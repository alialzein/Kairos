import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { AvatarState, TurnEvent, TurnRequest } from "./index";

const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url)), "utf8"));

describe("contracts", () => {
  it("has the seven avatar states from CONTEXT.md", () => {
    expect(AvatarState.options).toEqual([
      "DORMANT",
      "IDLE",
      "WAKING",
      "LISTENING",
      "THINKING",
      "SPEAKING",
      "OFFLINE",
    ]);
  });
  it("accepts the valid TurnRequest fixture", () => {
    expect(TurnRequest.safeParse(fixture("turn_request.valid.json")).success).toBe(true);
  });
  it("rejects every invalid TurnRequest fixture", () => {
    for (const bad of fixture("turn_request.invalid.json") as unknown[]) {
      expect(TurnRequest.safeParse(bad).success).toBe(false);
    }
  });
  it("accepts every TurnEvent fixture and preserves the discriminator", () => {
    for (const ev of fixture("turn_events.valid.json") as { type: string }[]) {
      const parsed = TurnEvent.parse(ev);
      expect(parsed.type).toBe(ev.type);
    }
  });
  it("rejects every invalid TurnEvent fixture", () => {
    for (const bad of fixture("turn_events.invalid.json") as unknown[]) {
      expect(TurnEvent.safeParse(bad).success).toBe(false);
    }
  });
});
