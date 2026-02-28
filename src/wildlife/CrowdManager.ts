import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { SlopeFunction } from "../terrain/SlopeFunction";
import { SlopeSpline } from "../terrain/SlopeSpline";
import { hash } from "../terrain/Noise";

const CROWD_PER_GATE = 24;
const CHEER_RATIO = 0.3;
const DEG = Math.PI / 180;

// Jacket color palette — bright, varied winter wear
const JACKET_COLORS: Color3[] = [
  new Color3(0.9, 0.2, 0.15),  // red
  new Color3(0.15, 0.4, 0.85), // blue
  new Color3(0.1, 0.7, 0.3),   // green
  new Color3(0.85, 0.7, 0.1),  // yellow
  new Color3(0.7, 0.15, 0.6),  // purple
  new Color3(0.95, 0.5, 0.1),  // orange
  new Color3(0.2, 0.65, 0.65), // teal
  new Color3(0.8, 0.8, 0.85),  // white/grey
];

interface Spectator {
  root: TransformNode;
  leftArm: Mesh;
  rightArm: Mesh;
  cheering: boolean;
  phase: number;      // animation phase offset
  waveSpeed: number;  // arm wave speed
  shufflePhase: number;
  baseY: number;
  baseRotY: number;
}

export class CrowdManager {
  private spectators: Spectator[] = [];

  constructor(
    scene: Scene,
    slopeFunction: SlopeFunction,
    spline: SlopeSpline,
    shadowGen: ShadowGenerator,
    startGateZ: number,
    finishGateZ: number,
  ) {
    // Place crowds at both gates
    this.placeCrowd(scene, slopeFunction, spline, shadowGen, startGateZ, 0);
    this.placeCrowd(scene, slopeFunction, spline, shadowGen, finishGateZ, CROWD_PER_GATE);
  }

  private placeCrowd(
    scene: Scene,
    slopeFunction: SlopeFunction,
    spline: SlopeSpline,
    shadowGen: ShadowGenerator,
    gateZ: number,
    idOffset: number,
  ): void {
    for (let i = 0; i < CROWD_PER_GATE; i++) {
      const id = idOffset + i;
      const h = hash(id * 31 + 7000);
      const h2 = hash(id * 31 + 7001);
      const h3 = hash(id * 31 + 7002);

      // Position: spread along Z near the gate, on both sides
      const side = i < CROWD_PER_GATE / 2 ? -1 : 1;
      const zSpread = (h - 0.5) * 10; // ±5m along course
      const z = gateZ + zSpread;

      const centerX = spline.centerXAt(z);
      const lateralDist = 4 + h2 * 6; // 4-10m from center line
      const x = centerX + side * lateralDist;
      const y = slopeFunction.heightAt(x, z);

      const cheering = h3 < CHEER_RATIO;
      const facing = side * (-60 + h * 120) * DEG; // face roughly toward course

      const spec = this.createSpectator(scene, shadowGen, id, x, y, z, facing, cheering);
      this.spectators.push(spec);
    }
  }

  private createSpectator(
    scene: Scene,
    shadowGen: ShadowGenerator,
    id: number,
    x: number, y: number, z: number,
    facingY: number,
    cheering: boolean,
  ): Spectator {
    const root = new TransformNode(`spec_${id}`, scene);
    root.position.set(x, y, z);
    root.rotation.y = facingY;
    root.scaling.setAll(1.0);

    // Colors
    const jacketColor = JACKET_COLORS[id % JACKET_COLORS.length];
    const jacketMat = new StandardMaterial(`specJacket_${id}`, scene);
    jacketMat.diffuseColor = jacketColor;

    const pantsMat = new StandardMaterial(`specPants_${id}`, scene);
    pantsMat.diffuseColor = new Color3(0.12, 0.12, 0.15);

    const hatMat = new StandardMaterial(`specHat_${id}`, scene);
    const hh = hash(id * 31 + 7003);
    hatMat.diffuseColor = new Color3(0.2 + hh * 0.6, 0.15 + hh * 0.3, 0.1 + hh * 0.4);

    // Legs (standing)
    const leftLeg = CreateBox(`specLL_${id}`, { width: 0.12, height: 0.45, depth: 0.12 }, scene);
    leftLeg.material = pantsMat;
    leftLeg.position.set(-0.08, 0.22, 0);
    leftLeg.parent = root;

    const rightLeg = CreateBox(`specRL_${id}`, { width: 0.12, height: 0.45, depth: 0.12 }, scene);
    rightLeg.material = pantsMat;
    rightLeg.position.set(0.08, 0.22, 0);
    rightLeg.parent = root;

    // Torso
    const torso = CreateBox(`specT_${id}`, { width: 0.32, height: 0.4, depth: 0.18 }, scene);
    torso.material = jacketMat;
    torso.position.set(0, 0.65, 0);
    torso.parent = root;
    shadowGen.addShadowCaster(torso);

    // Head
    const head = CreateSphere(`specH_${id}`, { diameter: 0.26, segments: 10 }, scene);
    head.material = hatMat;
    head.position.set(0, 0.28, 0);
    head.parent = torso;

    // Arms
    const armMat = new StandardMaterial(`specArm_${id}`, scene);
    armMat.diffuseColor = jacketColor.scale(0.8);

    const leftArm = CreateBox(`specLA_${id}`, { width: 0.09, height: 0.32, depth: 0.09 }, scene);
    leftArm.material = armMat;
    leftArm.position.set(-0.22, 0.04, 0);
    leftArm.parent = torso;

    const rightArm = CreateBox(`specRA_${id}`, { width: 0.09, height: 0.32, depth: 0.09 }, scene);
    rightArm.material = armMat;
    rightArm.position.set(0.22, 0.04, 0);
    rightArm.parent = torso;

    return {
      root,
      leftArm,
      rightArm,
      cheering,
      phase: hash(id * 31 + 7004) * Math.PI * 2,
      waveSpeed: 3 + hash(id * 31 + 7005) * 4,
      shufflePhase: hash(id * 31 + 7006) * Math.PI * 2,
      baseY: facingY,
      baseRotY: facingY,
    };
  }

  update(dt: number): void {
    for (const s of this.spectators) {
      s.phase += s.waveSpeed * dt;
      s.shufflePhase += 0.3 * dt;

      if (s.cheering) {
        // Wave arms up and down
        const wave = Math.sin(s.phase);
        // Left arm waves high
        s.leftArm.position.y = 0.04 + wave * 0.12;
        s.leftArm.rotation.z = -30 * DEG + wave * 50 * DEG;
        // Right arm waves (offset phase)
        const wave2 = Math.sin(s.phase + 1.2);
        s.rightArm.position.y = 0.04 + wave2 * 0.12;
        s.rightArm.rotation.z = 30 * DEG - wave2 * 50 * DEG;

        // Slight body bob
        s.root.position.y = s.root.position.y + Math.sin(s.phase * 1.5) * 0.003;
      }

      // Idle shuffle — slight rotation wobble for everyone
      s.root.rotation.y = s.baseRotY + Math.sin(s.shufflePhase) * 8 * DEG;
    }
  }
}
