import { SlopeSpline } from "./SlopeSpline";
import { fbm2D, noise2D, ridgeFbm, worley2D } from "./Noise";

export class SlopeFunction {
  private spline: SlopeSpline;

  constructor(spline: SlopeSpline) {
    this.spline = spline;
  }

  /** Pure O(1) height at any world (x, z). No chunk lookup needed. */
  heightAt(x: number, z: number): number {
    const centerX = this.spline.centerXAt(z);
    const halfWidth = this.spline.halfWidthAt(z);

    // Integrated base height — always descends, no uphill surprises
    let height = this.spline.baseHeightAt(z);

    // Bowl shape relative to spline center
    const distFromCenter = Math.abs(x - centerX);
    height += distFromCenter * distFromCenter * 0.002;

    // Edge falloff: gentle rise beyond half-width to guide player
    if (distFromCenter > halfWidth) {
      const excess = distFromCenter - halfWidth;
      height += excess * excess * 0.01;
    }

    // === Multi-scale terrain features ===
    // Ramp up gradually: smooth start zone
    const bumpFade = Math.min(1, Math.max(0, -z / 40));
    const bigRollFade = Math.min(1, Math.max(0, -z / 80));

    // Roughness map — spatially varying bump amplitude
    // Creates zones: smooth groomed areas (0.3x) vs rough natural areas (1.5x)
    const roughness = 0.3 + fbm2D(x * 0.004 + 200, z * 0.003 + 200, 3) * 1.2;

    // Domain warping — warp noise coordinates for organic, non-repeating shapes
    const warpX = noise2D(x * 0.01 + 300, z * 0.01 + 300) * 8;
    const warpZ = noise2D(x * 0.01 + 500, z * 0.01 + 500) * 8;

    // Large rolling terrain — warped for non-uniform shape
    const bigRolls = fbm2D((x + warpX) * 0.012, (z + warpZ) * 0.005, 3) * 2 - 1;

    // Medium mogul-like bumps — domain warped, cross-slope emphasis
    const mogulWarpX = noise2D(x * 0.02 + 700, z * 0.02 + 700) * 4;
    const mogulWarpZ = noise2D(x * 0.02 + 900, z * 0.02 + 900) * 4;
    const medBumps = fbm2D(
      (x + mogulWarpX) * 0.06 + 50,
      (z + mogulWarpZ) * 0.03 + 50, 4
    ) * 2 - 1;

    // Mogul field zones — clustered tight bumps appear in some areas, absent in others
    const mogulZone = Math.max(0, fbm2D(x * 0.005 + 400, z * 0.003 + 400, 2) * 2 - 0.6);
    const moguls = fbm2D(x * 0.15, z * 0.10, 3) * 2 - 1;

    // Gullies — ridge noise creating drainage-like channels running roughly downhill
    const gullies = ridgeFbm(x * 0.04 + 150, z * 0.008 + 150, 4) * 2 - 1;

    // Cellular dips — isolated depressions/holes (Worley noise)
    const cellDist = worley2D(x * 0.03, z * 0.02);
    const dips = Math.max(0, 0.4 - cellDist) * 2.5; // sharp dips near feature points

    // Small surface texture — fine detail
    const smallBumps = fbm2D(x * 0.2 + 100, z * 0.12 + 100, 3) * 2 - 1;

    height += (
      bigRolls * 2.5 * bigRollFade +
      medBumps * 1.2 * roughness +
      moguls * 0.9 * mogulZone +
      gullies * 0.5 +
      -dips * 1.8 * roughness +
      smallBumps * 0.4
    ) * bumpFade;

    return height;
  }
}
