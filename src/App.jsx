import React, { useState, useEffect } from 'react'
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea, Legend, Cell, ComposedChart, Line, Bar, Area, LabelList } from 'recharts'
import { TrendingUp, AlertCircle, RefreshCw, ChevronDown, ChevronUp, FileText, Activity, Filter, X, BarChart2, ActivitySquare, Compass, Search, Loader, Crosshair, Radio, HeartPulse, Maximize, Minimize, Send, Bot, User, Sun, BookOpen, Zap, Link, Star } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import CustomTradingChart from './CustomTradingChart'
import UnifiedPlotlyChart from './UnifiedPlotlyChart'
import GexHeatmap from './GexHeatmap'
import VolatilitySurface3D from './VolatilitySurface3D'
import TradingViewSync from './TradingViewSync'
import EarningsEvasionTracker from './EarningsEvasionTracker'
import ZacksFundamentalReport from './ZacksFundamentalReport'
import LiveAgentsDashboard from './LiveAgentsDashboard'
import RsLineScanner from './RsLineScanner'
import { AdvancedRealTimeChart } from "react-ts-tradingview-widgets";
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
  reversal: { title: "Oversold Reversal", icon: <RefreshCw color="#ef4444" /> },
  zacks_rank_1: { title: "Zacks Rank #1 (Strong Buy)", icon: <BookOpen color="#10b981" /> },
  pending_breakout: { title: "Pending Breakout (Squeeze)", icon: <ActivitySquare color="#f43f5e" /> },
  long_base_breakout: { title: "3-Year Long Base", icon: <Compass color="#3b82f6" /> },
  medium_base_breakout: { title: "Medium Base (3mo - 2yr)", icon: <Compass color="#a855f7" /> },
  qullamaggie_setup: { title: "Qullamaggie Episodic Pivot", icon: <TrendingUp color="#8b5cf6" /> },
  rs_divergence: { title: "RS Line Divergence (New High)", icon: <Activity color="#10b981" /> }
}

const ScreenerPill = ({ item, rank, onClick }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [healthData, setHealthData] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [loading, setLoading] = useState(false);

  const refreshData = (e) => {
    if (e) e.stopPropagation();
    setLoading(true);
    setErrorMsg(null);
    fetch(`/api/search?ticker=${item.ticker}&t=${new Date().getTime()}`)
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          setErrorMsg(data.error);
        } else {
          setHealthData(data);
        }
        setLoading(false);
      })
      .catch(() => {
        setErrorMsg("Network error");
        setLoading(false);
      });
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
    if (!healthData && !loading && !errorMsg) {
      refreshData();
    }
  };

  return (
    <div 
      className="stock-pill" 
      style={{ position: 'relative', zIndex: isHovered ? 999 : 1, display: 'flex', justifyContent: 'space-between', padding: '0.75rem 1rem', cursor: 'pointer', background: isHovered ? 'rgba(79, 172, 254, 0.1)' : 'rgba(255,255,255,0.05)' }}
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {rank && <span style={{ color: '#4facfe', fontWeight: 'bold', minWidth: '25px' }}>#{rank}</span>}
        <strong>{item.ticker}</strong>
      </div>
      <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>{item.metric}</span>
      
      {isHovered && (
        <div style={{ position: 'absolute', top: 'calc(100% + 5px)', right: '0', width: '280px', background: 'rgba(15, 23, 42, 0.95)', border: '1px solid #4facfe', borderRadius: '8px', padding: '1rem', zIndex: 9999, boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
          <h4 style={{ margin: '0 0 0.5rem 0', color: '#4facfe' }}>Why Picked:</h4>
          <p style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: '#fff' }}>{item.metric}</p>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <h4 style={{ margin: 0, color: '#10b981' }}>Health:</h4>
            <button onClick={refreshData} style={{ background: 'none', border: 'none', color: '#4facfe', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }} title="Refresh Data">
              <RefreshCw size={14} className={loading ? "spin" : ""} />
            </button>
          </div>
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
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#ef4444' }}>{errorMsg || 'Data unavailable'}</p>
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
  const [expandedCategories, setExpandedCategories] = useState({})
  const [collapsedCategories, setCollapsedCategories] = useState(
    Object.keys(ScreenerCategories).reduce((acc, key) => { acc[key] = true; return acc; }, {})
  )
  
  // Full-Stack Search State
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState(null)
  const [expertTickerData, setExpertTickerData] = useState(null)
  const [briefingData, setBriefingData] = useState(null)
  const [isRightDrawerOpen, setIsRightDrawerOpen] = useState(false)
  const [chartMode, setChartMode] = useState('advanced') // Default to advanced with drawing tools
  
  // Live Agent Chat State
  const [chatHistory, setChatHistory] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [agentPersona, setAgentPersona] = useState('quant') // quant, options, macro
  const [isChatLoading, setIsChatLoading] = useState(false)
  
  // Intraday State
  const [intradayData, setIntradayData] = useState(null)
  const [intradayLoading, setIntradayLoading] = useState(false)
  
  // Market Health State
  const [marketHealth, setMarketHealth] = useState(null)
  
  // Squeeze State
  const [squeezeData, setSqueezeData] = useState(null)
  
  // DeepVue State
  const [deepvueData, setDeepvueData] = useState(null)
  
  // Advanced Analytics State
  const [correlationData, setCorrelationData] = useState(null)
  const [gexSearch, setGexSearch] = useState('')
  const [searchedGex, setSearchedGex] = useState(null)
  const [gexLoading, setGexLoading] = useState(false)
  const [gexError, setGexError] = useState('')
  
  // Playbook State
  const [playbookContent, setPlaybookContent] = useState('')
  const [weeklyPlaybook, setWeeklyPlaybook] = useState(null)
  
  // Global Live Alerts State
  const [globalLiveAlerts, setGlobalLiveAlerts] = useState([])

  useEffect(() => {
    fetch('/sector_flow.json?t=' + new Date().getTime())
      .then(res => res.json())
      .then(json => setData(json))
      .catch(err => console.error("Error fetching data:", err))
      
    fetch('/screener_results.json?t=' + new Date().getTime())
      .then(res => res.json())
      .then(data => setScreenerData(data))
      .catch(err => console.error("Error loading screener data:", err))
      
    fetch('/market_health.json?t=' + new Date().getTime())
      .then(res => res.json())
      .then(data => setMarketHealth(data))

    fetch('/weekly_playbook.json?t=' + new Date().getTime())
      .then(res => res.json())
      .then(data => setWeeklyPlaybook(data))
      .catch(err => console.error("Error loading weekly playbook:", err))
      .catch(err => console.error("Error loading market health data:", err))
      
    fetch('/squeeze_results.json?t=' + new Date().getTime())
      .then(res => res.json())
      .then(data => setSqueezeData(data))
      .catch(err => console.error("Error loading squeeze data:", err))
      
    fetch('/deepvue_results.json?t=' + new Date().getTime())
      .then(res => res.json())
      .then(data => setDeepvueData(data))
      .catch(err => console.error("Error loading deepvue data:", err))
      
    fetch('/correlation_results.json?t=' + new Date().getTime())
      .then(res => res.json())
      .then(data => setCorrelationData(data))
      .catch(err => console.error("Error loading correlation data:", err))

    fetch('/ai_playbook.md?t=' + new Date().getTime())
      .then(res => res.text())
      .then(text => setPlaybookContent(text))
      .catch(err => console.error("Error loading playbook:", err))
      
    // Live Agent Slack-Channel Integration
    const eventSource = new EventSource('/api/stream');
    eventSource.onmessage = (event) => {
      try {
        const alert = JSON.parse(event.data);
        const slackMessage = {
          role: 'agent',
          isBroadcast: true,
          council: alert.council,
          text: alert.council.includes('PREMARKET') ? `[MORNING BRIEFING] ${alert.setup} - ${alert.timestamp}` : `[LIVE ALERT] ${alert.ticker}: ${alert.setup} - ${alert.timestamp}`,
          color: alert.color,
          ticker: alert.ticker,
          payload: alert.payload
        };
        // Append the live broadcast to the global chat history
        setChatHistory(prev => [...prev, slackMessage]);
      } catch (err) {
        console.error("SSE Parse Error", err);
      }
    };
    
    return () => eventSource.close();
  }, [])
  
  // Global Alert Polling
  useEffect(() => {
    const pollAlerts = async () => {
      try {
        const res = await fetch('/live_market_alerts.json?t=' + new Date().getTime());
        if (res.ok) {
          const json = await res.json();
          setGlobalLiveAlerts(json.alerts || []);
        }
      } catch (err) {}
    };
    pollAlerts();
    const interval = setInterval(pollAlerts, 10000);
    return () => clearInterval(interval);
  }, [])

  const handleGexSearch = async (e) => {
    e.preventDefault();
    if (!gexSearch) return;
    setGexLoading(true);
    setGexError('');
    setSearchedGex(null);
    try {
      const res = await fetch(`/api/gex?ticker=${gexSearch}`);
      const data = await res.json();
      if (data.error) {
        setGexError(data.error);
      } else {
        setSearchedGex(data);
      }
    } catch (err) {
      setGexError("Failed to connect to backend");
    } finally {
      setGexLoading(false);
    }
  };

  if (!data || !data.rrg) {
    return <div className="loading"><RefreshCw size={48} /><h2>Loading Sector Tracker Engine...</h2></div>
  }

  const rrgData = data.rrg[timeframe] || [];
  const marketMeter = data.market_meter;
  const tableData = [...rrgData].sort((a, b) => b.trail[b.trail.length - 1].x - a.trail[a.trail.length - 1].x)

  const getRotationSummary = () => {
    const freshMoney = [];
    const profitTaking = [];
    const deadMoney = [];

    rrgData.forEach(sec => {
      if (!sec.trail || sec.trail.length === 0) return;
      const current = sec.trail[sec.trail.length - 1];
      // Look back a few periods for direction
      const prev = sec.trail.length > 3 ? sec.trail[sec.trail.length - 3] : sec.trail[0];

      const isImproving = current.x < 100 && current.y >= 100;
      const isLeading = current.x >= 100 && current.y >= 100;
      const isWeakening = current.x >= 100 && current.y < 100;
      const isLagging = current.x < 100 && current.y < 100;

      const momRising = current.y > prev.y;
      
      const rank = tableData.findIndex(s => s.name === sec.name) + 1;
      const sectorObj = { name: sec.name, rank, improving: momRising };
      
      // 1. Fresh Money / Leaders (Aggressive rotation IN or Current Leaders)
      if (isLeading || (isImproving && momRising)) {
        freshMoney.push(sectorObj);
      } 
      // 2. Profit Taking (Rotation OUT)
      else if (isWeakening) {
        profitTaking.push(sectorObj);
      } 
      // 3. Dead Money (Trapped, or Failed Breakouts)
      else if (isLagging || (isImproving && !momRising)) {
        deadMoney.push(sectorObj);
      }
    });
    // Sort all arrays by rank (ascending, so #1 is first)
    freshMoney.sort((a, b) => a.rank - b.rank);
    profitTaking.sort((a, b) => a.rank - b.rank);
    // Dead money sorted descending (so highest rank number/worst sector is first)
    deadMoney.sort((a, b) => b.rank - a.rank);

    return { freshMoney, profitTaking, deadMoney };
  };
  const moneyFlow = getRotationSummary();

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
    setActiveTab('chart');
    setIsRightDrawerOpen(true);
    
    try {
      const res = await fetch(`/api/search?ticker=${ticker}&t=${new Date().getTime()}`);
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

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    
    const userMessage = { role: 'user', text: chatInput };
    setChatHistory(prev => [...prev, userMessage]);
    setChatInput('');
    setIsChatLoading(true);
    
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: chatInput, 
          ticker: expertTickerData ? expertTickerData.ticker : 'UNKNOWN',
          persona: agentPersona,
          context: expertTickerData || {}
        })
      });
      const data = await res.json();
      setChatHistory(prev => [...prev, { role: 'agent', text: data.response }]);
    } catch (err) {
      setChatHistory(prev => [...prev, { role: 'agent', text: 'Sorry, my connection to the mainframe dropped. Please try again.' }]);
    } finally {
      setIsChatLoading(false);
    }
  }
  
  const fetchIntradayAlerts = async () => {
    setActiveTab('intraday');
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
    <div className="app-layout">
      {/* Neo-Brutalist Sidebar */}
      <div className="sidebar-nav">
        <div style={{ padding: '1.5rem', borderBottom: '1px solid #1e293b', marginBottom: '1rem' }}>
          <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Activity color="#4facfe" /> SectorTracker
          </h1>
          <p style={{ margin: '0.5rem 0 0 0', color: '#94a3b8', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Institutional Terminal</p>
        </div>
        
        <div className="sidebar-menu">
          <button className={activeTab === 'dashboard' ? 'tab-active' : ''} onClick={() => setActiveTab('dashboard')}><Activity size={18} /> RRG Dashboard</button>
          <button className={activeTab === 'chart' ? 'tab-active' : ''} onClick={() => {
            setActiveTab('chart');
            if (!expertTickerData && !isSearching) {
              fetchTickerData('SPY');
            }
          }}><BarChart2 size={18} /> Deep Charting</button>
          <button className={activeTab === 'screeners' ? 'tab-active' : ''} onClick={() => setActiveTab('screeners')}><Crosshair size={18} /> Expert Screeners</button>
          <button className={activeTab === 'health' ? 'tab-active' : ''} onClick={() => setActiveTab('health')}><HeartPulse size={18} /> Market Health</button>
          <button className={activeTab === 'playbook' ? 'tab-active' : ''} onClick={() => setActiveTab('playbook')}><BookOpen size={18} /> Weekly Playbook</button>
          <div style={{ marginTop: '2rem', padding: '0 10px' }}>
            <button 
              className="trade-button" 
              onClick={() => {
                fetch('http://localhost:5001/api/sync_lakehouse', { method: 'POST' });
                alert("Database Update & Scanner Engine started in the background. Please wait ~2 minutes for it to complete.");
              }} 
              style={{ width: '100%', display: 'flex', justifyContent: 'center', gap: '8px' }}
            >
              <RefreshCw size={16} /> Sync Lakehouse
            </button>
          </div>
          <button className={activeTab === 'squeeze' ? 'tab-active' : ''} onClick={() => setActiveTab('squeeze')}><AlertCircle size={18} /> Squeeze Radar</button>
          <button className={activeTab === 'intraday' ? 'tab-active' : ''} onClick={fetchIntradayAlerts}><Radio size={18} /> Intraday Radar</button>
          <button className={activeTab === 'macromatrix' ? 'tab-active' : ''} onClick={() => setActiveTab('macromatrix')}><ActivitySquare size={18} /> Macro Matrix</button>
          <button className={activeTab === 'rslinescanner' ? 'tab-active' : ''} onClick={() => setActiveTab('rslinescanner')}><Star size={18} /> RS Line Scanner</button>
          <button className={activeTab === 'gexprofiler' ? 'tab-active' : ''} onClick={() => setActiveTab('gexprofiler')}><BarChart2 size={18} /> GEX Profiler</button>
          <button className={activeTab === 'volsurface' ? 'tab-active' : ''} onClick={() => setActiveTab('volsurface')}><Activity size={18} /> 3D Vol Surface</button>
          <button className={activeTab === 'earnings' ? 'tab-active' : ''} onClick={() => setActiveTab('earnings')}><User size={18} /> AI Earnings</button>
          <button className={activeTab === 'zacks' ? 'tab-active' : ''} onClick={() => setActiveTab('zacks')}><BookOpen size={18} /> Zacks Fundamentals</button>
          <button className={activeTab === 'agents' ? 'tab-active' : ''} onClick={() => setActiveTab('agents')}><Search size={18} /> AI Market Agents</button>
          <button className={activeTab === 'analysis' ? 'tab-active' : ''} onClick={() => setActiveTab('analysis')}><FileText size={18} /> AI Playbook</button>
          <button className={activeTab === 'tvsync' ? 'tab-active' : ''} onClick={() => setActiveTab('tvsync')}><Link size={18} /> TradingView Sync</button>
          <button className={activeTab === 'ask_ai' ? 'tab-active' : ''} onClick={() => setActiveTab('ask_ai')}><Bot size={18} /> Ask AI (Live)</button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="main-content">
        {/* Top Navbar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', paddingBottom: '1rem', borderBottom: '1px solid #1e293b' }}>
          <form onSubmit={handleSearch} style={{ display: 'flex', width: '400px', position: 'relative' }}>
            <input 
              type="text" placeholder="Search any US Ticker (e.g., AAPL)..."
              value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input" style={{ width: '100%' }}
            />
            <button type="submit" className="search-btn" disabled={isSearching}>
              {isSearching ? <Loader size={18} className="spin" /> : <Search size={18} />}
            </button>
          </form>

          {marketMeter && (
            <div className="glass-card" style={{ padding: '0.5rem 1rem', borderLeft: `4px solid ${marketMeter.color}`, display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
              <Compass size={18} color={marketMeter.color} />
              <strong style={{ margin: 0, color: marketMeter.color, fontSize: '0.9rem' }}>Market Trend: {marketMeter.status}</strong>
            </div>
          )}
        </div>

        {/* Global Intraday Live Alerts Ticker */}
        {globalLiveAlerts.length > 0 && (
          <div style={{ marginBottom: '1.5rem', padding: '0.5rem 1rem', background: 'rgba(239, 68, 68, 0.1)', borderBottom: '1px solid #ef4444', display: 'flex', alignItems: 'center', gap: '15px', overflowX: 'auto', borderRadius: '4px' }}>
              <span style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.9rem', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                  <AlertCircle size={16} /> BREAKOUTS:
              </span>
              <div style={{ display: 'flex', gap: '10px' }}>
                  {globalLiveAlerts.map((alert, i) => (
                      <div key={i} onClick={() => fetchTickerData(alert.ticker)} style={{ cursor: 'pointer', background: 'rgba(15, 23, 42, 0.8)', padding: '4px 10px', borderRadius: '4px', borderLeft: '2px solid #ef4444', display: 'flex', alignItems: 'center', gap: '10px', whiteSpace: 'nowrap', transition: 'all 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'} onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(15, 23, 42, 0.8)'}>
                          <strong style={{ color: '#fff', fontSize: '0.9rem' }}>{alert.ticker}</strong>
                          <span style={{ color: '#ef4444', fontWeight: 'bold', fontSize: '0.85rem' }}>+{alert.pct_above.toFixed(2)}%</span>
                          <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                              Brk: ${alert.trigger_price.toFixed(2)} ➔ <strong style={{color: '#fff'}}>${alert.price.toFixed(2)}</strong>
                          </span>
                      </div>
                  ))}
              </div>
          </div>
        )}

      {activeTab === 'tvsync' && (
        <TradingViewSync />
      )}

      {activeTab === 'macromatrix' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>
          <div className="glass-card" style={{ padding: '2rem', borderTop: '5px solid #4facfe' }}>
            <h2 style={{ marginTop: 0, color: '#4facfe', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ActivitySquare size={24} /> Actionable Macro Regimes
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '1rem', marginBottom: '2rem' }}>
              Stop looking at raw correlation decimals. This engine tells you exactly what to buy based on where you think Yields, Oil, Crypto, and the Dollar are going.
            </p>
            {correlationData && correlationData.scenarios ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                {correlationData.scenarios.map((scenario, idx) => {
                  let driverColor = '#4facfe';
                  if (scenario.driver.includes("Yield")) driverColor = '#ef4444';
                  if (scenario.driver.includes("Oil")) driverColor = '#f59e0b';
                  if (scenario.driver.includes("Bitcoin")) driverColor = '#f59e0b';
                  if (scenario.driver.includes("Dollar")) driverColor = '#10b981';

                  return (
                    <div key={idx} className="neo-panel" style={{ padding: '1.5rem', background: 'rgba(15, 23, 42, 0.6)' }}>
                      <h3 style={{ margin: '0 0 1.5rem 0', color: driverColor, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem', fontSize: '1.3rem' }}>
                        {scenario.driver} Scenario
                      </h3>
                      
                      <div style={{ marginBottom: '1.5rem' }}>
                        <h4 style={{ margin: '0 0 0.75rem 0', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          If {scenario.driver} goes UP ↗️
                        </h4>
                        <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: '#94a3b8' }}>Buy these highly positively correlated names:</p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                          {scenario.if_up.length > 0 ? scenario.if_up.map(stock => (
                            <span key={stock.ticker} onClick={() => fetchTickerData(stock.ticker)} className="stock-pill" style={{ cursor: 'pointer', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '4px 10px', borderRadius: '12px', fontSize: '0.85rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              {stock.ticker} <span style={{opacity: 0.5}}>{stock.corr}</span>
                            </span>
                          )) : <span style={{ color: '#64748b', fontSize: '0.85rem' }}>No strong positive correlations found.</span>}
                        </div>
                      </div>

                      <div>
                        <h4 style={{ margin: '0 0 0.75rem 0', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          If {scenario.driver} goes DOWN ↘️
                        </h4>
                        <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: '#94a3b8' }}>Buy these highly inversely correlated names:</p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                          {scenario.if_down.length > 0 ? scenario.if_down.map(stock => (
                            <span key={stock.ticker} onClick={() => fetchTickerData(stock.ticker)} className="stock-pill" style={{ cursor: 'pointer', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '4px 10px', borderRadius: '12px', fontSize: '0.85rem', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              {stock.ticker} <span style={{opacity: 0.5}}>{stock.corr}</span>
                            </span>
                          )) : <span style={{ color: '#64748b', fontSize: '0.85rem' }}>No strong inverse correlations found.</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#4facfe' }}>
                <Loader className="spin" size={32} style={{ marginBottom: '1rem' }} />
                <p>Loading Actionable Scenarios...</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'gexprofiler' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>
          <div className="glass-card" style={{ padding: '2rem' }}>
            <form onSubmit={(e) => { e.preventDefault(); setSearchedGex({ticker: gexSearch.toUpperCase()}); }} style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
              <input type="text" placeholder="Enter ticker (e.g., TSLA, SPY, SMCI)..." value={gexSearch} onChange={(e) => setGexSearch(e.target.value.toUpperCase())} style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid #334155', background: 'rgba(0,0,0,0.2)', color: 'white', flex: 1 }} />
              <button type="submit" style={{ padding: '0.75rem 2rem', background: '#3b82f6', borderRadius: '8px', border: 'none', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}>Scan Ticker</button>
            </form>
            <GexHeatmap ticker={(searchedGex?.ticker) || expertTickerData?.ticker || 'SPY'} />
          </div>
        </div>
      )}

      {activeTab === 'volsurface' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>
          <div className="glass-card" style={{ padding: '2rem' }}>
            <form onSubmit={(e) => { e.preventDefault(); setSearchedGex({ticker: gexSearch.toUpperCase()}); }} style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
              <input type="text" placeholder="Enter ticker (e.g., TSLA, SPY, SMCI)..." value={gexSearch} onChange={(e) => setGexSearch(e.target.value.toUpperCase())} style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid #334155', background: 'rgba(0,0,0,0.2)', color: 'white', flex: 1 }} />
              <button type="submit" style={{ padding: '0.75rem 2rem', background: '#3b82f6', borderRadius: '8px', border: 'none', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}>Map Surface</button>
            </form>
            <VolatilitySurface3D ticker={(searchedGex?.ticker) || expertTickerData?.ticker || 'SPY'} />
          </div>
        </div>
      )}

      {activeTab === 'zacks' && (
        <ZacksFundamentalReport initialTicker={searchQuery || 'NVDA'} />
      )}

      {activeTab === 'earnings' && (
        <EarningsEvasionTracker initialTicker={searchQuery || 'NVDA'} />
      )}

      {activeTab === 'agents' && (
        <LiveAgentsDashboard initialTicker={searchQuery || 'NVDA'} />
      )}

      {activeTab === 'rslinescanner' && (
        <div className="glass-card" style={{ padding: '2rem' }}>
            <RsLineScanner onTickerClick={fetchTickerData} />
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', alignItems: 'start', marginBottom: '2rem' }}>
            {/* DeepVue Quantitative Leaders Card */}
            {deepvueData && deepvueData.leaders && (
              <div className="glass-card" style={{ padding: '1.5rem', border: '1px solid rgba(255, 215, 0, 0.3)' }}>
                <h3 
                  style={{ marginTop: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#ffd700', cursor: 'pointer' }}
                  onClick={() => setCollapsedCategories(prev => ({ ...prev, deepvue: !prev.deepvue }))}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Zap size={18} /> TraderLion / DeepVue Leaders</span>
                  {collapsedCategories.deepvue ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
                </h3>
                
                {!collapsedCategories.deepvue && (
                  <>
                    <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '1rem', marginTop: '0.5rem' }}>
                      S.N.I.P Matrix: RS Rating &gt; 80, VCP, Earnings Growth &gt; 15%
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {deepvueData.leaders.map(item => (
                        <ScreenerPill 
                          key={item.ticker} 
                          item={{
                            ticker: item.ticker,
                            metric: `RS Rank ${item.rs_rating} ${item.vcp_setup ? '🔥(VCP)' : ''}`
                          }} 
                          onClick={() => fetchTickerData(item.ticker)} 
                        />
                      ))}
                    </div>

                    {deepvueData.active_vcp && deepvueData.active_vcp.length > 0 && (
                      <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid rgba(255, 215, 0, 0.15)' }}>
                        <h4 style={{ color: '#ffd700', marginTop: 0, marginBottom: '0.75rem', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <Crosshair size={14} /> Tightly Coiled (VCP)
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {deepvueData.active_vcp.map(item => (
                            <ScreenerPill 
                              key={`vcp-${item.ticker}`} 
                              item={{
                                ticker: item.ticker,
                                metric: `RS Rank ${item.rs_rating}`
                              }} 
                              onClick={() => fetchTickerData(item.ticker)} 
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
            
            {/* Standard Algorithmic Setups */}
            {Object.entries(ScreenerCategories).map(([key, config]) => (
              <div key={key} className="glass-card" style={{ padding: '1.5rem' }}>
                <h3 
                  style={{ marginTop: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#fff', cursor: 'pointer' }}
                  onClick={() => setCollapsedCategories(prev => ({ ...prev, [key]: !prev[key] }))}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>{config.icon} {config.title}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {expandedCategories[key] && !collapsedCategories[key] && (
                        <span 
                            style={{ fontSize: '0.75rem', padding: '4px 10px', background: 'rgba(79, 172, 254, 0.15)', color: '#4facfe', borderRadius: '12px', border: '1px solid #4facfe' }}
                            onClick={(e) => { 
                                e.stopPropagation(); 
                                setExpandedCategories(prev => ({ ...prev, [key]: false })); 
                            }}
                        >
                            Fold Up
                        </span>
                    )}
                    {collapsedCategories[key] ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
                  </div>
                </h3>
                
                {!collapsedCategories[key] && (
                  screenerData[key] && screenerData[key].length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
                      {screenerData[key]
                        .slice(0, expandedCategories[key] ? 20 : 5)
                        .map((item, idx) => (
                        <ScreenerPill key={item.ticker} item={item} rank={idx + 1} onClick={() => fetchTickerData(item.ticker)} />
                      ))}
                      {screenerData[key].length > 5 && (
                        <button 
                          onClick={() => setExpandedCategories(prev => ({ ...prev, [key]: !prev[key] }))}
                          style={{ 
                            background: 'rgba(79, 172, 254, 0.05)', 
                            border: '1px dashed rgba(79, 172, 254, 0.3)', 
                            color: '#4facfe', 
                            padding: '0.5rem', 
                            borderRadius: '4px', 
                            cursor: 'pointer', 
                            marginTop: '0.5rem',
                            transition: 'all 0.2s',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            gap: '5px'
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(79, 172, 254, 0.15)'; e.currentTarget.style.borderColor = '#4facfe'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(79, 172, 254, 0.05)'; e.currentTarget.style.borderColor = 'rgba(79, 172, 254, 0.3)'; }}
                        >
                          {expandedCategories[key] ? (
                            <><ChevronUp size={16}/> Fold Up</>
                          ) : (
                            <><ChevronDown size={16}/> Show Next 15 Stocks (Rank 6-20)</>
                          )}
                        </button>
                      )}
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

      {/* Weekly Playbook Tab */}
      {activeTab === 'playbook' && weeklyPlaybook && (
        <div style={{ marginTop: '2rem' }}>
          <div className="glass-card" style={{ padding: '2rem', marginBottom: '2rem' }}>
            <h2 style={{ margin: '0 0 1rem 0', color: '#4facfe', display: 'flex', alignItems: 'center', gap: '10px' }}><Compass size={24}/> Weekly Market Summary ({weeklyPlaybook.date})</h2>
            <p style={{ fontSize: '1.2rem', lineHeight: '1.6', color: '#e2e8f0', margin: '0 0 1rem 0' }}>{weeklyPlaybook.market_summary.text}</p>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', marginBottom: '2rem' }}>
            <div className="glass-card" style={{ padding: '1.5rem', borderLeft: '4px solid #10b981' }}>
              <h3 style={{ margin: '0 0 1rem 0', color: '#10b981', display: 'flex', alignItems: 'center', gap: '8px' }}><TrendingUp size={18}/> Stocks That Ran (Top 5)</h3>
              {weeklyPlaybook.stocks_that_ran.map(s => (
                <div key={s.ticker} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '0.5rem 0' }}>
                  <strong style={{ color: '#fff' }}>{s.ticker}</strong>
                  <span style={{ color: '#10b981' }}>{s.return}</span>
                </div>
              ))}
            </div>
            <div className="glass-card" style={{ padding: '1.5rem', borderLeft: '4px solid #f43f5e' }}>
              <h3 style={{ margin: '0 0 1rem 0', color: '#f43f5e', display: 'flex', alignItems: 'center', gap: '8px' }}><ActivitySquare size={18}/> About to Fly (Squeeze)</h3>
              {weeklyPlaybook.about_to_fly.map(s => (
                <div key={s.ticker} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '0.5rem 0' }}>
                  <strong style={{ color: '#fff' }}>{s.ticker}</strong>
                  <span style={{ color: '#f59e0b' }}>{s.dist_ath} from ATH</span>
                </div>
              ))}
            </div>
          </div>

          <h2 style={{ margin: '2rem 0 1rem 0', color: '#fff' }}>🤖 Top 3 AI Trade Plans for Next Week</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>
            {weeklyPlaybook.top_3_picks.map((pick, i) => (
              <div key={pick.ticker} className="glass-card" style={{ padding: '1.5rem', background: 'linear-gradient(135deg, rgba(79,172,254,0.1) 0%, rgba(0,242,254,0.05) 100%)', border: '1px solid rgba(79,172,254,0.3)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.8rem', color: '#fff', textShadow: '0 0 10px rgba(79,172,254,0.5)' }}>#{i+1} {pick.ticker}</h2>
                    <span style={{ display: 'inline-block', padding: '4px 10px', background: 'rgba(245,158,11,0.2)', color: '#f59e0b', borderRadius: '4px', fontSize: '0.85rem', marginBottom: '1rem' }}>{pick.setup_type}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ margin: '0', fontSize: '0.9rem', color: '#94a3b8' }}>Entry Zone</p>
                    <p style={{ margin: '0 0 10px 0', fontSize: '1.2rem', color: '#fff', fontWeight: 'bold' }}>{pick.entry_price}</p>
                    <p style={{ margin: '0', fontSize: '0.9rem', color: '#94a3b8' }}>Stop Loss</p>
                    <p style={{ margin: '0', fontSize: '1.2rem', color: '#ef4444', fontWeight: 'bold' }}>{pick.stop_loss}</p>
                  </div>
                </div>
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem', marginTop: '1rem' }}>
                  <p style={{ margin: '0', color: '#e2e8f0', lineHeight: '1.5' }}><strong>Reasoning:</strong> {pick.reasoning}</p>
                  <p style={{ margin: '1rem 0 1rem 0', color: '#10b981', fontWeight: 'bold' }}>🎯 Target: {pick.profit_target}</p>
                  
                  {pick.health && (
                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', borderLeft: `3px solid ${pick.health.momentum_color}` }}>
                      <h4 style={{ margin: '0 0 10px 0', color: '#94a3b8', fontSize: '0.9rem', textTransform: 'uppercase' }}>Technical Health Card</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                        <div>
                           <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Structural Stage</span>
                           <div style={{ color: pick.health.stage.includes('Stage 2') ? '#10b981' : '#e2e8f0', fontWeight: 'bold', fontSize: '0.9rem' }}>{pick.health.stage}</div>
                        </div>
                        <div>
                           <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Momentum</span>
                           <div style={{ color: pick.health.momentum_color, fontWeight: 'bold', fontSize: '0.9rem' }}>{pick.health.momentum_text}</div>
                        </div>
                        <div>
                           <span style={{ fontSize: '0.75rem', color: '#64748b' }}>RSI</span>
                           <div style={{ color: pick.health.rsi > 70 ? '#ef4444' : pick.health.rsi < 30 ? '#10b981' : '#e2e8f0', fontWeight: 'bold', fontSize: '0.9rem' }}>{pick.health.rsi}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Market Health Dashboard Tab */}
      {activeTab === 'health' && marketHealth && (
        <div style={{ marginTop: '2rem' }}>
          {/* Master Health Card */}
          <div className="glass-card" style={{ padding: '2rem', marginBottom: '2rem', textAlign: 'center', borderTop: `5px solid ${marketHealth.current_health.score_value >= 60 ? '#10b981' : marketHealth.current_health.score_value <= 40 ? '#ef4444' : '#f59e0b'}` }}>
            <h2 style={{ fontSize: '1.5rem', margin: '0', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '2px' }}>Aggregate Market Health Score</h2>
            <h1 style={{ fontSize: '4rem', margin: '0.5rem 0 0 0', color: marketHealth.current_health.score_value >= 60 ? '#10b981' : marketHealth.current_health.score_value <= 40 ? '#ef4444' : '#f59e0b' }}>
              {marketHealth.current_health.score_value} <span style={{fontSize: '2rem', color: '#64748b'}}>/ 100</span>
            </h1>
            <h3 style={{ fontSize: '1.2rem', margin: '0.5rem 0 2rem 0', color: '#fff' }}>Status: {marketHealth.current_health.score_label}</h3>
            
            <div style={{ background: 'rgba(15,23,42,0.5)', padding: '1.5rem', borderRadius: '12px', textAlign: 'left', borderLeft: '4px solid #3b82f6' }}>
              <h4 style={{ margin: '0 0 1rem 0', color: '#60a5fa', fontSize: '1.1rem' }}>Council Summary Briefing</h4>
              {marketHealth.current_health.summary_text ? (
                 marketHealth.current_health.summary_text.split('\\n').map((line, i) => (
                    <p key={i} style={{ margin: '0.5rem 0', color: '#e2e8f0', lineHeight: '1.5' }}>
                      {line.replace(/\\*\\*/g, '')}
                    </p>
                 ))
              ) : null}
            </div>

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
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>
            
            {/* Global Gradients */}
            <svg style={{ height: 0, position: 'absolute' }}>
              <defs>
                <linearGradient id="colorSpy" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#94a3b8" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorBreadth" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
            </svg>

            {/* Chart 1: Composite Market Health Oscillator */}
            <div className="glass-card" style={{ padding: '0', overflow: 'hidden', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
              <div style={{ padding: '2rem 2rem 0 2rem' }}>
                <h3 style={{ marginTop: 0, marginBottom: '0.5rem', color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{width: 12, height: 12, borderRadius: '50%', background: '#f59e0b', boxShadow: '0 0 10px #f59e0b'}}></span>
                  Master Composite Health Oscillator (0-100)
                </h3>
                <div style={{ background: 'rgba(245, 158, 11, 0.05)', borderLeft: '3px solid #f59e0b', padding: '1rem', marginBottom: '1.5rem', borderRadius: '4px', fontSize: '0.95rem', color: '#fde68a' }}>
                  <strong>ALGO INSIGHT:</strong> {marketHealth.current_health.chart_observations.oscillator}
                </div>
              </div>
              <div style={{ height: '350px', paddingRight: '2rem' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={marketHealth.historical_data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="date" stroke="#64748b" tick={{fill: '#64748b'}} tickFormatter={(str) => str.substring(5)} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="left" stroke="#64748b" tick={{fill: '#64748b'}} domain={['auto', 'auto']} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="right" orientation="right" stroke="#f59e0b" tick={{fill: '#f59e0b'}} domain={[0, 100]} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: 'rgba(9, 9, 11, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }} />
                    <Legend iconType="circle" wrapperStyle={{ paddingTop: '10px' }} />
                    <ReferenceLine y={50} yAxisId="right" stroke="#64748b" strokeDasharray="3 3" />
                    <Area yAxisId="left" type="monotone" dataKey="spy" name="SPY Price" stroke="#94a3b8" fillOpacity={1} fill="url(#colorSpy)" strokeWidth={2} />
                    <Line yAxisId="right" type="monotone" dataKey="health_oscillator" name="Composite Health" stroke="#f59e0b" strokeWidth={4} dot={false} style={{ filter: 'drop-shadow(0px 0px 6px rgba(245, 158, 11, 0.8))' }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Grid for Dual Charts */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
              
              {/* Chart 2: McClellan Oscillator */}
              <div className="glass-card" style={{ padding: '2rem', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                <h3 style={{ marginTop: 0, marginBottom: '0.5rem', color: '#f1f5f9' }}>McClellan Oscillator (MCO)</h3>
                <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '0.8rem', marginBottom: '1.5rem', borderRadius: '4px', fontSize: '0.85rem', color: '#cbd5e1' }}>
                  {marketHealth.current_health.chart_observations.mco}
                </div>
                <div style={{ height: '250px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={marketHealth.historical_data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="date" stroke="#64748b" tick={{fill: '#64748b', fontSize: 12}} tickFormatter={(str) => str.substring(5)} axisLine={false} tickLine={false} />
                      <YAxis stroke="#64748b" tick={{fill: '#64748b', fontSize: 12}} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: 'rgba(9, 9, 11, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
                      <ReferenceLine y={0} stroke="#475569" strokeWidth={2} />
                      <ReferenceLine y={50} stroke="#ef4444" strokeDasharray="3 3" label={{ position: 'insideTopLeft', value: 'OB', fill: '#ef4444', fontSize: 10 }} />
                      <ReferenceLine y={-50} stroke="#10b981" strokeDasharray="3 3" label={{ position: 'insideBottomLeft', value: 'OS', fill: '#10b981', fontSize: 10 }} />
                      <Bar dataKey="mco" name="MCO" radius={[2, 2, 0, 0]}>
                        {marketHealth.historical_data.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.mco > 0 ? '#10b981' : '#ef4444'} fillOpacity={0.8} />
                        ))}
                      </Bar>
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Chart 3: % > 50 SMA */}
              <div className="glass-card" style={{ padding: '2rem', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                <h3 style={{ marginTop: 0, marginBottom: '0.5rem', color: '#f1f5f9' }}>Market Breadth (% Above 50 SMA)</h3>
                <div style={{ background: 'rgba(59, 130, 246, 0.05)', padding: '0.8rem', marginBottom: '1.5rem', borderRadius: '4px', fontSize: '0.85rem', color: '#93c5fd' }}>
                  {marketHealth.current_health.chart_observations.p50}
                </div>
                <div style={{ height: '250px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={marketHealth.historical_data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="date" stroke="#64748b" tick={{fill: '#64748b', fontSize: 12}} tickFormatter={(str) => str.substring(5)} axisLine={false} tickLine={false} />
                      <YAxis stroke="#64748b" tick={{fill: '#64748b', fontSize: 12}} domain={[0, 100]} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: 'rgba(9, 9, 11, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
                      <ReferenceLine y={50} stroke="#475569" strokeDasharray="3 3" />
                      <Area type="monotone" dataKey="pct_above_50" name="% > 50 SMA" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorBreadth)" style={{ filter: 'drop-shadow(0px 0px 4px rgba(59, 130, 246, 0.4))' }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Grid for Secondary Indicators */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
              
              {/* Chart 4: New Highs vs New Lows */}
              <div className="glass-card" style={{ padding: '2rem' }}>
                <h3 style={{ marginTop: 0, marginBottom: '0.5rem', color: '#f1f5f9' }}>New Highs vs New Lows</h3>
                <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '0.8rem', marginBottom: '1.5rem', borderRadius: '4px', fontSize: '0.85rem', color: '#cbd5e1' }}>
                  {marketHealth.current_health.chart_observations.nhnl}
                </div>
                <div style={{ height: '200px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={marketHealth.historical_data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="date" stroke="#64748b" tick={{fill: '#64748b', fontSize: 12}} tickFormatter={(str) => str.substring(5)} axisLine={false} tickLine={false} />
                      <YAxis stroke="#64748b" tick={{fill: '#64748b', fontSize: 12}} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: 'rgba(9, 9, 11, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
                      <Bar dataKey="new_highs" name="New Highs" fill="#10b981" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="new_lows" name="New Lows" fill="#ef4444" radius={[2, 2, 0, 0]} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Chart 5: Volatility Curve (CBOE Put/Call Proxy) */}
              <div className="glass-card" style={{ padding: '2rem', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                <h3 style={{ marginTop: 0, marginBottom: '0.5rem', color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{width: 10, height: 10, borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 8px #ef4444'}}></span>
                  CBOE Volatility Skew (Put/Call Institutional Proxy)
                </h3>
                <div style={{ background: 'rgba(239, 68, 68, 0.05)', borderLeft: '3px solid #ef4444', padding: '0.8rem', marginBottom: '1.5rem', borderRadius: '4px', fontSize: '0.85rem', color: '#fca5a5' }}>
                  <strong>ALGO INSIGHT:</strong> {marketHealth.current_health.chart_observations.vix_curve}
                </div>
                <div style={{ height: '200px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={marketHealth.historical_data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="date" stroke="#64748b" tick={{fill: '#64748b', fontSize: 12}} tickFormatter={(str) => str.substring(5)} axisLine={false} tickLine={false} />
                      <YAxis stroke="#64748b" tick={{fill: '#64748b', fontSize: 12}} domain={['auto', 'auto']} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: 'rgba(9, 9, 11, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                      <Line type="monotone" dataKey="vix" name="VIX (Spot Fear)" stroke="#ef4444" strokeWidth={3} dot={false} style={{ filter: 'drop-shadow(0px 0px 4px rgba(239, 68, 68, 0.5))' }} />
                      <Line type="monotone" dataKey="vix3m" name="VIX3M (3-Month)" stroke="#3b82f6" strokeWidth={2} dot={false} strokeDasharray="5 5" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>

            </div>

            {/* Grid for Bottom Indicators */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
              
              {/* Chart 6: Credit Spreads */}
              <div className="glass-card" style={{ padding: '2rem' }}>
                <h3 style={{ marginTop: 0, marginBottom: '0.5rem', color: '#f1f5f9' }}>Institutional Credit Spreads (HYG/IEF)</h3>
                <div style={{ background: 'rgba(245, 158, 11, 0.05)', borderLeft: '3px solid #f59e0b', padding: '0.8rem', marginBottom: '1.5rem', borderRadius: '4px', fontSize: '0.85rem', color: '#fcd34d' }}>
                  {marketHealth.current_health.chart_observations.credit}
                </div>
                <div style={{ height: '200px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={marketHealth.historical_data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="date" stroke="#64748b" tick={{fill: '#64748b', fontSize: 12}} tickFormatter={(str) => str.substring(5)} axisLine={false} tickLine={false} />
                      <YAxis stroke="#64748b" tick={{fill: '#64748b', fontSize: 12}} domain={['auto', 'auto']} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: 'rgba(9, 9, 11, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
                      <Line type="monotone" dataKey="hyg_ratio" name="Risk-Appetite Ratio" stroke="#f59e0b" strokeWidth={3} dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Chart 7: Index Divergences */}
              <div className="glass-card" style={{ padding: '2rem' }}>
                <h3 style={{ marginTop: 0, marginBottom: '0.5rem', color: '#f1f5f9' }}>Sector & Size Divergences</h3>
                <div style={{ background: 'rgba(139, 92, 246, 0.05)', borderLeft: '3px solid #8b5cf6', padding: '0.8rem', marginBottom: '1.5rem', borderRadius: '4px', fontSize: '0.85rem', color: '#c4b5fd' }}>
                  {marketHealth.current_health.chart_observations.divergence}
                </div>
                <div style={{ height: '200px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={marketHealth.historical_data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="date" stroke="#64748b" tick={{fill: '#64748b', fontSize: 12}} tickFormatter={(str) => str.substring(5)} axisLine={false} tickLine={false} />
                      <YAxis yAxisId="left" stroke="#64748b" tick={{fill: '#64748b', fontSize: 12}} domain={['auto', 'auto']} axisLine={false} tickLine={false} />
                      <YAxis yAxisId="right" orientation="right" stroke="#8b5cf6" tick={{fill: '#8b5cf6', fontSize: 12}} domain={['auto', 'auto']} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: 'rgba(9, 9, 11, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                      <Line yAxisId="left" type="monotone" dataKey="spy_rsp_ratio" name="SPY/RSP (Mega-Cap)" stroke="#94a3b8" strokeWidth={2} dot={false} />
                      <Line yAxisId="right" type="monotone" dataKey="qqq_spy_ratio" name="QQQ/SPY (Tech)" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Grid for Macro Institutional Data (COT & T-Bill) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginTop: '2rem' }}>
              
              {/* Chart 8: Money Market Liquidity (13-Week T-Bill) */}
              <div className="glass-card" style={{ padding: '2rem' }}>
                <h3 style={{ marginTop: 0, marginBottom: '0.5rem', color: '#f1f5f9' }}>Money Market Liquidity (13-Week T-Bill)</h3>
                <div style={{ background: 'rgba(56, 189, 248, 0.05)', borderLeft: '3px solid #38bdf8', padding: '0.8rem', marginBottom: '1.5rem', borderRadius: '4px', fontSize: '0.85rem', color: '#bae6fd' }}>
                  {marketHealth.current_health.chart_observations.irx_liquidity}
                </div>
                <div style={{ height: '200px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={marketHealth.historical_data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="date" stroke="#64748b" tick={{fill: '#64748b', fontSize: 12}} tickFormatter={(str) => str.substring(5)} axisLine={false} tickLine={false} />
                      <YAxis stroke="#64748b" tick={{fill: '#64748b', fontSize: 12}} domain={['auto', 'auto']} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: 'rgba(9, 9, 11, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
                      <Line type="monotone" dataKey="irx" name="13-Week Yield (%)" stroke="#38bdf8" strokeWidth={3} dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Chart 9: CFTC COT S&P 500 Positioning */}
              <div className="glass-card" style={{ padding: '2rem' }}>
                <h3 style={{ marginTop: 0, marginBottom: '0.5rem', color: '#f1f5f9' }}>CFTC COT (Net Commercial Hedgers)</h3>
                <div style={{ background: 'rgba(236, 72, 153, 0.05)', borderLeft: '3px solid #ec4899', padding: '0.8rem', marginBottom: '1.5rem', borderRadius: '4px', fontSize: '0.85rem', color: '#fbcfe8' }}>
                  {marketHealth.current_health.chart_observations.cot}
                </div>
                <div style={{ height: '200px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={marketHealth.historical_data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="date" stroke="#64748b" tick={{fill: '#64748b', fontSize: 12}} tickFormatter={(str) => str.substring(5)} axisLine={false} tickLine={false} />
                      <YAxis stroke="#64748b" tick={{fill: '#64748b', fontSize: 12}} domain={['auto', 'auto']} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: 'rgba(9, 9, 11, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
                      <ReferenceLine y={0} stroke="#475569" strokeWidth={2} />
                      <Bar dataKey="cot_net" name="Net Positioning" radius={[2, 2, 0, 0]}>
                        {marketHealth.historical_data.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.cot_net > 0 ? '#10b981' : '#ef4444'} fillOpacity={0.8} />
                        ))}
                      </Bar>
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
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
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => { setIsTop5Isolated(false); setHiddenLines({}) }} className={`isolate-btn ${!isTop5Isolated && !hiddenLines['grid'] ? 'isolated' : ''}`}><Activity size={16} />All</button>
                  <button onClick={isolateTop5} className={`isolate-btn ${isTop5Isolated ? 'isolated' : ''}`}><Filter size={16} />Top 5</button>
                  <button onClick={() => setHiddenLines({ 'grid': true })} className={`isolate-btn ${hiddenLines['grid'] ? 'isolated' : ''}`}><ActivitySquare size={16} />Grid View (Separate)</button>
                </div>
              </div>
              
              {!hiddenLines['grid'] ? (
                <div style={{ position: 'relative' }}>
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
                        <XAxis type="number" dataKey="x" name="RS-Ratio" domain={['dataMin - 3', 'dataMax + 4']} stroke="rgba(255,255,255,0.5)" tick={{ fill: 'rgba(255,255,255,0.5)' }} />
                        <YAxis type="number" dataKey="y" name="RS-Momentum" domain={['dataMin - 3', 'dataMax + 4']} stroke="rgba(255,255,255,0.5)" tick={{ fill: 'rgba(255,255,255,0.5)' }} />
                        <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />
                        <Legend content={renderCustomLegend} verticalAlign="bottom" />
                        
                        {rrgData.map((sector, idx) => {
                          if (hiddenLines[sector.name]) return null;
                          const isHovered = hoveredSector === sector.name;
                          const isAnotherHovered = hoveredSector !== null && hoveredSector !== sector.name;
                          const color = COLORS[idx % COLORS.length];
                          
                          return (
                            <Scatter 
                              key={sector.name} name={sector.name} 
                              data={sector.trail.map((pt, i) => ({ ...pt, labelName: i === sector.trail.length - 1 ? sector.name : '' }))} 
                              fill={color}
                              line={{ type: "monotone", stroke: color, strokeWidth: isHovered ? 4 : 2 }}
                              opacity={isAnotherHovered ? 0.1 : 1} style={{ transition: 'all 0.3s ease', cursor: 'pointer' }}
                              onClick={() => setModalData(sector)}
                            >
                              <LabelList dataKey="labelName" position="right" offset={8} style={{ fill: 'white', fontSize: '13px', fontWeight: 'bold', textShadow: `0px 0px 4px ${color}, 0px 0px 8px black` }} />
                              {sector.trail.map((entry, index) => {
                                const isLast = index === sector.trail.length - 1;
                                return <Cell key={`cell-${index}`} fill={color} r={isLast ? (isHovered ? 12 : 8) : 0} opacity={isLast ? 1 : 0} />
                              })}
                            </Scatter>
                          )
                        })}
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginTop: '20px' }}>
                  {rrgData.map((sector, idx) => {
                    const color = COLORS[idx % COLORS.length];
                    return (
                      <div key={sector.name} className="stat-card" style={{ padding: '10px', height: '250px', cursor: 'pointer' }} onClick={() => setModalData(sector)}>
                        <h4 style={{ margin: '0 0 10px 0', textAlign: 'center', color: color }}>{sector.name}</h4>
                        <ResponsiveContainer width="100%" height="85%">
                          <ScatterChart margin={{ top: 5, right: 15, bottom: 5, left: 5 }}>
                            <ReferenceArea x1={100} y1={100} fill="rgba(16, 185, 129, 0.05)" /> 
                            <ReferenceArea x1={100} y2={100} fill="rgba(245, 158, 11, 0.05)" /> 
                            <ReferenceArea x2={100} y2={100} fill="rgba(239, 68, 68, 0.05)" /> 
                            <ReferenceArea x2={100} y1={100} fill="rgba(59, 130, 246, 0.05)" /> 
                            <ReferenceLine x={100} stroke="rgba(255,255,255,0.2)" strokeWidth={1} />
                            <ReferenceLine y={100} stroke="rgba(255,255,255,0.2)" strokeWidth={1} />
                            <XAxis type="number" dataKey="x" domain={['dataMin - 1', 'dataMax + 1']} hide />
                            <YAxis type="number" dataKey="y" domain={['dataMin - 1', 'dataMax + 1']} hide />
                            <Tooltip content={<CustomTooltip />} cursor={false} />
                            <Scatter 
                              name={sector.name} 
                              data={sector.trail} 
                              fill={color}
                              line={{ type: "monotone", stroke: color, strokeWidth: 2 }}
                            >
                              {sector.trail.map((entry, index) => {
                                const isLast = index === sector.trail.length - 1;
                                return <Cell key={`mini-cell-${index}`} fill={color} r={isLast ? 6 : 0} opacity={isLast ? 1 : 0} />
                              })}
                            </Scatter>
                          </ScatterChart>
                        </ResponsiveContainer>
                      </div>
                    )
                  })}
                </div>
              )}
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

          {/* Automated Money Flow Summary */}
          <div className="glass-card" style={{ marginTop: '20px' }}>
            <h2 style={{ textAlign: 'left', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fff' }}>
              <Zap color="#f59e0b" /> Automated Money Flow Summary ({timeframe})
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
              
              <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: '15px', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                <h3 style={{ color: '#10b981', marginTop: 0 }}>🟢 Fresh Money Inflow</h3>
                <p style={{ fontSize: '0.9rem', color: '#ccc', marginBottom: '10px' }}>Institutional capital is actively rotating INTO these sectors (Momentum is rising).</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {moneyFlow.freshMoney.map(sec => (
                    <span key={sec.name} style={{ background: '#10b981', color: '#000', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                      #{sec.rank} {sec.name} {sec.improving ? '📈' : '📉'}
                    </span>
                  ))}
                  {moneyFlow.freshMoney.length === 0 && <span style={{ color: '#888', fontSize: '0.9rem' }}>No sectors detected.</span>}
                </div>
              </div>

              <div style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', padding: '15px', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                <h3 style={{ color: '#f59e0b', marginTop: 0 }}>🟡 Profit Taking</h3>
                <p style={{ fontSize: '0.9rem', color: '#ccc', marginBottom: '10px' }}>Money is moving OUT of these previous leaders (Momentum is falling).</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {moneyFlow.profitTaking.map(sec => (
                    <span key={sec.name} style={{ background: '#f59e0b', color: '#000', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                      #{sec.rank} {sec.name} {sec.improving ? '📈' : '📉'}
                    </span>
                  ))}
                  {moneyFlow.profitTaking.length === 0 && <span style={{ color: '#888', fontSize: '0.9rem' }}>No sectors detected.</span>}
                </div>
              </div>

              <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '15px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                <h3 style={{ color: '#ef4444', marginTop: 0 }}>🔴 Dead Money</h3>
                <p style={{ fontSize: '0.9rem', color: '#ccc', marginBottom: '10px' }}>Sectors trapped in structural downtrends (Lagging quadrant).</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {moneyFlow.deadMoney.map(sec => (
                    <span key={sec.name} style={{ background: '#ef4444', color: '#fff', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                      #{sec.rank} {sec.name} {sec.improving ? '📈' : '📉'}
                    </span>
                  ))}
                  {moneyFlow.deadMoney.length === 0 && <span style={{ color: '#888', fontSize: '0.9rem' }}>No sectors detected.</span>}
                </div>
              </div>

            </div>
          </div>
        </>
      )}

      {/* Sector Components Modal */}
      {modalData && (
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

      {/* Charting Engine (Center Pane) */}
      {activeTab === 'chart' && (
        <div style={{ width: '100%', height: 'calc(100vh - 120px)' }}>
            {expertTickerData ? (
               <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <div>
                      <h1 style={{ margin: 0, fontSize: '2.5rem', color: '#fff' }}>{expertTickerData.ticker}</h1>
                      <h3 style={{ margin: 0, color: '#94a3b8', fontSize: '1rem' }}>{expertTickerData.name}</h3>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <div style={{ background: 'rgba(16, 185, 129, 0.2)', border: '1px solid #10b981', padding: '8px 16px', borderRadius: '4px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <Activity size={16} /> Pro Terminal: Drawing & Dark Pools
                      </div>
                    </div>
                 </div>
                 <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
                   <div style={{ height: '100%', position: 'relative' }}>
                     <UnifiedPlotlyChart ticker={expertTickerData.ticker} />
                   </div>
                   <div style={{ overflowY: 'auto', paddingRight: '10px' }}>
                     {expertTickerData.score !== null && (
                       <div className="glass-card" style={{ marginBottom: '1.5rem', textAlign: 'center', padding: '1.5rem', background: 'rgba(15, 23, 42, 0.6)' }}>
                         <span style={{ color: '#94a3b8', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '2px' }}>Master Algorithm Score</span>
                         <div style={{ fontSize: '4rem', fontWeight: 'bold', color: expertTickerData.score >= 70 ? '#10b981' : expertTickerData.score >= 40 ? '#f59e0b' : '#ef4444', lineHeight: '1', margin: '0.5rem 0' }}>
                           {expertTickerData.score}
                         </div>
                       </div>
                     )}

                     {expertTickerData.agent_insight && (
                       <div className="neo-panel" style={{ marginBottom: '1.5rem', borderLeft: '4px solid #a855f7', background: 'rgba(168, 85, 247, 0.05)' }}>
                         <h3 style={{ margin: '0 0 0.5rem 0', color: '#a855f7', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                           <Activity size={18} /> AI Agent Observation
                         </h3>
                         <p style={{ margin: 0, color: '#e2e8f0', fontSize: '0.95rem', lineHeight: '1.5' }}>
                           {expertTickerData.agent_insight}
                         </p>
                       </div>
                     )}


                     <div className="neo-panel" style={{ marginBottom: '1.5rem' }}>
                       <h3 style={{ margin: '0 0 1rem 0', color: '#4facfe', borderBottom: '1px solid #27272a', paddingBottom: '0.5rem' }}>Technical Health</h3>
                       <div style={{ marginBottom: '1rem' }}>
                         <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.85rem' }}>Stan Weinstein Phase</p>
                         <strong style={{ fontSize: '1.1rem', color: expertTickerData.technicals.stage.includes('Stage 2') ? '#10b981' : expertTickerData.technicals.stage.includes('Stage 4') ? '#ef4444' : '#f59e0b' }}>
                           {expertTickerData.technicals.stage}
                         </strong>
                       </div>
                       <div style={{ marginBottom: '1rem' }}>
                         <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.85rem' }}>MACD / RSI Trajectory</p>
                         <strong style={{ fontSize: '1rem', color: expertTickerData.technicals.momentum_color === 'bullish' ? '#10b981' : expertTickerData.technicals.momentum_color === 'bearish' ? '#ef4444' : '#f59e0b' }}>
                           {expertTickerData.technicals.momentum_text}
                         </strong>
                       </div>
                       <div>
                         <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.85rem' }}>Relative Strength vs SPY (1 Mo)</p>
                         <strong style={{ fontSize: '1.1rem', color: expertTickerData.technicals.rs_spy_1mo > 0 ? '#10b981' : '#ef4444' }}>
                           {expertTickerData.technicals.rs_spy_1mo > 0 ? '+' : ''}{expertTickerData.technicals.rs_spy_1mo.toFixed(2)}%
                         </strong>
                       </div>
                     </div>

                     {expertTickerData.trade_plan && (
                       <div className="neo-panel" style={{ marginBottom: '1.5rem', borderLeft: '4px solid #10b981' }}>
                         <h3 style={{ margin: '0 0 1rem 0', color: '#10b981', borderBottom: '1px solid #27272a', paddingBottom: '0.5rem' }}>Algorithmic Trade Plan</h3>
                         <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                           <div>
                             <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.85rem' }}>Ideal Entry</p>
                             <strong style={{ fontSize: '1.1rem', color: '#fff' }}>${expertTickerData.trade_plan.entry.toFixed(2)}</strong>
                           </div>
                           <div>
                             <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.85rem' }}>Target (3 ATR)</p>
                             <strong style={{ fontSize: '1.1rem', color: '#10b981' }}>${expertTickerData.trade_plan.profit_target.toFixed(2)}</strong>
                           </div>
                           <div>
                             <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.85rem' }}>Stop Loss (1.5 ATR)</p>
                             <strong style={{ fontSize: '1.1rem', color: '#ef4444' }}>${expertTickerData.trade_plan.stop_loss.toFixed(2)}</strong>
                           </div>
                           <div>
                             <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.85rem' }}>Risk %</p>
                             <strong style={{ fontSize: '1.1rem', color: '#f59e0b' }}>{expertTickerData.trade_plan.risk_pct.toFixed(1)}%</strong>
                           </div>
                         </div>
                       </div>
                     )}

                     {expertTickerData.fundamentals && (
                       <div className="neo-panel">
                         <h3 style={{ margin: '0 0 1rem 0', color: '#f59e0b', borderBottom: '1px solid #27272a', paddingBottom: '0.5rem' }}>Fundamental Health</h3>
                         <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                           <div>
                             <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.85rem' }}>Rev Growth</p>
                             <strong style={{ fontSize: '1rem', color: expertTickerData.fundamentals.revenue_growth > 20 ? '#10b981' : '#fff' }}>
                               {expertTickerData.fundamentals.revenue_growth.toFixed(1)}%
                             </strong>
                           </div>
                           <div>
                             <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.85rem' }}>Profit Margin</p>
                             <strong style={{ fontSize: '1rem', color: expertTickerData.fundamentals.profit_margin > 15 ? '#10b981' : '#fff' }}>
                               {expertTickerData.fundamentals.profit_margin.toFixed(1)}%
                             </strong>
                           </div>
                           <div>
                             <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.85rem' }}>ROE</p>
                             <strong style={{ fontSize: '1rem', color: expertTickerData.fundamentals.roe > 15 ? '#10b981' : '#fff' }}>
                               {expertTickerData.fundamentals.roe.toFixed(1)}%
                             </strong>
                           </div>
                           <div>
                             <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.85rem' }}>PEG Ratio</p>
                             <strong style={{ fontSize: '1rem', color: (expertTickerData.fundamentals.peg_ratio > 0 && expertTickerData.fundamentals.peg_ratio < 1.5) ? '#10b981' : expertTickerData.fundamentals.peg_ratio > 3 ? '#ef4444' : '#fff' }}>
                               {expertTickerData.fundamentals.peg_ratio ? expertTickerData.fundamentals.peg_ratio.toFixed(2) : 'N/A'}
                             </strong>
                           </div>
                         </div>
                       </div>
                     )}

                     {expertTickerData.news && expertTickerData.news.length > 0 && (
                       <div className="neo-panel" style={{ marginTop: '1.5rem' }}>
                         <h3 style={{ margin: '0 0 1rem 0', color: '#ec4899', borderBottom: '1px solid #27272a', paddingBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                           <Radio size={18} className="pulse" /> Live News Feed
                         </h3>
                         <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                           {expertTickerData.news.map((headline, i) => (
                             <li key={i} style={{ marginBottom: '1rem', color: '#94a3b8', fontSize: '0.9rem', lineHeight: '1.4', borderBottom: i !== expertTickerData.news.length - 1 ? '1px dashed rgba(255,255,255,0.1)' : 'none', paddingBottom: i !== expertTickerData.news.length - 1 ? '1rem' : 0 }}>
                               <span style={{ color: '#ec4899', marginRight: '5px' }}>▶</span> {headline}
                             </li>
                           ))}
                         </ul>
                       </div>
                     )}
                   </div>
                 </div>
               </div>
            ) : (
               <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#4facfe', width: '100%' }} className="glass-card">
                 <Search size={48} style={{marginBottom: '1rem', opacity: 0.5}} />
                 <h3>No Ticker Selected</h3>
                 <p style={{color: '#94a3b8'}}>Click on an alert in the Live Feed or use the search bar to load a chart.</p>
               </div>
            )}
        </div>
      )}

      {activeTab === 'intraday' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>
          <div className="glass-card" style={{ padding: '2rem', borderTop: '5px solid #ec4899' }}>
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
                {intradayData.map((alert, i) => (
                  <div key={i} className="glass-card" style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: '4px solid #10b981', cursor: 'pointer', transition: 'all 0.2s' }} onClick={() => fetchTickerData(alert.ticker)} onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.01)'} onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}>
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
                      <div style={{ marginBottom: '0.5rem' }}>
                        <span style={{ color: '#94a3b8', fontSize: '0.8rem', marginRight: '10px' }}>Call/Put Vol Ratio</span>
                        <strong style={{ color: alert.call_put_ratio > 2 ? '#10b981' : '#ec4899' }}>{alert.call_put_ratio.toFixed(2)}x</strong>
                      </div>
                      <div style={{ marginBottom: '0.5rem', display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                        <span style={{ color: '#94a3b8', fontSize: '0.8rem', marginRight: '10px' }}>VWAP Trend Velocity</span>
                        <strong style={{ background: alert.vwap_slope > 0.1 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)', color: alert.vwap_slope > 0.1 ? '#10b981' : '#ef4444', padding: '2px 8px', borderRadius: '4px', fontSize: '0.9rem' }}>
                          {alert.vwap_slope !== undefined ? `${alert.vwap_slope > 0 ? '+' : ''}${alert.vwap_slope.toFixed(2)}%` : 'N/A'}
                        </strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                        <span style={{ color: '#94a3b8', fontSize: '0.8rem', marginRight: '10px' }}>Institutional Block HVN</span>
                        <strong style={{ color: '#3b82f6', borderBottom: '1px dashed #3b82f6' }}>
                          ${alert.hvn_proxy !== undefined ? alert.hvn_proxy.toFixed(2) : 'N/A'}
                        </strong>
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

      {/* Morning Briefing Tab */}
      {activeTab === 'briefing' && briefingData && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>
          <div className="glass-card" style={{ padding: '2rem', borderTop: '5px solid #DFFF00' }}>
            <h2 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#DFFF00' }}>
              <Sun size={24} /> Daily Morning Briefing
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '1rem', marginBottom: '2rem' }}>
              Your pre-market breakdown of the top gap-up/down movers and macro catalysts.
            </p>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
              <div>
                <h3 style={{ color: '#f59e0b', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>Top Pre-Market Movers</h3>
                {briefingData.top_movers && briefingData.top_movers.map((mover, i) => (
                  <div key={i} style={{ padding: '1rem', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', marginBottom: '1rem', borderLeft: `4px solid ${mover.change && mover.change.startsWith('+') ? '#10b981' : '#ef4444'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <strong style={{ fontSize: '1.2rem', color: '#fff' }}>{mover.ticker}</strong>
                      <strong style={{ fontSize: '1.1rem', color: mover.change && mover.change.startsWith('+') ? '#10b981' : '#ef4444' }}>{mover.change}</strong>
                    </div>
                    <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.9rem', marginBottom: '10px' }}>{mover.reason}</p>
                    <button onClick={() => fetchTickerData(mover.ticker)} style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Search size={14} /> Analyze Setup
                    </button>
                  </div>
                ))}
              </div>
              <div>
                <h3 style={{ color: '#4facfe', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>Macro Catalysts (SPY)</h3>
                {briefingData.macro_news && briefingData.macro_news.map((news, i) => (
                  <div key={i} style={{ padding: '1rem', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', marginBottom: '1rem' }}>
                    <p style={{ margin: 0, color: '#e2e8f0', fontSize: '0.95rem' }}>{news}</p>
                  </div>
                ))}
                
                <h3 style={{ color: '#ec4899', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem', marginTop: '2rem' }}>Big Tech Earnings (QQQ)</h3>
                {briefingData.earnings && briefingData.earnings.map((news, i) => (
                  <div key={i} style={{ padding: '1rem', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', marginBottom: '1rem' }}>
                    <p style={{ margin: 0, color: '#e2e8f0', fontSize: '0.95rem' }}>{news}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dedicated Ask AI Full-Screen Tab */}
      {activeTab === 'ask_ai' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem', height: '80vh' }}>
          <div className="neo-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '2rem', background: 'rgba(15, 23, 42, 0.8)', borderTop: '5px solid #8b5cf6' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem' }}>
              <div>
                <h2 style={{ margin: 0, color: '#8b5cf6', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Bot size={28} /> Full-Screen Live Agent Feed
                </h2>
                <p style={{ margin: '0.5rem 0 0 0', color: '#94a3b8', fontSize: '0.9rem' }}>Chat directly with autonomous quant agents and monitor live market sweeps.</p>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => setAgentPersona('quant')} style={{ padding: '8px 16px', fontSize: '0.9rem', borderRadius: '4px', background: agentPersona === 'quant' ? '#8b5cf6' : 'transparent', color: agentPersona === 'quant' ? '#fff' : '#94a3b8', border: '1px solid #8b5cf6', cursor: 'pointer' }}>Quant Agent</button>
                <button onClick={() => setAgentPersona('options')} style={{ padding: '8px 16px', fontSize: '0.9rem', borderRadius: '4px', background: agentPersona === 'options' ? '#ec4899' : 'transparent', color: agentPersona === 'options' ? '#fff' : '#94a3b8', border: '1px solid #ec4899', cursor: 'pointer' }}>Options Agent</button>
                <button onClick={() => setAgentPersona('macro')} style={{ padding: '8px 16px', fontSize: '0.9rem', borderRadius: '4px', background: agentPersona === 'macro' ? '#10b981' : 'transparent', color: agentPersona === 'macro' ? '#fff' : '#94a3b8', border: '1px solid #10b981', cursor: 'pointer' }}>Macro Agent</button>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '15px', paddingRight: '10px' }}>
              {chatHistory.filter(msg => !msg.isBroadcast).length === 0 && (
                <div style={{ color: '#94a3b8', fontSize: '1rem', textAlign: 'center', marginTop: 'auto', marginBottom: 'auto' }}>
                  <Bot size={48} style={{ opacity: 0.5, marginBottom: '1rem' }} />
                  <p style={{ margin: 0 }}>Waiting for questions... Ask the AI anything about technicals, fundamentals, options flow, or SEC filings!</p>
                </div>
              )}
              
              {chatHistory.filter(msg => !msg.isBroadcast).map((msg, idx) => (
                <div key={idx} style={{ alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', background: msg.role === 'user' ? 'rgba(79, 172, 254, 0.2)' : msg.isBroadcast ? `rgba(${msg.color === '#10b981' ? '16, 185, 129' : msg.color === '#ef4444' ? '239, 68, 68' : '139, 92, 246'}, 0.1)` : 'rgba(255,255,255,0.05)', border: `1px solid ${msg.role === 'user' ? '#4facfe' : msg.isBroadcast ? msg.color : 'rgba(255,255,255,0.1)'}`, padding: '12px 16px', borderRadius: '8px', maxWidth: '80%' }}>
                  <p style={{ margin: 0, fontSize: '1rem', color: msg.role === 'user' ? '#fff' : '#e2e8f0', lineHeight: '1.5' }}>
                    {msg.role === 'user' ? null : (
                      <strong style={{ color: msg.isBroadcast ? msg.color : '#8b5cf6', display: 'block', marginBottom: '6px', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
                        {msg.isBroadcast ? msg.council : `${agentPersona} Agent`}
                      </strong>
                    )}
                    {msg.text}
                  </p>
                  {msg.payload ? (
                    <button 
                      onClick={() => { setBriefingData(msg.payload); setActiveTab('briefing'); }}
                      style={{ marginTop: '12px', padding: '8px 16px', background: '#DFFF00', color: '#000', border: 'none', borderRadius: '4px', fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold' }}
                    >
                      <Maximize size={16} /> Expand Morning Briefing
                    </button>
                  ) : (
                    msg.isBroadcast && msg.ticker && msg.ticker !== 'BRIEFING' && (
                      <button 
                        onClick={() => fetchTickerData(msg.ticker)}
                        style={{ marginTop: '12px', padding: '6px 16px', background: 'transparent', color: msg.color, border: `1px solid ${msg.color}`, borderRadius: '4px', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold' }}
                      >
                        <Search size={14} /> Analyze {msg.ticker}
                      </button>
                    )
                  )}
                </div>
              ))}
              
              {isChatLoading && (
                <div style={{ alignSelf: 'flex-start', background: 'rgba(255,255,255,0.05)', padding: '12px 16px', borderRadius: '8px' }}>
                  <Loader size={24} className="spin" color="#8b5cf6" />
                </div>
              )}
            </div>

            <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '12px' }}>
              <input 
                type="text" 
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask the AI Agents about any ticker, macro event, or strategy..."
                style={{ flex: 1, background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', padding: '12px 16px', borderRadius: '6px', outline: 'none', fontSize: '1rem' }}
              />
              <button type="submit" disabled={isChatLoading || !chatInput.trim()} style={{ background: '#8b5cf6', color: '#fff', border: 'none', borderRadius: '6px', padding: '12px 24px', cursor: (isChatLoading || !chatInput.trim()) ? 'not-allowed' : 'pointer', opacity: (isChatLoading || !chatInput.trim()) ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '1rem', fontWeight: 'bold' }}>
                <Send size={18} /> Send
              </button>
            </form>
          </div>
        </div>
      )}
      
      </div> {/* End main-content */}

      {/* Static Right Pane (Live Agents & Ask AI) */}
      <div className="right-pane" style={{ padding: '1.5rem' }}>
        
        {/* Live Agent / Sweeps Feed - ALWAYS VISIBLE */}
        <div className="neo-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '1rem', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>
            <h3 style={{ margin: 0, color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem' }}>
              <Radio size={18} className="pulse" /> Live Market Updates
            </h3>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '10px', paddingRight: '5px' }}>
            {chatHistory.filter(m => m.isBroadcast).length === 0 && (
              <div style={{ color: '#94a3b8', fontSize: '0.85rem', textAlign: 'center', marginTop: 'auto', marginBottom: 'auto' }}>
                <Activity size={32} style={{ opacity: 0.5, marginBottom: '0.5rem' }} />
                <p style={{ margin: 0 }}>Waiting for live agent broadcasts...</p>
              </div>
            )}
            
            {chatHistory.filter(m => m.isBroadcast).map((msg, idx) => (
              <div key={idx} style={{ alignSelf: 'flex-start', background: `rgba(${msg.color === '#10b981' ? '16, 185, 129' : msg.color === '#ef4444' ? '239, 68, 68' : '139, 92, 246'}, 0.1)`, border: `1px solid ${msg.color}`, padding: '8px 12px', borderRadius: '8px', width: '100%' }}>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#e2e8f0', lineHeight: '1.4' }}>
                  <strong style={{ color: msg.color, display: 'block', marginBottom: '4px', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                    {msg.council}
                  </strong>
                  {msg.text}
                </p>
                {msg.payload ? (
                  <button 
                    onClick={() => { setBriefingData(msg.payload); setActiveTab('briefing'); }}
                    style={{ marginTop: '8px', padding: '6px 12px', background: '#DFFF00', color: '#000', border: 'none', borderRadius: '4px', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'bold', width: '100%', justifyContent: 'center' }}
                  >
                    <Maximize size={14} /> Expand Morning Briefing
                  </button>
                ) : (
                  msg.ticker && msg.ticker !== 'BRIEFING' && (
                    <button 
                      onClick={() => fetchTickerData(msg.ticker)}
                      style={{ marginTop: '8px', padding: '4px 12px', background: 'transparent', color: msg.color, border: `1px solid ${msg.color}`, borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'bold' }}
                    >
                      <Search size={12} /> Analyze {msg.ticker}
                    </button>
                  )
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

    </div> {/* End app-layout */}
    </>
  )
}

export default App
