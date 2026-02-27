import HavokPhysics from "@babylonjs/havok";
import { Engine } from "@babylonjs/core/Engines/engine";
import { Game } from "./game/Game";
import { SplashScreen } from "./ui/SplashScreen";

async function main() {
  const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
  const splash = new SplashScreen();

  // Load physics engine while splash is showing
  const havokInstance = await HavokPhysics();
  console.log("Havok physics initialized");

  // Create engine with antialiasing OFF for pixel look
  const engine = new Engine(canvas, false);

  // Create and initialize the game (scene loads behind the splash)
  const game = new Game(engine, havokInstance);
  await game.init();

  // Wait for user to dismiss splash (click or keypress)
  await splash.waitForDismiss();

  // Start audio (needs user interaction first — splash dismiss provides it)
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
