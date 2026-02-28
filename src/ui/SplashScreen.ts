import { showRules } from "./RulesOverlay";

export class SplashScreen {
  private element: HTMLElement;
  private onShop: (() => void) | null = null;

  constructor(onShop?: () => void) {
    this.element = document.getElementById("splash")!;
    this.onShop = onShop ?? null;
    this.addButtons();
    this.adaptForTouch();
  }

  private addButtons(): void {
    const container = document.createElement("div");
    container.className = "splash-buttons";

    const rulesBtn = document.createElement("button");
    rulesBtn.className = "menu-btn menu-btn-secondary splash-btn-small";
    rulesBtn.textContent = "RULES";
    rulesBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      showRules();
    });

    const shopBtn = document.createElement("button");
    shopBtn.className = "menu-btn menu-btn-secondary splash-btn-small";
    shopBtn.textContent = "SHOP";
    shopBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (this.onShop) this.onShop();
    });

    container.appendChild(rulesBtn);
    container.appendChild(shopBtn);

    // Insert before the prompt
    const prompt = this.element.querySelector(".prompt");
    if (prompt) {
      this.element.insertBefore(container, prompt);
    } else {
      this.element.appendChild(container);
    }
  }

  private adaptForTouch(): void {
    const isTouch =
      "ontouchstart" in window || navigator.maxTouchPoints > 0;
    if (!isTouch) return;

    const controls = this.element.querySelector(".controls");
    if (controls) {
      controls.innerHTML =
        `<p>Drag left / right to steer</p>` +
        `<p><kbd>TUK</kbd> Pole / Skate / Tuck &nbsp; <kbd>BRK</kbd> Brake</p>` +
        `<p><kbd>JUMP</kbd> Hold to charge, release to jump</p>` +
        `<p style="margin-top:8px;color:#8af">TUK = skate when slow, pole at medium, tuck when fast</p>` +
        `<p style="color:#8af">TRICKS: steer / tuck / brake while airborne</p>`;
    }

    const prompt = this.element.querySelector(".prompt");
    if (prompt) {
      prompt.textContent = "TAP TO START";
    }
  }

  hide(): void {
    this.element.classList.add("hidden");
  }

  show(): void {
    this.element.classList.remove("hidden");
    this.element.style.display = "";
  }

  waitForDismiss(): Promise<void> {
    return new Promise((resolve) => {
      const dismiss = () => {
        document.removeEventListener("keydown", dismiss);
        this.element.removeEventListener("click", dismiss);
        this.element.removeEventListener("touchstart", handleTouch);

        this.element.classList.add("hidden");
        setTimeout(() => {
          this.element.style.display = "none";
          resolve();
        }, 800);
      };

      const handleTouch = (e: TouchEvent) => {
        e.preventDefault();
        dismiss();
      };

      document.addEventListener("keydown", dismiss);
      this.element.addEventListener("click", dismiss);
      this.element.addEventListener("touchstart", handleTouch, {
        passive: false,
      });
    });
  }
}
