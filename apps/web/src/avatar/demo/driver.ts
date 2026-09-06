import { synthEnergy } from "../audio/synth";
import { ZERO_ENERGY, type Energy } from "../audio/energy";
import type { AvatarEvent } from "../state/machine";

export interface DemoHooks {
  send(e: AvatarEvent): void;
  setEnergy(e: Energy): void;
  ribbon(text: string, replaceLast?: boolean): void;
  wait(ms: number): Promise<void>;
  now(): number;
}

/** Canned replies until the Brain's /turn exists (Phase A2). Arabic and English, like Ali. */
export const DEMO_REPLIES: readonly string[] = [
  "This is a demo turn. The Brain arrives in Phase A2 — for now I only show what a reply looks like.",
  "معك كايروس. هيدا جواب تجريبي لحد ما يوصل الـ Brain بالمرحلة A2.",
  "Kairos here. Think of this as a rehearsal: same avatar, same timing, no memory yet.",
];

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export async function runDemoTurn(
  text: string,
  h: DemoHooks,
  opts: { thinkMs: number; wordMs: number } = { thinkMs: 700, wordMs: 90 },
): Promise<void> {
  h.ribbon(`you: ${text}`);
  h.send("THINK");
  await h.wait(opts.thinkMs);
  const reply = DEMO_REPLIES[hashString(text) % DEMO_REPLIES.length] ?? DEMO_REPLIES[0] ?? "";
  h.send("FIRST_TOKEN");
  const t0 = h.now();
  let out = "";
  for (const word of reply.split(" ")) {
    out = out ? `${out} ${word}` : word;
    h.ribbon(`kairos: ${out}`, out !== word);
    h.setEnergy(synthEnergy((h.now() - t0) / 1000 + 0.2));
    await h.wait(opts.wordMs);
  }
  h.setEnergy(ZERO_ENERGY);
  h.send("TURN_END");
}
