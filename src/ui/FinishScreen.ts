export class FinishScreen {
  private overlay: HTMLDivElement;
  private timeText: HTMLParagraphElement;
  private coinsText: HTMLParagraphElement;
  private scoreText: HTMLParagraphElement;
  private bestLabel: HTMLParagraphElement;
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

    this.timeText = document.createElement("p");
    this.timeText.className = "finish-time";
    panel.appendChild(this.timeText);

    this.coinsText = document.createElement("p");
    this.coinsText.className = "finish-coins";
    panel.appendChild(this.coinsText);

    this.scoreText = document.createElement("p");
    this.scoreText.className = "finish-score";
    panel.appendChild(this.scoreText);

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

  show(time: number, coinsCollected: number, coinsTotal: number, isNewBest: boolean, trickScore = 0): void {
    this.timeText.textContent = this.formatTime(time);
    this.coinsText.textContent = `COINS: ${coinsCollected} / ${coinsTotal}`;
    this.scoreText.textContent = trickScore > 0 ? `TRICK SCORE: ${trickScore}` : "";
    this.bestLabel.style.display = isNewBest ? "block" : "none";
    document.body.appendChild(this.overlay);
    // Trigger fade-in
    requestAnimationFrame(() => this.overlay.classList.add("visible"));
  }

  private formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs.toFixed(2)}`;
  }
}
