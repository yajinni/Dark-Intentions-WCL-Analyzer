export interface SoakWave {
  timestamp: number;
  abilityId: number;
  soakers: string[];
  totalDamage: number;
  averageDamage: number;
  missedPlayers: string[];
}

export interface TunnelingReport {
  playerName: string;
  bossDamage: number;
  addDamage: number;
  tunnelingScore: number; // Percentage of damage to boss while adds were up
}

export interface AverzianAnalysisResult {
  reportId: string;
  fightId: number;
  soakWaves: SoakWave[];
  tunnelingPlayers: TunnelingReport[];
}
