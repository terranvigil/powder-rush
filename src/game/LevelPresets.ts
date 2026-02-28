import type { CourseTerrainConfig } from "../terrain/SlopeFunction";

export type CourseType = "downhill" | "slalom" | "superG" | "moguls" | "terrainPark" | "parallel" | "halfPipe";

export interface LevelPreset {
  name: string;
  subtitle: string;
  courseType: CourseType;
  scoreThreshold: number; // points to unlock next level
  sunAzimuth: number;
  sunElevation: number;
  sunColor: [number, number, number];
  sunIntensity: number;
  ambientIntensity: number;
  groundColor: [number, number, number];
  clearColor: [number, number, number];
  fogStart: number;
  fogEnd: number;
  fogColor: [number, number, number];
  snowRate: number;
  terrainConfig?: CourseTerrainConfig;
}

export const LEVELS: LevelPreset[] = [
  // Level 1: Standard downhill — introductory
  {
    name: "GREEN GLADE",
    subtitle: "Downhill",
    courseType: "downhill",
    scoreThreshold: 500,
    sunAzimuth: -60,
    sunElevation: 25,
    sunColor: [1.0, 0.85, 0.6],
    sunIntensity: 1.6,
    ambientIntensity: 0.3,
    groundColor: [0.4, 0.38, 0.55],
    clearColor: [0.45, 0.62, 0.85],
    fogStart: 80,
    fogEnd: 300,
    fogColor: [0.65, 0.70, 0.82],
    snowRate: 8,
  },
  // Level 2: Slalom — gates to weave through
  {
    name: "BIRCH RUN",
    subtitle: "Slalom",
    courseType: "slalom",
    scoreThreshold: 800,
    sunAzimuth: -30,
    sunElevation: 45,
    sunColor: [1.0, 0.90, 0.72],
    sunIntensity: 1.8,
    ambientIntensity: 0.25,
    groundColor: [0.36, 0.36, 0.62],
    clearColor: [0.25, 0.42, 0.78],
    fogStart: 80,
    fogEnd: 300,
    fogColor: [0.55, 0.62, 0.78],
    snowRate: 12,
  },
  // Level 3: Super G — high-speed wide gates
  {
    name: "DUSK BOWL",
    subtitle: "Super G",
    courseType: "superG",
    scoreThreshold: 1200,
    sunAzimuth: 60,
    sunElevation: 12,
    sunColor: [1.0, 0.55, 0.25],
    sunIntensity: 1.4,
    ambientIntensity: 0.2,
    groundColor: [0.3, 0.25, 0.5],
    clearColor: [0.18, 0.12, 0.4],
    fogStart: 60,
    fogEnd: 220,
    fogColor: [0.4, 0.3, 0.5],
    snowRate: 20,
  },
  // Level 4: Moguls — dense bumps, steep
  {
    name: "BUMP ALLEY",
    subtitle: "Moguls",
    courseType: "moguls",
    scoreThreshold: 1500,
    sunAzimuth: -45,
    sunElevation: 35,
    sunColor: [1.0, 0.88, 0.68],
    sunIntensity: 1.7,
    ambientIntensity: 0.25,
    groundColor: [0.38, 0.36, 0.58],
    clearColor: [0.30, 0.48, 0.82],
    fogStart: 70,
    fogEnd: 250,
    fogColor: [0.58, 0.64, 0.80],
    snowRate: 10,
    terrainConfig: { mogulIntensity: 0.85 },
  },
  // Level 5: Terrain Park — jumps and tricks
  {
    name: "TRICK RIDGE",
    subtitle: "Terrain Park",
    courseType: "terrainPark",
    scoreThreshold: 2000,
    sunAzimuth: 20,
    sunElevation: 40,
    sunColor: [1.0, 0.92, 0.75],
    sunIntensity: 1.9,
    ambientIntensity: 0.28,
    groundColor: [0.35, 0.35, 0.60],
    clearColor: [0.22, 0.40, 0.80],
    fogStart: 90,
    fogEnd: 320,
    fogColor: [0.50, 0.58, 0.75],
    snowRate: 6,
    terrainConfig: { jumpCount: 8 },
  },
  // Level 6: Parallel — race against AI opponent
  {
    name: "TWIN PEAKS",
    subtitle: "Parallel",
    courseType: "parallel",
    scoreThreshold: 2500,
    sunAzimuth: -20,
    sunElevation: 50,
    sunColor: [1.0, 0.95, 0.80],
    sunIntensity: 1.85,
    ambientIntensity: 0.22,
    groundColor: [0.34, 0.34, 0.58],
    clearColor: [0.20, 0.38, 0.75],
    fogStart: 80,
    fogEnd: 280,
    fogColor: [0.52, 0.60, 0.76],
    snowRate: 15,
  },
  // Level 7: Half-pipe — U-channel trick runs
  {
    name: "GLACIER PIPE",
    subtitle: "Half-Pipe",
    courseType: "halfPipe",
    scoreThreshold: 3000,
    sunAzimuth: 0,
    sunElevation: 60,
    sunColor: [0.6, 0.7, 0.9],
    sunIntensity: 0.8,
    ambientIntensity: 0.15,
    groundColor: [0.15, 0.15, 0.35],
    clearColor: [0.04, 0.05, 0.15],
    fogStart: 40,
    fogEnd: 150,
    fogColor: [0.08, 0.10, 0.22],
    snowRate: 25,
    terrainConfig: { halfPipeWidth: 22, halfPipeDepth: 6 },
  },
];
