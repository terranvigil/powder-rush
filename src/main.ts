import HavokPhysics from "@babylonjs/havok";
import { Engine } from "@babylonjs/core/Engines/engine";
import { Game } from "./game/Game";
import { SaveManager } from "./game/SaveManager";
import { ProgressionManager } from "./game/ProgressionManager";
import { resolveGearModifiers } from "./game/GearData";
import { LEVELS } from "./game/LevelPresets";
import { SplashScreen } from "./ui/SplashScreen";
import { MainMenu } from "./ui/MainMenu";
import { GearShop } from "./ui/GearShop";
import { FinishScreen } from "./ui/FinishScreen";
import { CourseDesigner } from "./ui/CourseDesigner";
import { DemoOverlay } from "./ui/DemoOverlay";
import { DemoMusic } from "./audio/DemoMusic";
import { SplashMusic } from "./audio/SplashMusic";
import type { CustomCourseConfig } from "./game/CourseCodec";

const DEMO_IDLE_SECONDS = 30;
const DEMO_RUN_METERS = 500;

async function main() {
  const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
  const saveManager = new SaveManager();
  const progression = new ProgressionManager();
  const gearShop = new GearShop(saveManager);

  // Load physics engine while splash/menu is showing
  const havokInstance = await HavokPhysics();
  console.log("Havok physics initialized");

  // Create engine with antialiasing OFF for pixel look
  const engine = new Engine(canvas, false);

  // Always show splash first
  const splash = new SplashScreen(() => gearShop.open());

  // --- Demo mode state ---
  let demoRunning = false;
  let demoGame: Game | null = null;
  let demoOverlay: DemoOverlay | null = null;
  let demoMusic: DemoMusic | null = null;
  let demoLevelOrder: number[] = [];
  let demoLevelIdx = 0;

  function shuffleLevels(): number[] {
    const arr = LEVELS.map((_, i) => i);
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  async function startDemoRun() {
    if (demoLevelOrder.length === 0 || demoLevelIdx >= demoLevelOrder.length) {
      demoLevelOrder = shuffleLevels();
      demoLevelIdx = 0;
    }

    const levelIdx = demoLevelOrder[demoLevelIdx++];
    demoGame = new Game({
      engine,
      havokInstance,
      demoMode: true,
      levelPreset: LEVELS[levelIdx],
    });
    await demoGame.init();
    demoGame.startDemo();

    engine.runRenderLoop(() => {
      if (!demoGame) return;
      demoGame.render();

      // Next run after enough distance
      if (-demoGame.playerZ > DEMO_RUN_METERS) {
        cycleDemoRun();
      }
    });
  }

  function cycleDemoRun() {
    engine.stopRenderLoop();
    if (demoGame) {
      demoGame.dispose();
      demoGame = null;
    }
    if (demoRunning) {
      setTimeout(() => {
        if (demoRunning) startDemoRun();
      }, 1000);
    }
  }

  // Start demo idle timer
  const demoTimer = setTimeout(async () => {
    demoRunning = true;
    // Hide splash, show demo overlay behind it
    splash.hide();
    demoOverlay = new DemoOverlay();
    demoOverlay.show();
    demoMusic = new DemoMusic();
    demoMusic.start();
    await startDemoRun();
  }, DEMO_IDLE_SECONDS * 1000);

  // Wait for user to dismiss splash (or interact during demo)
  await splash.waitForDismiss();

  // User interacted — cancel demo timer and stop demo if running
  clearTimeout(demoTimer);
  // demoRunning may have been set true asynchronously by the timer callback
  if (demoRunning as boolean) {
    demoRunning = false;
    engine.stopRenderLoop();
    if (demoGame as Game | null) {
      demoGame!.dispose();
      demoGame = null;
    }
    if (demoOverlay as DemoOverlay | null) {
      demoOverlay!.hide();
      demoOverlay = null;
    }
    if (demoMusic as DemoMusic | null) {
      demoMusic!.dispose();
      demoMusic = null;
    }
  }

  // --- Title music (plays through splash fade + menu) ---
  const splashMusic = new SplashMusic();
  splashMusic.start();

  // --- Main menu ---
  let levelIndex = 0;
  let customCourse: CustomCourseConfig | null = null;

  const menuAction = await showMainMenu();
  // Stop title music when leaving menu
  splashMusic.dispose();

  if (menuAction.type === "design") {
    await designerLoop();
    return;
  }
  levelIndex = menuAction.level;

  await startGame(levelIndex, customCourse);

  // --- Helpers ---

  async function showMainMenu() {
    const menu = new MainMenu(() => gearShop.open(), progression);
    return menu.show(saveManager.save);
  }

  async function designerLoop() {
    const designer = new CourseDesigner();
    const result = await designer.show();

    if (result.type === "back") {
      location.reload();
      return;
    }

    customCourse = result.config;
    await startGame(0, customCourse);
  }

  async function startGame(level: number, custom: CustomCourseConfig | null) {
    const gearMods = resolveGearModifiers(saveManager.save.equippedGear);

    let game: Game;
    if (custom) {
      game = new Game({
        engine,
        havokInstance,
        gearModifiers: gearMods,
        customCourse: custom,
      });
    } else {
      game = new Game(engine, havokInstance, gearMods, LEVELS[level]);
    }
    await game.init();

    const finishScreen = new FinishScreen(
      () => location.reload(),
      () => location.reload(),
    );

    game.onFinish((time, coins, total, trickScore, gatesPassed, gatesTotal, timePenalty) => {
      if (!custom) {
        saveManager.recordRun(time, coins);

        const breakdown = progression.scoreRun({
          levelIndex: level,
          time,
          trickScore,
          coinsCollected: coins,
          coinsTotal: total,
          gatesPassed,
          gatesTotal,
          timePenalty,
        });

        setTimeout(() => {
          finishScreen.show(
            time, coins, total,
            breakdown.isNewBest,
            trickScore,
            gatesPassed, gatesTotal,
            breakdown,
            LEVELS[level].scoreThreshold,
          );
        }, 2000);
      } else {
        setTimeout(() => {
          finishScreen.show(
            time, coins, total,
            false,
            trickScore,
            gatesPassed, gatesTotal,
            {
              timeScore: 0, trickScore, coinScore: coins * 20,
              gateScore: 0, penaltyScore: 0, totalScore: trickScore + coins * 20,
              isNewBest: false, advancedLevel: false, nextLevelName: null,
            },
            0,
          );
        }, 2000);
      }
    });

    game.startAudio();

    engine.runRenderLoop(() => {
      game.render();
    });

    window.addEventListener("resize", () => {
      engine.resize();
    });
  }
}

main().catch(console.error);
