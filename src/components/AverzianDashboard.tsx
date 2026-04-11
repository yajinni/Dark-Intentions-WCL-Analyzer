import React, { useEffect, useState } from 'react';
import { fetchAverzianDamageEvents } from '../services/wclEvents';
import type { AverzianAnalysisResult, Soak, SoakSet, AverzianDamageEvent } from '../types/analyzer';
import { AlertCircle } from 'lucide-react';

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
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-1">
            <div className="h-px w-8 bg-accent-color"></div>
            <span className="text-accent-color uppercase tracking-widest text-[10px] font-bold">Log Summary</span>
          </div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-white to-purple-400 bg-clip-text text-transparent">
            Umbral Collapse Soaks
          </h2>
        </div>
      </div>

      {/* Soak List */}
      <div className="space-y-3">
        {result.sets.flatMap(set => set.soaks).map((soak, sIdx) => {
          return (
            <div 
              key={`soak-${sIdx}`} 
              className="glass-panel overflow-hidden transition-all duration-300 border border-white/5 hover:border-purple-500/30 hover:bg-white/[0.02] p-5"
            >
              <div className="flex items-center w-full">
                {/* Left: Timestamp */}
                <div className="w-24 shrink-0 flex items-center gap-2">
                  <span className="font-mono text-gray-400 font-bold bg-black/40 px-2 py-1 rounded text-xs border border-white/5">
                    +{formatTime(soak.timestamp - fightStartTime)}
                  </span>
                </div>

                {/* Center: Title */}
                <div className="flex-1 px-8">
                  <span className="text-lg font-bold text-gray-100 uppercase tracking-tight">Soak {sIdx + 1}</span>
                </div>

                {/* Right: Avg Damage */}
                <div className="flex items-center">
                  <div className="text-right">
                    <div className="text-[10px] uppercase text-gray-500 font-black leading-none mb-1">Avg hit</div>
                    <div className="text-xl font-mono font-bold text-emerald-400 tracking-tighter">
                      {soak.averageDamage.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AverzianDashboard;
