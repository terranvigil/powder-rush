import { GEAR_CATEGORIES } from "./GearData";

const STORAGE_KEY = "powder-rush-save";

export interface SaveData {
  totalCoins: number;
  bestTime: number | null;
  ownedGear: string[];
  equippedGear: Record<string, string>;
}

function defaultSave(): SaveData {
  const equipped: Record<string, string> = {};
  const owned: string[] = [];
  for (const cat of GEAR_CATEGORIES) {
    const starter = cat.items[0];
    equipped[cat.id] = starter.id;
    owned.push(starter.id);
  }
  return { totalCoins: 0, bestTime: null, ownedGear: owned, equippedGear: equipped };
}

export class SaveManager {
  private data: SaveData;

  constructor() {
    this.data = this.load();
  }

  get save(): Readonly<SaveData> {
    return this.data;
  }

  get hasPlayed(): boolean {
    return this.data.bestTime !== null;
  }

  addCoins(amount: number): void {
    this.data.totalCoins += amount;
    this.persist();
  }

  spendCoins(amount: number): boolean {
    if (this.data.totalCoins < amount) return false;
    this.data.totalCoins -= amount;
    this.persist();
    return true;
  }

  recordRun(time: number, coinsCollected: number): void {
    this.data.totalCoins += coinsCollected;
    if (this.data.bestTime === null || time < this.data.bestTime) {
      this.data.bestTime = time;
    }
    this.persist();
  }

  buyGear(itemId: string): boolean {
    if (this.data.ownedGear.includes(itemId)) return false;
    for (const cat of GEAR_CATEGORIES) {
      const item = cat.items.find((i) => i.id === itemId);
      if (item) {
        if (!this.spendCoins(item.cost)) return false;
        this.data.ownedGear.push(itemId);
        this.persist();
        return true;
      }
    }
    return false;
  }

  equipGear(categoryId: string, itemId: string): void {
    if (!this.data.ownedGear.includes(itemId)) return;
    this.data.equippedGear[categoryId] = itemId;
    this.persist();
  }

  ownsGear(itemId: string): boolean {
    return this.data.ownedGear.includes(itemId);
  }

  private load(): SaveData {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSave();
    try {
      const parsed = JSON.parse(raw) as SaveData;
      const def = defaultSave();
      return {
        totalCoins: parsed.totalCoins ?? def.totalCoins,
        bestTime: parsed.bestTime ?? def.bestTime,
        ownedGear: parsed.ownedGear ?? def.ownedGear,
        equippedGear: { ...def.equippedGear, ...parsed.equippedGear },
      };
    } catch {
      return defaultSave();
    }
  }

  private persist(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
  }
}
