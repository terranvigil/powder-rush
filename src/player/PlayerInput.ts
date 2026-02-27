export interface InputState {
  steerInput: number;   // -1 (left), 0, +1 (right)
  tuckInput: boolean;   // W held
  brakeInput: boolean;  // S held
  jumpHeld: boolean;    // Space currently held
  jumpReleased: boolean; // Space was released this frame
}

export class PlayerInput {
  private keys = new Set<string>();
  private jumpWasHeld = false;
  private jumpReleasedFlag = false;

  constructor() {
    document.addEventListener("keydown", (e) => {
      this.keys.add(e.code);
    });

    document.addEventListener("keyup", (e) => {
      this.keys.delete(e.code);
      if (e.code === "Space") {
        this.jumpReleasedFlag = true;
      }
    });
  }

  getState(): InputState {
    let steerInput = 0;
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) steerInput -= 1;
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) steerInput += 1;

    const tuckInput = this.keys.has("KeyW") || this.keys.has("ArrowUp");
    const brakeInput = this.keys.has("KeyS") || this.keys.has("ArrowDown");
    const jumpHeld = this.keys.has("Space");

    // jumpReleased: true for one frame when space is released
    const jumpReleased = this.jumpReleasedFlag;
    this.jumpReleasedFlag = false;

    this.jumpWasHeld = jumpHeld;

    return { steerInput, tuckInput, brakeInput, jumpHeld, jumpReleased };
  }
}
