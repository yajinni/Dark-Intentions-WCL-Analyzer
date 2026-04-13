import { buildSdk } from '@rpglogs/api-sdk/dist/tsc/main';
import type { TunnelingEntry, NpcLifespan } from '../types/analyzer';

const PRIORITY_NPC_NAMES = [
  "Abyssal Voidshaper",
  "Shadowguard Stalwart",
  "Voidmaw",
  "Obsidian Endwalker",
  "Voidbound Annihilator"
];

export const fetchTunnelingData = async (
  accessToken: string,
  reportId: string,
  fightId: number,
  fightStartTime: number,
  fightEndTime: number
): Promise<{ 
  entries: TunnelingEntry[]; 
  windows: Record<string, { start: number; end: number }[]>; 
  npcLifespans: NpcLifespan[];
  allDeaths?: { id: number; name: string; timestamp: number }[];
}> => {
  const sdk = buildSdk(accessToken);

  // 1. Identification Cache
  const flightsData = await sdk.getReportFights({
    code: reportId,
    fightIds: [fightId],
    includeNpcs: true,
    includePlayers: false,
    includeDungeonPulls: false
  });
  
  const fight: any = flightsData.reportData?.report?.fights?.[0];
  const npcs = fight?.npcs || [];
  
  const actorMap: Record<number, { name: string; gameID: number }> = {};
  npcs.forEach((npc: any) => {
    actorMap[npc.id] = { name: npc.name, gameID: npc.gameID };
  });


  // 2. Fetch Broad Lifecycle Events (Life Signals)
  const fetchAllEvents = async (dataType: string, filter?: string) => {
    let all: any[] = [];
    let startTime = fightStartTime;
    while (true) {
      const resp: any = await sdk.getReportEvents({
        code: reportId,
        fightIds: [fightId],
        dataType: dataType as any,
        startTime,
        endTime: fightEndTime,
        filterExpression: filter
      });
      const data = resp.reportData?.report?.events?.data || [];
      all = [...all, ...data];
      const next = resp.reportData?.report?.events?.nextPageTimestamp;
      if (!next || data.length === 0 || next >= fightEndTime) break;
      startTime = next;
    }
    return all;
  };

  // Fetch ONLY deaths as requested
  const [deaths] = await Promise.all([
    fetchAllEvents('Deaths') // Fetch all deaths for diagnostic purposes
  ]);

  const allLifecycleEvents = deaths.sort((a, b) => a.timestamp - b.timestamp);

  // 3. Process Lifespans (Event-First Discovery)
  const lifespans: Record<number, NpcLifespan> = {};

  const processEvent = (ev: any) => {
    const id = ev.targetID || ev.target?.id || ev.sourceID || ev.source?.id;
    if (!id) return;

    // Is this a priority NPC?
    const name = ev.target?.name || ev.targetName || ev.source?.name || ev.sourceName || actorMap[id]?.name || "";
    const isPriority = PRIORITY_NPC_NAMES.some(p => name.includes(p));
    
    if (!isPriority) return;

    if (!lifespans[id]) {
      lifespans[id] = {
        id,
        name,
        spawn: ev.timestamp,
        death: ev.timestamp // Initial seen
      };
    }

    // Update with earlier sightings
    if (ev.timestamp < lifespans[id].spawn) {
        lifespans[id].spawn = ev.timestamp;
    }

    // Update with later sightings
    if (ev.timestamp > lifespans[id].death) {
        lifespans[id].death = ev.timestamp;
    }

    // Explicit Death event is the final word
    if (ev.type === 'death' && (ev.targetID === id || ev.target?.id === id)) {
        lifespans[id].death = ev.timestamp;
    }
    
    // Explicit Summon event is a great spawn time
    if (ev.type === 'summon' && (ev.targetID === id || ev.target?.id === id)) {
        lifespans[id].spawn = ev.timestamp;
    }
  };

  allLifecycleEvents.forEach(processEvent);

  const lifespanList = Object.values(lifespans).sort((a, b) => a.spawn - b.spawn);

  // 4. Calculate Tunneling Windows
  const windows: [number, number][] = [];
  if (lifespanList.length > 0) {
    const sorted = [...lifespanList].sort((a, b) => a.spawn - b.spawn);
    let current = [sorted[0].spawn, sorted[0].death];
    for (let i = 1; i < sorted.length; i++) {
        if (sorted[i].spawn <= current[1]) {
            current[1] = Math.max(current[1], sorted[i].death);
        } else {
            windows.push(current as [number, number]);
            current = [sorted[i].spawn, sorted[i].death];
        }
    }
    windows.push(current as [number, number]);
  }

  const isAddAliveAt = (time: number) => windows.some(w => time >= w[0] && time <= w[1]);

  // 5. Boss Damage Attribution
  const bossEvents: any[] = await fetchAllEvents('DamageDone', 'target.name = "Imperator Averzian"');

  const playerStats: Record<number, { name: string; class: string; tunneling: number; total: number }> = {};
  bossEvents.forEach(ev => {
    const sID = ev.sourceID;
    if (!sID) return;
    if (!playerStats[sID]) {
        playerStats[sID] = {
            name: ev.source?.name || ev.sourceName || `Player ${sID}`,
            class: ev.source?.type || 'Unknown',
            tunneling: 0,
            total: 0
        };
    }
    const amt = (ev.amount || 0) + (ev.absorbed || 0);
    playerStats[sID].total += amt;
    if (isAddAliveAt(ev.timestamp)) {
        playerStats[sID].tunneling += amt;
    }
  });

  const entries: TunnelingEntry[] = Object.values(playerStats)
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
    entries,
    windows: {}, 
    npcLifespans: lifespanList,
    allDeaths: deaths.map(ev => ({
        id: ev.targetID || ev.target?.id,
        name: ev.target?.name || ev.targetName || "Unknown",
        timestamp: ev.timestamp
    }))
  };
};
