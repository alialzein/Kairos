import { describe, expect, it } from "vitest";
import { SPEECH_END } from "@twin/config";
import { SpeechEndDetector } from "./speechEnd";

const LOUD = SPEECH_END.threshold + 0.05;
const QUIET = SPEECH_END.threshold - 0.05;

/** Feeds one level for `seconds`, 20 ms per sample, and returns every `update` result. */
function feed(d: SpeechEndDetector, level: number, seconds: number, t: { ms: number }): boolean[] {
  const out: boolean[] = [];
  for (let elapsed = 0; elapsed < seconds; elapsed += 0.02) {
    t.ms += 20;
    out.push(d.update(level, t.ms));
  }
  return out;
}

describe("SpeechEndDetector", () => {
  it("never fires while nobody has spoken", () => {
    const d = new SpeechEndDetector();
    const t = { ms: 1000 };
    expect(feed(d, QUIET, 10, t)).not.toContain(true);
  });

  it("ignores a burst shorter than minSpeechS", () => {
    const d = new SpeechEndDetector();
    const t = { ms: 1000 };
    feed(d, LOUD, SPEECH_END.minSpeechS - 0.1, t);
    expect(feed(d, QUIET, 5, t)).not.toContain(true);
  });

  it("fires once after speech followed by silenceS of quiet", () => {
    const d = new SpeechEndDetector();
    const t = { ms: 1000 };
    expect(feed(d, LOUD, 1, t)).not.toContain(true);
    const silence = feed(d, QUIET, 3, t);
    expect(silence.filter(Boolean)).toHaveLength(1);
  });

  it("does not fire again while the silence continues", () => {
    const d = new SpeechEndDetector();
    const t = { ms: 1000 };
    feed(d, LOUD, 1, t);
    feed(d, QUIET, 3, t);
    expect(feed(d, QUIET, 20, t)).not.toContain(true);
  });

  it("fires again for a second utterance", () => {
    const d = new SpeechEndDetector();
    const t = { ms: 1000 };
    feed(d, LOUD, 1, t);
    expect(feed(d, QUIET, 3, t).filter(Boolean)).toHaveLength(1);
    feed(d, LOUD, 1, t);
    expect(feed(d, QUIET, 3, t).filter(Boolean)).toHaveLength(1);
  });

  it("does not fire on a silence gap shorter than silenceS", () => {
    const d = new SpeechEndDetector();
    const t = { ms: 1000 };
    feed(d, LOUD, 1, t);
    expect(feed(d, QUIET, SPEECH_END.silenceS - 0.2, t)).not.toContain(true);
    feed(d, LOUD, 0.5, t);
    // the gap did not end the utterance; the next real silence still does, exactly once
    expect(feed(d, QUIET, 3, t).filter(Boolean)).toHaveLength(1);
  });

  it("forgets the utterance on reset", () => {
    const d = new SpeechEndDetector();
    const t = { ms: 1000 };
    feed(d, LOUD, 1, t);
    d.reset();
    expect(feed(d, QUIET, 5, t)).not.toContain(true);
  });

  it("honours an injected config", () => {
    const d = new SpeechEndDetector({ threshold: 0.5, minSpeechS: 0.1, silenceS: 0.2 });
    const t = { ms: 1000 };
    feed(d, 0.6, 0.2, t);
    expect(feed(d, 0.1, 0.5, t).filter(Boolean)).toHaveLength(1);
  });
});
