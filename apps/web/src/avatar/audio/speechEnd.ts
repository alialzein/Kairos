import { SPEECH_END } from "@twin/config";

export interface SpeechEndConfig {
  /** `energy.mid` at or above this counts as voice (0..1) */
  threshold: number;
  /** how long the level must stay up before an utterance is confirmed (seconds) */
  minSpeechS: number;
  /** how long it must stay down afterwards to end that utterance (seconds) */
  silenceS: number;
}

/**
 * Local end-of-speech detection on the smoothed mic energy (docs/06 §4), the stand-in for the
 * voice service's real VAD: `update` returns true exactly once per utterance, on the frame where
 * the trailing silence reaches `silenceS`. Pure — the caller supplies the clock — so it is testable
 * without a microphone and cheap enough to run per animation frame.
 */
export class SpeechEndDetector {
  private readonly cfg: SpeechEndConfig;
  /** when the current run of loud frames started, or null while quiet */
  private loudSince: number | null = null;
  /** when the current run of quiet frames started, or null while loud */
  private quietSince: number | null = null;
  /** an utterance has been confirmed and has not been ended yet */
  private speaking = false;

  constructor(cfg: SpeechEndConfig = SPEECH_END) {
    this.cfg = cfg;
  }

  update(mid: number, nowMs: number): boolean {
    if (mid >= this.cfg.threshold) {
      this.quietSince = null;
      this.loudSince ??= nowMs;
      if (nowMs - this.loudSince >= this.cfg.minSpeechS * 1000) this.speaking = true;
      return false;
    }
    this.loudSince = null;
    if (!this.speaking) return false;
    this.quietSince ??= nowMs;
    if (nowMs - this.quietSince < this.cfg.silenceS * 1000) return false;
    this.reset();
    return true;
  }

  reset(): void {
    this.loudSince = null;
    this.quietSince = null;
    this.speaking = false;
  }
}
