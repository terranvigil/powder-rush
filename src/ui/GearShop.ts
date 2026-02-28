import { GEAR_CATEGORIES, type GearCategory, type GearItem } from "../game/GearData";
import type { SaveManager } from "../game/SaveManager";

export class GearShop {
  private overlay: HTMLDivElement;
  private saveManager: SaveManager;
  private balanceEl: HTMLSpanElement;
  private categoryEls: Map<string, HTMLDivElement> = new Map();
  private activeCategory = "skis";

  constructor(saveManager: SaveManager) {
    this.saveManager = saveManager;

    this.overlay = document.createElement("div");
    this.overlay.className = "shop-overlay";
    this.overlay.addEventListener("click", (e) => {
      if (e.target === this.overlay) this.close();
    });

    const panel = document.createElement("div");
    panel.className = "shop-panel";

    // Header
    const header = document.createElement("div");
    header.className = "shop-header";
    const title = document.createElement("h2");
    title.textContent = "GEAR SHOP";
    this.balanceEl = document.createElement("span");
    this.balanceEl.className = "shop-balance";
    const closeBtn = document.createElement("button");
    closeBtn.className = "settings-close";
    closeBtn.textContent = "X";
    closeBtn.addEventListener("click", () => this.close());
    header.appendChild(title);
    header.appendChild(this.balanceEl);
    header.appendChild(closeBtn);
    panel.appendChild(header);

    // Category tabs
    const tabs = document.createElement("div");
    tabs.className = "shop-tabs";
    for (const cat of GEAR_CATEGORIES) {
      const tab = document.createElement("button");
      tab.className = "shop-tab";
      tab.textContent = cat.label;
      tab.dataset.catId = cat.id;
      tab.addEventListener("click", () => this.selectCategory(cat.id));
      tabs.appendChild(tab);
    }
    panel.appendChild(tabs);

    // Item lists (one per category, toggle visibility)
    const itemsContainer = document.createElement("div");
    itemsContainer.className = "shop-items-container";
    for (const cat of GEAR_CATEGORIES) {
      const catDiv = document.createElement("div");
      catDiv.className = "shop-category";
      catDiv.dataset.catId = cat.id;
      this.buildCategoryItems(catDiv, cat);
      itemsContainer.appendChild(catDiv);
      this.categoryEls.set(cat.id, catDiv);
    }
    panel.appendChild(itemsContainer);

    this.overlay.appendChild(panel);
  }

  private buildCategoryItems(container: HTMLDivElement, cat: GearCategory): void {
    container.innerHTML = "";
    for (const item of cat.items) {
      const row = document.createElement("div");
      row.className = "shop-item";
      row.dataset.itemId = item.id;

      const info = document.createElement("div");
      info.className = "shop-item-info";
      const name = document.createElement("span");
      name.className = "shop-item-name";
      name.textContent = item.name;
      const desc = document.createElement("span");
      desc.className = "shop-item-desc";
      desc.textContent = item.description;
      info.appendChild(name);
      info.appendChild(desc);

      const action = document.createElement("button");
      action.className = "shop-item-btn";
      action.addEventListener("click", () => this.handleItemAction(cat.id, item));

      row.appendChild(info);
      row.appendChild(action);
      container.appendChild(row);
    }
  }

  private refreshItems(): void {
    const save = this.saveManager.save;
    this.balanceEl.textContent = `${save.totalCoins} COINS`;

    for (const cat of GEAR_CATEGORIES) {
      const catDiv = this.categoryEls.get(cat.id)!;
      const rows = catDiv.querySelectorAll<HTMLDivElement>(".shop-item");
      rows.forEach((row) => {
        const itemId = row.dataset.itemId!;
        const item = cat.items.find((i) => i.id === itemId)!;
        const btn = row.querySelector<HTMLButtonElement>(".shop-item-btn")!;
        const equipped = save.equippedGear[cat.id] === itemId;
        const owned = save.ownedGear.includes(itemId);

        row.classList.toggle("equipped", equipped);

        if (equipped) {
          btn.textContent = "EQUIPPED";
          btn.disabled = true;
          btn.className = "shop-item-btn equipped";
        } else if (owned) {
          btn.textContent = "EQUIP";
          btn.disabled = false;
          btn.className = "shop-item-btn equip";
        } else {
          const canAfford = save.totalCoins >= item.cost;
          btn.textContent = `${item.cost}`;
          btn.disabled = !canAfford;
          btn.className = "shop-item-btn buy" + (canAfford ? "" : " disabled");
        }
      });
    }

    // Update tab active states
    const tabs = this.overlay.querySelectorAll<HTMLButtonElement>(".shop-tab");
    tabs.forEach((tab) => {
      tab.classList.toggle("active", tab.dataset.catId === this.activeCategory);
    });

    // Show only active category
    this.categoryEls.forEach((el, id) => {
      el.style.display = id === this.activeCategory ? "block" : "none";
    });
  }

  private selectCategory(catId: string): void {
    this.activeCategory = catId;
    this.refreshItems();
  }

  private handleItemAction(catId: string, item: GearItem): void {
    const owned = this.saveManager.ownsGear(item.id);
    if (owned) {
      this.saveManager.equipGear(catId, item.id);
    } else {
      this.saveManager.buyGear(item.id);
      if (this.saveManager.ownsGear(item.id)) {
        this.saveManager.equipGear(catId, item.id);
      }
    }
    this.refreshItems();
  }

  open(): void {
    this.refreshItems();
    document.body.appendChild(this.overlay);
    requestAnimationFrame(() => this.overlay.classList.add("visible"));
  }

  close(): void {
    this.overlay.classList.remove("visible");
    setTimeout(() => this.overlay.remove(), 300);
  }
}
