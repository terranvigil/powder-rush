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
import { SnowChunks } from "../effects/SnowChunks";
import { PowderBurst } from "../effects/PowderBurst";
import { FallingSnow } from "../effects/FallingSnow";
import { GlowLayer } from "@babylonjs/core/Layers/glowLayer";
import { WildlifeManager } from "../wildlife/WildlifeManager";
import { NPCSkierManager } from "../wildlife/NPCSkierManager";
import { SettingsMenu } from "../ui/SettingsMenu";
import { CoinManager } from "../collectibles/CoinManager";
import { TrickDetector } from "./TrickDetector";
import { TrickPopup } from "../ui/TrickPopup";
import { SnowSparkles } from "../effects/SnowSparkles";
import type { GearModifiers } from "./GearData";
import { ChairliftManager } from "../chairlift/ChairliftManager";
import { NightSky } from "../effects/NightSky";
import type { LevelPreset } from "./LevelPresets";

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
  private snowChunks!: SnowChunks;
  private powderBurst!: PowderBurst;
  private fallingSnow!: FallingSnow;
  private pixelRenderer!: PixelRenderer;
  private audio: AudioManager | null = null;
  private settingsMenu: SettingsMenu | null = null;
  private finishAudioPlayed = false;
  private paused = false;
  private chunkManager!: ChunkManager;
  private shadowGen!: CascadedShadowGenerator;
  private wildlifeManager!: WildlifeManager;
  private npcSkierManager!: NPCSkierManager;
  private coinManager!: CoinManager;
  private trickDetector!: TrickDetector;
  private trickPopup!: TrickPopup;
  private snowSparkles!: SnowSparkles;
  private chairliftManager!: ChairliftManager;
  private nightSky: NightSky | null = null;
  private gearModifiers: GearModifiers;
  private levelPreset: LevelPreset | null;
  private onFinishCallback: ((time: number, coins: number, total: number, trickScore: number) => void) | null = null;

  constructor(engine: Engine, havokInstance: unknown, gearModifiers?: GearModifiers, levelPreset?: LevelPreset) {
    this.engine = engine;
    this.havokInstance = havokInstance;
    this.levelPreset = levelPreset ?? null;
    this.gearModifiers = gearModifiers ?? {
      maxSpeedBonus: 0,
      steerRateBonus: 0,
      recoveryMultiplier: 1,
      crashRetainBonus: 0,
    };
  }

  onFinish(cb: (time: number, coins: number, total: number, trickScore: number) => void): void {
    this.onFinishCallback = cb;
  }

  async init(): Promise<void> {
    // Create scene
    this.scene = new Scene(this.engine);

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

    // Chairlift alongside the slope
    this.chairliftManager = new ChairliftManager(
      this.scene,
      this.chunkManager.slopeFunction,
      this.chunkManager.spline,
      this.shadowGen
    );

    // Night mode: stars, moon, and chairlift pole lights
    const isNight = this.levelPreset?.name === "NIGHT DROP";
    if (isNight) {
      this.nightSky = new NightSky(this.scene);
      this.chairliftManager.addPoleLights();
    }

    // Player input
    const input = new PlayerInput();

    // Player controller
    this.playerController = new PlayerController(
      this.scene,
      input,
      this.chunkManager.spawnPosition,
      this.chunkManager.finishZ,
      this.gearModifiers
    );

    // Register skier model as shadow caster
    for (const mesh of this.playerController.getModelMeshes()) {
      this.shadowGen.addShadowCaster(mesh);
    }

    // Snow effects
    const heightFn = (x: number, z: number) => this.chunkManager.getHeight(x, z);
    this.snowTrail = new SnowTrail(this.scene, heightFn);
    this.snowSpray = new SnowSpray(this.scene, heightFn);
    this.snowChunks = new SnowChunks(this.scene, heightFn);
    this.powderBurst = new PowderBurst(this.scene, heightFn);

    // Bloom glow on 3D snow chunks
    const glow = new GlowLayer("snowGlow", this.scene, {
      mainTextureFixedSize: 256,
      blurKernelSize: 32,
    });
    glow.intensity = 0.5;
    glow.addIncludedOnlyMesh(this.snowChunks.mesh);

    // Snow surface sparkles
    this.snowSparkles = new SnowSparkles(this.scene, heightFn);

    // Falling snow ambient particles
    this.fallingSnow = new FallingSnow(this.scene, this.levelPreset?.snowRate);

    // Camera
    this.skierCamera = new SkierCamera(
      this.scene,
      this.engine.getRenderingCanvas()!,
      this.playerController
    );

    // Pixel renderer with DOF pipeline (must be after camera is created)
    this.pixelRenderer = new PixelRenderer(this.scene, this.engine, this.skierCamera.camera);

    // Expose for debug/testing
    (window as any).__game = { playerController: this.playerController };

    // Trick detection + popups
    this.trickDetector = new TrickDetector();
    this.trickPopup = new TrickPopup();

    // HUD
    this.hud = new HUD();
    this.hud.setOnFinish((time, coins, total) => {
      if (this.onFinishCallback) this.onFinishCallback(time, coins, total, this.trickDetector.score);
    });

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

      // DOF focus tracks player distance
      const camPos = this.skierCamera.camera.position;
      const focusDist = Vector3.Distance(camPos, this.playerController.position);
      this.pixelRenderer.updateDOF(focusDist, this.playerController.speed);

      // Falling snow follows camera
      this.fallingSnow.update(camPos);

      // Snow sparkles on ground near camera
      this.snowSparkles.update(camPos);

      // Night sky follows camera
      if (this.nightSky) this.nightSky.update(camPos);

      const pos = this.playerController.position;
      const fwd = this.playerController.forward;
      const spd = this.playerController.speed;
      const gnd = this.playerController.grounded;
      const ln = this.playerController.lean;
      const brk = this.playerController.braking;
      this.snowTrail.update(pos, fwd, spd, gnd, ln, brk);
      this.snowSpray.update(pos, fwd, spd, gnd, ln, brk);
      this.snowChunks.update(pos, fwd, spd, gnd, ln, brk);
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

      // Chairlift animation
      this.chairliftManager.update(this.playerController.position.z, dt);

      // Trick detection
      this.trickDetector.update(
        this.playerController.grounded,
        this.playerController.steerInput,
        this.playerController.tucking,
        this.playerController.braking,
        spd,
        dt,
      );
      const tricks = this.trickDetector.consumeTricks();
      for (const trick of tricks) {
        this.trickPopup.show(trick.name, trick.points);
      }

      // Collision events
      const collisionEvt = this.playerController.consumeCollisionEvent();
      if (collisionEvt) {
        if (this.audio) this.audio.playCollision(collisionEvt.severity);
        this.hud.showCollisionFlash(
          collisionEvt.severity === "wipeout" ? "WIPEOUT!" : "STUMBLE!"
        );
        this.trickDetector.onCollision();
      }

      this.hud.update(
        this.playerController.speed,
        this.playerController.raceTime,
        this.playerController.finished,
        dt,
        this.coinManager.collected,
        this.coinManager.total,
        this.trickDetector.score,
        this.trickDetector.flowLevel,
      );
      this.updateAudio();
    });
  }

  startAudio(): void {
    this.audio = new AudioManager();
    this.settingsMenu = new SettingsMenu(this.audio, (paused) => {
      this.setPaused(paused);
    }, (enabled) => {
      this.chairliftManager.setEnabled(enabled);
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
    const p = this.levelPreset;
    const azimuth = (p?.sunAzimuth ?? -30) * Math.PI / 180;
    const elevation = (p?.sunElevation ?? 35) * Math.PI / 180;

    // Directional light
    const dirLight = new DirectionalLight(
      "sunLight",
      new Vector3(
        Math.sin(azimuth) * Math.cos(elevation),
        -Math.sin(elevation),
        Math.cos(azimuth) * Math.cos(elevation)
      ),
      this.scene
    );
    const sc = p?.sunColor ?? [1.0, 0.90, 0.72];
    dirLight.diffuse = new Color3(sc[0], sc[1], sc[2]);
    dirLight.intensity = p?.sunIntensity ?? 1.8;

    // Cascaded shadow map
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
    hemiLight.intensity = p?.ambientIntensity ?? 0.25;
    const gc = p?.groundColor ?? [0.36, 0.36, 0.62];
    hemiLight.groundColor = new Color3(gc[0], gc[1], gc[2]);

    // Sky color
    const cc = p?.clearColor ?? [0.25, 0.42, 0.78];
    this.scene.clearColor = new Color4(cc[0], cc[1], cc[2], 1.0);

    // Fog for depth perception
    this.scene.fogMode = Scene.FOGMODE_LINEAR;
    this.scene.fogStart = p?.fogStart ?? 80;
    this.scene.fogEnd = p?.fogEnd ?? 300;
    const fc = p?.fogColor ?? [0.55, 0.62, 0.78];
    this.scene.fogColor = new Color3(fc[0], fc[1], fc[2]);
  }

  render(): void {
    this.scene.render();
  }
}
