import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { z } from "zod";

const Hex = z.string().regex(/^#[0-9a-f]{6}$/i);

export const Identity = z.object({
  twin_name: z.string().min(1),
  wake_phrase: z.object({ en: z.string().min(1), ar: z.string().min(1) }),
  palette: z.object({
    bg: Hex,
    bg_light: Hex,
    particle: Hex,
    particle_deep: Hex,
    core: Hex,
    core_hot: Hex,
    spine_from: Hex,
    spine_to: Hex,
    halo: z.string().min(1),
    offline: Hex,
  }),
});
export type Identity = z.infer<typeof Identity>;

export function identityPath(): string {
  return fileURLToPath(new URL("../identity.yaml", import.meta.url));
}

export function loadIdentity(filePath: string = identityPath()): Identity {
  return Identity.parse(parse(readFileSync(filePath, "utf8")));
}
