import React, { useState, useEffect } from 'react'
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea, Legend, Cell, ComposedChart, Line, Bar, Area } from 'recharts'
import { TrendingUp, AlertCircle, RefreshCw, ChevronDown, ChevronUp, FileText, Activity, Filter, X, BarChart2, ActivitySquare, Compass, Search, Loader, Crosshair, Radio, HeartPulse } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

const COLORS = [
  "#4facfe", "#00f2fe", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#ec4899",
  "#14b8a6", "#f97316", "#06b6d4", "#84cc16", "#a855f7", "#eab308", "#f43f5e",
  "#0ea5e9", "#22c55e", "#d946ef", "#64748b", "#f87171", "#fbbf24", "#34d399"
];

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '10px' }}>
        <p style={{ color: '#fff', margin: '0 0 5px 0', fontWeight: 'bold' }}>{data.date || 'Current'}</p>
        <p style={{ color: '#4facfe', margin: 0 }}>RS-Ratio (Trend): {data.x}</p>
        <p style={{ color: '#f59e0b', margin: 0 }}>RS-Momentum: {data.y}</p>
        <p style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: '5px' }}>(Click to view top stocks)</p>
      </div>
    );
  }
  return null;
};

const ScreenerCategories = {
  relative_strength: { title: "Highest Relative Strength", icon: <TrendingUp color="#10b981" /> },
  early_stage_2: { title: "Early Stage 2 Breakouts", icon: <Activity color="#4facfe" /> },
  darvas_breakout: { title: "Darvas Box Breakouts", icon: <Compass color="#a855f7" /> },
  breakout_retest: { title: "Breakout Pivot Retest", icon: <ActivitySquare color="#fbbf24" /> },
  base_pullback_ma: { title: "Squat Base & SMA Support", icon: <Filter color="#14b8a6" /> },
  fresh_52w_high: { title: "Fresh 52-Week Highs", icon: <TrendingUp color="#f59e0b" /> },
  all_time_high: { title: "All-Time Highs", icon: <BarChart2 color="#eab308" /> },
  hve_volume: { title: "Volume Climax (HVE)", icon: <AlertCircle color="#3b82f6" /> },
  hve_consolidation: { title: "Consolidation post-HVE", icon: <Filter color="#14b8a6" /> },
  post_earning_reaction: { title: "Power Earnings Gap Up", icon: <TrendingUp color="#a855f7" /> },
  post_earning_consolidation: { title: "Earnings Gap Consolidation", icon: <ActivitySquare color="#8b5cf6" /> },
  weekly_cup_handle: { title: "Weekly Cup & Handle", icon: <Compass color="#4facfe" /> },
  monthly_cup_handle: { title: "Monthly Cup & Handle", icon: <Compass color="#a855f7" /> },
  ipo_avwap: { title: "IPO AVWAP Bounce", icon: <Crosshair color="#ec4899" /> },
  bullish_candlestick: { title: "Bullish Candlestick", icon: <TrendingUp color="#22c55e" /> },
  bearish_candlestick: { title: "Bearish Candlestick", icon: <TrendingUp color="#ef4444" style={{ transform: 'rotate(180deg)' }} /> },
  reversal: { title: "Oversold Reversal", icon: <RefreshCw color="#ef4444" /> }
}

const ScreenerPill = ({ item, onClick }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [healthData, setHealthData] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleMouseEnter = () => {
    setIsHovered(true);
    if (!healthData && !loading) {
      setLoading(true);
      fetch(`/api/search?ticker=${item.ticker}`)
        .then(res => res.json())
        .then(data => {
          if (!data.error) setHealthData(data);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  };

  return (
    <div 
      className="stock-pill" 
      style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', padding: '0.75rem 1rem', cursor: 'pointer', background: isHovered ? 'rgba(79, 172, 254, 0.1)' : 'rgba(255,255,255,0.05)' }}
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setIsHovered(false)}
    >
      <strong>{item.ticker}</strong>
      <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>{item.metric}</span>
      
      {isHovered && (
        <div style={{ position: 'absolute', top: '-10px', left: '105%', width: '250px', background: 'rgba(15, 23, 42, 0.95)', border: '1px solid #4facfe', borderRadius: '8px', padding: '1rem', zIndex: 100, boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
          <h4 style={{ margin: '0 0 0.5rem 0', color: '#4facfe' }}>Why Picked:</h4>
          <p style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: '#fff' }}>{item.metric}</p>
          
          <h4 style={{ margin: '0 0 0.5rem 0', color: '#10b981' }}>Health:</h4>
          {loading ? (
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '5px' }}><Loader size={12} className="spin"/> Loading...</p>
          ) : healthData ? (
            <div>
              <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.9rem', color: '#fff' }}>Stage: <strong style={{ color: healthData.technicals.stage.includes('2') ? '#10b981' : healthData.technicals.stage.includes('4') ? '#ef4444' : '#f59e0b' }}>{healthData.technicals.stage}</strong></p>
              <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.9rem', color: '#fff' }}>Mom: <strong style={{ color: healthData.technicals.momentum_color === 'bullish' ? '#10b981' : '#ef4444' }}>{healthData.technicals.momentum_text}</strong></p>
              {healthData.score && <p style={{ margin: 0, fontSize: '0.9rem', color: '#fff' }}>Master Score: <strong style={{ color: healthData.score >= 70 ? '#10b981' : healthData.score >= 40 ? '#f59e0b' : '#ef4444' }}>{healthData.score}/100</strong></p>}
              
              {healthData.trade_plan && (
                <>
                  <h4 style={{ margin: '1rem 0 0.5rem 0', color: '#f59e0b', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.5rem' }}>Trade Plan (ATR)</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.25rem' }}>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8' }}>Entry: <strong style={{ color: '#fff' }}>${healthData.trade_plan.entry}</strong></p>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8' }}>Risk: <strong style={{ color: '#fff' }}>{healthData.trade_plan.risk_pct}%</strong></p>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8' }}>Stop: <strong style={{ color: '#ef4444' }}>${healthData.trade_plan.stop_loss}</strong></p>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8' }}>Target: <strong style={{ color: '#10b981' }}>${healthData.trade_plan.profit_target}</strong></p>
                  </div>
                </>
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

function App() {
  const [data, setData] = useState(null)
  const [screenerData, setScreenerData] = useState(null)
  const [activeTab, setActiveTab] = useState('dashboard')
  const [timeframe, setTimeframe] = useState('daily')
  const [hiddenLines, setHiddenLines] = useState({})
  
  // UX State
  const [hoveredSector, setHoveredSector] = useState(null)
  const [isTop5Isolated, setIsTop5Isolated] = useState(false)
  const [modalData, setModalData] = useState(null)
  const [collapsedCategories, setCollapsedCategories] = useState({})
  
  // Full-Stack Search State
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState(null)
  const [expertTickerData, setExpertTickerData] = useState(null)
  
  // Intraday State
  const [showIntraday, setShowIntraday] = useState(false)
  const [intradayData, setIntradayData] = useState(null)
  const [intradayLoading, setIntradayLoading] = useState(false)
  
  // Market Health State
  const [marketHealth, setMarketHealth] = useState(null)
  
  // Squeeze State
  const [squeezeData, setSqueezeData] = useState(null)
  
  // Advanced Analytics State
  const [correlationData, setCorrelationData] = useState(null)
  const [gexData, setGexData] = useState(null)
  
  // Playbook State
  const [playbookContent, setPlaybookContent] = useState('')

  useEffect(() => {
    fetch('/sector_flow.json')
      .then(res => res.json())
      .then(json => setData(json))
      .catch(err => console.error("Error fetching data:", err))
      
    fetch('/screener_results.json')
      .then(res => res.json())
      .then(data => setScreenerData(data))
      .catch(err => console.error("Error loading screener data:", err))
      
    fetch('/market_health.json')
      .then(res => res.json())
      .then(data => setMarketHealth(data))
      .catch(err => console.error("Error loading market health data:", err))
      
    fetch('/squeeze_results.json')
      .then(res => res.json())
      .then(data => setSqueezeData(data))
      .catch(err => console.error("Error loading squeeze data:", err))
      
    fetch('/correlation_results.json')
      .then(res => res.json())
      .then(data => setCorrelationData(data))
      .catch(err => console.error("Error loading correlation data:", err))
      
    fetch('/gex_results.json')
      .then(res => res.json())
      .then(data => setGexData(data))
      .catch(err => console.error("Error loading gex data:", err))
      
    fetch('/ai_playbook.md')
      .then(res => res.text())
      .then(text => setPlaybookContent(text))
      .catch(err => console.error("Error loading playbook:", err))
  }, [])

  if (!data || !data.rrg) {
    return <div className="loading"><RefreshCw size={48} /><h2>Loading Sector Tracker Engine...</h2></div>
  }

  const rrgData = data.rrg[timeframe] || [];
  const marketMeter = data.market_meter;
  const tableData = [...rrgData].sort((a, b) => b.trail[b.trail.length - 1].x - a.trail[a.trail.length - 1].x)

  const toggleLine = (name) => {
    if (isTop5Isolated) setIsTop5Isolated(false)
    setHiddenLines(prev => ({ ...prev, [name]: !prev[name] }))
  }

  const isolateTop5 = () => {
    if (isTop5Isolated) {
      setIsTop5Isolated(false)
      setHiddenLines({})
    } else {
      const top5Sectors = tableData.slice(0, 5).map(item => item.name)
      const newHidden = {}
      rrgData.forEach(sec => newHidden[sec.name] = !top5Sectors.includes(sec.name))
      setHiddenLines(newHidden)
      setIsTop5Isolated(true)
    }
  }
  
  const fetchTickerData = async (ticker) => {
    setIsSearching(true);
    setSearchError(null);
    setExpertTickerData(null);
    setModalData(null);
    
    try {
      const res = await fetch(`/api/search?ticker=${ticker}`);
      const json = await res.json();
      if (!res.ok) {
        setSearchError(json.error || "Failed to fetch data.");
      } else {
        setExpertTickerData(json);
      }
    } catch (err) {
      setSearchError("Backend server is not running. Start server.py");
    } finally {
      setIsSearching(false);
    }
  }

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    fetchTickerData(searchQuery.trim().toUpperCase());
  }
  
  const fetchIntradayAlerts = async () => {
    setShowIntraday(true);
    setIntradayLoading(true);
    try {
      const res = await fetch(`/intraday_results.json`);
      const json = await res.json();
      setIntradayData(json.results || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIntradayLoading(false);
    }
  }

  const openLocalTicker = (stock) => {
    setExpertTickerData({
      ticker: stock.ticker,
      name: "Component Stock",
      score: null,
      technicals: {
        perf: stock.perf,
        stage: stock.stage,
        momentum_text: stock.momentum_text,
        momentum_color: stock.momentum_color,
        rs_spy_1mo: stock.rs_spy_1mo
      },
      fundamentals: null
    });
  }

  const renderCustomLegend = (props) => {
    const { payload } = props;
    const unique = [];
    payload.forEach(p => { if (!unique.find(x => x.value === p.value)) unique.push(p); });
    
    return (
      <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '15px', marginTop: '20px' }}>
        {unique.map((entry, index) => (
          <li
            key={`item-${index}`}
            onClick={() => toggleLine(entry.value)}
            onMouseEnter={() => setHoveredSector(entry.value)}
            onMouseLeave={() => setHoveredSector(null)}
            style={{
              cursor: 'pointer',
              color: hiddenLines[entry.value] ? '#475569' : entry.color,
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              transition: 'all 0.2s ease',
              opacity: hoveredSector ? (hoveredSector === entry.value ? 1 : 0.3) : 1,
              transform: hoveredSector === entry.value ? 'scale(1.1)' : 'scale(1)'
            }}
          >
            <span style={{ 
              width: 12, height: 12, borderRadius: '50%', 
              backgroundColor: hiddenLines[entry.value] ? 'transparent' : entry.color,
              border: `2px solid ${entry.color}`
            }}></span>
            {entry.value}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1>Sector Tracker Super App</h1>
          <p className="subtitle">Universal Search, Expert Screeners & Multi-Horizon Momentum</p>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1, maxWidth: '400px', alignItems: 'flex-end' }}>
          <form onSubmit={handleSearch} style={{ width: '100%', position: 'relative' }}>
            <input 
              type="text" placeholder="Search any US Ticker (e.g., AAPL)..."
              value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
            <button type="submit" className="search-btn" disabled={isSearching}>
              {isSearching ? <Loader size={18} className="spin" /> : <Search size={18} />}
            </button>
            {searchError && <div style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '5px', position: 'absolute' }}>{searchError}</div>}
          </form>

          {marketMeter && (
            <div className="glass-card" style={{ padding: '0.75rem 1rem', borderLeft: `5px solid ${marketMeter.color}`, display: 'flex', alignItems: 'center', gap: '1rem', width: '100%' }}>
              <Compass size={24} color={marketMeter.color} />
              <div>
                <h3 style={{ margin: 0, color: marketMeter.color, fontSize: '1.1rem' }}>
                  Market Trend: {marketMeter.status}
                </h3>
              </div>
            </div>
          )}
        </div>
      </div>
      
      <div className="main-tabs" style={{ marginTop: '2rem' }}>
        <button className={activeTab === 'dashboard' ? 'tab-active' : ''} onClick={() => setActiveTab('dashboard')}><Activity size={18} /> RRG Dashboard</button>
        <button className={activeTab === 'screeners' ? 'tab-active' : ''} onClick={() => setActiveTab('screeners')}><Crosshair size={18} /> Expert Screeners</button>
        <button className={activeTab === 'health' ? 'tab-active' : ''} onClick={() => setActiveTab('health')}><HeartPulse size={18} /> Market Health</button>
        <button className={activeTab === 'squeeze' ? 'tab-active' : ''} onClick={() => setActiveTab('squeeze')}><AlertCircle size={18} /> Squeeze Radar</button>
        <button className={activeTab === 'advanced' ? 'tab-active' : ''} onClick={() => setActiveTab('advanced')}><BarChart2 size={18} /> Advanced Analytics</button>
        <button className={activeTab === 'analysis' ? 'tab-active' : ''} onClick={() => setActiveTab('analysis')}><FileText size={18} /> AI Playbook</button>
      </div>

      {activeTab === 'advanced' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>
          <h2 style={{ marginBottom: '1rem' }}>🔬 Advanced Analytics (Macro & Options GEX)</h2>
          
          <div className="glass-card" style={{ padding: '2rem' }}>
            <h3 style={{ marginTop: 0, color: '#4facfe' }}>Cross-Asset Correlation Matrix (90-Day)</h3>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '1.5rem' }}>Track how your portfolio rotates alongside macroeconomic drivers (Yields, Oil, Crypto, DXY).</p>
            {correlationData ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '0.75rem', borderBottom: '1px solid #334155' }}>Ticker</th>
                      {correlationData.macro_drivers.map(driver => (
                        <th key={driver} style={{ textAlign: 'center', padding: '0.75rem', borderBottom: '1px solid #334155' }}>{driver}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {correlationData.stocks.map(stock => (
                      <tr key={stock.ticker}>
                        <td style={{ padding: '0.75rem', borderBottom: '1px solid #1e293b', fontWeight: 'bold' }}>{stock.ticker}</td>
                        {correlationData.macro_drivers.map(driver => {
                          const val = stock.correlations[driver];
                          let bgColor = 'transparent';
                          if (val > 0.5) bgColor = 'rgba(16, 185, 129, 0.2)';
                          else if (val > 0.2) bgColor = 'rgba(16, 185, 129, 0.05)';
                          else if (val < -0.5) bgColor = 'rgba(239, 68, 68, 0.2)';
                          else if (val < -0.2) bgColor = 'rgba(239, 68, 68, 0.05)';
                          return (
                            <td key={driver} style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '1px solid #1e293b', backgroundColor: bgColor }}>
                              {val ? val.toFixed(2) : '-'}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p>Loading Matrix...</p>}
          </div>

          <div className="glass-card" style={{ padding: '2rem' }}>
            <h3 style={{ marginTop: 0, color: '#fbc2eb' }}>Options Gamma Exposure (GEX) Profiler</h3>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '1.5rem' }}>Visualizing absolute dealer hedging magnets based on live options chains.</p>
            {gexData ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
                {Object.keys(gexData).map(ticker => (
                  <div key={ticker} style={{ background: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: '12px' }}>
                    <h4 style={{ marginTop: 0, borderBottom: '1px solid #334155', paddingBottom: '0.5rem' }}>{ticker} <span style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 'normal' }}>Spot: ${gexData[ticker].spot_price.toFixed(2)}</span></h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginTop: '1rem', maxHeight: '300px', overflowY: 'auto' }}>
                      {gexData[ticker].gex_profile.map((p, i) => {
                        const magnitude = Math.min(Math.abs(p.net_gex) / 10000000, 100); // Scale logic for simple visual
                        const isPositive = p.net_gex > 0;
                        return (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', fontSize: '0.8rem' }}>
                            <span style={{ width: '60px', textAlign: 'right', paddingRight: '10px' }}>${p.strike.toFixed(1)}</span>
                            <div style={{ flex: 1, height: '8px', background: '#1e293b', borderRadius: '4px', display: 'flex' }}>
                               <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
                                  {!isPositive && <div style={{ width: `${magnitude}%`, background: '#ef4444', borderRadius: '4px 0 0 4px' }}></div>}
                               </div>
                               <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-start' }}>
                                  {isPositive && <div style={{ width: `${magnitude}%`, background: '#10b981', borderRadius: '0 4px 4px 0' }}></div>}
                               </div>
                            </div>
                            <span style={{ width: '60px', textAlign: 'left', paddingLeft: '10px', color: isPositive ? '#10b981' : '#ef4444' }}>
                              {p.net_gex !== 0 ? (p.net_gex / 1000000).toFixed(1) + 'M' : '0'}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : <p>Loading Gamma Exposure...</p>}
          </div>

        </div>
      )}

      {activeTab === 'analysis' && (
        <div className="glass-card analysis-container" style={{ padding: '2rem' }}>
          <ReactMarkdown>{playbookContent}</ReactMarkdown>
        </div>
      )}

      {activeTab === 'squeeze' && squeezeData && (
        <div>
          <h2 style={{ marginBottom: '2rem' }}>🔥 Short Squeeze Radar</h2>
          
          {squeezeData.squeeze_started && squeezeData.squeeze_started.length > 0 && (
            <div className="glass-card flash-alert" style={{ padding: '2rem', marginBottom: '2rem', border: '2px solid #ef4444' }}>
              <h2 style={{ color: '#ef4444', marginTop: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertCircle /> SQUEEZE TRIGGERED!
              </h2>
              <p style={{ color: '#f87171' }}>These highly shorted stocks are experiencing massive price spikes and aggressive Call buying right now.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
                {squeezeData.squeeze_started.map(item => (
                  <ScreenerPill key={item.ticker} item={item} onClick={() => fetchTickerData(item.ticker)} />
                ))}
              </div>
            </div>
          )}
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', alignItems: 'start' }}>
            <div className="glass-card" style={{ padding: '1.5rem', borderLeft: '3px solid #f59e0b' }}>
              <h3 style={{ marginTop: 0, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ActivitySquare /> Gamma Squeeze Setup
              </h3>
              <p style={{ fontSize: '0.9rem', color: '#94a3b8' }}>High short interest + Unusual Options Call Volume</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
                {squeezeData.gamma_squeeze_setup && squeezeData.gamma_squeeze_setup.length > 0 ? (
                  squeezeData.gamma_squeeze_setup.map(item => (
                    <ScreenerPill key={item.ticker} item={item} onClick={() => fetchTickerData(item.ticker)} />
                  ))
                ) : <span style={{ color: '#64748b' }}>None currently detected.</span>}
              </div>
            </div>
            
            <div className="glass-card" style={{ padding: '1.5rem', borderLeft: '3px solid #4facfe' }}>
              <h3 style={{ marginTop: 0, color: '#4facfe', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <TrendingUp /> Heavily Shorted Watchlist
              </h3>
              <p style={{ fontSize: '0.9rem', color: '#94a3b8' }}>Top stocks with &gt; 5% Float Short or &gt; 3 Days to Cover</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
                {squeezeData.high_short_interest && squeezeData.high_short_interest.length > 0 ? (
                  squeezeData.high_short_interest.map(item => (
                    <ScreenerPill key={item.ticker} item={item} onClick={() => fetchTickerData(item.ticker)} />
                  ))
                ) : <span style={{ color: '#64748b' }}>None currently detected.</span>}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'screeners' && screenerData && (
        <div>
          <h2 style={{ marginBottom: '2rem' }}>Algorithmic Technical Setups</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', alignItems: 'start' }}>
            {Object.entries(ScreenerCategories).map(([key, config]) => (
              <div key={key} className="glass-card" style={{ padding: '1.5rem' }}>
                <h3 
                  style={{ marginTop: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#fff', cursor: 'pointer' }}
                  onClick={() => setCollapsedCategories(prev => ({ ...prev, [key]: !prev[key] }))}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>{config.icon} {config.title}</span>
                  {collapsedCategories[key] ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
                </h3>
                
                {!collapsedCategories[key] && (
                  screenerData[key] && screenerData[key].length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
                      {screenerData[key].map(item => (
                        <ScreenerPill key={item.ticker} item={item} onClick={() => fetchTickerData(item.ticker)} />
                      ))}
                    </div>
                  ) : (
                    <p style={{ color: '#64748b', fontStyle: 'italic', marginTop: '1rem' }}>No setups found today.</p>
                  )
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Market Health Dashboard Tab */}
      {activeTab === 'health' && marketHealth && (
        <div style={{ marginTop: '2rem' }}>
          {/* Master Health Card */}
          <div className="glass-card" style={{ padding: '2rem', marginBottom: '2rem', textAlign: 'center', borderTop: `5px solid ${marketHealth.current_health.score.includes('Bullish') || marketHealth.current_health.score.includes('Buy') ? '#10b981' : marketHealth.current_health.score.includes('Bearish') ? '#ef4444' : '#f59e0b'}` }}>
            <h2 style={{ fontSize: '2.5rem', margin: '0 0 1rem 0' }}>{marketHealth.current_health.score}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginTop: '2rem' }}>
              <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1.5rem', borderRadius: '12px' }}>
                <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>McClellan Oscillator</span>
                <h3 style={{ margin: '0.5rem 0 0 0', color: marketHealth.current_health.mco_value > 0 ? '#10b981' : '#ef4444' }}>{marketHealth.current_health.mco_value} ({marketHealth.current_health.mco_status})</h3>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1.5rem', borderRadius: '12px' }}>
                <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Breadth (% &gt; 50 SMA)</span>
                <h3 style={{ margin: '0.5rem 0 0 0', color: marketHealth.current_health.pct_above_50_value > 50 ? '#10b981' : '#ef4444' }}>{marketHealth.current_health.pct_above_50_value}% ({marketHealth.current_health.breadth_status})</h3>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1.5rem', borderRadius: '12px' }}>
                <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>A/D Momentum</span>
                <h3 style={{ margin: '0.5rem 0 0 0', color: marketHealth.current_health.ad_momentum.includes('Bullish') ? '#10b981' : '#ef4444' }}>{marketHealth.current_health.ad_momentum}</h3>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1.5rem', borderRadius: '12px' }}>
                <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Price/Breadth Divergence</span>
                <h3 style={{ margin: '0.5rem 0 0 0', color: marketHealth.current_health.divergence.includes('Bullish') ? '#10b981' : marketHealth.current_health.divergence.includes('Bearish') ? '#ef4444' : '#fff' }}>{marketHealth.current_health.divergence}</h3>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>
            {/* Chart 1: SPY vs A/D Line */}
            <div className="glass-card" style={{ padding: '2rem' }}>
              <h3 style={{ marginTop: 0, marginBottom: '1.5rem' }}>SPY Price vs Advance/Decline Line</h3>
              <div style={{ height: '400px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={marketHealth.historical_data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis dataKey="date" stroke="#94a3b8" tick={{fill: '#94a3b8'}} tickFormatter={(str) => str.substring(5)} />
                    <YAxis yAxisId="left" stroke="#94a3b8" tick={{fill: '#94a3b8'}} domain={['auto', 'auto']} />
                    <YAxis yAxisId="right" orientation="right" stroke="#10b981" tick={{fill: '#10b981'}} domain={['auto', 'auto']} />
                    <Tooltip contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="spy" name="SPY Price" stroke="#94a3b8" strokeWidth={3} dot={false} />
                    <Line yAxisId="right" type="monotone" dataKey="ad_line" name="A/D Line" stroke="#10b981" strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: McClellan Oscillator */}
            <div className="glass-card" style={{ padding: '2rem' }}>
              <h3 style={{ marginTop: 0, marginBottom: '1.5rem' }}>McClellan Oscillator (Momentum Breadth)</h3>
              <div style={{ height: '300px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={marketHealth.historical_data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis dataKey="date" stroke="#94a3b8" tick={{fill: '#94a3b8'}} tickFormatter={(str) => str.substring(5)} />
                    <YAxis stroke="#94a3b8" tick={{fill: '#94a3b8'}} />
                    <Tooltip contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
                    <ReferenceLine y={0} stroke="#94a3b8" />
                    <ReferenceLine y={50} stroke="#ef4444" strokeDasharray="3 3" label={{ position: 'insideTopLeft', value: 'Overbought', fill: '#ef4444' }} />
                    <ReferenceLine y={-50} stroke="#10b981" strokeDasharray="3 3" label={{ position: 'insideBottomLeft', value: 'Oversold', fill: '#10b981' }} />
                    <Bar dataKey="mco" name="McClellan Osc">
                      {
                        marketHealth.historical_data.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.mco > 0 ? '#10b981' : '#ef4444'} />
                        ))
                      }
                    </Bar>
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 3: % > 50 SMA */}
            <div className="glass-card" style={{ padding: '2rem' }}>
              <h3 style={{ marginTop: 0, marginBottom: '1.5rem' }}>Market Breadth (% Above 50-Day SMA)</h3>
              <div style={{ height: '300px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={marketHealth.historical_data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis dataKey="date" stroke="#94a3b8" tick={{fill: '#94a3b8'}} tickFormatter={(str) => str.substring(5)} />
                    <YAxis stroke="#94a3b8" tick={{fill: '#94a3b8'}} domain={[0, 100]} />
                    <Tooltip contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
                    <ReferenceLine y={50} stroke="#94a3b8" strokeDasharray="3 3" />
                    <Area type="monotone" dataKey="pct_above_50" name="% > 50 SMA" stroke="#3b82f6" fillOpacity={0.3} fill="#3b82f6" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RRG Dashboard Tab */}
      {activeTab === 'dashboard' && (
        <>
          <div className="timeframe-toggles">
            <button className={timeframe === 'daily' ? 'active' : ''} onClick={() => { setTimeframe('daily'); setHiddenLines({}); setIsTop5Isolated(false); }}>Daily (Short-Term)</button>
            <button className={timeframe === 'weekly' ? 'active' : ''} onClick={() => { setTimeframe('weekly'); setHiddenLines({}); setIsTop5Isolated(false); }}>Weekly (Medium-Term)</button>
            <button className={timeframe === 'monthly' ? 'active' : ''} onClick={() => { setTimeframe('monthly'); setHiddenLines({}); setIsTop5Isolated(false); }}>Monthly (Structural)</button>
          </div>

          <div className="dashboard-grid">
            <div className="glass-card chart-card" style={{ paddingBottom: '3rem', position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 style={{ textAlign: 'left', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <TrendingUp color="#4facfe" /> Relative Rotation Graph ({timeframe})
                </h2>
                <button onClick={isolateTop5} className={`isolate-btn ${isTop5Isolated ? 'isolated' : ''}`}><Filter size={16} />{isTop5Isolated ? "Show All Sectors" : "🎯 Isolate Top 5"}</button>
              </div>
              
              <div style={{ position: 'absolute', top: '70px', right: '30px', color: '#10b981', fontWeight: 'bold', fontSize: '1.2rem', opacity: 0.5 }}>LEADING</div>
              <div style={{ position: 'absolute', bottom: '150px', right: '30px', color: '#f59e0b', fontWeight: 'bold', fontSize: '1.2rem', opacity: 0.5 }}>WEAKENING</div>
              <div style={{ position: 'absolute', bottom: '150px', left: '80px', color: '#ef4444', fontWeight: 'bold', fontSize: '1.2rem', opacity: 0.5 }}>LAGGING</div>
              <div style={{ position: 'absolute', top: '70px', left: '80px', color: '#3b82f6', fontWeight: 'bold', fontSize: '1.2rem', opacity: 0.5 }}>IMPROVING</div>

              <div style={{ height: '650px', width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <ReferenceArea x1={100} y1={100} fill="rgba(16, 185, 129, 0.05)" /> 
                    <ReferenceArea x1={100} y2={100} fill="rgba(245, 158, 11, 0.05)" /> 
                    <ReferenceArea x2={100} y2={100} fill="rgba(239, 68, 68, 0.05)" /> 
                    <ReferenceArea x2={100} y1={100} fill="rgba(59, 130, 246, 0.05)" /> 
                    <ReferenceLine x={100} stroke="rgba(255,255,255,0.2)" strokeWidth={2} />
                    <ReferenceLine y={100} stroke="rgba(255,255,255,0.2)" strokeWidth={2} />
                    <XAxis type="number" dataKey="x" name="RS-Ratio" domain={['dataMin - 1', 'dataMax + 1']} stroke="rgba(255,255,255,0.5)" tick={{ fill: 'rgba(255,255,255,0.5)' }} />
                    <YAxis type="number" dataKey="y" name="RS-Momentum" domain={['dataMin - 1', 'dataMax + 1']} stroke="rgba(255,255,255,0.5)" tick={{ fill: 'rgba(255,255,255,0.5)' }} />
                    <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />
                    <Legend content={renderCustomLegend} verticalAlign="bottom" />
                    
                    {rrgData.map((sector, idx) => {
                      if (hiddenLines[sector.name]) return null;
                      const isHovered = hoveredSector === sector.name;
                      const isAnotherHovered = hoveredSector !== null && hoveredSector !== sector.name;
                      const color = COLORS[idx % COLORS.length];
                      
                      return (
                        <Scatter 
                          key={sector.name} name={sector.name} data={sector.trail} fill={color}
                          line={{ stroke: color, strokeWidth: isHovered ? 4 : 2, strokeDasharray: '5 5' }}
                          opacity={isAnotherHovered ? 0.1 : 1} style={{ transition: 'all 0.3s ease', cursor: 'pointer' }}
                          onClick={() => setModalData(sector)}
                        >
                          {sector.trail.map((entry, index) => {
                            const isLast = index === sector.trail.length - 1;
                            return <Cell key={`cell-${index}`} fill={color} r={isLast ? (isHovered ? 10 : 7) : 3} opacity={isLast ? 1 : 0.4} />
                          })}
                        </Scatter>
                      )
                    })}
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="glass-card alerts-card" style={{ display: 'flex', flexDirection: 'column' }}>
              <h2 style={{ textAlign: 'left', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertCircle color="#10b981" /> Structural Leaders
              </h2>
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {tableData.slice(0, 5).map((sec, idx) => {
                  const current = sec.trail[sec.trail.length - 1];
                  const isLeading = current.x > 100 && current.y > 100;
                  return (
                    <div key={idx} className="alert-item" style={{ borderLeft: `4px solid ${isLeading ? '#10b981' : '#f59e0b'}`, paddingLeft: '1rem', marginBottom: '1rem', cursor: 'pointer' }} onClick={() => setModalData(sec)}>
                      <div className="alert-content">
                        <h4>{sec.name}</h4>
                        <p style={{ margin: '5px 0' }}>Trend: <strong>{current.x}</strong> | Mom: <strong>{current.y}</strong></p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Sector Components Modal */}
      {modalData && !expertTickerData && (
        <div className="modal-overlay" onClick={() => setModalData(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setModalData(null)}><X size={24} /></button>
            <h2 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#4facfe' }}>
              <Activity /> {modalData.name} ({modalData.ticker})
            </h2>
            <div className="top-stocks-grid" style={{ gridTemplateColumns: '1fr', gap: '1rem' }}>
              {modalData.top_stocks && modalData.top_stocks.length > 0 ? (
                modalData.top_stocks.map(stock => (
                  <div key={stock.ticker} className="stock-pill" style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', cursor: 'pointer' }} onClick={() => openLocalTicker(stock)}>
                    <strong style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>{stock.ticker} <BarChart2 size={16} /></strong>
                    <span style={{ color: stock.perf > 0 ? '#10b981' : '#ef4444' }}>{stock.perf > 0 ? '+' : ''}{stock.perf.toFixed(2)}%</span>
                  </div>
                ))
              ) : <span>No data available.</span>}
            </div>
          </div>
        </div>
      )}

      {/* Unified Expert Ticker Card (Used for both Sector Components AND Live API Search AND Screeners) */}
      {expertTickerData && (
        <div className="modal-overlay" onClick={() => setExpertTickerData(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '800px', borderTop: `5px solid ${expertTickerData.technicals.momentum_color === 'bullish' ? '#10b981' : expertTickerData.technicals.momentum_color === 'bearish' ? '#ef4444' : '#f59e0b'}` }}>
            <button className="modal-close" onClick={() => setExpertTickerData(null)}><X size={24} /></button>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h1 style={{ margin: 0, fontSize: '2.5rem', color: '#fff' }}>{expertTickerData.ticker}</h1>
                <h3 style={{ margin: 0, color: '#94a3b8' }}>{expertTickerData.name}</h3>
              </div>
              {expertTickerData.score !== null && (
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '3rem', fontWeight: 'bold', color: expertTickerData.score >= 70 ? '#10b981' : expertTickerData.score >= 40 ? '#f59e0b' : '#ef4444', lineHeight: '1' }}>
                    {expertTickerData.score}
                  </div>
                  <span style={{ color: '#94a3b8', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Master Rank</span>
                </div>
              )}
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: expertTickerData.fundamentals ? '1fr 1fr' : '1fr', gap: '2rem', marginTop: '1.5rem' }}>
              
              <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1.5rem', borderRadius: '12px' }}>
                <h3 style={{ margin: '0 0 1rem 0', color: '#4facfe', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>Technical Health</h3>
                
                <div style={{ marginBottom: '1rem' }}>
                  <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.85rem' }}>Stan Weinstein Phase</p>
                  <strong style={{ fontSize: '1.2rem', color: expertTickerData.technicals.stage.includes('Stage 2') ? '#10b981' : expertTickerData.technicals.stage.includes('Stage 4') ? '#ef4444' : '#f59e0b' }}>
                    {expertTickerData.technicals.stage}
                  </strong>
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.85rem' }}>MACD / RSI Trajectory</p>
                  <strong style={{ fontSize: '1.1rem', color: expertTickerData.technicals.momentum_color === 'bullish' ? '#10b981' : expertTickerData.technicals.momentum_color === 'bearish' ? '#ef4444' : '#f59e0b' }}>
                    {expertTickerData.technicals.momentum_text}
                  </strong>
                </div>

                <div>
                  <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.85rem' }}>Relative Strength vs SPY (1 Month)</p>
                  <strong style={{ fontSize: '1.2rem', color: expertTickerData.technicals.rs_spy_1mo > 0 ? '#10b981' : '#ef4444' }}>
                    {expertTickerData.technicals.rs_spy_1mo > 0 ? '+' : ''}{expertTickerData.technicals.rs_spy_1mo.toFixed(2)}%
                  </strong>
                </div>
              </div>

              {expertTickerData.fundamentals && (
                <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1.5rem', borderRadius: '12px' }}>
                  <h3 style={{ margin: '0 0 1rem 0', color: '#f59e0b', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>Fundamental Health</h3>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.85rem' }}>Revenue Growth</p>
                      <strong style={{ fontSize: '1.1rem', color: expertTickerData.fundamentals.revenue_growth > 20 ? '#10b981' : '#fff' }}>
                        {expertTickerData.fundamentals.revenue_growth.toFixed(1)}%
                      </strong>
                    </div>
                    <div>
                      <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.85rem' }}>Profit Margin</p>
                      <strong style={{ fontSize: '1.1rem', color: expertTickerData.fundamentals.profit_margin > 15 ? '#10b981' : '#fff' }}>
                        {expertTickerData.fundamentals.profit_margin.toFixed(1)}%
                      </strong>
                    </div>
                    <div>
                      <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.85rem' }}>Return on Equity</p>
                      <strong style={{ fontSize: '1.1rem', color: expertTickerData.fundamentals.roe > 15 ? '#10b981' : '#fff' }}>
                        {expertTickerData.fundamentals.roe.toFixed(1)}%
                      </strong>
                    </div>
                    <div>
                      <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.85rem' }}>PEG Ratio</p>
                      <strong style={{ fontSize: '1.1rem', color: (expertTickerData.fundamentals.peg_ratio > 0 && expertTickerData.fundamentals.peg_ratio < 1.5) ? '#10b981' : expertTickerData.fundamentals.peg_ratio > 3 ? '#ef4444' : '#fff' }}>
                        {expertTickerData.fundamentals.peg_ratio ? expertTickerData.fundamentals.peg_ratio.toFixed(2) : 'N/A'}
                      </strong>
                    </div>
                  </div>
                </div>
              )}
              
            </div>
            
          </div>
        </div>
      )}

      {/* Floating Radar Button */}
      <button 
        className="live-radar-btn pulse"
        onClick={fetchIntradayAlerts}
        title="Live Intraday ORB Scanner"
      >
        <Radio size={24} color="#fff" />
      </button>

      {/* Intraday Options Popup Window */}
      {showIntraday && (
        <div className="modal-overlay" onClick={() => setShowIntraday(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '700px', borderTop: '5px solid #ec4899' }}>
            <button className="modal-close" onClick={() => setShowIntraday(false)}><X size={24} /></button>
            <h2 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#ec4899' }}>
              <Radio className="spin-slow" /> Live Intraday Options Radar
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              Scanning High-Beta Mega Caps for 15-Min Opening Range Breakouts paired with massive Call Volume &gt; Put Volume flow.
            </p>
            
            {intradayLoading ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#ec4899' }}>
                <Loader size={48} className="spin" style={{ marginBottom: '1rem' }} />
                <h3>Scanning Options Chains... (This takes a few seconds)</h3>
              </div>
            ) : intradayData && intradayData.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {intradayData.map((alert, i) => (
                  <div key={i} className="glass-card" style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: '4px solid #10b981' }}>
                    <div>
                      <h2 style={{ margin: '0 0 0.5rem 0', color: '#fff', fontSize: '2rem' }}>{alert.ticker}</h2>
                      <div style={{ color: '#10b981', fontWeight: 'bold' }}>
                        Broke 15m ORB Pivot: ${alert.orb_pivot.toFixed(2)}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ marginBottom: '0.5rem' }}>
                        <span style={{ color: '#94a3b8', fontSize: '0.8rem', marginRight: '10px' }}>Current Price</span>
                        <strong style={{ fontSize: '1.2rem' }}>${alert.current_price.toFixed(2)}</strong>
                      </div>
                      <div style={{ marginBottom: '0.5rem' }}>
                        <span style={{ color: '#94a3b8', fontSize: '0.8rem', marginRight: '10px' }}>Vol Multiplier</span>
                        <strong style={{ color: alert.vol_multiplier > 2 ? '#10b981' : '#f59e0b' }}>{alert.vol_multiplier.toFixed(1)}x Avg</strong>
                      </div>
                      <div>
                        <span style={{ color: '#94a3b8', fontSize: '0.8rem', marginRight: '10px' }}>Call/Put Vol Ratio</span>
                        <strong style={{ color: alert.call_put_ratio > 2 ? '#10b981' : '#ec4899' }}>{alert.call_put_ratio.toFixed(2)}x</strong>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: '2rem', textAlign: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: '12px' }}>
                <AlertCircle size={48} color="#f59e0b" style={{ marginBottom: '1rem' }} />
                <h3>No Intraday Breakouts Found</h3>
                <p style={{ color: '#94a3b8' }}>None of the high-beta stocks are currently breaking their 15-minute ORB with heavy Call flow.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

export default App
