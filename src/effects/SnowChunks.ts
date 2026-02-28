import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { SolidParticleSystem } from "@babylonjs/core/Particles/solidParticleSystem";
import { CreatePolyhedron } from "@babylonjs/core/Meshes/Builders/polyhedronBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";

const MAX_CHUNKS = 200;
const GRAVITY = -12;
const MAX_LEAN = 25 * (Math.PI / 180);

export class SnowChunks {
  readonly mesh: Mesh;
  private sps: SolidParticleSystem;
  // Per-particle data in typed arrays for perf
  private vx: Float32Array;
  private vy: Float32Array;
  private vz: Float32Array;
  private srx: Float32Array; // spin rotation speeds
  private sry: Float32Array;
  private srz: Float32Array;
  private life: Float32Array;
  private maxLife: Float32Array;
  private baseScale: Float32Array;
  private active: Uint8Array;
  private nextSlot = 0;
  private dt = 0;
  private getHeight: (x: number, z: number) => number;
  private scene: Scene;

  constructor(scene: Scene, getHeight: (x: number, z: number) => number) {
    this.scene = scene;
    this.getHeight = getHeight;

    this.vx = new Float32Array(MAX_CHUNKS);
    this.vy = new Float32Array(MAX_CHUNKS);
    this.vz = new Float32Array(MAX_CHUNKS);
    this.srx = new Float32Array(MAX_CHUNKS);
    this.sry = new Float32Array(MAX_CHUNKS);
    this.srz = new Float32Array(MAX_CHUNKS);
    this.life = new Float32Array(MAX_CHUNKS);
    this.maxLife = new Float32Array(MAX_CHUNKS);
    this.baseScale = new Float32Array(MAX_CHUNKS);
    this.active = new Uint8Array(MAX_CHUNKS);

    // Faceted icosahedron — low-poly ice chunk look
    const model = CreatePolyhedron("chunkModel", { type: 1, size: 0.1 }, scene);

    const sps = new SolidParticleSystem("snowChunks", scene, { updatable: true });
    sps.addShape(model, MAX_CHUNKS);
    this.mesh = sps.buildMesh();
    model.dispose();

    // Blue-white translucent material with emissive for glow
    const mat = new StandardMaterial("snowChunkMat", scene);
    mat.diffuseColor = new Color3(0.82, 0.88, 1.0);
    mat.emissiveColor = new Color3(0.35, 0.40, 0.50);
    mat.specularColor = new Color3(0.5, 0.5, 0.6);
    mat.backFaceCulling = false;
    this.mesh.material = mat;
    this.mesh.hasVertexAlpha = true;

    // All particles start invisible
    sps.initParticles = () => {
      for (let i = 0; i < sps.nbParticles; i++) {
        sps.particles[i].isVisible = false;
      }
    };

    // Per-particle update — hot loop, no allocations
    const self = this;
    sps.updateParticle = (p) => {
      const i = p.idx;
      if (!self.active[i]) {
        p.isVisible = false;
        return p;
      }

      const dt = self.dt;
      self.life[i] -= dt;

      if (self.life[i] <= 0) {
        self.active[i] = 0;
        p.isVisible = false;
        return p;
      }

      // Gravity
      self.vy[i] += GRAVITY * dt;

      // Integrate position (no allocations)
      p.position.x += self.vx[i] * dt;
      p.position.y += self.vy[i] * dt;
      p.position.z += self.vz[i] * dt;

      // Spin
      p.rotation.x += self.srx[i] * dt;
      p.rotation.y += self.sry[i] * dt;
      p.rotation.z += self.srz[i] * dt;

      // Fade out + shrink at end of life
      const t = self.life[i] / self.maxLife[i];
      if (p.color) p.color.a = t * 0.75;
      const s = t < 0.3 ? (t / 0.3) * self.baseScale[i] : self.baseScale[i];
      p.scaling.setAll(s);

      return p;
    };

    sps.initParticles();
    sps.setParticles();
    sps.computeParticleVertex = false;

    this.sps = sps;
  }

  update(
    pos: Vector3,
    fwd: Vector3,
    speed: number,
    grounded: boolean,
    lean: number,
    braking: boolean,
  ): void {
    this.dt = this.scene.getEngine().getDeltaTime() / 1000;

    if (grounded && speed >= 2) {
      const carveT = Math.abs(lean) / MAX_LEAN;
      const speedT = Math.min(1, speed / 25);

      let emitCount = 0;
      if (braking) {
        emitCount = Math.floor(2 + 5 * speedT);
      } else if (carveT > 0.15) {
        emitCount = Math.floor(1 + 5 * carveT * speedT);
      }

      if (emitCount > 0) {
        const right = Vector3.Cross(Vector3.Up(), fwd).normalize();
        const side = lean > 0 ? -1 : 1;
        for (let i = 0; i < emitCount; i++) {
          this.emit(pos, fwd, right, side, speedT, braking);
        }
      }
    }

    this.sps.setParticles();
  }

  private emit(
    pos: Vector3,
    fwd: Vector3,
    right: Vector3,
    side: number,
    speedT: number,
    braking: boolean,
  ): void {
    const idx = this.findSlot();
    if (idx < 0) return;

    const p = this.sps.particles[idx];

    this.active[idx] = 1;
    this.maxLife[idx] = 0.3 + Math.random() * 0.5;
    this.life[idx] = this.maxLife[idx];
    p.isVisible = true;

    // Position near ski edges
    const spreadX = side * (0.1 + Math.random() * 0.3);
    const alongZ = -0.3 + Math.random() * 0.4;
    p.position.x = pos.x + right.x * spreadX + fwd.x * alongZ;
    p.position.z = pos.z + right.z * spreadX + fwd.z * alongZ;
    p.position.y = this.getHeight(p.position.x, p.position.z) + 0.05 + Math.random() * 0.15;

    // Launch velocity
    const power = (3 + speedT * 6) * (0.5 + Math.random() * 0.5);
    if (braking) {
      // Fan backward + upward + sideways spread
      this.vx[idx] = fwd.x * (-power * 0.4) + right.x * ((Math.random() - 0.5) * power * 0.8);
      this.vy[idx] = 2 + Math.random() * 4;
      this.vz[idx] = fwd.z * (-power * 0.4) + right.z * ((Math.random() - 0.5) * power * 0.8);
    } else {
      // Spray to outside of turn
      this.vx[idx] = right.x * side * power + fwd.x * (-power * 0.2);
      this.vy[idx] = 1.5 + Math.random() * 3;
      this.vz[idx] = right.z * side * power + fwd.z * (-power * 0.2);
    }

    // Random size — bigger at higher speed
    const s = 0.6 + Math.random() * 1.2 + speedT * 0.5;
    this.baseScale[idx] = s;
    p.scaling.setAll(s);

    // Random orientation + tumble speed
    p.rotation.x = Math.random() * 6.28;
    p.rotation.y = Math.random() * 6.28;
    p.rotation.z = Math.random() * 6.28;
    this.srx[idx] = (Math.random() - 0.5) * 10;
    this.sry[idx] = (Math.random() - 0.5) * 10;
    this.srz[idx] = (Math.random() - 0.5) * 10;

    p.color = new Color4(0.82, 0.88, 1.0, 0.75);
  }

  private findSlot(): number {
    for (let i = 0; i < MAX_CHUNKS; i++) {
      const idx = (this.nextSlot + i) % MAX_CHUNKS;
      if (!this.active[idx]) {
        this.nextSlot = (idx + 1) % MAX_CHUNKS;
        return idx;
      }
    }
    return -1;
  }
}
