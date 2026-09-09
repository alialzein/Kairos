"use client";
import { useEffect, useRef } from "react";
import type { AvatarEvent } from "../state/machine";
import { useAvatarStore } from "../state/store";
import { SpeechEndDetector } from "./speechEnd";

/**
 * Dispatches SPEECH_END (LISTENING → THINKING, docs/06 §3) when the mic goes quiet after speech —
 * the local stand-in until the voice service's VAD sends the real one.
 *
 * Subscribes to the store directly instead of through the selector hook: energy updates land every
 * animation frame, and a hook would re-render the stage — and with it the scene canvas's parent —
 * 60 times a second (the canvas-isolation rule in `scene/SceneStage.tsx`). The detector only ever
 * runs in LISTENING, and is reset the moment the Avatar leaves it so a half-heard utterance cannot
 * fire into the next turn.
 */
export function useSpeechEnd(send: (e: AvatarEvent) => void): void {
  const sendRef = useRef(send);
  useEffect(() => {
    sendRef.current = send;
  }, [send]);

  useEffect(() => {
    const detector = new SpeechEndDetector();
    return useAvatarStore.subscribe((s, prev) => {
      if (s.state !== "LISTENING") {
        if (prev.state === "LISTENING") detector.reset();
        return;
      }
      if (s.energy === prev.energy) return;
      if (detector.update(s.energy.mid, performance.now())) sendRef.current("SPEECH_END");
    });
  }, []);
}
