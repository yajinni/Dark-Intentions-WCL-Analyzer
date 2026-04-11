import { buildSdk } from '@rpglogs/api-sdk/dist/tsc/main';

export const fetchSoakEvents = async (accessToken: string, reportId: string, fightId: number) => {
  const sdk = buildSdk(accessToken);
  // Fetch DamageTaken events for Umbral Collapse IDs
  const data = await sdk.getReportEvents({
    code: reportId,
    fightIds: [fightId],
    filterExpression: 'ability.id in (472506, 472508)',
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
  const data = await sdk.getReportTable({
    code: reportId,
    fightIds: [fightId],
    dataType: 'DamageDone' as any
  });
  
  const table = data.reportData?.report?.table;
  // Handle both possible structures: table.entries or table.data.entries
  const entries = table?.entries || table?.data?.entries || [];
  const mapping: Record<string, number> = {};
  
  entries.forEach((entry: any) => {
    if (entry.name && entry.id) {
      mapping[entry.name] = entry.id;
    }
  });
  
  return mapping;
};

export const fetchRaidRoster = async (accessToken: string, reportId: string, fightId: number) => {
  const sdk = buildSdk(accessToken);
  const data = await sdk.getReportPlayerDetails({
    code: reportId,
    fightIds: [fightId]
  });
  
  const details = data.reportData?.report?.playerDetails?.data;
  if (!details) return [];

  // Flatten the different roles into a single list of players
  const players: any[] = [];
  if (details.tanks) players.push(...details.tanks);
  if (details.healers) players.push(...details.healers);
  if (details.dps) players.push(...details.dps);
  
  return players.map(p => ({
    id: p.id,
    name: p.name,
    type: p.type,
    icon: p.icon
  }));
};
