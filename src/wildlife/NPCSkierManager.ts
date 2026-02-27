import { Scene } from "@babylonjs/core/scene";
import { Vector3, Quaternion, Matrix } from "@babylonjs/core/Maths/math.vector";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { SlopeFunction } from "../terrain/SlopeFunction";
import { SlopeSpline } from "../terrain/SlopeSpline";
import { NPCSkierModel } from "./NPCSkierModel";
import { hash } from "../terrain/Noise";

const NPC_COUNT = 4;
const TOTAL_LENGTH = 1200;
const RECYCLE_BEHIND = 80; // distance behind player to recycle
const SPAWN_AHEAD_MIN = 30;
const SPAWN_AHEAD_MAX = 100;

interface NPCState {
  z: number;
  lateralOffset: number;
  speed: number;
  wobblePhase: number;
  wobbleFreq: number;
  model: NPCSkierModel;
  prevX: number;
  prevZ: number;
  tuck: boolean;
}

export class NPCSkierManager {
  private scene: Scene;
  private slopeFunction: SlopeFunction;
  private spline: SlopeSpline;
  private shadowGen: ShadowGenerator;
  private npcs: NPCState[] = [];

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

    // Spawn initial NPCs ahead of player
    for (let i = 0; i < NPC_COUNT; i++) {
      this.spawnNPC(i, -(SPAWN_AHEAD_MIN + hash(i * 13 + 6000) * (SPAWN_AHEAD_MAX - SPAWN_AHEAD_MIN)));
    }
  }

  update(playerZ: number, dt: number): void {
    for (const npc of this.npcs) {
      // Advance position
      npc.z -= npc.speed * dt;

      // Clamp to run length
      const finishZ = -(TOTAL_LENGTH - 60);
      if (npc.z < finishZ) {
        npc.z = finishZ;
        npc.speed = 0;
      }

      // Wobble
      npc.wobblePhase += npc.wobbleFreq * dt;
      const wobble = Math.sin(npc.wobblePhase) * 2;

      // X position: follow spline center + lateral offset + wobble
      const centerX = this.spline.centerXAt(npc.z);
      const x = centerX + npc.lateralOffset + wobble;
      const y = this.slopeFunction.heightAt(x, npc.z);

      npc.model.root.position.set(x, y, npc.z);

      // Heading from position delta
      const dx = x - npc.prevX;
      const dz = npc.z - npc.prevZ;
      if (Math.abs(dx) > 0.001 || Math.abs(dz) > 0.001) {
        const heading = new Vector3(dx, 0, dz).normalize();
        const terrainUp = Vector3.Up();
        const rotMatrix = Matrix.Identity();
        Matrix.LookDirectionLHToRef(heading, terrainUp, rotMatrix);
        const quat = Quaternion.FromRotationMatrix(rotMatrix);
        if (!npc.model.root.rotationQuaternion) {
          npc.model.root.rotationQuaternion = Quaternion.Identity();
        }
        Quaternion.SlerpToRef(npc.model.root.rotationQuaternion, quat, Math.min(1, 5 * dt), npc.model.root.rotationQuaternion);
      }

      npc.prevX = x;
      npc.prevZ = npc.z;

      // Randomly alternate tuck/normal based on phase
      const tuckNow = Math.sin(npc.wobblePhase * 0.3) > 0.3;
      if (tuckNow !== npc.tuck) {
        npc.tuck = tuckNow;
        npc.model.setTucking(tuckNow);
      }

      npc.model.update(dt);

      // Recycle if too far behind player
      if (npc.z > playerZ + RECYCLE_BEHIND) {
        this.recycleNPC(npc, playerZ);
      }
    }
  }

  private spawnNPC(id: number, z: number): void {
    const model = new NPCSkierModel(this.scene, id);
    const lateralOffset = (hash(id * 13 + 6001) - 0.5) * 12;
    const speed = 8 + hash(id * 13 + 6002) * 6; // 8-14 m/s

    const centerX = this.spline.centerXAt(z);
    const x = centerX + lateralOffset;
    const y = this.slopeFunction.heightAt(x, z);
    model.root.position = new Vector3(x, y, z);

    // Register as shadow casters
    for (const child of model.root.getChildMeshes()) {
      this.shadowGen.addShadowCaster(child);
    }

    this.npcs.push({
      z,
      lateralOffset,
      speed,
      wobblePhase: hash(id * 13 + 6003) * Math.PI * 2,
      wobbleFreq: 1.5 + hash(id * 13 + 6004) * 1.5,
      model,
      prevX: x,
      prevZ: z,
      tuck: false,
    });
  }

  private recycleNPC(npc: NPCState, playerZ: number): void {
    // Place ahead of player
    npc.z = playerZ - SPAWN_AHEAD_MIN - Math.random() * (SPAWN_AHEAD_MAX - SPAWN_AHEAD_MIN);
    npc.speed = 8 + Math.random() * 6;

    const finishZ = -(TOTAL_LENGTH - 60);
    if (npc.z < finishZ) {
      npc.z = finishZ;
      npc.speed = 0;
    }

    const centerX = this.spline.centerXAt(npc.z);
    const x = centerX + npc.lateralOffset;
    const y = this.slopeFunction.heightAt(x, npc.z);
    npc.model.root.position.set(x, y, npc.z);
    npc.prevX = x;
    npc.prevZ = npc.z;
  }
}
