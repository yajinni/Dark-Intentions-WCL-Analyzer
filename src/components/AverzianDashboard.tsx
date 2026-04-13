import React, { useEffect, useState } from 'react';
import { fetchAverzianDamageEvents } from '../services/wclEvents';
import { fetchTunnelingData } from '../services/tunneling';
import type { AverzianAnalysisResult, Soak, SoakSet, AverzianDamageEvent } from '../types/analyzer';
import { AlertCircle, Target, Waves, Clock, Info } from 'lucide-react';

interface Props {
  accessToken: string;
  reportId: string;
  fightId: number;
  fightStartTime: number;
  fightEndTime: number;
}

const AverzianDashboard: React.FC<Props> = ({ accessToken, reportId, fightId, fightStartTime, fightEndTime }) => {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'soaks' | 'tunneling'>('soaks');
  const [result, setResult] = useState<AverzianAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const analyze = async () => {
      setLoading(true);
      setError(null);
      try {
        const [events, tunnelingData] = await Promise.all([
          fetchAverzianDamageEvents(accessToken, reportId, fightId),
          fetchTunnelingData(accessToken, reportId, fightId, fightStartTime, fightEndTime)
        ]);
        
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

        setResult({ 
          reportId, 
          fightId, 
          sets, 
          tunnelingEntries: tunnelingData.entries,
          addsAliveWindows: tunnelingData.windows,
          npcLifespans: tunnelingData.npcLifespans
        });
      } catch (err: any) {
        console.error("Analysis failed:", err);
        setError(err?.message || "Failed to process hierarchy.");
      } finally {
        setLoading(false);
      }
    };

    analyze();
  }, [accessToken, reportId, fightId, fightStartTime, fightEndTime]);

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
      <p className="mt-4 text-purple-400 animate-pulse">Analyzing soak logs...</p>
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
      <p className="text-gray-400">No Umbral Collapse events detected.</p>
    </div>
  );

  return (
    <div className="averzian-analyzer space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="glass-panel p-8 relative overflow-hidden mb-6">
        <div className="absolute top-0 right-0 w-64 h-64 bg-purple-600/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="h-px w-8 bg-accent-color"></div>
              <span className="text-accent-color uppercase tracking-widest text-[10px] font-bold">Encounter Analyzer</span>
            </div>
            <h2 className="text-3xl font-bold bg-gradient-to-r from-white to-purple-400 bg-clip-text text-transparent">
              Imperator Averzian
            </h2>
          </div>

          {/* Tab Switcher */}
          <div className="flex bg-black/40 p-1 rounded-xl border border-white/5 backdrop-blur-md">
            <button 
              onClick={() => setActiveTab('soaks')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'soaks' 
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20' 
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <Waves size={14} />
              SOAK SUMMARY
            </button>
            <button 
              onClick={() => setActiveTab('tunneling')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'tunneling' 
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20' 
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <Target size={14} />
              BOSS TUNNELING
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'soaks' ? (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="flex items-center gap-2 mb-4 px-2">
            <Waves size={16} className="text-purple-400" />
            <span className="text-sm font-bold text-gray-100 uppercase tracking-tight">Umbral Collapse Soaks</span>
          </div>
          {/* Soak List */}
          <div className="soak-list">
            {result.sets.flatMap(set => set.soaks).map((soak, sIdx) => (
              <div key={`soak-${sIdx}`} className="soak-row">
                <div className="soak-timestamp">+{formatTime(soak.timestamp - fightStartTime)}</div>
                <div className="soak-label">Soak {sIdx + 1}</div>
                <div className="soak-avg-hit">
                  <span className="soak-avg-hit-label">Avg Hit </span>
                  <span className="soak-avg-hit-value">{soak.averageDamage.toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="tunneling-audit animate-in fade-in slide-in-from-bottom-2 duration-500 space-y-6">
          {/* Summary Card */}
          {(() => {
            const totalWasted = result.tunnelingEntries?.reduce((sum, e) => sum + e.tunnelingDamage, 0) || 0;
            const isCritical = totalWasted > 10000000;
            return (
              <div className={`glass-panel p-6 border-l-4 ${isCritical ? 'border-l-red-500' : 'border-l-purple-500'}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-1">Total Wasted Damage</div>
                    <div className="text-3xl font-black text-white flex items-baseline gap-2">
                      {Math.round(totalWasted).toLocaleString()}
                      {isCritical && <span className="text-red-500 text-xs animate-pulse">! CRITICAL OVER-TUNNELING</span>}
                    </div>
                  </div>
                  <Info size={20} className="text-gray-600" />
                </div>
              </div>
            );
          })()}

          {/* NPC Lifecycle Timeline */}
          {result.npcLifespans && result.npcLifespans.length > 0 && (
            <div className="glass-panel p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Clock size={16} className="text-purple-400" />
                  <h3 className="text-sm font-bold text-gray-100 uppercase tracking-widest">Individual NPC Lifespans</h3>
                </div>
                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-tight italic">Sorted by Spawn Time</div>
              </div>
              
              <div className="space-y-3">
                {result.npcLifespans.map((npc, idx) => {
                  const duration = (npc.death - npc.spawn) / 1000;
                  return (
                    <div key={`${npc.id}-${idx}`} className="bg-white/5 border border-white/10 p-4 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-4 group hover:bg-white/[0.08] transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center text-[10px] font-bold text-purple-400 border border-purple-500/20">
                          {idx + 1}
                        </div>
                        <div>
                          <div className="text-sm font-black text-white uppercase tracking-wide">{npc.name}</div>
                          <div className="text-[10px] text-gray-500 font-mono">ID: {npc.id}</div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <div className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter">Active Duration</div>
                          <div className="text-xs font-mono text-purple-200">
                            {formatTime(npc.spawn - fightStartTime)} - {formatTime(npc.death - fightStartTime)}
                          </div>
                        </div>
                        
                        <div className="w-20 text-center">
                          <span className={`text-sm font-black px-3 py-1 rounded-full ${
                            duration > 30 ? 'bg-red-500/20 text-red-400' : 'bg-purple-600/20 text-purple-300'
                          }`}>
                            {duration.toFixed(1)}s
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Player Rankings */}
          <div className="glass-panel overflow-hidden">
            <div className="p-4 border-b border-white/5 bg-white/5 flex items-center gap-3">
              <Target size={16} className="text-purple-400" />
              <h3 className="text-sm font-bold text-gray-300 uppercase tracking-widest">Tunneling Rankings</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] font-bold text-gray-500 uppercase tracking-widest border-b border-white/5">
                    <th className="px-6 py-4">Player</th>
                    <th className="px-6 py-4">Boss Output While Adds Up</th>
                    <th className="px-6 py-4 text-right">Wasted %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {result.tunnelingEntries?.map((entry, idx) => (
                    <tr key={idx} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="px-6 py-4">
                        <div className={`font-bold class-${entry.playerClass.toLowerCase()}`}>
                          {entry.playerName}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          <div className="flex-1 h-2 bg-black/40 rounded-full overflow-hidden max-w-[150px]">
                            <div 
                              className="h-full bg-purple-500 rounded-full transition-all duration-1000"
                              style={{ width: `${entry.tunnelingPercentage}%` }}
                            ></div>
                          </div>
                          <span className="text-sm font-mono text-white">
                            {Math.round(entry.tunnelingDamage).toLocaleString()}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className={`text-sm font-bold ${entry.tunnelingPercentage > 50 ? 'text-red-400' : 'text-gray-300'}`}>
                          {entry.tunnelingPercentage.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AverzianDashboard;
