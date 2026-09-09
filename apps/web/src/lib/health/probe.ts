import { HEALTH_POLL } from "@twin/config";

/** The subset of `fetch` the probe uses — injectable so the unit tests need no network. */
export type FetchImpl = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/** What `/api/health` answers. Lives here so the client hook does not import the route module. */
export interface HealthResponse {
  /** false when `BRAIN_URL` is unset — the client then stops polling for the page's life */
  configured: boolean;
  /** null when not configured, otherwise the probe result */
  ok: boolean | null;
}

/** Narrows an unknown JSON body from `/api/health`; anything else is not a usable answer. */
export function parseHealthResponse(body: unknown): HealthResponse | null {
  if (typeof body !== "object" || body === null) return null;
  const { configured, ok } = body as Partial<HealthResponse>;
  if (typeof configured !== "boolean") return null;
  if (ok !== null && typeof ok !== "boolean") return null;
  return { configured, ok };
}

/**
 * One brain-health probe (docs/03 §7). The brain answers `{"status":"ok","service":"brain"}` on
 * `/health` and has no CORS middleware, so only the server may call it — this runs inside the
 * `/api/health` route handler. Every failure mode (refused, 5xx, a proxy's HTML, the abort on
 * `HEALTH_POLL.timeoutMs`) collapses to `false`; the URL never leaves this module.
 */
export async function probeBrain(fetchImpl: FetchImpl, url: string): Promise<boolean> {
  try {
    const res = await fetchImpl(`${url.replace(/\/+$/, "")}/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(HEALTH_POLL.timeoutMs),
    });
    if (!res.ok) return false;
    const body: unknown = await res.json();
    return typeof body === "object" && body !== null && "status" in body && body.status === "ok";
  } catch {
    return false;
  }
}
