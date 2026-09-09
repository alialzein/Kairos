"use client";
import { useEffect, useRef } from "react";
import { HEALTH_POLL } from "@twin/config";
import { parseHealthResponse } from "@/lib/health/probe";
import type { AvatarEvent } from "../state/machine";
import { HealthTracker } from "./tracker";

/**
 * Polls the web app's `/api/health` (the browser cannot reach the brain directly — it sends no
 * CORS headers) and dispatches the OFFLINE edges of docs/03 §7: FAILURE after
 * `HEALTH_POLL.failuresToOffline` consecutive probes that say the brain is down, RECOVER on the
 * first one that says it is up again.
 *
 * Deliberately render-free: everything lives in refs and reaches React only as an Avatar event, so
 * a poll never re-renders the stage — and so never re-renders the scene canvas's parent (the
 * canvas-isolation rule in `scene/SceneStage.tsx`).
 *
 * Only a parsed answer from the route moves the tracker. A poll that cannot be read at all — the
 * auth proxy's redirect to `/login` when the session has expired, a 500, an offline page — says
 * something about the web app, not about the brain, and must not dissolve the Avatar. Polling
 * stops for the page's life once the route answers `configured: false` (no `BRAIN_URL`), and a
 * poll is skipped while the tab is hidden: a background tab's throttled fetches are not evidence.
 */
export function useBrainHealth(send: (e: AvatarEvent) => void): void {
  const sendRef = useRef(send);
  useEffect(() => {
    sendRef.current = send;
  }, [send]);

  useEffect(() => {
    const tracker = new HealthTracker();
    let stopped = false;
    let inFlight = false;

    const poll = async () => {
      if (stopped || inFlight || document.hidden) return;
      inFlight = true;
      try {
        const res = await fetch("/api/health", { cache: "no-store" });
        const body = res.ok ? parseHealthResponse((await res.json()) as unknown) : null;
        if (stopped || !body) return;
        if (!body.configured) {
          stop();
          return;
        }
        const event = tracker.report(body.ok === true);
        if (event) sendRef.current(event);
      } catch {
        // unreadable answer or failed request: not a statement about the brain — ignore it
      } finally {
        inFlight = false;
      }
    };

    // `stop` closes over the timer, so it is declared after it; `poll` only calls it once a
    // response has come back, long after this effect body has finished running.
    const timer = setInterval(() => void poll(), HEALTH_POLL.intervalS * 1000);
    const stop = () => {
      stopped = true;
      clearInterval(timer);
    };

    void poll();
    return stop;
  }, []);
}
