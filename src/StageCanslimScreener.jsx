import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Flame, TrendingUp, TrendingDown, ShieldCheck, ShieldAlert, CheckCircle2, 
  Zap, Search, RefreshCw, Layers, Info, ChevronRight, X, ArrowUpRight, 
  ArrowDownRight, Sparkles, Target, Activity, Calendar, BarChart2, Award, 
  Crosshair, Clock, AlertTriangle, Compass, Check, AlertCircle, Percent, Copy, ExternalLink
} from 'lucide-react';
import './StageCanslimScreener.css';

// 12 Sub-Stages Definitions for the Visual Lifecycle Curve
const SUB_STAGES_LIST = [
  { id: '1A', name: 'Selling Climax', stage: 'Stage 1', phase: 'Basing', desc: 'Markdown decelerating, severe oversold climax bottoming.', color: '#a855f7' },
  { id: '1B', name: 'Neutral Base', stage: 'Stage 1', phase: 'Basing', desc: '30-week MA flattens. Tight consolidation, supply absorption.', color: '#8b5cf6' },
  { id: '1C', name: 'VCP Pre-Breakout', stage: 'Stage 1', phase: 'Basing', desc: 'Volatility coils near ceiling, volume dries up, RS curls to 0.', color: '#6366f1' },
  { id: '2A', name: 'Breakout Ignition', stage: 'Stage 2', phase: 'Advancing', desc: 'Explosive breakout above base on +100% volume. CANSLIM Sweet Spot!', color: '#10b981' },
  { id: '2B', name: '10w MA Reload', stage: 'Stage 2', phase: 'Advancing', desc: 'First low-volume orderly test of 10-week MA. High R/R add point.', color: '#34d399' },
  { id: '2C', name: 'Mature Compounder', stage: 'Stage 2', phase: 'Advancing', desc: 'Bases 2 & 3. Price riding above rising 10w & 30w MAs with high RS.', color: '#059669' },
  { id: '2D', name: 'Extended Climax', stage: 'Stage 2', phase: 'Advancing', desc: 'Base 4/5. Extended >25% above 10w MA. Late-stage climax risk.', color: '#f59e0b' },
  { id: '3A', name: 'Top Churning', stage: 'Stage 3', phase: 'Topping', desc: 'Heavy volume without upside progress. 30w MA begins flattening.', color: '#ec4899' },
  { id: '3B', name: 'Upthrust Trap', stage: 'Stage 3', phase: 'Topping', desc: 'Marginal new high fails swiftly on heavy volume. Retail trap.', color: '#e11d48' },
  { id: '3C', name: 'Breakdown Threat', stage: 'Stage 3', phase: 'Topping', desc: 'Repeated support tests. 30w MA rolls over downward.', color: '#f43f5e' },
  { id: '4A', name: 'Breakdown Ignition', stage: 'Stage 4', phase: 'Declining', desc: 'Decisive break below distribution neckline. Sinking RS.', color: '#b91c1c' },
  { id: '4B', name: 'Bear Snapback', stage: 'Stage 4', phase: 'Declining', desc: 'Low-volume counter-trend bounce into declining 30w MA.', color: '#ef4444' },
  { id: '4C', name: 'Capitulation Cascade', stage: 'Stage 4', phase: 'Declining', desc: 'Persistent lower highs & lows below declining MAs. Strict avoid.', color: '#dc2626' }
];

export default function StageCanslimScreener() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [selectedFilter, setSelectedFilter] = useState('ALL');
  const [searchTicker, setSearchTicker] = useState('');

  // Modal State
  const [activeStock, setActiveStock] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalTab, setModalTab] = useState('CHART'); // 'CHART' | 'LIFECYCLE' | 'PLAYBOOK'
  const [hoveredBar, setHoveredBar] = useState(null);
  const [copiedTicket, setCopiedTicket] = useState(false);

  // Fetch summary on load
  const loadData = async (force = false) => {
    if (force) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/stage_canslim/screener?force=${force ? 'true' : 'false'}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to load Stage+CANSLIM screener`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error("Stage+CANSLIM Screener error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData(false);
  }, []);

  // Open modal for detailed single stock analysis
  const openStockModal = async (ticker) => {
    if (!ticker) return;
    setModalLoading(true);
    setModalTab('CHART');
    setHoveredBar(null);
    setCopiedTicket(false);
    setActiveStock({ ticker: ticker.toUpperCase(), loading: true });
    try {
      const res = await fetch(`/api/stage_canslim/stock_analysis?ticker=${ticker.toUpperCase()}`);
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

  // Filter stocks
  const filteredStocks = useMemo(() => {
    if (!data || !data.stocks) return [];
    let list = data.stocks;
    if (selectedFilter === 'STAGE_2A') {
      return list.filter(s => s.stage_info?.sub_stage === '2A');
    }
    if (selectedFilter === 'STAGE_2B') {
      return list.filter(s => s.stage_info?.sub_stage === '2B');
    }
    if (selectedFilter === 'VCP_COILS') {
      return list.filter(s => s.vcp_info?.is_vcp);
    }
    if (selectedFilter === 'POCKET_PIVOTS') {
      return list.filter(s => s.pp_info?.has_recent_pocket_pivot);
    }
    if (selectedFilter === 'RS_AHEAD') {
      return list.filter(s => s.rs_alpha?.rs_new_high_ahead);
    }
    if (selectedFilter === 'CANSLIM_A') {
      return list.filter(s => ['A+', 'A'].includes(s.canslim_info?.canslim_grade));
    }
    if (selectedFilter === 'IN_BUY_ZONE') {
      return list.filter(s => s.playbook?.in_buy_zone);
    }
    if (selectedFilter === 'CLIMAX_RISK') {
      return list.filter(s => s.climax_info?.is_climax_risk || s.stage_info?.sub_stage === '2D');
    }
    if (selectedFilter === 'DEFENSIVE') {
      return list.filter(s => s.stage_info?.sub_stage?.startsWith('3') || s.stage_info?.sub_stage?.startsWith('4'));
    }
    return list;
  }, [data, selectedFilter]);

  const distribution = data?.stage_distribution || {};
  const alphas = data?.alpha_counts || {};

  const handleCopyOrderTicket = () => {
    if (!activeStock || !activeStock.playbook) return;
    const pb = activeStock.playbook;
    const ticketText = `=== O'NEIL EXECUTION TICKET: ${activeStock.ticker} ===
Current Price: $${pb.current_price}
Pivot Buy Point: $${pb.pivot_buy_point}
5% Buy Zone: $${pb.buy_zone_min} - $${pb.buy_zone_max}
Stop Loss: $${pb.stop_loss_price} (${pb.stop_loss_pct})
Target 1 (+22%): $${pb.profit_target_1}
Target 2 (+35%): $${pb.profit_target_2}
Scale-In Execution Plan:
  Tier 1 (50%): ${pb.scale_in_ticket?.tier_1?.action}
  Tier 2 (30%): ${pb.scale_in_ticket?.tier_2?.action}
  Tier 3 (20%): ${pb.scale_in_ticket?.tier_3?.action}
Risk Allocation: ${pb.position_sizing?.allocated_capital} (1% max risk basis)`;
    navigator.clipboard.writeText(ticketText);
    setCopiedTicket(true);
    setTimeout(() => setCopiedTicket(false), 2500);
  };

  return (
    <div className="stage-canslim-container">
      {/* Hero Header */}
      <div className="sc-hero">
        <div className="sc-hero-top">
          <div className="sc-title-area">
            <h1>
              <Flame size={32} className="sc-flame-icon" /> 
              Stan Weinstein Stage Analysis & CANSLIM Super-Terminal v2.0 🚀
            </h1>
            <p className="sc-subtitle">
              Granular 12-Sub-Stage Quantitative Classifier (1A to 4C) • VCP Multi-Wave Contractions • Institutional Pocket Pivots • Mansfield RS vs SPY • O'Neil 3-Tier Scale-In Execution Ticket
            </p>
          </div>
          <div className="sc-hero-actions">
            <button 
              className="sc-refresh-btn" 
              onClick={() => loadData(true)} 
              disabled={refreshing}
            >
              <RefreshCw size={16} className={refreshing ? 'sc-spin' : ''} />
              {refreshing ? 'Scanning Universe...' : 'Refresh Screener'}
            </button>
          </div>
        </div>

        {/* Market Stage Breadth Bar */}
        <div className="sc-breadth-matrix">
          <div className="sc-breadth-card sc-highlight">
            <div className="sc-metric-label">Stage 2 Bullish Breadth</div>
            <div className="sc-metric-val" style={{ color: (data?.stage_2_breadth_pct || 0) >= 50 ? '#10b981' : '#f59e0b' }}>
              {data?.stage_2_breadth_pct || 0}%
            </div>
            <div className="sc-metric-sub">{data?.market_stage_posture || 'Analyzing...'}</div>
          </div>

          <div className="sc-breadth-card">
            <div className="sc-metric-label">Stage 1: Basing</div>
            <div className="sc-metric-val" style={{ color: '#8b5cf6' }}>
              {distribution['Stage 1 (Basing)'] || 0}
            </div>
            <div className="sc-metric-sub">Accumulation & VCP Coils (1A, 1B, 1C)</div>
          </div>

          <div className="sc-breadth-card">
            <div className="sc-metric-label">Stage 2: Advancing</div>
            <div className="sc-metric-val" style={{ color: '#10b981' }}>
              {distribution['Stage 2 (Advancing)'] || 0}
            </div>
            <div className="sc-metric-sub">CANSLIM Sweet Spot (2A, 2B, 2C, 2D)</div>
          </div>

          <div className="sc-breadth-card">
            <div className="sc-metric-label">Stage 3: Topping</div>
            <div className="sc-metric-val" style={{ color: '#ec4899' }}>
              {distribution['Stage 3 (Topping)'] || 0}
            </div>
            <div className="sc-metric-sub">Distribution & Upthrust Traps (3A, 3B, 3C)</div>
          </div>

          <div className="sc-breadth-card">
            <div className="sc-metric-label">Stage 4: Declining</div>
            <div className="sc-metric-val" style={{ color: '#ef4444' }}>
              {distribution['Stage 4 (Declining)'] || 0}
            </div>
            <div className="sc-metric-sub">Markdown & Capitulation (4A, 4B, 4C)</div>
          </div>
        </div>
      </div>

      {/* Controls Bar & Ticker Search */}
      <div className="sc-controls-bar">
        <div className="sc-filter-pills">
          <button 
            className={`sc-pill ${selectedFilter === 'ALL' ? 'active' : ''}`}
            onClick={() => setSelectedFilter('ALL')}
          >
            All Screened ({data?.stocks?.length || 0})
          </button>
          <button 
            className={`sc-pill ${selectedFilter === 'STAGE_2A' ? 'active' : ''}`}
            onClick={() => setSelectedFilter('STAGE_2A')}
          >
            🔥 Stage 2A: Breakout Ignition
          </button>
          <button 
            className={`sc-pill ${selectedFilter === 'STAGE_2B' ? 'active' : ''}`}
            onClick={() => setSelectedFilter('STAGE_2B')}
          >
            🎯 Stage 2B: 10w MA Reload
          </button>
          <button 
            className={`sc-pill ${selectedFilter === 'VCP_COILS' ? 'active' : ''}`}
            onClick={() => setSelectedFilter('VCP_COILS')}
          >
            ⚡ Tight VCP Coils ({alphas.vcp_coils || 0})
          </button>
          <button 
            className={`sc-pill ${selectedFilter === 'POCKET_PIVOTS' ? 'active' : ''}`}
            onClick={() => setSelectedFilter('POCKET_PIVOTS')}
          >
            🟣 Pocket Pivots Active ({alphas.pocket_pivots || 0})
          </button>
          <button 
            className={`sc-pill ${selectedFilter === 'RS_AHEAD' ? 'active' : ''}`}
            onClick={() => setSelectedFilter('RS_AHEAD')}
          >
            🌟 RS Ahead of Price ({alphas.rs_new_high_ahead || 0})
          </button>
          <button 
            className={`sc-pill ${selectedFilter === 'CANSLIM_A' ? 'active' : ''}`}
            onClick={() => setSelectedFilter('CANSLIM_A')}
          >
            🏆 CANSLIM Grade A+ / A
          </button>
          <button 
            className={`sc-pill ${selectedFilter === 'IN_BUY_ZONE' ? 'active' : ''}`}
            onClick={() => setSelectedFilter('IN_BUY_ZONE')}
          >
            🟢 In 5% Buy Zone
          </button>
          <button 
            className={`sc-pill ${selectedFilter === 'CLIMAX_RISK' ? 'active' : ''}`}
            onClick={() => setSelectedFilter('CLIMAX_RISK')}
          >
            ⚠️ Climax Risk ({alphas.climax_risk || 0})
          </button>
          <button 
            className={`sc-pill ${selectedFilter === 'DEFENSIVE' ? 'active' : ''}`}
            onClick={() => setSelectedFilter('DEFENSIVE')}
          >
            🛑 Stage 3 & 4 (Avoid)
          </button>
        </div>

        <form onSubmit={handleDirectSearch} className="sc-search-form">
          <input 
            type="text" 
            placeholder="Deep Ticker Analysis (e.g. NVDA, AMD, PLTR)..."
            value={searchTicker}
            onChange={(e) => setSearchTicker(e.target.value)}
            className="sc-search-input"
          />
          <button type="submit" className="sc-search-btn">
            <Search size={16} /> Inspect
          </button>
        </form>
      </div>

      {/* Main Table */}
      {loading ? (
        <div className="sc-loading-state">
          <Flame size={48} className="sc-flame-icon sc-spin" />
          <p>Running Weinstein 12-Sub-Stage & O'Neil CANSLIM v2.0 Engine...</p>
        </div>
      ) : error ? (
        <div className="sc-error-state">
          <AlertCircle size={32} color="#ef4444" />
          <p>{error}</p>
        </div>
      ) : (
        <div className="sc-table-wrapper">
          <table className="sc-table">
            <thead>
              <tr>
                <th>Ticker & Price</th>
                <th>12-Sub-Stage & Duration</th>
                <th>Mansfield RS & Divergence</th>
                <th>VCP Contractions & VDU</th>
                <th>Pocket Pivots & Dist</th>
                <th>CANSLIM Score</th>
                <th>Base Pattern & Ladder</th>
                <th>Pivot Buy Point & Zone</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredStocks.map((stock) => {
                const stage = stock.stage_info || {};
                const vcp = stock.vcp_info || {};
                const pp = stock.pp_info || {};
                const rsAlpha = stock.rs_alpha || {};
                const canslim = stock.canslim_info || {};
                const playbook = stock.playbook || {};

                return (
                  <tr 
                    key={stock.ticker} 
                    className="sc-row"
                    onClick={() => openStockModal(stock.ticker)}
                  >
                    <td>
                      <div className="sc-ticker-cell">
                        <span className="sc-ticker-symbol">{stock.ticker}</span>
                        <span className="sc-ticker-price">${stock.current_price?.toFixed(2)}</span>
                      </div>
                    </td>

                    <td>
                      <div className="sc-stage-cell">
                        <div className="sc-stage-badge" style={{ backgroundColor: `${stage.status_color}22`, borderColor: stage.status_color, color: stage.status_color }}>
                          <span className="sc-stage-id">{stage.sub_stage}</span>
                          <span className="sc-stage-desc">{stage.sub_stage_name}</span>
                        </div>
                        <span className="sc-regime-duration">Duration: {stage.regime_duration_weeks || 1}w</span>
                      </div>
                    </td>

                    <td>
                      <div className="sc-rs-cell">
                        <span className={`sc-rs-badge ${stage.mansfield_rs >= 0 ? 'bullish' : 'bearish'}`}>
                          {stage.mansfield_rs >= 0 ? `+${stage.mansfield_rs?.toFixed(1)}%` : `${stage.mansfield_rs?.toFixed(1)}%`}
                        </span>
                        {rsAlpha.rs_new_high_ahead ? (
                          <span className="sc-alpha-badge">🌟 RS AHEAD OF PRICE</span>
                        ) : (
                          <span className="sc-rs-sub">
                            {stage.mansfield_rs >= 0 ? 'Outperforming SPY' : 'Underperforming SPY'}
                          </span>
                        )}
                      </div>
                    </td>

                    <td>
                      <div className="sc-vcp-cell">
                        {vcp.is_vcp ? (
                          <span className="sc-vcp-badge active">
                            ⚡ {vcp.contractions_count}T VCP ({vcp.contraction_depths?.slice(0, 3).join('%→')}%)
                          </span>
                        ) : (
                          <span className="sc-vcp-badge neutral">
                            {vcp.contractions_count > 0 ? `${vcp.contractions_count} Waves` : 'Forming Base'}
                          </span>
                        )}
                        <span className="sc-vdu-text">
                          VDU: <strong>{intVal(vcp.vdu_ratio * 100)}%</strong> of 50d avg
                        </span>
                      </div>
                    </td>

                    <td>
                      <div className="sc-pp-cell">
                        {pp.has_recent_pocket_pivot ? (
                          <span className="sc-pp-badge">
                            🟣 {pp.pocket_pivot_count_20d} Pocket Pivot{pp.pocket_pivot_count_20d > 1 ? 's' : ''}
                          </span>
                        ) : (
                          <span className="sc-pp-none">0 Pocket Pivots</span>
                        )}
                        <span className="sc-dist-days" style={{ color: pp.distribution_days_25d >= 5 ? '#ef4444' : '#94a3b8' }}>
                          Dist Days: {pp.distribution_days_25d}
                        </span>
                      </div>
                    </td>

                    <td>
                      <div className="sc-canslim-cell">
                        <span className={`sc-grade-badge grade-${canslim.canslim_grade}`}>
                          {canslim.canslim_grade}
                        </span>
                        <span className="sc-score-bar-text">{canslim.total_canslim_score}/100</span>
                      </div>
                    </td>

                    <td>
                      <div className="sc-base-cell">
                        <span className="sc-base-tag">{stock.base_ladder_desc || `Base ${stock.base_count}`}</span>
                        <span className="sc-base-name">{stock.base_pattern_desc}</span>
                      </div>
                    </td>

                    <td>
                      <div className="sc-pivot-cell">
                        <div className="sc-pivot-val">${playbook.pivot_buy_point?.toFixed(2)}</div>
                        <span className={`sc-pivot-tag ${playbook.in_buy_zone ? 'in-zone' : 'out-zone'}`}>
                          {playbook.status_tag}
                        </span>
                      </div>
                    </td>

                    <td>
                      <button 
                        className="sc-analyze-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          openStockModal(stock.ticker);
                        }}
                      >
                        Terminal <ChevronRight size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Deep Analysis Modal */}
      {activeStock && (
        <div className="sc-modal-overlay" onClick={() => setActiveStock(null)}>
          <div className="sc-modal-content" onClick={(e) => e.stopPropagation()}>
            {modalLoading ? (
              <div className="sc-modal-loading">
                <Flame size={40} className="sc-flame-icon sc-spin" />
                <p>Generating Stage & CANSLIM Deep Dossier for {activeStock.ticker}...</p>
              </div>
            ) : activeStock.error ? (
              <div className="sc-modal-error">
                <AlertCircle size={36} color="#ef4444" />
                <p>{activeStock.error}</p>
                <button onClick={() => setActiveStock(null)} className="sc-btn-close">Close</button>
              </div>
            ) : (
              <>
                {/* Modal Header */}
                <div className="sc-modal-header">
                  <div className="sc-mheader-left">
                    <div className="sc-mheader-title">
                      <h2>{activeStock.ticker}</h2>
                      <span className="sc-mheader-price">${activeStock.current_price?.toFixed(2)}</span>
                    </div>

                    <div className="sc-mheader-badges">
                      <span className="sc-stage-badge" style={{ backgroundColor: `${activeStock.stage_info?.status_color}22`, borderColor: activeStock.stage_info?.status_color, color: activeStock.stage_info?.status_color }}>
                        {activeStock.stage_info?.sub_stage_name}
                      </span>
                      <span className={`sc-grade-badge grade-${activeStock.canslim_info?.canslim_grade}`}>
                        CANSLIM {activeStock.canslim_info?.canslim_grade} ({activeStock.canslim_info?.total_canslim_score} pts)
                      </span>
                      <span className="sc-composite-pill">
                        Composite: {activeStock.synergy?.composite_score}/100
                      </span>
                      {activeStock.rs_alpha?.rs_new_high_ahead && (
                        <span className="sc-alpha-pill">🌟 RS NEW HIGH AHEAD OF PRICE</span>
                      )}
                      {activeStock.climax_info?.is_climax_risk && (
                        <span className="sc-climax-pill">⚠️ CLIMAX EXHAUSTION TOP</span>
                      )}
                    </div>
                  </div>

                  <div className="sc-mheader-right">
                    <button className="sc-close-btn" onClick={() => setActiveStock(null)}>
                      <X size={20} />
                    </button>
                  </div>
                </div>

                {/* Modal Sub-Tabs */}
                <div className="sc-modal-tabs">
                  <button 
                    className={`sc-mtab ${modalTab === 'CHART' ? 'active' : ''}`}
                    onClick={() => setModalTab('CHART')}
                  >
                    <BarChart2 size={16} /> 📊 Dual-Pane Stage, Pocket Pivots & RS Chart
                  </button>
                  <button 
                    className={`sc-mtab ${modalTab === 'LIFECYCLE' ? 'active' : ''}`}
                    onClick={() => setModalTab('LIFECYCLE')}
                  >
                    <Layers size={16} /> 🌀 12-Stage Visual Lifecycle & Verification Rules
                  </button>
                  <button 
                    className={`sc-mtab ${modalTab === 'PLAYBOOK' ? 'active' : ''}`}
                    onClick={() => setModalTab('PLAYBOOK')}
                  >
                    <Award size={16} /> 🏆 CANSLIM Scorecard & O'Neil Order Ticket
                  </button>
                </div>

                {/* Modal Body */}
                <div className="sc-modal-body">
                  {/* TAB 1: DUAL-PANE CHART */}
                  {modalTab === 'CHART' && (
                    <div className="sc-chart-pane">
                      <div className="sc-chart-topbar">
                        <div className="sc-chart-legend">
                          <span className="sc-legend-item"><span className="sc-legend-dot ma10-dot"></span> 10-Week MA (50-Day Line): ${activeStock.stage_info?.ma10_weekly}</span>
                          <span className="sc-legend-item"><span className="sc-legend-dot ma30-dot"></span> 30-Week MA (Stan Weinstein Line): ${activeStock.stage_info?.ma30_weekly}</span>
                          <span className="sc-legend-item"><span className="sc-legend-dot pivot-dot"></span> Base Pivot: ${activeStock.playbook?.pivot_buy_point}</span>
                          <span className="sc-legend-item"><span className="sc-legend-dot buyzone-dot"></span> 5% Buy Zone: [${activeStock.playbook?.buy_zone_min} - ${activeStock.playbook?.buy_zone_max}]</span>
                          <span className="sc-legend-item"><span className="sc-legend-dot pp-dot"></span> 🟣 Institutional Pocket Pivot</span>
                        </div>
                        {hoveredBar && (
                          <div className="sc-hover-tooltip">
                            <span>Date: <strong>{hoveredBar.date}</strong></span>
                            <span>O: {hoveredBar.open}</span>
                            <span>H: {hoveredBar.high}</span>
                            <span>L: {hoveredBar.low}</span>
                            <span>C: <strong>{hoveredBar.close}</strong></span>
                            <span>RS: <strong style={{ color: hoveredBar.mansfield_rs >= 0 ? '#10b981' : '#ef4444' }}>{hoveredBar.mansfield_rs > 0 ? `+${hoveredBar.mansfield_rs}%` : `${hoveredBar.mansfield_rs}%`}</strong></span>
                            {hoveredBar.is_pocket_pivot && (
                              <span style={{ color: '#c084fc', fontWeight: 'bold' }}>🟣 POCKET PIVOT</span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* SVG Canvas */}
                      <StageChartCanvas 
                        chartData={activeStock.chart_data || []} 
                        playbook={activeStock.playbook}
                        onHover={setHoveredBar}
                      />
                    </div>
                  )}

                  {/* TAB 2: 12-STAGE LIFECYCLE CURVE & VERIFICATION RULES */}
                  {modalTab === 'LIFECYCLE' && (
                    <div className="sc-lifecycle-pane">
                      <div className="sc-lifecycle-header">
                        <h3>Stan Weinstein's 4 Stages & 12 Granular Sub-Stages</h3>
                        <p>Institutional accumulation to secular markdown roadmap. Active stock stage is highlighted with glowing halo.</p>
                      </div>

                      {/* Interactive Horizontal 12-Stage Visual Track */}
                      <div className="sc-stages-track">
                        {SUB_STAGES_LIST.map((item) => {
                          const isActive = activeStock.stage_info?.sub_stage === item.id;
                          return (
                            <div 
                              key={item.id} 
                              className={`sc-track-node ${isActive ? 'is-active-stage' : ''}`}
                              style={{ borderColor: item.color }}
                            >
                              <div className="sc-node-badge" style={{ backgroundColor: item.color }}>
                                {item.id}
                              </div>
                              <div className="sc-node-phase">{item.phase}</div>
                              <div className="sc-node-title">{item.name}</div>
                              <div className="sc-node-desc">{item.desc}</div>
                              {isActive && (
                                <div className="sc-active-indicator">
                                  <Flame size={18} className="sc-flame-icon sc-pulse" />
                                  <span>CURRENT REGIME ({activeStock.stage_info?.regime_duration_weeks || 1}w)</span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Verification Rules & Institutional Checklist */}
                      <div className="sc-stage-dossier-grid">
                        <div className="sc-dossier-card">
                          <h4>Institutional Stage Verification Checklist</h4>
                          <div className="sc-rules-list">
                            <div className="sc-rule-row">
                              <span>30-Week MA (Stan Weinstein Baseline)</span>
                              <strong>${activeStock.stage_info?.ma30_weekly} ({activeStock.stage_info?.ma30_slope_pct > 0 ? `+${activeStock.stage_info?.ma30_slope_pct}% (Rising)` : `${activeStock.stage_info?.ma30_slope_pct}% (Declining)`})</strong>
                            </div>
                            <div className="sc-rule-row">
                              <span>10-Week MA (50-Day Momentum Line)</span>
                              <strong>${activeStock.stage_info?.ma10_weekly} ({activeStock.stage_info?.ma10_slope_pct > 0 ? `+${activeStock.stage_info?.ma10_slope_pct}% (Rising)` : `${activeStock.stage_info?.ma10_slope_pct}% (Falling)`})</strong>
                            </div>
                            <div className="sc-rule-row">
                              <span>Distance from 30-Week MA</span>
                              <strong style={{ color: activeStock.stage_info?.dist_ma30_pct > 0 ? '#10b981' : '#ef4444' }}>
                                {activeStock.stage_info?.dist_ma30_pct > 0 ? `+${activeStock.stage_info?.dist_ma30_pct}%` : `${activeStock.stage_info?.dist_ma30_pct}%`}
                              </strong>
                            </div>
                            <div className="sc-rule-row">
                              <span>Distance from 52-Week High</span>
                              <strong>-{activeStock.stage_info?.pct_from_52w_high}%</strong>
                            </div>
                            <div className="sc-rule-row">
                              <span>VCP Contraction Quality</span>
                              <strong style={{ color: activeStock.vcp_info?.is_vcp ? '#10b981' : '#94a3b8' }}>
                                {activeStock.vcp_info?.description} ({activeStock.vcp_info?.vcp_quality_score} pts)
                              </strong>
                            </div>
                            <div className="sc-rule-row">
                              <span>Pocket Pivots (Last 20 Days)</span>
                              <strong style={{ color: activeStock.pp_info?.has_recent_pocket_pivot ? '#c084fc' : '#94a3b8' }}>
                                {activeStock.pp_info?.pocket_pivot_count_20d} Pocket Pivots Detected
                              </strong>
                            </div>
                            <div className="sc-rule-row">
                              <span>Distribution Sessions (Last 25 Days)</span>
                              <strong style={{ color: activeStock.pp_info?.distribution_days_25d >= 5 ? '#ef4444' : '#10b981' }}>
                                {activeStock.pp_info?.distribution_days_25d} Days ({activeStock.pp_info?.distribution_status})
                              </strong>
                            </div>
                          </div>
                        </div>

                        <div className="sc-dossier-card">
                          <h4>Institutional Behavior & Action</h4>
                          <div className="sc-action-box" style={{ borderColor: activeStock.stage_info?.status_color }}>
                            <div className="sc-action-title">ACTION DIRECTIVE</div>
                            <div className="sc-action-val" style={{ color: activeStock.stage_info?.status_color }}>
                              {activeStock.stage_info?.action_directive}
                            </div>
                          </div>
                          <ul className="sc-char-list">
                            {activeStock.stage_info?.key_characteristics?.map((c, i) => (
                              <li key={i}><Check size={16} color="#10b981" /> {c}</li>
                            ))}
                            {activeStock.climax_info?.exhaustion_flags?.map((f, i) => (
                              <li key={`ex-${i}`} style={{ color: '#f59e0b' }}><AlertTriangle size={16} color="#f59e0b" /> {f}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 3: CANSLIM SCORECARD & O'NEIL SCALE-IN ORDER TICKET */}
                  {modalTab === 'PLAYBOOK' && (
                    <div className="sc-playbook-pane">
                      {/* CANSLIM 7 Pillars Grid */}
                      <div className="sc-canslim-grid-header">
                        <h3>William J. O'Neil CANSLIM 7-Pillar Scorecard</h3>
                        <div className="sc-total-canslim-badge">
                          <span>Total Score:</span>
                          <strong>{activeStock.canslim_info?.total_canslim_score} / 100</strong>
                          <span className={`sc-grade-badge grade-${activeStock.canslim_info?.canslim_grade}`}>
                            {activeStock.canslim_info?.canslim_grade}
                          </span>
                        </div>
                      </div>

                      <div className="sc-pillars-grid">
                        {Object.entries(activeStock.canslim_info?.pillars || {}).map(([key, pillar]) => (
                          <div key={key} className="sc-pillar-card">
                            <div className="sc-pillar-top">
                              <span className="sc-pillar-letter">{key}</span>
                              <div className="sc-pillar-names">
                                <strong>{pillar.pillar_name}</strong>
                                <span className="sc-pillar-weight">Weight: {pillar.weight} pts</span>
                              </div>
                              <span className="sc-pillar-score">{pillar.score} / {pillar.weight}</span>
                            </div>
                            <div className="sc-pillar-verdict">{pillar.verdict}</div>
                            <div className="sc-pillar-details">
                              {Object.entries(pillar.details || {}).map(([dKey, dVal]) => (
                                <div key={dKey} className="sc-pdetail-row">
                                  <span>{dKey.replace(/_/g, ' ')}:</span>
                                  <strong>{dVal}</strong>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Interactive O'Neil 3-Tier Order Ticket Card */}
                      <div className="sc-execution-card">
                        <div className="sc-exec-header">
                          <Target size={24} color="#10b981" />
                          <div style={{ flex: 1 }}>
                            <h4>William O'Neil 3-Tier Scale-In Execution Ticket</h4>
                            <p>Disciplined rules: 50% initial pivot breakout, 30% on +2% follow-through confirmation, 20% on first 10w MA test.</p>
                          </div>
                          <button 
                            className="sc-copy-ticket-btn"
                            onClick={handleCopyOrderTicket}
                          >
                            <Copy size={14} />
                            {copiedTicket ? 'Copied to Clipboard!' : 'Copy Order Ticket'}
                          </button>
                        </div>

                        {/* 3-Tier Scale-In Cards */}
                        <div className="sc-tiers-grid">
                          <div className="sc-tier-card">
                            <div className="sc-tier-badge">Tier 1: Pivot Breakout (50%)</div>
                            <div className="sc-tier-price">${activeStock.playbook?.scale_in_ticket?.tier_1?.trigger_price}</div>
                            <div className="sc-tier-action">{activeStock.playbook?.scale_in_ticket?.tier_1?.action}</div>
                          </div>

                          <div className="sc-tier-card">
                            <div className="sc-tier-badge">Tier 2: +2% Confirmation (30%)</div>
                            <div className="sc-tier-price" style={{ color: '#38bdf8' }}>${activeStock.playbook?.scale_in_ticket?.tier_2?.trigger_price}</div>
                            <div className="sc-tier-action">{activeStock.playbook?.scale_in_ticket?.tier_2?.action}</div>
                          </div>

                          <div className="sc-tier-card">
                            <div className="sc-tier-badge">Tier 3: 10w MA Reload (20%)</div>
                            <div className="sc-tier-price" style={{ color: '#a855f7' }}>${activeStock.playbook?.scale_in_ticket?.tier_3?.trigger_price}</div>
                            <div className="sc-tier-action">{activeStock.playbook?.scale_in_ticket?.tier_3?.action}</div>
                          </div>
                        </div>

                        {/* Key Metrics Grid */}
                        <div className="sc-exec-metrics-grid">
                          <div className="sc-exec-metric">
                            <div className="sc-em-label">Pivot Buy Point</div>
                            <div className="sc-em-val">${activeStock.playbook?.pivot_buy_point}</div>
                            <div className="sc-em-sub">Base Breakout Ceiling</div>
                          </div>

                          <div className="sc-exec-metric">
                            <div className="sc-em-label">5% Buy Zone</div>
                            <div className="sc-em-val" style={{ color: '#10b981' }}>
                              ${activeStock.playbook?.buy_zone_min} - ${activeStock.playbook?.buy_zone_max}
                            </div>
                            <div className="sc-em-sub">Strict No-Chase Zone</div>
                          </div>

                          <div className="sc-exec-metric">
                            <div className="sc-em-label">Stop Loss ({activeStock.playbook?.stop_loss_pct})</div>
                            <div className="sc-em-val" style={{ color: '#ef4444' }}>
                              ${activeStock.playbook?.stop_loss_price}
                            </div>
                            <div className="sc-em-sub">Strict Capital Defense Cut</div>
                          </div>

                          <div className="sc-exec-metric">
                            <div className="sc-em-label">Profit Target 1 (+22%)</div>
                            <div className="sc-em-val" style={{ color: '#38bdf8' }}>
                              ${activeStock.playbook?.profit_target_1}
                            </div>
                            <div className="sc-em-sub">20-25% Standard Rule</div>
                          </div>

                          <div className="sc-exec-metric">
                            <div className="sc-em-label">Profit Target 2 (+35%)</div>
                            <div className="sc-em-val" style={{ color: '#a855f7' }}>
                              ${activeStock.playbook?.profit_target_2}
                            </div>
                            <div className="sc-em-sub">Climax / 8-Week Rule</div>
                          </div>

                          <div className="sc-exec-metric">
                            <div className="sc-em-label">Risk / Reward Ratio</div>
                            <div className="sc-em-val" style={{ color: '#10b981' }}>
                              {activeStock.playbook?.risk_reward_ratio}
                            </div>
                            <div className="sc-em-sub">Institutional Edge</div>
                          </div>
                        </div>

                        {/* Sizing & Allocation Box */}
                        <div className="sc-sizing-box">
                          <div className="sc-sizing-title">
                            <Percent size={18} color="#f59e0b" />
                            <span>Position Sizing ($100,000 Portfolio, 1% Risk Rule)</span>
                          </div>
                          <div className="sc-sizing-content">
                            <div>Recommended Total Allocation: <strong>{activeStock.playbook?.position_sizing?.recommended_shares} shares</strong> ({activeStock.playbook?.position_sizing?.allocated_capital})</div>
                            <div className="sc-sizing-rule">{activeStock.playbook?.position_sizing?.oneil_rule}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function intVal(num) {
  return Math.round(num || 0);
}

// Dual-Pane SVG Chart (Price Candlesticks + 10w/30w MAs + Pocket Pivots + Mansfield RS)
function StageChartCanvas({ chartData, playbook, onHover }) {
  const containerRef = useRef(null);
  const [width, setWidth] = useState(900);

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setWidth(containerRef.current.clientWidth);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!chartData || chartData.length === 0) {
    return <div className="sc-no-chart">No chart history available.</div>;
  }

  // Dimensions
  const height = 480;
  const padding = { top: 25, right: 65, bottom: 20, left: 20 };
  const upperHeight = 315;
  const gap = 25;
  const lowerHeight = height - upperHeight - gap - padding.top - padding.bottom;

  // Price Scale
  const prices = chartData.flatMap(b => [b.high, b.low, b.ma10, b.ma30, b.pivot_line].filter(p => p !== null && !isNaN(p)));
  const minPrice = Math.min(...prices) * 0.96;
  const maxPrice = Math.max(...prices) * 1.04;
  const priceRange = maxPrice - minPrice || 1;

  const getY = (val) => {
    if (val === null || isNaN(val)) return 0;
    return padding.top + upperHeight - ((val - minPrice) / priceRange) * upperHeight;
  };

  // Mansfield RS Scale
  const rsVals = chartData.map(b => b.mansfield_rs || 0);
  const maxRsAbs = Math.max(10, Math.max(...rsVals.map(Math.abs))) * 1.15;
  const lowerTop = padding.top + upperHeight + gap;

  const getRsY = (val) => {
    const normalized = (val - (-maxRsAbs)) / (2 * maxRsAbs);
    return lowerTop + lowerHeight - normalized * lowerHeight;
  };

  const zeroRsY = getRsY(0);

  // X coordinate
  const usableWidth = width - padding.left - padding.right;
  const barWidth = Math.max(4, Math.min(14, (usableWidth / chartData.length) * 0.7));
  const getX = (index) => padding.left + (index / (chartData.length - 1)) * usableWidth;

  // Build MA lines paths
  let ma10Path = '';
  let ma30Path = '';
  let rsPath = '';

  chartData.forEach((b, i) => {
    const x = getX(i);
    if (b.ma10) {
      const y10 = getY(b.ma10);
      ma10Path += i === 0 ? `M ${x} ${y10}` : ` L ${x} ${y10}`;
    }
    if (b.ma30) {
      const y30 = getY(b.ma30);
      ma30Path += i === 0 ? `M ${x} ${y30}` : ` L ${x} ${y30}`;
    }
    const yRs = getRsY(b.mansfield_rs);
    rsPath += i === 0 ? `M ${x} ${yRs}` : ` L ${x} ${yRs}`;
  });

  const pivotY = getY(playbook?.pivot_buy_point);
  const buyMaxY = getY(playbook?.buy_zone_max);
  const buyZoneHeight = Math.max(0, pivotY - buyMaxY);

  return (
    <div className="sc-canvas-container" ref={containerRef}>
      <svg width={width} height={height} className="sc-svg-canvas">
        {/* Background grids */}
        <line x1={padding.left} y1={padding.top} x2={width - padding.right} y2={padding.top} stroke="#334155" strokeDasharray="3 3" opacity="0.4" />
        <line x1={padding.left} y1={padding.top + upperHeight * 0.5} x2={width - padding.right} y2={padding.top + upperHeight * 0.5} stroke="#334155" strokeDasharray="3 3" opacity="0.4" />
        <line x1={padding.left} y1={padding.top + upperHeight} x2={width - padding.right} y2={padding.top + upperHeight} stroke="#334155" opacity="0.8" />

        {/* Shaded 5% Buy Zone */}
        {playbook?.pivot_buy_point && (
          <g>
            <rect 
              x={padding.left} 
              y={buyMaxY} 
              width={usableWidth} 
              height={buyZoneHeight} 
              fill="#10b981" 
              fillOpacity="0.12" 
            />
            <line 
              x1={padding.left} 
              y1={pivotY} 
              x2={width - padding.right} 
              y2={pivotY} 
              stroke="#10b981" 
              strokeDasharray="4 4" 
              strokeWidth="1.5" 
            />
            <text x={width - padding.right + 5} y={pivotY + 4} fill="#10b981" fontSize="10" fontWeight="bold">
              PIVOT ${playbook.pivot_buy_point}
            </text>
          </g>
        )}

        {/* Candlesticks & Pocket Pivot Markers */}
        {chartData.map((bar, i) => {
          const x = getX(i);
          const isUp = bar.close >= bar.open;
          const candleColor = isUp ? '#10b981' : '#ef4444';
          const highY = getY(bar.high);
          const lowY = getY(bar.low);
          const openY = getY(bar.open);
          const closeY = getY(bar.close);
          const bodyY = Math.min(openY, closeY);
          const bodyHeight = Math.max(2, Math.abs(closeY - openY));

          return (
            <g 
              key={i} 
              className="sc-candle-group"
              onMouseEnter={() => onHover && onHover(bar)}
              onMouseLeave={() => onHover && onHover(null)}
            >
              {/* Pocket Pivot Purple Diamond Marker */}
              {bar.is_pocket_pivot && (
                <polygon 
                  points={`${x},${highY - 14} ${x + 5},${highY - 8} ${x},${highY - 2} ${x - 5},${highY - 8}`} 
                  fill="#c084fc" 
                  stroke="#7e22ce"
                  strokeWidth="1"
                />
              )}

              {/* Wick */}
              <line x1={x} y1={highY} x2={x} y2={lowY} stroke={candleColor} strokeWidth="1.2" />
              {/* Body */}
              <rect 
                x={x - barWidth / 2} 
                y={bodyY} 
                width={barWidth} 
                height={bodyHeight} 
                fill={candleColor} 
                rx="1"
              />
            </g>
          );
        })}

        {/* Moving Averages */}
        {ma30Path && (
          <path d={ma30Path} fill="none" stroke="#f59e0b" strokeWidth="2.5" />
        )}
        {ma10Path && (
          <path d={ma10Path} fill="none" stroke="#00f2fe" strokeWidth="2" />
        )}

        {/* Price Labels on Right Axis */}
        <text x={width - padding.right + 5} y={getY(maxPrice) + 10} fill="#94a3b8" fontSize="10">${maxPrice.toFixed(0)}</text>
        <text x={width - padding.right + 5} y={getY(minPrice)} fill="#94a3b8" fontSize="10">${minPrice.toFixed(0)}</text>

        {/* LOWER PANE: MANSFIELD RELATIVE STRENGTH */}
        <g transform={`translate(0, 0)`}>
          <text x={padding.left} y={lowerTop - 6} fill="#94a3b8" fontSize="11" fontWeight="bold">
            STAN WEINSTEIN MANSFIELD RELATIVE STRENGTH (vs SPY)
          </text>

          {/* Zero baseline */}
          <line 
            x1={padding.left} 
            y1={zeroRsY} 
            x2={width - padding.right} 
            y2={zeroRsY} 
            stroke="#94a3b8" 
            strokeWidth="1.5" 
            strokeDasharray="2 2" 
          />
          <text x={width - padding.right + 5} y={zeroRsY + 4} fill="#94a3b8" fontSize="10">0.0 RS</text>

          {/* Mansfield RS Curve */}
          {rsPath && (
            <path d={rsPath} fill="none" stroke="#a855f7" strokeWidth="2.5" />
          )}

          {/* Mansfield RS Area fills */}
          {chartData.map((bar, i) => {
            const x = getX(i);
            const y = getRsY(bar.mansfield_rs);
            const isPos = bar.mansfield_rs >= 0;
            return (
              <line 
                key={`rs-bar-${i}`}
                x1={x} 
                y1={zeroRsY} 
                x2={x} 
                y2={y} 
                stroke={isPos ? '#10b981' : '#ef4444'} 
                strokeWidth={barWidth * 0.7}
                opacity="0.3"
              />
            );
          })}
        </g>
      </svg>
    </div>
  );
}
