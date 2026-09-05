import { Color } from "three";

export interface Palette {
  bg: Color;
  particle: Color;
  deep: Color;
  core: Color;
  coreHot: Color;
  spineFrom: Color;
  spineTo: Color;
  offline: Color;
}

/** docs/06 §5 tokens. Colours are sRGB hex; three converts to linear on construction. */
export const PALETTE: Palette = {
  bg: new Color("#05070d"),
  particle: new Color("#2f9bff"),
  deep: new Color("#0a3d7a"),
  core: new Color("#ffb347"),
  coreHot: new Color("#ff7a1a"),
  spineFrom: new Color("#ffd28a"),
  spineTo: new Color("#2f9bff"),
  offline: new Color("#ff4d4d"),
};
