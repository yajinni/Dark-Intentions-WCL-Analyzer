import { useEffect, useState } from 'react';
import { Shield, BarChart3, Zap, Sword, LogOut, ChevronRight } from 'lucide-react';
import { buildSdk } from '@rpglogs/api-sdk/dist/tsc/main';

function App() {
  const [accessToken, setAccessToken] = useState<string | null>(localStorage.getItem('wcl_token'));
  const [isAuthorized, setIsAuthorized] = useState<boolean>(false);

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
          <div className="glass-panel" style={{ padding: '40px', marginTop: '40px' }}>
            <h2 style={{ marginBottom: '20px', color: '#fff' }}>Dashboard Ready</h2>
            <p style={{ marginBottom: '0' }}>
              You are now authorized. Future boss-specific metrics will appear here.
            </p>
          </div>
        )}

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
      </main>

      <footer style={{ marginTop: '100px', padding: '40px', textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
        &copy; 2026 Dark Intentions Guild. Powered by Warcraft Logs API.
      </footer>
    </div>
  );
}

export default App;
