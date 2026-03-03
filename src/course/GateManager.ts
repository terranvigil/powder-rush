import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { InstancedMesh } from "@babylonjs/core/Meshes/instancedMesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { CreatePlane } from "@babylonjs/core/Meshes/Builders/planeBuilder";
import { SlopeFunction } from "../terrain/SlopeFunction";
import { SlopeSpline } from "../terrain/SlopeSpline";

// Gate configs per course type
export interface GateConfig {
  spacing: number;       // meters between gates along Z
  width: number;         // distance between inner and outer pole
  lateralOffset: number; // offset from centerline
  poleHeight: number;
  penaltySeconds: number;
}

export const SLALOM_CONFIG: GateConfig = {
  spacing: 11,
  width: 5,
  lateralOffset: 5,
  poleHeight: 1.8,
  penaltySeconds: 2,
};

export const SUPER_G_CONFIG: GateConfig = {
  spacing: 35,
  width: 10,
  lateralOffset: 8,
  poleHeight: 2.2,
  penaltySeconds: 5,
};

interface Gate {
  z: number;
  innerX: number;
  outerX: number;
  passed: boolean;
  missed: boolean;
  side: -1 | 1; // -1 = left, +1 = right
}

const START_Z = -30;
const END_Z = -1120;
const VISIBILITY = 200;

export class GateManager {
  private scene: Scene;
  private root: TransformNode;
  private gates: Gate[] = [];
  private config: GateConfig;
  private lastPlayerZ = 0;
  private initialized = false;
  private spline: SlopeSpline;

  // Pole instances for visibility culling
  private poleInstances: { inner: InstancedMesh; outer: InstancedMesh }[] = [];

  // Fence posts + panels for visibility culling
  private fenceMeshes: Mesh[] = [];
  private dyeMeshes: Mesh[] = [];

  // Stats
  private _passed = 0;
  private _missed = 0;

  constructor(
    scene: Scene,
    slopeFunction: SlopeFunction,
    spline: SlopeSpline,
    config: GateConfig,
  ) {
    this.scene = scene;
    this.config = config;
    this.spline = spline;
    this.root = new TransformNode("gates", scene);

    this.placeGates(spline);
    this.buildPoles(slopeFunction);
    this.buildFences(slopeFunction, spline);
    this.buildSnowDye(slopeFunction);
  }

  private placeGates(spline: SlopeSpline): void {
    let z = START_Z;
    let side: -1 | 1 = -1; // start left

    while (z > END_Z) {
      const cx = spline.centerXAt(z);

      // Inner pole = closer to center, outer = further out
      const innerX = cx + side * this.config.lateralOffset;
      const outerX = innerX + side * this.config.width;

      this.gates.push({ z, innerX, outerX, passed: false, missed: false, side });

      z -= this.config.spacing;
      side = side === -1 ? 1 : -1; // alternate
    }
  }

  private buildPoles(sf: SlopeFunction): void {
    const h = this.config.poleHeight;

    // Red and blue materials (alternating gate colors)
    const redMat = new StandardMaterial("gateRed", this.scene);
    redMat.diffuseColor = new Color3(0.9, 0.15, 0.1);
    redMat.specularColor = new Color3(0.2, 0.2, 0.2);

    const blueMat = new StandardMaterial("gateBlue", this.scene);
    blueMat.diffuseColor = new Color3(0.1, 0.2, 0.9);
    blueMat.specularColor = new Color3(0.2, 0.2, 0.2);

    // Prototype poles (hidden)
    const redProto = CreateCylinder("_redPole", { height: h, diameter: 0.07, tessellation: 6 }, this.scene);
    redProto.material = redMat;
    redProto.isVisible = false;
    redProto.setEnabled(false);

    const blueProto = CreateCylinder("_bluePole", { height: h, diameter: 0.07, tessellation: 6 }, this.scene);
    blueProto.material = blueMat;
    blueProto.isVisible = false;
    blueProto.setEnabled(false);

    for (let i = 0; i < this.gates.length; i++) {
      const g = this.gates[i];
      const proto = i % 2 === 0 ? redProto : blueProto;

      const iy = sf.heightAt(g.innerX, g.z);
      const inner = proto.createInstance(`gi_${i}`);
      inner.position.set(g.innerX, iy + h / 2, g.z);
      inner.parent = this.root;
      inner.setEnabled(false);

      const oy = sf.heightAt(g.outerX, g.z);
      const outer = proto.createInstance(`go_${i}`);
      outer.position.set(g.outerX, oy + h / 2, g.z);
      outer.parent = this.root;
      outer.setEnabled(false);

      this.poleInstances.push({ inner, outer });
    }
  }

  private buildFences(sf: SlopeFunction, spline: SlopeSpline): void {
    const FENCE_SPACING = 25;
    const POST_HEIGHT = 2;

    // Orange fence material
    const fenceMat = new StandardMaterial("fenceMat", this.scene);
    fenceMat.diffuseColor = new Color3(0.95, 0.45, 0.05);
    fenceMat.specularColor = new Color3(0.1, 0.1, 0.1);

    // Semi-transparent netting material
    const netMat = new StandardMaterial("fenceNet", this.scene);
    netMat.diffuseColor = new Color3(0.95, 0.45, 0.05);
    netMat.alpha = 0.4;
    netMat.specularColor = new Color3(0.1, 0.1, 0.1);
    netMat.backFaceCulling = false;

    let z = START_Z;
    while (z > END_Z) {
      const cx = spline.centerXAt(z);
      const hw = spline.halfWidthAt(z);

      for (const side of [-1, 1]) {
        const x = cx + side * (hw - 2);
        const y = sf.heightAt(x, z);

        // Post
        const post = CreateCylinder(`fpost_${z}_${side}`, { height: POST_HEIGHT, diameter: 0.06, tessellation: 6 }, this.scene);
        post.material = fenceMat;
        post.position.set(x, y + POST_HEIGHT / 2, z);
        post.parent = this.root;
        post.setEnabled(false);
        this.fenceMeshes.push(post);

        // Panel between this post and next
        const nextZ = z - FENCE_SPACING;
        if (nextZ > END_Z) {
          const nextCx = spline.centerXAt(nextZ);
          const nextHw = spline.halfWidthAt(nextZ);
          const nextX = nextCx + side * (nextHw - 2);
          const nextY = sf.heightAt(nextX, nextZ);
          const midX = (x + nextX) / 2;
          const midY = (y + nextY) / 2;
          const midZ = (z + nextZ) / 2;

          const panel = CreateBox(`fpanel_${z}_${side}`, {
            width: 0.01,
            height: POST_HEIGHT,
            depth: FENCE_SPACING,
          }, this.scene);
          panel.material = netMat;
          panel.position.set(midX, midY + POST_HEIGHT / 2, midZ);
          panel.parent = this.root;
          panel.setEnabled(false);
          this.fenceMeshes.push(panel);
        }
      }
      z -= FENCE_SPACING;
    }
  }

  private buildSnowDye(sf: SlopeFunction): void {
    const dyeMat = new StandardMaterial("snowDye", this.scene);
    dyeMat.diffuseColor = new Color3(0.15, 0.25, 0.85);
    dyeMat.alpha = 0.3;
    dyeMat.specularColor = Color3.Black();
    dyeMat.backFaceCulling = false;

    for (const gate of this.gates) {
      const midX = (gate.innerX + gate.outerX) / 2;
      const y = sf.heightAt(midX, gate.z) + 0.02;

      const dye = CreatePlane(`dye_${gate.z}`, { width: 2, height: 3 }, this.scene);
      dye.material = dyeMat;
      dye.position.set(midX, y, gate.z);
      dye.rotation.x = Math.PI / 2; // lay flat on ground
      dye.parent = this.root;
      dye.setEnabled(false);
      this.dyeMeshes.push(dye);
    }
  }

  update(playerX: number, playerZ: number): void {
    if (!this.initialized) {
      this.lastPlayerZ = playerZ;
      this.initialized = true;
      return;
    }

    // Check gate crossings
    for (const gate of this.gates) {
      if (gate.passed || gate.missed) continue;

      // Player crossed gate Z line going downhill
      if (this.lastPlayerZ > gate.z && playerZ <= gate.z) {
        const minX = Math.min(gate.innerX, gate.outerX);
        const maxX = Math.max(gate.innerX, gate.outerX);

        if (playerX >= minX && playerX <= maxX) {
          gate.passed = true;
          this._passed++;
        } else {
          gate.missed = true;
          this._missed++;
        }
      }
    }

    // Visibility culling — gate poles
    for (let i = 0; i < this.gates.length; i++) {
      const visible = Math.abs(this.gates[i].z - playerZ) < VISIBILITY;
      this.poleInstances[i].inner.setEnabled(visible);
      this.poleInstances[i].outer.setEnabled(visible);
    }

    // Visibility culling — fence posts + panels
    for (const mesh of this.fenceMeshes) {
      mesh.setEnabled(Math.abs(mesh.position.z - playerZ) < VISIBILITY);
    }

    // Visibility culling — snow dye strips
    for (const mesh of this.dyeMeshes) {
      mesh.setEnabled(Math.abs(mesh.position.z - playerZ) < VISIBILITY);
    }

    this.lastPlayerZ = playerZ;
  }

  /** Next upcoming gate for HUD direction indicator */
  getNextGate(playerZ: number): { side: -1 | 1; distance: number } | null {
    for (const gate of this.gates) {
      if (gate.z < playerZ && !gate.passed && !gate.missed) {
        return { side: gate.side, distance: playerZ - gate.z };
      }
    }
    return null;
  }

  get totalGates(): number { return this.gates.length; }
  get gatesPassed(): number { return this._passed; }
  get gatesMissed(): number { return this._missed; }
  get timePenalty(): number { return this._missed * this.config.penaltySeconds; }
}
