import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { SlopeFunction } from "../terrain/SlopeFunction";
import { SlopeSpline } from "../terrain/SlopeSpline";
import { WildlifeModel } from "./WildlifeModel";
import { hash } from "../terrain/Noise";

const TOTAL_ANIMALS = 30;
const TOTAL_LENGTH = 1200;
const FLEE_RADIUS = 25;
const BUNNY_FLEE_SPEED = 6;
const DEER_FLEE_SPEED = 10;
const FLEE_DURATION = 3.5;
const SPAWN_WINDOW = 120; // meters ahead/behind to keep animals alive

interface AnimalState {
  baseX: number;
  baseZ: number;
  x: number;
  z: number;
  model: WildlifeModel;
  isBunny: boolean;
  state: "idle" | "fleeing";
  fleeTimer: number;
  fleeVx: number;
  fleeVz: number;
}

export class WildlifeManager {
  private scene: Scene;
  private slopeFunction: SlopeFunction;
  private spline: SlopeSpline;
  private shadowGen: ShadowGenerator;
  private animals = new Map<number, AnimalState>();

  constructor(
    scene: Scene,
    slopeFunction: SlopeFunction,
    spline: SlopeSpline,
    shadowGen: ShadowGenerator
  ) {
    this.scene = scene;
    this.slopeFunction = slopeFunction;
    this.spline = spline;
    this.shadowGen = shadowGen;
  }

  update(playerPos: Vector3, _playerSpeed: number, dt: number): void {
    const playerZ = playerPos.z;

    // Spawn/despawn based on distance
    for (let i = 0; i < TOTAL_ANIMALS; i++) {
      const z = -30 - hash(i * 11 + 5000) * (TOTAL_LENGTH - 90);
      const inRange = z < playerZ + SPAWN_WINDOW && z > playerZ - SPAWN_WINDOW;

      if (inRange && !this.animals.has(i)) {
        this.spawnAnimal(i, z);
      } else if (!inRange && this.animals.has(i)) {
        this.despawnAnimal(i);
      }
    }

    // Update all active animals
    for (const [_id, animal] of this.animals) {
      // Flee check
      if (animal.state === "idle") {
        const dx = playerPos.x - animal.x;
        const dz = playerPos.z - animal.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist < FLEE_RADIUS) {
          // Flee perpendicular to player's approach + slightly downhill
          const approachLen = Math.max(0.01, dist);
          const approachX = dx / approachLen;
          const approachZ = dz / approachLen;

          // Perpendicular: rotate 90 degrees, pick the side away from player
          let perpX = -approachZ;
          let perpZ = approachX;

          // Add slight downhill bias
          perpZ -= 0.3;
          const pLen = Math.sqrt(perpX * perpX + perpZ * perpZ);
          perpX /= pLen;
          perpZ /= pLen;

          const speed = animal.isBunny ? BUNNY_FLEE_SPEED : DEER_FLEE_SPEED;
          animal.fleeVx = perpX * speed;
          animal.fleeVz = perpZ * speed;
          animal.state = "fleeing";
          animal.fleeTimer = FLEE_DURATION;
          animal.model.setFleeing(new Vector3(perpX, 0, perpZ));
        }
      }

      if (animal.state === "fleeing") {
        animal.fleeTimer -= dt;
        if (animal.fleeTimer <= 0) {
          animal.state = "idle";
          animal.fleeVx = 0;
          animal.fleeVz = 0;
        } else {
          animal.x += animal.fleeVx * dt;
          animal.z += animal.fleeVz * dt;
        }
      }

      // Update position
      const y = this.slopeFunction.heightAt(animal.x, animal.z);
      animal.model.root.position.set(animal.x, y, animal.z);

      // Face direction of movement if fleeing
      if (animal.state === "fleeing" && (Math.abs(animal.fleeVx) > 0.01 || Math.abs(animal.fleeVz) > 0.01)) {
        animal.model.root.rotation.y = Math.atan2(animal.fleeVx, animal.fleeVz);
      }

      animal.model.update(dt);
    }
  }

  private spawnAnimal(index: number, z: number): void {
    const isBunny = hash(index * 11 + 5001) < 0.6;
    const centerX = this.spline.centerXAt(z);
    const halfWidth = this.spline.halfWidthAt(z);

    // Place near edges of skiable area or in margins
    const side = hash(index * 11 + 5002) < 0.5 ? -1 : 1;
    const offset = halfWidth * 0.3 + hash(index * 11 + 5003) * halfWidth * 0.5;
    const x = centerX + side * offset;
    const y = this.slopeFunction.heightAt(x, z);

    const model = new WildlifeModel(this.scene, isBunny, index);
    model.root.position = new Vector3(x, y, z);
    model.root.rotation.y = hash(index * 11 + 5004) * Math.PI * 2;

    // Register as shadow casters
    for (const child of model.root.getChildMeshes()) {
      this.shadowGen.addShadowCaster(child);
    }

    this.animals.set(index, {
      baseX: x,
      baseZ: z,
      x, z,
      model,
      isBunny,
      state: "idle",
      fleeTimer: 0,
      fleeVx: 0,
      fleeVz: 0,
    });
  }

  private despawnAnimal(index: number): void {
    const animal = this.animals.get(index);
    if (!animal) return;

    for (const child of animal.model.root.getChildMeshes()) {
      this.shadowGen.removeShadowCaster(child as Mesh);
    }
    animal.model.dispose();
    this.animals.delete(index);
  }
}
