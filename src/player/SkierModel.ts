import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
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
  leftLeg: PartPose;
  rightLeg: PartPose;
  leftSki: PartPose;
  rightSki: PartPose;
}

const DEG = Math.PI / 180;
const LERP_SPEED = 8;

// --- Pose definitions ---

const NORMAL_POSE: Pose = {
  torso: {
    position: new Vector3(0, 0.42, 0),
    rotation: new Vector3(15 * DEG, 0, 0),
  },
  head: {
    position: new Vector3(0, 0.48, 0),
    rotation: new Vector3(-15 * DEG, 0, 0),
  },
  leftArm: {
    position: new Vector3(-0.23, 0.1, 0.05),
    rotation: new Vector3(10 * DEG, 0, -35 * DEG),
  },
  rightArm: {
    position: new Vector3(0.23, 0.1, 0.05),
    rotation: new Vector3(10 * DEG, 0, 35 * DEG),
  },
  leftLeg: {
    position: new Vector3(-0.1, 0.0, 0),
    rotation: new Vector3(10 * DEG, 0, 0),
  },
  rightLeg: {
    position: new Vector3(0.1, 0.0, 0),
    rotation: new Vector3(10 * DEG, 0, 0),
  },
  leftSki: {
    position: new Vector3(0, -0.21, 0.1),
    rotation: new Vector3(0, 0, 0),
  },
  rightSki: {
    position: new Vector3(0, -0.21, 0.1),
    rotation: new Vector3(0, 0, 0),
  },
};

const TUCK_POSE: Pose = {
  torso: {
    position: new Vector3(0, 0.28, 0),
    rotation: new Vector3(45 * DEG, 0, 0),
  },
  head: {
    position: new Vector3(0, 0.42, 0),
    rotation: new Vector3(-20 * DEG, 0, 0),
  },
  leftArm: {
    position: new Vector3(-0.12, 0.05, -0.10),
    rotation: new Vector3(120 * DEG, 0, -5 * DEG),
  },
  rightArm: {
    position: new Vector3(0.12, 0.05, -0.10),
    rotation: new Vector3(120 * DEG, 0, 5 * DEG),
  },
  leftLeg: {
    position: new Vector3(-0.1, 0.0, 0),
    rotation: new Vector3(30 * DEG, 0, 0),
  },
  rightLeg: {
    position: new Vector3(0.1, 0.0, 0),
    rotation: new Vector3(30 * DEG, 0, 0),
  },
  leftSki: {
    position: new Vector3(0, -0.21, 0.1),
    rotation: new Vector3(0, 0, 0),
  },
  rightSki: {
    position: new Vector3(0, -0.21, 0.1),
    rotation: new Vector3(0, 0, 0),
  },
};

// Hockey stop: both skis turn sideways in the same direction
const BRAKE_POSE: Pose = {
  torso: {
    position: new Vector3(0, 0.32, 0),
    rotation: new Vector3(12 * DEG, -20 * DEG, 5 * DEG),
  },
  head: {
    position: new Vector3(0, 0.48, 0),
    rotation: new Vector3(-5 * DEG, 10 * DEG, 0),
  },
  leftArm: {
    position: new Vector3(-0.25, 0.12, 0),
    rotation: new Vector3(5 * DEG, 0, -50 * DEG),
  },
  rightArm: {
    position: new Vector3(0.25, 0.12, 0),
    rotation: new Vector3(5 * DEG, 0, 50 * DEG),
  },
  leftLeg: {
    position: new Vector3(-0.12, 0.0, 0),
    rotation: new Vector3(20 * DEG, 55 * DEG, 0),
  },
  rightLeg: {
    position: new Vector3(0.12, 0.0, 0),
    rotation: new Vector3(20 * DEG, 55 * DEG, 0),
  },
  leftSki: {
    position: new Vector3(0, -0.21, 0.05),
    rotation: new Vector3(0, 5 * DEG, 0),
  },
  rightSki: {
    position: new Vector3(0, -0.21, 0.05),
    rotation: new Vector3(0, 5 * DEG, 0),
  },
};

const CROUCH_POSE: Pose = {
  torso: {
    position: new Vector3(0, 0.22, 0),
    rotation: new Vector3(50 * DEG, 0, 0),
  },
  head: {
    position: new Vector3(0, 0.40, 0),
    rotation: new Vector3(-25 * DEG, 0, 0),
  },
  leftArm: {
    position: new Vector3(-0.1, -0.02, 0.1),
    rotation: new Vector3(55 * DEG, 0, -5 * DEG),
  },
  rightArm: {
    position: new Vector3(0.1, -0.02, 0.1),
    rotation: new Vector3(55 * DEG, 0, 5 * DEG),
  },
  leftLeg: {
    position: new Vector3(-0.1, 0.0, 0),
    rotation: new Vector3(40 * DEG, 0, 0),
  },
  rightLeg: {
    position: new Vector3(0.1, 0.0, 0),
    rotation: new Vector3(40 * DEG, 0, 0),
  },
  leftSki: {
    position: new Vector3(0, -0.21, 0.1),
    rotation: new Vector3(0, 0, 0),
  },
  rightSki: {
    position: new Vector3(0, -0.21, 0.1),
    rotation: new Vector3(0, 0, 0),
  },
};

// Grab: tuck while airborne — reach forward to grab ski tips
const GRAB_POSE: Pose = {
  torso: {
    position: new Vector3(0, 0.30, 0),
    rotation: new Vector3(35 * DEG, 0, 0),
  },
  head: {
    position: new Vector3(0, 0.45, 0),
    rotation: new Vector3(-10 * DEG, 0, 0),
  },
  leftArm: {
    position: new Vector3(-0.15, -0.10, 0.20),
    rotation: new Vector3(60 * DEG, 0, -15 * DEG),
  },
  rightArm: {
    position: new Vector3(0.15, -0.10, 0.20),
    rotation: new Vector3(60 * DEG, 0, 15 * DEG),
  },
  leftLeg: {
    position: new Vector3(-0.08, 0.0, 0),
    rotation: new Vector3(-5 * DEG, 0, 0),
  },
  rightLeg: {
    position: new Vector3(0.08, 0.0, 0),
    rotation: new Vector3(-5 * DEG, 0, 0),
  },
  leftSki: {
    position: new Vector3(0, -0.21, 0.15),
    rotation: new Vector3(15 * DEG, 0, 0),
  },
  rightSki: {
    position: new Vector3(0, -0.21, 0.15),
    rotation: new Vector3(15 * DEG, 0, 0),
  },
};

const AIRBORNE_POSE: Pose = {
  torso: {
    position: new Vector3(0, 0.45, 0),
    rotation: new Vector3(-5 * DEG, 0, 0),
  },
  head: {
    position: new Vector3(0, 0.48, 0),
    rotation: new Vector3(5 * DEG, 0, 0),
  },
  leftArm: {
    position: new Vector3(-0.22, 0.15, 0.1),
    rotation: new Vector3(-20 * DEG, 0, -40 * DEG),
  },
  rightArm: {
    position: new Vector3(0.22, 0.15, 0.1),
    rotation: new Vector3(-20 * DEG, 0, 40 * DEG),
  },
  leftLeg: {
    position: new Vector3(-0.08, 0.0, 0),
    rotation: new Vector3(-5 * DEG, 0, 0),
  },
  rightLeg: {
    position: new Vector3(0.08, 0.0, 0),
    rotation: new Vector3(-5 * DEG, 0, 0),
  },
  leftSki: {
    position: new Vector3(0, -0.21, 0.15),
    rotation: new Vector3(0, 0, 0),
  },
  rightSki: {
    position: new Vector3(0, -0.21, 0.15),
    rotation: new Vector3(0, 0, 0),
  },
};

const STUMBLE_POSE: Pose = {
  torso: {
    position: new Vector3(0, 0.30, 0),
    rotation: new Vector3(60 * DEG, 0, 5 * DEG),
  },
  head: {
    position: new Vector3(0, 0.42, 0),
    rotation: new Vector3(-30 * DEG, 0, 0),
  },
  leftArm: {
    position: new Vector3(-0.28, 0.15, 0.1),
    rotation: new Vector3(-30 * DEG, 0, -60 * DEG),
  },
  rightArm: {
    position: new Vector3(0.28, 0.15, 0.1),
    rotation: new Vector3(-30 * DEG, 0, 60 * DEG),
  },
  leftLeg: {
    position: new Vector3(-0.12, 0.0, 0),
    rotation: new Vector3(25 * DEG, 0, -5 * DEG),
  },
  rightLeg: {
    position: new Vector3(0.12, 0.0, 0),
    rotation: new Vector3(35 * DEG, 0, 5 * DEG),
  },
  leftSki: {
    position: new Vector3(0, -0.21, 0.1),
    rotation: new Vector3(0, -10 * DEG, 0),
  },
  rightSki: {
    position: new Vector3(0, -0.21, 0.1),
    rotation: new Vector3(0, 15 * DEG, 0),
  },
};

const WIPEOUT_POSE: Pose = {
  torso: {
    position: new Vector3(0, 0.15, 0),
    rotation: new Vector3(80 * DEG, 10 * DEG, 15 * DEG),
  },
  head: {
    position: new Vector3(0, 0.35, 0),
    rotation: new Vector3(-40 * DEG, -10 * DEG, 0),
  },
  leftArm: {
    position: new Vector3(-0.30, 0.20, 0.05),
    rotation: new Vector3(-45 * DEG, 0, -80 * DEG),
  },
  rightArm: {
    position: new Vector3(0.30, 0.05, 0.15),
    rotation: new Vector3(20 * DEG, 0, 70 * DEG),
  },
  leftLeg: {
    position: new Vector3(-0.15, 0.0, 0),
    rotation: new Vector3(10 * DEG, -20 * DEG, -15 * DEG),
  },
  rightLeg: {
    position: new Vector3(0.15, 0.0, 0),
    rotation: new Vector3(5 * DEG, 25 * DEG, 10 * DEG),
  },
  leftSki: {
    position: new Vector3(0, -0.21, 0.1),
    rotation: new Vector3(10 * DEG, -30 * DEG, 15 * DEG),
  },
  rightSki: {
    position: new Vector3(0, -0.21, 0.1),
    rotation: new Vector3(-5 * DEG, 40 * DEG, -10 * DEG),
  },
};

// Double poling: recovery — arms raised high forward, body tall and upright
const POLE_UP_POSE: Pose = {
  torso: {
    position: new Vector3(0, 0.44, 0),
    rotation: new Vector3(8 * DEG, 0, 0),
  },
  head: {
    position: new Vector3(0, 0.48, 0),
    rotation: new Vector3(-8 * DEG, 0, 0),
  },
  leftArm: {
    position: new Vector3(-0.22, 0.22, 0.20),
    rotation: new Vector3(-50 * DEG, 0, -20 * DEG),
  },
  rightArm: {
    position: new Vector3(0.22, 0.22, 0.20),
    rotation: new Vector3(-50 * DEG, 0, 20 * DEG),
  },
  leftLeg: {
    position: new Vector3(-0.1, 0.0, 0),
    rotation: new Vector3(6 * DEG, 0, 0),
  },
  rightLeg: {
    position: new Vector3(0.1, 0.0, 0),
    rotation: new Vector3(6 * DEG, 0, 0),
  },
  leftSki: {
    position: new Vector3(0, -0.21, 0.1),
    rotation: new Vector3(0, 0, 0),
  },
  rightSki: {
    position: new Vector3(0, -0.21, 0.1),
    rotation: new Vector3(0, 0, 0),
  },
};

// Double poling: drive — deep crunch, arms swept far behind hips
const POLE_PUSH_POSE: Pose = {
  torso: {
    position: new Vector3(0, 0.20, 0),
    rotation: new Vector3(65 * DEG, 0, 0),
  },
  head: {
    position: new Vector3(0, 0.38, 0),
    rotation: new Vector3(-40 * DEG, 0, 0),
  },
  leftArm: {
    position: new Vector3(-0.16, -0.10, -0.15),
    rotation: new Vector3(65 * DEG, 0, -5 * DEG),
  },
  rightArm: {
    position: new Vector3(0.16, -0.10, -0.15),
    rotation: new Vector3(65 * DEG, 0, 5 * DEG),
  },
  leftLeg: {
    position: new Vector3(-0.1, 0.0, 0),
    rotation: new Vector3(28 * DEG, 0, 0),
  },
  rightLeg: {
    position: new Vector3(0.1, 0.0, 0),
    rotation: new Vector3(28 * DEG, 0, 0),
  },
  leftSki: {
    position: new Vector3(0, -0.21, 0.1),
    rotation: new Vector3(0, 0, 0),
  },
  rightSki: {
    position: new Vector3(0, -0.21, 0.1),
    rotation: new Vector3(0, 0, 0),
  },
};

// V-skate: weight on left ski, pushing off right — wide V, big lateral shift
const SKATE_LEFT_POSE: Pose = {
  torso: {
    position: new Vector3(-0.06, 0.25, 0),
    rotation: new Vector3(35 * DEG, 0, -14 * DEG),
  },
  head: {
    position: new Vector3(0, 0.42, 0),
    rotation: new Vector3(-22 * DEG, 0, 8 * DEG),
  },
  leftArm: {
    position: new Vector3(-0.20, 0.12, 0.12),
    rotation: new Vector3(-25 * DEG, 0, -25 * DEG),
  },
  rightArm: {
    position: new Vector3(0.20, 0.12, 0.12),
    rotation: new Vector3(-25 * DEG, 0, 25 * DEG),
  },
  leftLeg: {
    position: new Vector3(-0.16, 0.0, 0),
    rotation: new Vector3(28 * DEG, 0, -12 * DEG),
  },
  rightLeg: {
    position: new Vector3(0.18, 0.0, 0),
    rotation: new Vector3(3 * DEG, 0, 18 * DEG),
  },
  leftSki: {
    position: new Vector3(0, -0.21, 0.08),
    rotation: new Vector3(0, -35 * DEG, 0),
  },
  rightSki: {
    position: new Vector3(0, -0.19, 0.08),
    rotation: new Vector3(0, 35 * DEG, 5 * DEG),
  },
};

// V-skate: weight on right ski, pushing off left — mirror of above
const SKATE_RIGHT_POSE: Pose = {
  torso: {
    position: new Vector3(0.06, 0.25, 0),
    rotation: new Vector3(35 * DEG, 0, 14 * DEG),
  },
  head: {
    position: new Vector3(0, 0.42, 0),
    rotation: new Vector3(-22 * DEG, 0, -8 * DEG),
  },
  leftArm: {
    position: new Vector3(-0.20, -0.08, -0.08),
    rotation: new Vector3(50 * DEG, 0, -10 * DEG),
  },
  rightArm: {
    position: new Vector3(0.20, -0.08, -0.08),
    rotation: new Vector3(50 * DEG, 0, 10 * DEG),
  },
  leftLeg: {
    position: new Vector3(-0.18, 0.0, 0),
    rotation: new Vector3(3 * DEG, 0, -18 * DEG),
  },
  rightLeg: {
    position: new Vector3(0.16, 0.0, 0),
    rotation: new Vector3(28 * DEG, 0, 12 * DEG),
  },
  leftSki: {
    position: new Vector3(0, -0.19, 0.08),
    rotation: new Vector3(0, -35 * DEG, -5 * DEG),
  },
  rightSki: {
    position: new Vector3(0, -0.21, 0.08),
    rotation: new Vector3(0, 35 * DEG, 0),
  },
};

const GETTING_UP_POSE: Pose = {
  torso: {
    position: new Vector3(0, 0.25, 0),
    rotation: new Vector3(40 * DEG, 0, 8 * DEG),
  },
  head: {
    position: new Vector3(0, 0.44, 0),
    rotation: new Vector3(-20 * DEG, 0, 0),
  },
  leftArm: {
    position: new Vector3(-0.25, -0.05, 0.15),
    rotation: new Vector3(60 * DEG, 0, -20 * DEG),
  },
  rightArm: {
    position: new Vector3(0.25, 0.10, 0.05),
    rotation: new Vector3(10 * DEG, 0, 45 * DEG),
  },
  leftLeg: {
    position: new Vector3(-0.12, 0.0, 0),
    rotation: new Vector3(30 * DEG, 0, 0),
  },
  rightLeg: {
    position: new Vector3(0.12, 0.0, 0),
    rotation: new Vector3(20 * DEG, 0, 0),
  },
  leftSki: {
    position: new Vector3(0, -0.21, 0.1),
    rotation: new Vector3(0, -5 * DEG, 0),
  },
  rightSki: {
    position: new Vector3(0, -0.21, 0.1),
    rotation: new Vector3(0, 5 * DEG, 0),
  },
};

export class SkierModel {
  root: TransformNode;

  private torso: Mesh;
  private head: Mesh;
  private leftArm: Mesh;
  private rightArm: Mesh;
  private leftLeg: Mesh;
  private rightLeg: Mesh;
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

    // Legs
    this.leftLeg = CreateBox("leftLeg", { width: 0.12, height: 0.4, depth: 0.12 }, scene);
    this.leftLeg.material = pantsMat;
    this.leftLeg.parent = this.root;

    this.rightLeg = CreateBox("rightLeg", { width: 0.12, height: 0.4, depth: 0.12 }, scene);
    this.rightLeg.material = pantsMat;
    this.rightLeg.parent = this.root;

    // Skis
    this.leftSki = CreateBox("leftSki", { width: 0.08, height: 0.02, depth: 0.7 }, scene);
    this.leftSki.material = skiMat;
    this.leftSki.parent = this.leftLeg;

    this.rightSki = CreateBox("rightSki", { width: 0.08, height: 0.02, depth: 0.7 }, scene);
    this.rightSki.material = skiMat;
    this.rightSki.parent = this.rightLeg;

    // Ski poles — thin sticks extending downward from each arm
    const poleMat = this.makeMat("skierPole", new Color3(0.3, 0.3, 0.3), scene);
    this.leftPole = CreateBox("leftPole", { width: 0.025, height: 0.65, depth: 0.025 }, scene);
    this.leftPole.material = poleMat;
    this.leftPole.parent = this.leftArm;
    this.leftPole.position.set(0, -0.35, 0);

    this.rightPole = CreateBox("rightPole", { width: 0.025, height: 0.65, depth: 0.025 }, scene);
    this.rightPole.material = poleMat;
    this.rightPole.parent = this.rightArm;
    this.rightPole.position.set(0, -0.35, 0);

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
    this.applyPartPose(this.leftLeg, pose.leftLeg);
    this.applyPartPose(this.rightLeg, pose.rightLeg);
    this.applyPartPose(this.leftSki, pose.leftSki);
    this.applyPartPose(this.rightSki, pose.rightSki);
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

function lerpPartPose(current: PartPose, target: PartPose, t: number): void {
  Vector3.LerpToRef(current.position, target.position, t, current.position);
  Vector3.LerpToRef(current.rotation, target.rotation, t, current.rotation);
}

function lerpPoseInPlace(current: Pose, target: Pose, t: number): void {
  lerpPartPose(current.torso, target.torso, t);
  lerpPartPose(current.head, target.head, t);
  lerpPartPose(current.leftArm, target.leftArm, t);
  lerpPartPose(current.rightArm, target.rightArm, t);
  lerpPartPose(current.leftLeg, target.leftLeg, t);
  lerpPartPose(current.rightLeg, target.rightLeg, t);
  lerpPartPose(current.leftSki, target.leftSki, t);
  lerpPartPose(current.rightSki, target.rightSki, t);
}
