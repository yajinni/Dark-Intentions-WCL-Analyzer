import { buildSdk } from '@rpglogs/api-sdk/dist/tsc/main';
import type { TunnelingEntry, NpcLifespan } from '../types/analyzer';

const PRIORITY_NPC_IDS = [
  251176, // Voidmaw
  251239, // Shadowguard Stalwart
  252918  // Abyssal Voidshaper
];

const PRIORITY_ADDS = [
  "Abyssal Voidshaper",
  "Shadowguard Stalwart",
  "Voidmaw",
  "Obsidian Endwalker",
  "Voidbound Annihilator",
  "Shadowguard Annihilator"
];

export const fetchTunnelingData = async (
  accessToken: string,
  reportId: string,
  fightId: number,
  fightStartTime: number,
  fightEndTime: number
): Promise<{ entries: TunnelingEntry[]; windows: Record<string, { start: number; end: number }[]>; npcLifespans: NpcLifespan[] }> => {
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

  // 1. Dual-Source ID Discovery
  // We check both the fight NPCs and the Damage Done table for robustness
  const [fightsData, doneTableData, takenTableData] = await Promise.all([
    sdk.getReportFights({
      code: reportId,
      fightIds: [fightId],
      includeNpcs: true,
      includePlayers: false,
      includeDungeonPulls: false
    }),
    sdk.getReportTable({
      code: reportId,
      fightIds: [fightId],
      dataType: 'DamageDone' as any
    }),
    sdk.getReportTable({
      code: reportId,
      fightIds: [fightId],
      dataType: 'DamageTaken' as any
    })
  ]);
  
  const fight: any = fightsData.reportData?.report?.fights?.[0];
  const npcs = fight?.npcs || [];
  const doneTable = doneTableData.reportData?.report?.table;
  const takenTable = takenTableData.reportData?.report?.table;
  const tableEntries = [
    ...(doneTable?.entries || doneTable?.data?.entries || []),
    ...(takenTable?.entries || takenTable?.data?.entries || [])
  ];
  
  // Combine all actor info into a resilient lookup
  const actorToName: Record<number, string> = {};
  const priorityAddIds: number[] = [];

  // Discovery from Fights NPCs
  npcs.forEach((n: any) => {
    if (PRIORITY_NPC_IDS.includes(n.gameID)) {
      actorToName[n.id] = n.name;
      priorityAddIds.push(n.id);
    }
  });

  // Discovery from Table Entries (fallback for untracked actors)
  tableEntries.forEach((e: any) => {
    // If the name matches our priority list but wasn't in NPCs header
    if (PRIORITY_ADDS.some(name => e.name?.includes(name))) {
      if (!priorityAddIds.includes(e.id)) {
        priorityAddIds.push(e.id);
        actorToName[e.id] = e.name;
      }
    }
  });

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
  // Use a hybrid filter: IDs we found + substring names for safety
  const idPart = priorityAddIds.length > 0 ? `target.id IN (${priorityAddIds.join(',')}) OR source.id IN (${priorityAddIds.join(',')})` : '1=0';
  const namePart = PRIORITY_ADDS.map(name => `target.name CONTAINS "${name}" OR source.name CONTAINS "${name}"`).join(' OR ');
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
    // Collect all possible actor IDs from the event (target/source, top-level or nested)
    const tID = ev.targetID || ev.target?.id;
    const sID = ev.sourceID || ev.source?.id;
    
    // Resilient name extraction: try normalized names then actor ID lookup
    const tName = ev.targetName || ev.target?.name || actorToName[tID] || "";
    const sName = ev.sourceName || ev.source?.name || actorToName[sID] || "";

    const matches: { id: number; name: string }[] = [];
    
    // Match by ID
    if (tID && priorityAddIds.includes(tID)) matches.push({ id: tID, name: actorToName[tID] || tName });
    if (sID && priorityAddIds.includes(sID)) matches.push({ id: sID, name: actorToName[sID] || sName });

    // Match by Name (Substring)
    PRIORITY_ADDS.forEach(pName => {
      const lowerPName = pName.toLowerCase();
      if (tName.toLowerCase().includes(lowerPName) && !matches.some(m => m.id === tID)) {
        matches.push({ id: tID || -Math.random(), name: pName });
      }
      if (sName.toLowerCase().includes(lowerPName) && !matches.some(m => m.id === sID)) {
        matches.push({ id: sID || -Math.random(), name: pName });
      }
    });

    matches.forEach(match => {
      const actorID = match.id;
      const categoryName = match.name;
      
      if (!addLifespans[actorID]) {
        addLifespans[actorID] = { spawn: ev.timestamp, death: fightEndTime, name: categoryName };
      }

      // Update death if we see it
      if (ev.type === 'death' && (ev.targetID === actorID || ev.target?.id === actorID)) {
        addLifespans[actorID].death = ev.timestamp;
      }
      
      // Update spawn if we see something earlier
      if (ev.timestamp < addLifespans[actorID].spawn) {
        addLifespans[actorID].spawn = ev.timestamp;
      }
    });
  });

  // 5. Determine "Adds Alive" windows per NPC Type
  const groupedWindows: Record<string, { start: number; end: number }[]> = {};
  const allIntervals: [number, number][] = [];

  // Categorize by normalized NPC name
  PRIORITY_ADDS.forEach(pName => {
    const intervals = Object.values(addLifespans)
      .filter(l => l.name.includes(pName))
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
    groupedWindows[pName] = merged;
    
    // Add to allIntervals for raid-wide tunneling check
    intervals.forEach(i => allIntervals.push(i));
  });

  // Merge allIntervals for the unified isAddAliveAt check
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
  const actorMap: Record<number, any> = {};
  tableEntries.forEach((e: any) => {
    if (e.id) actorMap[e.id] = e;
  });

  bossEvents.forEach((ev: any) => {
    const sourceID = ev.sourceID || ev.source?.id;
    if (!sourceID) return;

    if (!attribution[sourceID]) {
      attribution[sourceID] = {
        name: actorMap[sourceID]?.name || ev.source?.name || `Unknown (${sourceID})`,
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

  const lifespans: NpcLifespan[] = Object.entries(addLifespans).map(([id, l]) => ({
    id: Number(id),
    name: l.name,
    spawn: l.spawn,
    death: l.death
  })).sort((a, b) => a.spawn - b.spawn);

  return {
    entries: tunnelingEntries,
    windows: groupedWindows,
    npcLifespans: lifespans
  };
};
