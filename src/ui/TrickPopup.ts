export class TrickPopup {
  private container: HTMLDivElement;

  constructor() {
    this.container = document.createElement("div");
    this.container.className = "trick-popup-container";
    document.body.appendChild(this.container);
  }

  show(name: string, points: number): void {
    const el = document.createElement("div");
    el.className = "trick-popup";

    if (points > 0) {
      el.innerHTML = `${name} <span class="trick-points">+${points}</span>`;
    } else {
      // Combo label (no points value)
      el.textContent = name;
      el.classList.add("trick-combo");
    }

    this.container.appendChild(el);

    // Trigger entrance animation
    requestAnimationFrame(() => el.classList.add("active"));

    // Fade out after delay
    setTimeout(() => {
      el.classList.add("fading");
      setTimeout(() => el.remove(), 600);
    }, 1500);
  }
}
