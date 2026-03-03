import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { PhysicsAggregate } from "@babylonjs/core/Physics/v2/physicsAggregate";
import { PhysicsShapeType } from "@babylonjs/core/Physics/v2/IPhysicsEnginePlugin";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { SlopeFunction } from "./SlopeFunction";
import { SlopeSpline } from "./SlopeSpline";
import { hash, ridgeFbm, noise2D } from "./Noise";
import { buildObstacles, ObstacleMaterials } from "./ObstacleBuilder";
import { buildJumps, getJumpFootprints, getJumpHeightAt, type JumpFootprint } from "./JumpBuilder";

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
  treeVC: StandardMaterial;
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
  private jumpCountOverride?: number;

  constructor(
    chunkIndex: number,
    chunkSize: number,
    scene: Scene,
    slopeFunction: SlopeFunction,
    spline: SlopeSpline,
    materials: SharedMaterials,
    shadowGen: ShadowGenerator,
    jumpCountOverride?: number,
  ) {
    this.chunkIndex = chunkIndex;
    this.zStart = -chunkIndex * chunkSize;
    this.zEnd = -(chunkIndex + 1) * chunkSize;
    this.scene = scene;
    this.slopeFunction = slopeFunction;
    this.spline = spline;
    this.materials = materials;
    this.shadowGen = shadowGen;
    this.jumpCountOverride = jumpCountOverride;
  }

  build(): void {
    this.buildTerrainMesh();
    this.buildTrees();
    this.buildObstacles();
    this.buildJumps();
    this.buildMountainRidges();
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
      this.materials.treeSnow, this.shadowGen,
      this.jumpCountOverride,
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

    // Get jump footprints so we can depress terrain underneath them
    const jumpFootprints = getJumpFootprints(
      this.zStart, this.zEnd, this.spline, this.jumpCountOverride
    );

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
        let height = this.slopeFunction.heightAt(wx, wz);

        // Raise terrain to match jump profile (jump physics baked into terrain)
        height += getJumpHeightAt(wx, wz, jumpFootprints);

        positions.push(wx, height, wz);

        // Analytical surface normal from height function gradient (includes jump profile)
        const hL = this.slopeFunction.heightAt(wx - NORMAL_EPS, wz) + getJumpHeightAt(wx - NORMAL_EPS, wz, jumpFootprints);
        const hR = this.slopeFunction.heightAt(wx + NORMAL_EPS, wz) + getJumpHeightAt(wx + NORMAL_EPS, wz, jumpFootprints);
        const hD = this.slopeFunction.heightAt(wx, wz - NORMAL_EPS) + getJumpHeightAt(wx, wz - NORMAL_EPS, jumpFootprints);
        const hU = this.slopeFunction.heightAt(wx, wz + NORMAL_EPS) + getJumpHeightAt(wx, wz + NORMAL_EPS, jumpFootprints);
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
      { mass: 0, restitution: 0, friction: 0.02 },
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

    // Trunk with bark vertex colors
    const trunkJitter = 1.0 + (hash(index * 11 + 53) - 0.5) * 0.2;
    const trunkHeight = 1.8 * scale * trunkJitter;
    const trunk = CreateCylinder(
      `pine_trunk_${this.chunkIndex}_${index}`,
      { height: trunkHeight, diameterBottom: 0.7 * scale, diameterTop: 0.45 * scale, tessellation: 8 },
      this.scene
    );
    trunk.position = new Vector3(0, trunkHeight / 2, 0);
    trunk.parent = root;
    this.colorTrunk(trunk, trunkHeight, index * 100, false);
    trunk.material = this.materials.treeVC;

    // 4 canopy tiers with integrated snow and irregular edges
    const tiers = [
      { diameterBottom: 4.5, height: 2.0, yBase: 0.4 },
      { diameterBottom: 3.8, height: 2.0, yBase: 1.4 },
      { diameterBottom: 2.8, height: 2.2, yBase: 2.6 },
      { diameterBottom: 1.8, height: 2.8, yBase: 3.6 },
    ];

    for (let c = 0; c < tiers.length; c++) {
      const dJitter = 1.0 + (hash(index * 11 + 60 + c * 2) - 0.5) * 0.3;
      const hJitter = 1.0 + (hash(index * 11 + 61 + c * 2) - 0.5) * 0.2;
      const coneDiamBottom = tiers[c].diameterBottom * scale * dJitter;
      const coneHeight = tiers[c].height * scale * hJitter;

      const cone = CreateCylinder(
        `pine_canopy_${this.chunkIndex}_${index}_${c}`,
        { height: coneHeight, diameterTop: 0, diameterBottom: coneDiamBottom, tessellation: 16, cap: 0 },
        this.scene
      );
      const coneY = tiers[c].yBase * scale + coneHeight / 2;
      cone.position = new Vector3(0, coneY, 0);
      cone.parent = root;
      this.colorPineCanopy(cone, coneHeight, snowAmount, c, tiers.length, index * 100 + c);
      cone.material = this.materials.treeVC;
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
      { mass: 0, restitution: 0.36 }, this.scene
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

    // Trunk with aspen bark markings
    const trunkJitter = 1.0 + (hash(index * 13 + 73) - 0.5) * 0.2;
    const trunkHeight = 3.0 * scale * trunkJitter;
    const trunk = CreateCylinder(
      `aspen_trunk_${this.chunkIndex}_${index}`,
      { height: trunkHeight, diameterBottom: 0.5 * scale, diameterTop: 0.3 * scale, tessellation: 8 },
      this.scene
    );
    trunk.position = new Vector3(0, trunkHeight / 2, 0);
    trunk.parent = root;
    this.colorTrunk(trunk, trunkHeight, index * 200, true);
    trunk.material = this.materials.treeVC;

    // Multi-sphere canopy for billowy shape
    const heightJitter = 1.0 + (hash(index * 13 + 74) - 0.5) * 0.3;
    const widthJitter = 1.0 + (hash(index * 13 + 75) - 0.5) * 0.3;
    const canopyDiamX = 2.5 * scale * widthJitter;
    const canopyDiamY = 3.0 * scale * heightJitter;
    const canopyDiamZ = 2.5 * scale * widthJitter;
    const canopyY = trunkHeight + canopyDiamY / 2 - 0.3 * scale;

    // Main canopy sphere
    const canopy = CreateSphere(
      `aspen_canopy_${this.chunkIndex}_${index}`,
      { segments: 12, diameterX: canopyDiamX, diameterY: canopyDiamY, diameterZ: canopyDiamZ },
      this.scene
    );
    canopy.position = new Vector3(0, canopyY, 0);
    canopy.parent = root;
    this.colorAspenCanopy(canopy, canopyDiamY, snowAmount, index * 300);
    canopy.material = this.materials.treeVC;

    // Secondary sphere offset for natural shape
    const offsetX = (hash(index * 13 + 80) - 0.5) * canopyDiamX * 0.4;
    const offsetZ = (hash(index * 13 + 81) - 0.5) * canopyDiamZ * 0.4;
    const secondScale = 0.65 + hash(index * 13 + 82) * 0.2;
    const canopy2 = CreateSphere(
      `aspen_canopy2_${this.chunkIndex}_${index}`,
      {
        segments: 10,
        diameterX: canopyDiamX * secondScale,
        diameterY: canopyDiamY * secondScale * 0.8,
        diameterZ: canopyDiamZ * secondScale,
      },
      this.scene
    );
    canopy2.position = new Vector3(offsetX, canopyY + canopyDiamY * 0.15, offsetZ);
    canopy2.parent = root;
    this.colorAspenCanopy(canopy2, canopyDiamY * secondScale * 0.8, snowAmount, index * 300 + 50);
    canopy2.material = this.materials.treeVC;

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
      { mass: 0, restitution: 0.36 }, this.scene
    );
    this.aggregates.push(agg);
  }

  /** Vertex-color pine cone: snow on top, green below, irregular branch tips */
  private colorPineCanopy(
    cone: Mesh, coneHeight: number, snowAmount: number,
    tierIndex: number, tierCount: number, seed: number
  ): void {
    const positions = cone.getVerticesData("position");
    if (!positions) return;

    const vertCount = positions.length / 3;
    const colors = new Float32Array(vertCount * 4);
    const newPositions = new Float32Array(positions);

    // Tier color gradient: darker green at bottom, lighter at top
    const tierFrac = tierIndex / Math.max(tierCount - 1, 1);
    const greenR = 0.08 + tierFrac * 0.06;
    const greenG = 0.25 + tierFrac * 0.15;
    const greenB = 0.04 + tierFrac * 0.06;

    // Snow coverage increases on upper tiers
    const snowStart = 1.0 - snowAmount * (0.3 + tierFrac * 0.35);

    for (let v = 0; v < vertCount; v++) {
      const x = positions[v * 3 + 0];
      const y = positions[v * 3 + 1];
      const z = positions[v * 3 + 2];
      const heightFrac = (y + coneHeight / 2) / coneHeight; // 0=base, 1=tip

      // Organic displacement: all vertices get subtle wobble
      const radius = Math.sqrt(x * x + z * z);
      if (radius > 0.01) {
        let radScale = 1 + (hash(seed + v * 17) * 0.08 - 0.04);
        // Bottom vertices get larger displacement for irregular branch tips
        if (heightFrac < 0.15) {
          radScale *= 0.82 + hash(seed + v * 23) * 0.36;
          // Extended branches droop slightly
          if (radScale > 1.05) {
            newPositions[v * 3 + 1] = y - (radScale - 1.05) * coneHeight * 0.15;
          }
        }
        const angle = Math.atan2(z, x);
        newPositions[v * 3 + 0] = Math.cos(angle) * radius * radScale;
        newPositions[v * 3 + 2] = Math.sin(angle) * radius * radScale;
      }

      // Snow blend with smoothstep
      const rawSnow = heightFrac > snowStart
        ? Math.min(1, (heightFrac - snowStart) / Math.max(1 - snowStart, 0.01))
        : 0;
      const snowBlend = rawSnow * rawSnow * (3 - 2 * rawSnow);

      // Per-vertex noise for natural variation
      const noise = hash(seed + v * 31) * 0.05 - 0.025;

      const r = greenR + (0.92 - greenR) * snowBlend + noise;
      const g = greenG + (0.95 - greenG) * snowBlend + noise;
      const b = greenB + (0.98 - greenB) * snowBlend + noise * 0.5;

      colors[v * 4 + 0] = Math.max(0, Math.min(1, r));
      colors[v * 4 + 1] = Math.max(0, Math.min(1, g));
      colors[v * 4 + 2] = Math.max(0, Math.min(1, b));
      colors[v * 4 + 3] = 1.0;
    }

    cone.setVerticesData("position", newPositions);
    cone.setVerticesData("color", colors);
    cone.createNormals(false);
  }

  /** Vertex-color aspen sphere: snow on upper hemisphere, green-gold below */
  private colorAspenCanopy(
    sphere: Mesh, canopyDiamY: number, snowAmount: number, seed: number
  ): void {
    const positions = sphere.getVerticesData("position");
    if (!positions) return;

    const vertCount = positions.length / 3;
    const colors = new Float32Array(vertCount * 4);
    const newPositions = new Float32Array(positions);
    const halfH = canopyDiamY / 2;

    for (let v = 0; v < vertCount; v++) {
      const x = positions[v * 3 + 0];
      const y = positions[v * 3 + 1];
      const z = positions[v * 3 + 2];

      // Organic displacement for natural shape
      const radius = Math.sqrt(x * x + y * y + z * z);
      if (radius > 0.01) {
        const disp = 1 + (hash(seed + v * 23) * 0.12 - 0.06);
        newPositions[v * 3 + 0] = x * disp;
        newPositions[v * 3 + 1] = y * disp;
        newPositions[v * 3 + 2] = z * disp;
      }

      // Height fraction: -1 at bottom, +1 at top
      const heightFrac = halfH > 0.01 ? y / halfH : 0;

      // Snow on upper hemisphere
      const snowLine = 0.2 - snowAmount * 0.6;
      const rawSnow = heightFrac > snowLine
        ? Math.min(1, (heightFrac - snowLine) / Math.max(0.5, 1 - snowLine))
        : 0;
      const snowBlend = rawSnow * rawSnow * (3 - 2 * rawSnow);

      // Aspen green-gold base with per-vertex variation
      const vNoise = hash(seed + v * 19) * 0.1;
      const baseR = 0.45 + vNoise;
      const baseG = 0.55 + vNoise;
      const baseB = 0.10 + vNoise * 0.5;

      const r = baseR + (0.92 - baseR) * snowBlend;
      const g = baseG + (0.95 - baseG) * snowBlend;
      const b = baseB + (0.98 - baseB) * snowBlend;

      colors[v * 4 + 0] = Math.max(0, Math.min(1, r));
      colors[v * 4 + 1] = Math.max(0, Math.min(1, g));
      colors[v * 4 + 2] = Math.max(0, Math.min(1, b));
      colors[v * 4 + 3] = 1.0;
    }

    sphere.setVerticesData("position", newPositions);
    sphere.setVerticesData("color", colors);
    sphere.createNormals(false);
  }

  /** Vertex-color trunk: pine bark grain or aspen dark-band markings */
  private colorTrunk(
    trunk: Mesh, trunkHeight: number, seed: number, isAspen: boolean
  ): void {
    const positions = trunk.getVerticesData("position");
    if (!positions) return;

    const vertCount = positions.length / 3;
    const colors = new Float32Array(vertCount * 4);

    for (let v = 0; v < vertCount; v++) {
      const y = positions[v * 3 + 1];
      const heightFrac = (y + trunkHeight / 2) / trunkHeight;
      const noise = hash(seed + v * 7) * 0.06 - 0.03;

      let r: number, g: number, b: number;

      if (isAspen) {
        // Silvery white with dark horizontal eye-shaped markings
        const markPhase = heightFrac * 12 + hash(seed + 100) * 6;
        const mark = Math.pow(Math.abs(Math.sin(markPhase * Math.PI)), 8);
        const darkening = mark * 0.35;

        r = 0.82 - darkening + noise;
        g = 0.78 - darkening + noise;
        b = 0.72 - darkening * 0.8 + noise;
      } else {
        // Pine bark: warm brown, darker at base
        const darken = (1 - heightFrac) * 0.12;
        r = 0.38 - darken + noise;
        g = 0.24 - darken * 0.8 + noise * 0.5;
        b = 0.12 - darken * 0.5 + noise * 0.3;
      }

      colors[v * 4 + 0] = Math.max(0, Math.min(1, r));
      colors[v * 4 + 1] = Math.max(0, Math.min(1, g));
      colors[v * 4 + 2] = Math.max(0, Math.min(1, b));
      colors[v * 4 + 3] = 1.0;
    }

    trunk.setVerticesData("color", colors);
  }

  private buildMountainRidges(): void {
    const chunkLen = this.zStart - this.zEnd;
    // Overlap one segment past chunk boundary for seam prevention
    const overlap = chunkLen / 25;
    const totalLength = this.spline.length;

    for (const side of [-1, 1]) {
      // Foreground ridge — peaks just above player at summit, grow as you descend
      this.buildRidgeMesh(side, 2, 8, 4, 12, 0.1, "fg", chunkLen, overlap, totalLength);
      // Background ridge
      this.buildRidgeMesh(side, 16, 14, 8, 22, 0.07, "bg", chunkLen, overlap, totalLength);
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

    const SNOW_LINE = 0.65; // snow covers the top 35% of each peak
    const VERTS_PER_SEG = 5; // inner base, inner snowline, peak, outer snowline, outer base

    for (let i = 0; i <= segCount; i++) {
      const z = this.zStart - i * segLength;
      const centerX = this.spline.centerXAt(z);
      const halfWidth = this.spline.halfWidthAt(z);
      const baseOffset = halfWidth + extraOffset;
      const xBase = centerX + side * baseOffset;
      const groundY = this.slopeFunction.heightAt(xBase, z);

      // Mountains descend slower than the ski slope — creates depth cue
      const peakBoost = Math.abs(z) * 0.08;

      // Use global Z index for noise continuity across chunks
      const globalI = (-z / totalLength) * 200;
      const ridgeH = ridgeFbm(
        globalI * noiseScale,
        (side + 2) * 100 + globalI * noiseScale * 0.3,
        5
      );
      const peakHeight = minHeight + ridgeH * (maxHeight - minHeight);

      const baseY = groundY - 1;
      const peakX = xBase + side * (thickness * 0.4);
      const peakY = groundY + peakHeight + peakBoost;
      const outerX = xBase + side * thickness;
      const snowLineY = baseY + SNOW_LINE * (peakY - baseY);

      // 0: inner base — dark rock
      positions.push(xBase, baseY, z);
      colors.push(0.32, 0.28, 0.38, 1.0);

      // 1: inner snowline — rock at snow boundary
      const slInnerX = xBase + SNOW_LINE * (peakX - xBase);
      positions.push(slInnerX, snowLineY, z);
      colors.push(0.35, 0.31, 0.40, 1.0);

      // 2: peak — white snow
      const snowBright = 0.85 + ridgeH * 0.15;
      positions.push(peakX, peakY, z);
      colors.push(snowBright * 0.95, snowBright * 0.97, snowBright, 1.0);

      // 3: outer snowline — rock at snow boundary
      const slOuterX = peakX + (1 - SNOW_LINE) * (outerX - peakX);
      positions.push(slOuterX, snowLineY, z);
      colors.push(0.30, 0.27, 0.36, 1.0);

      // 4: outer base — dark rock
      positions.push(outerX, baseY, z);
      colors.push(0.28, 0.25, 0.35, 1.0);
    }

    for (let i = 0; i < segCount; i++) {
      const base = i * VERTS_PER_SEG;
      const next = (i + 1) * VERTS_PER_SEG;
      for (let col = 0; col < 4; col++) {
        const tl = base + col;
        const tr = base + col + 1;
        const bl = next + col;
        const br = next + col + 1;
        if (side > 0) {
          indices.push(tl, bl, br, tl, br, tr);
        } else {
          indices.push(tl, br, bl, tl, tr, br);
        }
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

}
