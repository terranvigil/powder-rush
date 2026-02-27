export class SplashScreen {
  private element: HTMLElement;

  constructor() {
    this.element = document.getElementById("splash")!;
  }

  waitForDismiss(): Promise<void> {
    return new Promise((resolve) => {
      const dismiss = () => {
        document.removeEventListener("keydown", dismiss);
        this.element.removeEventListener("click", dismiss);

        this.element.classList.add("hidden");
        setTimeout(() => {
          this.element.style.display = "none";
          resolve();
        }, 800);
      };

      document.addEventListener("keydown", dismiss);
      this.element.addEventListener("click", dismiss);
    });
  }
}
