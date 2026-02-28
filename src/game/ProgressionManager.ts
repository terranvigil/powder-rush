import { LEVELS } from "./LevelPresets";

const STORAGE_KEY = "powder-rush-progression";

// Time-based scoring: faster times earn more points
const TIME_BASE_SCORE = 600;  // score for a 60-second run
const TIME_SCALE = 10;        // points per second faster than base

interface ProgressionData {
  unlockedLevel: number; // highest unlocked level index
  bestScores: (number | null)[];
}

export interface RunResult {
  levelIndex: number;
  time: number;
  trickScore: number;
  coinsCollected: number;
  coinsTotal: number;
  gatesPassed: number;
  gatesTotal: number;
  timePenalty: number;
}

export interface ScoreBreakdown {
  timeScore: number;
  trickScore: number;
  coinScore: number;
  gateScore: number;
  penaltyScore: number;
  totalScore: number;
  isNewBest: boolean;
  advancedLevel: boolean;
  nextLevelName: string | null;
}

function defaultData(): ProgressionData {
  return {
    unlockedLevel: 6, // all levels unlocked for testing
    bestScores: LEVELS.map(() => null),
  };
}

export class ProgressionManager {
  private data: ProgressionData;

  constructor() {
    this.data = this.load();
  }

  get unlockedLevel(): number {
    return this.data.unlockedLevel;
  }

  isUnlocked(levelIndex: number): boolean {
    return levelIndex <= this.data.unlockedLevel;
  }

  bestScore(levelIndex: number): number | null {
    return this.data.bestScores[levelIndex] ?? null;
  }

  scoreRun(result: RunResult): ScoreBreakdown {
    // Time score: reward faster runs
    const adjustedTime = result.time + result.timePenalty;
    const timeScore = Math.max(0, Math.round(TIME_BASE_SCORE - (adjustedTime - 60) * TIME_SCALE));

    // Trick score: pass through directly
    const trickScore = result.trickScore;

    // Coin score: 20 points per coin
    const coinScore = result.coinsCollected * 20;

    // Gate score: 30 points per gate passed
    const gateScore = result.gatesPassed * 30;

    // Penalty: -50 per missed gate
    const penaltyScore = -result.timePenalty * 25;

    const totalScore = Math.max(0, timeScore + trickScore + coinScore + gateScore + penaltyScore);

    // Check if new best
    const prevBest = this.data.bestScores[result.levelIndex];
    const isNewBest = prevBest === null || totalScore > prevBest;
    if (isNewBest) {
      this.data.bestScores[result.levelIndex] = totalScore;
    }

    // Check level advancement
    const level = LEVELS[result.levelIndex];
    let advancedLevel = false;
    let nextLevelName: string | null = null;

    if (totalScore >= level.scoreThreshold && result.levelIndex === this.data.unlockedLevel) {
      const nextIndex = result.levelIndex + 1;
      if (nextIndex < LEVELS.length) {
        this.data.unlockedLevel = nextIndex;
        advancedLevel = true;
        nextLevelName = LEVELS[nextIndex].name;
      }
    }

    this.persist();

    return {
      timeScore,
      trickScore,
      coinScore,
      gateScore,
      penaltyScore,
      totalScore,
      isNewBest,
      advancedLevel,
      nextLevelName,
    };
  }

  private load(): ProgressionData {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultData();
    try {
      const parsed = JSON.parse(raw) as ProgressionData;
      const def = defaultData();
      return {
        unlockedLevel: parsed.unlockedLevel ?? def.unlockedLevel,
        bestScores: parsed.bestScores ?? def.bestScores,
      };
    } catch {
      return defaultData();
    }
  }

  private persist(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
  }
}
