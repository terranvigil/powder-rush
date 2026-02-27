import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { SlopeSpline } from "./SlopeSpline";
import { SlopeFunction } from "./SlopeFunction";
import { TerrainChunk, SharedMaterials } from "./TerrainChunk";

const TOTAL_LENGTH = 1200;
const CHUNK_SIZE = 150;
const TOTAL_CHUNKS = Math.ceil(TOTAL_LENGTH / CHUNK_SIZE); // 8
const CHUNKS_BEHIND = 2;
const CHUNKS_AHEAD = 3;

export class ChunkManager {
  private scene: Scene;
  readonly spline: SlopeSpline;
  readonly slopeFunction: SlopeFunction;
  private materials: SharedMaterials;
  readonly shadowGen: ShadowGenerator;
  private chunks = new Map<number, TerrainChunk>();
  private finishBuilt = false;
  private newObstacleAggregates: import("@babylonjs/core/Physics/v2/physicsAggregate").PhysicsAggregate[] = [];

  readonly spawnPosition: Vector3;
  readonly finishZ: number;
  startWandPivot: TransformNode | null = null;

  constructor(scene: Scene, shadowGen: ShadowGenerator) {
    this.scene = scene;
    this.shadowGen = shadowGen;
    this.spline = new SlopeSpline(TOTAL_LENGTH);
    this.slopeFunction = new SlopeFunction(this.spline);
    this.materials = this.createMaterials();

    // Finish line 60m before end
    this.finishZ = -(TOTAL_LENGTH - 60);

    // Spawn position — on the flat start pad, just behind the gate wand
    const spawnY = this.slopeFunction.heightAt(0, -2) + 1;
    this.spawnPosition = new Vector3(0, spawnY, -2);

    // Build initial chunks around spawn
    this.update(0);

    // Build start gate (always in chunk 0)
    this.buildStartGate();
  }

  getHeight(x: number, z: number): number {
    return this.slopeFunction.heightAt(x, z);
  }

  getNewObstacleAggregates(): import("@babylonjs/core/Physics/v2/physicsAggregate").PhysicsAggregate[] {
    const result = this.newObstacleAggregates;
    this.newObstacleAggregates = [];
    return result;
  }

  update(playerZ: number): void {
    // Which chunk is the player in?
    const currentChunkIdx = Math.max(0, Math.floor(-playerZ / CHUNK_SIZE));

    // Desired window
    const minChunk = Math.max(0, currentChunkIdx - CHUNKS_BEHIND);
    const maxChunk = Math.min(TOTAL_CHUNKS - 1, currentChunkIdx + CHUNKS_AHEAD);

    // Spawn missing chunks
    for (let i = minChunk; i <= maxChunk; i++) {
      if (!this.chunks.has(i)) {
        const chunk = new TerrainChunk(
          i, CHUNK_SIZE, this.scene,
          this.slopeFunction, this.spline, this.materials, this.shadowGen
        );
        chunk.build();
        this.chunks.set(i, chunk);

        // Collect obstacle aggregates for collision registration
        const obsAggs = chunk.getObstacleAggregates();
        for (const a of obsAggs) this.newObstacleAggregates.push(a);

        // Build finish gate when we spawn the chunk containing finishZ
        if (!this.finishBuilt && this.finishZ >= chunk.zEnd && this.finishZ <= chunk.zStart) {
          this.buildFinishGate();
          this.finishBuilt = true;
        }
      }
    }

    // Dispose chunks outside window
    for (const [idx, chunk] of this.chunks) {
      if (idx < minChunk || idx > maxChunk) {
        chunk.dispose();
        this.chunks.delete(idx);
      }
    }
  }

  private createMaterials(): SharedMaterials {
    const snow = new StandardMaterial("snowMat", this.scene);
    snow.diffuseColor = new Color3(1.0, 1.0, 1.0);
    snow.specularPower = 32;
    snow.specularColor = new Color3(0.5, 0.5, 0.55);

    const mountain = new StandardMaterial("mountainMat", this.scene);
    mountain.diffuseColor = new Color3(1, 1, 1);
    mountain.specularColor = new Color3(0.1, 0.1, 0.1);

    const pineTrunk = new StandardMaterial("pineTrunkMat", this.scene);
    pineTrunk.diffuseColor = new Color3(0.35, 0.22, 0.1);

    const pineCanopy = new StandardMaterial("pineCanopyMat", this.scene);
    pineCanopy.diffuseColor = new Color3(0.12, 0.35, 0.08);

    const aspenTrunk = new StandardMaterial("aspenTrunkMat", this.scene);
    aspenTrunk.diffuseColor = new Color3(0.85, 0.82, 0.75);

    const aspenCanopy = new StandardMaterial("aspenCanopyMat", this.scene);
    aspenCanopy.diffuseColor = new Color3(0.55, 0.65, 0.15);

    const treeSnow = new StandardMaterial("treeSnowMat", this.scene);
    treeSnow.diffuseColor = new Color3(0.94, 0.97, 1.0);

    const finishPole = new StandardMaterial("finishPoleMat", this.scene);
    finishPole.diffuseColor = new Color3(0.9, 0.15, 0.1);

    const finishBanner = new StandardMaterial("finishBannerMat", this.scene);
    finishBanner.diffuseColor = new Color3(1.0, 0.85, 0.1);

    const rock = new StandardMaterial("rockMat", this.scene);
    rock.diffuseColor = new Color3(0.45, 0.40, 0.38);
    rock.specularColor = new Color3(0.1, 0.1, 0.1);

    const stump = new StandardMaterial("stumpMat", this.scene);
    stump.diffuseColor = new Color3(0.40, 0.28, 0.15);

    const stumpSnow = new StandardMaterial("stumpSnowMat", this.scene);
    stumpSnow.diffuseColor = new Color3(0.94, 0.97, 1.0);

    return {
      snow, mountain, pineTrunk, pineCanopy,
      aspenTrunk, aspenCanopy, treeSnow, finishPole, finishBanner,
      rock, stump, stumpSnow
    };
  }

  private buildStartGate(): void {
    const gateZ = -3; // just downhill of spawn
    const centerX = this.spline.centerXAt(gateZ);
    const gateY = this.slopeFunction.heightAt(centerX, gateZ);

    const gateWidth = 4; // shoulder-width
    const poleHeight = 2.5;
    const wandHeight = 0.4; // shin height

    // Gate pole material (red)
    const poleMat = this.materials.finishPole;

    // Wand material (yellow)
    const wandMat = new StandardMaterial("startWandMat", this.scene);
    wandMat.diffuseColor = new Color3(1.0, 0.85, 0.0);

    // Timing box material (dark)
    const boxMat = new StandardMaterial("startBoxMat", this.scene);
    boxMat.diffuseColor = new Color3(0.1, 0.1, 0.12);

    // Left pole
    const leftPole = CreateCylinder(
      "startPoleL",
      { height: poleHeight, diameter: 0.15, tessellation: 10 },
      this.scene
    );
    leftPole.position = new Vector3(centerX - gateWidth / 2, gateY + poleHeight / 2, gateZ);
    leftPole.material = poleMat;
    this.shadowGen.addShadowCaster(leftPole);

    // Right pole
    const rightPole = CreateCylinder(
      "startPoleR",
      { height: poleHeight, diameter: 0.15, tessellation: 10 },
      this.scene
    );
    rightPole.position = new Vector3(centerX + gateWidth / 2, gateY + poleHeight / 2, gateZ);
    rightPole.material = poleMat;
    this.shadowGen.addShadowCaster(rightPole);

    // Timing box on left pole
    const timingBox = CreateBox(
      "startTimingBox",
      { width: 0.25, height: 0.2, depth: 0.15 },
      this.scene
    );
    timingBox.position = new Vector3(
      centerX - gateWidth / 2 + 0.15,
      gateY + wandHeight + 0.15,
      gateZ
    );
    timingBox.material = boxMat;

    // Banner/crossbar at top
    const crossbar = CreateBox(
      "startCrossbar",
      { width: gateWidth, height: 0.2, depth: 0.1 },
      this.scene
    );
    crossbar.position = new Vector3(centerX, gateY + poleHeight, gateZ);
    crossbar.material = poleMat;
    this.shadowGen.addShadowCaster(crossbar);

    // Wand pivot — at left pole, at wand height, rotates around X to swing open
    const wandPivot = new TransformNode("startWandPivot", this.scene);
    wandPivot.position = new Vector3(centerX, gateY + wandHeight, gateZ);

    const wand = CreateCylinder(
      "startWand",
      { height: gateWidth - 0.2, diameter: 0.03, tessellation: 8 },
      this.scene
    );
    wand.rotation.z = Math.PI / 2; // lay horizontal
    wand.material = wandMat;
    wand.parent = wandPivot;
    this.shadowGen.addShadowCaster(wand);

    this.startWandPivot = wandPivot;
  }

  private buildFinishGate(): void {
    const gateZ = this.finishZ;
    const centerX = this.spline.centerXAt(gateZ);
    const gateY = this.slopeFunction.heightAt(centerX, gateZ);

    const gateWidth = 12;
    const poleHeight = 6;

    const leftPole = CreateCylinder(
      "finishPoleL",
      { height: poleHeight, diameter: 0.3, tessellation: 12 },
      this.scene
    );
    leftPole.position = new Vector3(centerX - gateWidth / 2, gateY + poleHeight / 2, gateZ);
    leftPole.material = this.materials.finishPole;

    const rightPole = CreateCylinder(
      "finishPoleR",
      { height: poleHeight, diameter: 0.3, tessellation: 12 },
      this.scene
    );
    rightPole.position = new Vector3(centerX + gateWidth / 2, gateY + poleHeight / 2, gateZ);
    rightPole.material = this.materials.finishPole;

    const banner = CreateBox(
      "finishBanner",
      { width: gateWidth, height: 1.2, depth: 0.15 },
      this.scene
    );
    banner.position = new Vector3(centerX, gateY + poleHeight - 0.6, gateZ);
    banner.material = this.materials.finishBanner;

    const stripe = CreateBox(
      "finishStripe",
      { width: gateWidth, height: 0.3, depth: 0.16 },
      this.scene
    );
    stripe.position = new Vector3(centerX, gateY + poleHeight - 0.6, gateZ);
    stripe.material = this.materials.finishPole;
  }
}
