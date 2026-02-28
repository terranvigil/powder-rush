import type { CourseType } from "./LevelPresets";

export interface CustomCourseConfig {
  name: string;
  waypoints: { z: number; x: number; width: number }[];
  length: number;           // 600-2400
  steepness: number;        // 0.08-0.25
  bowlDepth: number;        // 0.0-0.01
  roughness: number;        // 0.0-1.0
  mogulIntensity: number;   // 0.0-1.0
  jumps: { z: number }[];   // 0-12 jump positions (as fraction 0-1 of course length)
  halfPipe: { startZ: number; endZ: number; width: number; depth: number } | null;
  treeDensity: number;      // 0.0-1.0
  obstacleDensity: number;  // 0.0-1.0
  coinCount: number;        // 0-50
  courseType: CourseType;
  atmospherePreset: "morning" | "midday" | "sunset" | "night";
  sunAzimuthOffset: number;   // -30 to +30
  sunElevationOffset: number; // -15 to +15
  fogDensity: number;         // 0.0-1.0
  snowIntensity: number;      // 0.0-2.0
  seed: number;
}

export function defaultCourseConfig(): CustomCourseConfig {
  return {
    name: "My Course",
    waypoints: [
      { z: 0, x: 0, width: 25 },
      { z: 0.15, x: 3, width: 25 },
      { z: 0.3, x: -2, width: 22 },
      { z: 0.45, x: 5, width: 28 },
      { z: 0.6, x: -4, width: 24 },
      { z: 0.75, x: 2, width: 26 },
      { z: 0.85, x: -1, width: 25 },
      { z: 1.0, x: 0, width: 25 },
    ],
    length: 1200,
    steepness: 0.15,
    bowlDepth: 0.002,
    roughness: 0.5,
    mogulIntensity: 0,
    jumps: [{ z: 0.25 }, { z: 0.5 }, { z: 0.75 }],
    halfPipe: null,
    treeDensity: 0.5,
    obstacleDensity: 0.5,
    coinCount: 25,
    courseType: "downhill",
    atmospherePreset: "morning",
    sunAzimuthOffset: 0,
    sunElevationOffset: 0,
    fogDensity: 0.5,
    snowIntensity: 1.0,
    seed: 42,
  };
}

// Version prefix for forward compatibility
const VERSION = 1;

export function encodeCourse(config: CustomCourseConfig): string {
  const json = JSON.stringify([VERSION, config]);
  return btoa(json);
}

export function decodeCourse(code: string): CustomCourseConfig | null {
  try {
    const json = atob(code.trim());
    const arr = JSON.parse(json);
    if (!Array.isArray(arr) || arr[0] !== VERSION) return null;
    const c = arr[1] as CustomCourseConfig;
    // Clamp values to valid ranges
    c.length = clamp(c.length, 600, 2400);
    c.steepness = clamp(c.steepness, 0.08, 0.25);
    c.bowlDepth = clamp(c.bowlDepth, 0, 0.01);
    c.roughness = clamp(c.roughness, 0, 1);
    c.mogulIntensity = clamp(c.mogulIntensity, 0, 1);
    c.treeDensity = clamp(c.treeDensity, 0, 1);
    c.obstacleDensity = clamp(c.obstacleDensity, 0, 1);
    c.coinCount = clamp(Math.round(c.coinCount), 0, 50);
    c.fogDensity = clamp(c.fogDensity, 0, 1);
    c.snowIntensity = clamp(c.snowIntensity, 0, 2);
    c.sunAzimuthOffset = clamp(c.sunAzimuthOffset, -30, 30);
    c.sunElevationOffset = clamp(c.sunElevationOffset, -15, 15);
    if (c.jumps) c.jumps = c.jumps.slice(0, 12);
    if (c.waypoints) c.waypoints = c.waypoints.slice(0, 20);
    return c;
  } catch {
    return null;
  }
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
