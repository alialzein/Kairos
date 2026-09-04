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
    // a queued THINK only survives while we are still waking; any other state discards it
    if (state !== "WAKING" && state !== "DORMANT") pendingThink.current = false;
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
