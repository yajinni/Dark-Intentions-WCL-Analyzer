import { buildSdk } from '@rpglogs/api-sdk/dist/tsc/main';
import type { TunnelingEntry, NpcLifespan } from '../types/analyzer';

const TARGET_NPC_ID = 252918; // Abyssal Voidshaper
const OTHER_NPC_IDS = [251176, 251239]; // Voidmaw, Stalwart

export const fetchTunnelingData = async (
  accessToken: string,
  reportId: string,
  fightId: number,
  fightStartTime: number,
  fightEndTime: number
): Promise<{ entries: TunnelingEntry[]; windows: Record<string, { start: number; end: number }[]>; npcLifespans: NpcLifespan[] }> => {
  const sdk = buildSdk(accessToken);

  // 1. Identify Actor Instances
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
  const trackedActorIds: number[] = [];

  npcs.forEach((npc: any) => {
    if (npc.gameID === TARGET_NPC_ID || OTHER_NPC_IDS.includes(npc.gameID)) {
      actorMap[npc.id] = { name: npc.name, gameID: npc.gameID };
      trackedActorIds.push(npc.id);
    }
  });

  // 2. Fetch Lifecycle Events
  const fetchAllEvents = async (dataType: string) => {
    let all: any[] = [];
    let startTime = fightStartTime;
    while (true) {
      const resp: any = await sdk.getReportEvents({
        code: reportId,
        fightIds: [fightId],
        dataType: dataType as any,
        startTime,
        endTime: fightEndTime,
        filterExpression: trackedActorIds.length > 0 ? `target.id IN (${trackedActorIds.join(',')}) OR source.id IN (${trackedActorIds.join(',')})` : undefined
      });
      const data = resp.reportData?.report?.events?.data || [];
      all = [...all, ...data];
      const next = resp.reportData?.report?.events?.nextPageTimestamp;
      if (!next || data.length === 0) break;
      startTime = next;
    }
    return all;
  };

  const [deathEvents, summonEvents] = await Promise.all([
    fetchAllEvents('Deaths'),
    fetchAllEvents('Summons')
  ]);

  // 3. Process Lifespans
  const lifespans: Record<number, NpcLifespan> = {};

  // Initialize with actor info
  trackedActorIds.forEach(id => {
    lifespans[id] = {
      id,
      name: actorMap[id].name,
      spawn: fightStartTime, // Default to start
      death: fightEndTime    // Default to end
    };
  });

  // Update with Summon events (more accurate spawn)
  summonEvents.forEach(ev => {
    const id = ev.targetID || ev.target?.id;
    if (id && lifespans[id]) {
      lifespans[id].spawn = ev.timestamp;
    }
  });

  // Update with Death events
  deathEvents.forEach(ev => {
    const id = ev.targetID || ev.target?.id;
    if (id && lifespans[id]) {
      lifespans[id].death = ev.timestamp;
    }
  });

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
  const bossEvents: any[] = [];
  let bStart = fightStartTime;
  while (true) {
    const resp: any = await sdk.getReportEvents({
      code: reportId,
      fightIds: [fightId],
      dataType: 'DamageDone' as any,
      startTime: bStart,
      endTime: fightEndTime,
      filterExpression: 'target.name = "Imperator Averzian"'
    });
    const data = resp.reportData?.report?.events?.data || [];
    bossEvents.push(...data);
    const next = resp.reportData?.report?.events?.nextPageTimestamp;
    if (!next || data.length === 0) break;
    bStart = next;
  }

  const playerStats: Record<number, { name: string; class: string; tunneling: number; total: number }> = {};
  bossEvents.forEach(ev => {
    const sID = ev.sourceID;
    if (!sID) return;
    if (!playerStats[sID]) {
        playerStats[sID] = {
            name: ev.source?.name || `Player ${sID}`,
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
        tunnelingPercentage: (p.tunneling / p.total) * 100
    }))
    .filter(p => p.totalBossDamage > 0)
    .sort((a, b) => b.tunnelingDamage - a.tunnelingDamage);

  return {
    entries,
    windows: {}, // Simplified
    npcLifespans: lifespanList
  };
};
