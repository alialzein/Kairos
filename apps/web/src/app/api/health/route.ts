import { NextResponse } from "next/server";
import { probeBrain } from "@/lib/health/probe";

/** never cached: the answer is a live probe, and a cached "ok" would hide an OFFLINE brain */
export const dynamic = "force-dynamic";

export interface HealthResponse {
  /** false when `BRAIN_URL` is unset — the client then stops polling for the page's life */
  configured: boolean;
  /** null when not configured, otherwise the probe result */
  ok: boolean | null;
}

/**
 * The browser's only route to the brain's `/health`: the brain has no CORS middleware, so the page
 * cannot call it directly (docs/03 §7 — a brain that reports the Reasoner unavailable puts the UI
 * in OFFLINE). The response says only `configured` and `ok`; `BRAIN_URL` itself is never echoed.
 * Sits behind the auth proxy like every non-public path, so only the Owner's session can probe.
 */
export async function GET() {
  const url = process.env.BRAIN_URL?.trim();
  if (!url) return NextResponse.json<HealthResponse>({ configured: false, ok: null });
  return NextResponse.json<HealthResponse>({ configured: true, ok: await probeBrain(fetch, url) });
}
