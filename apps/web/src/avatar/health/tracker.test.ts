import { describe, expect, it } from "vitest";
import { HEALTH_POLL } from "@twin/config";
import { HealthTracker } from "./tracker";

const N = HEALTH_POLL.failuresToOffline;
const report = (t: HealthTracker, ok: boolean, times: number) =>
  Array.from({ length: times }, () => t.report(ok));

describe("HealthTracker", () => {
  it("stays quiet while the brain answers", () => {
    const t = new HealthTracker();
    expect(report(t, true, 5)).toEqual([null, null, null, null, null]);
  });

  it("stays quiet until failuresToOffline consecutive failures", () => {
    const t = new HealthTracker();
    expect(report(t, false, N - 1)).not.toContain("FAILURE");
    expect(t.report(false)).toBe("FAILURE");
  });

  it("emits FAILURE only once while it stays down", () => {
    const t = new HealthTracker();
    report(t, false, N);
    expect(report(t, false, 5)).toEqual([null, null, null, null, null]);
  });

  it("resets the streak on any ok in between", () => {
    const t = new HealthTracker();
    report(t, false, N - 1);
    expect(t.report(true)).toBeNull();
    expect(report(t, false, N - 1)).not.toContain("FAILURE");
    expect(t.report(false)).toBe("FAILURE");
  });

  it("emits RECOVER on the first ok after a FAILURE, then goes quiet", () => {
    const t = new HealthTracker();
    report(t, false, N);
    expect(t.report(true)).toBe("RECOVER");
    expect(report(t, true, 3)).toEqual([null, null, null]);
  });

  it("never emits RECOVER without a FAILURE first", () => {
    const t = new HealthTracker();
    report(t, false, N - 1);
    expect(t.report(true)).toBeNull();
  });

  it("can fail again after recovering", () => {
    const t = new HealthTracker();
    report(t, false, N);
    t.report(true);
    expect(report(t, false, N - 1)).not.toContain("FAILURE");
    expect(t.report(false)).toBe("FAILURE");
  });

  it("honours an injected config", () => {
    const t = new HealthTracker({ failuresToOffline: 1 });
    expect(t.report(false)).toBe("FAILURE");
    expect(t.report(true)).toBe("RECOVER");
  });
});
