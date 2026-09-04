# Phase B5 — Avatar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The GPU-particle humanoid from `docs/06-avatar-spec.md` renders in `apps/web` on WebGPU (WebGL fallback), morphs through the seven Avatar States driven by `TurnEvent`s and audio energy, has a tuning playground, sits as the hero of the owner home page with a demo driver (real turns arrive in Phase A2), and is guarded by a frame-time test in CI.

**Architecture:** Shape targets (humanoid bust, orb, nebula, ring, core, spine, waves) are generated once on the client as seeded `Float32Array`s and uploaded to GPU storage buffers. A TSL compute kernel integrates every particle each frame: spring toward the morph-mixed target, noise flow scaled by turbulence, state forces (vortex, pointer, audio) — one `Sprite` draw call with additive `SpriteNodeMaterial`, one for background waves, one post pass (bloom, chromatic aberration on WAKING, vignette) through `RenderPipeline`. A pure state machine plus a zustand store owns Avatar State, tier, energy and pointer; React Three Fiber v9 hosts the `WebGPURenderer` via its async `gl` factory. Everything is stage-agnostic and runs on the laptop.

**Tech Stack:** three 0.185.1 (`three/webgpu`, `three/tsl`, `three/addons`) · @types/three 0.185.4 · @react-three/fiber 9.7.0 · zustand 5.0.15 · leva 0.10.1 (playground only) · @gltf-transform/core (bust build script) · @playwright/test 1.62.1 · Vitest 4 · Next.js 16.3 · React 19.2 · TypeScript 5.9 strict · Tailwind 4.

**Spec:** `docs/06-avatar-spec.md` (all sections) · `docs/11-roadmap.md` Phase B5 table + exit gate · `packages/shared/src/{avatar,turn}.ts` (contracts) · `docs/12-repo-and-tooling.md` §5 conventions · `docs/adr/0007-avatar-form.md`, `docs/adr/0014-home-stage.md` · Ali's answers of 2026-09-04 (Q6 = Avatar always dark; bust = open-license GLB; full B5 with a demo driver; Mid tier judged on a mid-range Android).

## Global Constraints

Copied from the specs; every task implicitly includes these.

- Stack does not drift (`CLAUDE.md` §4): Next.js App Router · React 19 · TypeScript `strict` · Tailwind + CSS tokens · React Three Fiber v9 · `three/webgpu` + TSL · Zustand. No `@react-three/drei`, no `postprocessing` package, no GLSL strings: every shader is TSL.
- TypeScript: `strict`, no `any` without a comment, ESLint + Prettier clean. `pnpm format` after every task. Vitest stays `environment: node`; UI behaviour is tested with Playwright (decision D12).
- Performance rules (`docs/06` §7): one draw call for the main cloud, one for waves, one post pass; `devicePixelRatio` capped at 1.5 on mobile and 2 on desktop; simulation pauses when the tab is hidden; reduced-motion users get the Low tier (20k particles, one static frame).
- Tiers (`docs/06` §1): Ultra 400k / High 150k / Mid 60k / Low 20k particles; targets 60 / 60 / 30 fps.
- Avatar State values come only from `@twin/shared` (`AvatarState` enum). The state table lives in `packages/config/src/avatar.ts`; shaders read uniforms, never the table.
- Design tokens (`docs/06` §5, already in `apps/web/src/app/globals.css`): `--twin-bg #05070d`, `--twin-particle #2f9bff`, `--twin-particle-deep #0a3d7a`, `--twin-core #ffb347`, `--twin-core-hot #ff7a1a`, `--twin-spine-from #ffd28a → --twin-spine-to #2f9bff`, `--twin-halo rgba(80,160,255,0.35)`, `--twin-offline #ff4d4d`. The Avatar is always dark (Q6 resolved): the avatar section carries `data-theme="dark"`.
- Privacy: nothing in B5 touches `corpus/`; the bust mesh is a CC0 asset with its licence file next to it.
- Conventional commits; every task ends with real command output pasted in the PR body (`CLAUDE.md` §2). Branch per task `b5-NN-<name>`, PR to `main`, CI green, squash-merge (`docs/12` §5, decision D1).
- Service ports and auth are unchanged. The owner home page and `/dev/avatar` stay behind the Owner check; only `/bench/avatar` is public (decision D6) and it renders no persona or user data.

## Decisions made by this plan (approved by Ali on 2026-09-04 unless marked "ruling")

| # | Decision | Why |
|---|---|---|
| D1 | Branch per task (`b5-01-foundations` …), PR, CI green, squash-merge by the controlling agent. | `docs/12` §5; Phase 0's D1 said branches start at A1/B5. |
| D2 | Humanoid bust = MakeHuman base mesh (CC0 1.0, `makehuman/license.txt` §C), pinned to commit `3c701a8e52f09e69922e8b598d23be2d7dfc49e3`, cropped to head + neck + shoulders by `scripts/build-bust.ts` and committed as `apps/web/public/avatar/bust.glb` with `bust.LICENSE.txt` and `bust.json`. | Ali chose an open-licence GLB; MakeHuman is the only widely used CC0 human base mesh with a direct download. |
| D3 | Point targets are computed on the client at start-up from the GLB with a seeded PRNG (ruling). | Shipping 400k-point binaries per shape would add ~30 MB to the repo; sampling 400k points takes well under a second. |
| D4 | Every shape target lives in its own GPU storage buffer, uploaded once; the kernel selects shape A/B by uniform ids. CORE (5 %) and SPINE (2 %) particles occupy fixed index ranges at the front of every buffer; WAVES is a separate sprite system (ruling). | Matches `docs/06` §2 ("all targets precomputed … sub-systems"); no per-transition uploads. |
| D5 | Motion = spring toward the morph target + noise flow × turbulence + state forces, integrated on velocity (ruling). | Gives the "liveliness" the spec asks for and makes tweens inherent; `mix + curl noise + forces` from `docs/06` §2. |
| D6 | Public route `/bench/avatar` (canvas only, query-driven) for Playwright perf and E2E; `/dev/avatar` stays owner-only (ruling). | CI has no Supabase session; the bench page exposes nothing private. |
| D7 | Q6 resolved: the Avatar is always dark; light theme applies to dashboard chrome only. | Ali's answer. |
| D8 | Pointer repulsion, click-to-wake and long-press attract ship in B5; pinch-zoom and double-tap reset move to Phase B7 (ruling). | Mobile gestures belong with the mobile phase. |
| D9 | Perf CI runs Chromium on SwiftShader and gates on regression against a committed CI baseline (> 15 % slower p95 fails, per-backend); absolute fps targets are checked by hand on the laptop (desktop) and Ali's phone (gate items). | GitHub runners have no GPU; absolute numbers there mean nothing. |
| D10 | No drei; R3F + three only. Leva only inside `/dev/avatar` (ruling). | Fewer moving parts on the WebGPU path. |
| D11 | Tier = signals → candidate tier → 2 s FPS probe → maybe one step down; `?tier=` overrides; nothing cached (ruling). | Simple and honest on every load. |
| D12 | Vitest stays node-only; component behaviour is covered by Playwright on `/bench/avatar` (ruling). | Avoids a jsdom + WebGPU mocking layer that would test nothing real. |
| D13 | The WAKING sound cue is synthesised with WebAudio (no audio asset) (ruling). | No asset, no licence, plays only after a user gesture. |
| D14 | Frame-time p50/p95 live in the store and the playground; "reported to the dashboard" waits for the A2 dashboard (ruling). | There is no dashboard yet. |

## Prerequisites (already true on the laptop)

- Node 24, pnpm 11, Chrome 151 (WebGPU on Windows), the repo at `main` ≥ `e3f3314`.
- `pnpm install --frozen-lockfile` green; `pnpm dev` serves `http://localhost:3000` (Supabase is not needed for `/bench/avatar`).
- Playwright browsers are installed in Task 5 (`pnpm --filter @twin/web exec playwright install chromium`).

## File map (created by this plan)

```
packages/config/src/avatar.ts                      state table, tiers, tween constants   (+ avatar.test.ts)
apps/web/src/avatar/
  tier.ts                                          tier signals, probe evaluation        (+ tier.test.ts)
  telemetry/frametime.ts                           rolling p50/p95                       (+ frametime.test.ts)
  sim/random.ts                                    mulberry32 + helpers                  (+ random.test.ts)
  sim/noise.ts                                     simplex 3D + curl                     (+ noise.test.ts)
  sim/sampler.ts                                   surface sampling + regions            (+ sampler.test.ts)
  sim/canonical.ts                                 bust normalisation + anchors          (+ canonical.test.ts)
  sim/targets/{orb,nebula,ring,core,spine,waves,humanoid,index}.ts   (+ targets.test.ts snapshots)
  sim/bust.ts                                      browser GLB loader → {positions, indices}
  sim/easing.ts, sim/morph.ts                      easing curves, morph tween            (+ tests)
  sim/uniforms.ts                                  SimUniforms (TSL uniform nodes + setter)
  sim/compute.ts                                   buffers, init/update kernels, sprite material
  sim/wavesSystem.ts                               background waves sprite
  state/machine.ts                                 transition(), fromTurnEvent()         (+ machine.test.ts)
  state/store.ts                                   zustand store
  useAvatarState.ts                                timers hook (WAKING 1.2 s, IDLE 90 s)
  audio/energy.ts                                  band energy + smoothing               (+ energy.test.ts)
  audio/synth.ts                                   synthetic speech envelope             (+ synth.test.ts)
  audio/analyser.ts                                WebAudio AnalyserNode wrapper
  audio/cue.ts                                     wake chime
  post/pipeline.ts                                 RenderPipeline: bloom, aberration, vignette
  AvatarCanvas.tsx                                 R3F Canvas + WebGPU renderer + ParticleSystem
  AvatarStage.tsx                                  hero: canvas, status ring, ribbon, drawer, demo driver
  demo/driver.ts                                   runDemoTurn()                         (+ driver.test.ts)
  index.ts
apps/web/src/app/bench/avatar/page.tsx + BenchAvatar.tsx      public bench page (D6)
apps/web/src/app/(owner)/dev/avatar/page.tsx + DevAvatar.tsx  playground (Leva)
apps/web/src/app/(owner)/page.tsx                             owner home = AvatarStage
apps/web/public/avatar/{bust.glb, bust.LICENSE.txt, bust.json}
apps/web/tests/{perf/avatar.spec.ts, perf/baseline.ci.json, e2e/avatar-demo.spec.ts}
apps/web/playwright.config.ts
scripts/build-bust.ts (+ scripts/lib/obj.ts + scripts/lib/obj.test.ts)
.github/workflows/ci.yml                            new `avatar` job
docs: docs/13 (Q6), CONTEXT.md (Tier, Bench page, Demo turn), docs/runbooks/local-dev.md (playground), STATUS.md
```

---

### Task 1 (B5 foundations): dependencies, state table, tier logic, frame telemetry

**Branch:** `b5-01-foundations`

**Files:**
- Modify: `apps/web/package.json` (dependencies), `apps/web/next.config.ts`, `packages/config/package.json`, `packages/config/src/index.ts`, `.gitignore`
- Create: `packages/config/src/avatar.ts`, `packages/config/src/avatar.test.ts`
- Create: `apps/web/src/avatar/tier.ts`, `apps/web/src/avatar/tier.test.ts`
- Create: `apps/web/src/avatar/telemetry/frametime.ts`, `apps/web/src/avatar/telemetry/frametime.test.ts`
- Modify: `docs/13-open-questions.md` (Q6 resolved), `CONTEXT.md` (Tier, Bench page, Demo turn)

**Interfaces:**
- Consumes: `AvatarState` from `@twin/shared`.
- Produces: `AVATAR_STATES: Record<AvatarState, StateParams>`, `SHAPES`, `Shape`, `TIERS: Record<Tier, TierParams>`, `Tier`, `WAKING_DURATION_S = 1.2`, `IDLE_TIMEOUT_S = 90`, `ROLE_SPLIT = { core: 0.05, spine: 0.02 }` (from `@twin/config`); `baseTier(signals)`, `stepDown(tier)`, `tierFromProbe(candidate, p95Ms)`, `parseTierOverride(search)`, `readSignals(nav, win)` (from `@/avatar/tier`); `FrameStats` (from `@/avatar/telemetry/frametime`).

- [ ] **Step 1: Branch and dependencies**

```powershell
git switch -c b5-01-foundations main
pnpm --filter @twin/web add three@0.185.1 @react-three/fiber@9.7.0 zustand@5.0.15
pnpm --filter @twin/web add -D @types/three@0.185.4 leva@0.10.1 @playwright/test@1.62.1
pnpm --filter @twin/config add @twin/shared@workspace:*
```

Expected: `pnpm-lock.yaml` updated; `pnpm install --frozen-lockfile` exits 0. Then in `apps/web/next.config.ts` add `transpilePackages: ["@twin/shared", "@twin/config", "three"]` (three's `addons` and `webgpu` entry points are ESM and Turbopack must transpile them). Append to `.gitignore`:

```
# playwright
apps/web/test-results/
apps/web/playwright-report/
apps/web/blob-report/
```

- [ ] **Step 2: Failing test for the state table**

`packages/config/src/avatar.test.ts`:

```ts
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
```

- [ ] **Step 3: Run it to see it fail**

Run: `pnpm --filter @twin/config test`
Expected: FAIL — `Cannot find module './avatar'`.

- [ ] **Step 4: Implement the table**

`packages/config/src/avatar.ts`:

```ts
import type { AvatarState } from "@twin/shared";

export const SHAPES = ["HUMANOID", "ORB", "NEBULA", "RING"] as const;
export type Shape = (typeof SHAPES)[number];
export const SHAPE_ID: Record<Shape, number> = { HUMANOID: 0, ORB: 1, NEBULA: 2, RING: 3 };

export type Easing = "linear" | "easeInOutCubic" | "easeOutExpo";

export interface CorePulse {
  /** seconds per pulse */
  period: number;
  /** brightness floor 0..1 */
  min: number;
  /** brightness ceiling 0..1 */
  max: number;
}

export interface StateParams {
  shape: Shape;
  /** 0..1, scales the noise flow (docs/06 §3) */
  turbulence: number;
  /** overall particle brightness multiplier */
  brightness: number;
  corePulse: CorePulse;
  /** RGB multiplier applied to every particle colour */
  tint: [number, number, number];
  /** seconds for the morph into this state (0.4–1.2 s; OFFLINE 2 s) */
  morphDuration: number;
  easing: Easing;
  /** ±scale breathing amplitude (ORB) */
  breathing: number;
  /** 0..1 swirl strength around the head anchor (THINKING) */
  vortex: number;
  /** how much audio energy adds to turbulence */
  audioGain: number;
  /** chromatic aberration amount for the post pass (WAKING) */
  aberration: number;
}

export const AVATAR_STATES: Record<AvatarState, StateParams> = {
  DORMANT: {
    shape: "NEBULA",
    turbulence: 0.15,
    brightness: 0.35,
    corePulse: { period: 6, min: 0.15, max: 0.35 },
    tint: [0.7, 0.8, 1.0],
    morphDuration: 1.2,
    easing: "easeInOutCubic",
    breathing: 0,
    vortex: 0,
    audioGain: 0,
    aberration: 0,
  },
  IDLE: {
    shape: "ORB",
    turbulence: 0.25,
    brightness: 0.7,
    corePulse: { period: 3, min: 0.45, max: 0.75 },
    tint: [1, 1, 1],
    morphDuration: 1.0,
    easing: "easeInOutCubic",
    breathing: 0.03,
    vortex: 0,
    audioGain: 0,
    aberration: 0,
  },
  WAKING: {
    shape: "HUMANOID",
    turbulence: 0.9,
    brightness: 1.25,
    corePulse: { period: 1.2, min: 0.9, max: 1.0 },
    tint: [1.05, 1.1, 1.25],
    morphDuration: 1.2,
    easing: "easeOutExpo",
    breathing: 0,
    vortex: 0,
    audioGain: 0,
    aberration: 1,
  },
  LISTENING: {
    shape: "HUMANOID",
    turbulence: 0.2,
    brightness: 0.9,
    corePulse: { period: 3, min: 0.55, max: 0.85 },
    tint: [1, 1, 1],
    morphDuration: 0.6,
    easing: "easeInOutCubic",
    breathing: 0,
    vortex: 0,
    audioGain: 0.4,
    aberration: 0,
  },
  THINKING: {
    shape: "HUMANOID",
    turbulence: 0.6,
    brightness: 0.95,
    corePulse: { period: 1.2, min: 0.6, max: 1.0 },
    tint: [1.0, 0.95, 0.9],
    morphDuration: 0.5,
    easing: "easeInOutCubic",
    breathing: 0,
    vortex: 1,
    audioGain: 0,
    aberration: 0,
  },
  SPEAKING: {
    shape: "HUMANOID",
    turbulence: 0.3,
    brightness: 1.0,
    corePulse: { period: 2, min: 0.7, max: 1.0 },
    tint: [1, 1, 1],
    morphDuration: 0.4,
    easing: "easeInOutCubic",
    breathing: 0,
    vortex: 0,
    audioGain: 0.5,
    aberration: 0,
  },
  OFFLINE: {
    shape: "NEBULA",
    turbulence: 0.8,
    brightness: 0.5,
    corePulse: { period: 0.5, min: 0.15, max: 0.5 },
    tint: [1.0, 0.45, 0.45],
    morphDuration: 2.0,
    easing: "easeInOutCubic",
    breathing: 0,
    vortex: 0,
    audioGain: 0,
    aberration: 0,
  },
};

export type Tier = "ultra" | "high" | "mid" | "low";
export interface TierParams {
  particles: number;
  /** particle count of the background waves system (0 = off) */
  waves: number;
  bloom: "full" | "cheap" | "off";
  /** 0 = render one static frame (reduced motion) */
  targetFps: number;
  /** devicePixelRatio cap (docs/06 §7) */
  dprCap: number;
}
export const TIERS: Record<Tier, TierParams> = {
  ultra: { particles: 400_000, waves: 60_000, bloom: "full", targetFps: 60, dprCap: 2 },
  high: { particles: 150_000, waves: 40_000, bloom: "full", targetFps: 60, dprCap: 2 },
  mid: { particles: 60_000, waves: 15_000, bloom: "cheap", targetFps: 30, dprCap: 1.5 },
  low: { particles: 20_000, waves: 0, bloom: "off", targetFps: 0, dprCap: 1 },
};
export const TIER_ORDER: readonly Tier[] = ["ultra", "high", "mid", "low"];

export const WAKING_DURATION_S = 1.2;
export const IDLE_TIMEOUT_S = 90;
/** fraction of particles reserved for the CORE and SPINE sub-systems (docs/06 §2) */
export const ROLE_SPLIT = { core: 0.05, spine: 0.02 } as const;
```

Add to `packages/config/src/index.ts`:

```ts
export * from "./avatar";
```

- [ ] **Step 5: Run the config tests**

Run: `pnpm --filter @twin/config test`
Expected: PASS (existing identity tests + 4 new).

- [ ] **Step 6: Failing tests for tier logic**

`apps/web/src/avatar/tier.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { baseTier, frameBudgetMs, parseTierOverride, stepDown, tierFromProbe } from "./tier";

describe("baseTier", () => {
  const desktop = { webgpu: true, mobile: false, reducedMotion: false };
  it("desktop WebGPU → ultra, desktop WebGL → high", () => {
    expect(baseTier(desktop)).toBe("ultra");
    expect(baseTier({ ...desktop, webgpu: false })).toBe("high");
  });
  it("mobile WebGPU → high, mobile WebGL → mid", () => {
    expect(baseTier({ ...desktop, mobile: true })).toBe("high");
    expect(baseTier({ ...desktop, mobile: true, webgpu: false })).toBe("mid");
  });
  it("low device memory caps at mid; low battery steps down once", () => {
    expect(baseTier({ ...desktop, deviceMemory: 4 })).toBe("mid");
    expect(baseTier({ ...desktop, batteryLow: true })).toBe("high");
    expect(baseTier({ ...desktop, mobile: true, webgpu: false, batteryLow: true })).toBe("low");
  });
  it("reduced motion always → low", () => {
    expect(baseTier({ ...desktop, reducedMotion: true })).toBe("low");
  });
});

describe("stepDown / probe", () => {
  it("steps one tier and stops at low", () => {
    expect(stepDown("ultra")).toBe("high");
    expect(stepDown("low")).toBe("low");
  });
  it("keeps the tier when p95 is within 125 % of the budget, else steps down once", () => {
    expect(frameBudgetMs("ultra")).toBeCloseTo(16.67, 1);
    expect(frameBudgetMs("mid")).toBeCloseTo(33.33, 1);
    expect(tierFromProbe("ultra", 20)).toBe("ultra");
    expect(tierFromProbe("ultra", 22)).toBe("high");
    expect(tierFromProbe("mid", 45)).toBe("low");
    expect(tierFromProbe("low", 500)).toBe("low");
  });
});

describe("parseTierOverride", () => {
  it("accepts ?tier=<valid>, ignores anything else", () => {
    expect(parseTierOverride("?tier=mid")).toBe("mid");
    expect(parseTierOverride("?x=1&tier=ULTRA")).toBe("ultra");
    expect(parseTierOverride("?tier=potato")).toBeNull();
    expect(parseTierOverride("")).toBeNull();
  });
});
```

- [ ] **Step 7: Run to see it fail**

Run: `pnpm --filter @twin/web test`
Expected: FAIL — `Cannot find module './tier'`.

- [ ] **Step 8: Implement tier.ts**

```ts
import { TIER_ORDER, TIERS, type Tier } from "@twin/config";

export type { Tier };

export interface TierSignals {
  webgpu: boolean;
  mobile: boolean;
  reducedMotion: boolean;
  /** navigator.deviceMemory in GB when the browser exposes it */
  deviceMemory?: number;
  /** battery not charging and below 20 % (docs/06 §7) */
  batteryLow?: boolean;
}

function lower(a: Tier, b: Tier): Tier {
  return TIER_ORDER.indexOf(a) >= TIER_ORDER.indexOf(b) ? a : b;
}

export function stepDown(t: Tier): Tier {
  const i = TIER_ORDER.indexOf(t);
  return TIER_ORDER[Math.min(i + 1, TIER_ORDER.length - 1)] ?? "low";
}

export function baseTier(s: TierSignals): Tier {
  if (s.reducedMotion) return "low";
  let t: Tier = s.webgpu ? (s.mobile ? "high" : "ultra") : s.mobile ? "mid" : "high";
  if (s.deviceMemory !== undefined && s.deviceMemory <= 4) t = lower(t, "mid");
  if (s.batteryLow) t = stepDown(t);
  return t;
}

export function frameBudgetMs(t: Tier): number {
  const fps = TIERS[t].targetFps;
  return fps === 0 ? Number.POSITIVE_INFINITY : 1000 / fps;
}

/** After the 2 s probe: step down once when p95 frame time exceeds 125 % of the budget. */
export function tierFromProbe(candidate: Tier, p95Ms: number): Tier {
  return p95Ms > frameBudgetMs(candidate) * 1.25 ? stepDown(candidate) : candidate;
}

export function parseTierOverride(search: string): Tier | null {
  const v = new URLSearchParams(search).get("tier")?.toLowerCase();
  return v && (TIER_ORDER as readonly string[]).includes(v) ? (v as Tier) : null;
}

/** Browser-only: gather the signals baseTier() needs. Safe to call on any navigator. */
export function readSignals(nav: Navigator, win: Window): TierSignals {
  const mobile = /Android|iPhone|iPad|Mobile/i.test(nav.userAgent);
  const memory = (nav as Navigator & { deviceMemory?: number }).deviceMemory;
  return {
    webgpu: "gpu" in nav,
    mobile,
    reducedMotion: win.matchMedia("(prefers-reduced-motion: reduce)").matches,
    deviceMemory: memory,
  };
}
```

- [ ] **Step 9: Failing test for frame telemetry**

`apps/web/src/avatar/telemetry/frametime.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { FrameStats, percentile } from "./frametime";

describe("percentile", () => {
  it("interpolates on a sorted array", () => {
    expect(percentile([1, 2, 3, 4], 0.5)).toBe(2.5);
    expect(percentile([10], 0.95)).toBe(10);
    expect(percentile([], 0.5)).toBe(0);
  });
});

describe("FrameStats", () => {
  it("keeps a bounded window and reports p50/p95", () => {
    const s = new FrameStats(4);
    [16, 16, 33, 16, 16].forEach((ms) => s.push(ms));
    expect(s.count).toBe(4);
    expect(s.p50).toBe(16);
    expect(s.p95).toBeGreaterThan(16);
    s.reset();
    expect(s.count).toBe(0);
  });
});
```

- [ ] **Step 10: Implement frametime.ts**

```ts
export function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  const w = idx - lo;
  return (sorted[lo] ?? 0) * (1 - w) + (sorted[hi] ?? 0) * w;
}

/** Rolling window of frame times in milliseconds. */
export class FrameStats {
  private readonly buf: number[] = [];
  constructor(private readonly size = 240) {}
  push(ms: number): void {
    this.buf.push(ms);
    if (this.buf.length > this.size) this.buf.shift();
  }
  get count(): number {
    return this.buf.length;
  }
  private sorted(): number[] {
    return [...this.buf].sort((a, b) => a - b);
  }
  get p50(): number {
    return percentile(this.sorted(), 0.5);
  }
  get p95(): number {
    return percentile(this.sorted(), 0.95);
  }
  reset(): void {
    this.buf.length = 0;
  }
}
```

- [ ] **Step 11: Docs**

`docs/13-open-questions.md` — replace the Q6 heading and body with:

```
## Q6 — Light theme for the Avatar — **RESOLVED: (c) Avatar always dark; light theme for dashboard pages only (2026-09-04)**

The avatar section carries `data-theme="dark"` so the tokens under it are always the dark set; dashboard chrome follows the toggle. Plan: `docs/plans/phase-b5.md` Task 8.
```

`CONTEXT.md` — add rows:

```
| **Tier** | The Avatar quality level chosen per device: Ultra, High, Mid or Low (particle count, waves, bloom, target fps). Decided by device signals plus a 2-second frame probe. |
| **Bench page** | `/bench/avatar`: a public page that renders only the Avatar canvas, driven by query parameters, used by the perf and E2E tests. Shows no persona or user data. |
| **Demo turn** | A synthetic Turn (canned reply text + synthetic energy) that drives the Avatar through THINKING → SPEAKING → IDLE until the Brain's `/turn` exists (Phase A2). |
```

- [ ] **Step 12: Verify and commit**

```powershell
pnpm format
pnpm lint
pnpm typecheck
pnpm --filter @twin/config test
pnpm --filter @twin/web test
git add -A
git commit -m "feat(avatar): B5 foundations — three/R3F/zustand deps, state table + tiers in @twin/config, tier logic, frame telemetry, Q6 resolved"
git push -u origin b5-01-foundations
gh pr create --fill --title "B5.0 foundations: deps, state table, tier logic" --body-file - <<'EOF'
(paste the command outputs above)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
```

Expected: all exit 0; PR opened; CI green; controller squash-merges.

---

### Task 2 (B5.2a): bust asset pipeline — MakeHuman base mesh → `bust.glb`

**Branch:** `b5-02-bust`

**Files:**
- Create: `scripts/lib/obj.ts`, `scripts/lib/obj.test.ts`, `scripts/build-bust.ts`
- Create: `apps/web/public/avatar/bust.glb`, `apps/web/public/avatar/bust.LICENSE.txt`, `apps/web/public/avatar/bust.json`
- Modify: root `package.json` (`"build:bust": "tsx scripts/build-bust.ts"`, devDependency `@gltf-transform/core`)

**Interfaces:**
- Produces: `parseObj(text, { group }) → { positions: Float32Array; faces: number[][] }`, `cropByY(mesh, yMin)`, `triangulate(faces) → Uint32Array`, `normalizeBust(positions) → { positions, bounds }` (in `scripts/lib/obj.ts`); the committed `bust.glb` (one mesh, one primitive, POSITION + indices, no materials) and `bust.json` `{ source, commit, licence, yCut, vertices, triangles, bounds: { min: [x,y,z], max: [x,y,z] } }`.

Source facts (checked 2026-09-04): `https://raw.githubusercontent.com/makehumancommunity/makehuman/3c701a8e52f09e69922e8b598d23be2d7dfc49e3/makehuman/data/3dobjs/base.obj` — 19 158 vertices, 18 486 faces (quads, `f v/vt/vn`), groups `body` + `helper-*` + `joint-*`; y spans −8.45 … 8.50 (decimetres, a 1.7 m figure). Licence: `makehuman/license.txt` §C — "The base mesh and proxies … released under CC0 1.0 Universal".

- [ ] **Step 1: Branch + dependency**

```powershell
git switch -c b5-02-bust main
pnpm add -D -w @gltf-transform/core
```

- [ ] **Step 2: Failing tests for the OBJ helpers**

`scripts/lib/obj.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { cropByY, normalizeBust, parseObj, triangulate } from "./obj";

const CUBE = `
g body
v -1 -1 -1
v 1 -1 -1
v 1 1 -1
v -1 1 -1
v -1 -1 1
v 1 -1 1
v 1 1 1
v -1 1 1
f 1/1/1 2/2/2 3/3/3 4/4/4
f 5/1/1 6/2/2 7/3/3 8/4/4
f 1/1/1 5/2/2 8/3/3 4/4/4
g helper-tights
v 0 9 0
v 1 9 0
v 0 9 1
f 9 10 11
`;

describe("parseObj", () => {
  it("keeps only the requested group and re-indexes its vertices", () => {
    const m = parseObj(CUBE, { group: "body" });
    expect(m.positions.length).toBe(8 * 3);
    expect(m.faces).toHaveLength(3);
    expect(m.faces[0]).toEqual([0, 1, 2, 3]);
  });
});

describe("cropByY", () => {
  it("drops faces with any vertex below yMin and compacts vertices", () => {
    const m = parseObj(CUBE, { group: "body" });
    const c = cropByY(m, 0.5);
    expect(c.faces).toHaveLength(0); // every cube face touches y = -1
    const top = cropByY({ positions: m.positions, faces: [[2, 3, 7, 6]] }, 0.5);
    expect(top.faces).toEqual([[0, 1, 2, 3]]);
    expect(top.positions.length).toBe(4 * 3);
  });
});

describe("triangulate", () => {
  it("fans quads into two triangles and keeps triangles", () => {
    expect(Array.from(triangulate([[0, 1, 2, 3], [4, 5, 6]]))).toEqual([0, 1, 2, 0, 2, 3, 4, 5, 6]);
  });
});

describe("normalizeBust", () => {
  it("centres x/z and maps y to [-0.9, 0.9] preserving aspect", () => {
    const pos = new Float32Array([-2, 0, 0, 2, 0, 0, 0, 4, 0, 0, 0, 1]);
    const { positions, bounds } = normalizeBust(pos);
    expect(bounds.max[1]).toBeCloseTo(0.9);
    expect(bounds.min[1]).toBeCloseTo(-0.9);
    expect(positions[0]).toBeCloseTo(-0.9); // x scaled by the same factor as y (4 → 1.8)
    const cx = (bounds.min[0] + bounds.max[0]) / 2;
    expect(cx).toBeCloseTo(0);
  });
});
```

- [ ] **Step 3: Run to see it fail**

Run: `pnpm test:scripts`
Expected: FAIL — `Cannot find module './obj'`.

- [ ] **Step 4: Implement `scripts/lib/obj.ts`**

```ts
export interface ObjMesh {
  positions: Float32Array; // xyz interleaved
  faces: number[][]; // 0-based vertex indices, 3 or 4 per face
}
export interface Bounds {
  min: [number, number, number];
  max: [number, number, number];
}

/** Minimal OBJ reader: `v` and `f` lines, one `g` group kept, other data ignored. */
export function parseObj(text: string, opts: { group: string }): ObjMesh {
  const allVerts: number[] = [];
  const faces: number[][] = [];
  let current = "";
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith("v ")) {
      const [, x, y, z] = line.split(/\s+/);
      allVerts.push(Number(x), Number(y), Number(z));
    } else if (line.startsWith("g ")) {
      current = line.slice(2).trim();
    } else if (line.startsWith("f ") && current === opts.group) {
      faces.push(
        line
          .slice(2)
          .trim()
          .split(/\s+/)
          .map((tok) => Number(tok.split("/")[0]) - 1),
      );
    }
  }
  return compact({ positions: new Float32Array(allVerts), faces });
}

/** Keep only vertices referenced by faces; re-index faces. */
function compact(m: ObjMesh): ObjMesh {
  const map = new Map<number, number>();
  const out: number[] = [];
  const faces = m.faces.map((f) =>
    f.map((vi) => {
      let ni = map.get(vi);
      if (ni === undefined) {
        ni = map.size;
        map.set(vi, ni);
        out.push(m.positions[vi * 3] ?? 0, m.positions[vi * 3 + 1] ?? 0, m.positions[vi * 3 + 2] ?? 0);
      }
      return ni;
    }),
  );
  return { positions: new Float32Array(out), faces };
}

export function cropByY(m: ObjMesh, yMin: number): ObjMesh {
  const keep = m.faces.filter((f) => f.every((vi) => (m.positions[vi * 3 + 1] ?? -Infinity) >= yMin));
  return compact({ positions: m.positions, faces: keep });
}

export function triangulate(faces: number[][]): Uint32Array {
  const out: number[] = [];
  for (const f of faces) {
    for (let i = 1; i + 1 < f.length; i++) out.push(f[0] ?? 0, f[i] ?? 0, f[i + 1] ?? 0);
  }
  return new Uint32Array(out);
}

export function boundsOf(p: Float32Array): Bounds {
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < p.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      const v = p[i + k] ?? 0;
      if (v < (min[k] ?? 0)) min[k] = v;
      if (v > (max[k] ?? 0)) max[k] = v;
    }
  }
  return { min, max };
}

/** Canonical bust space: x/z centred, y mapped to [-0.9, 0.9], uniform scale. */
export function normalizeBust(p: Float32Array): { positions: Float32Array; bounds: Bounds } {
  const b = boundsOf(p);
  const cx = (b.min[0] + b.max[0]) / 2;
  const cy = (b.min[1] + b.max[1]) / 2;
  const cz = (b.min[2] + b.max[2]) / 2;
  const s = 1.8 / (b.max[1] - b.min[1]);
  const out = new Float32Array(p.length);
  for (let i = 0; i < p.length; i += 3) {
    out[i] = ((p[i] ?? 0) - cx) * s;
    out[i + 1] = ((p[i + 1] ?? 0) - cy) * s;
    out[i + 2] = ((p[i + 2] ?? 0) - cz) * s;
  }
  return { positions: out, bounds: boundsOf(out) };
}
```

- [ ] **Step 5: Run the tests**

Run: `pnpm test:scripts`
Expected: PASS.

- [ ] **Step 6: The build script**

`scripts/build-bust.ts`:

```ts
/**
 * Builds apps/web/public/avatar/bust.glb from the MakeHuman base mesh (CC0 1.0).
 * Deterministic: pinned commit, fixed crop height. Run: pnpm build:bust
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { Accessor, Document, NodeIO, Primitive } from "@gltf-transform/core";
import { cropByY, normalizeBust, parseObj, triangulate } from "./lib/obj";

const COMMIT = "3c701a8e52f09e69922e8b598d23be2d7dfc49e3";
const SOURCE = `https://raw.githubusercontent.com/makehumancommunity/makehuman/${COMMIT}/makehuman/data/3dobjs/base.obj`;
/** MakeHuman units are decimetres; the shoulder line sits near y ≈ 5.7, the chest at ≈ 4.6. */
const Y_CUT = 4.4;
const OUT_DIR = "apps/web/public/avatar";

const res = await fetch(SOURCE);
if (!res.ok) throw new Error(`download failed: ${res.status} ${SOURCE}`);
const obj = parseObj(await res.text(), { group: "body" });
const cropped = cropByY(obj, Y_CUT);
const indices = triangulate(cropped.faces);
const { positions, bounds } = normalizeBust(cropped.positions);

const doc = new Document();
const buffer = doc.createBuffer();
const pos = doc.createAccessor("POSITION").setType(Accessor.Type.VEC3).setArray(positions).setBuffer(buffer);
const idx = doc.createAccessor("INDEX").setType(Accessor.Type.SCALAR).setArray(indices).setBuffer(buffer);
const prim = doc.createPrimitive().setMode(Primitive.Mode.TRIANGLES).setAttribute("POSITION", pos).setIndices(idx);
const mesh = doc.createMesh("bust").addPrimitive(prim);
const node = doc.createNode("bust").setMesh(mesh);
doc.createScene("bust").addChild(node);

mkdirSync(OUT_DIR, { recursive: true });
const glb = await new NodeIO().writeBinary(doc);
writeFileSync(`${OUT_DIR}/bust.glb`, glb);
writeFileSync(
  `${OUT_DIR}/bust.json`,
  JSON.stringify(
    {
      source: SOURCE,
      commit: COMMIT,
      licence: "CC0-1.0 (MakeHuman assets, license.txt §C)",
      yCut: Y_CUT,
      vertices: positions.length / 3,
      triangles: indices.length / 3,
      bounds,
    },
    null,
    2,
  ) + "\n",
);
writeFileSync(
  `${OUT_DIR}/bust.LICENSE.txt`,
  [
    "bust.glb — derived from the MakeHuman base mesh (makehuman/data/3dobjs/base.obj),",
    `commit ${COMMIT}, cropped to head + neck + shoulders and normalised by scripts/build-bust.ts.`,
    "The MakeHuman assets, including the base mesh, are released under CC0 1.0 Universal",
    "(https://github.com/makehumancommunity/makehuman/blob/master/makehuman/license.txt, section C).",
    "No rights reserved.",
    "",
  ].join("\n"),
);
console.log(`bust.glb: ${positions.length / 3} vertices, ${indices.length / 3} triangles, ${glb.byteLength} bytes`);
```

Add `"build:bust": "tsx scripts/build-bust.ts"` to the root `package.json` scripts.

- [ ] **Step 7: Run it and inspect**

Run: `pnpm build:bust`
Expected: prints roughly `bust.glb: ~3 000–5 000 vertices, ~5 000–9 000 triangles, < 300 000 bytes` (the exact counts go into `bust.json`). If vertices < 1 500 the crop is too high (lower `Y_CUT` to 4.0); if > 9 000 it is too low (raise to 4.8). Open the GLB once in a viewer (`https://gltf-viewer.donmccurdy.com/` accepts a local drop; nothing is uploaded) or trust `bust.json` bounds: x ≈ ±0.9 … ±1.1 (shoulders wider than tall), y −0.9 … 0.9, z ≈ ±0.35.

- [ ] **Step 8: Verify and commit**

```powershell
pnpm format
pnpm lint
pnpm typecheck
pnpm test:scripts
git add -A
git commit -m "feat(avatar): bust asset pipeline — MakeHuman base mesh (CC0) cropped to a head+shoulders GLB by scripts/build-bust.ts"
git push -u origin b5-02-bust
gh pr create --fill --title "B5.2a bust asset (MakeHuman CC0 → bust.glb)"
```

Expected: CI green (the privacy job stays clean: nothing under `corpus/`). Controller squash-merges.

---

### Task 3 (B5.2b): shape generators, surface sampler, canonical anchors

**Branch:** `b5-03-targets`

**Files:**
- Create: `apps/web/src/avatar/sim/random.ts` (+ `random.test.ts`), `sim/noise.ts` (+ `noise.test.ts`), `sim/sampler.ts` (+ `sampler.test.ts`), `sim/canonical.ts` (+ `canonical.test.ts`), `sim/targets/{orb,nebula,ring,core,spine,waves,humanoid,index}.ts`, `sim/targets/targets.test.ts`, `sim/bust.ts`
- Create: `apps/web/src/avatar/sim/__fixtures__/bust-tiny.json` (a 12-triangle stand-in used by the node tests; the real GLB is only loaded in the browser)

**Interfaces:**
- Consumes: `ROLE_SPLIT`, `TIERS` from `@twin/config`.
- Produces:
  - `mulberry32(seed: number): () => number` · `randomInSphere(rng, r): [x,y,z]`
  - `makeNoise(seed): (x, y, z) => number` (simplex, −1..1) · `curl(noise, x, y, z, eps?): [x,y,z]`
  - `sampleSurface(positions: Float32Array, indices: Uint32Array, n: number, rng, jitter?): Float32Array`
  - `regionsFor(points: Float32Array, bounds: Bounds): Uint8Array` with `Region = { HEAD: 0, FACE: 1, NECK: 2, CHEST: 3, SHOULDERS: 4 }`
  - `ANCHORS = { head: [0, 0.45, 0.02], chest: [0, -0.25, 0.12], earL: [-0.28, 0.42, 0], earR: [0.28, 0.42, 0], face: [0, 0.4, 0.3] }`
  - `buildTargets({ n, waves, seed, bust }): Targets` where `Targets = { n, coreEnd, spineEnd, humanoid, orb, nebula, ring, regions, spineT, waves }` — every shape array has length `n * 3`; indices `[0, coreEnd)` are CORE points, `[coreEnd, spineEnd)` SPINE points, the rest the shape itself; `regions` (Uint8Array n) is meaningful for the humanoid slots and 3 (CHEST) elsewhere; `spineT` (Float32Array n) is the 0..1 parameter along the spine for SPINE slots and 0 elsewhere; `waves` is a separate `Float32Array(waves * 3)`.
  - `strided(t: Targets, n2: number): Targets` — takes every k-th point per segment so a lower tier reuses the same generation.
  - `loadBust(url): Promise<{ positions: Float32Array; indices: Uint32Array; bounds: Bounds }>` (browser, GLTFLoader).

- [ ] **Step 1: Branch**

```powershell
git switch -c b5-03-targets main
```

- [ ] **Step 2: Failing tests — random + noise**

`apps/web/src/avatar/sim/random.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { mulberry32, randomInSphere, randomOnSphere } from "./random";

describe("mulberry32", () => {
  it("is deterministic per seed and uniform-ish in [0,1)", () => {
    const a = mulberry32(7);
    const b = mulberry32(7);
    const xs = Array.from({ length: 1000 }, () => a());
    expect(xs).toEqual(Array.from({ length: 1000 }, () => b()));
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...xs)).toBeLessThan(1);
    const mean = xs.reduce((s, x) => s + x, 0) / xs.length;
    expect(mean).toBeGreaterThan(0.45);
    expect(mean).toBeLessThan(0.55);
  });
});

describe("sphere sampling", () => {
  it("randomOnSphere has unit length; randomInSphere stays inside r", () => {
    const rng = mulberry32(1);
    for (let i = 0; i < 100; i++) {
      const [x, y, z] = randomOnSphere(rng);
      expect(Math.hypot(x, y, z)).toBeCloseTo(1, 6);
      const [a, b, c] = randomInSphere(rng, 2);
      expect(Math.hypot(a, b, c)).toBeLessThanOrEqual(2);
    }
  });
});
```

`apps/web/src/avatar/sim/noise.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { curl, makeNoise } from "./noise";

describe("simplex noise", () => {
  it("is deterministic, bounded and continuous", () => {
    const n1 = makeNoise(3);
    const n2 = makeNoise(3);
    expect(n1(0.3, 0.7, 1.1)).toBe(n2(0.3, 0.7, 1.1));
    for (let i = 0; i < 200; i++) {
      const v = n1(i * 0.13, i * 0.07, i * 0.05);
      expect(v).toBeGreaterThanOrEqual(-1);
      expect(v).toBeLessThanOrEqual(1);
    }
    expect(Math.abs(n1(1, 1, 1) - n1(1.001, 1, 1))).toBeLessThan(0.05);
  });
  it("different seeds differ", () => {
    expect(makeNoise(1)(0.5, 0.5, 0.5)).not.toBe(makeNoise(2)(0.5, 0.5, 0.5));
  });
});

describe("curl", () => {
  it("returns a finite 3-vector that varies in space", () => {
    const n = makeNoise(5);
    const a = curl(n, 0.1, 0.2, 0.3);
    const b = curl(n, 1.1, 0.2, 0.3);
    expect(a.every(Number.isFinite)).toBe(true);
    expect(a).not.toEqual(b);
  });
});
```

- [ ] **Step 3: Run to see them fail**

Run: `pnpm --filter @twin/web test`
Expected: FAIL — modules not found.

- [ ] **Step 4: Implement random.ts and noise.ts**

`random.ts`:

```ts
export type Rng = () => number;

/** Small, fast, seedable PRNG (Tommy Ettinger's mulberry32). */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomOnSphere(rng: Rng): [number, number, number] {
  const u = rng() * 2 - 1;
  const phi = rng() * Math.PI * 2;
  const s = Math.sqrt(1 - u * u);
  return [s * Math.cos(phi), s * Math.sin(phi), u];
}

export function randomInSphere(rng: Rng, r: number): [number, number, number] {
  const [x, y, z] = randomOnSphere(rng);
  const k = Math.cbrt(rng()) * r;
  return [x * k, y * k, z * k];
}
```

`noise.ts` — a 3D simplex noise (Stefan Gustavson's public-domain algorithm, permutation shuffled by the seed):

```ts
import { mulberry32 } from "./random";

export type Noise3 = (x: number, y: number, z: number) => number;

const GRAD3: readonly (readonly [number, number, number])[] = [
  [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
  [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
  [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1],
];
const F3 = 1 / 3;
const G3 = 1 / 6;

export function makeNoise(seed: number): Noise3 {
  const rng = mulberry32(seed);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [p[i], p[j]] = [p[j] ?? 0, p[i] ?? 0];
  }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255] ?? 0;
  const g = (i: number) => GRAD3[(perm[i] ?? 0) % 12] ?? GRAD3[0]!;
  const dot = (v: readonly [number, number, number], x: number, y: number, z: number) => v[0] * x + v[1] * y + v[2] * z;

  return (xin, yin, zin) => {
    const s = (xin + yin + zin) * F3;
    const i = Math.floor(xin + s), j = Math.floor(yin + s), k = Math.floor(zin + s);
    const t = (i + j + k) * G3;
    const x0 = xin - (i - t), y0 = yin - (j - t), z0 = zin - (k - t);
    let i1: number, j1: number, k1: number, i2: number, j2: number, k2: number;
    if (x0 >= y0) {
      if (y0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
      else if (x0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1; }
      else { i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1; }
    } else {
      if (y0 < z0) { i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1; }
      else if (x0 < z0) { i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1; }
      else { i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
    }
    const x1 = x0 - i1 + G3, y1 = y0 - j1 + G3, z1 = z0 - k1 + G3;
    const x2 = x0 - i2 + 2 * G3, y2 = y0 - j2 + 2 * G3, z2 = z0 - k2 + 2 * G3;
    const x3 = x0 - 1 + 3 * G3, y3 = y0 - 1 + 3 * G3, z3 = z0 - 1 + 3 * G3;
    const ii = i & 255, jj = j & 255, kk = k & 255;
    const corner = (x: number, y: number, z: number, gi: number) => {
      let t0 = 0.6 - x * x - y * y - z * z;
      if (t0 < 0) return 0;
      t0 *= t0;
      return t0 * t0 * dot(g(gi), x, y, z);
    };
    const n0 = corner(x0, y0, z0, ii + (perm[jj + (perm[kk] ?? 0)] ?? 0));
    const n1 = corner(x1, y1, z1, ii + i1 + (perm[jj + j1 + (perm[kk + k1] ?? 0)] ?? 0));
    const n2 = corner(x2, y2, z2, ii + i2 + (perm[jj + j2 + (perm[kk + k2] ?? 0)] ?? 0));
    const n3 = corner(x3, y3, z3, ii + 1 + (perm[jj + 1 + (perm[kk + 1] ?? 0)] ?? 0));
    return 32 * (n0 + n1 + n2 + n3);
  };
}

/** Curl of a noise-derived vector field (three offset samples), divergence-free flow. */
export function curl(n: Noise3, x: number, y: number, z: number, eps = 0.01): [number, number, number] {
  const fx = (a: number, b: number, c: number) => n(a, b, c);
  const fy = (a: number, b: number, c: number) => n(a + 31.7, b + 17.3, c + 5.1);
  const fz = (a: number, b: number, c: number) => n(a - 12.9, b + 43.2, c + 27.5);
  const dFz_dy = (fz(x, y + eps, z) - fz(x, y - eps, z)) / (2 * eps);
  const dFy_dz = (fy(x, y, z + eps) - fy(x, y, z - eps)) / (2 * eps);
  const dFx_dz = (fx(x, y, z + eps) - fx(x, y, z - eps)) / (2 * eps);
  const dFz_dx = (fz(x + eps, y, z) - fz(x - eps, y, z)) / (2 * eps);
  const dFy_dx = (fy(x + eps, y, z) - fy(x - eps, y, z)) / (2 * eps);
  const dFx_dy = (fx(x, y + eps, z) - fx(x, y - eps, z)) / (2 * eps);
  return [dFz_dy - dFy_dz, dFx_dz - dFz_dx, dFy_dx - dFx_dy];
}
```

Prettier will reflow the tables; that is fine. `noUncheckedIndexedAccess` is on in the base tsconfig, hence the `?? 0` guards — keep them.

- [ ] **Step 5: Run the tests**

Run: `pnpm --filter @twin/web test`
Expected: random + noise PASS.

- [ ] **Step 6: Failing tests — sampler + canonical**

`apps/web/src/avatar/sim/__fixtures__/bust-tiny.json` — a stand-in bust: a box 1.6 wide, 1.8 tall, 0.6 deep centred at the origin (8 vertices, 12 triangles), enough for the region logic:

```json
{
  "positions": [-0.8,-0.9,-0.3, 0.8,-0.9,-0.3, 0.8,0.9,-0.3, -0.8,0.9,-0.3, -0.8,-0.9,0.3, 0.8,-0.9,0.3, 0.8,0.9,0.3, -0.8,0.9,0.3],
  "indices": [0,1,2, 0,2,3, 4,6,5, 4,7,6, 0,4,7, 0,7,3, 1,2,6, 1,6,5, 3,7,6, 3,6,2, 0,1,5, 0,5,4]
}
```

`apps/web/src/avatar/sim/sampler.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import tiny from "./__fixtures__/bust-tiny.json";
import { boundsOf, Region, regionsFor, sampleSurface } from "./sampler";
import { mulberry32 } from "./random";

const positions = new Float32Array(tiny.positions);
const indices = new Uint32Array(tiny.indices);

describe("sampleSurface", () => {
  it("returns n points, deterministic per seed, inside the mesh bounds (+ jitter)", () => {
    const a = sampleSurface(positions, indices, 500, mulberry32(9), 0.02);
    const b = sampleSurface(positions, indices, 500, mulberry32(9), 0.02);
    expect(a.length).toBe(1500);
    expect(Array.from(a.slice(0, 30))).toEqual(Array.from(b.slice(0, 30)));
    const bb = boundsOf(a);
    expect(bb.min[0]).toBeGreaterThanOrEqual(-0.8 - 0.021);
    expect(bb.max[1]).toBeLessThanOrEqual(0.9 + 0.021);
  });
  it("spreads samples over the whole surface (both x halves populated)", () => {
    const p = sampleSurface(positions, indices, 2000, mulberry32(2));
    let left = 0;
    for (let i = 0; i < p.length; i += 3) if ((p[i] ?? 0) < 0) left++;
    expect(left / 2000).toBeGreaterThan(0.4);
    expect(left / 2000).toBeLessThan(0.6);
  });
});

describe("regionsFor", () => {
  it("labels head/face/neck/chest/shoulders by height and depth", () => {
    const pts = new Float32Array([
      0, 0.85, -0.2, // head (back)
      0, 0.85, 0.28, // face (front of head)
      0, 0.1, 0, // neck (yN ≈ 0.56)
      0, -0.5, 0, // chest
      0.75, -0.5, 0, // shoulder
    ]);
    const r = regionsFor(pts, boundsOf(positions));
    expect(Array.from(r)).toEqual([Region.HEAD, Region.FACE, Region.NECK, Region.CHEST, Region.SHOULDERS]);
  });
});
```

`apps/web/src/avatar/sim/canonical.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { ANCHORS } from "./canonical";

describe("ANCHORS", () => {
  it("head above chest, ears symmetric, face in front", () => {
    expect(ANCHORS.head[1]).toBeGreaterThan(ANCHORS.chest[1]);
    expect(ANCHORS.earL[0]).toBeCloseTo(-ANCHORS.earR[0]);
    expect(ANCHORS.face[2]).toBeGreaterThan(ANCHORS.head[2]);
  });
});
```

Vitest needs `resolveJsonModule` — it is already on in `tsconfig.base.json`? Check with `pnpm --filter @twin/web typecheck`; if the JSON import errors, add `"resolveJsonModule": true` to `apps/web/tsconfig.json`.

- [ ] **Step 7: Run to see them fail**

Run: `pnpm --filter @twin/web test`
Expected: FAIL — modules not found.

- [ ] **Step 8: Implement sampler.ts and canonical.ts**

`canonical.ts`:

```ts
/** Canonical bust space (from scripts/lib/obj.ts normalizeBust): y in [-0.9, 0.9], x/z centred. */
export const ANCHORS = {
  head: [0, 0.45, 0.02],
  chest: [0, -0.25, 0.12],
  earL: [-0.28, 0.42, 0],
  earR: [0.28, 0.42, 0],
  face: [0, 0.4, 0.3],
} as const satisfies Record<string, readonly [number, number, number]>;

export type Vec3 = readonly [number, number, number];
```

`sampler.ts`:

```ts
import type { Rng } from "./random";

export interface Bounds {
  min: [number, number, number];
  max: [number, number, number];
}

export function boundsOf(p: Float32Array): Bounds {
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < p.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      const v = p[i + k] ?? 0;
      if (v < (min[k] ?? 0)) min[k] = v;
      if (v > (max[k] ?? 0)) max[k] = v;
    }
  }
  return { min, max };
}

/** Area-weighted surface sampling with barycentric coordinates and jitter along the face normal. */
export function sampleSurface(
  positions: Float32Array,
  indices: Uint32Array,
  n: number,
  rng: Rng,
  jitter = 0.01,
): Float32Array {
  const triCount = indices.length / 3;
  const cum = new Float64Array(triCount);
  const normals = new Float32Array(triCount * 3);
  let total = 0;
  for (let t = 0; t < triCount; t++) {
    const a = (indices[t * 3] ?? 0) * 3, b = (indices[t * 3 + 1] ?? 0) * 3, c = (indices[t * 3 + 2] ?? 0) * 3;
    const ux = (positions[b] ?? 0) - (positions[a] ?? 0), uy = (positions[b + 1] ?? 0) - (positions[a + 1] ?? 0), uz = (positions[b + 2] ?? 0) - (positions[a + 2] ?? 0);
    const vx = (positions[c] ?? 0) - (positions[a] ?? 0), vy = (positions[c + 1] ?? 0) - (positions[a + 1] ?? 0), vz = (positions[c + 2] ?? 0) - (positions[a + 2] ?? 0);
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz);
    total += len / 2;
    cum[t] = total;
    if (len > 0) { normals[t * 3] = nx / len; normals[t * 3 + 1] = ny / len; normals[t * 3 + 2] = nz / len; }
  }
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const r = rng() * total;
    let lo = 0, hi = triCount - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if ((cum[mid] ?? 0) < r) lo = mid + 1; else hi = mid; }
    const t = lo;
    const a = (indices[t * 3] ?? 0) * 3, b = (indices[t * 3 + 1] ?? 0) * 3, c = (indices[t * 3 + 2] ?? 0) * 3;
    let u = rng(), v = rng();
    if (u + v > 1) { u = 1 - u; v = 1 - v; }
    const w = 1 - u - v;
    const j = (rng() * 2 - 1) * jitter;
    out[i * 3] = w * (positions[a] ?? 0) + u * (positions[b] ?? 0) + v * (positions[c] ?? 0) + (normals[t * 3] ?? 0) * j;
    out[i * 3 + 1] = w * (positions[a + 1] ?? 0) + u * (positions[b + 1] ?? 0) + v * (positions[c + 1] ?? 0) + (normals[t * 3 + 1] ?? 0) * j;
    out[i * 3 + 2] = w * (positions[a + 2] ?? 0) + u * (positions[b + 2] ?? 0) + v * (positions[c + 2] ?? 0) + (normals[t * 3 + 2] ?? 0) * j;
  }
  return out;
}

export const Region = { HEAD: 0, FACE: 1, NECK: 2, CHEST: 3, SHOULDERS: 4 } as const;
export type RegionId = (typeof Region)[keyof typeof Region];

/** Height bands of the canonical bust: head > 0.62, neck 0.50–0.62, below: shoulders when |x| > 45 % of half-width. */
export function regionsFor(points: Float32Array, bounds: Bounds): Uint8Array {
  const h = bounds.max[1] - bounds.min[1];
  const halfW = (bounds.max[0] - bounds.min[0]) / 2;
  const cz = (bounds.min[2] + bounds.max[2]) / 2;
  const out = new Uint8Array(points.length / 3);
  for (let i = 0; i < out.length; i++) {
    const x = points[i * 3] ?? 0, y = points[i * 3 + 1] ?? 0, z = points[i * 3 + 2] ?? 0;
    const yN = (y - bounds.min[1]) / h;
    if (yN > 0.62) out[i] = z > cz + 0.08 ? Region.FACE : Region.HEAD;
    else if (yN > 0.5) out[i] = Region.NECK;
    else out[i] = Math.abs(x) > halfW * 0.45 ? Region.SHOULDERS : Region.CHEST;
  }
  return out;
}
```

- [ ] **Step 9: Run the tests**

Run: `pnpm --filter @twin/web test`
Expected: sampler + canonical PASS.

- [ ] **Step 10: Failing snapshot tests for the shape generators**

`apps/web/src/avatar/sim/targets/targets.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import tiny from "../__fixtures__/bust-tiny.json";
import { boundsOf } from "../sampler";
import { buildTargets, strided } from "./index";
import { core } from "./core";
import { nebula } from "./nebula";
import { orb } from "./orb";
import { ring } from "./ring";
import { spine } from "./spine";
import { waves } from "./waves";
import { mulberry32 } from "../random";

const bust = { positions: new Float32Array(tiny.positions), indices: new Uint32Array(tiny.indices), bounds: boundsOf(new Float32Array(tiny.positions)) };
const first100 = (a: Float32Array) => Array.from(a.slice(0, 300)).map((v) => Number(v.toFixed(4)));

describe("generators are deterministic and sized", () => {
  it.each([
    ["orb", () => orb(1000, mulberry32(1))],
    ["nebula", () => nebula(1000, mulberry32(1))],
    ["ring", () => ring(1000, mulberry32(1))],
    ["core", () => core(1000, mulberry32(1))],
    ["waves", () => waves(1000, mulberry32(1))],
  ])("%s", (_name, gen) => {
    const a = gen();
    expect(a.length).toBe(3000);
    expect(first100(a)).toMatchSnapshot();
  });
  it("spine returns positions and a 0..1 parameter", () => {
    const s = spine(1000, mulberry32(1));
    expect(s.positions.length).toBe(3000);
    expect(s.t.length).toBe(1000);
    expect(Math.min(...s.t)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...s.t)).toBeLessThanOrEqual(1);
    expect(first100(s.positions)).toMatchSnapshot();
  });
});

describe("shape bounds match the spec", () => {
  it("orb radius ≤ 1, nebula within 2, ring near radius 1–1.5", () => {
    const o = orb(2000, mulberry32(3)), nb = nebula(2000, mulberry32(3)), rg = ring(2000, mulberry32(3));
    const rmax = (a: Float32Array) => { let m = 0; for (let i = 0; i < a.length; i += 3) m = Math.max(m, Math.hypot(a[i] ?? 0, a[i + 1] ?? 0, a[i + 2] ?? 0)); return m; };
    expect(rmax(o)).toBeLessThanOrEqual(1.02);
    expect(rmax(nb)).toBeLessThanOrEqual(2.2);
    expect(rmax(rg)).toBeLessThanOrEqual(1.6);
  });
});

describe("buildTargets", () => {
  it("lays out core, spine, then shape; regions/spineT aligned; waves separate", () => {
    const t = buildTargets({ n: 1000, waves: 200, seed: 42, bust });
    expect(t.coreEnd).toBe(50);
    expect(t.spineEnd).toBe(70);
    for (const shape of [t.humanoid, t.orb, t.nebula, t.ring]) {
      expect(shape.length).toBe(3000);
      expect(Array.from(shape.slice(0, 150))).toEqual(Array.from(t.humanoid.slice(0, 150))); // core identical in every shape
    }
    expect(t.regions.length).toBe(1000);
    expect(t.spineT.length).toBe(1000);
    expect(t.spineT[60]).toBeGreaterThanOrEqual(0);
    expect(t.spineT[500]).toBe(0);
    expect(t.waves.length).toBe(600);
    expect(first100(t.humanoid)).toMatchSnapshot();
  });
  it("strided keeps proportions and determinism", () => {
    const t = buildTargets({ n: 1000, waves: 200, seed: 42, bust });
    const s = strided(t, 500);
    expect(s.n).toBe(500);
    expect(s.coreEnd).toBe(25);
    expect(s.spineEnd).toBe(35);
    expect(s.orb.length).toBe(1500);
    expect(s.waves.length).toBe(300);
    expect(Array.from(s.orb.slice(0, 3))).toEqual(Array.from(t.orb.slice(0, 3)));
  });
});
```

- [ ] **Step 11: Run to see them fail**

Run: `pnpm --filter @twin/web test`
Expected: FAIL — modules not found.

- [ ] **Step 12: Implement the generators**

`targets/orb.ts`:

```ts
import type { Rng } from "../random";

/** Fibonacci sphere in three nested shells (docs/06 §2 ORB). */
export function orb(n: number, rng: Rng): Float32Array {
  const shells = [
    { r: 1.0, share: 0.6 },
    { r: 0.72, share: 0.28 },
    { r: 0.45, share: 0.12 },
  ];
  const out = new Float32Array(n * 3);
  const golden = Math.PI * (3 - Math.sqrt(5));
  let i = 0;
  shells.forEach((sh, si) => {
    const count = si === shells.length - 1 ? n - i : Math.round(n * sh.share);
    for (let k = 0; k < count && i < n; k++, i++) {
      const y = 1 - (2 * (k + 0.5)) / count;
      const rad = Math.sqrt(1 - y * y);
      const th = golden * k;
      const j = 1 + (rng() - 0.5) * 0.02;
      out[i * 3] = Math.cos(th) * rad * sh.r * j;
      out[i * 3 + 1] = y * sh.r * j;
      out[i * 3 + 2] = Math.sin(th) * rad * sh.r * j;
    }
  });
  return out;
}
```

`targets/nebula.ts`:

```ts
import { curl, makeNoise } from "../noise";
import { randomInSphere, type Rng } from "../random";

/** Curl-noise scattered volume (DORMANT / OFFLINE). */
export function nebula(n: number, rng: Rng): Float32Array {
  const noise = makeNoise(11);
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const [x, y, z] = randomInSphere(rng, 1.6);
    const [cx, cy, cz] = curl(noise, x * 0.9, y * 0.9, z * 0.9);
    out[i * 3] = x + cx * 0.35;
    out[i * 3 + 1] = y * 0.8 + cy * 0.35;
    out[i * 3 + 2] = z + cz * 0.35;
  }
  return out;
}
```

`targets/ring.ts`:

```ts
import type { Rng } from "../random";

/** Torus (70 %) plus two tilted halo annuli (30 %) — the WAKING flourish. */
export function ring(n: number, rng: Rng): Float32Array {
  const out = new Float32Array(n * 3);
  const torusCount = Math.round(n * 0.7);
  for (let i = 0; i < torusCount; i++) {
    const u = rng() * Math.PI * 2, v = rng() * Math.PI * 2;
    const R = 1.05, r = 0.06;
    out[i * 3] = (R + r * Math.cos(v)) * Math.cos(u);
    out[i * 3 + 1] = r * Math.sin(v);
    out[i * 3 + 2] = (R + r * Math.cos(v)) * Math.sin(u);
  }
  for (let i = torusCount; i < n; i++) {
    const a = rng() * Math.PI * 2;
    const rad = 1.3 + rng() * 0.2;
    const tilt = (i % 2 === 0 ? 1 : -1) * (15 * Math.PI) / 180;
    const x = Math.cos(a) * rad, z = Math.sin(a) * rad;
    out[i * 3] = x;
    out[i * 3 + 1] = z * Math.sin(tilt) + (rng() - 0.5) * 0.02;
    out[i * 3 + 2] = z * Math.cos(tilt);
  }
  return out;
}
```

`targets/core.ts`:

```ts
import { ANCHORS } from "../canonical";
import { randomInSphere, type Rng } from "../random";

/** Dense amber core: 60 % in the head anchor, 40 % in the chest anchor (docs/06 §2 CORE). */
export function core(n: number, rng: Rng): Float32Array {
  const out = new Float32Array(n * 3);
  const headCount = Math.round(n * 0.6);
  for (let i = 0; i < n; i++) {
    const head = i < headCount;
    const anchor = head ? ANCHORS.head : ANCHORS.chest;
    const [x, y, z] = randomInSphere(rng, head ? 0.09 : 0.11);
    out[i * 3] = anchor[0] + x;
    out[i * 3 + 1] = anchor[1] + y;
    out[i * 3 + 2] = anchor[2] + z;
  }
  return out;
}
```

`targets/spine.ts`:

```ts
import { ANCHORS } from "../canonical";
import { makeNoise } from "../noise";
import type { Rng } from "../random";

export interface SpineTarget {
  positions: Float32Array;
  /** 0 at the head end, 1 at the chest end (colour gradient amber → blue) */
  t: Float32Array;
}

/** Glowing tendrils from the head down the neck into the chest with short branches. */
export function spine(n: number, rng: Rng): SpineTarget {
  const noise = makeNoise(23);
  const positions = new Float32Array(n * 3);
  const t = new Float32Array(n);
  const branches = 5;
  for (let i = 0; i < n; i++) {
    const s = rng();
    const b = i % branches;
    const bx = (b - (branches - 1) / 2) * 0.05;
    const x = ANCHORS.head[0] * (1 - s) + ANCHORS.chest[0] * s + bx * Math.sin(s * Math.PI) + noise(s * 4, b, 0) * 0.04;
    const y = ANCHORS.head[1] * (1 - s) + ANCHORS.chest[1] * s;
    const z = ANCHORS.head[2] * (1 - s) + ANCHORS.chest[2] * s + noise(b, s * 4, 1) * 0.03;
    const r = 0.012 + rng() * 0.012;
    const a = rng() * Math.PI * 2;
    positions[i * 3] = x + Math.cos(a) * r;
    positions[i * 3 + 1] = y + (rng() - 0.5) * 0.01;
    positions[i * 3 + 2] = z + Math.sin(a) * r;
    t[i] = s;
  }
  return { positions, t };
}
```

`targets/waves.ts`:

```ts
import { makeNoise } from "../noise";
import type { Rng } from "../random";

/** Two low-frequency heightfield sheets left and right of the bust (background). */
export function waves(n: number, rng: Rng): Float32Array {
  const noise = makeNoise(5);
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const x = side * (1.2 + rng() * 2.0);
    const z = -1.5 + rng() * 2.0;
    const y = -0.9 + noise(x * 0.8, z * 0.8, 0) * 0.35;
    out[i * 3] = x;
    out[i * 3 + 1] = y;
    out[i * 3 + 2] = z;
  }
  return out;
}
```

`targets/humanoid.ts`:

```ts
import { regionsFor, sampleSurface, type Bounds } from "../sampler";
import type { Rng } from "../random";

export interface BustMesh {
  positions: Float32Array;
  indices: Uint32Array;
  bounds: Bounds;
}

export function humanoid(n: number, rng: Rng, bust: BustMesh): { positions: Float32Array; regions: Uint8Array } {
  const positions = sampleSurface(bust.positions, bust.indices, n, rng, 0.012);
  return { positions, regions: regionsFor(positions, bust.bounds) };
}
```

`targets/index.ts`:

```ts
import { ROLE_SPLIT } from "@twin/config";
import { mulberry32 } from "../random";
import { Region } from "../sampler";
import { core } from "./core";
import { humanoid, type BustMesh } from "./humanoid";
import { nebula } from "./nebula";
import { orb } from "./orb";
import { ring } from "./ring";
import { spine } from "./spine";
import { waves } from "./waves";

export interface Targets {
  n: number;
  coreEnd: number;
  spineEnd: number;
  humanoid: Float32Array;
  orb: Float32Array;
  nebula: Float32Array;
  ring: Float32Array;
  regions: Uint8Array;
  spineT: Float32Array;
  waves: Float32Array;
}

function concat(a: Float32Array, b: Float32Array, c: Float32Array): Float32Array {
  const out = new Float32Array(a.length + b.length + c.length);
  out.set(a, 0);
  out.set(b, a.length);
  out.set(c, a.length + b.length);
  return out;
}

export function buildTargets(opts: { n: number; waves: number; seed: number; bust: BustMesh }): Targets {
  const { n, seed, bust } = opts;
  const coreEnd = Math.round(n * ROLE_SPLIT.core);
  const spineEnd = coreEnd + Math.round(n * ROLE_SPLIT.spine);
  const main = n - spineEnd;
  const corePts = core(coreEnd, mulberry32(seed + 1));
  const sp = spine(spineEnd - coreEnd, mulberry32(seed + 2));
  const hu = humanoid(main, mulberry32(seed + 3), bust);
  const regions = new Uint8Array(n).fill(Region.CHEST);
  regions.set(hu.regions, spineEnd);
  const spineT = new Float32Array(n);
  spineT.set(sp.t, coreEnd);
  return {
    n,
    coreEnd,
    spineEnd,
    humanoid: concat(corePts, sp.positions, hu.positions),
    orb: concat(corePts, sp.positions, orb(main, mulberry32(seed + 4))),
    nebula: concat(corePts, sp.positions, nebula(main, mulberry32(seed + 5))),
    ring: concat(corePts, sp.positions, ring(main, mulberry32(seed + 6))),
    regions,
    spineT,
    waves: waves(opts.waves, mulberry32(seed + 7)),
  };
}

function pick(src: Float32Array, start: number, end: number, count: number, stride = 3): Float32Array {
  const avail = end - start;
  const out = new Float32Array(count * stride);
  for (let i = 0; i < count; i++) {
    const j = start + Math.floor((i * avail) / count);
    for (let k = 0; k < stride; k++) out[i * stride + k] = src[j * stride + k] ?? 0;
  }
  return out;
}

/** Every k-th point per segment, so a lower tier keeps the same look and role proportions. */
export function strided(t: Targets, n2: number): Targets {
  const coreEnd = Math.round(n2 * ROLE_SPLIT.core);
  const spineEnd = coreEnd + Math.round(n2 * ROLE_SPLIT.spine);
  const main = n2 - spineEnd;
  const seg = (a: Float32Array) => concat(pick(a, 0, t.coreEnd, coreEnd), pick(a, t.coreEnd, t.spineEnd, spineEnd - coreEnd), pick(a, t.spineEnd, t.n, main));
  const regions = new Uint8Array(n2);
  const spineT = new Float32Array(n2);
  const r1 = pick(Float32Array.from(t.regions), 0, t.coreEnd, coreEnd, 1), r2 = pick(Float32Array.from(t.regions), t.coreEnd, t.spineEnd, spineEnd - coreEnd, 1), r3 = pick(Float32Array.from(t.regions), t.spineEnd, t.n, main, 1);
  regions.set(r1, 0); regions.set(r2, coreEnd); regions.set(r3, spineEnd);
  spineT.set(pick(t.spineT, t.coreEnd, t.spineEnd, spineEnd - coreEnd, 1), coreEnd);
  const wavesN = Math.round((t.waves.length / 3) * (n2 / t.n));
  return { n: n2, coreEnd, spineEnd, humanoid: seg(t.humanoid), orb: seg(t.orb), nebula: seg(t.nebula), ring: seg(t.ring), regions, spineT, waves: pick(t.waves, 0, t.waves.length / 3, wavesN) };
}
```

`sim/bust.ts` (browser only; not unit-tested — exercised by the bench page in Task 5):

```ts
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { BufferGeometry, Mesh } from "three";
import { boundsOf } from "./sampler";
import type { BustMesh } from "./targets/humanoid";

export async function loadBust(url = "/avatar/bust.glb"): Promise<BustMesh> {
  const gltf = await new GLTFLoader().loadAsync(url);
  let geometry: BufferGeometry | null = null;
  gltf.scene.traverse((o) => {
    if ((o as Mesh).isMesh && !geometry) geometry = (o as Mesh).geometry;
  });
  if (!geometry) throw new Error("bust.glb has no mesh");
  const g = geometry as BufferGeometry;
  const positions = new Float32Array(g.getAttribute("position").array as ArrayLike<number>);
  const index = g.getIndex();
  const indices = index ? new Uint32Array(index.array as ArrayLike<number>) : Uint32Array.from({ length: positions.length / 3 }, (_, i) => i);
  return { positions, indices, bounds: boundsOf(positions) };
}
```

- [ ] **Step 13: Run tests, accept snapshots, verify**

Run: `pnpm --filter @twin/web test` (first run writes `__snapshots__/targets.test.ts.snap`; run twice — the second run must pass without writing).
Then: `pnpm format && pnpm lint && pnpm typecheck`. Expected: all exit 0.

- [ ] **Step 14: Commit + PR**

```powershell
git add -A
git commit -m "feat(avatar): shape generators (orb, nebula, ring, core, spine, waves, humanoid), surface sampler with regions, target layout with strided tiers"
git push -u origin b5-03-targets
gh pr create --fill --title "B5.2b shape generators + sampler"
```

---

### Task 4 (B5.4a): state machine, store, timers hook, audio energy

**Branch:** `b5-04-state-audio`

**Files:**
- Create: `apps/web/src/avatar/state/machine.ts` (+ `machine.test.ts`), `state/store.ts` (+ `store.test.ts`), `apps/web/src/avatar/useAvatarState.ts`
- Create: `apps/web/src/avatar/audio/energy.ts` (+ `energy.test.ts`), `audio/synth.ts` (+ `synth.test.ts`), `audio/analyser.ts`, `audio/cue.ts`

**Interfaces:**
- Consumes: `AvatarState`, `TurnEvent` from `@twin/shared`; `WAKING_DURATION_S`, `IDLE_TIMEOUT_S`, `Tier` from `@twin/config`; `mulberry32` from `../sim/random`.
- Produces:
  - `type AvatarEvent = "WAKE" | "WAKE_DONE" | "THINK" | "SPEECH_END" | "FIRST_TOKEN" | "TURN_END" | "INACTIVITY" | "FAILURE" | "RECOVER"`
  - `transition(state: AvatarState, event: AvatarEvent): AvatarState` · `fromTurnEvent(e: TurnEvent): AvatarEvent | null` · `explicitState(e: TurnEvent): AvatarState | null`
  - `useAvatarStore` (zustand) with `state, since, log, tier, backend, ready, energy, pointer, frames, tuning` and actions `dispatch, setState, setTier, setBackend, setReady, setEnergy, setPointer, setFrames, setTuning`
  - `useAvatarState(): { state; send(e: AvatarEvent); applyTurnEvent(e: TurnEvent) }` — owns the WAKING (1.2 s) and IDLE (90 s) timers and the "THINK while DORMANT" queue
  - `type Energy = { bass: number; mid: number; treble: number }` · `ZERO_ENERGY` · `bandEnergy(freq, sampleRate, fftSize, loHz, hiHz)` · `energyFrom(freq, sampleRate, fftSize)` · `smoothEnergy(prev, next)` · `synthEnergy(tSeconds, seed?)` · `createEnergySource(ctx, node)` · `micSource(ctx)` · `fileSource(ctx, file)` · `playWakeCue(ctx)`

- [ ] **Step 1: Branch**

```powershell
git switch -c b5-04-state-audio main
```

- [ ] **Step 2: Failing tests for the machine**

`apps/web/src/avatar/state/machine.test.ts`:

```ts
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
```

- [ ] **Step 3: Run to see it fail** — `pnpm --filter @twin/web test` → FAIL, module not found.

- [ ] **Step 4: Implement machine.ts**

```ts
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
```

- [ ] **Step 5: Failing tests for energy + synth**

`apps/web/src/avatar/audio/energy.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { bandEnergy, binRange, energyFrom, smooth, smoothEnergy, ZERO_ENERGY } from "./energy";

describe("binRange", () => {
  it("maps Hz to FFT bins and clamps", () => {
    expect(binRange(48000, 1024, 60, 250)).toEqual([1, 6]);
    expect(binRange(48000, 1024, 2000, 80000)).toEqual([42, 511]);
  });
});

describe("bandEnergy / energyFrom", () => {
  it("averages the bins of the band, normalised to 0..1", () => {
    const freq = new Uint8Array(512);
    for (let i = 2; i <= 4; i++) freq[i] = 255; // 94–188 Hz: inside bass [bins 1..6], outside mid [bins 5..43]
    expect(bandEnergy(freq, 48000, 1024, 60, 250)).toBeCloseTo(0.5);
    expect(bandEnergy(freq, 48000, 1024, 250, 2000)).toBeCloseTo(0);
    const e = energyFrom(freq, 48000, 1024);
    expect(e.bass).toBeCloseTo(0.5);
    expect(e.mid).toBeCloseTo(0);
    expect(e.treble).toBeCloseTo(0);
  });
});

describe("smoothing", () => {
  it("attacks fast and releases slowly", () => {
    expect(smooth(0, 1)).toBeCloseTo(0.5);
    expect(smooth(1, 0)).toBeCloseTo(0.88);
    const s = smoothEnergy(ZERO_ENERGY, { bass: 1, mid: 1, treble: 1 });
    expect(s.mid).toBeCloseTo(0.5);
  });
});
```

`apps/web/src/avatar/audio/synth.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { synthEnergy } from "./synth";

describe("synthEnergy", () => {
  it("is deterministic, bounded, speech-like (bursts with pauses)", () => {
    expect(synthEnergy(1.234)).toEqual(synthEnergy(1.234));
    let sum = 0, zeros = 0, n = 0;
    for (let t = 0; t < 10; t += 0.01, n++) {
      const e = synthEnergy(t);
      for (const v of [e.bass, e.mid, e.treble]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
      sum += e.mid;
      if (e.mid === 0) zeros++;
    }
    expect(sum / n).toBeGreaterThan(0.2);
    expect(sum / n).toBeLessThan(0.8);
    expect(zeros / n).toBeGreaterThan(0.1); // pauses exist
  });
});
```

- [ ] **Step 6: Run to see them fail** — module not found.

- [ ] **Step 7: Implement energy.ts, synth.ts, analyser.ts, cue.ts**

`energy.ts`:

```ts
export interface Energy {
  bass: number;
  mid: number;
  treble: number;
}
export const ZERO_ENERGY: Energy = { bass: 0, mid: 0, treble: 0 };
export const BANDS = { bass: [60, 250], mid: [250, 2000], treble: [2000, 8000] } as const;

export function binRange(sampleRate: number, fftSize: number, loHz: number, hiHz: number): [number, number] {
  const hzPerBin = sampleRate / fftSize;
  const last = fftSize / 2 - 1;
  return [Math.min(last, Math.max(0, Math.floor(loHz / hzPerBin))), Math.min(last, Math.max(0, Math.ceil(hiHz / hzPerBin)))];
}

export function bandEnergy(freq: Uint8Array, sampleRate: number, fftSize: number, loHz: number, hiHz: number): number {
  const [a, b] = binRange(sampleRate, fftSize, loHz, hiHz);
  let sum = 0;
  for (let i = a; i <= b; i++) sum += freq[i] ?? 0;
  return sum / ((b - a + 1) * 255);
}

export function energyFrom(freq: Uint8Array, sampleRate: number, fftSize: number): Energy {
  return {
    bass: bandEnergy(freq, sampleRate, fftSize, BANDS.bass[0], BANDS.bass[1]),
    mid: bandEnergy(freq, sampleRate, fftSize, BANDS.mid[0], BANDS.mid[1]),
    treble: bandEnergy(freq, sampleRate, fftSize, BANDS.treble[0], BANDS.treble[1]),
  };
}

/** Fast attack, slow release — keeps the Avatar from flickering on every frame. */
export function smooth(prev: number, next: number, attack = 0.5, release = 0.12): number {
  return next > prev ? prev + (next - prev) * attack : prev + (next - prev) * release;
}

export function smoothEnergy(prev: Energy, next: Energy): Energy {
  return { bass: smooth(prev.bass, next.bass), mid: smooth(prev.mid, next.mid), treble: smooth(prev.treble, next.treble) };
}
```

`synth.ts`:

```ts
import { mulberry32 } from "../sim/random";
import type { Energy } from "./energy";

/**
 * Speech-like envelope for the demo turn: phrases of 1.2–1.8 s with 0.3–0.5 s pauses,
 * ~4 syllables per second. Deterministic per (seed, t).
 */
export function synthEnergy(t: number, seed = 1): Energy {
  const window = Math.floor(t / 2);
  const rng = mulberry32(seed * 1000 + window);
  const phraseLen = 1.2 + rng() * 0.6;
  const phase = t - window * 2;
  const inPhrase = phase < phraseLen;
  const syllable = 0.55 + 0.45 * Math.max(0, Math.sin(t * Math.PI * 2 * 4));
  const env = inPhrase ? syllable * (0.85 + 0.15 * Math.sin(t * 1.7)) : 0;
  const trebleMix = 0.4 + 0.6 * rng();
  return { bass: env * 0.7, mid: env, treble: env * trebleMix };
}
```

`analyser.ts` (browser only):

```ts
import { energyFrom, smoothEnergy, ZERO_ENERGY, type Energy } from "./energy";

export interface EnergySource {
  read(): Energy;
  dispose(): void;
}

export function createEnergySource(ctx: AudioContext, node: AudioNode, fftSize = 1024): EnergySource {
  const analyser = ctx.createAnalyser();
  analyser.fftSize = fftSize;
  analyser.smoothingTimeConstant = 0.6;
  node.connect(analyser);
  const data = new Uint8Array(analyser.frequencyBinCount);
  let prev = ZERO_ENERGY;
  return {
    read() {
      analyser.getByteFrequencyData(data);
      prev = smoothEnergy(prev, energyFrom(data, ctx.sampleRate, fftSize));
      return prev;
    },
    dispose() {
      node.disconnect(analyser);
    },
  };
}

export async function micSource(ctx: AudioContext): Promise<{ node: AudioNode; stop(): void }> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const node = ctx.createMediaStreamSource(stream);
  return { node, stop: () => stream.getTracks().forEach((t) => t.stop()) };
}

export async function fileSource(ctx: AudioContext, file: File): Promise<{ node: AudioNode; start(): void; stop(): void }> {
  const buffer = await ctx.decodeAudioData(await file.arrayBuffer());
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  src.connect(ctx.destination);
  return { node: src, start: () => src.start(), stop: () => src.stop() };
}
```

`cue.ts`:

```ts
/** WAKING sound cue (docs/06 §3): a 350 ms rising sine, synthesised — no asset. Call after a user gesture. */
export function playWakeCue(ctx: AudioContext): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const t = ctx.currentTime;
  osc.type = "sine";
  osc.frequency.setValueAtTime(440, t);
  osc.frequency.exponentialRampToValueAtTime(880, t + 0.25);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.2, t + 0.05);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.4);
}
```

- [ ] **Step 8: Run tests** — machine, energy, synth PASS.

- [ ] **Step 9: Failing test for the store**

`apps/web/src/avatar/state/store.test.ts`:

```ts
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
```

- [ ] **Step 10: Implement store.ts and useAvatarState.ts**

`store.ts`:

```ts
import { create } from "zustand";
import type { AvatarState } from "@twin/shared";
import type { Tier } from "@twin/config";
import { ZERO_ENERGY, type Energy } from "../audio/energy";
import { transition, type AvatarEvent } from "./machine";

export interface PointerState {
  /** world-space x/y on the z = 0 plane */
  x: number;
  y: number;
  active: boolean;
  /** +1 repel (hover), -1 attract (long press) */
  strength: number;
}
export interface FrameSummary {
  p50: number;
  p95: number;
  count: number;
}
/** Live overrides from the playground; every field optional, applied on top of AVATAR_STATES. */
export interface Tuning {
  turbulence?: number;
  brightness?: number;
  spring?: number;
  damping?: number;
  noiseScale?: number;
  noiseAmp?: number;
  size?: number;
  bloomStrength?: number;
  bloomThreshold?: number;
  vortex?: number;
  pointerRadius?: number;
}
export type Backend = "webgpu" | "webgl";

export interface AvatarStore {
  state: AvatarState;
  since: number;
  log: AvatarState[];
  tier: Tier | null;
  backend: Backend | null;
  ready: boolean;
  energy: Energy;
  pointer: PointerState;
  frames: FrameSummary;
  tuning: Tuning;
  dispatch: (e: AvatarEvent) => void;
  setState: (s: AvatarState) => void;
  setTier: (t: Tier) => void;
  setBackend: (b: Backend) => void;
  setReady: (r: boolean) => void;
  setEnergy: (e: Energy) => void;
  setPointer: (p: Partial<PointerState>) => void;
  setFrames: (f: FrameSummary) => void;
  setTuning: (t: Tuning) => void;
  reset: () => void;
}

const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
const initial = () => ({
  state: "DORMANT" as AvatarState,
  since: now(),
  log: ["DORMANT" as AvatarState],
  tier: null,
  backend: null,
  ready: false,
  energy: ZERO_ENERGY,
  pointer: { x: 0, y: 0, active: false, strength: 1 },
  frames: { p50: 0, p95: 0, count: 0 },
  tuning: {},
});

export const useAvatarStore = create<AvatarStore>()((set, get) => ({
  ...initial(),
  dispatch: (e) => {
    const next = transition(get().state, e);
    if (next !== get().state) get().setState(next);
  },
  setState: (s) => set((st) => ({ state: s, since: now(), log: [...st.log, s].slice(-20) })),
  setTier: (tier) => set({ tier }),
  setBackend: (backend) => set({ backend }),
  setReady: (ready) => set({ ready }),
  setEnergy: (energy) => set({ energy }),
  setPointer: (p) => set((st) => ({ pointer: { ...st.pointer, ...p } })),
  setFrames: (frames) => set({ frames }),
  setTuning: (t) => set((st) => ({ tuning: { ...st.tuning, ...t } })),
  reset: () => set(initial()),
}));
```

`useAvatarState.ts`:

```ts
"use client";
import { useCallback, useEffect, useRef } from "react";
import type { AvatarState, TurnEvent } from "@twin/shared";
import { IDLE_TIMEOUT_S, WAKING_DURATION_S } from "@twin/config";
import { explicitState, fromTurnEvent, type AvatarEvent } from "./state/machine";
import { useAvatarStore } from "./state/store";

export interface AvatarStateApi {
  state: AvatarState;
  send: (e: AvatarEvent) => void;
  applyTurnEvent: (e: TurnEvent) => void;
}

/** Owns the timed transitions: WAKING lasts 1.2 s, IDLE falls DORMANT after 90 s, THINK during DORMANT waits for the wake. */
export function useAvatarState(): AvatarStateApi {
  const state = useAvatarStore((s) => s.state);
  const dispatch = useAvatarStore((s) => s.dispatch);
  const setState = useAvatarStore((s) => s.setState);
  const pendingThink = useRef(false);

  useEffect(() => {
    if (state === "WAKING") {
      const id = setTimeout(() => {
        dispatch("WAKE_DONE");
        if (pendingThink.current) {
          pendingThink.current = false;
          dispatch("THINK");
        }
      }, WAKING_DURATION_S * 1000);
      return () => clearTimeout(id);
    }
    if (state === "IDLE") {
      const id = setTimeout(() => dispatch("INACTIVITY"), IDLE_TIMEOUT_S * 1000);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [state, dispatch]);

  const send = useCallback(
    (e: AvatarEvent) => {
      const current = useAvatarStore.getState().state;
      if (e === "THINK" && (current === "DORMANT" || current === "WAKING")) pendingThink.current = true;
      dispatch(e);
    },
    [dispatch],
  );

  const applyTurnEvent = useCallback(
    (ev: TurnEvent) => {
      const forced = explicitState(ev);
      if (forced) {
        setState(forced);
        return;
      }
      const e = fromTurnEvent(ev);
      if (e) send(e);
    },
    [send, setState],
  );

  return { state, send, applyTurnEvent };
}
```

- [ ] **Step 11: Verify, commit, PR**

```powershell
pnpm format
pnpm lint
pnpm typecheck
pnpm --filter @twin/web test
git add -A
git commit -m "feat(avatar): state machine + zustand store + timers hook, audio band energy, synthetic speech envelope, wake cue"
git push -u origin b5-04-state-audio
gh pr create --fill --title "B5.4a state machine, store, audio energy"
```

---

### Task 5 (B5.1 + B5.3): TSL simulation, WebGPU canvas, public bench page, Playwright smoke

**Branch:** `b5-05-sim`

**Files:**
- Create: `apps/web/src/avatar/sim/easing.ts` (+ `easing.test.ts`), `sim/morph.ts` (+ `morph.test.ts`), `sim/frame.ts` (+ `frame.test.ts`), `sim/uniforms.ts`, `sim/compute.ts`, `sim/wavesSystem.ts`, `sim/palette.ts`
- Create: `apps/web/src/avatar/AvatarCanvas.tsx`, `apps/web/src/avatar/index.ts`
- Create: `apps/web/src/app/bench/avatar/page.tsx`, `apps/web/src/app/bench/avatar/BenchAvatar.tsx`
- Modify: `apps/web/src/lib/auth/public-paths.ts` (+ `public-paths.test.ts`), `apps/web/package.json` (scripts), `apps/web/playwright.config.ts` (new), `apps/web/tests/e2e/avatar-smoke.spec.ts` (new)

**Interfaces:**
- Consumes: `Targets`, `buildTargets`, `strided`, `loadBust` (Task 3); `AVATAR_STATES`, `SHAPE_ID`, `TIERS` (Task 1); store + energy (Task 4); `ANCHORS`.
- Produces:
  - `EASINGS: Record<Easing, (t: number) => number>`
  - `class Morph { shapeA; shapeB; t; start(toShape, duration, easing); update(dt); get eased(): number }`
  - `type UniformValues = { shapeA, shapeB, morph, turbulence, brightness, tint: [r,g,b], corePulse, coreHeat, breathing, vortex, bass, mid, treble, speak, listen, freeze, spring, damping, noiseScale, noiseAmp, size, alpha, pointer: [x,y,z], pointerStrength, pointerRadius, aberration }` (plain numbers — the testable "frame" layer)
  - `computeFrame(input: FrameInput, prev: FrameMemory): { values: UniformValues; memory: FrameMemory }` — pure, drives everything per frame
  - `createSimUniforms(): SimUniforms` (TSL uniform nodes with the same keys) · `writeUniforms(u: SimUniforms, v: UniformValues): void`
  - `createSim(targets: Targets, u: SimUniforms, palette: Palette): { sprite: Sprite; init: ComputeNode; update: ComputeNode; dispose(): void }`
  - `createWaves(points: Float32Array, u: SimUniforms, palette: Palette): { sprite: Sprite; dispose(): void }`
  - `<AvatarCanvas tier?: Tier; forceWebGL?: boolean; className?: string; onReady?: () => void; interactive?: boolean />` — reads/writes the store; exposes nothing else.
  - Bench page contract for tests: `window.__twinAvatar = { ready: boolean; backend: "webgpu" | "webgl" | null; tier: Tier | null; frames: number; stats: { p50: number; p95: number; count: number }; state: AvatarState; log: AvatarState[] }`, refreshed every frame.

- [ ] **Step 1: Branch + Playwright browser**

```powershell
git switch -c b5-05-sim main
pnpm --filter @twin/web exec playwright install chromium
```

- [ ] **Step 2: Failing tests — easing, morph, frame**

`apps/web/src/avatar/sim/easing.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { EASINGS } from "./easing";

describe("EASINGS", () => {
  it.each(Object.keys(EASINGS) as (keyof typeof EASINGS)[])("%s maps 0→0 and 1→1 monotonically", (name) => {
    const f = EASINGS[name];
    expect(f(0)).toBeCloseTo(0);
    expect(f(1)).toBeCloseTo(1);
    let prev = 0;
    for (let t = 0; t <= 1.0001; t += 0.05) {
      const v = f(Math.min(1, t));
      expect(v).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = v;
    }
  });
});
```

`apps/web/src/avatar/sim/morph.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { Morph } from "./morph";

describe("Morph", () => {
  it("starts settled on the initial shape and tweens to the next over the duration", () => {
    const m = new Morph(2);
    expect(m.shapeA).toBe(2);
    expect(m.t).toBe(1);
    m.start(1, 1.0, "linear");
    expect(m.shapeA).toBe(2);
    expect(m.shapeB).toBe(1);
    m.update(0.25);
    expect(m.eased).toBeCloseTo(0.25);
    m.update(1);
    expect(m.t).toBe(1);
    expect(m.eased).toBe(1);
  });
  it("retargeting mid-way continues from the previous target", () => {
    const m = new Morph(0);
    m.start(1, 1, "linear");
    m.update(0.5);
    m.start(3, 1, "linear");
    expect(m.shapeA).toBe(1);
    expect(m.shapeB).toBe(3);
    expect(m.t).toBe(0);
  });
});
```

`apps/web/src/avatar/sim/frame.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { SHAPE_ID } from "@twin/config";
import { ZERO_ENERGY } from "../audio/energy";
import { computeFrame, initialMemory, type FrameInput } from "./frame";

const base: FrameInput = {
  state: "IDLE",
  since: 0,
  now: 0,
  dt: 1 / 60,
  energy: ZERO_ENERGY,
  pointer: { x: 0, y: 0, active: false, strength: 1 },
  tuning: {},
};

function run(inputs: FrameInput[]) {
  let mem = initialMemory("DORMANT");
  const out = [];
  for (const i of inputs) {
    const r = computeFrame(i, mem);
    mem = r.memory;
    out.push(r.values);
  }
  return out;
}

describe("computeFrame", () => {
  it("IDLE targets the ORB with breathing and the IDLE turbulence", () => {
    const [v] = run([base]);
    expect(v?.shapeB).toBe(SHAPE_ID.ORB);
    expect(v?.turbulence).toBeCloseTo(0.25);
    expect(v?.breathing).toBeCloseTo(0.03);
  });
  it("WAKING flashes the RING first, then the HUMANOID, and enables aberration", () => {
    const frames = run([
      { ...base, state: "WAKING", now: 0.0, since: 0 },
      { ...base, state: "WAKING", now: 0.2, since: 0 },
      { ...base, state: "WAKING", now: 0.9, since: 0 },
    ]);
    expect(frames[0]?.shapeB).toBe(SHAPE_ID.RING);
    expect(frames[2]?.shapeB).toBe(SHAPE_ID.HUMANOID);
    expect(frames[0]?.aberration).toBeGreaterThan(0);
  });
  it("SPEAKING feeds mid energy into `speak`; LISTENING into `listen`; others zero", () => {
    const e = { bass: 0.2, mid: 0.8, treble: 0.4 };
    const [sp, li, th] = run([
      { ...base, state: "SPEAKING", energy: e },
      { ...base, state: "LISTENING", energy: e },
      { ...base, state: "THINKING", energy: e },
    ]);
    expect(sp?.speak).toBeCloseTo(0.8 * 0.5);
    expect(sp?.listen).toBe(0);
    expect(li?.listen).toBeCloseTo(0.8 * 0.4);
    expect(th?.speak).toBe(0);
    expect(th?.vortex).toBe(1);
  });
  it("OFFLINE freezes for 0.4 s, then dissolves toward the NEBULA over 2 s with a red tint", () => {
    const [a, b] = run([
      { ...base, state: "OFFLINE", since: 0, now: 0.1 },
      { ...base, state: "OFFLINE", since: 0, now: 0.6 },
    ]);
    expect(a?.freeze).toBe(1);
    expect(b?.freeze).toBe(0);
    expect(b?.shapeB).toBe(SHAPE_ID.NEBULA);
    expect(b?.tint[0]).toBeGreaterThan(b?.tint[2] ?? 1);
  });
  it("tuning overrides win over the state table", () => {
    const [v] = run([{ ...base, tuning: { turbulence: 0.9, size: 0.02 } }]);
    expect(v?.turbulence).toBe(0.9);
    expect(v?.size).toBe(0.02);
  });
  it("core pulse oscillates between the state's min and max", () => {
    const vals = run([0, 0.5, 1, 1.5, 2, 2.5, 3].map((now) => ({ ...base, now })));
    for (const v of vals) {
      expect(v.corePulse).toBeGreaterThanOrEqual(0.45 - 1e-6);
      expect(v.corePulse).toBeLessThanOrEqual(0.75 + 1e-6);
    }
  });
});
```

- [ ] **Step 3: Run to see them fail** — modules not found.

- [ ] **Step 4: Implement easing.ts, morph.ts, frame.ts**

`easing.ts`:

```ts
import type { Easing } from "@twin/config";

export const EASINGS: Record<Easing, (t: number) => number> = {
  linear: (t) => t,
  easeInOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  easeOutExpo: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
};
```

`morph.ts`:

```ts
import type { Easing } from "@twin/config";
import { EASINGS } from "./easing";

/** Tween between two shape ids; the kernel mixes targets by `eased`. */
export class Morph {
  shapeA: number;
  shapeB: number;
  t = 1;
  private elapsed = 0;
  private duration = 1;
  private easing: Easing = "easeInOutCubic";

  constructor(initialShape: number) {
    this.shapeA = initialShape;
    this.shapeB = initialShape;
  }

  start(toShape: number, duration: number, easing: Easing): void {
    if (toShape === this.shapeB && this.t >= 1) return;
    this.shapeA = this.shapeB;
    this.shapeB = toShape;
    this.t = 0;
    this.elapsed = 0;
    this.duration = Math.max(0.01, duration);
    this.easing = easing;
  }

  update(dt: number): void {
    if (this.t >= 1) return;
    this.elapsed += dt;
    this.t = Math.min(1, this.elapsed / this.duration);
  }

  get eased(): number {
    return EASINGS[this.easing](this.t);
  }
}
```

`frame.ts` — the pure per-frame brain of the Avatar (everything the shader needs, as numbers):

```ts
import type { AvatarState } from "@twin/shared";
import { AVATAR_STATES, SHAPE_ID, type StateParams } from "@twin/config";
import type { Energy } from "../audio/energy";
import type { PointerState, Tuning } from "../state/store";
import { Morph } from "./morph";

export interface FrameInput {
  state: AvatarState;
  /** seconds — when `state` was entered (same clock as `now`) */
  since: number;
  now: number;
  dt: number;
  energy: Energy;
  pointer: PointerState;
  tuning: Tuning;
}

export interface UniformValues {
  shapeA: number;
  shapeB: number;
  morph: number;
  turbulence: number;
  brightness: number;
  tint: [number, number, number];
  corePulse: number;
  coreHeat: number;
  breathing: number;
  vortex: number;
  bass: number;
  mid: number;
  treble: number;
  speak: number;
  listen: number;
  freeze: number;
  spring: number;
  damping: number;
  noiseScale: number;
  noiseAmp: number;
  size: number;
  alpha: number;
  pointer: [number, number, number];
  pointerStrength: number;
  pointerRadius: number;
  aberration: number;
}

export interface FrameMemory {
  lastState: AvatarState;
  morph: Morph;
  /** for WAKING's two-step flourish and OFFLINE's freeze */
  phase: number;
}

export const DEFAULTS = { spring: 12, damping: 0.9, noiseScale: 1.6, noiseAmp: 0.9, size: 0.012, alpha: 0.85, pointerRadius: 0.5 } as const;
const OFFLINE_FREEZE_S = 0.4;
const WAKING_RING_S = 0.45;

export function initialMemory(state: AvatarState): FrameMemory {
  return { lastState: state, morph: new Morph(SHAPE_ID[AVATAR_STATES[state].shape]), phase: 0 };
}

function plan(state: AvatarState, p: StateParams, elapsed: number, mem: FrameMemory): void {
  if (state === "WAKING") {
    if (mem.phase === 0) {
      mem.morph.start(SHAPE_ID.RING, 0.4, "easeOutExpo");
      mem.phase = 1;
    }
    if (mem.phase === 1 && elapsed >= WAKING_RING_S) {
      mem.morph.start(SHAPE_ID.HUMANOID, p.morphDuration - WAKING_RING_S, p.easing);
      mem.phase = 2;
    }
    return;
  }
  if (state === "OFFLINE") {
    if (mem.phase === 0 && elapsed >= OFFLINE_FREEZE_S) {
      mem.morph.start(SHAPE_ID.NEBULA, p.morphDuration, p.easing);
      mem.phase = 1;
    }
    return;
  }
  if (mem.phase === 0) {
    mem.morph.start(SHAPE_ID[p.shape], p.morphDuration, p.easing);
    mem.phase = 1;
  }
}

export function computeFrame(input: FrameInput, prev: FrameMemory): { values: UniformValues; memory: FrameMemory } {
  const mem = prev;
  const p = AVATAR_STATES[input.state];
  const elapsed = Math.max(0, input.now - input.since);
  if (input.state !== mem.lastState) {
    mem.lastState = input.state;
    mem.phase = 0;
  }
  plan(input.state, p, elapsed, mem);
  mem.morph.update(input.dt);

  const t = input.tuning;
  const pulsePhase = 0.5 + 0.5 * Math.sin((input.now * Math.PI * 2) / p.corePulse.period);
  const corePulse = p.corePulse.min + (p.corePulse.max - p.corePulse.min) * pulsePhase;
  const e = input.energy;
  const freeze = input.state === "OFFLINE" && elapsed < OFFLINE_FREEZE_S ? 1 : 0;
  const coreHeat = input.state === "THINKING" ? 0.8 : Math.min(1, 0.3 + e.bass * 0.6);

  const values: UniformValues = {
    shapeA: mem.morph.shapeA,
    shapeB: mem.morph.shapeB,
    morph: mem.morph.eased,
    turbulence: t.turbulence ?? p.turbulence,
    brightness: t.brightness ?? p.brightness,
    tint: p.tint,
    corePulse,
    coreHeat,
    breathing: p.breathing,
    vortex: t.vortex ?? p.vortex,
    bass: e.bass,
    mid: e.mid,
    treble: e.treble,
    speak: input.state === "SPEAKING" ? e.mid * p.audioGain : 0,
    listen: input.state === "LISTENING" ? e.mid * p.audioGain : 0,
    freeze,
    spring: t.spring ?? DEFAULTS.spring,
    damping: t.damping ?? DEFAULTS.damping,
    noiseScale: t.noiseScale ?? DEFAULTS.noiseScale,
    noiseAmp: t.noiseAmp ?? DEFAULTS.noiseAmp,
    size: t.size ?? DEFAULTS.size,
    alpha: DEFAULTS.alpha,
    pointer: [input.pointer.x, input.pointer.y, 0],
    pointerStrength: input.pointer.active ? input.pointer.strength : 0,
    pointerRadius: t.pointerRadius ?? DEFAULTS.pointerRadius,
    aberration: input.state === "WAKING" ? p.aberration * Math.max(0, 1 - elapsed / p.morphDuration) : 0,
  };
  return { values, memory: mem };
}
```

- [ ] **Step 5: Run the tests** — easing, morph, frame PASS.

- [ ] **Step 6: Palette, uniforms, kernels, sprite material**

`sim/palette.ts` (the design tokens as linear colours; the CSS stays the source of truth for chrome, this file for the GPU):

```ts
import { Color } from "three";

export interface Palette {
  bg: Color;
  particle: Color;
  deep: Color;
  core: Color;
  coreHot: Color;
  spineFrom: Color;
  spineTo: Color;
  offline: Color;
}

/** docs/06 §5 tokens. Colours are sRGB hex; three converts to linear on construction. */
export const PALETTE: Palette = {
  bg: new Color("#05070d"),
  particle: new Color("#2f9bff"),
  deep: new Color("#0a3d7a"),
  core: new Color("#ffb347"),
  coreHot: new Color("#ff7a1a"),
  spineFrom: new Color("#ffd28a"),
  spineTo: new Color("#2f9bff"),
  offline: new Color("#ff4d4d"),
};
```

`sim/uniforms.ts`:

```ts
import { uniform } from "three/tsl";
import { Vector3 } from "three";
import type { UniformValues } from "./frame";

export function createSimUniforms() {
  return {
    shapeA: uniform(2),
    shapeB: uniform(2),
    morph: uniform(1),
    turbulence: uniform(0.15),
    brightness: uniform(0.35),
    tint: uniform(new Vector3(1, 1, 1)),
    corePulse: uniform(0.3),
    coreHeat: uniform(0.3),
    breathing: uniform(0),
    vortex: uniform(0),
    bass: uniform(0),
    mid: uniform(0),
    treble: uniform(0),
    speak: uniform(0),
    listen: uniform(0),
    freeze: uniform(0),
    spring: uniform(12),
    damping: uniform(0.9),
    noiseScale: uniform(1.6),
    noiseAmp: uniform(0.9),
    size: uniform(0.012),
    alpha: uniform(0.85),
    pointer: uniform(new Vector3()),
    pointerStrength: uniform(0),
    pointerRadius: uniform(0.5),
    coreEnd: uniform(0),
    spineEnd: uniform(0),
  };
}
export type SimUniforms = ReturnType<typeof createSimUniforms>;

export function writeUniforms(u: SimUniforms, v: UniformValues): void {
  u.shapeA.value = v.shapeA;
  u.shapeB.value = v.shapeB;
  u.morph.value = v.morph;
  u.turbulence.value = v.turbulence;
  u.brightness.value = v.brightness;
  u.tint.value.set(v.tint[0], v.tint[1], v.tint[2]);
  u.corePulse.value = v.corePulse;
  u.coreHeat.value = v.coreHeat;
  u.breathing.value = v.breathing;
  u.vortex.value = v.vortex;
  u.bass.value = v.bass;
  u.mid.value = v.mid;
  u.treble.value = v.treble;
  u.speak.value = v.speak;
  u.listen.value = v.listen;
  u.freeze.value = v.freeze;
  u.spring.value = v.spring;
  u.damping.value = v.damping;
  u.noiseScale.value = v.noiseScale;
  u.noiseAmp.value = v.noiseAmp;
  u.size.value = v.size;
  u.alpha.value = v.alpha;
  u.pointer.value.set(v.pointer[0], v.pointer[1], v.pointer[2]);
  u.pointerStrength.value = v.pointerStrength;
  u.pointerRadius.value = v.pointerRadius;
}
```

`sim/compute.ts` — the GPU side. API names were verified against three 0.185.1 (`three/tsl` exports every function used below; `SpriteNodeMaterial`, `Sprite`, `AdditiveBlending` come from `three/webgpu`). If a call errors at runtime, open `node_modules/three/src/nodes/TSL.js` and the matching file under `node_modules/three/src/nodes/` to check the signature — do not fall back to GLSL.

```ts
import {
  Fn,
  float,
  hash,
  instanceIndex,
  instancedArray,
  length,
  mix,
  mx_noise_vec3,
  normalize,
  oneMinus,
  select,
  shapeCircle,
  sin,
  smoothstep,
  step,
  time,
  deltaTime,
  vec3,
  vec4,
  uniform,
} from "three/tsl";
import { AdditiveBlending, Sprite, SpriteNodeMaterial, Vector3, type ComputeNode } from "three/webgpu";
import { ANCHORS } from "./canonical";
import type { Palette } from "./palette";
import type { Targets } from "./targets";
import type { SimUniforms } from "./uniforms";

export interface Sim {
  sprite: Sprite;
  init: ComputeNode;
  update: ComputeNode;
  dispose(): void;
}

const v3 = (a: readonly [number, number, number]) => new Vector3(a[0], a[1], a[2]);

export function createSim(targets: Targets, u: SimUniforms, palette: Palette): Sim {
  const n = targets.n;
  u.coreEnd.value = targets.coreEnd;
  u.spineEnd.value = targets.spineEnd;

  const positions = instancedArray(n, "vec3");
  const velocities = instancedArray(n, "vec3");
  const tHumanoid = instancedArray(targets.humanoid, "vec3");
  const tOrb = instancedArray(targets.orb, "vec3");
  const tNebula = instancedArray(targets.nebula, "vec3");
  const tRing = instancedArray(targets.ring, "vec3");
  const regions = instancedArray(Float32Array.from(targets.regions), "float");
  const spineT = instancedArray(targets.spineT, "float");

  const headAnchor = uniform(v3(ANCHORS.head));
  const faceAnchor = uniform(v3(ANCHORS.face));
  const earL = uniform(v3(ANCHORS.earL));
  const earR = uniform(v3(ANCHORS.earR));

  // shape id → target position for this particle (0 HUMANOID, 1 ORB, 2 NEBULA, 3 RING — SHAPE_ID in @twin/config)
  const shapeAt = (id: ReturnType<typeof float>) => {
    const i = instanceIndex;
    return select(
      id.lessThan(0.5),
      tHumanoid.element(i),
      select(id.lessThan(1.5), tOrb.element(i), select(id.lessThan(2.5), tNebula.element(i), tRing.element(i))),
    );
  };
  const roleOf = () => {
    const fi = float(instanceIndex);
    return select(fi.lessThan(u.coreEnd), float(0), select(fi.lessThan(u.spineEnd), float(1), float(2)));
  };

  const init = Fn(() => {
    positions.element(instanceIndex).assign(tNebula.element(instanceIndex));
    velocities.element(instanceIndex).assign(vec3(0));
  })().compute(n);

  const update = Fn(() => {
    const i = instanceIndex;
    const pos = positions.element(i);
    const vel = velocities.element(i);
    const seed = hash(i);
    const role = roleOf();
    const isMain = role.equal(2);

    const target = mix(shapeAt(float(u.shapeA)), shapeAt(float(u.shapeB)), smoothstep(0, 1, u.morph)).toVar();
    // ORB breathing (±3 % over 4 s) — main particles only
    const breath = float(1).add(u.breathing.mul(sin(time.mul(Math.PI / 2))).mul(select(isMain, 1, 0)));
    target.mulAssign(breath);

    const dt = deltaTime.min(0.033);
    const flow = mx_noise_vec3(pos.mul(u.noiseScale).add(vec3(seed.mul(10), time.mul(0.15), 0)))
      .mul(u.turbulence.mul(u.noiseAmp));
    // THINKING: vortex around the head
    const rel = pos.sub(headAnchor);
    const rxz = length(rel.xz).max(0.05);
    const tangent = vec3(rel.z.negate(), 0, rel.x).div(rxz);
    const vortex = tangent.mul(u.vortex.mul(2.5)).mul(smoothstep(0.9, 0.0, length(rel)));
    // pointer: repel (hover) or attract (long press) on the z = 0 plane
    const dp = pos.xy.sub(u.pointer.xy);
    const dl = length(dp).max(0.001);
    const push = vec3(dp.div(dl), 0).mul(smoothstep(u.pointerRadius, 0, dl)).mul(u.pointerStrength.mul(3));
    // SPEAKING: face region pulses outward with mid energy
    const isFace = regions.element(i).equal(1);
    const fromFace = pos.sub(faceAnchor);
    const pulse = normalize(fromFace).mul(u.speak.mul(0.8)).mul(select(isFace, 1, 0.1));
    // LISTENING: particles near the ears pull inward with mic energy
    const ear = select(pos.x.lessThan(0), earL, earR);
    const toEar = ear.sub(pos);
    const earPull = toEar.mul(u.listen.mul(2)).mul(smoothstep(0.6, 0.0, length(toEar)));

    const acc = target.sub(pos).mul(u.spring).add(flow).add(vortex).add(push).add(pulse).add(earPull);
    vel.assign(vel.mul(u.damping).add(acc.mul(dt)).mul(oneMinus(u.freeze)));
    pos.addAssign(vel.mul(dt));
  })().compute(n);

  const material = new SpriteNodeMaterial();
  material.positionNode = positions.toAttribute();
  const role = roleOf();
  const seed = hash(instanceIndex.add(7));
  const roleSize = select(role.equal(0), float(2.4), select(role.equal(1), float(1.5), float(1)));
  const sparkle = float(1).add(u.treble.mul(step(0.9, seed)).mul(1.5));
  material.scaleNode = u.size.mul(roleSize).mul(float(0.7).add(seed.mul(0.6))).mul(sparkle);

  const p = positions.element(instanceIndex);
  const depth = smoothstep(-0.6, 0.6, p.z);
  const mainColor = mix(vec3(palette.deep.r, palette.deep.g, palette.deep.b), vec3(palette.particle.r, palette.particle.g, palette.particle.b), seed.mul(0.6).add(depth.mul(0.4)));
  const coreColor = mix(vec3(palette.core.r, palette.core.g, palette.core.b), vec3(palette.coreHot.r, palette.coreHot.g, palette.coreHot.b), u.coreHeat)
    .mul(u.corePulse.mul(1.5).add(0.5))
    .mul(float(1).add(u.bass.mul(0.8)));
  const spineColor = mix(vec3(palette.spineFrom.r, palette.spineFrom.g, palette.spineFrom.b), vec3(palette.spineTo.r, palette.spineTo.g, palette.spineTo.b), spineT.element(instanceIndex));
  const faceGlow = select(regions.element(instanceIndex).equal(1), u.speak.mul(1.2), float(0));
  const color = select(role.equal(0), coreColor, select(role.equal(1), spineColor, mainColor.mul(float(1).add(faceGlow))));
  material.colorNode = vec4(color.mul(u.brightness).mul(u.tint), 1);
  material.opacityNode = shapeCircle().mul(u.alpha).mul(select(role.equal(0), float(1), float(0.7)));
  material.transparent = true;
  material.depthWrite = false;
  material.blending = AdditiveBlending;

  const sprite = new Sprite(material);
  sprite.count = n;
  sprite.frustumCulled = false;

  return {
    sprite,
    init,
    update,
    dispose: () => {
      material.dispose();
    },
  };
}
```

`sim/wavesSystem.ts`:

```ts
import { float, hash, instanceIndex, instancedArray, mix, mx_noise_float, shapeCircle, time, vec3, vec4 } from "three/tsl";
import { AdditiveBlending, Sprite, SpriteNodeMaterial } from "three/webgpu";
import type { Palette } from "./palette";
import type { SimUniforms } from "./uniforms";

/** Background heightfield sheets: static points bobbed by noise in the vertex stage, no compute needed. */
export function createWaves(points: Float32Array, u: SimUniforms, palette: Palette): { sprite: Sprite; dispose(): void } {
  const count = points.length / 3;
  const base = instancedArray(points, "vec3");
  const material = new SpriteNodeMaterial();
  const p = base.element(instanceIndex);
  const bob = mx_noise_float(vec3(p.x.mul(0.8), p.z.mul(0.8), time.mul(0.12))).mul(0.15);
  material.positionNode = p.add(vec3(0, bob, 0));
  material.scaleNode = float(0.008).mul(float(0.6).add(hash(instanceIndex).mul(0.8)));
  const tint = mix(vec3(palette.deep.r, palette.deep.g, palette.deep.b), vec3(palette.particle.r, palette.particle.g, palette.particle.b), 0.35);
  material.colorNode = vec4(tint.mul(u.brightness).mul(0.5), 1);
  material.opacityNode = shapeCircle().mul(0.35);
  material.transparent = true;
  material.depthWrite = false;
  material.blending = AdditiveBlending;
  const sprite = new Sprite(material);
  sprite.count = count;
  sprite.frustumCulled = false;
  return { sprite, dispose: () => material.dispose() };
}
```

- [ ] **Step 7: AvatarCanvas**

`apps/web/src/avatar/AvatarCanvas.tsx`:

```tsx
"use client";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Color, Vector3, type PerspectiveCamera } from "three";
import type { WebGPURenderer } from "three/webgpu";
import { TIERS, type Tier } from "@twin/config";
import { FrameStats } from "./telemetry/frametime";
import { baseTier, parseTierOverride, readSignals, tierFromProbe } from "./tier";
import { loadBust } from "./sim/bust";
import { computeFrame, initialMemory, type FrameMemory } from "./sim/frame";
import { PALETTE } from "./sim/palette";
import { createSim } from "./sim/compute";
import { buildTargets, strided, type Targets } from "./sim/targets";
import { createSimUniforms, writeUniforms } from "./sim/uniforms";
import { createWaves } from "./sim/wavesSystem";
import { useAvatarStore } from "./state/store";

export interface AvatarCanvasProps {
  /** force a tier (tests, playground); otherwise signals + probe decide */
  tier?: Tier;
  forceWebGL?: boolean;
  className?: string;
  /** pointer repulsion / long-press attract / click-to-wake */
  interactive?: boolean;
  onReady?: () => void;
  onWake?: () => void;
}

const SEED = 20260904;
const PROBE_S = 2;

function ParticleSystem({ targets, tier, onReady }: { targets: Targets; tier: Tier; onReady: () => void }) {
  const gl = useThree((s) => s.gl) as unknown as WebGPURenderer;
  const scene = useThree((s) => s.scene);
  const uniforms = useMemo(() => createSimUniforms(), []);
  const sim = useMemo(() => createSim(targets, uniforms, PALETTE), [targets, uniforms]);
  const wavesN = TIERS[tier].waves;
  const wv = useMemo(() => (wavesN > 0 ? createWaves(targets.waves, uniforms, PALETTE) : null), [targets, uniforms, wavesN]);
  const memory = useRef<FrameMemory>(initialMemory(useAvatarStore.getState().state));
  const stats = useRef(new FrameStats());
  const last = useRef(0);

  useEffect(() => {
    scene.add(sim.sprite);
    if (wv) scene.add(wv.sprite);
    let cancelled = false;
    void gl.computeAsync(sim.init).then(() => {
      if (!cancelled) onReady();
    });
    return () => {
      cancelled = true;
      scene.remove(sim.sprite);
      if (wv) scene.remove(wv.sprite);
      sim.dispose();
      wv?.dispose();
    };
  }, [sim, wv, scene, gl, onReady]);

  useFrame((_, dt) => {
    const s = useAvatarStore.getState();
    const now = performance.now() / 1000;
    const r = computeFrame(
      { state: s.state, since: s.since / 1000, now, dt, energy: s.energy, pointer: s.pointer, tuning: s.tuning },
      memory.current,
    );
    memory.current = r.memory;
    writeUniforms(uniforms, r.values);
    gl.compute(sim.update);
    if (last.current) stats.current.push((now - last.current) * 1000);
    last.current = now;
    if (stats.current.count % 30 === 0) s.setFrames({ p50: stats.current.p50, p95: stats.current.p95, count: stats.current.count });
  });
  return null;
}

/** Turns pointer events into world-space coordinates on the z = 0 plane. */
function PointerTracker({ onWake }: { onWake?: () => void }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const setPointer = useAvatarStore((s) => s.setPointer);
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    const el = gl.domElement;
    let pressTimer: ReturnType<typeof setTimeout> | null = null;
    const toWorld = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      const v = new Vector3(nx, ny, 0.5).unproject(camera);
      const dir = v.sub(camera.position).normalize();
      const t = -camera.position.z / dir.z;
      return camera.position.clone().add(dir.multiplyScalar(t));
    };
    const move = (e: PointerEvent) => {
      const w = toWorld(e);
      setPointer({ x: w.x, y: w.y, active: true });
    };
    const leave = () => setPointer({ active: false, strength: 1 });
    const down = () => {
      pressTimer = setTimeout(() => setPointer({ strength: -1 }), 350);
    };
    const up = () => {
      if (pressTimer) clearTimeout(pressTimer);
      pressTimer = null;
      setPointer({ strength: 1 });
    };
    const click = () => onWake?.();
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointerup", up);
    el.addEventListener("click", click);
    return () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("click", click);
    };
  }, [camera, gl, setPointer, onWake]);
  return null;
}

export function AvatarCanvas({ tier: tierProp, forceWebGL, className, interactive = true, onReady, onWake }: AvatarCanvasProps) {
  const [tier, setTierLocal] = useState<Tier | null>(tierProp ?? null);
  const [targets, setTargets] = useState<Targets | null>(null);
  const [frameloop, setFrameloop] = useState<"always" | "never">("always");
  const setTier = useAvatarStore((s) => s.setTier);
  const setBackend = useAvatarStore((s) => s.setBackend);
  const setReady = useAvatarStore((s) => s.setReady);
  const probed = useRef(false);

  // 1. decide the candidate tier
  useEffect(() => {
    if (tierProp) return;
    const override = parseTierOverride(window.location.search);
    setTierLocal(override ?? baseTier(readSignals(navigator, window)));
  }, [tierProp]);

  // 2. build targets for the tier (once per tier)
  useEffect(() => {
    if (!tier) return;
    let cancelled = false;
    setTier(tier);
    void loadBust().then((bust) => {
      if (cancelled) return;
      setTargets((prev) => (prev && prev.n >= TIERS[tier].particles ? strided(prev, TIERS[tier].particles) : buildTargets({ n: TIERS[tier].particles, waves: TIERS[tier].waves, seed: SEED, bust })));
    });
    return () => {
      cancelled = true;
    };
  }, [tier, setTier]);

  // 3. pause when hidden; Low tier renders one second then stops
  useEffect(() => {
    const onVis = () => setFrameloop(document.hidden ? "never" : "always");
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const handleReady = useCallback(() => {
    setReady(true);
    onReady?.();
    if (tier === "low") setTimeout(() => setFrameloop("never"), 1000);
    // 4. probe: after 2 s, step down once if p95 is over budget (skipped when a tier was forced)
    if (!tierProp && !probed.current && tier && tier !== "low") {
      probed.current = true;
      setTimeout(() => {
        const next = tierFromProbe(tier, useAvatarStore.getState().frames.p95);
        if (next !== tier) setTierLocal(next);
      }, PROBE_S * 1000);
    }
  }, [tier, tierProp, onReady, setReady]);

  if (!tier || !targets) return <div className={className} data-avatar="loading" />;
  const dprCap = TIERS[tier].dprCap;
  return (
    <div className={className} data-avatar="canvas" data-tier={tier}>
      <Canvas
        frameloop={frameloop}
        dpr={[1, dprCap]}
        camera={{ position: [0, 0.05, 3.1], fov: 34, near: 0.1, far: 50 }}
        gl={async (props) => {
          const { WebGPURenderer } = await import("three/webgpu");
          const renderer = new WebGPURenderer({
            canvas: props.canvas as HTMLCanvasElement,
            antialias: false,
            powerPreference: "high-performance",
            forceWebGL: !!forceWebGL,
          });
          await renderer.init();
          setBackend(renderer.backend.isWebGPUBackend ? "webgpu" : "webgl");
          renderer.setClearColor(new Color("#05070d"), 1);
          return renderer;
        }}
      >
        <ParticleSystem targets={targets} tier={tier} onReady={handleReady} />
        {interactive ? <PointerTracker onWake={onWake} /> : null}
      </Canvas>
    </div>
  );
}
```

Typing notes for the implementer: R3F 9's `gl` prop accepts `(defaultProps) => Renderer | Promise<Renderer>`; `WebGPURenderer` satisfies the minimal `Renderer` interface. `renderer.backend.isWebGPUBackend` is typed in `@types/three` — if not, narrow with `"isWebGPUBackend" in renderer.backend`. `useFrame` runs before R3F's own render at priority 0, so `gl.compute(update)` precedes the draw. `since` is stored in milliseconds (performance.now()) by the store and converted to seconds here.

`apps/web/src/avatar/index.ts`:

```ts
export { AvatarCanvas } from "./AvatarCanvas";
export { useAvatarState } from "./useAvatarState";
export { useAvatarStore } from "./state/store";
```

- [ ] **Step 8: Public bench page + public path**

`apps/web/src/lib/auth/public-paths.ts` → `export const PUBLIC_PREFIXES = ["/login", "/auth", "/bench"];` and add to `public-paths.test.ts`:

```ts
it("the avatar bench page is public (docs/plans/phase-b5.md D6)", () => {
  expect(isPublicPath("/bench/avatar")).toBe(true);
  expect(isPublicPath("/benchmark")).toBe(false);
});
```

`apps/web/src/app/bench/avatar/page.tsx`:

```tsx
import { BenchAvatar } from "./BenchAvatar";

export const dynamic = "force-dynamic";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function BenchAvatarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  return <BenchAvatar tier={one(sp.tier)} webgl={one(sp.webgl) === "1"} demo={one(sp.demo) === "1"} state={one(sp.state)} />;
}
```

`apps/web/src/app/bench/avatar/BenchAvatar.tsx`:

```tsx
"use client";
import dynamic from "next/dynamic";
import { useEffect, useRef } from "react";
import { AvatarState } from "@twin/shared";
import { TIER_ORDER, type Tier } from "@twin/config";
import { useAvatarStore } from "@/avatar/state/store";

const AvatarCanvas = dynamic(() => import("@/avatar/AvatarCanvas").then((m) => m.AvatarCanvas), { ssr: false });

declare global {
  interface Window {
    __twinAvatar?: {
      ready: boolean;
      backend: string | null;
      tier: Tier | null;
      frames: number;
      stats: { p50: number; p95: number; count: number };
      state: string;
      log: string[];
    };
  }
}

export function BenchAvatar({ tier, webgl, demo, state }: { tier?: string; webgl: boolean; demo: boolean; state?: string }) {
  const forced = tier && (TIER_ORDER as readonly string[]).includes(tier) ? (tier as Tier) : undefined;
  const frames = useRef(0);

  useEffect(() => {
    const parsed = AvatarState.safeParse(state);
    if (parsed.success) useAvatarStore.getState().setState(parsed.data);
  }, [state]);

  useEffect(() => {
    const publish = () => {
      const s = useAvatarStore.getState();
      window.__twinAvatar = { ready: s.ready, backend: s.backend, tier: s.tier, frames: frames.current, stats: s.frames, state: s.state, log: s.log };
    };
    const unsub = useAvatarStore.subscribe(publish);
    let raf = 0;
    const tick = () => {
      frames.current += 1;
      publish();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      unsub();
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <main data-theme="dark" data-bench="avatar" data-demo={demo ? "1" : "0"} className="fixed inset-0 bg-twin-bg">
      <AvatarCanvas tier={forced} forceWebGL={webgl} className="h-full w-full" interactive={false} />
    </main>
  );
}
```

(`demo` is wired to the demo driver in Task 8; here it only sets the attribute.)

- [ ] **Step 9: Playwright config + smoke test**

`apps/web/playwright.config.ts`:

```ts
import { defineConfig, devices } from "@playwright/test";

const CI = !!process.env.CI;
const PORT = 3100;
export const BASE = `http://localhost:${PORT}`;

/** SwiftShader flags let headless Chromium on a GPU-less runner still run WebGL2 (and WebGPU where the build allows). */
const gpuArgs = CI
  ? ["--enable-unsafe-webgpu", "--enable-features=Vulkan,UnsafeWebGPU", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
  : ["--enable-unsafe-webgpu", "--ignore-gpu-blocklist"];

export default defineConfig({
  testDir: "tests",
  timeout: 90_000,
  retries: CI ? 1 : 0,
  reporter: CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: { baseURL: BASE, headless: true, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], launchOptions: { args: gpuArgs } } }],
  webServer: {
    command: `pnpm exec next start -p ${PORT}`,
    url: `${BASE}/bench/avatar?tier=low`,
    reuseExistingServer: !CI,
    timeout: 180_000,
  },
});
```

`apps/web/tests/e2e/avatar-smoke.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("bench page boots the particle system on WebGPU or WebGL and keeps rendering", async ({ page }) => {
  await page.goto("/bench/avatar?tier=low");
  await page.waitForFunction(() => window.__twinAvatar?.ready === true, null, { timeout: 60_000 });
  const first = await page.evaluate(() => window.__twinAvatar);
  expect(["webgpu", "webgl"]).toContain(first?.backend);
  expect(first?.tier).toBe("low");
  await page.waitForTimeout(1500);
  const later = await page.evaluate(() => window.__twinAvatar);
  expect((later?.frames ?? 0) - (first?.frames ?? 0)).toBeGreaterThan(20);
});

test("state can be forced through the query string", async ({ page }) => {
  await page.goto("/bench/avatar?tier=low&state=THINKING");
  await page.waitForFunction(() => window.__twinAvatar?.state === "THINKING");
});
```

Add to `apps/web/package.json` scripts: `"test:e2e": "playwright test"` and make sure `test` (vitest) does not pick up `tests/**` (the vitest include is `src/**/*.test.ts`, so it does not).

- [ ] **Step 10: Run everything locally**

```powershell
pnpm --filter @twin/web build
pnpm --filter @twin/web test:e2e
```

Expected: both tests pass on this laptop (Chrome 151 → `backend: "webgpu"`). Then open `pnpm dev` → `http://localhost:3000/bench/avatar` and `?tier=ultra`, `?webgl=1`, `?state=SPEAKING`: a blue particle cloud on the dark field, amber core visible, waves at the sides; `?webgl=1` looks the same (slower). If nothing renders, check the browser console: a TSL error names the node — fix the node call, never the backend.

- [ ] **Step 11: Verify, commit, PR**

```powershell
pnpm format
pnpm lint
pnpm typecheck
pnpm --filter @twin/web test
git add -A
git commit -m "feat(avatar): TSL compute simulation (spring + noise flow + state forces), sprite material, waves, WebGPU canvas with WebGL fallback, tier probe, public bench page, Playwright smoke"
git push -u origin b5-05-sim
gh pr create --fill --title "B5.1+B5.3 simulation, canvas, bench page"
```

---

### Task 6 (B5.5): post-processing — bloom, chromatic aberration on WAKING, vignette

**Branch:** `b5-06-post`

**Files:**
- Create: `apps/web/src/avatar/post/pipeline.ts`, `apps/web/src/avatar/post/params.ts` (+ `params.test.ts`)
- Modify: `apps/web/src/avatar/AvatarCanvas.tsx` (mount the pipeline), `apps/web/src/avatar/sim/frame.ts` (already emits `aberration`)

**Interfaces:**
- Consumes: `TIERS[tier].bloom`, `UniformValues.aberration`, `Tuning.bloomStrength/bloomThreshold`.
- Produces: `bloomParams(mode: "full" | "cheap" | "off", tuning): { strength, radius, threshold } | null` (pure) · `createPipeline(renderer, scene, camera, opts: { bloom: BloomMode }): { render(): void; setAberration(v: number): void; setBloom(p): void; dispose(): void }` · `<PostPass tier />` component inside the Canvas.

- [ ] **Step 1: Branch** — `git switch -c b5-06-post main`

- [ ] **Step 2: Failing test for the pure params**

`apps/web/src/avatar/post/params.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { bloomParams } from "./params";

describe("bloomParams", () => {
  it("full bloom blooms only the core and spine (high threshold), cheap is weaker, off is null", () => {
    expect(bloomParams("off", {})).toBeNull();
    const full = bloomParams("full", {});
    const cheap = bloomParams("cheap", {});
    expect(full?.threshold).toBeGreaterThanOrEqual(0.7);
    expect(cheap?.strength).toBeLessThan(full?.strength ?? 0);
    expect(cheap?.radius).toBeLessThan(full?.radius ?? 0);
  });
  it("tuning overrides strength and threshold", () => {
    expect(bloomParams("full", { bloomStrength: 2, bloomThreshold: 0.2 })).toMatchObject({ strength: 2, threshold: 0.2 });
  });
});
```

- [ ] **Step 3: Run to see it fail** — module not found.

- [ ] **Step 4: Implement params.ts and pipeline.ts**

`params.ts`:

```ts
import type { Tuning } from "../state/store";

export type BloomMode = "full" | "cheap" | "off";
export interface BloomParams {
  strength: number;
  radius: number;
  threshold: number;
}

/** docs/06 §1: threshold tuned so only the core and spine bloom. */
export function bloomParams(mode: BloomMode, tuning: Tuning): BloomParams | null {
  if (mode === "off") return null;
  const base = mode === "full" ? { strength: 0.9, radius: 0.35, threshold: 0.75 } : { strength: 0.55, radius: 0.15, threshold: 0.85 };
  return { ...base, strength: tuning.bloomStrength ?? base.strength, threshold: tuning.bloomThreshold ?? base.threshold };
}
```

`pipeline.ts` (verified against three 0.185.1: `RenderPipeline` in `three/webgpu`; `pass` in `three/tsl`; `bloom(node, strength, radius, threshold)` from `three/addons/tsl/display/BloomNode.js`; `chromaticAberration(node, strength, center, scale)` from `three/addons/tsl/display/ChromaticAberrationNode.js`):

```ts
import { length, oneMinus, screenUV, smoothstep, uniform } from "three/tsl";
import { RenderPipeline, type Camera, type Scene, type WebGPURenderer } from "three/webgpu";
import { bloom } from "three/addons/tsl/display/BloomNode.js";
import { chromaticAberration } from "three/addons/tsl/display/ChromaticAberrationNode.js";
import { pass } from "three/tsl";
import type { BloomParams } from "./params";

export interface PostPipeline {
  render(): void;
  setAberration(v: number): void;
  setBloom(p: BloomParams): void;
  dispose(): void;
}

export function createPipeline(renderer: WebGPURenderer, scene: Scene, camera: Camera, opts: { bloom: BloomParams | null; vignette?: number }): PostPipeline {
  const pipeline = new RenderPipeline(renderer);
  const scenePass = pass(scene, camera);
  const color = scenePass.getTextureNode("output");
  const uAberration = uniform(0);
  const uVignette = uniform(opts.vignette ?? 0.35);

  let out = color;
  let bloomNode: ReturnType<typeof bloom> | null = null;
  if (opts.bloom) {
    bloomNode = bloom(color, opts.bloom.strength, opts.bloom.radius, opts.bloom.threshold);
    out = color.add(bloomNode);
  }
  // chromatic aberration only fires on WAKING (strength 0 otherwise); skipped entirely when bloom is off (Low/Mid-cheap keep it)
  if (opts.bloom) out = chromaticAberration(out, uAberration, null, 1.1);
  const vig = oneMinus(smoothstep(0.55, 1.35, length(screenUV.sub(0.5)).mul(2)).mul(uVignette));
  pipeline.outputNode = out.mul(vig);

  return {
    render: () => pipeline.render(),
    setAberration: (v) => {
      uAberration.value = v * 0.6;
    },
    setBloom: (p) => {
      if (!bloomNode) return;
      bloomNode.strength.value = p.strength;
      bloomNode.radius.value = p.radius;
      bloomNode.threshold.value = p.threshold;
    },
    dispose: () => pipeline.dispose(),
  };
}
```

If `bloomNode.strength` is not typed as a uniform in `@types/three`, cast: `(bloomNode as unknown as { strength: { value: number } })`. Likewise for `RenderPipeline.dispose` if absent — then drop the call.

- [ ] **Step 5: Mount it in the canvas**

In `AvatarCanvas.tsx` add a `PostPass` component and render it inside `<Canvas>` after `ParticleSystem`:

```tsx
function PostPass({ tier, aberration }: { tier: Tier; aberration: React.RefObject<number> }) {
  const gl = useThree((s) => s.gl) as unknown as WebGPURenderer;
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const tuning = useAvatarStore((s) => s.tuning);
  const pipe = useMemo(() => createPipeline(gl, scene, camera, { bloom: bloomParams(TIERS[tier].bloom, tuning) }), [gl, scene, camera, tier]); // tuning applied through setBloom below
  useEffect(() => {
    const p = bloomParams(TIERS[tier].bloom, tuning);
    if (p) pipe.setBloom(p);
  }, [pipe, tier, tuning]);
  useEffect(() => () => pipe.dispose(), [pipe]);
  useFrame(() => {
    pipe.setAberration(aberration.current ?? 0);
    pipe.render();
  }, 1); // priority 1: R3F stops auto-rendering; the pipeline draws the frame
  return null;
}
```

`ParticleSystem` writes `aberration.current = r.values.aberration` each frame (add a shared `useRef(0)` in `AvatarCanvas` passed to both). Import `bloomParams` and `createPipeline`.

- [ ] **Step 6: Visual check + smoke**

`pnpm dev` → `/bench/avatar?tier=ultra&state=WAKING` right after load shows the ring flash with colour fringing for ~1 s; `?state=SPEAKING` shows the amber core blooming while the blue cloud stays crisp; `?tier=low` has no bloom. Then `pnpm --filter @twin/web build && pnpm --filter @twin/web test:e2e` still passes (the smoke test exercises the pipeline on both backends).

- [ ] **Step 7: Verify, commit, PR**

```powershell
pnpm format && pnpm lint && pnpm typecheck && pnpm --filter @twin/web test
git add -A
git commit -m "feat(avatar): post pipeline — bloom tuned to core/spine, chromatic aberration on WAKING, vignette; per-tier bloom modes"
git push -u origin b5-06-post
gh pr create --fill --title "B5.5 post-processing"
```

---

### Task 7 (B5.6): `/dev/avatar` playground — Leva controls, state stepper, audio injector, frame readout

**Branch:** `b5-07-playground`

**Files:**
- Create: `apps/web/src/app/(owner)/dev/avatar/page.tsx`, `apps/web/src/app/(owner)/dev/avatar/DevAvatar.tsx`, `apps/web/src/avatar/audio/useEnergyInput.ts`, `apps/web/src/avatar/audio/energyMode.ts` (+ `energyMode.test.ts`)
- Modify: `docs/runbooks/local-dev.md` (playground section)

**Interfaces:**
- Consumes: `AvatarCanvas`, `useAvatarStore` (`setState`, `setTuning`, `setEnergy`, `frames`, `backend`, `tier`), `createEnergySource`, `micSource`, `fileSource`, `synthEnergy`, `ZERO_ENERGY`.
- Produces: `type EnergyMode = "none" | "synth" | "file" | "mic"` · `energyForMode(mode, tSeconds, live: Energy | null): Energy` (pure) · `useEnergyInput(mode, file?)` — a hook that runs the chosen source on `requestAnimationFrame` and calls `setEnergy` every frame.

- [ ] **Step 1: Branch** — `git switch -c b5-07-playground main`

- [ ] **Step 2: Failing test for the pure mode logic**

`apps/web/src/avatar/audio/energyMode.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { ZERO_ENERGY } from "./energy";
import { energyForMode } from "./energyMode";

describe("energyForMode", () => {
  it("none → zero; synth → synthetic envelope; file/mic → the live reading or zero when absent", () => {
    expect(energyForMode("none", 3, { bass: 1, mid: 1, treble: 1 })).toEqual(ZERO_ENERGY);
    expect(energyForMode("synth", 0.3, null).mid).toBeGreaterThan(0);
    expect(energyForMode("file", 3, { bass: 0.2, mid: 0.4, treble: 0.1 }).mid).toBe(0.4);
    expect(energyForMode("mic", 3, null)).toEqual(ZERO_ENERGY);
  });
});
```

- [ ] **Step 3: Run to see it fail** — module not found.

- [ ] **Step 4: Implement energyMode.ts and useEnergyInput.ts**

`energyMode.ts`:

```ts
import { ZERO_ENERGY, type Energy } from "./energy";
import { synthEnergy } from "./synth";

export type EnergyMode = "none" | "synth" | "file" | "mic";
export const ENERGY_MODES: readonly EnergyMode[] = ["none", "synth", "file", "mic"];

export function energyForMode(mode: EnergyMode, tSeconds: number, live: Energy | null): Energy {
  switch (mode) {
    case "synth":
      return synthEnergy(tSeconds);
    case "file":
    case "mic":
      return live ?? ZERO_ENERGY;
    default:
      return ZERO_ENERGY;
  }
}
```

`useEnergyInput.ts`:

```ts
"use client";
import { useEffect, useRef } from "react";
import { useAvatarStore } from "../state/store";
import { createEnergySource, fileSource, micSource, type EnergySource } from "./analyser";
import { energyForMode, type EnergyMode } from "./energyMode";
import { ZERO_ENERGY } from "./energy";

/** Feeds the store's energy from a synthetic envelope, an audio file, or the microphone. */
export function useEnergyInput(mode: EnergyMode, file: File | null): void {
  const setEnergy = useAvatarStore((s) => s.setEnergy);
  const ctxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    let raf = 0;
    let source: EnergySource | null = null;
    let stop: (() => void) | null = null;
    let cancelled = false;
    const t0 = performance.now();

    const ctx = () => (ctxRef.current ??= new AudioContext());

    const setup = async () => {
      if (mode === "file" && file) {
        const f = await fileSource(ctx(), file);
        source = createEnergySource(ctx(), f.node);
        f.start();
        stop = f.stop;
      } else if (mode === "mic") {
        const m = await micSource(ctx());
        source = createEnergySource(ctx(), m.node);
        stop = m.stop;
      }
      if (cancelled) return;
      const tick = () => {
        const live = source ? source.read() : null;
        setEnergy(energyForMode(mode, (performance.now() - t0) / 1000, live));
        raf = requestAnimationFrame(tick);
      };
      if (mode !== "none") raf = requestAnimationFrame(tick);
      else setEnergy(ZERO_ENERGY);
    };
    void setup();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      source?.dispose();
      stop?.();
      setEnergy(ZERO_ENERGY);
    };
  }, [mode, file, setEnergy]);
}
```

- [ ] **Step 5: The playground page**

`apps/web/src/app/(owner)/dev/avatar/page.tsx`:

```tsx
import { DevAvatar } from "./DevAvatar";

export const metadata = { title: "Avatar playground" };

export default function DevAvatarPage() {
  return <DevAvatar />;
}
```

`apps/web/src/app/(owner)/dev/avatar/DevAvatar.tsx`:

```tsx
"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Leva, useControls, button } from "leva";
import { AvatarState } from "@twin/shared";
import { AVATAR_STATES, TIER_ORDER, type Tier } from "@twin/config";
import { DEFAULTS } from "@/avatar/sim/frame";
import { useAvatarStore } from "@/avatar/state/store";
import { useEnergyInput } from "@/avatar/audio/useEnergyInput";
import { ENERGY_MODES, type EnergyMode } from "@/avatar/audio/energyMode";

const AvatarCanvas = dynamic(() => import("@/avatar/AvatarCanvas").then((m) => m.AvatarCanvas), { ssr: false });

export function DevAvatar() {
  const state = useAvatarStore((s) => s.state);
  const frames = useAvatarStore((s) => s.frames);
  const backend = useAvatarStore((s) => s.backend);
  const activeTier = useAvatarStore((s) => s.tier);
  const setState = useAvatarStore((s) => s.setState);
  const setTuning = useAvatarStore((s) => s.setTuning);
  const [tier, setTier] = useState<Tier | undefined>(undefined);
  const [mode, setMode] = useState<EnergyMode>("none");
  const [file, setFile] = useState<File | null>(null);
  useEnergyInput(mode, file);

  const p = AVATAR_STATES[state];
  const tuning = useControls(
    "simulation",
    {
      turbulence: { value: p.turbulence, min: 0, max: 1, step: 0.01 },
      brightness: { value: p.brightness, min: 0, max: 2, step: 0.01 },
      vortex: { value: p.vortex, min: 0, max: 1, step: 0.01 },
      spring: { value: DEFAULTS.spring, min: 1, max: 40, step: 0.5 },
      damping: { value: DEFAULTS.damping, min: 0.5, max: 0.99, step: 0.005 },
      noiseScale: { value: DEFAULTS.noiseScale, min: 0.2, max: 5, step: 0.05 },
      noiseAmp: { value: DEFAULTS.noiseAmp, min: 0, max: 3, step: 0.05 },
      size: { value: DEFAULTS.size, min: 0.002, max: 0.05, step: 0.001 },
      pointerRadius: { value: DEFAULTS.pointerRadius, min: 0.05, max: 1.5, step: 0.05 },
      bloomStrength: { value: 0.9, min: 0, max: 3, step: 0.05 },
      bloomThreshold: { value: 0.75, min: 0, max: 1, step: 0.01 },
      reset: button(() => setTuning({})),
    },
    [state],
  );
  useEffect(() => {
    const { reset: _reset, ...values } = tuning as typeof tuning & { reset?: unknown };
    setTuning(values);
  }, [tuning, setTuning]);

  return (
    <main data-theme="dark" className="fixed inset-0 bg-twin-bg text-twin-fg">
      <AvatarCanvas key={tier ?? "auto"} tier={tier} className="h-full w-full" />
      <Leva collapsed={false} />
      <aside className="absolute left-4 top-4 flex max-w-xs flex-col gap-3 rounded-lg bg-black/60 p-4 text-sm backdrop-blur">
        <div className="font-mono text-xs opacity-70">
          {backend ?? "…"} · tier {activeTier ?? "…"} · p50 {frames.p50.toFixed(1)} ms · p95 {frames.p95.toFixed(1)} ms
        </div>
        <div className="flex flex-wrap gap-1">
          {AvatarState.options.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setState(s)}
              className={`rounded px-2 py-1 text-xs ${s === state ? "bg-twin-core text-black" : "bg-white/10"}`}
            >
              {s}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-xs">
          tier
          <select value={tier ?? "auto"} onChange={(e) => setTier(e.target.value === "auto" ? undefined : (e.target.value as Tier))} className="bg-white/10 px-1">
            <option value="auto">auto</option>
            {TIER_ORDER.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-xs">
          energy
          <select value={mode} onChange={(e) => setMode(e.target.value as EnergyMode)} className="bg-white/10 px-1">
            {ENERGY_MODES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        {mode === "file" ? (
          <input type="file" accept="audio/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-xs" />
        ) : null}
      </aside>
    </main>
  );
}
```

Leva's `useControls` third argument (deps) re-creates the panel when the state changes so the sliders show that state's defaults; `setTuning` then applies whatever the user drags. `bloomStrength`/`bloomThreshold` reach the pipeline through the store (Task 6 `PostPass` reads `tuning`).

- [ ] **Step 6: Runbook**

Append to `docs/runbooks/local-dev.md`:

```
## Avatar playground

`pnpm dev` → sign in → http://localhost:3000/dev/avatar. Left panel: backend, tier and frame times (p50/p95),
state buttons (one per Avatar State), tier override, energy source (`synth` = fake speech, `file` = pick a
WAV/MP3, `mic` = browser microphone). Right panel (Leva): live simulation and bloom sliders; `reset` returns
to the state table. Values you like go into `packages/config/src/avatar.ts` (state table) or
`apps/web/src/avatar/sim/frame.ts` (`DEFAULTS`) — the playground never persists anything.

Public, no sign-in: http://localhost:3000/bench/avatar?tier=mid&state=SPEAKING (used by the Playwright tests).
```

- [ ] **Step 7: Visual check** — `pnpm dev`, sign in, `/dev/avatar`: step through the seven states; `energy = synth` while SPEAKING makes the face region pulse and the core brighten; `mic` while LISTENING pulls particles toward the ears when you talk; long-press attracts, hover repels; the Leva sliders change the look live. Note the p95 on this laptop at `ultra` and `high` in the PR body.

- [ ] **Step 8: Verify, commit, PR**

```powershell
pnpm format && pnpm lint && pnpm typecheck && pnpm --filter @twin/web test
git add -A
git commit -m "feat(avatar): /dev/avatar playground — Leva tuning, state stepper, tier override, synth/file/mic energy, frame readout"
git push -u origin b5-07-playground
gh pr create --fill --title "B5.6 avatar playground"
```

---

### Task 8 (B5.7): the hero — Avatar stage on the owner home page with status ring, ribbon, drawer and demo turns; E2E

**Branch:** `b5-08-hero`

**Files:**
- Create: `apps/web/src/avatar/demo/driver.ts` (+ `driver.test.ts`), `apps/web/src/avatar/AvatarStage.tsx`, `apps/web/src/avatar/StatusRing.tsx`
- Modify: `apps/web/src/app/(owner)/page.tsx`, `apps/web/src/app/bench/avatar/BenchAvatar.tsx` (run the demo when `?demo=1`), `apps/web/src/app/globals.css` (ring colours per state)
- Create: `apps/web/tests/e2e/avatar-demo.spec.ts`

**Interfaces:**
- Consumes: `useAvatarState` (`send`), `useAvatarStore` (`setEnergy`, `state`), `synthEnergy`, `playWakeCue`, `AvatarCanvas`.
- Produces: `runDemoTurn(text, hooks: DemoHooks, opts?): Promise<void>` where `DemoHooks = { send(e: AvatarEvent): void; setEnergy(e: Energy): void; ribbon(text: string, replaceLast?: boolean): void; wait(ms: number): Promise<void>; now(): number }` · `DEMO_REPLIES` · `<AvatarStage demo?: boolean />` · `<StatusRing state />`.

- [ ] **Step 1: Branch** — `git switch -c b5-08-hero main`

- [ ] **Step 2: Failing test for the demo driver**

`apps/web/src/avatar/demo/driver.test.ts`:

```ts
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
```

- [ ] **Step 3: Run to see it fail** — module not found.

- [ ] **Step 4: Implement driver.ts**

```ts
import { synthEnergy } from "../audio/synth";
import { ZERO_ENERGY, type Energy } from "../audio/energy";
import type { AvatarEvent } from "../state/machine";

export interface DemoHooks {
  send(e: AvatarEvent): void;
  setEnergy(e: Energy): void;
  ribbon(text: string, replaceLast?: boolean): void;
  wait(ms: number): Promise<void>;
  now(): number;
}

/** Canned replies until the Brain's /turn exists (Phase A2). Arabic and English, like Ali. */
export const DEMO_REPLIES: readonly string[] = [
  "This is a demo turn. The Brain arrives in Phase A2 — for now I only show what a reply looks like.",
  "معك كايروس. هيدا جواب تجريبي لحد ما يوصل الـ Brain بالمرحلة A2.",
  "Kairos here. Think of this as a rehearsal: same avatar, same timing, no memory yet.",
];

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export async function runDemoTurn(
  text: string,
  h: DemoHooks,
  opts: { thinkMs: number; wordMs: number } = { thinkMs: 700, wordMs: 90 },
): Promise<void> {
  h.ribbon(`you: ${text}`);
  h.send("THINK");
  await h.wait(opts.thinkMs);
  const reply = DEMO_REPLIES[hashString(text) % DEMO_REPLIES.length] ?? DEMO_REPLIES[0] ?? "";
  h.send("FIRST_TOKEN");
  const t0 = h.now();
  let out = "";
  for (const word of reply.split(" ")) {
    out = out ? `${out} ${word}` : word;
    h.ribbon(`kairos: ${out}`, out !== word);
    h.setEnergy(synthEnergy((h.now() - t0) / 1000 + 0.2));
    await h.wait(opts.wordMs);
  }
  h.setEnergy(ZERO_ENERGY);
  h.send("TURN_END");
}
```

- [ ] **Step 5: Status ring, stage, page**

`apps/web/src/avatar/StatusRing.tsx`:

```tsx
import type { AvatarState } from "@twin/shared";

const RING: Record<AvatarState, string> = {
  DORMANT: "var(--twin-particle-deep)",
  IDLE: "var(--twin-particle)",
  WAKING: "#ffffff",
  LISTENING: "var(--twin-particle)",
  THINKING: "var(--twin-core)",
  SPEAKING: "var(--twin-core-hot)",
  OFFLINE: "var(--twin-offline)",
};

export function StatusRing({ state }: { state: AvatarState }) {
  const pulse = state === "THINKING" || state === "SPEAKING";
  return (
    <div className="flex items-center gap-3" data-status-ring={state}>
      <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
        <circle cx="14" cy="14" r="11" fill="none" stroke={RING[state]} strokeWidth="2.5" className={pulse ? "animate-pulse" : undefined} />
        <circle cx="14" cy="14" r="4" fill={RING[state]} />
      </svg>
      <span className="font-mono text-xs uppercase tracking-widest opacity-80">{state.toLowerCase()}</span>
    </div>
  );
}
```

`apps/web/src/avatar/AvatarStage.tsx`:

```tsx
"use client";
import dynamic from "next/dynamic";
import { useCallback, useRef, useState } from "react";
import { identity } from "@twin/config";
import { StatusRing } from "./StatusRing";
import { runDemoTurn } from "./demo/driver";
import { playWakeCue } from "./audio/cue";
import { useAvatarState } from "./useAvatarState";
import { useAvatarStore } from "./state/store";

const AvatarCanvas = dynamic(() => import("./AvatarCanvas").then((m) => m.AvatarCanvas), { ssr: false });

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** The owner's home: the Avatar, a status ring, a two-line transcript ribbon and a chat drawer that runs demo turns. */
export function AvatarStage({ demo = false }: { demo?: boolean }) {
  const { state, send } = useAvatarState();
  const setEnergy = useAvatarStore((s) => s.setEnergy);
  const [ribbon, setRibbon] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const audio = useRef<AudioContext | null>(null);

  const wake = useCallback(() => {
    audio.current ??= new AudioContext();
    playWakeCue(audio.current);
    send("WAKE");
  }, [send]);

  const submit = useCallback(async () => {
    const t = text.trim();
    if (!t || busy) return;
    setText("");
    setBusy(true);
    await runDemoTurn(t, {
      send,
      setEnergy,
      ribbon: (line, replaceLast) => setRibbon((r) => (replaceLast && r.length ? [...r.slice(0, -1), line] : [...r, line]).slice(-2)),
      wait,
      now: () => performance.now(),
    });
    setBusy(false);
  }, [text, busy, send, setEnergy]);

  const onReady = useCallback(() => {
    if (demo) void runDemoTurn("hello", { send, setEnergy, ribbon: (line, r) => setRibbon((x) => (r && x.length ? [...x.slice(0, -1), line] : [...x, line]).slice(-2)), wait, now: () => performance.now() });
  }, [demo, send, setEnergy]);

  return (
    <section data-theme="dark" data-state={state} className="relative flex h-dvh w-full flex-col bg-twin-bg text-twin-fg">
      <AvatarCanvas className="absolute inset-0" onWake={wake} onReady={onReady} />
      <header className="relative z-10 flex items-center justify-between p-4">
        <StatusRing state={state} />
        <button type="button" onClick={() => setOpen((o) => !o)} className="rounded-full border border-white/20 px-3 py-1 text-xs" aria-expanded={open}>
          {open ? "close" : "chat"}
        </button>
      </header>
      <div className="relative z-10 mt-auto space-y-1 p-4 font-mono text-sm" data-ribbon>
        {ribbon.length === 0 ? (
          <p className="opacity-60">
            say “{identity.wake_phrase.en}” · {identity.wake_phrase.ar} — or click the avatar
          </p>
        ) : (
          ribbon.map((line, i) => (
            <p key={i} className={i === ribbon.length - 1 ? "" : "opacity-50"}>
              {line}
            </p>
          ))
        )}
      </div>
      <aside className={`absolute inset-y-0 right-0 z-20 w-80 max-w-full transform bg-black/70 p-4 backdrop-blur transition-transform ${open ? "translate-x-0" : "translate-x-full"}`} aria-hidden={!open}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          className="flex flex-col gap-2"
        >
          <label className="text-xs opacity-70" htmlFor="demo-text">
            demo turn (Phase A2 replaces this with the Brain)
          </label>
          <input id="demo-text" value={text} onChange={(e) => setText(e.target.value)} className="rounded bg-white/10 px-2 py-1" placeholder="type something" />
          <button type="submit" disabled={busy} className="rounded bg-twin-core px-3 py-1 text-black disabled:opacity-50">
            send
          </button>
        </form>
      </aside>
    </section>
  );
}
```

`apps/web/src/app/(owner)/page.tsx` — replace the whole file:

```tsx
import { AvatarStage } from "@/avatar/AvatarStage";

export default function Home() {
  return <AvatarStage />;
}
```

`BenchAvatar.tsx` — when `demo` is true render `<AvatarStage demo />` instead of the bare canvas (keep the `window.__twinAvatar` publisher), so the E2E flow is the real stage component:

```tsx
return demo ? (
  <main data-theme="dark" data-bench="avatar" data-demo="1">
    <AvatarStage demo />
  </main>
) : (
  <main data-theme="dark" data-bench="avatar" data-demo="0" className="fixed inset-0 bg-twin-bg">
    <AvatarCanvas tier={forced} forceWebGL={webgl} className="h-full w-full" interactive={false} />
  </main>
);
```

(import `AvatarStage` with `next/dynamic`, `ssr: false`, like the canvas.)

Add to `globals.css` under the dark block nothing new — `StatusRing` uses the existing tokens. Confirm the light theme still styles `/login` (the stage forces dark only inside its own section: `data-theme="dark"` on the `<section>` scopes the token overrides because `globals.css` defines them on `[data-theme="dark"]`, and Tailwind's `dark` variant matches descendants of that attribute).

- [ ] **Step 6: E2E test**

`apps/web/tests/e2e/avatar-demo.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("a demo turn drives THINKING → SPEAKING → IDLE on the stage", async ({ page }) => {
  await page.goto("/bench/avatar?tier=low&demo=1");
  await page.waitForFunction(() => window.__twinAvatar?.ready === true, null, { timeout: 60_000 });
  await page.waitForFunction(
    () => {
      const log = window.__twinAvatar?.log ?? [];
      const i = log.indexOf("SPEAKING");
      return i > 0 && log.slice(i).includes("IDLE");
    },
    null,
    { timeout: 30_000 },
  );
  const log = await page.evaluate(() => window.__twinAvatar?.log ?? []);
  expect(log.indexOf("THINKING")).toBeLessThan(log.indexOf("SPEAKING"));
  await expect(page.locator("[data-ribbon] p").last()).toContainText("kairos:");
  await expect(page.locator("[data-status-ring=IDLE]")).toBeVisible();
});
```

Because the stage starts DORMANT, the driver's `THINK` first wakes the Avatar (WAKING 1.2 s → LISTENING), then the queued THINK fires — the log therefore reads `DORMANT, WAKING, LISTENING, THINKING, SPEAKING, IDLE`.

- [ ] **Step 7: Run + visual check**

```powershell
pnpm --filter @twin/web build
pnpm --filter @twin/web test:e2e
```

Then `pnpm dev`, sign in, `/`: click the avatar → chime + WAKING flourish → LISTENING; open the drawer, send text → THINKING (vortex) → SPEAKING (face pulses, ribbon streams) → IDLE (orb). Wait 90 s → DORMANT. Toggle the site theme on `/login`: the login page turns light, the stage stays dark.

- [ ] **Step 8: Verify, commit, PR**

```powershell
pnpm format && pnpm lint && pnpm typecheck && pnpm --filter @twin/web test
git add -A
git commit -m "feat(avatar): owner home = AvatarStage (status ring, ribbon, chat drawer, demo turns, click-to-wake with cue); E2E on the bench page"
git push -u origin b5-08-hero
gh pr create --fill --title "B5.7 avatar hero + demo turns"
```

---

### Task 9 (B5.8): frame-time test in CI, baseline, gate bookkeeping

**Branch:** `b5-09-perf-ci`

**Files:**
- Create: `apps/web/tests/perf/avatar.spec.ts`, `apps/web/tests/perf/baseline.ci.json`
- Modify: `.github/workflows/ci.yml` (new `avatar` job), `apps/web/package.json` (`test:perf`), `docs/STATUS.md`, `docs/runbooks/local-dev.md` (perf section)

**Interfaces:**
- Consumes: `window.__twinAvatar.stats` from the bench page.
- Produces: `baseline.ci.json` shaped `{ "backend": "webgl" | "webgpu", "tier": "mid", "p95": number, "p50": number, "recordedAt": "<iso>", "runner": "ubuntu-latest" }`; CI artifact `avatar-perf` with `test-results/perf.json` on every run.

- [ ] **Step 1: Branch** — `git switch -c b5-09-perf-ci main`

- [ ] **Step 2: The perf spec**

`apps/web/tests/perf/avatar.spec.ts`:

```ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const TIER = "mid";
const BASELINE = "tests/perf/baseline.ci.json";
const OUT = "test-results/perf.json";
const TOLERANCE = 1.15; // docs/11 B5.8: regression > 15 % fails

interface Baseline {
  backend: string;
  tier: string;
  p95: number;
  p50: number;
  recordedAt: string;
  runner: string;
}

test("avatar frame time on the bench page stays within 15 % of the CI baseline", async ({ page }) => {
  await page.goto(`/bench/avatar?tier=${TIER}`);
  await page.waitForFunction(() => window.__twinAvatar?.ready === true, null, { timeout: 60_000 });
  await page.waitForTimeout(2000); // warm-up
  await page.evaluate(() => void 0);
  await page.waitForTimeout(5000);
  const s = await page.evaluate(() => window.__twinAvatar);
  expect(s?.stats.count ?? 0).toBeGreaterThan(30);
  const result: Baseline = {
    backend: s?.backend ?? "unknown",
    tier: TIER,
    p95: Number(s?.stats.p95.toFixed(2)),
    p50: Number(s?.stats.p50.toFixed(2)),
    recordedAt: new Date().toISOString(),
    runner: process.env.RUNNER_OS ? "ubuntu-latest" : "local",
  };
  mkdirSync("test-results", { recursive: true });
  writeFileSync(OUT, JSON.stringify(result, null, 2));
  test.info().annotations.push({ type: "perf", description: JSON.stringify(result) });

  if (process.env.UPDATE_BASELINE === "1") {
    writeFileSync(BASELINE, JSON.stringify(result, null, 2) + "\n");
    return;
  }
  if (!process.env.CI) return; // laptop numbers are not comparable with the runner's
  expect(existsSync(BASELINE), "baseline missing — run the avatar job once with UPDATE_BASELINE=1 and commit it").toBe(true);
  const base = JSON.parse(readFileSync(BASELINE, "utf8")) as Baseline;
  expect(result.backend, "backend changed since the baseline; re-record it").toBe(base.backend);
  expect(result.p95, `p95 ${result.p95} ms vs baseline ${base.p95} ms`).toBeLessThanOrEqual(base.p95 * TOLERANCE);
});
```

Add `"test:perf": "playwright test tests/perf"` to `apps/web/package.json`.

- [ ] **Step 3: CI job**

Append to `.github/workflows/ci.yml`:

```yaml
  avatar:
    name: avatar · e2e + frame-time (Playwright, SwiftShader)
    runs-on: ubuntu-latest
    env:
      UPDATE_BASELINE: ${{ github.event_name == 'workflow_dispatch' && inputs.update_baseline == true && '1' || '0' }}
    steps:
      - uses: actions/checkout@v7
      - uses: pnpm/action-setup@v6
      - uses: actions/setup-node@v7
        with: { node-version: 24, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @twin/web exec playwright install --with-deps chromium
      - run: pnpm --filter @twin/web build
      - run: pnpm --filter @twin/web test:e2e
      - if: always()
        uses: actions/upload-artifact@v7.0.1
        with:
          name: avatar-perf
          path: |
            apps/web/test-results/perf.json
            apps/web/playwright-report
          if-no-files-found: ignore
```

and at the top of the file extend `on:` with a manual trigger so the baseline can be (re)recorded:

```yaml
on:
  push: { branches: ["**"] }
  pull_request: {}
  workflow_dispatch:
    inputs:
      update_baseline:
        description: "record tests/perf/baseline.ci.json from this run"
        type: boolean
        default: false
```

When `UPDATE_BASELINE=1` the spec writes the baseline into the checkout; add a final step that uploads it (`path: apps/web/tests/perf/baseline.ci.json`, artifact `avatar-baseline`) so the controller can download and commit it.

- [ ] **Step 4: Record the baseline**

1. Commit the job without a baseline file, push the branch, open the PR. The `avatar` job fails at "baseline missing" — expected.
2. Controller: `gh workflow run ci.yml --ref b5-09-perf-ci -f update_baseline=true`, wait, `gh run download <id> -n avatar-baseline -D apps/web/tests/perf/`, commit `baseline.ci.json` (`chore(avatar): record CI frame-time baseline (webgl on swiftshader, mid tier)`), push. The next run compares against it and passes.
3. Record in the PR body the baseline numbers and the laptop numbers from Task 7 (`ultra` and `high` p95 on the RTX-less laptop are informational; the desktop gate is measured on Ali's PC later).

- [ ] **Step 5: Docs + gate**

`docs/runbooks/local-dev.md` — append:

```
## Avatar performance

CI runs `apps/web/tests/perf/avatar.spec.ts` on SwiftShader (no GPU) and fails when p95 frame time regresses
more than 15 % against `tests/perf/baseline.ci.json`. Re-record the baseline only after an intentional cost
change: Actions → ci → "Run workflow" with `update_baseline` ticked, download the `avatar-baseline` artifact,
commit it. Real fps numbers come from `/dev/avatar` on the PC (desktop gate: 60 fps at `ultra`) and on Ali's
phone (`?tier=mid`, gate: 30 fps).
```

`docs/STATUS.md` — set `Current phase: A1 / B5 (B5 implementation complete on the laptop; gate items needing the PC/phone listed under Blockers)`, `Last session` = B5 summary, `Blockers` = "B5 gate: 60 fps at ultra on the PC, 30 fps on Ali's phone, Ali's visual approval of the seven states — all need Ali", `Gate history` += `B5 ⏳ <date> — perf CI baseline <p95> ms (webgl/swiftshader, mid), E2E green, playground live`.

- [ ] **Step 6: Verify, commit, PR**

```powershell
pnpm format && pnpm lint && pnpm typecheck && pnpm --filter @twin/web test
git add -A
git commit -m "test(avatar): Playwright frame-time test with CI baseline, avatar CI job with SwiftShader, perf runbook, STATUS"
git push -u origin b5-09-perf-ci
gh pr create --fill --title "B5.8 perf CI + gate bookkeeping"
```

---

## Exit gate B5 (docs/11)

| Gate item | How it is evidenced |
|---|---|
| 60 fps desktop at tier settings | `/dev/avatar` on Ali's PC (RTX 5070): p95 ≤ 16.7 ms at `ultra` — **Ali**; interim: this laptop's numbers at `high` in the Task 7 PR |
| 30 fps on Ali's phone | `/bench/avatar?tier=mid` over the LAN from the PC: p95 ≤ 33 ms — **Ali** |
| All 7 states visually approved by Ali | Ali steps through `/dev/avatar` and answers in STATUS.md — **Ali** |
| Reduced-motion respected | `baseTier` test (`reducedMotion → low`) + Low tier stops after one second (`AvatarCanvas` `frameloop="never"`) — automated |
| Perf CI green | `avatar` job on `main` — automated |

## Self-review (done while writing; re-run by the executor before starting)

**Spec coverage (docs/06):** §1 stack + tiers → Tasks 1, 5 (tier probe, dpr cap, WebGL fallback); §2 morph targets → Tasks 2–3 (all seven shapes; regions; sub-systems by index range); §3 state machine + table → Tasks 1, 4 (transitions incl. OFFLINE from any state, WAKING two-step, OFFLINE freeze/dissolve in `frame.ts` Task 5); §4 uniforms → Task 5 (`uState/uStateT` are represented by `shapeA/shapeB/morph` + per-state uniforms; `uPresence` is Phase 8 by spec); §5 tokens → `palette.ts`, `StatusRing`, Q6 scoping; §6 interactions → Task 5 pointer tracker (repel, long-press attract, click wake); pinch/double-tap deferred to B7 (D8); §7 performance → Task 5 (one draw call each, dpr cap, visibility pause, battery signal in `tier.ts`), Task 9 (CI frame sampling); §8 deliverables → `apps/web/src/avatar/*`, `/dev/avatar`, perf baseline. Roadmap rows B5.1–B5.8 → Tasks 5, 2+3, 5, 1+4, 6, 7, 8, 9.

**Placeholder scan:** no TBD/TODO; every code step carries the code; the only "check and adapt" notes point at concrete files in `node_modules/three/src/nodes` for API drift, which is the honest instruction for a node-based API that moves between releases.

**Type consistency:** `Targets` fields (`n, coreEnd, spineEnd, humanoid, orb, nebula, ring, regions, spineT, waves`) match between Task 3 and Task 5; `SHAPE_ID` order (HUMANOID 0, ORB 1, NEBULA 2, RING 3) matches `shapeAt()` in `compute.ts` and `initialMemory`; `UniformValues` keys match `writeUniforms`; `PointerState.strength` +1/−1 matches `PointerTracker` and the kernel; `Energy` is defined once in `energy.ts` and imported by the store; `AvatarEvent` names are identical in `machine.ts`, `useAvatarState.ts`, `driver.ts` and the tests; `window.__twinAvatar` shape is identical in `BenchAvatar.tsx` and both Playwright specs; `since` is milliseconds in the store and divided by 1000 in `ParticleSystem`.

**Version facts (checked 2026-09-04):** three 0.185.1 (`three/tsl` exports `Fn, If, uniform, float, vec3, vec4, mix, smoothstep, select, hash, mx_noise_vec3, mx_noise_float, time, deltaTime, length, normalize, oneMinus, step, sin, shapeCircle, instancedArray, instanceIndex, pass, screenUV`; `three/webgpu` has `WebGPURenderer` with `forceWebGL`, `computeAsync`, `backend.isWebGPUBackend`, `RenderPipeline`, `SpriteNodeMaterial`; addons `tsl/display/BloomNode.js` (`bloom(node, strength, radius, threshold)`), `tsl/display/ChromaticAberrationNode.js` (`chromaticAberration(node, strength, center, scale)`), `loaders/GLTFLoader.js`) · @types/three 0.185.4 · @react-three/fiber 9.7.0 (async `gl` factory; peer react ≥19 <19.3) · zustand 5.0.15 · leva 0.10.1 (peer react ^18 || ^19) · @playwright/test 1.62.1 · actions/upload-artifact v7.0.1 · MakeHuman base.obj at commit 3c701a8… (19 158 vertices, group `body`, CC0 per license.txt §C).
