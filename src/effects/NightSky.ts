import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { CreateDisc } from "@babylonjs/core/Meshes/Builders/discBuilder";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";

const STAR_COUNT = 200;
const SKY_RADIUS = 400;
const MOON_RADIUS = 12;
const MOON_ELEVATION = 55; // degrees above horizon
const MOON_AZIMUTH = -40;  // degrees from forward

export class NightSky {
  private root: Mesh;

  constructor(scene: Scene) {
    // Stars as a single merged mesh with emissive points
    this.root = this.buildStars(scene);
    this.buildMoon(scene);
  }

  private buildStars(scene: Scene): Mesh {
    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];

    // Generate random star positions on a sky dome (upper hemisphere)
    for (let i = 0; i < STAR_COUNT; i++) {
      // Random point on upper hemisphere
      const theta = Math.random() * Math.PI * 2; // azimuth
      const phi = Math.random() * 0.45 * Math.PI; // elevation (0 = horizon, PI/2 = zenith)
      const elev = phi + 0.05 * Math.PI; // keep above horizon

      const x = SKY_RADIUS * Math.cos(elev) * Math.sin(theta);
      const y = SKY_RADIUS * Math.sin(elev);
      const z = SKY_RADIUS * Math.cos(elev) * Math.cos(theta);

      // Each star is a small billboard quad (2 triangles)
      const size = 0.3 + Math.random() * 0.7;
      const base = positions.length / 3;

      // Quad vertices (camera-facing approximation — flat XZ plane works for distant stars)
      positions.push(x - size, y, z - size);
      positions.push(x + size, y, z - size);
      positions.push(x + size, y, z + size);
      positions.push(x - size, y, z + size);

      // Brightness variation
      const brightness = 0.5 + Math.random() * 0.5;
      // Slight color tint (warm white to cool blue)
      const tint = Math.random();
      const r = brightness * (0.85 + tint * 0.15);
      const g = brightness * (0.85 + tint * 0.1);
      const b = brightness;

      for (let v = 0; v < 4; v++) {
        colors.push(r, g, b, brightness);
      }

      indices.push(base, base + 1, base + 2);
      indices.push(base, base + 2, base + 3);
    }

    const mesh = new Mesh("nightStars", scene);
    const vertexData = new VertexData();
    vertexData.positions = positions;
    vertexData.colors = colors;
    vertexData.indices = indices;
    vertexData.applyToMesh(mesh);

    const mat = new StandardMaterial("starMat", scene);
    mat.emissiveColor = new Color3(1, 1, 1);
    mat.diffuseColor = new Color3(0, 0, 0);
    mat.specularColor = new Color3(0, 0, 0);
    mat.disableLighting = true;
    mesh.hasVertexAlpha = true;
    mesh.material = mat;
    mesh.isPickable = false;

    return mesh;
  }

  private buildMoon(scene: Scene): void {
    const elevRad = MOON_ELEVATION * Math.PI / 180;
    const azRad = MOON_AZIMUTH * Math.PI / 180;

    const x = SKY_RADIUS * 0.9 * Math.cos(elevRad) * Math.sin(azRad);
    const y = SKY_RADIUS * 0.9 * Math.sin(elevRad);
    const z = SKY_RADIUS * 0.9 * Math.cos(elevRad) * Math.cos(azRad);

    // Moon disc
    const moon = CreateDisc("moon", { radius: MOON_RADIUS, tessellation: 32 }, scene);
    moon.position.set(x, y, z);
    moon.billboardMode = Mesh.BILLBOARDMODE_ALL;

    const moonMat = new StandardMaterial("moonMat", scene);
    moonMat.emissiveColor = new Color3(0.9, 0.92, 0.95);
    moonMat.diffuseColor = new Color3(0, 0, 0);
    moonMat.specularColor = new Color3(0, 0, 0);
    moonMat.disableLighting = true;
    moonMat.alpha = 0.9;
    moon.material = moonMat;
    moon.isPickable = false;

    // Moon glow (larger, faint disc behind)
    const glow = CreateDisc("moonGlow", { radius: MOON_RADIUS * 2.5, tessellation: 32 }, scene);
    glow.position.set(x, y, z);
    glow.billboardMode = Mesh.BILLBOARDMODE_ALL;

    const glowMat = new StandardMaterial("moonGlowMat", scene);
    glowMat.emissiveColor = new Color3(0.5, 0.55, 0.7);
    glowMat.diffuseColor = new Color3(0, 0, 0);
    glowMat.specularColor = new Color3(0, 0, 0);
    glowMat.disableLighting = true;
    glowMat.alpha = 0.15;
    glow.material = glowMat;
    glow.isPickable = false;
  }

  update(cameraPosition: Vector3): void {
    // Move sky dome to follow camera XZ so stars never get closer
    this.root.position.x = cameraPosition.x;
    this.root.position.z = cameraPosition.z;
  }
}
