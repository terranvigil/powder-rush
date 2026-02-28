import { Scene } from "@babylonjs/core/scene";
import { SlopeFunction } from "../terrain/SlopeFunction";
import { SlopeSpline } from "../terrain/SlopeSpline";
import { NPCSkierModel } from "../wildlife/NPCSkierModel";

const TOTAL_LENGTH = 1200;
const FINISH_Z = -(TOTAL_LENGTH - 60);

// AI racer averages ~12 m/s with speed variation
const BASE_SPEED = 12;
const SPEED_VARIATION = 2;
const WOBBLE_FREQ = 0.15;
const LATERAL_OFFSET = -8; // left of center

export class RaceOpponent {
  private slopeFunction: SlopeFunction;
  private spline: SlopeSpline;
  private model: NPCSkierModel;
  private z = -5;
  private elapsed = 0;
  private _finished = false;
  private _finishTime = 0;

  constructor(
    scene: Scene,
    slopeFunction: SlopeFunction,
    spline: SlopeSpline,
  ) {
    this.slopeFunction = slopeFunction;
    this.spline = spline;
    this.model = new NPCSkierModel(scene, 999);

    const x = spline.centerXAt(this.z) + LATERAL_OFFSET;
    const y = slopeFunction.heightAt(x, this.z);
    this.model.root.position.set(x, y, this.z);
  }

  update(playerZ: number, dt: number): void {
    if (this._finished) return;

    this.elapsed += dt;

    const speed = BASE_SPEED + Math.sin(this.elapsed * WOBBLE_FREQ * Math.PI * 2) * SPEED_VARIATION;
    this.z -= speed * dt;

    if (this.z <= FINISH_Z) {
      this.z = FINISH_Z;
      this._finished = true;
      this._finishTime = this.elapsed;
    }

    const cx = this.spline.centerXAt(this.z) + LATERAL_OFFSET;
    const y = this.slopeFunction.heightAt(cx, this.z);
    this.model.root.position.set(cx, y, this.z);

    // Face downhill direction
    const nextZ = this.z - 1;
    const nextX = this.spline.centerXAt(nextZ) + LATERAL_OFFSET;
    const dx = nextX - cx;
    const dz = nextZ - this.z;
    this.model.root.rotation.y = Math.atan2(dx, dz);

    this.model.setTucking(speed > BASE_SPEED);
    this.model.update(dt);

    // Visibility culling
    const dist = Math.abs(this.z - playerZ);
    this.model.root.setEnabled(dist < 200);
  }

  /** Positive = player ahead, negative = opponent ahead */
  getZDelta(playerZ: number): number {
    return playerZ - this.z;
  }

  get finished(): boolean { return this._finished; }
  get finishTime(): number { return this._finishTime; }
  get positionZ(): number { return this.z; }
}
