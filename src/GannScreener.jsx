import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Compass, TrendingUp, TrendingDown, ShieldCheck, ShieldAlert, CheckCircle2, 
  Zap, Search, RefreshCw, Layers, Info, ChevronRight, X, ArrowUpRight, 
  ArrowDownRight, Sparkles, Target, SlidersHorizontal, Activity, Calendar,
  Maximize2, Eye, EyeOff, ZoomIn, ZoomOut, RotateCcw, Box, Radio, Grid,
  BarChart2, Award, Crosshair, Clock
} from 'lucide-react';
import './GannScreener.css';

export default function GannScreener() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [searchTicker, setSearchTicker] = useState('');
  const [selectedTf, setSelectedTf] = useState('180D'); // '90D' | '180D' | '1Y' | 'ALL'
  
  // Layer toggles for the SVG Chart
  const [showFan, setShowFan] = useState(true);
  const [showDownFan, setShowDownFan] = useState(true);
  const [showGannBox, setShowGannBox] = useState(true);
  const [showSecondSquare, setShowSecondSquare] = useState(true);
  const [showGannSwings, setShowGannSwings] = useState(true);
  const [showSq9, setShowSq9] = useState(true);
  const [showTimeCycles, setShowTimeCycles] = useState(true);
  const [showOctaves, setShowOctaves] = useState(true);

  // Modal State & active sub-tab ('CHART' | 'SQ9_MATRIX' | 'PLAYBOOK')
  const [activeStock, setActiveStock] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalTab, setModalTab] = useState('CHART');
  const [sq9Tab, setSq9Tab] = useState('ALL'); // 'ALL' | 'RESISTANCE' | 'SUPPORT'
  const [selectedMatrixCell, setSelectedMatrixCell] = useState(null);
  const [showInfoGuide, setShowInfoGuide] = useState(false);

  // Fetch summary on load
  const loadSummary = async (force = false) => {
    if (force) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/gann/summary?refresh=${force ? 'true' : 'false'}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to load Gann data`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error("Gann Screener fetch error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadSummary(false);
  }, []);

  // Inspect a specific stock in deep Gann terminal
  const openStockModal = async (ticker) => {
    if (!ticker) return;
    setModalLoading(true);
    setModalTab('CHART');
    setSelectedMatrixCell(null);
    setActiveStock({ ticker: ticker.toUpperCase(), loading: true });
    try {
      const res = await fetch(`/api/gann/stock_analysis?ticker=${ticker.toUpperCase()}`);
      if (!res.ok) throw new Error(`Could not fetch Gann analysis for ${ticker}`);
      const json = await res.json();
      setActiveStock(json);
      if (json.square_of_9?.matrix_grid?.active_cell) {
        const ac = json.square_of_9.matrix_grid.active_cell;
        const cellObj = json.square_of_9.matrix_grid.cells.find(c => c.row === ac.row && c.col === ac.col);
        setSelectedMatrixCell(cellObj);
      }
    } catch (err) {
      console.error(err);
      setActiveStock({ ticker: ticker.toUpperCase(), error: err.message });
    } finally {
      setModalLoading(false);
    }
  };

  const handleDirectSearch = (e) => {
    e.preventDefault();
    if (searchTicker.trim()) {
      openStockModal(searchTicker.trim());
    }
  };

  // Filter stocks based on selected setup category
  const filteredStocks = useMemo(() => {
    if (!data || !data.stocks) return [];
    let list = data.stocks;
    if (selectedFilter !== 'all') {
      list = list.filter(s => {
        if (selectedFilter === 'above_1x1') return s.above_1x1;
        if (selectedFilter === 'squared') return s.is_squared;
        if (selectedFilter === 'swing_up') return s.gann_swing_trend === 'UP';
        if (selectedFilter === 'second_square') return s.second_square_active;
        if (selectedFilter === 'high_conviction') return (s.conviction || 0) >= 85;
        if (selectedFilter === 'time_confluence') {
          return s.next_confluence_cluster && s.next_confluence_cluster.confluence_score >= 40;
        }
        if (selectedFilter === 'cardinal_sq9') {
          return s.aspect_label && s.aspect_label.includes('Cardinal');
        }
        return (s.setup_key || '').includes(selectedFilter);
      });
    }
    return list;
  }, [data, selectedFilter]);

  const posture = data?.posture;

  return (
    <div className="gann-container">
      {/* Hero Header */}
      <div className="gann-hero">
        <div className="gann-hero-top">
          <div className="gann-title-area">
            <h1><Compass size={28} className="gann-compass-spin" /> Institutional W.D. Gann Terminal v3.0 📐</h1>
            <div className="gann-subtitle">
              <span>Mechanical 2-Day & 3-Day Swing Engine</span>
              <span>•</span>
              <span>The Second Square (Forward Box Projection)</span>
              <span>•</span>
              <span>Square of 9 Concentric Matrix & Multi-Harmonic Confluence</span>
            </div>
          </div>
          <div className="gann-header-actions" style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
            <button 
              className="gann-guide-btn" 
              onClick={() => setShowInfoGuide(true)}
              style={{
                background: 'rgba(56, 189, 248, 0.12)',
                border: '1px solid rgba(56, 189, 248, 0.4)',
                color: '#38bdf8',
                padding: '0.55rem 1.1rem',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                transition: 'all 0.2s ease'
              }}
            >
              <Info size={15} />
              Gann Master Guide & Tutorial 📖
            </button>
            <button 
              className="gann-refresh-btn" 
              onClick={() => loadSummary(true)} 
              disabled={loading || refreshing}
            >
              <RefreshCw size={15} className={refreshing ? "spin-animation" : ""} />
              {refreshing ? "Recalculating Mathematical Spheres..." : "Rescan Gann Universe"}
            </button>
          </div>
        </div>

        {/* Market Posture Matrix */}
        {posture && (
          <div className="gann-posture-matrix">
            <div className="posture-breadth-left">
              <div className="posture-label-row">
                <span style={{ color: '#10b981' }}>Bullish Above 1x1: {posture.bullish_1x1_pct}%</span>
                <span style={{ color: '#fbbf24' }}>Gann Swing Uptrends: {posture.swing_uptrend_count || 0} Stocks</span>
              </div>
              <div className="breadth-meter-track">
                <div className="breadth-fill-acc" style={{ width: `${posture.bullish_1x1_pct}%` }} />
                <div className="breadth-fill-dist" style={{ width: `${100 - posture.bullish_1x1_pct}%` }} />
              </div>
              <div style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 600, marginTop: '4px' }}>
                Macro Regime: <span style={{ color: posture.bullish_1x1_pct >= 50 ? '#10b981' : '#f59e0b' }}>
                  {posture.primary_regime}
                </span>
              </div>
            </div>

            <div className="posture-stat-chips">
              <div className="stat-chip chip-1x1">📐 Above 1x1 Master: {posture.bullish_1x1_count} / {posture.total_scanned}</div>
              <div className="stat-chip chip-squared">⏳ Price-Time Squared: {posture.squared_count}</div>
              <div className="stat-chip chip-second-square">📦 Second Square: {posture.second_square_count || 0}</div>
              <div className="stat-chip chip-time">⚡ Time Confluence Clusters: {posture.confluence_window_count || 0}</div>
              <div className="stat-chip chip-sq9">🌀 Square of 9 Inflections: {posture.sq9_target_count}</div>
            </div>
          </div>
        )}
      </div>

      {/* Controls Bar: Filter Pills + Direct Search */}
      <div className="gann-controls-bar">
        <div className="filter-pills-group">
          <button 
            className={`filter-pill ${selectedFilter === 'all' ? 'active' : ''}`}
            onClick={() => setSelectedFilter('all')}
          >
            All Stocks ({data?.stocks?.length || 0})
          </button>
          <button 
            className={`filter-pill pill-1x1 ${selectedFilter === 'above_1x1' ? 'active pill-1x1' : ''}`}
            onClick={() => setSelectedFilter('above_1x1')}
            title="Stocks trading above the Master 1x1 45° Gann Angle"
          >
            📐 Above 1x1 ({posture?.bullish_1x1_count || 0})
          </button>
          <button 
            className={`filter-pill pill-swing ${selectedFilter === 'swing_up' ? 'active pill-swing' : ''}`}
            onClick={() => setSelectedFilter('swing_up')}
            title="W.D. Gann Mechanical 2-Day Swing in active Uptrend"
          >
            📈 Swing Uptrend ({posture?.swing_uptrend_count || 0})
          </button>
          <button 
            className={`filter-pill pill-squared ${selectedFilter === 'squared' ? 'active pill-squared' : ''}`}
            onClick={() => setSelectedFilter('squared')}
            title="Price & Time Squaring within mathematical tolerance"
          >
            ⏳ Price-Time Squared ({posture?.squared_count || 0})
          </button>
          <button 
            className={`filter-pill pill-second-square ${selectedFilter === 'second_square' ? 'active pill-second-square' : ''}`}
            onClick={() => setSelectedFilter('second_square')}
            title="Stocks entering or expanding into the Second Square"
          >
            📦 Second Square ({posture?.second_square_count || 0})
          </button>
          <button 
            className={`filter-pill pill-time ${selectedFilter === 'time_confluence' ? 'active pill-time' : ''}`}
            onClick={() => setSelectedFilter('time_confluence')}
            title="High-probability multi-cycle confluence windows"
          >
            📅 Time Confluence ({posture?.confluence_window_count || 0})
          </button>
          <button 
            className={`filter-pill pill-sq9 ${selectedFilter === 'cardinal_sq9' ? 'active pill-sq9' : ''}`}
            onClick={() => setSelectedFilter('cardinal_sq9')}
            title="Square of 9 Cardinal Cross align (0°, 90°, 180°, 270°)"
          >
            🌀 Cardinal Cross
          </button>
          <button 
            className={`filter-pill pill-conviction ${selectedFilter === 'high_conviction' ? 'active pill-conviction' : ''}`}
            onClick={() => setSelectedFilter('high_conviction')}
            title="Gann setups with conviction score 85 or higher"
          >
            ⭐ High Conviction (≥85)
          </button>
        </div>

        {/* Direct Search Form */}
        <form className="gann-search-form" onSubmit={handleDirectSearch}>
          <input 
            type="text" 
            placeholder="Check any ticker (e.g. META, NVDA)..."
            value={searchTicker}
            onChange={(e) => setSearchTicker(e.target.value)}
            className="gann-search-input"
          />
          <button type="submit" className="gann-search-btn">
            <Zap size={14} /> Check Stock
          </button>
        </form>
      </div>

      {/* Main Screener Table */}
      <div className="gann-table-wrapper">
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
            <RefreshCw size={24} className="spin-animation" style={{ margin: '0 auto 10px auto' }} />
            <div>Computing dual-anchor Gann geometry and cycle confluence clusters...</div>
          </div>
        ) : error ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#f43f5e' }}>
            Error: {error}
          </div>
        ) : filteredStocks.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
            No stocks found matching the "{selectedFilter}" Gann filter.
          </div>
        ) : (
          <table className="gann-table">
            <thead>
              <tr>
                <th>Ticker & Price</th>
                <th>Gann Setup</th>
                <th>Active Angle</th>
                <th>Gann Mechanical Swing</th>
                <th>Square of 9 Aspect</th>
                <th>Next Time Confluence Window</th>
                <th>Squaring Status</th>
                <th>Conviction</th>
                <th>Playbook R/R</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredStocks.map((stock) => {
                const score = stock.conviction || 50;
                const cluster = stock.next_confluence_cluster;

                return (
                  <tr 
                    key={stock.ticker} 
                    className="gann-row"
                    onClick={() => openStockModal(stock.ticker)}
                  >
                    <td>
                      <div className="stock-ticker-cell">
                        <span className="stock-symbol">{stock.ticker}</span>
                        <span className="stock-price-sub">
                          ${stock.current_price?.toFixed(2)}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className={`gann-setup-badge badge-${stock.setup_key || 'standard'}`}>
                        {stock.setup_name}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span className={`angle-pill ${stock.above_1x1 ? 'angle-bullish' : 'angle-bearish'}`}>
                          {stock.active_angle}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: stock.above_1x1 ? '#10b981' : '#94a3b8' }}>
                          {stock.above_1x1 ? 'Above 1x1 ↗' : 'Below 1x1 ↘'}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span className={`swing-trend-pill ${stock.gann_swing_trend === 'UP' ? 'swing-up' : 'swing-down'}`}>
                          {stock.gann_swing_trend === 'UP' ? '↗ Swing UP' : '↘ Swing DOWN'}
                        </span>
                        {stock.second_square_active && (
                          <span className="second-square-mini-chip" title="Active inside Second Square expansion">
                            Box 2
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="sq9-cell">
                        <span className="sq9-target-price">${stock.next_sq9_target?.toFixed(2)}</span>
                        <span className="sq9-gain-sub" style={{ color: stock.next_sq9_gain >= 0 ? '#10b981' : '#f43f5e' }}>
                          ({stock.next_sq9_gain >= 0 ? `+${stock.next_sq9_gain}%` : `${stock.next_sq9_gain}%`})
                        </span>
                        <span className="sq9-degree-sub">{stock.aspect_label} ({stock.current_sq9_degree?.toFixed(0)}°)</span>
                      </div>
                    </td>
                    <td>
                      <div className="time-turn-cell">
                        {cluster ? (
                          <>
                            <span className="turn-date">
                              <Calendar size={12} /> {cluster.target_date} ({cluster.target_day})
                            </span>
                            <span className="turn-confluence-badge" style={{ color: cluster.confluence_score >= 60 ? '#f472b6' : '#cbd5e1' }}>
                              ★ {cluster.cycle_count} Cycles Converging ({cluster.delta_days >= 0 ? `In ${cluster.delta_days}d` : 'Current'})
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="turn-date"><Calendar size={12} /> {stock.next_time_turn}</span>
                            <span className="turn-cycle-name">{stock.next_time_cycle}</span>
                          </>
                        )}
                      </div>
                    </td>
                    <td>
                      {stock.is_squared ? (
                        <span className="squared-badge active">
                          <CheckCircle2 size={12} /> Squared ({stock.squaring_ratio}x)
                        </span>
                      ) : (
                        <span className="squared-badge neutral">
                          {stock.squaring_ratio}x
                        </span>
                      )}
                    </td>
                    <td>
                      <div className="score-meter">
                        <div className="score-bar-bg">
                          <div 
                            className="score-bar-fill" 
                            style={{ 
                              width: `${score}%`,
                              background: score >= 85 ? '#10b981' : score >= 65 ? '#fbbf24' : '#f43f5e'
                            }} 
                          />
                        </div>
                        <span className="score-number" style={{ color: score >= 85 ? '#10b981' : score >= 65 ? '#fbbf24' : '#f43f5e' }}>
                          {score}/100
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className="rr-badge">
                        {stock.risk_reward ? `${stock.risk_reward} : 1` : '2.0 : 1'}
                      </span>
                    </td>
                    <td>
                      <button 
                        className="inspect-action-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          openStockModal(stock.ticker);
                        }}
                      >
                        Inspect <ChevronRight size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Educational Guide Modal */}
      {showInfoGuide && (
        <GannInfoGuideModal onClose={() => setShowInfoGuide(false)} />
      )}

      {/* Deep Gann Terminal Interactive Modal */}
      {activeStock && (
        <div className="gann-modal-overlay" onClick={() => setActiveStock(null)}>
          <div className="gann-modal-content" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="gann-modal-header">
              <div className="modal-header-left">
                <div className="modal-ticker-group">
                  <span className="modal-ticker">{activeStock.ticker}</span>
                  {activeStock.current_price && (
                    <span className="modal-price">${activeStock.current_price.toFixed(2)}</span>
                  )}
                  {activeStock.playbook && (
                    <span className={`gann-setup-badge badge-${activeStock.playbook.setup_key}`}>
                      {activeStock.playbook.setup_name}
                    </span>
                  )}
                  {activeStock.gann_swings && (
                    <span className={`direction-pill ${activeStock.gann_swings.current_trend === 'UP' ? 'bullish' : 'bearish'}`}>
                      {activeStock.gann_swings.current_trend === 'UP' ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                      2-Day Swing {activeStock.gann_swings.current_trend}
                    </span>
                  )}
                  {activeStock.second_square?.is_active && (
                    <span className="second-square-badge">
                      📦 In Second Square
                    </span>
                  )}
                </div>
              </div>
              <div className="modal-header-right">
                {activeStock.playbook?.conviction && (
                  <div className="modal-conviction-badge">
                    <span>Conviction:</span>
                    <strong>{activeStock.playbook.conviction}/100</strong>
                  </div>
                )}
                <button className="modal-close-btn" onClick={() => setActiveStock(null)}>
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Navigation Tabs */}
            <div className="modal-sub-nav">
              <button 
                className={`modal-sub-tab ${modalTab === 'CHART' ? 'active' : ''}`}
                onClick={() => setModalTab('CHART')}
              >
                <BarChart2 size={15} /> Geometric Wheel & Chart
              </button>
              <button 
                className={`modal-sub-tab ${modalTab === 'SQ9_MATRIX' ? 'active' : ''}`}
                onClick={() => setModalTab('SQ9_MATRIX')}
              >
                <Compass size={15} /> Interactive Gann Wheel & Square of 9 Studio
              </button>
              <button 
                className={`modal-sub-tab ${modalTab === 'PLAYBOOK' ? 'active' : ''}`}
                onClick={() => setModalTab('PLAYBOOK')}
              >
                <ShieldCheck size={15} /> Confluence & Pyramiding Playbook
              </button>
            </div>

            {/* Modal Body */}
            <div className="gann-modal-body">
              {activeStock.loading ? (
                <div style={{ padding: '4rem', textAlign: 'center', color: '#94a3b8' }}>
                  <RefreshCw size={32} className="spin-animation" style={{ margin: '0 auto 15px auto' }} />
                  <div>Computing dual-anchor Gann Box, Mechanical Swings, and Square of 9 Spiral Matrix for {activeStock.ticker}...</div>
                </div>
              ) : activeStock.error ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: '#f43f5e' }}>
                  <h3>Analysis Notice</h3>
                  <p>{activeStock.error}</p>
                </div>
              ) : modalTab === 'SQ9_MATRIX' ? (
                <GannMasterWheelStudio
                  activeStock={activeStock}
                  selectedMatrixCell={selectedMatrixCell}
                  setSelectedMatrixCell={setSelectedMatrixCell}
                />
              ) : (
                /* Default Chart & Analysis View or Playbook View */
                <>
                  {/* Candlestick & Gann Geometry Chart Card */}
                  {modalTab === 'CHART' && (
                    <div className="chart-container-card">
                    <div className="chart-header-row">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        <span>
                          <strong>W.D. Gann Interactive Dual-Fan, Box, Swings & Confluence Chart</strong>
                        </span>
                        {/* Timeframe selector buttons */}
                        <div className="tf-btn-group">
                          <button 
                            className={`tf-btn ${selectedTf === '90D' ? 'active' : ''}`}
                            onClick={() => setSelectedTf('90D')}
                          >
                            90D (3M)
                          </button>
                          <button 
                            className={`tf-btn ${selectedTf === '180D' ? 'active' : ''}`}
                            onClick={() => setSelectedTf('180D')}
                          >
                            180D (6M)
                          </button>
                          <button 
                            className={`tf-btn ${selectedTf === '1Y' ? 'active' : ''}`}
                            onClick={() => setSelectedTf('1Y')}
                          >
                            1 Year (252D)
                          </button>
                          <button 
                            className={`tf-btn ${selectedTf === 'ALL' ? 'active' : ''}`}
                            onClick={() => setSelectedTf('ALL')}
                          >
                            🎯 Full History
                          </button>
                        </div>
                      </div>

                      {/* Layer Toggles */}
                      <div className="chart-toggles-row">
                        <button 
                          className={`toggle-layer-btn ${showFan ? 'active' : ''}`}
                          onClick={() => setShowFan(!showFan)}
                        >
                          {showFan ? <Eye size={12} /> : <EyeOff size={12} />} Upward Fan
                        </button>
                        <button 
                          className={`toggle-layer-btn ${showDownFan ? 'active' : ''}`}
                          onClick={() => setShowDownFan(!showDownFan)}
                        >
                          {showDownFan ? <Eye size={12} /> : <EyeOff size={12} />} Downward Fan
                        </button>
                        <button 
                          className={`toggle-layer-btn ${showGannBox ? 'active' : ''}`}
                          onClick={() => setShowGannBox(!showGannBox)}
                        >
                          <Box size={12} /> Gann Box
                        </button>
                        <button 
                          className={`toggle-layer-btn ${showSecondSquare ? 'active' : ''}`}
                          onClick={() => setShowSecondSquare(!showSecondSquare)}
                          title="Forward Box Projection (The Second Square)"
                        >
                          <Award size={12} /> 2nd Square
                        </button>
                        <button 
                          className={`toggle-layer-btn ${showGannSwings ? 'active' : ''}`}
                          onClick={() => setShowGannSwings(!showGannSwings)}
                          title="W.D. Gann Mechanical 2-Day Swing Zigzag line"
                        >
                          <Activity size={12} /> Gann Swings
                        </button>
                        <button 
                          className={`toggle-layer-btn ${showSq9 ? 'active' : ''}`}
                          onClick={() => setShowSq9(!showSq9)}
                        >
                          {showSq9 ? <Eye size={12} /> : <EyeOff size={12} />} Square of 9
                        </button>
                        <button 
                          className={`toggle-layer-btn ${showTimeCycles ? 'active' : ''}`}
                          onClick={() => setShowTimeCycles(!showTimeCycles)}
                        >
                          <Calendar size={12} /> Confluence Cycles
                        </button>
                        <button 
                          className={`toggle-layer-btn ${showOctaves ? 'active' : ''}`}
                          onClick={() => setShowOctaves(!showOctaves)}
                        >
                          8ths Octaves
                        </button>
                      </div>
                    </div>

                    {/* High Performance SVG Chart */}
                    <div className="svg-chart-wrapper">
                      <GannSvgChart 
                        chartData={activeStock.chart_data} 
                        timeframe={selectedTf}
                        showFan={showFan}
                        showDownFan={showDownFan}
                        showGannBox={showGannBox}
                        showSecondSquare={showSecondSquare}
                        showGannSwings={showGannSwings}
                        showSq9={showSq9}
                        showTimeCycles={showTimeCycles}
                        showOctaves={showOctaves}
                      />
                    </div>
                  </div>
                )}

                  {/* Institutional Trade Execution & Gann Pyramiding Playbook (Prominent on PLAYBOOK tab) */}
                  {modalTab === 'PLAYBOOK' && activeStock.playbook && (
                    <GannPlaybookCard activeStock={activeStock} />
                  )}

                  {/* 4 Quantitative Gann Pillars Grid */}
                  <div className="four-pillars-grid">
                    {/* Pillar 1: Dual Geometric Gann Angles & Mechanical Swings */}
                    <div className="pillar-card">
                      <div className="pillar-title">
                        <Compass size={16} color="#fbbf24" /> 1. Geometric Angles & Mechanical Swings
                      </div>
                      <div className="pillar-metric-highlight" style={{ color: activeStock.fan_angles?.above_1x1 ? '#10b981' : '#f43f5e' }}>
                        {activeStock.gann_swings?.summary || (activeStock.fan_angles?.above_1x1 ? 'Above 1x1 Master Angle (Markup Trend)' : 'Below 1x1 Master Angle (Defensive)')}
                      </div>
                      <div className="pillar-chips-row">
                        <span className="pillar-chip" style={{ background: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24' }}>
                          Scale S: ${activeStock.anchors?.scale_factor} / bar
                        </span>
                        <span className="pillar-chip" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
                          Gann Box: ${activeStock.gann_box?.low_price} – ${activeStock.gann_box?.high_price}
                        </span>
                        {activeStock.second_square?.is_active && (
                          <span className="pillar-chip" style={{ background: 'rgba(168, 85, 247, 0.2)', color: '#c084fc', fontWeight: 800 }}>
                            Box 2 Target: ${activeStock.second_square?.mid_price}
                          </span>
                        )}
                      </div>
                      <div className="pillar-body-text">
                        {activeStock.fan_angles?.summary} Last confirmed swing pivot: {activeStock.gann_swings?.last_pivot?.type} at ${activeStock.gann_swings?.last_pivot?.price} ({activeStock.gann_swings?.last_pivot?.date}).
                      </div>
                      <div className="angles-mini-table">
                        <div className="angle-mini-row header">
                          <span>Angle</span>
                          <span>Slope (Pts/Bar)</span>
                          <span>Gann Value</span>
                          <span>Diff %</span>
                        </div>
                        {(activeStock.fan_angles?.angles || []).slice(0, 5).map(a => (
                          <div key={a.name} className={`angle-mini-row ${a.name === activeStock.fan_angles?.active_angle ? 'highlight' : ''}`}>
                            <span style={{ color: a.color, fontWeight: 700 }}>{a.name} ({a.degrees}°)</span>
                            <span>${a.slope_daily}</span>
                            <span>${a.price?.toFixed(2)}</span>
                            <span style={{ color: a.dist_pct >= 0 ? '#10b981' : '#f43f5e' }}>
                              {a.dist_pct >= 0 ? `+${a.dist_pct}%` : `${a.dist_pct}%`}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Pillar 2: Square of 9 Numerical Matrix & Aspect Dial */}
                    <div className="pillar-card">
                      <div className="pillar-title" style={{ justifyContent: 'space-between' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Sparkles size={16} color="#38bdf8" /> 2. Square of 9 (Wheel of 24)
                        </span>
                        <button 
                          className="view-matrix-btn"
                          onClick={() => setModalTab('SQ9_MATRIX')}
                        >
                          <Grid size={13} /> View 81-Cell Matrix
                        </button>
                      </div>
                      <div className="pillar-metric-highlight" style={{ color: '#38bdf8' }}>
                        {activeStock.square_of_9?.aspect_label} ({activeStock.square_of_9?.current_degree}°)
                      </div>
                      <div className="pillar-chips-row">
                        <span className="pillar-chip" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
                          Rotated: {activeStock.square_of_9?.degrees_traveled}°
                        </span>
                        <span className="pillar-chip" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc' }}>
                          Spiral Ring: N = {activeStock.square_of_9?.ring_level}
                        </span>
                        <span className="pillar-chip" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>
                          Next: ${activeStock.square_of_9?.next_target_price?.toFixed(2)} (+{activeStock.square_of_9?.next_target_gain}%)
                        </span>
                      </div>

                      {/* Circular Aspect Visualizer */}
                      <div className="sq9-circular-dial-wrapper">
                        <SquareOf9WheelWidget 
                          degree={activeStock.square_of_9?.current_degree || 0} 
                          ring={activeStock.square_of_9?.ring_level || 1}
                          sq9={activeStock.square_of_9}
                          currentPrice={activeStock.current_price}
                          elapsedDays={activeStock.time_cycles?.elapsed_days || 0}
                          onOpenWheel={() => setModalTab('SQ9_MATRIX')}
                        />
                      </div>

                      <div className="sq9-targets-list">
                        <div className="sq9-section-label">Upside Harmonics (Pyramiding Targets)</div>
                        {(activeStock.square_of_9?.upside_targets || []).slice(0, 3).map(t => (
                          <div key={t.deg} className="sq9-level-item">
                            <span className="sq9-level-name">
                              {t.name} ({t.deg}°):
                              {t.has_confluence && <span className="confluence-chip">★ CONFLUENCE</span>}
                            </span>
                            <span className="sq9-level-val">${t.price.toFixed(2)}</span>
                            <span className="sq9-level-gain">+{t.gain_pct}%</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Pillar 3: Master Time Cycle Confluence Clusters */}
                    <div className="pillar-card">
                      <div className="pillar-title">
                        <Calendar size={16} color="#ec4899" /> 3. Master Time Cycle Confluence
                      </div>
                      <div className="pillar-metric-highlight" style={{ color: '#ec4899' }}>
                        {activeStock.time_cycles?.next_cluster ? (
                          `Top Window: ${activeStock.time_cycles.next_cluster.target_date} (${activeStock.time_cycles.next_cluster.target_day})`
                        ) : (
                          `Next Pivot: ${activeStock.time_cycles?.next_turn?.target_date}`
                        )}
                      </div>
                      <div className="pillar-chips-row">
                        {activeStock.time_cycles?.next_cluster && (
                          <span className="pillar-chip" style={{ background: 'rgba(236, 72, 153, 0.2)', color: '#f472b6', fontWeight: 800 }}>
                            ⚡ Score: {activeStock.time_cycles.next_cluster.confluence_score}%
                          </span>
                        )}
                        <span className="pillar-chip" style={{ background: 'rgba(148, 163, 184, 0.15)', color: '#cbd5e1' }}>
                          Anchor: {activeStock.time_cycles?.anchor_date} ({activeStock.time_cycles?.elapsed_days}d ago)
                        </span>
                      </div>
                      <div className="pillar-body-text">
                        Confluence clusters group both Trading Bar counts and Solar Calendar cycles converging within ±3 days.
                      </div>
                      
                      {/* Confluence Clusters List */}
                      <div className="confluence-clusters-box">
                        {(activeStock.time_cycles?.confluence_clusters || []).slice(0, 3).map((cl, idx) => (
                          <div key={idx} className="cluster-row">
                            <div className="cluster-header">
                              <span className="cluster-date">📅 {cl.target_date} ({cl.target_day})</span>
                              <span className="cluster-score-pill">
                                {cl.confluence_score}% Confluence ({cl.cycle_count} Cycles)
                              </span>
                            </div>
                            <div className="cluster-cycles-sub">
                              {cl.converging_cycles.slice(0, 2).join(' • ')}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Pillar 4: Three Squaring Methods & 8ths Grid */}
                    <div className="pillar-card">
                      <div className="pillar-title">
                        <Target size={16} color="#10b981" /> 4. Three Squaring Methods & 8ths
                      </div>
                      <div className="pillar-metric-highlight" style={{ color: activeStock.octaves_and_squaring?.is_squared ? '#10b981' : '#fbbf24' }}>
                        {activeStock.octaves_and_squaring?.squaring_status}
                      </div>
                      <div className="pillar-chips-row">
                        <span className="pillar-chip" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>
                          Range Squaring: {activeStock.octaves_and_squaring?.squaring_range?.ratio}x
                        </span>
                        <span className="pillar-chip" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
                          50% Mid (4/8): ${activeStock.octaves_and_squaring?.fifty_pct_price}
                        </span>
                      </div>
                      <div className="pillar-body-text">
                        Gann 8ths divide the master swing range into octaves. The 4/8th level acts as the master balance of supply and demand.
                      </div>
                      <div className="octaves-horizontal-bar">
                        {(activeStock.octaves_and_squaring?.eighths || []).map(e => (
                          <div 
                            key={e.label} 
                            className={`octave-step ${e.is_active ? 'active-step' : ''}`}
                            title={`${e.label}: $${e.price?.toFixed(2)} (${e.role})`}
                          >
                            <span className="octave-label">{e.label}</span>
                            <span className="octave-price">${e.price?.toFixed(0)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Institutional Trade Execution & Gann Pyramiding Playbook */}
                  {modalTab === 'CHART' && activeStock.playbook && (
                    <GannPlaybookCard activeStock={activeStock} />
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
// W.D. Gann Quantitative Trade Execution & Pyramiding Playbook Component
// ---------------------------------------------------------------------------------
function GannPlaybookCard({ activeStock }) {
  if (!activeStock || !activeStock.playbook) return null;
  const pb = activeStock.playbook;

  return (
    <div className="gann-playbook-card">
      <div className="gann-playbook-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldCheck size={20} color="#fbbf24" />
          <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#f8fafc' }}>
            W.D. Gann Quantitative Trade Execution & Pyramiding Playbook
          </h3>
        </div>
        <span className="playbook-setup-badge">
          Setup: {pb.setup_name}
        </span>
      </div>

      <div className="gann-playbook-grid">
        <div className="playbook-cell">
          <span className="cell-label">Ideal Entry Pivot</span>
          <span className="cell-value" style={{ color: '#38bdf8' }}>
            ${pb.entry?.toFixed(2)}
          </span>
        </div>
        <div className="playbook-cell">
          <span className="cell-label">Gann Stop Loss</span>
          <span className="cell-value" style={{ color: '#f43f5e' }}>
            ${pb.stop_loss?.toFixed(2)}
          </span>
        </div>
        <div className="playbook-cell target-with-time">
          <span className="cell-label">{pb.target_1_label || 'Target 1 (Sq9)'}</span>
          <span className="cell-value" style={{ color: '#10b981' }}>
            ${pb.target_1?.toFixed(2)}
          </span>
          {pb.target_1_time && (
            <div className="playbook-time-sub">
              <span className="pb-time-date">
                <Calendar size={11} /> {pb.target_1_time.target_date} ({pb.target_1_time.target_day.slice(0, 3)})
              </span>
              <span className="pb-time-window">
                {pb.target_1_time.window} (~{pb.target_1_time.trading_bars} bars)
              </span>
            </div>
          )}
        </div>
        <div className="playbook-cell target-with-time">
          <span className="cell-label">{pb.target_2_label || 'Target 2 (90° Square)'}</span>
          <span className="cell-value" style={{ color: '#10b981' }}>
            ${pb.target_2?.toFixed(2)}
          </span>
          {pb.target_2_time && (
            <div className="playbook-time-sub">
              <span className="pb-time-date">
                <Calendar size={11} /> {pb.target_2_time.target_date} ({pb.target_2_time.target_day.slice(0, 3)})
              </span>
              <span className="pb-time-window">
                {pb.target_2_time.window} (~{pb.target_2_time.trading_bars} bars)
              </span>
            </div>
          )}
        </div>
        <div className="playbook-cell target-with-time">
          <span className="cell-label">{pb.macro_target_label || 'Macro Target (360°)'}</span>
          <span className="cell-value" style={{ color: '#fbbf24' }}>
            ${pb.macro_target?.toFixed(2)}
          </span>
          {pb.macro_target_time && (
            <div className="playbook-time-sub">
              <span className="pb-time-date">
                <Calendar size={11} /> {pb.macro_target_time.target_date} ({pb.macro_target_time.target_day.slice(0, 3)})
              </span>
              <span className="pb-time-window">
                {pb.macro_target_time.window} (~{pb.macro_target_time.trading_bars} bars)
              </span>
            </div>
          )}
        </div>
        <div className="playbook-cell">
          <span className="cell-label">Risk / Reward (R/R)</span>
          <span className="cell-value" style={{ color: '#fbbf24' }}>
            {pb.risk_reward} : 1
          </span>
        </div>
      </div>

      {/* W.D. Gann Price-Time Harmonics & Milestone Projection Roadmap */}
      {pb.milestone_roadmap && (
        <div className="gann-roadmap-box">
          <div className="roadmap-title">
            <Clock size={16} color="#fbbf24" />
            <span>W.D. Gann Price-Time Milestone Projection Roadmap ⏳</span>
          </div>
          <div className="roadmap-grid">
            {pb.milestone_roadmap.map((m, mIdx) => (
              <div key={mIdx} className="roadmap-card">
                <div className="roadmap-card-top">
                  <span className="roadmap-badge">{m.milestone}</span>
                  <span className="roadmap-gain" style={{ color: m.gain_pct >= 0 ? '#10b981' : '#f43f5e' }}>
                    {m.gain_pct >= 0 ? `+${m.gain_pct}%` : `${m.gain_pct}%`}
                  </span>
                </div>
                <div className="roadmap-price">${m.price?.toFixed(2)}</div>
                
                <div className="roadmap-timing-pill">
                  <Calendar size={13} color="#ec4899" />
                  <strong>{m.target_date} ({m.target_day})</strong>
                </div>
                
                <div className="roadmap-meta-row">
                  <span className="window-text">📅 Window: {m.window}</span>
                  <span className="bars-badge">⏳ ~{m.bars} bars</span>
                </div>
                
                {m.confluence_cycle && (
                  <div className="roadmap-cycle-tag">
                    <span>⚡ {m.confluence_cycle}</span>
                  </div>
                )}
                
                <div className="roadmap-rule-tag">
                  <span>📐 {m.gann_rule}</span>
                </div>
              </div>
            ))}
          </div>
          
          <div className="gann-law-callout">
            <Compass size={15} color="#38bdf8" />
            <span>
              <strong>W.D. Gann's Law of Vibration & Price-Time Harmony:</strong> "When time cycles converge and the number of trading days equals price movement divided by the Master scale factor (T = P / S), resistance dissolves and high-velocity acceleration occurs."
            </span>
          </div>
        </div>
      )}

      {/* Gann Pyramiding Execution Table */}
      {pb.pyramiding_plan && (
        <div className="pyramiding-table-box">
          <div className="pyramiding-title">
            <Layers size={14} color="#fbbf24" /> Gann Pyramiding & Capital Allocation Strategy
          </div>
          <div className="pyramiding-grid">
            {pb.pyramiding_plan.map((tier, tIdx) => (
              <div key={tIdx} className="pyramid-tier-card">
                <div className="tier-header">
                  <span className="tier-name">{tier.tier}</span>
                  <span className="tier-alloc">{tier.capital_alloc}</span>
                </div>
                <div className="tier-row">
                  <span className="tier-label">Trigger:</span>
                  <span className="tier-val">{tier.entry_trigger}</span>
                </div>
                {tier.timing && (
                  <div className="tier-row">
                    <span className="tier-label">Target Timing:</span>
                    <span className="tier-val timing-val">
                      <Clock size={11} /> {tier.timing}
                    </span>
                  </div>
                )}
                <div className="tier-row">
                  <span className="tier-label">Stop Rule:</span>
                  <span className="tier-val stop">{tier.stop_loss}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="playbook-notes">
        <strong>Strategy Execution Rationale:</strong> {pb.description}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------
// Redesigned Pillar 2: Multi-Ring Celestial Gann Wheel (Wheel of 24 + Sq9 Harmonics)
// ---------------------------------------------------------------------------------
function SquareOf9WheelWidget({ degree = 0, ring = 1, sq9 = {}, currentPrice = 0, elapsedDays = 0, onOpenWheel }) {
  const size = 256;
  const center = size / 2;
  const outerR = center - 16;
  const ringR1 = outerR * 0.78;
  const ringR2 = outerR * 0.54;
  const ringR3 = outerR * 0.30;

  const degToXY = (degVal, rVal) => {
    const rad = ((degVal - 90) * Math.PI) / 180.0;
    return {
      x: center + rVal * Math.cos(rad),
      y: center + rVal * Math.sin(rad),
    };
  };

  // Build swept arc path from 0° to degree
  const buildArcPath = (endDeg, rVal) => {
    const clamped = Math.max(1, Math.min(359.5, endDeg || 1));
    const start = degToXY(0, rVal);
    const end = degToXY(clamped, rVal);
    const largeArc = clamped > 180 ? 1 : 0;
    return `M ${center} ${center} L ${start.x.toFixed(1)} ${start.y.toFixed(1)} A ${rVal} ${rVal} 0 ${largeArc} 1 ${end.x.toFixed(1)} ${end.y.toFixed(1)} Z`;
  };

  // Inscribed Square (0° - 90° - 180° - 270°) & Grand Trine (0° - 120° - 240°)
  const sqPts = [0, 90, 180, 270].map((d) => {
    const p = degToXY(d, ringR1);
    return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
  }).join(' ');

  const trine1Pts = [0, 120, 240].map((d) => {
    const p = degToXY(d, ringR1);
    return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
  }).join(' ');

  const trine2Pts = [60, 180, 300].map((d) => {
    const p = degToXY(d, ringR1);
    return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
  }).join(' ');

  const spotPos = degToXY(degree, ringR1);
  const timeDeg = ((elapsedDays || 0) % 360 + 360) % 360;
  const timePos = degToXY(timeDeg, outerR);

  // Extract key harmonic prices for display around the mini wheel
  const upTargets = sq9?.upside_targets || [];
  const p45 = upTargets.find((t) => t.deg === 45)?.price;
  const p90 = upTargets.find((t) => t.deg === 90)?.price;
  const p180 = upTargets.find((t) => t.deg === 180)?.price;
  const p270 = upTargets.find((t) => t.deg === 270)?.price;

  const compassLabels = [
    { deg: 0, label: '0° N', sub: sq9?.anchor_price ? `$${Number(sq9.anchor_price).toFixed(0)}` : '', color: '#fbbf24' },
    { deg: 45, label: '45°', sub: p45 ? `$${Number(p45).toFixed(0)}` : '', color: '#38bdf8' },
    { deg: 90, label: '90° E', sub: p90 ? `$${Number(p90).toFixed(0)}` : '', color: '#10b981' },
    { deg: 135, label: '135°', sub: '', color: '#38bdf8' },
    { deg: 180, label: '180° S', sub: p180 ? `$${Number(p180).toFixed(0)}` : '', color: '#f43f5e' },
    { deg: 225, label: '225°', sub: '', color: '#38bdf8' },
    { deg: 270, label: '270° W', sub: p270 ? `$${Number(p270).toFixed(0)}` : '', color: '#10b981' },
    { deg: 315, label: '315°', sub: '', color: '#38bdf8' },
  ];

  return (
    <div
      className="sq9-wheel-container"
      onClick={onOpenWheel}
      style={{ cursor: onOpenWheel ? 'pointer' : 'default', width: '100%' }}
      title="Click to open Full Interactive W.D. Gann Master Wheel & Square of 9 Studio"
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="sq9-wheel-svg">
        <defs>
          <radialGradient id="gannMiniWheelBg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(56, 189, 248, 0.14)" />
            <stop offset="65%" stopColor="rgba(15, 23, 42, 0.92)" />
            <stop offset="100%" stopColor="rgba(9, 14, 28, 0.98)" />
          </radialGradient>
        </defs>

        {/* Outer Bezel & Concentric Harmonic Rings */}
        <circle cx={center} cy={center} r={outerR} fill="url(#gannMiniWheelBg)" stroke="rgba(251, 191, 36, 0.45)" strokeWidth="1.6" />
        <circle cx={center} cy={center} r={ringR1} fill="none" stroke="rgba(56, 189, 248, 0.35)" strokeWidth="1.1" />
        <circle cx={center} cy={center} r={ringR2} fill="none" stroke="rgba(148, 163, 184, 0.2)" strokeDasharray="3,3" />
        <circle cx={center} cy={center} r={ringR3} fill="none" stroke="rgba(251, 191, 36, 0.22)" />

        {/* 24-Division (15°) Protractor Bezel Ticks */}
        {Array.from({ length: 24 }, (_, idx) => idx * 15).map((degVal) => {
          const isCard = degVal % 90 === 0;
          const isFix = degVal % 45 === 0 && !isCard;
          const p1 = degToXY(degVal, outerR);
          const p2 = degToXY(degVal, outerR - (isCard ? 8 : isFix ? 6 : 4));
          return (
            <line
              key={`tick-${degVal}`}
              x1={p1.x}
              y1={p1.y}
              x2={p2.x}
              y2={p2.y}
              stroke={isCard ? '#fbbf24' : isFix ? '#38bdf8' : 'rgba(148, 163, 184, 0.35)'}
              strokeWidth={isCard ? 1.8 : 1}
            />
          );
        })}

        {/* Sacred Geometry: Grand Trine Hexagram (120° Triangles) */}
        <polygon points={trine1Pts} fill="rgba(168, 85, 247, 0.04)" stroke="rgba(168, 85, 247, 0.28)" strokeWidth="1" strokeDasharray="2,2" />
        <polygon points={trine2Pts} fill="none" stroke="rgba(236, 72, 153, 0.22)" strokeWidth="0.9" strokeDasharray="2,2" />

        {/* Sacred Geometry: Inscribed Gann Square (0°-90°-180°-270°) */}
        <polygon points={sqPts} fill="rgba(251, 191, 36, 0.03)" stroke="rgba(251, 191, 36, 0.35)" strokeWidth="1.1" />

        {/* Fixed Cross (45°, 135°, 225°, 315°) */}
        {[45, 135, 225, 315].map((a) => {
          const p = degToXY(a, outerR);
          return <line key={`fix-${a}`} x1={center} y1={center} x2={p.x} y2={p.y} stroke="rgba(56, 189, 248, 0.28)" strokeWidth="1" strokeDasharray="3,3" />;
        })}

        {/* Cardinal Cross (0°, 90°, 180°, 270°) */}
        {[0, 90, 180, 270].map((a) => {
          const p = degToXY(a, outerR);
          return <line key={`card-${a}`} x1={center} y1={center} x2={p.x} y2={p.y} stroke="rgba(251, 191, 36, 0.55)" strokeWidth="1.4" />;
        })}

        {/* Swept Orbital Progress Wedge */}
        <path d={buildArcPath(degree, ringR1)} fill="rgba(56, 189, 248, 0.13)" stroke="none" />

        {/* Compass Labels + Live Harmonic Target Prices */}
        {compassLabels.map((item) => {
          const pos = degToXY(item.deg, outerR - 14);
          return (
            <g key={`lbl-${item.deg}`}>
              <text x={pos.x} y={pos.y} fill={item.color} fontSize="8.5" fontWeight="800" textAnchor="middle" dominantBaseline="middle">
                {item.label}
              </text>
              {item.sub && (
                <text x={pos.x} y={pos.y + 9} fill="#e2e8f0" fontSize="7.5" fontFamily="monospace" fontWeight="700" textAnchor="middle">
                  {item.sub}
                </text>
              )}
            </g>
          );
        })}

        {/* Time Cycle Degree Marker on Outer Bezel */}
        <circle cx={timePos.x} cy={timePos.y} r={4} fill="#ec4899" stroke="#0f172a" strokeWidth="1.2" />

        {/* Live Price Vector Needle & Beacon */}
        <line x1={center} y1={center} x2={spotPos.x} y2={spotPos.y} stroke="#38bdf8" strokeWidth="2.5" />
        <circle cx={spotPos.x} cy={spotPos.y} r={8} fill="rgba(56, 189, 248, 0.25)" />
        <circle cx={spotPos.x} cy={spotPos.y} r={4.5} fill="#38bdf8" stroke="#f8fafc" strokeWidth="1.5" />

        {/* Center Hub */}
        <circle cx={center} cy={center} r={22} fill="rgba(15, 23, 42, 0.95)" stroke="#fbbf24" strokeWidth="1.5" />
        <text x={center} y={center - 3} fill="#f8fafc" fontSize="9.5" fontWeight="900" fontFamily="monospace" textAnchor="middle">
          {degree.toFixed(0)}°
        </text>
        <text x={center} y={center + 8} fill="#fbbf24" fontSize="7.5" fontWeight="700" textAnchor="middle">
          Ring #{ring}
        </text>
      </svg>

      <div className="sq9-wheel-legend" style={{ justifyContent: 'space-between', width: '100%', padding: '0 6px', fontSize: '0.74rem' }}>
        <span style={{ color: '#38bdf8', fontWeight: 800 }}>● Price Orbit: {degree.toFixed(1)}°</span>
        <span style={{ color: '#ec4899', fontWeight: 700 }}>● Time Orbit: {timeDeg.toFixed(0)}° ({elapsedDays}d)</span>
        <span style={{ color: '#fbbf24', fontWeight: 700, textDecoration: 'underline' }}>Expand Studio ↗</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------
// Full Interactive W.D. Gann Master Emblem Wheel & Square of 9 Studio
// ---------------------------------------------------------------------------------
function GannMasterWheelStudio({ activeStock, selectedMatrixCell, setSelectedMatrixCell }) {
  const sq9 = activeStock?.square_of_9 || {};
  const spotPrice = Number(activeStock?.current_price || sq9?.sr_ladder?.current_price || 100);
  const anchorPrice = Number(sq9?.anchor_price || activeStock?.anchors?.primary_anchor?.anchor_price || spotPrice);
  const anchorDate = activeStock?.anchors?.primary_anchor?.anchor_date || '';
  const elapsedDays = Number(activeStock?.time_cycles?.elapsed_days || 0);
  const currentDeg = Number(sq9?.current_degree || 0);
  const ringLevel = Number(sq9?.ring_level || 1);

  const [studioView, setStudioView] = useState('SPLIT'); // 'SPLIT' | 'WHEEL' | 'MATRIX'
  const [showCardinal, setShowCardinal] = useState(true);
  const [showFixed, setShowFixed] = useState(true);
  const [showTrine, setShowTrine] = useState(true);
  const [showSquareBox, setShowSquareBox] = useState(true);
  const [showSolarRing, setShowSolarRing] = useState(true);
  const [protractorDeg, setProtractorDeg] = useState(90);
  const [selectedWheelNode, setSelectedWheelNode] = useState(null);

  // Solar Calendar seasonal markers around 360°
  const solarMarkers = [
    { deg: 0, label: '0° Vernal Eq (Mar 21)', short: 'Mar 21 (0°)' },
    { deg: 45, label: '45° Cross-Quarter (May 5)', short: 'May 5 (45°)' },
    { deg: 90, label: '90° Summer Sol (Jun 21)', short: 'Jun 21 (90°)' },
    { deg: 135, label: '135° Cross-Quarter (Aug 7)', short: 'Aug 7 (135°)' },
    { deg: 180, label: '180° Autumn Eq (Sep 23)', short: 'Sep 23 (180°)' },
    { deg: 225, label: '225° Cross-Quarter (Nov 7)', short: 'Nov 7 (225°)' },
    { deg: 270, label: '270° Winter Sol (Dec 21)', short: 'Dec 21 (270°)' },
    { deg: 315, label: '315° Cross-Quarter (Feb 4)', short: 'Feb 4 (315°)' },
  ];

  // Dynamic Protractor Calculator math: P(theta) = (sqrt(P) +/- theta/180)^2
  const rootSpot = Math.sqrt(Math.max(0.1, spotPrice));
  const rootAnchor = Math.sqrt(Math.max(0.1, anchorPrice));
  const shift = protractorDeg / 180.0;
  const calcUpsidePrice = Math.pow(rootSpot + shift, 2);
  const calcDownsidePrice = Math.pow(Math.max(0.1, rootSpot - shift), 2);
  const calcAnchorHarmonic = Math.pow(rootAnchor + shift, 2);
  const calcGainPct = ((calcUpsidePrice - spotPrice) / spotPrice) * 100.0;
  const calcDropPct = ((spotPrice - calcDownsidePrice) / spotPrice) * 100.0;

  // Build harmonic nodes for Outer Ring (Upside Resistance) and Inner Ring (Downside Support)
  const upsideNodes = (sq9.upside_targets || []).map((t) => ({
    ...t,
    orbit: 'UPSIDE_RESISTANCE',
  }));
  const downsideNodes = (sq9.downside_supports || []).map((t) => ({
    ...t,
    orbit: 'DOWNSIDE_SUPPORT',
  }));

  // SVG Master Wheel Dimensions
  const W = 500;
  const C = W / 2;
  const R_SOLAR = 228;
  const R_BEZEL = 198;
  const R_RES_ORBIT = 162;
  const R_SPOT_ORBIT = 122;
  const R_SUP_ORBIT = 84;
  const R_CORE = 38;

  const degToPt = (degVal, rVal) => {
    const rad = ((degVal - 90) * Math.PI) / 180.0;
    return {
      x: C + rVal * Math.cos(rad),
      y: C + rVal * Math.sin(rad),
    };
  };

  const buildSweep = (endDeg, rVal) => {
    const clamped = Math.max(1, Math.min(359.5, endDeg || 1));
    const s = degToPt(0, rVal);
    const e = degToPt(clamped, rVal);
    const lg = clamped > 180 ? 1 : 0;
    return `M ${C} ${C} L ${s.x.toFixed(1)} ${s.y.toFixed(1)} A ${rVal} ${rVal} 0 ${lg} 1 ${e.x.toFixed(1)} ${e.y.toFixed(1)} Z`;
  };

  const timeDeg = ((elapsedDays % 360) + 360) % 360;
  const phaseDiff = Math.abs(currentDeg - timeDeg);
  const normPhaseDiff = phaseDiff > 180 ? 360 - phaseDiff : phaseDiff;
  const isPriceTimeAligned = normPhaseDiff <= 15 || Math.abs(normPhaseDiff - 90) <= 10 || Math.abs(normPhaseDiff - 180) <= 10;

  const spotPt = degToPt(currentDeg, R_SPOT_ORBIT);
  const timePt = degToPt(timeDeg, R_SOLAR);
  const protractorPt = degToPt(protractorDeg % 360, R_RES_ORBIT);

  const sr = sq9.sr_ladder || {};

  return (
    <div className="sq9-matrix-full-view" style={{ gap: '16px' }}>
      {/* Top Studio Control Header */}
      <div className="sq9-matrix-header-card" style={{ padding: '14px 18px', background: 'linear-gradient(145deg, rgba(15, 23, 42, 0.92), rgba(9, 14, 28, 0.96))' }}>
        <div className="matrix-card-left">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#f8fafc' }}>
              🌀 W.D. Gann Master Emblem Wheel & Square of 9 Harmonic Studio
            </h3>
            <span style={{
              background: isPriceTimeAligned ? 'rgba(16, 185, 129, 0.18)' : 'rgba(56, 189, 248, 0.15)',
              border: `1px solid ${isPriceTimeAligned ? '#10b981' : '#38bdf8'}`,
              color: isPriceTimeAligned ? '#34d399' : '#38bdf8',
              padding: '2px 10px',
              borderRadius: '999px',
              fontSize: '0.72rem',
              fontWeight: 800
            }}>
              {isPriceTimeAligned ? '⚡ PRICE-TIME HARMONIC LOCK' : `${sq9.aspect_label || 'Orbital Spiral'} (${currentDeg.toFixed(1)}°)`}
            </span>
          </div>
          <p style={{ marginTop: '4px', fontSize: '0.8rem', color: '#94a3b8' }}>
            Anchor Pivot: <strong style={{ color: '#fbbf24' }}>${anchorPrice.toFixed(2)}</strong> ({anchorDate || 'Cycle Origin'}) • Spot: <strong style={{ color: '#38bdf8' }}>${spotPrice.toFixed(2)}</strong> • Total Rotation: <strong style={{ color: '#e2e8f0' }}>{sq9.degrees_traveled || 0}°</strong> (Spiral Ring #{ringLevel}) • Time Elapsed: <strong style={{ color: '#f472b6' }}>{elapsedDays}d ({timeDeg.toFixed(0)}° Solar Orbit)</strong>
          </p>
        </div>

        {/* View Mode Switcher */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {[
            { id: 'SPLIT', label: '⚡ Split Studio (Wheel + Matrix)' },
            { id: 'WHEEL', label: '🌀 Full Gann Wheel' },
            { id: 'MATRIX', label: '🔢 81-Cell Spiral Grid' },
          ].map((m) => (
            <button
              key={m.id}
              onClick={() => setStudioView(m.id)}
              style={{
                background: studioView === m.id ? 'rgba(251, 191, 36, 0.2)' : 'rgba(30, 41, 59, 0.7)',
                border: studioView === m.id ? '1px solid #fbbf24' : '1px solid rgba(148, 163, 184, 0.25)',
                color: studioView === m.id ? '#fbbf24' : '#cbd5e1',
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '0.76rem',
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Geometry Layer Toggles + Interactive Protractor Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px',
        background: 'rgba(15, 23, 42, 0.75)',
        border: '1px solid rgba(148, 163, 184, 0.16)',
        borderRadius: '10px',
        padding: '10px 14px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.74rem', color: '#94a3b8', fontWeight: 700 }}>SACRED GEOMETRY OVERLAYS:</span>
          {[
            { label: '➕ Cardinal Cross (0°/90°/180°/270°)', active: showCardinal, toggle: () => setShowCardinal(!showCardinal), color: '#fbbf24' },
            { label: '✖ Fixed Cross (45°/135°/225°/315°)', active: showFixed, toggle: () => setShowFixed(!showFixed), color: '#38bdf8' },
            { label: '✡ Grand Trine (60°/120°/240°)', active: showTrine, toggle: () => setShowTrine(!showTrine), color: '#a855f7' },
            { label: '◇ Inscribed Square', active: showSquareBox, toggle: () => setShowSquareBox(!showSquareBox), color: '#10b981' },
            { label: '☀️ Solar Calendar Ring', active: showSolarRing, toggle: () => setShowSolarRing(!showSolarRing), color: '#f472b6' },
          ].map((btn, idx) => (
            <button
              key={idx}
              onClick={btn.toggle}
              style={{
                background: btn.active ? `${btn.color}22` : 'rgba(30, 41, 59, 0.5)',
                border: `1px solid ${btn.active ? btn.color : 'rgba(148, 163, 184, 0.2)'}`,
                color: btn.active ? btn.color : '#64748b',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '0.72rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              {btn.label}
            </button>
          ))}
        </div>

        {/* Quick Preset Harmonic Degree Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.73rem', color: '#cbd5e1', fontWeight: 700 }}>Protractor:</span>
          {[45, 60, 90, 120, 135, 180, 240, 270, 360, 540, 720].map((d) => (
            <button
              key={d}
              onClick={() => setProtractorDeg(d)}
              style={{
                background: protractorDeg === d ? 'rgba(56, 189, 248, 0.25)' : 'rgba(30, 41, 59, 0.65)',
                border: protractorDeg === d ? '1px solid #38bdf8' : '1px solid rgba(148, 163, 184, 0.2)',
                color: protractorDeg === d ? '#38bdf8' : '#94a3b8',
                padding: '3px 7px',
                borderRadius: '5px',
                fontSize: '0.7rem',
                fontFamily: 'monospace',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              {d}°
            </button>
          ))}
        </div>
      </div>

      {/* Main Studio Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: studioView === 'SPLIT' ? 'repeat(auto-fit, minmax(460px, 1fr))' : '1fr',
        gap: '16px',
        alignItems: 'start'
      }}>
        {/* LEFT / MAIN PANEL: INTERACTIVE 500x500 W.D. GANN MASTER EMBLEM WHEEL */}
        {(studioView === 'SPLIT' || studioView === 'WHEEL') && (
          <div style={{
            background: 'linear-gradient(160deg, rgba(11, 17, 32, 0.96), rgba(7, 11, 22, 0.99))',
            border: '1px solid rgba(251, 191, 36, 0.28)',
            borderRadius: '14px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center'
          }}>
            <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', fontSize: '0.76rem' }}>
              <span style={{ color: '#fbbf24', fontWeight: 800 }}>
                📐 CONCENTRIC HARMONIC RINGS: Outer = Resistance (+Δ°) • Mid = Spot Orbit • Inner = Support (−Δ°)
              </span>
              <span style={{ color: '#94a3b8', fontSize: '0.72rem' }}>Click any node on wheel to inspect</span>
            </div>

            <svg
              viewBox={`0 0 ${W} ${W}`}
              style={{
                width: '100%',
                maxWidth: studioView === 'WHEEL' ? '640px' : '500px',
                height: 'auto',
                overflow: 'visible'
              }}
            >
              <defs>
                <radialGradient id="gannMasterCoreGrad" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="rgba(56, 189, 248, 0.16)" />
                  <stop offset="55%" stopColor="rgba(15, 23, 42, 0.94)" />
                  <stop offset="100%" stopColor="rgba(6, 10, 21, 0.99)" />
                </radialGradient>
              </defs>

              {/* Outer Solar Calendar Ring */}
              {showSolarRing && (
                <g>
                  <circle cx={C} cy={C} r={R_SOLAR} fill="rgba(15, 23, 42, 0.5)" stroke="rgba(244, 114, 182, 0.35)" strokeWidth="1.2" strokeDasharray="4,3" />
                  {solarMarkers.map((sm) => {
                    const pt = degToPt(sm.deg, R_SOLAR + 13);
                    const tick1 = degToPt(sm.deg, R_SOLAR - 4);
                    const tick2 = degToPt(sm.deg, R_SOLAR + 4);
                    return (
                      <g key={`solar-${sm.deg}`}>
                        <line x1={tick1.x} y1={tick1.y} x2={tick2.x} y2={tick2.y} stroke="#f472b6" strokeWidth="1.5" />
                        <text x={pt.x} y={pt.y} fill="#f472b6" fontSize="8.5" fontWeight="700" textAnchor="middle" dominantBaseline="middle">
                          {sm.short}
                        </text>
                      </g>
                    );
                  })}
                </g>
              )}

              {/* Primary Wheel Bezel & Concentric Orbit Circles */}
              <circle cx={C} cy={C} r={R_BEZEL} fill="url(#gannMasterCoreGrad)" stroke="rgba(251, 191, 36, 0.55)" strokeWidth="2" />
              <circle cx={C} cy={C} r={R_RES_ORBIT} fill="none" stroke="rgba(16, 185, 129, 0.35)" strokeWidth="1.2" strokeDasharray="3,3" />
              <circle cx={C} cy={C} r={R_SPOT_ORBIT} fill="none" stroke="rgba(56, 189, 248, 0.45)" strokeWidth="1.5" />
              <circle cx={C} cy={C} r={R_SUP_ORBIT} fill="none" stroke="rgba(244, 63, 94, 0.35)" strokeWidth="1.2" strokeDasharray="3,3" />

              {/* 72 Degree Ticks (every 5°) + 24 Major Ticks (every 15°) */}
              {Array.from({ length: 72 }, (_, idx) => idx * 5).map((degVal) => {
                const isCard = degVal % 90 === 0;
                const isFix = degVal % 45 === 0 && !isCard;
                const is15 = degVal % 15 === 0;
                const p1 = degToPt(degVal, R_BEZEL);
                const p2 = degToPt(degVal, R_BEZEL - (isCard ? 12 : isFix ? 9 : is15 ? 6 : 3));
                return (
                  <g key={`deg5-${degVal}`}>
                    <line
                      x1={p1.x}
                      y1={p1.y}
                      x2={p2.x}
                      y2={p2.y}
                      stroke={isCard ? '#fbbf24' : isFix ? '#38bdf8' : is15 ? 'rgba(203, 213, 225, 0.55)' : 'rgba(148, 163, 184, 0.22)'}
                      strokeWidth={isCard ? 2 : isFix ? 1.5 : 0.9}
                    />
                    {is15 && (
                      <text
                        x={degToPt(degVal, R_BEZEL - 18).x}
                        y={degToPt(degVal, R_BEZEL - 18).y}
                        fill={isCard ? '#fbbf24' : isFix ? '#38bdf8' : '#64748b'}
                        fontSize={isCard ? '9.5' : '8'}
                        fontWeight={isCard || isFix ? '800' : '600'}
                        fontFamily="monospace"
                        textAnchor="middle"
                        dominantBaseline="middle"
                      >
                        {degVal}°
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Sacred Geometry 1: Grand Trine Hexagram (0°-120°-240° and 60°-180°-300°) */}
              {showTrine && (
                <g>
                  <polygon
                    points={[0, 120, 240].map((d) => `${degToPt(d, R_RES_ORBIT).x.toFixed(1)},${degToPt(d, R_RES_ORBIT).y.toFixed(1)}`).join(' ')}
                    fill="rgba(168, 85, 247, 0.04)"
                    stroke="rgba(168, 85, 247, 0.45)"
                    strokeWidth="1.3"
                    strokeDasharray="4,3"
                  />
                  <polygon
                    points={[60, 180, 300].map((d) => `${degToPt(d, R_RES_ORBIT).x.toFixed(1)},${degToPt(d, R_RES_ORBIT).y.toFixed(1)}`).join(' ')}
                    fill="rgba(236, 72, 153, 0.03)"
                    stroke="rgba(236, 72, 153, 0.35)"
                    strokeWidth="1.2"
                    strokeDasharray="4,3"
                  />
                </g>
              )}

              {/* Sacred Geometry 2: Inscribed Gann Squares (Cardinal & Fixed 45° Rotated Square) */}
              {showSquareBox && (
                <g>
                  <polygon
                    points={[0, 90, 180, 270].map((d) => `${degToPt(d, R_RES_ORBIT).x.toFixed(1)},${degToPt(d, R_RES_ORBIT).y.toFixed(1)}`).join(' ')}
                    fill="rgba(16, 185, 129, 0.03)"
                    stroke="rgba(16, 185, 129, 0.42)"
                    strokeWidth="1.3"
                  />
                  <polygon
                    points={[45, 135, 225, 315].map((d) => `${degToPt(d, R_RES_ORBIT).x.toFixed(1)},${degToPt(d, R_RES_ORBIT).y.toFixed(1)}`).join(' ')}
                    fill="none"
                    stroke="rgba(56, 189, 248, 0.28)"
                    strokeWidth="1.1"
                    strokeDasharray="3,3"
                  />
                </g>
              )}

              {/* Sacred Geometry 3: Fixed Cross (45° / 135° / 225° / 315°) */}
              {showFixed && [45, 135, 225, 315].map((d) => {
                const p = degToPt(d, R_BEZEL);
                return <line key={`fc-${d}`} x1={C} y1={C} x2={p.x} y2={p.y} stroke="rgba(56, 189, 248, 0.38)" strokeWidth="1.2" strokeDasharray="4,3" />;
              })}

              {/* Sacred Geometry 4: Cardinal Cross (0° / 90° / 180° / 270°) */}
              {showCardinal && [0, 90, 180, 270].map((d) => {
                const p = degToPt(d, R_BEZEL);
                return <line key={`cc-${d}`} x1={C} y1={C} x2={p.x} y2={p.y} stroke="rgba(251, 191, 36, 0.65)" strokeWidth="1.8" />;
              })}

              {/* Swept Orbital Progress Sector from 0° to Current Degree */}
              <path d={buildSweep(currentDeg, R_SPOT_ORBIT)} fill="rgba(56, 189, 248, 0.14)" />

              {/* Protractor Custom Angle Ray */}
              <line
                x1={C}
                y1={C}
                x2={protractorPt.x}
                y2={protractorPt.y}
                stroke="#fbbf24"
                strokeWidth="1.5"
                strokeDasharray="3,3"
              />
              <circle cx={protractorPt.x} cy={protractorPt.y} r="5" fill="#fbbf24" stroke="#0f172a" strokeWidth="1.5" />

              {/* OUTER ORBIT NODES: Upside Harmonic Resistance Targets (+45° to +360°) */}
              {upsideNodes.map((node) => {
                const pt = degToPt(node.deg % 360, R_RES_ORBIT);
                const isSel = selectedWheelNode && selectedWheelNode.deg === node.deg && selectedWheelNode.orbit === node.orbit;
                return (
                  <g
                    key={`up-${node.deg}`}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setSelectedWheelNode(node)}
                  >
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={isSel ? 17 : 14}
                      fill="rgba(15, 23, 42, 0.94)"
                      stroke={node.has_confluence ? '#fbbf24' : node.color || '#10b981'}
                      strokeWidth={isSel ? 2.4 : 1.5}
                    />
                    <text x={pt.x} y={pt.y - 3} fill="#f8fafc" fontSize="7.5" fontWeight="800" fontFamily="monospace" textAnchor="middle">
                      ${Number(node.price).toFixed(0)}
                    </text>
                    <text x={pt.x} y={pt.y + 6} fill={node.color || '#10b981'} fontSize="6.5" fontWeight="700" textAnchor="middle">
                      +{node.deg}°{node.has_confluence ? '★' : ''}
                    </text>
                  </g>
                );
              })}

              {/* INNER ORBIT NODES: Downside Harmonic Supports (-45° to -270°) */}
              {downsideNodes.filter((n) => [45, 90, 135, 180, 270, 360].includes(n.deg)).map((node) => {
                const pt = degToPt(node.deg % 360, R_SUP_ORBIT);
                const isSel = selectedWheelNode && selectedWheelNode.deg === node.deg && selectedWheelNode.orbit === node.orbit;
                return (
                  <g
                    key={`dn-${node.deg}`}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setSelectedWheelNode(node)}
                  >
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={isSel ? 15 : 12.5}
                      fill="rgba(15, 23, 42, 0.94)"
                      stroke="#f43f5e"
                      strokeWidth={isSel ? 2.2 : 1.2}
                    />
                    <text x={pt.x} y={pt.y - 2} fill="#fda4af" fontSize="7" fontWeight="800" fontFamily="monospace" textAnchor="middle">
                      ${Number(node.price).toFixed(0)}
                    </text>
                    <text x={pt.x} y={pt.y + 6} fill="#f43f5e" fontSize="6" fontWeight="700" textAnchor="middle">
                      -{node.deg}°
                    </text>
                  </g>
                );
              })}

              {/* Solar Time Vector on Outer Ring */}
              {showSolarRing && (
                <g>
                  <line x1={C} y1={C} x2={timePt.x} y2={timePt.y} stroke="rgba(236, 72, 153, 0.55)" strokeWidth="1.5" strokeDasharray="2,3" />
                  <circle cx={timePt.x} cy={timePt.y} r="7" fill="#ec4899" stroke="#f8fafc" strokeWidth="1.5" />
                  <text x={timePt.x} y={timePt.y - 11} fill="#f472b6" fontSize="8" fontWeight="800" textAnchor="middle">
                    TIME ({timeDeg.toFixed(0)}°)
                  </text>
                </g>
              )}

              {/* Live Current Spot Price Vector & Glowing Beacon */}
              <line x1={C} y1={C} x2={spotPt.x} y2={spotPt.y} stroke="#38bdf8" strokeWidth="3" />
              <circle cx={spotPt.x} cy={spotPt.y} r="13" fill="rgba(56, 189, 248, 0.25)" />
              <circle cx={spotPt.x} cy={spotPt.y} r="7" fill="#38bdf8" stroke="#ffffff" strokeWidth="2" />
              <rect x={spotPt.x - 32} y={spotPt.y - 28} width="64" height="16" rx="4" fill="#0284c7" stroke="#e0f2fe" strokeWidth="0.8" />
              <text x={spotPt.x} y={spotPt.y - 17} fill="#ffffff" fontSize="8.5" fontWeight="900" fontFamily="monospace" textAnchor="middle">
                ${spotPrice.toFixed(2)}
              </text>

              {/* Center Hub Emblem */}
              <circle cx={C} cy={C} r={R_CORE} fill="rgba(9, 14, 28, 0.98)" stroke="#fbbf24" strokeWidth="2" />
              <text x={C} y={C - 11} fill="#fbbf24" fontSize="8" fontWeight="800" textAnchor="middle">
                ANCHOR 0°
              </text>
              <text x={C} y={C + 2} fill="#f8fafc" fontSize="11" fontWeight="900" fontFamily="monospace" textAnchor="middle">
                ${anchorPrice.toFixed(1)}
              </text>
              <text x={C} y={C + 14} fill="#38bdf8" fontSize="8" fontWeight="700" fontFamily="monospace" textAnchor="middle">
                {currentDeg.toFixed(1)}° • R#{ringLevel}
              </text>
            </svg>

            {/* Selected Wheel Node Inspector Banner */}
            {selectedWheelNode && (
              <div style={{
                width: '100%',
                marginTop: '10px',
                background: 'rgba(30, 41, 59, 0.78)',
                border: `1px solid ${selectedWheelNode.orbit === 'UPSIDE_RESISTANCE' ? '#10b981' : '#f43f5e'}`,
                borderRadius: '10px',
                padding: '10px 14px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '8px',
                fontSize: '0.78rem'
              }}>
                <div>
                  <strong style={{ color: '#f8fafc' }}>
                    {selectedWheelNode.orbit === 'UPSIDE_RESISTANCE' ? '🟢 Upside Resistance Node' : '🔻 Downside Support Node'}: {selectedWheelNode.name}
                  </strong>
                  <span style={{ marginLeft: '8px', color: '#94a3b8' }}>({selectedWheelNode.type})</span>
                </div>
                <div style={{ fontFamily: 'monospace', fontWeight: 800, color: '#fbbf24', fontSize: '0.9rem' }}>
                  ${Number(selectedWheelNode.price).toFixed(2)}{' '}
                  <span style={{ color: selectedWheelNode.orbit === 'UPSIDE_RESISTANCE' ? '#10b981' : '#f43f5e', fontSize: '0.78rem' }}>
                    ({selectedWheelNode.orbit === 'UPSIDE_RESISTANCE' ? `+${selectedWheelNode.gain_pct}%` : `-${selectedWheelNode.drop_pct}%`})
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* RIGHT PANEL: PROTRACTOR CALCULATOR + S/R EQUILIBRIUM LADDER + 9x9 SPIRAL MATRIX */}
        {(studioView === 'SPLIT' || studioView === 'MATRIX' || studioView === 'WHEEL') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Card A: Interactive Harmonic Angle Protractor Calculator (0° to 720°) */}
            <div style={{
              background: 'rgba(15, 23, 42, 0.85)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              borderRadius: '12px',
              padding: '14px 16px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.86rem', fontWeight: 800, color: '#f8fafc' }}>
                  🧭 Interactive Square of 9 Angle Calculator (0° – 720°)
                </span>
                <span style={{ fontFamily: 'monospace', fontSize: '0.82rem', fontWeight: 900, color: '#fbbf24' }}>
                  Δθ = {protractorDeg}° ({(protractorDeg / 360).toFixed(2)} Orbits)
                </span>
              </div>

              <input
                type="range"
                min="15"
                max="720"
                step="15"
                value={protractorDeg}
                onChange={(e) => setProtractorDeg(Number(e.target.value))}
                style={{ width: '100%', accentColor: '#38bdf8', cursor: 'pointer', marginBottom: '10px' }}
              />

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '8px', padding: '8px 10px' }}>
                  <div style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 700 }}>UPSIDE TARGET (+{protractorDeg}°)</div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 900, fontFamily: 'monospace', color: '#10b981', marginTop: '2px' }}>
                    ${calcUpsidePrice.toFixed(2)}
                  </div>
                  <div style={{ fontSize: '0.69rem', color: '#34d399', fontFamily: 'monospace' }}>+{calcGainPct.toFixed(2)}% from Spot</div>
                </div>

                <div style={{ background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.3)', borderRadius: '8px', padding: '8px 10px' }}>
                  <div style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 700 }}>DOWNSIDE SUPPORT (−{protractorDeg}°)</div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 900, fontFamily: 'monospace', color: '#f43f5e', marginTop: '2px' }}>
                    ${calcDownsidePrice.toFixed(2)}
                  </div>
                  <div style={{ fontSize: '0.69rem', color: '#fda4af', fontFamily: 'monospace' }}>−{calcDropPct.toFixed(2)}% from Spot</div>
                </div>

                <div style={{ background: 'rgba(251, 191, 36, 0.1)', border: '1px solid rgba(251, 191, 36, 0.3)', borderRadius: '8px', padding: '8px 10px' }}>
                  <div style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 700 }}>FROM ANCHOR (+{protractorDeg}°)</div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 900, fontFamily: 'monospace', color: '#fbbf24', marginTop: '2px' }}>
                    ${calcAnchorHarmonic.toFixed(2)}
                  </div>
                  <div style={{ fontSize: '0.69rem', color: '#cbd5e1', fontFamily: 'monospace' }}>Anchor: ${anchorPrice.toFixed(2)}</div>
                </div>
              </div>
            </div>

            {/* Card B: S4 -> S1 -> SPOT -> R1 -> R4 Harmonic Support/Resistance Ladder */}
            {sr && sr.r1 && sr.s1 && (
              <div style={{
                background: 'rgba(15, 23, 42, 0.85)',
                border: '1px solid rgba(148, 163, 184, 0.2)',
                borderRadius: '12px',
                padding: '14px 16px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#f8fafc' }}>
                    🎯 Square of 9 S/R Equilibrium Channel (S1 ↔ R1)
                  </span>
                  <span style={{ fontSize: '0.72rem', color: '#38bdf8', fontWeight: 700 }}>
                    {sr.tactical_posture}
                  </span>
                </div>

                {/* Progress Bar between S1 (-45°) and R1 (+45°) */}
                <div style={{ position: 'relative', height: '10px', background: 'rgba(30, 41, 59, 0.9)', borderRadius: '999px', margin: '8px 0 12px 0', overflow: 'hidden' }}>
                  <div style={{
                    width: `${Math.max(3, Math.min(97, sr.channel_position_pct || 50))}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #f43f5e, #fbbf24, #10b981)'
                  }} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', fontSize: '0.72rem', fontFamily: 'monospace' }}>
                  {[
                    { tag: 'S2 (−90°)', val: sr.s2?.price, pct: `-${sr.s2?.drop_pct}%`, col: '#f43f5e' },
                    { tag: 'S1 (−45°)', val: sr.s1?.price, pct: `-${sr.s1?.drop_pct}%`, col: '#fb7185' },
                    { tag: 'R1 (+45°)', val: sr.r1?.price, pct: `+${sr.r1?.gain_pct}%`, col: '#34d399' },
                    { tag: 'R2 (+90°)', val: sr.r2?.price, pct: `+${sr.r2?.gain_pct}%`, col: '#10b981' },
                  ].map((item, idx) => (
                    <div key={idx} style={{ background: 'rgba(30, 41, 59, 0.55)', border: `1px solid ${item.col}44`, borderRadius: '7px', padding: '6px 8px', textAlign: 'center' }}>
                      <div style={{ color: '#94a3b8', fontSize: '0.66rem', fontWeight: 700 }}>{item.tag}</div>
                      <div style={{ color: '#f8fafc', fontWeight: 800, fontSize: '0.82rem' }}>${Number(item.val || 0).toFixed(2)}</div>
                      <div style={{ color: item.col, fontWeight: 700 }}>{item.pct}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Card C: Authentic 81-Cell Concentric Spiral Matrix */}
            {(studioView === 'SPLIT' || studioView === 'MATRIX') && (
              <div style={{
                background: 'rgba(15, 23, 42, 0.85)',
                border: '1px solid rgba(251, 191, 36, 0.25)',
                borderRadius: '12px',
                padding: '14px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                  <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#fbbf24' }}>
                    🔢 9×9 Concentric Square of 9 Spiral Matrix (81 Cells)
                  </span>
                  {selectedMatrixCell && (
                    <span style={{ fontSize: '0.74rem', fontFamily: 'monospace', color: '#e2e8f0', background: 'rgba(30, 41, 59, 0.85)', padding: '3px 9px', borderRadius: '6px', border: '1px solid rgba(251, 191, 36, 0.4)' }}>
                      Cell #{selectedMatrixCell.num}: <strong style={{ color: '#fbbf24' }}>${selectedMatrixCell.price?.toFixed(2)}</strong> ({selectedMatrixCell.axis_name || `${selectedMatrixCell.degrees}°`} • Ring #{selectedMatrixCell.ring})
                    </span>
                  )}
                </div>

                <div className="sq9-matrix-table-container" style={{ padding: 0 }}>
                  <div className="sq9-matrix-grid">
                    {(sq9?.matrix_grid?.cells || []).map((c, i) => {
                      const isSelected = selectedMatrixCell && selectedMatrixCell.row === c.row && selectedMatrixCell.col === c.col;
                      const isCenter = c.row === 4 && c.col === 4;
                      const isCurrentActive = sq9?.matrix_grid?.active_cell?.row === c.row && sq9?.matrix_grid?.active_cell?.col === c.col;

                      let cellClass = 'matrix-cell';
                      if (isCenter) cellClass += ' center-cell';
                      else if (c.is_cardinal) cellClass += ' cardinal-cell';
                      else if (c.is_fixed) cellClass += ' fixed-cell';
                      if (isCurrentActive) cellClass += ' current-price-cell';
                      if (isSelected) cellClass += ' selected-cell';

                      return (
                        <div
                          key={i}
                          className={cellClass}
                          onClick={() => setSelectedMatrixCell(c)}
                          title={`Cell #${c.num}: $${c.price} | ${c.axis_name || `${c.degrees}°`} | Ring #${c.ring}`}
                        >
                          <div className="cell-num">{c.num}</div>
                          <div className="cell-price">${c.price?.toFixed(0)}</div>
                          {c.axis_name && <div className="cell-axis">{c.axis_name}</div>}
                          {isCurrentActive && <div className="current-indicator">SPOT</div>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------
// High Performance SVG Candlestick + Swings + Dual Fan + Second Square Chart
// ---------------------------------------------------------------------------------
function GannSvgChart({ 
  chartData, 
  timeframe = '180D', 
  showFan = true, 
  showDownFan = true, 
  showGannBox = true, 
  showSecondSquare = true,
  showGannSwings = true,
  showSq9 = true, 
  showTimeCycles = true, 
  showOctaves = true 
}) {
  const [hoverBar, setHoverBar] = useState(null);
  const containerRef = useRef(null);
  const [width, setWidth] = useState(900);
  const [sliderPos, setSliderPos] = useState(100);
  const [zoomLevel, setZoomLevel] = useState(1.0);

  useEffect(() => {
    if (!containerRef.current) return;
    const updateW = () => setWidth(containerRef.current.clientWidth || 900);
    updateW();
    window.addEventListener('resize', updateW);
    return () => window.removeEventListener('resize', updateW);
  }, []);

  useEffect(() => {
    setSliderPos(100);
    setZoomLevel(1.0);
  }, [timeframe]);

  if (!chartData || !chartData.candles || chartData.candles.length === 0) {
    return <div style={{ color: '#94a3b8', textAlign: 'center', paddingTop: '100px' }}>No chart data available.</div>;
  }

  const allCandles = chartData.candles;
  const anchorLow = chartData.anchor_low || {};
  const anchorHigh = chartData.anchor_high || {};
  const gbox = chartData.gann_box || {};
  const secSq = chartData.second_square || {};
  const gannSwings = chartData.gann_swings || [];
  const fanRays = chartData.fan_rays || [];
  const downRays = chartData.down_rays || [];
  const sq9Levels = chartData.sq9_levels || [];
  const timeCycleLines = chartData.time_cycle_lines || [];
  const timeBands = chartData.time_confluence_bands || [];
  const octaves = chartData.octaves || [];

  const baseWindowSize = useMemo(() => {
    if (timeframe === '90D') return Math.min(allCandles.length, 90);
    if (timeframe === '180D') return Math.min(allCandles.length, 180);
    if (timeframe === '1Y') return Math.min(allCandles.length, 252);
    return allCandles.length;
  }, [allCandles, timeframe]);

  const windowSize = Math.max(30, Math.round(baseWindowSize / zoomLevel));
  const maxOffset = Math.max(0, allCandles.length - windowSize);
  const offset = Math.round((sliderPos / 100) * maxOffset);

  const candles = useMemo(() => {
    return allCandles.slice(offset, offset + windowSize);
  }, [allCandles, offset, windowSize]);

  const handleWheel = (e) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      setZoomLevel(prev => Math.min(2.5, prev * 1.15));
    } else {
      setZoomLevel(prev => Math.max(0.7, prev * 0.85));
    }
  };

  const height = 420;
  const priceHeight = 300;
  const volHeight = 70;
  const gap = 15;
  const padTop = 25;
  const padRight = 95;
  const padLeft = 10;
  const drawWidth = Math.max(100, width - padLeft - padRight);

  const allHighs = candles.map(c => c.high);
  const allLows = candles.map(c => c.low);

  let minP = Math.min(...allLows);
  let maxP = Math.max(...allHighs);

  if (showSq9 && sq9Levels.length > 0) {
    sq9Levels.forEach(s => {
      if (s.price < minP && s.price > minP * 0.85) minP = s.price;
      if (s.price > maxP && s.price < maxP * 1.15) maxP = s.price;
    });
  }
  if (showSecondSquare && secSq.high_price) {
    const targetCap = secSq.is_active ? secSq.high_price * 1.03 : Math.min(secSq.mid_price || secSq.high_price, maxP * 1.25);
    if (targetCap > maxP) maxP = targetCap;
  }

  const pSpan = (maxP - minP) || 1.0;
  const maxVol = Math.max(...candles.map(c => c.volume), 1000);

  const getY = (price) => {
    return padTop + priceHeight - ((price - minP) / pSpan) * priceHeight;
  };

  const getVolY = (vol) => {
    const volTop = padTop + priceHeight + gap;
    return volTop + volHeight - (vol / maxVol) * volHeight;
  };

  const barWidth = Math.max(2, Math.min(14, (drawWidth / candles.length) * 0.65));
  const step = drawWidth / candles.length;

  const lowSliceIdx = (anchorLow.trimmed_idx != null ? anchorLow.trimmed_idx : 0) - offset;
  const highSliceIdx = (anchorHigh.trimmed_idx != null ? anchorHigh.trimmed_idx : 0) - offset;
  
  const lowAnchorX = padLeft + lowSliceIdx * step + step / 2;
  const lowAnchorY = getY(anchorLow.price || minP);

  const highAnchorX = padLeft + highSliceIdx * step + step / 2;
  const highAnchorY = getY(anchorHigh.price || maxP);

  // Box 1 pixel coords
  const boxStartSlice = Math.min(lowSliceIdx, highSliceIdx);
  const boxEndSlice = Math.max(lowSliceIdx, highSliceIdx);
  const boxX1 = padLeft + boxStartSlice * step;
  const boxX2 = padLeft + boxEndSlice * step + step;
  const boxYTop = getY(gbox.high_price || maxP);
  const boxYBot = getY(gbox.low_price || minP);
  const boxYMid = getY(gbox.mid_price || (maxP + minP) / 2);

  // Box 2 (Second Square) pixel coords
  const secBoxStartSlice = boxEndSlice;
  const secBoxEndSlice = Math.min(candles.length + 20, boxEndSlice + (boxEndSlice - boxStartSlice));
  const secBoxX1 = padLeft + secBoxStartSlice * step;
  const secBoxX2 = padLeft + secBoxEndSlice * step;
  const secBoxYTop = Math.max(padTop + 2, getY(secSq.high_price || maxP));
  const secBoxYBot = boxYTop;
  const secBoxYMid = Math.max(padTop + 10, getY(secSq.mid_price || (secSq.high_price + (gbox.high_price || maxP)) / 2));

  // Build continuous Gann Swing Line points
  const visibleSwings = useMemo(() => {
    if (!showGannSwings || !gannSwings.length) return [];
    const pts = [];
    gannSwings.forEach(s => {
      const sliceIdx = s.idx - offset;
      if (sliceIdx >= -2 && sliceIdx <= candles.length + 2) {
        pts.push({
          x: padLeft + sliceIdx * step + step / 2,
          y: getY(s.price),
          type: s.type,
          price: s.price,
          is_active: s.is_active
        });
      }
    });
    return pts;
  }, [gannSwings, offset, candles.length, step, minP, maxP, showGannSwings]);

  return (
    <div className="gann-svg-chart-container" ref={containerRef} onWheel={handleWheel}>
      {/* Zoom / Pan Floating Control Bar */}
      <div className="chart-zoom-controls">
        <button className="chart-ctrl-btn" onClick={() => setZoomLevel(prev => Math.min(2.5, prev * 1.2))} title="Zoom In">
          <ZoomIn size={14} />
        </button>
        <button className="chart-ctrl-btn" onClick={() => setZoomLevel(prev => Math.max(0.7, prev * 0.8))} title="Zoom Out">
          <ZoomOut size={14} />
        </button>
        <button className="chart-ctrl-btn" onClick={() => { setZoomLevel(1.0); setSliderPos(100); }} title="Reset Zoom">
          <RotateCcw size={14} />
        </button>
      </div>

      <svg 
        width={width} 
        height={height} 
        className="gann-svg-canvas"
        onMouseLeave={() => setHoverBar(null)}
      >
        {/* Background Grid Lines */}
        {[0, 0.25, 0.5, 0.75, 1.0].map((frac, idx) => {
          const y = padTop + priceHeight * frac;
          const priceVal = maxP - frac * pSpan;
          return (
            <g key={idx}>
              <line x1={padLeft} y1={y} x2={padLeft + drawWidth} y2={y} stroke="rgba(255,255,255,0.05)" strokeDasharray="3,3" />
              <text x={padLeft + drawWidth + 6} y={y + 4} fill="#64748b" fontSize="10" fontFamily="monospace">
                ${priceVal.toFixed(2)}
              </text>
            </g>
          );
        })}

        {/* Time Confluence Shaded Bands */}
        {showTimeCycles && timeBands.map((band, bIdx) => {
          const sliceX = band.center_idx - offset;
          if (sliceX < 0 || sliceX >= candles.length) return null;
          const x = padLeft + sliceX * step;
          const bandW = step * 3;
          return (
            <g key={`band-${bIdx}`}>
              <rect 
                x={x - step} 
                y={padTop} 
                width={bandW} 
                height={priceHeight} 
                fill="rgba(236, 72, 153, 0.12)" 
                stroke="rgba(236, 72, 153, 0.3)" 
                strokeDasharray="2,2" 
              />
              <rect 
                x={x - 30} 
                y={padTop + 4} 
                width={60} 
                height={16} 
                rx={3} 
                fill="rgba(236, 72, 153, 0.9)" 
              />
              <text 
                x={x} 
                y={padTop + 15} 
                textAnchor="middle" 
                fill="#ffffff" 
                fontSize="8" 
                fontWeight={800}
              >
                ★ {band.score}% CONFLUENCE
              </text>
            </g>
          );
        })}

        {/* The Primary Gann Box (Square 1) */}
        {showGannBox && boxX2 > boxX1 && (
          <g className="gann-box-overlay">
            <rect 
              x={Math.max(padLeft, boxX1)} 
              y={boxYTop} 
              width={Math.min(drawWidth, boxX2 - boxX1)} 
              height={Math.max(10, boxYBot - boxYTop)} 
              fill="rgba(251, 191, 36, 0.04)" 
              stroke="rgba(251, 191, 36, 0.45)" 
              strokeWidth={1.5}
            />
            <line 
              x1={Math.max(padLeft, boxX1)} 
              y1={boxYMid} 
              x2={Math.min(padLeft + drawWidth, boxX2)} 
              y2={boxYMid} 
              stroke="#38bdf8" 
              strokeWidth={1.2} 
              strokeDasharray="4,4" 
            />
            <line 
              x1={boxX1} 
              y1={lowSliceIdx <= highSliceIdx ? boxYBot : boxYTop} 
              x2={boxX2} 
              y2={lowSliceIdx <= highSliceIdx ? boxYTop : boxYBot} 
              stroke="rgba(251, 191, 36, 0.3)" 
              strokeWidth={1} 
            />
            <line 
              x1={boxX1} 
              y1={lowSliceIdx <= highSliceIdx ? boxYTop : boxYBot} 
              x2={boxX2} 
              y2={lowSliceIdx <= highSliceIdx ? boxYBot : boxYTop} 
              stroke="rgba(251, 191, 36, 0.3)" 
              strokeWidth={1} 
            />
          </g>
        )}

        {/* The Second Square (Forward Box Projection) */}
        {showSecondSquare && secBoxX2 > secBoxX1 && (
          <g className="second-square-overlay">
            <rect 
              x={Math.max(padLeft, secBoxX1)} 
              y={secBoxYTop} 
              width={Math.min(drawWidth, secBoxX2 - secBoxX1)} 
              height={Math.max(10, secBoxYBot - secBoxYTop)} 
              fill="rgba(168, 85, 247, 0.04)" 
              stroke="rgba(168, 85, 247, 0.5)" 
              strokeWidth={1.2}
              strokeDasharray="5,3"
            />
            <line 
              x1={Math.max(padLeft, secBoxX1)} 
              y1={secBoxYMid} 
              x2={Math.min(padLeft + drawWidth, secBoxX2)} 
              y2={secBoxYMid} 
              stroke="#c084fc" 
              strokeWidth={1.0} 
              strokeDasharray="3,3" 
            />
            <line 
              x1={secBoxX1} 
              y1={secBoxYBot} 
              x2={secBoxX2} 
              y2={secBoxYTop} 
              stroke="rgba(168, 85, 247, 0.25)" 
              strokeWidth={1} 
              strokeDasharray="3,3"
            />
            <text 
              x={Math.max(padLeft + 10, secBoxX1 + 10)} 
              y={secBoxYTop + 14} 
              fill="#c084fc" 
              fontSize="8.5" 
              fontWeight={800}
            >
              2ND SQUARE PROJECTION (${secSq.high_price})
            </text>
          </g>
        )}

        {/* 8ths Octaves Reference Lines */}
        {showOctaves && octaves.map(oct => {
          const y = getY(oct.price);
          if (y < padTop || y > padTop + priceHeight) return null;
          const isMid = oct.label === '4/8';
          return (
            <g key={oct.label}>
              <line 
                x1={padLeft} 
                y1={y} 
                x2={padLeft + drawWidth} 
                y2={y} 
                stroke={isMid ? '#38bdf8' : 'rgba(148, 163, 184, 0.25)'} 
                strokeWidth={isMid ? 1.5 : 1}
                strokeDasharray={isMid ? "4,4" : "2,4"} 
              />
              <text 
                x={padLeft + drawWidth + 6} 
                y={y - 3} 
                fill={isMid ? '#38bdf8' : '#94a3b8'} 
                fontSize="9" 
                fontWeight={isMid ? 700 : 400}
                fontFamily="monospace"
              >
                {oct.label} (${oct.price.toFixed(0)})
              </text>
            </g>
          );
        })}

        {/* Square of 9 Horizontal Levels */}
        {showSq9 && sq9Levels.map((lvl, idx) => {
          const y = getY(lvl.price);
          if (y < padTop || y > padTop + priceHeight) return null;
          return (
            <g key={`sq9-${idx}`}>
              <line 
                x1={padLeft} 
                y1={y} 
                x2={padLeft + drawWidth} 
                y2={y} 
                stroke={lvl.color} 
                strokeWidth={lvl.deg === 90 || lvl.deg === 180 ? 1.5 : 1}
                strokeDasharray="5,4" 
                strokeOpacity={0.8}
              />
              <rect 
                x={padLeft + drawWidth + 4} 
                y={y - 8} 
                width={85} 
                height={16} 
                rx={3} 
                fill="rgba(15, 23, 42, 0.9)" 
                stroke={lvl.color}
                strokeWidth={0.5}
              />
              <text 
                x={padLeft + drawWidth + 7} 
                y={y + 4} 
                fill={lvl.color} 
                fontSize="8.5" 
                fontWeight={600}
                fontFamily="monospace"
              >
                {lvl.name} ${lvl.price.toFixed(1)} {lvl.has_confluence ? '★' : ''}
              </text>
            </g>
          );
        })}

        {/* Time Cycle Vertical Projections */}
        {showTimeCycles && timeCycleLines.map((tc, idx) => {
          const sliceIdx = tc.index - offset;
          if (sliceIdx < 0 || sliceIdx >= candles.length) return null;
          const x = padLeft + sliceIdx * step + step / 2;
          return (
            <g key={`tc-${idx}`}>
              <line 
                x1={x} 
                y1={padTop} 
                x2={x} 
                y2={padTop + priceHeight} 
                stroke="#ec4899" 
                strokeWidth={1.2}
                strokeDasharray="4,4" 
                strokeOpacity={0.7}
              />
              <rect 
                x={x - 26} 
                y={padTop + 2} 
                width={52} 
                height={15} 
                rx={3} 
                fill="rgba(236, 72, 153, 0.25)" 
                stroke="#ec4899"
                strokeWidth={0.5}
              />
              <text 
                x={x} 
                y={padTop + 12} 
                textAnchor="middle" 
                fill="#f472b6" 
                fontSize="8" 
                fontWeight={700}
              >
                {tc.name}
              </text>
            </g>
          );
        })}

        {/* Downward Fan Rays (from High) */}
        {showDownFan && downRays.map((ray) => {
          const endX = padLeft + drawWidth;
          const endY = getY(ray.projected_price);

          return (
            <g key={`down-${ray.name}`}>
              <line 
                x1={highAnchorX} 
                y1={highAnchorY} 
                x2={endX} 
                y2={endY} 
                stroke={ray.color} 
                strokeWidth={1.0}
                strokeOpacity={0.55}
                strokeDasharray="4,2"
              />
            </g>
          );
        })}

        {/* Upward Gann Fan Angled Rays (from Low) */}
        {showFan && fanRays.map((ray) => {
          const isMaster = ray.name === '1x1';
          const endX = padLeft + drawWidth;
          const endY = getY(ray.projected_price);

          return (
            <g key={`up-${ray.name}`}>
              <line 
                x1={lowAnchorX} 
                y1={lowAnchorY} 
                x2={endX} 
                y2={endY} 
                stroke={ray.color} 
                strokeWidth={isMaster ? 2.2 : 1.2}
                strokeOpacity={isMaster ? 0.95 : 0.65}
              />
              {endY >= padTop && endY <= padTop + priceHeight && (
                <text 
                  x={endX - 35} 
                  y={endY - 4} 
                  fill={ray.color} 
                  fontSize="9" 
                  fontWeight={isMaster ? 800 : 600}
                >
                  {ray.name}
                </text>
              )}
            </g>
          );
        })}

        {/* W.D. Gann Mechanical Swing Line (Zigzag Overlay) */}
        {showGannSwings && visibleSwings.length >= 2 && (
          <g className="gann-swing-overlay">
            {visibleSwings.map((pt, idx) => {
              if (idx === 0) return null;
              const prev = visibleSwings[idx - 1];
              return (
                <line 
                  key={`swing-${idx}`}
                  x1={prev.x}
                  y1={prev.y}
                  x2={pt.x}
                  y2={pt.y}
                  stroke="#fbbf24"
                  strokeWidth={2.0}
                  strokeOpacity={0.85}
                />
              );
            })}
            {visibleSwings.map((pt, idx) => (
              <g key={`swing-pt-${idx}`}>
                <circle cx={pt.x} cy={pt.y} r={3.5} fill={pt.type === 'HIGH' ? '#f43f5e' : '#10b981'} />
                {pt.type === 'HIGH' ? (
                  <text x={pt.x} y={pt.y - 7} fill="#f43f5e" fontSize="8" fontWeight="800" textAnchor="middle">
                    H ${pt.price?.toFixed(0)}
                  </text>
                ) : (
                  <text x={pt.x} y={pt.y + 12} fill="#10b981" fontSize="8" fontWeight="800" textAnchor="middle">
                    L ${pt.price?.toFixed(0)}
                  </text>
                )}
              </g>
            ))}
          </g>
        )}

        {/* Anchor Low Marker */}
        {lowSliceIdx >= 0 && lowSliceIdx < candles.length && (
          <g>
            <circle cx={lowAnchorX} cy={lowAnchorY} r={6} fill="#fbbf24" stroke="#0f172a" strokeWidth={2} />
            <rect 
              x={lowAnchorX - 35} 
              y={lowAnchorY + 8} 
              width={70} 
              height={16} 
              rx={4} 
              fill="rgba(251, 191, 36, 0.9)" 
            />
            <text 
              x={lowAnchorX} 
              y={lowAnchorY + 19} 
              textAnchor="middle" 
              fill="#0f172a" 
              fontSize="8.5" 
              fontWeight={800}
            >
              CYCLE LOW
            </text>
          </g>
        )}

        {/* Anchor High Marker */}
        {highSliceIdx >= 0 && highSliceIdx < candles.length && (
          <g>
            <circle cx={highAnchorX} cy={highAnchorY} r={6} fill="#f43f5e" stroke="#0f172a" strokeWidth={2} />
            <rect 
              x={highAnchorX - 35} 
              y={highAnchorY - 22} 
              width={70} 
              height={16} 
              rx={4} 
              fill="rgba(244, 63, 94, 0.9)" 
            />
            <text 
              x={highAnchorX} 
              y={highAnchorY - 11} 
              textAnchor="middle" 
              fill="#ffffff" 
              fontSize="8.5" 
              fontWeight={800}
            >
              SWING HIGH
            </text>
          </g>
        )}

        {/* Candlesticks & Volume Bars */}
        {candles.map((c, i) => {
          const x = padLeft + i * step + (step - barWidth) / 2;
          const centerX = padLeft + i * step + step / 2;
          const isGreen = c.close >= c.open;
          const candleColor = isGreen ? '#10b981' : '#f43f5e';
          
          const openY = getY(c.open);
          const closeY = getY(c.close);
          const highY = getY(c.high);
          const lowY = getY(c.low);
          
          const topBodyY = Math.min(openY, closeY);
          const bodyH = Math.max(1.5, Math.abs(openY - closeY));

          const volTop = getVolY(c.volume);
          const volBase = padTop + priceHeight + gap + volHeight;
          const volH = Math.max(1, volBase - volTop);

          return (
            <g 
              key={c.date} 
              className="candle-group"
              onMouseEnter={() => setHoverBar({ candle: c, index: i + offset, x: centerX, y: topBodyY })}
            >
              <line x1={centerX} y1={highY} x2={centerX} y2={lowY} stroke={candleColor} strokeWidth={1} />
              <rect 
                x={x} 
                y={topBodyY} 
                width={barWidth} 
                height={bodyH} 
                fill={candleColor} 
                rx={1}
              />
              <rect 
                x={x} 
                y={volTop} 
                width={barWidth} 
                height={volH} 
                fill={isGreen ? 'rgba(16, 185, 129, 0.45)' : 'rgba(244, 63, 94, 0.45)'} 
                rx={1}
              />
            </g>
          );
        })}

        {/* Hover Crosshair */}
        {hoverBar && (
          <g>
            <line 
              x1={hoverBar.x} 
              y1={padTop} 
              x2={hoverBar.x} 
              y2={padTop + priceHeight + gap + volHeight} 
              stroke="rgba(255, 255, 255, 0.3)" 
              strokeDasharray="2,2" 
            />
            <line 
              x1={padLeft} 
              y1={hoverBar.y} 
              x2={padLeft + drawWidth} 
              y2={hoverBar.y} 
              stroke="rgba(255, 255, 255, 0.3)" 
              strokeDasharray="2,2" 
            />
          </g>
        )}
      </svg>

      {/* Floating Hover Info Pill with Dynamic Slope from Anchor */}
      {hoverBar && (
        <div 
          className="gann-hover-tooltip"
          style={{
            left: Math.min(Math.max(15, hoverBar.x - 90), width - 240),
            top: 10
          }}
        >
          <div className="tooltip-date">{hoverBar.candle.date}</div>
          <div className="tooltip-row">
            <span>O: ${hoverBar.candle.open.toFixed(2)}</span>
            <span>H: ${hoverBar.candle.high.toFixed(2)}</span>
            <span>L: ${hoverBar.candle.low.toFixed(2)}</span>
            <span style={{ color: hoverBar.candle.close >= hoverBar.candle.open ? '#10b981' : '#f43f5e' }}>
              C: ${hoverBar.candle.close.toFixed(2)}
            </span>
          </div>
          <div className="tooltip-row-sub">
            <span>Vol: {(hoverBar.candle.volume / 1e6).toFixed(1)}M</span>
            <span>RVOL: {hoverBar.candle.rvol || 1.0}x</span>
            <span>Slope from Low: ${(Math.abs(hoverBar.candle.close - (anchorLow.price || 0)) / Math.max(1, hoverBar.index - (anchorLow.trimmed_idx || 0))).toFixed(2)}/bar</span>
          </div>
        </div>
      )}

      {/* Interactive Range Slider (Pan along historical bars) */}
      <div className="gann-slider-row">
        <span className="slider-label">Timeline Pan:</span>
        <input 
          type="range" 
          min="0" 
          max="100" 
          value={sliderPos} 
          onChange={(e) => setSliderPos(Number(e.target.value))}
          className="gann-timeline-slider" 
        />
        <span className="slider-dates-info">
          {candles[0]?.date} ➔ {candles[candles.length - 1]?.date} ({candles.length} bars, {zoomLevel.toFixed(1)}x Zoom)
        </span>
      </div>
    </div>
  );
}

// Master W.D. Gann Educational & Reference Guide Modal
function GannInfoGuideModal({ onClose }) {
  const [activeTab, setActiveTab] = useState('CONCEPTS');

  return (
    <div className="gann-modal-overlay" onClick={onClose}>
      <div className="gann-modal-content gann-guide-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="gann-modal-header" style={{ borderBottom: '1px solid rgba(251, 191, 36, 0.3)' }}>
          <div className="modal-header-left">
            <div className="modal-ticker-group">
              <span className="modal-ticker" style={{ color: '#fbbf24', fontSize: '1.4rem' }}>📐 W.D. Gann Master Educational Guide</span>
              <span className="gann-setup-badge badge-second_square_breakout">Complete Terminal Reference</span>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-sub-nav" style={{ margin: '1rem 0' }}>
          <button className={`modal-sub-tab ${activeTab === 'CONCEPTS' ? 'active' : ''}`} onClick={() => setActiveTab('CONCEPTS')}>
            💡 Core Principles
          </button>
          <button className={`modal-sub-tab ${activeTab === 'SQ9' ? 'active' : ''}`} onClick={() => setActiveTab('SQ9')}>
            🎯 Square of 9 (Spiral)
          </button>
          <button className={`modal-sub-tab ${activeTab === 'ANGLES' ? 'active' : ''}`} onClick={() => setActiveTab('ANGLES')}>
            📐 1x1 & Fan Angles
          </button>
          <button className={`modal-sub-tab ${activeTab === 'CYCLES' ? 'active' : ''}`} onClick={() => setActiveTab('CYCLES')}>
            ⏰ Time & Calendar Cycles
          </button>
          <button className={`modal-sub-tab ${activeTab === 'SETUPS' ? 'active' : ''}`} onClick={() => setActiveTab('SETUPS')}>
            🚀 Terminal Setups & Rules
          </button>
        </div>

        <div className="gann-modal-body" style={{ padding: '1rem', lineHeight: '1.6', color: '#cbd5e1' }}>
          {activeTab === 'CONCEPTS' && (
            <div className="guide-section">
              <h3 style={{ color: '#fbbf24', fontSize: '1.2rem', marginBottom: '0.8rem' }}>What is W.D. Gann Theory?</h3>
              <p>
                William Delbert Gann (1878–1955) was a legendary financial trader who discovered that financial markets operate according to 
                <strong> mathematical harmonics, geometric angles, and fixed time cycles</strong>. Unlike modern technical indicators that lag price, Gann's methods are <em>predictive</em>—projecting exact price targets and time windows where trend pivots must occur.
              </p>
              
              <div className="guide-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1.2rem' }}>
                <div className="guide-card" style={{ background: 'rgba(15, 23, 42, 0.8)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <h4 style={{ color: '#38bdf8', margin: '0 0 0.5rem 0' }}>1. Time & Price Equivalence</h4>
                  <p style={{ fontSize: '0.88rem', margin: 0 }}>
                    Gann believed time and price are interchangeable. When a stock advances by 50 points over 50 days (or 50 bars), price and time are <strong>"Squared"</strong>. At this exact junction, a trend change or powerful breakout occurs.
                  </p>
                </div>
                <div className="guide-card" style={{ background: 'rgba(15, 23, 42, 0.8)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <h4 style={{ color: '#10b981', margin: '0 0 0.5rem 0' }}>2. Geometric Angles (1x1 Master Line)</h4>
                  <p style={{ fontSize: '0.88rem', margin: 0 }}>
                    The 1x1 angle represents 1 unit of price per 1 unit of time (45° angle). As long as a stock stays <strong>above the 1x1 Master Angle</strong>, it is in a strong institutional bull market. Falling below signals defensive distribution.
                  </p>
                </div>
                <div className="guide-card" style={{ background: 'rgba(15, 23, 42, 0.8)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <h4 style={{ color: '#f59e0b', margin: '0 0 0.5rem 0' }}>3. Square of 9 (Spiral Matrix)</h4>
                  <p style={{ fontSize: '0.88rem', margin: 0 }}>
                    A mathematical wheel where prices radiate outward in a square spiral. Key price levels occur at cardinal angular rotations (45°, 90°, 180°, 270°, 360°).
                  </p>
                </div>
                <div className="guide-card" style={{ background: 'rgba(15, 23, 42, 0.8)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <h4 style={{ color: '#ec4899', margin: '0 0 0.5rem 0' }}>4. Mechanical Swing System</h4>
                  <p style={{ fontSize: '0.88rem', margin: 0 }}>
                    Gann used objective 2-day and 3-day swing rules to eliminate emotions. A 2-day consecutive higher high confirms an UPTREND, while a 2-day consecutive lower low confirms a DOWNTREND.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'SQ9' && (
            <div className="guide-section">
              <h3 style={{ color: '#fbbf24', fontSize: '1.2rem', marginBottom: '0.8rem' }}>Understanding the Square of 9 (Sq9)</h3>
              <p>
                The <strong>Square of 9</strong> is a square root calculator arranged as a spiral matrix starting from 1 at the center. Gann discovered that stock prices naturally stop and reverse at exact angular steps along this wheel.
              </p>

              <div style={{ background: 'rgba(15, 23, 42, 0.9)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(251, 191, 36, 0.2)', margin: '1rem 0' }}>
                <h4 style={{ color: '#fbbf24', marginTop: 0 }}>Key Angular Harmonics:</h4>
                <ul style={{ paddingLeft: '1.2rem', margin: 0, fontSize: '0.9rem' }}>
                  <li><strong style={{ color: '#38bdf8' }}>45° / 135° / 225° / 315° (Diagonal Cross)</strong>: Minor intra-swing support and resistance targets.</li>
                  <li><strong style={{ color: '#10b981' }}>90° / 270° (Cardinal Cross)</strong>: Major inflection points where trend speed accelerates.</li>
                  <li><strong style={{ color: '#f43f5e' }}>180° (Opposite Pole)</strong>: Critical reversal target (half-cycle rotation).</li>
                  <li><strong style={{ color: '#a855f7' }}>360° (Full Solar Orbit)</strong>: Complete price-time square completion (1 full rotation around the wheel).</li>
                </ul>
              </div>
              <p style={{ fontSize: '0.88rem', color: '#94a3b8' }}>
                *In our Gann Terminal, click on the <strong>Square of 9 Matrix</strong> tab inside any stock modal to view its real-time 360° grid!
              </p>
            </div>
          )}

          {activeTab === 'ANGLES' && (
            <div className="guide-section">
              <h3 style={{ color: '#fbbf24', fontSize: '1.2rem', marginBottom: '0.8rem' }}>Gann Fan Angles (Geometric Slopes)</h3>
              <p>
                Gann Fans are drawn from major swing lows (Bullish Anchor) or swing highs (Bearish Anchor). The angles measure the velocity of price relative to time:
              </p>

              <table className="gann-table" style={{ width: '100%', marginTop: '1rem', fontSize: '0.88rem' }}>
                <thead>
                  <tr style={{ background: '#1e293b', color: '#fbbf24' }}>
                    <th style={{ padding: '8px' }}>Angle</th>
                    <th style={{ padding: '8px' }}>Ratio (Price : Time)</th>
                    <th style={{ padding: '8px' }}>Meaning & Market Posture</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ padding: '8px', color: '#ec4899', fontWeight: 'bold' }}>1x8 / 1x4</td>
                    <td style={{ padding: '8px' }}>1 point per 8/4 bars</td>
                    <td style={{ padding: '8px' }}>Parabolic / Hyper-bullish momentum (Unstable extreme)</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '8px', color: '#38bdf8', fontWeight: 'bold' }}>1x2</td>
                    <td style={{ padding: '8px' }}>1 point per 2 bars</td>
                    <td style={{ padding: '8px' }}>Strong Momentum Trend (Outperforming baseline)</td>
                  </tr>
                  <tr style={{ background: 'rgba(16, 185, 129, 0.15)' }}>
                    <td style={{ padding: '8px', color: '#10b981', fontWeight: 'bold' }}>1x1 (Master)</td>
                    <td style={{ padding: '8px' }}>1 point per 1 bar (45°)</td>
                    <td style={{ padding: '8px' }}><strong>The True Bull/Bear Divider</strong> (Institutional equilibrium)</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '8px', color: '#f59e0b', fontWeight: 'bold' }}>2x1 / 4x1</td>
                    <td style={{ padding: '8px' }}>2/4 points per 1 bar</td>
                    <td style={{ padding: '8px' }}>Sluggish / Pullback Support Zone</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'CYCLES' && (
            <div className="guide-section">
              <h3 style={{ color: '#fbbf24', fontSize: '1.2rem', marginBottom: '0.8rem' }}>Gann Time Cycles & Natural Dates</h3>
              <p>
                W.D. Gann famously said: <em>"Time is the most important element in forecasting."</em> When a time cycle expires, the market MUST change direction or accelerate.
              </p>

              <div className="guide-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                <div style={{ background: 'rgba(15, 23, 42, 0.8)', padding: '1rem', borderRadius: '8px' }}>
                  <h4 style={{ color: '#38bdf8', marginTop: 0 }}>Fixed Calendar Cycles</h4>
                  <ul style={{ paddingLeft: '1rem', margin: 0, fontSize: '0.85rem' }}>
                    <li><strong>30 Days / 45 Days</strong>: Short-term swing exhaustion.</li>
                    <li><strong>90 Days (1/4 Year)</strong>: Major seasonal pivot window.</li>
                    <li><strong>180 Days (1/2 Year)</strong>: Counter-trend reversal cycle.</li>
                    <li><strong>365 Days (1 Year / Solar Orbit)</strong>: Master Anniversary Pivot.</li>
                  </ul>
                </div>
                <div style={{ background: 'rgba(15, 23, 42, 0.8)', padding: '1rem', borderRadius: '8px' }}>
                  <h4 style={{ color: '#10b981', marginTop: 0 }}>Gann / Fibonacci Bar Counts</h4>
                  <ul style={{ paddingLeft: '1rem', margin: 0, fontSize: '0.85rem' }}>
                    <li><strong>7 / 9 / 13 / 21 Bars</strong>: Immediate reaction pivots.</li>
                    <li><strong>49 Bars (7 x 7)</strong>: The "Fatal Number" / Square of 7 Reversal.</li>
                    <li><strong>90 Bars / 144 Bars</strong>: Major institutional accumulation/distribution end.</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'SETUPS' && (
            <div className="guide-section">
              <h3 style={{ color: '#fbbf24', fontSize: '1.2rem', marginBottom: '0.8rem' }}>Terminal Setups & Trading Rules</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                <div style={{ background: 'rgba(16, 185, 129, 0.1)', borderLeft: '4px solid #10b981', padding: '0.8rem 1rem', borderRadius: '0 8px 8px 0' }}>
                  <h4 style={{ color: '#10b981', margin: '0 0 0.3rem 0' }}>1. Gann Second Square Breakout 📦</h4>
                  <p style={{ fontSize: '0.85rem', margin: 0 }}>
                    When a stock consolidates inside a Gann Box and breaks out above the top edge ($100\rightarrow\$200$), it enters the <strong>"Second Square"</strong> ($200\rightarrow\$300$). This triggers explosive momentum expansion.
                  </p>
                </div>
                
                <div style={{ background: 'rgba(56, 189, 248, 0.1)', borderLeft: '4px solid #38bdf8', padding: '0.8rem 1rem', borderRadius: '0 8px 8px 0' }}>
                  <h4 style={{ color: '#38bdf8', margin: '0 0 0.3rem 0' }}>2. 1x1 Master Angle Bounce 📐</h4>
                  <p style={{ fontSize: '0.85rem', margin: 0 }}>
                    A pull-back to the rising 1x1 Master Angle that finds support on low volume. This offers an A+ low-risk entry aligned with institutional trend velocity.
                  </p>
                </div>

                <div style={{ background: 'rgba(245, 158, 11, 0.1)', borderLeft: '4px solid #f59e0b', padding: '0.8rem 1rem', borderRadius: '0 8px 8px 0' }}>
                  <h4 style={{ color: '#f59e0b', margin: '0 0 0.3rem 0' }}>3. Square of 9 Confluence Reversal 🎯</h4>
                  <p style={{ fontSize: '0.85rem', margin: 0 }}>
                    Occurs when price touches a major Sq9 Cardinal Cross level (e.g. 180° or 360°) at the exact same time a Gann Time Cycle (e.g. 90 days) expires. High probability trend change!
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
