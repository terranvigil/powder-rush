export class DemoOverlay {
  private overlay: HTMLDivElement;

  constructor() {
    this.overlay = document.createElement("div");
    this.overlay.className = "demo-overlay";
    this.overlay.innerHTML = `
      <div class="demo-title">POWDER<br>RUSH</div>
      <div class="demo-prompt">PRESS ANY KEY TO PLAY</div>
    `;

    // Inject styles if not already present
    if (!document.getElementById("demo-overlay-styles")) {
      const style = document.createElement("style");
      style.id = "demo-overlay-styles";
      style.textContent = `
        .demo-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          pointer-events: none;
          z-index: 100;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          align-items: center;
          padding: 40px 20px;
          opacity: 0;
          transition: opacity 0.8s ease;
        }
        .demo-overlay.visible { opacity: 1; }
        .demo-title {
          font-family: 'Press Start 2P', monospace;
          font-size: 28px;
          color: rgba(255, 255, 255, 0.7);
          text-align: center;
          line-height: 1.6;
          text-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
        }
        .demo-prompt {
          font-family: 'Press Start 2P', monospace;
          font-size: 14px;
          color: rgba(255, 255, 255, 0.8);
          text-shadow: 0 1px 4px rgba(0, 0, 0, 0.6);
          animation: demoPulse 2s ease-in-out infinite;
        }
        @keyframes demoPulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1.0; }
        }
      `;
      document.head.appendChild(style);
    }
  }

  show(): void {
    document.body.appendChild(this.overlay);
    requestAnimationFrame(() => this.overlay.classList.add("visible"));
  }

  hide(): void {
    this.overlay.classList.remove("visible");
    setTimeout(() => this.overlay.remove(), 800);
  }

  dispose(): void {
    this.overlay.remove();
  }
}
