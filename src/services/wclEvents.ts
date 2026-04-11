import { buildSdk } from '@rpglogs/api-sdk/dist/tsc/main';

/**
 * Fetches the raid roster for a specific fight
 */
export const fetchRaidRoster = async (accessToken: string, reportId: string, fightId: number) => {
  const sdk = buildSdk(accessToken);
  const data = await sdk.getReportFights({
    code: reportId,
    fightIds: [fightId],
    includePlayers: true,
    includeNpcs: false,
    includeDungeonPulls: false
  });
  
  const fight = data.reportData?.report?.fights?.[0];
  const players = fight?.friendlyPlayers || [];
  
  return players.map((p: any) => ({
    id: p.id,
    name: p.name,
    type: p.type,
    icon: p.icon
  }));
};

/**
 * Fetches all damage events for Umbral Collapse (1249262)
 */
export const fetchAverzianDamageEvents = async (accessToken: string, reportId: string, fightId: number) => {
  const sdk = buildSdk(accessToken);
  const data = await sdk.getReportEvents({
    code: reportId,
    fightIds: [fightId],
    filterExpression: 'ability.id = 1249262',
    dataType: 'DamageTaken' as any
  });
  
  const events = data.reportData?.report?.events?.data || [];
  
  // We need character names, but events only give targetID. 
  // We'll fetch the roster as well to map IDs to names.
  const roster = await fetchRaidRoster(accessToken, reportId, fightId);
  const idToName: Record<number, string> = {};
  roster.forEach(p => idToName[p.id] = p.name);

  return events.map((e: any) => ({
    timestamp: e.timestamp,
    targetName: idToName[e.targetID] || `Unknown (${e.targetID})`,
    amount: e.amount || 0,
    mitigated: e.mitigated || 0
  }));
};
