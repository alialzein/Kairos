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
