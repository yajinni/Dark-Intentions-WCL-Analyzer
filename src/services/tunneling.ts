import { buildSdk } from '@rpglogs/api-sdk/dist/tsc/main';
import type { TunnelingEntry } from '../types/analyzer';

const PRIORITY_ADDS = [
  "Abyssal Voidshaper",
  "Shadowguard Stalwart",
  "Voidbound Annihilator",
  "Voidmaw"
];

export const fetchTunnelingData = async (
  accessToken: string,
  reportId: string,
  fightId: number,
  _fightStartTime: number, // Prefixed with _ to ignore unused warning
  fightEndTime: number
): Promise<TunnelingEntry[]> => {
  const sdk = buildSdk(accessToken);

  // 1. Fetch all Boss Damage events
  const bossDamageData = await sdk.getReportEvents({
    code: reportId,
    fightIds: [fightId],
    filterExpression: 'target.name = "Imperator Averzian"',
    dataType: 'DamageDone' as any
  });

  const bossEvents = bossDamageData.reportData?.report?.events?.data || [];

  // 2. Fetch all Deaths and DamageTaken to find add lifespans
  // We use valid EventDataType values (DamageTaken and Deaths)
  const addFilter = `target.name IN ("${PRIORITY_ADDS.join('","')}") OR source.name IN ("${PRIORITY_ADDS.join('","')}")`;
  
  const [damageTakenData, deathsData] = await Promise.all([
    sdk.getReportEvents({
      code: reportId,
      fightIds: [fightId],
      filterExpression: addFilter,
      dataType: 'DamageTaken' as any
    }),
    sdk.getReportEvents({
      code: reportId,
      fightIds: [fightId],
      filterExpression: addFilter,
      dataType: 'Deaths' as any
    })
  ]);

  const lifecycleEvents = [
    ...(damageTakenData.reportData?.report?.events?.data || []),
    ...(deathsData.reportData?.report?.events?.data || [])
  ].sort((a, b) => a.timestamp - b.timestamp);

  // 3. Process Add Lifespans
  // actorID -> { spawn: number, death: number }
  const addLifespans: Record<number, { spawn: number; death: number }> = {};

  lifecycleEvents.forEach((ev: any) => {
    const targetID = ev.targetID;
    if (!targetID) return;
    
    // Check if it's a priority add
    const name = ev.target?.name || ev.source?.name;
    if (!PRIORITY_ADDS.includes(name)) return;

    if (!addLifespans[targetID]) {
      addLifespans[targetID] = { spawn: ev.timestamp, death: fightEndTime };
    }

    if (ev.type === 'death') {
      addLifespans[targetID].death = ev.timestamp;
    }
    // If we see it earlier (damage taken, etc), update spawn
    if (ev.timestamp < addLifespans[targetID].spawn) {
      addLifespans[targetID].spawn = ev.timestamp;
    }
  });

  // 4. Determine "Adds Alive" windows
  // We simplify this into an array of intervals [start, end]
  const rawIntervals = Object.values(addLifespans).map(l => [l.spawn, l.death]);
  // Merge overlapping intervals
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

  // 5. Attribution
  // playerID -> { name, class, tunnelingDmg, totalDmg }
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

    const amount = ev.amount || 0;
    attribution[sourceID].total += amount;
    if (isAddAliveAt(ev.timestamp)) {
      attribution[sourceID].tunneling += amount;
    }
  });

  // 6. Convert to Array and Sort
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
