import type { InputState } from "./PlayerInput";

export class TouchInput {
  private overlay: HTMLDivElement | null = null;
  private brakeBtn: HTMLDivElement | null = null;
  private tuckBtn: HTMLDivElement | null = null;
  private jumpBtn: HTMLDivElement | null = null;

  private _brakeActive = false;
  private _tuckActive = false;
  private _jumpActive = false;
  private _jumpReleasedFlag = false;
  private _steerInput = 0;

  private steerTouchId: number | null = null;

  readonly isTouchDevice: boolean;

  constructor() {
    // Only show touch controls on actual touch devices without a fine pointer (mouse/trackpad)
    const hasTouchAPI = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    const hasFinePointer = window.matchMedia("(pointer: fine)").matches;
    this.isTouchDevice = hasTouchAPI && !hasFinePointer;

    if (!this.isTouchDevice) return;

    this.createOverlay();
    this.bindSteeringEvents();
  }

  private createOverlay(): void {
    this.overlay = document.createElement("div");
    this.overlay.className = "touch-overlay";

    this.brakeBtn = this.makeButton("BRK", "touch-btn-brake");
    this.tuckBtn = this.makeButton("TUK", "touch-btn-tuck");
    this.jumpBtn = this.makeButton("JUMP", "touch-btn-jump");

    this.overlay.appendChild(this.brakeBtn);
    this.overlay.appendChild(this.tuckBtn);
    this.overlay.appendChild(this.jumpBtn);

    document.body.appendChild(this.overlay);

    this.bindButtonEvents(this.brakeBtn, "brake");
    this.bindButtonEvents(this.tuckBtn, "tuck");
    this.bindButtonEvents(this.jumpBtn, "jump");
  }

  private makeButton(label: string, posClass: string): HTMLDivElement {
    const btn = document.createElement("div");
    btn.className = `touch-btn ${posClass}`;
    btn.textContent = label;
    return btn;
  }

  private bindButtonEvents(
    btn: HTMLDivElement,
    action: "brake" | "tuck" | "jump"
  ): void {
    btn.addEventListener(
      "touchstart",
      (e) => {
        e.preventDefault();
        btn.classList.add("pressed");
        this.setAction(action, true);
      },
      { passive: false }
    );

    btn.addEventListener(
      "touchend",
      (e) => {
        e.preventDefault();
        btn.classList.remove("pressed");
        this.setAction(action, false);
      },
      { passive: false }
    );

    btn.addEventListener(
      "touchcancel",
      (e) => {
        e.preventDefault();
        btn.classList.remove("pressed");
        this.setAction(action, false);
      },
      { passive: false }
    );
  }

  private setAction(action: "brake" | "tuck" | "jump", active: boolean): void {
    switch (action) {
      case "brake":
        this._brakeActive = active;
        break;
      case "tuck":
        this._tuckActive = active;
        break;
      case "jump":
        if (!active && this._jumpActive) {
          this._jumpReleasedFlag = true;
        }
        this._jumpActive = active;
        break;
    }
  }

  private bindSteeringEvents(): void {
    const canvas = document.getElementById("renderCanvas")!;

    canvas.addEventListener(
      "touchstart",
      (e) => {
        if (this.steerTouchId !== null) return;
        for (let i = 0; i < e.changedTouches.length; i++) {
          const t = e.changedTouches[i];
          if (this.isTouchOnButton(t)) continue;
          this.steerTouchId = t.identifier;
          this.updateSteer(t);
          break;
        }
      },
      { passive: true }
    );

    canvas.addEventListener(
      "touchmove",
      (e) => {
        if (this.steerTouchId === null) return;
        for (let i = 0; i < e.changedTouches.length; i++) {
          const t = e.changedTouches[i];
          if (t.identifier === this.steerTouchId) {
            this.updateSteer(t);
            break;
          }
        }
      },
      { passive: true }
    );

    const endSteer = (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === this.steerTouchId) {
          this.steerTouchId = null;
          this._steerInput = 0;
          break;
        }
      }
    };

    canvas.addEventListener("touchend", endSteer, { passive: true });
    canvas.addEventListener("touchcancel", endSteer, { passive: true });
  }

  private isTouchOnButton(t: Touch): boolean {
    const el = document.elementFromPoint(t.clientX, t.clientY);
    if (!el) return false;
    return el.classList.contains("touch-btn");
  }

  private updateSteer(t: Touch): void {
    const centerX = window.innerWidth / 2;
    const halfWidth = window.innerWidth / 2;
    const raw = (t.clientX - centerX) / halfWidth;
    this._steerInput = Math.max(-1, Math.min(1, raw));
  }

  getState(): InputState {
    const jumpReleased = this._jumpReleasedFlag;
    this._jumpReleasedFlag = false;

    return {
      steerInput: this._steerInput,
      tuckInput: this._tuckActive,
      brakeInput: this._brakeActive,
      jumpHeld: this._jumpActive,
      jumpReleased,
    };
  }
}
