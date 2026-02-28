import { Scene } from "@babylonjs/core/scene";
import { ParticleSystem } from "@babylonjs/core/Particles/particleSystem";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color4 } from "@babylonjs/core/Maths/math.color";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";

export class SnowSparkles {
  private system: ParticleSystem;
  private emitterPos = Vector3.Zero();
  private getHeight: (x: number, z: number) => number;

  constructor(scene: Scene, getHeight: (x: number, z: number) => number) {
    this.getHeight = getHeight;

    const ps = new ParticleSystem("snowSparkles", 80, scene);
    ps.particleTexture = createSparkleTexture(scene);
    ps.blendMode = ParticleSystem.BLENDMODE_ADD;

    ps.emitter = this.emitterPos;
    ps.minEmitBox = new Vector3(-15, 0.05, -20);
    ps.maxEmitBox = new Vector3(15, 0.3, 5);

    ps.minLifeTime = 0.15;
    ps.maxLifeTime = 0.5;
    ps.minSize = 0.04;
    ps.maxSize = 0.12;
    ps.emitRate = 25;

    // Nearly stationary — sparkles twinkle in place
    ps.direction1 = new Vector3(0, 0, 0);
    ps.direction2 = new Vector3(0, 0.01, 0);
    ps.minEmitPower = 0;
    ps.maxEmitPower = 0.01;

    ps.gravity = Vector3.Zero();

    // Bright white sparkle with quick fade
    ps.color1 = new Color4(1, 1, 1, 1);
    ps.color2 = new Color4(0.95, 0.97, 1.0, 0.9);
    ps.colorDead = new Color4(1, 1, 1, 0);

    ps.start();
    this.system = ps;
  }

  update(cameraPosition: Vector3): void {
    this.emitterPos.x = cameraPosition.x;
    this.emitterPos.z = cameraPosition.z;
    this.emitterPos.y = this.getHeight(cameraPosition.x, cameraPosition.z);
  }
}

function createSparkleTexture(scene: Scene): DynamicTexture {
  const size = 16;
  const dt = new DynamicTexture("sparkleTex", size, scene, false);
  const ctx = dt.getContext();
  const c = size / 2;
  const g = ctx.createRadialGradient(c, c, 0, c, c, c * 0.6);
  g.addColorStop(0, "rgba(255, 255, 255, 1)");
  g.addColorStop(0.3, "rgba(255, 255, 255, 0.8)");
  g.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  dt.update();
  return dt;
}
