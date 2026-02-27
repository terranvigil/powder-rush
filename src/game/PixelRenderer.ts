import { Scene } from "@babylonjs/core/scene";
import { Engine } from "@babylonjs/core/Engines/engine";
import { Camera } from "@babylonjs/core/Cameras/camera";
import { PassPostProcess } from "@babylonjs/core/PostProcesses/passPostProcess";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";

const TARGET_HEIGHT = 480; // Effective pixel height — enough detail to see smooth shading

export class PixelRenderer {
  private postProcess: PassPostProcess;
  private engine: Engine;

  constructor(scene: Scene, engine: Engine, camera: Camera) {
    this.engine = engine;

    const ratio = this.calculateRatio();
    this.postProcess = new PassPostProcess(
      "pixelate",
      ratio,
      camera,
      Texture.NEAREST_SAMPLINGMODE,
      engine
    );

    // Recalculate on resize
    window.addEventListener("resize", () => {
      this.postProcess.dispose(camera);
      const newRatio = this.calculateRatio();
      this.postProcess = new PassPostProcess(
        "pixelate",
        newRatio,
        camera,
        Texture.NEAREST_SAMPLINGMODE,
        engine
      );
    });
  }

  private calculateRatio(): number {
    const canvasHeight = this.engine.getRenderHeight();
    return TARGET_HEIGHT / canvasHeight;
  }
}
