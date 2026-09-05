import type { Easing } from "@twin/config";
import { EASINGS } from "./easing";

/** Tween between two shape ids; the kernel mixes targets by `eased`. */
export class Morph {
  shapeA: number;
  shapeB: number;
  t = 1;
  private elapsed = 0;
  private duration = 1;
  private easing: Easing = "easeInOutCubic";

  constructor(initialShape: number) {
    this.shapeA = initialShape;
    this.shapeB = initialShape;
  }

  start(toShape: number, duration: number, easing: Easing): void {
    if (toShape === this.shapeB && this.t >= 1) return;
    this.shapeA = this.shapeB;
    this.shapeB = toShape;
    this.t = 0;
    this.elapsed = 0;
    this.duration = Math.max(0.01, duration);
    this.easing = easing;
  }

  update(dt: number): void {
    if (this.t >= 1) return;
    this.elapsed += dt;
    this.t = Math.min(1, this.elapsed / this.duration);
  }

  get eased(): number {
    return EASINGS[this.easing](this.t);
  }
}
