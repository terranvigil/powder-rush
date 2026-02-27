import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { hash } from "../terrain/Noise";

interface PartPose {
  position: Vector3;
  rotation: Vector3;
}

interface Pose {
  torso: PartPose;
  head: PartPose;
  leftArm: PartPose;
  rightArm: PartPose;
  leftLeg: PartPose;
  rightLeg: PartPose;
  leftSki: PartPose;
  rightSki: PartPose;
}

const DEG = Math.PI / 180;
const LERP_SPEED = 6;

const NPC_NORMAL_POSE: Pose = {
  torso: { position: new Vector3(0, 0.42, 0), rotation: new Vector3(15 * DEG, 0, 0) },
  head: { position: new Vector3(0, 0.48, 0), rotation: new Vector3(-15 * DEG, 0, 0) },
  leftArm: { position: new Vector3(-0.23, 0.1, 0.05), rotation: new Vector3(10 * DEG, 0, -35 * DEG) },
  rightArm: { position: new Vector3(0.23, 0.1, 0.05), rotation: new Vector3(10 * DEG, 0, 35 * DEG) },
  leftLeg: { position: new Vector3(-0.1, 0.0, 0), rotation: new Vector3(10 * DEG, 0, 0) },
  rightLeg: { position: new Vector3(0.1, 0.0, 0), rotation: new Vector3(10 * DEG, 0, 0) },
  leftSki: { position: new Vector3(0, -0.21, 0.1), rotation: new Vector3(0, 0, 0) },
  rightSki: { position: new Vector3(0, -0.21, 0.1), rotation: new Vector3(0, 0, 0) },
};

const NPC_TUCK_POSE: Pose = {
  torso: { position: new Vector3(0, 0.28, 0), rotation: new Vector3(45 * DEG, 0, 0) },
  head: { position: new Vector3(0, 0.42, 0), rotation: new Vector3(-20 * DEG, 0, 0) },
  leftArm: { position: new Vector3(-0.12, 0.0, 0.15), rotation: new Vector3(50 * DEG, 0, -10 * DEG) },
  rightArm: { position: new Vector3(0.12, 0.0, 0.15), rotation: new Vector3(50 * DEG, 0, 10 * DEG) },
  leftLeg: { position: new Vector3(-0.1, 0.0, 0), rotation: new Vector3(30 * DEG, 0, 0) },
  rightLeg: { position: new Vector3(0.1, 0.0, 0), rotation: new Vector3(30 * DEG, 0, 0) },
  leftSki: { position: new Vector3(0, -0.21, 0.1), rotation: new Vector3(0, 0, 0) },
  rightSki: { position: new Vector3(0, -0.21, 0.1), rotation: new Vector3(0, 0, 0) },
};

export class NPCSkierModel {
  root: TransformNode;

  private torso: Mesh;
  private head: Mesh;
  private leftArm: Mesh;
  private rightArm: Mesh;
  private leftLeg: Mesh;
  private rightLeg: Mesh;
  private leftSki: Mesh;
  private rightSki: Mesh;

  private currentPose: Pose;
  private targetPose: Pose;

  constructor(scene: Scene, id: number) {
    this.root = new TransformNode(`npcSkier_${id}`, scene);
    this.root.scaling = new Vector3(0.8, 0.8, 0.8);

    // Per-NPC color variation via hash
    const hue = hash(id * 17 + 4000);
    const jacketR = 0.1 + hue * 0.2;
    const jacketG = 0.2 + hue * 0.3;
    const jacketB = 0.6 + hue * 0.3;
    const jacketMat = this.makeMat(`npcJacket_${id}`, new Color3(jacketR, jacketG, jacketB), scene);
    const jacketDarkMat = this.makeMat(`npcJacketDark_${id}`, new Color3(jacketR * 0.7, jacketG * 0.7, jacketB * 0.7), scene);
    const helmetMat = this.makeMat(`npcHelmet_${id}`, new Color3(jacketR * 0.9, jacketG * 0.9, jacketB * 0.9), scene);
    const pantsMat = this.makeMat(`npcPants_${id}`, new Color3(0.1, 0.1, 0.12), scene);
    const skiMat = this.makeMat(`npcSki_${id}`, new Color3(0.2, 0.2, 0.2), scene);

    this.torso = CreateBox(`npcTorso_${id}`, { width: 0.35, height: 0.45, depth: 0.2 }, scene);
    this.torso.material = jacketMat;
    this.torso.parent = this.root;

    this.head = CreateSphere(`npcHead_${id}`, { diameter: 0.32, segments: 14 }, scene);
    this.head.material = helmetMat;
    this.head.parent = this.torso;

    this.leftArm = CreateBox(`npcLArm_${id}`, { width: 0.1, height: 0.35, depth: 0.1 }, scene);
    this.leftArm.material = jacketDarkMat;
    this.leftArm.parent = this.torso;

    this.rightArm = CreateBox(`npcRArm_${id}`, { width: 0.1, height: 0.35, depth: 0.1 }, scene);
    this.rightArm.material = jacketDarkMat;
    this.rightArm.parent = this.torso;

    this.leftLeg = CreateBox(`npcLLeg_${id}`, { width: 0.12, height: 0.4, depth: 0.12 }, scene);
    this.leftLeg.material = pantsMat;
    this.leftLeg.parent = this.root;

    this.rightLeg = CreateBox(`npcRLeg_${id}`, { width: 0.12, height: 0.4, depth: 0.12 }, scene);
    this.rightLeg.material = pantsMat;
    this.rightLeg.parent = this.root;

    this.leftSki = CreateBox(`npcLSki_${id}`, { width: 0.08, height: 0.02, depth: 0.7 }, scene);
    this.leftSki.material = skiMat;
    this.leftSki.parent = this.leftLeg;

    this.rightSki = CreateBox(`npcRSki_${id}`, { width: 0.08, height: 0.02, depth: 0.7 }, scene);
    this.rightSki.material = skiMat;
    this.rightSki.parent = this.rightLeg;

    this.currentPose = clonePose(NPC_NORMAL_POSE);
    this.targetPose = clonePose(NPC_NORMAL_POSE);
    this.applyPose(this.currentPose);
  }

  setTucking(tuck: boolean): void {
    this.targetPose = tuck ? NPC_TUCK_POSE : NPC_NORMAL_POSE;
  }

  update(dt: number): void {
    const t = Math.min(1, LERP_SPEED * dt);
    lerpPoseInPlace(this.currentPose, this.targetPose, t);
    this.applyPose(this.currentPose);
  }

  dispose(): void {
    this.root.dispose(false, true);
  }

  private applyPose(pose: Pose): void {
    applyPart(this.torso, pose.torso);
    applyPart(this.head, pose.head);
    applyPart(this.leftArm, pose.leftArm);
    applyPart(this.rightArm, pose.rightArm);
    applyPart(this.leftLeg, pose.leftLeg);
    applyPart(this.rightLeg, pose.rightLeg);
    applyPart(this.leftSki, pose.leftSki);
    applyPart(this.rightSki, pose.rightSki);
  }

  private makeMat(name: string, color: Color3, scene: Scene): StandardMaterial {
    const mat = new StandardMaterial(name, scene);
    mat.diffuseColor = color;
    return mat;
  }
}

function applyPart(mesh: Mesh, partPose: PartPose): void {
  mesh.position.copyFrom(partPose.position);
  mesh.rotation.copyFrom(partPose.rotation);
}

function clonePose(pose: Pose): Pose {
  return {
    torso: { position: pose.torso.position.clone(), rotation: pose.torso.rotation.clone() },
    head: { position: pose.head.position.clone(), rotation: pose.head.rotation.clone() },
    leftArm: { position: pose.leftArm.position.clone(), rotation: pose.leftArm.rotation.clone() },
    rightArm: { position: pose.rightArm.position.clone(), rotation: pose.rightArm.rotation.clone() },
    leftLeg: { position: pose.leftLeg.position.clone(), rotation: pose.leftLeg.rotation.clone() },
    rightLeg: { position: pose.rightLeg.position.clone(), rotation: pose.rightLeg.rotation.clone() },
    leftSki: { position: pose.leftSki.position.clone(), rotation: pose.leftSki.rotation.clone() },
    rightSki: { position: pose.rightSki.position.clone(), rotation: pose.rightSki.rotation.clone() },
  };
}

function lerpPoseInPlace(current: Pose, target: Pose, t: number): void {
  for (const key of ["torso", "head", "leftArm", "rightArm", "leftLeg", "rightLeg", "leftSki", "rightSki"] as const) {
    Vector3.LerpToRef(current[key].position, target[key].position, t, current[key].position);
    Vector3.LerpToRef(current[key].rotation, target[key].rotation, t, current[key].rotation);
  }
}
