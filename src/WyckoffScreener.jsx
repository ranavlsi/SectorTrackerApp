import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Landmark, TrendingUp, TrendingDown, ShieldAlert, CheckCircle2,
  Zap, Search, RefreshCw, SlidersHorizontal, Layers,
  X, Sparkles, Target, Compass,
  ZoomIn, ZoomOut, RotateCcw, LayoutGrid, List, Copy, Check, Activity
} from 'lucide-react';
import './WyckoffScreener.css';

export default function WyckoffScreener() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const [selectedFilter, setSelectedFilter] = useState('all');
  const [directionFilter, setDirectionFilter] = useState('ALL'); // 'ALL' | 'BULLISH' | 'BEARISH'
  const [tableSearch, setTableSearch] = useState('');
  const [searchTicker, setSearchTicker] = useState('');
  const [sortBy, setSortBy] = useState('wyckoff_score');
  const [viewMode, setViewMode] = useState('cards'); // 'cards' | 'table'
  const [selectedTf, setSelectedTf] = useState('180D'); // '90D' | '180D' | '1Y' | 'BASE'
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 48;

  // Modal State for interactive deep chart inspection
  const [activeStock, setActiveStock] = useState(null);
  const [copiedTicket, setCopiedTicket] = useState(false);

  const formatCap = (capB) => {
    if (capB == null || isNaN(capB)) return '—';
    return capB >= 1000 ? `$${(capB / 1000).toFixed(2)}T` : `$${Number(capB).toFixed(1)}B`;
  };

  // Close schematic modal cleanly on Escape key
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && activeStock) setActiveStock(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeStock]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedFilter, directionFilter, tableSearch, sortBy, viewMode]);

  // Fetch summary on load
  const loadSummary = async (force = false) => {
    if (force) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/wyckoff/summary?refresh=${force ? 'true' : 'false'}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to load Wyckoff data`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error('Wyckoff Screener fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadSummary(false);
  }, []);

  // Inspect a specific stock in deep Wyckoff terminal
  const openStockModal = async (ticker) => {
    if (!ticker) return;
    setCopiedTicket(false);
    setActiveStock({ ticker: ticker.toUpperCase(), loading: true });
    try {
      const res = await fetch(`/api/wyckoff/stock_analysis?ticker=${ticker.toUpperCase()}`);
      if (!res.ok) throw new Error(`Could not fetch analysis for ${ticker}`);
      const json = await res.json();
      setActiveStock(json);
    } catch (err) {
      console.error(err);
      setActiveStock({ ticker: ticker.toUpperCase(), error: err.message });
    }
  };

  const handleDirectSearch = (e) => {
    e.preventDefault();
    if (searchTicker.trim()) {
      openStockModal(searchTicker.trim());
    }
  };

  const allStocks = useMemo(() => data?.stocks || [], [data]);
  const posture = data?.market_posture;

  // Canonical filter matcher so badge counts always match displayed results
  const matchesFilter = (s, filterKey) => {
    if (!s) return false;
    if (filterKey === 'all') return true;
    if (filterKey.startsWith('phase_')) {
      const targetLetter = filterKey.replace('phase_', '').toUpperCase();
      return s.phase_letter === targetLetter || (s.wyckoff_phase && s.wyckoff_phase.includes(`Phase ${targetLetter}`));
    }
    const pKey = s.primary_setup?.setup_key?.toLowerCase();
    const allKeys = (s.all_setups || []).map((x) => x.setup_key?.toLowerCase());
    if (filterKey === 'utad') {
      return pKey === 'utad' || pKey === 'sow' || allKeys.includes('utad') || allKeys.includes('sow') || s.primary_setup?.direction === 'BEARISH';
    }
    return pKey === filterKey || allKeys.includes(filterKey);
  };

  // Live counts for every filter pill
  const filterCounts = useMemo(() => {
    return {
      all: allStocks.length,
      phase_a: allStocks.filter((s) => matchesFilter(s, 'phase_a')).length,
      phase_b: allStocks.filter((s) => matchesFilter(s, 'phase_b')).length,
      phase_c: allStocks.filter((s) => matchesFilter(s, 'phase_c')).length,
      phase_d: allStocks.filter((s) => matchesFilter(s, 'phase_d')).length,
      phase_e: allStocks.filter((s) => matchesFilter(s, 'phase_e')).length,
      spring: allStocks.filter((s) => matchesFilter(s, 'spring')).length,
      sos: allStocks.filter((s) => matchesFilter(s, 'sos')).length,
      lps: allStocks.filter((s) => matchesFilter(s, 'lps')).length,
      utad: allStocks.filter((s) => matchesFilter(s, 'utad')).length
    };
  }, [allStocks]);

  // Dual Spotlights: #1 Accumulation Alpha & #1 Distribution Warning
  const { topAccumulation, topDistribution } = useMemo(() => {
    const bull = allStocks
      .filter((s) => s.primary_setup?.direction === 'BULLISH')
      .sort((a, b) => (b.wyckoff_score || 0) - (a.wyckoff_score || 0))[0] || null;
    const bear = allStocks
      .filter((s) => s.primary_setup?.direction === 'BEARISH')
      .sort((a, b) => (b.wyckoff_score || 0) - (a.wyckoff_score || 0))[0] || null;
    return { topAccumulation: bull, topDistribution: bear };
  }, [allStocks]);

  // Filtered & Sorted Stocks
  const filteredStocks = useMemo(() => {
    let list = [...allStocks];

    if (selectedFilter !== 'all') {
      list = list.filter((s) => matchesFilter(s, selectedFilter));
    }

    if (directionFilter !== 'ALL') {
      list = list.filter((s) => s.primary_setup?.direction === directionFilter);
    }

    if (tableSearch.trim()) {
      const q = tableSearch.trim().toUpperCase();
      list = list.filter(
        (s) =>
          (s.ticker || '').toUpperCase().includes(q) ||
          (s.name || '').toUpperCase().includes(q) ||
          (s.sector || '').toUpperCase().includes(q) ||
          (s.primary_setup?.name || '').toUpperCase().includes(q) ||
          (s.wyckoff_phase || '').toUpperCase().includes(q) ||
          (s.effort_result_bias || '').toUpperCase().includes(q)
      );
    }

    list.sort((a, b) => {
      if (sortBy === 'wyckoff_score') return (b.wyckoff_score || 0) - (a.wyckoff_score || 0);
      if (sortBy === 'market_cap') return (b.market_cap_usd || 0) - (a.market_cap_usd || 0);
      if (sortBy === 'avg_vol') return (b.avg_vol_20d || 0) - (a.avg_vol_20d || 0);
      if (sortBy === 'risk_reward') return (b.primary_setup?.risk_reward || 0) - (a.primary_setup?.risk_reward || 0);
      if (sortBy === 'rvol') return (b.rvol || 0) - (a.rvol || 0);
      if (sortBy === 'vol_flow') return (b.trading_range?.up_down_vol_ratio || 0) - (a.trading_range?.up_down_vol_ratio || 0);
      if (sortBy === 'cause_bars') return (b.trading_range?.cause_bars || 0) - (a.trading_range?.cause_bars || 0);
      if (sortBy === 'pf_gain') return (b.trading_range?.pf_gain_pct || 0) - (a.trading_range?.pf_gain_pct || 0);
      if (sortBy === 'creek_prox') {
        return Math.abs(a.trading_range?.dist_to_creek_pct ?? 999) - Math.abs(b.trading_range?.dist_to_creek_pct ?? 999);
      }
      return 0;
    });

    return list;
  }, [allStocks, selectedFilter, directionFilter, tableSearch, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredStocks.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedStocks = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredStocks.slice(start, start + pageSize);
  }, [filteredStocks, safePage]);

  const handleCopyTicket = (stockObj) => {
    const sr = stockObj?.setup_result;
    const ps = sr?.primary_setup;
    const tr = sr?.trading_range;
    const ce = stockObj?.cause_and_effect;
    if (!sr || !ps) return;
    const text = `🏛️ [WYCKOFF COMPOSITE OPERATOR TICKET] $${stockObj.ticker}
Phase: ${sr.wyckoff_phase} | Setup: ${ps.name} (${ps.direction})
Spot: $${sr.current_price?.toFixed(2)} | Creek: $${tr?.creek?.toFixed(2)} | Ice: $${tr?.ice?.toFixed(2)}
Cause: ${tr?.cause_bars} bars (${tr?.cause_days}d) | Vol Flow: ${tr?.up_down_vol_ratio}x | RVOL: ${sr.rvol}x
Entry: $${ps.entry?.toFixed(2)} | Stop: $${ps.stop_loss?.toFixed(2)} | T1: $${ps.target_1?.toFixed(2)} | P&F Target: $${ce?.projected_target?.toFixed(2)} | R:R ${ps.risk_reward}:1`;
    navigator.clipboard.writeText(text);
    setCopiedTicket(true);
    setTimeout(() => setCopiedTicket(false), 2200);
  };

  return (
    <div className="wyckoff-container">
      {/* 1. EXECUTIVE HERO HEADER & CLICKABLE 6-PILLAR CYCLE KPI RIBBON */}
      <div className="wyckoff-hero">
        <div className="wyckoff-hero-top">
          <div className="wyckoff-title-area">
            <div className="wyckoff-kicker-row">
              <span className="wyckoff-kicker-badge">WYCKOFF METHOD 3.0</span>
              <span className="wyckoff-kicker-meta">
                ALL US STOCKS • MCAP &ge; ${data?.universe_filters?.min_market_cap_b ?? 2}B • AVG VOL &gt; {data?.universe_filters?.min_avg_vol_m ?? 2}M • {data?.total_scanned || allStocks.length} EQUITIES
              </span>
            </div>
            <h1>
              <Landmark size={28} color="#38bdf8" /> Institutional Wyckoff Command Terminal
            </h1>
            <p className="wyckoff-subtitle">
              Track Composite Operator accumulation &amp; distribution footprints across{' '}
              <strong>The Creek (Resistance)</strong> &amp; <strong>The Ice (Support)</strong> with automated Point &amp; Figure Cause targets and Weis Wave Volume Spread Analysis.
            </p>
          </div>

          <div className="wyckoff-header-actions">
            {/* View Mode Toggle */}
            <div className="wyckoff-view-toggle">
              <button
                type="button"
                className={`wyckoff-view-btn ${viewMode === 'cards' ? 'active' : ''}`}
                onClick={() => setViewMode('cards')}
              >
                <LayoutGrid size={14} /> Cards
              </button>
              <button
                type="button"
                className={`wyckoff-view-btn ${viewMode === 'table' ? 'active' : ''}`}
                onClick={() => setViewMode('table')}
              >
                <List size={14} /> Matrix Table
              </button>
            </div>

            <button
              type="button"
              className="wyckoff-refresh-btn"
              onClick={() => loadSummary(true)}
              disabled={loading || refreshing}
            >
              <RefreshCw size={15} className={refreshing ? 'spin-animation' : ''} />
              {refreshing ? 'Scanning Lakehouse...' : 'Rescan Market'}
            </button>
          </div>
        </div>

        {/* Market Posture Breadth & Regime */}
        {posture && (
          <div className="posture-matrix">
            <div className="posture-breadth-left">
              <div className="posture-label-row">
                <span style={{ color: '#10b981' }}>🟢 Accumulation Breadth: {posture.accumulation_pct}%</span>
                <span style={{ color: '#f43f5e' }}>🔴 Distribution: {posture.distribution_pct}%</span>
              </div>
              <div className="breadth-meter-track">
                <div className="breadth-fill-acc" style={{ width: `${posture.accumulation_pct}%` }} />
                <div className="breadth-fill-dist" style={{ width: `${posture.distribution_pct}%` }} />
              </div>
              <div style={{ fontSize: '0.82rem', color: '#cbd5e1', fontWeight: 600, marginTop: '2px' }}>
                Composite Operator Regime:{' '}
                <span
                  style={{
                    color:
                      posture.badge === 'BULLISH_ACCUMULATION'
                        ? '#10b981'
                        : posture.badge === 'BEARISH_DISTRIBUTION'
                        ? '#f43f5e'
                        : '#38bdf8',
                    fontWeight: 800
                  }}
                >
                  {posture.text}
                </span>
              </div>
            </div>

            {/* Clickable 6-Card Phase KPI Strip */}
            <div className="wyckoff-kpi-grid">
              {[
                { id: 'all', label: 'TOTAL SCANNED', val: filterCounts.all, sub: 'All Phases', color: '#f8fafc', border: 'rgba(148,163,184,0.35)' },
                { id: 'phase_a', label: '⚓ PHASE A: STOPPING', val: filterCounts.phase_a, sub: 'SC / AR / ST', color: '#94a3b8', border: 'rgba(148,163,184,0.4)' },
                { id: 'phase_b', label: '🏛️ PHASE B: CAUSE', val: filterCounts.phase_b, sub: 'Base Absorption', color: '#38bdf8', border: 'rgba(56,189,248,0.4)' },
                { id: 'phase_c', label: '🌱 PHASE C: TEST', val: filterCounts.phase_c, sub: 'Springs / UTAD', color: '#10b981', border: 'rgba(16,185,129,0.45)' },
                { id: 'phase_d', label: '🚀 PHASE D: MARKUP', val: filterCounts.phase_d, sub: 'SOS / LPS / SOW', color: '#c084fc', border: 'rgba(168,85,247,0.45)' },
                { id: 'phase_e', label: '⚡ PHASE E: TREND', val: filterCounts.phase_e, sub: 'Runaway Expansion', color: '#fbbf24', border: 'rgba(251,191,36,0.45)' }
              ].map((k) => {
                const isSelected = selectedFilter === k.id;
                return (
                  <div
                    key={k.id}
                    onClick={() => setSelectedFilter(isSelected && k.id !== 'all' ? 'all' : k.id)}
                    className={`wyckoff-kpi-card ${isSelected ? 'selected' : ''}`}
                    style={{
                      borderColor: isSelected ? k.color : k.border,
                      boxShadow: isSelected ? `0 0 14px ${k.border}` : undefined
                    }}
                    title={`Click to filter by ${k.label}`}
                  >
                    <div className="wyckoff-kpi-lbl" style={{ color: isSelected ? k.color : '#94a3b8' }}>{k.label}</div>
                    <div className="wyckoff-kpi-val" style={{ color: k.color }}>{k.val}</div>
                    <div className="wyckoff-kpi-sub">{k.sub}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 2. DUAL SPOTLIGHT ARENA: #1 ACCUMULATION ALPHA VS #1 DISTRIBUTION WARNING */}
      {!loading && (topAccumulation || topDistribution) && (
        <div className="wyckoff-spotlight-grid">
          {topAccumulation && (
            <div
              className="wyckoff-spotlight-card bull"
              onClick={() => openStockModal(topAccumulation.ticker)}
            >
              <div className="spotlight-top-row">
                <span className="spotlight-tag bull">🏛️ #1 ACCUMULATION LEADER</span>
                <span className="spotlight-score bull">SCORE {topAccumulation.wyckoff_score}/100</span>
              </div>
              <div className="spotlight-main-row">
                <div className="spotlight-ticker-wrap">
                  <span className="spotlight-ticker">${topAccumulation.ticker}</span>
                  <span className="spotlight-price">${topAccumulation.current_price?.toFixed(2)}</span>
                  <span style={{ color: topAccumulation.pct_change >= 0 ? '#10b981' : '#f43f5e', fontWeight: 800, fontSize: '0.88rem', fontFamily: 'monospace' }}>
                    {topAccumulation.pct_change >= 0 ? `+${topAccumulation.pct_change}%` : `${topAccumulation.pct_change}%`}
                  </span>
                </div>
                <span className={`setup-badge ${topAccumulation.primary_setup?.setup_key || 'base_acc'}`}>
                  {topAccumulation.primary_setup?.name}
                </span>
              </div>
              <div className="spotlight-metrics-row">
                <div><span>PHASE</span><strong>{topAccumulation.wyckoff_phase}</strong></div>
                <div><span>CREEK / ICE</span><strong>${topAccumulation.trading_range?.creek?.toFixed(1)} / ${topAccumulation.trading_range?.ice?.toFixed(1)}</strong></div>
                <div><span>CAUSE</span><strong>{topAccumulation.trading_range?.cause_bars} bars</strong></div>
                <div><span>P&amp;F TARGET</span><strong style={{ color: '#10b981' }}>${topAccumulation.trading_range?.pf_target?.toFixed(0)} (+{topAccumulation.trading_range?.pf_gain_pct}%)</strong></div>
                <div><span>R:R</span><strong style={{ color: '#fbbf24' }}>{topAccumulation.primary_setup?.risk_reward}:1</strong></div>
              </div>
            </div>
          )}

          {topDistribution && (
            <div
              className="wyckoff-spotlight-card bear"
              onClick={() => openStockModal(topDistribution.ticker)}
            >
              <div className="spotlight-top-row">
                <span className="spotlight-tag bear">⚠️ #1 DISTRIBUTION / TRAP ALERT</span>
                <span className="spotlight-score bear">SCORE {topDistribution.wyckoff_score}/100</span>
              </div>
              <div className="spotlight-main-row">
                <div className="spotlight-ticker-wrap">
                  <span className="spotlight-ticker">${topDistribution.ticker}</span>
                  <span className="spotlight-price">${topDistribution.current_price?.toFixed(2)}</span>
                  <span style={{ color: topDistribution.pct_change >= 0 ? '#10b981' : '#f43f5e', fontWeight: 800, fontSize: '0.88rem', fontFamily: 'monospace' }}>
                    {topDistribution.pct_change >= 0 ? `+${topDistribution.pct_change}%` : `${topDistribution.pct_change}%`}
                  </span>
                </div>
                <span className={`setup-badge ${topDistribution.primary_setup?.setup_key || 'utad'}`}>
                  {topDistribution.primary_setup?.name}
                </span>
              </div>
              <div className="spotlight-metrics-row">
                <div><span>PHASE</span><strong>{topDistribution.wyckoff_phase}</strong></div>
                <div><span>SUPPLY / ICE</span><strong>${topDistribution.trading_range?.creek?.toFixed(1)} / ${topDistribution.trading_range?.ice?.toFixed(1)}</strong></div>
                <div><span>CAUSE</span><strong>{topDistribution.trading_range?.cause_bars} bars</strong></div>
                <div><span>VOL FLOW</span><strong style={{ color: '#f43f5e' }}>{topDistribution.trading_range?.up_down_vol_ratio}x</strong></div>
                <div><span>SHORT R:R</span><strong style={{ color: '#fbbf24' }}>{topDistribution.primary_setup?.risk_reward}:1</strong></div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. CONTROLS BAR: SETUP PILLS, DIRECTION, SEARCH, SORT & DIRECT INSPECT */}
      <div className="wyckoff-controls-bar">
        <div className="filter-pills-group">
          {[
            { id: 'all', label: `All (${filterCounts.all})`, cls: '' },
            { id: 'phase_c', label: `🌱 Phase C: Test (${filterCounts.phase_c})`, cls: 'phase-c-pill' },
            { id: 'phase_d', label: `🚀 Phase D: Markup (${filterCounts.phase_d})`, cls: 'phase-d-pill' },
            { id: 'phase_e', label: `⚡ Phase E: Trend (${filterCounts.phase_e})`, cls: 'phase-e-pill' },
            { id: 'phase_b', label: `🏛️ Phase B: Cause (${filterCounts.phase_b})`, cls: 'phase-b-pill' },
            { id: 'phase_a', label: `⚓ Phase A: Stopping (${filterCounts.phase_a})`, cls: 'phase-a-pill' },
            { id: 'spring', label: `Springs (${filterCounts.spring})`, cls: 'spring' },
            { id: 'sos', label: `SOS Breakouts (${filterCounts.sos})`, cls: 'sos' },
            { id: 'lps', label: `BUEC / LPS (${filterCounts.lps})`, cls: 'lps' },
            { id: 'utad', label: `⚠️ UTAD / SOW (${filterCounts.utad})`, cls: 'utad' }
          ].map((p) => (
            <button
              key={p.id}
              type="button"
              className={`filter-pill ${p.cls} ${selectedFilter === p.id ? `active ${p.cls}` : ''}`}
              onClick={() => setSelectedFilter(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="wyckoff-subcontrols">
          {/* Direction Filter */}
          <div className="wyckoff-dir-toggle">
            {[
              { id: 'ALL', label: 'All Bias' },
              { id: 'BULLISH', label: '🟢 Accumulation' },
              { id: 'BEARISH', label: '🔴 Distribution' }
            ].map((d) => (
              <button
                key={d.id}
                type="button"
                className={`dir-btn ${directionFilter === d.id ? 'active' : ''}`}
                onClick={() => setDirectionFilter(d.id)}
              >
                {d.label}
              </button>
            ))}
          </div>

          {/* Instant Filter Search */}
          <div className="wyckoff-inline-search">
            <Search size={14} color="#64748b" />
            <input
              type="text"
              placeholder="Filter table/cards..."
              value={tableSearch}
              onChange={(e) => setTableSearch(e.target.value)}
            />
            {tableSearch && (
              <button type="button" onClick={() => setTableSearch('')} className="clear-mini-btn">×</button>
            )}
          </div>

          {/* Sort Selector */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="wyckoff-sort-select"
          >
            <option value="wyckoff_score">Sort: Wyckoff Score</option>
            <option value="market_cap">Sort: Market Cap ($B)</option>
            <option value="avg_vol">Sort: Daily Avg Vol (20D)</option>
            <option value="risk_reward">Sort: Highest R/R Ratio</option>
            <option value="rvol">Sort: RVOL Effort</option>
            <option value="vol_flow">Sort: Up/Down Vol Flow</option>
            <option value="cause_bars">Sort: Longest Cause (Bars)</option>
            <option value="pf_gain">Sort: P&amp;F Target Upside %</option>
            <option value="creek_prox">Sort: Closest to Creek</option>
          </select>

          {/* Direct Ticker Schematic Lookup */}
          <form className="wyckoff-search-form" onSubmit={handleDirectSearch}>
            <input
              type="text"
              placeholder="Deep scan ticker (e.g. NVDA)..."
              value={searchTicker}
              onChange={(e) => setSearchTicker(e.target.value)}
              className="wyckoff-search-input"
            />
            <button type="submit" className="wyckoff-search-btn">
              <Zap size={14} /> Check Stock
            </button>
          </form>
        </div>
      </div>

      {/* 4. MAIN DISPLAY: RADAR CARDS GRID OR HIGH-DENSITY MATRIX TABLE */}
      {loading ? (
        <div className="wyckoff-table-wrapper" style={{ padding: '3.5rem', textAlign: 'center', color: '#94a3b8' }}>
          <RefreshCw size={26} className="spin-animation" style={{ margin: '0 auto 10px auto' }} />
          <div>Loading institutional Wyckoff footprints...</div>
        </div>
      ) : error ? (
        <div className="wyckoff-table-wrapper" style={{ padding: '2rem', textAlign: 'center', color: '#f43f5e' }}>
          Error: {error}
        </div>
      ) : filteredStocks.length === 0 ? (
        <div className="wyckoff-table-wrapper" style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
          No stocks match the current Wyckoff filter. Try resetting filters or searching any ticker directly.
        </div>
      ) : viewMode === 'cards' ? (
        <>
        <div className="wyckoff-cards-grid">
          {paginatedStocks.map((stock) => {
            const s = stock.primary_setup || {};
            const tr = stock.trading_range || {};
            const isBull = s.direction === 'BULLISH';
            const isBear = s.direction === 'BEARISH';
            const score = stock.wyckoff_score || 50;
            const rawPos = tr.range_pos_pct ?? 50;
            const posPercent = Math.min(100, Math.max(0, rawPos));
            const scoreColor = score >= 75 ? '#10b981' : score >= 55 ? '#38bdf8' : score >= 40 ? '#f59e0b' : '#f43f5e';

            return (
              <div
                key={stock.ticker}
                className={`wyckoff-card ${isBear ? 'bearish' : isBull ? 'bullish' : ''}`}
                onClick={() => openStockModal(stock.ticker)}
              >
                {/* Card Header */}
                <div className="wyckoff-card-hdr">
                  <div>
                    <div className="wyckoff-card-sym-row">
                      <span className="stock-symbol">${stock.ticker}</span>
                      <span className={`phase-pill phase-${(stock.phase_letter || 'b').toLowerCase()}`}>
                        {stock.wyckoff_phase}
                      </span>
                    </div>
                    <div className="wyckoff-card-price-row">
                      <span className="card-spot">${stock.current_price?.toFixed(2)}</span>
                      <span style={{ color: stock.pct_change >= 0 ? '#10b981' : '#f43f5e', fontWeight: 700, fontSize: '0.78rem' }}>
                        {stock.pct_change >= 0 ? `+${stock.pct_change}%` : `${stock.pct_change}%`}
                      </span>
                      <span className={`bias-mini-tag ${isBear ? 'bear' : 'bull'}`}>
                        {isBear ? 'DISTRIBUTION' : 'ACCUMULATION'}
                      </span>
                    </div>
                    {(stock.market_cap_b != null || stock.avg_vol_20_m != null) && (
                      <div className="wyckoff-card-liq-row">
                        <span>Cap <strong>{formatCap(stock.market_cap_b)}</strong></span>
                        <span>•</span>
                        <span>AvgVol <strong>{stock.avg_vol_20_m != null ? `${Number(stock.avg_vol_20_m).toFixed(2)}M` : '—'}</strong></span>
                        {stock.sector && (
                          <>
                            <span>•</span>
                            <span className="liq-sector-tag" title={stock.name || stock.sector}>{stock.sector}</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="wyckoff-score-badge" style={{ borderColor: scoreColor, color: scoreColor }}>
                    <span className="ws-num">{score}</span>
                    <span className="ws-lbl">SCORE</span>
                  </div>
                </div>

                {/* Primary Setup Badge */}
                <div className="wyckoff-card-setup-row">
                  <span className={`setup-badge ${s.setup_key || 'base_acc'}`}>
                    {s.name || 'Accumulation Base'}
                  </span>
                  <span className="rr-chip" style={{ color: isBull ? '#10b981' : isBear ? '#f43f5e' : '#fbbf24' }}>
                    {s.risk_reward ? `${s.risk_reward}:1 R/R` : '2.2:1 R/R'}
                  </span>
                </div>

                {/* Creek-to-Ice Equilibrium Channel Gauge */}
                <div className="wyckoff-channel-box">
                  <div className="channel-labels">
                    <span className="ice-tag">🧊 Ice ${tr.ice?.toFixed(2)}</span>
                    <span className="pos-tag" style={{ color: rawPos > 100 ? '#10b981' : rawPos < 0 ? '#f43f5e' : '#cbd5e1' }}>
                      {rawPos > 100 ? `Above Creek (${rawPos}%)` : rawPos < 0 ? `Below Ice (${rawPos}%)` : `${rawPos}% in TR`}
                    </span>
                    <span className="creek-tag">🌊 Creek ${tr.creek?.toFixed(2)}</span>
                  </div>
                  <div className="range-mini-slider">
                    <div className="range-mid-tick" />
                    <div
                      className="range-slider-thumb"
                      style={{
                        left: `${posPercent}%`,
                        background: isBear ? '#f43f5e' : '#10b981',
                        boxShadow: `0 0 8px ${isBear ? '#f43f5e' : '#10b981'}`
                      }}
                    />
                  </div>
                </div>

                {/* 3-Law Telemetry Strip */}
                <div className="wyckoff-card-telemetry">
                  <div className="tele-cell">
                    <span className="tele-lbl">CAUSE (P&amp;F)</span>
                    <span className="tele-val">{tr.cause_bars}b ({tr.cause_days}d)</span>
                    <span className="tele-sub" style={{ color: isBear ? '#fb7185' : '#10b981' }}>
                      {isBear ? `Ice: $${tr.ice?.toFixed(1)}` : `Target: $${tr.pf_target?.toFixed(0)} (+${tr.pf_gain_pct}%)`}
                    </span>
                  </div>
                  <div className="tele-cell">
                    <span className="tele-lbl">VSA EFFORT</span>
                    <span className="tele-val" style={{ color: stock.rvol >= 1.5 ? '#38bdf8' : '#e2e8f0' }}>{stock.rvol}x RVOL</span>
                    <span className="tele-sub" style={{ color: (tr.up_down_vol_ratio || 1) >= 1.1 ? '#10b981' : '#f43f5e' }}>
                      Vol Flow: {tr.up_down_vol_ratio || 1.0}x
                    </span>
                  </div>
                  <div className="tele-cell">
                    <span className="tele-lbl">CLV / BIAS</span>
                    <span className="tele-val">{Math.round((stock.clv || 0.5) * 100)}% CLV</span>
                    <span className="tele-sub" title={stock.effort_result_bias}>
                      {(stock.effort_result_bias || '').split('(')[0].trim()}
                    </span>
                  </div>
                </div>

                {/* Bracket Trade Plan Footer */}
                <div className="wyckoff-card-footer">
                  <div className="footer-levels">
                    <span>Entry <strong style={{ color: '#38bdf8' }}>${s.entry?.toFixed(2)}</strong></span>
                    <span>Stop <strong style={{ color: '#f43f5e' }}>${s.stop_loss?.toFixed(2)}</strong></span>
                    <span>T1 <strong style={{ color: isBear ? '#f43f5e' : '#10b981' }}>${s.target_1?.toFixed(2)}</strong></span>
                  </div>
                  <button
                    type="button"
                    className="inspect-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      openStockModal(stock.ticker);
                    }}
                  >
                    <Compass size={13} /> Schematic
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        </>
      ) : (
        <div className="wyckoff-table-wrapper">
          <table className="wyckoff-table">
            <thead>
              <tr>
                <th>Ticker</th>
                <th>MCap / Avg Vol</th>
                <th>Wyckoff Setup</th>
                <th>Phase</th>
                <th>Wyckoff Score</th>
                <th>Trading Range Bounds</th>
                <th>Cause Duration (Base)</th>
                <th>VSA Effort &amp; RVOL</th>
                <th>Risk / Reward</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {paginatedStocks.map((stock) => {
                const s = stock.primary_setup || {};
                const tr = stock.trading_range || {};
                const isBull = s.direction === 'BULLISH';
                const isBear = s.direction === 'BEARISH';
                const badgeClass = s.setup_key || 'base_acc';
                const score = stock.wyckoff_score || 50;
                const posPercent = Math.min(100, Math.max(0, tr.range_pos_pct || 50));

                return (
                  <tr
                    key={stock.ticker}
                    className="wyckoff-row"
                    onClick={() => openStockModal(stock.ticker)}
                  >
                    <td>
                      <div className="stock-ticker-cell">
                        <span className="stock-symbol">{stock.ticker}</span>
                        <span className="stock-price-sub">
                          ${stock.current_price?.toFixed(2)}
                          <span style={{ color: stock.pct_change >= 0 ? '#10b981' : '#f43f5e', marginLeft: '4px' }}>
                            {stock.pct_change >= 0 ? `+${stock.pct_change}%` : `${stock.pct_change}%`}
                          </span>
                        </span>
                        {stock.sector && (
                          <span style={{ fontSize: '0.67rem', color: '#64748b' }}>{stock.sector}</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontFamily: 'monospace', fontSize: '0.77rem' }}>
                        <strong style={{ color: '#e2e8f0' }}>{formatCap(stock.market_cap_b)}</strong>
                        <span style={{ color: '#38bdf8', fontSize: '0.72rem' }}>
                          {stock.avg_vol_20_m != null ? `${Number(stock.avg_vol_20_m).toFixed(2)}M/d` : '—'}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className={`setup-badge ${badgeClass}`}>
                        {s.name || 'Accumulation Base'}
                      </span>
                    </td>
                    <td>
                      <span className={`phase-pill phase-${(stock.phase_letter || 'b').toLowerCase()}`}>
                        {stock.wyckoff_phase}
                      </span>
                    </td>
                    <td>
                      <div className="score-meter">
                        <div className="score-bar-bg">
                          <div
                            className="score-bar-fill"
                            style={{
                              width: `${score}%`,
                              background: score >= 75 ? '#10b981' : score >= 55 ? '#38bdf8' : score >= 40 ? '#f59e0b' : '#f43f5e'
                            }}
                          />
                        </div>
                        <span className="score-num" style={{ color: score >= 75 ? '#10b981' : score >= 55 ? '#38bdf8' : score >= 40 ? '#f59e0b' : '#f43f5e' }}>
                          {score}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="range-collar-cell">
                        <span className="creek-tag">🌊 Creek: ${tr.creek?.toFixed(2)}</span>
                        <span className="ice-tag">🧊 Ice: ${tr.ice?.toFixed(2)}</span>
                        <div className="range-mini-slider" title={`Price is at ${tr.range_pos_pct}% of trading range`}>
                          <div className="range-slider-thumb" style={{ left: `${posPercent}%` }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: '0.68rem' }}>
                          <span>Height: {tr.tr_height_pct}%</span>
                          <span style={{ color: tr.range_pos_pct >= 85 ? '#38bdf8' : tr.range_pos_pct <= 20 ? '#f43f5e' : '#cbd5e1' }}>
                            {tr.range_pos_pct}% in TR
                          </span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>
                        <strong>{tr.cause_bars}</strong> bars ({tr.cause_days}d)
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#38bdf8', marginTop: '2px' }}>
                        {tr.cause_maturity || 'Forming Cause'}
                      </div>
                      {tr.cause_start_date && (
                        <div style={{ fontSize: '0.68rem', color: '#64748b' }}>
                          Since {tr.cause_start_date}
                        </div>
                      )}
                    </td>
                    <td>
                      <div>
                        <span style={{ fontWeight: 700, color: stock.rvol >= 1.5 ? '#38bdf8' : '#cbd5e1' }}>
                          {stock.rvol}x RVOL
                        </span>
                        {tr.up_down_vol_ratio && (
                          <span style={{ marginLeft: '6px', fontSize: '0.75rem', fontWeight: 600, color: tr.up_down_vol_ratio >= 1.2 ? '#10b981' : tr.up_down_vol_ratio <= 0.8 ? '#f43f5e' : '#94a3b8' }}>
                            ({tr.up_down_vol_ratio}x Vol Flow)
                          </span>
                        )}
                        <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{stock.effort_result_bias}</div>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontWeight: 700, color: isBull ? '#10b981' : isBear ? '#f43f5e' : '#cbd5e1' }}>
                        {s.risk_reward ? `${s.risk_reward} : 1` : '2.2 : 1'}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="inspect-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          openStockModal(stock.ticker);
                        }}
                      >
                        <Compass size={13} /> Schematic
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* PAGINATION BAR */}
      {!loading && !error && filteredStocks.length > pageSize && (
        <div className="wyckoff-pagination-bar">
          <span className="wyckoff-page-info">
            Showing <strong>{((safePage - 1) * pageSize) + 1}</strong> – <strong>{Math.min(safePage * pageSize, filteredStocks.length)}</strong> of <strong>{filteredStocks.length}</strong> qualifying US equities
          </span>
          <div className="wyckoff-page-controls">
            <button
              type="button"
              className="wyckoff-page-btn"
              disabled={safePage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>
            <span className="wyckoff-page-num">Page {safePage} of {totalPages}</span>
            <button
              type="button"
              className="wyckoff-page-btn"
              disabled={safePage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* 5. WYCKOFF INTERACTIVE SCHEMATIC MODAL */}
      {activeStock && (
        <div className="wyckoff-modal-backdrop" onClick={() => setActiveStock(null)}>
          <div className="wyckoff-modal-card" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="wyckoff-modal-header">
              <div className="modal-header-left">
                <span className="modal-ticker-title">{activeStock.ticker}</span>
                {activeStock.setup_result && (
                  <>
                    <span className="modal-price-pill">
                      ${activeStock.setup_result.current_price?.toFixed(2)}
                      <span style={{ color: activeStock.setup_result.pct_change >= 0 ? '#10b981' : '#f43f5e', marginLeft: '6px' }}>
                        {activeStock.setup_result.pct_change >= 0 ? `+${activeStock.setup_result.pct_change}%` : `${activeStock.setup_result.pct_change}%`}
                      </span>
                    </span>
                    <span className={`setup-badge ${activeStock.setup_result.primary_setup?.setup_key || 'base_acc'}`}>
                      {activeStock.setup_result.primary_setup?.name}
                    </span>
                    {activeStock.phase_progression?.schematic_type === 'DISTRIBUTION' ? (
                      <span className="schematic-badge dist-badge">
                        ⚠️ DISTRIBUTION SCHEMATIC
                      </span>
                    ) : (
                      <span className="schematic-badge acc-badge">
                        🏛️ ACCUMULATION SCHEMATIC
                      </span>
                    )}
                    <span className={`phase-pill phase-${(activeStock.setup_result.phase_letter || 'b').toLowerCase()}`}>
                      {activeStock.setup_result.wyckoff_phase}
                    </span>
                    <span className="phase-pill" style={{ borderColor: '#38bdf8', color: '#38bdf8' }}>
                      {activeStock.cause_and_effect?.cause_maturity}
                    </span>
                  </>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {activeStock.setup_result && (
                  <button
                    type="button"
                    className="modal-copy-btn"
                    onClick={() => handleCopyTicket(activeStock)}
                  >
                    {copiedTicket ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                    {copiedTicket ? 'Ticket Copied' : 'Copy Bracket Ticket'}
                  </button>
                )}
                <button type="button" className="modal-close-btn" onClick={() => setActiveStock(null)}>
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="wyckoff-modal-body">
              {activeStock.loading ? (
                <div style={{ padding: '4rem', textAlign: 'center', color: '#94a3b8' }}>
                  <RefreshCw size={28} className="spin-animation" style={{ margin: '0 auto 12px auto' }} />
                  <div>Synthesizing Wyckoff Schematic &amp; The Creek / The Ice Collars...</div>
                </div>
              ) : activeStock.error ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#f43f5e' }}>
                  {activeStock.error}
                </div>
              ) : (
                <>
                  {/* 5-Phase Progression Stepper Ribbon */}
                  {activeStock.phase_progression && (
                    <div className="phase-stepper-container">
                      <div className={`schematic-title-banner ${activeStock.phase_progression.schematic_type === 'DISTRIBUTION' ? 'dist' : 'acc'}`}>
                        <span className="schematic-title-tag">
                          {activeStock.phase_progression.schematic_type === 'DISTRIBUTION' ? '⚠️ DISTRIBUTION SCHEMATIC' : '🏛️ ACCUMULATION SCHEMATIC'}
                        </span>
                        <span className="schematic-title-name">
                          {activeStock.phase_progression.schematic_name}
                        </span>
                      </div>
                      <div className="phase-stepper-track">
                        {(activeStock.phase_progression.phases || []).map((p) => {
                          const isCurrent = p.id === activeStock.phase_progression.current_phase;
                          const isPast = p.id < activeStock.phase_progression.current_phase;
                          const isDist = activeStock.phase_progression.schematic_type === 'DISTRIBUTION';
                          const stepClass = isCurrent ? (isDist ? 'active-dist' : 'active') : isPast ? (isDist ? 'completed-dist' : 'completed') : 'pending';
                          return (
                            <div key={p.id} className={`phase-step-item ${stepClass}`}>
                              <div className="phase-step-indicator">
                                <span className="phase-step-code">{p.id}</span>
                                <span className="phase-step-title">{p.name}</span>
                              </div>
                              <div className="phase-step-role">{p.role}</div>
                              <div className="phase-step-events">{p.events}</div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="phase-stepper-status">
                        <div className="phase-status-text">
                          <strong>Cycle Progression ({activeStock.phase_progression.progress_pct}%):</strong> {activeStock.phase_progression.description}
                        </div>
                        <div className="phase-checklist-row">
                          {(() => {
                            const isDist = activeStock.phase_progression.schematic_type === 'DISTRIBUTION';
                            return (activeStock.phase_progression.checklist || []).map((item, idx) => (
                              <span
                                key={idx}
                                className={`phase-check-chip ${item.active ? (isDist ? 'active-chip-dist' : 'active-chip') : item.done ? (isDist ? 'done-chip-dist' : 'done-chip') : 'pending-chip'}`}
                              >
                                {item.done ? '✓' : '○'} {item.title}
                              </span>
                            ));
                          })()}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Candlestick & Volume Chart Card */}
                  <div className="chart-container-card">
                    <div className="chart-header-row">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        <span>
                          <strong>{activeStock.phase_progression?.schematic_name || `${selectedTf} Wyckoff Schematic`}</strong> with Automated Collar Bands
                        </span>
                        <div className="tf-btn-group">
                          {[
                            { id: '90D', label: '90D (3M)', title: 'Zoom to last 90 trading sessions (3 months)' },
                            { id: '180D', label: '180D (6M)', title: 'Zoom to last 180 trading sessions (6 months)' },
                            { id: '1Y', label: '1 Year (252D)', title: 'Zoom out to full 1-year macro context' },
                            { id: 'BASE', label: '🎯 Full Base View', title: 'Frame from onset of current consolidation base' }
                          ].map((tf) => (
                            <button
                              key={tf.id}
                              type="button"
                              className={`tf-btn ${selectedTf === tf.id ? 'active' : ''}`}
                              onClick={() => setSelectedTf(tf.id)}
                              title={tf.title}
                            >
                              {tf.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="chart-legend">
                        <div className="legend-item">
                          <span className="legend-line" style={{ background: activeStock.setup_result?.primary_setup?.direction === 'BEARISH' ? '#f59e0b' : '#10b981' }} />
                          <span style={{ color: activeStock.setup_result?.primary_setup?.direction === 'BEARISH' ? '#f59e0b' : '#10b981' }}>
                            {activeStock.cause_and_effect?.upper_collar_name || 'The Creek'} (${activeStock.setup_result?.trading_range?.creek?.toFixed(2)})
                          </span>
                        </div>
                        <div className="legend-item">
                          <span className="legend-line" style={{ background: '#f43f5e' }} />
                          <span style={{ color: '#f43f5e' }}>
                            {activeStock.cause_and_effect?.lower_collar_name || 'The Ice'} (${activeStock.setup_result?.trading_range?.ice?.toFixed(2)})
                          </span>
                        </div>
                        <div className="legend-item">
                          <span className="legend-line" style={{ background: '#64748b', borderTop: '1px dashed #94a3b8' }} />
                          <span style={{ color: '#94a3b8' }}>Mid (${activeStock.setup_result?.trading_range?.mid?.toFixed(2)})</span>
                        </div>
                      </div>
                    </div>

                    <div className="svg-chart-wrapper">
                      <WyckoffSvgChart
                        chartData={activeStock.chart_data}
                        timeframe={selectedTf}
                        baseBars={activeStock.setup_result?.trading_range?.cause_bars}
                        upperCollarName={activeStock.cause_and_effect?.upper_collar_name || 'The Creek'}
                        lowerCollarName={activeStock.cause_and_effect?.lower_collar_name || 'The Ice'}
                        isDistribution={activeStock.setup_result?.primary_setup?.direction === 'BEARISH'}
                        tradePlan={activeStock.setup_result?.primary_setup}
                      />
                    </div>
                  </div>

                  {/* Richard Wyckoff's Three Fundamental Laws */}
                  <div className="three-laws-grid">
                    {/* Law 1: Supply & Demand */}
                    <div className="law-card">
                      <div className="law-title"><Sparkles size={14} /> 1. Law of Supply &amp; Demand</div>
                      <div className="law-metric" style={{ color: activeStock.setup_result?.primary_setup?.direction === 'BULLISH' ? '#10b981' : '#f43f5e' }}>
                        {activeStock.setup_result?.primary_setup?.direction === 'BULLISH' ? 'Demand Dominant' : activeStock.setup_result?.primary_setup?.direction === 'BEARISH' ? 'Supply Dominant' : 'Balanced Equilibrium'}
                      </div>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <span className="law-sub-badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>
                          Vol Flow: {activeStock.cause_and_effect?.up_down_vol_ratio}x
                        </span>
                        <span className="law-sub-badge" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
                          Range Pos: {activeStock.cause_and_effect?.range_pos_pct}%
                        </span>
                      </div>
                      <div className="law-desc">
                        CLV: {(activeStock.setup_result?.clv * 100).toFixed(0)}% close location. {activeStock.setup_result?.primary_setup?.description}
                      </div>
                    </div>

                    {/* Law 2: Cause & Effect */}
                    {(() => {
                      const isMarkdown = activeStock.cause_and_effect?.effect_type === 'MARKDOWN';
                      const isPhaseB = activeStock.cause_and_effect?.effect_type === 'CONDITIONAL_PHASE_B';
                      const targetPrice = activeStock.cause_and_effect?.projected_target || activeStock.cause_and_effect?.projected_markup_target;
                      const targetGain = activeStock.cause_and_effect?.projected_gain_pct;
                      const gainPrefix = targetGain > 0 ? '+' : '';
                      const metricColor = isMarkdown ? '#f43f5e' : (isPhaseB ? '#38bdf8' : '#10b981');

                      return (
                        <div className="law-card">
                          <div className="law-title">
                            <Target size={14} /> 2. Law of Cause &amp; Effect ({isMarkdown ? 'P&F Markdown Objectives' : isPhaseB ? 'Dual-Potential P&F Projections' : 'P&F Markup Projections'})
                          </div>
                          <div className="law-metric" style={{ color: metricColor }}>
                            {isMarkdown ? 'Markdown Target: ' : isPhaseB ? 'Intra-Range Target: ' : 'Base Markup Target: '}
                            ${targetPrice?.toFixed(2)}
                            <span style={{ fontSize: '0.85rem', color: metricColor, marginLeft: '6px' }}>
                              ({gainPrefix}{targetGain}%)
                            </span>
                          </div>

                          {activeStock.cause_and_effect?.multi_tier_targets && (
                            <div className="multi-target-strip">
                              <div className={`target-tier-cell t1 ${isMarkdown ? 'downside' : ''}`}>
                                <span className="tier-tag">{activeStock.cause_and_effect.multi_tier_targets.t1?.name || 'T1'}</span>
                                <span className="tier-price">${activeStock.cause_and_effect.multi_tier_targets.t1?.target?.toFixed(2)}</span>
                                <span className={`tier-pct ${isMarkdown ? 'downside' : ''}`}>
                                  {activeStock.cause_and_effect.multi_tier_targets.t1?.gain_pct > 0 ? '+' : ''}{activeStock.cause_and_effect.multi_tier_targets.t1?.gain_pct}%
                                </span>
                              </div>
                              <div className={`target-tier-cell t2 ${isMarkdown ? 'downside' : ''}`}>
                                <span className="tier-tag">{activeStock.cause_and_effect.multi_tier_targets.t2?.name || 'T2'}</span>
                                <span className="tier-price">${activeStock.cause_and_effect.multi_tier_targets.t2?.target?.toFixed(2)}</span>
                                <span className={`tier-pct ${isMarkdown ? 'downside' : ''}`}>
                                  {activeStock.cause_and_effect.multi_tier_targets.t2?.gain_pct > 0 ? '+' : ''}{activeStock.cause_and_effect.multi_tier_targets.t2?.gain_pct}%
                                </span>
                              </div>
                              <div className={`target-tier-cell t3 ${isMarkdown ? 'downside' : ''}`}>
                                <span className="tier-tag">{activeStock.cause_and_effect.multi_tier_targets.t3?.name || 'T3'}</span>
                                <span className="tier-price">${activeStock.cause_and_effect.multi_tier_targets.t3?.target?.toFixed(2)}</span>
                                <span className={`tier-pct ${isMarkdown ? 'downside' : ''}`}>
                                  {activeStock.cause_and_effect.multi_tier_targets.t3?.gain_pct > 0 ? '+' : ''}{activeStock.cause_and_effect.multi_tier_targets.t3?.gain_pct}%
                                </span>
                              </div>
                            </div>
                          )}

                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginTop: '4px' }}>
                            <span className="law-sub-badge" style={{ background: isMarkdown ? 'rgba(244, 63, 94, 0.15)' : 'rgba(168, 85, 247, 0.15)', color: isMarkdown ? '#fb7185' : '#c084fc' }}>
                              {activeStock.cause_and_effect?.cause_maturity}
                            </span>
                            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                              Potency: <strong>{activeStock.cause_and_effect?.cause_potency}%</strong>
                            </span>
                          </div>
                          <div className="potency-bar-track">
                            <div className="potency-bar-fill" style={{ width: `${activeStock.cause_and_effect?.cause_potency}%`, background: isMarkdown ? '#f43f5e' : undefined }} />
                          </div>
                          <div className="law-desc">
                            Built <strong>{activeStock.cause_and_effect?.cause_duration_bars} bars</strong> ({activeStock.cause_and_effect?.cause_duration_days} calendar days) of {isMarkdown ? 'distribution' : 'base'} cause since {activeStock.cause_and_effect?.cause_start_date}.
                          </div>
                        </div>
                      );
                    })()}

                    {/* Law 3: Effort vs. Result */}
                    <div className="law-card">
                      <div className="law-title"><SlidersHorizontal size={14} /> 3. Effort vs. Result &amp; Weis Wave</div>
                      <div className="law-metric" style={{ color: '#fbbf24' }}>
                        {activeStock.setup_result?.rvol}x RVOL
                      </div>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <span className="law-sub-badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }}>
                          Spread: {activeStock.setup_result?.spread_ratio}x ATR
                        </span>
                        <span className="law-sub-badge" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
                          VDU Index: {activeStock.cause_and_effect?.vdu_index}x
                        </span>
                        {activeStock.weis_wave && (
                          <span
                            className="law-sub-badge"
                            style={{
                              background: activeStock.weis_wave.wave_dir === 'DEMAND' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                              color: activeStock.weis_wave.wave_dir === 'DEMAND' ? '#34d399' : '#fb7185'
                            }}
                          >
                            🌊 Weis {activeStock.weis_wave.wave_dir}: {activeStock.weis_wave.wave_vol_m}M ({activeStock.weis_wave.ratio}x)
                          </span>
                        )}
                      </div>
                      <div className="law-desc">
                        {activeStock.setup_result?.effort_result_bias}. {activeStock.weis_wave?.status ? `Weis Wave footprint: ${activeStock.weis_wave.status}.` : ''}
                      </div>
                    </div>
                  </div>

                  {/* Institutional Trade Execution Playbook */}
                  {activeStock.setup_result?.primary_setup && (
                    <div className={`wyckoff-playbook-card ${activeStock.setup_result.primary_setup.direction === 'BEARISH' ? 'bearish' : ''}`}>
                      <div className="wyckoff-playbook-header">
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <CheckCircle2 size={18} color={activeStock.setup_result.primary_setup.direction === 'BEARISH' ? '#f43f5e' : '#10b981'} />
                          Trade Execution Playbook: {activeStock.setup_result.primary_setup.name}
                        </span>
                        <span style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
                          Conviction: <strong>{activeStock.setup_result.primary_setup.confidence}%</strong>
                        </span>
                      </div>

                      <div className="wyckoff-playbook-grid">
                        <div className="wyckoff-playbook-cell">
                          <span className="cell-label">Ideal Entry</span>
                          <span className="cell-value" style={{ color: '#38bdf8' }}>
                            ${activeStock.setup_result.primary_setup.entry?.toFixed(2)}
                          </span>
                        </div>
                        <div className="wyckoff-playbook-cell">
                          <span className="cell-label">Invalidation / Stop</span>
                          <span className="cell-value" style={{ color: '#f43f5e' }}>
                            ${activeStock.setup_result.primary_setup.stop_loss?.toFixed(2)}
                          </span>
                        </div>
                        <div className="wyckoff-playbook-cell">
                          <span className="cell-label">{activeStock.setup_result.primary_setup.target_1_label || 'Tactical Target (T1)'}</span>
                          <span className="cell-value" style={{ color: activeStock.setup_result.primary_setup.direction === 'BEARISH' ? '#f43f5e' : '#10b981' }}>
                            ${activeStock.setup_result.primary_setup.target_1?.toFixed(2)}
                          </span>
                        </div>
                        {activeStock.setup_result.primary_setup.target_2 && (
                          <div className="wyckoff-playbook-cell">
                            <span className="cell-label">{activeStock.setup_result.primary_setup.target_2_label || 'Objective Target (T2)'}</span>
                            <span className="cell-value" style={{ color: activeStock.setup_result.primary_setup.direction === 'BEARISH' ? '#fb7185' : '#34d399' }}>
                              ${activeStock.setup_result.primary_setup.target_2?.toFixed(2)}
                            </span>
                          </div>
                        )}
                        {activeStock.setup_result.primary_setup.macro_pf_target && (
                          <div className="wyckoff-playbook-cell">
                            <span className="cell-label">Macro P&amp;F Target</span>
                            <span className="cell-value" style={{ color: activeStock.setup_result.primary_setup.direction === 'BEARISH' ? '#f43f5e' : '#38bdf8' }}>
                              ${activeStock.setup_result.primary_setup.macro_pf_target?.toFixed(2)}
                              <span style={{ fontSize: '0.72rem', marginLeft: '4px', opacity: 0.9 }}>
                                ({activeStock.setup_result.primary_setup.macro_pf_gain > 0 ? '+' : ''}{activeStock.setup_result.primary_setup.macro_pf_gain}%)
                              </span>
                            </span>
                          </div>
                        )}
                        <div className="wyckoff-playbook-cell">
                          <span className="cell-label">Risk / Reward (R/R)</span>
                          <span className="cell-value" style={{ color: '#fbbf24' }}>
                            {activeStock.setup_result.primary_setup.risk_reward} : 1
                          </span>
                        </div>
                      </div>

                      <div className="wyckoff-playbook-notes">
                        <strong>Playbook Commentary:</strong> {activeStock.setup_result.primary_setup.description}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------
// SVG Candlestick + Volume Chart with Creek/Ice Collars, SMAs, Trade Levels & Crosshair
// ---------------------------------------------------------------------------------
function WyckoffSvgChart({
  chartData,
  timeframe = '180D',
  baseBars = 45,
  upperCollarName = 'The Creek',
  lowerCollarName = 'The Ice',
  isDistribution = false,
  tradePlan = null
}) {
  const [hoverBar, setHoverBar] = useState(null);
  const [volMode, setVolMode] = useState('RVOL'); // 'RVOL' | 'WEIS'
  const [showSma, setShowSma] = useState(true);
  const [showMarkers, setShowMarkers] = useState(true);
  const [showPlan, setShowPlan] = useState(false);

  const containerRef = useRef(null);
  const [width, setWidth] = useState(900);

  useEffect(() => {
    if (!containerRef.current) return;
    const updateW = () => setWidth(containerRef.current.clientWidth || 900);
    updateW();
    window.addEventListener('resize', updateW);
    return () => window.removeEventListener('resize', updateW);
  }, []);

  if (!chartData || !chartData.candles || chartData.candles.length === 0) {
    return <div style={{ color: '#94a3b8', textAlign: 'center', paddingTop: '100px' }}>No chart data</div>;
  }

  // Enrich all candles with SMA20 and SMA50 once
  const allCandles = useMemo(() => {
    const raw = chartData.candles || [];
    return raw.map((c, idx) => {
      const s20Start = Math.max(0, idx - 19);
      const s50Start = Math.max(0, idx - 49);
      const slice20 = raw.slice(s20Start, idx + 1);
      const slice50 = raw.slice(s50Start, idx + 1);
      const sma20 = slice20.reduce((a, b) => a + b.close, 0) / slice20.length;
      const sma50 = slice50.reduce((a, b) => a + b.close, 0) / slice50.length;
      return { ...c, sma20, sma50 };
    });
  }, [chartData.candles]);

  const allMarkers = chartData.markers || [];
  const [sliderPos, setSliderPos] = useState(100);
  const [zoomLevel, setZoomLevel] = useState(1.0);

  useEffect(() => {
    setSliderPos(100);
    setZoomLevel(1.0);
  }, [timeframe]);

  const handleZoomIn = () => setZoomLevel((prev) => Math.min(3.5, Number((prev * 1.3).toFixed(2))));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(0.4, Number((prev / 1.3).toFixed(2))));
  const handleResetZoom = () => {
    setZoomLevel(1.0);
    setSliderPos(100);
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        if (e.deltaY < 0) setZoomLevel((prev) => Math.min(3.5, Number((prev * 1.12).toFixed(2))));
        else setZoomLevel((prev) => Math.max(0.4, Number((prev / 1.12).toFixed(2))));
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const windowSize = useMemo(() => {
    let base = 180;
    if (timeframe === '90D') base = 90;
    else if (timeframe === '180D') base = 180;
    else if (timeframe === '1Y') base = 252;
    else if (timeframe === 'BASE') base = Math.max(35, (baseBars || 40) + 20);
    const scaled = Math.round(base / zoomLevel);
    return Math.max(15, Math.min(allCandles.length, scaled));
  }, [allCandles, timeframe, baseBars, zoomLevel]);

  const maxOffset = Math.max(0, allCandles.length - windowSize);
  const offset = Math.round((sliderPos / 100) * maxOffset);

  const candles = useMemo(() => allCandles.slice(offset, offset + windowSize), [allCandles, offset, windowSize]);

  const markers = useMemo(() => {
    const visibleMarkers = [];
    allMarkers.forEach((m) => {
      const idx = candles.findIndex((c) => c.date === m.date);
      if (idx !== -1) visibleMarkers.push({ ...m, sliceIndex: idx });
    });
    return visibleMarkers;
  }, [allMarkers, candles]);

  const creek = chartData.creek;
  const ice = chartData.ice;
  const mid = chartData.mid;

  const height = 385;
  const priceHeight = 280;
  const volHeight = 72;
  const gap = 16;
  const padTop = 30;
  const padRight = 90;
  const padLeft = 10;
  const drawWidth = width - padLeft - padRight;

  const allHighs = candles.map((c) => c.high);
  const allLows = candles.map((c) => c.low);
  const extraPrices = [ice * 0.985, creek * 1.02];
  if (showPlan && tradePlan?.stop_loss) extraPrices.push(tradePlan.stop_loss);
  if (showPlan && tradePlan?.target_1) extraPrices.push(tradePlan.target_1);

  const minP = Math.min(...allLows, ...extraPrices);
  const maxP = Math.max(...allHighs, ...extraPrices) * 1.02;
  const pSpan = maxP - minP || 1.0;

  const maxRvolVol = Math.max(...candles.map((c) => c.volume), 1000);
  const maxWeisVol = Math.max(...candles.map((c) => c.weis_wave_vol || c.volume), 1000);
  const maxVol = volMode === 'WEIS' ? maxWeisVol : maxRvolVol;

  const getY = (price) => padTop + priceHeight - ((price - minP) / pSpan) * priceHeight;
  const getVolY = (vol) => {
    const volTop = padTop + priceHeight + gap;
    return volTop + volHeight - (vol / maxVol) * volHeight;
  };

  const barWidth = Math.max(2, Math.min(10, (drawWidth / candles.length) * 0.65));
  const step = drawWidth / candles.length;

  const creekY = getY(creek);
  const iceY = getY(ice);
  const midY = getY(mid);

  const sma20Pts = candles.map((c, i) => `${(padLeft + i * step + step / 2).toFixed(1)},${getY(c.sma20).toFixed(1)}`).join(' ');
  const sma50Pts = candles.map((c, i) => `${(padLeft + i * step + step / 2).toFixed(1)},${getY(c.sma50).toFixed(1)}`).join(' ');

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      {/* Chart Control Toolbar */}
      <div style={{ position: 'absolute', left: '14px', top: '8px', zIndex: 10, display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <div className="zoom-btn-group">
          <button type="button" className="zoom-btn" onClick={handleZoomIn} title="Zoom In (+)">
            <ZoomIn size={13} />
          </button>
          <span className="zoom-level-badge">{Math.round(zoomLevel * 100)}%</span>
          <button type="button" className="zoom-btn" onClick={handleZoomOut} title="Zoom Out (-)">
            <ZoomOut size={13} />
          </button>
          <button type="button" className="zoom-btn" onClick={handleResetZoom} title="Reset Zoom">
            <RotateCcw size={12} />
          </button>
        </div>

        <div className="vol-toggle-group">
          <button type="button" className={`vol-toggle-btn ${volMode === 'RVOL' ? 'active' : ''}`} onClick={() => setVolMode('RVOL')}>
            📊 Daily RVOL
          </button>
          <button type="button" className={`vol-toggle-btn ${volMode === 'WEIS' ? 'active' : ''}`} onClick={() => setVolMode('WEIS')}>
            🌊 Weis Wave
          </button>
        </div>

        <div className="vol-toggle-group">
          <button type="button" className={`vol-toggle-btn ${showSma ? 'active' : ''}`} onClick={() => setShowSma((p) => !p)}>
            SMA 20/50
          </button>
          <button type="button" className={`vol-toggle-btn ${showMarkers ? 'active' : ''}`} onClick={() => setShowMarkers((p) => !p)}>
            Event Pins
          </button>
          <button type="button" className={`vol-toggle-btn ${showPlan ? 'active' : ''}`} onClick={() => setShowPlan((p) => !p)}>
            Trade Plan
          </button>
        </div>
      </div>

      <svg width={width} height={height} style={{ overflow: 'visible' }}>
        {/* Creek / Ice / Mid Collars */}
        <line x1={padLeft} y1={creekY} x2={padLeft + drawWidth} y2={creekY} stroke={isDistribution ? '#f59e0b' : '#10b981'} strokeWidth="1.5" strokeDasharray="5,4" opacity="0.85" />
        <text x={padLeft + drawWidth + 6} y={creekY + 4} fill={isDistribution ? '#f59e0b' : '#10b981'} fontSize="10" fontWeight="700">{upperCollarName} (${creek.toFixed(2)})</text>

        <line x1={padLeft} y1={iceY} x2={padLeft + drawWidth} y2={iceY} stroke="#f43f5e" strokeWidth="1.5" strokeDasharray="5,4" opacity="0.85" />
        <text x={padLeft + drawWidth + 6} y={iceY + 4} fill="#f43f5e" fontSize="10" fontWeight="700">{lowerCollarName} (${ice.toFixed(2)})</text>

        <line x1={padLeft} y1={midY} x2={padLeft + drawWidth} y2={midY} stroke="#64748b" strokeWidth="1" strokeDasharray="3,3" opacity="0.5" />
        <text x={padLeft + drawWidth + 6} y={midY + 4} fill="#64748b" fontSize="10">Mid (${mid.toFixed(2)})</text>

        {/* Optional Trade Plan Overlay */}
        {showPlan && tradePlan && (
          <>
            {tradePlan.entry && (
              <>
                <line x1={padLeft} y1={getY(tradePlan.entry)} x2={padLeft + drawWidth} y2={getY(tradePlan.entry)} stroke="#38bdf8" strokeWidth="1.2" strokeDasharray="2,3" />
                <text x={padLeft + drawWidth + 6} y={getY(tradePlan.entry) + 3} fill="#38bdf8" fontSize="9.5" fontWeight="700">Entry ${tradePlan.entry.toFixed(2)}</text>
              </>
            )}
            {tradePlan.stop_loss && (
              <>
                <line x1={padLeft} y1={getY(tradePlan.stop_loss)} x2={padLeft + drawWidth} y2={getY(tradePlan.stop_loss)} stroke="#fb7185" strokeWidth="1.2" strokeDasharray="2,3" />
                <text x={padLeft + drawWidth + 6} y={getY(tradePlan.stop_loss) + 3} fill="#fb7185" fontSize="9.5" fontWeight="700">Stop ${tradePlan.stop_loss.toFixed(2)}</text>
              </>
            )}
            {tradePlan.target_1 && (
              <>
                <line x1={padLeft} y1={getY(tradePlan.target_1)} x2={padLeft + drawWidth} y2={getY(tradePlan.target_1)} stroke="#34d399" strokeWidth="1.2" strokeDasharray="2,3" />
                <text x={padLeft + drawWidth + 6} y={getY(tradePlan.target_1) + 3} fill="#34d399" fontSize="9.5" fontWeight="700">T1 ${tradePlan.target_1.toFixed(2)}</text>
              </>
            )}
          </>
        )}

        {/* Trading Range Shading */}
        <rect x={padLeft} y={Math.min(creekY, iceY)} width={drawWidth} height={Math.max(1, Math.abs(iceY - creekY))} fill="rgba(56, 189, 248, 0.03)" />

        {/* SMA 20 & SMA 50 Overlays */}
        {showSma && candles.length > 2 && (
          <>
            <polyline fill="none" stroke="#38bdf8" strokeWidth="1.2" opacity="0.65" points={sma20Pts} />
            <polyline fill="none" stroke="#a855f7" strokeWidth="1.3" strokeDasharray="3,2" opacity="0.65" points={sma50Pts} />
          </>
        )}

        {/* Crosshair Line */}
        {hoverBar && (
          <line
            x1={hoverBar.x}
            y1={padTop}
            x2={hoverBar.x}
            y2={padTop + priceHeight + gap + volHeight}
            stroke="rgba(148, 163, 184, 0.35)"
            strokeWidth="1"
            strokeDasharray="3,3"
          />
        )}

        {/* Candlesticks & Volume Bars */}
        {candles.map((c, i) => {
          const x = padLeft + i * step + step / 2;
          const openY = getY(c.open);
          const closeY = getY(c.close);
          const highY = getY(c.high);
          const lowY = getY(c.low);
          const isUp = c.close >= c.open;
          const candleColor = isUp ? '#10b981' : '#f43f5e';

          const candleTop = Math.min(openY, closeY);
          const candleH = Math.max(2, Math.abs(openY - closeY));

          const activeVol = volMode === 'WEIS' ? (c.weis_wave_vol || c.volume) : c.volume;
          const volTop = getVolY(activeVol);
          const volBottom = padTop + priceHeight + gap + volHeight;
          const volBarH = Math.max(1, volBottom - volTop);

          let volColor = isUp ? 'rgba(16, 185, 129, 0.45)' : 'rgba(244, 63, 94, 0.45)';
          if (volMode === 'WEIS') {
            volColor = c.weis_wave_dir === 1 ? 'rgba(16, 185, 129, 0.75)' : 'rgba(244, 63, 94, 0.75)';
          } else {
            if (c.rvol >= 1.8) volColor = '#38bdf8';
            else if (c.rvol <= 0.65) volColor = '#94a3b8';
          }

          return (
            <g
              key={i}
              onMouseEnter={() => setHoverBar({ candle: c, x, y: closeY, activeVol, volMode })}
              onMouseLeave={() => setHoverBar(null)}
              style={{ cursor: 'crosshair' }}
            >
              <rect x={x - step / 2} y={padTop} width={step} height={priceHeight + gap + volHeight} fill="transparent" />
              <line x1={x} y1={highY} x2={x} y2={lowY} stroke={candleColor} strokeWidth="1.2" />
              <rect x={x - barWidth / 2} y={candleTop} width={barWidth} height={candleH} fill={candleColor} rx="1" />
              <rect x={x - barWidth / 2} y={volTop} width={barWidth} height={volBarH} fill={volColor} rx="1" />
            </g>
          );
        })}

        {/* Labeled Wyckoff Event Markers */}
        {showMarkers &&
          markers.map((m, idx) => {
            const x = padLeft + (m.sliceIndex !== undefined ? m.sliceIndex : m.index) * step + step / 2;
            const y = getY(m.price);
            const isAbove = m.position === 'above';
            const pinY = isAbove ? y - 18 : y + 22;
            const labelText = m.label;
            const labelWidth = Math.max(48, labelText.length * 6.5 + 14);

            return (
              <g key={idx}>
                <circle cx={x} cy={y} r="3.5" fill={m.color} />
                <line x1={x} y1={y} x2={x} y2={pinY} stroke={m.color} strokeWidth="1" strokeDasharray="2,2" />
                <rect x={x - labelWidth / 2} y={isAbove ? pinY - 14 : pinY - 3} width={labelWidth} height="16" fill="#0f172a" stroke={m.color} strokeWidth="1.5" rx="4" />
                <text x={x} y={isAbove ? pinY - 3 : pinY + 9} fill={m.color} fontSize="8" fontWeight="800" textAnchor="middle">
                  [{labelText}]
                </text>
              </g>
            );
          })}
      </svg>

      {/* Horizontal Viewport Pan Slider */}
      <div className="chart-viewport-slider-wrap">
        <span className="slider-label-past">◀ Older ({candles[0]?.date || ''})</span>
        <div className="slider-track-container">
          <input
            type="range"
            min="0"
            max="100"
            value={sliderPos}
            onChange={(e) => setSliderPos(Number(e.target.value))}
            className="chart-viewport-range-slider"
            title="Slide chart left or right"
          />
        </div>
        <span className="slider-label-future">Recent ({candles[candles.length - 1]?.date || ''}) ▶</span>
        <button
          type="button"
          className={`slider-live-snap-btn ${sliderPos === 100 ? 'active' : ''}`}
          onClick={() => setSliderPos(100)}
          title="Snap to most recent live session"
        >
          LIVE ⚡
        </button>
      </div>

      {/* Floating Hover Tooltip */}
      {hoverBar && (
        <div
          style={{
            position: 'absolute',
            left: Math.min(hoverBar.x + 12, width - 230),
            top: 44,
            background: 'rgba(15, 23, 42, 0.96)',
            border: '1px solid #38bdf8',
            borderRadius: '8px',
            padding: '8px 12px',
            fontSize: '0.75rem',
            color: '#f8fafc',
            pointerEvents: 'none',
            boxShadow: '0 8px 24px rgba(0,0,0,0.65)',
            zIndex: 50
          }}
        >
          <div style={{ fontWeight: 800, color: '#38bdf8', marginBottom: '2px' }}>{hoverBar.candle.date}</div>
          <div>Open: ${hoverBar.candle.open.toFixed(2)} | Close: ${hoverBar.candle.close.toFixed(2)}</div>
          <div>High: ${hoverBar.candle.high.toFixed(2)} | Low: ${hoverBar.candle.low.toFixed(2)}</div>
          {hoverBar.volMode === 'WEIS' ? (
            <div>
              Weis Wave Vol:{' '}
              <span style={{ color: hoverBar.candle.weis_wave_dir === 1 ? '#10b981' : '#f43f5e', fontWeight: 700 }}>
                {(hoverBar.candle.weis_wave_vol / 1e6).toFixed(1)}M ({hoverBar.candle.weis_wave_dir === 1 ? 'Demand' : 'Supply'})
              </span>
            </div>
          ) : (
            <div>
              RVOL: <span style={{ color: '#38bdf8', fontWeight: 700 }}>{hoverBar.candle.rvol}x</span> ({(hoverBar.candle.volume / 1e6).toFixed(1)}M)
            </div>
          )}
          <div style={{ color: '#94a3b8', marginTop: '2px' }}>{hoverBar.candle.vsa_class}</div>
        </div>
      )}
    </div>
  );
}
