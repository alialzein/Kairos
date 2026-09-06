import { randomInSphere, type Rng } from "../random";

const ARMS = 3;
const RADIUS = 1.55;
const TILT = -0.5; // radians around x: tips the disc toward the camera so it reads as 3D

/** "Sleeping galaxy" (DORMANT / OFFLINE): flattened three-arm spiral disc + sparse halo.
 *  Replaced the old shapeless curl-noise ball — Ali: "dormant shape is very poor". */
export function nebula(n: number, rng: Rng): Float32Array {
  const out = new Float32Array(n * 3);
  const discN = Math.floor(n * 0.88);
  const cosT = Math.cos(TILT);
  const sinT = Math.sin(TILT);
  for (let i = 0; i < n; i++) {
    let x: number, y: number, z: number;
    if (i < discN) {
      // dense centre, arms twist ~2.3 rad over the radius, jitter widens outward
      const r = RADIUS * Math.pow(rng(), 0.62);
      const arm = (i % ARMS) * ((Math.PI * 2) / ARMS);
      const jitter = (rng() + rng() + rng() - 1.5) * (0.18 + 0.5 * (r / RADIUS));
      const theta = arm + (r / RADIUS) * 2.3 + jitter;
      const thickness = (rng() + rng() + rng() - 1.5) * 0.09 * (0.4 + r / RADIUS);
      x = r * Math.cos(theta);
      y = thickness;
      z = r * Math.sin(theta);
    } else {
      [x, y, z] = randomInSphere(rng, 1.3);
    }
    out[i * 3] = x;
    out[i * 3 + 1] = y * cosT - z * sinT;
    out[i * 3 + 2] = y * sinT + z * cosT;
  }
  return out;
}
