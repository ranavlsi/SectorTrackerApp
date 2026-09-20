import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Flame, TrendingUp, TrendingDown, ShieldCheck, ShieldAlert, CheckCircle2, 
  Zap, Search, RefreshCw, Layers, Info, ChevronRight, X, ArrowUpRight, 
  ArrowDownRight, Sparkles, Target, Activity, Calendar, BarChart2, Award, 
  Crosshair, Clock, AlertTriangle, Compass, Check, AlertCircle, Percent, Copy, ExternalLink,
  ZoomIn, ZoomOut, RotateCcw, Maximize2
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
  const [chartTimeframe, setChartTimeframe] = useState('2Y'); // '1Y' | '2Y' | '5Y'
  const [simulatorAccount, setSimulatorAccount] = useState(100000);
  const [simulatorRiskPct, setSimulatorRiskPct] = useState(1.0);
  const [showVcpWaves, setShowVcpWaves] = useState(true);
  const [hoveredWaveIdx, setHoveredWaveIdx] = useState(null);

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
    if (selectedFilter === 'TRIPLE_GREEN') {
      return list.filter(s => s.triple_tf?.is_triple_green);
    }
    if (selectedFilter === 'SECTOR_TAILWIND') {
      return list.filter(s => s.sector_info?.has_sector_tailwind);
    }
    if (selectedFilter === 'UR_SHAKEOUT') {
      return list.filter(s => s.ur_info?.has_ur_setup);
    }
    if (selectedFilter === 'EPS_ACCEL') {
      return list.filter(s => s.accel_data?.is_dual_accelerating);
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
            className={`sc-pill ${selectedFilter === 'TRIPLE_GREEN' ? 'active' : ''}`}
            onClick={() => setSelectedFilter('TRIPLE_GREEN')}
          >
            🟢 Triple Green Stage 2 ({alphas.triple_green || 0})
          </button>
          <button 
            className={`sc-pill ${selectedFilter === 'SECTOR_TAILWIND' ? 'active' : ''}`}
            onClick={() => setSelectedFilter('SECTOR_TAILWIND')}
          >
            🚀 Double Stage 2 Tailwind ({alphas.sector_tailwind || 0})
          </button>
          <button 
            className={`sc-pill ${selectedFilter === 'UR_SHAKEOUT' ? 'active' : ''}`}
            onClick={() => setSelectedFilter('UR_SHAKEOUT')}
          >
            ⚡ U&R Shakeout Entry ({alphas.ur_shakeouts || 0})
          </button>
          <button 
            className={`sc-pill ${selectedFilter === 'EPS_ACCEL' ? 'active' : ''}`}
            onClick={() => setSelectedFilter('EPS_ACCEL')}
          >
            ⚡ Dual EPS Accel ({alphas.eps_acceleration || 0})
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
                <th>Master Conviction</th>
                <th>12-Sub-Stage & Duration</th>
                <th>Sector & Confluence</th>
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
                const council = stock.trade_council || {};
                const sector = stock.sector_info || {};
                const tripleTf = stock.triple_tf || {};
                const ur = stock.ur_info || {};

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
                      <div className="sc-conviction-cell">
                        <div className="sc-conviction-score-wrap">
                          <span className="sc-conviction-val" style={{ color: council.tier_color || '#10b981' }}>
                            {council.master_conviction_score || 0}
                          </span>
                          <span className="sc-conviction-max">/100</span>
                        </div>
                        <span className="sc-conviction-badge" style={{ backgroundColor: `${council.tier_color || '#10b981'}22`, color: council.tier_color || '#10b981', borderColor: council.tier_color || '#10b981' }}>
                          {council.tier || 'CONVICTION B'}
                        </span>
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
                      <div className="sc-sector-confluence-cell">
                        <div className="sc-sec-etf-line">
                          <span className="sc-sec-etf-tag">{sector.sector_etf || 'SPY'}</span>
                          {sector.has_sector_tailwind ? (
                            <span className="sc-tailwind-pill">🚀 TAILWIND</span>
                          ) : (
                            <span className="sc-neutral-pill">{sector.sector_stage || 'Stage 2'}</span>
                          )}
                        </div>
                        <div className="sc-sec-sub-badges">
                          {tripleTf.is_triple_green && (
                            <span className="sc-micro-badge triple-green">🟢 3-GREEN</span>
                          )}
                          {ur.has_ur_setup && (
                            <span className="sc-micro-badge ur-shakeout">⚡ U&R</span>
                          )}
                        </div>
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
                      {activeStock.stage_info?.ma10_test_label === 'UNDERNEATH_RESISTANCE' && (
                        <span className="sc-ma10-warn-pill">
                          ⚠️ 10w MA Overhead Resistance (Testing from Underneath)
                        </span>
                      )}
                      {activeStock.stage_info?.sub_stage === '2B' && activeStock.stage_info?.ma10_test_label === 'UPSIDE_SUPPORT' && (
                        <span className="sc-ma10-support-pill">
                          🟢 10w MA Support (Orderly Bounce from Above)
                        </span>
                      )}
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
                          <span className="sc-legend-item"><span className="sc-legend-dot" style={{ background: '#a855f7' }}></span> ⚡ VCP Contraction Waves</span>
                        </div>
                        
                        <div className="sc-tf-selector">
                          <span className="sc-tf-label">Cycle Horizon:</span>
                          <button 
                            className={`sc-tf-btn ${chartTimeframe === '6M' ? 'active' : ''}`}
                            onClick={() => setChartTimeframe('6M')}
                            title="Zoom in on Base Consolidation and VCP Contractions"
                          >
                            6M (Base / VCP)
                          </button>
                          <button 
                            className={`sc-tf-btn ${chartTimeframe === '1Y' ? 'active' : ''}`}
                            onClick={() => setChartTimeframe('1Y')}
                          >
                            1Y (52w)
                          </button>
                          <button 
                            className={`sc-tf-btn ${chartTimeframe === '2Y' ? 'active' : ''}`}
                            onClick={() => setChartTimeframe('2Y')}
                          >
                            2Y (Tactical)
                          </button>
                          <button 
                            className={`sc-tf-btn ${chartTimeframe === '5Y' ? 'active' : ''}`}
                            onClick={() => setChartTimeframe('5Y')}
                          >
                            5Y (Full Stage Cycle)
                          </button>

                          <button 
                            className={`sc-tf-btn ${showVcpWaves ? 'active' : ''}`}
                            style={{ 
                              borderColor: showVcpWaves ? '#a855f7' : undefined, 
                              color: showVcpWaves ? '#c084fc' : undefined, 
                              background: showVcpWaves ? 'rgba(168, 85, 247, 0.2)' : undefined 
                            }}
                            onClick={() => setShowVcpWaves(!showVcpWaves)}
                            title="Toggle VCP Contraction Waves on Chart"
                          >
                            ⚡ VCP Waves: {showVcpWaves ? 'ON' : 'OFF'}
                          </button>
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

                      {/* Institutional Mark Minervini VCP Wave Sequence Strip */}
                      {showVcpWaves && activeStock.vcp_info?.waves_detail?.length > 0 && (
                        <div className="sc-vcp-sequence-bar">
                          <div className="sc-vcp-bar-header">
                            <span className="sc-vcp-head-title">⚡ MARK MINERVINI VOLATILITY CONTRACTION (VCP) ENGINE</span>
                            <span className={`sc-vcp-status-tag ${activeStock.vcp_info.is_vcp ? 'pass' : (activeStock.vcp_info.is_forming ? 'warning' : 'fail')}`}>
                              {activeStock.vcp_info.is_vcp 
                                ? `✓ Certified Minervini VCP (-${Math.round(activeStock.vcp_info.total_dampening_pct || 0)}% Vol Dampened)`
                                : activeStock.vcp_info.is_forming
                                  ? `⏳ Forming Base (${Math.round(activeStock.vcp_info.total_dampening_pct || 0)}% Dampened - Waiting for Tight Pivot)`
                                  : `⚠️ Disqualified: ${activeStock.vcp_info.lower_low_breaches?.[0] || 'VCP Breach'}`}
                            </span>
                            <span className={`sc-vcp-vdu-tag ${activeStock.vcp_info.vdu_confirmed ? 'pass' : 'normal'}`}>
                              {activeStock.vcp_info.vdu_confirmed 
                                ? `⚡ ${Math.round(activeStock.vcp_info.vdu_ratio * 100)}% Volume Dry-Up (VDU Confirmed)` 
                                : `${Math.round(activeStock.vcp_info.vdu_ratio * 100)}% 50-Day Vol`}
                            </span>
                          </div>

                          {/* Minervini 5-Pillar Checklist Bar */}
                          {activeStock.vcp_info.audit && (
                            <div className="sc-vcp-checklist-bar">
                              <span className={`sc-vcp-check-pill ${activeStock.vcp_info.audit.nested_inside_t1 ? 'pass' : 'fail'}`}>
                                {activeStock.vcp_info.audit.nested_inside_t1 ? '✓ Inside T1 Master Envelope' : '✗ T1 Floor Breach'}
                              </span>
                              <span className={`sc-vcp-check-pill ${activeStock.vcp_info.audit.ascending_floors ? 'pass' : 'fail'}`}>
                                {activeStock.vcp_info.audit.ascending_floors ? '✓ Ascending Higher Lows' : '✗ Lower Low Breach'}
                              </span>
                              <span className={`sc-vcp-check-pill ${activeStock.vcp_info.audit.volatility_dampened ? 'pass' : 'fail'}`}>
                                {activeStock.vcp_info.audit.volatility_dampened ? `✓ Volatility Dampened (-${Math.round(activeStock.vcp_info.total_dampening_pct || 0)}%)` : '✗ Volatility Expanded'}
                              </span>
                              <span className={`sc-vcp-check-pill ${activeStock.vcp_info.audit.final_tightness_pass ? 'pass' : 'warning'}`}>
                                {activeStock.vcp_info.audit.final_tightness_pass 
                                  ? `✓ Tight Terminal Pivot (${activeStock.vcp_info.contraction_depths?.slice(-1)[0]}% ≤ 8.5%)` 
                                  : `⏳ Wide Contraction (${activeStock.vcp_info.contraction_depths?.slice(-1)[0]}% > 8.5%)`}
                              </span>
                              <span className={`sc-vcp-check-pill ${activeStock.vcp_info.audit.vdu_confirmed ? 'pass' : 'normal'}`}>
                                {activeStock.vcp_info.audit.vdu_confirmed ? '✓ Volume Dry-Up (VDU)' : '• 50d Volume Normal'}
                              </span>
                            </div>
                          )}

                          <div className="sc-vcp-cards-row">
                            {activeStock.vcp_info.waves_detail.map((w, idx) => {
                              const isBreach = !w.is_nested || w.is_lower_low;
                              return (
                                <div 
                                  key={idx} 
                                  className={`sc-vcp-chip ${hoveredWaveIdx === idx ? 'hovered' : ''} ${isBreach ? 'lower-low' : ''}`}
                                  onMouseEnter={() => setHoveredWaveIdx(idx)}
                                  onMouseLeave={() => setHoveredWaveIdx(null)}
                                  style={isBreach ? { borderColor: '#ef4444', background: 'rgba(239, 68, 68, 0.1)' } : undefined}
                                >
                                  <div className="sc-vcp-chip-top">
                                    <span className="sc-vcp-wave-tag">{w.wave} CONTRACTION</span>
                                    <div className="sc-vcp-depth-badges">
                                      <span className="sc-vcp-wave-depth">-{w.depth_pct}%</span>
                                      {idx > 0 && w.dampening_ratio && (
                                        <span className="sc-vcp-dampening-badge" title={`Contraction is ${Math.round(w.dampening_ratio * 100)}% of T${idx}`}>
                                          {Math.round(w.dampening_ratio * 100)}% of T{idx}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="sc-vcp-chip-detail">
                                    <span className="sc-vcp-chip-price">${w.peak_price?.toFixed(2)} ➔ ${w.trough_price?.toFixed(2)}</span>
                                    <span className="sc-vcp-chip-dates">{w.peak_date?.slice(5)} to {w.trough_date?.slice(5)} ({w.days || 7}d)</span>
                                    {!w.is_nested ? (
                                      <span style={{ color: '#ef4444', fontSize: '0.62rem', fontWeight: 'bold' }}>⚠️ T1 Floor Breach</span>
                                    ) : w.is_lower_low ? (
                                      <span style={{ color: '#f87171', fontSize: '0.62rem', fontWeight: 'bold' }}>⚠️ Lower Low Breach</span>
                                    ) : (
                                      <span style={{ color: '#10b981', fontSize: '0.62rem', fontWeight: 'bold' }}>✓ Nested Higher Low</span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* SVG Canvas with dynamic timeframe bars & VCP waves */}
                      <StageChartCanvas 
                        chartData={
                          chartTimeframe === '6M'
                            ? (activeStock.chart_data || []).slice(-26)
                            : chartTimeframe === '1Y' 
                              ? (activeStock.chart_data || []).slice(-52) 
                              : chartTimeframe === '2Y' 
                                ? (activeStock.chart_data || []).slice(-104) 
                                : (activeStock.chart_data || [])
                        } 
                        playbook={activeStock.playbook}
                        vcp_info={activeStock.vcp_info}
                        showVcpWaves={showVcpWaves}
                        hoveredWaveIdx={hoveredWaveIdx}
                        setHoveredWaveIdx={setHoveredWaveIdx}
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
                              <span>10-Week MA Test Trajectory</span>
                              <strong style={{ color: activeStock.stage_info?.ma10_test_label === 'UNDERNEATH_RESISTANCE' ? '#ef4444' : '#10b981' }}>
                                {activeStock.stage_info?.ma10_test_label === 'UNDERNEATH_RESISTANCE' 
                                  ? `⚠️ Testing from Underneath (${activeStock.stage_info?.weeks_below_ma10}w below MA10 - Resistance)` 
                                  : '✓ Support Bounce from Above'}
                              </strong>
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

                      {/* v3.0 Triple-Timeframe Stage Matrix & Sector Confluence */}
                      <div className="sc-confluence-grid">
                        <div className="sc-confluence-card">
                          <div className="sc-confluence-card-header">
                            <Compass size={18} color="#38bdf8" />
                            <h4>Triple-Timeframe Stage Confluence</h4>
                            {activeStock.triple_tf?.is_triple_green ? (
                              <span className="sc-triple-green-badge">🟢 TRIPLE GREEN STAGE 2</span>
                            ) : (
                              <span className="sc-tf-mixed-badge">{activeStock.triple_tf?.badge || 'Multi-Timeframe Active'}</span>
                            )}
                          </div>
                          <p className="sc-confluence-desc">{activeStock.triple_tf?.confluence_verdict}</p>

                          <div className="sc-timeframes-row">
                            <div className="sc-tf-box">
                              <div className="sc-tf-name">Monthly (Secular)</div>
                              <div className="sc-tf-val" style={{ color: activeStock.triple_tf?.monthly?.status === 'BULLISH' ? '#10b981' : '#f59e0b' }}>
                                {activeStock.triple_tf?.monthly?.stage}
                              </div>
                              <div className="sc-tf-sub">10m MA: ${activeStock.triple_tf?.monthly?.ma10_monthly} • 30m MA: ${activeStock.triple_tf?.monthly?.ma30_monthly}</div>
                            </div>

                            <div className="sc-tf-box">
                              <div className="sc-tf-name">Weekly (Primary)</div>
                              <div className="sc-tf-val" style={{ color: '#10b981' }}>
                                {activeStock.triple_tf?.weekly?.stage}
                              </div>
                              <div className="sc-tf-sub">10w MA: ${activeStock.triple_tf?.weekly?.ma10_weekly} • 30w MA: ${activeStock.triple_tf?.weekly?.ma30_weekly}</div>
                            </div>

                            <div className="sc-tf-box">
                              <div className="sc-tf-name">Daily (Tactical)</div>
                              <div className="sc-tf-val" style={{ color: activeStock.triple_tf?.daily?.status === 'BULLISH' ? '#10b981' : '#f59e0b' }}>
                                {activeStock.triple_tf?.daily?.status} ({activeStock.triple_tf?.daily?.trend_template_passed ? 'Minervini Template Pass' : 'Tactical Base'})
                              </div>
                              <div className="sc-tf-sub">SMA50: ${activeStock.triple_tf?.daily?.sma50} • SMA200: ${activeStock.triple_tf?.daily?.sma200}</div>
                            </div>
                          </div>
                        </div>

                        <div className="sc-confluence-card">
                          <div className="sc-confluence-card-header">
                            <Activity size={18} color="#10b981" />
                            <h4>Sector & Order Flow Confluence</h4>
                            {activeStock.sector_info?.has_sector_tailwind && (
                              <span className="sc-tailwind-badge">🚀 DOUBLE STAGE 2 TAILWIND</span>
                            )}
                          </div>
                          <div className="sc-sec-flow-body">
                            <div className="sc-sec-info-line">
                              <span>Industry / Sector ETF:</span>
                              <strong>{activeStock.sector_info?.sector_etf} ({activeStock.sector_info?.industry_name})</strong>
                            </div>
                            <div className="sc-sec-info-line">
                              <span>Sector Stage Status:</span>
                              <strong style={{ color: '#10b981' }}>{activeStock.sector_info?.sector_stage}</strong>
                            </div>
                            <div className="sc-sec-info-line">
                              <span>Order Flow A/D Grade:</span>
                              <strong className={`sc-grade-badge grade-${activeStock.ad_info?.ad_rating || 'B'}`}>
                                Grade {activeStock.ad_info?.ad_rating} ({activeStock.ad_info?.ad_label})
                              </strong>
                            </div>
                            <div className="sc-sec-info-line">
                              <span>Volume Spread (VSA):</span>
                              <strong style={{ color: activeStock.ad_info?.is_squat_warning ? '#f59e0b' : '#38bdf8' }}>
                                {activeStock.ad_info?.vsa_signal}
                              </strong>
                            </div>
                          </div>
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

                      {/* Institutional Undercut & Rally (U&R) Shakeout Box */}
                      {activeStock.ur_info?.has_ur_setup && (
                        <div className="sc-ur-alert-box">
                          <div className="sc-ur-alert-header">
                            <Zap size={22} color="#fbbf24" />
                            <div>
                              <h4>⚡ Institutional Undercut & Rally (U&R) Shakeout Active!</h4>
                              <p>Base support low (${activeStock.ur_info.shakeout_low}) was undercut by {activeStock.ur_info.undercut_pct}% and swiftly reclaimed. High R/R early entry pivot inside the base before the main breakout ceiling!</p>
                            </div>
                          </div>
                          <div className="sc-ur-details-grid">
                            <div className="sc-ur-detail">
                              <span>Early U&R Pivot:</span>
                              <strong style={{ color: '#10b981' }}>${activeStock.ur_info.undercut_pivot}</strong>
                            </div>
                            <div className="sc-ur-detail">
                              <span>Shakeout Low Floor:</span>
                              <strong style={{ color: '#ef4444' }}>${activeStock.ur_info.shakeout_low}</strong>
                            </div>
                            <div className="sc-ur-detail">
                              <span>Headstart to Ceiling:</span>
                              <strong style={{ color: '#38bdf8' }}>+{activeStock.ur_info.gain_to_base_high}%</strong>
                            </div>
                            <div className="sc-ur-detail">
                              <span>Action Directive:</span>
                              <strong>{activeStock.ur_info.action_note}</strong>
                            </div>
                          </div>
                        </div>
                      )}

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

                        {/* Interactive Dynamic Position Sizing Simulator */}
                        <div className="sc-simulator-card">
                          <div className="sc-sim-header">
                            <div className="sc-sim-title-wrap">
                              <Percent size={20} color="#f59e0b" />
                              <div>
                                <h4>Dynamic Account Capital & Risk Position Simulator</h4>
                                <p>Adjust account equity and risk budget to simulate precise position sizing & scale-in orders.</p>
                              </div>
                            </div>

                            <div className="sc-sim-risk-pills">
                              <span className="sc-sim-pill-label">Risk Rule:</span>
                              {[0.5, 1.0, 2.0].map((r) => (
                                <button
                                  key={r}
                                  type="button"
                                  className={`sc-risk-pill ${simulatorRiskPct === r ? 'active' : ''}`}
                                  onClick={() => setSimulatorRiskPct(r)}
                                >
                                  {r}% Risk
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="sc-sim-controls">
                            <div className="sc-slider-wrap">
                              <div className="sc-slider-label-row">
                                <span>Account Portfolio Equity:</span>
                                <strong className="sc-sim-equity-val">${simulatorAccount.toLocaleString()}</strong>
                              </div>
                              <input 
                                type="range" 
                                min="10000" 
                                max="500000" 
                                step="5000"
                                value={simulatorAccount}
                                onChange={(e) => setSimulatorAccount(Number(e.target.value))}
                                className="sc-equity-slider"
                              />
                              <div className="sc-slider-presets">
                                {[25000, 50000, 100000, 250000, 500000].map((amt) => (
                                  <button 
                                    key={amt} 
                                    type="button" 
                                    onClick={() => setSimulatorAccount(amt)} 
                                    className={`sc-preset-btn ${simulatorAccount === amt ? 'active' : ''}`}
                                  >
                                    ${amt >= 1000 ? `${amt / 1000}k` : amt}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Live Computed Sizing Output */}
                          {(() => {
                            const pivot = activeStock.playbook?.pivot_buy_point || activeStock.current_price || 100;
                            const stop = activeStock.playbook?.stop_loss_price || (pivot * 0.93);
                            const riskPerShare = Math.max(0.01, pivot - stop);
                            const totalMaxRiskDollars = simulatorAccount * (simulatorRiskPct / 100);
                            const simShares = Math.max(1, Math.floor(totalMaxRiskDollars / riskPerShare));
                            const totalSimCapital = simShares * pivot;
                            const pctOfAccount = Math.min(100, ((totalSimCapital / simulatorAccount) * 100)).toFixed(1);

                            const t1Shares = Math.round(simShares * 0.5);
                            const t2Shares = Math.round(simShares * 0.3);
                            const t3Shares = Math.max(0, simShares - t1Shares - t2Shares);

                            return (
                              <div className="sc-sim-results-grid">
                                <div className="sc-sim-res-box">
                                  <span className="sc-sim-res-lbl">Max Dollar Risk ({simulatorRiskPct}%)</span>
                                  <strong className="sc-sim-res-val" style={{ color: '#ef4444' }}>${Math.round(totalMaxRiskDollars).toLocaleString()}</strong>
                                  <span className="sc-sim-res-sub">Capital at risk if stop is triggered</span>
                                </div>

                                <div className="sc-sim-res-box">
                                  <span className="sc-sim-res-lbl">Total Position Size</span>
                                  <strong className="sc-sim-res-val" style={{ color: '#10b981' }}>{simShares.toLocaleString()} shares</strong>
                                  <span className="sc-sim-res-sub">Based on ${(riskPerShare).toFixed(2)}/sh stop distance</span>
                                </div>

                                <div className="sc-sim-res-box">
                                  <span className="sc-sim-res-lbl">Total Capital Allocated</span>
                                  <strong className="sc-sim-res-val" style={{ color: '#38bdf8' }}>${Math.round(totalSimCapital).toLocaleString()}</strong>
                                  <span className="sc-sim-res-sub">{pctOfAccount}% of total portfolio</span>
                                </div>

                                <div className="sc-sim-res-box">
                                  <span className="sc-sim-res-lbl">Scale-In Plan (Shares)</span>
                                  <strong className="sc-sim-res-val" style={{ color: '#c084fc', fontSize: '0.95rem' }}>
                                    T1: {t1Shares} • T2: {t2Shares} • T3: {t3Shares}
                                  </strong>
                                  <span className="sc-sim-res-sub">50% Breakout, 30% Confirm, 20% 10w MA</span>
                                </div>
                              </div>
                            );
                          })()}
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

// Dual-Pane SVG Chart (Price Candlesticks + 10w/30w MAs + Pocket Pivots + Mansfield RS + VCP Waves)
function StageChartCanvas({ chartData, playbook, vcp_info, showVcpWaves = true, hoveredWaveIdx, setHoveredWaveIdx, onHover }) {
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
  const height = 440;
  const padding = { top: 32, right: 65, bottom: 20, left: 20 };
  const upperHeight = 280;
  const gap = 20;
  const lowerHeight = height - upperHeight - gap - padding.top - padding.bottom;

  // Zoom & Pan Interactive State
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [sliderPos, setSliderPos] = useState(100);
  const isDraggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartSliderPosRef = useRef(100);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    setZoomLevel(1.0);
    setSliderPos(100);
  }, [chartData?.length]);

  // Compute sliced visible bars based on zoomLevel and sliderPos
  const allBars = chartData || [];
  const baseWindowSize = allBars.length;
  const windowSize = Math.max(12, Math.min(allBars.length, Math.round(baseWindowSize / zoomLevel)));
  const maxOffset = Math.max(0, allBars.length - windowSize);
  const offset = Math.round((sliderPos / 100) * maxOffset);

  const visibleBars = useMemo(() => {
    return allBars.slice(offset, offset + windowSize);
  }, [allBars, offset, windowSize]);

  // Usable canvas dimensions
  const usableWidth = width - padding.left - padding.right;

  // Mouse wheel zoom listener
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handleWheelZoom = (e) => {
      e.preventDefault();
      if (e.deltaY < 0) {
        setZoomLevel(prev => Math.min(4.0, Number((prev * 1.15).toFixed(2))));
      } else {
        setZoomLevel(prev => Math.max(0.6, Number((prev * 0.85).toFixed(2))));
      }
    };
    el.addEventListener('wheel', handleWheelZoom, { passive: false });
    return () => el.removeEventListener('wheel', handleWheelZoom);
  }, []);

  // Mouse drag panning handlers
  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    if (e.target.closest('button') || e.target.closest('input')) return;
    isDraggingRef.current = true;
    dragStartXRef.current = e.clientX;
    dragStartSliderPosRef.current = sliderPos;
    setIsDragging(true);
  };

  const handleMouseMove = (e) => {
    if (isDraggingRef.current && maxOffset > 0) {
      const dx = e.clientX - dragStartXRef.current;
      const pctDelta = (dx / (usableWidth || 800)) * 100 * 0.85;
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

  // Price Scale computed on visible bars
  const prices = visibleBars.flatMap(b => [b.high, b.low, b.ma10, b.ma30, b.pivot_line].filter(p => p !== null && !isNaN(p)));
  const minPrice = prices.length > 0 ? Math.min(...prices) * 0.96 : 10;
  const maxPrice = prices.length > 0 ? Math.max(...prices) * 1.04 : 100;
  const priceRange = maxPrice - minPrice || 1;

  const getY = (val) => {
    if (val === null || isNaN(val)) return 0;
    return padding.top + upperHeight - ((val - minPrice) / priceRange) * upperHeight;
  };

  // Mansfield RS Scale computed on visible bars
  const rsVals = visibleBars.map(b => b.mansfield_rs || 0);
  const maxRsAbs = Math.max(10, Math.max(...rsVals.map(Math.abs))) * 1.15;
  const lowerTop = padding.top + upperHeight + gap;

  const getRsY = (val) => {
    const normalized = (val - (-maxRsAbs)) / (2 * maxRsAbs);
    return lowerTop + lowerHeight - normalized * lowerHeight;
  };

  const zeroRsY = getRsY(0);

  // X coordinate
  const barWidth = Math.max(2, Math.min(22, (usableWidth / Math.max(1, visibleBars.length)) * 0.75));
  const getX = (index) => padding.left + (index / Math.max(1, visibleBars.length - 1)) * usableWidth;

  // Helper to map date string to nearest bar index in visibleBars
  const findNearestBarIndex = (dateStr) => {
    if (!dateStr || !visibleBars || visibleBars.length === 0) return -1;
    const targetTime = new Date(dateStr).getTime();
    let closestIdx = -1;
    let minDiff = Infinity;
    for (let i = 0; i < visibleBars.length; i++) {
      const barTime = new Date(visibleBars[i].date).getTime();
      const diff = Math.abs(barTime - targetTime);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = i;
      }
    }
    if (minDiff > 14 * 86400000) return -1;
    return closestIdx;
  };

  // Calculate VCP Waves coordinates on visibleBars
  const vcpWaves = useMemo(() => {
    if (!vcp_info || !vcp_info.waves_detail || vcp_info.waves_detail.length === 0) return [];
    return vcp_info.waves_detail.map((w, idx) => {
      const pIdx = findNearestBarIndex(w.peak_date);
      const tIdx = findNearestBarIndex(w.trough_date);
      if (pIdx === -1 || tIdx === -1) return null;
      return {
        ...w,
        idx,
        pIdx,
        tIdx,
        xPeak: getX(pIdx),
        yPeak: getY(w.peak_price),
        xTrough: getX(tIdx),
        yTrough: getY(w.trough_price)
      };
    }).filter(Boolean);
  }, [vcp_info, visibleBars, width]);

  // Build MA lines paths on visibleBars
  let ma10Path = '';
  let ma30Path = '';
  let rsPath = '';

  visibleBars.forEach((b, i) => {
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
    <div 
      className={`sc-canvas-container ${isDragging ? 'is-dragging' : ''}`} 
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Floating Interactive Zoom & Pan Controls */}
      <div className="sc-chart-zoom-toolbar">
        <button 
          className="sc-zoom-btn" 
          onClick={() => setZoomLevel(prev => Math.min(4.0, Number((prev * 1.25).toFixed(2))))} 
          title="Zoom In (or Mouse Wheel Up)"
        >
          <ZoomIn size={13} />
        </button>
        <button 
          className="sc-zoom-btn" 
          onClick={() => setZoomLevel(prev => Math.max(0.6, Number((prev * 0.8).toFixed(2))))} 
          title="Zoom Out (or Mouse Wheel Down)"
        >
          <ZoomOut size={13} />
        </button>
        <button 
          className="sc-zoom-btn fit-btn" 
          onClick={() => { setZoomLevel(1.0); setSliderPos(100); }} 
          title="Reset Zoom / Fit View"
        >
          <RotateCcw size={12} />
          <span>{Math.round(zoomLevel * 100)}%</span>
        </button>
        <div className="sc-zoom-badge">
          {visibleBars.length} / {allBars.length} bars
        </div>
      </div>
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
        {visibleBars.map((bar, i) => {
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

        {/* VCP Contraction Waves, Floor/Ceiling Envelopes & Staggered Badges */}
        {showVcpWaves && vcpWaves.length > 0 && (
          <g className="sc-vcp-svg-layer">
            {/* Mark Minervini T1 Master Volatility Envelope Corridor */}
            {vcp_info?.t1_envelope && (() => {
              const t1CeilY = getY(vcp_info.t1_envelope.ceiling);
              const t1FloorY = getY(vcp_info.t1_envelope.floor);
              const xStart = vcpWaves[0]?.xPeak || padding.left;
              const xEnd = width - padding.right;
              const envHeight = Math.max(0, t1FloorY - t1CeilY);
              return (
                <g className="sc-vcp-envelope-layer">
                  <rect
                    x={xStart}
                    y={t1CeilY}
                    width={xEnd - xStart}
                    height={envHeight}
                    fill="rgba(168, 85, 247, 0.05)"
                    stroke="none"
                  />
                  <line
                    x1={xStart}
                    y1={t1CeilY}
                    x2={xEnd}
                    y2={t1CeilY}
                    stroke="#c084fc"
                    strokeWidth="1.5"
                    strokeDasharray="6 4"
                    opacity="0.85"
                  />
                  <text
                    x={xStart + 8}
                    y={t1CeilY - 4}
                    fill="#c084fc"
                    fontSize="9.5"
                    fontWeight="bold"
                  >
                    P1 Base Ceiling: ${vcp_info.t1_envelope.ceiling} ({vcp_info.t1_envelope.depth_pct}% Master Depth)
                  </text>
                  <line
                    x1={xStart}
                    y1={t1FloorY}
                    x2={xEnd}
                    y2={t1FloorY}
                    stroke={vcp_info.has_ascending_floor ? "#f59e0b" : "#ef4444"}
                    strokeWidth="1.5"
                    strokeDasharray="6 4"
                    opacity="0.85"
                  />
                  <text
                    x={xStart + 8}
                    y={t1FloorY + 12}
                    fill={vcp_info.has_ascending_floor ? "#f59e0b" : "#ef4444"}
                    fontSize="9.5"
                    fontWeight="bold"
                  >
                    T1 Base Floor: ${vcp_info.t1_envelope.floor} {vcp_info.has_ascending_floor ? '(Nested Support)' : '(⚠️ Floor Breached)'}
                  </text>
                </g>
              );
            })()}

            {/* Shaded corridor between peak envelope and trough floor */}
            {vcpWaves.length >= 2 && (
              <polygon
                points={`
                  ${vcpWaves.map(w => `${w.xPeak},${w.yPeak}`).join(' ')} 
                  ${[...vcpWaves].reverse().map(w => `${w.xTrough},${w.yTrough}`).join(' ')}
                `}
                fill={vcp_info?.has_ascending_floor ? "rgba(168, 85, 247, 0.07)" : "rgba(239, 68, 68, 0.05)"}
                stroke="none"
              />
            )}

            {/* Ascending / Descending Floor Trendline connecting troughs */}
            {vcpWaves.length >= 2 && (
              <polyline
                points={vcpWaves.map(w => `${w.xTrough},${w.yTrough}`).join(' ')}
                fill="none"
                stroke={vcp_info?.has_ascending_floor ? "#10b981" : "#ef4444"}
                strokeWidth="2"
                strokeDasharray="4 3"
              />
            )}

            {/* Resistance Ceiling line connecting peaks */}
            {vcpWaves.length >= 2 && (
              <polyline
                points={vcpWaves.map(w => `${w.xPeak},${w.yPeak}`).join(' ')}
                fill="none"
                stroke="#a855f7"
                strokeWidth="1.8"
                strokeDasharray="4 3"
                opacity="0.8"
              />
            )}

            {/* Rebound lines between Trough[i] and Peak[i+1] */}
            {vcpWaves.map((w, i) => {
              if (i >= vcpWaves.length - 1) return null;
              const nextWave = vcpWaves[i + 1];
              return (
                <line
                  key={`vcp-rebound-${i}`}
                  x1={w.xTrough}
                  y1={w.yTrough}
                  x2={nextWave.xPeak}
                  y2={nextWave.yPeak}
                  stroke="#38bdf8"
                  strokeWidth="1.2"
                  strokeDasharray="3 3"
                  opacity="0.45"
                />
              );
            })}

            {/* Individual Contraction Waves (Peak -> Trough) with Vertically Staggered Non-Overlapping Badges */}
            {vcpWaves.map((w, i) => {
              const isFloorValid = vcp_info?.has_ascending_floor;
              const isHovered = hoveredWaveIdx === i;
              const isBreach = !w.is_nested || w.is_lower_low;
              // Anti-congestion: Stagger badges vertically so adjacent waves never collide!
              const badgeX = w.xPeak;
              const badgeY = (i % 2 === 0) ? w.yPeak - 14 : w.yPeak - 30;

              return (
                <g 
                  key={`vcp-wave-${i}`} 
                  className="sc-vcp-wave-node"
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() => setHoveredWaveIdx && setHoveredWaveIdx(i)}
                  onMouseLeave={() => setHoveredWaveIdx && setHoveredWaveIdx(null)}
                >
                  {/* Wave Contraction Line */}
                  <line
                    x1={w.xPeak}
                    y1={w.yPeak}
                    x2={w.xTrough}
                    y2={w.yTrough}
                    stroke={isHovered ? "#38bdf8" : (isBreach ? "#ef4444" : "#c084fc")}
                    strokeWidth={isHovered ? "3" : "2"}
                    strokeDasharray={isHovered ? "none" : "4 2"}
                    opacity={hoveredWaveIdx !== null ? (isHovered ? 1.0 : 0.4) : 0.85}
                  />

                  {/* Peak Marker Dot */}
                  <circle 
                    cx={w.xPeak} 
                    cy={w.yPeak} 
                    r={isHovered ? "5.5" : "3.5"} 
                    fill="#a855f7" 
                    stroke="#ffffff" 
                    strokeWidth="1.2" 
                  />

                  {/* Trough Marker Dot */}
                  <circle
                    cx={w.xTrough}
                    cy={w.yTrough}
                    r={isHovered ? "6.0" : (isBreach ? "4.5" : "3.5")}
                    fill={isBreach ? "#ef4444" : (isFloorValid ? "#10b981" : "#f59e0b")}
                    stroke="#ffffff"
                    strokeWidth="1.2"
                  />

                  {/* Vertically Staggered Compact Badge */}
                  <g transform={`translate(${badgeX}, ${badgeY})`}>
                    <rect
                      x="-25"
                      y="-8"
                      width="50"
                      height="16"
                      rx="4"
                      fill="#0f172a"
                      stroke={isBreach ? "#ef4444" : (isHovered ? "#38bdf8" : "#a855f7")}
                      strokeWidth={isHovered ? "1.8" : "1"}
                      opacity="0.95"
                    />
                    <text
                      x="0"
                      y="3.5"
                      fill={isBreach ? "#f87171" : (isHovered ? "#38bdf8" : "#e9d5ff")}
                      fontSize="8.5"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      {w.wave}: -{w.depth_pct}%
                    </text>
                  </g>

                  {/* Interactive Tooltip Card when Wave is Hovered */}
                  {isHovered && (
                    <g transform={`translate(${Math.min(width - padding.right - 200, Math.max(padding.left, w.xPeak - 40))}, ${Math.max(padding.top, w.yPeak - 65)})`}>
                      <rect
                        x="0"
                        y="0"
                        width="200"
                        height={isBreach ? 64 : 50}
                        rx="6"
                        fill="#0f172a"
                        stroke={isBreach ? "#ef4444" : "#38bdf8"}
                        strokeWidth="1.5"
                      />
                      <text x="8" y="16" fill={isBreach ? "#f87171" : "#38bdf8"} fontSize="10" fontWeight="bold">
                        ⚡ {w.wave} Contraction: -{w.depth_pct}%
                      </text>
                      <text x="8" y="30" fill="#e2e8f0" fontSize="9">
                        ${w.peak_price} ➔ ${w.trough_price} ({w.days || 7} days)
                      </text>
                      {w.dampening_ratio && w.wave !== 'T1' && (
                        <text x="8" y="44" fill="#38bdf8" fontSize="8.5">
                          Halving Ratio: {Math.round(w.dampening_ratio * 100)}% of prior wave
                        </text>
                      )}
                      {!w.is_nested ? (
                        <text x="8" y="58" fill="#ef4444" fontSize="8.5" fontWeight="bold">
                          ⚠️ T1 Floor Breach (${w.trough_price} &lt; ${vcp_info?.t1_envelope?.floor})
                        </text>
                      ) : w.is_lower_low ? (
                        <text x="8" y="58" fill="#f87171" fontSize="8.5" fontWeight="bold">
                          ⚠️ Under-cut Prior Low (Lower Low)
                        </text>
                      ) : null}
                    </g>
                  )}
                </g>
              );
            })}
          </g>
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
          {visibleBars.map((bar, i) => {
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

      {/* Timeline Viewport Scrubber Slider (shown when zoomed in) */}
      {maxOffset > 0 && (
        <div className="sc-pan-slider-bar">
          <span className="sc-pan-date">{visibleBars[0]?.date}</span>
          <input 
            type="range" 
            min="0" 
            max="100" 
            step="0.5"
            value={sliderPos} 
            onChange={(e) => setSliderPos(Number(e.target.value))}
            className="sc-pan-range-slider"
          />
          <span className="sc-pan-date">{visibleBars[visibleBars.length - 1]?.date}</span>
        </div>
      )}
    </div>
  );
}
