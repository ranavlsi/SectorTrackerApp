import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Landmark, TrendingUp, TrendingDown, ShieldAlert, CheckCircle2, 
  Zap, Search, RefreshCw, SlidersHorizontal, Layers, Info, 
  ChevronRight, X, ArrowUpRight, ArrowDownRight, Sparkles, Target, Compass,
  ZoomIn, ZoomOut, RotateCcw
} from 'lucide-react';
import './WyckoffScreener.css';

export default function WyckoffScreener() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [searchTicker, setSearchTicker] = useState('');
  const [selectedTf, setSelectedTf] = useState('180D'); // '90D' | '180D' | '1Y' | 'BASE'
  
  // Modal State for interactive deep chart inspection
  const [activeStock, setActiveStock] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);

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
      console.error("Wyckoff Screener fetch error:", err);
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
    setModalLoading(true);
    setActiveStock({ ticker: ticker.toUpperCase(), loading: true });
    try {
      const res = await fetch(`/api/wyckoff/stock_analysis?ticker=${ticker.toUpperCase()}`);
      if (!res.ok) throw new Error(`Could not fetch analysis for ${ticker}`);
      const json = await res.json();
      setActiveStock(json);
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

  // Filter stocks based on selected setup pill or phase
  const filteredStocks = useMemo(() => {
    if (!data || !data.stocks) return [];
    let list = data.stocks;
    if (selectedFilter !== 'all') {
      list = list.filter(s => {
        if (selectedFilter.startsWith('phase_')) {
          const targetLetter = selectedFilter.replace('phase_', '').toUpperCase();
          return s.phase_letter === targetLetter || (s.wyckoff_phase && s.wyckoff_phase.includes(`Phase ${targetLetter}`));
        }
        const pKey = s.primary_setup?.setup_key?.toLowerCase();
        const allKeys = (s.all_setups || []).map(x => x.setup_key?.toLowerCase());
        return pKey === selectedFilter || allKeys.includes(selectedFilter);
      });
    }
    return list;
  }, [data, selectedFilter]);

  const posture = data?.market_posture;

  return (
    <div className="wyckoff-container">
      {/* Hero Header */}
      <div className="wyckoff-hero">
        <div className="wyckoff-hero-top">
          <div className="wyckoff-title-area">
            <h1><Landmark size={28} /> Institutional Wyckoff Terminal</h1>
            <div className="wyckoff-subtitle">
              <span>Composite Operator Footprint Surveillance</span>
              <span>•</span>
              <span>Richard Wyckoff's Three Laws & Multi-Phase Schematics</span>
            </div>
          </div>
          <button 
            className="wyckoff-refresh-btn" 
            onClick={() => loadSummary(true)} 
            disabled={loading || refreshing}
          >
            <RefreshCw size={15} className={refreshing ? "spin-animation" : ""} />
            {refreshing ? "Scanning Lakehouse..." : "Rescan Market"}
          </button>
        </div>

        {/* Market Posture Matrix */}
        {posture && (
          <div className="posture-matrix">
            <div className="posture-breadth-left">
              <div className="posture-label-row">
                <span style={{ color: '#10b981' }}>Accumulation Breadth: {posture.accumulation_pct}%</span>
                <span style={{ color: '#f43f5e' }}>Distribution: {posture.distribution_pct}%</span>
              </div>
              <div className="breadth-meter-track">
                <div className="breadth-fill-acc" style={{ width: `${posture.accumulation_pct}%` }} />
                <div className="breadth-fill-dist" style={{ width: `${posture.distribution_pct}%` }} />
              </div>
              <div style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 600, marginTop: '4px' }}>
                Regime: <span style={{ color: posture.badge === 'BULLISH_ACCUMULATION' ? '#10b981' : posture.badge === 'BEARISH_DISTRIBUTION' ? '#f43f5e' : '#38bdf8' }}>
                  {posture.text}
                </span>
              </div>
            </div>

            <div className="posture-stat-chips">
              <div className="stat-chip phase-c">🌱 Phase C (Tests): {posture.phase_c_count || posture.spring_count}</div>
              <div className="stat-chip phase-d">🚀 Phase D (Markup): {posture.phase_d_count || posture.sos_count}</div>
              <div className="stat-chip phase-e">⚡ Phase E (Trend): {posture.phase_e_count || 0}</div>
              <div className="stat-chip phase-a">⚓ Phase A (Stopping): {posture.phase_a_count || 0}</div>
              <div className="stat-chip phase-b">🏛️ Phase B (Cause): {posture.phase_b_count || 0}</div>
              <div className="stat-chip utad">⚠️ Distribution Traps: {(posture.utad_count || 0) + (posture.sow_count || 0)}</div>
            </div>
          </div>
        )}
      </div>

      {/* Controls Bar: Filter Pills + Direct Search */}
      <div className="wyckoff-controls-bar">
        <div className="filter-pills-group">
          <button 
            className={`filter-pill ${selectedFilter === 'all' ? 'active' : ''}`}
            onClick={() => setSelectedFilter('all')}
          >
            All Stocks ({data?.stocks?.length || 0})
          </button>
          <button 
            className={`filter-pill phase-c-pill ${selectedFilter === 'phase_c' ? 'active phase-c-pill' : ''}`}
            onClick={() => setSelectedFilter('phase_c')}
            title="Phase C: The Definitive Test (Springs, Shakeouts & LPS Higher-Lows)"
          >
            🌱 Phase C: The Test ({posture?.phase_c_count || 0})
          </button>
          <button 
            className={`filter-pill phase-d-pill ${selectedFilter === 'phase_d' ? 'active phase-d-pill' : ''}`}
            onClick={() => setSelectedFilter('phase_d')}
            title="Phase D: Transition to Markup inside TR (SOS Breakouts & Back-Up LPS)"
          >
            🚀 Phase D: Markup In Range ({posture?.phase_d_count || 0})
          </button>
          <button 
            className={`filter-pill phase-e-pill ${selectedFilter === 'phase_e' ? 'active phase-e-pill' : ''}`}
            onClick={() => setSelectedFilter('phase_e')}
            title="Phase E: Unfolded Runaway Markup outside the base"
          >
            ⚡ Phase E: Runaway Trend ({posture?.phase_e_count || 0})
          </button>
          <button 
            className={`filter-pill phase-a-pill ${selectedFilter === 'phase_a' ? 'active phase-a-pill' : ''}`}
            onClick={() => setSelectedFilter('phase_a')}
            title="Phase A: Stopping Action (SC, AR, and Secondary Tests)"
          >
            ⚓ Phase A: Stopping ({posture?.phase_a_count || 0})
          </button>
          <button 
            className={`filter-pill phase-b-pill ${selectedFilter === 'phase_b' ? 'active phase-b-pill' : ''}`}
            onClick={() => setSelectedFilter('phase_b')}
            title="Phase B: Horizontal Cause Building & Supply Absorption"
          >
            🏛️ Phase B: Cause ({posture?.phase_b_count || 0})
          </button>
          <button 
            className={`filter-pill spring ${selectedFilter === 'spring' ? 'active spring' : ''}`}
            onClick={() => setSelectedFilter('spring')}
          >
            Springs
          </button>
          <button 
            className={`filter-pill sos ${selectedFilter === 'sos' ? 'active sos' : ''}`}
            onClick={() => setSelectedFilter('sos')}
          >
            SOS Breakouts
          </button>
          <button 
            className={`filter-pill lps ${selectedFilter === 'lps' ? 'active lps' : ''}`}
            onClick={() => setSelectedFilter('lps')}
            title="Phase D: Back-Up to Creek / Last Point of Support (BUEC / LPS)"
          >
            BUEC / LPS
          </button>
          <button 
            className={`filter-pill utad ${selectedFilter === 'utad' ? 'active utad' : ''}`}
            onClick={() => setSelectedFilter('utad')}
          >
            ⚠️ UTAD / SOW
          </button>
        </div>

        {/* Direct Search Form */}
        <form className="wyckoff-search-form" onSubmit={handleDirectSearch}>
          <input 
            type="text" 
            placeholder="Check any ticker (e.g. NVDA)..."
            value={searchTicker}
            onChange={(e) => setSearchTicker(e.target.value)}
            className="wyckoff-search-input"
          />
          <button type="submit" className="wyckoff-search-btn">
            <Zap size={14} /> Check Stock
          </button>
        </form>
      </div>

      {/* Main Screener Table */}
      <div className="wyckoff-table-wrapper">
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
            <RefreshCw size={24} className="spin-animation" style={{ margin: '0 auto 10px auto' }} />
            <div>Loading institutional Wyckoff footprints...</div>
          </div>
        ) : error ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#f43f5e' }}>
            Error: {error}
          </div>
        ) : filteredStocks.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
            No stocks found matching the "{selectedFilter}" Wyckoff filter.
          </div>
        ) : (
          <table className="wyckoff-table">
            <thead>
              <tr>
                <th>Ticker</th>
                <th>Wyckoff Setup</th>
                <th>Phase</th>
                <th>Wyckoff Score</th>
                <th>Trading Range Bounds</th>
                <th>Cause Duration (Base)</th>
                <th>VSA Effort & RVOL</th>
                <th>Risk / Reward</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredStocks.map((stock) => {
                const s = stock.primary_setup || {};
                const tr = stock.trading_range || {};
                const isBull = s.direction === 'BULLISH';
                const isBear = s.direction === 'BEARISH';
                const badgeClass = s.setup_key || 'base_acc';
                const score = stock.wyckoff_score || 50;

                // Range position slider clamp (0 to 100%)
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
        )}
      </div>

      {/* Wyckoff Interactive Schematic Modal */}
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
              <button className="modal-close-btn" onClick={() => setActiveStock(null)}>
                <X size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="wyckoff-modal-body">
              {activeStock.loading ? (
                <div style={{ padding: '4rem', textAlign: 'center', color: '#94a3b8' }}>
                  <RefreshCw size={28} className="spin-animation" style={{ margin: '0 auto 12px auto' }} />
                  <div>Synthesizing Wyckoff Schematic & The Creek / The Ice Collars...</div>
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
                            <div 
                              key={p.id} 
                              className={`phase-step-item ${stepClass}`}
                            >
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
                          <strong>{activeStock.phase_progression?.schematic_name || `${selectedTf === '90D' ? '90-Day (3M)' : selectedTf === '180D' ? '180-Day (6M)' : selectedTf === '1Y' ? '1-Year (252D)' : 'Full Base & Anchor'} Wyckoff Schematic`}</strong> with Automated Collar Bands
                        </span>
                        {/* Interactive Timeframe Toggle Buttons */}
                        <div className="tf-btn-group">
                          <button 
                            className={`tf-btn ${selectedTf === '90D' ? 'active' : ''}`}
                            onClick={() => setSelectedTf('90D')}
                            title="Zoom to last 90 trading sessions (3 months)"
                          >
                            90D (3M)
                          </button>
                          <button 
                            className={`tf-btn ${selectedTf === '180D' ? 'active' : ''}`}
                            onClick={() => setSelectedTf('180D')}
                            title="Zoom to last 180 trading sessions (6 months)"
                          >
                            180D (6M)
                          </button>
                          <button 
                            className={`tf-btn ${selectedTf === '1Y' ? 'active' : ''}`}
                            onClick={() => setSelectedTf('1Y')}
                            title="Zoom out to full 1-year macro context (252 sessions)"
                          >
                            1 Year (252D)
                          </button>
                          <button 
                            className={`tf-btn ${selectedTf === 'BASE' ? 'active' : ''}`}
                            onClick={() => setSelectedTf('BASE')}
                            title="Frame exactly from the onset of the current consolidation base"
                          >
                            🎯 Full Base View
                          </button>
                        </div>
                      </div>

                      <div className="chart-legend">
                        <div className="legend-item">
                          <span className="legend-line" style={{ background: activeStock.setup_result?.primary_setup?.direction === 'BEARISH' ? '#f59e0b' : '#10b981' }} />
                          <span style={{ color: activeStock.setup_result?.primary_setup?.direction === 'BEARISH' ? '#f59e0b' : '#10b981' }}>
                            {activeStock.cause_and_effect?.upper_collar_name || activeStock.setup_result?.trading_range?.upper_collar_name || 'The Creek'} (${activeStock.setup_result?.trading_range?.creek?.toFixed(2)})
                          </span>
                        </div>
                        <div className="legend-item">
                          <span className="legend-line" style={{ background: '#f43f5e' }} />
                          <span style={{ color: '#f43f5e' }}>
                            {activeStock.cause_and_effect?.lower_collar_name || activeStock.setup_result?.trading_range?.lower_collar_name || 'The Ice'} (${activeStock.setup_result?.trading_range?.ice?.toFixed(2)})
                          </span>
                        </div>
                        <div className="legend-item">
                          <span className="legend-line" style={{ background: '#64748b', borderTop: '1px dashed #94a3b8' }} />
                          <span style={{ color: '#94a3b8' }}>Equilibrium (${activeStock.setup_result?.trading_range?.mid?.toFixed(2)})</span>
                        </div>
                      </div>
                    </div>

                    {/* High Performance SVG Chart */}
                    <div className="svg-chart-wrapper">
                      <WyckoffSvgChart 
                        chartData={activeStock.chart_data} 
                        timeframe={selectedTf} 
                        baseBars={activeStock.setup_result?.trading_range?.cause_bars}
                        upperCollarName={activeStock.cause_and_effect?.upper_collar_name || activeStock.setup_result?.trading_range?.upper_collar_name || 'The Creek'}
                        lowerCollarName={activeStock.cause_and_effect?.lower_collar_name || activeStock.setup_result?.trading_range?.lower_collar_name || 'The Ice'}
                        isDistribution={activeStock.setup_result?.primary_setup?.direction === 'BEARISH'}
                      />
                    </div>
                  </div>

                  {/* Richard Wyckoff's Three Fundamental Laws */}
                  <div className="three-laws-grid">
                    {/* Law 1: Supply & Demand */}
                    <div className="law-card">
                      <div className="law-title"><Sparkles size={14} /> 1. Law of Supply & Demand</div>
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
                            <Target size={14} /> 2. Law of Cause & Effect ({isMarkdown ? 'P&F Markdown Objectives' : isPhaseB ? 'Dual-Potential P&F Projections' : 'P&F Markup Projections'})
                          </div>
                          <div className="law-metric" style={{ color: metricColor }}>
                            {isMarkdown ? 'Markdown Target: ' : isPhaseB ? 'Intra-Range Target: ' : 'Base Markup Target: '}
                            ${targetPrice?.toFixed(2)}
                            <span style={{ fontSize: '0.85rem', color: metricColor, marginLeft: '6px' }}>
                              ({gainPrefix}{targetGain}%)
                            </span>
                          </div>

                          {/* Multi-Tier Targets Strip */}
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
                            {isMarkdown ? (
                              <>Built <strong>{activeStock.cause_and_effect?.cause_duration_bars} bars</strong> ({activeStock.cause_and_effect?.cause_duration_days} calendar days) of distribution cause since {activeStock.cause_and_effect?.cause_start_date}. Point & Figure count projects multi-tier markdown targets down to {activeStock.cause_and_effect?.multi_tier_targets?.t2?.gain_pct || targetGain}%. Floating supply dominates as smart money distributes inventory.</>
                            ) : isPhaseB ? (
                              <>Built <strong>{activeStock.cause_and_effect?.cause_duration_bars} bars</strong> ({activeStock.cause_and_effect?.cause_duration_days} calendar days) of cause in Phase B since {activeStock.cause_and_effect?.cause_start_date}. Tactical intra-range execution active; secular P&F target (${targetPrice?.toFixed(2)}, {gainPrefix}{targetGain}%) activates upon confirmed Phase D breakout above the Creek.</>
                            ) : (
                              <>Built <strong>{activeStock.cause_and_effect?.cause_duration_bars} bars</strong> ({activeStock.cause_and_effect?.cause_duration_days} calendar days) of base cause since {activeStock.cause_and_effect?.cause_start_date}. Point & Figure horizontal box count projects multi-tier markup objectives up to +{activeStock.cause_and_effect?.multi_tier_targets?.t3?.gain_pct || targetGain}%.</>
                            )}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Law 3: Effort vs. Result */}
                    <div className="law-card">
                      <div className="law-title"><SlidersHorizontal size={14} /> 3. Effort vs. Result & Weis Wave</div>
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
                          <span className="law-sub-badge" style={{ 
                            background: activeStock.weis_wave.wave_dir === 'DEMAND' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                            color: activeStock.weis_wave.wave_dir === 'DEMAND' ? '#34d399' : '#fb7185'
                          }}>
                            🌊 Weis {activeStock.weis_wave.wave_dir}: {activeStock.weis_wave.wave_vol_m}M ({activeStock.weis_wave.ratio}x)
                          </span>
                        )}
                      </div>
                      <div className="law-desc">
                        {activeStock.setup_result?.effort_result_bias}. {activeStock.weis_wave?.status ? `Weis Wave footprint: ${activeStock.weis_wave.status}.` : activeStock.cause_and_effect?.vdu_index < 0.8 ? "Volume dry-up confirms absence of floating seller supply." : "Active institutional turnover detected."}
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
                            <span className="cell-label">Macro P&F Target</span>
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
// SVG Candlestick + Volume Chart with Creek/Ice Reference Collars & Event Markers
// ---------------------------------------------------------------------------------
function WyckoffSvgChart({ chartData, timeframe = '180D', baseBars = 45, upperCollarName = 'The Creek', lowerCollarName = 'The Ice', isDistribution = false }) {
  const [hoverBar, setHoverBar] = useState(null);
  const [volMode, setVolMode] = useState('RVOL'); // 'RVOL' or 'WEIS'
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

  const allCandles = chartData.candles;
  const allMarkers = chartData.markers || [];

  const [sliderPos, setSliderPos] = useState(100);
  const [zoomLevel, setZoomLevel] = useState(1.0); // 1.0 = standard, > 1.0 = zoomed in, < 1.0 = zoomed out

  // Reset slider & zoom to live/recent on timeframe change
  useEffect(() => {
    setSliderPos(100);
    setZoomLevel(1.0);
  }, [timeframe]);

  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(3.5, Number((prev * 1.3).toFixed(2))));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(0.4, Number((prev / 1.3).toFixed(2))));
  };

  const handleResetZoom = () => {
    setZoomLevel(1.0);
    setSliderPos(100);
  };

  // Enable mouse wheel / trackpad pinch zoom on chart canvas
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        if (e.deltaY < 0) {
          setZoomLevel(prev => Math.min(3.5, Number((prev * 1.12).toFixed(2))));
        } else {
          setZoomLevel(prev => Math.max(0.4, Number((prev / 1.12).toFixed(2))));
        }
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
    else if (timeframe === 'BASE') {
      base = Math.max(35, (baseBars || 40) + 20);
    }
    const scaled = Math.round(base / zoomLevel);
    return Math.max(15, Math.min(allCandles.length, scaled));
  }, [allCandles, timeframe, baseBars, zoomLevel]);

  const maxOffset = Math.max(0, allCandles.length - windowSize);
  const offset = Math.round((sliderPos / 100) * maxOffset);

  // Dynamically slice candles based on user-selected timeframe & slider position
  const candles = useMemo(() => {
    return allCandles.slice(offset, offset + windowSize);
  }, [allCandles, offset, windowSize]);

  // Dynamically remap markers to the sliced candle array
  const markers = useMemo(() => {
    const visibleMarkers = [];
    allMarkers.forEach(m => {
      const idx = candles.findIndex(c => c.date === m.date);
      if (idx !== -1) {
        visibleMarkers.push({ ...m, sliceIndex: idx });
      }
    });
    return visibleMarkers;
  }, [allMarkers, candles]);

  const creek = chartData.creek;
  const ice = chartData.ice;
  const mid = chartData.mid;

  const height = 370;
  const priceHeight = 270;
  const volHeight = 70;
  const gap = 15;
  const padTop = 28;
  const padRight = 75;
  const padLeft = 10;
  const drawWidth = width - padLeft - padRight;

  const allHighs = candles.map(c => c.high);
  const allLows = candles.map(c => c.low);
  const minP = Math.min(...allLows, ice * 0.985);
  const maxP = Math.max(...allHighs, creek * 1.02) * 1.025;
  const pSpan = (maxP - minP) || 1.0;

  const maxRvolVol = Math.max(...candles.map(c => c.volume), 1000);
  const maxWeisVol = Math.max(...candles.map(c => c.weis_wave_vol || c.volume), 1000);
  const maxVol = volMode === 'WEIS' ? maxWeisVol : maxRvolVol;

  const getY = (price) => {
    return padTop + priceHeight - ((price - minP) / pSpan) * priceHeight;
  };

  const getVolY = (vol) => {
    const volTop = padTop + priceHeight + gap;
    return volTop + volHeight - (vol / maxVol) * volHeight;
  };

  const barWidth = Math.max(2, Math.min(10, (drawWidth / candles.length) * 0.65));
  const step = drawWidth / candles.length;

  const creekY = getY(creek);
  const iceY = getY(ice);
  const midY = getY(mid);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      {/* Chart Control Toolbar: Zoom In/Out/Reset + Volume Mode Toggle */}
      <div style={{ position: 'absolute', left: '14px', top: '10px', zIndex: 10, display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div className="zoom-btn-group">
          <button 
            className="zoom-btn" 
            onClick={handleZoomIn} 
            title="Zoom In (+): Fewer bars, detailed candle inspection"
          >
            <ZoomIn size={13} />
          </button>
          <span className="zoom-level-badge" title="Current Zoom Level">
            {Math.round(zoomLevel * 100)}%
          </span>
          <button 
            className="zoom-btn" 
            onClick={handleZoomOut} 
            title="Zoom Out (-): More bars, macro context"
          >
            <ZoomOut size={13} />
          </button>
          <button 
            className="zoom-btn" 
            onClick={handleResetZoom} 
            title="Reset Zoom (100% LIVE)"
          >
            <RotateCcw size={12} />
          </button>
        </div>

        <div className="vol-toggle-group">
          <button 
            className={`vol-toggle-btn ${volMode === 'RVOL' ? 'active' : ''}`}
            onClick={() => setVolMode('RVOL')}
            title="Standard Volume with RVOL spike / dry-up color coding"
          >
            📊 Daily RVOL
          </button>
          <button 
            className={`vol-toggle-btn ${volMode === 'WEIS' ? 'active' : ''}`}
            onClick={() => setVolMode('WEIS')}
            title="David Weis Wave Cumulative Volume (CVD) swings"
          >
            🌊 Weis Wave
          </button>
        </div>
      </div>

      <svg width={width} height={height} style={{ overflow: 'visible' }}>
        {/* Background Grid Lines */}
        <line x1={padLeft} y1={creekY} x2={padLeft + drawWidth} y2={creekY} stroke={isDistribution ? "#f59e0b" : "#10b981"} strokeWidth="1.5" strokeDasharray="5,4" opacity="0.85" />
        <text x={padLeft + drawWidth + 6} y={creekY + 4} fill={isDistribution ? "#f59e0b" : "#10b981"} fontSize="11" fontWeight="700">{upperCollarName} (${creek.toFixed(2)})</text>

        <line x1={padLeft} y1={iceY} x2={padLeft + drawWidth} y2={iceY} stroke="#f43f5e" strokeWidth="1.5" strokeDasharray="5,4" opacity="0.85" />
        <text x={padLeft + drawWidth + 6} y={iceY + 4} fill="#f43f5e" fontSize="11" fontWeight="700">{lowerCollarName} (${ice.toFixed(2)})</text>

        <line x1={padLeft} y1={midY} x2={padLeft + drawWidth} y2={midY} stroke="#64748b" strokeWidth="1" strokeDasharray="3,3" opacity="0.5" />
        <text x={padLeft + drawWidth + 6} y={midY + 4} fill="#64748b" fontSize="10">Mid (${mid.toFixed(2)})</text>

        {/* Trading Range Shading */}
        <rect 
          x={padLeft} 
          y={creekY} 
          width={drawWidth} 
          height={Math.max(1, iceY - creekY)} 
          fill="rgba(56, 189, 248, 0.03)" 
        />

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
              <line x1={x} y1={highY} x2={x} y2={lowY} stroke={candleColor} strokeWidth="1.2" />
              <rect 
                x={x - barWidth / 2} 
                y={candleTop} 
                width={barWidth} 
                height={candleH} 
                fill={candleColor}
                rx="1"
              />
              <rect 
                x={x - barWidth / 2} 
                y={volTop} 
                width={barWidth} 
                height={volBarH} 
                fill={volColor}
                rx="1"
              />
            </g>
          );
        })}

        {/* Labeled Wyckoff Event Markers */}
        {markers.map((m, idx) => {
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
              <rect 
                x={x - labelWidth / 2} 
                y={isAbove ? pinY - 14 : pinY - 3} 
                width={labelWidth} 
                height="16" 
                fill="#0f172a" 
                stroke={m.color} 
                strokeWidth="1.5" 
                rx="4" 
              />
              <text 
                x={x} 
                y={isAbove ? pinY - 3 : pinY + 9} 
                fill={m.color} 
                fontSize="8" 
                fontWeight="800" 
                textAnchor="middle"
              >
                [{labelText}]
              </text>
            </g>
          );
        })}
      </svg>

      {/* Horizontal Viewport Pan Slider (Left ↔ Right) */}
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
            title="Slide chart from left to right or right to left"
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
      </div>

      {/* Floating Hover Tooltip */}
      {hoverBar && (
        <div style={{
          position: 'absolute',
          left: Math.min(hoverBar.x + 10, width - 210),
          top: 10,
          background: 'rgba(15, 23, 42, 0.95)',
          border: '1px solid #38bdf8',
          borderRadius: '6px',
          padding: '8px 12px',
          fontSize: '0.75rem',
          color: '#f8fafc',
          pointerEvents: 'none',
          boxShadow: '0 8px 20px rgba(0,0,0,0.6)',
          zIndex: 50
        }}>
          <div><strong>{hoverBar.candle.date}</strong></div>
          <div>Open: ${hoverBar.candle.open.toFixed(2)} | Close: ${hoverBar.candle.close.toFixed(2)}</div>
          <div>High: ${hoverBar.candle.high.toFixed(2)} | Low: ${hoverBar.candle.low.toFixed(2)}</div>
          {hoverBar.volMode === 'WEIS' ? (
            <div>Weis Wave Vol: <span style={{ color: hoverBar.candle.weis_wave_dir === 1 ? '#10b981' : '#f43f5e', fontWeight: 700 }}>{(hoverBar.candle.weis_wave_vol / 1e6).toFixed(1)}M ({hoverBar.candle.weis_wave_dir === 1 ? 'Demand' : 'Supply'})</span></div>
          ) : (
            <div>RVOL: <span style={{ color: '#38bdf8', fontWeight: 700 }}>{hoverBar.candle.rvol}x</span> ({(hoverBar.candle.volume / 1e6).toFixed(1)}M)</div>
          )}
          <div style={{ color: '#94a3b8', marginTop: '2px' }}>{hoverBar.candle.vsa_class}</div>
        </div>
      )}
    </div>
  );
}
