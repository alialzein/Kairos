import { describe, expect, it } from "vitest";
import { AvatarState } from "@twin/shared";
import {
  AVATAR_STATES,
  IDLE_TIMEOUT_S,
  ROLE_SPLIT,
  SHAPES,
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
