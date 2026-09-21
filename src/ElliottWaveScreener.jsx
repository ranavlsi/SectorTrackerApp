import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Waves, TrendingUp, TrendingDown, ShieldCheck, ShieldAlert, CheckCircle2, 
  Zap, Search, RefreshCw, Layers, Info, ChevronRight, X, ArrowUpRight, 
  ArrowDownRight, Sparkles, Target, Compass, SlidersHorizontal, Activity,
  ZoomIn, ZoomOut, RotateCcw, Maximize2
} from 'lucide-react';
import './ElliottWaveScreener.css';

export default function ElliottWaveScreener() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [searchTicker, setSearchTicker] = useState('');
  const [selectedTf, setSelectedTf] = useState('180D'); // '90D' | '180D' | '1Y' | 'ALL'
  
  // Modal State for deep interactive wave terminal
  const [activeStock, setActiveStock] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);

  // Fetch summary on mount
  const loadSummary = async (force = false) => {
    if (force) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/elliott_wave/summary?refresh=${force ? 'true' : 'false'}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to load Elliott Wave data`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error("Elliott Wave Screener fetch error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadSummary(false);
  }, []);

  const [activeTimeframe, setActiveTimeframe] = useState('1D');
  const [subwaveMode, setSubwaveMode] = useState('all'); // 'all', 'w1', 'w2', 'w3', 'w4', 'w5', 'off'
  const [contextMenu, setContextMenu] = useState(null); // { x, y }

  // Dismiss context menu on escape or global click
  useEffect(() => {
    const handleGlobalClick = () => setContextMenu(null);
    const handleKeyDown = (e) => { if (e.key === 'Escape') setContextMenu(null); };
    window.addEventListener('click', handleGlobalClick);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('click', handleGlobalClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Inspect a specific stock in deep Elliott Wave terminal with timeframe support
  const openStockModal = async (ticker, tf = '1D') => {
    if (!ticker) return;
    setActiveTimeframe(tf);
    setModalLoading(true);
    setActiveStock({ ticker: ticker.toUpperCase(), loading: true });
    try {
      const res = await fetch(`/api/elliott_wave/stock_analysis?ticker=${ticker.toUpperCase()}&timeframe=${tf}`);
      if (!res.ok) throw new Error(`Could not fetch wave analysis for ${ticker} on ${tf}`);
      const json = await res.json();
      setActiveStock(json);
    } catch (err) {
      console.error(err);
      setActiveStock({ ticker: ticker.toUpperCase(), error: err.message });
    } finally {
      setModalLoading(false);
    }
  };

  const handleTimeframeChange = async (tf) => {
    if (!activeStock || !activeStock.ticker) return;
    openStockModal(activeStock.ticker, tf);
  };

  const handleDirectSearch = (e) => {
    e.preventDefault();
    if (searchTicker.trim()) {
      openStockModal(searchTicker.trim());
    }
  };

  // Filter stocks based on selected pattern category
  const filteredStocks = useMemo(() => {
    if (!data || !data.stocks) return [];
    let list = data.stocks;
    if (selectedFilter !== 'all') {
      list = list.filter(s => {
        const p = s.pattern || {};
        const pkey = (p.pattern_key || '').toLowerCase();
        const pname = (p.pattern_name || '').toLowerCase();
        const sub = (p.sub_category || '').toLowerCase();
        const wave = (p.active_wave || '').toLowerCase();

        if (selectedFilter === 'wave3_ignition') {
          return pkey === 'impulse_w3_ignition' || Boolean(p.w3_stage) || sub.includes('wave (3)') || sub.includes('ignition');
        }
        if (selectedFilter === 'impulse_5') return pkey.includes('impulse') || pname.includes('impulse');
        if (selectedFilter === 'wave_3') return sub.includes('wave 3') || wave.includes('wave (3)') || pkey === 'impulse_w3_ignition';
        if (selectedFilter === 'wave_4') return sub.includes('wave 4') || wave.includes('wave (4)') || pkey === 'impulse_w4';
        if (selectedFilter === 'wave_5') return sub.includes('wave 5') || wave.includes('wave (5)');
        if (selectedFilter === 'flat') return pkey.includes('flat') || pname.includes('flat') || sub.includes('flat');
        if (selectedFilter === 'triangle') return pkey.includes('triangle') || pname.includes('triangle') || sub.includes('triangle');
        if (selectedFilter === 'zigzag') return pkey.includes('zigzag') || pname.includes('zigzag') || sub.includes('zigzag');
        if (selectedFilter === 'diagonal') return pkey.includes('diagonal') || pname.includes('diagonal') || sub.includes('diagonal');
        return pkey.includes(selectedFilter) || sub.includes(selectedFilter);
      });
    }
    return list;
  }, [data, selectedFilter]);

  const posture = data?.market_posture;

  return (
    <div className="elliott-container">
      {/* Hero Header */}
      <div className="elliott-hero">
        <div className="elliott-hero-top">
          <div className="elliott-title-area">
            <h1><Waves size={28} className="wave-icon-spin" /> Institutional Elliott Wave Terminal</h1>
            <div className="elliott-subtitle">
              <span>Ralph Nelson Elliott's Wave Principle</span>
              <span>•</span>
              <span>Fractal Motive & Corrective Cycle Surveillance</span>
              <span>•</span>
              <span>Cardinal Invariant Rules Engine</span>
            </div>
          </div>
          <button 
            className="elliott-refresh-btn" 
            onClick={() => loadSummary(true)} 
            disabled={loading || refreshing}
          >
            <RefreshCw size={15} className={refreshing ? "spin-animation" : ""} />
            {refreshing ? "Scanning Fractal Cycles..." : "Rescan Waves"}
          </button>
        </div>

        {/* Market Posture Matrix */}
        {posture && (
          <div className="posture-matrix">
            <div className="posture-breadth-left">
              <div className="posture-label-row">
                <span style={{ color: '#38bdf8' }}>Motive Impulse Breadth: {posture.motive_pct}%</span>
                <span style={{ color: '#ec4899' }}>Corrective Digestion: {posture.corrective_pct}%</span>
              </div>
              <div className="breadth-meter-track">
                <div className="breadth-fill-motive" style={{ width: `${posture.motive_pct}%` }} />
                <div className="breadth-fill-corrective" style={{ width: `${posture.corrective_pct}%` }} />
              </div>
              <div style={{ fontSize: '0.82rem', color: '#cbd5e1', fontWeight: 600, marginTop: '5px' }}>
                Macro Posture: <span style={{ color: posture.badge === 'MOTIVE_IMPULSE' ? '#38bdf8' : posture.badge === 'CORRECTIVE_DIGESTION' ? '#ec4899' : '#a855f7' }}>
                  {posture.text}
                </span>
              </div>
            </div>

            <div className="posture-stat-chips">
              <div className="stat-chip motive">🚀 Impulses: {posture.impulse_count}</div>
              {posture.wave3_ignition_count > 0 && (
                <div className="stat-chip ignition">⚡ Wave 3 Ignition: {posture.wave3_ignition_count}</div>
              )}
              <div className="stat-chip wave4">🎯 Wave 4 Pullbacks: {posture.wave4_count}</div>
              <div className="stat-chip wave5">⚠️ Wave 5 Exhaustions: {posture.wave5_count}</div>
              <div className="stat-chip flat">📦 Flats (3-3-5): {posture.flat_count}</div>
              <div className="stat-chip triangle">📐 Triangles: {posture.triangle_count}</div>
              <div className="stat-chip zigzag">🔄 Zigzags (5-3-5): {posture.zigzag_count}</div>
            </div>
          </div>
        )}
      </div>

      {/* Controls Bar: Filter Pills + Direct Search */}
      <div className="elliott-controls-bar">
        <div className="filter-pills-group">
          <button 
            className={`filter-pill ${selectedFilter === 'all' ? 'active' : ''}`}
            onClick={() => setSelectedFilter('all')}
          >
            All Wave Cycles ({data?.stocks?.length || 0})
          </button>
          <button 
            className={`filter-pill ignition ${selectedFilter === 'wave3_ignition' ? 'active ignition' : ''}`}
            onClick={() => setSelectedFilter('wave3_ignition')}
          >
            ⚡ Wave 3 Ignition
          </button>
          <button 
            className={`filter-pill motive ${selectedFilter === 'impulse_5' ? 'active motive' : ''}`}
            onClick={() => setSelectedFilter('impulse_5')}
          >
            🚀 5-Wave Impulses
          </button>
          <button 
            className={`filter-pill wave3 ${selectedFilter === 'wave_3' ? 'active wave3' : ''}`}
            onClick={() => setSelectedFilter('wave_3')}
          >
            ⚡ Extended Wave 3
          </button>
          <button 
            className={`filter-pill wave4 ${selectedFilter === 'wave_4' ? 'active wave4' : ''}`}
            onClick={() => setSelectedFilter('wave_4')}
          >
            🎯 Wave 4 Pullbacks
          </button>
          <button 
            className={`filter-pill wave5 ${selectedFilter === 'wave_5' ? 'active wave5' : ''}`}
            onClick={() => setSelectedFilter('wave_5')}
          >
            ⚠️ Wave 5 Blow-Offs
          </button>
          <button 
            className={`filter-pill flat ${selectedFilter === 'flat' ? 'active flat' : ''}`}
            onClick={() => setSelectedFilter('flat')}
          >
            📦 Flats (3-3-5)
          </button>
          <button 
            className={`filter-pill triangle ${selectedFilter === 'triangle' ? 'active triangle' : ''}`}
            onClick={() => setSelectedFilter('triangle')}
          >
            📐 Triangles (3-3-3-3-3)
          </button>
          <button 
            className={`filter-pill zigzag ${selectedFilter === 'zigzag' ? 'active zigzag' : ''}`}
            onClick={() => setSelectedFilter('zigzag')}
          >
            🔄 Zigzags (5-3-5)
          </button>
          <button 
            className={`filter-pill diagonal ${selectedFilter === 'diagonal' ? 'active diagonal' : ''}`}
            onClick={() => setSelectedFilter('diagonal')}
          >
            💎 Diagonals
          </button>
        </div>

        {/* Direct Ticker Search */}
        <form className="direct-search-box" onSubmit={handleDirectSearch}>
          <Search size={16} color="#64748b" />
          <input 
            type="text" 
            placeholder="Scan ticker wave (e.g. NVDA, TSLA, AAPL)..."
            value={searchTicker}
            onChange={(e) => setSearchTicker(e.target.value)}
          />
          <button type="submit" disabled={!searchTicker.trim()}>
            Scan Wave
          </button>
        </form>
      </div>

      {/* Main Screener Grid / Table */}
      <div className="elliott-table-card">
        {loading && !refreshing ? (
          <div className="loading-state">
            <RefreshCw size={28} className="spin-animation" color="#38bdf8" />
            <p>Deconstructing Elliott Wave Cycles across liquid universe...</p>
          </div>
        ) : error ? (
          <div className="error-state">
            <ShieldAlert size={28} color="#f43f5e" />
            <p>{error}</p>
            <button onClick={() => loadSummary(true)}>Retry Scan</button>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="elliott-table">
              <thead>
                <tr>
                  <th>Ticker & Price</th>
                  <th>Pattern Taxonomy</th>
                  <th>Sub-Category & Degree</th>
                  <th>Active Wave Cycle</th>
                  <th>Cardinal Rules</th>
                  <th>Fibonacci Harmonization</th>
                  <th>EWO 5/35</th>
                  <th>Trade Target & R/R</th>
                  <th style={{ textAlign: 'right' }}>Terminal</th>
                </tr>
              </thead>
              <tbody>
                {filteredStocks.map((item) => {
                  const p = item.pattern || {};
                  const isMotive = p.pattern_key === 'impulse_5' || p.pattern_key === 'impulse_w4';
                  const isFlat = p.pattern_key === 'flat';
                  const isTriangle = p.pattern_key === 'triangle';
                  const isZigzag = p.pattern_key === 'zigzag';
                  const rulesScore = p.cardinal_score || "3/3";
                  const fibs = p.fibonacci || {};

                  return (
                    <tr 
                      key={item.ticker} 
                      className="table-row-hover"
                      onClick={() => openStockModal(item.ticker)}
                      style={{ cursor: 'pointer' }}
                    >
                      {/* Ticker & Price */}
                      <td>
                        <div className="ticker-cell">
                          <span className="ticker-symbol">{item.ticker}</span>
                          <span className="ticker-price">${item.price?.toFixed(2)}</span>
                          <span className={`ticker-change ${item.pct_change >= 0 ? 'pos' : 'neg'}`}>
                            {item.pct_change >= 0 ? '+' : ''}{item.pct_change?.toFixed(2)}%
                          </span>
                        </div>
                      </td>

                      {/* Pattern Taxonomy */}
                      <td>
                        <span className={`pattern-badge ${
                          isMotive ? 'badge-motive' :
                          isTriangle ? 'badge-triangle' :
                          isFlat ? 'badge-flat' :
                          isZigzag ? 'badge-zigzag' : 'badge-cycle'
                        }`}>
                          {p.pattern_name || 'Developing Wave'}
                        </span>
                      </td>

                      {/* Sub-Category & Degree */}
                      <td>
                        <div className="subcategory-cell">
                          {p.stage_badge ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                              <span className={`w3-stage-pill ${p.stage_key || ''}`}>{p.stage_badge}</span>
                              {p.pct_above_w2 !== undefined && (
                                <span className="w3-early-turn-metric" title={`Wave 2 formed ${p.days_since_w2} bars ago`}>
                                  +{p.pct_above_w2}% from W2 ({p.days_since_w2}d)
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="subcat-title">{p.sub_category || 'Elliott Cycle'}</span>
                          )}
                          <span className="degree-tag">{p.degree || 'Primary Degree'}</span>
                        </div>
                      </td>

                      {/* Active Wave Cycle */}
                      <td>
                        <div className="active-wave-cell">
                          <span className="wave-name">{p.active_wave || 'Wave Progression'}</span>
                          <span className="wave-subdivision">{p.subdivision || 'Fractal Subdivision'}</span>
                        </div>
                      </td>

                      {/* Cardinal Rules */}
                      <td>
                        <div className="cardinal-cell">
                          <span className={`cardinal-pill ${rulesScore.startsWith('3') ? 'passed' : 'alert'}`}>
                            {rulesScore.startsWith('3') ? <ShieldCheck size={12} /> : <ShieldAlert size={12} />}
                            {rulesScore} Validated
                          </span>
                          <span className="confidence-text">{p.confidence || 80}% Conf</span>
                        </div>
                      </td>

                      {/* Fibonacci Harmonization */}
                      <td>
                        <div className="fib-cell">
                          {fibs.wave_3_extension_pct && (
                            <span className="fib-tag">W3 Ext: <strong>{fibs.wave_3_extension_pct}%</strong></span>
                          )}
                          {fibs.wave_4_retrace_pct && (
                            <span className="fib-tag">W4 Ret: <strong>{fibs.wave_4_retrace_pct}%</strong></span>
                          )}
                          {fibs.wave_2_retrace_pct && !fibs.wave_4_retrace_pct && (
                            <span className="fib-tag">W2 Ret: <strong>{fibs.wave_2_retrace_pct}%</strong></span>
                          )}
                        </div>
                      </td>

                      {/* EWO 5/35 */}
                      <td>
                        <div className="ewo-cell">
                          <Activity size={12} color="#38bdf8" />
                          <span className="ewo-val">5/35 EWO</span>
                        </div>
                      </td>

                      {/* Trade Target & R/R */}
                      <td>
                        <div className="target-cell">
                          <span className="target-price">T1: ${p.target_1?.toFixed(2) || '-'}</span>
                          <span className="rr-ratio">{p.risk_reward ? `${p.risk_reward} R/R` : '-'}</span>
                        </div>
                      </td>

                      {/* Inspect Terminal Button */}
                      <td style={{ textAlign: 'right' }}>
                        <button 
                          className="inspect-btn"
                          onClick={() => openStockModal(item.ticker)}
                        >
                          Inspect Wave <ChevronRight size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* INTERACTIVE MODAL: Deep Elliott Wave Terminal */}
      {/* ========================================================================= */}
      {activeStock && (
        <div className="elliott-modal-overlay" onClick={() => setActiveStock(null)}>
          <div className="elliott-modal-content" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="modal-header-banner">
              <div className="modal-title-left">
                <div className="modal-ticker-group">
                  <span className="modal-ticker-symbol">{activeStock.ticker}</span>
                  {activeStock.current_price && (
                    <span className="modal-ticker-price">
                      ${activeStock.current_price.toFixed(2)}
                      <span className={`modal-ticker-pct ${activeStock.pct_change >= 0 ? 'pos' : 'neg'}`}>
                        {activeStock.pct_change >= 0 ? '+' : ''}{activeStock.pct_change?.toFixed(2)}%
                      </span>
                    </span>
                  )}
                </div>

                {activeStock.pattern && (
                  <div className="modal-pattern-tags">
                    <span className="modal-pattern-name">{activeStock.pattern.pattern_name}</span>
                    {activeStock.pattern.stage_badge && (
                      <span className={`w3-stage-pill ${activeStock.pattern.stage_key || ''}`}>{activeStock.pattern.stage_badge}</span>
                    )}
                    <span className="modal-subcat-badge">{activeStock.pattern.sub_category}</span>
                    <span className="modal-wave-badge">{activeStock.pattern.active_wave}</span>
                  </div>
                )}
              </div>

              <div className="modal-actions-right">
                {/* Timeframe Quick Switcher */}
                <div className="modal-tf-bar">
                  <span className="modal-tf-title">Timeframe:</span>
                  {['1W', '1D', '1H', '15M', '5M'].map((tf) => (
                    <button
                      key={tf}
                      className={`modal-tf-btn ${activeTimeframe === tf ? 'active' : ''}`}
                      onClick={() => handleTimeframeChange(tf)}
                      title={`Analyze Elliott Wave structure on ${tf} timeframe`}
                    >
                      {tf}
                    </button>
                  ))}
                </div>

                {activeStock.pattern && (
                  <div className="confidence-pill">
                    <Sparkles size={14} color="#38bdf8" />
                    <span>Confidence: {activeStock.pattern.confidence}%</span>
                  </div>
                )}
                <button className="modal-close-btn" onClick={() => setActiveStock(null)}>
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Context menu instruction strip */}
            <div className="chart-context-tip-strip">
              <span>💡 <strong>Deep Multi-Timeframe Analysis:</strong> Right-click chart anywhere to analyze lower timeframes (5M / 15M / 1H) or macro cycles (1W / 1D) with subwave isolation.</span>
            </div>

            {/* Modal Body */}
            <div className="modal-scroll-body">
              {activeStock.loading ? (
                <div className="modal-loading-pane">
                  <RefreshCw size={36} className="spin-animation" color="#38bdf8" />
                  <p>Calculating Fractal Fibonacci Projections & Cardinal Invariants ({activeTimeframe})...</p>
                </div>
              ) : activeStock.error ? (
                <div className="modal-error-pane">
                  <ShieldAlert size={36} color="#f43f5e" />
                  <p>{activeStock.error}</p>
                </div>
              ) : (
                <>
                  {/* Multi-Degree Wave Progression Ribbon */}
                  <WaveProgressionRibbon pattern={activeStock.pattern} />

                  {/* High Performance SVG Chart & EWO Subchart */}
                  <div className="chart-container-card">
                    <div className="chart-header-row">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        <span>
                          <strong>{activeStock.timeframe_label || activeTimeframe} Elliott Wave Chart</strong> with Harmonic Fib Grid
                        </span>
                        
                        {/* Timeframe Toggles */}
                        <div className="modal-tf-bar" style={{ marginLeft: '10px' }}>
                          {['1W', '1D', '1H', '15M', '5M'].map((tf) => (
                            <button
                              key={tf}
                              className={`modal-tf-btn ${activeTimeframe === tf ? 'active' : ''}`}
                              onClick={() => handleTimeframeChange(tf)}
                              title={`Analyze Elliott Wave structure on ${tf} timeframe`}
                            >
                              {tf}
                            </button>
                          ))}
                        </div>

                        {/* Secular Macro Cycle Anchor Badge */}
                        {activeStock.secular_anchor && (
                          <div className="secular-anchor-header-badge" style={{ marginLeft: 'auto' }} title="Macro secular pivot anchor for multi-degree wave analysis">
                            ⚓ Secular Macro Anchor: <strong>${activeStock.secular_anchor.price?.toFixed(2)}</strong> ({activeStock.secular_anchor.date})
                          </div>
                        )}
                      </div>

                      {/* Chart Legend */}
                      <div className="chart-legend">
                        <div className="legend-item">
                          <span className="legend-line" style={{ background: '#38bdf8' }} />
                          <span style={{ color: '#38bdf8' }}>Primary Wave</span>
                        </div>
                        <div className="legend-item">
                          <span className="legend-line" style={{ background: '#ec4899', borderTop: '2px dashed #ec4899' }} />
                          <span style={{ color: '#ec4899' }}>Fractal Subwaves</span>
                        </div>
                        <div className="legend-item">
                          <span className="legend-line" style={{ background: '#00F0FF', borderTop: '2px dashed #00F0FF' }} />
                          <span style={{ color: '#00F0FF' }}>Future Trajectory</span>
                        </div>
                        <div className="legend-item">
                          <span className="legend-line" style={{ background: '#60a5fa', borderTop: '2px solid #60a5fa' }} />
                          <span style={{ color: '#60a5fa' }}>Elliott Channel</span>
                        </div>
                        <div className="legend-item">
                          <span className="legend-line" style={{ background: '#f59e0b', borderTop: '1px dashed #f59e0b' }} />
                          <span style={{ color: '#fbbf24' }}>Fibonacci Harmonics</span>
                        </div>
                      </div>
                    </div>

                    {/* High Performance SVG Chart */}
                    <div className="svg-chart-wrapper">
                      <ElliottWaveSvgChart 
                        chartData={activeStock.chart_data} 
                        pattern={activeStock.pattern} 
                        secularAnchor={activeStock.secular_anchor}
                        timeframe={activeTimeframe} 
                        subwaveMode={subwaveMode}
                        setSubwaveMode={setSubwaveMode}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setContextMenu({ x: e.clientX, y: e.clientY });
                        }}
                      />
                    </div>
                  </div>

                  {/* Elliott Wave Future Milestone Roadmap Card */}
                  {(activeStock.future_projection || activeStock.chart_data?.future_projection) && (() => {
                    const fp = activeStock.future_projection || activeStock.chart_data?.future_projection;
                    const nodes = fp.future_nodes || [];
                    return (
                      <div className="future-roadmap-banner">
                        <div className="roadmap-header">
                          <div className="roadmap-title-wrap">
                            <span className="roadmap-icon">🔮</span>
                            <div>
                              <div className="roadmap-title">
                                {fp.projection_title || 'Elliott Wave Future Roadmap & Harmonic Trajectory'}
                              </div>
                              <div className="roadmap-sub">
                                Based on active {activeStock.pattern?.active_wave || 'wave structure'} & Fibonacci harmonic expansions
                              </div>
                            </div>
                          </div>
                          <div className="roadmap-meta-pills">
                            {activeStock.pattern?.stage_badge && (
                              <span className={`roadmap-pill-stage ${activeStock.pattern?.stage_key || ''}`}>
                                {activeStock.pattern.stage_badge}
                              </span>
                            )}
                            <span className="roadmap-pill-conf">
                              Confidence: {fp.confidence || activeStock.pattern?.confidence || 85}%
                            </span>
                          </div>
                        </div>

                        <div className="roadmap-nodes-grid">
                          {nodes.map((node, i) => {
                            const isGainPos = (node.expected_gain_pct || 0) >= 0;
                            return (
                              <div key={`roadmap-node-${i}`} className={`roadmap-node-card ${node.type || 'peak'}`}>
                                {node.step_title && (
                                  <div className="node-card-step-badge">
                                    {node.step_title}
                                  </div>
                                )}
                                <div className="node-card-top">
                                  <span className="node-wave-tag">{node.label}</span>
                                  <span className="node-horizon-tag">⏱ {node.horizon || `${node.offset_bars} bars`}</span>
                                </div>
                                <div className="node-target-price">
                                  ${node.price?.toFixed(2)}
                                  <span className={`node-gain-pct ${isGainPos ? 'pos' : 'neg'}`}>
                                    {isGainPos ? '+' : ''}{node.expected_gain_pct}%
                                  </span>
                                </div>

                                {/* Target Date & Estimated Day of Week based on Wave Personality */}
                                {node.target_formatted && (
                                  <div className="node-target-date-box">
                                    <div className="target-day-headline">
                                      <span className="calendar-icon">📅</span>
                                      <span className="target-day-text">Target: <strong>{node.target_formatted}</strong></span>
                                    </div>
                                    {node.time_window_str && (
                                      <div className="target-window-text">
                                        Probable Window: <span>{node.time_window_str}</span>
                                      </div>
                                    )}
                                  </div>
                                )}

                                <div className="node-fib-desc">{node.fib_rationale}</div>
                                <div className="node-action-desc">{node.action}</div>

                                {/* Wave Personality & Time Behavior Rationale */}
                                {node.personality_desc && (
                                  <div className="node-personality-box">
                                    <div className="personality-label">
                                      <span>🧠</span> {node.personality_name || 'Wave Personality in Time'}
                                    </div>
                                    <div className="personality-text">
                                      {node.personality_desc}
                                    </div>
                                  </div>
                                )}

                                {node.tactics && (
                                  <div className="node-tactics-box">
                                    <span className="tactics-label">Institutional Playbook</span>
                                    {node.tactics}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {fp.invalidation_desc && (
                          <div className="roadmap-invalidation-footer">
                            <span className="invalidation-icon">🛡️</span>
                            <div className="invalidation-text">
                              <strong>Structural Invalidation:</strong> {fp.invalidation_desc}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Elliott Trend Channel Corridor Card */}
                  {(activeStock.elliott_channels || activeStock.chart_data?.elliott_channels || activeStock.pattern?.elliott_channels) && (() => {
                    const chan = activeStock.elliott_channels || activeStock.chart_data?.elliott_channels || activeStock.pattern?.elliott_channels;
                    const isPos = (chan.projected_upper_gain_pct || 0) >= 0;
                    const posPct = Math.max(0, Math.min(100, chan.channel_pos_pct || 50));
                    return (
                      <div className="future-roadmap-banner channel-roadmap-banner">
                        <div className="roadmap-header">
                          <div className="roadmap-title-wrap">
                            <span className="roadmap-icon">📐</span>
                            <div>
                              <div className="roadmap-title">
                                {chan.channel_type || 'Elliott Wave Harmonic Trend Channel'}
                              </div>
                              <div className="roadmap-sub">
                                Baseline: <strong>{chan.anchor_base}</strong> • Upper Parallel: <strong>{chan.anchor_parallel}</strong>
                              </div>
                            </div>
                          </div>
                          <div className="roadmap-meta-pills">
                            {chan.regime_badge && (
                              <span className={`channel-regime-pill ${chan.channel_regime?.toLowerCase() || ''}`}>
                                {chan.regime_badge}
                              </span>
                            )}
                            <span className={`channel-slope-pill ${chan.slope_dir?.toLowerCase()}`}>
                              {chan.slope_dir === 'ASCENDING' ? '↗ Ascending Motive' : '↘ Descending Corridor'} (${Math.abs(chan.slope || 0).toFixed(2)}/bar)
                            </span>
                          </div>
                        </div>

                        <div className="channel-metrics-grid">
                          <div className="channel-metric-cell">
                            <span className="metric-label">Channel Base Support</span>
                            <span className="metric-value base">${chan.current_base?.toFixed(2)}</span>
                            <span className="metric-sub">
                              {chan.dist_to_base_pct !== undefined ? (
                                <span className="dist-tag neg">-{chan.dist_to_base_pct}% (${chan.dist_to_base_dollars} cushion)</span>
                              ) : (
                                chan.anchor_base
                              )}
                            </span>
                          </div>

                          <div className="channel-metric-cell">
                            <span className="metric-label">Midline 50% Equilibrium</span>
                            <span className="metric-value mid">${chan.current_mid?.toFixed(2)}</span>
                            <span className="metric-sub">Harmonic Centerline</span>
                          </div>

                          <div className="channel-metric-cell">
                            <span className="metric-label">Upper Parallel Boundary</span>
                            <span className="metric-value upper">${chan.current_upper?.toFixed(2)}</span>
                            <span className="metric-sub">
                              {chan.dist_to_upper_pct !== undefined ? (
                                <span className="dist-tag pos">+{chan.dist_to_upper_pct}% (+${chan.dist_to_upper_dollars} upside)</span>
                              ) : (
                                chan.anchor_parallel
                              )}
                            </span>
                          </div>

                          <div className="channel-metric-cell highlight">
                            <span className="metric-label">Projected Upper Objective</span>
                            <span className="metric-value target">
                              ${chan.projected_upper_target?.toFixed(2)}
                              <span className={`target-gain ${isPos ? 'pos' : 'neg'}`}>
                                ({isPos ? '+' : ''}{chan.projected_upper_gain_pct}%)
                              </span>
                            </span>
                            <span className="metric-sub">Wave 5 Target Corridor (+10b)</span>
                          </div>

                          {chan.has_modified_w1_parallel && chan.projected_modified_w1_target && (
                            <div className="channel-metric-cell highlight prechter-cell" title={chan.modified_w1_rationale || ''}>
                              <span className="metric-label">Prechter Modified W1 Target</span>
                              <span className="metric-value target-amber">
                                ${chan.projected_modified_w1_target?.toFixed(2)}
                                <span className={`target-gain ${(chan.modified_w1_gain_pct || 0) >= 0 ? 'pos' : 'neg'}`}>
                                  ({(chan.modified_w1_gain_pct || 0) >= 0 ? '+' : ''}{chan.modified_w1_gain_pct}%)
                                </span>
                              </span>
                              <span className="metric-sub">Conservative Extended W3 Target</span>
                            </div>
                          )}

                          {chan.apex_idx && chan.is_converging && (
                            <div className="channel-metric-cell apex-cell" title="Wedge/Triangle trendlines converge at this point">
                              <span className="metric-label">Apex Intersection Target</span>
                              <span className="metric-value mid">
                                ${chan.apex_price?.toFixed(2)}
                              </span>
                              <span className="metric-sub">Bar #{chan.apex_idx} Convergence</span>
                            </div>
                          )}
                        </div>

                        {/* Visual Channel Position Gauge */}
                        <div className="channel-gauge-container">
                          <div className="channel-gauge-labels">
                            <span>Base Support (0%)</span>
                            <span className="channel-gauge-cur">
                              Current Corridor Position: <strong>{chan.channel_pos_pct}%</strong>
                            </span>
                            <span>Upper Boundary (100%)</span>
                          </div>
                          <div className="channel-gauge-track">
                            <div className="channel-gauge-mid-mark" style={{ left: '50%' }} title="50% Harmonic Midline" />
                            <div 
                              className="channel-gauge-pointer" 
                              style={{ left: `${posPct}%` }}
                              title={`Current price is at ${chan.channel_pos_pct}% of channel corridor`}
                            >
                              <div className="pointer-dot" />
                              <span className="pointer-label">{chan.channel_pos_pct}%</span>
                            </div>
                          </div>
                        </div>

                        {/* Channel Regime Description & Actionable Tactics */}
                        {(chan.regime_desc || chan.tactics) && (
                          <div className="channel-tactics-banner">
                            <div className="channel-tactics-header">
                              <span className="tactics-bolt">⚡</span>
                              <strong>Corridor Status:</strong> {chan.regime_desc}
                            </div>
                            {chan.tactics && (
                              <div className="channel-tactics-body">
                                <span className="tactics-tag">Tactical Rule:</span> {chan.tactics}
                              </div>
                            )}
                          </div>
                        )}

                        {chan.rationale && (
                          <div className="roadmap-invalidation-footer channel-footer">
                            <span className="invalidation-icon">💡</span>
                            <div className="invalidation-text">
                              <strong>Prechter Elliott Channel Rule:</strong> {chan.rationale}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Three Institutional Analytical Cards */}
                  <div className="three-cards-grid">
                    {/* Card 1: Cardinal Invariant Rules */}
                    <div className="analytical-card">
                      <div className="card-title">
                        <ShieldCheck size={16} color="#38bdf8" /> 1. Ralph Nelson Elliott's 3 Cardinal Rules
                      </div>
                      <div className="rules-list">
                        {(activeStock.pattern?.cardinal_rules || []).map((r, i) => (
                          <div key={i} className="rule-item">
                            <div className="rule-header">
                              <span className={`rule-icon ${r.passed ? 'pass' : 'fail'}`}>
                                {r.passed ? '✓' : '✗'}
                              </span>
                              <span className="rule-name">{r.rule_name}</span>
                              <span className={`rule-badge ${r.passed ? 'pass' : 'fail'}`}>
                                {r.verdict}
                              </span>
                            </div>
                            <div className="rule-criterion">{r.criterion}</div>
                            <div className="rule-value">Observed: <strong>{r.value}</strong></div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Card 2: Fibonacci Harmonics & Projections */}
                    <div className="analytical-card">
                      <div className="card-title">
                        <Target size={16} color="#fbbf24" /> 2. Fibonacci Harmonic Projections
                      </div>
                      <div className="fib-metrics-list">
                        {activeStock.pattern?.fibonacci?.wave_2_retrace_pct && (
                          <div className="fib-row">
                            <span className="fib-lbl">Wave 2 Retracement:</span>
                            <span className="fib-val">{activeStock.pattern.fibonacci.wave_2_retrace_pct}% (ideal 50.0% - 61.8%)</span>
                          </div>
                        )}
                        {activeStock.pattern?.fibonacci?.wave_3_extension_pct && (
                          <div className="fib-row">
                            <span className="fib-lbl">Wave 3 Expansion:</span>
                            <span className="fib-val" style={{ color: '#38bdf8', fontWeight: 'bold' }}>
                              {activeStock.pattern.fibonacci.wave_3_extension_pct}% (ideal 161.8% - 261.8%)
                            </span>
                          </div>
                        )}
                        {Boolean(activeStock.pattern?.fibonacci?.wave_4_retrace_pct) && (
                          <div className="fib-row">
                            <span className="fib-lbl">Wave 4 Retracement:</span>
                            <span className="fib-val">{activeStock.pattern.fibonacci.wave_4_retrace_pct}% (ideal 38.2%)</span>
                          </div>
                        )}
                        
                        <div className="fib-divider" />
                        <div className="fib-targets-title">Wave 5 Target Projections:</div>
                        <div className="fib-targets-grid">
                          {activeStock.pattern?.fibonacci?.fib_levels?.w5_target_conservative && (
                            <div className="fib-box">
                              <span className="t-name">Conservative (0.618 W1)</span>
                              <span className="t-val">${activeStock.pattern.fibonacci.fib_levels.w5_target_conservative}</span>
                            </div>
                          )}
                          {activeStock.pattern?.fibonacci?.fib_levels?.w5_target_standard && (
                            <div className="fib-box highlight">
                              <span className="t-name">Standard Base (1.0 W1)</span>
                              <span className="t-val">${activeStock.pattern.fibonacci.fib_levels.w5_target_standard}</span>
                            </div>
                          )}
                          {activeStock.pattern?.fibonacci?.fib_levels?.w5_target_extended && (
                            <div className="fib-box">
                              <span className="t-name">Extended (1.618 W1)</span>
                              <span className="t-val">${activeStock.pattern.fibonacci.fib_levels.w5_target_extended}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Card 3: Fractal Degree & EWO Momentum Divergence */}
                    <div className="analytical-card">
                      <div className="card-title">
                        <Activity size={16} color="#ec4899" /> 3. Elliott Wave Oscillator (EWO 5/35) & Fractals
                      </div>
                      <div className="card-content-block">
                        <div className="subwave-degree-info">
                          <div className="degree-hierarchy-row">
                            <span className="deg-box active">Primary (1)-(5)</span>
                            <span className="deg-arrow">→</span>
                            <span className="deg-box active">Intermediate 1-5</span>
                            <span className="deg-arrow">→</span>
                            <span className="deg-box active">Minor i-v</span>
                          </div>
                          <p className="degree-desc">
                            Fractal self-similarity confirmed across timeframes. Wave 3 exhibits explosive momentum density, followed by Wave 5 divergence.
                          </p>
                        </div>

                        <div className="ewo-divergence-box">
                          <div className="ewo-status-title">EWO Momentum Signature:</div>
                          <p className="ewo-status-text">
                            Oscillator (5-SMA - 35-SMA) verifies wave count validity. Wave 3 established the oscillator high-water mark; Wave 4 pulled toward the zero line; Wave 5 registers diminishing momentum.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Trade Execution Playbook */}
                  <div className="elliott-playbook-card">
                    <div className="elliott-playbook-header">
                      <Compass size={18} color="#38bdf8" />
                      <span>Quantitative Elliott Wave Trade Execution Playbook</span>
                    </div>

                    <div className="elliott-playbook-grid">
                      <div className="elliott-playbook-cell">
                        <span className="cell-label">Execution Directive</span>
                        <span className="cell-value" style={{ 
                          color: activeStock.pattern?.direction?.includes('BULLISH') ? '#10b981' : 
                                 activeStock.pattern?.direction?.includes('BEARISH') ? '#f43f5e' : '#38bdf8' 
                        }}>
                          {activeStock.pattern?.direction || 'NEUTRAL'}
                        </span>
                      </div>
                      <div className="elliott-playbook-cell">
                        <span className="cell-label">Ideal Entry Anchor</span>
                        <span className="cell-value" style={{ color: '#38bdf8' }}>
                          ${activeStock.pattern?.entry?.toFixed(2) || '-'}
                        </span>
                      </div>
                      <div className="elliott-playbook-cell">
                        <span className="cell-label">Structural Invalidation (Stop)</span>
                        <span className="cell-value" style={{ color: '#f43f5e' }}>
                          ${activeStock.pattern?.stop_loss?.toFixed(2) || '-'}
                        </span>
                      </div>
                      <div className="elliott-playbook-cell">
                        <span className="cell-label">Primary Target (T1)</span>
                        <span className="cell-value" style={{ color: '#10b981' }}>
                          ${activeStock.pattern?.target_1?.toFixed(2) || '-'}
                        </span>
                      </div>
                      <div className="elliott-playbook-cell">
                        <span className="cell-label">Expansion Target (T2)</span>
                        <span className="cell-value" style={{ color: '#a855f7' }}>
                          ${activeStock.pattern?.target_2?.toFixed(2) || '-'}
                        </span>
                      </div>
                      <div className="elliott-playbook-cell">
                        <span className="cell-label">Risk / Reward (R/R)</span>
                        <span className="cell-value" style={{ color: '#fbbf24' }}>
                          {activeStock.pattern?.risk_reward ? `${activeStock.pattern.risk_reward} : 1` : '-'}
                        </span>
                      </div>
                    </div>

                    <div className="elliott-playbook-notes">
                      <strong>Elliott Wave Strategic Blueprint:</strong> {activeStock.pattern?.description}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Right-Click Context Menu for Multi-Timeframe Analysis */}
            {contextMenu && (
              <div 
                className="elliott-context-menu"
                style={{ top: contextMenu.y, left: contextMenu.x }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="menu-header">
                  <span>⚡ Multi-Timeframe Engine</span>
                  <span className="ticker-badge">{activeStock?.ticker}</span>
                </div>
                <div className="menu-section-label">MACRO STRUCTURE</div>
                <button 
                  className={`menu-item ${activeTimeframe === '1W' ? 'active' : ''}`}
                  onClick={() => { handleTimeframeChange('1W'); setContextMenu(null); }}
                >
                  <span>Weekly Cycle (1W)</span>
                  <span className="menu-badge">Multi-Year</span>
                </button>
                <button 
                  className={`menu-item ${activeTimeframe === '1D' ? 'active' : ''}`}
                  onClick={() => { handleTimeframeChange('1D'); setContextMenu(null); }}
                >
                  <span>Daily Swings (1D)</span>
                  <span className="menu-badge">Standard</span>
                </button>
                
                <div className="menu-section-label">INTRADAY SUBWAVES</div>
                <button 
                  className={`menu-item ${activeTimeframe === '1H' ? 'active' : ''}`}
                  onClick={() => { handleTimeframeChange('1H'); setContextMenu(null); }}
                >
                  <span>Hourly Structure (1H)</span>
                  <span className="menu-badge">Wave (i)-(v)</span>
                </button>
                <button 
                  className={`menu-item ${activeTimeframe === '15M' ? 'active' : ''}`}
                  onClick={() => { handleTimeframeChange('15M'); setContextMenu(null); }}
                >
                  <span>15-Minute Micro (15M)</span>
                  <span className="menu-badge">Tactical</span>
                </button>
                <button 
                  className={`menu-item ${activeTimeframe === '5M' ? 'active' : ''}`}
                  onClick={() => { handleTimeframeChange('5M'); setContextMenu(null); }}
                >
                  <span>5-Minute Scalp (5M)</span>
                  <span className="menu-badge">Execution</span>
                </button>

                <div className="menu-divider" />
                <div className="menu-section-label">SUBWAVE FILTER</div>
                <div className="menu-subwave-grid">
                  {['all', 'w1', 'w2', 'w3', 'w4', 'w5', 'off'].map(mode => (
                    <button
                      key={mode}
                      className={`menu-subwave-btn ${subwaveMode === mode ? 'active' : ''}`}
                      onClick={() => { setSubwaveMode(mode); setContextMenu(null); }}
                    >
                      {mode.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------
// Wave Progression Ribbon Component
// ---------------------------------------------------------------------------------
function WaveProgressionRibbon({ pattern }) {
  if (!pattern) return null;
  const isTriangle = pattern.pattern_key === 'triangle';
  const isFlat = pattern.pattern_key === 'flat';
  const isZigzag = pattern.pattern_key === 'zigzag';

  let steps = [];
  let currentStepIdx = 2;

  if (isTriangle) {
    steps = [
      { id: 'A', name: 'Wave A', desc: 'Initial Reversal' },
      { id: 'B', name: 'Wave B', desc: 'First Oscillation' },
      { id: 'C', name: 'Wave C', desc: 'Contraction Pivot' },
      { id: 'D', name: 'Wave D', desc: 'Internal Retest' },
      { id: 'E', name: 'Wave E', desc: 'Apex Coil Pre-Thrust' }
    ];
    if (pattern.active_wave.includes('E')) currentStepIdx = 4;
    else if (pattern.active_wave.includes('D')) currentStepIdx = 3;
    else currentStepIdx = 2;
  } else if (isFlat) {
    steps = [
      { id: 'A', name: 'Wave A (3)', desc: 'Initial 3-Wave Move' },
      { id: 'B', name: 'Wave B (3)', desc: '100%+ Range Retest' },
      { id: 'C', name: 'Wave C (5)', desc: 'Terminal 5-Wave Flush' }
    ];
    currentStepIdx = 2;
  } else if (isZigzag) {
    steps = [
      { id: 'A', name: 'Wave A (5)', desc: 'Sharp 5-Wave Decline' },
      { id: 'B', name: 'Wave B (3)', desc: 'Shallow 3-Wave Bounce' },
      { id: 'C', name: 'Wave C (5)', desc: 'Final 5-Wave Exhaustion' }
    ];
    currentStepIdx = 2;
  } else if (pattern.pattern_key === 'diagonal') {
    steps = [
      { id: '(1)', name: 'Wave (1)', desc: 'Leading Wedge Thrust' },
      { id: '(2)', name: 'Wave (2)', desc: 'Deep Retracement' },
      { id: '(3)', name: 'Wave (3)', desc: 'Contracting Surge' },
      { id: '(4)', name: 'Wave (4)', desc: 'Overlapping Incursion' },
      { id: '(5)', name: 'Wave (5)', desc: 'Terminal Wedge Exhaustion' }
    ];
    currentStepIdx = 4;
  } else if (pattern.pattern_key === 'impulse_w4') {
    steps = [
      { id: '(1)', name: 'Wave (1)', desc: 'Trend Ignition' },
      { id: '(2)', name: 'Wave (2)', desc: 'Initial Retracement' },
      { id: '(3)', name: 'Wave (3)', desc: '161.8%+ Surge' },
      { id: '(4)', name: 'Wave (4)', desc: 'Support Retest [Active]' },
      { id: '(5)', name: 'Wave (5)', desc: 'Upcoming Target Projection' }
    ];
    currentStepIdx = 3;
  } else {
    // 5-Wave Motive Impulse
    steps = [
      { id: '(1)', name: 'Wave (1)', desc: 'Trend Ignition' },
      { id: '(2)', name: 'Wave (2)', desc: '50-61.8% Retracement' },
      { id: '(3)', name: 'Wave (3)', desc: '161.8% Impulse Surge' },
      { id: '(4)', name: 'Wave (4)', desc: '38.2% Consolidation' },
      { id: '(5)', name: 'Wave (5)', desc: 'Blow-Off Exhaustion' }
    ];
    if (pattern.active_wave.includes('(5)') || pattern.active_wave.includes('Terminal')) currentStepIdx = 4;
    else if (pattern.active_wave.includes('(4)')) currentStepIdx = 3;
    else if (pattern.active_wave.includes('(3)')) currentStepIdx = 2;
    else currentStepIdx = 1;
  }

  return (
    <div className="wave-stepper-container">
      <div className="wave-stepper-track">
        {steps.map((step, idx) => {
          const isCurrent = idx === currentStepIdx;
          const isPast = idx < currentStepIdx;
          return (
            <div 
              key={step.id} 
              className={`wave-step-item ${isCurrent ? 'active' : isPast ? 'completed' : 'pending'}`}
            >
              <div className="wave-step-indicator">
                <span className="wave-step-code">{step.id}</span>
                <span className="wave-step-title">{step.name}</span>
              </div>
              <div className="wave-step-desc">{step.desc}</div>
            </div>
          );
        })}
      </div>
      <div className="wave-stepper-status">
        <div className="wave-status-text">
          <strong>Cycle Classification:</strong> {pattern.sub_category} — <em>{pattern.active_wave}</em>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------
// SVG Candlestick + Primary Waves + Subwaves + EWO Sub-Chart + Viewport Slider
// ---------------------------------------------------------------------------------
function ElliottWaveSvgChart({ 
  chartData, 
  pattern, 
  secularAnchor, 
  timeframe = '1D', 
  subwaveMode = 'all', 
  setSubwaveMode, 
  onContextMenu 
}) {
  const [hoverBar, setHoverBar] = useState(null);
  const [showPrimary, setShowPrimary] = useState(true);
  const [showProjection, setShowProjection] = useState(true);
  const [showChannels, setShowChannels] = useState(true);
  const [sliderPos, setSliderPos] = useState(100);
  const [zoomScale, setZoomScale] = useState(1.0); // 1.0 = 100%, >1.0 = zoom in, <1.0 = zoom out, 'fit' = fit all
  const containerRef = useRef(null);
  const [width, setWidth] = useState(940);

  // Drag-to-pan state
  const isDraggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartSliderPosRef = useRef(100);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    const updateW = () => setWidth(Math.max(940, containerRef.current.clientWidth || 940));
    updateW();
    window.addEventListener('resize', updateW);
    return () => window.removeEventListener('resize', updateW);
  }, []);

  // Reset slider and zoom to default whenever timeframe changes
  useEffect(() => {
    setSliderPos(100);
    setZoomScale(1.0);
  }, [timeframe]);

  if (!chartData || !chartData.candles || chartData.candles.length === 0) {
    return <div style={{ color: '#94a3b8', textAlign: 'center', paddingTop: '100px' }}>No chart data</div>;
  }

  const allCandles = chartData.candles;
  const allWavePoints = chartData.wave_points || [];
  const allSubwaves = chartData.all_subwaves || chartData.minor_subwaves || [];
  const groupedSubwaves = chartData.grouped_subwaves || {};
  const allEwo = chartData.ewo_series || [];
  const fibLevels = chartData.fib_levels || {};
  const futureProjection = chartData.future_projection || pattern?.future_projection;
  const futureNodes = futureProjection?.future_nodes || [];
  const channel = chartData.elliott_channels || pattern?.elliott_channels;

  // Base window size for current timeframe
  const baseWindowSize = useMemo(() => {
    if (timeframe === '1W') return Math.min(allCandles.length, 100);
    if (timeframe === '1D') return Math.min(allCandles.length, 120);
    if (timeframe === '1H') return Math.min(allCandles.length, 80);
    if (timeframe === '15M' || timeframe === '5M') return Math.min(allCandles.length, 75);
    return Math.min(allCandles.length, 120);
  }, [allCandles.length, timeframe]);

  // Compute adaptive window size factoring in interactive zoom scale
  const windowSize = useMemo(() => {
    if (zoomScale === 'fit') return allCandles.length;
    const raw = Math.round(baseWindowSize / zoomScale);
    return Math.min(allCandles.length, Math.max(16, raw));
  }, [allCandles.length, baseWindowSize, zoomScale]);

  const maxOffset = Math.max(0, allCandles.length - windowSize);
  const offset = Math.round((sliderPos / 100) * maxOffset);

  // Smooth Zoom Controller with focus retention
  const updateZoom = (nextScaleOrFn) => {
    setZoomScale(prev => {
      const nextScale = typeof nextScaleOrFn === 'function' ? nextScaleOrFn(prev) : nextScaleOrFn;
      
      let newWindowSize;
      if (nextScale === 'fit') {
        newWindowSize = allCandles.length;
      } else {
        const raw = Math.round(baseWindowSize / nextScale);
        newWindowSize = Math.min(allCandles.length, Math.max(16, raw));
      }

      const currentCenter = offset + windowSize / 2;
      const isLive = sliderPos >= 98;
      const newMaxOffset = Math.max(0, allCandles.length - newWindowSize);
      
      let newSliderPos = 100;
      if (!isLive && newMaxOffset > 0) {
        const newOffset = Math.max(0, Math.min(newMaxOffset, Math.round(currentCenter - newWindowSize / 2)));
        newSliderPos = Math.round((newOffset / newMaxOffset) * 100);
      }
      
      setSliderPos(newSliderPos);
      return nextScale;
    });
  };

  const handleZoomStep = (delta) => {
    updateZoom(prev => {
      let curr = prev === 'fit' ? (baseWindowSize / allCandles.length) : prev;
      let next = Number((curr + delta).toFixed(2));
      return Math.max(0.35, Math.min(4.0, next));
    });
  };

  const handleToggleFitAll = () => {
    if (zoomScale === 'fit') {
      updateZoom(1.0);
    } else {
      updateZoom('fit');
    }
  };

  const handleResetZoom = () => {
    updateZoom(1.0);
  };

  const handleCycleZoomPreset = () => {
    if (zoomScale === 1.0) updateZoom(1.75);
    else if (zoomScale === 1.75) updateZoom(3.0);
    else if (zoomScale === 3.0) updateZoom('fit');
    else updateZoom(1.0);
  };

  // Non-passive wheel event listener for smooth trackpad/mouse scroll-to-zoom
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleWheelZoom = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const delta = e.deltaY < 0 ? 0.20 : -0.20;
      handleZoomStep(delta);
    };

    el.addEventListener('wheel', handleWheelZoom, { passive: false });
    return () => el.removeEventListener('wheel', handleWheelZoom);
  }, [allCandles.length, baseWindowSize, offset, windowSize, sliderPos]);

  // Click and drag to pan viewport left/right
  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    if (e.target.closest('button') || e.target.closest('input') || e.target.closest('.subwave-pill-group') || e.target.closest('.chart-zoom-badge')) return;
    isDraggingRef.current = true;
    dragStartXRef.current = e.clientX;
    dragStartSliderPosRef.current = sliderPos;
    setIsDragging(true);
  };

  const handleMouseMove = (e) => {
    if (isDraggingRef.current) {
      const dx = e.clientX - dragStartXRef.current;
      const pctDelta = (dx / (drawWidth || 800)) * 100 * 0.75;
      const newPos = Math.max(0, Math.min(100, dragStartSliderPosRef.current - pctDelta));
      setSliderPos(Number(newPos.toFixed(1)));
    }
  };

  const handleMouseUp = () => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      setIsDragging(false);
    }
  };

  // Sliced candles based on viewport slider position
  const candles = useMemo(() => {
    return allCandles.slice(offset, offset + windowSize);
  }, [allCandles, offset, windowSize]);

  // Sliced EWO
  const ewoSeries = useMemo(() => {
    return allEwo.slice(offset, offset + windowSize);
  }, [allEwo, offset, windowSize]);

  // Remap Primary Wave points to sliced candles
  const wavePoints = useMemo(() => {
    const visible = [];
    allWavePoints.forEach(p => {
      const idx = candles.findIndex(c => c.date === p.date);
      if (idx !== -1) {
        visible.push({ ...p, sliceIndex: idx });
      }
    });
    return visible;
  }, [allWavePoints, candles]);

  // Filter Subwaves by active subwaveMode ('all', 'w1', 'w2', 'w3', 'w4', 'w5', 'off')
  const subwavesToRender = useMemo(() => {
    if (subwaveMode === 'off') return [];
    let source = [];
    if (subwaveMode === 'all') {
      source = allSubwaves;
    } else {
      const legKey = subwaveMode.toUpperCase();
      source = groupedSubwaves[legKey] || allSubwaves.filter(s => s.wave === legKey);
    }
    const visible = [];
    source.forEach(s => {
      const idx = candles.findIndex(c => c.date === s.date);
      if (idx !== -1) {
        visible.push({ ...s, sliceIndex: idx });
      }
    });
    return visible;
  }, [subwaveMode, allSubwaves, groupedSubwaves, candles]);

  const height = 460;
  const priceHeight = 270;
  const ewoHeight = 72;
  const gap = 16;
  const padTop = 46;
  const padRight = 104;
  const padLeft = 15;
  const timeAxisHeight = 22;
  const timeAxisY = padTop + priceHeight + gap + ewoHeight + 8;
  const drawWidth = Math.max(100, width - padLeft - padRight);

  // Allocate 30 future bars on the right side if viewing live end and projection is on
  const isAtRightEnd = sliderPos >= 90;
  const futureBars = (showProjection && futureNodes.length > 0 && isAtRightEnd) ? 30 : 0;
  const totalBars = candles.length + futureBars;

  const allHighs = candles.map(c => c.high);
  const allLows = candles.map(c => c.low);
  const projPrices = (showProjection && futureNodes.length > 0 && isAtRightEnd) 
    ? futureNodes.map(n => n.price) 
    : [];
  const baseMin = Math.min(...allLows);
  const baseMax = Math.max(...allHighs);
  const validProjPrices = projPrices.filter(p => p > baseMin * 0.75 && p < baseMax * 1.5);
  const rawMinP = Math.min(baseMin, ...validProjPrices);
  const rawMaxP = Math.max(baseMax, ...validProjPrices);
  const rawSpan = (rawMaxP - rawMinP) || 1.0;
  
  // Headroom: 12% buffer above highest peak and 3% below lowest price for badge clearance
  const minP = Math.max(0.01, rawMinP - (rawSpan * 0.03));
  const maxP = rawMaxP + (rawSpan * 0.12);
  const pSpan = (maxP - minP) || 1.0;

  const maxEwoVal = Math.max(...ewoSeries.map(e => Math.abs(e.ewo || 0)), 0.1);

  const getY = (price) => {
    return padTop + priceHeight - ((price - minP) / pSpan) * priceHeight;
  };

  const getEwoY = (val) => {
    const ewoCenterY = padTop + priceHeight + gap + (ewoHeight / 2);
    const halfH = (ewoHeight / 2) - 5;
    return ewoCenterY - (val / maxEwoVal) * halfH;
  };

  const ewoZeroY = padTop + priceHeight + gap + (ewoHeight / 2);

  const barWidth = Math.max(1.8, Math.min(18, (drawWidth / (totalBars || 1)) * 0.68));
  const step = drawWidth / (totalBars || 1);

  // Y-Axis Price Scale Ticks (5 equidistant reference levels)
  const priceTicks = useMemo(() => {
    if (pSpan <= 0) return [];
    const count = 5;
    const stepVal = pSpan / (count - 1);
    const ticks = [];
    for (let i = 0; i < count; i++) {
      const price = minP + i * stepVal;
      ticks.push({
        price,
        y: getY(price),
        label: price >= 100 ? price.toFixed(2) : price.toFixed(2)
      });
    }
    return ticks;
  }, [minP, pSpan, padTop, priceHeight]);

  // X-Axis Time / Date Ticks (6-8 equidistant dates across visible window)
  const timeTicks = useMemo(() => {
    if (!candles || candles.length === 0) return [];
    const count = Math.min(candles.length, 7);
    if (count <= 1) return [];
    const interval = Math.floor((candles.length - 1) / (count - 1));
    const ticks = [];
    for (let i = 0; i < count; i++) {
      const idx = Math.min(i * interval, candles.length - 1);
      const c = candles[idx];
      if (!c) continue;
      const x = padLeft + idx * step + step / 2;
      
      let label = c.date || '';
      if (label.includes(' ')) {
        const parts = label.split(' ');
        label = `${parts[0].slice(5)} ${parts[1]}`;
      } else if (label.length === 10) {
        try {
          const d = new Date(label + 'T00:00:00');
          label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
        } catch {
          label = label.slice(5);
        }
      }
      ticks.push({ idx, x, label, date: c.date });
    }
    return ticks;
  }, [candles, step, padLeft]);

  const latestCandle = candles[candles.length - 1];

  // Build SVG path string for Primary Waves
  const primaryPathD = useMemo(() => {
    if (wavePoints.length < 2) return '';
    let d = '';
    wavePoints.forEach((p, i) => {
      const x = padLeft + p.sliceIndex * step + step / 2;
      const y = getY(p.price);
      if (i === 0) d += `M ${x} ${y}`;
      else d += ` L ${x} ${y}`;
    });
    return d;
  }, [wavePoints, step, padLeft, pSpan, minP]);

  // Build separate SVG paths for each subwave leg to avoid connecting disjoint legs
  const subwaveLegPaths = useMemo(() => {
    if (!subwavesToRender || subwavesToRender.length < 2) return [];
    const groups = {};
    subwavesToRender.forEach(s => {
      const leg = s.wave || 'W3';
      if (!groups[leg]) groups[leg] = [];
      groups[leg].push(s);
    });

    return Object.entries(groups).map(([leg, pts]) => {
      if (pts.length < 2) return null;
      let d = '';
      pts.forEach((p, i) => {
        const x = padLeft + p.sliceIndex * step + step / 2;
        const y = getY(p.price);
        if (i === 0) d += `M ${x} ${y}`;
        else d += ` L ${x} ${y}`;
      });
      return { leg, d, points: pts };
    }).filter(Boolean);
  }, [subwavesToRender, step, padLeft, pSpan, minP]);

  // Secular Macro Anchor Pin in visible range
  const secularPin = useMemo(() => {
    if (!secularAnchor || !secularAnchor.date) return null;
    const idx = candles.findIndex(c => c.date === secularAnchor.date);
    if (idx !== -1) {
      return {
        ...secularAnchor,
        sliceIndex: idx,
        x: padLeft + idx * step + step / 2,
        y: getY(secularAnchor.price)
      };
    }
    return null;
  }, [secularAnchor, candles, step, padLeft, minP, pSpan]);

  // Build SVG path string and target badges for Future Elliott Wave Projections
  const futurePathData = useMemo(() => {
    if (!showProjection || !futureNodes || futureNodes.length === 0 || candles.length === 0 || !isAtRightEnd) return null;
    const lastIdx = candles.length - 1;
    const startX = padLeft + lastIdx * step + step / 2;
    const startY = getY(candles[lastIdx]?.close || minP);

    let d = `M ${startX} ${startY}`;
    const computedNodes = [];

    futureNodes.forEach((node, i) => {
      // Dynamic spacing across futureBars corridor: guaranteed 8-10 bars separation
      const barOffset = Math.min(
        futureBars - 4, 
        Math.max(5, Math.round((i + 0.8) * ((futureBars - 5) / Math.max(1, futureNodes.length))))
      );
      const x = padLeft + (lastIdx + barOffset) * step + step / 2;
      const y = getY(node.price);
      d += ` L ${x} ${y}`;
      computedNodes.push({
        ...node,
        x,
        y,
        isPeak: node.type === 'peak' || (!node.type && i % 2 === 0)
      });
    });

    return { d, startX, startY, computedNodes };
  }, [showProjection, futureNodes, candles, step, padLeft, minP, pSpan, isAtRightEnd, futureBars]);

  // Compute Elliott Trend Channel Geometry (Prechter, Kennedy & R.N. Elliott)
  const channelGeometry = useMemo(() => {
    if (!showChannels || !channel || !candles.length) return null;

    const totalVisibleBars = candles.length + futureBars;
    if (totalVisibleBars < 2) return null;

    const sliceStartIdx = Math.max(0, (channel.start_idx !== undefined ? channel.start_idx : 0) - offset);
    const sliceEndIdx = totalVisibleBars - 1;

    if (sliceStartIdx >= sliceEndIdx) return null;

    const xStart = padLeft + sliceStartIdx * step + step / 2;
    const xEnd = padLeft + sliceEndIdx * step + step / 2;

    const absStartIdx = offset + sliceStartIdx;
    const absEndIdx = offset + sliceEndIdx;

    const slopeBase = channel.slope_base !== undefined ? channel.slope_base : (channel.slope || 0);
    const slopeUpper = channel.slope_upper !== undefined ? channel.slope_upper : (channel.slope || 0);

    const baseP1 = channel.intercept_base + slopeBase * absStartIdx;
    const baseP2 = channel.intercept_base + slopeBase * absEndIdx;

    const upperP1 = channel.intercept_upper + slopeUpper * absStartIdx;
    const upperP2 = channel.intercept_upper + slopeUpper * absEndIdx;

    const midP1 = (baseP1 + upperP1) / 2.0;
    const midP2 = (baseP2 + upperP2) / 2.0;

    const yBase1 = getY(baseP1);
    const yBase2 = getY(baseP2);

    const yUpper1 = getY(upperP1);
    const yUpper2 = getY(upperP2);

    const yMid1 = getY(midP1);
    const yMid2 = getY(midP2);

    const polyPoints = `${xStart},${yUpper1} ${xEnd},${yUpper2} ${xEnd},${yBase2} ${xStart},${yBase1}`;

    // Frost & Prechter Modified Wave 1 Parallel (for extended Wave 3)
    let modW1 = null;
    if (channel.has_modified_w1_parallel && channel.intercept_modified_w1 !== null && channel.intercept_modified_w1 !== undefined) {
      const pMod1 = channel.intercept_modified_w1 + slopeBase * absStartIdx;
      const pMod2 = channel.intercept_modified_w1 + slopeBase * absEndIdx;
      modW1 = {
        p1: pMod1,
        p2: pMod2,
        y1: getY(pMod1),
        y2: getY(pMod2),
        currPrice: channel.current_modified_w1,
        targetPrice: channel.projected_modified_w1_target,
        gainPct: channel.modified_w1_gain_pct
      };
    }

    const visibleAnchors = [];
    [channel.base_point_1, channel.base_point_2, channel.upper_anchor].forEach(pt => {
      if (!pt || pt.index === undefined) return;
      const relIdx = pt.index - offset;
      if (relIdx >= 0 && relIdx < candles.length) {
        const ax = padLeft + relIdx * step + step / 2;
        const ay = getY(pt.price);
        visibleAnchors.push({ ...pt, x: ax, y: ay });
      }
    });

    const isWedge = channel.channel_geometry_type === 'CONVERGING_WEDGE';
    const isTriangle = channel.channel_geometry_type === 'TRIANGLE_APEX';

    return {
      xStart,
      xEnd,
      yBase1,
      yBase2,
      yUpper1,
      yUpper2,
      yMid1,
      yMid2,
      baseP1,
      baseP2,
      upperP1,
      upperP2,
      polyPoints,
      modW1,
      isWedge,
      isTriangle,
      anchors: visibleAnchors
    };
  }, [showChannels, channel, offset, candles.length, futureBars, step, padLeft, minP, pSpan]);

  return (
    <div 
      ref={containerRef} 
      className={`elliott-chart-viewport-box ${isDragging ? 'is-dragging' : ''}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => {
        handleMouseUp();
        setHoverBar(null);
      }}
      onDoubleClick={handleResetZoom}
      onContextMenu={onContextMenu}
      title="Scroll wheel to Zoom • Drag to Pan • Double-click to Reset (100%) • Right-click for Menu"
    >
      {/* Top Left Controls: Primary Wave Toggle, Future Projection Toggle, Subwaves, Secular Anchor */}
      <div className="chart-top-overlay-bar">
        <div className="chart-overlay-controls-left">
          <button 
            className={`overlay-toggle-btn ${showPrimary ? 'active' : ''}`}
            onClick={() => setShowPrimary(!showPrimary)}
            title="Toggle Primary Elliott Wave Polyline"
          >
            🌊 Primary Waves
          </button>

          <button 
            className={`overlay-toggle-btn future-btn ${showProjection ? 'active' : ''}`}
            onClick={() => setShowProjection(!showProjection)}
            title="Toggle Future Elliott Wave Harmonic Projection Trajectory"
          >
            🔮 Future Projection
          </button>

          <button 
            className={`overlay-toggle-btn channel-btn ${showChannels ? 'active' : ''}`}
            onClick={() => setShowChannels(!showChannels)}
            title="Toggle Elliott Trend Channel Corridor (Base line, Upper target, Midline)"
          >
            📐 Elliott Channel
          </button>

          <div className="subwave-pill-group" title="Select Subwaves to plot">
            <span className="subwave-pill-label">Subwaves:</span>
            {[
              { id: 'all', label: 'ALL' },
              { id: 'w1', label: 'W1' },
              { id: 'w2', label: 'W2' },
              { id: 'w3', label: 'W3' },
              { id: 'w4', label: 'W4' },
              { id: 'w5', label: 'W5' },
              { id: 'off', label: 'OFF' }
            ].map(pill => (
              <button
                key={pill.id}
                className={`subwave-mode-btn ${subwaveMode === pill.id ? 'active' : ''}`}
                onClick={() => setSubwaveMode(pill.id)}
              >
                {pill.label}
              </button>
            ))}
          </div>
        </div>

        {/* Top Right Zoom Controls: Zoom In, Zoom Out, Presets, Fit All, Reset */}
        <div className="chart-overlay-controls-right">
          <div className="chart-zoom-toolbar">
            <button 
              className="chart-zoom-btn"
              onClick={() => handleZoomStep(0.25)}
              disabled={zoomScale >= 4.0}
              title="Zoom In (+25%) • Scroll Wheel Up"
            >
              <ZoomIn size={14} />
            </button>
            <span 
              className="chart-zoom-badge" 
              onClick={handleCycleZoomPreset}
              title="Click to cycle zoom presets (100% → 175% → 300% → FIT ALL)"
            >
              {zoomScale === 'fit' ? 'FIT ALL' : `${Math.round(zoomScale * 100)}%`}
            </span>
            <button 
              className="chart-zoom-btn"
              onClick={() => handleZoomStep(-0.25)}
              disabled={zoomScale <= 0.35 || zoomScale === 'fit'}
              title="Zoom Out (-25%) • Scroll Wheel Down"
            >
              <ZoomOut size={14} />
            </button>
            <button 
              className={`chart-zoom-btn fit-btn ${zoomScale === 'fit' ? 'active' : ''}`}
              onClick={handleToggleFitAll}
              title="Fit All History (Macro Perspective)"
            >
              <Maximize2 size={13} />
              <span>FIT</span>
            </button>
            <button 
              className="chart-zoom-btn reset-btn"
              onClick={handleResetZoom}
              title="Reset Zoom to 100%"
            >
              <RotateCcw size={13} />
            </button>
          </div>
        </div>
      </div>

      <svg 
        width={width} 
        height={height} 
        style={{ overflow: 'visible', userSelect: 'none' }}
        onMouseLeave={() => setHoverBar(null)}
      >
        <defs>
          <pattern id="elliottGrid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
          </pattern>
          <filter id="waveGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="futureGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="anchorGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id="channelGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.12" />
            <stop offset="50%" stopColor="#0284c7" stopOpacity="0.04" />
            <stop offset="100%" stopColor="#60a5fa" stopOpacity="0.12" />
          </linearGradient>
        </defs>

        {/* Background Grid */}
        <rect x={padLeft} y={padTop} width={drawWidth} height={priceHeight} fill="url(#elliottGrid)" />
        <rect x={padLeft} y={padTop + priceHeight + gap} width={drawWidth} height={ewoHeight} fill="rgba(15,23,42,0.6)" rx="4" />

        {/* Y-Axis Price Scale Ticks & Subtle Reference Grid Lines */}
        {priceTicks.map((tick, i) => (
          <g key={`price-tick-${i}`}>
            <line 
              x1={padLeft} 
              y1={tick.y} 
              x2={padLeft + drawWidth} 
              y2={tick.y} 
              stroke="rgba(255, 255, 255, 0.05)" 
              strokeDasharray="3 4" 
              strokeWidth="1" 
            />
            <text 
              x={padLeft + drawWidth + 6} 
              y={tick.y + 3.5} 
              fill="#64748b" 
              fontSize="10" 
              fontFamily="'JetBrains Mono', monospace" 
              fontWeight="600"
            >
              ${tick.label}
            </text>
          </g>
        ))}

        {/* Pinned Latest Closing Price Tag on Right Axis */}
        {latestCandle && (
          <g>
            <line 
              x1={padLeft} 
              y1={getY(latestCandle.close)} 
              x2={padLeft + drawWidth} 
              y2={getY(latestCandle.close)} 
              stroke={latestCandle.close >= latestCandle.open ? '#10b981' : '#f43f5e'} 
              strokeWidth="1" 
              strokeDasharray="2 2" 
              opacity="0.85" 
            />
            <rect 
              x={padLeft + drawWidth + 2} 
              y={getY(latestCandle.close) - 9} 
              width={78} 
              height={18} 
              rx="3" 
              fill={latestCandle.close >= latestCandle.open ? 'rgba(6, 95, 70, 0.95)' : 'rgba(136, 19, 55, 0.95)'} 
              stroke={latestCandle.close >= latestCandle.open ? '#10b981' : '#f43f5e'} 
              strokeWidth="1.2" 
            />
            <text 
              x={padLeft + drawWidth + 41} 
              y={getY(latestCandle.close) + 3.5} 
              fill="#ffffff" 
              fontSize="10.5" 
              fontWeight="800" 
              fontFamily="'JetBrains Mono', monospace" 
              textAnchor="middle"
            >
              ${latestCandle.close.toFixed(2)}
            </text>
          </g>
        )}

        {/* EWO Zero Line */}
        <line 
          x1={padLeft} 
          y1={ewoZeroY} 
          x2={padLeft + drawWidth} 
          y2={ewoZeroY} 
          stroke="rgba(255,255,255,0.2)" 
          strokeDasharray="3 3" 
        />
        <text 
          x={padLeft + drawWidth + 5} 
          y={ewoZeroY + 3} 
          fill="#94a3b8" 
          fontSize="10" 
          fontWeight="bold"
        >
          EWO 0.00
        </text>

        {/* Key Fibonacci Horizontal Guideline Levels */}
        {Object.entries(fibLevels).map(([k, val]) => {
          if (!val || val < minP || val > maxP) return null;
          const y = getY(val);
          let label = k.replace(/_/g, ' ');
          if (k === 'w3_target_1618') label = 'W3 161.8% Exp';
          else if (k === 'w4_retrace_382') label = 'W4 38.2% Ret';
          else if (k === 'w5_target_standard') label = 'W5 Target (1.0)';
          else if (k === 'w2_retrace_target') label = 'W2 61.8% Ret';

          return (
            <g key={k}>
              <line 
                x1={padLeft} 
                y1={y} 
                x2={padLeft + drawWidth} 
                y2={y} 
                stroke="rgba(245, 158, 11, 0.4)" 
                strokeDasharray="4 4" 
                strokeWidth="1" 
              />
              <text 
                x={padLeft + drawWidth - 8} 
                y={y - 4} 
                fill="#fbbf24" 
                fontSize="8.5" 
                fontWeight="600"
                fontFamily="'JetBrains Mono', monospace"
                textAnchor="end"
                opacity="0.85"
              >
                ┄ {label} (${val.toFixed(2)})
              </text>
            </g>
          );
        })}

        {/* Elliott Trend Channel Corridor (R.N. Elliott & Prechter Standard) */}
        {showChannels && channelGeometry && (
          <g className="elliott-channel-layer">
            {/* Subtle translucent corridor background */}
            <polygon 
              points={channelGeometry.polyPoints} 
              fill="url(#channelGradient)" 
              stroke="none" 
            />
            {/* Upper Boundary Line */}
            <line 
              x1={channelGeometry.xStart} 
              y1={channelGeometry.yUpper1} 
              x2={channelGeometry.xEnd} 
              y2={channelGeometry.yUpper2} 
              stroke={channelGeometry.isWedge ? "#f43f5e" : channelGeometry.isTriangle ? "#c084fc" : "#38bdf8"} 
              strokeWidth="2" 
              strokeDasharray={channelGeometry.isWedge || channelGeometry.isTriangle ? "5 3" : "7 4"} 
              opacity="0.95" 
            />
            {/* Inline Label on Upper Line */}
            <text 
              x={channelGeometry.xStart + 24} 
              y={channelGeometry.yUpper1 - 7} 
              fill={channelGeometry.isWedge ? "#f43f5e" : channelGeometry.isTriangle ? "#c084fc" : "#38bdf8"} 
              fontSize="8.5" 
              fontWeight="800" 
              letterSpacing="0.06em"
              opacity="0.9"
            >
              {channelGeometry.isWedge 
                ? "▲ UPPER CONVERGING BOUNDARY (WAVE 1-3)" 
                : channelGeometry.isTriangle 
                  ? "▲ UPPER TRIANGLE RESISTANCE (A-C)" 
                  : "▲ UPPER PARALLEL RESISTANCE (WAVE 5 TARGET)"}
            </text>

            {/* Midline 50% Harmonic Guide */}
            <line 
              x1={channelGeometry.xStart} 
              y1={channelGeometry.yMid1} 
              x2={channelGeometry.xEnd} 
              y2={channelGeometry.yMid2} 
              stroke="rgba(226, 232, 240, 0.55)" 
              strokeWidth="1.2" 
              strokeDasharray="4 4" 
            />
            {/* Inline Label on Midline */}
            <text 
              x={channelGeometry.xStart + 24} 
              y={channelGeometry.yMid1 - 5} 
              fill="#94a3b8" 
              fontSize="8" 
              fontWeight="600" 
              letterSpacing="0.04em"
              opacity="0.8"
            >
              {channelGeometry.isWedge 
                ? "┄ CONVERGING EQUILIBRIUM MIDLINE ┄" 
                : channelGeometry.isTriangle 
                  ? "┄ TRIANGLE APEX MIDLINE ┄" 
                  : "┄ 50% HARMONIC MIDLINE EQUILIBRIUM ┄"}
            </text>

            {/* Frost & Prechter Modified Wave 1 Parallel (for extended Wave 3) */}
            {channelGeometry.modW1 && (
              <g>
                <line 
                  x1={channelGeometry.xStart} 
                  y1={channelGeometry.modW1.y1} 
                  x2={channelGeometry.xEnd} 
                  y2={channelGeometry.modW1.y2} 
                  stroke="#fbbf24" 
                  strokeWidth="1.6" 
                  strokeDasharray="5 3" 
                  opacity="0.9" 
                />
                <text 
                  x={channelGeometry.xStart + 24} 
                  y={channelGeometry.modW1.y1 - 6} 
                  fill="#fbbf24" 
                  fontSize="8.2" 
                  fontWeight="800" 
                  letterSpacing="0.05em"
                  opacity="0.95"
                >
                  ┄ PRECHTER MODIFIED W1 PARALLEL (CONSERVATIVE TARGET) ┄
                </text>
              </g>
            )}

            {/* Base Support Line */}
            <line 
              x1={channelGeometry.xStart} 
              y1={channelGeometry.yBase1} 
              x2={channelGeometry.xEnd} 
              y2={channelGeometry.yBase2} 
              stroke={channelGeometry.isWedge ? "#f43f5e" : channelGeometry.isTriangle ? "#c084fc" : "#60a5fa"} 
              strokeWidth="2" 
              opacity="0.95" 
            />
            {/* Inline Label on Base Line */}
            <text 
              x={channelGeometry.xStart + 24} 
              y={channelGeometry.yBase1 + 15} 
              fill={channelGeometry.isWedge ? "#f43f5e" : channelGeometry.isTriangle ? "#c084fc" : "#60a5fa"} 
              fontSize="8.5" 
              fontWeight="800" 
              letterSpacing="0.06em"
              opacity="0.9"
            >
              {channelGeometry.isWedge 
                ? "▼ LOWER CONVERGING BOUNDARY (WAVE 2-4)" 
                : channelGeometry.isTriangle 
                  ? "▼ LOWER TRIANGLE SUPPORT (B-D)" 
                  : "▼ BASELINE SUPPORT (ACCUMULATION)"}
            </text>

            {/* Channel Anchors if visible */}
            {channelGeometry.anchors.map((anc, aIdx) => (
              <g key={`chan-anc-${aIdx}`}>
                <circle cx={anc.x} cy={anc.y} r="5" fill="#0284c7" stroke="#e0f2fe" strokeWidth="1.8" />
                <circle cx={anc.x} cy={anc.y} r="2" fill="#ffffff" />
              </g>
            ))}

            {/* Pinned Channel Upper Target Tag on Right Axis */}
            {isAtRightEnd && channelGeometry.yUpper2 >= padTop && channelGeometry.yUpper2 <= padTop + priceHeight && (
              <g>
                <rect 
                  x={padLeft + drawWidth + 2} 
                  y={channelGeometry.yUpper2 - 10} 
                  width={88} 
                  height={20} 
                  rx="4" 
                  fill="#082f49" 
                  stroke={channelGeometry.isWedge ? "#f43f5e" : channelGeometry.isTriangle ? "#c084fc" : "#38bdf8"} 
                  strokeWidth="1.2" 
                  opacity="0.95" 
                />
                <text 
                  x={padLeft + drawWidth + 46} 
                  y={channelGeometry.yUpper2 + 4} 
                  fill={channelGeometry.isWedge ? "#f43f5e" : channelGeometry.isTriangle ? "#c084fc" : "#38bdf8"} 
                  fontSize="8.5" 
                  fontWeight="bold" 
                  fontFamily="'JetBrains Mono', monospace" 
                  textAnchor="middle" 
                >
                  {channelGeometry.isWedge ? 'Wedge Up' : channelGeometry.isTriangle ? 'Tri Upper' : 'Ch Upper'} ${channelGeometry.upperP2.toFixed(1)}
                </text>
              </g>
            )}

            {/* Pinned Prechter Modified W1 Target Tag on Right Axis */}
            {isAtRightEnd && channelGeometry.modW1 && channelGeometry.modW1.y2 >= padTop && channelGeometry.modW1.y2 <= padTop + priceHeight && (
              <g>
                <rect 
                  x={padLeft + drawWidth + 2} 
                  y={channelGeometry.modW1.y2 - 10} 
                  width={88} 
                  height={20} 
                  rx="4" 
                  fill="#451a03" 
                  stroke="#fbbf24" 
                  strokeWidth="1.2" 
                  opacity="0.95" 
                />
                <text 
                  x={padLeft + drawWidth + 46} 
                  y={channelGeometry.modW1.y2 + 4} 
                  fill="#fbbf24" 
                  fontSize="8.5" 
                  fontWeight="bold" 
                  fontFamily="'JetBrains Mono', monospace" 
                  textAnchor="middle" 
                >
                  Mod W1 ${channelGeometry.modW1.p2.toFixed(1)}
                </text>
              </g>
            )}

            {/* Pinned Channel Base Support Tag on Right Axis */}
            {isAtRightEnd && channelGeometry.yBase2 >= padTop && channelGeometry.yBase2 <= padTop + priceHeight && (
              <g>
                <rect 
                  x={padLeft + drawWidth + 2} 
                  y={channelGeometry.yBase2 - 10} 
                  width={88} 
                  height={20} 
                  rx="4" 
                  fill="#0c2340" 
                  stroke={channelGeometry.isWedge ? "#f43f5e" : channelGeometry.isTriangle ? "#c084fc" : "#60a5fa"} 
                  strokeWidth="1.2" 
                  opacity="0.95" 
                />
                <text 
                  x={padLeft + drawWidth + 46} 
                  y={channelGeometry.yBase2 + 4} 
                  fill={channelGeometry.isWedge ? "#f43f5e" : channelGeometry.isTriangle ? "#c084fc" : "#60a5fa"} 
                  fontSize="8.5" 
                  fontWeight="bold" 
                  fontFamily="'JetBrains Mono', monospace" 
                  textAnchor="middle" 
                >
                  {channelGeometry.isWedge ? 'Wedge Low' : channelGeometry.isTriangle ? 'Tri Base' : 'Ch Base'} ${channelGeometry.baseP2.toFixed(1)}
                </text>
              </g>
            )}
          </g>
        )}

        {/* Candlesticks & EWO Histogram Bars */}
        {candles.map((c, i) => {
          const x = padLeft + i * step + step / 2;
          const isGreen = c.close >= c.open;
          const candleColor = isGreen ? '#10b981' : '#f43f5e';
          const wickColor = isGreen ? '#34d399' : '#fb7185';

          const openY = getY(c.open);
          const closeY = getY(c.close);
          const highY = getY(c.high);
          const lowY = getY(c.low);

          const bodyTop = Math.min(openY, closeY);
          const bodyH = Math.max(2, Math.abs(closeY - openY));

          // EWO Histogram
          const ewoVal = ewoSeries[i]?.ewo || 0;
          const ewoY = getEwoY(ewoVal);
          const isEwoPos = ewoVal >= 0;
          const ewoBarColor = isEwoPos ? '#38bdf8' : '#ec4899';
          const ewoTop = isEwoPos ? ewoY : ewoZeroY;
          const ewoH = Math.max(1, Math.abs(ewoY - ewoZeroY));

          return (
            <g key={c.date} onMouseEnter={() => { if (!isDraggingRef.current) setHoverBar({ candle: c, ewo: ewoVal, index: i, x }); }}>
              {/* Full-column invisible hit area for frictionless crosshair tracking */}
              <rect 
                x={x - step / 2} 
                y={padTop} 
                width={Math.max(2, step)} 
                height={priceHeight + gap + ewoHeight} 
                fill="transparent" 
                style={{ cursor: 'crosshair' }} 
              />
              {/* Candlestick Wick */}
              <line x1={x} y1={highY} x2={x} y2={lowY} stroke={wickColor} strokeWidth="1" />
              {/* Candlestick Body */}
              <rect 
                x={x - barWidth / 2} 
                y={bodyTop} 
                width={barWidth} 
                height={bodyH} 
                fill={candleColor} 
                rx="1" 
              />
              {/* EWO Histogram Bar */}
              <rect 
                x={x - Math.max(1, barWidth / 2)} 
                y={ewoTop} 
                width={Math.max(2, barWidth)} 
                height={ewoH} 
                fill={ewoBarColor} 
                opacity="0.8" 
                rx="1" 
              />
            </g>
          );
        })}

        {/* Fractal Subwaves Polylines & Circular Badges */}
        {subwaveMode !== 'off' && subwaveLegPaths.map((legPath, lIdx) => (
          <g key={`leg-${legPath.leg}-${lIdx}`}>
            <path 
              d={legPath.d} 
              fill="none" 
              stroke="#ec4899" 
              strokeWidth="1.6" 
              strokeDasharray="4 3" 
              opacity="0.9" 
            />
            {legPath.points.map((s, idx) => {
              if (s.is_origin) return null;
              const cx = padLeft + s.sliceIndex * step + step / 2;
              const cy = getY(s.price);
              const isPeak = s.is_peak !== undefined ? s.is_peak : (s.label.includes('i') && !s.label.includes('ii') && !s.label.includes('iv'));
              return (
                <g key={`sub-pt-${lIdx}-${idx}`}>
                  <circle cx={cx} cy={cy} r="4.5" fill="#1e1b4b" stroke="#ec4899" strokeWidth="1.5" />
                  <text 
                    x={cx} 
                    y={isPeak ? cy - 8 : cy + 15} 
                    textAnchor="middle" 
                    fill="#f472b6" 
                    fontSize="9.5" 
                    fontWeight="bold" 
                  >
                    {s.label}
                  </text>
                </g>
              );
            })}
          </g>
        ))}

        {/* Future Elliott Wave Harmonic Projection Trajectory & Milestone Targets */}
        {showProjection && isAtRightEnd && futurePathData && (
          <g className="future-projection-layer">
            {/* Projected Trajectory Dashed Glowing Polyline */}
            <path 
              d={futurePathData.d} 
              fill="none" 
              stroke="#00F0FF" 
              strokeWidth="2.5" 
              strokeDasharray="6 4" 
              filter="url(#futureGlow)" 
            />
            <path 
              d={futurePathData.d} 
              fill="none" 
              stroke="#e0f7fa" 
              strokeWidth="1.4" 
              strokeDasharray="6 4" 
            />

            {/* Projection Milestone Target Nodes & Horizontal Price Reference Lines */}
            {futurePathData.computedNodes.map((node, idx) => {
              const badgeW = 142;
              const badgeH = 46;
              // Strict clamping: never let badge extend past right SVG boundary
              const rawBadgeX = node.x - badgeW / 2;
              const badgeX = Math.max(padLeft + 6, Math.min(padLeft + drawWidth - badgeW - 6, rawBadgeX));
              
              // Clean alternating above/below placement:
              // For peaks: place above node as long as headroom allows (node.y - badgeH - 10 >= 8)
              // For troughs: place below node
              const badgeAbove = node.isPeak 
                ? (node.y - badgeH - 10 >= 8) 
                : false;
              const badgeY = badgeAbove ? (node.y - badgeH - 10) : (node.y + 14);
              const gainPositive = node.expected_gain_pct >= 0;

              return (
                <g key={`proj-node-${idx}`}>
                  {/* Milestone dashed connecting stem from node circle to badge */}
                  <line 
                    x1={node.x} 
                    y1={badgeAbove ? node.y - 8 : node.y + 8} 
                    x2={badgeX + badgeW / 2} 
                    y2={badgeAbove ? badgeY + badgeH : badgeY} 
                    stroke="#00F0FF" 
                    strokeWidth="1.2" 
                    strokeDasharray="2 2" 
                    opacity="0.85" 
                  />

                  {/* Horizontal projection line to right price scale */}
                  <line 
                    x1={node.x} 
                    y1={node.y} 
                    x2={padLeft + drawWidth} 
                    y2={node.y} 
                    stroke="#00F0FF" 
                    strokeWidth="1" 
                    strokeDasharray="3 3" 
                    opacity="0.45" 
                  />

                  {/* Pinned Price Tag on Right Axis */}
                  <rect 
                    x={padLeft + drawWidth + 2} 
                    y={node.y - 10} 
                    width={88} 
                    height={20} 
                    rx="4" 
                    fill="#041b2d" 
                    stroke="#00F0FF" 
                    strokeWidth="1.2" 
                  />
                  <text 
                    x={padLeft + drawWidth + 46} 
                    y={node.y + 4} 
                    fill="#00F0FF" 
                    fontSize="9" 
                    fontWeight="bold" 
                    fontFamily="'JetBrains Mono', monospace" 
                    textAnchor="middle" 
                  >
                    {node.label} ${node.price.toFixed(1)}
                  </text>

                  {/* Target Node Circle with Outer Pulsing Halo */}
                  <circle cx={node.x} cy={node.y} r="12" fill="none" stroke="#00F0FF" strokeWidth="1" opacity="0.35" strokeDasharray="3 2" />
                  <circle cx={node.x} cy={node.y} r="7" fill="#082f49" stroke="#00F0FF" strokeWidth="2" />
                  <circle cx={node.x} cy={node.y} r="3" fill="#ffffff" />

                  {/* Milestone Target Pill Badge */}
                  <rect 
                    x={badgeX} 
                    y={badgeY} 
                    width={badgeW} 
                    height={badgeH} 
                    rx="6" 
                    fill="rgba(5, 20, 38, 0.96)" 
                    stroke="#00F0FF" 
                    strokeWidth="1.5" 
                    filter="url(#futureGlow)" 
                  />

                  {/* Mini Wave Tag Pill Header inside Badge */}
                  <rect 
                    x={badgeX + 8} 
                    y={badgeY + 5} 
                    width={node.label.length * 7 + 12} 
                    height={11} 
                    rx="3" 
                    fill="rgba(0, 240, 255, 0.2)" 
                  />
                  <text 
                    x={badgeX + 8 + (node.label.length * 7 + 12) / 2} 
                    y={badgeY + 13.5} 
                    textAnchor="middle" 
                    fill="#38bdf8" 
                    fontSize="8" 
                    fontWeight="900" 
                    letterSpacing="0.04em" 
                  >
                    {node.label.toUpperCase()}
                  </text>

                  {/* Price and Gain % */}
                  <text 
                    x={badgeX + badgeW / 2} 
                    y={badgeY + 26} 
                    textAnchor="middle" 
                    fill="#ffffff" 
                    fontSize="10" 
                    fontWeight="900" 
                    fontFamily="'JetBrains Mono', monospace" 
                  >
                    ${node.price.toFixed(2)}
                    <tspan 
                      fill={gainPositive ? '#34d399' : '#fb7185'} 
                      fontSize="8.5" 
                      fontWeight="800" 
                      dx="4" 
                    >
                      ({gainPositive ? '+' : ''}{node.expected_gain_pct}%)
                    </tspan>
                  </text>

                  {/* Target Date Row */}
                  {node.target_short && (
                    <text 
                      x={badgeX + badgeW / 2} 
                      y={badgeY + 39} 
                      textAnchor="middle" 
                      fill="#38bdf8" 
                      fontSize="8.5" 
                      fontWeight="700" 
                      fontFamily="'JetBrains Mono', monospace"
                    >
                      📅 {node.target_short}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        )}

        {/* Primary Elliott Wave Polyline Path & Nodes */}
        {showPrimary && primaryPathD && (() => {
          const isCorrective = pattern?.pattern_key === 'abc_zigzag' || pattern?.pattern_name?.includes('A-B-C');
          const lineColor = isCorrective ? '#f59e0b' : '#38bdf8';
          const innerLineColor = isCorrective ? '#fef3c7' : '#e0f2fe';
          const badgeFill = isCorrective ? '#78350f' : '#0369a1';
          const badgeStroke = isCorrective ? '#f59e0b' : '#38bdf8';
          const badgeText = isCorrective ? '#fbbf24' : '#38bdf8';

          return (
            <g>
              {/* Glowing polyline */}
              <path 
                d={primaryPathD} 
                fill="none" 
                stroke={lineColor} 
                strokeWidth="2.5" 
                filter="url(#waveGlow)" 
              />
              <path 
                d={primaryPathD} 
                fill="none" 
                stroke={innerLineColor} 
                strokeWidth="1.2" 
              />

              {/* Wave Pivot Badges */}
              {wavePoints.map((p, idx) => {
                const cx = padLeft + p.sliceIndex * step + step / 2;
                const cy = getY(p.price);
                const isPeak = p.type === 'corrective_peak' || p.type === 'corrective_b' || p.label.includes('P0') || p.label.includes('(B)')
                  ? true 
                  : p.type === 'corrective_a' || p.type === 'corrective_c' || p.label.includes('(A)') || p.label.includes('(C)')
                  ? false
                  : p.label.includes('1') || p.label.includes('3') || p.label.includes('5') || p.label === 'A' || p.label === 'C' || p.label === 'E';

                return (
                  <g key={`p-${idx}`}>
                    <circle cx={cx} cy={cy} r="7" fill={badgeFill} stroke={badgeStroke} strokeWidth="2" />
                    <rect 
                      x={cx - 16} 
                      y={isPeak ? cy - 26 : cy + 10} 
                      width="32" 
                      height="16" 
                      rx="4" 
                      fill="#0f172a" 
                      stroke={badgeStroke} 
                      strokeWidth="1.2" 
                    />
                    <text 
                      x={cx} 
                      y={isPeak ? cy - 14 : cy + 22} 
                      textAnchor="middle" 
                      fill={badgeText} 
                      fontSize="10" 
                      fontWeight="bold"
                    >
                      {p.label}
                    </text>
                  </g>
                );
              })}
            </g>
          );
        })()}

        {/* Secular Macro Anchor Marker Pin (if in visible window) */}
        {secularPin && (
          <g filter="url(#anchorGlow)">
            <line 
              x1={secularPin.x} 
              y1={padTop} 
              x2={secularPin.x} 
              y2={padTop + priceHeight} 
              stroke="#fbbf24" 
              strokeWidth="1.5" 
              strokeDasharray="3 3" 
            />
            <circle cx={secularPin.x} cy={secularPin.y} r="8" fill="#d97706" stroke="#fde047" strokeWidth="2" />
            <rect 
              x={secularPin.x - 55} 
              y={secularPin.y > padTop + 40 ? secularPin.y - 32 : secularPin.y + 12} 
              width="110" 
              height="20" 
              rx="4" 
              fill="#1e1b4b" 
              stroke="#fbbf24" 
              strokeWidth="1.5" 
            />
            <text 
              x={secularPin.x} 
              y={secularPin.y > padTop + 40 ? secularPin.y - 18 : secularPin.y + 26} 
              textAnchor="middle" 
              fill="#fde047" 
              fontSize="9.5" 
              fontWeight="900"
            >
              ⚓ SECULAR ANCHOR
            </text>
          </g>
        )}

        {/* Bottom Time / Date Axis Baseline & Date Ticks */}
        <line 
          x1={padLeft} 
          y1={timeAxisY} 
          x2={padLeft + drawWidth} 
          y2={timeAxisY} 
          stroke="rgba(255, 255, 255, 0.15)" 
          strokeWidth="1" 
        />
        {timeTicks.map((t, idx) => (
          <g key={`time-tick-${idx}`}>
            <line 
              x1={t.x} 
              y1={timeAxisY} 
              x2={t.x} 
              y2={timeAxisY + 4} 
              stroke="rgba(255, 255, 255, 0.3)" 
              strokeWidth="1" 
            />
            <text 
              x={t.x} 
              y={timeAxisY + 16} 
              fill="#94a3b8" 
              fontSize="9.5" 
              fontFamily="'JetBrains Mono', monospace" 
              textAnchor="middle"
            >
              {t.label}
            </text>
          </g>
        ))}

        {/* Future Time Projection Ticks along Bottom Axis */}
        {showProjection && isAtRightEnd && futurePathData?.computedNodes.map((n, idx) => (
          <g key={`future-time-tick-${idx}`}>
            <line 
              x1={n.x} 
              y1={timeAxisY} 
              x2={n.x} 
              y2={timeAxisY + 4} 
              stroke="#00F0FF" 
              strokeWidth="1.5" 
              strokeDasharray="2 2" 
            />
            <text 
              x={n.x} 
              y={timeAxisY + 16} 
              fill="#00F0FF" 
              fontSize="9" 
              fontFamily="'JetBrains Mono', monospace" 
              fontWeight="bold" 
              textAnchor="middle"
            >
              {n.horizon || `+${n.offset_bars}d`}
            </text>
          </g>
        ))}

        {/* Dual-Axis Interactive Crosshair with Pinned Time & Price Badges */}
        {hoverBar && (
          <g>
            {/* Vertical crosshair line spanning from price top to time axis */}
            <line 
              x1={hoverBar.x} 
              y1={padTop} 
              x2={hoverBar.x} 
              y2={timeAxisY} 
              stroke="rgba(56, 189, 248, 0.5)" 
              strokeDasharray="2 2" 
            />
            {/* Horizontal crosshair line to right price axis */}
            <line 
              x1={padLeft} 
              y1={getY(hoverBar.candle.close)} 
              x2={padLeft + drawWidth} 
              y2={getY(hoverBar.candle.close)} 
              stroke="rgba(56, 189, 248, 0.5)" 
              strokeDasharray="2 2" 
            />
            <circle cx={hoverBar.x} cy={getY(hoverBar.candle.close)} r="4" fill="#38bdf8" />

            {/* Pinned Price Tag on Right Axis */}
            <rect 
              x={padLeft + drawWidth + 2} 
              y={getY(hoverBar.candle.close) - 9} 
              width={78} 
              height={18} 
              rx="3" 
              fill="#0f172a" 
              stroke="#38bdf8" 
              strokeWidth="1.2" 
            />
            <text 
              x={padLeft + drawWidth + 41} 
              y={getY(hoverBar.candle.close) + 3.5} 
              fill="#38bdf8" 
              fontSize="10" 
              fontWeight="bold" 
              fontFamily="'JetBrains Mono', monospace" 
              textAnchor="middle"
            >
              ${hoverBar.candle.close.toFixed(2)}
            </text>

            {/* Pinned Date/Time Tag on Bottom Time Axis */}
            <rect 
              x={Math.max(padLeft, Math.min(padLeft + drawWidth - 84, hoverBar.x - 42))} 
              y={timeAxisY + 2} 
              width={84} 
              height={18} 
              rx="3" 
              fill="#0f172a" 
              stroke="#38bdf8" 
              strokeWidth="1.2" 
            />
            <text 
              x={Math.max(padLeft, Math.min(padLeft + drawWidth - 84, hoverBar.x - 42)) + 42} 
              y={timeAxisY + 14.5} 
              fill="#38bdf8" 
              fontSize="9" 
              fontWeight="bold" 
              fontFamily="'JetBrains Mono', monospace" 
              textAnchor="middle"
            >
              {hoverBar.candle.date?.length > 10 ? hoverBar.candle.date.slice(5) : hoverBar.candle.date}
            </text>
          </g>
        )}
      </svg>

      {/* Chart Viewport Range Slider */}
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
            title="Slide Elliott Wave chart from left to right or right to left"
          />
        </div>
        <span className="slider-label-future">Recent ({candles[candles.length - 1]?.date || ''}) ▶</span>
        <button 
          className={`slider-live-snap-btn ${sliderPos === 100 ? 'active' : ''}`}
          onClick={() => setSliderPos(100)}
          title="Snap to most recent live session"
        >
          LIVE ⚡
        </button>

        <div className="slider-zoom-quick-group">
          <button 
            className="slider-zoom-quick-btn" 
            onClick={() => handleZoomStep(-0.25)}
            disabled={zoomScale <= 0.35 || zoomScale === 'fit'}
            title="Zoom Out (-25%)"
          >
            <ZoomOut size={12} />
          </button>
          <span 
            className="slider-zoom-quick-level" 
            onClick={handleCycleZoomPreset}
            title="Click to cycle zoom presets (100% → 175% → 300% → FIT ALL)"
          >
            {zoomScale === 'fit' ? 'FIT' : `${Math.round(zoomScale * 100)}%`}
          </span>
          <button 
            className="slider-zoom-quick-btn" 
            onClick={() => handleZoomStep(0.25)}
            disabled={zoomScale >= 4.0}
            title="Zoom In (+25%)"
          >
            <ZoomIn size={12} />
          </button>
        </div>
      </div>

      {/* Floating Hover Tooltip */}
      {hoverBar && (
        <div 
          className="chart-hover-tooltip"
          style={{
            left: Math.min(Math.max(10, hoverBar.x - 70), width - 170),
            top: 45
          }}
        >
          <div className="tooltip-date">{hoverBar.candle.date}</div>
          <div className="tooltip-row">
            <span>Close:</span>
            <strong>${hoverBar.candle.close.toFixed(2)}</strong>
          </div>
          <div className="tooltip-row">
            <span>High:</span>
            <span>${hoverBar.candle.high.toFixed(2)}</span>
          </div>
          <div className="tooltip-row">
            <span>Low:</span>
            <span>${hoverBar.candle.low.toFixed(2)}</span>
          </div>
          <div className="tooltip-row">
            <span>EWO 5/35:</span>
            <span style={{ color: hoverBar.ewo >= 0 ? '#38bdf8' : '#ec4899', fontWeight: 'bold' }}>
              {hoverBar.ewo.toFixed(2)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
