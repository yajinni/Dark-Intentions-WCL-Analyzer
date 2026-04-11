export interface AverzianDamageEvent {
  timestamp: number;
  targetName: string;
  amount: number;
  mitigated?: number;
}

export interface AverzianAnalysisResult {
  reportId: string;
  fightId: number;
  events: AverzianDamageEvent[];
}
