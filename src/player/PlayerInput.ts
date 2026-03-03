import { TouchInput } from "./TouchInput";
import { keyBindings } from "./KeyBindings";

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
      if (e.code === keyBindings.get("jump")) {
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
    if (keyBindings.isActionPressed("steerLeft", this.keys)) kbSteer -= 1;
    if (keyBindings.isActionPressed("steerRight", this.keys)) kbSteer += 1;

    const kbTuck = keyBindings.isActionPressed("tuck", this.keys);
    const kbBrake = keyBindings.isActionPressed("brake", this.keys);
    const kbJumpHeld = keyBindings.isActionPressed("jump", this.keys);

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
