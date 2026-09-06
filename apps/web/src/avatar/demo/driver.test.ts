import { describe, expect, it } from "vitest";
import type { AvatarEvent } from "../state/machine";
import { DEMO_REPLIES, runDemoTurn } from "./driver";

function fakeHooks() {
  const events: AvatarEvent[] = [];
  const ribbon: string[] = [];
  const energies: number[] = [];
  let clock = 0;
  return {
    events,
    ribbon,
    energies,
    hooks: {
      send: (e: AvatarEvent) => events.push(e),
      setEnergy: (e: { mid: number }) => energies.push(e.mid),
      ribbon: (t: string, replaceLast?: boolean) => {
        if (replaceLast && ribbon.length) ribbon[ribbon.length - 1] = t;
        else ribbon.push(t);
      },
      wait: async (ms: number) => {
        clock += ms;
      },
      now: () => clock,
    },
  };
}

describe("runDemoTurn", () => {
  it("THINK → FIRST_TOKEN → streams the canned reply word by word with synthetic energy → TURN_END", async () => {
    const f = fakeHooks();
    await runDemoTurn("hello", f.hooks, { thinkMs: 500, wordMs: 50 });
    expect(f.events).toEqual(["THINK", "FIRST_TOKEN", "TURN_END"]);
    expect(f.ribbon[0]).toBe("you: hello");
    const reply = f.ribbon[1] ?? "";
    expect(DEMO_REPLIES.some((r) => reply === `kairos: ${r}`)).toBe(true);
    expect(f.energies.length).toBeGreaterThan(3);
    expect(f.energies.at(-1)).toBe(0); // energy cleared at the end
  });
  it("picks the reply deterministically from the input text", async () => {
    const a = fakeHooks();
    const b = fakeHooks();
    await runDemoTurn("same text", a.hooks, { thinkMs: 0, wordMs: 0 });
    await runDemoTurn("same text", b.hooks, { thinkMs: 0, wordMs: 0 });
    expect(a.ribbon).toEqual(b.ribbon);
  });
});
