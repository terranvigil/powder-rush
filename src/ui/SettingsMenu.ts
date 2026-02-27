import { AudioManager } from "../audio/AudioManager";

const STORAGE_KEY = "powder-rush-settings";

interface SavedSettings {
  musicVolume: number;
  sfxVolume: number;
  musicMuted: boolean;
  sfxMuted: boolean;
}

export class SettingsMenu {
  private overlay: HTMLDivElement;
  private musicToggle: HTMLInputElement;
  private sfxToggle: HTMLInputElement;
  private musicSlider: HTMLInputElement;
  private sfxSlider: HTMLInputElement;
  private isOpen = false;

  constructor(
    private audio: AudioManager,
    private onPauseChange: (paused: boolean) => void,
  ) {
    // Gear button
    const btn = document.createElement("button");
    btn.id = "settings-btn";
    btn.innerHTML = "&#9881;";
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

    this.overlay.appendChild(panel);
    document.body.appendChild(this.overlay);

    // Event listeners
    this.musicToggle.addEventListener("change", () => this.applyAndSave());
    this.sfxToggle.addEventListener("change", () => this.applyAndSave());
    this.musicSlider.addEventListener("input", () => this.applyAndSave());
    this.sfxSlider.addEventListener("input", () => this.applyAndSave());

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

    const settings: SavedSettings = {
      musicVolume: musicVol,
      sfxVolume: sfxVol,
      musicMuted,
      sfxMuted,
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
    } catch { /* ignore corrupt data */ }
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
