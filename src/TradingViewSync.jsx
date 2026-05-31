import React, { useState, useEffect } from 'react';
import { Activity, RefreshCw, Link as LinkIcon, CheckCircle2, AlertTriangle, Play } from 'lucide-react';

const TVAlertCard = ({ alert }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [healthData, setHealthData] = useState(null);
  const [loadingHealth, setLoadingHealth] = useState(false);

  const handleMouseEnter = () => {
    setIsHovered(true);
    if (!healthData && !loadingHealth) {
      setLoadingHealth(true);
      fetch(`/api/search?ticker=${alert.ticker}`)
        .then(res => res.json())
        .then(data => {
          if (!data.error) setHealthData(data);
          setLoadingHealth(false);
        })
        .catch(() => setLoadingHealth(false));
    }
  };

  return (
    <div 
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setIsHovered(false)}
      style={{ 
        position: 'relative', 
        padding: '1.5rem', 
        background: isHovered ? 'rgba(59, 130, 246, 0.1)' : 'rgba(0,0,0,0.3)', 
        borderRadius: '8px', 
        borderLeft: `4px solid ${alert.priority === 'High' ? '#ef4444' : '#f59e0b'}`,
        cursor: 'pointer',
        transition: 'background 0.2s ease'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0, fontSize: '1.5rem', color: 'white' }}>{alert.ticker}</h3>
        <span style={{ padding: '0.2rem 0.5rem', background: alert.priority === 'High' ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)', color: alert.priority === 'High' ? '#ef4444' : '#f59e0b', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>
          {alert.type}
        </span>
      </div>
      <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: '0 0 1rem 0' }}>{alert.reason}</p>
      
      {isHovered && (
        <div style={{ position: 'absolute', top: 'calc(100% + 5px)', left: '0', width: '280px', background: 'rgba(15, 23, 42, 0.95)', border: '1px solid #3b82f6', borderRadius: '8px', padding: '1rem', zIndex: 9999, boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
          <h4 style={{ margin: '0 0 0.5rem 0', color: '#10b981' }}>Health Snapshot:</h4>
          {loadingHealth ? (
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#94a3b8' }}>Loading metrics...</p>
          ) : healthData ? (
            <div>
              <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.9rem', color: '#fff' }}>Stage: <strong style={{ color: healthData.technicals?.stage?.includes('2') ? '#10b981' : healthData.technicals?.stage?.includes('4') ? '#ef4444' : '#f59e0b' }}>{healthData.technicals?.stage}</strong></p>
              <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.9rem', color: '#fff' }}>Trend: <strong style={{ color: healthData.technicals?.momentum_color === 'bullish' ? '#10b981' : '#ef4444' }}>{healthData.technicals?.momentum_text}</strong></p>
              {healthData.score && <p style={{ margin: 0, fontSize: '0.9rem', color: '#fff' }}>Quant Score: <strong style={{ color: healthData.score >= 70 ? '#10b981' : healthData.score >= 40 ? '#f59e0b' : '#ef4444' }}>{healthData.score}/100</strong></p>}
              
              {healthData.trade_plan && (
                <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                  <h5 style={{ margin: '0 0 0.5rem 0', color: '#8b5cf6', fontSize: '0.85rem', textTransform: 'uppercase' }}>AI Trade Plan</h5>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8' }}>Entry: <strong style={{ color: '#fff' }}>${healthData.trade_plan.entry}</strong></p>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8' }}>Risk: <strong style={{ color: '#fff' }}>{healthData.trade_plan.risk_pct}%</strong></p>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8' }}>Stop: <strong style={{ color: '#ef4444' }}>${healthData.trade_plan.stop_loss}</strong></p>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8' }}>Target: <strong style={{ color: '#10b981' }}>${healthData.trade_plan.profit_target}</strong></p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#ef4444' }}>Data unavailable</p>
          )}
        </div>
      )}
    </div>
  );
};

const TradingViewSync = () => {
  const [url, setUrl] = useState('');
  const [savedUrl, setSavedUrl] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  
  useEffect(() => {
    // Fetch saved URL
    fetch('/api/tv_watchlist')
      .then(res => res.json())
      .then(data => {
        if (data.url) {
          setUrl(data.url);
          setSavedUrl(data.url);
        }
      })
      .catch(err => console.error("Error fetching TV URL", err));
      
    // Fetch latest results
    fetch('/tv_watchlist_results.json')
      .then(res => res.json())
      .then(data => setResults(data))
      .catch(err => console.log("No TV results found yet", err));
  }, []);
  
  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus('Saving and initiating sync...');
    
    try {
      const res = await fetch('/api/tv_watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      const data = await res.json();
      if (data.status === 'success') {
        setStatus('Sync initiated! Agent is actively scraping...');
        setSavedUrl(url);
        setTimeout(() => setStatus(''), 5000);
      } else {
        setStatus('Failed to save URL');
      }
    } catch (err) {
      setStatus('Network error');
    }
    setLoading(false);
  };
  
  const fetchResults = () => {
    fetch('/tv_watchlist_results.json?' + new Date().getTime())
      .then(res => res.json())
      .then(data => setResults(data))
      .catch(err => console.log(err));
  };
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div className="glass-card" style={{ padding: '2rem', borderLeft: '4px solid #3b82f6' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 1rem 0' }}>
          <LinkIcon color="#3b82f6" /> TradingView Watchlist Sync
        </h2>
        <p style={{ color: '#94a3b8', marginBottom: '2rem' }}>
          Paste your public TradingView Watchlist link here. Our autonomous Python agent will constantly scrape the URL every 5 minutes and feed your personal tickers into our institutional quant scanner.
        </p>
        
        <form onSubmit={handleSave} style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <input 
            type="text" 
            placeholder="Paste TradingView URL or comma-separated tickers (e.g., AAPL, NVDA, TSLA)"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            style={{ flex: 1, padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: 'white', fontSize: '1rem' }}
            required
          />
          <button type="submit" disabled={loading} style={{ padding: '1rem 2rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold' }}>
            {loading ? <RefreshCw className="spin" size={18} /> : <Play size={18} />}
            {loading ? 'Syncing...' : 'Start Agent'}
          </button>
        </form>
        {status && <div style={{ marginTop: '1rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><CheckCircle2 size={16} /> {status}</div>}
      </div>
      
      {(savedUrl || (results && results.alerts)) && (
        <div className="glass-card" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
            <h3 style={{ margin: 0 }}>Active Radar for: {savedUrl ? <a href={savedUrl} target="_blank" rel="noreferrer" style={{ color: '#60a5fa' }}>Your Watchlist</a> : <span style={{ color: '#60a5fa' }}>Local Watchlist File</span>}</h3>
            <button onClick={fetchResults} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'white', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <RefreshCw size={14} /> Refresh Results
            </button>
          </div>
          
          {results && results.alerts ? (
            results.alerts.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
                {results.alerts.map((alert, i) => (
                  <TVAlertCard key={i} alert={alert} />
                ))}
              </div>
            ) : (
              <div style={{ padding: '3rem', textAlign: 'center', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                <Activity size={48} color="#10b981" style={{ marginBottom: '1rem', opacity: 0.5 }} />
                <h3 style={{ margin: 0, color: '#94a3b8' }}>All Clear</h3>
                <p style={{ color: '#64748b' }}>No institutional setups found on your watchlist tickers right now.</p>
              </div>
            )
          ) : (
            <div style={{ padding: '3rem', textAlign: 'center', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
              <AlertTriangle size={48} color="#f59e0b" style={{ marginBottom: '1rem', opacity: 0.5 }} />
              <h3 style={{ margin: 0, color: '#94a3b8' }}>Awaiting Sync</h3>
              <p style={{ color: '#64748b' }}>The agent is either currently scraping your URL or has not run yet.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TradingViewSync;
