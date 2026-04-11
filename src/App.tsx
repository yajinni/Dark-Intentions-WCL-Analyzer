import { useEffect, useState } from 'react';
import { buildSdk } from '@rpglogs/api-sdk/dist/tsc/main';
import AverzianDashboard from './components/AverzianDashboard';
import { 
  Shield, BarChart3, Zap, Sword, LogOut, ChevronRight, 
  Search, Loader2, Target, Clock, AlertTriangle 
} from 'lucide-react';

function App() {
  const [accessToken, setAccessToken] = useState<string | null>(localStorage.getItem('wcl_token'));
  const [isAuthorized, setIsAuthorized] = useState<boolean>(false);
  const [logUrl, setLogUrl] = useState<string>('');
  const [fights, setFights] = useState<any[]>([]);
  const [isLoadingFights, setIsLoadingFights] = useState<boolean>(false);
  const [selectedFight, setSelectedFight] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);

  useEffect(() => {
    // Check for token in URL (from callback redirect)
    const params = new URLSearchParams(window.location.search);
    const token = params.get('access_token');
    
    if (token) {
      localStorage.setItem('wcl_token', token);
      setAccessToken(token);
      window.history.replaceState({}, document.title, "/"); // Clean URL
    }
  }, []);

  useEffect(() => {
    if (accessToken) {
      verifyToken();
    }
  }, [accessToken]);

  const verifyToken = async () => {
    if (!accessToken) return;
    try {
      const sdk = buildSdk(accessToken);
      // getRateLimit is a reliable way to check if the token is valid
      const data = await sdk.getRateLimit();
      if (data) {
        setIsAuthorized(true);
      }
    } catch (err) {
      console.error("Token verification failed:", err);
      handleLogout();
    }
  };

  const handleConnect = () => {
    window.location.href = '/api/auth';
  };

  const handleLogout = () => {
    localStorage.removeItem('wcl_token');
    setAccessToken(null);
    setIsAuthorized(false);
    setFights([]);
    setLogUrl('');
    setSelectedFight(null);
  };

  const parseReportId = (url: string) => {
    const regex = /(?:reports\/|reports\/|)([a-zA-Z0-9]{16})/;
    const match = url.match(regex);
    return match ? match[1] : null;
  };

  const handleFetchFights = async () => {
    const reportId = parseReportId(logUrl);
    if (!reportId) {
      setError("Invalid WCL URL. Please provide a valid report link.");
      return;
    }

    if (!accessToken) return;

    setError(null);
    setIsLoadingFights(true);
    setFights([]);
    setReportId(reportId);
    
    try {
      const sdk = buildSdk(accessToken);
      const data = await sdk.getReportFights({ 
        code: reportId,
        includeNpcs: false,
        includePlayers: false,
        includeDungeonPulls: false
      });
      
      const reportFights = data.reportData?.report?.fights;
      
      if (reportFights) {
        // Filter for boss encounters only (encounterID > 0)
        const bossFights = reportFights.filter((f: any) => f && f.encounterID > 0);
        setFights(bossFights);
        if (bossFights.length === 0) {
          setError("No boss encounters found in this report.");
        }
      } else {
        setError("Could not retrieve fights for this report.");
      }
    } catch (err) {
      console.error("Failed to fetch fights:", err);
      setError("Error accessing report. Make sure the report is public or your account has access.");
    } finally {
      setIsLoadingFights(false);
    }
  };

  const formatDuration = (start: number, end: number) => {
    const seconds = Math.floor((end - start) / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="app-container">
      <header>
        <div className="logo">
          <Shield size={28} color="#d4af37" />
          <span>DARK INTENTIONS</span>
        </div>
        
        {accessToken && isAuthorized ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <span style={{ color: 'var(--text-muted)' }}>
              Session <span style={{ color: 'var(--accent-color)', fontWeight: 600 }}>Active</span>
            </span>
            <button onClick={handleLogout} className="btn-primary" style={{ padding: '8px 16px', fontSize: '0.8rem' }}>
              <LogOut size={16} /> Logout
            </button>
          </div>
        ) : (
          <button onClick={handleConnect} className="btn-primary">
            Connect
          </button>
        )}
      </header>

      <main className="hero">
        <h1>Analyze with <span style={{ color: 'var(--primary-color)' }}>Precision.</span></h1>
        <p>
          The ultimate log analysis tool for the elite raiders of Dark Intentions. 
          Connect your Warcraft Logs account to get started with custom boss metrics.
        </p>

        {!isAuthorized ? (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button onClick={handleConnect} className="btn-wcl">
              <Sword size={20} />
              Connect to Warcraft Logs
              <ChevronRight size={18} />
            </button>
          </div>
        ) : (
          <div className="log-input-section">
            <h2 style={{ marginBottom: '24px', fontSize: '1.8rem' }}>Step 1: Select Encounter</h2>
            
            <div className="log-input-group">
              <Search size={20} color="var(--text-muted)" style={{ margin: 'auto 10px auto 20px' }} />
              <input 
                type="text" 
                className="log-input" 
                placeholder="Paste WCL Report URL (e.g. https://www.warcraftlogs.com/reports/...)"
                value={logUrl}
                onChange={(e) => setLogUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleFetchFights()}
              />
              <button 
                onClick={handleFetchFights} 
                className="btn-primary" 
                style={{ padding: '8px 24px', margin: '4px' }}
                disabled={isLoadingFights}
              >
                {isLoadingFights ? <Loader2 className="loading-spinner" style={{ margin: 0, width: '20px', height: '20px' }} /> : 'Load Fights'}
              </button>
            </div>

            {error && (
              <div style={{ marginTop: '16px', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '0.9rem' }}>
                <AlertTriangle size={16} /> {error}
              </div>
            )}

            {isLoadingFights && (
              <div className="loading-spinner"></div>
            )}

            {fights.length > 0 && !isLoadingFights && (
              <div className="fights-container">
                <div className="fights-grid">
                  {fights.map((fight: any) => (
                    <div 
                      key={fight.id} 
                      className={`glass-panel fight-card ${selectedFight?.id === fight.id ? 'selected' : ''}`}
                      onClick={() => setSelectedFight(fight)}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ textAlign: 'left' }}>
                          <h4>{fight.name}</h4>
                          <div className="fight-meta">
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Target size={14} /> {
                                fight.difficulty === 5 ? 'Mythic' : 
                                fight.difficulty === 4 ? 'Heroic' : 
                                fight.difficulty === 3 ? 'Normal' : 
                                fight.difficulty === 1 ? 'LFR' : 'Normal'
                              }
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '12px' }}>
                              <Clock size={14} /> {formatDuration(fight.startTime, fight.endTime)}
                            </span>
                          </div>
                        </div>
                        <span className={`status-badge ${fight.kill ? 'status-kill' : 'status-wipe'}`}>
                          {fight.kill ? 'Kill' : `Wipe (${(fight.bossPercentage).toFixed(1)}%)`}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                
                {selectedFight && (
                  <div style={{ marginTop: '40px', animation: 'fadeIn 0.4s ease-out' }}>
                    {selectedFight.name === "Imperator Averzian" ? (
                      <AverzianDashboard 
                        accessToken={accessToken!} 
                        reportId={reportId!} 
                        fightId={selectedFight.id} 
                        fightStartTime={selectedFight.startTime}
                      />
                    ) : (
                      <div className="glass-panel" style={{ padding: '40px', textAlign: 'center' }}>
                         <h3 style={{ marginBottom: '20px' }}>Analysis for {selectedFight.name}</h3>
                         <p>Custom metrics for this encounter are currently under development.</p>
                         <button className="btn-primary" style={{ margin: '20px auto' }}>
                           <Zap size={20} /> Request Analyzer
                         </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {!isAuthorized && (
          <div className="feature-grid">
            <div className="glass-panel feature-card">
              <div className="feature-icon">
                <BarChart3 size={24} />
              </div>
              <h3>Advanced Metrics</h3>
              <p>Deep dive into combat data with custom-built analyzers for every raid encounter.</p>
            </div>

            <div className="glass-panel feature-card">
              <div className="feature-icon">
                <Zap size={24} />
              </div>
              <h3>Real-time Updates</h3>
              <p>Fetch the latest logs directly from Warcraft Logs with a single click.</p>
            </div>

            <div className="glass-panel feature-card">
              <div className="feature-icon">
                <Shield size={24} />
              </div>
              <h3>Guild Performance</h3>
              <p>Compare performance within the guild and identify areas for group improvement.</p>
            </div>
          </div>
        )}
      </main>

      <footer style={{ marginTop: '100px', padding: '40px', textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
        &copy; 2026 Dark Intentions Guild. Powered by Warcraft Logs API.
      </footer>
    </div>
  );
}

export default App;
