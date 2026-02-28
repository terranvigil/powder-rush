import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { InstancedMesh } from "@babylonjs/core/Meshes/instancedMesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder";
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

  // Pole instances for visibility culling
  private poleInstances: { inner: InstancedMesh; outer: InstancedMesh }[] = [];

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
    this.root = new TransformNode("gates", scene);

    this.placeGates(spline);
    this.buildPoles(slopeFunction);
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

    // Visibility culling
    for (let i = 0; i < this.gates.length; i++) {
      const visible = Math.abs(this.gates[i].z - playerZ) < VISIBILITY;
      this.poleInstances[i].inner.setEnabled(visible);
      this.poleInstances[i].outer.setEnabled(visible);
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
