import { Scene } from "@babylonjs/core/scene";
import { ParticleSystem } from "@babylonjs/core/Particles/particleSystem";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color4 } from "@babylonjs/core/Maths/math.color";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";

export class FallingSnow {
  private system: ParticleSystem;
  private emitterPos = Vector3.Zero();

  constructor(scene: Scene) {
    const ps = new ParticleSystem("fallingSnow", 100, scene);
    ps.particleTexture = createSnowflakeTexture(scene);
    ps.blendMode = ParticleSystem.BLENDMODE_STANDARD;

    ps.emitter = this.emitterPos;
    ps.minEmitBox = new Vector3(-25, 5, -30);
    ps.maxEmitBox = new Vector3(25, 15, 10);

    ps.minLifeTime = 4;
    ps.maxLifeTime = 8;
    ps.minSize = 0.08;
    ps.maxSize = 0.18;
    ps.emitRate = 12;

    // Gentle downward drift with slight lateral sway
    ps.direction1 = new Vector3(-0.4, -1, -0.3);
    ps.direction2 = new Vector3(0.4, -0.5, 0.3);
    ps.minEmitPower = 0.3;
    ps.maxEmitPower = 0.8;

    ps.gravity = new Vector3(0, -0.2, 0);

    // Subtle white dots, visible mainly against sky and dark objects
    ps.color1 = new Color4(1, 1, 1, 0.6);
    ps.color2 = new Color4(0.92, 0.95, 1.0, 0.4);
    ps.colorDead = new Color4(1, 1, 1, 0);

    ps.start();
    this.system = ps;
  }

  update(cameraPosition: Vector3): void {
    this.emitterPos.copyFrom(cameraPosition);
  }
}

function createSnowflakeTexture(scene: Scene): DynamicTexture {
  const size = 32;
  const dt = new DynamicTexture("snowflakeTex", size, scene, false);
  const ctx = dt.getContext();
  const c = size / 2;
  const g = ctx.createRadialGradient(c, c, 0, c, c, c);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.4, "rgba(255,255,255,0.7)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  dt.update();
  return dt;
}
