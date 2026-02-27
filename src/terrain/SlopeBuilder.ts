import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { PhysicsAggregate } from "@babylonjs/core/Physics/v2/physicsAggregate";
import { PhysicsShapeType } from "@babylonjs/core/Physics/v2/IPhysicsEnginePlugin";

// Slope parameters
const WIDTH = 50;
const LENGTH = 800;
const RES_X = 100;
const RES_Z = 400;
const STEEPNESS = 0.15;
const CURVE_AMPLITUDE = 8;
const BUMP_AMPLITUDE = 1.0;
const FINISH_Z = -(LENGTH - 60);

export class SlopeBuilder {
  private scene: Scene;

  constructor(scene: Scene) {
    this.scene = scene;
  }

  build(): void {
    this.buildSlopeMesh();
    this.buildMountainBorders();
    this.buildTrees();
    this.buildFinishGate();
  }

  getHeight(x: number, z: number): number {
    return SlopeBuilder.heightOnSlope(x, z);
  }

  get finishZ(): number {
    return FINISH_Z;
  }

  private static heightOnSlope(x: number, z: number): number {
    // Base slope: descend in -Z direction
    let height = z * STEEPNESS;

    // Gentle S-curve: slope wanders left-right
    const curveOffset = Math.sin(-z * 0.015) * CURVE_AMPLITUDE;
    const distFromCenter = Math.abs(x - curveOffset);

    // Slight bowl shape: edges are higher than center
    height += distFromCenter * distFromCenter * 0.002;

    // Multi-scale terrain features for natural variety
    // Ramp up gradually — smooth start zone
    const bumpFade = Math.min(1, Math.max(0, -z / 40));
    const bigRollFade = Math.min(1, Math.max(0, -z / 80));
    // Large rolling hills and valleys (wavelength ~125m)
    const bigRolls = SlopeBuilder.fbm2D(x * 0.008, z * 0.008, 3) * 2 - 1;
    // Medium mogul-like bumps (wavelength ~30m)
    const medBumps = SlopeBuilder.fbm2D(x * 0.035 + 50, z * 0.035 + 50, 4) * 2 - 1;
    // Small surface texture (wavelength ~10m)
    const smallBumps = SlopeBuilder.fbm2D(x * 0.1 + 100, z * 0.1 + 100, 3) * 2 - 1;
    height += (bigRolls * 3.0 * bigRollFade + medBumps * 1.2 + smallBumps * 0.4) * BUMP_AMPLITUDE * bumpFade;

    return height;
  }

  /** Hash-based pseudo-random for 2D noise lattice */
  private static hash2D(ix: number, iy: number): number {
    const dot = ix * 12.9898 + iy * 78.233;
    const v = Math.sin(dot) * 43758.5453;
    return v - Math.floor(v);
  }

  /** 2D value noise with smooth interpolation */
  private static noise2D(x: number, y: number): number {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const n00 = SlopeBuilder.hash2D(ix, iy);
    const n10 = SlopeBuilder.hash2D(ix + 1, iy);
    const n01 = SlopeBuilder.hash2D(ix, iy + 1);
    const n11 = SlopeBuilder.hash2D(ix + 1, iy + 1);
    const nx0 = n00 + (n10 - n00) * sx;
    const nx1 = n01 + (n11 - n01) * sx;
    return nx0 + (nx1 - nx0) * sy;
  }

  /** Fractal Brownian Motion — layers of noise at different scales */
  private static fbm2D(x: number, y: number, octaves: number): number {
    let value = 0;
    let amplitude = 1;
    let frequency = 1;
    let maxValue = 0;
    for (let i = 0; i < octaves; i++) {
      value += SlopeBuilder.noise2D(x * frequency, y * frequency) * amplitude;
      maxValue += amplitude;
      amplitude *= 0.5;
      frequency *= 2;
    }
    return value / maxValue;
  }

  /** Ridge noise — sharp peaks for mountain ridgelines */
  private static ridgeFbm(x: number, y: number, octaves: number): number {
    let value = 0;
    let amplitude = 1;
    let frequency = 1;
    let maxValue = 0;
    for (let i = 0; i < octaves; i++) {
      const n = SlopeBuilder.noise2D(
        x * frequency + i * 31.7,
        y * frequency + i * 17.3
      );
      const ridge = 1 - Math.abs(n * 2 - 1);
      value += ridge * ridge * amplitude;
      maxValue += amplitude;
      amplitude *= 0.5;
      frequency *= 2;
    }
    return value / maxValue;
  }

  private buildSlopeMesh(): void {
    const positions: number[] = [];
    const indices: number[] = [];
    const colors: number[] = [];

    const stepX = WIDTH / (RES_X - 1);
    const stepZ = LENGTH / (RES_Z - 1);

    // Track height range for color mapping
    let minH = Infinity;
    let maxH = -Infinity;

    // Generate vertices
    for (let z = 0; z < RES_Z; z++) {
      for (let x = 0; x < RES_X; x++) {
        const wx = (x - RES_X / 2) * stepX;
        const wz = -z * stepZ;
        const height = SlopeBuilder.heightOnSlope(wx, wz);

        positions.push(wx, height, wz);
        if (height < minH) minH = height;
        if (height > maxH) maxH = height;
      }
    }

    // Per-vertex colors: tint based on local height (white peaks, blue-grey valleys)
    const heightRange = maxH - minH || 1;
    for (let i = 0; i < positions.length / 3; i++) {
      const h = positions[i * 3 + 1];
      const t = (h - minH) / heightRange; // 0 = lowest, 1 = highest
      // Low areas: cool blue-grey (0.72, 0.76, 0.84)
      // High areas: bright white (0.95, 0.97, 1.0)
      const r = 0.72 + t * 0.23;
      const g = 0.76 + t * 0.21;
      const b = 0.84 + t * 0.16;
      colors.push(r, g, b, 1.0);
    }

    // Generate triangles — same winding as Unity (both are left-handed)
    for (let z = 0; z < RES_Z - 1; z++) {
      for (let x = 0; x < RES_X - 1; x++) {
        const bl = z * RES_X + x;
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

    const mesh = new Mesh("slope", this.scene);
    vertexData.applyToMesh(mesh);
    mesh.createNormals(false);

    // Physics
    new PhysicsAggregate(
      mesh,
      PhysicsShapeType.MESH,
      { mass: 0, restitution: 0.1, friction: 0.02 },
      this.scene
    );

    // Smooth snow material — vertex colors blend smoothly across surface
    const snowMat = new StandardMaterial("snowMat", this.scene);
    snowMat.diffuseColor = new Color3(1.0, 1.0, 1.0);
    snowMat.specularPower = 32;
    snowMat.specularColor = new Color3(0.5, 0.5, 0.55);
    mesh.material = snowMat;
  }

  private buildTrees(): void {
    // Shared materials (6 total)
    const pineTrunkMat = new StandardMaterial("pineTrunkMat", this.scene);
    pineTrunkMat.diffuseColor = new Color3(0.35, 0.22, 0.1);

    const pineCanopyMat = new StandardMaterial("pineCanopyMat", this.scene);
    pineCanopyMat.diffuseColor = new Color3(0.12, 0.35, 0.08);

    const aspenTrunkMat = new StandardMaterial("aspenTrunkMat", this.scene);
    aspenTrunkMat.diffuseColor = new Color3(0.85, 0.82, 0.75);

    const aspenCanopyMat = new StandardMaterial("aspenCanopyMat", this.scene);
    aspenCanopyMat.diffuseColor = new Color3(0.55, 0.65, 0.15);

    const snowMat = new StandardMaterial("treeSnowMat", this.scene);
    snowMat.diffuseColor = new Color3(0.94, 0.97, 1.0);

    const growthScales = [0.5, 0.75, 1.0]; // small, medium, large
    const snowAmounts = [0.3, 0.6, 1.0]; // light, medium, heavy
    const treeCount = 120;

    // Simple deterministic hash
    const hash = (seed: number): number => {
      let h = seed * 2654435761;
      h = ((h >>> 16) ^ h) * 0x45d9f3b;
      h = ((h >>> 16) ^ h) * 0x45d9f3b;
      h = (h >>> 16) ^ h;
      return (h >>> 0) / 0xffffffff; // 0..1
    };

    for (let i = 0; i < treeCount; i++) {
      const isPine = hash(i * 3 + 0) < 0.6; // 60% pine, 40% aspen
      const stageIndex = Math.floor(hash(i * 3 + 1) * 3); // 0, 1, or 2
      const scale = growthScales[stageIndex];

      // Z spread across full run length
      const z = -20 - (hash(i * 3 + 2) * 750); // -20 to -770

      // Place in margins: |x| > 5 from center curve
      const curveOffset = Math.sin(-z * 0.015) * CURVE_AMPLITUDE;
      const side = hash(i * 5 + 7) < 0.5 ? -1 : 1;
      const xOffset = 5 + hash(i * 5 + 9) * 15; // 5..20 from center
      const x = curveOffset + side * xOffset;

      const y = SlopeBuilder.heightOnSlope(x, z);

      // Per-tree snow amount
      const snowIndex = Math.floor(hash(i * 7 + 13) * 3);
      const snowAmount = snowAmounts[snowIndex];

      if (isPine) {
        this.buildPine(i, new Vector3(x, y, z), scale, pineTrunkMat, pineCanopyMat, snowMat, snowAmount, hash);
      } else {
        this.buildAspen(i, new Vector3(x, y, z), scale, aspenTrunkMat, aspenCanopyMat, snowMat, snowAmount, hash);
      }
    }
  }

  private buildPine(
    index: number,
    position: Vector3,
    scale: number,
    trunkMat: StandardMaterial,
    canopyMat: StandardMaterial,
    snowMat: StandardMaterial,
    snowAmount: number,
    hash: (seed: number) => number
  ): void {
    const root = new TransformNode(`pine_${index}`, this.scene);
    root.position = position;

    // Per-tree rotation: Y-axis full rotation, slight lean on X/Z
    root.rotation.y = hash(index * 11 + 50) * Math.PI * 2;
    const leanMax = 3 * (Math.PI / 180); // ±3 degrees
    root.rotation.x = (hash(index * 11 + 51) - 0.5) * 2 * leanMax;
    root.rotation.z = (hash(index * 11 + 52) - 0.5) * 2 * leanMax;

    // Trunk: tapered brown cylinder (wider at base)
    const trunkJitter = 1.0 + (hash(index * 11 + 53) - 0.5) * 0.2; // ±10%
    const trunkHeight = 1.8 * scale * trunkJitter;
    const trunk = CreateCylinder(
      `pine_trunk_${index}`,
      {
        height: trunkHeight,
        diameterBottom: 0.7 * scale,
        diameterTop: 0.45 * scale,
        tessellation: 12,
      },
      this.scene
    );
    trunk.position = new Vector3(0, trunkHeight / 2, 0);
    trunk.parent = root;
    trunk.material = trunkMat;

    // Canopy: 3 smooth-shaded cone tiers with heavy overlap
    const cones = [
      { diameterBottom: 4.2, height: 2.2, yBase: 0.6 },   // bottom — widest
      { diameterBottom: 3.2, height: 2.2, yBase: 1.8 },   // middle
      { diameterBottom: 2.0, height: 2.8, yBase: 3.0 },   // top — tallest point
    ];

    for (let c = 0; c < cones.length; c++) {
      // Per-cone dimensional jitter: ±15% diameter, ±10% height
      const dJitter = 1.0 + (hash(index * 11 + 60 + c * 2) - 0.5) * 0.3;
      const hJitter = 1.0 + (hash(index * 11 + 61 + c * 2) - 0.5) * 0.2;
      const coneDiamBottom = cones[c].diameterBottom * scale * dJitter;
      const coneHeight = cones[c].height * scale * hJitter;

      const cone = CreateCylinder(
        `pine_canopy_${index}_${c}`,
        {
          height: coneHeight,
          diameterTop: 0,
          diameterBottom: coneDiamBottom,
          tessellation: 24,
        },
        this.scene
      );
      const coneY = cones[c].yBase * scale + coneHeight / 2;
      cone.position = new Vector3(0, coneY, 0);
      cone.parent = root;
      cone.material = canopyMat;

      // Snow shelf: thick cap sitting on each tier
      const snowHeight = 0.25 * snowAmount * scale;
      const snowDiamBottom = coneDiamBottom * (0.5 + snowAmount * 0.35);
      const snowDiamTop = snowDiamBottom * 0.5;
      const snow = CreateCylinder(
        `pine_snow_${index}_${c}`,
        {
          height: snowHeight,
          diameterTop: snowDiamTop,
          diameterBottom: snowDiamBottom,
          tessellation: 24,
        },
        this.scene
      );
      const snowY = cones[c].yBase * scale + coneHeight + snowHeight / 2;
      snow.position = new Vector3(0, snowY, 0);
      snow.parent = root;
      snow.material = snowMat;
    }

    // Physics aggregate on trunk for collision
    const physicsProxy = CreateCylinder(
      `pine_phys_${index}`,
      { height: 7 * scale, diameter: 0.8 * scale, tessellation: 6 },
      this.scene
    );
    physicsProxy.position = new Vector3(
      position.x,
      position.y + (7 * scale) / 2,
      position.z
    );
    physicsProxy.isVisible = false;

    new PhysicsAggregate(
      physicsProxy,
      PhysicsShapeType.CYLINDER,
      { mass: 0, restitution: 0.5 },
      this.scene
    );
  }

  private buildAspen(
    index: number,
    position: Vector3,
    scale: number,
    trunkMat: StandardMaterial,
    canopyMat: StandardMaterial,
    snowMat: StandardMaterial,
    snowAmount: number,
    hash: (seed: number) => number
  ): void {
    const root = new TransformNode(`aspen_${index}`, this.scene);
    root.position = position;

    // Per-tree rotation: Y-axis full rotation, slight lean on X/Z
    root.rotation.y = hash(index * 13 + 70) * Math.PI * 2;
    const leanMax = 3 * (Math.PI / 180); // ±3 degrees
    root.rotation.x = (hash(index * 13 + 71) - 0.5) * 2 * leanMax;
    root.rotation.z = (hash(index * 13 + 72) - 0.5) * 2 * leanMax;

    // Trunk: white/cream tapered cylinder
    const trunkJitter = 1.0 + (hash(index * 13 + 73) - 0.5) * 0.2; // ±10%
    const trunkHeight = 3.0 * scale * trunkJitter;
    const trunk = CreateCylinder(
      `aspen_trunk_${index}`,
      {
        height: trunkHeight,
        diameterBottom: 0.5 * scale,
        diameterTop: 0.3 * scale,
        tessellation: 12,
      },
      this.scene
    );
    trunk.position = new Vector3(0, trunkHeight / 2, 0);
    trunk.parent = root;
    trunk.material = trunkMat;

    // Canopy: smooth-shaded ellipsoid with proper normals
    const heightJitter = 1.0 + (hash(index * 13 + 74) - 0.5) * 0.3; // ±15%
    const widthJitter = 1.0 + (hash(index * 13 + 75) - 0.5) * 0.3;  // ±15%
    const canopyDiamX = 2.5 * scale * widthJitter;
    const canopyDiamY = 3.0 * scale * heightJitter;
    const canopyDiamZ = 2.5 * scale * widthJitter;
    const canopy = CreateSphere(
      `aspen_canopy_${index}`,
      {
        segments: 20,
        diameterX: canopyDiamX,
        diameterY: canopyDiamY,
        diameterZ: canopyDiamZ,
      },
      this.scene
    );
    const canopyY = trunkHeight + canopyDiamY / 2 - 0.3 * scale;
    canopy.position = new Vector3(0, canopyY, 0);
    canopy.parent = root;
    canopy.material = canopyMat;

    // Snow cap on top of canopy
    const snowHeight = 0.4 * snowAmount * scale;
    const snowDiameter = canopyDiamX * (0.4 + snowAmount * 0.4);
    const snowCap = CreateCylinder(
      `aspen_snow_${index}`,
      {
        height: snowHeight,
        diameterTop: snowDiameter * 0.6,
        diameterBottom: snowDiameter,
        tessellation: 24,
      },
      this.scene
    );
    const snowY = trunkHeight + canopyDiamY - 0.3 * scale + snowHeight / 2;
    snowCap.position = new Vector3(0, snowY, 0);
    snowCap.parent = root;
    snowCap.material = snowMat;

    // Physics aggregate on trunk for collision
    const physicsProxy = CreateCylinder(
      `aspen_phys_${index}`,
      { height: 6 * scale, diameter: 0.6 * scale, tessellation: 6 },
      this.scene
    );
    physicsProxy.position = new Vector3(
      position.x,
      position.y + (6 * scale) / 2,
      position.z
    );
    physicsProxy.isVisible = false;

    new PhysicsAggregate(
      physicsProxy,
      PhysicsShapeType.CYLINDER,
      { mass: 0, restitution: 0.5 },
      this.scene
    );
  }

  private buildMountainBorders(): void {
    // Mountain material — vertex colors provide rock-to-snow gradient
    const mountainMat = new StandardMaterial("mountainMat", this.scene);
    mountainMat.diffuseColor = new Color3(1, 1, 1);
    mountainMat.specularColor = new Color3(0.1, 0.1, 0.1);

    for (const side of [-1, 1]) {
      // Foreground ridge — closer, medium height
      this.buildRidgeMesh(side, WIDTH / 2 + 2, 8, 10, 24, 0.1, mountainMat, "fg");
      // Background ridge — further out, taller, more dramatic
      this.buildRidgeMesh(side, WIDTH / 2 + 16, 14, 20, 42, 0.07, mountainMat, "bg");
      // Physics colliders following the S-curve
      this.buildRidgeCollider(side);
    }
  }

  private buildRidgeMesh(
    side: number,
    baseOffset: number,
    thickness: number,
    minHeight: number,
    maxHeight: number,
    noiseScale: number,
    mat: StandardMaterial,
    label: string
  ): void {
    const segCount = 200;
    const segLength = LENGTH / segCount;
    const positions: number[] = [];
    const indices: number[] = [];
    const colors: number[] = [];

    // For each Z step, 3 vertices forming a triangular mountain cross-section:
    //   0: inner_bottom (slope edge, ground level)
    //   1: peak (slightly outward, ridge height)
    //   2: outer_bottom (further outward, ground level)
    for (let i = 0; i <= segCount; i++) {
      const z = -i * segLength;
      const curveOffset = Math.sin(-z * 0.015) * CURVE_AMPLITUDE;
      const xBase = curveOffset + side * baseOffset;
      const groundY = SlopeBuilder.heightOnSlope(xBase, z);

      // Ridge height using multi-octave ridge noise for jagged peaks
      const ridgeH = SlopeBuilder.ridgeFbm(
        i * noiseScale,
        (side + 2) * 100 + i * noiseScale * 0.3,
        5
      );
      const peakHeight = minHeight + ridgeH * (maxHeight - minHeight);

      // Inner bottom — at slope edge, slightly below ground to avoid gaps
      positions.push(xBase, groundY - 1, z);
      colors.push(0.32, 0.28, 0.38, 1.0); // Dark rock

      // Peak — slightly outward, at ridge height
      const peakX = xBase + side * (thickness * 0.4);
      positions.push(peakX, groundY + peakHeight, z);
      // Color: rock at low ridges, snow-white at tall peaks
      const snowT = Math.pow(ridgeH, 0.6);
      colors.push(
        0.32 + snowT * 0.62,
        0.28 + snowT * 0.69,
        0.38 + snowT * 0.59,
        1.0
      );

      // Outer bottom — further outward, below ground
      const outerX = xBase + side * thickness;
      positions.push(outerX, groundY - 1, z);
      colors.push(0.28, 0.25, 0.35, 1.0); // Dark rock
    }

    // Build triangles connecting adjacent cross-sections
    for (let i = 0; i < segCount; i++) {
      const base = i * 3;
      const next = (i + 1) * 3;

      if (side > 0) {
        // Right side — inner face normal points toward slope (-X)
        indices.push(base + 0, base + 1, next + 1);
        indices.push(base + 0, next + 1, next + 0);
        // Outer face
        indices.push(base + 1, base + 2, next + 2);
        indices.push(base + 1, next + 2, next + 1);
      } else {
        // Left side — inner face normal points toward slope (+X)
        indices.push(base + 0, next + 1, base + 1);
        indices.push(base + 0, next + 0, next + 1);
        // Outer face
        indices.push(base + 1, next + 2, base + 2);
        indices.push(base + 1, next + 1, next + 2);
      }
    }

    const vertexData = new VertexData();
    vertexData.positions = positions;
    vertexData.indices = indices;
    vertexData.colors = colors;

    const mesh = new Mesh(
      `ridge_${label}_${side > 0 ? "R" : "L"}`,
      this.scene
    );
    vertexData.applyToMesh(mesh);
    mesh.createNormals(false);
    mesh.convertToFlatShadedMesh(); // Faceted low-poly mountain look
    mesh.material = mat;
  }

  private buildRidgeCollider(side: number): void {
    // Multiple overlapping box colliders following the S-curve
    const segCount = 20;
    const segLength = LENGTH / segCount;

    for (let i = 0; i < segCount; i++) {
      const z = -(i + 0.5) * segLength;
      const curveOffset = Math.sin(-z * 0.015) * CURVE_AMPLITUDE;
      const x = curveOffset + side * (WIDTH / 2 + 5);
      const y = SlopeBuilder.heightOnSlope(x, z);

      const wall = CreateBox(
        `mountainWall_${side > 0 ? "R" : "L"}_${i}`,
        { width: 10, height: 50, depth: segLength * 1.2 },
        this.scene
      );
      wall.position = new Vector3(x, y + 20, z);
      wall.isVisible = false;

      new PhysicsAggregate(
        wall,
        PhysicsShapeType.BOX,
        { mass: 0, restitution: 0.3 },
        this.scene
      );
    }
  }

  private buildFinishGate(): void {
    const gateZ = FINISH_Z;
    const curveOffset = Math.sin(-gateZ * 0.015) * CURVE_AMPLITUDE;
    const gateY = SlopeBuilder.heightOnSlope(curveOffset, gateZ);

    // Red pole material
    const poleMat = new StandardMaterial("finishPoleMat", this.scene);
    poleMat.diffuseColor = new Color3(0.9, 0.15, 0.1);

    // Banner material — bright yellow
    const bannerMat = new StandardMaterial("finishBannerMat", this.scene);
    bannerMat.diffuseColor = new Color3(1.0, 0.85, 0.1);

    const gateWidth = 12;
    const poleHeight = 6;

    // Left pole
    const leftPole = CreateCylinder(
      "finishPoleL",
      { height: poleHeight, diameter: 0.3, tessellation: 12 },
      this.scene
    );
    leftPole.position = new Vector3(
      curveOffset - gateWidth / 2,
      gateY + poleHeight / 2,
      gateZ
    );
    leftPole.material = poleMat;

    // Right pole
    const rightPole = CreateCylinder(
      "finishPoleR",
      { height: poleHeight, diameter: 0.3, tessellation: 12 },
      this.scene
    );
    rightPole.position = new Vector3(
      curveOffset + gateWidth / 2,
      gateY + poleHeight / 2,
      gateZ
    );
    rightPole.material = poleMat;

    // Banner crossbar
    const banner = CreateBox(
      "finishBanner",
      { width: gateWidth, height: 1.2, depth: 0.15 },
      this.scene
    );
    banner.position = new Vector3(
      curveOffset,
      gateY + poleHeight - 0.6,
      gateZ
    );
    banner.material = bannerMat;

    // "FINISH" text banner stripe (darker red stripe)
    const stripe = CreateBox(
      "finishStripe",
      { width: gateWidth, height: 0.3, depth: 0.16 },
      this.scene
    );
    stripe.position = new Vector3(
      curveOffset,
      gateY + poleHeight - 0.6,
      gateZ
    );
    stripe.material = poleMat;
  }
}
