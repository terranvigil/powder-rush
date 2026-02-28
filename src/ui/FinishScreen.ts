import type { ScoreBreakdown } from "../game/ProgressionManager";

export class FinishScreen {
  private overlay: HTMLDivElement;
  private timeText: HTMLParagraphElement;
  private coinsText: HTMLParagraphElement;
  private scoreText: HTMLParagraphElement;
  private gateText: HTMLParagraphElement;
  private totalScoreText: HTMLParagraphElement;
  private bestLabel: HTMLParagraphElement;
  private unlockLabel: HTMLParagraphElement;
  private thresholdText: HTMLParagraphElement;
  private onPlayAgain: () => void;
  private onMenu: () => void;

  constructor(onPlayAgain: () => void, onMenu: () => void) {
    this.onPlayAgain = onPlayAgain;
    this.onMenu = onMenu;

    this.overlay = document.createElement("div");
    this.overlay.className = "finish-overlay";

    const panel = document.createElement("div");
    panel.className = "finish-panel";

    const title = document.createElement("h2");
    title.textContent = "FINISH";
    title.className = "finish-title";
    panel.appendChild(title);

    this.bestLabel = document.createElement("p");
    this.bestLabel.className = "finish-best";
    this.bestLabel.textContent = "NEW BEST!";
    this.bestLabel.style.display = "none";
    panel.appendChild(this.bestLabel);

    this.unlockLabel = document.createElement("p");
    this.unlockLabel.className = "finish-unlock";
    this.unlockLabel.style.display = "none";
    panel.appendChild(this.unlockLabel);

    this.timeText = document.createElement("p");
    this.timeText.className = "finish-time";
    panel.appendChild(this.timeText);

    this.gateText = document.createElement("p");
    this.gateText.className = "finish-coins";
    this.gateText.style.display = "none";
    panel.appendChild(this.gateText);

    this.coinsText = document.createElement("p");
    this.coinsText.className = "finish-coins";
    panel.appendChild(this.coinsText);

    this.scoreText = document.createElement("p");
    this.scoreText.className = "finish-score";
    panel.appendChild(this.scoreText);

    this.totalScoreText = document.createElement("p");
    this.totalScoreText.className = "finish-total";
    panel.appendChild(this.totalScoreText);

    this.thresholdText = document.createElement("p");
    this.thresholdText.className = "finish-threshold";
    panel.appendChild(this.thresholdText);

    const buttons = document.createElement("div");
    buttons.className = "finish-buttons";

    const againBtn = document.createElement("button");
    againBtn.className = "menu-btn";
    againBtn.textContent = "AGAIN";
    againBtn.addEventListener("click", () => this.onPlayAgain());

    const menuBtn = document.createElement("button");
    menuBtn.className = "menu-btn menu-btn-secondary";
    menuBtn.textContent = "MENU";
    menuBtn.addEventListener("click", () => this.onMenu());

    buttons.appendChild(againBtn);
    buttons.appendChild(menuBtn);
    panel.appendChild(buttons);

    this.overlay.appendChild(panel);
  }

  show(
    time: number,
    coinsCollected: number,
    coinsTotal: number,
    isNewBest: boolean,
    trickScore = 0,
    gatesPassed = 0,
    gatesTotal = 0,
    scoreBreakdown?: ScoreBreakdown,
    scoreThreshold = 0,
  ): void {
    this.timeText.textContent = this.formatTime(time);
    this.coinsText.textContent = `COINS: ${coinsCollected} / ${coinsTotal}`;
    this.scoreText.textContent = trickScore > 0 ? `TRICK SCORE: ${trickScore}` : "";

    // Gate stats
    if (gatesTotal > 0) {
      this.gateText.textContent = `GATES: ${gatesPassed} / ${gatesTotal}`;
      this.gateText.style.display = "block";
    } else {
      this.gateText.style.display = "none";
    }

    // Score breakdown
    if (scoreBreakdown) {
      this.totalScoreText.textContent = `SCORE: ${scoreBreakdown.totalScore}`;
      this.bestLabel.style.display = scoreBreakdown.isNewBest ? "block" : "none";

      if (scoreBreakdown.advancedLevel && scoreBreakdown.nextLevelName) {
        this.unlockLabel.textContent = `UNLOCKED: ${scoreBreakdown.nextLevelName}`;
        this.unlockLabel.style.display = "block";
        this.unlockLabel.style.color = "#FFD700";
        this.thresholdText.textContent = "";
      } else if (scoreThreshold > 0 && scoreBreakdown.totalScore < scoreThreshold) {
        this.unlockLabel.style.display = "none";
        this.thresholdText.textContent = `NEED ${scoreThreshold} TO ADVANCE (${scoreThreshold - scoreBreakdown.totalScore} MORE)`;
      } else {
        this.unlockLabel.style.display = "none";
        this.thresholdText.textContent = "";
      }
    } else {
      this.totalScoreText.textContent = "";
      this.bestLabel.style.display = isNewBest ? "block" : "none";
      this.unlockLabel.style.display = "none";
      this.thresholdText.textContent = "";
    }

    document.body.appendChild(this.overlay);
    requestAnimationFrame(() => this.overlay.classList.add("visible"));
  }

  private formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs.toFixed(2)}`;
  }
}
