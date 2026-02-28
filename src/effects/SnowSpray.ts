import { Scene } from "@babylonjs/core/scene";
import { ParticleSystem } from "@babylonjs/core/Particles/particleSystem";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color4 } from "@babylonjs/core/Maths/math.color";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";

const MAX_LEAN = 25 * (Math.PI / 180);

export class SnowSpray {
  private system: ParticleSystem;
  private getHeight: (x: number, z: number) => number;

  constructor(scene: Scene, getHeight: (x: number, z: number) => number) {
    this.getHeight = getHeight;

    const ps = new ParticleSystem("snowSpray", 1200, scene);
    ps.particleTexture = createSnowTexture(scene);
    ps.blendMode = ParticleSystem.BLENDMODE_STANDARD;

    ps.minLifeTime = 0.3;
    ps.maxLifeTime = 0.7;
    ps.minSize = 0.3;
    ps.maxSize = 0.8;
    ps.emitRate = 0;

    // Bright blue-white for soft glow cloud behind 3D chunks
    ps.color1 = new Color4(0.9, 0.94, 1.0, 0.65);
    ps.color2 = new Color4(0.8, 0.86, 1.0, 0.5);
    ps.colorDead = new Color4(0.95, 0.97, 1.0, 0);

    ps.gravity = new Vector3(0, -6, 0);
    ps.minEmitBox = new Vector3(-0.1, 0, -0.1);
    ps.maxEmitBox = new Vector3(0.1, 0.1, 0.1);

    ps.emitter = Vector3.Zero();
    ps.start();

    this.system = ps;
  }

  update(
    position: Vector3,
    forward: Vector3,
    speed: number,
    grounded: boolean,
    lean: number,
    braking: boolean,
  ): void {
    if (!grounded || speed < 1.5) {
      this.system.emitRate = 0;
      return;
    }

    const right = Vector3.Cross(Vector3.Up(), forward).normalize();
    const carveT = Math.abs(lean) / MAX_LEAN;
    const speedT = Math.min(1, speed / 20);

    if (braking) {
      this.emitBrakeSpray(position, forward, right, speedT);
    } else if (carveT > 0.1) {
      this.emitCarveSpray(position, forward, right, lean, carveT, speedT);
    } else {
      this.system.emitRate = 0;
    }
  }

  private emitBrakeSpray(
    position: Vector3,
    forward: Vector3,
    right: Vector3,
    speedT: number,
  ): void {
    const ps = this.system;
    ps.emitRate = Math.floor(100 + 300 * speedT);
    ps.minEmitPower = 2 + speedT * 5;
    ps.maxEmitPower = 4 + speedT * 10;
    ps.minSize = 0.5;
    ps.maxSize = 1.5 + speedT * 0.8;
    ps.minLifeTime = 0.3;
    ps.maxLifeTime = 0.8 + speedT * 0.3;

    // Spray uphill and upward, fanning sideways
    const back = forward.scale(-1);
    ps.direction1 = back.add(new Vector3(0, 0.8, 0)).subtract(right.scale(0.6));
    ps.direction2 = back.add(new Vector3(0, 2.0, 0)).add(right.scale(0.6));

    const emitPos = position.clone();
    emitPos.y = this.getHeight(emitPos.x, emitPos.z) + 0.1;
    ps.emitter = emitPos;
  }

  private emitCarveSpray(
    position: Vector3,
    forward: Vector3,
    right: Vector3,
    lean: number,
    carveT: number,
    speedT: number,
  ): void {
    const ps = this.system;

    // Spray to outside of turn (opposite lean direction)
    const spraySide = lean > 0 ? -1 : 1;
    const sprayDir = right.scale(spraySide);

    ps.emitRate = Math.floor(40 + 200 * carveT * speedT);
    ps.minEmitPower = 1 + speedT * 4;
    ps.maxEmitPower = 2 + speedT * 8;
    ps.minSize = 0.3;
    ps.maxSize = 0.8 + 0.6 * carveT;
    ps.minLifeTime = 0.25;
    ps.maxLifeTime = 0.6 + speedT * 0.2;

    // Sideways + up + slightly backward
    const base = sprayDir.add(new Vector3(0, 0.6, 0)).add(forward.scale(-0.2));
    ps.direction1 = base.scale(0.7);
    ps.direction2 = base.add(new Vector3(0, 0.5, 0)).scale(1.3);

    // Position at outside ski edge
    const skiOffset = right.scale(spraySide * 0.2);
    const emitPos = position.add(skiOffset);
    emitPos.y = this.getHeight(emitPos.x, emitPos.z) + 0.1;
    ps.emitter = emitPos;
  }
}

function createSnowTexture(scene: Scene): DynamicTexture {
  const size = 64;
  const dt = new DynamicTexture("snowParticleTex", size, scene, false);
  const ctx = dt.getContext();
  const c = size / 2;
  const g = ctx.createRadialGradient(c, c, 0, c, c, c);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.3, "rgba(255,255,255,0.8)");
  g.addColorStop(0.7, "rgba(255,255,255,0.3)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  dt.update();
  return dt;
}
