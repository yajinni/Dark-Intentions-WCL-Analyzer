import React, { useEffect, useState } from 'react';
import { fetchSoakEvents, fetchRaidRoster, fetchActorMapping } from '../services/wclEvents';
import type { SoakWave, AverzianAnalysisResult } from '../types/analyzer';
import { Shield, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  accessToken: string;
  reportId: string;
  fightId: number;
}

const AverzianDashboard: React.FC<Props> = ({ accessToken, reportId, fightId }) => {
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<AverzianAnalysisResult | null>(null);
  const [expandedSoak, setExpandedSoak] = useState<number | null>(null);

  useEffect(() => {
    analyzeFight();
  }, [reportId, fightId]);

  const analyzeFight = async () => {
    setLoading(true);
    try {
      const [soakEvents, roster, actorMap] = await Promise.all([
        fetchSoakEvents(accessToken, reportId, fightId),
        fetchRaidRoster(accessToken, reportId, fightId),
        fetchActorMapping(accessToken, reportId, fightId)
      ]);

      const findIdByGameID = (gameID: number) => {
        const entry = Object.entries(actorMap).find(([_, data]) => (data as any).gameID === gameID);
        return entry ? (entry[1] as any).id : undefined;
      };

      const findIdByFuzzyName = (names: string[]) => {
        const entry = Object.entries(actorMap).find(([actorName]) => 
          names.some(n => actorName.toLowerCase().includes(n.toLowerCase()))
        );
        return entry ? (entry[1] as any).id : undefined;
      };

      // 1. Try Game ID first
      let bossId = findIdByGameID(240435);
      
      // 2. Fallback to Name
      if (!bossId) bossId = findIdByFuzzyName(["Imperator Averzian", "Averzian"]);
      
      // 3. Ultimate Fallback: Most damaged target
      if (!bossId) {
        const mostDamaged = Object.entries(actorMap)
          .sort((a, b) => (b[1] as any).total - (a[1] as any).total)[0];
        if (mostDamaged) bossId = (mostDamaged[1] as any).id;
      }

      // Process Soak Waves
      const soakWaves: SoakWave[] = [];
      const SOAK_THRESHOLD_MS = 2000;
      
      let currentWave: any[] = [];
      let lastTime = 0;

      soakEvents.forEach((event: any) => {
        if (event.timestamp - lastTime > SOAK_THRESHOLD_MS && currentWave.length > 0) {
          soakWaves.push(processWave(currentWave, roster));
          currentWave = [];
        }
        currentWave.push(event);
        lastTime = event.timestamp;
      });
      if (currentWave.length > 0) soakWaves.push(processWave(currentWave, roster));

      setResult({ reportId, fightId, soakWaves });
    } catch (err) {
      console.error("Analysis failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const processWave = (events: any[], roster: any[]): SoakWave => {
    const soakersSet = new Set(events.map((e: any) => e.targetID));
    const soakers = roster.filter(p => soakersSet.has(p.id)).map(p => p.name);
    const missed = roster.filter(p => !soakersSet.has(p.id)).map(p => p.name);
    const totalDamage = events.reduce((sum: number, e: any) => sum + (e.amount || 0), 0);
    
    return {
      timestamp: events[0].timestamp,
      abilityId: events[0].ability.id,
      soakers,
      totalDamage,
      averageDamage: Math.round(totalDamage / (soakers.length || 1)),
      missedPlayers: missed
    };
  };


  if (loading) return (
    <div className="flex flex-col items-center justify-center p-20">
      <div className="loading-spinner"></div>
      <p className="mt-4 text-purple-400 animate-pulse">Analyzing encounter data...</p>
    </div>
  );

  if (!result) return (
    <div className="glass-panel p-10 text-center">
      <AlertCircle size={48} className="mx-auto text-red-500 mb-4" />
      <h3 className="text-xl font-bold">Analysis Unavailable</h3>
      <p className="text-gray-400">We couldn't resolve the encounter details. Please ensure the fight is correctly recorded.</p>
    </div>
  );

  return (
    <div className="averzian-analyzer space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Hero Header */}
      <div className="glass-panel p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-purple-600/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-px w-8 bg-accent-color"></div>
            <span className="text-accent-color uppercase tracking-widest text-xs font-bold">Combat Insight</span>
          </div>
          <h2 className="text-4xl font-bold bg-gradient-to-r from-white to-purple-400 bg-clip-text text-transparent">
            Imperator Averzian
          </h2>
          <p className="text-gray-400 mt-2 max-w-2xl">
            Mechanics audit focusing on grid soaking efficiency and identification of missed soakers.
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto">
        {/* Soak Analysis Card */}
        <div className="glass-panel p-6 border-l-4 border-l-primary-color">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <Shield className="text-primary-color" size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold">Umbral Collapse</h3>
                <p className="text-xs text-gray-400">Soak distribution audit</p>
              </div>
            </div>
          </div>
          
          <div className="space-y-4">
            {result.soakWaves.length === 0 ? (
              <div className="text-center py-10 text-gray-500 italic">No soak events detected in this window.</div>
            ) : result.soakWaves.map((wave, index) => (
              <div 
                key={index} 
                className={`group transition-all duration-300 rounded-xl border ${expandedSoak === index ? 'bg-white/5 border-purple-500/30' : 'bg-black/20 border-white/5 hover:border-white/10'}`}
              >
                <div 
                  className="p-4 flex items-center justify-between cursor-pointer"
                  onClick={() => setExpandedSoak(expandedSoak === index ? null : index)}
                >
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col items-center justify-center w-10 h-10 rounded-lg bg-black/40 border border-white/10">
                      <span className="text-xs text-gray-500 font-bold">W</span>
                      <span className="text-sm font-bold text-white">{index + 1}</span>
                    </div>
                    <div>
                      <div className="text-sm font-bold text-gray-200">{wave.soakers.length} Players Soaked</div>
                      <div className="text-xs text-gray-500">Avg. Damage: <span className="text-accent-color">{wave.averageDamage.toLocaleString()}</span></div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right hidden sm:block">
                      <div className="text-xs text-gray-500 uppercase tracking-tighter">Impact Time</div>
                      <div className="text-sm text-gray-300 font-mono">+{Math.round(wave.timestamp / 1000)}s</div>
                    </div>
                    {expandedSoak === index ? <ChevronUp className="text-gray-400" /> : <ChevronDown className="text-gray-400" />}
                  </div>
                </div>

                {expandedSoak === index && (
                  <div className="px-4 pb-4 animate-in slide-in-from-top-2 duration-300">
                    <div className="h-px bg-white/5 mb-4"></div>
                    <div className="space-y-4">
                      <div className="flex flex-col gap-2">
                        <span className="text-xs font-bold text-red-400 flex items-center gap-1.5 uppercase tracking-wider">
                          <AlertCircle size={12} /> Missed Soak ({wave.missedPlayers.length})
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {wave.missedPlayers.map(p => (
                            <span key={p} className="text-[10px] sm:text-xs px-2.5 py-1 bg-red-500/10 text-red-300 border border-red-500/20 rounded-full hover:bg-red-500/20 transition-colors">
                              {p}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AverzianDashboard;
