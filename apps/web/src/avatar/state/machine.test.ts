import { describe, expect, it } from "vitest";
import { AvatarState, type TurnEvent } from "@twin/shared";
import { explicitState, fromTurnEvent, transition } from "./machine";

const ID = "3fa85f64-5717-4562-b3fc-2c963f66afa6";

describe("transition (docs/06 §3 diagram)", () => {
  it("DORMANT → WAKING → LISTENING → THINKING → SPEAKING → IDLE → DORMANT", () => {
    expect(transition("DORMANT", "WAKE")).toBe("WAKING");
    expect(transition("WAKING", "WAKE_DONE")).toBe("LISTENING");
    expect(transition("LISTENING", "SPEECH_END")).toBe("THINKING");
    expect(transition("THINKING", "FIRST_TOKEN")).toBe("SPEAKING");
    expect(transition("SPEAKING", "TURN_END")).toBe("IDLE");
    expect(transition("IDLE", "INACTIVITY")).toBe("DORMANT");
  });
  it("text turns: THINK from IDLE/LISTENING goes straight to THINKING; from DORMANT it wakes first", () => {
    expect(transition("IDLE", "THINK")).toBe("THINKING");
    expect(transition("LISTENING", "THINK")).toBe("THINKING");
    expect(transition("DORMANT", "THINK")).toBe("WAKING");
  });
  it("IDLE + WAKE replays the WAKING flourish; SPEAKING + WAKE is barge-in", () => {
    expect(transition("IDLE", "WAKE")).toBe("WAKING");
    expect(transition("SPEAKING", "WAKE")).toBe("LISTENING");
  });
  it("THINKING + TURN_END (empty reply) → IDLE; OFFLINE recovers to IDLE", () => {
    expect(transition("THINKING", "TURN_END")).toBe("IDLE");
    expect(transition("OFFLINE", "RECOVER")).toBe("IDLE");
  });
  it("FAILURE → OFFLINE from every state", () => {
    for (const s of AvatarState.options) expect(transition(s, "FAILURE")).toBe("OFFLINE");
  });
  it("ignores events that do not apply", () => {
    expect(transition("DORMANT", "TURN_END")).toBe("DORMANT");
    expect(transition("OFFLINE", "WAKE")).toBe("OFFLINE");
    expect(transition("WAKING", "THINK")).toBe("WAKING");
  });
});

describe("fromTurnEvent", () => {
  it("maps the shared contract", () => {
    const start: TurnEvent = { type: "turn.start", turn_id: ID, session_id: ID };
    const delta: TurnEvent = { type: "turn.delta", turn_id: ID, text: "hi" };
    const end: TurnEvent = { type: "turn.end", turn_id: ID, style_applied: false, latency_ms: {} };
    const err: TurnEvent = { type: "error", code: "x", message: "y" };
    const st: TurnEvent = { type: "avatar.state", state: "LISTENING" };
    const en: TurnEvent = { type: "avatar.energy", value: 0.5 };
    expect(fromTurnEvent(start)).toBe("THINK");
    expect(fromTurnEvent(delta)).toBe("FIRST_TOKEN");
    expect(fromTurnEvent(end)).toBe("TURN_END");
    expect(fromTurnEvent(err)).toBe("FAILURE");
    expect(fromTurnEvent(st)).toBeNull();
    expect(fromTurnEvent(en)).toBeNull();
    expect(explicitState(st)).toBe("LISTENING");
    expect(explicitState(delta)).toBeNull();
  });
});
