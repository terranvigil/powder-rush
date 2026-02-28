import HavokPhysics from "@babylonjs/havok";
import { Engine } from "@babylonjs/core/Engines/engine";
import { Game } from "./game/Game";
import { SaveManager } from "./game/SaveManager";
import { resolveGearModifiers } from "./game/GearData";
import { LEVELS } from "./game/LevelPresets";
import { SplashScreen } from "./ui/SplashScreen";
import { MainMenu } from "./ui/MainMenu";
import { GearShop } from "./ui/GearShop";
import { FinishScreen } from "./ui/FinishScreen";

async function main() {
  const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
  const saveManager = new SaveManager();
  const gearShop = new GearShop(saveManager);

  // Load physics engine while splash/menu is showing
  const havokInstance = await HavokPhysics();
  console.log("Havok physics initialized");

  // Create engine with antialiasing OFF for pixel look
  const engine = new Engine(canvas, false);

  // Always show splash first
  const splash = new SplashScreen(() => gearShop.open());
  await splash.waitForDismiss();

  // Returning players get main menu with level select after splash
  let levelIndex = 0;
  if (saveManager.hasPlayed) {
    const menu = new MainMenu(() => gearShop.open());
    levelIndex = await menu.show(saveManager.save);
  }

  // Resolve gear modifiers from equipped gear
  const gearMods = resolveGearModifiers(saveManager.save.equippedGear);

  // Create and initialize the game with selected level
  const game = new Game(engine, havokInstance, gearMods, LEVELS[levelIndex]);
  await game.init();

  // Finish screen with save integration
  const finishScreen = new FinishScreen(
    () => location.reload(),
    () => location.reload(),
  );

  game.onFinish((time, coins, total, trickScore) => {
    const prevBest = saveManager.save.bestTime;
    saveManager.recordRun(time, coins);
    const isNewBest = prevBest === null || time < prevBest;
    // Delay finish screen to let fanfare play
    setTimeout(() => {
      finishScreen.show(time, coins, total, isNewBest, trickScore);
    }, 2000);
  });

  // Start audio (needs user interaction first — splash/menu dismiss provides it)
  game.startAudio();

  // Run render loop
  engine.runRenderLoop(() => {
    game.render();
  });

  // Handle window resize
  window.addEventListener("resize", () => {
    engine.resize();
  });
}

main().catch(console.error);
