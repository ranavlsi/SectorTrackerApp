import React, { useState, useEffect, useMemo, useRef } from 'react';
import './GexProfiler.css';
import {
  Loader2, Zap, Target, TrendingUp, TrendingDown,
  Activity, Compass, Layers, AlertCircle, ArrowUpRight,
  ArrowDownRight, CheckCircle2, Sliders, Info, Eye,
  ChevronDown, ChevronUp, Crosshair, Shield, Sparkles,
  Filter, ArrowRight, ShieldCheck, Check, Maximize2,
  Bot, Cpu, Brain, Flame, Search, RefreshCw, BarChart2,
  AlertTriangle, Briefcase, ChevronRight
} from 'lucide-react';
import {
  ComposedChart, Bar, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ReferenceLine, ResponsiveContainer,
  Line, Area, Legend
} from 'recharts';

export default function GexProfilerSuite({ initialTicker = 'SPY' }) {
  const [ticker, setTicker] = useState(initialTicker || 'SPY');
  const [searchInput, setSearchInput] = useState('');
  const [selectedExpiry, setSelectedExpiry] = useState('ALL');
  const [activeChartMode, setActiveChartMode] = useState('net_gex'); // 'net_gex' | 'call_put_split' | 'vanna_vex' | 'term_structure' | 'oi_heatmap' | 'cumulative'
  const [showMatrixModal, setShowMatrixModal] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const quickTickers = ['SPY', 'QQQ', 'NVDA', 'AAPL', 'TSLA', 'MSFT', 'AMD', 'SMCI'];

  const fetchGex = async (targetTicker, expiry = 'ALL') => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/gex?ticker=${targetTicker}&expiry=${expiry}`);
      const json = await res.json();
      if (json.error) {
        setError(json.error);
      } else {
        setData(json);
      }
    } catch (err) {
      console.error('Failed to load GEX data:', err);
      setError(err.message || 'Failed to fetch options dealer gamma data');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchGex(ticker, selectedExpiry);
  }, [ticker, selectedExpiry]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (!searchInput.trim()) return;
    const clean = searchInput.trim().toUpperCase();
    setTicker(clean);
    setSearchInput('');
  };

  // Extract key analytics from backend payload
  const spot = data?.spot_price || 0;
  const keyLevels = data?.key_levels || {};
  const totals = data?.totals || {};
  const regime = data?.regime || {};
  const pillars = data?.pillars || [];
  const tradeSetup = data?.trade_setup || {};
  const expirations = data?.expirations || [];
  const rawProfile = data?.gex_profile || [];
  const expectedMove = data?.expected_move || null;
  const riskScores = data?.risk_scores || null;
  const greekProjection = data?.greek_projection || null;
  const termStructure = data?.term_structure || [];
  const matrixData = data?.matrix_data || [];

  // Filter strikes within ±12% of spot for high-definition chart visualization
  const filteredProfile = useMemo(() => {
    if (!rawProfile.length || !spot) return rawProfile;
    const lower = spot * 0.88;
    const upper = spot * 1.12;
    const filtered = rawProfile.filter(p => p.strike >= lower && p.strike <= upper);
    return filtered.length > 0 ? filtered : rawProfile;
  }, [rawProfile, spot]);

  // Construct trajectory series including T=0 Spot origin for cone visualization
  const projectionChartData = useMemo(() => {
    if (!greekProjection?.trajectory_series || !spot) return [];
    const startPoint = {
      day: 0,
      label: 'Now',
      base_target: Number(spot.toFixed(2)),
      upper_1sigma: Number(spot.toFixed(2)),
      lower_1sigma: Number(spot.toFixed(2)),
      upper_2sigma: Number(spot.toFixed(2)),
      lower_2sigma: Number(spot.toFixed(2)),
      call_wall: keyLevels.call_wall,
      put_wall: keyLevels.put_wall,
      pin_anchor: greekProjection?.pin_equilibrium_anchor || spot,
    };
    return [startPoint, ...greekProjection.trajectory_series];
  }, [greekProjection, spot, keyLevels]);

  // Format Large Values ($ Millions / Billions)
  const formatDollarGex = (val) => {
    if (val === undefined || val === null) return '$0';
    const absVal = Math.abs(val);
    const sign = val < 0 ? '-' : '+';
    if (absVal >= 1e9) return `${sign}$${(absVal / 1e9).toFixed(2)}B`;
    if (absVal >= 1e6) return `${sign}$${(absVal / 1e6).toFixed(1)}M`;
    if (absVal >= 1e3) return `${sign}$${(absVal / 1e3).toFixed(0)}K`;
    return `${sign}$${absVal.toFixed(0)}`;
  };

  return (
    <div className="gex-root">
      
      {/* ===================================================================== */}
      {/* 1. MASTER TERMINAL COMMAND & TICKER RIBBON                            */}
      {/* ===================================================================== */}
      <div className="gex-header-banner">
        <div className="gex-header-glow" />

        <div className="gex-header-top-row">
          {/* Identity Left */}
          <div className="gex-identity-wrap">
            <div className="gex-logo-box">
              <Zap style={{ width: '22px', height: '22px', color: '#00F0FF' }} />
            </div>
            <div className="gex-titles-block">
              <h1>
                {ticker} <span className="gex-badge-tag">GEX TERMINAL</span>
              </h1>
              <p className="gex-subtitle">
                Institutional Gamma Exposure Profiler · Real-time Market Maker Delta Hedging & Pin Analytics
              </p>
            </div>
          </div>

          {/* Controls Right */}
          <div className="gex-controls-wrap">
            <div className="gex-quick-chips">
              {quickTickers.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTicker(t)}
                  className={`gex-chip-btn ${ticker === t ? 'active' : ''}`}
                >
                  {t}
                </button>
              ))}
            </div>

            <form onSubmit={handleSearch} className="gex-search-form">
              <input
                type="text"
                placeholder="Lookup (e.g. NVDA)"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value.toUpperCase())}
                className="gex-search-input"
              />
              <button type="submit" className="gex-search-btn">
                Scan GEX
              </button>
            </form>
          </div>
        </div>
      </div>

      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0' }}>
          <Loader2 size={44} color="#00F0FF" style={{ animation: 'spin 1s linear infinite', marginBottom: '16px' }} />
          <p style={{ fontFamily: 'JetBrains Mono, monospace', color: '#94a3b8', fontSize: '13px' }}>
            Aggregating multi-expiration options chains & computing dealer gamma surfaces for {ticker}...
          </p>
        </div>
      )}

      {error && !loading && (
        <div style={{ padding: '24px', borderRadius: '12px', background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.3)', color: '#f43f5e', fontFamily: 'JetBrains Mono, monospace' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <AlertCircle size={18} />
            <strong>Options Data Ingestion Error</strong>
          </div>
          <p style={{ margin: 0, fontSize: '13px', color: '#fca5a5' }}>{error}</p>
        </div>
      )}

      {!loading && data && (
        <>
          {/* ===================================================================== */}
          {/* 2. EXECUTIVE AI DEALER GAMMA INTELLIGENCE HERO                        */}
          {/* ===================================================================== */}
          <div className="gex-ai-hero-card">
            <div className="gex-ai-glow-cyan" />
            <div className="gex-ai-glow-purple" />

            <div className="gex-ai-header">
              <div className="gex-ai-titles-left">
                <div className="gex-ai-icon-box">
                  <Brain style={{ width: '22px', height: '22px', color: '#00F0FF' }} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <h2>Quant AI Dealer Gamma Intelligence · {ticker} Positioning</h2>
                    <span className="gex-ai-tag">
                      <Sparkles style={{ width: '12px', height: '12px' }} />
                      LIVE POSITIONING
                    </span>
                  </div>
                  <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: '#94a3b8' }}>
                    Multi-expiry Black-Scholes gamma surface · Zero-gamma crossover, dealer pinning & squeeze risk modeling
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                {expectedMove && (
                  <div className="gex-em-pill">
                    <span className="gex-em-label">1D EXPECTED MOVE:</span>
                    <span className="gex-em-val">±${expectedMove.move_1d} ({expectedMove.move_1d_pct}%)</span>
                    <span className="gex-em-range">[{expectedMove.range_1d[0]} – {expectedMove.range_1d[1]}]</span>
                  </div>
                )}
                <div className="gex-ai-posture-pill">
                  {regime.badge || 'DEALER REGIME'}
                </div>
              </div>
            </div>

            {/* Verdict Hero Box with Dual Risk Meters */}
            <div className="gex-ai-verdict-box">
              <div className="gex-ai-verdict-text">
                <span className="gex-ai-verdict-badge">{regime.badge}</span>
                <h3 className="gex-ai-verdict-title">{regime.title}</h3>
                <p className="gex-ai-verdict-summary">{regime.summary}</p>
              </div>

              {/* Quantitative Risk Dial Gauges: Squeeze & Pin Risk */}
              {riskScores && (
                <div className="gex-risk-meters-wrap">
                  {/* Gauge 1: Gamma Squeeze */}
                  <div className="gex-risk-gauge">
                    <div className="gex-risk-gauge-top">
                      <span className="gex-risk-title">SQUEEZE RISK</span>
                      <Flame size={14} color={riskScores.squeeze_color} />
                    </div>
                    <div className="gex-risk-score-num" style={{ color: riskScores.squeeze_color }}>
                      {riskScores.squeeze_score}<span style={{ fontSize: '11px', color: '#64748b' }}>/100</span>
                    </div>
                    <div className="gex-risk-bar-track">
                      <div
                        className="gex-risk-bar-fill"
                        style={{
                          width: `${riskScores.squeeze_score}%`,
                          backgroundColor: riskScores.squeeze_color
                        }}
                      />
                    </div>
                    <span className="gex-risk-rating" style={{ color: riskScores.squeeze_color }}>
                      {riskScores.squeeze_rating}
                    </span>
                  </div>

                  {/* Gauge 2: Pin Probability */}
                  <div className="gex-risk-gauge">
                    <div className="gex-risk-gauge-top">
                      <span className="gex-risk-title">PIN RISK</span>
                      <Target size={14} color={riskScores.pin_color} />
                    </div>
                    <div className="gex-risk-score-num" style={{ color: riskScores.pin_color }}>
                      {riskScores.pin_score}<span style={{ fontSize: '11px', color: '#64748b' }}>/100</span>
                    </div>
                    <div className="gex-risk-bar-track">
                      <div
                        className="gex-risk-bar-fill"
                        style={{
                          width: `${riskScores.pin_score}%`,
                          backgroundColor: riskScores.pin_color
                        }}
                      />
                    </div>
                    <span className="gex-risk-rating" style={{ color: riskScores.pin_color }}>
                      {riskScores.pin_rating}
                    </span>
                  </div>
                </div>
              )}

              {/* Gamma Range Corridor Preview Box */}
              <div className="gex-corridor-box">
                <div className="gex-corridor-top">
                  <span>Current Spot Price</span>
                  <span style={{ color: '#00F0FF', fontWeight: 700 }}>Real-Time Feed</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                  <span className="gex-corridor-num">${spot.toFixed(2)}</span>
                  <span style={{ fontSize: '12px', fontFamily: 'monospace', color: spot >= keyLevels.zero_gamma ? '#00E676' : '#f43f5e', fontWeight: 800 }}>
                    {spot >= keyLevels.zero_gamma ? '▲ Above Flip' : '▼ Below Flip'}
                  </span>
                </div>
                <div className="gex-corridor-targets">
                  <span>Put Wall: <strong style={{ color: '#f43f5e' }}>${keyLevels.put_wall}</strong></span>
                  <span>Flip: <strong style={{ color: '#00F0FF' }}>${keyLevels.zero_gamma}</strong></span>
                  <span>Call Wall: <strong style={{ color: '#00E676' }}>${keyLevels.call_wall}</strong></span>
                </div>
              </div>
            </div>

            {/* 4-Pillar Diagnostic Grid */}
            <div className="gex-pillars-grid">
              {pillars.map((pillar) => {
                const borderClass = `border-${pillar.color}`;
                return (
                  <div key={pillar.id} className={`gex-pillar-card ${borderClass}`}>
                    <div>
                      <div className="gex-pillar-header">
                        <span className="gex-pillar-title">{pillar.title}</span>
                        <span className={`gex-pillar-status ${pillar.color}`}>{pillar.status}</span>
                      </div>
                      <div className={`gex-pillar-metric ${pillar.color}`}>
                        {pillar.metric}
                      </div>
                      <p className="gex-pillar-takeaway">
                        {pillar.takeaway}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ================================================================= */}
            {/* 3. QUANT AI ENTRY & POSITION ARCHITECTURE DECK                    */}
            {/* ================================================================= */}
            {data?.trade_setup && (
              <div className="gex-entry-plan-card">
                <div className="gex-entry-plan-header">
                  <div className="gex-entry-plan-title-box">
                    <div className="gex-entry-icon-box">
                      <Target style={{ width: '18px', height: '18px', color: '#00E676' }} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <h4 className="gex-entry-main-heading">
                          Quant AI Dealer Execution Plan · {tradeSetup.setup_name}
                        </h4>
                        <span className={`gex-entry-badge ${tradeSetup.bias_color || 'emerald'}`}>
                          <Sparkles style={{ width: '10px', height: '10px' }} />
                          {tradeSetup.bias || 'GEX TRIGGER'}
                        </span>
                      </div>
                      <p className="gex-entry-subheading">
                        {tradeSetup.strategy_name ? `${tradeSetup.strategy_name} · ` : ''}
                        Algorithmic entries anchored to dealer hedging flip points, Call/Put walls, and OpEx pin gravitational magnets
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    {tradeSetup.sizing_recommendation && (
                      <div className="gex-entry-allocation-pill" style={{ borderColor: 'rgba(0, 230, 118, 0.3)', color: '#00E676' }}>
                        <ShieldCheck style={{ width: '13px', height: '13px', color: '#00E676' }} />
                        <span>{tradeSetup.sizing_recommendation}</span>
                      </div>
                    )}
                    <div className="gex-entry-allocation-pill">
                      <Briefcase style={{ width: '13px', height: '13px', color: '#00F0FF' }} />
                      <span>R/R {tradeSetup.risk_reward || '1:3.0'} {tradeSetup.risk_reward_t2 ? `(T2: ${tradeSetup.risk_reward_t2})` : ''}</span>
                    </div>
                  </div>
                </div>

                <div className="gex-entry-metrics-grid">
                  {/* 1. Optimal Trigger / Accumulation Corridor */}
                  <div className="gex-entry-tile primary">
                    <div className="gex-entry-tile-top">
                      <span className="label">Accumulation Corridor</span>
                      <span className="tag green">ENTRY</span>
                    </div>
                    <div className="gex-entry-val green" style={{ fontSize: tradeSetup.entry_range ? '15px' : '18px' }}>
                      {tradeSetup.entry_range
                        ? `$${tradeSetup.entry_range[0]} ── $${tradeSetup.entry_range[1]}`
                        : `$${tradeSetup.ideal_entry}`}
                    </div>
                    <div className="gex-entry-sub">
                      Spot: ${spot.toFixed(2)} {tradeSetup.entry_range && spot >= tradeSetup.entry_range[0] && spot <= tradeSetup.entry_range[1] ? '🎯 In Corridor' : ''}
                    </div>
                  </div>

                  {/* 2. Structural Invalidation Sentinel */}
                  <div className="gex-entry-tile">
                    <div className="gex-entry-tile-top">
                      <span className="label">Invalidation Stop</span>
                      <span className="tag rose">STOP LOSS</span>
                    </div>
                    <div className="gex-entry-val rose">
                      ${tradeSetup.stop_loss}
                    </div>
                    <div className="gex-entry-sub">
                      Risk: {tradeSetup.stop_loss_pct !== undefined ? `${tradeSetup.stop_loss_pct}%` : `-${Math.abs(((tradeSetup.ideal_entry - tradeSetup.stop_loss) / tradeSetup.ideal_entry) * 100).toFixed(1)}%`}
                    </div>
                  </div>

                  {/* 3. Primary Pin Target */}
                  <div className="gex-entry-tile">
                    <div className="gex-entry-tile-top">
                      <span className="label">Target 1 (Pin)</span>
                      <span className="tag emerald">TRIM 50%</span>
                    </div>
                    <div className="gex-entry-val emerald">
                      ${tradeSetup.target_primary}
                    </div>
                    <div className="gex-entry-sub" style={{ color: '#00E676' }}>
                      +{tradeSetup.target_primary_pct !== undefined ? `${tradeSetup.target_primary_pct}%` : Math.abs(((tradeSetup.target_primary - tradeSetup.ideal_entry) / tradeSetup.ideal_entry) * 100).toFixed(1)}% Gain
                    </div>
                  </div>

                  {/* 4. Secondary Target Runner */}
                  <div className="gex-entry-tile">
                    <div className="gex-entry-tile-top">
                      <span className="label">Secondary Target</span>
                      <span className="tag purple">RUNNER</span>
                    </div>
                    <div className="gex-entry-val purple">
                      ${tradeSetup.target_secondary}
                    </div>
                    <div className="gex-entry-sub" style={{ color: '#c084fc' }}>
                      +{tradeSetup.target_secondary_pct !== undefined ? `${tradeSetup.target_secondary_pct}%` : ''} Trailing
                    </div>
                  </div>

                  {/* 5. Options Structure */}
                  <div className="gex-entry-tile">
                    <div className="gex-entry-tile-top">
                      <span className="label">Options Contract</span>
                      <span className="tag cyan">STRATEGY</span>
                    </div>
                    <div className="gex-entry-val cyan" style={{ fontSize: '11px', lineHeight: '1.4', marginTop: '4px' }}>
                      {tradeSetup.options_spec || tradeSetup.strategy_name || 'Vertical Spread'}
                    </div>
                    <div className="gex-entry-sub">
                      Horizon: {tradeSetup.expected_holding || '3-8 Days'}
                    </div>
                  </div>

                  {/* 6. Asymmetry & Sizing */}
                  <div className="gex-entry-tile">
                    <div className="gex-entry-tile-top">
                      <span className="label">Quant Asymmetry</span>
                      <span className="tag amber">R:R EDGE</span>
                    </div>
                    <div className="gex-entry-val amber">
                      {tradeSetup.risk_reward}
                    </div>
                    <div className="gex-entry-sub">
                      Max Pain: ${tradeSetup.max_pain_pin || '---'}
                    </div>
                  </div>
                </div>

                {/* 5-Phase Execution Checklist */}
                {tradeSetup.execution_checklist && tradeSetup.execution_checklist.length > 0 && (
                  <div className="gex-checklist-box">
                    <div className="gex-checklist-header">
                      <div className="gex-checklist-title">
                        <CheckCircle2 style={{ width: '15px', height: '15px', color: '#00F0FF' }} />
                        <span>5-Phase Institutional Execution Protocol</span>
                      </div>
                      <span style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'JetBrains Mono, monospace' }}>
                        Rigorous Invalidation & Scale-Out Discipline
                      </span>
                    </div>
                    <div className="gex-checklist-grid">
                      {tradeSetup.execution_checklist.map((step, idx) => (
                        <div key={idx} className="gex-checklist-step">
                          <div className="step-badge">{idx + 1}</div>
                          <div className="step-content">
                            <span className="step-phase">{step.phase}</span>
                            <span className="step-detail">{step.detail}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ================================================================= */}
            {/* 3B. QUANTITATIVE GREEK PRICE PROJECTIONS (5D & 20D HORIZON)       */}
            {/* ================================================================= */}
            {greekProjection && (
              <div className="gex-projections-container">
                <div className="gex-projections-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div className="gex-proj-icon-box">
                      <TrendingUp style={{ width: '18px', height: '18px', color: '#00F0FF' }} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <h4 className="gex-entry-main-heading">
                          Quantitative Greek Price Projections · 5-Day & 20-Day Model
                        </h4>
                        <span className="gex-ai-tag">
                          <Brain style={{ width: '10px', height: '10px' }} />
                          SDE JUMP-DIFFUSION
                        </span>
                      </div>
                      <p className="gex-entry-subheading">
                        Mathematical framework: Gamma-Attenuated Ornstein-Uhlenbeck Mean Reversion + Vanna Delta Drift Vector
                      </p>
                    </div>
                  </div>

                  <div className="gex-proj-vol-badge">
                    <Activity size={13} color="#c084fc" />
                    <span>Realized Vol Compression: {greekProjection.effective_realized_vol_pct}%</span>
                  </div>
                </div>

                {/* Dual Horizon Cards (5-Day & 20-Day) */}
                <div className="gex-horizons-grid">
                  {/* 5-Day Projection Card */}
                  <div className="gex-horizon-card">
                    <div className="gex-horizon-card-top">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="gex-horizon-badge cyan">5-DAY OUTLOOK</span>
                        <span className="gex-horizon-title">Next Week OpEx Pin</span>
                      </div>
                      <div className="gex-horizon-ret-pill" style={{ color: greekProjection.proj_5d.base_return_pct >= 0 ? '#00E676' : '#f43f5e' }}>
                        {greekProjection.proj_5d.base_return_pct >= 0 ? '+' : ''}{greekProjection.proj_5d.base_return_pct}% Exp Return
                      </div>
                    </div>

                    <div className="gex-horizon-main-target">
                      <span className="label">Projected Median Pin</span>
                      <div className="val cyan">${greekProjection.proj_5d.base_target}</div>
                      <span className="sub">Anchor: Max Pain ${greekProjection.pin_equilibrium_anchor}</span>
                    </div>

                    {/* Confidence Corridors */}
                    <div className="gex-conf-corridors">
                      <div className="gex-conf-row">
                        <span className="conf-label">68% Confidence (±1σ)</span>
                        <span className="conf-val">${greekProjection.proj_5d.lower_1sigma} ── ${greekProjection.proj_5d.upper_1sigma}</span>
                      </div>
                      <div className="gex-conf-row">
                        <span className="conf-label">95% Confidence (±2σ)</span>
                        <span className="conf-val">${greekProjection.proj_5d.lower_2sigma} ── ${greekProjection.proj_5d.upper_2sigma}</span>
                      </div>
                    </div>

                    {/* Scenarios Mini-Bar */}
                    <div className="gex-scenario-minibar">
                      <div className="scen-item">
                        <span className="scen-lbl">Bull Squeeze</span>
                        <span className="scen-val emerald">${greekProjection.proj_5d.bull_squeeze_target}</span>
                      </div>
                      <div className="scen-item">
                        <span className="scen-lbl">Base Pin</span>
                        <span className="scen-val cyan">${greekProjection.proj_5d.base_target}</span>
                      </div>
                      <div className="scen-item">
                        <span className="scen-lbl">Bear Cascade</span>
                        <span className="scen-val rose">${greekProjection.proj_5d.bear_cascade_target}</span>
                      </div>
                    </div>
                  </div>

                  {/* 20-Day Projection Card */}
                  <div className="gex-horizon-card">
                    <div className="gex-horizon-card-top">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="gex-horizon-badge purple">20-DAY OUTLOOK</span>
                        <span className="gex-horizon-title">Monthly OpEx Horizon</span>
                      </div>
                      <div className="gex-horizon-ret-pill" style={{ color: greekProjection.proj_20d.base_return_pct >= 0 ? '#00E676' : '#f43f5e' }}>
                        {greekProjection.proj_20d.base_return_pct >= 0 ? '+' : ''}{greekProjection.proj_20d.base_return_pct}% Exp Return
                      </div>
                    </div>

                    <div className="gex-horizon-main-target">
                      <span className="label">Projected Monthly Target</span>
                      <div className="val purple">${greekProjection.proj_20d.base_target}</div>
                      <span className="sub">Macro Wall Channel: ${keyLevels.put_wall} ── ${keyLevels.call_wall}</span>
                    </div>

                    {/* Confidence Corridors */}
                    <div className="gex-conf-corridors">
                      <div className="gex-conf-row">
                        <span className="conf-label">68% Confidence (±1σ)</span>
                        <span className="conf-val">${greekProjection.proj_20d.lower_1sigma} ── ${greekProjection.proj_20d.upper_1sigma}</span>
                      </div>
                      <div className="gex-conf-row">
                        <span className="conf-label">95% Confidence (±2σ)</span>
                        <span className="conf-val">${greekProjection.proj_20d.lower_2sigma} ── ${greekProjection.proj_20d.upper_2sigma}</span>
                      </div>
                    </div>

                    {/* Scenarios Mini-Bar */}
                    <div className="gex-scenario-minibar">
                      <div className="scen-item">
                        <span className="scen-lbl">Bull Squeeze</span>
                        <span className="scen-val emerald">${greekProjection.proj_20d.bull_squeeze_target}</span>
                      </div>
                      <div className="scen-item">
                        <span className="scen-lbl">Base Target</span>
                        <span className="scen-val purple">${greekProjection.proj_20d.base_target}</span>
                      </div>
                      <div className="scen-item">
                        <span className="scen-lbl">Bear Cascade</span>
                        <span className="scen-val rose">${greekProjection.proj_20d.bear_cascade_target}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3-Way Greek Scenario Probability Deck */}
                <div className="gex-scenario-cards-grid">
                  {greekProjection.scenarios.map((scen) => (
                    <div key={scen.id} className={`gex-scen-card border-${scen.color}`}>
                      <div className="gex-scen-card-top">
                        <span className="gex-scen-name">{scen.name}</span>
                        <span className={`gex-scen-prob-badge ${scen.color}`}>{scen.probability} Probability</span>
                      </div>
                      <div className="gex-scen-targets-row">
                        <div>
                          <span className="t-lbl">5D Target:</span>
                          <span className={`t-val ${scen.color}`}>{scen.target_5d}</span>
                        </div>
                        <div>
                          <span className="t-lbl">20D Target:</span>
                          <span className={`t-val ${scen.color}`}>{scen.target_20d}</span>
                        </div>
                      </div>
                      <p className="gex-scen-narrative">{scen.narrative}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ===================================================================== */}
          {/* 4. KEY STRUCTURAL TELEMETRY STRIP                                     */}
          {/* ===================================================================== */}
          <div className="gex-kpis-strip">
            <div className="gex-kpi-tile">
              <span className="gex-kpi-label">Call Wall (Resistance)</span>
              <div className="gex-kpi-val" style={{ color: '#00E676' }}>
                ${keyLevels.call_wall}
              </div>
              <span className="gex-kpi-sub">Major overhead ceiling</span>
            </div>

            <div className="gex-kpi-tile">
              <span className="gex-kpi-label">Put Wall (Support)</span>
              <div className="gex-kpi-val" style={{ color: '#f43f5e' }}>
                ${keyLevels.put_wall}
              </div>
              <span className="gex-kpi-sub">Major downside support floor</span>
            </div>

            <div className="gex-kpi-tile">
              <span className="gex-kpi-label">Zero Gamma Flip Point</span>
              <div className="gex-kpi-val" style={{ color: '#00F0FF' }}>
                ${keyLevels.zero_gamma}
              </div>
              <span className="gex-kpi-sub">Volatility inflection line</span>
            </div>

            <div className="gex-kpi-tile">
              <span className="gex-kpi-label">Max Pain Strike</span>
              <div className="gex-kpi-val" style={{ color: '#fbbf24' }}>
                ${keyLevels.max_pain}
              </div>
              <span className="gex-kpi-sub">Maximum financial pain pin</span>
            </div>

            <div className="gex-kpi-tile">
              <span className="gex-kpi-label">Total Net Dollar Gamma</span>
              <div className="gex-kpi-val" style={{ color: totals.total_net_gex >= 0 ? '#00E676' : '#f43f5e' }}>
                {formatDollarGex(totals.total_net_gex)}
              </div>
              <span className="gex-kpi-sub">Dealer $ per 1% move</span>
            </div>

            <div className="gex-kpi-tile">
              <span className="gex-kpi-label">Put / Call OI Ratio</span>
              <div className="gex-kpi-val" style={{ color: totals.put_call_oi_ratio > 1.2 ? '#f43f5e' : (totals.put_call_oi_ratio < 0.8 ? '#00E676' : '#ffffff') }}>
                {totals.put_call_oi_ratio}x
              </div>
              <span className="gex-kpi-sub">
                {totals.put_call_oi_ratio > 1.2 ? 'Heavy Put Skew' : (totals.put_call_oi_ratio < 0.8 ? 'Heavy Call Skew' : 'Balanced Flow')}
              </span>
            </div>
          </div>

          {/* ===================================================================== */}
          {/* 5. INTERACTIVE GEX VISUALIZER DECK                                    */}
          {/* ===================================================================== */}
          <div className="gex-visualizer-card">
            <div className="gex-visualizer-header">
              <div className="gex-visualizer-left">
                <BarChart2 size={18} color="#00F0FF" />
                <div>
                  <h3 style={{ margin: 0, fontFamily: 'JetBrains Mono, monospace', fontSize: '14px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Interactive Gamma Exposure Surface & Distribution
                  </h3>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                    Filtered view (±12% from spot ${spot.toFixed(2)}) across active strikes
                  </span>
                </div>
              </div>

              {/* Mode Toggles & Expiration Selector */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <div className="gex-mode-toggles">
                  <button
                    type="button"
                    onClick={() => setActiveChartMode('net_gex')}
                    className={`gex-mode-btn ${activeChartMode === 'net_gex' ? 'active' : ''}`}
                  >
                    Net GEX
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveChartMode('call_put_split')}
                    className={`gex-mode-btn ${activeChartMode === 'call_put_split' ? 'active' : ''}`}
                  >
                    Call vs Put GEX
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveChartMode('vanna_vex')}
                    className={`gex-mode-btn ${activeChartMode === 'vanna_vex' ? 'active' : ''}`}
                  >
                    Net Vanna (VEX)
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveChartMode('term_structure')}
                    className={`gex-mode-btn ${activeChartMode === 'term_structure' ? 'active' : ''}`}
                  >
                    Term Structure
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveChartMode('price_projection')}
                    className={`gex-mode-btn ${activeChartMode === 'price_projection' ? 'active' : ''}`}
                  >
                    5D & 20D Projections 🚀
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveChartMode('oi_heatmap')}
                    className={`gex-mode-btn ${activeChartMode === 'oi_heatmap' ? 'active' : ''}`}
                  >
                    OI & Volume
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveChartMode('cumulative')}
                    className={`gex-mode-btn ${activeChartMode === 'cumulative' ? 'active' : ''}`}
                  >
                    Cumulative GEX
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setShowMatrixModal(!showMatrixModal)}
                  className={`gex-matrix-toggle-btn ${showMatrixModal ? 'active' : ''}`}
                >
                  <Layers size={13} />
                  {showMatrixModal ? 'Hide Matrix' : 'Strike × Expiry Matrix'}
                </button>

                {expirations.length > 0 && (
                  <select
                    value={selectedExpiry}
                    onChange={(e) => setSelectedExpiry(e.target.value)}
                    className="gex-expiry-select"
                  >
                    <option value="ALL">All Expirations (Full Chain)</option>
                    <option value="FRONT">Front Expiration (0-5 DTE)</option>
                    {expirations.map((exp) => (
                      <option key={exp} value={exp}>
                        Exp: {exp}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* Interactive Chart */}
            <div className="gex-chart-container">
              <ResponsiveContainer width="100%" height="100%">
                {activeChartMode === 'net_gex' && (
                  <ComposedChart data={filteredProfile} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis
                      dataKey="strike"
                      stroke="#94a3b8"
                      tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}
                      label={{ value: 'Strike Price ($)', position: 'insideBottom', offset: -10, fill: '#94a3b8', fontSize: 11 }}
                    />
                    <YAxis
                      stroke="#94a3b8"
                      tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}
                      tickFormatter={(val) => formatDollarGex(val)}
                      label={{ value: 'Net Dollar Gamma ($)', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 11 }}
                    />
                    <RechartsTooltip
                      contentStyle={{ backgroundColor: 'rgba(10, 14, 23, 0.95)', borderColor: '#334155', borderRadius: '8px', color: 'white', fontFamily: 'monospace' }}
                      formatter={(val, name) => [formatDollarGex(val), name === 'net_gex' ? 'Net Dollar GEX' : name]}
                    />
                    {spot > 0 && (
                      <ReferenceLine
                        x={spot}
                        stroke="#ffffff"
                        strokeDasharray="4 4"
                        strokeWidth={2}
                        label={{ position: 'top', value: `Spot $${spot.toFixed(2)}`, fill: '#ffffff', fontSize: 11, fontWeight: 700 }}
                      />
                    )}
                    {keyLevels.call_wall && (
                      <ReferenceLine
                        x={keyLevels.call_wall}
                        stroke="#00E676"
                        strokeDasharray="3 3"
                        strokeWidth={1.5}
                        label={{ position: 'top', value: `Call Wall $${keyLevels.call_wall}`, fill: '#00E676', fontSize: 10 }}
                      />
                    )}
                    {keyLevels.put_wall && (
                      <ReferenceLine
                        x={keyLevels.put_wall}
                        stroke="#f43f5e"
                        strokeDasharray="3 3"
                        strokeWidth={1.5}
                        label={{ position: 'top', value: `Put Wall $${keyLevels.put_wall}`, fill: '#f43f5e', fontSize: 10 }}
                      />
                    )}
                    {keyLevels.zero_gamma && (
                      <ReferenceLine
                        x={keyLevels.zero_gamma}
                        stroke="#00F0FF"
                        strokeDasharray="2 2"
                        strokeWidth={1.5}
                        label={{ position: 'bottom', value: `Flip $${keyLevels.zero_gamma}`, fill: '#00F0FF', fontSize: 10 }}
                      />
                    )}
                    <Bar dataKey="net_gex" radius={[3, 3, 0, 0]}>
                      {filteredProfile.map((entry, idx) => (
                        <Cell
                          key={`cell-${entry.strike}`}
                          fill={entry.net_gex >= 0 ? '#00E676' : '#f43f5e'}
                          fillOpacity={0.85}
                        />
                      ))}
                    </Bar>
                  </ComposedChart>
                )}

                {activeChartMode === 'call_put_split' && (
                  <ComposedChart data={filteredProfile} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis
                      dataKey="strike"
                      stroke="#94a3b8"
                      tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}
                      label={{ value: 'Strike Price ($)', position: 'insideBottom', offset: -10, fill: '#94a3b8', fontSize: 11 }}
                    />
                    <YAxis
                      stroke="#94a3b8"
                      tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}
                      tickFormatter={(val) => formatDollarGex(val)}
                      label={{ value: 'Dealer Dollar Gamma ($)', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 11 }}
                    />
                    <RechartsTooltip
                      contentStyle={{ backgroundColor: 'rgba(10, 14, 23, 0.95)', borderColor: '#334155', borderRadius: '8px', color: 'white', fontFamily: 'monospace' }}
                      formatter={(val, name) => [formatDollarGex(val), name === 'call_gex' ? 'Call Gamma (Long)' : 'Put Gamma (Short)']}
                    />
                    <Legend wrapperStyle={{ fontFamily: 'monospace', fontSize: '11px', color: '#cbd5e1' }} />
                    {spot > 0 && <ReferenceLine x={spot} stroke="#ffffff" strokeDasharray="4 4" strokeWidth={2} />}
                    <Bar dataKey="call_gex" name="Call GEX" fill="#00E676" fillOpacity={0.7} stackId="a" />
                    <Bar dataKey="put_gex" name="Put GEX" fill="#f43f5e" fillOpacity={0.7} stackId="a" />
                  </ComposedChart>
                )}

                {activeChartMode === 'vanna_vex' && (
                  <ComposedChart data={filteredProfile} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis
                      dataKey="strike"
                      stroke="#94a3b8"
                      tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}
                      label={{ value: 'Strike Price ($)', position: 'insideBottom', offset: -10, fill: '#94a3b8', fontSize: 11 }}
                    />
                    <YAxis
                      stroke="#94a3b8"
                      tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}
                      tickFormatter={(val) => formatDollarGex(val)}
                      label={{ value: 'Net Vanna Exposure ($/1% IV)', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 11 }}
                    />
                    <RechartsTooltip
                      contentStyle={{ backgroundColor: 'rgba(10, 14, 23, 0.95)', borderColor: '#334155', borderRadius: '8px', color: 'white', fontFamily: 'monospace' }}
                      formatter={(val) => [formatDollarGex(val), 'Net Dollar Vanna (VEX)']}
                    />
                    {spot > 0 && (
                      <ReferenceLine
                        x={spot}
                        stroke="#ffffff"
                        strokeDasharray="4 4"
                        strokeWidth={2}
                        label={{ position: 'top', value: `Spot $${spot.toFixed(2)}`, fill: '#ffffff', fontSize: 11, fontWeight: 700 }}
                      />
                    )}
                    <ReferenceLine y={0} stroke="#475569" strokeWidth={1} />
                    <Bar dataKey="net_vex" radius={[3, 3, 0, 0]}>
                      {filteredProfile.map((entry) => (
                        <Cell
                          key={`vcell-${entry.strike}`}
                          fill={entry.net_vex >= 0 ? '#38bdf8' : '#fb7185'}
                          fillOpacity={0.85}
                        />
                      ))}
                    </Bar>
                  </ComposedChart>
                )}

                {activeChartMode === 'term_structure' && (
                  <ComposedChart data={termStructure} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis
                      dataKey="expiry"
                      stroke="#94a3b8"
                      tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}
                      label={{ value: 'Expiration Date (OpEx)', position: 'insideBottom', offset: -10, fill: '#94a3b8', fontSize: 11 }}
                    />
                    <YAxis
                      stroke="#94a3b8"
                      tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}
                      tickFormatter={(val) => formatDollarGex(val)}
                      label={{ value: 'Net Gamma by Expiry ($)', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 11 }}
                    />
                    <RechartsTooltip
                      contentStyle={{ backgroundColor: 'rgba(10, 14, 23, 0.95)', borderColor: '#334155', borderRadius: '8px', color: 'white', fontFamily: 'monospace' }}
                      formatter={(val, name) => [formatDollarGex(val), name === 'net_gex' ? 'Net GEX' : (name === 'call_gex' ? 'Call GEX' : 'Put GEX')]}
                    />
                    <Legend wrapperStyle={{ fontFamily: 'monospace', fontSize: '11px', color: '#cbd5e1' }} />
                    <ReferenceLine y={0} stroke="#475569" strokeWidth={1} />
                    <Bar dataKey="call_gex" name="Call GEX" fill="#00E676" fillOpacity={0.7} stackId="t" />
                    <Bar dataKey="put_gex" name="Put GEX" fill="#f43f5e" fillOpacity={0.7} stackId="t" />
                    <Line type="monotone" dataKey="net_gex" name="Net Term GEX" stroke="#00F0FF" strokeWidth={3} dot={{ r: 4, fill: '#00F0FF' }} />
                  </ComposedChart>
                )}

                {activeChartMode === 'oi_heatmap' && (
                  <ComposedChart data={filteredProfile} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis
                      dataKey="strike"
                      stroke="#94a3b8"
                      tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}
                      label={{ value: 'Strike Price ($)', position: 'insideBottom', offset: -10, fill: '#94a3b8', fontSize: 11 }}
                    />
                    <YAxis
                      stroke="#94a3b8"
                      tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}
                      label={{ value: 'Open Interest Contracts', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 11 }}
                    />
                    <RechartsTooltip
                      contentStyle={{ backgroundColor: 'rgba(10, 14, 23, 0.95)', borderColor: '#334155', borderRadius: '8px', color: 'white', fontFamily: 'monospace' }}
                    />
                    <Legend wrapperStyle={{ fontFamily: 'monospace', fontSize: '11px', color: '#cbd5e1' }} />
                    {spot > 0 && <ReferenceLine x={spot} stroke="#ffffff" strokeDasharray="4 4" strokeWidth={2} />}
                    <Bar dataKey="call_oi" name="Call Open Interest" fill="#38bdf8" fillOpacity={0.8} />
                    <Bar dataKey="put_oi" name="Put Open Interest" fill="#f43f5e" fillOpacity={0.8} />
                  </ComposedChart>
                )}

                {activeChartMode === 'cumulative' && (
                  <ComposedChart data={filteredProfile} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis
                      dataKey="strike"
                      stroke="#94a3b8"
                      tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}
                      label={{ value: 'Strike Price ($)', position: 'insideBottom', offset: -10, fill: '#94a3b8', fontSize: 11 }}
                    />
                    <YAxis
                      stroke="#94a3b8"
                      tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}
                      tickFormatter={(val) => formatDollarGex(val)}
                      label={{ value: 'Cumulative GEX ($)', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 11 }}
                    />
                    <RechartsTooltip
                      contentStyle={{ backgroundColor: 'rgba(10, 14, 23, 0.95)', borderColor: '#334155', borderRadius: '8px', color: 'white', fontFamily: 'monospace' }}
                      formatter={(val) => [formatDollarGex(val), 'Cumulative Dollar GEX']}
                    />
                    {spot > 0 && <ReferenceLine x={spot} stroke="#ffffff" strokeDasharray="4 4" strokeWidth={2} />}
                    <ReferenceLine y={0} stroke="#475569" strokeWidth={1} />
                    <Area
                      type="monotone"
                      dataKey="cumulative_gex"
                      stroke="#00F0FF"
                      strokeWidth={3}
                      fill="rgba(6, 182, 212, 0.15)"
                      name="Cumulative GEX"
                    />
                  </ComposedChart>
                )}

                {activeChartMode === 'price_projection' && (
                  <ComposedChart data={projectionChartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis
                      dataKey="label"
                      stroke="#94a3b8"
                      tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}
                      label={{ value: 'Time Horizon (Trading Days Ahead)', position: 'insideBottom', offset: -10, fill: '#94a3b8', fontSize: 11 }}
                    />
                    <YAxis
                      stroke="#94a3b8"
                      domain={['auto', 'auto']}
                      tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}
                      tickFormatter={(val) => `$${Number(val).toFixed(0)}`}
                      label={{ value: 'Greek SDE Projected Price ($)', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 11 }}
                    />
                    <RechartsTooltip
                      contentStyle={{ backgroundColor: 'rgba(10, 14, 23, 0.95)', borderColor: '#334155', borderRadius: '8px', color: 'white', fontFamily: 'monospace' }}
                      formatter={(val, name) => [`$${Number(val).toFixed(2)}`, name]}
                      labelFormatter={(label) => `Horizon: ${label}`}
                    />
                    <Legend wrapperStyle={{ fontFamily: 'monospace', fontSize: '11px', color: '#cbd5e1' }} />
                    {spot > 0 && (
                      <ReferenceLine
                        y={spot}
                        stroke="#ffffff"
                        strokeDasharray="4 4"
                        strokeWidth={1.5}
                        label={{ position: 'top', value: `Spot $${spot.toFixed(2)}`, fill: '#ffffff', fontSize: 10, fontWeight: 700 }}
                      />
                    )}
                    {keyLevels.call_wall && (
                      <ReferenceLine
                        y={keyLevels.call_wall}
                        stroke="#00E676"
                        strokeDasharray="3 3"
                        strokeWidth={1.5}
                        label={{ position: 'top', value: `Call Wall $${keyLevels.call_wall}`, fill: '#00E676', fontSize: 10 }}
                      />
                    )}
                    {keyLevels.put_wall && (
                      <ReferenceLine
                        y={keyLevels.put_wall}
                        stroke="#f43f5e"
                        strokeDasharray="3 3"
                        strokeWidth={1.5}
                        label={{ position: 'bottom', value: `Put Wall $${keyLevels.put_wall}`, fill: '#f43f5e', fontSize: 10 }}
                      />
                    )}
                    {greekProjection?.pin_equilibrium_anchor && (
                      <ReferenceLine
                        y={greekProjection.pin_equilibrium_anchor}
                        stroke="#38bdf8"
                        strokeDasharray="2 2"
                        strokeWidth={1}
                        label={{ position: 'insideTopLeft', value: `Gamma Pin Equilibrium $${greekProjection.pin_equilibrium_anchor}`, fill: '#38bdf8', fontSize: 10 }}
                      />
                    )}
                    <Line
                      type="monotone"
                      dataKey="upper_2sigma"
                      name="+2σ Bull Expansion (95% Cl)"
                      stroke="#64748b"
                      strokeDasharray="4 4"
                      strokeWidth={1}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="upper_1sigma"
                      name="+1σ Gamma Corridor (68% Cl)"
                      stroke="#c084fc"
                      strokeDasharray="3 3"
                      strokeWidth={1.5}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="base_target"
                      name="Expected Price (Gamma Mean-Reversion + Vanna Drift)"
                      stroke="#00F0FF"
                      strokeWidth={3}
                      dot={{ r: 3, fill: '#00F0FF' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="lower_1sigma"
                      name="-1σ Gamma Corridor (68% Cl)"
                      stroke="#c084fc"
                      strokeDasharray="3 3"
                      strokeWidth={1.5}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="lower_2sigma"
                      name="-2σ Bear Cascade (95% Cl)"
                      stroke="#64748b"
                      strokeDasharray="4 4"
                      strokeWidth={1}
                      dot={false}
                    />
                  </ComposedChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>

          {/* ===================================================================== */}
          {/* 6. DEALER PLAYBOOK & ACTIONABLE STRATEGIES TABLE                      */}
          {/* ===================================================================== */}
          <div className="gex-playbook-card">
            <div className="gex-playbook-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Crosshair size={18} color="#00F0FF" />
                <h3 style={{ margin: 0, fontFamily: 'JetBrains Mono, monospace', fontSize: '14px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Institutional Gamma Playbook & Trigger Rules
                </h3>
              </div>
              <span style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'JetBrains Mono, monospace' }}>
                Rule-Based Delta Hedging Exploits
              </span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="gex-table">
                <thead>
                  <tr>
                    <th>Market Condition</th>
                    <th>Dealer Mechanics</th>
                    <th>Expected Price Behavior</th>
                    <th>Institutional Strategy</th>
                    <th>Trigger Point</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ fontWeight: 800, color: '#38bdf8' }}>
                      Price Above Call Wall 🚀
                    </td>
                    <td>Dealers short gamma; forced to BUY shares as price ascends.</td>
                    <td>Parabolic squeeze velocity, high volume upside drift.</td>
                    <td>Long Calls / Momentum Breakout continuation tranches.</td>
                    <td style={{ color: '#00E676', fontWeight: 700 }}>Break above ${keyLevels.call_wall}</td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 800, color: '#00E676' }}>
                      Long Gamma Channel 🛡️
                    </td>
                    <td>Dealers long gamma; BUY dips and SELL rips against retail.</td>
                    <td>Tight consolidation range; sticky volatility suppression.</td>
                    <td>Iron Condors, Mean-Reversion Scalps, Covered Calls.</td>
                    <td style={{ color: '#00F0FF', fontWeight: 700 }}>Between ${keyLevels.put_wall} and ${keyLevels.call_wall}</td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 800, color: '#fbbf24' }}>
                      Approaching Zero Gamma Flip ⚖️
                    </td>
                    <td>Transition zone between stabilizing and expanding volatility.</td>
                    <td>Chop, false breakouts, and regime shifts.</td>
                    <td>Straddles / Strangle volatility expansion breakout triggers.</td>
                    <td style={{ color: '#fbbf24', fontWeight: 700 }}>Inflection at ${keyLevels.zero_gamma}</td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 800, color: '#f43f5e' }}>
                      Price Below Put Wall 📉
                    </td>
                    <td>Dealers short gamma; forced to aggressively SELL shares.</td>
                    <td>Cascading liquidity air pockets and accelerated downward spikes.</td>
                    <td>Long Puts, Bear Put Spreads, or Long VIX Calls.</td>
                    <td style={{ color: '#f43f5e', fontWeight: 700 }}>Break below ${keyLevels.put_wall}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* ===================================================================== */}
          {/* 7. STRIKE × EXPIRATION MATRIX TABLE MODAL / SECTION                   */}
          {/* ===================================================================== */}
          {showMatrixModal && matrixData.length > 0 && (
            <div className="gex-matrix-card">
                <div className="gex-matrix-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Layers size={18} color="#00F0FF" />
                    <div>
                      <h3 style={{ margin: 0, fontFamily: 'JetBrains Mono, monospace', fontSize: '14px', fontWeight: 800, textTransform: 'uppercase' }}>
                        Strike × Expiration Gamma Matrix Heatmap
                      </h3>
                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                        Pinpoint exact expiration concentration across active strikes
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowMatrixModal(false)}
                    className="gex-matrix-close-btn"
                  >
                    Close Matrix
                  </button>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table className="gex-matrix-table">
                    <thead>
                      <tr>
                        <th>Strike</th>
                        {expirations.slice(0, 6).map((exp) => (
                          <th key={exp}>{exp}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {matrixData.map((row) => {
                        const isAtTheMoney = Math.abs(row.strike - spot) / spot < 0.015;
                        const isCallWall = row.strike === keyLevels.call_wall;
                        const isPutWall = row.strike === keyLevels.put_wall;

                        return (
                          <tr key={row.strike} className={isAtTheMoney ? 'atm-row' : ''}>
                            <td className="strike-cell">
                              ${row.strike.toFixed(1)}
                              {isAtTheMoney && <span className="atm-tag">ATM</span>}
                              {isCallWall && <span className="wall-tag call">CALL WALL</span>}
                              {isPutWall && <span className="wall-tag put">PUT WALL</span>}
                            </td>
                            {expirations.slice(0, 6).map((exp) => {
                              const val = row[exp] || 0;
                              const isPos = val >= 0;
                              return (
                                <td
                                  key={exp}
                                  className="matrix-val-cell"
                                  style={{
                                    color: isPos ? '#00E676' : '#f43f5e',
                                    background: isPos
                                      ? `rgba(0, 230, 118, ${Math.min(0.25, Math.abs(val) / 5e7)})`
                                      : `rgba(244, 63, 94, ${Math.min(0.25, Math.abs(val) / 5e7)})`
                                  }}
                                >
                                  {formatDollarGex(val)}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
        </>
      )}
    </div>
  );
}
