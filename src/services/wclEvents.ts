import { buildSdk } from '@rpglogs/api-sdk/dist/tsc/main';

/**
 * Fetches the raid roster for a specific fight
 */
export const fetchRaidRoster = async (accessToken: string, reportId: string, fightId: number) => {
  const sdk = buildSdk(accessToken);
  
  // Fetch table data (player names) and fight data (IDs)
  const [tableData, fightsData] = await Promise.all([
    sdk.getReportTable({
      code: reportId,
      fightIds: [fightId],
      dataType: 'DamageDone' as any
    }),
    sdk.getReportFights({
      code: reportId,
      fightIds: [fightId],
      includePlayers: true,
      includeNpcs: false,
      includeDungeonPulls: false
    })
  ]);
  
  const table = tableData.reportData?.report?.table;
  const entries = table?.entries || table?.data?.entries || [];
  const actorMap: Record<number, string> = {};
  entries.forEach((e: any) => actorMap[e.id] = e.name);

  const fight = fightsData.reportData?.report?.fights?.[0];
  const playerIds = fight?.friendlyPlayers || [];
  
  return playerIds.map((id: any) => ({
    id: id,
    name: actorMap[id] || `Unknown (${id})`
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
  const tableData = await sdk.getReportTable({
    code: reportId,
    fightIds: [fightId],
    dataType: 'DamageDone' as any
  });
  
  const table = tableData.reportData?.report?.table;
  const entries = table?.entries || table?.data?.entries || [];
  const idToName: Record<number, string> = {};
  entries.forEach((e: any) => idToName[e.id] = e.name);

  return events.map((e: any) => ({
    timestamp: e.timestamp,
    targetName: idToName[e.targetID] || `Unknown (${e.targetID})`,
    amount: e.amount || 0,
    mitigated: e.mitigated || 0
  }));
};
