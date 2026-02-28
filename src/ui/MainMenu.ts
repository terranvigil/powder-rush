import type { SaveData } from "../game/SaveManager";
import { showRules } from "./RulesOverlay";

export class MainMenu {
  private overlay: HTMLDivElement;
  private bestTimeEl: HTMLParagraphElement;
  private coinsEl: HTMLParagraphElement;
  private resolvePlay: (() => void) | null = null;
  private onShop: () => void;

  constructor(onShop: () => void) {
    this.onShop = onShop;

    this.overlay = document.createElement("div");
    this.overlay.className = "main-menu-overlay";

    const panel = document.createElement("div");
    panel.className = "main-menu-panel";

    const title = document.createElement("h1");
    title.className = "main-menu-title";
    title.innerHTML = "POWDER<br>RUSH";
    panel.appendChild(title);

    // Stats
    const stats = document.createElement("div");
    stats.className = "main-menu-stats";

    this.bestTimeEl = document.createElement("p");
    this.bestTimeEl.className = "main-menu-stat";
    stats.appendChild(this.bestTimeEl);

    this.coinsEl = document.createElement("p");
    this.coinsEl.className = "main-menu-stat main-menu-coins";
    stats.appendChild(this.coinsEl);

    panel.appendChild(stats);

    // Buttons
    const buttons = document.createElement("div");
    buttons.className = "main-menu-buttons";

    const playBtn = document.createElement("button");
    playBtn.className = "menu-btn menu-btn-play";
    playBtn.textContent = "PLAY";
    playBtn.addEventListener("click", () => {
      if (this.resolvePlay) this.resolvePlay();
    });

    const shopBtn = document.createElement("button");
    shopBtn.className = "menu-btn menu-btn-secondary";
    shopBtn.textContent = "SHOP";
    shopBtn.addEventListener("click", () => this.onShop());

    const rulesBtn = document.createElement("button");
    rulesBtn.className = "menu-btn menu-btn-secondary";
    rulesBtn.textContent = "RULES";
    rulesBtn.addEventListener("click", () => showRules());

    buttons.appendChild(playBtn);
    buttons.appendChild(shopBtn);
    buttons.appendChild(rulesBtn);
    panel.appendChild(buttons);

    this.overlay.appendChild(panel);
  }

  show(save: Readonly<SaveData>): Promise<void> {
    this.updateStats(save);
    document.body.appendChild(this.overlay);
    requestAnimationFrame(() => this.overlay.classList.add("visible"));

    return new Promise((resolve) => {
      this.resolvePlay = () => {
        this.overlay.classList.remove("visible");
        setTimeout(() => {
          this.overlay.remove();
          resolve();
        }, 400);
      };
    });
  }

  updateStats(save: Readonly<SaveData>): void {
    if (save.bestTime !== null) {
      const mins = Math.floor(save.bestTime / 60);
      const secs = save.bestTime % 60;
      this.bestTimeEl.textContent = `BEST: ${mins}:${secs < 10 ? "0" : ""}${secs.toFixed(2)}`;
    } else {
      this.bestTimeEl.textContent = "";
    }
    this.coinsEl.textContent = `COINS: ${save.totalCoins}`;
  }
}
