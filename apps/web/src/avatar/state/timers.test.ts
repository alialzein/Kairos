import { describe, expect, it } from "vitest";
import { AvatarState } from "@twin/shared";
import { IDLE_TIMEOUT_S, LISTENING_TIMEOUT_S, WAKING_DURATION_S } from "@twin/config";
import { timedEventFor } from "./timers";

describe("timedEventFor", () => {
  it("ends WAKING after the wake duration", () => {
    expect(timedEventFor("WAKING")).toEqual({ event: "WAKE_DONE", ms: WAKING_DURATION_S * 1000 });
  });

  it("falls from IDLE to DORMANT after the inactivity timeout", () => {
    expect(timedEventFor("IDLE")).toEqual({ event: "INACTIVITY", ms: IDLE_TIMEOUT_S * 1000 });
  });

  it("decays LISTENING back to IDLE after the listening timeout", () => {
    expect(timedEventFor("LISTENING")).toEqual({
      event: "INACTIVITY",
      ms: LISTENING_TIMEOUT_S * 1000,
    });
  });

  it("arms no timer in the states that wait on the Brain or on Ali", () => {
    for (const s of ["DORMANT", "THINKING", "SPEAKING", "OFFLINE"] as const)
      expect(timedEventFor(s)).toBeNull();
  });

  it("covers every AvatarState", () => {
    for (const s of AvatarState.options) {
      const t = timedEventFor(s);
      if (t) expect(t.ms).toBeGreaterThan(0);
    }
  });
});
