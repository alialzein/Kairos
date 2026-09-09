import { Color } from "three/webgpu";
import { describe, expect, it } from "vitest";
import { sceneConfig } from "./sceneConfig";
import {
  cloneLook,
  DEMO_SEQUENCE,
  DEMO_STEP_MS,
  easeInOutCubic,
  linearRgb,
  LISTENING_LOOK,
  LOOK_NUMBER_KEYS,
  LOOK_RATE_KEYS,
  SCENE_STATES,
  SceneStateEngine,
  STATE_ORDER,
  type SceneLook,
  type SceneStateName,
  type SceneStateSpec,
} from "./states";

/** A fixture spec set: every state gets `look`, so a test can point two states at two looks and
 *  watch the engine blend between them. Never the shipped `SCENE_STATES` (Ali overwrites those
 *  rows) — the engine's behaviour is what these assert. */
function specs(rows: Partial<Record<SceneStateName, SceneStateSpec>>) {
  const base = (): SceneStateSpec => ({
    look: cloneLook(LISTENING_LOOK),
    hud: { text: "", dot: "#000000", pulse: false },
    inMs: 600,
  });
  const out = {} as Record<SceneStateName, SceneStateSpec>;
  for (const name of STATE_ORDER) out[name] = rows[name] ?? base();
  return out;
}

function look(over: Partial<SceneLook>): SceneLook {
  return { ...cloneLook(LISTENING_LOOK), ...over };
}

describe("linearRgb", () => {
  it("matches three's sRGB → linear conversion channel for channel", () => {
    for (const hex of [sceneConfig.palette.core, sceneConfig.palette.line, "#000000", "#FFFFFF"]) {
      const c = new Color(hex);
      expect(linearRgb(hex)).toEqual([c.r, c.g, c.b]);
    }
  });
});

describe("LISTENING is the identity row", () => {
  it("LISTENING_LOOK is the merged scene: every multiplier 1, periods and colour from config", () => {
    expect(LISTENING_LOOK).toEqual({
      coreColor: linearRgb(sceneConfig.palette.core),
      coreIntensity: 1,
      corePulsePeriod: (Math.PI * 2) / sceneConfig.core.pulseSpeed,
      corePulseAmount: 1,
      ringBreathAmount: 1,
      ringBreathPeriod: sceneConfig.motion.ringBreath.period,
      plumeFraction: 1,
      plumeSpeed: 1,
      neckPulseSpeed: 1,
      neckBrightness: 1,
      contourScroll: 1,
      goldBrightness: 1,
      dustDrift: 1,
    });
  });

  it("SCENE_STATES.LISTENING.look equals LISTENING_LOOK field by field", () => {
    const row = SCENE_STATES.LISTENING.look;
    expect(row.coreColor).toEqual(LISTENING_LOOK.coreColor);
    for (const key of LOOK_NUMBER_KEYS) expect(row[key]).toBe(LISTENING_LOOK[key]);
    // the LISTENING HUD text is still the config's — the key the merged scene shipped with
    expect(SCENE_STATES.LISTENING.hud.text).toBe(sceneConfig.hud.text);
    expect(SCENE_STATES.LISTENING.hud.text).toBe("STATUS: LISTENING");
  });

  it("every state has a row, a HUD text, a dot and a tween ≤ 600 ms", () => {
    for (const name of STATE_ORDER) {
      const spec = SCENE_STATES[name];
      expect(spec.hud.text).toBe(name === "LISTENING" ? sceneConfig.hud.text : `STATUS: ${name}`);
      expect(spec.hud.dot).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(spec.inMs).toBeLessThanOrEqual(600);
    }
  });

  it("each row owns its look object, so overwriting one never moves another", () => {
    expect(SCENE_STATES.IDLE.look).not.toBe(SCENE_STATES.LISTENING.look);
    expect(SCENE_STATES.IDLE.look.coreColor).not.toBe(LISTENING_LOOK.coreColor);
  });
});

describe("key tables", () => {
  it("LOOK_NUMBER_KEYS covers every field of SceneLook but the colour", () => {
    const keys = Object.keys(LISTENING_LOOK).filter((k) => k !== "coreColor");
    expect([...LOOK_NUMBER_KEYS].sort()).toEqual(keys.sort());
  });
  it("LOOK_RATE_KEYS are the fields that make something move", () => {
    expect([...LOOK_RATE_KEYS]).toEqual([
      "corePulseAmount",
      "ringBreathAmount",
      "plumeSpeed",
      "neckPulseSpeed",
      "contourScroll",
      "dustDrift",
    ]);
  });
});

describe("STATE_ORDER / DEMO_SEQUENCE", () => {
  it("STATE_ORDER is the AvatarState enum order", () => {
    expect(STATE_ORDER).toEqual([
      "DORMANT",
      "IDLE",
      "WAKING",
      "LISTENING",
      "THINKING",
      "SPEAKING",
      "OFFLINE",
    ]);
  });
  it("DEMO_SEQUENCE is Ali's loop and only names real states", () => {
    expect(DEMO_SEQUENCE).toEqual([
      "DORMANT",
      "WAKING",
      "LISTENING",
      "THINKING",
      "SPEAKING",
      "IDLE",
      "OFFLINE",
      "IDLE",
    ]);
    for (const name of DEMO_SEQUENCE) expect(STATE_ORDER).toContain(name);
    expect(DEMO_STEP_MS).toBe(5000);
  });
});

describe("easeInOutCubic", () => {
  it("is 0 → 0, 1 → 1 and symmetric about the 0.5 midpoint", () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(1)).toBe(1);
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5, 12);
    expect(easeInOutCubic(0.25)).toBeCloseTo(0.0625, 12);
    expect(easeInOutCubic(0.75)).toBeCloseTo(1 - 0.0625, 12);
  });
});

describe("SceneStateEngine — identity", () => {
  it("sits on its initial state's look and returns the same object every frame", () => {
    const engine = new SceneStateEngine(specs({}), "LISTENING", false);
    const a = engine.update(0, 0);
    const b = engine.update(1000, 0);
    expect(a).toBe(b); // reused, never reallocated
    expect(a.coreColor).toEqual(LISTENING_LOOK.coreColor);
    for (const key of LOOK_NUMBER_KEYS) expect(a[key]).toBe(LISTENING_LOOK[key]);
    expect(engine.state).toBe("LISTENING");
    expect(engine.spec.inMs).toBe(600);
  });
});

describe("SceneStateEngine — tween", () => {
  const table = specs({
    THINKING: {
      look: look({ coreIntensity: 3, contourScroll: 5, coreColor: [1, 0, 0] }),
      hud: { text: "", dot: "#000000", pulse: false },
      inMs: 600,
    },
  });

  it("eases in-out cubic from the current look to the target, per field and per channel", () => {
    const engine = new SceneStateEngine(table, "LISTENING", false);
    engine.update(0, 0);
    engine.set("THINKING", 1000);
    expect(engine.state).toBe("THINKING");

    const t0 = engine.update(1000, 0);
    expect(t0.coreIntensity).toBeCloseTo(1, 12);
    expect(t0.coreColor[0]).toBeCloseTo(linearRgb(sceneConfig.palette.core)[0], 12);

    const half = engine.update(1300, 0); // 300 / 600 → ease 0.5
    expect(half.coreIntensity).toBeCloseTo(2, 12);
    expect(half.contourScroll).toBeCloseTo(3, 12);
    const [r0, g0, b0] = linearRgb(sceneConfig.palette.core);
    expect(half.coreColor[0]).toBeCloseTo(r0 + (1 - r0) * 0.5, 12);
    expect(half.coreColor[1]).toBeCloseTo(g0 * 0.5, 12);
    expect(half.coreColor[2]).toBeCloseTo(b0 * 0.5, 12);

    const quarter = engine.update(1150, 0); // 150 / 600 → ease 0.0625
    expect(quarter.coreIntensity).toBeCloseTo(1 + 2 * 0.0625, 12);

    const end = engine.update(1600, 0);
    expect(end.coreIntensity).toBeCloseTo(3, 12);
    expect(end.coreColor).toEqual([1, 0, 0]);
    expect(engine.update(9999, 0).coreIntensity).toBeCloseTo(3, 12); // stays settled
  });

  it("interrupting a tween starts the next one from the blended look, never from the row", () => {
    const engine = new SceneStateEngine(table, "LISTENING", false);
    engine.update(0, 0);
    engine.set("THINKING", 0);
    const mid = engine.update(300, 0).coreIntensity; // 2
    engine.set("LISTENING", 300);
    expect(engine.update(300, 0).coreIntensity).toBeCloseTo(mid, 12);
    expect(engine.update(900, 0).coreIntensity).toBeCloseTo(1, 12);
  });
});

describe("SceneStateEngine — freeze then tween (OFFLINE)", () => {
  const table = specs({
    OFFLINE: {
      look: look({ coreIntensity: 0.2, contourScroll: 0.1 }),
      hud: { text: "", dot: "#000000", pulse: false },
      inMs: 600,
      freezeMs: 400,
    },
  });

  it("holds the entry look with every rate at 0, then tweens out of it", () => {
    const engine = new SceneStateEngine(table, "LISTENING", false);
    engine.update(0, 0);
    engine.set("OFFLINE", 0);

    const frozen = engine.update(200, 0);
    // rates stopped...
    for (const key of LOOK_RATE_KEYS) expect(frozen[key]).toBe(0);
    // ...everything else is exactly the look it froze from
    expect(frozen.coreIntensity).toBe(1);
    expect(frozen.corePulsePeriod).toBe(LISTENING_LOOK.corePulsePeriod);
    expect(frozen.coreColor).toEqual(LISTENING_LOOK.coreColor);

    // the tween starts at the frozen look, not at the pre-freeze one
    const start = engine.update(400, 0);
    expect(start.contourScroll).toBe(0);
    expect(start.coreIntensity).toBeCloseTo(1, 12);

    const half = engine.update(700, 0); // 300 / 600 → ease 0.5
    expect(half.coreIntensity).toBeCloseTo(0.6, 12);
    expect(half.contourScroll).toBeCloseTo(0.05, 12);

    const end = engine.update(1000, 0);
    expect(end.coreIntensity).toBeCloseTo(0.2, 12);
    expect(end.contourScroll).toBeCloseTo(0.1, 12);
  });
});

describe("SceneStateEngine — sequence (WAKING)", () => {
  const table = specs({
    WAKING: {
      look: look({ coreIntensity: 2 }),
      hud: { text: "", dot: "#000000", pulse: false },
      inMs: 600,
      sequenceMs: 1200,
      // writes in place, never allocates; `out` arrives pre-filled with the row's look
      sequence: (t01, out) => {
        out.coreIntensity = t01 * 2;
        out.plumeFraction = t01;
      },
    },
  });

  it("runs the one-shot curve while t < sequenceMs and leaves its end value after it", () => {
    const engine = new SceneStateEngine(table, "LISTENING", false);
    engine.update(0, 0);
    engine.set("WAKING", 0);
    expect(engine.update(0, 0).coreIntensity).toBe(0);
    expect(engine.update(600, 0).coreIntensity).toBeCloseTo(1, 12);
    expect(engine.update(600, 0).plumeFraction).toBeCloseTo(0.5, 12);
    expect(engine.update(1200, 0).coreIntensity).toBeCloseTo(2, 12);
    expect(engine.update(5000, 0).coreIntensity).toBeCloseTo(2, 12);
    // untouched fields come from the row's look
    expect(engine.update(600, 0).goldBrightness).toBe(1);
  });

  it("the next state tweens from wherever the sequence left the look", () => {
    const engine = new SceneStateEngine(table, "LISTENING", false);
    engine.update(0, 0);
    engine.set("WAKING", 0);
    engine.update(300, 0); // coreIntensity 0.5
    engine.set("LISTENING", 300);
    expect(engine.update(300, 0).coreIntensity).toBeCloseTo(0.5, 12);
    expect(engine.update(900, 0).coreIntensity).toBeCloseTo(1, 12);
  });
});

describe("SceneStateEngine — energy (SPEAKING)", () => {
  const table = specs({
    SPEAKING: {
      look: look({ coreIntensity: 1.5 }),
      hud: { text: "", dot: "#000000", pulse: false },
      inMs: 0,
      energy: { coreIntensity: 2, corePulsePeriod: -10 },
    },
  });

  it("adds gain · energyMid after the tween and clamps at 0", () => {
    const engine = new SceneStateEngine(table, "LISTENING", false);
    engine.update(0, 0);
    engine.set("SPEAKING", 0);
    expect(engine.update(0, 0).coreIntensity).toBeCloseTo(1.5, 12);
    expect(engine.update(0, 0.5).coreIntensity).toBeCloseTo(2.5, 12);
    // −10 · 1 takes the 4.19 s period well below zero: clamped, never negative
    expect(engine.update(0, 1).corePulsePeriod).toBe(0);
    // the add does not accumulate frame over frame
    expect(engine.update(0, 0).coreIntensity).toBeCloseTo(1.5, 12);
  });
});

describe("SceneStateEngine — reduced motion", () => {
  const table = specs({
    THINKING: {
      look: look({ coreIntensity: 3 }),
      hud: { text: "", dot: "#000000", pulse: false },
      inMs: 600,
    },
    OFFLINE: {
      look: look({ coreIntensity: 0.2 }),
      hud: { text: "", dot: "#000000", pulse: false },
      inMs: 600,
      freezeMs: 400,
    },
    WAKING: {
      look: look({ coreIntensity: 2 }),
      hud: { text: "", dot: "#000000", pulse: false },
      inMs: 600,
      sequenceMs: 1200,
      sequence: (t01, out) => {
        out.coreIntensity = t01 * 2;
      },
    },
  });

  it("transitions are instant, freezes are skipped and sequences jump to their end", () => {
    const engine = new SceneStateEngine(table, "LISTENING", true);
    engine.update(0, 0);
    engine.set("THINKING", 0);
    expect(engine.update(0, 0).coreIntensity).toBe(3);
    engine.set("OFFLINE", 0);
    expect(engine.update(0, 0).coreIntensity).toBe(0.2);
    engine.set("WAKING", 0);
    expect(engine.update(0, 0).coreIntensity).toBe(2);
  });

  it("keeps the pulse amplitude — the still comes from the driver freezing the phase", () => {
    // the merged still scene renders the core at 1 − pulseAmount (sin 0 = 0); zeroing the
    // amplitude here would brighten it by that much, so reduced motion leaves it alone
    const still = new SceneStateEngine(specs({}), "LISTENING", true);
    expect(still.update(0, 0).corePulseAmount).toBe(1);
    const moving = new SceneStateEngine(specs({}), "LISTENING", false);
    expect(moving.update(0, 0).corePulseAmount).toBe(1);
  });
});

describe("SceneStateEngine — hold", () => {
  const table = specs({
    THINKING: {
      look: look({ coreIntensity: 3 }),
      hud: { text: "", dot: "#000000", pulse: false },
      inMs: 600,
    },
  });

  it("pins the clock at `hold` seconds after the entry, whatever `now` says", () => {
    const engine = new SceneStateEngine(table, "LISTENING", false);
    engine.update(0, 0);
    engine.set("THINKING", 1000);
    expect(engine.update(999_999, 0, 0).coreIntensity).toBeCloseTo(1, 12);
    expect(engine.update(999_999, 0, 0.3).coreIntensity).toBeCloseTo(2, 12);
    expect(engine.update(0, 0, 10).coreIntensity).toBeCloseTo(3, 12);
  });
});
