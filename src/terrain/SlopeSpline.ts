import { hash } from "./Noise";

const SMOOTH_START = 30; // meters of smooth start zone

/** Cubic Hermite interpolation between p0 and p1 with tangents m0, m1 */
function hermite(t: number, p0: number, m0: number, p1: number, m1: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * p0 +
         (t3 - 2 * t2 + t) * m0 +
         (-2 * t3 + 3 * t2) * p1 +
         (t3 - t2) * m1;
}

export class SlopeSpline {
  /** Pre-sampled arrays at 1m resolution, indexed by Math.floor(-z) */
  readonly centerX: Float32Array;
  readonly steepness: Float32Array;
  readonly halfWidth: Float32Array;
  /** Integrated height: cumulative descent from z=0 */
  readonly baseHeight: Float32Array;
  readonly length: number;

  constructor(totalLength: number, seed: number = 42) {
    this.length = totalLength;
    const sampleCount = totalLength + 1;
    this.centerX = new Float32Array(sampleCount);
    this.steepness = new Float32Array(sampleCount);
    this.halfWidth = new Float32Array(sampleCount);
    this.baseHeight = new Float32Array(sampleCount);

    // Generate control points via random walk
    const numPoints = 15 + Math.floor(hash(seed * 7 + 1) * 6); // 15-20
    const spacing = totalLength / (numPoints - 1);

    const cpZ: number[] = [];
    const cpCenterX: number[] = [];
    const cpSteepness: number[] = [];
    const cpHalfWidth: number[] = [];

    for (let i = 0; i < numPoints; i++) {
      cpZ.push(i * spacing);

      if (i === 0) {
        // Start: centered, base steepness
        cpCenterX.push(0);
        cpSteepness.push(0.15);
        cpHalfWidth.push(25);
      } else {
        const h0 = hash(seed * 100 + i * 3);
        const h1 = hash(seed * 100 + i * 3 + 1);
        const h2 = hash(seed * 100 + i * 3 + 2);

        // Random walk for center X: wander ±15m
        const prevX = cpCenterX[i - 1];
        const drift = (h0 - 0.5) * 10; // ±5m per segment
        cpCenterX.push(Math.max(-15, Math.min(15, prevX + drift)));

        // Steepness: 0.10 - 0.22
        cpSteepness.push(0.10 + h1 * 0.12);

        // Half-width: 20-30m
        cpHalfWidth.push(20 + h2 * 10);
      }
    }

    // Override first control point for steep start ramp
    // (subsequent points start the random walk from normal steepness)
    cpSteepness[0] = 0.02; // nearly flat starting pad

    // Compute Catmull-Rom tangents for Hermite interpolation
    const tangentCX: number[] = [];
    const tangentSt: number[] = [];
    const tangentHW: number[] = [];
    for (let i = 0; i < numPoints; i++) {
      if (i === 0) {
        tangentCX.push(cpCenterX[1] - cpCenterX[0]);
        tangentSt.push(cpSteepness[1] - cpSteepness[0]);
        tangentHW.push(cpHalfWidth[1] - cpHalfWidth[0]);
      } else if (i === numPoints - 1) {
        tangentCX.push(cpCenterX[i] - cpCenterX[i - 1]);
        tangentSt.push(cpSteepness[i] - cpSteepness[i - 1]);
        tangentHW.push(cpHalfWidth[i] - cpHalfWidth[i - 1]);
      } else {
        tangentCX.push((cpCenterX[i + 1] - cpCenterX[i - 1]) * 0.5);
        tangentSt.push((cpSteepness[i + 1] - cpSteepness[i - 1]) * 0.5);
        tangentHW.push((cpHalfWidth[i + 1] - cpHalfWidth[i - 1]) * 0.5);
      }
    }

    // Sample at 1m resolution
    for (let m = 0; m < sampleCount; m++) {
      const segFloat = m / spacing;
      const seg = Math.min(Math.floor(segFloat), numPoints - 2);
      const t = segFloat - seg;

      let cx = hermite(t, cpCenterX[seg], tangentCX[seg], cpCenterX[seg + 1], tangentCX[seg + 1]);
      const st = hermite(t, cpSteepness[seg], tangentSt[seg], cpSteepness[seg + 1], tangentSt[seg + 1]);
      const hw = hermite(t, cpHalfWidth[seg], tangentHW[seg], cpHalfWidth[seg + 1], tangentHW[seg + 1]);

      // Smooth start zone: blend center to 0 over first 30m
      if (m < SMOOTH_START) {
        const blend = m / SMOOTH_START;
        const ease = blend * blend * (3 - 2 * blend);
        cx *= ease;
      }

      this.centerX[m] = cx;
      this.steepness[m] = st;
      this.halfWidth[m] = hw;
    }

    // Override steepness for steep start ramp
    // Flat pad (0-3m), quick ramp into steep (3-10m), hold steep (10-40m), ease back (40-60m)
    const FLAT_END = 3;
    const RAMP_UP_END = 10;
    const STEEP_HOLD_END = 40;
    const BLEND_END = 60;
    const START_STEEP = 0.50; // ~27° — steep race start ramp

    for (let m = 0; m <= Math.min(BLEND_END, this.length); m++) {
      if (m <= FLAT_END) {
        this.steepness[m] = 0.02;
      } else if (m <= RAMP_UP_END) {
        const rt = (m - FLAT_END) / (RAMP_UP_END - FLAT_END);
        const ease = rt * rt * (3 - 2 * rt);
        this.steepness[m] = 0.02 + ease * (START_STEEP - 0.02);
      } else if (m <= STEEP_HOLD_END) {
        this.steepness[m] = START_STEEP;
      } else {
        const rt = (m - STEEP_HOLD_END) / (BLEND_END - STEEP_HOLD_END);
        const ease = rt * rt * (3 - 2 * rt);
        this.steepness[m] = START_STEEP * (1 - ease) + this.steepness[m] * ease;
      }
    }

    // Integrate steepness into cumulative baseHeight
    let cumulativeH = 0;
    for (let m = 0; m < sampleCount; m++) {
      if (m > 0) {
        cumulativeH -= this.steepness[m];
      }
      this.baseHeight[m] = cumulativeH;
    }
  }

  /** O(1) centerline X at world z (z is negative going downhill) */
  centerXAt(z: number): number {
    const idx = Math.max(0, Math.min(this.length, Math.floor(-z)));
    return this.centerX[idx];
  }

  /** O(1) steepness at world z */
  steepnessAt(z: number): number {
    const idx = Math.max(0, Math.min(this.length, Math.floor(-z)));
    return this.steepness[idx];
  }

  /** O(1) half-width at world z */
  halfWidthAt(z: number): number {
    const idx = Math.max(0, Math.min(this.length, Math.floor(-z)));
    return this.halfWidth[idx];
  }

  /** O(1) integrated base height at world z (always descending) */
  baseHeightAt(z: number): number {
    const idx = Math.max(0, Math.min(this.length, Math.floor(-z)));
    return this.baseHeight[idx];
  }
}
