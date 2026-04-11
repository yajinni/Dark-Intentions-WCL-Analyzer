import React, { useEffect, useState } from 'react';
import { fetchAverzianDamageEvents, fetchRaidRoster } from '../services/wclEvents';
import type { AverzianAnalysisResult, Soak, SoakSet, AverzianDamageEvent } from '../types/analyzer';
import { AlertCircle, ChevronDown, ChevronUp, Layers } from 'lucide-react';

interface Props {
  accessToken: string;
  reportId: string;
  fightId: number;
  fightStartTime: number;
}

const AverzianDashboard: React.FC<Props> = ({ accessToken, reportId, fightId, fightStartTime }) => {
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<AverzianAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedSet, setExpandedSet] = useState<number | null>(null);
  const [expandedSoak, setExpandedSoak] = useState<string | null>(null);

  useEffect(() => {
    const analyze = async () => {
      setLoading(true);
      setError(null);
      try {
        const [events, roster] = await Promise.all([
          fetchAverzianDamageEvents(accessToken, reportId, fightId),
          fetchRaidRoster(accessToken, reportId, fightId)
        ]);
        
        const soaks: Soak[] = [];
        const SOAK_GAP_MS = 1000;
        
        if (events.length > 0) {
          let currentSoakEvents: AverzianDamageEvent[] = [];
          let lastTimestamp = events[0].timestamp;
          
          events.forEach((event: AverzianDamageEvent) => {
            if (event.timestamp - lastTimestamp > SOAK_GAP_MS && currentSoakEvents.length > 0) {
              soaks.push(createSoak(currentSoakEvents, roster));
              currentSoakEvents = [];
            }
            currentSoakEvents.push(event);
            lastTimestamp = event.timestamp;
          });
          if (currentSoakEvents.length > 0) soaks.push(createSoak(currentSoakEvents, roster));
        }

        const sets: SoakSet[] = [];
        const SET_GAP_MS = 15000;
        
        if (soaks.length > 0) {
          let currentSetSoaks: Soak[] = [];
          let lastSoakTimestamp = soaks[0].timestamp;
          
          soaks.forEach((soak: Soak) => {
            if (soak.timestamp - lastSoakTimestamp > SET_GAP_MS && currentSetSoaks.length > 0) {
              sets.push(createSet(sets.length + 1, currentSetSoaks));
              currentSetSoaks = [];
            }
            currentSetSoaks.push(soak);
            lastSoakTimestamp = soak.timestamp;
          });
          if (currentSetSoaks.length > 0) sets.push(createSet(sets.length + 1, currentSetSoaks));
        }

        setResult({ reportId, fightId, sets });
      } catch (err: any) {
        console.error("Analysis failed:", err);
        setError(err?.message || "Failed to process hierarchy.");
      } finally {
        setLoading(false);
      }
    };

    analyze();
  }, [accessToken, reportId, fightId]);

  const createSoak = (events: AverzianDamageEvent[], roster: any[]): Soak => {
    const total = events.reduce((sum, e) => sum + e.amount, 0);
    const soakers = new Set(events.map(e => e.targetName));
    
    const missedPlayers = roster
      .filter(p => !soakers.has(p.name))
      .map(p => ({ name: p.name, class: p.class }));

    return {
      timestamp: events[0].timestamp,
      events,
      missedPlayers,
      totalDamage: total,
      averageDamage: Math.round(total / (events.length || 1))
    };
  };

  const createSet = (id: number, soaks: Soak[]): SoakSet => {
    return {
      id,
      startTime: soaks[0].timestamp,
      endTime: soaks[soaks.length - 1].timestamp,
      soaks,
      totalDamage: soaks.reduce((sum, s) => sum + s.totalDamage, 0)
    };
  };

  const getClassColor = (className?: string) => {
    if (!className) return 'var(--text-color)';
    const colors: Record<string, string> = {
      'Warrior': '#C79C6E',
      'Paladin': '#F58CBA',
      'Hunter': '#ABD473',
      'Rogue': '#FFF569',
      'Priest': '#FFFFFF',
      'DeathKnight': '#C41F3B',
      'Shaman': '#0070DE',
      'Mage': '#3FC7EB',
      'Warlock': '#8787ED',
      'Monk': '#00FF96',
      'Druid': '#FF7D0A',
      'DemonHunter': '#A330C9',
      'Evoker': '#33937F'
    };
    const normalized = className.replace(/\s+/g, '');
    return colors[normalized] || 'var(--text-color)';
  };

  const formatTime = (ms: number) => {
    const totalSeconds = Math.round(ms / 1000);
    if (totalSeconds < 60) return `${totalSeconds}s`;
    
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center p-20">
      <div className="loading-spinner"></div>
      <p className="mt-4 text-purple-400 animate-pulse">Analyzing soak performance...</p>
    </div>
  );

  if (error) return (
    <div className="glass-panel p-10 text-center border-red-500/50">
      <AlertCircle size={48} className="mx-auto text-red-500 mb-4" />
      <h3 className="text-xl font-bold text-red-400">Audit Error</h3>
      <p className="text-gray-400">{error}</p>
    </div>
  );

  if (!result || result.sets.length === 0) return (
    <div className="glass-panel p-10 text-center">
      <AlertCircle size={48} className="mx-auto text-gray-500 mb-4" />
      <h3 className="text-xl font-bold">No Data Available</h3>
      <p className="text-gray-400">No Umbral Collapse sets detected in this encounter.</p>
    </div>
  );

  return (
    <div className="averzian-analyzer space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="glass-panel p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-purple-600/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-px w-8 bg-accent-color"></div>
            <span className="text-accent-color uppercase tracking-widest text-xs font-bold">Mechanical Audit</span>
          </div>
          <h2 className="text-4xl font-bold bg-gradient-to-r from-white to-purple-400 bg-clip-text text-transparent">
            Umbral Collapse Soak Analysis
          </h2>
          <p className="text-gray-400 mt-2 max-w-2xl">
            Identifying missed individual soaks. Expanded views show only players who failed to contribute to the mechanic.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {result.sets.map((set) => (
          <div key={set.id} className="glass-panel overflow-hidden border-white/5 transition-all duration-300">
            <div 
              className={`p-5 flex items-center justify-between cursor-pointer transition-colors ${expandedSet === set.id ? 'bg-white/5' : 'hover:bg-white/[0.02]'}`}
              onClick={() => setExpandedSet(expandedSet === set.id ? null : set.id)}
            >
              <div className="flex items-center gap-6">
                <div className="flex flex-col items-center justify-center w-10 h-10 rounded-lg bg-accent-color/10 border border-accent-color/20">
                  <Layers className="text-accent-color" size={18} />
                </div>
                <div>
                  <div className="text-xl font-bold text-gray-100">Umbral Collapse Set {set.id}</div>
                  <div className="text-xs text-gray-500 font-medium">Started at {formatTime(set.startTime - fightStartTime)}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {expandedSet === set.id ? <ChevronUp className="text-gray-400" /> : <ChevronDown className="text-gray-400" />}
              </div>
            </div>

            {expandedSet === set.id && (
              <div className="p-5 pt-0 border-t border-white/5 bg-black/30 animate-in slide-in-from-top-2 duration-300">
                <div className="mt-4 space-y-2 ml-4">
                  {set.soaks.map((soak, sIdx) => {
                    const soakKey = `${set.id}-${sIdx}`;
                    const isSoakExpanded = expandedSoak === soakKey;
                    
                    return (
                      <div key={soakKey} className="rounded-lg border border-white/5 bg-white/[0.01] overflow-hidden transition-all duration-300">
                        <div 
                          className={`p-3 flex items-center justify-between cursor-pointer transition-colors ${isSoakExpanded ? 'bg-white/5' : 'hover:bg-white/[0.01]'}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedSoak(isSoakExpanded ? null : soakKey);
                          }}
                        >
                          <div className="flex items-center text-sm w-full">
                            <span className="font-mono text-gray-500 font-bold w-16">+{formatTime(soak.timestamp - fightStartTime)}</span>
                            <span className="text-gray-300 font-bold ml-8">Soak {sIdx + 1}</span>
                            
                            <div className="ml-auto flex items-center gap-10">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-black text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded border border-blue-400/20">
                                  {soak.events.length}
                                </span>
                                <span className="text-[10px] uppercase text-gray-500 font-bold">Players Soaked</span>
                              </div>
                              <span className="text-xs font-bold text-accent-color">Avg: {soak.averageDamage.toLocaleString()}</span>
                            </div>
                          </div>
                          <div className="ml-6">
                            {isSoakExpanded ? <ChevronUp size={14} className="text-gray-500" /> : <ChevronDown size={14} className="text-gray-500" />}
                          </div>
                        </div>

                        {isSoakExpanded && (
                          <div className="p-4 bg-red-500/5 border-t border-red-500/10 animate-in slide-in-from-top-1 duration-200">
                            <div className="flex items-center gap-2 mb-3 text-red-400">
                              <AlertCircle size={14} />
                              <span className="text-xs font-black uppercase tracking-widest">Missed Soakers ({soak.missedPlayers.length})</span>
                            </div>
                            {soak.missedPlayers.length === 0 ? (
                              <p className="text-xs text-gray-500 italic">No failures detected. Everyone soaked!</p>
                            ) : (
                              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                                {soak.missedPlayers.map((player, pIdx) => (
                                  <div key={pIdx} className="p-2 bg-black/40 rounded border border-white/5">
                                    <span 
                                      className="text-xs font-bold truncate block"
                                      style={{ color: getClassColor(player.class) }}
                                    >
                                      {player.name}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default AverzianDashboard;
