import { buildSdk } from '@rpglogs/api-sdk/dist/tsc/main';

/**
 * Fetches the raid roster for a specific fight
 */
export const fetchRaidRoster = async (accessToken: string, reportId: string, fightId: number) => {
  const sdk = buildSdk(accessToken);
  
  // Fetch table data (player names/classes) and fight data (IDs)
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
  const actorMap: Record<number, any> = {};
  entries.forEach((e: any) => {
    if (e.id) actorMap[e.id] = e;
  });

  const fight = fightsData.reportData?.report?.fights?.[0];
  const playerIds = fight?.friendlyPlayers || [];
  
  return playerIds.map((id: any) => ({
    id: id,
    name: actorMap[id]?.name || `Unknown (${id})`,
    class: actorMap[id]?.type // In DamageDone entries, 'type' is the class
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
  
  // Get actor info from the table to map ID to Name and Class
  const tableData = await sdk.getReportTable({
    code: reportId,
    fightIds: [fightId],
    dataType: 'DamageDone' as any
  });
  
  const table = tableData.reportData?.report?.table;
  const entries = table?.entries || table?.data?.entries || [];
  const actorMap: Record<number, any> = {};
  entries.forEach((e: any) => {
    if (e.id) actorMap[e.id] = e;
  });

  return events.map((e: any) => ({
    timestamp: e.timestamp,
    targetName: actorMap[e.targetID]?.name || `Unknown (${e.targetID})`,
    targetClass: actorMap[e.targetID]?.type,
    amount: e.amount || 0,
    mitigated: e.mitigated || 0
  }));
};
