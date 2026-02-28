import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { SlopeFunction } from "../terrain/SlopeFunction";
import { SlopeSpline } from "../terrain/SlopeSpline";

// Simple hash (same as terrain/Noise.ts)
function coinHash(n: number): number {
  let x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

const TOTAL_COINS = 25;
const COIN_START_Z = 80;
const COIN_END_Z = 80;
const TOTAL_LENGTH = 1200;
const COLLECT_RADIUS = 3.0;
const HOVER_HEIGHT = 1.5;
const SPIN_SPEED = 3.0;
const VISIBLE_AHEAD = 120;
const VISIBLE_BEHIND = 30;

interface CoinData {
  pivot: TransformNode;
  mesh: Mesh;
  worldZ: number;
  collected: boolean;
}

export class CoinManager {
  private coins: CoinData[] = [];
  private _collected = 0;

  get collected(): number { return this._collected; }
  get total(): number { return TOTAL_COINS; }

  constructor(
    scene: Scene,
    slopeFunction: SlopeFunction,
    spline: SlopeSpline,
    shadowGen: ShadowGenerator,
  ) {
    const mat = new StandardMaterial("coinMat", scene);
    mat.diffuseColor = new Color3(1.0, 0.84, 0);
    mat.specularColor = new Color3(1.0, 0.9, 0.5);
    mat.emissiveColor = new Color3(0.25, 0.2, 0);

    // Place coins in clusters of 1, 2, or 3
    let coinIndex = 0;
    let clusterSeed = 0;
    while (coinIndex < TOTAL_COINS) {
      // Determine cluster size (1, 2, or 3) — don't exceed total
      const sizeRoll = coinHash(clusterSeed * 13 + 5000);
      const clusterSize = Math.min(
        sizeRoll < 0.33 ? 1 : sizeRoll < 0.66 ? 2 : 3,
        TOTAL_COINS - coinIndex,
      );

      // Cluster anchor position
      const z = -COIN_START_Z - coinHash(clusterSeed * 7 + 3000) * (TOTAL_LENGTH - COIN_START_Z - COIN_END_Z);
      const centerX = spline.centerXAt(z);
      const halfWidth = spline.halfWidthAt(z);
      const lateralT = (coinHash(clusterSeed * 7 + 3001) - 0.5) * 0.6;
      const anchorX = centerX + lateralT * halfWidth;

      for (let j = 0; j < clusterSize; j++) {
        // Offset each coin in the cluster along the downhill direction
        const cz = z + j * 2.5; // 2.5m spacing downhill
        const cx = anchorX;
        const cy = slopeFunction.heightAt(cx, cz) + HOVER_HEIGHT;

        const pivot = new TransformNode(`coinPivot_${coinIndex}`, scene);
        pivot.position = new Vector3(cx, cy, cz);

        const mesh = CreateCylinder(`coin_${coinIndex}`, {
          height: 0.12,
          diameter: 0.9,
          tessellation: 16,
        }, scene);
        mesh.material = mat;
        mesh.rotation.x = Math.PI / 2; // stand on edge
        mesh.parent = pivot;
        shadowGen.addShadowCaster(mesh);

        pivot.setEnabled(false);
        this.coins.push({ pivot, mesh, worldZ: cz, collected: false });
        coinIndex++;
      }
      clusterSeed++;
    }
  }

  update(playerPos: Vector3, dt: number): number {
    let justCollected = 0;

    for (const coin of this.coins) {
      if (coin.collected) continue;

      const dz = coin.worldZ - playerPos.z;
      if (dz > VISIBLE_BEHIND || dz < -VISIBLE_AHEAD) {
        coin.pivot.setEnabled(false);
        continue;
      }
      coin.pivot.setEnabled(true);

      // Spin
      coin.pivot.rotation.y += SPIN_SPEED * dt;

      // Collection check
      const dx = coin.pivot.position.x - playerPos.x;
      const dy = coin.pivot.position.y - playerPos.y;
      const distSq = dx * dx + dy * dy + dz * dz;
      if (distSq < COLLECT_RADIUS * COLLECT_RADIUS) {
        coin.collected = true;
        coin.pivot.setEnabled(false);
        coin.mesh.dispose();
        this._collected++;
        justCollected++;
      }
    }

    return justCollected;
  }
}
