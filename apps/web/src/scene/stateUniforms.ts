import { uniform } from "three/tsl";
import { Vector3 } from "three/webgpu";
import { LISTENING_LOOK } from "./states";

/**
 * The one set of TSL uniforms the scene's layers read for the seven-state wiring. Created once at
 * module load and written by `SceneStateDriver` on every frame — nothing else may write them. The
 * two layers that animate in JS instead of in a shader (Rings' scale, NeckCircuit's dash offset)
 * read `currentLook` from `states.ts`, which stays three-free so the bench can import it too.
 *
 * Client-only, like every other module that touches `three/webgpu`: reached only through
 * `SceneCanvas`, which consumers import with `dynamic(..., { ssr: false })`. The pure half of the
 * state system lives in `states.ts`, which imports no three at all and is safe for the DOM HUD.
 *
 * The three PHASE uniforms are accumulations, not `time · rate` products: a rate that changes
 * mid-scene (a state transition) would make `time · rate` jump the phase, so every frame adds
 * `rate · dt` to a running total instead. At the LISTENING identity the totals equal
 * `elapsed · rate`, which is exactly the expression each layer used before.
 *
 * `uniform(new Vector3())` for the colour (not `uniform(Color)`): @types/three 0.185.4 types a
 * Color uniform as a "color" node the vec3()/mix() overloads reject — the same reason
 * `createContourUniforms` does it this way.
 */
export const stateUniforms = {
  /** linear rgb of the face core (contour core tint + glow sprite) */
  coreColor: uniform(new Vector3(...LISTENING_LOOK.coreColor)),
  /** × on the core colour; > 1 brightens into bloom, < 1 dims */
  coreIntensity: uniform(LISTENING_LOOK.coreIntensity),
  /** accumulated radians: replaces `time · core.pulseSpeed` */
  pulsePhase: uniform(0),
  /** × on `core.pulseAmount` — 0 under reduced motion (no flicker) */
  corePulseAmount: uniform(LISTENING_LOOK.corePulseAmount),
  /** accumulated world-y offset: replaces `time · contours.scrollSpeed` */
  scrollOffset: uniform(0),
  /** accumulated seconds × the plume speed: replaces `time` in the plume rise */
  plumeClock: uniform(0),
  /** 0..1 share of the plume's sprites drawn */
  plumeFraction: uniform(LISTENING_LOOK.plumeFraction),
  /** × on the neck bead / nucleus colour */
  neckBrightness: uniform(LISTENING_LOOK.neckBrightness),
  /** × on the landscape gold colour */
  goldBrightness: uniform(LISTENING_LOOK.goldBrightness),
  /** × on `dust.ambient.drift.amount` */
  dustDrift: uniform(LISTENING_LOOK.dustDrift),
};
