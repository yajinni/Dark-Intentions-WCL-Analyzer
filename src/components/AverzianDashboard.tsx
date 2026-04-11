import React, { useEffect, useState } from 'react';
import { fetchAverzianDamageEvents } from '../services/wclEvents';
import type { AverzianAnalysisResult } from '../types/analyzer';
import { Shield, AlertCircle, Clock, Users } from 'lucide-react';

interface Props {
  accessToken: string;
  reportId: string;
  fightId: number;
}

const AverzianDashboard: React.FC<Props> = ({ accessToken, reportId, fightId }) => {
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<AverzianAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const analyze = async () => {
      setLoading(true);
      setError(null);
      try {
        const events = await fetchAverzianDamageEvents(accessToken, reportId, fightId);
        setResult({ reportId, fightId, events });
      } catch (err: any) {
        console.error("Analysis failed:", err);
        setError(err?.message || "Failed to fetch event data.");
      } finally {
        setLoading(false);
      }
    };

    analyze();
  }, [accessToken, reportId, fightId]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center p-20">
      <div className="loading-spinner"></div>
      <p className="mt-4 text-purple-400 animate-pulse">Fetching Umbral Collapse events...</p>
    </div>
  );

  if (error) return (
    <div className="glass-panel p-10 text-center border-red-500/50">
      <AlertCircle size={48} className="mx-auto text-red-500 mb-4" />
      <h3 className="text-xl font-bold text-red-400">Fetch Error</h3>
      <p className="text-gray-400">{error}</p>
    </div>
  );

  if (!result || result.events.length === 0) return (
    <div className="glass-panel p-10 text-center">
      <AlertCircle size={48} className="mx-auto text-gray-500 mb-4" />
      <h3 className="text-xl font-bold">No Events Found</h3>
      <p className="text-gray-400">No damage events for spell 1249262 were found in this fight.</p>
    </div>
  );

  const totalDamage = result.events.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="averzian-analyzer space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="glass-panel p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-purple-600/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-px w-8 bg-accent-color"></div>
            <span className="text-accent-color uppercase tracking-widest text-xs font-bold">Fresh Start</span>
          </div>
          <h2 className="text-4xl font-bold bg-gradient-to-r from-white to-purple-400 bg-clip-text text-transparent">
            Umbral Collapse Log
          </h2>
          <p className="text-gray-400 mt-2 max-w-2xl">
            A raw list of all damage taken from Spell ID 1249262 (Umbral Collapse) for Imperator Averzian.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="glass-panel p-4 flex items-center gap-4 border-l-4 border-l-purple-500">
          <div className="p-3 bg-purple-500/10 rounded-xl">
            <Clock className="text-purple-400" size={24} />
          </div>
          <div>
            <div className="text-xs text-gray-500 uppercase font-black">Total Events</div>
            <div className="text-2xl font-bold">{result.events.length}</div>
          </div>
        </div>
        <div className="glass-panel p-4 flex items-center gap-4 border-l-4 border-l-emerald-500">
          <div className="p-3 bg-emerald-500/10 rounded-xl">
            <Shield className="text-emerald-400" size={24} />
          </div>
          <div>
            <div className="text-xs text-gray-500 uppercase font-black">Total Damage</div>
            <div className="text-2xl font-bold">{(totalDamage / 1000000).toFixed(1)}M</div>
          </div>
        </div>
      </div>

      <div className="glass-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-0">
            <thead>
              <tr className="bg-white/5">
                <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-widest text-gray-400 border-b border-white/10">Timestamp</th>
                <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-widest text-gray-400 border-b border-white/10">Player</th>
                <th className="px-6 py-4 text-right text-xs font-black uppercase tracking-widest text-gray-400 border-b border-white/10">Damage Taken</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {result.events.map((event, index) => (
                <tr key={index} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-6 py-4 text-sm font-mono text-gray-500">
                    +{((event.timestamp - result.events[0].timestamp) / 1000).toFixed(1)}s
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                      <span className="font-bold text-gray-200">{event.targetName}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-accent-color font-bold">{event.amount.toLocaleString()}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AverzianDashboard;
