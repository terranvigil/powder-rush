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
import { CrowdManager } from "../wildlife/CrowdManager";
import { NightSky } from "../effects/NightSky";
import { GateManager, SLALOM_CONFIG, SUPER_G_CONFIG } from "../course/GateManager";
import { RaceOpponent } from "../course/RaceOpponent";
import type { LevelPreset } from "./LevelPresets";
import { DemoInput } from "../player/DemoInput";
import { DemoCamera } from "../camera/DemoCamera";
import type { CustomCourseConfig } from "./CourseCodec";
import { SlopeSpline } from "../terrain/SlopeSpline";

// Map custom course atmosphere preset to LevelPreset lighting values
const ATMOSPHERE_PRESETS: Record<string, Partial<LevelPreset>> = {
  morning: {
    sunAzimuth: -60, sunElevation: 25, sunColor: [1.0, 0.85, 0.6], sunIntensity: 1.6,
    ambientIntensity: 0.3, groundColor: [0.4, 0.38, 0.55],
    clearColor: [0.45, 0.62, 0.85], fogStart: 80, fogEnd: 300, fogColor: [0.65, 0.70, 0.82], snowRate: 8,
  },
  midday: {
    sunAzimuth: -30, sunElevation: 45, sunColor: [1.0, 0.90, 0.72], sunIntensity: 1.8,
    ambientIntensity: 0.25, groundColor: [0.36, 0.36, 0.62],
    clearColor: [0.25, 0.42, 0.78], fogStart: 80, fogEnd: 300, fogColor: [0.55, 0.62, 0.78], snowRate: 12,
  },
  sunset: {
    sunAzimuth: 60, sunElevation: 12, sunColor: [1.0, 0.55, 0.25], sunIntensity: 1.4,
    ambientIntensity: 0.2, groundColor: [0.3, 0.25, 0.5],
    clearColor: [0.18, 0.12, 0.4], fogStart: 60, fogEnd: 220, fogColor: [0.4, 0.3, 0.5], snowRate: 20,
  },
  night: {
    sunAzimuth: 0, sunElevation: 60, sunColor: [0.6, 0.7, 0.9], sunIntensity: 0.8,
    ambientIntensity: 0.15, groundColor: [0.15, 0.15, 0.35],
    clearColor: [0.04, 0.05, 0.15], fogStart: 40, fogEnd: 150, fogColor: [0.08, 0.10, 0.22], snowRate: 25,
  },
};

function customCourseToPreset(cc: CustomCourseConfig): LevelPreset {
  const base = ATMOSPHERE_PRESETS[cc.atmospherePreset] ?? ATMOSPHERE_PRESETS.morning;
  const fogRange = (base.fogEnd ?? 300) - (base.fogStart ?? 80);
  return {
    name: cc.name,
    subtitle: cc.courseType,
    courseType: cc.courseType,
    scoreThreshold: 0,
    sunAzimuth: (base.sunAzimuth ?? -30) + cc.sunAzimuthOffset,
    sunElevation: (base.sunElevation ?? 35) + cc.sunElevationOffset,
    sunColor: base.sunColor ?? [1, 0.9, 0.72],
    sunIntensity: base.sunIntensity ?? 1.8,
    ambientIntensity: base.ambientIntensity ?? 0.25,
    groundColor: base.groundColor ?? [0.36, 0.36, 0.62],
    clearColor: base.clearColor ?? [0.25, 0.42, 0.78],
    fogStart: (base.fogStart ?? 80) * (1 - cc.fogDensity * 0.5),
    fogEnd: (base.fogStart ?? 80) + fogRange * (1 - cc.fogDensity * 0.5),
    fogColor: base.fogColor ?? [0.55, 0.62, 0.78],
    snowRate: (base.snowRate ?? 12) * cc.snowIntensity,
  };
}

// Side-effect imports for Babylon.js tree-shaking
import "@babylonjs/core/Physics/joinedPhysicsEngineComponent";
import "@babylonjs/core/Particles/particleSystemComponent";
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";

export interface GameOptions {
  engine: Engine;
  havokInstance: unknown;
  gearModifiers?: GearModifiers;
  levelPreset?: LevelPreset;
  demoMode?: boolean;
  customCourse?: CustomCourseConfig;
}

export class Game {
  private engine: Engine;
  private havokInstance: unknown;
  private scene!: Scene;
  private skierCamera!: SkierCamera;
  private demoCamera: DemoCamera | null = null;
  private playerController!: PlayerController;
  private demoInput: DemoInput | null = null;
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
  private crowdManager!: CrowdManager;
  private nightSky: NightSky | null = null;
  private gateManager: GateManager | null = null;
  private raceOpponent: RaceOpponent | null = null;
  private gearModifiers: GearModifiers;
  private levelPreset: LevelPreset | null;
  private isDemoMode: boolean;
  private customCourse: CustomCourseConfig | null;
  private onFinishCallback: ((time: number, coins: number, total: number, trickScore: number, gatesPassed: number, gatesTotal: number, timePenalty: number) => void) | null = null;

  constructor(engine: Engine, havokInstance: unknown, gearModifiers?: GearModifiers, levelPreset?: LevelPreset);
  constructor(opts: GameOptions);
  constructor(
    engineOrOpts: Engine | GameOptions, havokInstance?: unknown,
    gearModifiers?: GearModifiers, levelPreset?: LevelPreset,
  ) {
    if (engineOrOpts instanceof Engine) {
      this.engine = engineOrOpts;
      this.havokInstance = havokInstance!;
      this.levelPreset = levelPreset ?? null;
      this.isDemoMode = false;
      this.customCourse = null;
      this.gearModifiers = gearModifiers ?? {
        maxSpeedBonus: 0, steerRateBonus: 0, recoveryMultiplier: 1, crashRetainBonus: 0,
      };
    } else {
      const opts = engineOrOpts;
      this.engine = opts.engine;
      this.havokInstance = opts.havokInstance;
      this.isDemoMode = opts.demoMode ?? false;
      this.customCourse = opts.customCourse ?? null;
      // Custom courses generate their own LevelPreset from atmosphere settings
      this.levelPreset = this.customCourse
        ? customCourseToPreset(this.customCourse)
        : (opts.levelPreset ?? null);
      this.gearModifiers = opts.gearModifiers ?? {
        maxSpeedBonus: 0, steerRateBonus: 0, recoveryMultiplier: 1, crashRetainBonus: 0,
      };
    }
  }

  onFinish(cb: (time: number, coins: number, total: number, trickScore: number, gatesPassed: number, gatesTotal: number, timePenalty: number) => void): void {
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

    // Build terrain chunks (with course-specific terrain modifications)
    // Custom courses provide their own spline and terrain config
    if (this.customCourse) {
      const cc = this.customCourse;
      const spline = SlopeSpline.fromWaypoints(cc.length, cc.waypoints, cc.steepness);
      const terrainConfig = {
        mogulIntensity: cc.mogulIntensity > 0 ? cc.mogulIntensity : undefined,
        halfPipeWidth: cc.halfPipe?.width,
        halfPipeDepth: cc.halfPipe?.depth,
        jumpCount: cc.jumps.length,
      };
      this.chunkManager = new ChunkManager(this.scene, this.shadowGen, terrainConfig, spline, cc.length);
    } else {
      this.chunkManager = new ChunkManager(this.scene, this.shadowGen, this.levelPreset?.terrainConfig);
    }

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

    // Crowd at start & finish gates
    this.crowdManager = new CrowdManager(
      this.scene,
      this.chunkManager.slopeFunction,
      this.chunkManager.spline,
      this.shadowGen,
      -3,
      this.chunkManager.finishZ,
    );

    // Night mode: stars, moon, and chairlift pole lights
    const isNight = this.levelPreset?.clearColor?.[0] !== undefined &&
      this.levelPreset.clearColor[0] < 0.1 && this.levelPreset.clearColor[2] < 0.2;
    if (isNight) {
      this.nightSky = new NightSky(this.scene);
      this.chairliftManager.addPoleLights();
    }

    // Course-type gates (slalom, super G)
    const ct = this.levelPreset?.courseType;
    if (ct === "slalom") {
      this.gateManager = new GateManager(
        this.scene, this.chunkManager.slopeFunction, this.chunkManager.spline, SLALOM_CONFIG
      );
    } else if (ct === "superG") {
      this.gateManager = new GateManager(
        this.scene, this.chunkManager.slopeFunction, this.chunkManager.spline, SUPER_G_CONFIG
      );
    }

    // Parallel race opponent
    if (ct === "parallel") {
      this.raceOpponent = new RaceOpponent(
        this.scene, this.chunkManager.slopeFunction, this.chunkManager.spline
      );
    }

    // Player input — demo mode uses AI, normal uses keyboard/touch
    let input: { getState(): import("../player/PlayerInput").InputState };
    if (this.isDemoMode) {
      const courseLen = this.customCourse?.length ?? 1200;
      const jumpZones = this.customCourse?.jumps.map(j => j.z) ?? [0.2, 0.4, 0.6, 0.8];
      this.demoInput = new DemoInput(courseLen, jumpZones);
      input = this.demoInput;
    } else {
      input = new PlayerInput();
    }

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

    // Camera — demo mode uses cinematic cycling camera
    if (this.isDemoMode) {
      this.demoCamera = new DemoCamera(this.scene, this.engine.getRenderingCanvas()!, heightFn);
      // Use demo camera as active
      this.scene.activeCamera = this.demoCamera.camera;
    }
    this.skierCamera = new SkierCamera(
      this.scene,
      this.engine.getRenderingCanvas()!,
      this.playerController,
      heightFn
    );
    if (this.isDemoMode) {
      // Demo camera is the active one; skierCamera exists but isn't active
      this.scene.activeCamera = this.demoCamera!.camera;
    }

    // Pixel renderer with DOF pipeline (must be after camera is created)
    const activeCamera = this.isDemoMode ? this.demoCamera!.camera : this.skierCamera.camera;
    this.pixelRenderer = new PixelRenderer(this.scene, this.engine, activeCamera);

    // Expose for debug/testing
    (window as any).__game = { playerController: this.playerController };

    // Trick detection + popups
    this.trickDetector = new TrickDetector();
    if (this.levelPreset?.courseType) {
      this.trickDetector.setCourseType(this.levelPreset.courseType);
    }
    this.trickPopup = new TrickPopup();

    // HUD (hidden in demo mode)
    this.hud = new HUD();
    if (this.isDemoMode) {
      this.hud.setVisible(false);
    }
    this.hud.setOnFinish((time, coins, total) => {
      if (this.onFinishCallback) {
        const gp = this.gateManager?.gatesPassed ?? 0;
        const gt = this.gateManager?.totalGates ?? 0;
        const tp = this.gateManager?.timePenalty ?? 0;
        this.onFinishCallback(time, coins, total, this.trickDetector.score, gp, gt, tp);
      }
    });

    // Frame update: camera + HUD + trail + audio
    this.scene.onBeforeRenderObservable.add(() => {
      if (this.paused) return;
      const dt = this.scene.getEngine().getDeltaTime() / 1000;
      const pz = this.playerController.position.z;
      this.chunkManager.update(pz);

      // Edge containment — keep player within slope bounds
      {
        const cx = this.chunkManager.spline.centerXAt(pz);
        const hw = this.chunkManager.spline.halfWidthAt(pz);
        this.playerController.constrainToEdge(cx, hw);
      }

      // Register new obstacle collisions
      const newObstacles = this.chunkManager.getNewObstacleAggregates();
      for (const agg of newObstacles) {
        this.playerController.registerObstacleCollision(agg);
      }

      // Feed demo AI context before physics tick
      if (this.demoInput) {
        const pos = this.playerController.position;
        const cx = this.chunkManager.spline.centerXAt(pz);
        this.demoInput.updateContext(pz, cx, pos.x, this.playerController.grounded, dt);
      }

      // Camera update
      if (this.demoCamera) {
        this.demoCamera.update(this.playerController.position, dt);
      } else {
        this.skierCamera.update();
      }

      // DOF focus tracks player distance
      const activeCam = this.demoCamera?.camera ?? this.skierCamera.camera;
      const camPos = activeCam.position;
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

      // Crowd animation
      this.crowdManager.update(dt);

      // Race opponent
      if (this.raceOpponent) {
        this.raceOpponent.update(pos.z, dt);
        this.hud.updateRace(this.raceOpponent.getZDelta(pos.z));
      }

      // Gate tracking + HUD
      if (this.gateManager) {
        this.gateManager.update(pos.x, pos.z);
        this.hud.updateGate(
          this.gateManager.getNextGate(pos.z),
          this.gateManager.gatesPassed,
          this.gateManager.totalGates,
          this.gateManager.timePenalty,
        );
      }

      // Trick detection
      const terrainY = this.chunkManager.getHeight(pos.x, pos.z);
      this.trickDetector.updateAirHeight(pos.y - terrainY);
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

  /** Start demo mode — no audio, no countdown, just release the skier */
  startDemo(): void {
    this.playerController.setFrozen(false);
    this.playerController.applyStartPush();
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

  dispose(): void {
    this.hud.dispose();
    this.scene.dispose();
  }

  /** Current player Z position (for demo mode distance tracking) */
  get playerZ(): number {
    return this.playerController.position.z;
  }
}
