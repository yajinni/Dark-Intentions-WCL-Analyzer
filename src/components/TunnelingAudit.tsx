import React from 'react';
import type { TunnelingEntry } from '../types/analyzer';
import { Target, AlertTriangle } from 'lucide-react';

interface Props {
  entries: TunnelingEntry[];
}

const TunnelingAudit: React.FC<Props> = ({ entries }) => {
  const totalTunneling = entries.reduce((sum, e) => sum + e.tunnelingDamage, 0);
  
  // Sort by damage descending
  const sortedEntries = [...entries].sort((a, b) => b.tunnelingDamage - a.tunnelingDamage);

  const getClassColor = (playerClass: string) => {
    const colors: Record<string, string> = {
      'Warrior': '#C79C6E',
      'Paladin': '#F58CBA',
      'Hunter': '#ABD473',
      'Rogue': '#FFF569',
      'Priest': '#FFFFFF',
      'DeathKnight': '#C41F3B',
      'Shaman': '#0070DE',
      'Mage': '#69CCF0',
      'Warlock': '#9482C9',
      'Monk': '#00FF96',
      'Druid': '#FF7D0A',
      'DemonHunter': '#A330C9',
      'Evoker': '#33937F'
    };
    return colors[playerClass] || '#A0A0A0';
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Summary Header */}
      <div className="glass-panel p-6 mb-6 border-l-4 border-l-purple-500">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-purple-500/20 rounded-lg">
            <Target className="text-purple-400" size={24} />
          </div>
          <div>
            <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Total Boss Tunneling</span>
            <div className="text-2xl font-mono font-bold text-white">
              {totalTunneling.toLocaleString()} <span className="text-sm font-normal text-gray-400">Total Wasted Damage</span>
            </div>
          </div>
          {totalTunneling > 10000000 && (
            <div className="ml-auto flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs font-bold">
              <AlertTriangle size={14} />
              CRITICAL OVER-TUNNELING DETECTED
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4 px-2">
        <Target size={16} className="text-purple-400" />
        <span className="text-sm font-bold text-gray-100 uppercase tracking-tight">Player Tunneling Audit</span>
      </div>

      {/* Audit List */}
      <div className="soak-list">
        {sortedEntries.length === 0 ? (
          <div className="glass-panel p-12 text-center text-gray-500 italic">
            No boss tunneling detected. Excellent target priority!
          </div>
        ) : (
          sortedEntries.map((entry, idx) => (
            <div key={entry.playerName} className="soak-row hover:bg-white/[0.04]">
              {/* Rank */}
              <div className="w-8 shrink-0 text-gray-600 font-bold text-xs">
                #{idx + 1}
              </div>

              {/* Player Name */}
              <div className="w-48 shrink-0 font-bold" style={{ color: getClassColor(entry.playerClass) }}>
                {entry.playerName}
              </div>

              {/* Damage Bar & Value */}
              <div className="flex-grow flex items-center gap-4">
                <div className="flex-grow h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-purple-600 to-purple-400 rounded-full"
                    style={{ width: `${entry.tunnelingPercentage}%` }}
                  ></div>
                </div>
                
                <div className="w-32 text-right">
                  <span className="text-sm font-mono font-bold text-white">
                    {entry.tunnelingDamage.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-gray-500 ml-2">
                    ({entry.tunnelingPercentage.toFixed(1)}%)
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default TunnelingAudit;
