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
): Promise<{ entries: TunnelingEntry[]; windows: Record<string, { start: number; end: number }[]> }> => {
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

  // Map Actor ID to NPC Name for grouping
  const actorToName: Record<number, string> = {};
  npcs.forEach((n: any) => {
    if (PRIORITY_NPC_IDS.includes(n.gameID)) {
      actorToName[n.id] = n.name;
    }
  });

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
  const idPart = priorityAddIds.length > 0 ? `target.id IN (${priorityAddIds.join(',')}) OR source.id IN (${priorityAddIds.join(',')})` : '1=0';
  const namePart = `target.name IN ("${PRIORITY_ADDS.join('","')}") OR source.name IN ("${PRIORITY_ADDS.join('","')}")`;
  const addFilter = `(${idPart}) OR (${namePart})`;
  
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
  const addLifespans: Record<number, { spawn: number; death: number; name: string }> = {};

  lifecycleEvents.forEach((ev: any) => {
    // Check multiple properties for ID extraction (GraphQL often nests these)
    const tID = ev.targetID || ev.target?.id;
    const sID = ev.sourceID || ev.source?.id;
    
    // We also identify by name if the ID isn't in our fight-header list
    const tName = ev.target?.name || "";
    const sName = ev.source?.name || "";

    const relevantIds: { id: number; name: string }[] = [];
    
    if (tID && priorityAddIds.includes(tID)) relevantIds.push({ id: tID, name: actorToName[tID] || tName });
    else if (PRIORITY_ADDS.includes(tName)) relevantIds.push({ id: tID || -Math.random(), name: tName }); // Use name if ID mapping missing

    if (sID && priorityAddIds.includes(sID)) relevantIds.push({ id: sID, name: actorToName[sID] || sName });
    else if (PRIORITY_ADDS.includes(sName)) relevantIds.push({ id: sID || -Math.random(), name: sName });

    relevantIds.forEach(actor => {
      const actorID = actor.id;
      const npcName = actor.name || "Unknown Add";
      
      if (!addLifespans[actorID]) {
        addLifespans[actorID] = { spawn: ev.timestamp, death: fightEndTime, name: npcName };
      }

      if (ev.type === 'death' && (ev.targetID === actorID || ev.target?.id === actorID)) {
        addLifespans[actorID].death = ev.timestamp;
      }
      
      if (ev.timestamp < addLifespans[actorID].spawn) {
        addLifespans[actorID].spawn = ev.timestamp;
      }
    });
  });

  // 5. Determine "Adds Alive" windows per NPC Type
  const groupedWindows: Record<string, { start: number; end: number }[]> = {};
  
  // Also collect ALL intervals for the raid-wide "Any Add Alive" check
  const allIntervals: [number, number][] = [];

  const npcTypes = Array.from(new Set(Object.values(addLifespans).map(l => l.name)));
  
  npcTypes.forEach(name => {
    const intervals = Object.values(addLifespans)
      .filter(l => l.name === name)
      .map(l => [l.spawn, l.death] as [number, number]);
    
    if (intervals.length === 0) return;
    
    intervals.sort((a, b) => a[0] - b[0]);
    const merged: { start: number; end: number }[] = [];
    let current = [...intervals[0]];
    
    for (let i = 1; i < intervals.length; i++) {
      const next = intervals[i];
      if (next[0] <= current[1]) {
        current[1] = Math.max(current[1], next[1]);
      } else {
        merged.push({ start: current[0], end: current[1] });
        current = [...next];
      }
    }
    merged.push({ start: current[0], end: current[1] });
    groupedWindows[name] = merged;
    
    // Add to allIntervals for the tunneling calculation
    intervals.forEach(i => allIntervals.push(i));
  });

  // Merge allIntervals for the isAddAliveAt check
  const raidWideIntervals: [number, number][] = [];
  if (allIntervals.length > 0) {
    allIntervals.sort((a, b) => a[0] - b[0]);
    let current = [...allIntervals[0]];
    for (let i = 1; i < allIntervals.length; i++) {
      const next = allIntervals[i];
      if (next[0] <= current[1]) {
        current[1] = Math.max(current[1], next[1]);
      } else {
        raidWideIntervals.push(current as [number, number]);
        current = [...next];
      }
    }
    raidWideIntervals.push(current as [number, number]);
  }

  const isAddAliveAt = (timestamp: number) => {
    return raidWideIntervals.some(interval => timestamp >= interval[0] && timestamp <= interval[1]);
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
  const tableEntries = table?.entries || table?.data?.entries || [];
  const actorMap: Record<number, any> = {};
  tableEntries.forEach((e: any) => {
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

  const tunnelingEntries = Object.values(attribution)
    .map(p => ({
      playerName: p.name,
      playerClass: p.class,
      tunnelingDamage: p.tunneling,
      totalBossDamage: p.total,
      tunnelingPercentage: p.total > 0 ? (p.tunneling / p.total) * 100 : 0
    }))
    .filter(p => p.totalBossDamage > 0)
    .sort((a, b) => b.tunnelingDamage - a.tunnelingDamage);

  return {
    entries: tunnelingEntries,
    windows: groupedWindows
  };
};
