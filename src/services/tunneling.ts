import { buildSdk } from '@rpglogs/api-sdk/dist/tsc/main';
import type { TunnelingEntry } from '../types/analyzer';

const PRIORITY_NPC_IDS = [
  251176, // Voidmaw
  251239, // Shadowguard Stalwart
  252918  // Abyssal Voidshaper
];

const PRIORITY_ADDS = [
  "Abyssal Voidshaper",
  "Shadowguard Stalwart",
  "Voidmaw"
];

export const fetchTunnelingData = async (
  accessToken: string,
  reportId: string,
  fightId: number,
  fightStartTime: number,
  fightEndTime: number
): Promise<TunnelingEntry[]> => {
  const sdk = buildSdk(accessToken);

  // Helper for pagination
  const fetchAllEvents = async (options: any) => {
    let allData: any[] = [];
    let currentOptions = { ...options };
    
    while (true) {
      const resp: any = await sdk.getReportEvents(currentOptions);
      const events = resp.reportData?.report?.events?.data || [];
      allData = [...allData, ...events];
      
      const nextTimestamp = resp.reportData?.report?.events?.nextPageTimestamp;
      if (!nextTimestamp || events.length === 0) break;
      currentOptions.startTime = nextTimestamp;
    }
    return allData;
  };

  // 1. Get Priority Add IDs from ReportFights
  const fightsData = await sdk.getReportFights({
    code: reportId,
    fightIds: [fightId],
    includeNpcs: true,
    includePlayers: false,
    includeDungeonPulls: false
  });
  
  const fight: any = fightsData.reportData?.report?.fights?.[0];
  const npcs = fight?.npcs || [];
  const priorityAddIds = npcs
    .filter((n: any) => PRIORITY_NPC_IDS.includes(n.gameID))
    .map((n: any) => n.id);

  if (priorityAddIds.length === 0) {
    console.log("No priority adds found in fight data, but fetching anyway in case events carry them.");
  }

  // 2. Fetch all Boss Damage events (Paginated)
  const bossEvents = await fetchAllEvents({
    code: reportId,
    fightIds: [fightId],
    filterExpression: 'target.name = "Imperator Averzian"',
    dataType: 'DamageDone' as any,
    startTime: fightStartTime,
    endTime: fightEndTime
  });

  // 3. Fetch all Add Lifecycle events (Paginated)
  // We use multiple types to be absolutely sure we catch their lifespan
  const addFilter = `target.name IN ("${PRIORITY_ADDS.join('","')}") OR source.name IN ("${PRIORITY_ADDS.join('","')}") OR target.id IN (${priorityAddIds.join(',')}) OR source.id IN (${priorityAddIds.join(',')})`;
  
  const lifecycleTypes = ['DamageTaken', 'Deaths', 'Summons', 'Casts'];
  const lifecyclePromises = lifecycleTypes.map(type => fetchAllEvents({
    code: reportId,
    fightIds: [fightId],
    filterExpression: addFilter,
    dataType: type as any,
    startTime: fightStartTime,
    endTime: fightEndTime
  }));

  const allLifecycleResults = await Promise.all(lifecyclePromises);
  const lifecycleEvents = allLifecycleResults.flat().sort((a, b) => a.timestamp - b.timestamp);

  // 4. Process Add Lifespans
  const addLifespans: Record<number, { spawn: number; death: number }> = {};

  lifecycleEvents.forEach((ev: any) => {
    // We look for any actor involved that is a priority add
    const relevantIds = [ev.targetID, ev.sourceID, ev.target?.id, ev.source?.id].filter(id => id && (priorityAddIds.includes(id) || priorityAddIds.length === 0));
    
    relevantIds.forEach(actorID => {
      if (!addLifespans[actorID]) {
        addLifespans[actorID] = { spawn: ev.timestamp, death: fightEndTime };
      }

      if (ev.type === 'death' && ev.targetID === actorID) {
        addLifespans[actorID].death = ev.timestamp;
      }
      
      if (ev.timestamp < addLifespans[actorID].spawn) {
        addLifespans[actorID].spawn = ev.timestamp;
      }
    });
  });

  // 5. Determine "Adds Alive" windows
  const rawIntervals = Object.values(addLifespans).map(l => [l.spawn, l.death]);
  const mergedIntervals: [number, number][] = [];
  if (rawIntervals.length > 0) {
    rawIntervals.sort((a, b) => a[0] - b[0]);
    let current = rawIntervals[0];
    for (let i = 1; i < rawIntervals.length; i++) {
      const next = rawIntervals[i];
      if (next[0] <= current[1]) {
        current[1] = Math.max(current[1], next[1]);
      } else {
        mergedIntervals.push(current as [number, number]);
        current = next;
      }
    }
    mergedIntervals.push(current as [number, number]);
  }

  const isAddAliveAt = (timestamp: number) => {
    return mergedIntervals.some(interval => timestamp >= interval[0] && timestamp <= interval[1]);
  };

  // 6. Attribution
  const attribution: Record<number, { name: string; class: string; tunneling: number; total: number }> = {};

  // Get actor info for class colors
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

  bossEvents.forEach((ev: any) => {
    const sourceID = ev.sourceID;
    if (!sourceID) return;

    if (!attribution[sourceID]) {
      attribution[sourceID] = {
        name: actorMap[sourceID]?.name || `Unknown (${sourceID})`,
        class: actorMap[sourceID]?.type || 'Unknown',
        tunneling: 0,
        total: 0
      };
    }

    const amount = (ev.amount || 0) + (ev.absorbed || 0);
    attribution[sourceID].total += amount;
    if (isAddAliveAt(ev.timestamp)) {
      attribution[sourceID].tunneling += amount;
    }
  });

  return Object.values(attribution)
    .map(p => ({
      playerName: p.name,
      playerClass: p.class,
      tunnelingDamage: p.tunneling,
      totalBossDamage: p.total,
      tunnelingPercentage: p.total > 0 ? (p.tunneling / p.total) * 100 : 0
    }))
    .filter(p => p.totalBossDamage > 0)
    .sort((a, b) => b.tunnelingDamage - a.tunnelingDamage);
};
