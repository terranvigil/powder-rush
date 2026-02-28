export interface GearItem {
  id: string;
  name: string;
  cost: number;
  tier: number;
  description: string;
}

export interface GearCategory {
  id: string;
  label: string;
  items: GearItem[];
}

export interface GearModifiers {
  maxSpeedBonus: number;
  steerRateBonus: number;
  recoveryMultiplier: number;
  crashRetainBonus: number;
}

export const GEAR_CATEGORIES: GearCategory[] = [
  {
    id: "skis",
    label: "SKIS",
    items: [
      { id: "skis_1", name: "Rental Skis", cost: 0, tier: 1, description: "Basic all-mountain skis" },
      { id: "skis_2", name: "Carver 90s", cost: 50, tier: 2, description: "+5 top speed, tighter turns" },
      { id: "skis_3", name: "Powder Rockets", cost: 150, tier: 3, description: "+10 top speed, max grip" },
    ],
  },
  {
    id: "boots",
    label: "BOOTS",
    items: [
      { id: "boots_1", name: "Soft Flex", cost: 0, tier: 1, description: "Comfortable but slow recovery" },
      { id: "boots_2", name: "Mid Flex", cost: 50, tier: 2, description: "Faster crash recovery" },
      { id: "boots_3", name: "Race Flex", cost: 150, tier: 3, description: "Fastest crash recovery" },
    ],
  },
  {
    id: "jacket",
    label: "JACKET",
    items: [
      { id: "jacket_1", name: "Shell Layer", cost: 0, tier: 1, description: "Thin protection" },
      { id: "jacket_2", name: "Padded Coat", cost: 50, tier: 2, description: "Keep more speed on crash" },
      { id: "jacket_3", name: "Armor Jacket", cost: 150, tier: 3, description: "Max crash protection" },
    ],
  },
  {
    id: "helmet",
    label: "HELMET",
    items: [
      { id: "helmet_1", name: "Basic Lid", cost: 0, tier: 1, description: "Standard helmet" },
      { id: "helmet_2", name: "Sport Pro", cost: 50, tier: 2, description: "Better visibility" },
      { id: "helmet_3", name: "Race Visor", cost: 150, tier: 3, description: "Night vision ready" },
    ],
  },
  {
    id: "poles",
    label: "POLES",
    items: [
      { id: "poles_1", name: "Aluminum", cost: 0, tier: 1, description: "Standard poles" },
      { id: "poles_2", name: "Carbon Lite", cost: 50, tier: 2, description: "Better balance" },
      { id: "poles_3", name: "Trick Sticks", cost: 150, tier: 3, description: "Trick combo bonus" },
    ],
  },
];

export function resolveGearModifiers(
  equipped: Record<string, string>,
): GearModifiers {
  const mods: GearModifiers = {
    maxSpeedBonus: 0,
    steerRateBonus: 0,
    recoveryMultiplier: 1,
    crashRetainBonus: 0,
  };

  for (const cat of GEAR_CATEGORIES) {
    const itemId = equipped[cat.id];
    if (!itemId) continue;
    const item = cat.items.find((i) => i.id === itemId);
    if (!item) continue;

    switch (cat.id) {
      case "skis":
        mods.maxSpeedBonus += (item.tier - 1) * 5;
        mods.steerRateBonus += (item.tier - 1) * 0.05;
        break;
      case "boots":
        mods.recoveryMultiplier -= (item.tier - 1) * 0.15;
        break;
      case "jacket":
        mods.crashRetainBonus += (item.tier - 1) * 0.1;
        break;
    }
  }

  return mods;
}
