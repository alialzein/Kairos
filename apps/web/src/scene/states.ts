/**
 * Seven-state wiring for the Neural Bust scene — the pure half (Ali, 2026-09-08).
 *
 * One state machine drives the scene's look through tweened uniforms: no remounts, no new layers,
 * no geometry or camera changes. LISTENING is frozen as the merged look (`LISTENING_LOOK`), and
 * every other state is a delta from it expressed in the knobs of `SceneLook` — nothing else moves.
 *
 * This module is deliberately three-free (it is imported by the DOM HUD and by node tests): the
 * colour helper below is the same sRGB → linear curve three's `Color` applies, so
 * `linearRgb(palette.core)` equals `new Color(palette.core)` channel for channel (asserted in
 * states.test.ts).
 *
 * Note on `?set=`: `LISTENING_LOOK` is computed from `sceneConfig` at module load, which on the
 * bench happens BEFORE `applyOverrides` runs — so the three knobs it captures (`core.pulseSpeed`,
 * `motion.ringBreath.period`, `palette.core`) would otherwise be stale. `SceneStateDriver` calls
 * `copyLook(listeningLook(), SCENE_STATES.LISTENING.look)` at mount to re-derive the identity row
 * from the live config; the other six rows hold absolute values Ali wrote by hand, so `?set=` does
 * not move them (it never moved a hand-written number either).
 */
import { AvatarState } from "@twin/shared";
import { sceneConfig, type SceneConfig } from "./sceneConfig";

/** The scene's state names are the avatar's — one machine, two renderers (`@twin/shared`). */
export type SceneStateName = AvatarState;

/**
 * The absolute look of one state. Colours are linear rgb; every other field is either a period in
 * seconds, a 0..1 fraction, or a MULTIPLIER on the sceneConfig value named in its comment — so
 * `LISTENING_LOOK` (all multipliers 1) reproduces the merged scene exactly.
 */
export interface SceneLook {
  /** linear rgb — the face core's colour (contour core tint + glow sprite) */
  coreColor: [number, number, number];
  /** × on the glow sprite colour and the contour core tint */
  coreIntensity: number;
  /** seconds per core pulse (LISTENING: 2π / `core.pulseSpeed`) */
  corePulsePeriod: number;
  /** × on `core.pulseAmount` */
  corePulseAmount: number;
  /** × on `motion.ringBreath.amount` */
  ringBreathAmount: number;
  /** seconds per ring breath (LISTENING: `motion.ringBreath.period`) */
  ringBreathPeriod: number;
  /** 0..1 visible share of the crown plume's particles */
  plumeFraction: number;
  /** × on the plume rise rate */
  plumeSpeed: number;
  /** × on `motion.neckPulse.speed` */
  neckPulseSpeed: number;
  /** × on the neck bead / nucleus colour */
  neckBrightness: number;
  /** × on `contours.scrollSpeed` */
  contourScroll: number;
  /** × on the landscape gold colour */
  goldBrightness: number;
  /** × on `dust.ambient.drift.amount` */
  dustDrift: number;
}

/** Every numeric field of `SceneLook` (i.e. all but the colour) — what tweens and what energy adds to. */
export type NumericLookKey = Exclude<keyof SceneLook, "coreColor">;

/**
 * One state's row. `look` is where the state settles; the optional fields shape how it gets there:
 * - `freezeMs` (OFFLINE): hold the look the state was entered from, with every RATE field at 0, for
 *   this long — then tween from that frozen look.
 * - `sequenceMs` + `sequence` (WAKING): a one-shot curve. `out` arrives pre-filled with `look`, so a
 *   sequence may write only the fields it animates; at t01 = 1 an empty sequence leaves `look`.
 * - `energy` (SPEAKING): after the tween/sequence, `look[k] += energy[k] · energyMid`, clamped ≥ 0.
 *   Numeric keys only — the colour is not energy-modulated (a deviation from the sketch's
 *   `keyof SceneLook`, which would not type-check against the rgb tuple).
 */
export interface SceneStateSpec {
  look: SceneLook;
  /** `dot` is a hex colour; `pulse` toggles the HUD dot's CSS pulse */
  hud: { text: string; dot: string; pulse: boolean };
  /** tween into this state, ms (≤ 600 by Ali's rule, except WAKING's settle) */
  inMs: number;
  /** OFFLINE: freeze the current look with every rate at 0 for this long before the tween */
  freezeMs?: number;
  /** WAKING: while t < sequenceMs the look comes from `sequence` */
  sequenceMs?: number;
  /** writes in place into `out` (pre-filled with `look`); called once per frame, may not allocate */
  sequence?: (t01: number, out: SceneLook) => void;
  /** SPEAKING: per-field gain × the avatar store's `energy.mid` */
  energy?: Partial<Record<NumericLookKey, number>>;
}

/** Every numeric field of `SceneLook`, in declaration order. The engine walks this instead of
 *  `Object.keys` so no iteration allocates. states.test.ts asserts it stays exhaustive. */
export const LOOK_NUMBER_KEYS = [
  "coreIntensity",
  "corePulsePeriod",
  "corePulseAmount",
  "ringBreathAmount",
  "ringBreathPeriod",
  "plumeFraction",
  "plumeSpeed",
  "neckPulseSpeed",
  "neckBrightness",
  "contourScroll",
  "goldBrightness",
  "dustDrift",
] as const satisfies readonly NumericLookKey[];

/** The fields `freezeMs` drops to 0: everything that makes something move. */
export const LOOK_RATE_KEYS = [
  "corePulseAmount",
  "ringBreathAmount",
  "plumeSpeed",
  "neckPulseSpeed",
  "contourScroll",
  "dustDrift",
] as const satisfies readonly NumericLookKey[];

/** three's `SRGBToLinear` (ColorManagement.js), so a hex here matches `new Color(hex)` exactly. */
function srgbToLinear(c: number): number {
  return c < 0.04045 ? c * 0.0773993808 : Math.pow(c * 0.9478672986 + 0.0521327014, 2.4);
}

/** `#RRGGBB` → linear rgb, the conversion three's `Color` does on construction. */
export function linearRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  return [
    srgbToLinear(((n >> 16) & 255) / 255),
    srgbToLinear(((n >> 8) & 255) / 255),
    srgbToLinear((n & 255) / 255),
  ];
}

/** The merged scene, as a look: every multiplier 1, the periods and the colour read from config. */
export function listeningLook(cfg: SceneConfig = sceneConfig): SceneLook {
  return {
    coreColor: linearRgb(cfg.palette.core),
    coreIntensity: 1,
    corePulsePeriod: (Math.PI * 2) / cfg.core.pulseSpeed,
    corePulseAmount: 1,
    ringBreathAmount: 1,
    ringBreathPeriod: cfg.motion.ringBreath.period,
    plumeFraction: 1,
    plumeSpeed: 1,
    neckPulseSpeed: 1,
    neckBrightness: 1,
    contourScroll: 1,
    goldBrightness: 1,
    dustDrift: 1,
  };
}

/** The identity row: LISTENING is the look the scene shipped with (docs/plans/scene-plan.md). */
export const LISTENING_LOOK: SceneLook = listeningLook();

export function cloneLook(look: Readonly<SceneLook>): SceneLook {
  return { ...look, coreColor: [look.coreColor[0], look.coreColor[1], look.coreColor[2]] };
}

/** Field-by-field copy into an existing object — the allocation-free half of `cloneLook`. */
export function copyLook(from: Readonly<SceneLook>, to: SceneLook): void {
  to.coreColor[0] = from.coreColor[0];
  to.coreColor[1] = from.coreColor[1];
  to.coreColor[2] = from.coreColor[2];
  for (const key of LOOK_NUMBER_KEYS) to[key] = from[key];
}

/** Ali's transition curve: ease-in-out cubic over the tween. */
export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** `out = a + (b − a)·k`, per field and per colour channel. Allocation-free. The ends are copied
 *  rather than interpolated, so a settled state is EXACTLY its row's values (`a + (b − a)·1` is
 *  not b in binary floating point) — which is what makes LISTENING the exact identity. */
export function lerpLook(
  a: Readonly<SceneLook>,
  b: Readonly<SceneLook>,
  k: number,
  out: SceneLook,
): void {
  if (k <= 0) return copyLook(a, out);
  if (k >= 1) return copyLook(b, out);
  out.coreColor[0] = a.coreColor[0] + (b.coreColor[0] - a.coreColor[0]) * k;
  out.coreColor[1] = a.coreColor[1] + (b.coreColor[1] - a.coreColor[1]) * k;
  out.coreColor[2] = a.coreColor[2] + (b.coreColor[2] - a.coreColor[2]) * k;
  for (const key of LOOK_NUMBER_KEYS) out[key] = a[key] + (b[key] - a[key]) * k;
}

/** The canonical order — the `AvatarState` enum's, so the bench cycles states the way docs/06 lists them. */
export const STATE_ORDER: readonly SceneStateName[] = AvatarState.options;

/** Ali's bench demo loop (`?demo=1`), 5 s per step, looping. */
export const DEMO_SEQUENCE: readonly SceneStateName[] = [
  "DORMANT",
  "WAKING",
  "LISTENING",
  "THINKING",
  "SPEAKING",
  "IDLE",
  "OFFLINE",
  "IDLE",
];
export const DEMO_STEP_MS = 5000;

/** Every state's placeholder row: LISTENING's look, its own HUD text, a 600 ms tween. The six
 *  non-LISTENING rows are Ali's to write (one commit each) — the schema above already carries
 *  everything they need (freeze, sequence, energy). */
function baseSpec(name: SceneStateName): SceneStateSpec {
  return {
    look: cloneLook(LISTENING_LOOK),
    hud: { text: `STATUS: ${name}`, dot: sceneConfig.palette.line, pulse: true },
    inMs: 600,
  };
}

/** A delta row: LISTENING's look with the named fields replaced (Ali's Step A table, approved
 *  2026-09-08 with three changes — see docs/plans/scene-log.md "Seven-state wiring"). */
function delta(
  hex: string,
  fields: Partial<Omit<SceneLook, "coreColor">>,
  hud: SceneStateSpec["hud"],
  rest: Omit<SceneStateSpec, "look" | "hud"> = { inMs: 600 },
): SceneStateSpec {
  return { look: { ...LISTENING_LOOK, ...fields, coreColor: linearRgb(hex) }, hud, ...rest };
}

const WAKE_FROM = linearRgb("#0A3D7A"); // DORMANT's core
const WAKE_PEAK = linearRgb("#FFE2B0"); // palette.coreHot

export const SCENE_STATES: Record<SceneStateName, SceneStateSpec> = {
  // DORMANT — page load, or IDLE after 90 s: a sleeping core, deep blue, everything at rest
  DORMANT: delta(
    "#0A3D7A",
    {
      coreIntensity: 0.3,
      corePulsePeriod: 6,
      ringBreathAmount: 0,
      plumeFraction: 0.2,
      plumeSpeed: 0.5,
      neckPulseSpeed: 0,
      neckBrightness: 0.4,
      contourScroll: 0,
      goldBrightness: 0.4,
      dustDrift: 0.5,
    },
    { text: "STATUS: DORMANT", dot: "#0A3D7A", pulse: false },
  ),
  // IDLE — after a turn, or recovery: "warm but resting" (Ali: dim amber, core ×0.45, 6 s breath)
  IDLE: delta(
    "#C97F3A",
    {
      coreIntensity: 0.45,
      corePulsePeriod: 4,
      ringBreathPeriod: 6,
      plumeFraction: 0.6,
      plumeSpeed: 0.7,
      neckPulseSpeed: 0.5,
      contourScroll: 0.5,
      goldBrightness: 0.8,
    },
    { text: "STATUS: IDLE", dot: sceneConfig.palette.line, pulse: false },
  ),
  // WAKING — the 1.2 s one-shot (v2's WAKING_DURATION_S): the core flares from DORMANT's deep
  // blue to white-hot at 0.6 s and settles to LISTENING's orange; every rate runs high for the
  // whole sequence (the nerves light up first, the contour lines sweep upward ×6), then the
  // normal 600 ms LISTENING-in tween brings them down. Reduced motion: evaluated at the end.
  WAKING: delta(
    sceneConfig.palette.core,
    {
      corePulsePeriod: 0.6,
      ringBreathAmount: 3,
      plumeFraction: 1, // Ali's ×1.5: capped — the plume is built at LISTENING's count
      plumeSpeed: 2,
      neckPulseSpeed: 4,
      neckBrightness: 1.5,
      contourScroll: 6,
      goldBrightness: 1.3,
      dustDrift: 2,
    },
    { text: "STATUS: WAKING", dot: "#FFFFFF", pulse: true },
    {
      inMs: 0,
      sequenceMs: 1200,
      sequence: (t01, out) => {
        // 0 → 0.5: deep blue → white-hot, intensity 0.3 → 2.0; 0.5 → 1: → orange, intensity 1
        const up = t01 < 0.5;
        const k = easeInOutCubic(up ? t01 * 2 : (t01 - 0.5) * 2);
        const a = up ? WAKE_FROM : WAKE_PEAK;
        const b = up ? WAKE_PEAK : LISTENING_LOOK.coreColor;
        out.coreColor[0] = a[0] + (b[0] - a[0]) * k;
        out.coreColor[1] = a[1] + (b[1] - a[1]) * k;
        out.coreColor[2] = a[2] + (b[2] - a[2]) * k;
        out.coreIntensity = up ? 0.3 + 1.7 * k : 2 - k;
      },
    },
  ),
  // the identity row: `sceneConfig.hud.text` is the LISTENING readout the scene shipped with
  LISTENING: {
    ...baseSpec("LISTENING"),
    hud: { text: sceneConfig.hud.text, dot: sceneConfig.palette.line, pulse: true },
  },
  // THINKING — a turn is being worked on: amber core throbbing at 1.2 s, signals running to
  // the nucleus, faster breath / scroll / drift
  THINKING: delta(
    "#FFB347",
    {
      coreIntensity: 1.3,
      corePulsePeriod: 1.2,
      corePulseAmount: 2,
      ringBreathAmount: 1.5,
      ringBreathPeriod: 3,
      plumeSpeed: 1.5,
      neckPulseSpeed: 3,
      neckBrightness: 1.3,
      contourScroll: 2,
      goldBrightness: 1.2,
      dustDrift: 1.5,
    },
    { text: "STATUS: THINKING", dot: "#FFB347", pulse: true },
    { inMs: 500 },
  ),
  // SPEAKING — hot core doing what v2's jaw did: intensity, ring breath and the nerves ride the
  // avatar store's energy.mid (0 on the bench unless ?demo=1 feeds the synthetic phrases)
  SPEAKING: delta(
    "#FF7A1A",
    {
      coreIntensity: 1.2,
      corePulsePeriod: 2,
      plumeFraction: 1, // Ali's ×1.3: capped — the plume is built at LISTENING's count
      plumeSpeed: 1.3,
      neckPulseSpeed: 2,
      contourScroll: 1.5,
      goldBrightness: 1.1,
      dustDrift: 1.2,
    },
    { text: "STATUS: SPEAKING", dot: "#FF7A1A", pulse: true },
    { inMs: 400, energy: { coreIntensity: 0.8, ringBreathAmount: 1, neckBrightness: 1 } },
  ),
  OFFLINE: baseSpec("OFFLINE"),
};

/**
 * The blended look of the current frame, published by `SceneStateDriver` for the consumers that
 * cannot read a TSL uniform: the layers that animate in JS (Rings' scale, NeckCircuit's dash
 * offset) and the bench's `window.__twinScene`. Written in place — one object for the life of the
 * page — and READ ONLY for everyone but the driver.
 */
export const currentLook: SceneLook = cloneLook(LISTENING_LOOK);

/**
 * The state machine as the scene sees it: one reusable `SceneLook` blended every frame.
 *
 * Allocation-free after construction — `update()` returns the engine's own object, which the
 * caller may read but must never keep a reference to across frames expecting it to hold still.
 *
 * Transitions are an ease-in-out cubic over `inMs` from the look the engine was showing when
 * `set()` was called (not from the previous state's settled look — interrupting a tween never
 * jumps). Reduced motion collapses `inMs` and `freezeMs` to 0 and evaluates sequences at their
 * end; the flicker-free still comes from the driver freezing the phases, not from this class.
 */
export class SceneStateEngine {
  private readonly specs: Record<SceneStateName, SceneStateSpec>;
  private readonly reduced: boolean;
  /** the blended look this frame — reused, never reallocated */
  private readonly currentLook: SceneLook;
  /** the look `set()` captured: the tween's source */
  private readonly fromLook: SceneLook;
  /** `fromLook` with every rate at 0: what OFFLINE's `freezeMs` holds, and the tween's source after it */
  private readonly frozenLook: SceneLook;
  private startMs = 0;
  /** the first `update()` stamps the entry time — the initial state plays its sequence/freeze too */
  private armed = false;
  private currentState: SceneStateName;
  private currentSpec: SceneStateSpec;

  constructor(
    specs: Record<SceneStateName, SceneStateSpec>,
    initial: SceneStateName,
    reducedMotion: boolean,
  ) {
    this.specs = specs;
    this.reduced = reducedMotion;
    this.currentState = initial;
    this.currentSpec = specs[initial];
    this.currentLook = cloneLook(this.currentSpec.look);
    this.fromLook = cloneLook(this.currentSpec.look);
    this.frozenLook = cloneLook(this.currentSpec.look);
    this.enter();
  }

  get state(): SceneStateName {
    return this.currentState;
  }
  get spec(): SceneStateSpec {
    return this.currentSpec;
  }

  /** Records the transition: from = the look showing right now, to = the new spec's look. */
  set(state: SceneStateName, nowMs: number): void {
    this.currentState = state;
    this.currentSpec = this.specs[state];
    this.startMs = nowMs;
    this.armed = true;
    this.enter();
  }

  /** Captures the tween source and, for a freezing state, the all-rates-0 hold. */
  private enter(): void {
    copyLook(this.currentLook, this.fromLook);
    copyLook(this.fromLook, this.frozenLook);
    if (this.freezeMs() > 0) for (const key of LOOK_RATE_KEYS) this.frozenLook[key] = 0;
  }

  private freezeMs(): number {
    return this.reduced ? 0 : (this.currentSpec.freezeMs ?? 0);
  }

  /**
   * The look for this frame. `holdSeconds` pins the clock at that many seconds after the state
   * was entered (bench `?hold=`, for stills); otherwise the clock is `nowMs − entry`.
   */
  update(nowMs: number, energyMid: number, holdSeconds?: number): Readonly<SceneLook> {
    if (!this.armed) {
      this.startMs = nowMs;
      this.armed = true;
    }
    const spec = this.currentSpec;
    const look = this.currentLook;
    const elapsed =
      holdSeconds === undefined
        ? Math.max(0, nowMs - this.startMs)
        : Math.max(0, holdSeconds * 1000);

    if (spec.sequence && spec.sequenceMs !== undefined && spec.sequenceMs > 0) {
      copyLook(spec.look, look);
      spec.sequence(this.reduced ? 1 : Math.min(1, elapsed / spec.sequenceMs), look);
    } else {
      const freeze = this.freezeMs();
      if (elapsed < freeze) {
        copyLook(this.frozenLook, look);
      } else {
        const inMs = this.reduced ? 0 : spec.inMs;
        const from = freeze > 0 ? this.frozenLook : this.fromLook;
        const k = inMs > 0 ? easeInOutCubic(Math.min(1, (elapsed - freeze) / inMs)) : 1;
        lerpLook(from, spec.look, k, look);
      }
    }

    if (spec.energy) {
      for (const key of LOOK_NUMBER_KEYS) {
        const gain = spec.energy[key];
        if (gain !== undefined) look[key] = Math.max(0, look[key] + gain * energyMid);
      }
    }
    // Ali: "no flicker anywhere" under reduced motion — the driver never advances `pulsePhase`
    // there (sin 0 = 0), so the amplitude stays and the still core renders exactly as the merged
    // still scene did (1 − pulseAmount); OFFLINE's 0.5 s alarm becomes a steady red the same way
    return look;
  }
}
