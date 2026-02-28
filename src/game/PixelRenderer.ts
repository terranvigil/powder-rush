import { Scene } from "@babylonjs/core/scene";
import { Engine } from "@babylonjs/core/Engines/engine";
import { Camera } from "@babylonjs/core/Cameras/camera";
import { PassPostProcess } from "@babylonjs/core/PostProcesses/passPostProcess";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { DefaultRenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline";

import "@babylonjs/core/Rendering/depthRendererSceneComponent";
import "@babylonjs/core/PostProcesses/RenderPipeline/postProcessRenderPipelineManagerSceneComponent";

const TARGET_HEIGHT = 480;
const BASE_FSTOP = 2.8;
const MIN_FSTOP = 1.4;
const FOCAL_LENGTH = 60;

export class PixelRenderer {
  private pipeline: DefaultRenderingPipeline;
  private pixelPass: PassPostProcess;
  private engine: Engine;
  private camera: Camera;

  constructor(scene: Scene, engine: Engine, camera: Camera) {
    this.engine = engine;
    this.camera = camera;

    // DOF + grain pipeline (renders at full resolution before pixel downscale)
    this.pipeline = new DefaultRenderingPipeline("defaultPipeline", true, scene, [camera]);

    // Depth of field
    this.pipeline.depthOfFieldEnabled = true;
    this.pipeline.depthOfFieldBlurLevel = 1; // Medium
    this.pipeline.depthOfField.focalLength = FOCAL_LENGTH;
    this.pipeline.depthOfField.fStop = BASE_FSTOP;
    this.pipeline.depthOfField.focusDistance = 8000; // 8m in mm

    // Subtle film grain
    this.pipeline.grainEnabled = true;
    this.pipeline.grain.intensity = 8;
    this.pipeline.grain.animated = true;

    // Pixel downscale as final step (after DOF pipeline)
    const ratio = this.calculateRatio();
    this.pixelPass = new PassPostProcess(
      "pixelate",
      ratio,
      camera,
      Texture.NEAREST_SAMPLINGMODE,
      engine
    );

    // Recalculate pixel ratio on resize
    window.addEventListener("resize", () => {
      this.pixelPass.dispose(camera);
      const newRatio = this.calculateRatio();
      this.pixelPass = new PassPostProcess(
        "pixelate",
        newRatio,
        camera,
        Texture.NEAREST_SAMPLINGMODE,
        engine
      );
    });
  }

  updateDOF(focusDistance: number, speed: number): void {
    // Focus tracks player distance (scene units to mm)
    this.pipeline.depthOfField.focusDistance = focusDistance * 1000;

    // Aperture widens at speed for more cinematic blur
    const speedT = Math.min(1, speed / 35);
    this.pipeline.depthOfField.fStop = BASE_FSTOP - speedT * (BASE_FSTOP - MIN_FSTOP);
  }

  private calculateRatio(): number {
    const canvasHeight = this.engine.getRenderHeight();
    return TARGET_HEIGHT / canvasHeight;
  }
}
