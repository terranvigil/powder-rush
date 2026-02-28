import { defaultCourseConfig, encodeCourse, decodeCourse, type CustomCourseConfig } from "../game/CourseCodec";
import { COURSE_PRESETS } from "../game/CoursePresets";
import { DesignerMap } from "./DesignerMap";
import type { CourseType } from "../game/LevelPresets";

const SAVE_KEY = "powder-rush-custom-courses";
const MAX_SLOTS = 5;

type Tab = "path" | "terrain" | "features" | "atmosphere" | "save";

export class CourseDesigner {
  private overlay: HTMLDivElement;
  private config: CustomCourseConfig;
  private map: DesignerMap;
  private sliderPanel: HTMLDivElement;
  private tabs: HTMLButtonElement[] = [];
  private activeTab: Tab = "path";
  private nameInput: HTMLInputElement;
  private resolveAction: ((action: { type: "play"; config: CustomCourseConfig } | { type: "back" }) => void) | null = null;
  private resizeObserver: ResizeObserver | null = null;

  constructor() {
    this.config = defaultCourseConfig();

    this.overlay = document.createElement("div");
    this.overlay.className = "designer-overlay";

    // Header bar
    const header = document.createElement("div");
    header.className = "designer-header";

    const backBtn = document.createElement("button");
    backBtn.className = "menu-btn designer-btn-small";
    backBtn.textContent = "BACK";
    backBtn.addEventListener("click", () => this.close("back"));

    this.nameInput = document.createElement("input");
    this.nameInput.className = "designer-name-input";
    this.nameInput.type = "text";
    this.nameInput.value = this.config.name;
    this.nameInput.maxLength = 20;
    this.nameInput.addEventListener("input", () => {
      this.config.name = this.nameInput.value || "My Course";
    });

    const playBtn = document.createElement("button");
    playBtn.className = "menu-btn designer-btn-small designer-btn-play";
    playBtn.textContent = "PLAY";
    playBtn.addEventListener("click", () => this.close("play"));

    header.appendChild(backBtn);
    header.appendChild(this.nameInput);
    header.appendChild(playBtn);
    this.overlay.appendChild(header);

    // Content area: map + panel
    const content = document.createElement("div");
    content.className = "designer-content";

    // Map container
    const mapContainer = document.createElement("div");
    mapContainer.className = "designer-map-container";
    this.map = new DesignerMap(this.config, () => this.onMapChange());
    mapContainer.appendChild(this.map.canvas);
    content.appendChild(mapContainer);

    // Right panel with tabs
    const rightPanel = document.createElement("div");
    rightPanel.className = "designer-right-panel";

    // Tab bar
    const tabBar = document.createElement("div");
    tabBar.className = "designer-tab-bar";
    const tabDefs: { id: Tab; label: string }[] = [
      { id: "path", label: "PATH" },
      { id: "terrain", label: "TERRAIN" },
      { id: "features", label: "FEATURES" },
      { id: "atmosphere", label: "ATMOS" },
      { id: "save", label: "SAVE" },
    ];
    for (const td of tabDefs) {
      const btn = document.createElement("button");
      btn.className = "designer-tab";
      btn.textContent = td.label;
      btn.addEventListener("click", () => this.setTab(td.id));
      tabBar.appendChild(btn);
      this.tabs.push(btn);
    }
    rightPanel.appendChild(tabBar);

    // Slider panel (content changes per tab)
    this.sliderPanel = document.createElement("div");
    this.sliderPanel.className = "designer-slider-panel";
    rightPanel.appendChild(this.sliderPanel);

    content.appendChild(rightPanel);
    this.overlay.appendChild(content);

    this.injectStyles();
  }

  show(): Promise<{ type: "play"; config: CustomCourseConfig } | { type: "back" }> {
    document.body.appendChild(this.overlay);
    requestAnimationFrame(() => {
      this.overlay.classList.add("visible");
      this.map.resize();
      this.setTab("path");
    });

    this.resizeObserver = new ResizeObserver(() => this.map.resize());
    const mapContainer = this.overlay.querySelector(".designer-map-container");
    if (mapContainer) this.resizeObserver.observe(mapContainer);

    return new Promise((resolve) => {
      this.resolveAction = resolve;
    });
  }

  private close(type: "play" | "back"): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    this.overlay.classList.remove("visible");
    setTimeout(() => {
      this.overlay.remove();
      if (this.resolveAction) {
        if (type === "play") {
          this.resolveAction({ type: "play", config: { ...this.config } });
        } else {
          this.resolveAction({ type: "back" });
        }
      }
    }, 300);
  }

  private onMapChange(): void {
    // Map changed waypoints — refresh path tab if active
    if (this.activeTab === "path") {
      this.renderTab();
    }
  }

  private setTab(tab: Tab): void {
    this.activeTab = tab;
    this.tabs.forEach((btn, i) => {
      const tabIds: Tab[] = ["path", "terrain", "features", "atmosphere", "save"];
      btn.classList.toggle("active", tabIds[i] === tab);
    });
    this.renderTab();
  }

  private renderTab(): void {
    this.sliderPanel.innerHTML = "";

    switch (this.activeTab) {
      case "path": this.renderPathTab(); break;
      case "terrain": this.renderTerrainTab(); break;
      case "features": this.renderFeaturesTab(); break;
      case "atmosphere": this.renderAtmosphereTab(); break;
      case "save": this.renderSaveTab(); break;
    }
  }

  private renderPathTab(): void {
    this.addSlider("Course Length", 600, 2400, 100, this.config.length, `${this.config.length}m`, (v) => {
      this.config.length = v;
      this.map.setConfig(this.config);
    });

    this.addSlider("Waypoints", 6, 20, 1, this.config.waypoints.length, `${this.config.waypoints.length}`, (v) => {
      this.adjustWaypoints(v);
      this.map.setConfig(this.config);
      this.renderTab(); // Refresh
    });

    // Per-waypoint info (read-only summary)
    const info = document.createElement("p");
    info.className = "designer-info";
    info.textContent = "Drag waypoints on the map to shape the course. Diamond handles adjust width.";
    this.sliderPanel.appendChild(info);
  }

  private renderTerrainTab(): void {
    const steepLabels = ["Gentle", "Moderate", "Steep", "Extreme"];
    const steepIdx = Math.round((this.config.steepness - 0.08) / (0.25 - 0.08) * 3);
    this.addSlider("Steepness", 0.08, 0.25, 0.01, this.config.steepness, steepLabels[Math.min(3, steepIdx)], (v) => {
      this.config.steepness = v;
    });

    this.addSlider("Bowl Depth", 0, 0.01, 0.001, this.config.bowlDepth,
      this.config.bowlDepth < 0.003 ? "Flat" : this.config.bowlDepth < 0.007 ? "Moderate" : "Deep",
      (v) => { this.config.bowlDepth = v; });

    this.addSlider("Roughness", 0, 1, 0.05, this.config.roughness,
      this.config.roughness < 0.3 ? "Groomed" : this.config.roughness < 0.7 ? "Natural" : "Extreme",
      (v) => { this.config.roughness = v; });

    this.addSlider("Moguls", 0, 1, 0.05, this.config.mogulIntensity,
      this.config.mogulIntensity < 0.1 ? "None" : `${Math.round(this.config.mogulIntensity * 100)}%`,
      (v) => { this.config.mogulIntensity = v; });
  }

  private renderFeaturesTab(): void {
    // Tool selector
    const toolRow = document.createElement("div");
    toolRow.className = "designer-tool-row";
    const tools: { id: "none" | "jump" | "eraser"; label: string }[] = [
      { id: "none", label: "SELECT" },
      { id: "jump", label: "JUMP" },
      { id: "eraser", label: "ERASE" },
    ];
    for (const tool of tools) {
      const btn = document.createElement("button");
      btn.className = "designer-tool-btn";
      btn.textContent = tool.label;
      btn.addEventListener("click", () => {
        this.map.setTool(tool.id);
        toolRow.querySelectorAll("button").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
      });
      if (tool.id === "none") btn.classList.add("active");
      toolRow.appendChild(btn);
    }
    this.sliderPanel.appendChild(toolRow);

    const info = document.createElement("p");
    info.className = "designer-info";
    info.textContent = `Jumps: ${this.config.jumps.length}/12. Click map to place, ERASE to remove.`;
    this.sliderPanel.appendChild(info);

    // Course type
    const typeRow = document.createElement("div");
    typeRow.className = "designer-row";
    const typeLabel = document.createElement("label");
    typeLabel.textContent = "Type";
    typeLabel.className = "designer-label";
    typeRow.appendChild(typeLabel);

    const typeSelect = document.createElement("select");
    typeSelect.className = "designer-select";
    const courseTypes: { value: CourseType; label: string }[] = [
      { value: "downhill", label: "Downhill" },
      { value: "terrainPark", label: "Terrain Park" },
      { value: "moguls", label: "Moguls" },
      { value: "halfPipe", label: "Half-Pipe" },
      { value: "slalom", label: "Slalom" },
      { value: "superG", label: "Super G" },
    ];
    for (const ct of courseTypes) {
      const opt = document.createElement("option");
      opt.value = ct.value;
      opt.textContent = ct.label;
      if (this.config.courseType === ct.value) opt.selected = true;
      typeSelect.appendChild(opt);
    }
    typeSelect.addEventListener("change", () => {
      this.config.courseType = typeSelect.value as CourseType;
    });
    typeRow.appendChild(typeSelect);
    this.sliderPanel.appendChild(typeRow);

    this.addSlider("Trees", 0, 1, 0.05, this.config.treeDensity,
      this.config.treeDensity < 0.2 ? "Barren" : this.config.treeDensity < 0.5 ? "Sparse" : this.config.treeDensity < 0.8 ? "Dense" : "Forest",
      (v) => { this.config.treeDensity = v; });

    this.addSlider("Obstacles", 0, 1, 0.05, this.config.obstacleDensity,
      this.config.obstacleDensity < 0.1 ? "None" : this.config.obstacleDensity < 0.4 ? "Light" : this.config.obstacleDensity < 0.7 ? "Moderate" : "Heavy",
      (v) => { this.config.obstacleDensity = v; });

    this.addSlider("Coins", 0, 50, 1, this.config.coinCount, `${this.config.coinCount}`, (v) => {
      this.config.coinCount = v;
    });
  }

  private renderAtmosphereTab(): void {
    // Preset buttons
    const presetRow = document.createElement("div");
    presetRow.className = "designer-preset-row";
    const presets: { id: CustomCourseConfig["atmospherePreset"]; label: string; color: string }[] = [
      { id: "morning", label: "MORN", color: "#ffcc77" },
      { id: "midday", label: "MID", color: "#88bbff" },
      { id: "sunset", label: "DUSK", color: "#ff8855" },
      { id: "night", label: "NIGHT", color: "#334466" },
    ];
    for (const p of presets) {
      const btn = document.createElement("button");
      btn.className = "designer-atmos-btn";
      btn.style.borderColor = p.color;
      btn.textContent = p.label;
      if (this.config.atmospherePreset === p.id) btn.classList.add("active");
      btn.addEventListener("click", () => {
        this.config.atmospherePreset = p.id;
        presetRow.querySelectorAll("button").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
      });
      presetRow.appendChild(btn);
    }
    this.sliderPanel.appendChild(presetRow);

    this.addSlider("Fog", 0, 1, 0.05, this.config.fogDensity,
      this.config.fogDensity < 0.2 ? "Clear" : this.config.fogDensity < 0.5 ? "Light" : this.config.fogDensity < 0.8 ? "Medium" : "Heavy",
      (v) => { this.config.fogDensity = v; });

    this.addSlider("Snow", 0, 2, 0.1, this.config.snowIntensity,
      this.config.snowIntensity < 0.3 ? "None" : this.config.snowIntensity < 0.8 ? "Flurries" : this.config.snowIntensity < 1.5 ? "Moderate" : "Blizzard",
      (v) => { this.config.snowIntensity = v; });

    this.addSlider("Seed", 1, 999, 1, this.config.seed, `#${this.config.seed}`, (v) => {
      this.config.seed = v;
    });
  }

  private renderSaveTab(): void {
    const saves = this.loadSaves();

    // Save slots
    for (let i = 0; i < MAX_SLOTS; i++) {
      const row = document.createElement("div");
      row.className = "designer-save-row";

      const label = document.createElement("span");
      label.className = "designer-save-label";
      label.textContent = saves[i] ? saves[i]!.name : `Slot ${i + 1} (empty)`;
      row.appendChild(label);

      const saveBtn = document.createElement("button");
      saveBtn.className = "designer-save-btn";
      saveBtn.textContent = "SAVE";
      saveBtn.addEventListener("click", () => {
        saves[i] = { ...this.config };
        this.persistSaves(saves);
        this.renderTab();
      });
      row.appendChild(saveBtn);

      if (saves[i]) {
        const loadBtn = document.createElement("button");
        loadBtn.className = "designer-save-btn";
        loadBtn.textContent = "LOAD";
        loadBtn.addEventListener("click", () => {
          this.config = { ...saves[i]! };
          this.nameInput.value = this.config.name;
          this.map.setConfig(this.config);
          this.renderTab();
        });
        row.appendChild(loadBtn);

        const delBtn = document.createElement("button");
        delBtn.className = "designer-save-btn designer-save-del";
        delBtn.textContent = "X";
        delBtn.addEventListener("click", () => {
          saves[i] = null;
          this.persistSaves(saves);
          this.renderTab();
        });
        row.appendChild(delBtn);
      }

      this.sliderPanel.appendChild(row);
    }

    // Separator
    const sep = document.createElement("hr");
    sep.className = "designer-sep";
    this.sliderPanel.appendChild(sep);

    // Course code share
    const codeRow = document.createElement("div");
    codeRow.className = "designer-code-row";

    const copyBtn = document.createElement("button");
    copyBtn.className = "menu-btn designer-btn-small";
    copyBtn.textContent = "COPY CODE";
    copyBtn.addEventListener("click", () => {
      const code = encodeCourse(this.config);
      navigator.clipboard.writeText(code).then(() => {
        copyBtn.textContent = "COPIED!";
        setTimeout(() => { copyBtn.textContent = "COPY CODE"; }, 1500);
      });
    });
    codeRow.appendChild(copyBtn);
    this.sliderPanel.appendChild(codeRow);

    const pasteRow = document.createElement("div");
    pasteRow.className = "designer-code-row";
    const codeInput = document.createElement("input");
    codeInput.className = "designer-code-input";
    codeInput.type = "text";
    codeInput.placeholder = "Paste code...";

    const loadCodeBtn = document.createElement("button");
    loadCodeBtn.className = "designer-save-btn";
    loadCodeBtn.textContent = "LOAD";
    loadCodeBtn.addEventListener("click", () => {
      const decoded = decodeCourse(codeInput.value);
      if (decoded) {
        this.config = decoded;
        this.nameInput.value = this.config.name;
        this.map.setConfig(this.config);
        this.renderTab();
      } else {
        codeInput.style.borderColor = "red";
        setTimeout(() => { codeInput.style.borderColor = ""; }, 1000);
      }
    });
    pasteRow.appendChild(codeInput);
    pasteRow.appendChild(loadCodeBtn);
    this.sliderPanel.appendChild(pasteRow);

    // Separator
    const sep2 = document.createElement("hr");
    sep2.className = "designer-sep";
    this.sliderPanel.appendChild(sep2);

    // Preset courses
    const presetsLabel = document.createElement("p");
    presetsLabel.className = "designer-info";
    presetsLabel.textContent = "PRESETS";
    this.sliderPanel.appendChild(presetsLabel);

    for (const p of COURSE_PRESETS) {
      const btn = document.createElement("button");
      btn.className = "designer-preset-course-btn";
      btn.textContent = p.label;
      btn.addEventListener("click", () => {
        this.config = { ...p.config };
        this.nameInput.value = this.config.name;
        this.map.setConfig(this.config);
        this.setTab("path");
      });
      this.sliderPanel.appendChild(btn);
    }
  }

  private addSlider(
    label: string, min: number, max: number, step: number,
    value: number, display: string, onChange: (v: number) => void,
  ): void {
    const row = document.createElement("div");
    row.className = "designer-row";

    const lbl = document.createElement("label");
    lbl.className = "designer-label";
    lbl.textContent = label;
    row.appendChild(lbl);

    const valSpan = document.createElement("span");
    valSpan.className = "designer-value";
    valSpan.textContent = display;
    row.appendChild(valSpan);

    const slider = document.createElement("input");
    slider.className = "designer-slider";
    slider.type = "range";
    slider.min = String(min);
    slider.max = String(max);
    slider.step = String(step);
    slider.value = String(value);
    slider.addEventListener("input", () => {
      const v = parseFloat(slider.value);
      onChange(v);
      // Update display
      valSpan.textContent = this.getSliderDisplay(label, v);
    });
    row.appendChild(slider);

    this.sliderPanel.appendChild(row);
  }

  private getSliderDisplay(label: string, v: number): string {
    switch (label) {
      case "Course Length": return `${v}m`;
      case "Waypoints": return `${v}`;
      case "Steepness": {
        const labels = ["Gentle", "Moderate", "Steep", "Extreme"];
        const idx = Math.round((v - 0.08) / (0.25 - 0.08) * 3);
        return labels[Math.min(3, idx)];
      }
      case "Bowl Depth": return v < 0.003 ? "Flat" : v < 0.007 ? "Moderate" : "Deep";
      case "Roughness": return v < 0.3 ? "Groomed" : v < 0.7 ? "Natural" : "Extreme";
      case "Moguls": return v < 0.1 ? "None" : `${Math.round(v * 100)}%`;
      case "Trees": return v < 0.2 ? "Barren" : v < 0.5 ? "Sparse" : v < 0.8 ? "Dense" : "Forest";
      case "Obstacles": return v < 0.1 ? "None" : v < 0.4 ? "Light" : v < 0.7 ? "Moderate" : "Heavy";
      case "Coins": return `${v}`;
      case "Fog": return v < 0.2 ? "Clear" : v < 0.5 ? "Light" : v < 0.8 ? "Medium" : "Heavy";
      case "Snow": return v < 0.3 ? "None" : v < 0.8 ? "Flurries" : v < 1.5 ? "Moderate" : "Blizzard";
      case "Seed": return `#${v}`;
      default: return `${v}`;
    }
  }

  private adjustWaypoints(target: number): void {
    const wps = this.config.waypoints;
    while (wps.length < target) {
      // Add evenly distributed waypoint
      const z = wps.length / target;
      wps.push({ z, x: 0, width: 25 });
    }
    while (wps.length > target) {
      // Remove middle waypoints (keep first and last)
      if (wps.length > 2) {
        wps.splice(Math.floor(wps.length / 2), 1);
      }
    }
    // Redistribute Z evenly
    for (let i = 0; i < wps.length; i++) {
      wps[i].z = i / (wps.length - 1);
    }
  }

  private loadSaves(): (CustomCourseConfig | null)[] {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return new Array(MAX_SLOTS).fill(null);
      const arr = JSON.parse(raw) as (CustomCourseConfig | null)[];
      while (arr.length < MAX_SLOTS) arr.push(null);
      return arr.slice(0, MAX_SLOTS);
    } catch {
      return new Array(MAX_SLOTS).fill(null);
    }
  }

  private persistSaves(saves: (CustomCourseConfig | null)[]): void {
    localStorage.setItem(SAVE_KEY, JSON.stringify(saves));
  }

  private injectStyles(): void {
    if (document.getElementById("designer-styles")) return;
    const style = document.createElement("style");
    style.id = "designer-styles";
    style.textContent = `
      .designer-overlay {
        position: fixed;
        inset: 0;
        z-index: 100;
        background: linear-gradient(180deg, #0a0a1a 0%, #0f1e3d 100%);
        font-family: 'Press Start 2P', monospace;
        color: #c0c8d4;
        display: flex;
        flex-direction: column;
        opacity: 0;
        transition: opacity 0.3s;
      }
      .designer-overlay.visible { opacity: 1; }

      .designer-header {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 16px;
        background: rgba(0, 0, 0, 0.3);
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      }
      .designer-btn-small {
        width: auto;
        padding: 8px 16px;
        font-size: 10px;
      }
      .designer-btn-play {
        background: rgba(100, 200, 255, 0.3) !important;
        border-color: rgba(100, 200, 255, 0.6) !important;
      }
      .designer-name-input {
        flex: 1;
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 4px;
        padding: 8px 12px;
        font-family: 'Press Start 2P', monospace;
        font-size: 10px;
        color: #fff;
        outline: none;
      }
      .designer-name-input:focus {
        border-color: rgba(100, 200, 255, 0.5);
      }

      .designer-content {
        flex: 1;
        display: flex;
        overflow: hidden;
      }
      @media (max-width: 768px) {
        .designer-content {
          flex-direction: column;
        }
        .designer-map-container {
          height: 40vh !important;
          width: 100% !important;
        }
        .designer-right-panel {
          width: 100% !important;
          height: 60vh !important;
        }
      }

      .designer-map-container {
        flex: 1;
        min-width: 0;
        position: relative;
      }
      .designer-map-canvas {
        width: 100%;
        height: 100%;
        display: block;
      }

      .designer-right-panel {
        width: 320px;
        flex-shrink: 0;
        display: flex;
        flex-direction: column;
        border-left: 1px solid rgba(255, 255, 255, 0.1);
        background: rgba(0, 0, 0, 0.2);
      }

      .designer-tab-bar {
        display: flex;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      }
      .designer-tab {
        flex: 1;
        padding: 8px 4px;
        font-family: 'Press Start 2P', monospace;
        font-size: 7px;
        color: rgba(255, 255, 255, 0.4);
        background: transparent;
        border: none;
        border-bottom: 2px solid transparent;
        cursor: pointer;
        transition: color 0.15s, border-color 0.15s;
      }
      .designer-tab:hover { color: rgba(255, 255, 255, 0.7); }
      .designer-tab.active {
        color: #8af;
        border-bottom-color: #8af;
      }

      .designer-slider-panel {
        flex: 1;
        overflow-y: auto;
        padding: 12px;
      }

      .designer-row {
        margin-bottom: 14px;
      }
      .designer-label {
        display: block;
        font-size: 8px;
        color: rgba(255, 255, 255, 0.6);
        margin-bottom: 4px;
      }
      .designer-value {
        float: right;
        font-size: 8px;
        color: #8af;
      }
      .designer-slider {
        width: 100%;
        -webkit-appearance: none;
        appearance: none;
        height: 6px;
        background: rgba(255, 255, 255, 0.12);
        border-radius: 3px;
        outline: none;
        margin-top: 4px;
      }
      .designer-slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: 14px;
        height: 14px;
        background: #8af;
        border-radius: 50%;
        cursor: pointer;
      }
      .designer-slider::-moz-range-thumb {
        width: 14px;
        height: 14px;
        background: #8af;
        border-radius: 50%;
        border: none;
        cursor: pointer;
      }

      .designer-info {
        font-size: 7px;
        color: rgba(255, 255, 255, 0.4);
        line-height: 1.8;
        margin: 8px 0;
      }

      .designer-tool-row {
        display: flex;
        gap: 4px;
        margin-bottom: 12px;
      }
      .designer-tool-btn {
        flex: 1;
        padding: 6px 4px;
        font-family: 'Press Start 2P', monospace;
        font-size: 7px;
        color: rgba(255, 255, 255, 0.5);
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 4px;
        cursor: pointer;
      }
      .designer-tool-btn:hover { color: #fff; background: rgba(255, 255, 255, 0.1); }
      .designer-tool-btn.active {
        color: #8af;
        background: rgba(100, 200, 255, 0.15);
        border-color: rgba(100, 200, 255, 0.4);
      }

      .designer-select {
        width: 100%;
        padding: 6px 8px;
        font-family: 'Press Start 2P', monospace;
        font-size: 8px;
        color: #fff;
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 4px;
        outline: none;
        margin-top: 4px;
      }
      .designer-select option {
        background: #0a0f1a;
        color: #fff;
      }

      .designer-preset-row {
        display: flex;
        gap: 4px;
        margin-bottom: 12px;
      }
      .designer-atmos-btn {
        flex: 1;
        padding: 8px 4px;
        font-family: 'Press Start 2P', monospace;
        font-size: 7px;
        color: rgba(255, 255, 255, 0.6);
        background: rgba(255, 255, 255, 0.05);
        border: 2px solid rgba(255, 255, 255, 0.2);
        border-radius: 4px;
        cursor: pointer;
      }
      .designer-atmos-btn:hover { color: #fff; }
      .designer-atmos-btn.active {
        color: #fff;
        background: rgba(255, 255, 255, 0.1);
      }

      .designer-save-row {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 8px;
        padding: 6px 8px;
        background: rgba(255, 255, 255, 0.03);
        border-radius: 4px;
      }
      .designer-save-label {
        flex: 1;
        font-size: 7px;
        color: rgba(255, 255, 255, 0.6);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .designer-save-btn {
        padding: 4px 8px;
        font-family: 'Press Start 2P', monospace;
        font-size: 6px;
        color: #8af;
        background: rgba(100, 200, 255, 0.1);
        border: 1px solid rgba(100, 200, 255, 0.3);
        border-radius: 3px;
        cursor: pointer;
      }
      .designer-save-btn:hover {
        background: rgba(100, 200, 255, 0.2);
      }
      .designer-save-del {
        color: #f44;
        background: rgba(255, 68, 68, 0.1);
        border-color: rgba(255, 68, 68, 0.3);
      }

      .designer-sep {
        border: none;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
        margin: 12px 0;
      }

      .designer-code-row {
        display: flex;
        gap: 6px;
        margin-bottom: 8px;
      }
      .designer-code-input {
        flex: 1;
        padding: 6px 8px;
        font-family: 'Press Start 2P', monospace;
        font-size: 7px;
        color: #fff;
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 4px;
        outline: none;
      }

      .designer-preset-course-btn {
        display: block;
        width: 100%;
        padding: 8px;
        margin-bottom: 4px;
        font-family: 'Press Start 2P', monospace;
        font-size: 7px;
        color: rgba(255, 255, 255, 0.7);
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 4px;
        cursor: pointer;
        text-align: left;
      }
      .designer-preset-course-btn:hover {
        color: #fff;
        background: rgba(255, 255, 255, 0.08);
        border-color: rgba(255, 255, 255, 0.2);
      }
    `;
    document.head.appendChild(style);
  }

  dispose(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    this.map.dispose();
    this.overlay.remove();
    const style = document.getElementById("designer-styles");
    if (style) style.remove();
  }
}
