"use client";
import dynamic from "next/dynamic";
import { memo, useCallback, useRef, useState } from "react";
import { identity } from "@twin/config";
import { playWakeCue } from "@/avatar/audio/cue";
import { runDemoTurn } from "@/avatar/demo/driver";
import { useAvatarStore } from "@/avatar/state/store";
import { useAvatarState } from "@/avatar/useAvatarState";
import type { Layers } from "./sceneConfig";

const SceneCanvas = dynamic(() => import("./SceneCanvas").then((m) => m.SceneCanvas), {
  ssr: false,
});

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * A turn that starts from DORMANT/WAKING must think longer than the 1.2 s wake: the machine keeps
 * the queued THINK across the wake, but a FIRST_TOKEN arriving mid-WAKING is dropped and the turn
 * would never reach SPEAKING.
 */
function demoOpts() {
  const s = useAvatarStore.getState().state;
  return s === "DORMANT" || s === "WAKING"
    ? { thinkMs: 1600, wordMs: 90 }
    : { thinkMs: 700, wordMs: 90 };
}

/**
 * Canvas-isolation rule (docs/plans/phase-b5-ledger.md, Task 7): the scene canvas must sit under
 * a component that never re-renders — the stage re-renders on every ribbon word and state change,
 * so the canvas gets its own memoized layer whose props are stable callbacks. The click-to-wake
 * handler lives on the wrapper: the canvas element's clicks bubble to it, and nothing inside the
 * Canvas subscribes to React state for it.
 */
const CanvasLayer = memo(function CanvasLayer({
  layers,
  forceWebGL,
  onWake,
  onReady,
}: {
  layers: Partial<Layers> | undefined;
  forceWebGL: boolean;
  onWake: () => void;
  onReady: () => void;
}) {
  return (
    <div className="absolute inset-0" data-stage-canvas onClick={onWake}>
      <SceneCanvas
        className="h-full w-full"
        layers={layers}
        forceWebGL={forceWebGL}
        onReady={onReady}
      />
    </div>
  );
});

/**
 * The owner's home (follow-up 3 of the Neural Bust, replacing look v2's AvatarStage): the scene
 * canvas with its own HUD, a two-line transcript ribbon and a chat drawer that runs demo turns
 * until the Brain arrives (Phase A2). Click the avatar to wake it (WAKE; barge-in while SPEAKING).
 */
export function SceneStage({
  demo = false,
  forceWebGL = false,
  layers,
}: {
  /** run one demo turn as soon as the scene is ready (the bench's `?stage=1&demo=1`) */
  demo?: boolean;
  /** WebGL2 backend (the bench's `?webgl=1`; CI) */
  forceWebGL?: boolean;
  /** per-layer overrides (the bench's `only` / `off`); MUST be referentially stable — the home
   *  passes nothing and renders every layer */
  layers?: Partial<Layers>;
}) {
  const { state, send } = useAvatarState();
  const setEnergy = useAvatarStore((s) => s.setEnergy);
  const [ribbon, setRibbon] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const audio = useRef<AudioContext | null>(null);

  const pushRibbon = useCallback((line: string, replaceLast?: boolean) => {
    setRibbon((r) =>
      (replaceLast && r.length ? [...r.slice(0, -1), line] : [...r, line]).slice(-2),
    );
  }, []);

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
    await runDemoTurn(
      t,
      { send, setEnergy, ribbon: pushRibbon, wait, now: () => performance.now() },
      demoOpts(),
    );
    setBusy(false);
  }, [text, busy, send, setEnergy, pushRibbon]);

  const onReady = useCallback(() => {
    if (demo)
      void runDemoTurn(
        "hello",
        { send, setEnergy, ribbon: pushRibbon, wait, now: () => performance.now() },
        demoOpts(),
      );
  }, [demo, send, setEnergy, pushRibbon]);

  return (
    <section
      data-theme="dark"
      data-stage="scene"
      data-state={state}
      className="relative flex h-dvh w-full flex-col overflow-hidden bg-twin-bg text-twin-fg"
    >
      <CanvasLayer layers={layers} forceWebGL={forceWebGL} onWake={wake} onReady={onReady} />
      {/* the scene's own HUD (top-right, inside the canvas container) is the status readout;
          the stage adds only the chat toggle, top-left so the two never overlap */}
      <header className="relative z-10 flex items-start justify-start p-4">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="rounded-full border border-white/20 px-3 py-1 text-xs"
          aria-expanded={open}
        >
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
      <aside
        className={`absolute inset-y-0 right-0 z-20 w-80 max-w-full transform bg-black/70 p-4 backdrop-blur transition-transform ${open ? "translate-x-0" : "translate-x-full"}`}
        aria-hidden={!open}
      >
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
          <input
            id="demo-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="rounded bg-white/10 px-2 py-1"
            placeholder="type something"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded bg-twin-core px-3 py-1 text-black disabled:opacity-50"
          >
            send
          </button>
        </form>
      </aside>
    </section>
  );
}
