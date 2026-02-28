import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder";
import { Vector3, Quaternion, Matrix } from "@babylonjs/core/Maths/math.vector";
import { PhysicsAggregate } from "@babylonjs/core/Physics/v2/physicsAggregate";
import { PhysicsShapeType } from "@babylonjs/core/Physics/v2/IPhysicsEnginePlugin";
import { PhysicsRaycastResult } from "@babylonjs/core/Physics/physicsRaycastResult";
import { PlayerInput } from "./PlayerInput";
import { SkierModel } from "./SkierModel";
import type { GearModifiers } from "../game/GearData";

// === Physics constants (based on real skiing physics) ===
// See physics.md for derivations and references

// Aerodynamic drag: a = (CdA * rho * v²) / (2 * m)
const AIR_DENSITY = 1.2;       // kg/m³
const SKIER_MASS = 75;         // kg
const CDA_NORMAL = 0.50;       // Cd×A — upright skiing stance
const CDA_TUCK = 0.15;         // Cd×A — full tuck (70% less drag)
const CDA_BRAKE = 0.70;        // Cd×A — braking stance, upright

// Snow friction: a = mu * g * cos(theta)  — constant deceleration
const SNOW_MU = 0.04;          // kinetic friction coefficient, groomed snow

// Braking: constant deceleration from snow plowing (NOT speed²)
const BRAKE_DECEL = 6.0;       // m/s² — effective hockey stop force

// Steering
const STEER_RATE = 0.50;       // rad/s base heading turn rate

// Edge grip: lateral friction that decays sideways velocity
const BASE_LATERAL_FRICTION = 12.0;  // /s decay rate at low speed (tight carving)
const MIN_LATERAL_FRICTION = 2.0;    // /s minimum even at max speed

// Lean
const LEAN_SPEED = 3;
const LEAN_RETURN_SPEED = 4;
const MAX_LEAN_ANGLE = 35;     // degrees — visually natural for game camera

// Jump
const JUMP_FORCE = 5.76;

// Self-propulsion (poling / skating)
const SKATE_SPEED_THRESHOLD = 6;   // m/s (~22 km/h) — below this, skating + poling
const POLE_SPEED_THRESHOLD = 14;   // m/s (~50 km/h) — below this, double poling only
const SKATE_ACCEL = 2.0;           // m/s² — skating + poling combined acceleration
const POLE_ACCEL = 1.0;            // m/s² — double poling acceleration

// Safety cap — prevents physics glitches, NOT gameplay speed limit
// Terminal velocity from drag/friction naturally limits speed
const SAFETY_MAX_SPEED = 45;   // m/s (~162 km/h)

export const enum CollisionState {
  NORMAL = 0,
  STUMBLE = 1,
  WIPEOUT = 2,
  RECOVERING = 3,
}

const STUMBLE_DURATION = 0.5;
const WIPEOUT_DURATION = 1.5;
const RECOVERY_DURATION = 1.0;
const STUMBLE_SPEED_THRESHOLD = 8;
const STUMBLE_SPEED_PENALTY = 0.7; // keep 70%
const WIPEOUT_SPEED_PENALTY = 0.2; // keep 20%

export class PlayerController {
  private scene: Scene;
  private input: PlayerInput;
  private physicsMesh: Mesh;
  private model: SkierModel;
  private aggregate: PhysicsAggregate;
  private raycastResult = new PhysicsRaycastResult();
  private gearMods: GearModifiers;

  // State
  private isGrounded = false;
  private terrainNormal = Vector3.Up();
  private heading = new Vector3(0, 0, -1); // direction skier faces on slope plane
  private leanAngle = 0;
  private crouchTime = 0;
  private isTucking = false;
  private isBraking = false;
  private isPoling = false;
  private isSkating = false;
  private lastSteerInput = 0;

  // Collision state
  private _collisionState: CollisionState = CollisionState.NORMAL;
  private _collisionTimer = 0;
  private _justCollided = false;
  private _collisionSeverity: "stumble" | "wipeout" = "stumble";
  private _registeredObstacles = new Set<PhysicsAggregate>();

  // Start gate
  private _frozen = true; // held at gate until countdown finishes

  // Race timing
  private _finishZ: number;
  private _raceStarted = false;
  private _raceStartTime = 0;
  private _finished = false;
  private _finishTime = 0;
  private _pauseAccum = 0;
  private _pauseStart = 0;

  // Event flags (consumed once per read)
  private _justJumped = false;
  private _justLanded = false;
  private _wasGrounded = true;

  get speed(): number {
    return this.aggregate.body.getLinearVelocity().length();
  }

  get position(): Vector3 {
    return this.physicsMesh.position.clone();
  }

  get forward(): Vector3 {
    return this.heading.clone();
  }

  get lean(): number {
    return this.leanAngle;
  }

  get grounded(): boolean {
    return this.isGrounded;
  }

  get braking(): boolean {
    return this.isBraking;
  }

  get tucking(): boolean {
    return this.isTucking;
  }

  get steerInput(): number {
    return this.lastSteerInput;
  }

  get poling(): boolean {
    return this.isPoling;
  }

  get skating(): boolean {
    return this.isSkating;
  }

  get finished(): boolean {
    return this._finished;
  }

  get raceTime(): number {
    if (!this._raceStarted) return 0;
    if (this._finished) return this._finishTime;
    return (performance.now() - this._raceStartTime - this._pauseAccum) / 1000;
  }

  pause(): void {
    this._pauseStart = performance.now();
  }

  resume(): void {
    if (this._pauseStart > 0) {
      this._pauseAccum += performance.now() - this._pauseStart;
      this._pauseStart = 0;
    }
  }

  setFrozen(frozen: boolean): void {
    this._frozen = frozen;
    if (frozen) {
      this.aggregate.body.setLinearVelocity(Vector3.Zero());
    }
  }

  applyStartPush(): void {
    this.aggregate.body.setLinearVelocity(new Vector3(0, 0, -3));
  }

  get collisionState(): CollisionState {
    return this._collisionState;
  }

  getModelMeshes(): import("@babylonjs/core/Meshes/mesh").Mesh[] {
    return this.model.root.getChildMeshes(false) as import("@babylonjs/core/Meshes/mesh").Mesh[];
  }

  consumeJumpEvent(): boolean {
    const v = this._justJumped;
    this._justJumped = false;
    return v;
  }

  consumeLandEvent(): boolean {
    const v = this._justLanded;
    this._justLanded = false;
    return v;
  }

  consumeCollisionEvent(): { severity: "stumble" | "wipeout" } | null {
    if (!this._justCollided) return null;
    this._justCollided = false;
    return { severity: this._collisionSeverity };
  }

  registerObstacleCollision(agg: PhysicsAggregate): void {
    if (this._registeredObstacles.has(agg)) return;
    this._registeredObstacles.add(agg);

    const playerBody = this.aggregate.body;
    const obsBody = agg.body;

    playerBody.getCollisionObservable().add((ev: any) => {
      if (this._collisionState !== CollisionState.NORMAL) return;
      if (this._finished) return;

      // Check if this collision involves the obstacle
      const other = ev.collidedAgainst;
      if (other !== obsBody) return;

      const speed = this.speed;
      if (speed < 1) return; // ignore near-standstill contact

      if (speed < STUMBLE_SPEED_THRESHOLD) {
        this._collisionState = CollisionState.STUMBLE;
        this._collisionTimer = STUMBLE_DURATION * this.gearMods.recoveryMultiplier;
        this._collisionSeverity = "stumble";

        // Speed penalty (gear adds crash protection)
        const vel = playerBody.getLinearVelocity();
        const retain = Math.min(1, STUMBLE_SPEED_PENALTY + this.gearMods.crashRetainBonus);
        playerBody.setLinearVelocity(vel.scale(retain));
      } else {
        this._collisionState = CollisionState.WIPEOUT;
        this._collisionTimer = WIPEOUT_DURATION * this.gearMods.recoveryMultiplier;
        this._collisionSeverity = "wipeout";

        // Speed penalty (gear adds crash protection)
        const vel = playerBody.getLinearVelocity();
        const retain = Math.min(1, WIPEOUT_SPEED_PENALTY + this.gearMods.crashRetainBonus);
        playerBody.setLinearVelocity(vel.scale(retain));
      }
      this._justCollided = true;
    });
  }

  constructor(scene: Scene, input: PlayerInput, spawnPosition: Vector3, finishZ: number, gearModifiers?: GearModifiers) {
    this.scene = scene;
    this.input = input;
    this._finishZ = finishZ;
    this.gearMods = gearModifiers ?? {
      maxSpeedBonus: 0, steerRateBonus: 0, recoveryMultiplier: 1, crashRetainBonus: 0,
    };

    // Invisible physics sphere
    this.physicsMesh = CreateSphere("playerPhysics", { diameter: 0.5 }, scene);
    this.physicsMesh.position = spawnPosition;
    this.physicsMesh.isVisible = false;

    this.aggregate = new PhysicsAggregate(
      this.physicsMesh,
      PhysicsShapeType.SPHERE,
      { mass: 75, restitution: 0.0, friction: 0.01 },
      scene
    );

    this.aggregate.body.setAngularDamping(1000);

    // Articulated skier model (purely visual)
    this.model = new SkierModel(scene);
    this.model.root.position = spawnPosition.clone();

    scene.onBeforePhysicsObservable.add(() => this.physicsStep());
    scene.onBeforeRenderObservable.add(() => this.visualUpdate());
  }

  private physicsStep(): void {
    const dt = this.scene.getEngine().getDeltaTime() / 1000;
    if (dt <= 0 || dt > 0.1) return; // skip bad frames

    const body = this.aggregate.body;
    body.setAngularVelocity(Vector3.Zero());

    // Held at start gate
    if (this._frozen) {
      body.setLinearVelocity(Vector3.Zero());
      return;
    }

    this.detectTerrain();

    // Landing detection (before any early returns)
    if (this.isGrounded && !this._wasGrounded) {
      this._justLanded = true;
    }
    this._wasGrounded = this.isGrounded;

    // Collision state timer
    if (this._collisionState !== CollisionState.NORMAL) {
      this._collisionTimer -= dt;
      if (this._collisionTimer <= 0) {
        if (this._collisionState === CollisionState.WIPEOUT) {
          this._collisionState = CollisionState.RECOVERING;
          this._collisionTimer = RECOVERY_DURATION * this.gearMods.recoveryMultiplier;
        } else {
          this._collisionState = CollisionState.NORMAL;
        }
      }
    }

    // Race start detection (first meaningful movement)
    if (!this._raceStarted && this.speed > 0.5) {
      this._raceStarted = true;
      this._raceStartTime = performance.now();
    }

    // Finish line detection
    if (!this._finished && this._raceStarted && this.physicsMesh.position.z <= this._finishZ) {
      this._finished = true;
      this._finishTime = (performance.now() - this._raceStartTime) / 1000;
    }

    // Auto-brake after finish — aggressively decelerate to stop
    if (this._finished) {
      let vel = body.getLinearVelocity();
      const speed = vel.length();
      if (speed > 0.3) {
        const brakeFactor = Math.max(0, 1 - dt * 3);
        vel = vel.scale(brakeFactor);
        body.setLinearVelocity(vel);
      } else {
        body.setLinearVelocity(Vector3.Zero());
      }
      this.isBraking = true;
      this.isTucking = false;
      this.isPoling = false;
      this.isSkating = false;
      this.lastSteerInput = 0;
      return; // Skip normal input processing
    }

    // Skip normal input during collision states
    if (this._collisionState === CollisionState.STUMBLE || this._collisionState === CollisionState.WIPEOUT) {
      this.isTucking = false;
      this.isPoling = false;
      this.isSkating = false;
      this.isBraking = true; // forced brake
      this.lastSteerInput = 0;
      return;
    }

    const inputState = this.input.getState();
    this.isBraking = inputState.brakeInput;
    this.lastSteerInput = inputState.steerInput;

    // W key: speed-based behavior
    // Slow/stopped → skating + poling (strongest acceleration)
    // Medium speed → double poling (moderate acceleration)
    // Fast → tuck (reduced drag, no acceleration)
    const currentSpeed = body.getLinearVelocity().length();
    if (inputState.tuckInput && this.isGrounded) {
      if (currentSpeed < SKATE_SPEED_THRESHOLD) {
        this.isSkating = true;
        this.isPoling = true;
        this.isTucking = false;
      } else if (currentSpeed < POLE_SPEED_THRESHOLD) {
        this.isSkating = false;
        this.isPoling = true;
        this.isTucking = false;
      } else {
        this.isSkating = false;
        this.isPoling = false;
        this.isTucking = true;
      }
    } else {
      this.isTucking = inputState.tuckInput; // airborne tuck still works for grabs
      this.isSkating = false;
      this.isPoling = false;
    }

    if (inputState.jumpHeld) {
      this.crouchTime += dt;
    }

    if (this.isGrounded) {
      let vel = body.getLinearVelocity();

      // --- Steering: rotate heading on the slope plane ---
      if (Math.abs(inputState.steerInput) > 0.01) {
        const speed = vel.length();
        const speedFactor = 1.0 / (1.0 + speed * 0.06);
        const turnAmount = inputState.steerInput * (STEER_RATE + this.gearMods.steerRateBonus) * speedFactor * dt;
        const rotQuat = Quaternion.RotationAxis(this.terrainNormal, turnAmount);
        this.heading = this.heading.applyRotationQuaternion(rotQuat).normalize();
      }

      // Align heading to slope plane
      this.heading = projectOnPlane(this.heading, this.terrainNormal);
      if (this.heading.lengthSquared() > 0.001) {
        this.heading.normalize();
      } else {
        this.heading = projectOnPlane(new Vector3(0, -1, 0), this.terrainNormal).normalize();
      }

      // --- Decompose velocity into forward / lateral / vertical ---
      const slopeVel = projectOnPlane(vel, this.terrainNormal);
      const verticalVel = vel.subtract(slopeVel);
      let forwardSpeed = Vector3.Dot(slopeVel, this.heading);
      const lateralVel = slopeVel.subtract(this.heading.scale(forwardSpeed));
      let lateralSpeed = lateralVel.length();
      const lateralDir = lateralSpeed > 0.001
        ? lateralVel.scale(1 / lateralSpeed)
        : Vector3.Zero();

      // --- Edge grip: lateral friction decays sideways sliding ---
      // This IS the sliding model — lateral velocity persists and decays via friction.
      // At high speed or on steep terrain, friction is lower → more slide.
      if (lateralSpeed > 0.01) {
        const slopeSpeed = slopeVel.length();
        const steepness = 1 - this.terrainNormal.y; // 0=flat, ~0.2=steep
        const speedGripLoss = Math.min(0.7, slopeSpeed * 0.028);
        const steepGripLoss = Math.min(0.3, steepness * 1.5);
        let frictionRate = Math.max(
          MIN_LATERAL_FRICTION,
          BASE_LATERAL_FRICTION * (1 - speedGripLoss - steepGripLoss)
        );
        // Braking digs edges in harder
        if (this.isBraking) frictionRate *= 2.0;
        const decay = Math.max(0, 1 - frictionRate * dt);
        lateralSpeed *= decay;
      }

      // --- Braking: constant deceleration (effective at ALL speeds) ---
      if (this.isBraking) {
        const totalSpeed = Math.sqrt(forwardSpeed * forwardSpeed + lateralSpeed * lateralSpeed);
        if (totalSpeed > 0.1) {
          const newSpeed = Math.max(0, totalSpeed - BRAKE_DECEL * dt);
          const ratio = newSpeed / totalSpeed;
          forwardSpeed *= ratio;
          lateralSpeed *= ratio;
        }
      }

      // --- Aerodynamic drag: a = (CdA * rho * v²) / (2 * m) ---
      {
        let cdA = CDA_NORMAL;
        if (this.isTucking) cdA = CDA_TUCK;
        else if (this.isBraking) cdA = CDA_BRAKE;
        const totalSpeed = Math.sqrt(forwardSpeed * forwardSpeed + lateralSpeed * lateralSpeed);
        if (totalSpeed > 0.01) {
          const dragDecel = (cdA * AIR_DENSITY * totalSpeed * totalSpeed) / (2 * SKIER_MASS);
          const newSpeed = Math.max(0, totalSpeed - dragDecel * dt);
          const ratio = newSpeed / totalSpeed;
          forwardSpeed *= ratio;
          lateralSpeed *= ratio;
        }
      }

      // --- Snow friction: mu * g * cos(theta) — constant, speed-independent ---
      {
        const cosTheta = this.terrainNormal.y;
        const frictionDecel = SNOW_MU * 9.81 * cosTheta;
        const totalSpeed = Math.sqrt(forwardSpeed * forwardSpeed + lateralSpeed * lateralSpeed);
        if (totalSpeed > 0.01) {
          const newSpeed = Math.max(0, totalSpeed - frictionDecel * dt);
          const ratio = newSpeed / totalSpeed;
          forwardSpeed *= ratio;
          lateralSpeed *= ratio;
        }
      }

      // --- Poling / skating acceleration ---
      if (this.isSkating) {
        forwardSpeed += SKATE_ACCEL * dt;
      } else if (this.isPoling) {
        forwardSpeed += POLE_ACCEL * dt;
      }

      // --- Reconstruct velocity ---
      vel = this.heading.scale(forwardSpeed)
        .add(lateralDir.scale(lateralSpeed))
        .add(verticalVel);

      // Safety speed cap
      const maxSpeed = SAFETY_MAX_SPEED + this.gearMods.maxSpeedBonus;
      if (vel.length() > maxSpeed) {
        vel = vel.normalize().scale(maxSpeed);
      }

      body.setLinearVelocity(vel);
    }

    // --- Airborne: aero drag only ---
    if (!this.isGrounded) {
      let vel = body.getLinearVelocity();
      const speed = vel.length();
      if (speed > 0.01) {
        const cdA = this.isTucking ? CDA_TUCK : CDA_NORMAL;
        const dragDecel = (cdA * AIR_DENSITY * speed * speed) / (2 * SKIER_MASS);
        const newSpeed = Math.max(0, speed - dragDecel * dt);
        vel = vel.normalize().scale(newSpeed);
      }
      const airMaxSpeed = SAFETY_MAX_SPEED + this.gearMods.maxSpeedBonus;
      if (speed > airMaxSpeed) {
        vel = vel.normalize().scale(airMaxSpeed);
      }
      body.setLinearVelocity(vel);
    }

    // --- Jump ---
    if (inputState.jumpReleased && this.isGrounded) {
      this._justJumped = true;
      const chargeTime = Math.min(this.crouchTime, 1.0);
      const jumpStrength = JUMP_FORCE * (0.5 + 0.5 * chargeTime);
      body.applyImpulse(this.terrainNormal.scale(jumpStrength), this.physicsMesh.position);
      this.crouchTime = 0;
    }
    if (!inputState.jumpHeld && !inputState.jumpReleased) {
      this.crouchTime = 0;
    }
  }

  private detectTerrain(): void {
    const pos = this.physicsMesh.position;
    const start = new Vector3(pos.x, pos.y + 0.5, pos.z);
    const end = new Vector3(pos.x, pos.y - 0.65, pos.z);

    const physicsEngine = this.scene.getPhysicsEngine()!;
    (physicsEngine as any).raycastToRef(start, end, this.raycastResult);

    if (this.raycastResult.hasHit) {
      this.isGrounded = true;
      this.terrainNormal = this.raycastResult.hitNormalWorld.clone();
    } else {
      this.isGrounded = false;
      this.terrainNormal = Vector3.Up();
    }
  }

  private visualUpdate(): void {
    const dt = this.scene.getEngine().getDeltaTime() / 1000;

    const targetLean = this.lastSteerInput * MAX_LEAN_ANGLE * (Math.PI / 180);
    if (Math.abs(this.lastSteerInput) > 0.01) {
      this.leanAngle = moveTowards(this.leanAngle, targetLean, LEAN_SPEED * dt);
    } else {
      this.leanAngle = moveTowards(this.leanAngle, 0, LEAN_RETURN_SPEED * dt);
    }

    // Update skier model pose
    const airborne = !this.isGrounded;
    const crouching = this.crouchTime > 0;
    const stumble = this._collisionState === CollisionState.STUMBLE;
    const wipeout = this._collisionState === CollisionState.WIPEOUT;
    const gettingUp = this._collisionState === CollisionState.RECOVERING;
    this.model.setState(this.isTucking, this.isBraking, crouching, airborne, this.leanAngle, stumble, wipeout, gettingUp, this.isPoling, this.isSkating);
    this.model.update(dt);

    this.alignMesh(dt);
  }

  private alignMesh(dt: number): void {
    if (this.heading.lengthSquared() < 0.01) return;

    // Sync visual model position to physics body
    this.model.root.position.copyFrom(this.physicsMesh.position);

    const up = this.terrainNormal;
    const forward = this.heading;

    const rotationMatrix = Matrix.Identity();
    Matrix.LookDirectionLHToRef(forward, up, rotationMatrix);
    const targetQuat = Quaternion.FromRotationMatrix(rotationMatrix);

    // Apply lean tilt
    const leanQuat = Quaternion.RotationAxis(forward, -this.leanAngle);
    const finalQuat = leanQuat.multiply(targetQuat);

    if (!this.model.root.rotationQuaternion) {
      this.model.root.rotationQuaternion = Quaternion.Identity();
    }
    Quaternion.SlerpToRef(
      this.model.root.rotationQuaternion,
      finalQuat,
      Math.min(1, 10 * dt),
      this.model.root.rotationQuaternion
    );
  }
}

function moveTowards(current: number, target: number, maxDelta: number): number {
  if (Math.abs(target - current) <= maxDelta) return target;
  return current + Math.sign(target - current) * maxDelta;
}

function projectOnPlane(vector: Vector3, planeNormal: Vector3): Vector3 {
  const dot = Vector3.Dot(vector, planeNormal);
  return vector.subtract(planeNormal.scale(dot));
}
