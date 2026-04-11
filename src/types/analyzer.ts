export interface AverzianDamageEvent {
  timestamp: number;
  targetName: string;
  amount: number;
  mitigated?: number;
}

export interface Soak {
  timestamp: number; // The representitive timestamp (first event in group)
  events: AverzianDamageEvent[];
  totalDamage: number;
  averageDamage: number;
}

export interface SoakSet {
  id: number;
  startTime: number;
  endTime: number;
  soaks: Soak[];
  totalDamage: number;
}

export interface AverzianAnalysisResult {
  reportId: string;
  fightId: number;
  sets: SoakSet[];
}
