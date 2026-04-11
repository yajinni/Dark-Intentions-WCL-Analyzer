import React, { useEffect, useState } from 'react';
import { fetchSoakEvents, fetchDamageDoneEvents, fetchRaidRoster, fetchActorMapping } from '../services/wclEvents';
import type { SoakWave, TunnelingReport, AverzianAnalysisResult } from '../types/analyzer';
import { Shield, Target, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';

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
      const [soakEvents, damageEvents, roster, actorMap] = await Promise.all([
        fetchSoakEvents(accessToken, reportId, fightId),
        fetchDamageDoneEvents(accessToken, reportId, fightId),
        fetchRaidRoster(accessToken, reportId, fightId),
        fetchActorMapping(accessToken, reportId, fightId)
      ]);

      const findIdByFuzzyName = (names: string[]) => {
        const entry = Object.entries(actorMap).find(([actorName]) => 
          names.some(n => actorName.toLowerCase().includes(n.toLowerCase()))
        );
        return entry ? (entry[1] as any).id : undefined;
      };

      let bossId = findIdByFuzzyName(["Imperator Averzian", "Averzian"]);
      
      // Fallback: If no boss is found by name, pick the NPC with most damage taken
      if (!bossId) {
        const mostDamaged = Object.entries(actorMap)
          .sort((a, b) => (b[1] as any).total - (a[1] as any).total)[0];
        if (mostDamaged) bossId = (mostDamaged[1] as any).id;
      }

      const addKeywords = ["Voidshaper", "Voidmaw", "Shadowguard", "Annihilator", "Void"];
      const addIds = new Set<number>();
      Object.entries(actorMap).forEach(([name, data]) => {
        const actorData = data as any;
        if (addKeywords.some(k => name.toLowerCase().includes(k.toLowerCase())) && actorData.id !== bossId) {
          addIds.add(actorData.id);
        }
      });

      // 1. Process Soak Waves
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

      // 2. Process Tunneling
      // Filter for boss damage and add damage using IDs
      const addDamageEvents = damageEvents.filter((e: any) => addIds.has(e.targetID));
      const bossDamageEvents = damageEvents.filter((e: any) => e.targetID === bossId);
      
      const tunnelingReports: TunnelingReport[] = roster.map(player => {
        const playerBossDamageDuringAdds = bossDamageEvents
          .filter((e: any) => e.sourceID === player.id)
          .filter((e: any) => isDuringAdds(e.timestamp, addDamageEvents))
          .reduce((sum: number, e: any) => sum + (e.amount || 0), 0);
          
        const playerAddDamage = addDamageEvents
          .filter((e: any) => e.sourceID === player.id)
          .reduce((sum: number, e: any) => sum + (e.amount || 0), 0);
          
        const score = playerBossDamageDuringAdds > 0 
          ? (playerBossDamageDuringAdds / (playerBossDamageDuringAdds + playerAddDamage)) * 100 
          : 0;

        return {
          playerName: player.name,
          bossDamage: playerBossDamageDuringAdds,
          addDamage: playerAddDamage,
          tunnelingScore: Math.round(score)
        };
      }).filter(r => r.bossDamage > 0 || r.addDamage > 0)
        .sort((a, b) => b.tunnelingScore - a.tunnelingScore);

      setResult({ reportId, fightId, soakWaves, tunnelingPlayers: tunnelingReports });
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

  const isDuringAdds = (timestamp: number, addEvents: any[]) => {
    const ADD_WINDOW_MS = 5000; // If add damage occurred within 5s, consider adds active
    return addEvents.some((e: any) => Math.abs(e.timestamp - timestamp) < ADD_WINDOW_MS);
  };

  if (loading) return <div className="loading-spinner"></div>;
  if (!result) return <div>Failed to analyze encounter.</div>;

  return (
    <div className="averzian-analyzer" style={{ animation: 'fadeIn 0.5s ease-out' }}>
      <div className="section-header" style={{ marginBottom: '40px' }}>
        <h2 style={{ color: 'var(--accent-color)', fontSize: '2rem' }}>Imperator Averzian Insights</h2>
        <p>Detailed performance breakdown for Soak mechanics and Add priority.</p>
      </div>

      <div className="analyzer-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
        {/* Soak Analysis */}
        <div className="glass-panel" style={{ padding: '30px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
            <Shield className="text-primary" size={24} color="var(--primary-color)" />
            <h3 style={{ margin: 0 }}>Umbral Collapse Soaking</h3>
          </div>
          
          <div className="soak-list">
            {result.soakWaves.map((wave, index) => (
              <div key={index} className="soak-row" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '15px 0' }}>
                <div 
                  style={{ display: 'flex', justifyContent: 'space-between', cursor: 'pointer' }}
                  onClick={() => setExpandedSoak(expandedSoak === index ? null : index)}
                >
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Wave {index + 1}</span>
                    <div style={{ fontWeight: 600 }}>{wave.soakers.length} Soakers</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: 'var(--accent-color)' }}>Avg: {wave.averageDamage.toLocaleString()}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Total: {wave.totalDamage.toLocaleString()}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', marginLeft: '15px' }}>
                    {expandedSoak === index ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </div>
                </div>

                {expandedSoak === index && (
                  <div style={{ marginTop: '15px', padding: '15px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', animation: 'fadeIn 0.3s ease' }}>
                    <h4 style={{ fontSize: '0.9rem', color: '#ef4444', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <AlertCircle size={14} /> Did Not Soak ({wave.missedPlayers.length})
                    </h4>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {wave.missedPlayers.map(p => (
                        <span key={p} style={{ fontSize: '0.8rem', padding: '4px 8px', background: 'rgba(239, 68, 68, 0.1)', color: '#fca5a5', borderRadius: '4px' }}>
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Tunneling Analysis */}
        <div className="glass-panel" style={{ padding: '30px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
            <Target className="text-accent" size={24} color="var(--accent-color)" />
            <h3 style={{ margin: 0 }}>Add Priority (Boss Tunneling)</h3>
          </div>
          
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.8rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <th style={{ paddingBottom: '10px' }}>Player</th>
                <th style={{ paddingBottom: '10px' }}>Boss Dmg (during Adds)</th>
                <th style={{ paddingBottom: '10px' }}>Add Dmg</th>
                <th style={{ paddingBottom: '10px' }}>Tunneling %</th>
              </tr>
            </thead>
            <tbody>
              {result.tunnelingPlayers.slice(0, 10).map((player, index) => (
                <tr key={index} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                  <td style={{ padding: '12px 0', fontWeight: 600 }}>{player.playerName}</td>
                  <td style={{ padding: '12px 0' }}>{player.bossDamage.toLocaleString()}</td>
                  <td style={{ padding: '12px 0' }}>{player.addDamage.toLocaleString()}</td>
                  <td style={{ padding: '12px 0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ flex: 1, height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ 
                          width: `${player.tunnelingScore}%`, 
                          height: '100%', 
                          background: player.tunnelingScore > 70 ? '#ef4444' : player.tunnelingScore > 40 ? '#f59e0b' : '#10b981' 
                        }}></div>
                      </div>
                      <span style={{ minWidth: '40px', textAlign: 'right', fontWeight: 700 }}>{player.tunnelingScore}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {result.tunnelingPlayers.length > 10 && (
            <p style={{ marginTop: '20px', fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
              Showing top 10 players by boss focus.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AverzianDashboard;
