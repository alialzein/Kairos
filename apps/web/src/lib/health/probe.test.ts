import { describe, expect, it } from "vitest";
import { HEALTH_POLL } from "@twin/config";
import { parseHealthResponse, probeBrain } from "./probe";

type Call = { url: string; init: RequestInit | undefined };

/** A fetch stand-in that records its call and answers with `respond`. */
function fakeFetch(respond: () => Promise<Response>) {
  const calls: Call[] = [];
  const impl = (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    return respond();
  };
  return { impl, calls };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("probeBrain", () => {
  it("is ok when /health answers 200 with the brain's body", async () => {
    const f = fakeFetch(async () => json({ status: "ok", service: "brain" }));
    await expect(probeBrain(f.impl, "http://localhost:8000")).resolves.toBe(true);
  });

  it("calls <url>/health uncached, with the configured timeout", async () => {
    const f = fakeFetch(async () => json({ status: "ok" }));
    await probeBrain(f.impl, "http://localhost/brain");
    expect(f.calls).toHaveLength(1);
    expect(f.calls[0]?.url).toBe("http://localhost/brain/health");
    expect(f.calls[0]?.init?.cache).toBe("no-store");
    expect(f.calls[0]?.init?.signal).toBeInstanceOf(AbortSignal);
    expect(HEALTH_POLL.timeoutMs).toBeGreaterThan(0);
  });

  it("trims a trailing slash off the base url", async () => {
    const f = fakeFetch(async () => json({ status: "ok" }));
    await probeBrain(f.impl, "http://localhost:8000/");
    expect(f.calls[0]?.url).toBe("http://localhost:8000/health");
  });

  it("is not ok on a non-200", async () => {
    const f = fakeFetch(async () => json({ status: "ok" }, 503));
    await expect(probeBrain(f.impl, "http://localhost:8000")).resolves.toBe(false);
  });

  it("is not ok when the body does not say status ok", async () => {
    const f = fakeFetch(async () => json({ status: "degraded", service: "brain" }));
    await expect(probeBrain(f.impl, "http://localhost:8000")).resolves.toBe(false);
  });

  it("is not ok when the body is not JSON", async () => {
    const f = fakeFetch(async () => new Response("<html>gateway</html>", { status: 200 }));
    await expect(probeBrain(f.impl, "http://localhost:8000")).resolves.toBe(false);
  });

  it("is not ok when the request throws (connection refused)", async () => {
    const f = fakeFetch(() => Promise.reject(new TypeError("fetch failed")));
    await expect(probeBrain(f.impl, "http://localhost:8000")).resolves.toBe(false);
  });

  it("is not ok when the request aborts on the timeout", async () => {
    const f = fakeFetch(() => Promise.reject(new DOMException("timed out", "TimeoutError")));
    await expect(probeBrain(f.impl, "http://localhost:8000")).resolves.toBe(false);
  });
});

describe("parseHealthResponse", () => {
  it("accepts the two shapes the route sends", () => {
    expect(parseHealthResponse({ configured: false, ok: null })).toEqual({
      configured: false,
      ok: null,
    });
    expect(parseHealthResponse({ configured: true, ok: false })).toEqual({
      configured: true,
      ok: false,
    });
  });

  it("rejects anything else", () => {
    const bad: unknown[] = [null, "ok", 1, {}, { configured: "yes", ok: true }, { configured: 1 }];
    for (const body of bad) expect(parseHealthResponse(body)).toBeNull();
  });
});
