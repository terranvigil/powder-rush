import type { InputState } from "./PlayerInput";

/**
 * AI input adapter for demo/attract mode.
 * Follows the spline centerline with gentle S-turns and performs tricks on jumps.
 */
export class DemoInput {
  private elapsed = 0;
  private trickPhase = 0;
  private trickType = 0; // 0=spin-left, 1=spin-right, 2=grab, 3=flip
  private airborne = false;
  private jumpCharging = false;
  private jumpChargeTime = 0;
  private jumpReleasedFlag = false;

  // Jump z-positions (fractions of course length) where AI should jump
  private jumpZones: number[] = [];
  private courseLength = 1200;
  private nextJumpIndex = 0;

  constructor(courseLength: number = 1200, jumpZones?: number[]) {
    this.courseLength = courseLength;
    this.jumpZones = jumpZones ?? [0.2, 0.4, 0.6, 0.8];
  }

  /** Call each frame with current player state so AI can react */
  updateContext(playerZ: number, centerX: number, playerX: number, isGrounded: boolean, dt: number): void {
    this.elapsed += dt;
    this.airborne = !isGrounded;

    // Detect when approaching a jump zone — start charging
    const progress = -playerZ / this.courseLength;
    if (this.nextJumpIndex < this.jumpZones.length) {
      const nextJump = this.jumpZones[this.nextJumpIndex];
      const dist = nextJump - progress;
      if (dist < 0.02 && dist > -0.01 && !this.jumpCharging && isGrounded) {
        this.jumpCharging = true;
        this.jumpChargeTime = 0;
      }
      if (dist < -0.02) {
        this.nextJumpIndex++;
      }
    }

    if (this.jumpCharging) {
      this.jumpChargeTime += dt;
      if (this.jumpChargeTime > 0.4) {
        this.jumpCharging = false;
        this.jumpReleasedFlag = true;
        // Pick random trick for this jump
        this.trickType = Math.floor(Math.random() * 4);
        this.trickPhase = 0;
      }
    }

    // Reset trick when landing
    if (isGrounded && this.trickPhase > 0) {
      this.trickPhase = 0;
    }
    if (!isGrounded) {
      this.trickPhase += dt;
    }
  }

  getState(): InputState {
    const jumpReleased = this.jumpReleasedFlag;
    this.jumpReleasedFlag = false;

    // S-turn steering: gentle sinusoidal
    let steerInput = Math.sin(this.elapsed * 0.7) * 0.5;

    // Airborne tricks
    let tuckInput = false;
    let brakeInput = false;

    if (this.airborne && this.trickPhase > 0.1) {
      switch (this.trickType) {
        case 0: // spin left
          steerInput = -1;
          break;
        case 1: // spin right
          steerInput = 1;
          break;
        case 2: // grab (tuck)
          tuckInput = true;
          break;
        case 3: // flip (brake)
          brakeInput = true;
          break;
      }
    }

    // Tuck on straightaways (when not turning much and grounded)
    if (!this.airborne && Math.abs(steerInput) < 0.2) {
      tuckInput = true;
    }

    return {
      steerInput,
      tuckInput,
      brakeInput,
      jumpHeld: this.jumpCharging,
      jumpReleased,
    };
  }
}
