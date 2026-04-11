export interface SoakWave {
  timestamp: number;
  abilityId: number;
  soakers: string[];
  totalDamage: number;
  averageDamage: number;
  missedPlayers: string[];
}

export interface AverzianAnalysisResult {
  reportId: string;
  fightId: number;
  soakWaves: SoakWave[];
}
