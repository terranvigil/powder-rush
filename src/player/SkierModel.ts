import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3, Matrix } from "@babylonjs/core/Maths/math.vector";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";

// Pose definitions: local position + rotation (Euler degrees) for each body part
interface PartPose {
  position: Vector3;
  rotation: Vector3; // Euler angles in radians
}

interface Pose {
  torso: PartPose;
  head: PartPose;
  leftArm: PartPose;
  rightArm: PartPose;
  leftThigh: PartPose;
  rightThigh: PartPose;
  leftShin: PartPose;
  rightShin: PartPose;
  leftSki: PartPose;
  rightSki: PartPose;
  leftPole?: PartPose;
  rightPole?: PartPose;
}

const DEG = Math.PI / 180;
const LERP_SPEED = 8;
// Pole origin = grip (top). Position = hand location relative to arm. Rotation.x = tilt from vertical.
const DEFAULT_POLE: PartPose = { position: new Vector3(0, -0.175, 0), rotation: new Vector3(0, 0, 0) };

// --- Pose definitions ---

// NOTE: In model local space (after LookDirectionLH), +Z is BACKWARD (away from heading).
// Torso: forward lean = NEGATIVE rotation.x, forward offset = NEGATIVE position.z
// Thigh: positive rotation.x = knees forward. Shin: counter-rotates to keep ski flat.
// Thigh/shin pivots are baked to joint tops (hip/knee), so rotation is anatomically correct.

// Helper: make a leg pair (thigh + shin). Shin counter-rotates to keep ski flat.
function leg(pos: Vector3, thighRx: number, extraShinRx = 0, thighRy = 0, thighRz = 0): { thigh: PartPose; shin: PartPose } {
  return {
    thigh: { position: pos, rotation: new Vector3(thighRx * DEG, thighRy * DEG, thighRz * DEG) },
    shin: { position: new Vector3(0, -0.20, 0), rotation: new Vector3((-thighRx + extraShinRx) * DEG, 0, 0) },
  };
}

const NORMAL_POSE: Pose = (() => {
  const l = leg(new Vector3(-0.1, 0, 0), 22);
  const r = leg(new Vector3(0.1, 0, 0), 22);
  return {
    torso: { position: new Vector3(0, 0.38, -0.06), rotation: new Vector3(-28 * DEG, 0, 0) },
    head: { position: new Vector3(0, 0.46, 0), rotation: new Vector3(22 * DEG, 0, 0) },
    leftArm: { position: new Vector3(-0.23, 0.1, 0.05), rotation: new Vector3(15 * DEG, 0, -35 * DEG) },
    rightArm: { position: new Vector3(0.23, 0.1, 0.05), rotation: new Vector3(15 * DEG, 0, 35 * DEG) },
    leftThigh: l.thigh, rightThigh: r.thigh, leftShin: l.shin, rightShin: r.shin,
    leftSki: { position: new Vector3(0, -0.20, 0.1), rotation: new Vector3(0, 0, 0) },
    rightSki: { position: new Vector3(0, -0.20, 0.1), rotation: new Vector3(0, 0, 0) },
    leftPole: { position: new Vector3(0, -0.175, 0), rotation: new Vector3(-42 * DEG, 0, 0) },
    rightPole: { position: new Vector3(0, -0.175, 0), rotation: new Vector3(-42 * DEG, 0, 0) },
  };
})();

const TUCK_POSE: Pose = (() => {
  const l = leg(new Vector3(-0.1, 0, 0), 45, -10);
  const r = leg(new Vector3(0.1, 0, 0), 45, -10);
  return {
    torso: { position: new Vector3(0, 0.22, -0.10), rotation: new Vector3(-65 * DEG, 0, 0) },
    head: { position: new Vector3(0, 0.38, 0), rotation: new Vector3(35 * DEG, 0, 0) },
    leftArm: { position: new Vector3(-0.10, 0.02, 0.05), rotation: new Vector3(100 * DEG, 0, -5 * DEG) },
    rightArm: { position: new Vector3(0.10, 0.02, 0.05), rotation: new Vector3(100 * DEG, 0, 5 * DEG) },
    leftThigh: l.thigh, rightThigh: r.thigh, leftShin: l.shin, rightShin: r.shin,
    leftSki: { position: new Vector3(0, -0.20, 0.1), rotation: new Vector3(0, 0, 0) },
    rightSki: { position: new Vector3(0, -0.20, 0.1), rotation: new Vector3(0, 0, 0) },
    leftPole: { position: new Vector3(0, -0.12, 0), rotation: new Vector3(-90 * DEG, 0, 5 * DEG) },
    rightPole: { position: new Vector3(0, -0.12, 0), rotation: new Vector3(-90 * DEG, 0, -5 * DEG) },
  };
})();

const BRAKE_POSE: Pose = (() => {
  const l = leg(new Vector3(-0.12, 0, 0), 28, 0, 55);
  const r = leg(new Vector3(0.12, 0, 0), 28, 0, 55);
  return {
    torso: { position: new Vector3(0, 0.30, -0.04), rotation: new Vector3(-24 * DEG, -20 * DEG, 5 * DEG) },
    head: { position: new Vector3(0, 0.46, 0), rotation: new Vector3(15 * DEG, 10 * DEG, 0) },
    leftArm: { position: new Vector3(-0.25, 0.12, 0.04), rotation: new Vector3(10 * DEG, 0, -50 * DEG) },
    rightArm: { position: new Vector3(0.25, 0.12, 0.04), rotation: new Vector3(10 * DEG, 0, 50 * DEG) },
    leftThigh: l.thigh, rightThigh: r.thigh, leftShin: l.shin, rightShin: r.shin,
    leftSki: { position: new Vector3(0, -0.20, 0.05), rotation: new Vector3(0, 5 * DEG, 0) },
    rightSki: { position: new Vector3(0, -0.20, 0.05), rotation: new Vector3(0, 5 * DEG, 0) },
    leftPole: { position: new Vector3(0, -0.175, 0), rotation: new Vector3(-28 * DEG, 0, -20 * DEG) },
    rightPole: { position: new Vector3(0, -0.175, 0), rotation: new Vector3(-28 * DEG, 0, 20 * DEG) },
  };
})();

const CROUCH_POSE: Pose = (() => {
  const l = leg(new Vector3(-0.1, 0, 0), 40, -8);
  const r = leg(new Vector3(0.1, 0, 0), 40, -8);
  return {
    torso: { position: new Vector3(0, 0.22, -0.05), rotation: new Vector3(-50 * DEG, 0, 0) },
    head: { position: new Vector3(0, 0.40, 0), rotation: new Vector3(25 * DEG, 0, 0) },
    leftArm: { position: new Vector3(-0.1, -0.02, 0.1), rotation: new Vector3(55 * DEG, 0, -5 * DEG) },
    rightArm: { position: new Vector3(0.1, -0.02, 0.1), rotation: new Vector3(55 * DEG, 0, 5 * DEG) },
    leftThigh: l.thigh, rightThigh: r.thigh, leftShin: l.shin, rightShin: r.shin,
    leftSki: { position: new Vector3(0, -0.20, 0.1), rotation: new Vector3(0, 0, 0) },
    rightSki: { position: new Vector3(0, -0.20, 0.1), rotation: new Vector3(0, 0, 0) },
    leftPole: { position: new Vector3(0, -0.175, 0), rotation: new Vector3(-50 * DEG, 0, 0) },
    rightPole: { position: new Vector3(0, -0.175, 0), rotation: new Vector3(-50 * DEG, 0, 0) },
  };
})();

const GRAB_POSE: Pose = (() => {
  const l = leg(new Vector3(-0.08, 0, 0), -5);
  const r = leg(new Vector3(0.08, 0, 0), -5);
  return {
    torso: { position: new Vector3(0, 0.30, -0.04), rotation: new Vector3(-35 * DEG, 0, 0) },
    head: { position: new Vector3(0, 0.45, 0), rotation: new Vector3(10 * DEG, 0, 0) },
    leftArm: { position: new Vector3(-0.15, -0.10, 0.20), rotation: new Vector3(60 * DEG, 0, -15 * DEG) },
    rightArm: { position: new Vector3(0.15, -0.10, 0.20), rotation: new Vector3(60 * DEG, 0, 15 * DEG) },
    leftThigh: l.thigh, rightThigh: r.thigh, leftShin: l.shin, rightShin: r.shin,
    leftSki: { position: new Vector3(0, -0.20, 0.15), rotation: new Vector3(-15 * DEG, 0, 0) },
    rightSki: { position: new Vector3(0, -0.20, 0.15), rotation: new Vector3(-15 * DEG, 0, 0) },
    leftPole: { position: new Vector3(0, -0.12, 0), rotation: new Vector3(-90 * DEG, 0, 0) },
    rightPole: { position: new Vector3(0, -0.12, 0), rotation: new Vector3(-90 * DEG, 0, 0) },
  };
})();

const AIRBORNE_POSE: Pose = (() => {
  const l = leg(new Vector3(-0.08, 0, 0), 8);
  const r = leg(new Vector3(0.08, 0, 0), 8);
  return {
    torso: { position: new Vector3(0, 0.40, -0.04), rotation: new Vector3(-15 * DEG, 0, 0) },
    head: { position: new Vector3(0, 0.48, 0), rotation: new Vector3(10 * DEG, 0, 0) },
    leftArm: { position: new Vector3(-0.22, 0.15, 0.1), rotation: new Vector3(-15 * DEG, 0, -40 * DEG) },
    rightArm: { position: new Vector3(0.22, 0.15, 0.1), rotation: new Vector3(-15 * DEG, 0, 40 * DEG) },
    leftThigh: l.thigh, rightThigh: r.thigh, leftShin: l.shin, rightShin: r.shin,
    leftSki: { position: new Vector3(0, -0.20, 0.15), rotation: new Vector3(0, 0, 0) },
    rightSki: { position: new Vector3(0, -0.20, 0.15), rotation: new Vector3(0, 0, 0) },
    leftPole: { position: new Vector3(0, -0.175, 0), rotation: new Vector3(-33 * DEG, 0, 0) },
    rightPole: { position: new Vector3(0, -0.175, 0), rotation: new Vector3(-33 * DEG, 0, 0) },
  };
})();

const STUMBLE_POSE: Pose = (() => {
  const l = leg(new Vector3(-0.12, 0, 0), 25, 0, 0, -5);
  const r = leg(new Vector3(0.12, 0, 0), 35, 0, 0, 5);
  return {
    torso: { position: new Vector3(0, 0.30, 0), rotation: new Vector3(-60 * DEG, 0, 5 * DEG) },
    head: { position: new Vector3(0, 0.42, 0), rotation: new Vector3(30 * DEG, 0, 0) },
    leftArm: { position: new Vector3(-0.28, 0.15, 0.1), rotation: new Vector3(-30 * DEG, 0, -60 * DEG) },
    rightArm: { position: new Vector3(0.28, 0.15, 0.1), rotation: new Vector3(-30 * DEG, 0, 60 * DEG) },
    leftThigh: l.thigh, rightThigh: r.thigh, leftShin: l.shin, rightShin: r.shin,
    leftSki: { position: new Vector3(0, -0.20, 0.1), rotation: new Vector3(0, -10 * DEG, 0) },
    rightSki: { position: new Vector3(0, -0.20, 0.1), rotation: new Vector3(0, 15 * DEG, 0) },
    leftPole: { position: new Vector3(0, -0.175, 0), rotation: new Vector3(25 * DEG, 15 * DEG, -30 * DEG) },
    rightPole: { position: new Vector3(0, -0.175, 0), rotation: new Vector3(-55 * DEG, -15 * DEG, 45 * DEG) },
  };
})();

const WIPEOUT_POSE: Pose = (() => {
  const l = leg(new Vector3(-0.15, 0, 0), 10, 0, -20, -15);
  const r = leg(new Vector3(0.15, 0, 0), 5, 0, 25, 10);
  return {
    torso: { position: new Vector3(0, 0.15, 0), rotation: new Vector3(-80 * DEG, 10 * DEG, 15 * DEG) },
    head: { position: new Vector3(0, 0.35, 0), rotation: new Vector3(40 * DEG, -10 * DEG, 0) },
    leftArm: { position: new Vector3(-0.30, 0.20, 0.05), rotation: new Vector3(-45 * DEG, 0, -80 * DEG) },
    rightArm: { position: new Vector3(0.30, 0.05, 0.15), rotation: new Vector3(20 * DEG, 0, 70 * DEG) },
    leftThigh: l.thigh, rightThigh: r.thigh, leftShin: l.shin, rightShin: r.shin,
    leftSki: { position: new Vector3(0, -0.20, 0.1), rotation: new Vector3(10 * DEG, -30 * DEG, 15 * DEG) },
    rightSki: { position: new Vector3(0, -0.20, 0.1), rotation: new Vector3(-5 * DEG, 40 * DEG, -10 * DEG) },
    leftPole: { position: new Vector3(0, -0.175, 0), rotation: new Vector3(35 * DEG, 25 * DEG, -50 * DEG) },
    rightPole: { position: new Vector3(0, -0.175, 0), rotation: new Vector3(-70 * DEG, -20 * DEG, 60 * DEG) },
  };
})();

const POLE_UP_POSE: Pose = (() => {
  const l = leg(new Vector3(-0.1, 0, 0), 18);
  const r = leg(new Vector3(0.1, 0, 0), 18);
  return {
    torso: { position: new Vector3(0, 0.40, -0.05), rotation: new Vector3(-20 * DEG, 0, 0) },
    head: { position: new Vector3(0, 0.48, 0), rotation: new Vector3(15 * DEG, 0, 0) },
    leftArm: { position: new Vector3(-0.22, 0.22, 0.20), rotation: new Vector3(-50 * DEG, 0, -20 * DEG) },
    rightArm: { position: new Vector3(0.22, 0.22, 0.20), rotation: new Vector3(-50 * DEG, 0, 20 * DEG) },
    leftThigh: l.thigh, rightThigh: r.thigh, leftShin: l.shin, rightShin: r.shin,
    leftSki: { position: new Vector3(0, -0.20, 0.1), rotation: new Vector3(0, 0, 0) },
    rightSki: { position: new Vector3(0, -0.20, 0.1), rotation: new Vector3(0, 0, 0) },
    leftPole: { position: new Vector3(0, -0.175, 0), rotation: new Vector3(35 * DEG, 0, 0) },
    rightPole: { position: new Vector3(0, -0.175, 0), rotation: new Vector3(35 * DEG, 0, 0) },
  };
})();

const POLE_PUSH_POSE: Pose = (() => {
  const l = leg(new Vector3(-0.1, 0, 0), 28);
  const r = leg(new Vector3(0.1, 0, 0), 28);
  return {
    torso: { position: new Vector3(0, 0.20, -0.08), rotation: new Vector3(-65 * DEG, 0, 0) },
    head: { position: new Vector3(0, 0.38, 0), rotation: new Vector3(40 * DEG, 0, 0) },
    leftArm: { position: new Vector3(-0.16, -0.10, -0.15), rotation: new Vector3(65 * DEG, 0, -5 * DEG) },
    rightArm: { position: new Vector3(0.16, -0.10, -0.15), rotation: new Vector3(65 * DEG, 0, 5 * DEG) },
    leftThigh: l.thigh, rightThigh: r.thigh, leftShin: l.shin, rightShin: r.shin,
    leftSki: { position: new Vector3(0, -0.20, 0.1), rotation: new Vector3(0, 0, 0) },
    rightSki: { position: new Vector3(0, -0.20, 0.1), rotation: new Vector3(0, 0, 0) },
    leftPole: { position: new Vector3(0, -0.175, 0), rotation: new Vector3(-75 * DEG, 0, 0) },
    rightPole: { position: new Vector3(0, -0.175, 0), rotation: new Vector3(-75 * DEG, 0, 0) },
  };
})();

const SKATE_LEFT_POSE: Pose = (() => {
  const l = leg(new Vector3(-0.16, 0, 0), 28, 0, 0, -12);
  const r = leg(new Vector3(0.18, 0, 0), 3, 0, 0, 18);
  return {
    torso: { position: new Vector3(-0.06, 0.25, -0.06), rotation: new Vector3(-35 * DEG, 0, -14 * DEG) },
    head: { position: new Vector3(0, 0.42, 0), rotation: new Vector3(22 * DEG, 0, 8 * DEG) },
    leftArm: { position: new Vector3(-0.20, 0.12, 0.12), rotation: new Vector3(-25 * DEG, 0, -25 * DEG) },
    rightArm: { position: new Vector3(0.20, 0.12, 0.12), rotation: new Vector3(-25 * DEG, 0, 25 * DEG) },
    leftThigh: l.thigh, rightThigh: r.thigh, leftShin: l.shin, rightShin: r.shin,
    leftSki: { position: new Vector3(0, -0.20, 0.08), rotation: new Vector3(0, -35 * DEG, 0) },
    rightSki: { position: new Vector3(0, -0.18, 0.08), rotation: new Vector3(0, 35 * DEG, 5 * DEG) },
    leftPole: { position: new Vector3(0, -0.175, 0), rotation: new Vector3(-12 * DEG, 0, -8 * DEG) },
    rightPole: { position: new Vector3(0, -0.175, 0), rotation: new Vector3(-12 * DEG, 0, 8 * DEG) },
  };
})();

const SKATE_RIGHT_POSE: Pose = (() => {
  const l = leg(new Vector3(-0.18, 0, 0), 3, 0, 0, -18);
  const r = leg(new Vector3(0.16, 0, 0), 28, 0, 0, 12);
  return {
    torso: { position: new Vector3(0.06, 0.25, -0.06), rotation: new Vector3(-35 * DEG, 0, 14 * DEG) },
    head: { position: new Vector3(0, 0.42, 0), rotation: new Vector3(22 * DEG, 0, -8 * DEG) },
    leftArm: { position: new Vector3(-0.20, -0.08, -0.08), rotation: new Vector3(50 * DEG, 0, -10 * DEG) },
    rightArm: { position: new Vector3(0.20, -0.08, -0.08), rotation: new Vector3(50 * DEG, 0, 10 * DEG) },
    leftThigh: l.thigh, rightThigh: r.thigh, leftShin: l.shin, rightShin: r.shin,
    leftSki: { position: new Vector3(0, -0.18, 0.08), rotation: new Vector3(0, -35 * DEG, -5 * DEG) },
    rightSki: { position: new Vector3(0, -0.20, 0.08), rotation: new Vector3(0, 35 * DEG, 0) },
    leftPole: { position: new Vector3(0, -0.175, 0), rotation: new Vector3(-50 * DEG, 0, -8 * DEG) },
    rightPole: { position: new Vector3(0, -0.175, 0), rotation: new Vector3(-50 * DEG, 0, 8 * DEG) },
  };
})();

const GETTING_UP_POSE: Pose = (() => {
  const l = leg(new Vector3(-0.12, 0, 0), 30);
  const r = leg(new Vector3(0.12, 0, 0), 20);
  return {
    torso: { position: new Vector3(0, 0.25, 0), rotation: new Vector3(-40 * DEG, 0, 8 * DEG) },
    head: { position: new Vector3(0, 0.44, 0), rotation: new Vector3(20 * DEG, 0, 0) },
    leftArm: { position: new Vector3(-0.25, -0.05, 0.15), rotation: new Vector3(60 * DEG, 0, -20 * DEG) },
    rightArm: { position: new Vector3(0.25, 0.10, 0.05), rotation: new Vector3(10 * DEG, 0, 45 * DEG) },
    leftThigh: l.thigh, rightThigh: r.thigh, leftShin: l.shin, rightShin: r.shin,
    leftSki: { position: new Vector3(0, -0.20, 0.1), rotation: new Vector3(0, -5 * DEG, 0) },
    rightSki: { position: new Vector3(0, -0.20, 0.1), rotation: new Vector3(0, 5 * DEG, 0) },
    leftPole: { position: new Vector3(0, -0.175, 0), rotation: new Vector3(55 * DEG, 0, -15 * DEG) },
    rightPole: { position: new Vector3(0, -0.175, 0), rotation: new Vector3(35 * DEG, 0, 20 * DEG) },
  };
})();

export class SkierModel {
  root: TransformNode;

  private torso: Mesh;
  private head: Mesh;
  private leftArm: Mesh;
  private rightArm: Mesh;
  private leftThigh: Mesh;
  private rightThigh: Mesh;
  private leftShin: Mesh;
  private rightShin: Mesh;
  private leftSki: Mesh;
  private rightSki: Mesh;
  private leftPole: Mesh;
  private rightPole: Mesh;

  // Current interpolated poses (position + rotation per part)
  private currentPose: Pose;
  private targetPose: Pose;

  // Cyclic animation for poling/skating
  private cycleTimer = 0;
  private cycleMode: "none" | "poling" | "skating" = "none";

  constructor(scene: Scene) {
    this.root = new TransformNode("skierRoot", scene);
    this.root.scaling = new Vector3(0.8, 0.8, 0.8);

    // Shared materials — orange-red ski jacket, dark orange accents
    const jacketMat = this.makeMat("skierJacket", new Color3(0.92, 0.35, 0.08), scene);
    const jacketDarkMat = this.makeMat("skierJacketDark", new Color3(0.85, 0.22, 0.05), scene);
    const helmetMat = this.makeMat("skierHelmet", new Color3(0.9, 0.3, 0.07), scene);
    const pantsMat = this.makeMat("skierPants", new Color3(0.15, 0.15, 0.35), scene);
    const skiMat = this.makeMat("skierSki", new Color3(0.25, 0.25, 0.25), scene);

    // Torso
    this.torso = CreateBox("torso", { width: 0.35, height: 0.45, depth: 0.2 }, scene);
    this.torso.material = jacketMat;
    this.torso.parent = this.root;

    // Head — large round helmet, clearly visible above torso
    this.head = CreateSphere("head", { diameter: 0.32, segments: 14 }, scene);
    this.head.material = helmetMat;
    this.head.parent = this.torso;

    // Arms
    this.leftArm = CreateBox("leftArm", { width: 0.1, height: 0.35, depth: 0.1 }, scene);
    this.leftArm.material = jacketDarkMat;
    this.leftArm.parent = this.torso;

    this.rightArm = CreateBox("rightArm", { width: 0.1, height: 0.35, depth: 0.1 }, scene);
    this.rightArm.material = jacketDarkMat;
    this.rightArm.parent = this.torso;

    // Legs: split into thigh + shin with knee joint
    // Bake pivot to top of each segment so rotation happens at hip/knee joint
    const thighShift = Matrix.Translation(0, -0.10, 0); // pivot at hip (top)
    const shinShift = Matrix.Translation(0, -0.10, 0);  // pivot at knee (top)

    this.leftThigh = CreateBox("leftThigh", { width: 0.12, height: 0.20, depth: 0.12 }, scene);
    this.leftThigh.material = pantsMat;
    this.leftThigh.bakeTransformIntoVertices(thighShift);
    this.leftThigh.parent = this.root;

    this.rightThigh = CreateBox("rightThigh", { width: 0.12, height: 0.20, depth: 0.12 }, scene);
    this.rightThigh.material = pantsMat;
    this.rightThigh.bakeTransformIntoVertices(thighShift);
    this.rightThigh.parent = this.root;

    this.leftShin = CreateBox("leftShin", { width: 0.10, height: 0.20, depth: 0.10 }, scene);
    this.leftShin.material = pantsMat;
    this.leftShin.bakeTransformIntoVertices(shinShift);
    this.leftShin.parent = this.leftThigh;

    this.rightShin = CreateBox("rightShin", { width: 0.10, height: 0.20, depth: 0.10 }, scene);
    this.rightShin.material = pantsMat;
    this.rightShin.bakeTransformIntoVertices(shinShift);
    this.rightShin.parent = this.rightThigh;

    // Skis — parented to shins (at ankle)
    this.leftSki = CreateBox("leftSki", { width: 0.08, height: 0.02, depth: 0.7 }, scene);
    this.leftSki.material = skiMat;
    this.leftSki.parent = this.leftShin;

    this.rightSki = CreateBox("rightSki", { width: 0.08, height: 0.02, depth: 0.7 }, scene);
    this.rightSki.material = skiMat;
    this.rightSki.parent = this.rightShin;

    // Ski poles — thin sticks extending downward from each arm
    // Origin baked to grip (top of pole) so rotations pivot naturally from the hand
    const poleMat = this.makeMat("skierPole", new Color3(0.3, 0.3, 0.3), scene);
    const poleShift = Matrix.Translation(0, -0.325, 0); // shift verts so origin = top

    this.leftPole = CreateBox("leftPole", { width: 0.025, height: 0.65, depth: 0.025 }, scene);
    this.leftPole.material = poleMat;
    this.leftPole.bakeTransformIntoVertices(poleShift);
    this.leftPole.parent = this.leftArm;

    this.rightPole = CreateBox("rightPole", { width: 0.025, height: 0.65, depth: 0.025 }, scene);
    this.rightPole.material = poleMat;
    this.rightPole.bakeTransformIntoVertices(poleShift);
    this.rightPole.parent = this.rightArm;

    // Initialize poses
    this.currentPose = clonePose(NORMAL_POSE);
    this.targetPose = clonePose(NORMAL_POSE);
    this.applyPose(this.currentPose);
  }

  setState(
    tuck: boolean, brake: boolean, crouch: boolean, airborne: boolean, _lean: number,
    stumble = false, wipeout = false, gettingUp = false,
    poling = false, skating = false,
  ): void {
    // Priority: collision states > airborne > crouch > brake > skating > poling > tuck > normal
    if (wipeout) {
      this.cycleMode = "none";
      this.targetPose = WIPEOUT_POSE;
    } else if (gettingUp) {
      this.cycleMode = "none";
      this.targetPose = GETTING_UP_POSE;
    } else if (stumble) {
      this.cycleMode = "none";
      this.targetPose = STUMBLE_POSE;
    } else if (airborne && tuck) {
      this.cycleMode = "none";
      this.targetPose = GRAB_POSE;
    } else if (airborne) {
      this.cycleMode = "none";
      this.targetPose = AIRBORNE_POSE;
    } else if (crouch) {
      this.cycleMode = "none";
      this.targetPose = CROUCH_POSE;
    } else if (brake) {
      this.cycleMode = "none";
      this.targetPose = BRAKE_POSE;
    } else if (skating) {
      if (this.cycleMode !== "skating") {
        this.cycleTimer = 0;
      }
      this.cycleMode = "skating";
      // targetPose set by cycle in update()
    } else if (poling) {
      if (this.cycleMode !== "poling") {
        this.cycleTimer = 0;
      }
      this.cycleMode = "poling";
      // targetPose set by cycle in update()
    } else if (tuck) {
      this.cycleMode = "none";
      this.targetPose = TUCK_POSE;
    } else {
      this.cycleMode = "none";
      this.targetPose = NORMAL_POSE;
    }
  }

  update(dt: number): void {
    // Cycle animation for poling/skating — alternate target pose on a timer
    if (this.cycleMode !== "none") {
      this.cycleTimer += dt;
      // Skating: fast waddle (~0.35s per side), Poling: punchy stroke (~0.48s per phase)
      const halfPeriod = this.cycleMode === "skating" ? 0.35 : 0.48;
      const phase = Math.floor(this.cycleTimer / halfPeriod) % 2;
      if (this.cycleMode === "skating") {
        this.targetPose = phase === 0 ? SKATE_LEFT_POSE : SKATE_RIGHT_POSE;
      } else {
        this.targetPose = phase === 0 ? POLE_UP_POSE : POLE_PUSH_POSE;
      }
    }

    const t = Math.min(1, LERP_SPEED * dt);
    lerpPoseInPlace(this.currentPose, this.targetPose, t);
    this.applyPose(this.currentPose);
  }

  dispose(): void {
    this.root.dispose(false, true);
  }

  private applyPose(pose: Pose): void {
    this.applyPartPose(this.torso, pose.torso);
    this.applyPartPose(this.head, pose.head);
    this.applyPartPose(this.leftArm, pose.leftArm);
    this.applyPartPose(this.rightArm, pose.rightArm);
    this.applyPartPose(this.leftThigh, pose.leftThigh);
    this.applyPartPose(this.rightThigh, pose.rightThigh);
    this.applyPartPose(this.leftShin, pose.leftShin);
    this.applyPartPose(this.rightShin, pose.rightShin);
    this.applyPartPose(this.leftSki, pose.leftSki);
    this.applyPartPose(this.rightSki, pose.rightSki);
    if (pose.leftPole) this.applyPartPose(this.leftPole, pose.leftPole);
    if (pose.rightPole) this.applyPartPose(this.rightPole, pose.rightPole);
  }

  private applyPartPose(mesh: Mesh, partPose: PartPose): void {
    mesh.position.copyFrom(partPose.position);
    mesh.rotation.copyFrom(partPose.rotation);
  }

  private makeMat(name: string, color: Color3, scene: Scene): StandardMaterial {
    const mat = new StandardMaterial(name, scene);
    mat.diffuseColor = color;
    return mat;
  }
}

function clonePose(pose: Pose): Pose {
  const lp = pose.leftPole ?? DEFAULT_POLE;
  const rp = pose.rightPole ?? DEFAULT_POLE;
  return {
    torso: { position: pose.torso.position.clone(), rotation: pose.torso.rotation.clone() },
    head: { position: pose.head.position.clone(), rotation: pose.head.rotation.clone() },
    leftArm: { position: pose.leftArm.position.clone(), rotation: pose.leftArm.rotation.clone() },
    rightArm: { position: pose.rightArm.position.clone(), rotation: pose.rightArm.rotation.clone() },
    leftThigh: { position: pose.leftThigh.position.clone(), rotation: pose.leftThigh.rotation.clone() },
    rightThigh: { position: pose.rightThigh.position.clone(), rotation: pose.rightThigh.rotation.clone() },
    leftShin: { position: pose.leftShin.position.clone(), rotation: pose.leftShin.rotation.clone() },
    rightShin: { position: pose.rightShin.position.clone(), rotation: pose.rightShin.rotation.clone() },
    leftSki: { position: pose.leftSki.position.clone(), rotation: pose.leftSki.rotation.clone() },
    rightSki: { position: pose.rightSki.position.clone(), rotation: pose.rightSki.rotation.clone() },
    leftPole: { position: lp.position.clone(), rotation: lp.rotation.clone() },
    rightPole: { position: rp.position.clone(), rotation: rp.rotation.clone() },
  };
}

function lerpPartPose(current: PartPose, target: PartPose, t: number): void {
  Vector3.LerpToRef(current.position, target.position, t, current.position);
  Vector3.LerpToRef(current.rotation, target.rotation, t, current.rotation);
}

function lerpPoseInPlace(current: Pose, target: Pose, t: number): void {
  lerpPartPose(current.torso, target.torso, t);
  lerpPartPose(current.head, target.head, t);
  lerpPartPose(current.leftArm, target.leftArm, t);
  lerpPartPose(current.rightArm, target.rightArm, t);
  lerpPartPose(current.leftThigh, target.leftThigh, t);
  lerpPartPose(current.rightThigh, target.rightThigh, t);
  lerpPartPose(current.leftShin, target.leftShin, t);
  lerpPartPose(current.rightShin, target.rightShin, t);
  lerpPartPose(current.leftSki, target.leftSki, t);
  lerpPartPose(current.rightSki, target.rightSki, t);
  if (current.leftPole && target.leftPole) lerpPartPose(current.leftPole, target.leftPole, t);
  if (current.rightPole && target.rightPole) lerpPartPose(current.rightPole, target.rightPole, t);
}
