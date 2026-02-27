import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";

// Shared materials (created once)
let bunnyMat: StandardMaterial | null = null;
let deerBodyMat: StandardMaterial | null = null;
let deerLegMat: StandardMaterial | null = null;
let antlerMat: StandardMaterial | null = null;

function ensureMaterials(scene: Scene): void {
  if (bunnyMat) return;

  bunnyMat = new StandardMaterial("bunnyMat", scene);
  bunnyMat.diffuseColor = new Color3(0.9, 0.88, 0.85);

  deerBodyMat = new StandardMaterial("deerBodyMat", scene);
  deerBodyMat.diffuseColor = new Color3(0.55, 0.38, 0.22);

  deerLegMat = new StandardMaterial("deerLegMat", scene);
  deerLegMat.diffuseColor = new Color3(0.45, 0.30, 0.18);

  antlerMat = new StandardMaterial("antlerMat", scene);
  antlerMat.diffuseColor = new Color3(0.6, 0.5, 0.35);
}

export class WildlifeModel {
  root: TransformNode;
  readonly isBunny: boolean;
  private parts: Mesh[] = [];
  private animTime = 0;
  private fleeing = false;
  private fleeDir = Vector3.Zero();

  constructor(scene: Scene, isBunny: boolean, id: number) {
    ensureMaterials(scene);
    this.isBunny = isBunny;
    this.root = new TransformNode(`wildlife_${id}`, scene);

    if (isBunny) {
      this.buildBunny(scene, id);
    } else {
      this.buildDeer(scene, id);
    }
  }

  private buildBunny(scene: Scene, id: number): void {
    // Body ellipsoid
    const body = CreateSphere(`bunny_body_${id}`, {
      segments: 10, diameterX: 0.25, diameterY: 0.18, diameterZ: 0.35
    }, scene);
    body.position = new Vector3(0, 0.12, 0);
    body.parent = this.root;
    body.material = bunnyMat!;
    this.parts.push(body);

    // Head
    const head = CreateSphere(`bunny_head_${id}`, { diameter: 0.14, segments: 8 }, scene);
    head.position = new Vector3(0, 0.18, -0.15);
    head.parent = this.root;
    head.material = bunnyMat!;
    this.parts.push(head);

    // Ears
    for (const side of [-1, 1]) {
      const ear = CreateBox(`bunny_ear_${id}_${side}`, {
        width: 0.03, height: 0.12, depth: 0.04
      }, scene);
      ear.position = new Vector3(side * 0.04, 0.30, -0.14);
      ear.rotation.z = side * 0.15;
      ear.parent = this.root;
      ear.material = bunnyMat!;
      this.parts.push(ear);
    }

    // Tail
    const tail = CreateSphere(`bunny_tail_${id}`, { diameter: 0.06, segments: 6 }, scene);
    tail.position = new Vector3(0, 0.12, 0.18);
    tail.parent = this.root;
    tail.material = bunnyMat!;
    this.parts.push(tail);
  }

  private buildDeer(scene: Scene, id: number): void {
    // Body
    const body = CreateBox(`deer_body_${id}`, {
      width: 0.3, height: 0.35, depth: 0.7
    }, scene);
    body.position = new Vector3(0, 0.55, 0);
    body.parent = this.root;
    body.material = deerBodyMat!;
    this.parts.push(body);

    // Head
    const head = CreateBox(`deer_head_${id}`, {
      width: 0.15, height: 0.18, depth: 0.22
    }, scene);
    head.position = new Vector3(0, 0.75, -0.35);
    head.rotation.x = -0.2;
    head.parent = this.root;
    head.material = deerBodyMat!;
    this.parts.push(head);

    // Legs (4)
    const legPositions = [
      new Vector3(-0.1, 0.2, -0.22),
      new Vector3(0.1, 0.2, -0.22),
      new Vector3(-0.1, 0.2, 0.22),
      new Vector3(0.1, 0.2, 0.22),
    ];
    for (let i = 0; i < 4; i++) {
      const leg = CreateBox(`deer_leg_${id}_${i}`, {
        width: 0.06, height: 0.4, depth: 0.06
      }, scene);
      leg.position = legPositions[i];
      leg.parent = this.root;
      leg.material = deerLegMat!;
      this.parts.push(leg);
    }

    // Antlers
    for (const side of [-1, 1]) {
      const antler = CreateBox(`deer_antler_${id}_${side}`, {
        width: 0.03, height: 0.2, depth: 0.03
      }, scene);
      antler.position = new Vector3(side * 0.08, 0.88, -0.32);
      antler.rotation.z = side * 0.3;
      antler.parent = this.root;
      antler.material = antlerMat!;
      this.parts.push(antler);
    }
  }

  setFleeing(direction: Vector3): void {
    this.fleeing = true;
    this.fleeDir = direction.normalize();
  }

  update(dt: number): void {
    this.animTime += dt;

    if (this.isBunny) {
      // Hop animation
      const hopSpeed = this.fleeing ? 8 : 2;
      const hopHeight = this.fleeing ? 0.08 : 0.03;
      const hop = Math.abs(Math.sin(this.animTime * hopSpeed)) * hopHeight;
      this.root.position.y += hop;
    } else {
      // Deer weight shift
      const shiftSpeed = this.fleeing ? 6 : 1.5;
      const shiftAmount = this.fleeing ? 0.02 : 0.01;
      this.root.position.x += Math.sin(this.animTime * shiftSpeed) * shiftAmount;
    }
  }

  dispose(): void {
    this.root.dispose(false, true);
  }
}
