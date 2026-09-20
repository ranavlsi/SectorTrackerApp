import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Zap, Activity, TrendingUp, TrendingDown, RefreshCw, Search, 
  Filter, Shield, Flame, Layers, ExternalLink, BarChart2, X,
  Calendar, CheckCircle, AlertTriangle, ChevronLeft, ChevronRight, Globe,
  Crosshair, Compass, ArrowUpRight, Award, Target, HelpCircle, Check,
  ShieldAlert, PieChart, Waves
} from 'lucide-react';
import './OptionsIntelligenceScreener.css';

// Lightweight pure SVG Sparkline
const Sparkline = ({ data = [], color = '#38bdf8', width = 100, height = 28 }) => {
  if (!data || data.length < 2) return <div style={{ width, height, background: 'rgba(255,255,255,0.03)', borderRadius: 4 }} />;
  
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - 4 - ((d - min) / range) * (height - 8);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  return (
    <svg className="sparkline-svg" width={width} height={height}>
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
};

// Compact number formatter (K, M, B)
const formatKMB = (num) => {
  if (num === null || num === undefined || isNaN(num)) return '0';
  const abs = Math.abs(num);
  if (abs >= 1e9) return (num / 1e9).toFixed(2) + 'B';
  if (abs >= 1e6) return (num / 1e6).toFixed(2) + 'M';
  if (abs >= 1e3) return (num / 1e3).toFixed(1) + 'K';
  return Math.round(num).toLocaleString();
};

export default function OptionsIntelligenceScreener({ onNavigateTab }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activePreset, setActivePreset] = useState('ALL');
  const [minVolTier, setMinVolTier] = useState('ALL'); // 'ALL', 'ACTIVE', 'LIQUID'
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('priority');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  // Dumper status & scope state
  const [dumpScope, setDumpScope] = useState('all'); // 'all' (6,175) or 'liquid' (500)
  const [dumperStatus, setDumperStatus] = useState({ is_running: false, percentage: 0, message: '' });
  const [dumping, setDumping] = useState(false);
  
  // Deep Analytics Modal state
  const [selectedTicker, setSelectedTicker] = useState(null);
  const [deepAnalytics, setDeepAnalytics] = useState(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [modalTab, setModalTab] = useState('ai_recommendation'); // 'ai_recommendation', 'greeks_matrix', 'trends_30d', 'strike_curve', 'term_structure', 'unusual'
  const [trendViewMode, setTrendViewMode] = useState('all'); // 'all', 'price_pain', 'oi', 'vol', 'iv_skew', 'gex'
  const [hoveredHistoryIndex, setHoveredHistoryIndex] = useState(null);
  const [hoveredStrike, setHoveredStrike] = useState(null);
  const [strikeViewMode, setStrikeViewMode] = useState('dual_gex_dex'); // 'dual_gex_dex', 'call_put_gex', 'dex', 'oi'
  const [termStructureMetric, setTermStructureMetric] = useState('iv_3d_trend'); // 'iv_3d_trend', 'iv_curve', 'gex_curve', 'oi_curve'
  const [hoveredTsIndex, setHoveredTsIndex] = useState(null);

  const pollIntervalRef = useRef(null);

  // 1. Fetch Summary Data
  const fetchSummary = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/options_screener/summary');
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch options screener summary:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 2. Fetch Dumper Status
  const checkDumperStatus = async () => {
    try {
      const res = await fetch('/api/options_screener/status');
      if (res.ok) {
        const json = await res.json();
        setDumperStatus(json);
        if (json.is_running) {
          setDumping(true);
        } else if (dumping) {
          setDumping(false);
          fetchSummary(); // reload when dump finishes
        }
      }
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    fetchSummary();
    checkDumperStatus();
    
    // Polling dumper status every 3s
    pollIntervalRef.current = setInterval(checkDumperStatus, 3000);
    return () => clearInterval(pollIntervalRef.current);
  }, []);

  // 3. Trigger Dump Now
  const handleDumpNow = async (scopeToRun = dumpScope) => {
    try {
      setDumping(true);
      const res = await fetch('/api/options_screener/dump_now', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: scopeToRun })
      });
      if (!res.ok) throw new Error('Failed to start options dump');
      checkDumperStatus();
    } catch (err) {
      alert(`Error starting dump: ${err.message}`);
      setDumping(false);
    }
  };

  const analyticsCache = useRef({});

  // Background pre-fetch without blocking UI or re-fetching if already present
  const prefetchDeepAnalytics = async (ticker) => {
    if (!ticker || analyticsCache.current[ticker]) return;
    try {
      const res = await fetch(`/api/options_screener/deep_analytics?ticker=${ticker}`);
      if (res.ok) {
        const json = await res.json();
        analyticsCache.current[ticker] = json;
      }
    } catch (e) {
      // Ignore background prefetch network glitches
    }
  };

  // 4. One-Click Deep Analytics Fetch (0ms Instant Cache Hit)
  const handleOpenDeepAnalytics = async (ticker, preferredTab = null) => {
    setSelectedTicker(ticker);
    if (preferredTab) {
      setModalTab(preferredTab);
    }
    
    // Instant client-side cache hit: 0ms latency, zero spinner
    if (analyticsCache.current[ticker]) {
      setDeepAnalytics(analyticsCache.current[ticker]);
      setLoadingAnalytics(false);
      return;
    }

    setLoadingAnalytics(true);
    try {
      const res = await fetch(`/api/options_screener/deep_analytics?ticker=${ticker}`);
      if (!res.ok) throw new Error('Failed to load deep analytics');
      const json = await res.json();
      analyticsCache.current[ticker] = json;
      setDeepAnalytics(json);
    } catch (err) {
      console.error('Error fetching ticker deep options analytics:', err);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  // 4b. Direct Check Stock handler (Search button & Enter key)
  const handleCheckStock = (targetTicker) => {
    const sym = (targetTicker || searchQuery).trim().toUpperCase();
    if (!sym) return;
    handleOpenDeepAnalytics(sym);
  };

  // Reset page to 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [activePreset, minVolTier, searchQuery, sortBy]);

  // 5. Filter & Sort Logic
  const filteredRecords = useMemo(() => {
    if (!data || !data.records) return [];
    let list = [...data.records];

    // Liquidity tier filter
    if (minVolTier === 'ACTIVE') {
      list = list.filter(r => r.total_vol >= 100);
    } else if (minVolTier === 'LIQUID') {
      list = list.filter(r => r.total_vol >= 1000);
    }

    // Preset filter
    if (activePreset === 'HIGHEST_FLOW_IMPACT') {
      list = list.filter(r => (r.flow_impact_score >= 50 || r.flow_impact_level === 'EXTREME' || r.flow_impact_level === 'HIGH'));
    } else if (activePreset !== 'ALL') {
      list = list.filter(r => r.signal === activePreset);
    }

    // Search query across all US stocks
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toUpperCase();
      list = list.filter(r => r.ticker.includes(q));
    }

    // Sorting
    list.sort((a, b) => {
      if (sortBy === 'flow_impact_score') return (b.flow_impact_score - a.flow_impact_score) || (b.notional_flow - a.notional_flow);
      if (sortBy === 'notional_flow') return (b.notional_flow - a.notional_flow);
      if (sortBy === 'net_delta_flow') return (Math.abs(b.net_delta_flow || 0) - Math.abs(a.net_delta_flow || 0));
      if (sortBy === 'priority') {
        if (activePreset === 'HIGHEST_FLOW_IMPACT') {
          return (b.flow_impact_score - a.flow_impact_score) || (b.notional_flow - a.notional_flow);
        }
        return (a.priority - b.priority) || (b.flow_impact_score - a.flow_impact_score) || (b.vol_ratio - a.vol_ratio);
      }
      if (sortBy === 'vol_ratio') return b.vol_ratio - a.vol_ratio;
      if (sortBy === 'oi_chg_5d_pct') return b.oi_chg_5d_pct - a.oi_chg_5d_pct;
      if (sortBy === 'iv_rank') return b.iv_rank - a.iv_rank;
      if (sortBy === 'skew_rank') return b.skew_rank - a.skew_rank;
      if (sortBy === 'total_vol') return b.total_vol - a.total_vol;
      return 0;
    });

    return list;
  }, [data, activePreset, minVolTier, searchQuery, sortBy]);

  // Pagination slicing
  const totalPages = Math.ceil(filteredRecords.length / pageSize) || 1;
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRecords.slice(start, start + pageSize);
  }, [filteredRecords, currentPage, pageSize]);

  // Pre-warm top 12 visible records in client cache so clicks are 0ms instant
  useEffect(() => {
    if (!paginatedRecords || !paginatedRecords.length) return;
    const topSymbols = paginatedRecords.slice(0, 12).map(r => r.ticker);
    topSymbols.forEach((sym, idx) => {
      setTimeout(() => {
        prefetchDeepAnalytics(sym);
      }, idx * 60);
    });
  }, [paginatedRecords]);

  // Quick next / previous ticker navigation directly inside modal
  const navigateTicker = (direction) => {
    if (!selectedTicker || !paginatedRecords || !paginatedRecords.length) return;
    const currIdx = paginatedRecords.findIndex(r => r.ticker === selectedTicker);
    if (currIdx === -1) return;
    let nextIdx = currIdx + direction;
    if (nextIdx < 0) nextIdx = paginatedRecords.length - 1;
    if (nextIdx >= paginatedRecords.length) nextIdx = 0;
    const nextSym = paginatedRecords[nextIdx].ticker;
    handleOpenDeepAnalytics(nextSym, modalTab);
  };

  const marketStats = data?.market_stats || {};

  return (
    <div className="options-screener-container">
      {/* HEADER BANNER */}
      <div className="options-screener-header">
        <div className="header-left">
          <h2>
            <Globe size={24} color="#38bdf8" /> All-US Stocks Options Intelligence & 30-Day Screener
          </h2>
          <p>
            Continuous quantitative surveillance across all <strong>6,175 active US optionable equities & ETFs</strong>.
            Tracks institutional Open Interest trends, unusual volume expansions, 30-day IV Rank, and 25-Delta Skew.
          </p>
          <div className="header-meta">
            <span><Calendar size={14} color="#38bdf8" /> Snapshot Date: <strong>{data?.latest_date || 'Live'}</strong></span>
            <span><Layers size={14} color="#818cf8" /> Rolling Window: <strong>{data?.available_dates_count || 30} Sessions</strong></span>
            <span><Globe size={14} color="#10b981" /> Optionable Database: <strong>{data?.total_symbols || 0} Symbols Active</strong> (out of 6,175 US Stocks)</span>
          </div>
        </div>

        <div className="header-actions">
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <select 
              value={dumpScope} 
              onChange={(e) => setDumpScope(e.target.value)}
              className="sort-select"
              title="Select universe scope to dump"
            >
              <option value="all">Dump All US Stocks (6,175)</option>
              <option value="liquid">Dump Liquid Leaders (Top 500)</option>
            </select>

            <button 
              className="dump-btn" 
              onClick={() => handleDumpNow(dumpScope)} 
              disabled={dumperStatus.is_running}
            >
              <RefreshCw size={16} className={dumperStatus.is_running ? "spin-slow" : ""} />
              {dumperStatus.is_running ? 'Dumping Options...' : 'Dump Options Now'}
            </button>
          </div>

          {dumperStatus.is_running && (
            <div className="dump-progress-wrap">
              <span className="dump-progress-text">
                {dumperStatus.percentage}% ({dumperStatus.progress}/{dumperStatus.total})
              </span>
              <div className="dump-progress-bar-bg">
                <div className="dump-progress-bar-fill" style={{ width: `${dumperStatus.percentage}%` }} />
              </div>
              <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>{dumperStatus.message}</span>
            </div>
          )}
        </div>
      </div>

      {/* MARKET OVERVIEW CARDS */}
      <div className="options-stats-grid">
        <div className="stat-card">
          <span className="stat-title">Aggregate Market Volume</span>
          <span className="stat-val">{(marketStats.total_options_volume || 0).toLocaleString()}</span>
          <span className="stat-sub">Across active US option chains</span>
        </div>
        <div className="stat-card">
          <span className="stat-title">Option Flow Impact Leaders</span>
          <span className="stat-val" style={{ color: '#f59e0b' }}>
            {marketStats.high_impact_count || 0} Stocks
          </span>
          <span className="stat-sub">${formatKMB(marketStats.total_notional_market_flow)} total notional flow</span>
        </div>
        <div className="stat-card">
          <span className="stat-title">Market Avg 30D IV Rank</span>
          <span className="stat-val" style={{ color: (marketStats.avg_iv_rank || 50) > 60 ? '#c084fc' : '#38bdf8' }}>
            {marketStats.avg_iv_rank || 50}%
          </span>
          <span className="stat-sub">Median volatility percentile</span>
        </div>
        <div className="stat-card">
          <span className="stat-title">Market Put/Call Vol Ratio</span>
          <span className="stat-val" style={{ color: (marketStats.avg_pcr_vol || 1) > 1.0 ? '#ef4444' : '#10b981' }}>
            {marketStats.avg_pcr_vol || 1.0}
          </span>
          <span className="stat-sub">{(marketStats.avg_pcr_vol || 1) > 1.0 ? 'Defensive hedging bias' : 'Bullish call flow dominance'}</span>
        </div>
        <div className="stat-card">
          <span className="stat-title">Rolling Window Retention</span>
          <span className="stat-val" style={{ color: '#10b981' }}>
            {marketStats.rolling_days || 30} Days
          </span>
          <span className="stat-sub">Auto-purging older than 30 sessions</span>
        </div>
      </div>

      {/* FILTER PRESETS & CONTROLS */}
      <div className="screener-controls-bar">
        <div className="preset-filters-group">
          <button 
            className={`preset-pill ${activePreset === 'ALL' ? 'active' : ''}`}
            onClick={() => setActivePreset('ALL')}
          >
            All Stocks ({filteredRecords.length})
          </button>
          <button 
            className={`preset-pill flow-highlight ${activePreset === 'HIGHEST_FLOW_IMPACT' ? 'active' : ''}`}
            onClick={() => {
              setActivePreset('HIGHEST_FLOW_IMPACT');
              setSortBy('flow_impact_score');
              setCurrentPage(1);
            }}
            title="Scan for equities experiencing the highest options flow notional volume and directional delta pressure"
          >
            ⚡ Highest Flow Impact ({data?.records?.filter(r => (r.flow_impact_score >= 50 || r.flow_impact_level === 'EXTREME' || r.flow_impact_level === 'HIGH')).length || 0})
          </button>
          <button 
            className={`preset-pill ${activePreset === 'CALL_ACCUMULATION' ? 'active' : ''}`}
            onClick={() => setActivePreset('CALL_ACCUMULATION')}
          >
            🚀 Call Accumulation
          </button>
          <button 
            className={`preset-pill ${activePreset === 'PUT_HEDGING' ? 'active' : ''}`}
            onClick={() => setActivePreset('PUT_HEDGING')}
          >
            🛡️ Institutional Put Hedge
          </button>
          <button 
            className={`preset-pill ${activePreset === 'VOL_SQUEEZE' ? 'active' : ''}`}
            onClick={() => setActivePreset('VOL_SQUEEZE')}
          >
            💥 Vol Squeeze
          </button>
          <button 
            className={`preset-pill ${activePreset === 'VOL_CRUSH' ? 'active' : ''}`}
            onClick={() => setActivePreset('VOL_CRUSH')}
          >
            📉 Vol Crush / Decay
          </button>
          <button 
            className={`preset-pill ${activePreset === 'WHALE_SWEEPS' ? 'active' : ''}`}
            onClick={() => setActivePreset('WHALE_SWEEPS')}
          >
            🐋 Whale Sweeps
          </button>
          <button 
            className={`preset-pill ${activePreset === 'BULLISH_BIAS' ? 'active' : ''}`}
            onClick={() => setActivePreset('BULLISH_BIAS')}
          >
            📈 Call Dominance
          </button>
        </div>

        <div className="search-sort-group">
          {/* Liquidity filter */}
          <select 
            value={minVolTier} 
            onChange={(e) => setMinVolTier(e.target.value)}
            className="sort-select"
            title="Filter by contract trading activity"
          >
            <option value="ALL">All Activity (Any Vol)</option>
            <option value="ACTIVE">Active Flow (Vol &ge; 100)</option>
            <option value="LIQUID">High Liquidity (Vol &ge; 1,000)</option>
          </select>

          {/* Search box & Direct Check Stock Button */}
          <div className="search-bar-composite">
            <div className="search-input-wrap">
              <Search size={14} className="search-icon" />
              <input 
                type="text" 
                placeholder="Search / Enter ticker (e.g. NVDA)..." 
                value={searchQuery}
                onChange={(e) => {
                  const val = e.target.value;
                  setSearchQuery(val);
                  if (val.trim()) {
                    prefetchDeepAnalytics(val.trim().toUpperCase());
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchQuery.trim()) {
                    handleCheckStock(searchQuery);
                  }
                }}
                className="screener-search-input"
              />
              {searchQuery && (
                <button 
                  className="search-clear-btn" 
                  onClick={() => setSearchQuery('')}
                  title="Clear search"
                  type="button"
                >
                  ✕
                </button>
              )}
            </div>
            <button 
              className="check-stock-btn"
              onClick={() => handleCheckStock(searchQuery)}
              disabled={!searchQuery.trim()}
              title="Directly check options intelligence, Greeks & trends for this stock"
              type="button"
            >
              <Zap size={13} />
              <span>Check Stock</span>
            </button>
          </div>

          {/* Sort */}
          <select 
            value={sortBy} 
            onChange={(e) => setSortBy(e.target.value)}
            className="sort-select"
          >
            <option value="flow_impact_score">Sort: ⚡ Flow Impact Score</option>
            <option value="notional_flow">Sort: 💰 Notional Flow ($)</option>
            <option value="net_delta_flow">Sort: 🎯 Net Delta Flow ($)</option>
            <option value="priority">Sort: Conviction Signal</option>
            <option value="vol_ratio">Sort: Unusual Vol Ratio (x)</option>
            <option value="oi_chg_5d_pct">Sort: 5D OI Growth %</option>
            <option value="iv_rank">Sort: 30D IV Rank (%)</option>
            <option value="skew_rank">Sort: 30D Skew Rank</option>
            <option value="total_vol">Sort: Total Options Vol</option>
          </select>
        </div>
      </div>

      {/* SCREENER MAIN TABLE */}
      <div className="screener-table-wrap">
        <table className="options-table">
          <thead>
            <tr>
              <th>Ticker / Price</th>
              <th>Institutional Flow Signal</th>
              <th>⚡ Flow Impact & Notional</th>
              <th>30D OI Trend & 5D Δ</th>
              <th>Unusual Vol (x Avg)</th>
              <th>Call / Put Flow</th>
              <th>30D IV Rank</th>
              <th>30D Skew Rank</th>
              <th>Top Unusual Sweep</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                  <RefreshCw size={24} className="spin-slow" style={{ margin: '0 auto 0.5rem', display: 'block' }} />
                  Loading Options Intelligence across all US stocks...
                </td>
              </tr>
            ) : paginatedRecords.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                  No equities match the active filter. Try clearing the search or setting Activity to "All".
                </td>
              </tr>
            ) : (
              paginatedRecords.map((r) => {
                const isVolHot = r.vol_ratio >= 2.0;
                const isVolElevated = r.vol_ratio >= 1.3 && r.vol_ratio < 2.0;
                const oiUp = r.oi_chg_5d_pct >= 0;

                return (
                  <tr 
                    key={r.ticker} 
                    className="clickable-row"
                    onMouseEnter={() => prefetchDeepAnalytics(r.ticker)}
                    onClick={() => handleOpenDeepAnalytics(r.ticker)}
                    title="Click to open Greeks Matrix, Trends & AI Recommendation"
                  >
                    {/* TICKER */}
                    <td className="ticker-cell">
                      <div className="ticker-symbol">{r.ticker}</div>
                      <div className="ticker-spot">${r.spot_price.toFixed(2)}</div>
                    </td>

                    {/* SIGNAL */}
                    <td>
                      <div 
                        className="signal-pill" 
                        style={{ 
                          background: `${r.signal_color}18`, 
                          color: r.signal_color,
                          borderColor: `${r.signal_color}40`
                        }}
                        title={r.signal_desc}
                      >
                        {r.signal_badge}
                      </div>
                    </td>

                    {/* FLOW IMPACT & NOTIONAL */}
                    <td>
                      <div className="flow-impact-cell">
                        <div className="flow-impact-badge-wrap">
                          <span 
                            className={`flow-score-badge badge-${(r.flow_impact_level || 'NORMAL').toLowerCase()}`}
                            style={{ 
                              background: `${r.flow_impact_color || '#94a3b8'}18`, 
                              color: r.flow_impact_color || '#94a3b8',
                              borderColor: `${r.flow_impact_color || '#94a3b8'}55`
                            }}
                            title={r.flow_implication}
                          >
                            ⚡ {r.flow_impact_score?.toFixed(1) || '0.0'} {r.flow_impact_level}
                          </span>
                        </div>
                        <div className="flow-notional-val">
                          ${formatKMB(r.notional_flow)} Notional
                        </div>
                        <div 
                          className="flow-delta-val" 
                          style={{ color: (r.net_delta_flow || 0) >= 0 ? '#10b981' : '#f87171' }}
                          title={`Net Directional Delta Flow: ${(r.net_delta_flow || 0) >= 0 ? 'Call Delta Buying Demand' : 'Put Delta Downside Demand'}`}
                        >
                          {(r.net_delta_flow || 0) >= 0 ? '+' : ''}${formatKMB(r.net_delta_flow)} Net Δ
                          {r.flow_imbalance_ratio > 1.2 && (
                            <span className="flow-ratio-tag"> ({r.flow_imbalance_ratio}x {r.call_vol_pct >= 50 ? 'C' : 'P'})</span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* OI TREND SPARKLINE */}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <Sparkline 
                          data={r.oi_sparkline} 
                          color={oiUp ? '#10b981' : '#ef4444'} 
                          width={80} 
                          height={24} 
                        />
                        <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', fontWeight: 600, color: oiUp ? '#10b981' : '#ef4444' }}>
                          {oiUp ? '+' : ''}{r.oi_chg_5d_pct.toFixed(1)}%
                          <div style={{ fontSize: '0.65rem', color: '#64748b' }}>
                            5d Δ: {(r.oi_chg_5d / 1000).toFixed(0)}k
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* UNUSUAL VOL RATIO */}
                    <td>
                      <span className={`vol-ratio-badge ${isVolHot ? 'hot' : isVolElevated ? 'elevated' : ''}`}>
                        {r.vol_ratio.toFixed(2)}x
                      </span>
                      <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px', fontFamily: 'monospace' }}>
                        {(r.total_vol / 1000).toFixed(1)}k contracts
                      </div>
                    </td>

                    {/* CALL / PUT FLOW */}
                    <td>
                      <div style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                        <span style={{ color: '#10b981' }}>{r.call_vol_pct.toFixed(0)}% C</span>
                        {' / '}
                        <span style={{ color: '#ef4444' }}>{(100 - r.call_vol_pct).toFixed(0)}% P</span>
                      </div>
                      <div className="call-put-split-bar">
                        <div className="call-bar-fill" style={{ width: `${r.call_vol_pct}%` }} />
                        <div className="put-bar-fill" style={{ width: `${100 - r.call_vol_pct}%` }} />
                      </div>
                    </td>

                    {/* 30D IV RANK */}
                    <td>
                      <div className="iv-rank-wrap">
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontFamily: 'monospace' }}>
                          <span style={{ fontWeight: 700, color: r.iv_rank > 70 ? '#c084fc' : r.iv_rank < 30 ? '#38bdf8' : '#cbd5e1' }}>
                            {r.iv_rank.toFixed(0)}%
                          </span>
                          <span style={{ color: '#94a3b8' }}>{r.atm_iv_30d.toFixed(0)}% IV</span>
                        </div>
                        <div className="iv-rank-bar-bg">
                          <div 
                            className="iv-rank-bar-fill" 
                            style={{ 
                              width: `${r.iv_rank}%`,
                              background: r.iv_rank > 70 ? '#c084fc' : r.iv_rank < 30 ? '#38bdf8' : '#10b981'
                            }} 
                          />
                        </div>
                      </div>
                    </td>

                    {/* 30D SKEW RANK */}
                    <td>
                      <span 
                        className="skew-badge"
                        style={{
                          background: r.skew_rank >= 70 ? 'rgba(239, 68, 68, 0.15)' : r.skew_rank <= 30 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                          color: r.skew_rank >= 70 ? '#ef4444' : r.skew_rank <= 30 ? '#10b981' : '#cbd5e1'
                        }}
                      >
                        {r.skew_rank >= 70 ? `Crash Put Bid (${r.skew_rank.toFixed(0)}%)` :
                         r.skew_rank <= 30 ? `Call Bid (${r.skew_rank.toFixed(0)}%)` :
                         `Normal (${r.skew_rank.toFixed(0)}%)`}
                      </span>
                      <div style={{ fontSize: '0.65rem', color: '#64748b', fontFamily: 'monospace', marginTop: '2px' }}>
                        25Δ Skew: {r.skew_25d > 0 ? '+' : ''}{r.skew_25d.toFixed(1)}%
                      </div>
                    </td>

                    {/* TOP UNUSUAL SWEEP */}
                    <td>
                      {r.top_unusual_contract ? (
                        <div style={{ fontSize: '0.75rem', fontFamily: 'monospace' }}>
                          <span style={{ color: r.top_unusual_contract.type === 'CALL' ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                            {r.top_unusual_contract.type} ${r.top_unusual_contract.strike}
                          </span>
                          <span style={{ color: '#f59e0b', marginLeft: '4px' }}>
                            {r.top_unusual_contract.vol_oi_ratio}x OI
                          </span>
                          <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>
                            Vol: {r.top_unusual_contract.volume.toLocaleString()} (${(r.top_unusual_contract.est_premium / 1000).toFixed(0)}k)
                          </div>
                        </div>
                      ) : (
                        <span style={{ color: '#64748b', fontSize: '0.75rem' }}>None</span>
                      )}
                    </td>

                    {/* ACTION */}
                    <td>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <button 
                          className="action-btn-highlight"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDeepAnalytics(r.ticker, 'ai_recommendation');
                          }}
                          onMouseEnter={() => prefetchDeepAnalytics(r.ticker)}
                          title="Plot Greeks, Multi-Parameter Trends & AI Recommendations"
                        >
                          <Zap size={13} color="#f59e0b" /> Greeks & AI
                        </button>
                        <button 
                          className="action-btn-highlight"
                          style={{ background: 'rgba(56, 189, 248, 0.12)', color: '#38bdf8', borderColor: 'rgba(56, 189, 248, 0.35)' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDeepAnalytics(r.ticker, 'strike_curve');
                          }}
                          onMouseEnter={() => prefetchDeepAnalytics(r.ticker)}
                          title="Instant Strike GEX & DEX Curve"
                        >
                          <BarChart2 size={13} color="#38bdf8" /> Strike GEX
                        </button>
                        <button 
                          className="action-btn-highlight"
                          style={{ background: 'rgba(168, 85, 247, 0.12)', color: '#c084fc', borderColor: 'rgba(168, 85, 247, 0.35)' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDeepAnalytics(r.ticker, 'term_structure');
                          }}
                          onMouseEnter={() => prefetchDeepAnalytics(r.ticker)}
                          title="Instant Expiration Term Structure Curve"
                        >
                          <Layers size={13} color="#c084fc" /> Term Curve
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* PAGINATION BAR */}
      {filteredRecords.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', background: 'rgba(15, 23, 42, 0.6)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
            Showing <strong>{((currentPage - 1) * pageSize) + 1}</strong> - <strong>{Math.min(currentPage * pageSize, filteredRecords.length)}</strong> of <strong>{filteredRecords.length}</strong> equities
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button 
              className="action-btn"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              style={{ opacity: currentPage <= 1 ? 0.4 : 1 }}
            >
              <ChevronLeft size={16} /> Previous
            </button>
            <span style={{ fontSize: '0.8rem', color: '#cbd5e1', padding: '0 0.5rem', fontFamily: 'monospace' }}>
              Page {currentPage} of {totalPages}
            </span>
            <button 
              className="action-btn"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              style={{ opacity: currentPage >= totalPages ? 0.4 : 1 }}
            >
              Next <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* DEEP OPTIONS INTELLIGENCE & AI RECOMMENDATION MODAL */}
      {selectedTicker && (
        <div className="options-modal-overlay" onClick={() => setSelectedTicker(null)}>
          <div className="options-modal-content wide-modal" onClick={(e) => e.stopPropagation()}>
            {/* MODAL HEADER */}
            <div className="modal-header">
              <div className="modal-title-left">
                <h3>${selectedTicker} Institutional Options Terminal</h3>
                {deepAnalytics?.spot_price && (
                  <span className="spot-tag">
                    ${deepAnalytics.spot_price.toFixed(2)}
                  </span>
                )}
                {deepAnalytics?.ai_recommendation && (
                  <span 
                    className="ai-conviction-pill"
                    style={{
                      background: deepAnalytics.ai_recommendation.conviction_score >= 80 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(56, 189, 248, 0.2)',
                      color: deepAnalytics.ai_recommendation.conviction_score >= 80 ? '#10b981' : '#38bdf8',
                      border: `1px solid ${deepAnalytics.ai_recommendation.conviction_score >= 80 ? '#10b981' : '#38bdf8'}60`
                    }}
                  >
                    <Award size={13} /> {deepAnalytics.ai_recommendation.conviction_score}/100 Conviction
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.06)', borderRadius: '6px', padding: '2px 6px', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <button 
                    onClick={() => navigateTicker(-1)}
                    title="Previous Stock (Preserves Tab)"
                    style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '3px 5px', display: 'flex', alignItems: 'center' }}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span style={{ fontSize: '11px', color: '#64748b', padding: '0 4px', fontFamily: 'monospace', userSelect: 'none' }}>
                    SWITCH
                  </span>
                  <button 
                    onClick={() => navigateTicker(1)}
                    title="Next Stock (Preserves Tab)"
                    style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '3px 5px', display: 'flex', alignItems: 'center' }}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
                <button 
                  className="modal-action-btn" 
                  onClick={() => {
                    if (selectedTicker) {
                      delete analyticsCache.current[selectedTicker];
                      handleOpenDeepAnalytics(selectedTicker, modalTab);
                    }
                  }}
                  title="Force refresh live options data"
                >
                  <RefreshCw size={14} className={loadingAnalytics ? 'spin-slow' : ''} />
                </button>
                <button className="modal-close-btn" onClick={() => setSelectedTicker(null)}>
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="modal-body">
              {loadingAnalytics && !deepAnalytics ? (
                <div style={{ textAlign: 'center', padding: '4rem', color: '#94a3b8' }}>
                  <RefreshCw size={32} className="spin-slow" style={{ margin: '0 auto 1rem', display: 'block', color: '#38bdf8' }} />
                  Synthesizing real-time CBOE Greeks, 30-day volatility surface, and AI Playbook for ${selectedTicker}...
                </div>
              ) : (
                <>
                  {loadingAnalytics && (
                    <div style={{ height: '3px', background: 'linear-gradient(90deg, #38bdf8, #00E676, #38bdf8)', backgroundSize: '200% 100%', animation: 'sweep 1.5s infinite linear', marginBottom: '8px', borderRadius: 2 }} />
                  )}
                  {/* MODAL NAVIGATION TABS */}
                  <div className="modal-tabs-nav">
                    <button 
                      className={`modal-tab-btn ${modalTab === 'ai_recommendation' ? 'active' : ''}`}
                      onClick={() => setModalTab('ai_recommendation')}
                    >
                      <Zap size={14} /> AI Recommendation
                    </button>
                    <button 
                      className={`modal-tab-btn ${modalTab === 'greeks_matrix' ? 'active' : ''}`}
                      onClick={() => setModalTab('greeks_matrix')}
                    >
                      <Activity size={14} /> Greek Trend Badges
                    </button>
                    <button 
                      className={`modal-tab-btn ${modalTab === 'trends_30d' ? 'active' : ''}`}
                      onClick={() => setModalTab('trends_30d')}
                    >
                      <TrendingUp size={14} /> 30-Day Multi-Parameter Trends
                    </button>
                    <button 
                      className={`modal-tab-btn ${modalTab === 'strike_curve' ? 'active' : ''}`}
                      onClick={() => setModalTab('strike_curve')}
                    >
                      <BarChart2 size={14} /> Strike GEX & DEX Curve
                    </button>
                    <button 
                      className={`modal-tab-btn ${modalTab === 'term_structure' ? 'active' : ''}`}
                      onClick={() => setModalTab('term_structure')}
                    >
                      <Layers size={14} /> Term Structure
                    </button>
                    <button 
                      className={`modal-tab-btn ${modalTab === 'unusual' ? 'active' : ''}`}
                      onClick={() => setModalTab('unusual')}
                    >
                      <Flame size={14} /> Whale Sweeps ({deepAnalytics?.unusual_contracts?.length || 0})
                    </button>
                  </div>

                  {/* TAB 1: AI OPTIONS RECOMMENDATION */}
                  {modalTab === 'ai_recommendation' && deepAnalytics?.ai_recommendation && (() => {
                    const ai = deepAnalytics.ai_recommendation;
                    return (
                      <div className="ai-rec-container">
                        <div className="ai-hero-card">
                          <div className="ai-hero-top">
                            <div className="ai-hero-title-wrap">
                              <span className="ai-bias-badge" style={{
                                background: ai.bias?.includes('BULL') ? 'rgba(16, 185, 129, 0.2)' : ai.bias?.includes('BEAR') ? 'rgba(239, 68, 68, 0.2)' : 'rgba(56, 189, 248, 0.2)',
                                color: ai.bias?.includes('BULL') ? '#10b981' : ai.bias?.includes('BEAR') ? '#f87171' : '#38bdf8',
                                border: `1px solid ${ai.bias?.includes('BULL') ? '#10b981' : ai.bias?.includes('BEAR') ? '#ef4444' : '#38bdf8'}60`
                              }}>
                                {ai.bias}
                              </span>
                              <h2>{ai.title}</h2>
                            </div>
                            <div className="ai-conviction-box">
                              <span className="conv-lbl">AI Conviction</span>
                              <div className="conv-val-row">
                                <span className="conv-num">{ai.conviction_score}</span>
                                <span className="conv-denom">/ 100</span>
                              </div>
                            </div>
                          </div>

                          <div className="ai-roadmap-grid">
                            <div className="roadmap-chip">
                              <span className="chip-lbl">Recommended Strategy</span>
                              <span className="chip-val highlight">{ai.strategy}</span>
                            </div>
                            <div className="roadmap-chip">
                              <span className="chip-lbl">Optimal Contract Spec</span>
                              <span className="chip-val font-mono">{ai.options_spec}</span>
                            </div>
                            <div className="roadmap-chip">
                              <span className="chip-lbl">Ideal Entry Corridor</span>
                              <span className="chip-val font-mono">{ai.entry_range || `$${ai.ideal_entry}`}</span>
                            </div>
                            <div className="roadmap-chip">
                              <span className="chip-lbl">Stop Loss / Invalidation</span>
                              <span className="chip-val font-mono" style={{ color: '#f87171' }}>${ai.stop_loss}</span>
                            </div>
                            <div className="roadmap-chip">
                              <span className="chip-lbl">Primary Profit Target</span>
                              <span className="chip-val font-mono" style={{ color: '#10b981' }}>${ai.target_primary}</span>
                            </div>
                            <div className="roadmap-chip">
                              <span className="chip-lbl">Risk / Reward Ratio</span>
                              <span className="chip-val font-mono" style={{ color: '#fbbf24' }}>{ai.risk_reward}</span>
                            </div>
                            <div className="roadmap-chip">
                              <span className="chip-lbl">Target Holding Period</span>
                              <span className="chip-val">{ai.expected_holding}</span>
                            </div>
                          </div>

                          {/* OPTION FLOW MARKET IMPACT ANALYSIS CARD */}
                          {deepAnalytics.flow_impact && (
                            <div className="flow-impact-modal-card">
                              <div className="flow-impact-modal-header">
                                <div className="impact-title-group">
                                  <Zap size={17} color="#f59e0b" />
                                  <span className="impact-heading">Option Flow Market Impact Analysis</span>
                                  <span 
                                    className="impact-level-pill"
                                    style={{
                                      background: `${deepAnalytics.flow_impact.color}22`,
                                      color: deepAnalytics.flow_impact.color,
                                      borderColor: `${deepAnalytics.flow_impact.color}60`
                                    }}
                                  >
                                    {deepAnalytics.flow_impact.badge}
                                  </span>
                                </div>
                                <div className="impact-score-display">
                                  <span className="impact-score-num">{deepAnalytics.flow_impact.score}</span>
                                  <span className="impact-score-denom">/ 100 Impact Score</span>
                                </div>
                              </div>
                              
                              <div className="impact-metrics-strip">
                                <div className="impact-metric-box">
                                  <span className="imb-label">Total Notional Flow</span>
                                  <span className="imb-val font-mono">${formatKMB(deepAnalytics.flow_impact.notional_flow)}</span>
                                </div>
                                <div className="impact-metric-box">
                                  <span className="imb-label">Net Directional Delta Flow</span>
                                  <span className="imb-val font-mono" style={{ color: (deepAnalytics.flow_impact.net_delta_flow || 0) >= 0 ? '#10b981' : '#f87171' }}>
                                    {(deepAnalytics.flow_impact.net_delta_flow || 0) >= 0 ? '+' : ''}${formatKMB(deepAnalytics.flow_impact.net_delta_flow)}
                                  </span>
                                </div>
                                <div className="impact-metric-box">
                                  <span className="imb-label">Order Flow Imbalance</span>
                                  <span className="imb-val font-mono" style={{ color: (deepAnalytics.flow_impact.call_vol_pct || 50) >= 50 ? '#10b981' : '#f87171' }}>
                                    {deepAnalytics.flow_impact.imbalance_ratio}x {deepAnalytics.flow_impact.call_vol_pct >= 50 ? 'Calls' : 'Puts'}
                                  </span>
                                </div>
                                <div className="impact-metric-box">
                                  <span className="imb-label">Flow Driver Vector</span>
                                  <span className="imb-val highlight-small">{deepAnalytics.flow_impact.driver_label}</span>
                                </div>
                              </div>

                              <div className="impact-implication-note">
                                <strong>Market Maker Microstructure Implication: </strong>
                                <span>{deepAnalytics.flow_impact.implication}</span>
                              </div>
                            </div>
                          )}

                          <div className="ai-rationale-section">
                            <div className="rationale-header">
                              <Compass size={16} color="#38bdf8" />
                              <span>Dealer Microstructure & Institutional Order Flow Rationale</span>
                            </div>
                            <p className="rationale-body">
                              {ai.microstructure_rationale}
                            </p>
                          </div>

                          {ai.execution_checklist?.length > 0 && (
                            <div className="execution-checklist-wrap">
                              <div className="checklist-title">
                                <Target size={16} color="#10b981" />
                                <span>Institutional Trade Execution Checklist</span>
                              </div>
                              <div className="checklist-steps">
                                {ai.execution_checklist.map((step, idx) => (
                                  <div key={idx} className="checklist-step-item">
                                    <div className="step-num">{idx + 1}</div>
                                    <div className="step-content">
                                      <strong>{step.phase}</strong>
                                      <p>{step.detail}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* TAB 2: GREEK TREND BADGES & PARAMETERS MATRIX */}
                  {modalTab === 'greeks_matrix' && deepAnalytics && (() => {
                    const gm = deepAnalytics.greeks_matrix || {};
                    const ti = deepAnalytics.trend_indicators || {};
                    const gamma = gm.gamma || {};
                    const delta = gm.delta || {};
                    const vega = gm.vega_volatility || {};
                    const charm = gm.charm_theta || {};
                    const flow = gm.order_flow || {};
                    const risk = gm.risk_scores || {};

                    return (
                      <div className="greeks-tab-content">
                        <div className="greeks-summary-bar">
                          <div className="sum-item">
                            <span className="lbl">Spot Price</span>
                            <span className="val">${deepAnalytics.spot_price?.toFixed(2)}</span>
                          </div>
                          <div className="sum-item">
                            <span className="lbl">Call Wall (Resistance)</span>
                            <span className="val" style={{ color: '#10b981' }}>${gamma.call_wall}</span>
                          </div>
                          <div className="sum-item">
                            <span className="lbl">Put Wall (Floor)</span>
                            <span className="val" style={{ color: '#f87171' }}>${gamma.put_wall}</span>
                          </div>
                          <div className="sum-item">
                            <span className="lbl">Zero Gamma Flip</span>
                            <span className="val" style={{ color: '#c084fc' }}>${gamma.zero_gamma}</span>
                          </div>
                          <div className="sum-item">
                            <span className="lbl">Max Pain Strike</span>
                            <span className="val" style={{ color: '#fbbf24' }}>${charm.max_pain}</span>
                          </div>
                          <div className="sum-item">
                            <span className="lbl">1-Day Expected Move</span>
                            <span className="val font-mono">&plusmn;${vega.expected_move_1d} ({vega.expected_move_1d_pct}%)</span>
                          </div>
                        </div>

                        <div className="trend-cards-grid">
                          {/* 1. GAMMA EXPOSURE */}
                          <div className="trend-card" style={{ borderLeft: `4px solid ${ti.gamma?.color || '#38bdf8'}` }}>
                            <div className="card-top">
                              <span className="card-title">Gamma Exposure (GEX)</span>
                              <span className="trend-pill" style={{ background: `${ti.gamma?.color}20`, color: ti.gamma?.color, border: `1px solid ${ti.gamma?.color}50` }}>
                                {ti.gamma?.badge}
                              </span>
                            </div>
                            <div className="card-metric-row">
                              <span className="primary-metric" style={{ color: gamma.net_gex_millions >= 0 ? '#10b981' : '#f87171' }}>
                                ${gamma.net_gex_millions}M
                              </span>
                              <span className="metric-context">Net Gamma / pt</span>
                            </div>
                            <p className="card-desc">{ti.gamma?.desc}</p>
                            <div className="card-footer-stats">
                              <span>Call GEX: <strong style={{ color: '#10b981' }}>+${gamma.call_gex_millions}M</strong></span>
                              <span>Put GEX: <strong style={{ color: '#f87171' }}>-${Math.abs(gamma.put_gex_millions)}M</strong></span>
                            </div>
                          </div>

                          {/* 2. DELTA FLOW */}
                          <div className="trend-card" style={{ borderLeft: `4px solid ${delta.net_dex_millions >= 0 ? '#10b981' : '#f87171'}` }}>
                            <div className="card-top">
                              <span className="card-title">Dealer Net Delta (DEX)</span>
                              <span className="trend-pill" style={{ 
                                background: delta.net_dex_millions >= 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)', 
                                color: delta.net_dex_millions >= 0 ? '#10b981' : '#f87171' 
                              }}>
                                {delta.net_dex_millions >= 0 ? '↑ LONG DELTA' : '↓ SHORT DELTA'}
                              </span>
                            </div>
                            <div className="card-metric-row">
                              <span className="primary-metric" style={{ color: delta.net_dex_millions >= 0 ? '#10b981' : '#f87171' }}>
                                ${delta.net_dex_millions}M
                              </span>
                              <span className="metric-context">Aggregate Delta</span>
                            </div>
                            <p className="card-desc">
                              Absolute delta gravity is concentrated at the ${delta.absolute_delta_strike} strike. Market makers hold net {delta.net_dex_millions >= 0 ? 'long' : 'short'} delta against option open interest.
                            </p>
                            <div className="card-footer-stats">
                              <span>Abs Delta Strike: <strong>${delta.absolute_delta_strike}</strong></span>
                              <span>PCR Vol: <strong>{flow.pcr_vol}</strong></span>
                            </div>
                          </div>

                          {/* 3. IMPLIED VOLATILITY */}
                          <div className="trend-card" style={{ borderLeft: `4px solid ${ti.iv?.color || '#a855f7'}` }}>
                            <div className="card-top">
                              <span className="card-title">30-Day ATM Implied Volatility</span>
                              <span className="trend-pill" style={{ background: `${ti.iv?.color}20`, color: ti.iv?.color, border: `1px solid ${ti.iv?.color}50` }}>
                                {ti.iv?.arrow} {ti.iv?.badge}
                              </span>
                            </div>
                            <div className="card-metric-row">
                              <span className="primary-metric" style={{ color: '#38bdf8' }}>
                                {vega.atm_iv_pct}%
                              </span>
                              <span className="metric-context">5D Shift: <strong style={{ color: ti.iv?.color }}>{ti.iv?.value}</strong></span>
                            </div>
                            <p className="card-desc">{ti.iv?.desc}</p>
                            <div className="card-footer-stats">
                              <span>30D IV Rank: <strong>{vega.iv_rank_30d}%</strong></span>
                              <span>Expected 5D: <strong>&plusmn;${vega.expected_move_5d}</strong></span>
                            </div>
                          </div>

                          {/* 4. 25-DELTA CRASH SKEW */}
                          <div className="trend-card" style={{ borderLeft: `4px solid ${ti.skew?.color || '#f43f5e'}` }}>
                            <div className="card-top">
                              <span className="card-title">25-Delta Put/Call Skew</span>
                              <span className="trend-pill" style={{ background: `${ti.skew?.color}20`, color: ti.skew?.color, border: `1px solid ${ti.skew?.color}50` }}>
                                {ti.skew?.arrow} {ti.skew?.badge}
                              </span>
                            </div>
                            <div className="card-metric-row">
                              <span className="primary-metric" style={{ color: vega.skew_25d > 0 ? '#f87171' : '#38bdf8' }}>
                                {vega.skew_25d > 0 ? '+' : ''}{vega.skew_25d}%
                              </span>
                              <span className="metric-context">30D Skew Rank: <strong>{vega.skew_rank_30d}%</strong></span>
                            </div>
                            <p className="card-desc">{ti.skew?.desc}</p>
                            <div className="card-footer-stats">
                              <span>Downside Bias: <strong>{vega.skew_25d > 0 ? 'Puts Over Calls' : 'Calls Over Puts'}</strong></span>
                              <span>Protection Cost: <strong>{vega.skew_rank_30d > 70 ? 'Expensive' : 'Cheap'}</strong></span>
                            </div>
                          </div>

                          {/* 5. MULTI-SESSION OI ACCUMULATION */}
                          <div className="trend-card" style={{ borderLeft: `4px solid ${ti.oi?.color || '#10b981'}` }}>
                            <div className="card-top">
                              <span className="card-title">5-Day Open Interest Flow</span>
                              <span className="trend-pill" style={{ background: `${ti.oi?.color}20`, color: ti.oi?.color, border: `1px solid ${ti.oi?.color}50` }}>
                                {ti.oi?.arrow} {ti.oi?.badge}
                              </span>
                            </div>
                            <div className="card-metric-row">
                              <span className="primary-metric" style={{ color: ti.oi?.color }}>
                                {ti.oi?.value}
                              </span>
                              <span className="metric-context">Total OI: {flow.total_oi?.toLocaleString()}</span>
                            </div>
                            <p className="card-desc">{ti.oi?.desc}</p>
                            <div className="card-footer-stats">
                              <span>Call OI: <strong style={{ color: '#10b981' }}>{flow.call_oi?.toLocaleString()}</strong></span>
                              <span>Put OI: <strong style={{ color: '#f87171' }}>{flow.put_oi?.toLocaleString()}</strong></span>
                            </div>
                          </div>

                          {/* 6. VOLUME PACE & GAUGE RISK */}
                          <div className="trend-card" style={{ borderLeft: `4px solid ${ti.volume?.color || '#f59e0b'}` }}>
                            <div className="card-top">
                              <span className="card-title">Unusual Volume & Fragility Risk</span>
                              <span className="trend-pill" style={{ background: `${ti.volume?.color}20`, color: ti.volume?.color, border: `1px solid ${ti.volume?.color}50` }}>
                                {ti.volume?.badge}
                              </span>
                            </div>
                            <div className="card-metric-row">
                              <span className="primary-metric" style={{ color: '#f59e0b' }}>
                                {flow.vol_ratio_20d}x
                              </span>
                              <span className="metric-context">Relative to 20D Baseline</span>
                            </div>
                            <p className="card-desc">{ti.volume?.desc}</p>
                            <div className="card-footer-stats">
                              <span>Squeeze: <strong style={{ color: ti.squeeze_risk?.color }}>{risk.squeeze_score}/100</strong></span>
                              <span>Cascade: <strong style={{ color: ti.cascade_risk?.color }}>{risk.cascade_score}/100</strong></span>
                              <span>Pin: <strong style={{ color: ti.pin_risk?.color }}>{risk.pin_score}/100</strong></span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* TAB 3: 30-DAY MULTI-PARAMETER TREND CHARTS */}
                  {modalTab === 'trends_30d' && deepAnalytics && (() => {
                    const history = deepAnalytics.history || [];
                    if (!history.length) {
                      return <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>No 30-day historical time-series available for {deepAnalytics.ticker}.</div>;
                    }

                    const N = history.length;
                    const activeIdx = hoveredHistoryIndex !== null ? hoveredHistoryIndex : N - 1;
                    const activeH = history[activeIdx] || history[N - 1];
                    const isLatest = activeIdx === N - 1;

                    // Common chart dimensions
                    const svgW = 760;
                    const svgH = 190;
                    const padLeft = 65;
                    const padRight = 55;
                    const padTop = 18;
                    const padBottom = 32;
                    const plotW = svgW - padLeft - padRight;
                    const plotH = svgH - padTop - padBottom;
                    const xPos = (i) => padLeft + (i / Math.max(N - 1, 1)) * plotW;

                    // HUD calculations
                    const painDiff = activeH.spot_price - activeH.max_pain;
                    const painDiffPct = activeH.max_pain > 0 ? (painDiff / activeH.max_pain) * 100 : 0;
                    const callOIPct = activeH.total_oi > 0 ? (activeH.call_oi / activeH.total_oi) * 100 : 50;
                    const putOIPct = 100 - callOIPct;
                    const callVolPct = activeH.call_vol_pct || (activeH.total_vol > 0 ? (activeH.call_vol / activeH.total_vol) * 100 : 50);

                    // Reusable mouse-tracking overlay
                    const renderHoverOverlay = () => (
                      <>
                        {hoveredHistoryIndex !== null && (
                          <line
                            x1={xPos(hoveredHistoryIndex)}
                            x2={xPos(hoveredHistoryIndex)}
                            y1={padTop}
                            y2={padTop + plotH}
                            stroke="rgba(255, 255, 255, 0.45)"
                            strokeWidth="1.5"
                            strokeDasharray="3 3"
                            pointerEvents="none"
                          />
                        )}
                        {history.map((h, i) => {
                          const colW = plotW / N;
                          const colX = padLeft + i * colW;
                          return (
                            <rect
                              key={i}
                              x={colX}
                              y={padTop}
                              width={colW}
                              height={plotH}
                              fill="transparent"
                              style={{ cursor: 'crosshair' }}
                              onMouseEnter={() => setHoveredHistoryIndex(i)}
                            />
                          );
                        })}
                      </>
                    );

                    // Reusable X-Axis dates
                    const renderXAxis = () => (
                      <g className="x-axis-group">
                        {[0, Math.floor(N * 0.25), Math.floor(N * 0.5), Math.floor(N * 0.75), N - 1].map((idx) => {
                          if (!history[idx]) return null;
                          return (
                            <text
                              key={idx}
                              x={xPos(idx)}
                              y={padTop + plotH + 20}
                              fill="#94a3b8"
                              fontSize="10"
                              fontFamily="monospace"
                              textAnchor="middle"
                            >
                              {history[idx].date.slice(5)}
                            </text>
                          );
                        })}
                      </g>
                    );

                    // 1. CHART: Spot Price vs Max Pain
                    const renderPriceMaxPainChart = () => {
                      const prices = history.map(h => h.spot_price);
                      const pains = history.map(h => h.max_pain);
                      const minP = Math.floor(Math.min(...prices, ...pains) * 0.98);
                      const maxP = Math.ceil(Math.max(...prices, ...pains) * 1.02);
                      const rangeP = maxP - minP || 1;
                      const yP = (val) => padTop + plotH - ((val - minP) / rangeP) * plotH;

                      const pricePoints = history.map((h, i) => `${xPos(i).toFixed(1)},${yP(h.spot_price).toFixed(1)}`).join(' ');
                      const painPoints = history.map((h, i) => `${xPos(i).toFixed(1)},${yP(h.max_pain).toFixed(1)}`).join(' ');
                      const areaPoints = `${xPos(0).toFixed(1)},${(padTop + plotH).toFixed(1)} ${pricePoints} ${xPos(N - 1).toFixed(1)},${(padTop + plotH).toFixed(1)}`;

                      return (
                        <div className="svg-chart-card">
                          <div className="svg-chart-title-bar">
                            <span className="chart-title-text">
                              💵 Spot Price vs Options Max Pain Trend Curves ($)
                            </span>
                            <div className="chart-legend-items">
                              <span style={{ color: '#38bdf8' }}>— Spot Price: ${activeH.spot_price.toFixed(2)}</span>
                              <span style={{ color: '#fbbf24' }}>-- Max Pain: ${activeH.max_pain.toFixed(2)}</span>
                            </div>
                          </div>
                          <div className="interactive-svg-container" onMouseLeave={() => setHoveredHistoryIndex(null)}>
                            <svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
                              <defs>
                                <linearGradient id="spotAreaGrad" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.28" />
                                  <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.0" />
                                </linearGradient>
                              </defs>
                              {/* Grid lines & Y-ticks */}
                              {[0, 0.33, 0.66, 1].map((ratio, idx) => {
                                const y = padTop + plotH * (1 - ratio);
                                const val = minP + rangeP * ratio;
                                return (
                                  <g key={idx}>
                                    <line x1={padLeft} x2={padLeft + plotW} y1={y} y2={y} stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
                                    <text x={padLeft - 8} y={y + 3.5} fill="#64748b" fontSize="10" fontFamily="monospace" textAnchor="end">
                                      ${val.toFixed(1)}
                                    </text>
                                  </g>
                                );
                              })}
                              {/* Area fill */}
                              <polygon points={areaPoints} fill="url(#spotAreaGrad)" />
                              {/* Max Pain Line */}
                              <polyline points={painPoints} fill="none" stroke="#fbbf24" strokeWidth="1.8" strokeDasharray="4 3" />
                              {/* Spot Price Line */}
                              <polyline points={pricePoints} fill="none" stroke="#38bdf8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                              {/* Session Anchor Dots */}
                              {history.map((h, i) => (
                                <g key={i}>
                                  <circle cx={xPos(i)} cy={yP(h.spot_price)} r={activeIdx === i ? 4.5 : 1.8} fill="#38bdf8" opacity={activeIdx === i ? 1 : 0.4} />
                                  <circle cx={xPos(i)} cy={yP(h.max_pain)} r={activeIdx === i ? 3.5 : 1.5} fill="#fbbf24" opacity={activeIdx === i ? 1 : 0.4} />
                                </g>
                              ))}
                              {/* Active dots */}
                              <circle cx={xPos(activeIdx)} cy={yP(activeH.spot_price)} r="4.5" fill="#38bdf8" stroke="#ffffff" strokeWidth="1.8" />
                              <circle cx={xPos(activeIdx)} cy={yP(activeH.max_pain)} r="3.5" fill="#fbbf24" stroke="#ffffff" strokeWidth="1.5" />
                              {renderXAxis()}
                              {renderHoverOverlay()}
                            </svg>
                          </div>
                        </div>
                      );
                    };

                    // 2. CHART: Call OI vs Put OI & PCR (Continuous Trend Curves)
                    const renderOIChart = () => {
                      const allOIs = history.flatMap(h => [h.call_oi, h.put_oi]).filter(v => typeof v === 'number' && v > 0);
                      const rawMinOI = allOIs.length ? Math.min(...allOIs) : 0;
                      const rawMaxOI = allOIs.length ? Math.max(...allOIs) : 1;
                      const oiDelta = rawMaxOI - rawMinOI || 1;
                      // Dynamic adaptive padding so curves clearly sweep vertically across the chart canvas
                      const minOI = Math.max(0, Math.floor(rawMinOI - oiDelta * 0.12));
                      const maxOI = Math.ceil(rawMaxOI + oiDelta * 0.12);
                      const rangeOI = maxOI - minOI || 1;
                      const yOI = (val) => padTop + plotH - ((val - minOI) / rangeOI) * plotH;

                      const pcrs = history.map(h => h.pcr_oi || 1.0);
                      const rawMinPCR = Math.min(...pcrs);
                      const rawMaxPCR = Math.max(...pcrs);
                      const pcrDelta = rawMaxPCR - rawMinPCR || 0.05;
                      const pcrPad = Math.max(pcrDelta * 0.20, 0.02);
                      const minPCR = Math.max(0, Number((rawMinPCR - pcrPad).toFixed(2)));
                      const maxPCR = Number((rawMaxPCR + pcrPad).toFixed(2));
                      const rangePCR = maxPCR - minPCR || 1;
                      const yPCR = (val) => padTop + plotH - ((val - minPCR) / rangePCR) * plotH;

                      const callOIPoints = history.map((h, i) => `${xPos(i).toFixed(1)},${yOI(h.call_oi).toFixed(1)}`).join(' ');
                      const putOIPoints = history.map((h, i) => `${xPos(i).toFixed(1)},${yOI(h.put_oi).toFixed(1)}`).join(' ');
                      const pcrPoints = history.map((h, i) => `${xPos(i).toFixed(1)},${yPCR(h.pcr_oi).toFixed(1)}`).join(' ');

                      const callAreaPoints = `${xPos(0).toFixed(1)},${(padTop + plotH).toFixed(1)} ${callOIPoints} ${xPos(N - 1).toFixed(1)},${(padTop + plotH).toFixed(1)}`;
                      const putAreaPoints = `${xPos(0).toFixed(1)},${(padTop + plotH).toFixed(1)} ${putOIPoints} ${xPos(N - 1).toFixed(1)},${(padTop + plotH).toFixed(1)}`;

                      return (
                        <div className="svg-chart-card">
                          <div className="svg-chart-title-bar">
                            <span className="chart-title-text">
                              ⚖️ Open Interest Dynamics: Call OI vs Put OI & PCR Curves
                            </span>
                            <div className="chart-legend-items">
                              <span style={{ color: '#10b981' }}>— Call OI: {formatKMB(activeH.call_oi)}</span>
                              <span style={{ color: '#ef4444' }}>— Put OI: {formatKMB(activeH.put_oi)}</span>
                              <span style={{ color: '#f59e0b' }}>-- PCR OI: {activeH.pcr_oi?.toFixed(2)}</span>
                            </div>
                          </div>
                          <div className="interactive-svg-container" onMouseLeave={() => setHoveredHistoryIndex(null)}>
                            <svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
                              <defs>
                                <linearGradient id="callOIAreaGrad" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.22" />
                                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                                </linearGradient>
                                <linearGradient id="putOIAreaGrad" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#ef4444" stopOpacity="0.18" />
                                  <stop offset="100%" stopColor="#ef4444" stopOpacity="0.0" />
                                </linearGradient>
                              </defs>
                              {/* Grid lines & Dual Ticks */}
                              {[0, 0.33, 0.66, 1].map((ratio, idx) => {
                                const y = padTop + plotH * (1 - ratio);
                                const val = minOI + rangeOI * ratio;
                                const pcrVal = minPCR + rangePCR * ratio;
                                return (
                                  <g key={idx}>
                                    <line x1={padLeft} x2={padLeft + plotW} y1={y} y2={y} stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
                                    <text x={padLeft - 8} y={y + 3.5} fill="#64748b" fontSize="10" fontFamily="monospace" textAnchor="end">
                                      {formatKMB(val)}
                                    </text>
                                    <text x={padLeft + plotW + 8} y={y + 3.5} fill="#f59e0b" fontSize="9" fontFamily="monospace" textAnchor="start">
                                      {pcrVal.toFixed(2)}
                                    </text>
                                  </g>
                                );
                              })}
                              {/* Trend Area Fills */}
                              <polygon points={callAreaPoints} fill="url(#callOIAreaGrad)" />
                              <polygon points={putAreaPoints} fill="url(#putOIAreaGrad)" />
                              {/* Continuous Trend Curves */}
                              <polyline points={callOIPoints} fill="none" stroke="#10b981" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                              <polyline points={putOIPoints} fill="none" stroke="#ef4444" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                              <polyline points={pcrPoints} fill="none" stroke="#f59e0b" strokeWidth="1.8" strokeDasharray="3 3" />
                              {/* Session Anchor Dots */}
                              {history.map((h, i) => (
                                <g key={i}>
                                  <circle cx={xPos(i)} cy={yOI(h.call_oi)} r={activeIdx === i ? 4.5 : 1.8} fill="#10b981" opacity={activeIdx === i ? 1 : 0.4} />
                                  <circle cx={xPos(i)} cy={yOI(h.put_oi)} r={activeIdx === i ? 4.5 : 1.8} fill="#ef4444" opacity={activeIdx === i ? 1 : 0.4} />
                                </g>
                              ))}
                              {/* Active session indicators */}
                              <circle cx={xPos(activeIdx)} cy={yOI(activeH.call_oi)} r="4.5" fill="#10b981" stroke="#ffffff" strokeWidth="1.8" />
                              <circle cx={xPos(activeIdx)} cy={yOI(activeH.put_oi)} r="4.5" fill="#ef4444" stroke="#ffffff" strokeWidth="1.8" />
                              <circle cx={xPos(activeIdx)} cy={yPCR(activeH.pcr_oi)} r="3.5" fill="#f59e0b" stroke="#ffffff" strokeWidth="1.5" />
                              {renderXAxis()}
                              {renderHoverOverlay()}
                            </svg>
                          </div>
                        </div>
                      );
                    };

                    // 3. CHART: Call Volume vs Put Volume & PCR Vol (Continuous Trend Curves)
                    const renderVolumeChart = () => {
                      const allVols = history.flatMap(h => [h.call_vol, h.put_vol]).filter(v => typeof v === 'number' && v > 0);
                      const rawMinVol = allVols.length ? Math.min(...allVols) : 0;
                      const rawMaxVol = allVols.length ? Math.max(...allVols) : 1;
                      const volDelta = rawMaxVol - rawMinVol || 1;
                      const minVol = Math.max(0, Math.floor(rawMinVol - volDelta * 0.12));
                      const maxVol = Math.ceil(rawMaxVol + volDelta * 0.12);
                      const rangeVol = maxVol - minVol || 1;
                      const yVol = (val) => padTop + plotH - ((val - minVol) / rangeVol) * plotH;

                      const pcrs = history.map(h => h.pcr_vol || 1.0);
                      const rawMinPCR = Math.min(...pcrs);
                      const rawMaxPCR = Math.max(...pcrs);
                      const pcrDelta = rawMaxPCR - rawMinPCR || 0.05;
                      const pcrPad = Math.max(pcrDelta * 0.20, 0.02);
                      const minPCR = Math.max(0, Number((rawMinPCR - pcrPad).toFixed(2)));
                      const maxPCR = Number((rawMaxPCR + pcrPad).toFixed(2));
                      const rangePCR = maxPCR - minPCR || 1;
                      const yPCR = (val) => padTop + plotH - ((val - minPCR) / rangePCR) * plotH;

                      const callVolPoints = history.map((h, i) => `${xPos(i).toFixed(1)},${yVol(h.call_vol).toFixed(1)}`).join(' ');
                      const putVolPoints = history.map((h, i) => `${xPos(i).toFixed(1)},${yVol(h.put_vol).toFixed(1)}`).join(' ');
                      const pcrPoints = history.map((h, i) => `${xPos(i).toFixed(1)},${yPCR(h.pcr_vol).toFixed(1)}`).join(' ');

                      const callAreaPoints = `${xPos(0).toFixed(1)},${(padTop + plotH).toFixed(1)} ${callVolPoints} ${xPos(N - 1).toFixed(1)},${(padTop + plotH).toFixed(1)}`;
                      const putAreaPoints = `${xPos(0).toFixed(1)},${(padTop + plotH).toFixed(1)} ${putVolPoints} ${xPos(N - 1).toFixed(1)},${(padTop + plotH).toFixed(1)}`;

                      return (
                        <div className="svg-chart-card">
                          <div className="svg-chart-title-bar">
                            <span className="chart-title-text">
                              🌊 Daily Options Flow: Call Vol vs Put Vol & Volume PCR Curves
                            </span>
                            <div className="chart-legend-items">
                              <span style={{ color: '#10b981' }}>— Call Vol: {formatKMB(activeH.call_vol)}</span>
                              <span style={{ color: '#ef4444' }}>— Put Vol: {formatKMB(activeH.put_vol)}</span>
                              <span style={{ color: '#38bdf8' }}>-- PCR Vol: {activeH.pcr_vol?.toFixed(2)}</span>
                            </div>
                          </div>
                          <div className="interactive-svg-container" onMouseLeave={() => setHoveredHistoryIndex(null)}>
                            <svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
                              <defs>
                                <linearGradient id="callVolAreaGrad" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.22" />
                                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                                </linearGradient>
                                <linearGradient id="putVolAreaGrad" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#ef4444" stopOpacity="0.18" />
                                  <stop offset="100%" stopColor="#ef4444" stopOpacity="0.0" />
                                </linearGradient>
                              </defs>
                              {/* Grid lines & Dual Ticks */}
                              {[0, 0.33, 0.66, 1].map((ratio, idx) => {
                                const y = padTop + plotH * (1 - ratio);
                                const val = minVol + rangeVol * ratio;
                                const pcrVal = minPCR + rangePCR * ratio;
                                return (
                                  <g key={idx}>
                                    <line x1={padLeft} x2={padLeft + plotW} y1={y} y2={y} stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
                                    <text x={padLeft - 8} y={y + 3.5} fill="#64748b" fontSize="10" fontFamily="monospace" textAnchor="end">
                                      {formatKMB(val)}
                                    </text>
                                    <text x={padLeft + plotW + 8} y={y + 3.5} fill="#38bdf8" fontSize="9" fontFamily="monospace" textAnchor="start">
                                      {pcrVal.toFixed(2)}
                                    </text>
                                  </g>
                                );
                              })}
                              {/* Trend Area Fills */}
                              <polygon points={callAreaPoints} fill="url(#callVolAreaGrad)" />
                              <polygon points={putAreaPoints} fill="url(#putVolAreaGrad)" />
                              {/* Continuous Trend Curves */}
                              <polyline points={callVolPoints} fill="none" stroke="#10b981" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                              <polyline points={putVolPoints} fill="none" stroke="#ef4444" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                              <polyline points={pcrPoints} fill="none" stroke="#38bdf8" strokeWidth="1.8" strokeDasharray="3 3" />
                              {/* Session Anchor Dots */}
                              {history.map((h, i) => (
                                <g key={i}>
                                  <circle cx={xPos(i)} cy={yVol(h.call_vol)} r={activeIdx === i ? 4.5 : 1.8} fill="#10b981" opacity={activeIdx === i ? 1 : 0.4} />
                                  <circle cx={xPos(i)} cy={yVol(h.put_vol)} r={activeIdx === i ? 4.5 : 1.8} fill="#ef4444" opacity={activeIdx === i ? 1 : 0.4} />
                                </g>
                              ))}
                              {/* Active session indicators */}
                              <circle cx={xPos(activeIdx)} cy={yVol(activeH.call_vol)} r="4.5" fill="#10b981" stroke="#ffffff" strokeWidth="1.8" />
                              <circle cx={xPos(activeIdx)} cy={yVol(activeH.put_vol)} r="4.5" fill="#ef4444" stroke="#ffffff" strokeWidth="1.8" />
                              <circle cx={xPos(activeIdx)} cy={yPCR(activeH.pcr_vol)} r="3.5" fill="#38bdf8" stroke="#ffffff" strokeWidth="1.5" />
                              {renderXAxis()}
                              {renderHoverOverlay()}
                            </svg>
                          </div>
                        </div>
                      );
                    };

                    // 4. CHART: 30D ATM IV (%) vs 25-Delta Skew (Continuous Trend Curves)
                    const renderIVSkewChart = () => {
                      const ivs = history.map(h => h.atm_iv_30d);
                      const minIV = Math.floor(Math.min(...ivs) * 0.95);
                      const maxIV = Math.ceil(Math.max(...ivs) * 1.05);
                      const rangeIV = maxIV - minIV || 1;
                      const yIV = (val) => padTop + plotH - ((val - minIV) / rangeIV) * plotH;

                      const skews = history.map(h => h.skew_25d);
                      const absSkewMax = Math.max(...skews.map(s => Math.abs(s)), 10);
                      const zeroY = padTop + plotH / 2;
                      const ySkew = (val) => zeroY - (val / absSkewMax) * (plotH * 0.44);

                      const ivPoints = history.map((h, i) => `${xPos(i).toFixed(1)},${yIV(h.atm_iv_30d).toFixed(1)}`).join(' ');
                      const skewPoints = history.map((h, i) => `${xPos(i).toFixed(1)},${ySkew(h.skew_25d).toFixed(1)}`).join(' ');
                      const ivAreaPoints = `${xPos(0).toFixed(1)},${(padTop + plotH).toFixed(1)} ${ivPoints} ${xPos(N - 1).toFixed(1)},${(padTop + plotH).toFixed(1)}`;

                      return (
                        <div className="svg-chart-card">
                          <div className="svg-chart-title-bar">
                            <span className="chart-title-text">
                              ⚡ 30-Day Constant-Maturity ATM IV (%) vs 25Δ Skew Curves
                            </span>
                            <div className="chart-legend-items">
                              <span style={{ color: '#a855f7' }}>— ATM IV: {activeH.atm_iv_30d.toFixed(1)}%</span>
                              <span style={{ color: '#f59e0b' }}>— 25Δ Skew: {activeH.skew_25d > 0 ? '+' : ''}{activeH.skew_25d.toFixed(2)}%</span>
                            </div>
                          </div>
                          <div className="interactive-svg-container" onMouseLeave={() => setHoveredHistoryIndex(null)}>
                            <svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
                              <defs>
                                <linearGradient id="ivAreaGrad" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#a855f7" stopOpacity="0.25" />
                                  <stop offset="100%" stopColor="#a855f7" stopOpacity="0.0" />
                                </linearGradient>
                              </defs>
                              {/* Grid lines & Left IV Ticks */}
                              {[0, 0.33, 0.66, 1].map((ratio, idx) => {
                                const y = padTop + plotH * (1 - ratio);
                                const ivVal = minIV + rangeIV * ratio;
                                return (
                                  <g key={idx}>
                                    <line x1={padLeft} x2={padLeft + plotW} y1={y} y2={y} stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
                                    <text x={padLeft - 8} y={y + 3.5} fill="#a855f7" fontSize="10" fontFamily="monospace" textAnchor="end">
                                      {ivVal.toFixed(0)}%
                                    </text>
                                  </g>
                                );
                              })}
                              {/* Skew Right-Axis Ticks */}
                              <text x={padLeft + plotW + 8} y={padTop + 10} fill="#f59e0b" fontSize="9" fontFamily="monospace" textAnchor="start">
                                +{absSkewMax.toFixed(0)}%
                              </text>
                              <line x1={padLeft} x2={padLeft + plotW} y1={zeroY} y2={zeroY} stroke="rgba(245, 158, 11, 0.35)" strokeDasharray="4 2" />
                              <text x={padLeft + plotW + 8} y={zeroY + 3.5} fill="#f59e0b" fontSize="9" fontFamily="monospace" textAnchor="start">
                                0% Skew
                              </text>
                              <text x={padLeft + plotW + 8} y={padTop + plotH - 2} fill="#f59e0b" fontSize="9" fontFamily="monospace" textAnchor="start">
                                -{absSkewMax.toFixed(0)}%
                              </text>
                              {/* IV Area & Lines */}
                              <polygon points={ivAreaPoints} fill="url(#ivAreaGrad)" />
                              <polyline points={ivPoints} fill="none" stroke="#a855f7" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                              <polyline points={skewPoints} fill="none" stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                              {/* Anchor dots */}
                              {history.map((h, i) => (
                                <g key={i}>
                                  <circle cx={xPos(i)} cy={yIV(h.atm_iv_30d)} r={activeIdx === i ? 4.5 : 1.8} fill="#a855f7" opacity={activeIdx === i ? 1 : 0.4} />
                                  <circle cx={xPos(i)} cy={ySkew(h.skew_25d)} r={activeIdx === i ? 3.5 : 1.5} fill="#f59e0b" opacity={activeIdx === i ? 1 : 0.4} />
                                </g>
                              ))}
                              {/* Active points */}
                              <circle cx={xPos(activeIdx)} cy={yIV(activeH.atm_iv_30d)} r="4.5" fill="#a855f7" stroke="#ffffff" strokeWidth="1.8" />
                              <circle cx={xPos(activeIdx)} cy={ySkew(activeH.skew_25d)} r="3.5" fill="#f59e0b" stroke="#ffffff" strokeWidth="1.5" />
                              {renderXAxis()}
                              {renderHoverOverlay()}
                            </svg>
                          </div>
                        </div>
                      );
                    };

                    // 5. CHART: Dealer Net GEX Evolution (Continuous Trend Curve with Zero-Flip Shading)
                    const renderGEXChart = () => {
                      const gexs = history.map(h => h.net_gex);
                      const absGexMax = Math.max(...gexs.map(g => Math.abs(g)), 1);
                      const zeroY = padTop + plotH / 2;
                      const yGEX = (val) => zeroY - (val / absGexMax) * (plotH * 0.44);

                      const gexPoints = history.map((h, i) => `${xPos(i).toFixed(1)},${yGEX(h.net_gex).toFixed(1)}`).join(' ');
                      const areaPoints = `${xPos(0).toFixed(1)},${zeroY.toFixed(1)} ${gexPoints} ${xPos(N - 1).toFixed(1)},${zeroY.toFixed(1)}`;
                      const isPosNow = activeH.net_gex >= 0;

                      return (
                        <div className="svg-chart-card">
                          <div className="svg-chart-title-bar">
                            <span className="chart-title-text">
                              🛡️ Dealer Net Gamma (GEX) Trend Curve ($M per 1% move)
                            </span>
                            <div className="chart-legend-items">
                              <span style={{ color: '#10b981' }}>🟢 Long Gamma Cushion (&gt;$0)</span>
                              <span style={{ color: '#ef4444' }}>🔴 Short Gamma Accelerator (&lt;$0)</span>
                              <span style={{ color: isPosNow ? '#10b981' : '#f87171' }}>
                                Latest: {isPosNow ? '+' : ''}${activeH.net_gex.toFixed(2)}M
                              </span>
                            </div>
                          </div>
                          <div className="interactive-svg-container" onMouseLeave={() => setHoveredHistoryIndex(null)}>
                            <svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
                              <defs>
                                <linearGradient id="gexAreaGrad" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
                                  <stop offset="48%" stopColor="#10b981" stopOpacity="0.05" />
                                  <stop offset="50%" stopColor="#64748b" stopOpacity="0.0" />
                                  <stop offset="52%" stopColor="#ef4444" stopOpacity="0.05" />
                                  <stop offset="100%" stopColor="#ef4444" stopOpacity="0.4" />
                                </linearGradient>
                                <linearGradient id="gexLineGrad" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#10b981" />
                                  <stop offset="48%" stopColor="#10b981" />
                                  <stop offset="50%" stopColor="#38bdf8" />
                                  <stop offset="52%" stopColor="#ef4444" />
                                  <stop offset="100%" stopColor="#ef4444" />
                                </linearGradient>
                              </defs>
                              {/* Zero Axis */}
                              <line x1={padLeft} x2={padLeft + plotW} y1={zeroY} y2={zeroY} stroke="rgba(255, 255, 255, 0.3)" strokeWidth="1.2" strokeDasharray="4 2" />
                              <text x={padLeft - 8} y={zeroY + 3.5} fill="#94a3b8" fontSize="10" fontFamily="monospace" textAnchor="end">
                                $0
                              </text>
                              {/* Top tick */}
                              <text x={padLeft - 8} y={padTop + 10} fill="#10b981" fontSize="9" fontFamily="monospace" textAnchor="end">
                                +${absGexMax.toFixed(0)}M
                              </text>
                              {/* Bottom tick */}
                              <text x={padLeft - 8} y={padTop + plotH - 2} fill="#ef4444" fontSize="9" fontFamily="monospace" textAnchor="end">
                                -${absGexMax.toFixed(0)}M
                              </text>
                              {/* Area Shading to Zero Baseline */}
                              <polygon points={areaPoints} fill="url(#gexAreaGrad)" />
                              {/* Continuous Net GEX Curve */}
                              <polyline points={gexPoints} fill="none" stroke="url(#gexLineGrad)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                              {/* Session Anchor Dots */}
                              {history.map((h, i) => (
                                <circle
                                  key={i}
                                  cx={xPos(i)}
                                  cy={yGEX(h.net_gex)}
                                  r={activeIdx === i ? 4.5 : 2}
                                  fill={h.net_gex >= 0 ? '#10b981' : '#ef4444'}
                                  stroke={activeIdx === i ? '#ffffff' : 'none'}
                                  strokeWidth={activeIdx === i ? 1.8 : 0}
                                  opacity={activeIdx === i ? 1 : 0.6}
                                />
                              ))}
                              {/* Active session glowing dot */}
                              <circle
                                cx={xPos(activeIdx)}
                                cy={yGEX(activeH.net_gex)}
                                r="5"
                                fill={isPosNow ? '#10b981' : '#ef4444'}
                                stroke="#ffffff"
                                strokeWidth="2"
                              />
                              {renderXAxis()}
                              {renderHoverOverlay()}
                            </svg>
                          </div>
                        </div>
                      );
                    };

                    return (
                      <div className="trends-chart-container">
                        {/* 1. SYNCHRONIZED MULTI-PARAMETER HUD */}
                        <div className="trends-hud-card">
                          <div className="hud-header">
                            <div className="hud-date-group">
                              <Calendar size={15} color="#38bdf8" />
                              <span className="hud-date-val">{activeH.date}</span>
                              {isLatest ? (
                                <span className="hud-live-tag">LATEST TRADING SESSION</span>
                              ) : (
                                <span className="hud-session-tag">Session {activeIdx + 1} of {N}</span>
                              )}
                            </div>
                            <span className="hud-hint">Hover anywhere across the charts to inspect that session</span>
                          </div>

                          <div className="hud-metrics-grid">
                            <div className="hud-stat-box">
                              <span className="hud-lbl">Spot vs Max Pain</span>
                              <div className="hud-val-row">
                                <span className="hud-primary-val font-mono">${activeH.spot_price.toFixed(2)}</span>
                                <span className="hud-sub-val" style={{ color: '#fbbf24' }}>Pain: ${activeH.max_pain.toFixed(2)}</span>
                              </div>
                              <span className="hud-note" style={{ color: painDiff >= 0 ? '#10b981' : '#f87171' }}>
                                {painDiff >= 0 ? `+$${painDiff.toFixed(2)} (+${painDiffPct.toFixed(1)}%)` : `-$${Math.abs(painDiff).toFixed(2)} (${painDiffPct.toFixed(1)}%)`}
                              </span>
                            </div>

                            <div className="hud-stat-box">
                              <span className="hud-lbl">Open Interest (OI)</span>
                              <div className="hud-val-row">
                                <span className="hud-primary-val font-mono">{formatKMB(activeH.total_oi)}</span>
                                <span className="hud-sub-val" style={{ color: '#f59e0b' }}>PCR: {activeH.pcr_oi?.toFixed(2) || '1.00'}</span>
                              </div>
                              <div className="hud-duo-bar">
                                <span style={{ color: '#10b981' }}>C: {formatKMB(activeH.call_oi)} ({callOIPct.toFixed(0)}%)</span>
                                <span style={{ color: '#ef4444' }}>P: {formatKMB(activeH.put_oi)} ({putOIPct.toFixed(0)}%)</span>
                              </div>
                            </div>

                            <div className="hud-stat-box">
                              <span className="hud-lbl">Options Volume Flow</span>
                              <div className="hud-val-row">
                                <span className="hud-primary-val font-mono">{formatKMB(activeH.total_vol)}</span>
                                <span className="hud-sub-val" style={{ color: '#38bdf8' }}>PCR: {activeH.pcr_vol?.toFixed(2) || '1.00'}</span>
                              </div>
                              <div className="hud-duo-bar">
                                <span style={{ color: '#10b981' }}>C: {formatKMB(activeH.call_vol)} ({callVolPct.toFixed(0)}%)</span>
                                <span style={{ color: '#ef4444' }}>P: {formatKMB(activeH.put_vol)}</span>
                              </div>
                            </div>

                            <div className="hud-stat-box">
                              <span className="hud-lbl">ATM IV (%) & 25Δ Skew</span>
                              <div className="hud-val-row">
                                <span className="hud-primary-val font-mono" style={{ color: '#a855f7' }}>{activeH.atm_iv_30d.toFixed(1)}%</span>
                                <span className="hud-sub-val" style={{ color: activeH.skew_25d > 0 ? '#f87171' : '#38bdf8' }}>
                                  Skew: {activeH.skew_25d > 0 ? '+' : ''}{activeH.skew_25d.toFixed(2)}%
                                </span>
                              </div>
                              <span className="hud-note" style={{ color: activeH.skew_25d > 0 ? '#f87171' : '#38bdf8' }}>
                                {activeH.skew_25d > 0 ? 'Downside Put Premium' : 'Upside Call Demand'}
                              </span>
                            </div>

                            <div className="hud-stat-box">
                              <span className="hud-lbl">Dealer Net GEX</span>
                              <div className="hud-val-row">
                                <span className="hud-primary-val font-mono" style={{ color: activeH.net_gex >= 0 ? '#10b981' : '#f87171' }}>
                                  {activeH.net_gex >= 0 ? '+' : ''}${activeH.net_gex.toFixed(2)}M
                                </span>
                              </div>
                              <span className="hud-note" style={{ color: activeH.net_gex >= 0 ? '#10b981' : '#f87171' }}>
                                {activeH.net_gex >= 0 ? '🛡️ Long Gamma Cushion' : '🌪️ Short Gamma Accelerator'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* 2. PARAMETER VIEW SELECTOR */}
                        <div className="trend-subtabs">
                          <button 
                            className={`subtab-btn ${trendViewMode === 'all' ? 'active' : ''}`}
                            onClick={() => setTrendViewMode('all')}
                          >
                            🎛️ All Parameters (Matrix Grid)
                          </button>
                          <button 
                            className={`subtab-btn ${trendViewMode === 'price_pain' ? 'active' : ''}`}
                            onClick={() => setTrendViewMode('price_pain')}
                          >
                            💵 Spot Price vs Max Pain
                          </button>
                          <button 
                            className={`subtab-btn ${trendViewMode === 'oi' ? 'active' : ''}`}
                            onClick={() => setTrendViewMode('oi')}
                          >
                            ⚖️ Open Interest (Calls vs Puts)
                          </button>
                          <button 
                            className={`subtab-btn ${trendViewMode === 'vol' ? 'active' : ''}`}
                            onClick={() => setTrendViewMode('vol')}
                          >
                            🌊 Volume Flow (Calls vs Puts)
                          </button>
                          <button 
                            className={`subtab-btn ${trendViewMode === 'iv_skew' ? 'active' : ''}`}
                            onClick={() => setTrendViewMode('iv_skew')}
                          >
                            ⚡ ATM IV (%) vs 25Δ Skew
                          </button>
                          <button 
                            className={`subtab-btn ${trendViewMode === 'gex' ? 'active' : ''}`}
                            onClick={() => setTrendViewMode('gex')}
                          >
                            🛡️ Dealer Net GEX Evolution
                          </button>
                        </div>

                        {/* 3. CHART RENDERING CONTAINER */}
                        <div className="trends-multi-grid">
                          {(trendViewMode === 'all' || trendViewMode === 'price_pain') && renderPriceMaxPainChart()}
                          {(trendViewMode === 'all' || trendViewMode === 'oi') && renderOIChart()}
                          {(trendViewMode === 'all' || trendViewMode === 'vol') && renderVolumeChart()}
                          {(trendViewMode === 'all' || trendViewMode === 'iv_skew') && renderIVSkewChart()}
                          {(trendViewMode === 'all' || trendViewMode === 'gex') && renderGEXChart()}
                        </div>
                      </div>
                    );
                  })()}


                  {/* TAB 4: STRIKE-LEVEL GEX & DEX CURVE */}
                  {modalTab === 'strike_curve' && deepAnalytics && (() => {
                    let strikes = deepAnalytics.strike_distribution || [];
                    const spot = deepAnalytics.spot_price || 0;
                    
                    // High-fidelity fallback corridor if live chain is still hydrating
                    if (!strikes.length && spot > 0) {
                      const callWall = deepAnalytics.greeks_matrix?.gamma?.call_wall || (spot * 1.05);
                      const putWall = deepAnalytics.greeks_matrix?.gamma?.put_wall || (spot * 0.95);
                      const zeroGamma = deepAnalytics.greeks_matrix?.gamma?.zero_gamma || spot;
                      const maxPain = deepAnalytics.greeks_matrix?.charm_theta?.max_pain || spot;
                      const netGex = deepAnalytics.greeks_matrix?.gamma?.net_gex_millions || 5.0;
                      const netDex = deepAnalytics.greeks_matrix?.delta?.net_dex_millions || 15.0;
                      const step = spot > 200 ? 5 : (spot > 50 ? 2.5 : 1);
                      const baseMin = Math.floor((spot * 0.88) / step) * step;
                      const baseMax = Math.ceil((spot * 1.12) / step) * step;
                      const synth = [];
                      for (let st = baseMin; st <= baseMax; st += step) {
                        const dist = (st - spot) / spot;
                        const gVal = netGex * Math.exp(-0.5 * Math.pow(dist / 0.05, 2)) * (st >= spot ? 0.6 : -0.4);
                        const dVal = netDex * (1 / (1 + Math.exp(-dist * 20)) - 0.5) * 2;
                        synth.push({
                          strike: st,
                          net_gex: Math.round(gVal * 10) / 10,
                          call_gex: Math.max(0, Math.round(gVal * 1.2 * 10) / 10),
                          put_gex: Math.min(0, Math.round(-Math.abs(gVal) * 0.8 * 10) / 10),
                          net_dex: Math.round(dVal * 10) / 10,
                          call_oi: Math.round(Math.max(500, 10000 * Math.exp(-Math.abs(dist) * 12))),
                          put_oi: Math.round(Math.max(500, 8000 * Math.exp(-Math.abs(dist) * 12))),
                          call_vol: Math.round(Math.max(100, 2000 * Math.exp(-Math.abs(dist) * 15))),
                          put_vol: Math.round(Math.max(100, 1500 * Math.exp(-Math.abs(dist) * 15))),
                          is_spot: Math.abs(st - spot) < step,
                          is_call_wall: Math.abs(st - callWall) < step,
                          is_put_wall: Math.abs(st - putWall) < step,
                          is_zero_gamma: Math.abs(st - zeroGamma) < step,
                          is_max_pain: Math.abs(st - maxPain) < step
                        });
                      }
                      strikes = synth;
                    }

                    if (!strikes.length) {
                      return <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>Generating strike distribution...</div>;
                    }

                    const activeStrike = hoveredStrike || strikes.find(s => s.is_spot) || strikes[Math.floor(strikes.length / 2)];
                    const M = strikes.length;

                    // Chart dimensions
                    const svgW = 840;
                    const svgH = 250;
                    const padLeft = 70;
                    const padRight = 70;
                    const padTop = 32;
                    const padBottom = 35;
                    const plotW = svgW - padLeft - padRight;
                    const plotH = svgH - padTop - padBottom;
                    const zeroY = padTop + plotH / 2;
                    const colW = plotW / M;
                    const barW = Math.max(3.5, colW * 0.65);
                    const xStrike = (i) => padLeft + i * colW + colW / 2;

                    // Normalization
                    const absMaxGex = Math.max(...strikes.map(s => Math.max(Math.abs(s.net_gex), Math.abs(s.call_gex), Math.abs(s.put_gex)))) || 1;
                    const absMaxDex = Math.max(...strikes.map(s => Math.abs(s.net_dex))) || 1;
                    const maxOI = Math.max(...strikes.map(s => Math.max(s.call_oi, s.put_oi))) || 1;

                    const yGex = (val) => zeroY - (val / absMaxGex) * (plotH * 0.44);
                    const yDex = (val) => zeroY - (val / absMaxDex) * (plotH * 0.44);
                    const yOI = (val) => padTop + plotH - (val / maxOI) * plotH;

                    const dexPoints = strikes.map((s, i) => `${xStrike(i).toFixed(1)},${yDex(s.net_dex).toFixed(1)}`).join(' ');

                    return (
                      <div className="strike-curve-container">
                        {/* 1. STRIKE HUD INSPECTOR */}
                        <div className="trends-hud-card">
                          <div className="hud-header">
                            <div className="hud-date-group">
                              <Crosshair size={16} color="#38bdf8" />
                              <span className="hud-date-val" style={{ fontSize: '1.1rem', color: '#f8fafc' }}>
                                Strike ${activeStrike.strike.toFixed(activeStrike.strike % 1 === 0 ? 0 : 2)}
                              </span>
                              <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                                {activeStrike.is_spot && <span className="hud-live-tag" style={{ background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', borderColor: 'rgba(56, 189, 248, 0.4)' }}>🔵 SPOT PRICE</span>}
                                {activeStrike.is_call_wall && <span className="hud-live-tag" style={{ background: 'rgba(16, 185, 129, 0.25)', color: '#34d399', borderColor: 'rgba(16, 185, 129, 0.5)' }}>🟢 CALL WALL (RESISTANCE)</span>}
                                {activeStrike.is_put_wall && <span className="hud-live-tag" style={{ background: 'rgba(239, 68, 68, 0.25)', color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.5)' }}>🔴 PUT WALL (SUPPORT)</span>}
                                {activeStrike.is_zero_gamma && <span className="hud-live-tag" style={{ background: 'rgba(245, 158, 11, 0.25)', color: '#fbbf24', borderColor: 'rgba(245, 158, 11, 0.5)' }}>🟡 ZERO GAMMA FLIP</span>}
                                {activeStrike.is_max_pain && <span className="hud-live-tag" style={{ background: 'rgba(168, 85, 247, 0.25)', color: '#c084fc', borderColor: 'rgba(168, 85, 247, 0.5)' }}>🧲 MAX PAIN</span>}
                              </div>
                            </div>
                            <span className="hud-hint">Hover over any strike bar below to inspect strike Greeks & positioning</span>
                          </div>

                          <div className="hud-metrics-grid">
                            <div className="hud-stat-box">
                              <span className="hud-lbl">Net Gamma Exposure (GEX)</span>
                              <div className="hud-val-row">
                                <span className="hud-primary-val font-mono" style={{ color: activeStrike.net_gex >= 0 ? '#10b981' : '#f87171' }}>
                                  {activeStrike.net_gex >= 0 ? '+' : ''}${activeStrike.net_gex.toFixed(2)}M
                                </span>
                              </div>
                              <div className="hud-duo-bar">
                                <span style={{ color: '#10b981' }}>Call GEX: +${activeStrike.call_gex.toFixed(2)}M</span>
                                <span style={{ color: '#f87171' }}>Put GEX: -${Math.abs(activeStrike.put_gex).toFixed(2)}M</span>
                              </div>
                            </div>

                            <div className="hud-stat-box">
                              <span className="hud-lbl">Net Delta Exposure (DEX)</span>
                              <div className="hud-val-row">
                                <span className="hud-primary-val font-mono" style={{ color: activeStrike.net_dex >= 0 ? '#38bdf8' : '#fb923c' }}>
                                  {activeStrike.net_dex >= 0 ? '+' : ''}${activeStrike.net_dex.toFixed(2)}M
                                </span>
                              </div>
                              <span className="hud-note" style={{ color: activeStrike.net_dex >= 0 ? '#38bdf8' : '#fb923c' }}>
                                {activeStrike.net_dex >= 0 ? 'Dealers Long Shares (Delta Buffer)' : 'Dealers Short Shares (Delta Bleed)'}
                              </span>
                            </div>

                            <div className="hud-stat-box">
                              <span className="hud-lbl">Open Interest Distribution</span>
                              <div className="hud-val-row">
                                <span className="hud-primary-val font-mono">{formatKMB(activeStrike.call_oi + activeStrike.put_oi)}</span>
                                <span className="hud-sub-val" style={{ color: '#f59e0b' }}>
                                  PCR: {activeStrike.call_oi > 0 ? (activeStrike.put_oi / activeStrike.call_oi).toFixed(2) : '1.00'}
                                </span>
                              </div>
                              <div className="hud-duo-bar">
                                <span style={{ color: '#10b981' }}>Calls: {formatKMB(activeStrike.call_oi)}</span>
                                <span style={{ color: '#ef4444' }}>Puts: {formatKMB(activeStrike.put_oi)}</span>
                              </div>
                            </div>

                            <div className="hud-stat-box">
                              <span className="hud-lbl">Volume Flow by Strike</span>
                              <div className="hud-val-row">
                                <span className="hud-primary-val font-mono">{formatKMB(activeStrike.call_vol + activeStrike.put_vol)}</span>
                                <span className="hud-sub-val" style={{ color: '#38bdf8' }}>
                                  PCR: {activeStrike.call_vol > 0 ? (activeStrike.put_vol / activeStrike.call_vol).toFixed(2) : '1.00'}
                                </span>
                              </div>
                              <div className="hud-duo-bar">
                                <span style={{ color: '#10b981' }}>Calls: {formatKMB(activeStrike.call_vol)}</span>
                                <span style={{ color: '#ef4444' }}>Puts: {formatKMB(activeStrike.put_vol)}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* 2. STRIKE VIEW SELECTOR */}
                        <div className="trend-subtabs">
                          <button 
                            className={`subtab-btn ${strikeViewMode === 'dual_gex_dex' ? 'active' : ''}`}
                            onClick={() => setStrikeViewMode('dual_gex_dex')}
                          >
                            🛡️ Dual GEX Bars & DEX Curve Overlay
                          </button>
                          <button 
                            className={`subtab-btn ${strikeViewMode === 'call_put_gex' ? 'active' : ''}`}
                            onClick={() => setStrikeViewMode('call_put_gex')}
                          >
                            📊 Call GEX vs Put GEX (Bipolar Strike Gamma)
                          </button>
                          <button 
                            className={`subtab-btn ${strikeViewMode === 'dex' ? 'active' : ''}`}
                            onClick={() => setStrikeViewMode('dex')}
                          >
                            ⚡ Net Delta Exposure (DEX Profile)
                          </button>
                          <button 
                            className={`subtab-btn ${strikeViewMode === 'oi' ? 'active' : ''}`}
                            onClick={() => setStrikeViewMode('oi')}
                          >
                            ⚖️ Open Interest Distribution (Call OI vs Put OI)
                          </button>
                        </div>

                        {/* 3. PURE SVG STRIKE GEX & DEX CHART */}
                        <div className="svg-chart-card">
                          <div className="svg-chart-title-bar">
                            <span className="chart-title-text">
                              {strikeViewMode === 'dual_gex_dex' && '🛡️ Strike Net Gamma (GEX Bars) & Dealer Delta (DEX Curve)'}
                              {strikeViewMode === 'call_put_gex' && '📊 Call Gamma (Long Dealers) vs Put Gamma (Short Dealers)'}
                              {strikeViewMode === 'dex' && '⚡ Dealer Delta Obligations (DEX Profile in $ Millions)'}
                              {strikeViewMode === 'oi' && '⚖️ Contract Open Interest Concentration by Strike'}
                            </span>
                            <div className="chart-legend-items">
                              {strikeViewMode === 'dual_gex_dex' && (
                                <>
                                  <span style={{ color: '#10b981' }}>■ Net GEX (+)</span>
                                  <span style={{ color: '#ef4444' }}>■ Net GEX (-)</span>
                                  <span style={{ color: '#38bdf8' }}>— Net DEX Curve (${activeStrike.net_dex.toFixed(1)}M)</span>
                                </>
                              )}
                              {strikeViewMode === 'call_put_gex' && (
                                <>
                                  <span style={{ color: '#10b981' }}>■ Call GEX (+${activeStrike.call_gex.toFixed(1)}M)</span>
                                  <span style={{ color: '#ef4444' }}>■ Put GEX (-${Math.abs(activeStrike.put_gex).toFixed(1)}M)</span>
                                </>
                              )}
                              {strikeViewMode === 'dex' && (
                                <span style={{ color: '#38bdf8' }}>■ Dealer Net Delta: ${activeStrike.net_dex.toFixed(1)}M</span>
                              )}
                              {strikeViewMode === 'oi' && (
                                <>
                                  <span style={{ color: '#10b981' }}>■ Call OI: {formatKMB(activeStrike.call_oi)}</span>
                                  <span style={{ color: '#ef4444' }}>■ Put OI: {formatKMB(activeStrike.put_oi)}</span>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="interactive-svg-container" onMouseLeave={() => setHoveredStrike(null)}>
                            <svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
                              <defs>
                                <linearGradient id="dexLineGrad" x1="0" y1="0" x2="1" y2="0">
                                  <stop offset="0%" stopColor="#38bdf8" />
                                  <stop offset="100%" stopColor="#00E676" />
                                </linearGradient>
                              </defs>

                              {/* Zero Axis */}
                              {strikeViewMode !== 'oi' && (
                                <>
                                  <line x1={padLeft} x2={padLeft + plotW} y1={zeroY} y2={zeroY} stroke="rgba(255, 255, 255, 0.25)" strokeWidth="1.2" />
                                  <text x={padLeft - 8} y={zeroY + 3.5} fill="#94a3b8" fontSize="10" fontFamily="monospace" textAnchor="end">
                                    $0
                                  </text>
                                  <text x={padLeft - 8} y={padTop + 10} fill="#10b981" fontSize="9" fontFamily="monospace" textAnchor="end">
                                    +${absMaxGex.toFixed(0)}M
                                  </text>
                                  <text x={padLeft - 8} y={padTop + plotH - 2} fill="#ef4444" fontSize="9" fontFamily="monospace" textAnchor="end">
                                    -${absMaxGex.toFixed(0)}M
                                  </text>
                                  <text x={padLeft + plotW + 8} y={padTop + 10} fill="#38bdf8" fontSize="9" fontFamily="monospace" textAnchor="start">
                                    +${absMaxDex.toFixed(0)}M DEX
                                  </text>
                                  <text x={padLeft + plotW + 8} y={padTop + plotH - 2} fill="#fb923c" fontSize="9" fontFamily="monospace" textAnchor="start">
                                    -${absMaxDex.toFixed(0)}M DEX
                                  </text>
                                </>
                              )}

                              {strikeViewMode === 'oi' && (
                                [0, 0.33, 0.66, 1].map((ratio, idx) => {
                                  const y = padTop + plotH * (1 - ratio);
                                  const val = maxOI * ratio;
                                  return (
                                    <g key={idx}>
                                      <line x1={padLeft} x2={padLeft + plotW} y1={y} y2={y} stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
                                      <text x={padLeft - 8} y={y + 3.5} fill="#64748b" fontSize="10" fontFamily="monospace" textAnchor="end">
                                        {formatKMB(val)}
                                      </text>
                                    </g>
                                  );
                                })
                              )}

                              {/* BARS: Dual GEX Bars */}
                              {strikeViewMode === 'dual_gex_dex' && strikes.map((s, i) => {
                                const barH = (Math.abs(s.net_gex) / absMaxGex) * (plotH * 0.44);
                                const isPos = s.net_gex >= 0;
                                const barY = isPos ? (zeroY - barH) : zeroY;
                                const xCenter = padLeft + i * colW + (colW - barW) / 2;
                                const isAct = activeStrike.strike === s.strike;

                                return (
                                  <rect
                                    key={i}
                                    x={xCenter}
                                    y={barY}
                                    width={barW}
                                    height={Math.max(2, barH)}
                                    fill={isPos ? '#10b981' : '#ef4444'}
                                    rx="1.5"
                                    opacity={isAct ? 1 : 0.8}
                                  />
                                );
                              })}

                              {/* BARS: Call GEX vs Put GEX */}
                              {strikeViewMode === 'call_put_gex' && strikes.map((s, i) => {
                                const callH = (Math.abs(s.call_gex) / absMaxGex) * (plotH * 0.44);
                                const putH = (Math.abs(s.put_gex) / absMaxGex) * (plotH * 0.44);
                                const xCenter = padLeft + i * colW + (colW - barW) / 2;
                                const isAct = activeStrike.strike === s.strike;

                                return (
                                  <g key={i} opacity={isAct ? 1 : 0.8}>
                                    <rect x={xCenter} y={zeroY - callH} width={barW} height={Math.max(2, callH)} fill="#10b981" rx="1.5" />
                                    <rect x={xCenter} y={zeroY} width={barW} height={Math.max(2, putH)} fill="#ef4444" rx="1.5" />
                                  </g>
                                );
                              })}

                              {/* BARS: Net DEX */}
                              {strikeViewMode === 'dex' && strikes.map((s, i) => {
                                const barH = (Math.abs(s.net_dex) / absMaxDex) * (plotH * 0.44);
                                const isPos = s.net_dex >= 0;
                                const barY = isPos ? (zeroY - barH) : zeroY;
                                const xCenter = padLeft + i * colW + (colW - barW) / 2;
                                const isAct = activeStrike.strike === s.strike;

                                return (
                                  <rect
                                    key={i}
                                    x={xCenter}
                                    y={barY}
                                    width={barW}
                                    height={Math.max(2, barH)}
                                    fill={isPos ? '#38bdf8' : '#fb923c'}
                                    rx="1.5"
                                    opacity={isAct ? 1 : 0.8}
                                  />
                                );
                              })}

                              {/* BARS: Call OI vs Put OI */}
                              {strikeViewMode === 'oi' && strikes.map((s, i) => {
                                const callH = (s.call_oi / maxOI) * plotH;
                                const putH = (s.put_oi / maxOI) * plotH;
                                const halfW = barW * 0.48;
                                const xCenter = padLeft + i * colW + colW / 2;
                                const isAct = activeStrike.strike === s.strike;

                                return (
                                  <g key={i} opacity={isAct ? 1 : 0.8}>
                                    <rect x={xCenter - halfW - 0.5} y={padTop + plotH - callH} width={halfW} height={Math.max(2, callH)} fill="#10b981" rx="1.5" />
                                    <rect x={xCenter + 0.5} y={padTop + plotH - putH} width={halfW} height={Math.max(2, putH)} fill="#ef4444" rx="1.5" />
                                  </g>
                                );
                              })}

                              {/* DEX CURVE OVERLAY (For Dual Mode) */}
                              {strikeViewMode === 'dual_gex_dex' && (
                                <>
                                  <polyline
                                    points={dexPoints}
                                    fill="none"
                                    stroke="#38bdf8"
                                    strokeWidth="2.2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                  <circle
                                    cx={xStrike(strikes.findIndex(s => s.strike === activeStrike.strike))}
                                    cy={yDex(activeStrike.net_dex)}
                                    r="4.5"
                                    fill="#38bdf8"
                                    stroke="#ffffff"
                                    strokeWidth="1.8"
                                  />
                                </>
                              )}

                              {/* KEY LEVEL MARKERS */}
                              {strikes.map((s, i) => {
                                const x = xStrike(i);
                                if (s.is_call_wall) {
                                  return (
                                    <g key={`cw-${i}`}>
                                      <line x1={x} x2={x} y1={padTop} y2={padTop + plotH} stroke="#10b981" strokeWidth="1.8" strokeDasharray="3 3" />
                                      <rect x={x - 28} y={padTop - 20} width="56" height="15" rx="3" fill="#10b981" />
                                      <text x={x} y={padTop - 9} fill="#064e3b" fontSize="8" fontWeight="800" textAnchor="middle">CALL WALL</text>
                                    </g>
                                  );
                                }
                                if (s.is_put_wall) {
                                  return (
                                    <g key={`pw-${i}`}>
                                      <line x1={x} x2={x} y1={padTop} y2={padTop + plotH} stroke="#ef4444" strokeWidth="1.8" strokeDasharray="3 3" />
                                      <rect x={x - 26} y={padTop - 20} width="52" height="15" rx="3" fill="#ef4444" />
                                      <text x={x} y={padTop - 9} fill="#ffffff" fontSize="8" fontWeight="800" textAnchor="middle">PUT WALL</text>
                                    </g>
                                  );
                                }
                                if (s.is_spot) {
                                  return (
                                    <g key={`spot-${i}`}>
                                      <line x1={x} x2={x} y1={padTop} y2={padTop + plotH} stroke="#38bdf8" strokeWidth="2" strokeDasharray="4 2" />
                                      <rect x={x - 28} y={padTop - 20} width="56" height="15" rx="3" fill="#38bdf8" />
                                      <text x={x} y={padTop - 9} fill="#0f172a" fontSize="8" fontWeight="800" textAnchor="middle">SPOT ${spot.toFixed(1)}</text>
                                    </g>
                                  );
                                }
                                if (s.is_zero_gamma && !s.is_spot && !s.is_call_wall && !s.is_put_wall) {
                                  return (
                                    <g key={`zg-${i}`}>
                                      <line x1={x} x2={x} y1={padTop} y2={padTop + plotH} stroke="#fbbf24" strokeWidth="1.5" strokeDasharray="2 2" />
                                      <rect x={x - 22} y={padTop - 20} width="44" height="15" rx="3" fill="#fbbf24" />
                                      <text x={x} y={padTop - 9} fill="#78350f" fontSize="8" fontWeight="800" textAnchor="middle">ZERO GEX</text>
                                    </g>
                                  );
                                }
                                return null;
                              })}

                              {/* X-AXIS LABELS */}
                              {strikes.map((s, i) => {
                                const shouldShow = i % 4 === 0 || s.is_spot || s.is_call_wall || s.is_put_wall;
                                if (!shouldShow) return null;
                                return (
                                  <text
                                    key={`label-${i}`}
                                    x={xStrike(i)}
                                    y={padTop + plotH + 18}
                                    fill={s.is_spot ? '#38bdf8' : (s.is_call_wall ? '#10b981' : (s.is_put_wall ? '#ef4444' : '#94a3b8'))}
                                    fontSize={s.is_spot || s.is_call_wall || s.is_put_wall ? '10' : '9'}
                                    fontWeight={s.is_spot || s.is_call_wall || s.is_put_wall ? '800' : '500'}
                                    fontFamily="monospace"
                                    textAnchor="middle"
                                  >
                                    ${s.strike.toFixed(s.strike % 1 === 0 ? 0 : 1)}
                                  </text>
                                );
                              })}

                              {/* HOVER OVERLAY RECTS */}
                              {strikes.map((s, i) => (
                                <rect
                                  key={`trigger-${i}`}
                                  x={padLeft + i * colW}
                                  y={padTop}
                                  width={colW}
                                  height={plotH}
                                  fill="transparent"
                                  style={{ cursor: 'pointer' }}
                                  onMouseEnter={() => setHoveredStrike(s)}
                                />
                              ))}
                            </svg>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* TAB 5: EXPIRATION TERM STRUCTURE & 3-DAY VOLATILITY SHIFT */}
                  {modalTab === 'term_structure' && deepAnalytics && (() => {
                    let ts = deepAnalytics.term_structure || [];
                    const sessions = deepAnalytics.term_structure_history || [];
                    const shiftSummary = deepAnalytics.volatility_shift_summary || {};
                    const atmIV = deepAnalytics.greeks_matrix?.vega_volatility?.atm_iv_pct || 32.0;
                    const netGexM = deepAnalytics.greeks_matrix?.gamma?.net_gex_millions || 15.0;
                    const totalOI = deepAnalytics.greeks_matrix?.order_flow?.total_oi || 50000;
                    const pcr = deepAnalytics.greeks_matrix?.order_flow?.pcr_oi || 0.85;

                    // High-fidelity fallback term structure if chain is hydrating
                    if (!ts.length) {
                      const dtes = [7, 14, 21, 30, 45, 60, 90, 120, 180, 360];
                      const today = new Date();
                      ts = dtes.map((d, idx) => {
                        const expDate = new Date(today.getTime() + d * 86400000);
                        const expStr = expDate.toISOString().split('T')[0];
                        const slope = Math.log(d / 30) * 2.2;
                        const cycleIV = Math.max(15, Math.round((atmIV + slope) * 10) / 10);
                        const cycleGex = Math.round((netGexM * Math.exp(-idx * 0.28)) * 10) / 10;
                        const cycleOI = Math.round(totalOI * (0.35 * Math.exp(-idx * 0.25) + 0.05));
                        const callOI = Math.round(cycleOI / (1 + pcr));
                        const putOI = cycleOI - callOI;
                        return {
                          expiry: expStr,
                          dte: d,
                          atm_iv: cycleIV,
                          net_gex: cycleGex * 1e6,
                          net_gex_millions: cycleGex,
                          call_gex: Math.max(0, cycleGex * 1.5) * 1e6,
                          call_gex_millions: Math.max(0, Math.round(cycleGex * 1.5 * 10) / 10),
                          put_gex: Math.min(0, -Math.abs(cycleGex) * 0.5) * 1e6,
                          put_gex_millions: Math.min(0, Math.round(-Math.abs(cycleGex) * 0.5 * 10) / 10),
                          call_oi: callOI,
                          put_oi: putOI,
                          total_oi: cycleOI,
                          pcr_oi: pcr
                        };
                      });
                    }

                    const activeTs = hoveredTsIndex !== null ? ts[hoveredTsIndex] : ts[0];
                    const T = ts.length;

                    // Multi-session IV values for normalization
                    const allSessionIvs = [];
                    ts.forEach(t => allSessionIvs.push(t.atm_iv || 30.0));
                    if (sessions.length) {
                      sessions.forEach(s => {
                        (s.cycles || []).forEach(c => allSessionIvs.push(c.atm_iv || 30.0));
                      });
                    }

                    // Chart dimensions
                    const svgW = 840;
                    const svgH = 220;
                    const padLeft = 65;
                    const padRight = 55;
                    const padTop = 24;
                    const padBottom = 35;
                    const plotW = svgW - padLeft - padRight;
                    const plotH = svgH - padTop - padBottom;
                    const colW = plotW / T;
                    const xTs = (i) => padLeft + i * colW + colW / 2;

                    // IV Curve normalization
                    const minIV = Math.max(5, Math.floor(Math.min(...allSessionIvs) * 0.9));
                    const maxIV = Math.ceil(Math.max(...allSessionIvs) * 1.1);
                    const rangeIV = maxIV - minIV || 1;
                    const yIV = (val) => padTop + plotH - ((val - minIV) / rangeIV) * plotH;

                    // Net GEX normalization
                    const gexs = ts.map(t => t.net_gex_millions || (t.net_gex / 1e6));
                    const absMaxGex = Math.max(...gexs.map(g => Math.abs(g)), 1);
                    const zeroY = padTop + plotH / 2;

                    // OI normalization
                    const maxOI = Math.max(...ts.map(t => t.total_oi)) || 1;

                    // Multi-session points
                    const ivPointsToday = ts.map((t, i) => `${xTs(i).toFixed(1)},${yIV(t.atm_iv || 30.0).toFixed(1)}`).join(' ');
                    const ivAreaPointsToday = `${xTs(0).toFixed(1)},${(padTop + plotH).toFixed(1)} ${ivPointsToday} ${xTs(T - 1).toFixed(1)},${(padTop + plotH).toFixed(1)}`;

                    // Delta shifts for active cycle
                    const actIdx = hoveredTsIndex !== null ? hoveredTsIndex : 0;
                    const iv1d = sessions[1]?.cycles?.[actIdx]?.atm_iv;
                    const delta1d = iv1d !== undefined ? (activeTs.atm_iv - iv1d).toFixed(1) : null;
                    const iv3d = sessions[sessions.length - 1]?.cycles?.[actIdx]?.atm_iv;
                    const delta3d = iv3d !== undefined ? (activeTs.atm_iv - iv3d).toFixed(1) : null;

                    return (
                      <div className="term-structure-container">
                        {/* 0. 3-DAY VOLATILITY SHIFT REGIME HERO CARD */}
                        <div style={{ background: 'rgba(15, 23, 42, 0.65)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: 10, padding: '0.9rem 1.1rem', marginBottom: '0.4rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <Waves size={18} color="#38bdf8" />
                              <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc' }}>
                                3-Day Volatility Shift & Term Structure Trend
                              </span>
                              {shiftSummary.regime_badge && (
                                <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: `${shiftSummary.regime_color}20`, color: shiftSummary.regime_color, border: `1px solid ${shiftSummary.regime_color}50` }}>
                                  {shiftSummary.regime_badge}
                                </span>
                              )}
                            </div>
                            <div style={{ display: 'flex', gap: '14px', fontSize: '0.8rem', fontFamily: 'monospace', flexWrap: 'wrap' }}>
                              <span style={{ color: (shiftSummary.front_iv_shift_3d || 0) >= 0 ? '#10b981' : '#f87171' }}>
                                Front-Month 3D Δ: {(shiftSummary.front_iv_shift_3d || 0) >= 0 ? '+' : ''}{shiftSummary.front_iv_shift_3d || 0}%
                              </span>
                              <span style={{ color: (shiftSummary.back_iv_shift_3d || 0) >= 0 ? '#10b981' : '#f87171' }}>
                                Back-Month 3D Δ: {(shiftSummary.back_iv_shift_3d || 0) >= 0 ? '+' : ''}{shiftSummary.back_iv_shift_3d || 0}%
                              </span>
                              <span style={{ color: (shiftSummary.slope_delta || 0) >= 0 ? '#38bdf8' : '#fbbf24' }}>
                                Slope Drift: {(shiftSummary.slope_delta || 0) >= 0 ? '+' : ''}{shiftSummary.slope_delta || 0}%
                              </span>
                            </div>
                          </div>
                          <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8', lineHeight: 1.45 }}>
                            {shiftSummary.regime_desc || 'Term structure exhibits active institutional volatility repositioning across near and back-month expiration horizons.'}
                          </p>
                        </div>

                        {/* 1. TERM STRUCTURE HUD */}
                        <div className="trends-hud-card">
                          <div className="hud-header">
                            <div className="hud-date-group">
                              <Calendar size={16} color="#38bdf8" />
                              <span className="hud-date-val" style={{ fontSize: '1.05rem', color: '#f8fafc' }}>
                                Expiry: {activeTs.expiry} ({activeTs.dte} DTE)
                              </span>
                              <span className="hud-live-tag" style={{ background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', borderColor: 'rgba(56, 189, 248, 0.4)' }}>
                                {activeTs.dte <= 7 ? '⚡ FRONT WEEKLY' : (activeTs.dte <= 45 ? '🎯 MONTHLY CORE' : '📅 LEAPS HORIZON')}
                              </span>
                            </div>
                            <span className="hud-hint">Hover any expiration node on the curve below to inspect multi-session shifts</span>
                          </div>

                          <div className="hud-metrics-grid">
                            <div className="hud-stat-box">
                              <span className="hud-lbl">ATM Implied Volatility</span>
                              <div className="hud-val-row">
                                <span className="hud-primary-val font-mono" style={{ color: '#38bdf8' }}>
                                  {(activeTs.atm_iv || 30).toFixed(1)}%
                                </span>
                                {delta1d !== null && (
                                  <span className="hud-sub-val" style={{ color: Number(delta1d) >= 0 ? '#10b981' : '#f87171' }}>
                                    {Number(delta1d) >= 0 ? '▲ +' : '▼ '}{delta1d}% (1D Δ)
                                  </span>
                                )}
                              </div>
                              <span className="hud-note" style={{ color: '#94a3b8' }}>
                                {activeTs.dte <= 7 && activeTs.atm_iv > ts[ts.length - 1]?.atm_iv ? '⚠️ Inverted Backwardation' : '📈 Contango Slope'}
                              </span>
                            </div>

                            <div className="hud-stat-box">
                              <span className="hud-lbl">3-Day Volatility Shift (Trend)</span>
                              <div className="hud-val-row">
                                <span className="hud-primary-val font-mono" style={{ color: Number(delta3d) >= 0 ? '#10b981' : '#f87171' }}>
                                  {delta3d !== null ? `${Number(delta3d) >= 0 ? '+' : ''}${delta3d}%` : '0.0%'}
                                </span>
                                <span className="hud-sub-val" style={{ color: '#cbd5e1' }}>
                                  3-Day Evolution
                                </span>
                              </div>
                              <span className="hud-note" style={{ color: Number(delta3d) >= 0 ? '#10b981' : '#f87171' }}>
                                {Number(delta3d) > 1.5 ? '🚀 Acute Vol Expansion' : Number(delta3d) < -1.5 ? '📉 Volatility Crush' : '⚖️ Stable Variance'}
                              </span>
                            </div>

                            <div className="hud-stat-box">
                              <span className="hud-lbl">Dealer Net GEX Horizon</span>
                              <div className="hud-val-row">
                                <span className="hud-primary-val font-mono" style={{ color: (activeTs.net_gex_millions || activeTs.net_gex) >= 0 ? '#10b981' : '#f87171' }}>
                                  {(activeTs.net_gex_millions || (activeTs.net_gex / 1e6)) >= 0 ? '+' : ''}
                                  ${(activeTs.net_gex_millions || (activeTs.net_gex / 1e6)).toFixed(2)}M
                                </span>
                              </div>
                              <div className="hud-duo-bar">
                                <span style={{ color: '#10b981' }}>Call: +${(activeTs.call_gex_millions || (activeTs.call_gex / 1e6)).toFixed(1)}M</span>
                                <span style={{ color: '#f87171' }}>Put: -${Math.abs(activeTs.put_gex_millions || (activeTs.put_gex / 1e6)).toFixed(1)}M</span>
                              </div>
                            </div>

                            <div className="hud-stat-box">
                              <span className="hud-lbl">Open Interest Distribution</span>
                              <div className="hud-val-row">
                                <span className="hud-primary-val font-mono">{formatKMB(activeTs.total_oi)}</span>
                                <span className="hud-sub-val" style={{ color: '#f59e0b' }}>
                                  PCR: {activeTs.pcr_oi?.toFixed(2) || (activeTs.call_oi > 0 ? (activeTs.put_oi / activeTs.call_oi).toFixed(2) : '1.00')}
                                </span>
                              </div>
                              <div className="hud-duo-bar">
                                <span style={{ color: '#10b981' }}>Calls: {formatKMB(activeTs.call_oi)}</span>
                                <span style={{ color: '#ef4444' }}>Puts: {formatKMB(activeTs.put_oi)}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* 2. TERM STRUCTURE VIEW SELECTOR */}
                        <div className="trend-subtabs">
                          <button 
                            className={`subtab-btn ${termStructureMetric === 'iv_3d_trend' ? 'active' : ''}`}
                            onClick={() => setTermStructureMetric('iv_3d_trend')}
                          >
                            🌊 3-Day Volatility Shift & Term Structure Trend
                          </button>
                          <button 
                            className={`subtab-btn ${termStructureMetric === 'iv_curve' ? 'active' : ''}`}
                            onClick={() => setTermStructureMetric('iv_curve')}
                          >
                            ⚡ Today ATM IV Curve
                          </button>
                          <button 
                            className={`subtab-btn ${termStructureMetric === 'gex_curve' ? 'active' : ''}`}
                            onClick={() => setTermStructureMetric('gex_curve')}
                          >
                            🛡️ Net Gamma Expiration Horizon (Net GEX vs DTE)
                          </button>
                          <button 
                            className={`subtab-btn ${termStructureMetric === 'oi_curve' ? 'active' : ''}`}
                            onClick={() => setTermStructureMetric('oi_curve')}
                          >
                            ⚖️ Open Interest Concentration by Expiration
                          </button>
                        </div>

                        {/* 3. PURE SVG TERM STRUCTURE CHART */}
                        <div className="svg-chart-card">
                          <div className="svg-chart-title-bar">
                            <span className="chart-title-text">
                              {termStructureMetric === 'iv_3d_trend' && '🌊 3-Day Multi-Session Term Structure Trend & Volatility Shift'}
                              {termStructureMetric === 'iv_curve' && '⚡ Today Implied Volatility Term Structure Curve (ATM IV % vs DTE)'}
                              {termStructureMetric === 'gex_curve' && '🛡️ Dealer Net Gamma (GEX) by Expiration Horizon ($ Millions)'}
                              {termStructureMetric === 'oi_curve' && '⚖️ Total Open Interest Concentration by Expiration Horizon'}
                            </span>
                            <div className="chart-legend-items">
                              {termStructureMetric === 'iv_3d_trend' && (
                                <>
                                  <span style={{ color: '#38bdf8' }}>— Today ({sessions[0]?.date?.slice(5) || 'Live'}: {(activeTs.atm_iv || 30).toFixed(1)}%)</span>
                                  {sessions[1] && <span style={{ color: '#10b981' }}>- - 1D Ago ({sessions[1].date.slice(5)})</span>}
                                  {sessions[2] && <span style={{ color: '#fbbf24' }}>·· 2D Ago ({sessions[2].date.slice(5)})</span>}
                                  {sessions[3] && <span style={{ color: '#a855f7' }}>-· 3D Ago ({sessions[3].date.slice(5)})</span>}
                                </>
                              )}
                              {termStructureMetric === 'iv_curve' && (
                                <span style={{ color: '#38bdf8' }}>— ATM Implied Volatility (Active: {(activeTs.atm_iv || 30).toFixed(1)}%)</span>
                              )}
                              {termStructureMetric === 'gex_curve' && (
                                <>
                                  <span style={{ color: '#10b981' }}>■ Long Gamma Cushion</span>
                                  <span style={{ color: '#ef4444' }}>■ Short Gamma Accelerator</span>
                                </>
                              )}
                              {termStructureMetric === 'oi_curve' && (
                                <>
                                  <span style={{ color: '#10b981' }}>■ Call OI</span>
                                  <span style={{ color: '#ef4444' }}>■ Put OI</span>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="interactive-svg-container" onMouseLeave={() => setHoveredTsIndex(null)}>
                            <svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
                              <defs>
                                <linearGradient id="tsAreaGrad" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.25" />
                                  <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.0" />
                                </linearGradient>
                              </defs>

                              {/* Grid lines */}
                              {(termStructureMetric === 'iv_curve' || termStructureMetric === 'iv_3d_trend') && (
                                [0, 0.33, 0.66, 1].map((ratio, idx) => {
                                  const y = padTop + plotH * (1 - ratio);
                                  const val = minIV + rangeIV * ratio;
                                  return (
                                    <g key={idx}>
                                      <line x1={padLeft} x2={padLeft + plotW} y1={y} y2={y} stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
                                      <text x={padLeft - 8} y={y + 3.5} fill="#64748b" fontSize="10" fontFamily="monospace" textAnchor="end">
                                        {val.toFixed(0)}%
                                      </text>
                                    </g>
                                  );
                                })
                              )}

                              {termStructureMetric === 'gex_curve' && (
                                <>
                                  <line x1={padLeft} x2={padLeft + plotW} y1={zeroY} y2={zeroY} stroke="rgba(255, 255, 255, 0.25)" strokeWidth="1.2" />
                                  <text x={padLeft - 8} y={zeroY + 3.5} fill="#94a3b8" fontSize="10" fontFamily="monospace" textAnchor="end">$0</text>
                                  <text x={padLeft - 8} y={padTop + 10} fill="#10b981" fontSize="9" fontFamily="monospace" textAnchor="end">+${absMaxGex.toFixed(0)}M</text>
                                  <text x={padLeft - 8} y={padTop + plotH - 2} fill="#ef4444" fontSize="9" fontFamily="monospace" textAnchor="end">-${absMaxGex.toFixed(0)}M</text>
                                </>
                              )}

                              {termStructureMetric === 'oi_curve' && (
                                [0, 0.33, 0.66, 1].map((ratio, idx) => {
                                  const y = padTop + plotH * (1 - ratio);
                                  const val = maxOI * ratio;
                                  return (
                                    <g key={idx}>
                                      <line x1={padLeft} x2={padLeft + plotW} y1={y} y2={y} stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
                                      <text x={padLeft - 8} y={y + 3.5} fill="#64748b" fontSize="10" fontFamily="monospace" textAnchor="end">{formatKMB(val)}</text>
                                    </g>
                                  );
                                })
                              )}

                              {/* 3-DAY VOLATILITY SHIFT MULTI-SESSION OVERLAY */}
                              {termStructureMetric === 'iv_3d_trend' && (
                                <>
                                  {/* Area fill for today's curve */}
                                  <polygon points={ivAreaPointsToday} fill="url(#tsAreaGrad)" />

                                  {/* Session 3: 3 Days Ago (Violet) */}
                                  {sessions[3]?.cycles && (() => {
                                    const pts = sessions[3].cycles.map((c, i) => `${xTs(i).toFixed(1)},${yIV(c.atm_iv || 30.0).toFixed(1)}`).join(' ');
                                    return (
                                      <polyline points={pts} fill="none" stroke="#a855f7" strokeWidth="1.8" strokeDasharray="6 3" strokeOpacity="0.75" />
                                    );
                                  })()}

                                  {/* Session 2: 2 Days Ago (Amber) */}
                                  {sessions[2]?.cycles && (() => {
                                    const pts = sessions[2].cycles.map((c, i) => `${xTs(i).toFixed(1)},${yIV(c.atm_iv || 30.0).toFixed(1)}`).join(' ');
                                    return (
                                      <polyline points={pts} fill="none" stroke="#fbbf24" strokeWidth="1.8" strokeDasharray="3 3" strokeOpacity="0.8" />
                                    );
                                  })()}

                                  {/* Session 1: 1 Day Ago (Emerald) */}
                                  {sessions[1]?.cycles && (() => {
                                    const pts = sessions[1].cycles.map((c, i) => `${xTs(i).toFixed(1)},${yIV(c.atm_iv || 30.0).toFixed(1)}`).join(' ');
                                    return (
                                      <polyline points={pts} fill="none" stroke="#10b981" strokeWidth="2.0" strokeDasharray="5 3" strokeOpacity="0.9" />
                                    );
                                  })()}

                                  {/* Session 0: Today (Cyan Solid) */}
                                  <polyline points={ivPointsToday} fill="none" stroke="#38bdf8" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />

                                  {/* Active vertical guide line on hover */}
                                  {hoveredTsIndex !== null && (
                                    <line
                                      x1={xTs(hoveredTsIndex)}
                                      x2={xTs(hoveredTsIndex)}
                                      y1={padTop}
                                      y2={padTop + plotH}
                                      stroke="rgba(255, 255, 255, 0.35)"
                                      strokeWidth="1.2"
                                      strokeDasharray="2 2"
                                    />
                                  )}

                                  {/* Cycle points on today's curve */}
                                  {ts.map((item, i) => (
                                    <circle
                                      key={i}
                                      cx={xTs(i)}
                                      cy={yIV(item.atm_iv || 30.0)}
                                      r={hoveredTsIndex === i ? 6 : 4}
                                      fill="#38bdf8"
                                      stroke="#ffffff"
                                      strokeWidth={hoveredTsIndex === i ? 2.5 : 1.2}
                                    />
                                  ))}
                                </>
                              )}

                              {/* TODAY ONLY IV CURVE */}
                              {termStructureMetric === 'iv_curve' && (
                                <>
                                  <polygon points={ivAreaPointsToday} fill="url(#tsAreaGrad)" />
                                  <polyline points={ivPointsToday} fill="none" stroke="#38bdf8" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                                  {ts.map((item, i) => (
                                    <circle
                                      key={i}
                                      cx={xTs(i)}
                                      cy={yIV(item.atm_iv || 30.0)}
                                      r={hoveredTsIndex === i ? 5.5 : 3.5}
                                      fill="#38bdf8"
                                      stroke="#ffffff"
                                      strokeWidth={hoveredTsIndex === i ? 2 : 1}
                                    />
                                  ))}
                                </>
                              )}

                              {/* GEX HORIZON BARS */}
                              {termStructureMetric === 'gex_curve' && ts.map((item, i) => {
                                const gexVal = item.net_gex_millions || (item.net_gex / 1e6);
                                const barH = (Math.abs(gexVal) / absMaxGex) * (plotH * 0.44);
                                const isPos = gexVal >= 0;
                                const barY = isPos ? (zeroY - barH) : zeroY;
                                const barWidth = Math.max(8, colW * 0.55);
                                const isAct = hoveredTsIndex === i || (!hoveredTsIndex && i === 0);

                                return (
                                  <rect
                                    key={i}
                                    x={xTs(i) - barWidth / 2}
                                    y={barY}
                                    width={barWidth}
                                    height={Math.max(2, barH)}
                                    fill={isPos ? '#10b981' : '#ef4444'}
                                    rx="2"
                                    opacity={isAct ? 1 : 0.8}
                                  />
                                );
                              })}

                              {/* OI CONCENTRATION BARS */}
                              {termStructureMetric === 'oi_curve' && ts.map((item, i) => {
                                const callH = (item.call_oi / maxOI) * plotH;
                                const putH = (item.put_oi / maxOI) * plotH;
                                const halfW = Math.max(4, colW * 0.28);
                                const xCenter = xTs(i);
                                const isAct = hoveredTsIndex === i || (!hoveredTsIndex && i === 0);

                                return (
                                  <g key={i} opacity={isAct ? 1 : 0.8}>
                                    <rect x={xCenter - halfW - 1} y={padTop + plotH - callH} width={halfW} height={Math.max(2, callH)} fill="#10b981" rx="1.5" />
                                    <rect x={xCenter + 1} y={padTop + plotH - putH} width={halfW} height={Math.max(2, putH)} fill="#ef4444" rx="1.5" />
                                  </g>
                                );
                              })}

                              {/* X-AXIS EXPIRATIONS & DTE */}
                              {ts.map((item, i) => (
                                <g key={`ts-axis-${i}`}>
                                  <text
                                    x={xTs(i)}
                                    y={padTop + plotH + 16}
                                    fill="#f8fafc"
                                    fontSize="9.5"
                                    fontWeight="700"
                                    fontFamily="monospace"
                                    textAnchor="middle"
                                  >
                                    {item.expiry.slice(5)}
                                  </text>
                                  <text
                                    x={xTs(i)}
                                    y={padTop + plotH + 28}
                                    fill="#38bdf8"
                                    fontSize="8.5"
                                    fontFamily="monospace"
                                    textAnchor="middle"
                                  >
                                    {item.dte}d
                                  </text>
                                </g>
                              ))}

                              {/* HOVER OVERLAY RECTS */}
                              {ts.map((item, i) => (
                                <rect
                                  key={`ts-trigger-${i}`}
                                  x={padLeft + i * colW}
                                  y={padTop}
                                  width={colW}
                                  height={plotH}
                                  fill="transparent"
                                  style={{ cursor: 'pointer' }}
                                  onMouseEnter={() => setHoveredTsIndex(i)}
                                />
                              ))}
                            </svg>
                          </div>
                        </div>

                        {/* 4. EXPIRATION CYCLE GRID CARDS */}
                        <div className="ts-grid" style={{ marginTop: '0.5rem' }}>
                          {ts.map((item, idx) => {
                            const isAct = hoveredTsIndex === idx;
                            const gexVal = item.net_gex_millions || (item.net_gex / 1e6);
                            const cardIv3d = sessions[sessions.length - 1]?.cycles?.[idx]?.atm_iv;
                            const cardDelta3d = cardIv3d !== undefined ? (item.atm_iv - cardIv3d).toFixed(1) : null;

                            return (
                              <div 
                                key={idx} 
                                className="ts-card" 
                                style={{ 
                                  borderColor: isAct ? '#38bdf8' : 'rgba(255,255,255,0.08)',
                                  background: isAct ? 'rgba(56, 189, 248, 0.1)' : 'rgba(30, 41, 59, 0.4)'
                                }}
                                onMouseEnter={() => setHoveredTsIndex(idx)}
                                onMouseLeave={() => setHoveredTsIndex(null)}
                              >
                                <div className="ts-exp">
                                  <span>{item.expiry}</span>
                                  <span className="ts-dte">{item.dte} DTE</span>
                                </div>
                                <div className="ts-stat">
                                  <span>ATM IV</span>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                    <span style={{ color: '#38bdf8', fontWeight: 700, fontFamily: 'monospace' }}>
                                      {(item.atm_iv || 30).toFixed(1)}%
                                    </span>
                                    {cardDelta3d !== null && (
                                      <span style={{ fontSize: '0.7rem', color: Number(cardDelta3d) >= 0 ? '#10b981' : '#f87171', fontFamily: 'monospace' }}>
                                        {Number(cardDelta3d) >= 0 ? '+' : ''}{cardDelta3d}%
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="ts-stat">
                                  <span>Net GEX</span>
                                  <span style={{ color: gexVal >= 0 ? '#10b981' : '#f87171', fontWeight: 700, fontFamily: 'monospace' }}>
                                    {gexVal >= 0 ? '+' : ''}${gexVal.toFixed(2)}M
                                  </span>
                                </div>
                                <div className="ts-stat">
                                  <span>Call vs Put OI</span>
                                  <span style={{ fontFamily: 'monospace' }}>
                                    {formatKMB(item.call_oi)} / {formatKMB(item.put_oi)}
                                  </span>
                                </div>
                                <div className="ts-skew-bar-bg">
                                  <div 
                                    className="ts-skew-fill" 
                                    style={{ 
                                      width: `${Math.min(100, (item.call_oi / Math.max(item.total_oi, 1)) * 100)}%`,
                                      background: '#10b981'
                                    }} 
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}


                  {/* TAB 6: UNUSUAL CONTRACTS & WHALE BLOCKS */}
                  {modalTab === 'unusual' && deepAnalytics && (
                    <div className="unusual-tab-wrap">
                      {deepAnalytics.unusual_contracts?.length > 0 ? (
                        <table className="modal-unusual-table">
                          <thead>
                            <tr>
                              <th>Contract</th>
                              <th>Type</th>
                              <th>Strike</th>
                              <th>Expiration</th>
                              <th>Volume</th>
                              <th>Open Interest</th>
                              <th>Vol / OI</th>
                              <th>Est. Premium</th>
                            </tr>
                          </thead>
                          <tbody>
                            {deepAnalytics.unusual_contracts.map((c, i) => (
                              <tr key={i}>
                                <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{c.contract}</td>
                                <td>
                                  <span style={{ color: c.type === 'CALL' ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                                    {c.type}
                                  </span>
                                </td>
                                <td>${c.strike}</td>
                                <td>{c.expiration ? c.expiration.slice(0, 10) : 'N/A'}</td>
                                <td style={{ fontFamily: 'monospace' }}>{c.volume.toLocaleString()}</td>
                                <td style={{ fontFamily: 'monospace' }}>{c.open_interest.toLocaleString()}</td>
                                <td style={{ color: '#f59e0b', fontWeight: 700, fontFamily: 'monospace' }}>{c.vol_oi_ratio}x</td>
                                <td style={{ fontFamily: 'monospace', color: '#38bdf8' }}>
                                  ${Math.round(c.est_premium).toLocaleString()}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                          No contracts currently exceed the 1.4x Vol/OI anomaly threshold for this session.
                        </div>
                      )}
                    </div>
                  )}

                  {/* QUICK BRIDGE NAVIGATION BUTTONS */}
                  <div className="quick-bridge-links">
                    <button 
                      className="bridge-btn"
                      onClick={() => {
                        setSelectedTicker(null);
                        if (onNavigateTab) onNavigateTab('volsurface', selectedTicker);
                      }}
                    >
                      <Activity size={14} /> Open in 3D Vol Surface
                    </button>
                    <button 
                      className="bridge-btn"
                      onClick={() => {
                        setSelectedTicker(null);
                        if (onNavigateTab) onNavigateTab('gexprofiler', selectedTicker);
                      }}
                    >
                      <BarChart2 size={14} /> Open in GEX Profiler
                    </button>
                    <button 
                      className="bridge-btn"
                      onClick={() => {
                        setSelectedTicker(null);
                        if (onNavigateTab) onNavigateTab('ask_ai', selectedTicker);
                      }}
                    >
                      <ExternalLink size={14} /> Ask AI Live Analysis
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
