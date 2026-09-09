"use client";
import dynamic from "next/dynamic";
import { useEffect, useRef } from "react";
import { AvatarState } from "@twin/shared";
import { TIER_ORDER, type Tier } from "@twin/config";
import { useAvatarStore } from "@/avatar/state/store";

const AvatarCanvas = dynamic(() => import("@/avatar/AvatarCanvas").then((m) => m.AvatarCanvas), {
  ssr: false,
});
const AvatarStage = dynamic(() => import("@/avatar/AvatarStage").then((m) => m.AvatarStage), {
  ssr: false,
});

declare global {
  interface Window {
    __twinAvatar?: {
      ready: boolean;
      backend: string | null;
      /** renderer failure, e.g. a lost WebGPU device — null when healthy */
      error: string | null;
      tier: Tier | null;
      frames: number;
      stats: { p50: number; p95: number; count: number };
      state: string;
      log: string[];
    };
  }
}

export function BenchAvatar({
  tier,
  webgl,
  demo,
  state,
}: {
  tier?: string;
  webgl: boolean;
  demo: boolean;
  state?: string;
}) {
  const forced =
    tier && (TIER_ORDER as readonly string[]).includes(tier) ? (tier as Tier) : undefined;
  const frames = useRef(0);

  useEffect(() => {
    const parsed = AvatarState.safeParse(state);
    if (parsed.success) useAvatarStore.getState().setState(parsed.data);
  }, [state]);

  useEffect(() => {
    const publish = () => {
      const s = useAvatarStore.getState();
      window.__twinAvatar = {
        ready: s.ready,
        backend: s.backend,
        error: s.error,
        tier: s.tier,
        frames: frames.current,
        stats: s.frames,
        state: s.state,
        log: s.log,
      };
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

  return demo ? (
    <main data-theme="dark" data-bench="avatar" data-demo="1">
      <AvatarStage demo />
    </main>
  ) : (
    <main data-theme="dark" data-bench="avatar" data-demo="0" className="fixed inset-0 bg-twin-bg">
      <AvatarCanvas
        tier={forced}
        forceWebGL={webgl}
        className="h-full w-full"
        interactive={false}
      />
    </main>
  );
}
