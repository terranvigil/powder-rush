import { showRules } from "./RulesOverlay";
import { keyBindings } from "../player/KeyBindings";

export class SplashScreen {
  private element: HTMLElement;
  private onShop: (() => void) | null = null;

  constructor(onShop?: () => void) {
    this.element = document.getElementById("splash")!;
    this.onShop = onShop ?? null;
    this.addButtons();
    this.adaptForTouch();
    this.updateControlHints();
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

    const settingsBtn = document.createElement("button");
    settingsBtn.className = "menu-btn menu-btn-secondary splash-btn-small";
    settingsBtn.textContent = "SETTINGS";
    settingsBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.showSettingsOverlay();
    });

    container.appendChild(rulesBtn);
    container.appendChild(settingsBtn);
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

  private updateControlHints(): void {
    const isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    if (isTouch) return; // touch has its own hints

    const controls = this.element.querySelector(".controls");
    if (!controls) return;

    const left = keyBindings.displayName(keyBindings.get("steerLeft"));
    const right = keyBindings.displayName(keyBindings.get("steerRight"));
    const tuck = keyBindings.displayName(keyBindings.get("tuck"));
    const brake = keyBindings.displayName(keyBindings.get("brake"));
    const jump = keyBindings.displayName(keyBindings.get("jump"));

    controls.innerHTML =
      `<p><kbd>${left}</kbd> / <kbd>${right}</kbd> &mdash; Steer</p>` +
      `<p><kbd>${tuck}</kbd> &mdash; Pole / Skate / Tuck &nbsp; <kbd>${brake}</kbd> &mdash; Brake</p>` +
      `<p><kbd>${jump}</kbd> &mdash; Jump (hold to charge)</p>` +
      `<p style="margin-top:8px;color:#8af;font-size:8px">${tuck} = skate when slow, pole at medium, tuck when fast</p>` +
      `<p style="color:#8af;font-size:8px">TRICKS: steer / tuck / brake while airborne!</p>`;
  }

  private showSettingsOverlay(): void {
    const overlay = document.createElement("div");
    overlay.className = "rules-overlay";
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close();
    });

    const panel = document.createElement("div");
    panel.className = "rules-panel";
    panel.style.width = "320px";

    // Header
    const header = document.createElement("div");
    header.className = "settings-header";
    header.innerHTML = `<h2>SETTINGS</h2>`;
    const closeBtn = document.createElement("button");
    closeBtn.className = "settings-close";
    closeBtn.textContent = "X";
    closeBtn.addEventListener("click", () => close());
    header.appendChild(closeBtn);
    panel.appendChild(header);

    // Controls section header
    const controlsHeader = document.createElement("div");
    controlsHeader.className = "settings-section-header";
    controlsHeader.textContent = "CONTROLS";
    panel.appendChild(controlsHeader);

    // Keybind rows
    const buttons = new Map<string, HTMLButtonElement>();
    let capturing: string | null = null;
    let captureHandler: ((e: KeyboardEvent) => void) | null = null;

    const refreshAll = () => {
      for (const action of keyBindings.actions) {
        const btn = buttons.get(action)!;
        btn.textContent = keyBindings.displayName(keyBindings.get(action));
      }
    };

    const stopCapture = () => {
      if (captureHandler) {
        document.removeEventListener("keydown", captureHandler, true);
        captureHandler = null;
      }
      if (capturing) {
        const btn = buttons.get(capturing)!;
        btn.classList.remove("capturing");
        btn.textContent = keyBindings.displayName(keyBindings.get(capturing as any));
        capturing = null;
      }
    };

    for (const action of keyBindings.actions) {
      const row = document.createElement("div");
      row.className = "keybind-row";
      const label = document.createElement("label");
      label.textContent = keyBindings.actionLabel(action);
      const btn = document.createElement("button");
      btn.className = "keybind-btn";
      btn.textContent = keyBindings.displayName(keyBindings.get(action));
      btn.addEventListener("click", () => {
        stopCapture();
        capturing = action;
        btn.textContent = "...";
        btn.classList.add("capturing");

        captureHandler = (e: KeyboardEvent) => {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();

          if (e.code === "Escape") {
            stopCapture();
            return;
          }
          if (keyBindings.isBlocked(e.code)) {
            btn.classList.remove("invalid");
            void btn.offsetWidth;
            btn.classList.add("invalid");
            return;
          }

          const swapped = keyBindings.set(action, e.code);
          stopCapture();
          refreshAll();

          if (swapped) {
            const swappedBtn = buttons.get(swapped)!;
            swappedBtn.classList.add("swapped");
            setTimeout(() => swappedBtn.classList.remove("swapped"), 500);
          }
        };
        document.addEventListener("keydown", captureHandler, true);
      });
      buttons.set(action, btn);
      row.append(label, btn);
      panel.appendChild(row);
    }

    // Reset button
    const resetBtn = document.createElement("button");
    resetBtn.className = "keybind-reset";
    resetBtn.textContent = "RESET DEFAULTS";
    resetBtn.addEventListener("click", () => {
      stopCapture();
      keyBindings.reset();
      refreshAll();
    });
    panel.appendChild(resetBtn);

    // Close button
    const doneBtn = document.createElement("button");
    doneBtn.className = "menu-btn";
    doneBtn.textContent = "DONE";
    doneBtn.style.marginTop = "20px";
    doneBtn.addEventListener("click", () => close());
    panel.appendChild(doneBtn);

    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add("visible"));

    const self = this;
    function close() {
      stopCapture();
      document.removeEventListener("keydown", escHandler, true);
      self.updateControlHints();
      overlay.classList.remove("visible");
      setTimeout(() => overlay.remove(), 300);
    }

    function escHandler(e: KeyboardEvent) {
      if (e.key === "Escape" && !capturing) {
        e.stopImmediatePropagation();
        close();
      }
    }
    document.addEventListener("keydown", escHandler, true);
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
