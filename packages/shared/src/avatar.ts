import { z } from "zod";

export const AvatarState = z.enum([
  "DORMANT",
  "IDLE",
  "WAKING",
  "LISTENING",
  "THINKING",
  "SPEAKING",
  "OFFLINE",
]);
export type AvatarState = z.infer<typeof AvatarState>;
