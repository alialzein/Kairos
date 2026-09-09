import { describe, expect, it } from "vitest";
import { AvatarState } from "@twin/shared";
import {
  AVATAR_STATES,
  HEALTH_POLL,
  IDLE_TIMEOUT_S,
  LISTENING_TIMEOUT_S,
  ROLE_SPLIT,
  SHAPES,
  SPEECH_END,
  TIERS,
  WAKING_DURATION_S,
} from "./avatar";

describe("AVATAR_STATES", () => {
  it("has an entry for every AvatarState and nothing else", () => {
    expect(Object.keys(AVATAR_STATES).sort()).toEqual([...AvatarState.options].sort());
  });

  it("uses only known shapes and tween durations inside the spec window", () => {
    for (const [name, p] of Object.entries(AVATAR_STATES)) {
      expect(SHAPES).toContain(p.shape);
      const max = name === "OFFLINE" ? 2.0 : 1.2; // OFFLINE dissolves over 2 s (docs/06 §3)
      expect(p.morphDuration).toBeGreaterThanOrEqual(0.4);
      expect(p.morphDuration).toBeLessThanOrEqual(max);
      expect(p.turbulence).toBeGreaterThanOrEqual(0);
      expect(p.turbulence).toBeLessThanOrEqual(1);
      expect(p.corePulse.min).toBeLessThanOrEqual(p.corePulse.max);
    }
  });

  it("matches the spec table for the states that define the look", () => {
    expect(AVATAR_STATES.DORMANT.shape).toBe("NEBULA");
    expect(AVATAR_STATES.IDLE.shape).toBe("ORB");
    expect(AVATAR_STATES.WAKING.aberration).toBeGreaterThan(0);
    expect(AVATAR_STATES.THINKING.vortex).toBeGreaterThan(0);
    expect(AVATAR_STATES.OFFLINE.shape).toBe("NEBULA");
    expect(AVATAR_STATES.OFFLINE.tint[0]).toBeGreaterThan(AVATAR_STATES.OFFLINE.tint[2]);
  });
});

describe("TIERS", () => {
  it("orders particle counts ultra > high > mid > low with the spec values", () => {
    expect(TIERS.ultra.particles).toBe(400_000);
    expect(TIERS.high.particles).toBe(150_000);
    expect(TIERS.mid.particles).toBe(60_000);
    expect(TIERS.low.particles).toBe(20_000);
    expect(TIERS.low.waves).toBe(0);
    expect(TIERS.low.bloom).toBe("off");
    expect(TIERS.mid.targetFps).toBe(30);
  });
});

it("exposes timing and role constants", () => {
  expect(WAKING_DURATION_S).toBe(1.2);
  expect(IDLE_TIMEOUT_S).toBe(90);
  expect(ROLE_SPLIT.core + ROLE_SPLIT.spine).toBeLessThan(0.1);
});

it("decays LISTENING sooner than IDLE falls DORMANT", () => {
  expect(LISTENING_TIMEOUT_S).toBe(30);
  expect(LISTENING_TIMEOUT_S).toBeLessThan(IDLE_TIMEOUT_S);
  expect(LISTENING_TIMEOUT_S).toBeGreaterThan(WAKING_DURATION_S);
});

describe("SPEECH_END", () => {
  it("keeps the threshold inside the 0..1 energy range", () => {
    expect(SPEECH_END.threshold).toBeGreaterThan(0);
    expect(SPEECH_END.threshold).toBeLessThan(1);
  });

  it("confirms speech for at least the voice spec's 300 ms before it can end", () => {
    expect(SPEECH_END.minSpeechS).toBeGreaterThanOrEqual(0.3);
    expect(SPEECH_END.silenceS).toBeGreaterThan(0);
    // an utterance must be able to end well inside the LISTENING decay
    expect(SPEECH_END.minSpeechS + SPEECH_END.silenceS).toBeLessThan(LISTENING_TIMEOUT_S);
  });
});

describe("HEALTH_POLL", () => {
  it("needs more than one failure and times out well inside one interval", () => {
    expect(HEALTH_POLL.failuresToOffline).toBeGreaterThanOrEqual(2);
    expect(HEALTH_POLL.timeoutMs).toBeLessThan(HEALTH_POLL.intervalS * 1000);
    expect(HEALTH_POLL.intervalS).toBe(15);
  });
});
