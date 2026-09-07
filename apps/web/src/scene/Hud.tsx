"use client";
import { sceneConfig } from "./sceneConfig";

/**
 * Phase 8 — the "STATUS: LISTENING" readout (docs/plans/scene-plan.md Phase 8): plain DOM,
 * absolutely positioned top-right inside the canvas container, pointer-events off, monospace
 * 11 px with 0.18 em tracking in `palette.line` at 75 %, preceded by a 6 px dot with a slow
 * 2 s opacity pulse (Tailwind `animate-pulse`, disabled under prefers-reduced-motion).
 */
export function Hud() {
  const { hud, palette } = sceneConfig;
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
        className="inline-block rounded-full motion-safe:animate-pulse"
        style={{ width: hud.dotSize, height: hud.dotSize, background: palette.line }}
      />
      {hud.text}
    </div>
  );
}
