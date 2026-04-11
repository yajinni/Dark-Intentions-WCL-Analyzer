import { buildSdk } from '@rpglogs/api-sdk/dist/tsc/main';

export const fetchSoakEvents = async (accessToken: string, reportId: string, fightId: number) => {
  const sdk = buildSdk(accessToken);
  // Fetch DamageTaken events for Umbral Collapse IDs
  const data = await sdk.getReportEvents({
    code: reportId,
    fightIds: [fightId],
    filterExpression: 'ability.id in (472506, 472508, 1249262)',
    dataType: 'DamageTaken' as any // SDK might use enum, 'DamageTaken' is standard
  });
  return data.reportData?.report?.events?.data || [];
};

export const fetchDamageDoneEvents = async (accessToken: string, reportId: string, fightId: number) => {
  const sdk = buildSdk(accessToken);
  // Fetch DamageDone events to Boss and Adds
  const data = await sdk.getReportEvents({
    code: reportId,
    fightIds: [fightId],
    dataType: 'DamageDone' as any
  });
  
  return data.reportData?.report?.events?.data || [];
};

export const fetchActorMapping = async (accessToken: string, reportId: string, fightId: number) => {
  const sdk = buildSdk(accessToken);
  
  // Fetch both table (for names/totals) and fights (for gameIDs)
  const [tableData, fightData] = await Promise.all([
    sdk.getReportTable({
      code: reportId,
      fightIds: [fightId],
      dataType: 'DamageDone' as any
    }),
    sdk.getReportFights({
      code: reportId,
      fightIds: [fightId],
      includeNpcs: true,
      includePlayers: false,
      includeDungeonPulls: false
    })
  ]);
  
  const table = tableData.reportData?.report?.table;
  const entries = table?.entries || table?.data?.entries || [];
  const fight = fightData.reportData?.report?.fights?.[0];
  const enemyNPCs = fight?.enemyNPCs || [];
  
  const mapping: Record<string, { id: number; total: number; gameID?: number }> = {};
  
  // Create a map of ID -> GameID for enrichment
  const idToGameID: Record<number, number> = {};
  enemyNPCs.forEach((npc: any) => {
    if (npc.id && npc.gameID) idToGameID[npc.id] = npc.gameID;
  });

  entries.forEach((entry: any) => {
    if (entry.name && entry.id) {
      mapping[entry.name] = { 
        id: entry.id, 
        total: entry.total || 0,
        gameID: idToGameID[entry.id]
      };
    }
  });
  
  return mapping;
};

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
