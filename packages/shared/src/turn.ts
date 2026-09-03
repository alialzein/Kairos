import { z } from "zod";
import { AvatarState } from "./avatar";

export const Channel = z.enum(["web", "voice", "mobile", "guest"]);
export type Channel = z.infer<typeof Channel>;

export const Register = z.enum(["casual", "professional"]);
export type Register = z.infer<typeof Register>;

export const TurnRequest = z.strictObject({
  text: z.string().min(1).max(8000),
  channel: Channel,
  register: Register.optional(),
  session_id: z.uuid(),
});
export type TurnRequest = z.infer<typeof TurnRequest>;

export const TurnEvent = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("turn.start"), turn_id: z.uuid(), session_id: z.uuid() }),
  z.strictObject({ type: z.literal("turn.delta"), turn_id: z.uuid(), text: z.string() }),
  z.strictObject({
    type: z.literal("turn.end"),
    turn_id: z.uuid(),
    style_applied: z.boolean(),
    latency_ms: z.record(z.string(), z.number().nonnegative()),
  }),
  z.strictObject({ type: z.literal("avatar.state"), state: AvatarState }),
  z.strictObject({ type: z.literal("avatar.energy"), value: z.number().min(0).max(1) }),
  z.strictObject({
    type: z.literal("memory.candidate"),
    candidate_id: z.uuid(),
    kind: z.string(),
    summary: z.string(),
  }),
  z.strictObject({ type: z.literal("error"), code: z.string(), message: z.string() }),
]);
export type TurnEvent = z.infer<typeof TurnEvent>;
