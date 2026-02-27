import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";

const MAX_POINTS = 300;
const MIN_DISTANCE = 0.25;
const BASE_HALF_WIDTH = 0.035;
const CARVE_HALF_WIDTH = 0.12;
const BRAKE_HALF_WIDTH = 0.18;
const TERRAIN_OFFSET = 0.03;
const SKI_SEPARATION = 0.28;

interface TrailPoint {
  center: Vector3;
  right: Vector3;
  halfWidth: number;
}

class SkiTrackMesh {
  private points: TrailPoint[] = [];
  private mesh: Mesh;

  constructor(name: string, scene: Scene, material: StandardMaterial) {
    this.mesh = new Mesh(name, scene);
    this.mesh.material = material;
    this.mesh.hasVertexAlpha = true;
  }

  addPoint(center: Vector3, right: Vector3, halfWidth: number): void {
    if (this.points.length > 0) {
      const last = this.points[this.points.length - 1];
      if (Vector3.Distance(last.center, center) < MIN_DISTANCE) return;
    }

    this.points.push({
      center: center.clone(),
      right: right.clone(),
      halfWidth,
    });

    if (this.points.length > MAX_POINTS) {
      this.points.shift();
    }

    this.rebuild();
  }

  private rebuild(): void {
    const count = this.points.length;
    if (count < 2) return;

    const positions: number[] = [];
    const normals: number[] = [];
    const indices: number[] = [];
    const colors: number[] = [];

    for (let i = 0; i < count; i++) {
      const p = this.points[i];
      const t = i / (count - 1); // 0=oldest, 1=newest

      const left = p.center.subtract(p.right.scale(p.halfWidth));
      const right = p.center.add(p.right.scale(p.halfWidth));

      positions.push(left.x, left.y, left.z);
      positions.push(right.x, right.y, right.z);

      // Normals pointing up
      normals.push(0, 1, 0);
      normals.push(0, 1, 0);

      // Fade: oldest transparent, newest opaque
      const alpha = t * 0.5;
      colors.push(0.82, 0.86, 0.94, alpha);
      colors.push(0.82, 0.86, 0.94, alpha);

      if (i > 0) {
        const base = (i - 1) * 2;
        indices.push(base, base + 2, base + 3);
        indices.push(base, base + 3, base + 1);
      }
    }

    const vd = new VertexData();
    vd.positions = positions;
    vd.normals = normals;
    vd.indices = indices;
    vd.colors = colors;
    vd.applyToMesh(this.mesh, true);
  }
}

export class SnowTrail {
  private leftTrack: SkiTrackMesh;
  private rightTrack: SkiTrackMesh;
  private getHeight: (x: number, z: number) => number;

  constructor(scene: Scene, getHeight: (x: number, z: number) => number) {
    this.getHeight = getHeight;

    const mat = new StandardMaterial("skiTrackMat", scene);
    mat.diffuseColor = new Color3(0.7, 0.75, 0.88);
    mat.specularColor = new Color3(0.4, 0.42, 0.5);
    mat.specularPower = 64;
    mat.backFaceCulling = false;

    this.leftTrack = new SkiTrackMesh("leftSkiTrack", scene, mat);
    this.rightTrack = new SkiTrackMesh("rightSkiTrack", scene, mat);
  }

  update(
    position: Vector3,
    forward: Vector3,
    speed: number,
    grounded: boolean,
    lean: number,
    braking: boolean,
  ): void {
    if (!grounded || speed < 0.5) return;

    // Right vector perpendicular to forward on the ground plane
    const right = Vector3.Cross(Vector3.Up(), forward).normalize();

    // Lean shifts both skis sideways slightly
    const leanShift = lean * 0.08;

    const leftCenter = position.add(right.scale(-SKI_SEPARATION / 2 + leanShift));
    const rightCenter = position.add(right.scale(SKI_SEPARATION / 2 + leanShift));

    // Snap to terrain
    leftCenter.y = this.getHeight(leftCenter.x, leftCenter.z) + TERRAIN_OFFSET;
    rightCenter.y = this.getHeight(rightCenter.x, rightCenter.z) + TERRAIN_OFFSET;

    // Trail width varies with carving intensity
    const carveT = Math.abs(lean) / (25 * Math.PI / 180);
    let halfWidth: number;
    if (braking) {
      halfWidth = BRAKE_HALF_WIDTH;
    } else {
      halfWidth = BASE_HALF_WIDTH + (CARVE_HALF_WIDTH - BASE_HALF_WIDTH) * carveT;
    }

    this.leftTrack.addPoint(leftCenter, right, halfWidth);
    this.rightTrack.addPoint(rightCenter, right, halfWidth);
  }
}
