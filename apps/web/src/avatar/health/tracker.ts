import { HEALTH_POLL } from "@twin/config";
import type { AvatarEvent } from "../state/machine";

export interface HealthTrackerConfig {
  /** consecutive failed probes before the Avatar goes OFFLINE */
  failuresToOffline: number;
}

/** The Avatar events this tracker can ask for; nothing else in the machine reacts to health. */
export type HealthEvent = Extract<AvatarEvent, "FAILURE" | "RECOVER">;

/**
 * Turns a stream of brain-health probe results into the two Avatar events docs/03 §7 describes:
 * FAILURE once the brain has missed `failuresToOffline` probes in a row (one dropped request must
 * not dissolve the Avatar), RECOVER on the first probe that answers afterwards. Pure and clock-free
 * — the poller decides when to `report`.
 */
export class HealthTracker {
  private readonly failuresToOffline: number;
  private failures = 0;
  /** true between an emitted FAILURE and the RECOVER that clears it */
  private offline = false;

  constructor(cfg: HealthTrackerConfig = HEALTH_POLL) {
    this.failuresToOffline = cfg.failuresToOffline;
  }

  report(ok: boolean): HealthEvent | null {
    if (ok) {
      this.failures = 0;
      if (!this.offline) return null;
      this.offline = false;
      return "RECOVER";
    }
    this.failures += 1;
    if (this.offline || this.failures < this.failuresToOffline) return null;
    this.offline = true;
    return "FAILURE";
  }
}
