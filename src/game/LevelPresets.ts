export interface LevelPreset {
  name: string;
  subtitle: string;
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
}

export const LEVELS: LevelPreset[] = [
  {
    name: "GREEN GLADE",
    subtitle: "Morning",
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
  {
    name: "BIRCH RUN",
    subtitle: "Midday",
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
  {
    name: "DUSK BOWL",
    subtitle: "Sunset",
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
  {
    name: "NIGHT DROP",
    subtitle: "Night",
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
    snowRate: 30,
  },
];
