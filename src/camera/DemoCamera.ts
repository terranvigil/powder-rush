import { Scene } from "@babylonjs/core/scene";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";

interface CameraAngle {
  name: string;
  offset: Vector3;       // offset from target
  fov: number;           // field of view in radians
  lookAhead: number;     // look ahead distance (negative Z)
  fixed: boolean;        // if true, camera stays at world position when set
}

const ANGLES: CameraAngle[] = [
  { name: "low-chase",  offset: new Vector3(0, 2, 6),     fov: 1.1, lookAhead: 8,  fixed: false },
  { name: "side-track", offset: new Vector3(12, 3, 0),    fov: 1.0, lookAhead: 5,  fixed: false },
  { name: "helicopter", offset: new Vector3(0, 20, 15),   fov: 1.3, lookAhead: 15, fixed: false },
  { name: "close-up",   offset: new Vector3(1, 1.5, 3),   fov: 0.8, lookAhead: 4,  fixed: false },
  { name: "reverse",    offset: new Vector3(0, 3, -10),   fov: 1.0, lookAhead: -5, fixed: false },
  { name: "flyby",      offset: new Vector3(8, 4, 20),    fov: 1.0, lookAhead: 0,  fixed: true },
];

const ANGLE_DURATION = 6.0;   // seconds per angle
const BLEND_DURATION = 1.5;   // transition time

export class DemoCamera {
  readonly camera: FreeCamera;
  private heightFn: (x: number, z: number) => number;
  private currentAngle = 0;
  private angleTimer = 0;
  private blending = false;
  private blendTimer = 0;
  private prevPos = Vector3.Zero();
  private prevTarget = Vector3.Zero();
  private angleOrder: number[] = [];

  constructor(scene: Scene, canvas: HTMLCanvasElement, heightFn: (x: number, z: number) => number) {
    this.camera = new FreeCamera("demoCamera", new Vector3(0, 10, 10), scene);
    this.camera.fov = 1.0;
    this.camera.minZ = 0.5;
    this.camera.maxZ = 500;
    this.camera.attachControl(canvas, false);
    // Detach user input — this is AI-controlled
    this.camera.detachControl();
    this.heightFn = heightFn;
    this.shuffleAngles();
  }

  private shuffleAngles(): void {
    this.angleOrder = ANGLES.map((_, i) => i);
    // Fisher-Yates shuffle
    for (let i = this.angleOrder.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.angleOrder[i], this.angleOrder[j]] = [this.angleOrder[j], this.angleOrder[i]];
    }
    this.currentAngle = 0;
  }

  update(targetPos: Vector3, dt: number): void {
    this.angleTimer += dt;

    // Time to switch angle?
    if (this.angleTimer >= ANGLE_DURATION && !this.blending) {
      this.blending = true;
      this.blendTimer = 0;
      this.prevPos = this.camera.position.clone();
      this.prevTarget = this.camera.getTarget().clone();
      this.currentAngle++;
      if (this.currentAngle >= this.angleOrder.length) {
        this.shuffleAngles();
      }
    }

    const angle = ANGLES[this.angleOrder[this.currentAngle]];

    // Compute ideal camera position
    let idealPos: Vector3;
    if (angle.fixed && !this.blending) {
      // Fixed flyby: camera stays put, only target changes
      idealPos = this.camera.position.clone();
    } else {
      idealPos = targetPos.add(angle.offset);
    }

    // Terrain collision: push camera above terrain
    const terrainY = this.heightFn(idealPos.x, idealPos.z);
    if (idealPos.y < terrainY + 2) {
      idealPos.y = terrainY + 2;
    }

    // Look-at target (ahead of skier)
    const idealTarget = new Vector3(targetPos.x, targetPos.y + 1, targetPos.z - angle.lookAhead);

    // Apply position and target
    if (this.blending) {
      this.blendTimer += dt;
      const t = Math.min(1, this.blendTimer / BLEND_DURATION);
      const ease = t * t * (3 - 2 * t); // smoothstep
      this.camera.position = Vector3.Lerp(this.prevPos, idealPos, ease);
      const blendTarget = Vector3.Lerp(this.prevTarget, idealTarget, ease);
      this.camera.setTarget(blendTarget);
      this.camera.fov = this.camera.fov + (angle.fov - this.camera.fov) * ease;
      if (t >= 1) {
        this.blending = false;
        this.angleTimer = 0;
        // If this is a fixed angle, lock position now
        if (angle.fixed) {
          // Position is already set from the blend end
        }
      }
    } else {
      // Smooth follow
      const lerpRate = 1 - Math.exp(-3 * dt);
      this.camera.position = Vector3.Lerp(this.camera.position, idealPos, lerpRate);
      this.camera.setTarget(idealTarget);
      this.camera.fov = this.camera.fov + (angle.fov - this.camera.fov) * lerpRate;
    }
  }
}
