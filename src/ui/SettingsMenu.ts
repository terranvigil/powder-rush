import { AudioManager } from "../audio/AudioManager";
import { keyBindings, Action } from "../player/KeyBindings";

const STORAGE_KEY = "powder-rush-settings";

interface SavedSettings {
  musicVolume: number;
  sfxVolume: number;
  musicMuted: boolean;
  sfxMuted: boolean;
  chairliftsEnabled?: boolean;
  gravityMultiplier?: number;
}

export class SettingsMenu {
  private overlay: HTMLDivElement;
  private musicToggle: HTMLInputElement;
  private sfxToggle: HTMLInputElement;
  private musicSlider: HTMLInputElement;
  private sfxSlider: HTMLInputElement;
  private chairliftToggle: HTMLInputElement;
  private gravitySlider: HTMLInputElement;
  private gravityValueLabel: HTMLSpanElement;
  private onChairliftToggle: ((enabled: boolean) => void) | null;
  private onGravityChange: ((multiplier: number) => void) | null;
  private isOpen = false;
  private keybindButtons = new Map<Action, HTMLButtonElement>();
  private capturing: Action | null = null;
  private captureHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor(
    private audio: AudioManager,
    private onPauseChange: (paused: boolean) => void,
    onChairliftToggle?: (enabled: boolean) => void,
    onGravityChange?: (multiplier: number) => void,
  ) {
    this.onChairliftToggle = onChairliftToggle ?? null;
    this.onGravityChange = onGravityChange ?? null;
    // Gear button
    const btn = document.createElement("button");
    btn.id = "settings-btn";
    btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M7.5 1h3l.5 2.1a6 6 0 011.4.8l2-.8 1.5 2.6-1.6 1.3a6 6 0 010 1.6l1.6 1.3-1.5 2.6-2-.8a6 6 0 01-1.4.8L10.5 17h-3l-.5-2.1a6 6 0 01-1.4-.8l-2 .8L2.1 12.3l1.6-1.3a6 6 0 010-1.6L2.1 8.1l1.5-2.6 2 .8A6 6 0 017 5.5L7.5 1z" stroke="rgba(255,255,255,0.7)" stroke-width="1.5" fill="none"/>
      <circle cx="9" cy="9" r="2.5" stroke="rgba(255,255,255,0.7)" stroke-width="1.5" fill="none"/>
    </svg>`;
    btn.addEventListener("click", () => this.toggle());
    document.body.appendChild(btn);

    // Overlay
    this.overlay = document.createElement("div");
    this.overlay.id = "settings-overlay";
    this.overlay.addEventListener("click", (e) => {
      if (e.target === this.overlay) this.close();
    });

    // Panel
    const panel = document.createElement("div");
    panel.id = "settings-panel";

    // Header
    const header = document.createElement("div");
    header.className = "settings-header";
    header.innerHTML = `<h2>SETTINGS</h2>`;
    const closeBtn = document.createElement("button");
    closeBtn.className = "settings-close";
    closeBtn.textContent = "X";
    closeBtn.addEventListener("click", () => this.close());
    header.appendChild(closeBtn);
    panel.appendChild(header);

    // Music row
    const musicRow = document.createElement("div");
    musicRow.className = "settings-row";
    const musicLabel = document.createElement("label");
    musicLabel.textContent = "MUSIC";
    this.musicToggle = this.createToggle(true);
    this.musicSlider = this.createSlider(50);
    musicRow.append(musicLabel, this.createToggleWrap(this.musicToggle), this.musicSlider);
    panel.appendChild(musicRow);

    // Sound row
    const sfxRow = document.createElement("div");
    sfxRow.className = "settings-row";
    const sfxLabel = document.createElement("label");
    sfxLabel.textContent = "SOUND";
    this.sfxToggle = this.createToggle(true);
    this.sfxSlider = this.createSlider(60);
    sfxRow.append(sfxLabel, this.createToggleWrap(this.sfxToggle), this.sfxSlider);
    panel.appendChild(sfxRow);

    // Chairlift row
    const liftRow = document.createElement("div");
    liftRow.className = "settings-row";
    const liftLabel = document.createElement("label");
    liftLabel.textContent = "LIFTS";
    this.chairliftToggle = this.createToggle(true);
    liftRow.append(liftLabel, this.createToggleWrap(this.chairliftToggle));
    panel.appendChild(liftRow);

    // Gravity slider row
    const gravRow = document.createElement("div");
    gravRow.className = "settings-row";
    const gravLabel = document.createElement("label");
    gravLabel.textContent = "GRAVITY";
    this.gravitySlider = document.createElement("input");
    this.gravitySlider.type = "range";
    this.gravitySlider.min = "50";
    this.gravitySlider.max = "200";
    this.gravitySlider.value = "100";
    this.gravitySlider.className = "vol-slider";
    this.gravityValueLabel = document.createElement("span");
    this.gravityValueLabel.textContent = "1.0x";
    this.gravityValueLabel.style.cssText = "font-size:9px;min-width:36px;text-align:right;color:rgba(255,255,255,0.7)";
    gravRow.append(gravLabel, this.gravitySlider, this.gravityValueLabel);
    panel.appendChild(gravRow);

    // Controls section
    const controlsHeader = document.createElement("div");
    controlsHeader.className = "settings-section-header";
    controlsHeader.textContent = "CONTROLS";
    panel.appendChild(controlsHeader);

    for (const action of keyBindings.actions) {
      const row = document.createElement("div");
      row.className = "keybind-row";
      const label = document.createElement("label");
      label.textContent = keyBindings.actionLabel(action);
      const btn = document.createElement("button");
      btn.className = "keybind-btn";
      btn.textContent = keyBindings.displayName(keyBindings.get(action));
      btn.addEventListener("click", () => this.startCapture(action));
      this.keybindButtons.set(action, btn);
      row.append(label, btn);
      panel.appendChild(row);
    }

    const resetBtn = document.createElement("button");
    resetBtn.className = "keybind-reset";
    resetBtn.textContent = "RESET DEFAULTS";
    resetBtn.addEventListener("click", () => this.resetBindings());
    panel.appendChild(resetBtn);

    // Resume button
    const resumeBtn = document.createElement("button");
    resumeBtn.className = "menu-btn";
    resumeBtn.textContent = "RESUME";
    resumeBtn.style.marginTop = "20px";
    resumeBtn.addEventListener("click", () => this.close());
    panel.appendChild(resumeBtn);

    // Exit button
    const exitBtn = document.createElement("button");
    exitBtn.className = "menu-btn menu-btn-secondary";
    exitBtn.textContent = "EXIT";
    exitBtn.addEventListener("click", () => location.reload());
    panel.appendChild(exitBtn);

    this.overlay.appendChild(panel);
    document.body.appendChild(this.overlay);

    // Event listeners
    this.musicToggle.addEventListener("change", () => this.applyAndSave());
    this.sfxToggle.addEventListener("change", () => this.applyAndSave());
    this.musicSlider.addEventListener("input", () => this.applyAndSave());
    this.sfxSlider.addEventListener("input", () => this.applyAndSave());
    this.chairliftToggle.addEventListener("change", () => this.applyAndSave());
    this.gravitySlider.addEventListener("input", () => this.applyAndSave());

    // ESC toggles settings menu
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        this.toggle();
      }
    });

    // Load saved settings
    this.loadSettings();
  }

  toggle(): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  private open(): void {
    // Sync UI with current audio state
    this.musicToggle.checked = !this.audio.isMusicMuted();
    this.sfxToggle.checked = !this.audio.isSfxMuted();
    this.musicSlider.value = String(Math.round(this.audio.getMusicVolume() * 100));
    this.sfxSlider.value = String(Math.round(this.audio.getSfxVolume() * 100));
    this.musicSlider.disabled = this.audio.isMusicMuted();
    this.sfxSlider.disabled = this.audio.isSfxMuted();
    this.isOpen = true;
    this.overlay.classList.add("open");
    this.onPauseChange(true);
  }

  private close(): void {
    this.stopCapture();
    this.isOpen = false;
    this.overlay.classList.remove("open");
    this.onPauseChange(false);
  }

  private applyAndSave(): void {
    const musicMuted = !this.musicToggle.checked;
    const sfxMuted = !this.sfxToggle.checked;
    const musicVol = parseInt(this.musicSlider.value) / 100;
    const sfxVol = parseInt(this.sfxSlider.value) / 100;

    this.audio.setMusicVolume(musicVol);
    this.audio.setSfxVolume(sfxVol);
    this.audio.setMusicMuted(musicMuted);
    this.audio.setSfxMuted(sfxMuted);

    this.musicSlider.disabled = musicMuted;
    this.sfxSlider.disabled = sfxMuted;

    const chairliftsEnabled = this.chairliftToggle.checked;
    if (this.onChairliftToggle) this.onChairliftToggle(chairliftsEnabled);

    const gravityPct = parseInt(this.gravitySlider.value);
    const gravityMul = gravityPct / 100;
    this.gravityValueLabel.textContent = gravityMul.toFixed(1) + "x";
    if (this.onGravityChange) this.onGravityChange(gravityMul);

    const settings: SavedSettings = {
      musicVolume: musicVol,
      sfxVolume: sfxVol,
      musicMuted,
      sfxMuted,
      chairliftsEnabled,
      gravityMultiplier: gravityMul,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }

  private loadSettings(): void {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const s: SavedSettings = JSON.parse(raw);
      this.audio.setMusicVolume(s.musicVolume);
      this.audio.setSfxVolume(s.sfxVolume);
      this.audio.setMusicMuted(s.musicMuted);
      this.audio.setSfxMuted(s.sfxMuted);

      this.musicSlider.value = String(Math.round(s.musicVolume * 100));
      this.sfxSlider.value = String(Math.round(s.sfxVolume * 100));
      this.musicToggle.checked = !s.musicMuted;
      this.sfxToggle.checked = !s.sfxMuted;
      this.musicSlider.disabled = s.musicMuted;
      this.sfxSlider.disabled = s.sfxMuted;

      if (s.chairliftsEnabled !== undefined) {
        this.chairliftToggle.checked = s.chairliftsEnabled;
        if (this.onChairliftToggle) this.onChairliftToggle(s.chairliftsEnabled);
      }

      if (s.gravityMultiplier !== undefined) {
        const pct = Math.round(s.gravityMultiplier * 100);
        this.gravitySlider.value = String(pct);
        this.gravityValueLabel.textContent = s.gravityMultiplier.toFixed(1) + "x";
        if (this.onGravityChange) this.onGravityChange(s.gravityMultiplier);
      }
    } catch { /* ignore corrupt data */ }
  }

  private startCapture(action: Action): void {
    // Cancel any existing capture
    this.stopCapture();

    this.capturing = action;
    const btn = this.keybindButtons.get(action)!;
    btn.textContent = "...";
    btn.classList.add("capturing");

    this.captureHandler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      const code = e.code;

      // ESC cancels capture (doesn't close settings)
      if (code === "Escape") {
        this.stopCapture();
        return;
      }

      // Blocked keys flash red
      if (keyBindings.isBlocked(code)) {
        btn.classList.remove("invalid");
        void btn.offsetWidth; // reflow to restart animation
        btn.classList.add("invalid");
        return;
      }

      // Bind the key
      const swapped = keyBindings.set(action, code);
      this.stopCapture();

      // Update all buttons to reflect new state
      this.refreshKeybindButtons();

      // Flash gold on swapped button
      if (swapped) {
        const swappedBtn = this.keybindButtons.get(swapped)!;
        swappedBtn.classList.add("swapped");
        setTimeout(() => swappedBtn.classList.remove("swapped"), 500);
      }
    };

    document.addEventListener("keydown", this.captureHandler, true);
  }

  private stopCapture(): void {
    if (this.captureHandler) {
      document.removeEventListener("keydown", this.captureHandler, true);
      this.captureHandler = null;
    }
    if (this.capturing) {
      const btn = this.keybindButtons.get(this.capturing)!;
      btn.classList.remove("capturing");
      btn.textContent = keyBindings.displayName(keyBindings.get(this.capturing));
      this.capturing = null;
    }
  }

  private refreshKeybindButtons(): void {
    for (const action of keyBindings.actions) {
      const btn = this.keybindButtons.get(action)!;
      btn.textContent = keyBindings.displayName(keyBindings.get(action));
    }
  }

  private resetBindings(): void {
    this.stopCapture();
    keyBindings.reset();
    this.refreshKeybindButtons();
  }

  private createToggle(checked: boolean): HTMLInputElement {
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = checked;
    return input;
  }

  private createToggleWrap(input: HTMLInputElement): HTMLLabelElement {
    const label = document.createElement("label");
    label.className = "toggle-switch";
    const slider = document.createElement("span");
    slider.className = "toggle-slider";
    label.append(input, slider);
    return label;
  }

  private createSlider(value: number): HTMLInputElement {
    const input = document.createElement("input");
    input.type = "range";
    input.min = "0";
    input.max = "100";
    input.value = String(value);
    input.className = "vol-slider";
    return input;
  }
}
