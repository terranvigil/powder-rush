import { AdvancedDynamicTexture } from "@babylonjs/gui/2D/advancedDynamicTexture";
import { TextBlock } from "@babylonjs/gui/2D/controls/textBlock";
import { Rectangle } from "@babylonjs/gui/2D/controls/rectangle";
import { Control } from "@babylonjs/gui/2D/controls/control";

export class HUD {
  private speedText: TextBlock;
  private timerText: TextBlock;
  private coinText: TextBlock;
  private scoreText: TextBlock;
  private collisionText: TextBlock;
  private collisionFadeTimer = 0;
  private flowBg: Rectangle;
  private flowFill: Rectangle;
  private ui: AdvancedDynamicTexture;
  private _finishTriggered = false;
  private onFinish: ((time: number, coins: number, total: number) => void) | null = null;
  private fadePanels: (Rectangle | TextBlock)[] = [];
  private fadeTimer = 0;
  private hudAlpha = 1;
  private lastSpeed = 0;
  private lastCoins = 0;

  constructor() {
    const ui = AdvancedDynamicTexture.CreateFullscreenUI("hud");
    this.ui = ui;

    // Semi-transparent background panel — speed (top-left)
    const panel = new Rectangle("speedPanel");
    panel.width = "240px";
    panel.height = "80px";
    panel.cornerRadius = 12;
    panel.background = "rgba(0, 0, 0, 0.6)";
    panel.thickness = 0;
    panel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    panel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    panel.left = "20px";
    panel.top = "20px";
    ui.addControl(panel);
    this.fadePanels.push(panel);

    this.speedText = new TextBlock("speed", "0 km/h");
    this.speedText.color = "white";
    this.speedText.fontSize = 48;
    this.speedText.fontFamily = "'Courier New', monospace";
    this.speedText.fontWeight = "bold";
    this.speedText.outlineWidth = 4;
    this.speedText.outlineColor = "black";
    panel.addControl(this.speedText);

    // Trick score panel (below speed)
    const scorePanel = new Rectangle("scorePanel");
    scorePanel.width = "160px";
    scorePanel.height = "36px";
    scorePanel.cornerRadius = 10;
    scorePanel.background = "rgba(0, 0, 0, 0.6)";
    scorePanel.thickness = 0;
    scorePanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    scorePanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    scorePanel.left = "20px";
    scorePanel.top = "108px";
    ui.addControl(scorePanel);
    this.fadePanels.push(scorePanel);

    this.scoreText = new TextBlock("score", "SCORE: 0");
    this.scoreText.color = "#8af";
    this.scoreText.fontSize = 18;
    this.scoreText.fontFamily = "'Courier New', monospace";
    this.scoreText.fontWeight = "bold";
    this.scoreText.outlineWidth = 2;
    this.scoreText.outlineColor = "black";
    scorePanel.addControl(this.scoreText);

    // Flow meter (below score)
    this.flowBg = new Rectangle("flowBg");
    this.flowBg.width = "160px";
    this.flowBg.height = "10px";
    this.flowBg.cornerRadius = 5;
    this.flowBg.background = "rgba(0, 0, 0, 0.6)";
    this.flowBg.thickness = 0;
    this.flowBg.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.flowBg.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.flowBg.left = "20px";
    this.flowBg.top = "152px";
    ui.addControl(this.flowBg);
    this.fadePanels.push(this.flowBg);

    this.flowFill = new Rectangle("flowFill");
    this.flowFill.width = "0px";
    this.flowFill.height = "8px";
    this.flowFill.cornerRadius = 4;
    this.flowFill.background = "#8af";
    this.flowFill.thickness = 0;
    this.flowFill.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.flowFill.left = "1px";
    this.flowBg.addControl(this.flowFill);

    const flowLabel = new TextBlock("flowLabel", "FLOW");
    flowLabel.color = "rgba(255, 255, 255, 0.5)";
    flowLabel.fontSize = 8;
    flowLabel.fontFamily = "'Courier New', monospace";
    flowLabel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    flowLabel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    flowLabel.left = "24px";
    flowLabel.top = "165px";
    ui.addControl(flowLabel);
    this.fadePanels.push(flowLabel);

    // Coin counter panel (top-right, below gear button)
    const coinPanel = new Rectangle("coinPanel");
    coinPanel.width = "180px";
    coinPanel.height = "50px";
    coinPanel.cornerRadius = 12;
    coinPanel.background = "rgba(0, 0, 0, 0.6)";
    coinPanel.thickness = 0;
    coinPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    coinPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    coinPanel.left = "-20px";
    coinPanel.top = "60px";
    ui.addControl(coinPanel);
    this.fadePanels.push(coinPanel);

    this.coinText = new TextBlock("coins", "0 / 25");
    this.coinText.color = "gold";
    this.coinText.fontSize = 28;
    this.coinText.fontFamily = "'Courier New', monospace";
    this.coinText.fontWeight = "bold";
    this.coinText.outlineWidth = 3;
    this.coinText.outlineColor = "black";
    coinPanel.addControl(this.coinText);

    // Timer panel (top-center)
    const timerPanel = new Rectangle("timerPanel");
    timerPanel.width = "220px";
    timerPanel.height = "60px";
    timerPanel.cornerRadius = 12;
    timerPanel.background = "rgba(0, 0, 0, 0.6)";
    timerPanel.thickness = 0;
    timerPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    timerPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    timerPanel.top = "20px";
    ui.addControl(timerPanel);
    this.fadePanels.push(timerPanel);

    this.timerText = new TextBlock("timer", "0:00.00");
    this.timerText.color = "white";
    this.timerText.fontSize = 36;
    this.timerText.fontFamily = "'Courier New', monospace";
    this.timerText.fontWeight = "bold";
    this.timerText.outlineWidth = 3;
    this.timerText.outlineColor = "black";
    timerPanel.addControl(this.timerText);

    // Collision flash text (center screen, hidden by default)
    this.collisionText = new TextBlock("collisionFlash", "");
    this.collisionText.color = "red";
    this.collisionText.fontSize = 64;
    this.collisionText.fontFamily = "'Courier New', monospace";
    this.collisionText.fontWeight = "bold";
    this.collisionText.outlineWidth = 5;
    this.collisionText.outlineColor = "black";
    this.collisionText.alpha = 0;
    this.collisionText.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    this.collisionText.top = "-40px";
    ui.addControl(this.collisionText);
  }

  setOnFinish(cb: (time: number, coins: number, total: number) => void): void {
    this.onFinish = cb;
  }

  showCollisionFlash(text: string): void {
    this.collisionText.text = text;
    this.collisionText.color = text === "WIPEOUT!" ? "red" : "orange";
    this.collisionText.alpha = 1;
    this.collisionFadeTimer = 1.5;
  }

  update(speed: number, raceTime: number, finished: boolean, dt = 0, coinsCollected = 0, coinsTotal = 0, trickScore = 0, flowLevel = 0): void {
    const kmh = Math.round(speed * 3.6);
    this.speedText.text = `${kmh} km/h`;

    this.timerText.text = this.formatTime(raceTime);
    this.coinText.text = `${coinsCollected} / ${coinsTotal}`;

    // Trick score
    this.scoreText.text = `SCORE: ${trickScore}`;

    // Flow meter bar (max width ~156px inside 160px container)
    const fillWidth = Math.round((flowLevel / 100) * 156);
    this.flowFill.width = `${fillWidth}px`;
    // Color shifts from blue to gold at high flow
    if (flowLevel > 75) {
      this.flowFill.background = "gold";
    } else if (flowLevel > 50) {
      this.flowFill.background = "#6cf";
    } else {
      this.flowFill.background = "#8af";
    }

    if (finished && !this._finishTriggered) {
      this._finishTriggered = true;
      if (this.onFinish) this.onFinish(raceTime, coinsCollected, coinsTotal);
    }

    // Fade collision flash
    if (this.collisionFadeTimer > 0 && dt > 0) {
      this.collisionFadeTimer -= dt;
      this.collisionText.alpha = Math.max(0, this.collisionFadeTimer / 1.5);
    }

    // Auto-fade HUD after inactivity
    const FADE_DELAY = 3;
    const MIN_ALPHA = 0.15;
    const FADE_SPEED = 2;

    const speedChanged = Math.abs(kmh - this.lastSpeed) > 2;
    const coinsChanged = coinsCollected !== this.lastCoins;
    this.lastSpeed = kmh;
    this.lastCoins = coinsCollected;

    if (speedChanged || coinsChanged || this.collisionFadeTimer > 0 || finished) {
      this.fadeTimer = 0;
      this.hudAlpha = 1;
    } else {
      this.fadeTimer += dt;
    }

    if (this.fadeTimer > FADE_DELAY) {
      this.hudAlpha = Math.max(MIN_ALPHA, this.hudAlpha - FADE_SPEED * dt);
    }

    for (const panel of this.fadePanels) {
      panel.alpha = this.hudAlpha;
    }
  }

  private formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs.toFixed(2)}`;
  }
}
