import { chromium } from "playwright";

async function testGame() {
  const browser = await chromium.launch({
    headless: false,
    args: ["--enable-webgl", "--ignore-gpu-blocklist"],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  const logs: string[] = [];
  page.on("console", (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
  page.on("pageerror", (err) => logs.push(`[ERROR] ${err.message}`));

  console.log("Loading page...");
  await page.goto("http://localhost:5173/", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  // Print init logs
  logs.forEach((l) => console.log(l));

  async function snap(name: string, index: number) {
    const path = `/tmp/game-${String(index).padStart(2, "0")}-${name}.png`;
    await page.screenshot({ path });
    const data = await page.evaluate(() => {
      const w = window as any;
      if (!w.__game) return "no ref";
      const pc = w.__game.playerController;
      const p = pc.position;
      return `spd=${pc.speed.toFixed(1)}m/s (${(pc.speed * 3.6).toFixed(0)}km/h)  pos=(${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)})  gnd=${pc.grounded}`;
    });
    console.log(`[${String(index).padStart(2, "0")}] ${name}: ${data}`);
  }

  let i = 1;

  // Phase 1: Just gravity, no input — watch every second for 6s
  console.log("\n=== Phase 1: Gravity only (no input) ===");
  for (let t = 0; t < 6; t++) {
    await snap(`gravity-${t}s`, i++);
    await page.waitForTimeout(1000);
  }

  // Phase 2: Steer left for 3s, snap each second
  console.log("\n=== Phase 2: Steer left (a) ===");
  await page.keyboard.down("a");
  for (let t = 0; t < 3; t++) {
    await page.waitForTimeout(1000);
    await snap(`steer-L-${t + 1}s`, i++);
  }
  await page.keyboard.up("a");

  // Phase 3: Steer right for 3s
  console.log("\n=== Phase 3: Steer right (d) ===");
  await page.keyboard.down("d");
  for (let t = 0; t < 3; t++) {
    await page.waitForTimeout(1000);
    await snap(`steer-R-${t + 1}s`, i++);
  }
  await page.keyboard.up("d");

  // Phase 4: Tuck for 3s
  console.log("\n=== Phase 4: Tuck (w) ===");
  await page.keyboard.down("w");
  for (let t = 0; t < 3; t++) {
    await page.waitForTimeout(1000);
    await snap(`tuck-${t + 1}s`, i++);
  }
  await page.keyboard.up("w");

  // Phase 5: Brake for 3s
  console.log("\n=== Phase 5: Brake (s) ===");
  await page.keyboard.down("s");
  for (let t = 0; t < 3; t++) {
    await page.waitForTimeout(1000);
    await snap(`brake-${t + 1}s`, i++);
  }
  await page.keyboard.up("s");

  // Phase 6: Jump
  console.log("\n=== Phase 6: Jump (space) ===");
  await snap("pre-jump", i++);
  await page.keyboard.down("Space");
  await page.waitForTimeout(500);
  await page.keyboard.up("Space");
  await page.waitForTimeout(500);
  await snap("mid-jump", i++);
  await page.waitForTimeout(1000);
  await snap("post-jump", i++);

  await browser.close();
  console.log("\nDone!");
}

testGame().catch(console.error);
