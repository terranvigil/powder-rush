import type { CourseType } from "./LevelPresets";

export interface TrickEvent {
  name: string;
  points: number;
}

// Spin/flip rates while airborne
const SPIN_RATE = 360;      // deg/s at full steer input
const FLIP_RATE = 300;      // deg/s while brake held

// Minimum thresholds (30° margin for imprecision)
const SPIN_360 = 330;
const SPIN_720 = 690;
const SPIN_1080 = 1050;
const FLIP_360 = 330;
const FLIP_720 = 690;

// Grab timing
const GRAB_MIN = 0.3;       // seconds for basic grab
const STYLE_GRAB_MIN = 1.0; // seconds for style grab

// Flow meter
const FLOW_GAIN_RATE = 8;   // per second at speed ~10 m/s
const FLOW_MAX = 100;

// Minimum airborne time to count tricks
const MIN_AIR_TIME = 0.3;

export class TrickDetector {
  // Airborne trick accumulators
  private spinAccum = 0;     // degrees (signed — direction matters)
  private flipAccum = 0;     // degrees (unsigned — only forward flips)
  private grabTime = 0;      // seconds tuck held while airborne
  private airborneTime = 0;
  private wasAirborne = false;

  // Flow meter: continuous clean skiing multiplier
  private _flowLevel = 0;    // 0–100

  // Cumulative trick score for the run
  private _totalScore = 0;

  // Pending events (consumed by Game each frame)
  private pendingTricks: TrickEvent[] = [];

  // Course-type modifiers
  private courseType: CourseType = "downhill";
  private maxAirHeight = 0;  // track peak height above ground for half-pipe

  get score(): number { return this._totalScore; }
  get flowLevel(): number { return this._flowLevel; }
  get flowMultiplier(): number { return 1 + this._flowLevel / FLOW_MAX; }

  setCourseType(ct: CourseType): void { this.courseType = ct; }

  /** Call each frame with height above terrain for half-pipe altitude tracking */
  updateAirHeight(heightAboveGround: number): void {
    if (!this.wasAirborne && heightAboveGround < 0.5) return;
    this.maxAirHeight = Math.max(this.maxAirHeight, heightAboveGround);
  }

  update(
    grounded: boolean,
    steerInput: number,
    tuckInput: boolean,
    brakeInput: boolean,
    speed: number,
    dt: number,
  ): void {
    // Flow meter — increases with speed, resets on collision (onCollision)
    if (speed > 3) {
      this._flowLevel = Math.min(FLOW_MAX, this._flowLevel + FLOW_GAIN_RATE * (speed / 10) * dt);
    }

    const airborne = !grounded;

    if (airborne) {
      this.airborneTime += dt;
      this.spinAccum += steerInput * SPIN_RATE * dt;
      if (brakeInput) this.flipAccum += FLIP_RATE * dt;
      if (tuckInput) this.grabTime += dt;
    }

    // Landing — score accumulated tricks
    if (this.wasAirborne && !airborne) {
      this.scoreTricks();
      this.resetAirborne();
    }

    this.wasAirborne = airborne;
  }

  onCollision(): void {
    this._flowLevel = 0;
  }

  consumeTricks(): TrickEvent[] {
    const out = this.pendingTricks;
    this.pendingTricks = [];
    return out;
  }

  private scoreTricks(): void {
    if (this.airborneTime < MIN_AIR_TIME) return;

    const tricks: { name: string; basePoints: number }[] = [];

    // Spins (check highest first)
    const absSpin = Math.abs(this.spinAccum);
    if (absSpin >= SPIN_1080) {
      tricks.push({ name: "1080 SPIN", basePoints: 600 });
    } else if (absSpin >= SPIN_720) {
      tricks.push({ name: "720 SPIN", basePoints: 300 });
    } else if (absSpin >= SPIN_360) {
      tricks.push({ name: "360 SPIN", basePoints: 100 });
    }

    // Flips
    if (this.flipAccum >= FLIP_720) {
      tricks.push({ name: "DOUBLE FLIP", basePoints: 500 });
    } else if (this.flipAccum >= FLIP_360) {
      tricks.push({ name: "FRONT FLIP", basePoints: 200 });
    }

    // Grabs
    if (this.grabTime >= STYLE_GRAB_MIN) {
      tricks.push({ name: "STYLE GRAB", basePoints: 100 });
    } else if (this.grabTime >= GRAB_MIN) {
      tricks.push({ name: "GRAB", basePoints: 50 });
    }

    // Moguls: bonus "BIG AIR" for any airborne trick on mogul course
    if (this.courseType === "moguls" && tricks.length === 0 && this.airborneTime >= 0.5) {
      tricks.push({ name: "MOGUL AIR", basePoints: 75 });
    }

    if (tricks.length === 0) return;

    // Combo multiplier for multiple tricks in one air
    let comboMult = 1;
    if (tricks.length === 2) comboMult = 1.5;
    else if (tricks.length === 3) comboMult = 2.0;
    else if (tricks.length >= 4) comboMult = 3.0;

    // Half-pipe altitude multiplier: higher air = bigger scores
    let pipeMult = 1;
    if (this.courseType === "halfPipe" && this.maxAirHeight > 2) {
      // 2m above ground = 1.5x, 4m = 2x, 6m+ = 2.5x
      pipeMult = 1 + Math.min(1.5, (this.maxAirHeight - 2) * 0.375);
    }

    // Moguls course gives 1.3x trick bonus across the board
    const mogulMult = this.courseType === "moguls" ? 1.3 : 1;

    const flowMult = this.flowMultiplier;

    for (const trick of tricks) {
      const points = Math.round(trick.basePoints * comboMult * flowMult * pipeMult * mogulMult);
      this._totalScore += points;
      this.pendingTricks.push({ name: trick.name, points });
    }

    // Half-pipe height notification
    if (this.courseType === "halfPipe" && pipeMult > 1) {
      const heightM = Math.round(this.maxAirHeight * 10) / 10;
      this.pendingTricks.push({ name: `${heightM}m HEIGHT`, points: 0 });
    }

    // Extra combo notification
    if (tricks.length >= 2) {
      this.pendingTricks.push({
        name: `${tricks.length}x COMBO`,
        points: 0,
      });
    }
  }

  private resetAirborne(): void {
    this.spinAccum = 0;
    this.flipAccum = 0;
    this.grabTime = 0;
    this.airborneTime = 0;
    this.maxAirHeight = 0;
  }
}
