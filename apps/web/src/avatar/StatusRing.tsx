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
        <circle
          cx="14"
          cy="14"
          r="11"
          fill="none"
          stroke={RING[state]}
          strokeWidth="2.5"
          className={pulse ? "animate-pulse" : undefined}
        />
        <circle cx="14" cy="14" r="4" fill={RING[state]} />
      </svg>
      <span className="font-mono text-xs uppercase tracking-widest opacity-80">
        {state.toLowerCase()}
      </span>
    </div>
  );
}
