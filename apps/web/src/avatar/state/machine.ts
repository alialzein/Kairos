import type { AvatarState, TurnEvent } from "@twin/shared";

export type AvatarEvent =
  | "WAKE"
  | "WAKE_DONE"
  | "THINK"
  | "SPEECH_END"
  | "FIRST_TOKEN"
  | "TURN_END"
  | "INACTIVITY"
  | "FAILURE"
  | "RECOVER";

/** Pure transition table for docs/06 §3. Unknown (state, event) pairs return the same state. */
export function transition(state: AvatarState, event: AvatarEvent): AvatarState {
  if (event === "FAILURE") return "OFFLINE";
  switch (state) {
    case "DORMANT":
      return event === "WAKE" || event === "THINK" ? "WAKING" : state;
    case "WAKING":
      return event === "WAKE_DONE" ? "LISTENING" : state;
    case "LISTENING":
      if (event === "SPEECH_END" || event === "THINK") return "THINKING";
      if (event === "INACTIVITY") return "IDLE";
      return state;
    case "THINKING":
      if (event === "FIRST_TOKEN") return "SPEAKING";
      if (event === "TURN_END") return "IDLE";
      return state;
    case "SPEAKING":
      if (event === "TURN_END") return "IDLE";
      if (event === "WAKE") return "LISTENING"; // barge-in
      return state;
    case "IDLE":
      if (event === "WAKE") return "WAKING";
      if (event === "THINK") return "THINKING";
      if (event === "INACTIVITY") return "DORMANT";
      return state;
    case "OFFLINE":
      return event === "RECOVER" ? "IDLE" : state;
    default:
      return state;
  }
}

export function fromTurnEvent(e: TurnEvent): AvatarEvent | null {
  switch (e.type) {
    case "turn.start":
      return "THINK";
    case "turn.delta":
      return "FIRST_TOKEN";
    case "turn.end":
      return "TURN_END";
    case "error":
      return "FAILURE";
    default:
      return null;
  }
}

export function explicitState(e: TurnEvent): AvatarState | null {
  return e.type === "avatar.state" ? e.state : null;
}
