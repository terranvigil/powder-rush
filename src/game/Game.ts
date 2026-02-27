import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { HavokPlugin } from "@babylonjs/core/Physics/v2/Plugins/havokPlugin";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { CascadedShadowGenerator } from "@babylonjs/core/Lights/Shadows/cascadedShadowGenerator";
import { ChunkManager } from "../terrain/ChunkManager";
import { PlayerInput } from "../player/PlayerInput";
import { PlayerController } from "../player/PlayerController";
import { SkierCamera } from "../camera/SkierCamera";
import { PixelRenderer } from "./PixelRenderer";
import { HUD } from "../ui/HUD";
import { AudioManager } from "../audio/AudioManager";
import { SnowTrail } from "../effects/SnowTrail";
import { SnowSpray } from "../effects/SnowSpray";
import { PowderBurst } from "../effects/PowderBurst";
import { WildlifeManager } from "../wildlife/WildlifeManager";
import { NPCSkierManager } from "../wildlife/NPCSkierManager";
import { SettingsMenu } from "../ui/SettingsMenu";
import { CoinManager } from "../collectibles/CoinManager";

// Side-effect imports for Babylon.js tree-shaking
import "@babylonjs/core/Physics/joinedPhysicsEngineComponent";
import "@babylonjs/core/Particles/particleSystemComponent";
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";

export class Game {
  private engine: Engine;
  private havokInstance: unknown;
  private scene!: Scene;
  private skierCamera!: SkierCamera;
  private playerController!: PlayerController;
  private hud!: HUD;
  private snowTrail!: SnowTrail;
  private snowSpray!: SnowSpray;
  private powderBurst!: PowderBurst;
  private audio: AudioManager | null = null;
  private settingsMenu: SettingsMenu | null = null;
  private finishAudioPlayed = false;
  private paused = false;
  private chunkManager!: ChunkManager;
  private shadowGen!: CascadedShadowGenerator;
  private wildlifeManager!: WildlifeManager;
  private npcSkierManager!: NPCSkierManager;
  private coinManager!: CoinManager;

  constructor(engine: Engine, havokInstance: unknown) {
    this.engine = engine;
    this.havokInstance = havokInstance;
  }

  async init(): Promise<void> {
    // Create scene
    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0.53, 0.75, 0.93, 1.0); // Sky blue

    // Enable Havok physics
    const havokPlugin = new HavokPlugin(true, this.havokInstance as ArrayBuffer);
    this.scene.enablePhysics(new Vector3(0, -9.81, 0), havokPlugin);

    // Lighting
    this.setupLighting();

    // Build terrain chunks
    this.chunkManager = new ChunkManager(this.scene, this.shadowGen);

    // Wildlife manager
    this.wildlifeManager = new WildlifeManager(
      this.scene,
      this.chunkManager.slopeFunction,
      this.chunkManager.spline,
      this.shadowGen
    );

    // NPC skier manager
    this.npcSkierManager = new NPCSkierManager(
      this.scene,
      this.chunkManager.slopeFunction,
      this.chunkManager.spline,
      this.shadowGen
    );

    // Collectible coins
    this.coinManager = new CoinManager(
      this.scene,
      this.chunkManager.slopeFunction,
      this.chunkManager.spline,
      this.shadowGen
    );

    // Player input
    const input = new PlayerInput();

    // Player controller
    this.playerController = new PlayerController(
      this.scene,
      input,
      this.chunkManager.spawnPosition,
      this.chunkManager.finishZ
    );

    // Register skier model as shadow caster
    for (const mesh of this.playerController.getModelMeshes()) {
      this.shadowGen.addShadowCaster(mesh);
    }

    // Snow effects
    const heightFn = (x: number, z: number) => this.chunkManager.getHeight(x, z);
    this.snowTrail = new SnowTrail(this.scene, heightFn);
    this.snowSpray = new SnowSpray(this.scene, heightFn);
    this.powderBurst = new PowderBurst(this.scene, heightFn);

    // Camera
    this.skierCamera = new SkierCamera(
      this.scene,
      this.engine.getRenderingCanvas()!,
      this.playerController
    );

    // Pixel renderer (must be after camera is created)
    new PixelRenderer(this.scene, this.engine, this.skierCamera.camera);

    // Expose for debug/testing
    (window as any).__game = { playerController: this.playerController };

    // HUD
    this.hud = new HUD();

    // Frame update: camera + HUD + trail + audio
    this.scene.onBeforeRenderObservable.add(() => {
      if (this.paused) return;
      const dt = this.scene.getEngine().getDeltaTime() / 1000;
      this.chunkManager.update(this.playerController.position.z);

      // Register new obstacle collisions
      const newObstacles = this.chunkManager.getNewObstacleAggregates();
      for (const agg of newObstacles) {
        this.playerController.registerObstacleCollision(agg);
      }

      this.skierCamera.update();
      const pos = this.playerController.position;
      const fwd = this.playerController.forward;
      const spd = this.playerController.speed;
      const gnd = this.playerController.grounded;
      const ln = this.playerController.lean;
      const brk = this.playerController.braking;
      this.snowTrail.update(pos, fwd, spd, gnd, ln, brk);
      this.snowSpray.update(pos, fwd, spd, gnd, ln, brk);
      if (this.playerController.consumeLandEvent()) {
        this.powderBurst.trigger(pos, spd);
        if (this.audio) this.audio.playLanding();
      }

      // Coins
      const coinsJustCollected = this.coinManager.update(pos, dt);
      if (coinsJustCollected > 0 && this.audio) {
        this.audio.playCoinPickup();
      }

      // Wildlife & NPC skiers
      this.wildlifeManager.update(pos, spd, dt);
      this.npcSkierManager.update(this.playerController.position.z, dt);

      // Collision events
      const collisionEvt = this.playerController.consumeCollisionEvent();
      if (collisionEvt) {
        if (this.audio) this.audio.playCollision(collisionEvt.severity);
        this.hud.showCollisionFlash(
          collisionEvt.severity === "wipeout" ? "WIPEOUT!" : "STUMBLE!"
        );
      }

      this.hud.update(
        this.playerController.speed,
        this.playerController.raceTime,
        this.playerController.finished,
        dt,
        this.coinManager.collected,
        this.coinManager.total
      );
      this.updateAudio();
    });
  }

  startAudio(): void {
    this.audio = new AudioManager();
    this.settingsMenu = new SettingsMenu(this.audio, (paused) => {
      this.setPaused(paused);
    });

    // Player held at gate until countdown finishes
    this.playerController.setFrozen(true);

    // Title jingle
    this.audio.playTitleJingle();

    // After jingle, start race countdown beeps
    setTimeout(() => {
      if (!this.audio) return;
      this.audio.playStartCountdown(() => {
        // GO — release the skier
        this.playerController.setFrozen(false);
        this.playerController.applyStartPush();
        this.animateStartWand();

        // Start music and continuous SFX
        if (this.audio) {
          this.audio.startGameplayMusic();
          this.audio.startWind();
          this.audio.startCarving();
        }
      });
    }, 2000);
  }

  private animateStartWand(): void {
    const pivot = this.chunkManager.startWandPivot;
    if (!pivot) return;

    let elapsed = 0;
    const openDur = 0.25;
    const holdDur = 0.3;
    const closeDur = 0.6;

    const obs = this.scene.onBeforeRenderObservable.add(() => {
      const dt = this.scene.getEngine().getDeltaTime() / 1000;
      elapsed += dt;

      if (elapsed < openDur) {
        // Swing wand forward (down)
        pivot.rotation.x = -(elapsed / openDur) * Math.PI / 2;
      } else if (elapsed < openDur + holdDur) {
        pivot.rotation.x = -Math.PI / 2;
      } else if (elapsed < openDur + holdDur + closeDur) {
        // Spring back
        const t = (elapsed - openDur - holdDur) / closeDur;
        const ease = t * t;
        pivot.rotation.x = -Math.PI / 2 * (1 - ease);
      } else {
        pivot.rotation.x = 0;
        this.scene.onBeforeRenderObservable.remove(obs);
      }
    });
  }

  private setPaused(paused: boolean): void {
    this.paused = paused;
    if (paused) {
      this.scene.physicsEnabled = false;
      this.playerController.pause();
      if (this.audio) this.audio.suspend();
    } else {
      this.scene.physicsEnabled = true;
      this.playerController.resume();
      if (this.audio) this.audio.resume();
    }
  }

  private updateAudio(): void {
    if (!this.audio) return;

    this.audio.updateWind(this.playerController.speed);
    this.audio.updateCarving(Math.abs(this.playerController.lean), this.playerController.speed);

    if (this.playerController.consumeJumpEvent()) {
      this.audio.playJump();
    }
    // Landing is handled in the main update loop (powder burst + audio together)
    if (this.playerController.finished && !this.finishAudioPlayed) {
      this.audio.playFinishFanfare();
      this.audio.fadeOutMusic(3);
      this.finishAudioPlayed = true;
    }
  }

  private setupLighting(): void {
    // Directional light — warm sunlight
    const dirLight = new DirectionalLight(
      "sunLight",
      new Vector3(
        Math.sin(-30 * Math.PI / 180) * Math.cos(35 * Math.PI / 180),
        -Math.sin(35 * Math.PI / 180),
        Math.cos(-30 * Math.PI / 180) * Math.cos(35 * Math.PI / 180)
      ),
      this.scene
    );
    dirLight.diffuse = new Color3(1, 0.95, 0.85);
    dirLight.intensity = 1.8;

    // Cascaded shadow map — good resolution near camera, fades with distance
    this.shadowGen = new CascadedShadowGenerator(1024, dirLight);
    this.shadowGen.numCascades = 4;
    this.shadowGen.lambda = 0.5;
    this.shadowGen.shadowMaxZ = 200;
    this.shadowGen.stabilizeCascades = true;
    this.shadowGen.filteringQuality = CascadedShadowGenerator.QUALITY_MEDIUM;
    this.shadowGen.bias = 0.005;
    this.shadowGen.normalBias = 0.02;

    // Hemispheric ambient fill
    const hemiLight = new HemisphericLight(
      "ambientLight",
      new Vector3(0, 1, 0),
      this.scene
    );
    hemiLight.intensity = 0.25;
    hemiLight.groundColor = new Color3(0.4, 0.45, 0.55);

    // Fog for depth perception
    this.scene.fogMode = Scene.FOGMODE_LINEAR;
    this.scene.fogStart = 80;
    this.scene.fogEnd = 300;
    this.scene.fogColor = new Color3(0.7, 0.78, 0.88);
  }

  render(): void {
    this.scene.render();
  }
}
