import React, { useEffect, useState } from 'react';
import { fetchAverzianDamageEvents } from '../services/wclEvents';
import type { AverzianAnalysisResult, Soak, SoakSet, AverzianDamageEvent } from '../types/analyzer';
import { Shield, AlertCircle, Clock, ChevronDown, ChevronUp, Activity, Layers } from 'lucide-react';

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
        const events = await fetchAverzianDamageEvents(accessToken, reportId, fightId);
        
        const soaks: Soak[] = [];
        const SOAK_GAP_MS = 1000;
        
        if (events.length > 0) {
          let currentSoakEvents: AverzianDamageEvent[] = [];
          let lastTimestamp = events[0].timestamp;
          
          events.forEach((event: AverzianDamageEvent) => {
            if (event.timestamp - lastTimestamp > SOAK_GAP_MS && currentSoakEvents.length > 0) {
              soaks.push(createSoak(currentSoakEvents));
              currentSoakEvents = [];
            }
            currentSoakEvents.push(event);
            lastTimestamp = event.timestamp;
          });
          if (currentSoakEvents.length > 0) soaks.push(createSoak(currentSoakEvents));
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

  const createSoak = (events: AverzianDamageEvent[]): Soak => {
    const total = events.reduce((sum, e) => sum + e.amount, 0);
    return {
      timestamp: events[0].timestamp,
      events,
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
    // WCL might return subType as "Death Knight" or "Demon Hunter"
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
      <p className="mt-4 text-purple-400 animate-pulse">Building encounter hierarchy...</p>
    </div>
  );

  if (error) return (
    <div className="glass-panel p-10 text-center border-red-500/50">
      <AlertCircle size={48} className="mx-auto text-red-500 mb-4" />
      <h3 className="text-xl font-bold text-red-400">Analysis Error</h3>
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

  const totalDamage = result.sets.reduce((sum, s) => sum + s.totalDamage, 0);
  const totalSoaks = result.sets.reduce((sum, s) => sum + s.soaks.length, 0);

  return (
    <div className="averzian-analyzer space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="glass-panel p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-purple-600/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-px w-8 bg-accent-color"></div>
            <span className="text-accent-color uppercase tracking-widest text-xs font-bold">Encouter Hierarchy</span>
          </div>
          <h2 className="text-4xl font-bold bg-gradient-to-r from-white to-purple-400 bg-clip-text text-transparent">
            Umbral Collapse Sets
          </h2>
          <p className="text-gray-400 mt-2 max-w-2xl">
            Grouped analysis of mechanical waves. Hits at the same second form a <strong>Soak</strong>, and soaks within 15 seconds form a <strong>Set</strong>.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-panel p-4 flex items-center gap-4 border-l-4 border-l-purple-500 hover:bg-white/[0.02] transition-colors">
          <div className="p-3 bg-purple-500/10 rounded-xl">
            <Layers className="text-purple-400" size={24} />
          </div>
          <div>
            <div className="text-xs text-gray-500 uppercase font-black tracking-tighter">Total Sets</div>
            <div className="text-2xl font-bold">{result.sets.length}</div>
          </div>
        </div>
        <div className="glass-panel p-4 flex items-center gap-4 border-l-4 border-l-blue-500 hover:bg-white/[0.02] transition-colors">
          <div className="p-3 bg-blue-500/10 rounded-xl">
            <Activity className="text-blue-400" size={24} />
          </div>
          <div>
            <div className="text-xs text-gray-500 uppercase font-black tracking-tighter">Total Soaks</div>
            <div className="text-2xl font-bold">{totalSoaks}</div>
          </div>
        </div>
        <div className="glass-panel p-4 flex items-center gap-4 border-l-4 border-l-emerald-500 hover:bg-white/[0.02] transition-colors">
          <div className="p-3 bg-emerald-500/10 rounded-xl">
            <Shield className="text-emerald-400" size={24} />
          </div>
          <div>
            <div className="text-xs text-gray-500 uppercase font-black tracking-tighter">Total Taken</div>
            <div className="text-2xl font-bold">{(totalDamage / 1000000).toFixed(1)}M</div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {result.sets.map((set) => (
          <div key={set.id} className="glass-panel overflow-hidden border-white/5 transition-all duration-300">
            <div 
              className={`p-6 flex items-center justify-between cursor-pointer transition-colors ${expandedSet === set.id ? 'bg-white/5' : 'hover:bg-white/[0.02]'}`}
              onClick={() => setExpandedSet(expandedSet === set.id ? null : set.id)}
            >
              <div className="flex items-center gap-6">
                <div className="flex flex-col items-center justify-center w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20">
                  <span className="text-[10px] text-purple-400 font-black uppercase">Set</span>
                  <span className="text-xl font-bold text-white leading-none">{set.id}</span>
                </div>
                <div>
                  <div className="text-lg font-bold text-gray-200">{set.soaks.length} Phase Waves</div>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><Clock size={12} /> +{formatTime(set.startTime - fightStartTime)}</span>
                    <span className="flex items-center gap-1"><Shield size={12} /> {(set.totalDamage / 1000000).toFixed(2)}M damage</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {expandedSet === set.id ? <ChevronUp className="text-gray-400" /> : <ChevronDown className="text-gray-400" />}
              </div>
            </div>

            {expandedSet === set.id && (
              <div className="p-6 pt-0 border-t border-white/5 bg-black/20 animate-in slide-in-from-top-2 duration-300">
                <div className="mt-6 space-y-3">
                  {set.soaks.map((soak, sIdx) => {
                    const soakKey = `${set.id}-${sIdx}`;
                    const isSoakExpanded = expandedSoak === soakKey;
                    
                    return (
                      <div key={soakKey} className="rounded-lg border border-white/5 bg-white/[0.02] overflow-hidden transition-all duration-300">
                        <div 
                          className={`p-3 flex items-center justify-between cursor-pointer transition-colors ${isSoakExpanded ? 'bg-white/5' : 'hover:bg-white/[0.02]'}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedSoak(isSoakExpanded ? null : soakKey);
                          }}
                        >
                          <div className="flex items-center gap-4 text-sm">
                            <span className="font-mono text-gray-500 font-bold">+{formatTime(soak.timestamp - fightStartTime)}</span>
                            <span className="text-gray-200">Soak Hit # {sIdx + 1}</span>
                            <span className="text-[10px] px-2 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full uppercase">
                              {soak.events.length} Hit
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-bold text-accent-color">Avg: {soak.averageDamage.toLocaleString()}</span>
                            {isSoakExpanded ? <ChevronUp size={14} className="text-gray-500" /> : <ChevronDown size={14} className="text-gray-500" />}
                          </div>
                        </div>

                        {isSoakExpanded && (
                          <div className="p-3 pt-0 border-t border-white/5 animate-in slide-in-from-top-1 duration-200">
                            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                              {soak.events.map((event, eIdx) => (
                                <div key={eIdx} className="p-2 bg-black/40 rounded border border-white/5 flex items-center justify-between">
                                  <span 
                                    className="text-xs font-bold truncate pr-2"
                                    style={{ color: getClassColor(event.targetClass) }}
                                  >
                                    {event.targetName}
                                  </span>
                                  <span className="text-[10px] font-mono font-bold text-emerald-400">{event.amount.toLocaleString()}</span>
                                </div>
                              ))}
                            </div>
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
