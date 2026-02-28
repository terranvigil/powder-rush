import type { SaveData } from "../game/SaveManager";
import { LEVELS } from "../game/LevelPresets";
import { ProgressionManager } from "../game/ProgressionManager";
import { showRules } from "./RulesOverlay";

export type MenuAction = { type: "play"; level: number } | { type: "design" };

export class MainMenu {
  private overlay: HTMLDivElement;
  private bestTimeEl: HTMLParagraphElement;
  private coinsEl: HTMLParagraphElement;
  private levelButtons: HTMLButtonElement[] = [];
  private resolveAction: ((action: MenuAction) => void) | null = null;
  private onShop: () => void;
  private progression: ProgressionManager;

  constructor(onShop: () => void, progression: ProgressionManager) {
    this.onShop = onShop;
    this.progression = progression;

    this.overlay = document.createElement("div");
    this.overlay.className = "main-menu-overlay";

    const panel = document.createElement("div");
    panel.className = "main-menu-panel";

    // Title row with logo
    const titleRow = document.createElement("div");
    titleRow.className = "splash-title-row";
    titleRow.style.justifyContent = "center";

    const logoWrap = document.createElement("div");
    logoWrap.innerHTML = `<svg class="splash-logo" viewBox="0 0 14 14" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">
      <rect x="8" y="3" width="1" height="1" fill="#3a5a8f"/>
      <rect x="7" y="4" width="3" height="1" fill="#3a5a8f"/>
      <rect x="6" y="5" width="5" height="1" fill="#3a5a8f"/>
      <rect x="5" y="6" width="7" height="1" fill="#3a5a8f"/>
      <rect x="5" y="7" width="8" height="1" fill="#3a5a8f"/>
      <rect x="4" y="8" width="9" height="1" fill="#3a5a8f"/>
      <rect x="4" y="9" width="10" height="1" fill="#3a5a8f"/>
      <rect x="3" y="10" width="11" height="1" fill="#3a5a8f"/>
      <rect x="3" y="11" width="11" height="1" fill="#3a5a8f"/>
      <rect x="8" y="2" width="1" height="1" fill="#a0d0ff"/>
      <rect x="8" y="3" width="2" height="1" fill="#c8e8ff"/>
      <rect x="3" y="5" width="1" height="1" fill="#4a7abf"/>
      <rect x="2" y="6" width="3" height="1" fill="#4a7abf"/>
      <rect x="1" y="7" width="5" height="1" fill="#4a7abf"/>
      <rect x="1" y="8" width="5" height="1" fill="#4a7abf"/>
      <rect x="0" y="9" width="6" height="1" fill="#4a7abf"/>
      <rect x="0" y="10" width="5" height="1" fill="#4a7abf"/>
      <rect x="0" y="11" width="5" height="1" fill="#4a7abf"/>
      <rect x="3" y="4" width="1" height="1" fill="#ffffff"/>
      <rect x="2" y="5" width="2" height="1" fill="#ddeeff"/>
      <rect x="4" y="6" width="1" height="1" fill="#64c8ff"/>
      <rect x="5" y="7" width="1" height="1" fill="#64c8ff"/>
      <rect x="5" y="8" width="1" height="1" fill="#64c8ff"/>
      <rect x="6" y="9" width="1" height="1" fill="#64c8ff"/>
      <rect x="7" y="10" width="1" height="1" fill="#64c8ff"/>
      <rect x="8" y="11" width="1" height="1" fill="#64c8ff"/>
      <rect x="10" y="6" width="2" height="1" fill="rgba(255,255,255,0.25)"/>
      <rect x="11" y="8" width="3" height="1" fill="rgba(255,255,255,0.2)"/>
      <rect x="9" y="10" width="2" height="1" fill="rgba(255,255,255,0.15)"/>
      <rect x="1" y="1" width="1" height="1" fill="rgba(255,255,255,0.6)"/>
      <rect x="11" y="2" width="1" height="1" fill="rgba(255,255,255,0.4)"/>
      <rect x="6" y="0" width="1" height="1" fill="rgba(255,255,255,0.5)"/>
      <rect x="13" y="5" width="1" height="1" fill="rgba(255,255,255,0.3)"/>
      <rect x="0" y="3" width="1" height="1" fill="rgba(255,255,255,0.25)"/>
    </svg>`;
    titleRow.appendChild(logoWrap.firstElementChild!);

    const title = document.createElement("h1");
    title.className = "main-menu-title";
    title.style.textAlign = "left";
    title.innerHTML = "POWDER<br>RUSH";
    titleRow.appendChild(title);
    panel.appendChild(titleRow);

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

    // Level select grid
    const levelGrid = document.createElement("div");
    levelGrid.className = "level-grid";

    LEVELS.forEach((level, i) => {
      const btn = document.createElement("button");
      btn.className = "menu-btn level-btn";

      const unlocked = this.progression.isUnlocked(i);
      const best = this.progression.bestScore(i);

      let thirdLine = "&nbsp;"; // invisible placeholder keeps height consistent
      if (!unlocked) {
        btn.classList.add("level-locked");
        btn.disabled = true;
        if (i > 0) thirdLine = `LOCKED`;
      } else if (best !== null) {
        thirdLine = `<span style="color:gold">${best}</span>`;
      }
      btn.innerHTML = `<span class="level-name">${level.name}</span><span class="level-desc">${level.subtitle}</span><span class="level-desc">${thirdLine}</span>`;

      btn.addEventListener("click", () => {
        if (unlocked && this.resolveAction) this.resolveAction({ type: "play", level: i });
      });
      levelGrid.appendChild(btn);
      this.levelButtons.push(btn);
    });

    panel.appendChild(levelGrid);

    // Secondary buttons
    const buttons = document.createElement("div");
    buttons.className = "main-menu-buttons";

    const designBtn = document.createElement("button");
    designBtn.className = "menu-btn menu-btn-secondary";
    designBtn.textContent = "DESIGN";
    designBtn.addEventListener("click", () => {
      if (this.resolveAction) this.resolveAction({ type: "design" });
    });

    const shopBtn = document.createElement("button");
    shopBtn.className = "menu-btn menu-btn-secondary";
    shopBtn.textContent = "SHOP";
    shopBtn.addEventListener("click", () => this.onShop());

    const rulesBtn = document.createElement("button");
    rulesBtn.className = "menu-btn menu-btn-secondary";
    rulesBtn.textContent = "RULES";
    rulesBtn.addEventListener("click", () => showRules());

    buttons.appendChild(designBtn);
    buttons.appendChild(shopBtn);
    buttons.appendChild(rulesBtn);
    panel.appendChild(buttons);

    this.overlay.appendChild(panel);
  }

  show(save: Readonly<SaveData>): Promise<MenuAction> {
    this.updateStats(save);
    document.body.appendChild(this.overlay);
    requestAnimationFrame(() => this.overlay.classList.add("visible"));

    return new Promise((resolve) => {
      this.resolveAction = (action: MenuAction) => {
        this.overlay.classList.remove("visible");
        setTimeout(() => {
          this.overlay.remove();
          resolve(action);
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
