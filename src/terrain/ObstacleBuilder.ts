import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { PhysicsAggregate } from "@babylonjs/core/Physics/v2/physicsAggregate";
import { PhysicsShapeType } from "@babylonjs/core/Physics/v2/IPhysicsEnginePlugin";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { SlopeFunction } from "./SlopeFunction";
import { SlopeSpline } from "./SlopeSpline";
import { hash } from "./Noise";

const TOTAL_OBSTACLE_COUNT = 80;
const TOTAL_LENGTH = 1200;
const START_SAFE_ZONE = 40;
const END_SAFE_ZONE = 60;

export interface ObstacleMaterials {
  rock: StandardMaterial;
  stump: StandardMaterial;
  stumpSnow: StandardMaterial;
}

export interface ObstacleResult {
  nodes: (Mesh | TransformNode)[];
  aggregates: PhysicsAggregate[];
  shadowCasters: Mesh[];
}

export function buildObstacles(
  chunkIndex: number,
  zStart: number,
  zEnd: number,
  scene: Scene,
  slopeFunction: SlopeFunction,
  spline: SlopeSpline,
  materials: ObstacleMaterials,
  shadowGen: ShadowGenerator
): ObstacleResult {
  const nodes: (Mesh | TransformNode)[] = [];
  const aggregates: PhysicsAggregate[] = [];
  const shadowCasters: Mesh[] = [];

  for (let i = 0; i < TOTAL_OBSTACLE_COUNT; i++) {
    const z = -START_SAFE_ZONE - hash(i * 7 + 1000) * (TOTAL_LENGTH - START_SAFE_ZONE - END_SAFE_ZONE);

    // Filter to chunk z-range
    if (z > zStart + 2 || z < zEnd - 2) continue;

    const isRock = hash(i * 7 + 1001) < 0.6;

    // Place within skiable area
    const centerX = spline.centerXAt(z);
    const halfWidth = spline.halfWidthAt(z);
    const lateralT = hash(i * 7 + 1002) * 2 - 1; // -1..1
    const x = centerX + lateralT * (halfWidth * 0.7);
    const y = slopeFunction.heightAt(x, z);

    if (isRock) {
      buildRock(i, chunkIndex, new Vector3(x, y, z), scene, materials.rock, shadowGen, nodes, aggregates, shadowCasters);
    } else {
      buildStump(i, chunkIndex, new Vector3(x, y, z), scene, materials.stump, materials.stumpSnow, shadowGen, nodes, aggregates, shadowCasters);
    }
  }

  return { nodes, aggregates, shadowCasters };
}

function buildRock(
  index: number,
  chunkIndex: number,
  position: Vector3,
  scene: Scene,
  material: StandardMaterial,
  shadowGen: ShadowGenerator,
  nodes: (Mesh | TransformNode)[],
  aggregates: PhysicsAggregate[],
  shadowCasters: Mesh[]
): void {
  const root = new TransformNode(`rock_${chunkIndex}_${index}`, scene);
  root.position = position;
  nodes.push(root);

  root.rotation.y = hash(index * 11 + 2000) * Math.PI * 2;

  const numParts = 2 + Math.floor(hash(index * 11 + 2001) * 2); // 2-3
  let maxW = 0;
  let maxH = 0;

  for (let p = 0; p < numParts; p++) {
    const w = 0.3 + hash(index * 11 + 2010 + p * 3) * 0.6;
    const h = 0.3 + hash(index * 11 + 2011 + p * 3) * 0.5;
    const d = 0.3 + hash(index * 11 + 2012 + p * 3) * 0.5;
    maxW = Math.max(maxW, w);
    maxH = Math.max(maxH, h);

    const box = CreateBox(
      `rock_part_${chunkIndex}_${index}_${p}`,
      { width: w, height: h, depth: d },
      scene
    );
    const offX = (hash(index * 11 + 2020 + p) - 0.5) * 0.3;
    const offZ = (hash(index * 11 + 2030 + p) - 0.5) * 0.3;
    box.position = new Vector3(offX, h / 2, offZ);
    box.rotation.y = hash(index * 11 + 2040 + p) * 0.5;
    box.rotation.x = (hash(index * 11 + 2050 + p) - 0.5) * 0.3;
    box.parent = root;
    box.material = material;
    shadowGen.addShadowCaster(box);
    shadowCasters.push(box);
  }

  // Physics proxy — box encompassing the cluster
  const proxyW = maxW + 0.3;
  const proxyH = maxH + 0.1;
  const proxy = CreateBox(
    `rock_phys_${chunkIndex}_${index}`,
    { width: proxyW, height: proxyH, depth: proxyW },
    scene
  );
  proxy.position = new Vector3(position.x, position.y + proxyH / 2, position.z);
  proxy.isVisible = false;
  nodes.push(proxy);

  const agg = new PhysicsAggregate(
    proxy, PhysicsShapeType.BOX,
    { mass: 0, restitution: 0.24 }, scene
  );
  (agg as any)._isObstacle = true;
  aggregates.push(agg);
}

function buildStump(
  index: number,
  chunkIndex: number,
  position: Vector3,
  scene: Scene,
  stumpMat: StandardMaterial,
  snowMat: StandardMaterial,
  shadowGen: ShadowGenerator,
  nodes: (Mesh | TransformNode)[],
  aggregates: PhysicsAggregate[],
  shadowCasters: Mesh[]
): void {
  const root = new TransformNode(`stump_${chunkIndex}_${index}`, scene);
  root.position = position;
  nodes.push(root);

  const stumpH = 0.3 + hash(index * 13 + 3000) * 0.2;
  const stumpD = 0.3 + hash(index * 13 + 3001) * 0.3;

  const trunk = CreateCylinder(
    `stump_trunk_${chunkIndex}_${index}`,
    { height: stumpH, diameter: stumpD, tessellation: 10 },
    scene
  );
  trunk.position = new Vector3(0, stumpH / 2, 0);
  trunk.parent = root;
  trunk.material = stumpMat;
  shadowGen.addShadowCaster(trunk);
  shadowCasters.push(trunk);

  // Snow cap
  const snowH = 0.08;
  const snow = CreateCylinder(
    `stump_snow_${chunkIndex}_${index}`,
    { height: snowH, diameterTop: stumpD * 0.7, diameterBottom: stumpD * 1.1, tessellation: 10 },
    scene
  );
  snow.position = new Vector3(0, stumpH + snowH / 2, 0);
  snow.parent = root;
  snow.material = snowMat;
  shadowGen.addShadowCaster(snow);
  shadowCasters.push(snow);

  // Physics proxy
  const proxy = CreateCylinder(
    `stump_phys_${chunkIndex}_${index}`,
    { height: stumpH + 0.1, diameter: stumpD + 0.1, tessellation: 6 },
    scene
  );
  proxy.position = new Vector3(position.x, position.y + (stumpH + 0.1) / 2, position.z);
  proxy.isVisible = false;
  nodes.push(proxy);

  const agg = new PhysicsAggregate(
    proxy, PhysicsShapeType.CYLINDER,
    { mass: 0, restitution: 0.24 }, scene
  );
  (agg as any)._isObstacle = true;
  aggregates.push(agg);
}
