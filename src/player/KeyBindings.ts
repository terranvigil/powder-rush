export type Action = "steerLeft" | "steerRight" | "tuck" | "brake" | "jump";

const ACTIONS: Action[] = ["steerLeft", "steerRight", "tuck", "brake", "jump"];

const DEFAULTS: Record<Action, string> = {
  steerLeft: "KeyA",
  steerRight: "KeyD",
  tuck: "KeyW",
  brake: "KeyS",
  jump: "Space",
};

const ALTERNATES: Partial<Record<Action, string>> = {
  steerLeft: "ArrowLeft",
  steerRight: "ArrowRight",
  tuck: "ArrowUp",
  brake: "ArrowDown",
};

const BLOCKED = new Set([
  "Escape",
  "MetaLeft",
  "MetaRight",
  "ControlLeft",
  "ControlRight",
  "AltLeft",
  "AltRight",
  "ShiftLeft",
  "ShiftRight",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
]);

const ACTION_LABELS: Record<Action, string> = {
  steerLeft: "STEER LEFT",
  steerRight: "STEER RIGHT",
  tuck: "TUK",
  brake: "BRAKE",
  jump: "JUMP",
};

const STORAGE_KEY = "powder-rush-keybindings";

class KeyBindings {
  private bindings: Record<Action, string>;

  constructor() {
    this.bindings = { ...DEFAULTS };
    this.load();
  }

  get actions(): Action[] {
    return ACTIONS;
  }

  get(action: Action): string {
    return this.bindings[action];
  }

  getAlternate(action: Action): string | undefined {
    return ALTERNATES[action];
  }

  isActionPressed(action: Action, keys: Set<string>): boolean {
    if (keys.has(this.bindings[action])) return true;
    const alt = ALTERNATES[action];
    return alt !== undefined && keys.has(alt);
  }

  /** Bind a key to an action. Returns the swapped action name if a conflict was resolved, or null. */
  set(action: Action, code: string): Action | null {
    if (this.isBlocked(code)) return null;

    // Check for conflict
    let swapped: Action | null = null;
    for (const a of ACTIONS) {
      if (a !== action && this.bindings[a] === code) {
        // Swap: give the conflicting action our old key
        this.bindings[a] = this.bindings[action];
        swapped = a;
        break;
      }
    }

    this.bindings[action] = code;
    this.save();
    return swapped;
  }

  isBlocked(code: string): boolean {
    return BLOCKED.has(code);
  }

  displayName(code: string): string {
    if (code.startsWith("Key")) return code.slice(3);
    if (code.startsWith("Digit")) return code.slice(5);
    if (code === "Space") return "SPACE";
    if (code === "Backspace") return "BKSP";
    if (code === "CapsLock") return "CAPS";
    if (code.startsWith("Arrow")) return code.slice(5).toUpperCase();
    // Bracket, Semicolon, etc — strip common prefixes
    return code.replace(/^(Bracket|Semicolon|Quote|Backquote|Comma|Period|Slash|Backslash|Minus|Equal|Enter|Tab|Insert|Delete|Home|End|PageUp|PageDown|Numpad)/, "$1")
      .toUpperCase();
  }

  actionLabel(action: Action): string {
    return ACTION_LABELS[action];
  }

  reset(): void {
    this.bindings = { ...DEFAULTS };
    this.save();
  }

  save(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.bindings));
  }

  load(): void {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const saved = JSON.parse(raw) as Partial<Record<Action, string>>;
      for (const a of ACTIONS) {
        if (typeof saved[a] === "string") {
          this.bindings[a] = saved[a];
        }
      }
    } catch {
      /* ignore corrupt data */
    }
  }
}

export const keyBindings = new KeyBindings();
