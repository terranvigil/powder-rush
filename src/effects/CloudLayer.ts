import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { CreatePlane } from "@babylonjs/core/Meshes/Builders/planeBuilder";

const CLOUD_COUNT = 16;
const CLOUD_HEIGHT = 55;      // base height above camera
const SPREAD_X = 200;
const SPREAD_Z = 350;
const DRIFT_SPEED = 1.5;      // m/s gentle wind drift

export class CloudLayer {
  private root: TransformNode;
  private driftOffset = 0;

  constructor(scene: Scene) {
    this.root = new TransformNode("cloudRoot", scene);

    const mat = new StandardMaterial("cloudMat", scene);
    mat.diffuseColor = Color3.White();
    mat.emissiveColor = new Color3(0.78, 0.80, 0.88);
    mat.specularColor = Color3.Black();
    mat.alpha = 0.4;
    mat.backFaceCulling = false;
    mat.disableLighting = true;

    for (let i = 0; i < CLOUD_COUNT; i++) {
      const w = 30 + rand(i * 31) * 60;  // 30-90m wide
      const h = 5 + rand(i * 37) * 10;   // 5-15m tall (wispy)

      const cloud = CreatePlane(`cloud_${i}`, { width: w, height: h }, scene);
      cloud.material = mat;
      cloud.billboardMode = Mesh.BILLBOARDMODE_ALL;
      cloud.isPickable = false;
      cloud.parent = this.root;

      // Scatter around the camera
      const angle = (i / CLOUD_COUNT) * Math.PI * 2 + rand(i * 7) * 0.5;
      const radius = 50 + rand(i * 13) * (SPREAD_X - 50);
      cloud.position.x = Math.sin(angle) * radius;
      cloud.position.y = rand(i * 23) * 20;  // 0-20m height variation
      cloud.position.z = (rand(i * 19) - 0.5) * SPREAD_Z * 2;
    }
  }

  update(camPos: Vector3, dt: number): void {
    this.driftOffset += DRIFT_SPEED * dt;
    this.root.position.x = camPos.x + this.driftOffset;
    // Clouds descend at 30% of camera rate — provides slope depth reference
    this.root.position.y = CLOUD_HEIGHT + camPos.y * 0.3;
    this.root.position.z = camPos.z;
  }
}

function rand(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}
