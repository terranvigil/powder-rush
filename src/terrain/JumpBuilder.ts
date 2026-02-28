import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { PhysicsAggregate } from "@babylonjs/core/Physics/v2/physicsAggregate";
import { PhysicsShapeType } from "@babylonjs/core/Physics/v2/IPhysicsEnginePlugin";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { SlopeFunction } from "./SlopeFunction";
import { SlopeSpline } from "./SlopeSpline";
import { hash } from "./Noise";

const TOTAL_JUMP_COUNT = 3;
const TOTAL_LENGTH = 1200;
const JUMP_START_Z = 200;  // no jumps in first 200m
const JUMP_END_Z = 150;    // no jumps in last 150m

// Tabletop jump profile: [zFraction of halfLength, yFraction of height]
// z positive = approach (skier enters here), z negative = landing/runout
// Smooth curve with enough cross-sections for clean physics
const PROFILE: [number, number][] = [
  [ 1.00, 0.00],  // approach start (ground)
  [ 0.75, 0.04],  // gentle rise
  [ 0.50, 0.20],  // transition
  [ 0.30, 0.55],  // mid ramp
  [ 0.15, 0.90],  // upper ramp
  [ 0.08, 1.00],  // lip (takeoff) — blue dye here
  [-0.08, 1.00],  // table
  [-0.20, 0.65],  // knuckle / start landing
  [-0.40, 0.25],  // landing zone
  [-0.65, 0.04],  // runout transition
  [-1.00, 0.00],  // runout end (ground)
];

const LIP_INDEX = 5;
const SKIRT_WIDTH = 1.5; // side blend into terrain

export interface JumpResult {
  nodes: Mesh[];
  aggregates: PhysicsAggregate[];
  shadowCasters: Mesh[];
}

let blueMat: StandardMaterial | null = null;

export function buildJumps(
  chunkIndex: number,
  zStart: number,
  zEnd: number,
  scene: Scene,
  slopeFunction: SlopeFunction,
  spline: SlopeSpline,
  material: StandardMaterial,
  shadowGen: ShadowGenerator
): JumpResult {
  const nodes: Mesh[] = [];
  const aggregates: PhysicsAggregate[] = [];
  const shadowCasters: Mesh[] = [];

  if (!blueMat) {
    blueMat = new StandardMaterial("jumpLipBlueMat", scene);
    blueMat.diffuseColor = new Color3(0.15, 0.35, 0.85);
    blueMat.specularColor = new Color3(0.3, 0.4, 0.7);
  }

  for (let i = 0; i < TOTAL_JUMP_COUNT; i++) {
    const z = -JUMP_START_Z - hash(i * 11 + 5000) * (TOTAL_LENGTH - JUMP_START_Z - JUMP_END_Z);

    if (z > zStart + 2 || z < zEnd - 2) continue;

    const centerX = spline.centerXAt(z);
    const halfWidth = spline.halfWidthAt(z);
    const lateralT = (hash(i * 11 + 5001) - 0.5) * 0.4;
    const x = centerX + lateralT * halfWidth;

    const width = 5.0 + hash(i * 11 + 5002) * 2.0;       // 5-7m wide
    const totalLength = 14.0 + hash(i * 11 + 5003) * 4.0; // 14-18m long
    const height = 1.2 + hash(i * 11 + 5004) * 0.8;       // 1.2-2.0m tall

    buildTabletop(
      i, chunkIndex, x, z,
      width, totalLength, height,
      scene, slopeFunction, material, blueMat!, shadowGen,
      nodes, aggregates, shadowCasters
    );
  }

  return { nodes, aggregates, shadowCasters };
}

function buildTabletop(
  index: number,
  chunkIndex: number,
  centerX: number,
  centerZ: number,
  width: number,
  totalLength: number,
  height: number,
  scene: Scene,
  slopeFunction: SlopeFunction,
  snowMaterial: StandardMaterial,
  lipMaterial: StandardMaterial,
  shadowGen: ShadowGenerator,
  nodes: Mesh[],
  aggregates: PhysicsAggregate[],
  shadowCasters: Mesh[]
): void {
  const halfW = width / 2;
  const halfL = totalLength / 2;
  const n = PROFILE.length;
  const centerY = slopeFunction.heightAt(centerX, centerZ);

  const positions: number[] = [];

  // 4 vertices per profile row: skirtL, topL, topR, skirtR
  // Top follows terrain height + jump profile offset
  // Skirts sit at terrain level for smooth blending
  for (const [zFrac, yFrac] of PROFILE) {
    const localZ = zFrac * halfL;
    const worldZ = centerZ + localZ;
    const terrainY = slopeFunction.heightAt(centerX, worldZ);
    const baseY = terrainY - centerY; // local y relative to mesh origin
    const jumpOffset = yFrac * height;

    // Skirt left — at terrain level, extends wider
    positions.push(-halfW - SKIRT_WIDTH, baseY - 0.1, localZ);
    // Top left
    positions.push(-halfW, baseY + jumpOffset, localZ);
    // Top right
    positions.push(halfW, baseY + jumpOffset, localZ);
    // Skirt right — at terrain level, extends wider
    positions.push(halfW + SKIRT_WIDTH, baseY - 0.1, localZ);
  }

  const indices: number[] = [];

  // Connect rows: 3 quads per row (skirtL-topL, topL-topR, topR-skirtR)
  for (let i = 0; i < n - 1; i++) {
    const row = i * 4;
    const nextRow = (i + 1) * 4;

    for (let col = 0; col < 3; col++) {
      const tl = row + col;
      const tr = row + col + 1;
      const bl = nextRow + col;
      const br = nextRow + col + 1;
      indices.push(tl, bl, br, tl, br, tr);
    }
  }

  const vertexData = new VertexData();
  vertexData.positions = positions;
  vertexData.indices = indices;

  const mesh = new Mesh(`jump_${chunkIndex}_${index}`, scene);
  vertexData.applyToMesh(mesh);
  mesh.createNormals(false);
  mesh.position = new Vector3(centerX, centerY, centerZ);
  mesh.material = snowMaterial;
  mesh.receiveShadows = true;
  shadowGen.addShadowCaster(mesh);
  shadowCasters.push(mesh);
  nodes.push(mesh);

  const agg = new PhysicsAggregate(
    mesh, PhysicsShapeType.MESH,
    { mass: 0, restitution: 0.08, friction: 0.02 },
    scene
  );
  aggregates.push(agg);

  // Blue dye strip on the lip edge
  const lipZ = PROFILE[LIP_INDEX][0] * halfL;
  const lipWorldZ = centerZ + lipZ;
  const lipTerrainY = slopeFunction.heightAt(centerX, lipWorldZ);
  const strip = CreateBox(`jumpLip_${chunkIndex}_${index}`, {
    width: width + 0.3,
    height: 0.06,
    depth: 0.5,
  }, scene);
  strip.position = new Vector3(centerX, lipTerrainY + height + 0.03, lipWorldZ);
  strip.material = lipMaterial;
  strip.receiveShadows = true;
  shadowGen.addShadowCaster(strip);
  shadowCasters.push(strip);
  nodes.push(strip);
}
