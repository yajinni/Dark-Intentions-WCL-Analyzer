export interface AverzianDamageEvent {
  timestamp: number;
  targetName: string;
  targetClass?: string;
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

export interface TunnelingEntry {
  playerName: string;
  playerClass: string;
  tunnelingDamage: number; // Boss damage while adds alive
  totalBossDamage: number;
  tunnelingPercentage: number;
}

export interface NpcLifespan {
  id: number;
  name: string;
  spawn: number;
  death: number;
}

export interface AverzianAnalysisResult {
  reportId: string;
  fightId: number;
  sets: SoakSet[];
  tunnelingEntries?: TunnelingEntry[];
  addsAliveWindows?: Record<string, { start: number; end: number }[]>;
  npcLifespans?: NpcLifespan[];
  allDeaths?: { id: number; name: string; timestamp: number }[];
}
