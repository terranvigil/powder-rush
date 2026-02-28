import { TouchInput } from "./TouchInput";

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
  private touch: TouchInput;

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

    this.touch = new TouchInput();
  }

  get isTouchDevice(): boolean {
    return this.touch.isTouchDevice;
  }

  getState(): InputState {
    // Keyboard state
    let kbSteer = 0;
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) kbSteer -= 1;
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) kbSteer += 1;

    const kbTuck = this.keys.has("KeyW") || this.keys.has("ArrowUp");
    const kbBrake = this.keys.has("KeyS") || this.keys.has("ArrowDown");
    const kbJumpHeld = this.keys.has("Space");

    const kbJumpReleased = this.jumpReleasedFlag;
    this.jumpReleasedFlag = false;

    this.jumpWasHeld = kbJumpHeld;

    // Touch state
    const ts = this.touch.getState();

    // Merge: touch overrides keyboard steer when non-zero, OR logic for booleans
    return {
      steerInput: ts.steerInput !== 0 ? ts.steerInput : kbSteer,
      tuckInput: kbTuck || ts.tuckInput,
      brakeInput: kbBrake || ts.brakeInput,
      jumpHeld: kbJumpHeld || ts.jumpHeld,
      jumpReleased: kbJumpReleased || ts.jumpReleased,
    };
  }
}
