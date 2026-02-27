import { AdvancedDynamicTexture } from "@babylonjs/gui/2D/advancedDynamicTexture";
import { TextBlock } from "@babylonjs/gui/2D/controls/textBlock";
import { Rectangle } from "@babylonjs/gui/2D/controls/rectangle";
import { Control } from "@babylonjs/gui/2D/controls/control";

export class HUD {
  private speedText: TextBlock;
  private timerText: TextBlock;
  private coinText: TextBlock;
  private finishPanel: Rectangle;
  private finishTimeText: TextBlock;
  private finishCoinsText: TextBlock;
  private collisionText: TextBlock;
  private collisionFadeTimer = 0;
  private ui: AdvancedDynamicTexture;

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

    this.speedText = new TextBlock("speed", "0 km/h");
    this.speedText.color = "white";
    this.speedText.fontSize = 48;
    this.speedText.fontFamily = "'Courier New', monospace";
    this.speedText.fontWeight = "bold";
    this.speedText.outlineWidth = 4;
    this.speedText.outlineColor = "black";
    panel.addControl(this.speedText);

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

    this.timerText = new TextBlock("timer", "0:00.00");
    this.timerText.color = "white";
    this.timerText.fontSize = 36;
    this.timerText.fontFamily = "'Courier New', monospace";
    this.timerText.fontWeight = "bold";
    this.timerText.outlineWidth = 3;
    this.timerText.outlineColor = "black";
    timerPanel.addControl(this.timerText);

    // Finish overlay (hidden until finish)
    this.finishPanel = new Rectangle("finishPanel");
    this.finishPanel.width = "420px";
    this.finishPanel.height = "200px";
    this.finishPanel.cornerRadius = 16;
    this.finishPanel.background = "rgba(0, 0, 0, 0.8)";
    this.finishPanel.thickness = 3;
    this.finishPanel.color = "gold";
    this.finishPanel.isVisible = false;
    ui.addControl(this.finishPanel);

    const finishLabel = new TextBlock("finishLabel", "FINISH");
    finishLabel.color = "gold";
    finishLabel.fontSize = 48;
    finishLabel.fontFamily = "'Courier New', monospace";
    finishLabel.fontWeight = "bold";
    finishLabel.outlineWidth = 3;
    finishLabel.outlineColor = "black";
    finishLabel.top = "-30px";
    this.finishPanel.addControl(finishLabel);

    this.finishTimeText = new TextBlock("finishTime", "");
    this.finishTimeText.color = "white";
    this.finishTimeText.fontSize = 56;
    this.finishTimeText.fontFamily = "'Courier New', monospace";
    this.finishTimeText.fontWeight = "bold";
    this.finishTimeText.outlineWidth = 4;
    this.finishTimeText.outlineColor = "black";
    this.finishTimeText.top = "15px";
    this.finishPanel.addControl(this.finishTimeText);

    this.finishCoinsText = new TextBlock("finishCoins", "");
    this.finishCoinsText.color = "gold";
    this.finishCoinsText.fontSize = 28;
    this.finishCoinsText.fontFamily = "'Courier New', monospace";
    this.finishCoinsText.fontWeight = "bold";
    this.finishCoinsText.outlineWidth = 3;
    this.finishCoinsText.outlineColor = "black";
    this.finishCoinsText.top = "55px";
    this.finishPanel.addControl(this.finishCoinsText);

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

  showCollisionFlash(text: string): void {
    this.collisionText.text = text;
    this.collisionText.color = text === "WIPEOUT!" ? "red" : "orange";
    this.collisionText.alpha = 1;
    this.collisionFadeTimer = 1.5;
  }

  update(speed: number, raceTime: number, finished: boolean, dt = 0, coinsCollected = 0, coinsTotal = 0): void {
    const kmh = Math.round(speed * 3.6);
    this.speedText.text = `${kmh} km/h`;

    this.timerText.text = this.formatTime(raceTime);
    this.coinText.text = `${coinsCollected} / ${coinsTotal}`;

    if (finished && !this.finishPanel.isVisible) {
      this.finishPanel.isVisible = true;
      this.finishTimeText.text = this.formatTime(raceTime);
      this.finishCoinsText.text = `COINS: ${coinsCollected} / ${coinsTotal}`;
    }

    // Fade collision flash
    if (this.collisionFadeTimer > 0 && dt > 0) {
      this.collisionFadeTimer -= dt;
      this.collisionText.alpha = Math.max(0, this.collisionFadeTimer / 1.5);
    }
  }

  private formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs.toFixed(2)}`;
  }
}
