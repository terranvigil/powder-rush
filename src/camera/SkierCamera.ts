import { Scene } from "@babylonjs/core/scene";
import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { PlayerController } from "../player/PlayerController";

// Camera tuning
const BASE_FOV = 65 * (Math.PI / 180);
const MAX_FOV = 80 * (Math.PI / 180);
const FOV_LERP_SPEED = 3;
const DUTCH_TILT_MAX = 4 * (Math.PI / 180);
const DUTCH_TILT_SPEED = 5;
const LANDING_PUNCH_FOV = 3 * (Math.PI / 180);
const LANDING_PUNCH_DECAY = 12;
const CAMERA_DISTANCE = 8;
const CAMERA_HEIGHT = 4;
const CAMERA_SMOOTH = 5;
const LOOK_AHEAD = 5;
const MAX_SPEED_FOR_FOV = 40;

export class SkierCamera {
  readonly camera: UniversalCamera;
  private scene: Scene;
  private player: PlayerController;
  private currentFov = BASE_FOV;
  private currentTilt = 0;
  private landingPunch = 0;
  private wasGrounded = true;
  private wasAirborne = false;
  private currentPosition: Vector3;

  constructor(scene: Scene, canvas: HTMLCanvasElement, player: PlayerController) {
    this.scene = scene;
    this.player = player;

    this.camera = new UniversalCamera("skierCam", Vector3.Zero(), scene);
    this.camera.fov = BASE_FOV;
    this.camera.minZ = 0.1;
    this.camera.maxZ = 500;

    // Detach default controls — we position manually
    this.camera.detachControl();

    // Initialize position behind player
    const playerPos = player.position;
    this.currentPosition = new Vector3(
      playerPos.x,
      playerPos.y + CAMERA_HEIGHT,
      playerPos.z + CAMERA_DISTANCE
    );
    this.camera.position = this.currentPosition.clone();
  }

  update(): void {
    const dt = this.scene.getEngine().getDeltaTime() / 1000;
    const playerPos = this.player.position;
    const playerForward = this.player.forward;
    const speed = this.player.speed;

    // Target position: behind + above player
    const targetPos = new Vector3(
      playerPos.x - playerForward.x * CAMERA_DISTANCE,
      playerPos.y + CAMERA_HEIGHT,
      playerPos.z - playerForward.z * CAMERA_DISTANCE
    );

    // Smooth follow
    const lerpFactor = 1 - Math.exp(-CAMERA_SMOOTH * dt);
    this.currentPosition = Vector3.Lerp(this.currentPosition, targetPos, lerpFactor);
    this.camera.position.copyFrom(this.currentPosition);

    // Look at player + forward offset
    const lookTarget = new Vector3(
      playerPos.x + playerForward.x * LOOK_AHEAD,
      playerPos.y,
      playerPos.z + playerForward.z * LOOK_AHEAD
    );
    this.camera.setTarget(lookTarget);

    // FOV boost with speed
    const speedRatio = Math.min(speed / MAX_SPEED_FOR_FOV, 1);
    const targetFov = BASE_FOV + (MAX_FOV - BASE_FOV) * speedRatio;
    this.currentFov = lerp(this.currentFov, targetFov, FOV_LERP_SPEED * dt);

    // Landing detection
    if (this.wasAirborne && this.player.grounded) {
      this.landingPunch = LANDING_PUNCH_FOV;
    }
    this.wasAirborne = !this.player.grounded;

    // Decay landing punch
    this.landingPunch = moveTowards(this.landingPunch, 0, LANDING_PUNCH_DECAY * dt);

    this.camera.fov = this.currentFov + this.landingPunch;

    // Dutch tilt based on lean
    const targetTilt = -this.player.lean * (DUTCH_TILT_MAX / (25 * Math.PI / 180));
    this.currentTilt = lerp(this.currentTilt, targetTilt, DUTCH_TILT_SPEED * dt);
    this.camera.rotation.z = this.currentTilt;
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.min(t, 1);
}

function moveTowards(current: number, target: number, maxDelta: number): number {
  if (Math.abs(target - current) <= maxDelta) return target;
  return current + Math.sign(target - current) * maxDelta;
}
