"use client";
import { useAvatarStore } from "@/avatar/state/store";
import { sceneConfig } from "./sceneConfig";
import { SCENE_STATES } from "./states";

/**
 * Phase 8 — the "STATUS: LISTENING" readout (docs/plans/scene-plan.md Phase 8): plain DOM,
 * absolutely positioned top-right inside the canvas container, pointer-events off, monospace
 * 11 px with 0.18 em tracking in `palette.line` at 75 %, preceded by a 6 px dot with a slow
 * 2 s opacity pulse (Tailwind `animate-pulse`, disabled under prefers-reduced-motion).
 *
 * b5-32 (seven-state wiring): the text and the dot come from the current state's row —
 * `SCENE_STATES[state].hud` — and WAKING adds the avatar HUD's second line, `ASSEMBLING… NN%`, off
 * the store's linear assembly progress. Subscribes to the store on its own (two selectors) so only
 * this block re-renders on a state change, never the canvas's parent (ledger, Task 7 rule).
 * `sceneConfig.hud` still owns the layout, and its `text` is the LISTENING row's readout, so the
 * merged scene renders exactly as before.
 */
export function Hud() {
  const { hud, palette } = sceneConfig;
  const state = useAvatarStore((s) => s.state);
  const assemble = useAvatarStore((s) => s.assemble);
  const spec = SCENE_STATES[state].hud;
  const pct = Math.min(99, Math.round(assemble * 100));
  return (
    <div
      data-scene-hud
      className="pointer-events-none absolute flex select-none items-center gap-2 font-mono uppercase"
      style={{
        top: hud.top,
        right: hud.right,
        fontSize: hud.fontSize,
        letterSpacing: hud.letterSpacing,
        color: palette.line,
        opacity: hud.opacity,
      }}
    >
      <span
        aria-hidden
        className={`inline-block shrink-0 rounded-full${
          spec.pulse ? " motion-safe:animate-pulse" : ""
        }`}
        style={{ width: hud.dotSize, height: hud.dotSize, background: spec.dot }}
      />
      {/* one line at every state but WAKING, so the dot stays vertically centred on the readout
          exactly as it was when the text was a bare flex item */}
      <div className="text-right">
        <div>{spec.text}</div>
        {state === "WAKING" ? <div data-scene-hud-assembling>assembling… {pct}%</div> : null}
      </div>
    </div>
  );
}
