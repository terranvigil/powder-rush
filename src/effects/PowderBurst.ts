import { Scene } from "@babylonjs/core/scene";
import { ParticleSystem } from "@babylonjs/core/Particles/particleSystem";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color4 } from "@babylonjs/core/Maths/math.color";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";

export class PowderBurst {
  private system: ParticleSystem;
  private getHeight: (x: number, z: number) => number;

  constructor(scene: Scene, getHeight: (x: number, z: number) => number) {
    this.getHeight = getHeight;

    const ps = new ParticleSystem("powderBurst", 400, scene);
    ps.particleTexture = createPowderTexture(scene);
    ps.blendMode = ParticleSystem.BLENDMODE_STANDARD;

    ps.minLifeTime = 0.4;
    ps.maxLifeTime = 1.0;
    ps.minSize = 0.4;
    ps.maxSize = 1.2;
    ps.emitRate = 0;

    ps.color1 = new Color4(0.88, 0.92, 1.0, 0.7);
    ps.color2 = new Color4(0.8, 0.86, 0.98, 0.5);
    ps.colorDead = new Color4(0.95, 0.97, 1.0, 0);

    ps.gravity = new Vector3(0, -4, 0);
    ps.minEmitBox = new Vector3(-0.3, 0, -0.3);
    ps.maxEmitBox = new Vector3(0.3, 0.1, 0.3);

    ps.direction1 = new Vector3(-1.5, 1, -1.5);
    ps.direction2 = new Vector3(1.5, 3, 1.5);
    ps.minEmitPower = 2;
    ps.maxEmitPower = 5;

    ps.emitter = Vector3.Zero();
    ps.start();

    this.system = ps;
  }

  trigger(position: Vector3, speed: number): void {
    const ps = this.system;
    const intensity = Math.min(1, speed / 15);

    const emitPos = position.clone();
    emitPos.y = this.getHeight(emitPos.x, emitPos.z) + 0.1;
    ps.emitter = emitPos;

    ps.minEmitPower = 2 + intensity * 3;
    ps.maxEmitPower = 4 + intensity * 6;
    ps.minSize = 0.4 + intensity * 0.4;
    ps.maxSize = 0.8 + intensity * 0.8;

    // Burst: emit a batch in one frame
    const count = Math.floor(40 + 100 * intensity);
    ps.manualEmitCount = count;
  }
}

function createPowderTexture(scene: Scene): DynamicTexture {
  const size = 64;
  const dt = new DynamicTexture("powderTex", size, scene, false);
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
