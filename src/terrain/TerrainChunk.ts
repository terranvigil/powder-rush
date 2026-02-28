import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { PhysicsAggregate } from "@babylonjs/core/Physics/v2/physicsAggregate";
import { PhysicsShapeType } from "@babylonjs/core/Physics/v2/IPhysicsEnginePlugin";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { SlopeFunction } from "./SlopeFunction";
import { SlopeSpline } from "./SlopeSpline";
import { hash, ridgeFbm, noise2D } from "./Noise";
import { buildObstacles, ObstacleMaterials } from "./ObstacleBuilder";
import { buildJumps } from "./JumpBuilder";

// Terrain mesh resolution per chunk
const RES_X = 60;
const RES_Z = 150;  // 150 rows for 150m = 1m spacing along slope

// Sun direction (toward the sun, normalized) — matches Game.ts directional light
const SUN_DIR_X = -Math.sin(-30 * Math.PI / 180) * Math.cos(35 * Math.PI / 180);
const SUN_DIR_Y = Math.sin(35 * Math.PI / 180);
const SUN_DIR_Z = -Math.cos(-30 * Math.PI / 180) * Math.cos(35 * Math.PI / 180);
const NORMAL_EPS = 0.5; // sampling epsilon for analytical normals

export interface SharedMaterials {
  snow: StandardMaterial;
  mountain: StandardMaterial;
  pineTrunk: StandardMaterial;
  pineCanopy: StandardMaterial;
  aspenTrunk: StandardMaterial;
  aspenCanopy: StandardMaterial;
  treeSnow: StandardMaterial;
  finishPole: StandardMaterial;
  finishBanner: StandardMaterial;
  rock: StandardMaterial;
  stump: StandardMaterial;
  stumpSnow: StandardMaterial;
}

export class TerrainChunk {
  readonly chunkIndex: number;
  readonly zStart: number; // world z of chunk start (less negative)
  readonly zEnd: number;   // world z of chunk end (more negative)
  private scene: Scene;
  private slopeFunction: SlopeFunction;
  private spline: SlopeSpline;
  private materials: SharedMaterials;
  private shadowGen: ShadowGenerator;
  private nodes: (Mesh | TransformNode)[] = [];
  private aggregates: PhysicsAggregate[] = [];
  private shadowCasters: Mesh[] = [];
  private obstacleAggregates: PhysicsAggregate[] = [];

  constructor(
    chunkIndex: number,
    chunkSize: number,
    scene: Scene,
    slopeFunction: SlopeFunction,
    spline: SlopeSpline,
    materials: SharedMaterials,
    shadowGen: ShadowGenerator
  ) {
    this.chunkIndex = chunkIndex;
    this.zStart = -chunkIndex * chunkSize;
    this.zEnd = -(chunkIndex + 1) * chunkSize;
    this.scene = scene;
    this.slopeFunction = slopeFunction;
    this.spline = spline;
    this.materials = materials;
    this.shadowGen = shadowGen;
  }

  build(): void {
    this.buildTerrainMesh();
    this.buildTrees();
    this.buildObstacles();
    this.buildJumps();
    this.buildMountainRidges();
    this.buildWallColliders();
  }

  getObstacleAggregates(): PhysicsAggregate[] {
    return this.obstacleAggregates;
  }

  dispose(): void {
    for (const caster of this.shadowCasters) {
      this.shadowGen.removeShadowCaster(caster);
    }
    this.shadowCasters.length = 0;
    for (const agg of this.aggregates) {
      agg.dispose();
    }
    for (const node of this.nodes) {
      node.dispose();
    }
    this.aggregates.length = 0;
    this.nodes.length = 0;
  }

  private buildObstacles(): void {
    const obsMats: ObstacleMaterials = {
      rock: this.materials.rock,
      stump: this.materials.stump,
      stumpSnow: this.materials.stumpSnow,
    };
    const result = buildObstacles(
      this.chunkIndex, this.zStart, this.zEnd,
      this.scene, this.slopeFunction, this.spline, obsMats, this.shadowGen
    );
    for (const n of result.nodes) this.nodes.push(n);
    for (const a of result.aggregates) {
      this.aggregates.push(a);
      this.obstacleAggregates.push(a);
    }
    for (const c of result.shadowCasters) this.shadowCasters.push(c);
  }

  private buildJumps(): void {
    const result = buildJumps(
      this.chunkIndex, this.zStart, this.zEnd,
      this.scene, this.slopeFunction, this.spline,
      this.materials.treeSnow, this.shadowGen
    );
    for (const n of result.nodes) this.nodes.push(n);
    for (const a of result.aggregates) this.aggregates.push(a);
    for (const c of result.shadowCasters) this.shadowCasters.push(c);
  }

  private buildTerrainMesh(): void {
    const chunkLen = this.zStart - this.zEnd; // positive
    // Overlap one row past zEnd for seam prevention
    const overlapZ = chunkLen / (RES_Z - 1);

    const positions: number[] = [];
    const indices: number[] = [];
    const colors: number[] = [];

    // Width uses spline half-width at chunk midpoint for mesh extent
    const midZ = (this.zStart + this.zEnd) / 2;
    const maxHalfWidth = Math.max(
      this.spline.halfWidthAt(this.zStart),
      this.spline.halfWidthAt(midZ),
      this.spline.halfWidthAt(this.zEnd)
    ) + 5; // extra margin
    const meshWidth = maxHalfWidth * 2;

    const stepX = meshWidth / (RES_X - 1);
    const stepZ = (chunkLen + overlapZ) / (RES_Z - 1);

    for (let zi = 0; zi < RES_Z; zi++) {
      const wz = this.zStart - zi * stepZ;
      const centerX = this.spline.centerXAt(wz);

      for (let xi = 0; xi < RES_X; xi++) {
        const wx = centerX + (xi - RES_X / 2) * stepX;
        const height = this.slopeFunction.heightAt(wx, wz);
        positions.push(wx, height, wz);

        // Analytical surface normal from height function gradient
        const hL = this.slopeFunction.heightAt(wx - NORMAL_EPS, wz);
        const hR = this.slopeFunction.heightAt(wx + NORMAL_EPS, wz);
        const hD = this.slopeFunction.heightAt(wx, wz - NORMAL_EPS);
        const hU = this.slopeFunction.heightAt(wx, wz + NORMAL_EPS);
        const dx = (hR - hL) / (2 * NORMAL_EPS);
        const dz = (hU - hD) / (2 * NORMAL_EPS);
        // Normal = normalize(-dx, 1, -dz)
        const len = Math.sqrt(dx * dx + 1 + dz * dz);
        const nx = -dx / len;
        const ny = 1 / len;
        const nz = -dz / len;

        // Dot with sun direction: 1 = fully sun-lit, 0 = edge-lit, <0 = shadowed
        const ndotl = nx * SUN_DIR_X + ny * SUN_DIR_Y + nz * SUN_DIR_Z;

        // Remap to 0..1: wide range for strong contrast
        const sunFactor = Math.max(0, Math.min(1, (ndotl + 0.4) / 1.4));

        // Steepness factor: steeper faces darken more
        const steepness = 1 - ny; // 0 = flat, ~1 = vertical
        const steepDarken = 1 - steepness * 0.3;

        // Multi-frequency noise for surface texture variation
        const micro1 = noise2D(wx * 0.4, wz * 0.4) * 0.08 - 0.04;
        const micro2 = noise2D(wx * 1.2 + 50, wz * 1.2 + 50) * 0.04 - 0.02;
        const microNoise = micro1 + micro2;

        // Blend between shadow color (cool blue-violet) and sun color (warm peach-cream)
        // Shadow: (0.50, 0.50, 0.75)  Sun: (1.0, 0.95, 0.84)
        const r = (0.50 + sunFactor * 0.50) * steepDarken + microNoise;
        const g = (0.50 + sunFactor * 0.45) * steepDarken + microNoise;
        const b = (0.75 + sunFactor * 0.09) * steepDarken + microNoise * 0.4;
        colors.push(
          Math.max(0, Math.min(1, r)),
          Math.max(0, Math.min(1, g)),
          Math.max(0, Math.min(1, b)),
          1.0
        );
      }
    }

    for (let zi = 0; zi < RES_Z - 1; zi++) {
      for (let xi = 0; xi < RES_X - 1; xi++) {
        const bl = zi * RES_X + xi;
        const br = bl + 1;
        const tl = bl + RES_X;
        const tr = tl + 1;
        indices.push(bl, tl, tr);
        indices.push(bl, tr, br);
      }
    }

    const vertexData = new VertexData();
    vertexData.positions = positions;
    vertexData.indices = indices;
    vertexData.colors = colors;

    const mesh = new Mesh(`terrain_chunk_${this.chunkIndex}`, this.scene);
    vertexData.applyToMesh(mesh);
    mesh.createNormals(false);
    mesh.material = this.materials.snow;
    mesh.receiveShadows = true;
    this.shadowGen.addShadowCaster(mesh);
    this.shadowCasters.push(mesh);
    this.nodes.push(mesh);

    const agg = new PhysicsAggregate(
      mesh,
      PhysicsShapeType.MESH,
      { mass: 0, restitution: 0.08, friction: 0.02 },
      this.scene
    );
    this.aggregates.push(agg);
  }

  private buildTrees(): void {
    // Global deterministic placement: iterate all possible trees, filter to chunk z-range
    const totalTreeCount = 180; // more trees for 1200m (was 120 for 800m)
    const totalLength = this.spline.length;
    const growthScales = [0.5, 0.75, 1.0];
    const snowAmounts = [0.3, 0.6, 1.0];

    for (let i = 0; i < totalTreeCount; i++) {
      // Z spread across full run length
      const z = -20 - hash(i * 3 + 2) * (totalLength - 70); // margin from start and end

      // Filter: only build trees in this chunk's z-range (with small margin)
      if (z > this.zStart + 2 || z < this.zEnd - 2) continue;

      const isPine = hash(i * 3 + 0) < 0.6;
      const stageIndex = Math.floor(hash(i * 3 + 1) * 3);
      const scale = growthScales[stageIndex];

      // Place in margins relative to spline center
      const centerX = this.spline.centerXAt(z);
      const halfWidth = this.spline.halfWidthAt(z);
      const side = hash(i * 5 + 7) < 0.5 ? -1 : 1;
      const xOffset = 5 + hash(i * 5 + 9) * (halfWidth * 0.6);
      const x = centerX + side * xOffset;

      const y = this.slopeFunction.heightAt(x, z);

      const snowIndex = Math.floor(hash(i * 7 + 13) * 3);
      const snowAmount = snowAmounts[snowIndex];

      if (isPine) {
        this.buildPine(i, new Vector3(x, y, z), scale, snowAmount);
      } else {
        this.buildAspen(i, new Vector3(x, y, z), scale, snowAmount);
      }
    }
  }

  private buildPine(index: number, position: Vector3, scale: number, snowAmount: number): void {
    const root = new TransformNode(`pine_${this.chunkIndex}_${index}`, this.scene);
    root.position = position;
    this.nodes.push(root);

    root.rotation.y = hash(index * 11 + 50) * Math.PI * 2;
    const leanMax = 3 * (Math.PI / 180);
    root.rotation.x = (hash(index * 11 + 51) - 0.5) * 2 * leanMax;
    root.rotation.z = (hash(index * 11 + 52) - 0.5) * 2 * leanMax;

    const trunkJitter = 1.0 + (hash(index * 11 + 53) - 0.5) * 0.2;
    const trunkHeight = 1.8 * scale * trunkJitter;
    const trunk = CreateCylinder(
      `pine_trunk_${this.chunkIndex}_${index}`,
      { height: trunkHeight, diameterBottom: 0.7 * scale, diameterTop: 0.45 * scale, tessellation: 12 },
      this.scene
    );
    trunk.position = new Vector3(0, trunkHeight / 2, 0);
    trunk.parent = root;
    trunk.material = this.materials.pineTrunk;

    const cones = [
      { diameterBottom: 4.2, height: 2.2, yBase: 0.6 },
      { diameterBottom: 3.2, height: 2.2, yBase: 1.8 },
      { diameterBottom: 2.0, height: 2.8, yBase: 3.0 },
    ];

    for (let c = 0; c < cones.length; c++) {
      const dJitter = 1.0 + (hash(index * 11 + 60 + c * 2) - 0.5) * 0.3;
      const hJitter = 1.0 + (hash(index * 11 + 61 + c * 2) - 0.5) * 0.2;
      const coneDiamBottom = cones[c].diameterBottom * scale * dJitter;
      const coneHeight = cones[c].height * scale * hJitter;

      const cone = CreateCylinder(
        `pine_canopy_${this.chunkIndex}_${index}_${c}`,
        { height: coneHeight, diameterTop: 0, diameterBottom: coneDiamBottom, tessellation: 24 },
        this.scene
      );
      const coneY = cones[c].yBase * scale + coneHeight / 2;
      cone.position = new Vector3(0, coneY, 0);
      cone.parent = root;
      cone.material = this.materials.pineCanopy;

      const snowHeight = 0.25 * snowAmount * scale;
      const snowDiamBottom = coneDiamBottom * (0.5 + snowAmount * 0.35);
      const snowDiamTop = snowDiamBottom * 0.5;
      const snow = CreateCylinder(
        `pine_snow_${this.chunkIndex}_${index}_${c}`,
        { height: snowHeight, diameterTop: snowDiamTop, diameterBottom: snowDiamBottom, tessellation: 24 },
        this.scene
      );
      const snowY = cones[c].yBase * scale + coneHeight + snowHeight / 2;
      snow.position = new Vector3(0, snowY, 0);
      snow.parent = root;
      snow.material = this.materials.treeSnow;
    }

    // Register tree meshes as shadow casters
    for (const child of root.getChildMeshes()) {
      this.shadowGen.addShadowCaster(child);
      this.shadowCasters.push(child as Mesh);
    }

    // Physics proxy
    const physicsProxy = CreateCylinder(
      `pine_phys_${this.chunkIndex}_${index}`,
      { height: 7 * scale, diameter: 0.8 * scale, tessellation: 6 },
      this.scene
    );
    physicsProxy.position = new Vector3(
      position.x, position.y + (7 * scale) / 2, position.z
    );
    physicsProxy.isVisible = false;
    this.nodes.push(physicsProxy);

    const agg = new PhysicsAggregate(
      physicsProxy, PhysicsShapeType.CYLINDER,
      { mass: 0, restitution: 0.4 }, this.scene
    );
    this.aggregates.push(agg);
  }

  private buildAspen(index: number, position: Vector3, scale: number, snowAmount: number): void {
    const root = new TransformNode(`aspen_${this.chunkIndex}_${index}`, this.scene);
    root.position = position;
    this.nodes.push(root);

    root.rotation.y = hash(index * 13 + 70) * Math.PI * 2;
    const leanMax = 3 * (Math.PI / 180);
    root.rotation.x = (hash(index * 13 + 71) - 0.5) * 2 * leanMax;
    root.rotation.z = (hash(index * 13 + 72) - 0.5) * 2 * leanMax;

    const trunkJitter = 1.0 + (hash(index * 13 + 73) - 0.5) * 0.2;
    const trunkHeight = 3.0 * scale * trunkJitter;
    const trunk = CreateCylinder(
      `aspen_trunk_${this.chunkIndex}_${index}`,
      { height: trunkHeight, diameterBottom: 0.5 * scale, diameterTop: 0.3 * scale, tessellation: 12 },
      this.scene
    );
    trunk.position = new Vector3(0, trunkHeight / 2, 0);
    trunk.parent = root;
    trunk.material = this.materials.aspenTrunk;

    const heightJitter = 1.0 + (hash(index * 13 + 74) - 0.5) * 0.3;
    const widthJitter = 1.0 + (hash(index * 13 + 75) - 0.5) * 0.3;
    const canopyDiamX = 2.5 * scale * widthJitter;
    const canopyDiamY = 3.0 * scale * heightJitter;
    const canopyDiamZ = 2.5 * scale * widthJitter;
    const canopy = CreateSphere(
      `aspen_canopy_${this.chunkIndex}_${index}`,
      { segments: 20, diameterX: canopyDiamX, diameterY: canopyDiamY, diameterZ: canopyDiamZ },
      this.scene
    );
    const canopyY = trunkHeight + canopyDiamY / 2 - 0.3 * scale;
    canopy.position = new Vector3(0, canopyY, 0);
    canopy.parent = root;
    canopy.material = this.materials.aspenCanopy;

    const snowHeight = 0.4 * snowAmount * scale;
    const snowDiameter = canopyDiamX * (0.4 + snowAmount * 0.4);
    const snowCap = CreateCylinder(
      `aspen_snow_${this.chunkIndex}_${index}`,
      { height: snowHeight, diameterTop: snowDiameter * 0.6, diameterBottom: snowDiameter, tessellation: 24 },
      this.scene
    );
    const snowY = trunkHeight + canopyDiamY - 0.3 * scale + snowHeight / 2;
    snowCap.position = new Vector3(0, snowY, 0);
    snowCap.parent = root;
    snowCap.material = this.materials.treeSnow;

    // Register tree meshes as shadow casters
    for (const child of root.getChildMeshes()) {
      this.shadowGen.addShadowCaster(child);
      this.shadowCasters.push(child as Mesh);
    }

    // Physics proxy
    const physicsProxy = CreateCylinder(
      `aspen_phys_${this.chunkIndex}_${index}`,
      { height: 6 * scale, diameter: 0.6 * scale, tessellation: 6 },
      this.scene
    );
    physicsProxy.position = new Vector3(
      position.x, position.y + (6 * scale) / 2, position.z
    );
    physicsProxy.isVisible = false;
    this.nodes.push(physicsProxy);

    const agg = new PhysicsAggregate(
      physicsProxy, PhysicsShapeType.CYLINDER,
      { mass: 0, restitution: 0.4 }, this.scene
    );
    this.aggregates.push(agg);
  }

  private buildMountainRidges(): void {
    const chunkLen = this.zStart - this.zEnd;
    // Overlap one segment past chunk boundary for seam prevention
    const overlap = chunkLen / 25;
    const totalLength = this.spline.length;

    for (const side of [-1, 1]) {
      // Foreground ridge
      this.buildRidgeMesh(side, 2, 8, 10, 24, 0.1, "fg", chunkLen, overlap, totalLength);
      // Background ridge
      this.buildRidgeMesh(side, 16, 14, 20, 42, 0.07, "bg", chunkLen, overlap, totalLength);
    }
  }

  private buildRidgeMesh(
    side: number,
    extraOffset: number,
    thickness: number,
    minHeight: number,
    maxHeight: number,
    noiseScale: number,
    label: string,
    chunkLen: number,
    overlap: number,
    totalLength: number
  ): void {
    const segCount = 25;
    const segLength = (chunkLen + overlap) / segCount;
    const positions: number[] = [];
    const indices: number[] = [];
    const colors: number[] = [];

    for (let i = 0; i <= segCount; i++) {
      const z = this.zStart - i * segLength;
      const centerX = this.spline.centerXAt(z);
      const halfWidth = this.spline.halfWidthAt(z);
      const baseOffset = halfWidth + extraOffset;
      const xBase = centerX + side * baseOffset;
      const groundY = this.slopeFunction.heightAt(xBase, z);

      // Use global Z index for noise continuity across chunks
      const globalI = (-z / totalLength) * 200; // maps to 0..200 range matching original
      const ridgeH = ridgeFbm(
        globalI * noiseScale,
        (side + 2) * 100 + globalI * noiseScale * 0.3,
        5
      );
      const peakHeight = minHeight + ridgeH * (maxHeight - minHeight);

      positions.push(xBase, groundY - 1, z);
      colors.push(0.32, 0.28, 0.38, 1.0);

      const peakX = xBase + side * (thickness * 0.4);
      positions.push(peakX, groundY + peakHeight, z);
      const snowT = Math.pow(ridgeH, 0.6);
      colors.push(0.32 + snowT * 0.62, 0.28 + snowT * 0.69, 0.38 + snowT * 0.59, 1.0);

      const outerX = xBase + side * thickness;
      positions.push(outerX, groundY - 1, z);
      colors.push(0.28, 0.25, 0.35, 1.0);
    }

    for (let i = 0; i < segCount; i++) {
      const base = i * 3;
      const next = (i + 1) * 3;
      if (side > 0) {
        indices.push(base + 0, base + 1, next + 1);
        indices.push(base + 0, next + 1, next + 0);
        indices.push(base + 1, base + 2, next + 2);
        indices.push(base + 1, next + 2, next + 1);
      } else {
        indices.push(base + 0, next + 1, base + 1);
        indices.push(base + 0, next + 0, next + 1);
        indices.push(base + 1, next + 2, base + 2);
        indices.push(base + 1, next + 1, next + 2);
      }
    }

    const vertexData = new VertexData();
    vertexData.positions = positions;
    vertexData.indices = indices;
    vertexData.colors = colors;

    const mesh = new Mesh(
      `ridge_${label}_${side > 0 ? "R" : "L"}_chunk${this.chunkIndex}`,
      this.scene
    );
    vertexData.applyToMesh(mesh);
    mesh.createNormals(false);
    mesh.convertToFlatShadedMesh();
    mesh.material = this.materials.mountain;
    mesh.receiveShadows = true;
    this.nodes.push(mesh);
  }

  private buildWallColliders(): void {
    const chunkLen = this.zStart - this.zEnd;
    const segCount = 3; // 3 wall segments per chunk
    const segLength = chunkLen / segCount;

    for (const side of [-1, 1]) {
      for (let i = 0; i < segCount; i++) {
        const z = this.zStart - (i + 0.5) * segLength;
        const centerX = this.spline.centerXAt(z);
        const halfWidth = this.spline.halfWidthAt(z);
        const x = centerX + side * (halfWidth + 5);
        const y = this.slopeFunction.heightAt(x, z);

        const wall = CreateBox(
          `wall_${side > 0 ? "R" : "L"}_${this.chunkIndex}_${i}`,
          { width: 10, height: 50, depth: segLength * 1.2 },
          this.scene
        );
        wall.position = new Vector3(x, y + 20, z);
        wall.isVisible = false;
        this.nodes.push(wall);

        const agg = new PhysicsAggregate(
          wall, PhysicsShapeType.BOX,
          { mass: 0, restitution: 0.24 }, this.scene
        );
        this.aggregates.push(agg);
      }
    }
  }
}
