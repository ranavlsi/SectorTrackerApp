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
          <button 
            className="gann-refresh-btn" 
            onClick={() => loadSummary(true)} 
            disabled={loading || refreshing}
          >
            <RefreshCw size={15} className={refreshing ? "spin-animation" : ""} />
            {refreshing ? "Recalculating Mathematical Spheres..." : "Rescan Gann Universe"}
          </button>
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
                <Grid size={15} /> Square of 9 Numerical Spiral Matrix (81 Cells)
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
                /* Square of 9 Spiral Matrix Grid View */
                <div className="sq9-matrix-full-view">
                  <div className="sq9-matrix-header-card">
                    <div className="matrix-card-left">
                      <h3><Grid size={18} color="#fbbf24" /> Authentic Square of 9 Numerical Spiral Matrix</h3>
                      <p>
                        Concentric 81-cell matrix radiating from anchor (${activeStock.anchors?.primary_anchor?.anchor_price}).
                        Gold cells define the <strong>Cardinal Cross</strong> (0°, 90°, 180°, 270° axes). Cyan cells define the <strong>Fixed Cross</strong> (45°, 135°, 225°, 315° diagonals).
                      </p>
                    </div>
                    {selectedMatrixCell && (
                      <div className="matrix-selected-cell-pill">
                        <span>Selected Cell #{selectedMatrixCell.num}</span>
                        <strong>${selectedMatrixCell.price?.toFixed(2)}</strong>
                        <span style={{ color: selectedMatrixCell.is_cardinal ? '#fbbf24' : selectedMatrixCell.is_fixed ? '#38bdf8' : '#cbd5e1' }}>
                          {selectedMatrixCell.axis_name || `Ring #${selectedMatrixCell.ring} (${selectedMatrixCell.degrees}°)`}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="sq9-matrix-table-container">
                    <div className="sq9-matrix-grid">
                      {(activeStock.square_of_9?.matrix_grid?.cells || []).map((c, i) => {
                        const isSelected = selectedMatrixCell && selectedMatrixCell.row === c.row && selectedMatrixCell.col === c.col;
                        const isCenter = c.row === 4 && c.col === 4;
                        const isCurrentActive = activeStock.square_of_9?.matrix_grid?.active_cell?.row === c.row && activeStock.square_of_9?.matrix_grid?.active_cell?.col === c.col;

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
                            {isCurrentActive && <div className="current-indicator">PRICE HERE</div>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
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
// Square of 9 Circular Aspect Wheel Widget (Celestial Dial)
// ---------------------------------------------------------------------------------
function SquareOf9WheelWidget({ degree = 0, ring = 1 }) {
  const size = 180;
  const center = size / 2;
  const radius = center - 18;

  const rad = ((degree - 90) * Math.PI) / 180.0;
  const markerX = center + radius * Math.cos(rad);
  const markerY = center + radius * Math.sin(rad);

  const cardinalAngles = [0, 90, 180, 270];
  const fixedAngles = [45, 135, 225, 315];

  return (
    <div className="sq9-wheel-container">
      <svg width={size} height={size} className="sq9-wheel-svg">
        <circle cx={center} cy={center} r={radius} fill="none" stroke="rgba(255, 255, 255, 0.1)" strokeWidth="2" />
        <circle cx={center} cy={center} r={radius * 0.65} fill="none" stroke="rgba(255, 255, 255, 0.05)" strokeDasharray="2,2" />
        <circle cx={center} cy={center} r={radius * 0.35} fill="none" stroke="rgba(255, 255, 255, 0.05)" strokeDasharray="2,2" />

        {fixedAngles.map(a => {
          const r = ((a - 90) * Math.PI) / 180.0;
          const x2 = center + radius * Math.cos(r);
          const y2 = center + radius * Math.sin(r);
          return (
            <line key={a} x1={center} y1={center} x2={x2} y2={y2} stroke="rgba(56, 189, 248, 0.3)" strokeWidth="1" strokeDasharray="3,3" />
          );
        })}

        {cardinalAngles.map(a => {
          const r = ((a - 90) * Math.PI) / 180.0;
          const x2 = center + radius * Math.cos(r);
          const y2 = center + radius * Math.sin(r);
          return (
            <line key={a} x1={center} y1={center} x2={x2} y2={y2} stroke="rgba(251, 191, 36, 0.5)" strokeWidth="1.5" />
          );
        })}

        <text x={center} y={12} fill="#fbbf24" fontSize="9" fontWeight="800" textAnchor="middle">0° (N)</text>
        <text x={size - 8} y={center + 3} fill="#10b981" fontSize="9" fontWeight="800" textAnchor="middle">90°</text>
        <text x={center} y={size - 4} fill="#f43f5e" fontSize="9" fontWeight="800" textAnchor="middle">180°</text>
        <text x={12} y={center + 3} fill="#10b981" fontSize="9" fontWeight="800" textAnchor="middle">270°</text>

        <line x1={center} y1={center} x2={markerX} y2={markerY} stroke="#38bdf8" strokeWidth="2" />
        <circle cx={markerX} cy={markerY} r={5} fill="#38bdf8" stroke="#0f172a" strokeWidth={1.5} />
        <circle cx={center} cy={center} r={4} fill="#fbbf24" />
      </svg>
      <div className="sq9-wheel-legend">
        <span style={{ color: '#38bdf8', fontWeight: 800 }}>{degree.toFixed(1)}° Position</span>
        <span style={{ color: '#94a3b8', fontSize: '0.72rem' }}>Spiral Ring #{ring}</span>
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
