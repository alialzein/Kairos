import type { AvatarState } from "@twin/shared";
import { IDLE_TIMEOUT_S, LISTENING_TIMEOUT_S, WAKING_DURATION_S } from "@twin/config";
import type { AvatarEvent } from "./machine";

export interface TimedEvent {
  event: AvatarEvent;
  ms: number;
}

/**
 * The timed edges of docs/06 §3, as data: WAKING lasts 1.2 s, IDLE falls DORMANT after 90 s, and
 * LISTENING decays back to IDLE after 30 s of nobody speaking (a proposed default — see
 * `LISTENING_TIMEOUT_S`). The other four states wait on the Brain or on Ali, never on a clock.
 */
export function timedEventFor(state: AvatarState): TimedEvent | null {
  switch (state) {
    case "WAKING":
      return { event: "WAKE_DONE", ms: WAKING_DURATION_S * 1000 };
    case "IDLE":
      return { event: "INACTIVITY", ms: IDLE_TIMEOUT_S * 1000 };
    case "LISTENING":
      return { event: "INACTIVITY", ms: LISTENING_TIMEOUT_S * 1000 };
    default:
      return null;
  }
}
