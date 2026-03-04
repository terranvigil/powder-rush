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
const CAMERA_SMOOTH = 5;
const LOOK_AHEAD = 5;
const MAX_SPEED_FOR_FOV = 40;

// Dynamic camera — Phase 11
const CAMERA_DISTANCE = 8;
const CAMERA_PULLBACK = 4;    // extra distance at max speed (8 → 12)
const CAMERA_HEIGHT = 4;
const CAMERA_DROP = 1.5;      // height reduction at max speed (4 → 2.5)
const ORBIT_SCALE = 3;        // lateral orbit in turn direction
const LOOK_ORBIT = 1.5;       // look target orbit offset

// Right-mouse orbit
const ORBIT_SENSITIVITY = 0.004; // radians per pixel of mouse drag
const ORBIT_SNAP_SPEED = 4;     // radians/s snap-back when released
const MAX_ORBIT_YAW = Math.PI * 0.75; // ±135° orbit limit

export class SkierCamera {
  readonly camera: UniversalCamera;
  private scene: Scene;
  private player: PlayerController;
  private heightFn: (x: number, z: number) => number;
  private currentFov = BASE_FOV;
  private currentTilt = 0;
  private landingPunch = 0;
  private wasAirborne = false;
  private firstFrame = true;
  private currentPosition: Vector3;

  // Right-mouse orbit state
  private orbitYaw = 0;       // current yaw offset in radians
  private orbitDragging = false;

  constructor(scene: Scene, canvas: HTMLCanvasElement, player: PlayerController, heightFn: (x: number, z: number) => number) {
    this.scene = scene;
    this.player = player;
    this.heightFn = heightFn;

    this.camera = new UniversalCamera("skierCam", Vector3.Zero(), scene);
    this.camera.fov = BASE_FOV;
    this.camera.minZ = 0.1;
    this.camera.maxZ = 500;

    // Detach default controls — we position manually
    this.camera.detachControl();

    // Right-mouse orbit controls — attached to document so HUD overlays don't block
    document.addEventListener("pointerdown", (e) => {
      if (e.button === 2) { this.orbitDragging = true; e.preventDefault(); }
    });
    document.addEventListener("pointerup", (e) => {
      if (e.button === 2) this.orbitDragging = false;
    });
    document.addEventListener("pointermove", (e) => {
      if (!this.orbitDragging) return;
      this.orbitYaw = Math.max(-MAX_ORBIT_YAW, Math.min(MAX_ORBIT_YAW,
        this.orbitYaw + e.movementX * ORBIT_SENSITIVITY));
    });
    document.addEventListener("contextmenu", (e) => {
      // Only prevent context menu on the game canvas
      if (e.target === canvas) e.preventDefault();
    });

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
    const lean = this.player.lean;

    const speedRatio = Math.min(speed / MAX_SPEED_FOR_FOV, 1);

    // Snap orbit yaw back to 0 when not dragging
    if (!this.orbitDragging && Math.abs(this.orbitYaw) > 0.001) {
      const snapAmount = ORBIT_SNAP_SPEED * dt;
      if (Math.abs(this.orbitYaw) <= snapAmount) {
        this.orbitYaw = 0;
      } else {
        this.orbitYaw -= Math.sign(this.orbitYaw) * snapAmount;
      }
    }

    // Dynamic distance: pulls back at high speed
    const dynamicDistance = CAMERA_DISTANCE + speedRatio * CAMERA_PULLBACK;

    // Dynamic height: drops lower at high speed
    const dynamicHeight = CAMERA_HEIGHT - speedRatio * CAMERA_DROP;

    // Right vector for orbit
    const right = Vector3.Cross(Vector3.Up(), playerForward).normalize();

    // Orbit offset in turn direction
    const orbitOffset = lean * ORBIT_SCALE;

    // Base offset behind player (before orbit yaw)
    const behindX = -playerForward.x * dynamicDistance + right.x * orbitOffset;
    const behindZ = -playerForward.z * dynamicDistance + right.z * orbitOffset;

    // Rotate offset around Y axis by orbitYaw
    const cosY = Math.cos(this.orbitYaw);
    const sinY = Math.sin(this.orbitYaw);
    const orbitedX = behindX * cosY - behindZ * sinY;
    const orbitedZ = behindX * sinY + behindZ * cosY;

    // Target position: player + orbited offset + height
    const targetPos = new Vector3(
      playerPos.x + orbitedX,
      playerPos.y + dynamicHeight,
      playerPos.z + orbitedZ
    );

    // Clamp camera above terrain at its own position (slope rises behind player)
    const terrainAtCam = this.heightFn(targetPos.x, targetPos.z);
    if (targetPos.y < terrainAtCam + 2) {
      targetPos.y = terrainAtCam + 2;
    }

    // Smooth follow (snap on first frame to avoid camera starting underground)
    if (this.firstFrame) {
      this.currentPosition.copyFrom(targetPos);
      this.firstFrame = false;
    } else {
      const lerpFactor = 1 - Math.exp(-CAMERA_SMOOTH * dt);
      this.currentPosition = Vector3.Lerp(this.currentPosition, targetPos, lerpFactor);
    }
    this.camera.position.copyFrom(this.currentPosition);

    // Look at player + forward offset + slight turn offset
    const lookOrbit = lean * LOOK_ORBIT;
    const lookTarget = new Vector3(
      playerPos.x + playerForward.x * LOOK_AHEAD + right.x * lookOrbit,
      playerPos.y - 1.0,
      playerPos.z + playerForward.z * LOOK_AHEAD + right.z * lookOrbit
    );
    this.camera.setTarget(lookTarget);

    // FOV boost with speed
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
    const targetTilt = -lean * (DUTCH_TILT_MAX / (25 * Math.PI / 180));
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
