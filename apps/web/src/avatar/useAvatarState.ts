"use client";
import { useCallback, useEffect, useRef } from "react";
import type { AvatarState, TurnEvent } from "@twin/shared";
import { explicitState, fromTurnEvent, type AvatarEvent } from "./state/machine";
import { useAvatarStore } from "./state/store";
import { timedEventFor } from "./state/timers";

export interface AvatarStateApi {
  state: AvatarState;
  send: (e: AvatarEvent) => void;
  applyTurnEvent: (e: TurnEvent) => void;
}

/**
 * Owns the timed transitions of `state/timers.ts` (WAKING lasts 1.2 s, IDLE falls DORMANT after
 * 90 s, LISTENING decays to IDLE after 30 s) and the one rule a table cannot express: a THINK that
 * arrives during DORMANT/WAKING is queued and re-dispatched the moment the wake completes.
 */
export function useAvatarState(): AvatarStateApi {
  const state = useAvatarStore((s) => s.state);
  const dispatch = useAvatarStore((s) => s.dispatch);
  const setState = useAvatarStore((s) => s.setState);
  const pendingThink = useRef(false);

  useEffect(() => {
    // a queued THINK only survives while we are still waking; any other state discards it
    if (state !== "WAKING" && state !== "DORMANT") pendingThink.current = false;
    const timed = timedEventFor(state);
    if (!timed) return undefined;
    const id = setTimeout(() => {
      dispatch(timed.event);
      if (state === "WAKING" && pendingThink.current) {
        pendingThink.current = false;
        dispatch("THINK");
      }
    }, timed.ms);
    return () => clearTimeout(id);
  }, [state, dispatch]);

  const send = useCallback(
    (e: AvatarEvent) => {
      const current = useAvatarStore.getState().state;
      if (e === "THINK" && (current === "DORMANT" || current === "WAKING"))
        pendingThink.current = true;
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
