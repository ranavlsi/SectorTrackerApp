import React, { useState, useEffect } from 'react';

const LiveAgentsDashboard = ({ initialTicker = 'AAPL' }) => {
  const [ticker, setTicker] = useState(initialTicker);
  const [searchInput, setSearchInput] = useState(initialTicker);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!ticker) return;
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/agents?ticker=${ticker}`);
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err.message || 'Failed to fetch data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [ticker]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchInput.trim()) {
      setTicker(searchInput.trim().toUpperCase());
    }
  };

  return (
    <div className="agents-dashboard-container">
      <style>{`
        .agents-dashboard-container {
          padding: 2rem;
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
          color: #e2e8f0;
          min-height: 100vh;
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
          box-sizing: border-box;
        }
        .agents-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
          flex-wrap: wrap;
          gap: 1rem;
        }
        .agents-title {
          font-size: 2.25rem;
          font-weight: 800;
          margin: 0;
          background: linear-gradient(to right, #60a5fa, #c084fc);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .agents-search {
          display: flex;
          gap: 0.75rem;
        }
        .agents-input {
          padding: 0.75rem 1.5rem;
          border-radius: 9999px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.05);
          color: #fff;
          outline: none;
          backdrop-filter: blur(10px);
          width: 280px;
          font-size: 1rem;
          transition: border-color 0.3s, box-shadow 0.3s;
        }
        .agents-input:focus {
          border-color: #60a5fa;
          box-shadow: 0 0 0 2px rgba(96, 165, 250, 0.2);
        }
        .agents-btn {
          padding: 0.75rem 1.75rem;
          border-radius: 9999px;
          border: none;
          background: linear-gradient(to right, #3b82f6, #8b5cf6);
          color: #fff;
          font-weight: 600;
          font-size: 1rem;
          cursor: pointer;
          transition: transform 0.2s, opacity 0.2s;
          box-shadow: 0 4px 14px 0 rgba(0,0,0,0.2);
        }
        .agents-btn:hover {
          transform: translateY(-2px);
          opacity: 0.9;
        }
        .agents-glass-panel {
          background: rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 24px;
          padding: 1.75rem;
          box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.2);
        }
        .agents-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
          gap: 2rem;
          margin-bottom: 2rem;
        }
        .agents-synthesis {
          background: linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(139, 92, 246, 0.15));
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 24px;
          padding: 2rem;
          margin-bottom: 2rem;
          box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.2);
        }
        .agents-synthesis p {
          font-size: 1.25rem;
          line-height: 1.8;
          color: #f1f5f9;
          margin: 0;
        }
        .agents-section-title {
          font-size: 1.35rem;
          font-weight: 600;
          margin-bottom: 1.25rem;
          color: #e2e8f0;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .agents-list {
          list-style: none;
          padding: 0;
          margin: 0;
          max-height: 350px;
          overflow-y: auto;
          padding-right: 0.5rem;
        }
        /* Custom Scrollbar for inner lists */
        .agents-list::-webkit-scrollbar {
          width: 6px;
        }
        .agents-list::-webkit-scrollbar-track {
          background: rgba(255,255,255,0.02);
          border-radius: 10px;
        }
        .agents-list::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.1);
          border-radius: 10px;
        }
        .agents-list::-webkit-scrollbar-thumb:hover {
          background: rgba(255,255,255,0.2);
        }
        .agents-list-item {
          padding: 1rem;
          border-bottom: 1px solid rgba(255,255,255,0.05);
          transition: background 0.2s;
          border-radius: 12px;
        }
        .agents-list-item:hover {
          background: rgba(255,255,255,0.02);
        }
        .agents-badge {
          display: inline-block;
          padding: 0.25rem 0.75rem;
          border-radius: 9999px;
          font-size: 0.85rem;
          font-weight: 600;
          background: rgba(255,255,255,0.1);
          color: #e2e8f0;
          margin-top: 0.5rem;
        }
        .agents-badge-bullish {
          background: rgba(34, 197, 94, 0.2);
          color: #4ade80;
        }
        .agents-badge-bearish {
          background: rgba(239, 68, 68, 0.2);
          color: #f87171;
        }
        .agents-table-wrapper {
          overflow-x: auto;
        }
        .agents-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
        }
        .agents-table th {
          padding: 1.25rem 1rem;
          border-bottom: 2px solid rgba(255,255,255,0.1);
          color: #94a3b8;
          font-weight: 600;
          white-space: nowrap;
        }
        .agents-table td {
          padding: 1rem;
          border-bottom: 1px solid rgba(255,255,255,0.05);
          color: #f1f5f9;
        }
        .agents-table tr {
          transition: background 0.2s;
        }
        .agents-table tr:hover {
          background: rgba(255,255,255,0.02);
        }
        
        @media (min-width: 1024px) {
          .agents-grid-col-span-2 {
            grid-column: auto / span 2;
          }
        }
      `}</style>

      <header className="agents-header">
        <h1 className="agents-title">Live Agents Dashboard: {ticker}</h1>
        <form onSubmit={handleSearch} className="agents-search">
          <input 
            type="text" 
            value={searchInput} 
            onChange={(e) => setSearchInput(e.target.value)} 
            placeholder="Enter Ticker (e.g. NVDA)" 
            className="agents-input"
          />
          <button type="submit" className="agents-btn">Search</button>
        </form>
      </header>

      {loading && <div style={{ textAlign: 'center', padding: '3rem', fontSize: '1.2rem', color: '#94a3b8' }}>Analyzing market data...</div>}
      {error && <div style={{ color: '#ef4444', textAlign: 'center', padding: '2rem', background: 'rgba(239,68,68,0.1)', borderRadius: '12px' }}>Error: {error}</div>}

      {!loading && !error && data && (
        <>
          {data.synthesis && (
            <div className="agents-synthesis">
              <h2 className="agents-section-title" style={{ color: '#fff', fontSize: '1.6rem' }}>
                🧠 Synthesis Agent
              </h2>
              <p>{data.synthesis}</p>

              {data.surge_metrics && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '3rem', marginTop: '1.5rem', background: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', flexWrap: 'wrap' }}>
                  
                  <div style={{ flex: '1 1 250px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ fontWeight: 'bold', color: '#94a3b8', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Social Surge Level</span>
                      <span style={{ fontWeight: 'bold', color: data.surge_metrics.surge_level > 50 ? '#4ade80' : '#f87171' }}>{data.surge_metrics.surge_level}%</span>
                    </div>
                    <div style={{ width: '100%', background: 'rgba(255,255,255,0.1)', height: '8px', borderRadius: '999px', overflow: 'hidden' }}>
                      <div style={{ width: `${data.surge_metrics.surge_level}%`, background: `linear-gradient(90deg, #3b82f6, ${data.surge_metrics.surge_level > 50 ? '#10b981' : '#f59e0b'})`, height: '100%', transition: 'width 1s ease-in-out' }}></div>
                    </div>
                  </div>

                  <div style={{ flex: '1 1 250px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ fontWeight: 'bold', color: '#94a3b8', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Bull / Bear Ratio</span>
                      <span style={{ fontWeight: 'bold', color: data.surge_metrics.bullish_percent >= 50 ? '#4ade80' : '#f87171' }}>{data.surge_metrics.bullish_percent}% Bullish</span>
                    </div>
                    <div style={{ width: '100%', background: 'rgba(239, 68, 68, 0.8)', height: '8px', borderRadius: '999px', overflow: 'hidden', display: 'flex' }}>
                      <div style={{ width: `${data.surge_metrics.bullish_percent}%`, background: '#22c55e', height: '100%', transition: 'width 1s ease-in-out' }}></div>
                    </div>
                  </div>

                </div>
              )}
            </div>
          )}

          <div className="agents-grid">
            {/* Social Chatter Agent */}
            <div className="agents-glass-panel">
              <h2 className="agents-section-title">💬 Social Chatter Agent</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div>
                  <h3 style={{ color: '#94a3b8', fontSize: '1.05rem', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Reddit (r/wallstreetbets)</h3>
                  {data.reddit && data.reddit.length > 0 ? (
                    <ul className="agents-list">
                      {data.reddit.map((item, i) => (
                        <li key={i} className="agents-list-item">
                          <p style={{ margin: '0 0 0.25rem 0', fontWeight: '500' }}>{item}</p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p style={{ color: '#64748b' }}>No Reddit data available.</p>
                  )}
                </div>
                <div>
                  <h3 style={{ color: '#94a3b8', fontSize: '1.05rem', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>StockTwits</h3>
                  {data.stocktwits && data.stocktwits.length > 0 ? (
                    <ul className="agents-list">
                      {data.stocktwits.map((item, i) => {
                        const text = item;
                        const isBullish = text.toLowerCase().includes('bullish') || text.toLowerCase().includes('buy');
                        const isBearish = text.toLowerCase().includes('bearish') || text.toLowerCase().includes('short') || text.toLowerCase().includes('sell');
                        const sentimentClass = isBullish ? 'agents-badge-bullish' : (isBearish ? 'agents-badge-bearish' : '');
                        return (
                          <li key={i} className="agents-list-item">
                            <p style={{ margin: '0 0 0.25rem 0', fontWeight: '500' }}>{text}</p>
                            {(isBullish || isBearish) && (
                              <span className={`agents-badge ${sentimentClass}`}>
                                {isBullish ? 'BULLISH' : 'BEARISH'}
                              </span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p style={{ color: '#64748b' }}>No Stocktwits data available.</p>
                  )}
                </div>
                <div>
                  <h3 style={{ color: '#94a3b8', fontSize: '1.05rem', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>X.com (News Proxy)</h3>
                  {data.x_updates && data.x_updates.length > 0 ? (
                    <ul className="agents-list">
                      {data.x_updates.map((item, i) => (
                        <li key={i} className="agents-list-item" style={{ borderLeft: '3px solid #1da1f2' }}>
                          <p style={{ margin: '0 0 0.25rem 0', fontWeight: '500', color: '#1da1f2' }}>@MarketUpdate</p>
                          <p style={{ margin: '0' }}>{item}</p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p style={{ color: '#64748b' }}>No X.com data available.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Options Whale Agent */}
            <div className="agents-glass-panel agents-grid-col-span-2">
              <h2 className="agents-section-title">🐋 Options Whale Agent</h2>
              {data.unusual_options && data.unusual_options.length > 0 ? (
                <div className="agents-table-wrapper">
                  <table className="agents-table">
                    <thead>
                      <tr>
                        <th>Type</th>
                        <th>Strike</th>
                        <th>Expiration</th>
                        <th>Volume</th>
                        <th>Open Interest</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.unusual_options.map((opt, i) => {
                        return (
                          <tr key={i}>
                            <td>
                              <span className="agents-badge agents-badge-bullish">
                                ALERT
                              </span>
                            </td>
                            <td style={{ fontWeight: '500' }}>${opt.strike}</td>
                            <td>Near Term</td>
                            <td>{opt.vol?.toLocaleString()}</td>
                            <td style={{ color: '#94a3b8' }}>{opt.oi?.toLocaleString()} (Ratio: {opt.ratio}x)</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p style={{ color: '#64748b' }}>No unusual options activity detected.</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default LiveAgentsDashboard;
