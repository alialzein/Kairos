import { beforeEach, describe, expect, it } from "vitest";
import { useAvatarStore } from "./store";

describe("useAvatarStore", () => {
  beforeEach(() => useAvatarStore.getState().reset());

  it("starts DORMANT and applies transitions through dispatch", () => {
    const s = useAvatarStore.getState();
    expect(s.state).toBe("DORMANT");
    s.dispatch("WAKE");
    expect(useAvatarStore.getState().state).toBe("WAKING");
    useAvatarStore.getState().dispatch("TURN_END"); // ignored in WAKING
    expect(useAvatarStore.getState().state).toBe("WAKING");
    expect(useAvatarStore.getState().log).toEqual(["DORMANT", "WAKING"]);
  });

  it("setState forces a state (avatar.state events) and records it", () => {
    useAvatarStore.getState().setState("OFFLINE");
    expect(useAvatarStore.getState().state).toBe("OFFLINE");
    expect(useAvatarStore.getState().log.at(-1)).toBe("OFFLINE");
  });

  it("keeps the log bounded to 20 entries", () => {
    for (let i = 0; i < 30; i++) useAvatarStore.getState().setState(i % 2 ? "IDLE" : "THINKING");
    expect(useAvatarStore.getState().log.length).toBeLessThanOrEqual(20);
  });

  it("stores energy, pointer, frames and tuning", () => {
    const s = useAvatarStore.getState();
    s.setEnergy({ bass: 0.1, mid: 0.2, treble: 0.3 });
    s.setPointer({ x: 0.5, active: true });
    s.setFrames({ p50: 8, p95: 12, count: 100 });
    s.setTuning({ turbulence: 0.9 });
    const g = useAvatarStore.getState();
    expect(g.energy.mid).toBe(0.2);
    expect(g.pointer).toMatchObject({ x: 0.5, y: 0, active: true, strength: 1 });
    expect(g.frames.p95).toBe(12);
    expect(g.tuning.turbulence).toBe(0.9);
  });
});
