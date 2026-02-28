import type { CustomCourseConfig } from "../game/CourseCodec";

const MAP_BG = "#0a0f1a";
const PATH_COLOR = "rgba(255, 255, 255, 0.15)";
const PATH_STROKE = "rgba(100, 200, 255, 0.5)";
const WAYPOINT_COLOR = "#8af";
const WAYPOINT_HOVER = "#fff";
const WAYPOINT_RADIUS = 8;
const JUMP_COLOR = "#ff8844";
const GRID_COLOR = "rgba(255, 255, 255, 0.06)";
const GRID_TEXT = "rgba(255, 255, 255, 0.2)";

type PlaceTool = "none" | "jump" | "eraser";

export class DesignerMap {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private config: CustomCourseConfig;
  private onChange: () => void;

  // View state
  private scrollY = 0;
  private zoom = 1;
  private canvasW = 0;
  private canvasH = 0;

  // Interaction state
  private dragWaypoint: number | null = null;
  private dragWidthWaypoint: number | null = null;
  private dragWidthSide: -1 | 1 = 1;
  private hoverWaypoint: number | null = null;
  private panStartY: number | null = null;
  private panStartScroll = 0;
  private activeTool: PlaceTool = "none";

  // Touch tracking
  private lastTouchY = 0;

  constructor(config: CustomCourseConfig, onChange: () => void) {
    this.config = config;
    this.onChange = onChange;

    this.canvas = document.createElement("canvas");
    this.canvas.className = "designer-map-canvas";
    this.ctx = this.canvas.getContext("2d")!;

    this.bindEvents();
  }

  setConfig(config: CustomCourseConfig): void {
    this.config = config;
    this.scrollY = 0;
    this.zoom = 1;
    this.draw();
  }

  setTool(tool: PlaceTool): void {
    this.activeTool = tool;
    this.canvas.style.cursor = tool === "none" ? "default" : "crosshair";
  }

  resize(): void {
    const rect = this.canvas.parentElement?.getBoundingClientRect();
    if (!rect) return;
    const dpr = window.devicePixelRatio || 1;
    this.canvasW = rect.width;
    this.canvasH = rect.height;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.draw();
  }

  draw(): void {
    const ctx = this.ctx;
    const w = this.canvasW;
    const h = this.canvasH;
    if (w === 0 || h === 0) return;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = MAP_BG;
    ctx.fillRect(0, 0, w, h);

    // Coordinate transforms: world Z (negative downhill) → screen Y
    // Screen maps course length vertically, X maps ±40m from center
    const courseLen = this.config.length;
    const metersPerPixel = courseLen / (h * this.zoom);
    const xScale = w / 80; // ±40m fits in canvas width

    const worldToScreenY = (z: number): number => {
      // z is fraction 0-1, convert to meters, then to pixels
      const meters = z * courseLen;
      return (meters / metersPerPixel) - this.scrollY;
    };

    const worldToScreenX = (x: number): number => {
      return w / 2 + x * xScale;
    };

    // Grid lines every 100m
    ctx.font = "9px 'Press Start 2P', monospace";
    ctx.fillStyle = GRID_TEXT;
    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 1;
    for (let m = 0; m <= courseLen; m += 100) {
      const sy = worldToScreenY(m / courseLen);
      if (sy < -20 || sy > h + 20) continue;
      ctx.beginPath();
      ctx.moveTo(0, sy);
      ctx.lineTo(w, sy);
      ctx.stroke();
      ctx.fillText(`${m}m`, 4, sy - 3);
    }

    // Draw course path as filled band
    const wps = this.config.waypoints;
    if (wps.length >= 2) {
      // Fill
      ctx.beginPath();
      for (let i = 0; i < wps.length; i++) {
        const sx = worldToScreenX(wps[i].x - wps[i].width);
        const sy = worldToScreenY(wps[i].z);
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      for (let i = wps.length - 1; i >= 0; i--) {
        const sx = worldToScreenX(wps[i].x + wps[i].width);
        const sy = worldToScreenY(wps[i].z);
        ctx.lineTo(sx, sy);
      }
      ctx.closePath();
      ctx.fillStyle = PATH_COLOR;
      ctx.fill();

      // Left edge stroke
      ctx.beginPath();
      for (let i = 0; i < wps.length; i++) {
        const sx = worldToScreenX(wps[i].x - wps[i].width);
        const sy = worldToScreenY(wps[i].z);
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.strokeStyle = PATH_STROKE;
      ctx.lineWidth = 1;
      ctx.stroke();

      // Right edge stroke
      ctx.beginPath();
      for (let i = 0; i < wps.length; i++) {
        const sx = worldToScreenX(wps[i].x + wps[i].width);
        const sy = worldToScreenY(wps[i].z);
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.stroke();

      // Center line
      ctx.beginPath();
      for (let i = 0; i < wps.length; i++) {
        const sx = worldToScreenX(wps[i].x);
        const sy = worldToScreenY(wps[i].z);
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.strokeStyle = "rgba(100, 200, 255, 0.2)";
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw jumps
    ctx.fillStyle = JUMP_COLOR;
    for (const jump of this.config.jumps) {
      const sy = worldToScreenY(jump.z);
      if (sy < -20 || sy > h + 20) continue;
      // Draw triangle marker
      ctx.beginPath();
      ctx.moveTo(w / 2 - 8, sy + 6);
      ctx.lineTo(w / 2 + 8, sy + 6);
      ctx.lineTo(w / 2, sy - 8);
      ctx.closePath();
      ctx.fill();
      // Label
      ctx.font = "7px 'Press Start 2P', monospace";
      ctx.fillText("JUMP", w / 2 + 14, sy + 3);
    }

    // Draw half-pipe zone
    if (this.config.halfPipe) {
      const hp = this.config.halfPipe;
      const sy1 = worldToScreenY(hp.startZ);
      const sy2 = worldToScreenY(hp.endZ);
      const hpw = (hp.width / 2) * xScale;
      ctx.fillStyle = "rgba(100, 100, 255, 0.1)";
      ctx.strokeStyle = "rgba(100, 100, 255, 0.4)";
      ctx.lineWidth = 2;
      ctx.fillRect(w / 2 - hpw, sy1, hpw * 2, sy2 - sy1);
      ctx.strokeRect(w / 2 - hpw, sy1, hpw * 2, sy2 - sy1);
      ctx.font = "7px 'Press Start 2P', monospace";
      ctx.fillStyle = "rgba(100, 100, 255, 0.6)";
      ctx.fillText("HALF-PIPE", w / 2 - hpw + 4, sy1 + 12);
    }

    // Draw waypoint handles
    for (let i = 0; i < wps.length; i++) {
      const sx = worldToScreenX(wps[i].x);
      const sy = worldToScreenY(wps[i].z);
      if (sy < -20 || sy > h + 20) continue;

      const isHover = i === this.hoverWaypoint;

      // Center handle
      ctx.beginPath();
      ctx.arc(sx, sy, WAYPOINT_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = isHover ? WAYPOINT_HOVER : WAYPOINT_COLOR;
      ctx.fill();
      ctx.strokeStyle = "rgba(0, 0, 0, 0.5)";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Width handles (small diamonds on edges)
      const lwx = worldToScreenX(wps[i].x - wps[i].width);
      const rwx = worldToScreenX(wps[i].x + wps[i].width);
      for (const ex of [lwx, rwx]) {
        ctx.beginPath();
        ctx.moveTo(ex, sy - 5);
        ctx.lineTo(ex + 5, sy);
        ctx.lineTo(ex, sy + 5);
        ctx.lineTo(ex - 5, sy);
        ctx.closePath();
        ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
        ctx.fill();
      }
    }

    // Start/Finish labels
    const startY = worldToScreenY(0);
    const finishY = worldToScreenY(1);
    ctx.font = "9px 'Press Start 2P', monospace";
    ctx.fillStyle = "#4f4";
    if (startY > -20 && startY < h + 20) {
      ctx.fillText("START", 4, startY - 8);
    }
    ctx.fillStyle = "#f44";
    if (finishY > -20 && finishY < h + 20) {
      ctx.fillText("FINISH", 4, finishY - 8);
    }
  }

  private bindEvents(): void {
    // Mouse events
    this.canvas.addEventListener("mousedown", (e) => this.onPointerDown(e.offsetX, e.offsetY, e.button));
    this.canvas.addEventListener("mousemove", (e) => this.onPointerMove(e.offsetX, e.offsetY));
    this.canvas.addEventListener("mouseup", () => this.onPointerUp());
    this.canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      this.zoom = Math.max(0.5, Math.min(4, this.zoom - e.deltaY * 0.001));
      this.draw();
    }, { passive: false });

    // Touch events
    this.canvas.addEventListener("touchstart", (e) => {
      e.preventDefault();
      const t = e.touches[0];
      const rect = this.canvas.getBoundingClientRect();
      this.lastTouchY = t.clientY;
      this.onPointerDown(t.clientX - rect.left, t.clientY - rect.top, 0);
    }, { passive: false });

    this.canvas.addEventListener("touchmove", (e) => {
      e.preventDefault();
      const t = e.touches[0];
      const rect = this.canvas.getBoundingClientRect();
      this.onPointerMove(t.clientX - rect.left, t.clientY - rect.top);

      // Pan with touch if dragging nothing
      if (this.dragWaypoint === null && this.dragWidthWaypoint === null && this.activeTool === "none") {
        this.scrollY += (this.lastTouchY - t.clientY) / 1;
        this.lastTouchY = t.clientY;
        this.draw();
      }
    }, { passive: false });

    this.canvas.addEventListener("touchend", (e) => {
      e.preventDefault();
      this.onPointerUp();
    }, { passive: false });
  }

  private screenToWorld(sx: number, sy: number): { x: number; z: number } {
    const w = this.canvasW;
    const courseLen = this.config.length;
    const metersPerPixel = courseLen / (this.canvasH * this.zoom);
    const xScale = w / 80;
    const x = (sx - w / 2) / xScale;
    const meters = (sy + this.scrollY) * metersPerPixel;
    const z = meters / courseLen;
    return { x, z };
  }

  private onPointerDown(sx: number, sy: number, button: number): void {
    const world = this.screenToWorld(sx, sy);
    const w = this.canvasW;
    const courseLen = this.config.length;
    const metersPerPixel = courseLen / (this.canvasH * this.zoom);
    const xScale = w / 80;

    // Check for waypoint hits
    const wps = this.config.waypoints;
    for (let i = 0; i < wps.length; i++) {
      const wpSx = w / 2 + wps[i].x * xScale;
      const wpSy = (wps[i].z * courseLen / metersPerPixel) - this.scrollY;

      // Check width handles first (edges)
      const lwx = w / 2 + (wps[i].x - wps[i].width) * xScale;
      const rwx = w / 2 + (wps[i].x + wps[i].width) * xScale;
      if (Math.abs(sx - lwx) < 10 && Math.abs(sy - wpSy) < 10) {
        this.dragWidthWaypoint = i;
        this.dragWidthSide = -1;
        return;
      }
      if (Math.abs(sx - rwx) < 10 && Math.abs(sy - wpSy) < 10) {
        this.dragWidthWaypoint = i;
        this.dragWidthSide = 1;
        return;
      }

      // Center handle
      const dist = Math.sqrt((sx - wpSx) ** 2 + (sy - wpSy) ** 2);
      if (dist < WAYPOINT_RADIUS + 4) {
        if (button === 2) {
          // Right-click to delete (if more than 6 waypoints)
          if (wps.length > 6 && i > 0 && i < wps.length - 1) {
            wps.splice(i, 1);
            this.onChange();
            this.draw();
          }
          return;
        }
        this.dragWaypoint = i;
        return;
      }
    }

    // Tool placement
    if (this.activeTool === "jump") {
      const z = Math.max(0.05, Math.min(0.95, world.z));
      // Check min spacing from existing jumps
      const tooClose = this.config.jumps.some(j => Math.abs(j.z - z) < 0.04);
      if (!tooClose && this.config.jumps.length < 12) {
        this.config.jumps.push({ z });
        this.config.jumps.sort((a, b) => a.z - b.z);
        this.onChange();
        this.draw();
      }
    } else if (this.activeTool === "eraser") {
      // Check if clicking near a jump
      for (let i = 0; i < this.config.jumps.length; i++) {
        const jsy = (this.config.jumps[i].z * courseLen / metersPerPixel) - this.scrollY;
        if (Math.abs(sy - jsy) < 15 && Math.abs(sx - w / 2) < 20) {
          this.config.jumps.splice(i, 1);
          this.onChange();
          this.draw();
          return;
        }
      }
    } else if (button === 0 && this.activeTool === "none") {
      // Pan
      this.panStartY = sy;
      this.panStartScroll = this.scrollY;
    }
  }

  private onPointerMove(sx: number, sy: number): void {
    const w = this.canvasW;
    const courseLen = this.config.length;
    const metersPerPixel = courseLen / (this.canvasH * this.zoom);
    const xScale = w / 80;

    if (this.dragWaypoint !== null) {
      const world = this.screenToWorld(sx, sy);
      const wp = this.config.waypoints[this.dragWaypoint];
      // Clamp X to ±30m
      wp.x = Math.max(-30, Math.min(30, world.x));
      // Don't allow moving first or last Z
      if (this.dragWaypoint > 0 && this.dragWaypoint < this.config.waypoints.length - 1) {
        const prev = this.config.waypoints[this.dragWaypoint - 1].z;
        const next = this.config.waypoints[this.dragWaypoint + 1].z;
        wp.z = Math.max(prev + 0.02, Math.min(next - 0.02, world.z));
      }
      this.onChange();
      this.draw();
      return;
    }

    if (this.dragWidthWaypoint !== null) {
      const world = this.screenToWorld(sx, sy);
      const wp = this.config.waypoints[this.dragWidthWaypoint];
      const dist = Math.abs(world.x - wp.x);
      wp.width = Math.max(15, Math.min(40, dist));
      this.onChange();
      this.draw();
      return;
    }

    if (this.panStartY !== null) {
      this.scrollY = this.panStartScroll + (this.panStartY - sy);
      this.draw();
      return;
    }

    // Hover detection
    let foundHover = false;
    const wps = this.config.waypoints;
    for (let i = 0; i < wps.length; i++) {
      const wpSx = w / 2 + wps[i].x * xScale;
      const wpSy = (wps[i].z * courseLen / metersPerPixel) - this.scrollY;
      const dist = Math.sqrt((sx - wpSx) ** 2 + (sy - wpSy) ** 2);
      if (dist < WAYPOINT_RADIUS + 4) {
        this.hoverWaypoint = i;
        this.canvas.style.cursor = "grab";
        foundHover = true;
        break;
      }
    }
    if (!foundHover) {
      this.hoverWaypoint = null;
      this.canvas.style.cursor = this.activeTool === "none" ? "default" : "crosshair";
    }
    this.draw();
  }

  private onPointerUp(): void {
    this.dragWaypoint = null;
    this.dragWidthWaypoint = null;
    this.panStartY = null;
  }

  dispose(): void {
    this.canvas.remove();
  }
}
