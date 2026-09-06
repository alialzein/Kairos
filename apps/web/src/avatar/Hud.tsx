"use client";
import { useAvatarStore } from "./state/store";

/** HUD chrome (look v2, L7): the reference's top-right monospace readout. `STATUS: <STATE>`
 *  always; `ASSEMBLING… NN%` while WAKING, fed by the linear assembly progress the frame step
 *  writes to the store. Subscribes on its own so only this block re-renders per frame during
 *  the wake — never the canvas's parent (ledger, Task 7 rule). System monospace stack, no
 *  font downloads; nothing blinks, so reduced-motion needs no special case. */
export function Hud() {
  const state = useAvatarStore((s) => s.state);
  const assemble = useAvatarStore((s) => s.assemble);
  const waking = state === "WAKING";
  const pct = Math.min(99, Math.round(assemble * 100));
  return (
    <div
      data-hud
      className="pointer-events-none select-none text-right text-[11px] uppercase leading-5 text-twin-particle/70"
      style={{
        fontFamily: 'ui-monospace, "Cascadia Mono", "JetBrains Mono", Menlo, Consolas, monospace',
        letterSpacing: "0.18em",
      }}
    >
      <p>
        <span className="mr-2 inline-block h-px w-4 translate-y-[-3px] bg-twin-particle/60" />
        status: {state.toLowerCase()}
      </p>
      {waking ? (
        <p data-hud-assembling>
          <span className="mr-2 inline-block h-px w-4 translate-y-[-3px] bg-twin-particle/60" />
          assembling… {pct}%
        </p>
      ) : null}
    </div>
  );
}
