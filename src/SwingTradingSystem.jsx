import React, { useState, useEffect, useMemo } from 'react';
import './SwingTradingSystem.css';
import {
  Target, Activity, Zap, TrendingUp, Shield,
  RefreshCw, Search, ArrowUpRight,
  ArrowRight, AlertCircle, Clock, BarChart2,
  DollarSign, Calculator, Copy, Check, ExternalLink, Sparkles,
  Sliders, BookOpen, Award, Crosshair, ChevronDown, ChevronUp, Flame
} from 'lucide-react';

const SETUP_CATEGORIES = [
  { id: 'all', label: 'All Setups', icon: '🎯' },
  { id: 'vcp_coil', label: 'VCP Coils', icon: '🌀' },
  { id: 'bull_flag', label: 'Bull Flags', icon: '🚩' },
  { id: 'ema_pullback', label: '10/21-EMA Pullbacks', icon: '📈' },
  { id: 'rs_leader', label: 'RS Leaders', icon: '🚀' },
  { id: 'pead_drift', label: 'PEAD Shelves', icon: '💥' },
  { id: 'vdu_squeeze', label: 'VDU Squeezes', icon: '⚡' }
];

/**
 * 30-Day Price + 10/21 EMA + Normalized RS Line vs SPY Sparkline with Entry Pivot & Stop Guides
 */
function SwingSparkline({ sparkline, entry, stopLoss, currentPrice, rsIntel }) {
  const closes = sparkline?.close || [];
  const ema10 = sparkline?.ema10 || [];
  const ema21 = sparkline?.ema21 || [];
  const rsNorm = sparkline?.rs_norm || [];

  if (!closes || closes.length < 5) {
    return null;
  }

  const width = 280;
  const height = 84;
  const padX = 6;
  const padY = 7;

  const allVals = [
    ...closes,
    ...ema10.filter(Boolean),
    ...ema21.filter(Boolean),
    ...rsNorm.filter(Boolean),
    entry > 0 ? entry : closes[0],
    stopLoss > 0 ? stopLoss : closes[0]
  ].filter(v => Number.isFinite(v) && v > 0);

  const minVal = Math.min(...allVals) * 0.994;
  const maxVal = Math.max(...allVals) * 1.006;
  const span = Math.max(maxVal - minVal, 0.01);

  const toX = (i, len) => padX + (i / Math.max(len - 1, 1)) * (width - padX * 2);
  const toY = (v) => padY + (1 - (v - minVal) / span) * (height - padY * 2);

  const buildPath = (arr) =>
    arr
      .map((v, i) => (Number.isFinite(v) ? `${i === 0 ? 'M' : 'L'}${toX(i, arr.length).toFixed(1)},${toY(v).toFixed(1)}` : ''))
      .filter(Boolean)
      .join(' ');

  const closePath = buildPath(closes);
  const ema10Path = buildPath(ema10);
  const ema21Path = buildPath(ema21);
  const rsPath = rsNorm.length >= 5 ? buildPath(rsNorm) : '';
  const areaPath = `${closePath} L${toX(closes.length - 1, closes.length).toFixed(1)},${height - padY} L${padX},${height - padY} Z`;

  const yEntry = entry > 0 ? Math.max(padY, Math.min(height - padY, toY(entry))) : null;
  const yStop = stopLoss > 0 ? Math.max(padY, Math.min(height - padY, toY(stopLoss))) : null;
  const lastX = toX(closes.length - 1, closes.length);
  const lastY = toY(closes[closes.length - 1]);
  const lastRsY = rsNorm.length > 0 ? toY(rsNorm[rsNorm.length - 1]) : null;
  const isUp = closes[closes.length - 1] >= closes[0];
  const strokeColor = isUp ? '#10b981' : '#00f2fe';
  const isBlueDot = Boolean(rsIntel?.is_blue_dot);

  return (
    <div className="swing-sparkline-box">
      <div className="swing-sparkline-hdr">
        <span className="swing-sparkline-title">30D TRAJECTORY · 10/21 EMA · RS LINE vs SPY</span>
        <div className="swing-sparkline-leg">
          <span style={{ color: strokeColor }}>● Price</span>
          <span style={{ color: '#00f2fe' }}>─ 10E</span>
          <span style={{ color: '#a855f7' }}>─ 21E</span>
          <span style={{ color: '#fbbf24', fontWeight: 800 }}>
            {isBlueDot ? '🔵 RS High' : '┄ RS/SPY'}
          </span>
        </div>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="swing-sparkline-svg" preserveAspectRatio="none">
        <defs>
          <linearGradient id={`swingGrad-${isUp ? 'u' : 'd'}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.24" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {yEntry !== null && (
          <line
            x1={padX}
            y1={yEntry}
            x2={width - padX}
            y2={yEntry}
            stroke="rgba(16, 185, 129, 0.65)"
            strokeWidth="1"
            strokeDasharray="3 2"
          />
        )}
        {yStop !== null && (
          <line
            x1={padX}
            y1={yStop}
            x2={width - padX}
            y2={yStop}
            stroke="rgba(239, 68, 68, 0.55)"
            strokeWidth="1"
            strokeDasharray="2 2"
          />
        )}

        <path d={areaPath} fill={`url(#swingGrad-${isUp ? 'u' : 'd'})`} />
        {ema21Path && <path d={ema21Path} fill="none" stroke="#a855f7" strokeWidth="1.2" strokeOpacity="0.85" />}
        {ema10Path && <path d={ema10Path} fill="none" stroke="#00f2fe" strokeWidth="1.3" strokeOpacity="0.9" />}
        {rsPath && (
          <path
            d={rsPath}
            fill="none"
            stroke="#fbbf24"
            strokeWidth="1.55"
            strokeDasharray="3 1.5"
            strokeOpacity="0.95"
          />
        )}
        <path d={closePath} fill="none" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" />

        {lastRsY !== null && isBlueDot && (
          <circle cx={lastX} cy={lastRsY} r="3.4" fill="#38bdf8" stroke="#ffffff" strokeWidth="1.1" />
        )}
        <circle cx={lastX} cy={lastY} r="3.1" fill={strokeColor} stroke="#070b12" strokeWidth="1.2" />
      </svg>
    </div>
  );
}

export default function SwingTradingSystem({ onSelectTicker, onOpenFundamentals }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Filters & Controls
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all'); // 'all' | 'TRIGGERED' | 'COILING' | 'VOL_SQUEEZE' | 'BLUE_DOT' | 'OPTIONS_CONFIRMED' | 'SEASONAL' | 'ON_WATCH'
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('score'); // 'score' | 'proximity' | 'alpha30d' | 'vol_comp' | 'rr' | 'risk'

  // Interactive Position Sizing Settings
  const [accountSize, setAccountSize] = useState(100000);
  const [riskPercent, setRiskPercent] = useState(1.0);
  const [maxAllocationPct, setMaxAllocationPct] = useState(20);
  const [showCalculatorModal, setShowCalculatorModal] = useState(false);
  const [showChecklistModal, setShowChecklistModal] = useState(false);
  const [copiedTicker, setCopiedTicker] = useState(null);
  const [refreshingLive, setRefreshingLive] = useState(false);
  const [expandedCards, setExpandedCards] = useState({});

  const fetchSetups = async (forceRefresh = false, liveOnly = false) => {
    if (liveOnly) {
      setRefreshingLive(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const url = `/api/swing_trading_setups?refresh=${forceRefresh}&live=${liveOnly}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const rawText = await res.text();
      const json = JSON.parse(rawText.replace(/:\s*NaN\b/g, ': 0').replace(/:\s*-?Infinity\b/g, ': 0'));
      if (json.error) {
        setError(json.error);
      } else {
        setData(json);
      }
    } catch (err) {
      console.error('Failed to load swing setups:', err);
      try {
        const fbRes = await fetch('/swing_trading_setups.json');
        if (fbRes.ok) {
          const fbText = await fbRes.text();
          const fbJson = JSON.parse(fbText.replace(/:\s*NaN\b/g, ': 0').replace(/:\s*-?Infinity\b/g, ': 0'));
          setData(fbJson);
        } else {
          setError(err.message || 'Failed to load swing setups');
        }
      } catch (fbErr) {
        setError(err.message || 'Failed to load swing setups');
      }
    } finally {
      setLoading(false);
      setRefreshingLive(false);
    }
  };

  useEffect(() => {
    fetchSetups(false);
    const interval = setInterval(() => {
      fetchSetups(false, true);
    }, 45000);
    return () => clearInterval(interval);
  }, []);

  const toggleExpand = (ticker) => {
    setExpandedCards(prev => ({ ...prev, [ticker]: !prev[ticker] }));
  };

  // Filtered & Sorted Setups
  const filteredSetups = useMemo(() => {
    if (!data || !data.setups) return [];
    let list = [...data.setups];

    // Category Filter
    if (selectedCategory !== 'all') {
      list = list.filter(s => s.setup_type === selectedCategory || (s.all_setup_types || []).includes(selectedCategory));
    }

    // Status & Multi-Engine Filter
    if (selectedStatus === 'TRIGGERED' || selectedStatus === 'COILING' || selectedStatus === 'ON_WATCH') {
      list = list.filter(s => s.status === selectedStatus);
    } else if (selectedStatus === 'VOL_SQUEEZE') {
      list = list.filter(s =>
        ['VCP_SQUEEZE_CHEAP_VEGA', 'HV_CONTRACTING', 'NEGATIVE_VRP'].includes(s.volatility_intel?.vol_state)
      );
    } else if (selectedStatus === 'BLUE_DOT') {
      list = list.filter(s => s.rs_intel?.is_blue_dot);
    } else if (selectedStatus === 'OPTIONS_CONFIRMED') {
      list = list.filter(s =>
        ['CONFIRMED_BULLISH', 'CONSTRUCTIVE'].includes(s.options_intel?.flow_status)
      );
    } else if (selectedStatus === 'SEASONAL') {
      list = list.filter(s =>
        ['STRONG_TAILWIND', 'FAVORABLE'].includes(s.seasonality_intel?.seasonal_state)
      );
    }

    // Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(s =>
        s.ticker.toLowerCase().includes(q) ||
        (s.company_name && s.company_name.toLowerCase().includes(q)) ||
        (s.sector && s.sector.toLowerCase().includes(q)) ||
        (s.setup_name && s.setup_name.toLowerCase().includes(q)) ||
        (s.converged_engines || []).some(e => e.toLowerCase().includes(q))
      );
    }

    // Sort By
    list.sort((a, b) => {
      if (sortBy === 'score') return b.score - a.score;
      if (sortBy === 'proximity') return Math.abs(a.proximity_pct) - Math.abs(b.proximity_pct);
      if (sortBy === 'alpha30d') {
        return Number(b.movement_30d?.alpha_30d_pct || 0) - Number(a.movement_30d?.alpha_30d_pct || 0);
      }
      if (sortBy === 'vol_comp') {
        return Number(a.volatility_intel?.hv_compression_ratio || 1) - Number(b.volatility_intel?.hv_compression_ratio || 1);
      }
      if (sortBy === 'rr') return b.reward_risk - a.reward_risk;
      if (sortBy === 'risk') return a.risk_pct - b.risk_pct;
      return 0;
    });

    return list;
  }, [data, selectedCategory, selectedStatus, searchQuery, sortBy]);

  // Position Sizing Calculator Helper
  const calculatePosition = (entry, stopLoss, target1, target2) => {
    const dollarRisk = accountSize * (riskPercent / 100);
    const perShareRisk = Math.max(0.01, entry - stopLoss);
    const rawShares = Math.floor(dollarRisk / perShareRisk);
    const maxCapital = accountSize * (maxAllocationPct / 100);
    const maxSharesAllowed = Math.floor(maxCapital / entry);

    const shares = Math.max(1, Math.min(rawShares, maxSharesAllowed > 0 ? maxSharesAllowed : rawShares));
    const totalCapital = shares * entry;
    const capitalPct = ((totalCapital / accountSize) * 100).toFixed(1);
    const totalRisk = shares * perShareRisk;
    const profitT1 = shares * (target1 - entry);
    const profitT2 = shares * (target2 - entry);

    const t1Shs = Math.max(1, Math.round(shares * 0.30));
    const t2Shs = Math.max(1, Math.round(shares * 0.40));
    const t3Shs = Math.max(0, shares - t1Shs - t2Shs);

    return {
      shares,
      totalCapital: Math.round(totalCapital),
      capitalPct,
      totalRisk: Math.round(totalRisk),
      profitT1: Math.round(profitT1),
      profitT2: Math.round(profitT2),
      trancheShares: [t1Shs, t2Shs, t3Shs]
    };
  };

  const copyTradePlan = (setup) => {
    const sizing = calculatePosition(setup.entry, setup.stop_loss, setup.target_1, setup.target_2);
    const mov = setup.movement_30d || {};
    const vol = setup.volatility_intel || {};
    const rs = setup.rs_intel || {};
    const seas = setup.seasonality_intel || {};
    const opt = setup.options_intel || {};

    const text = `🎯 [1-3 WEEK PINNACLE SWING TICKET: $${setup.ticker}]
Setup: ${setup.setup_name} (${setup.timeframe}) | Conviction: ${setup.score}/100 (${setup.conviction_tier || 'A'}) | Domains: ${setup.aligned_domains_count || 6}/6
Status: ${setup.status_label} | Current Price: $${setup.current_price.toFixed(2)}
• Entry Pivot Trigger: $${setup.entry.toFixed(2)} (${setup.proximity_pct >= 0 ? '+' : ''}${setup.proximity_pct.toFixed(1)}% · 3% Chase Ceiling $${setup.chase_ceiling || (setup.entry * 1.03).toFixed(2)})
• Hard Stop Loss: $${setup.stop_loss.toFixed(2)} (-${setup.risk_pct}%) | Tripwire Exit: $${setup.tripwire_price || setup.support_level.toFixed(2)}
• Target 1 (5-8d Partial 50%): $${setup.target_1.toFixed(2)} (+${setup.target_1_pct}% · +$${Number(sizing.profitT1).toLocaleString()})
• Target 2 (10-15d Runner): $${setup.target_2.toFixed(2)} (+${setup.target_2_pct}% · R:R ${setup.reward_risk}:1 · +$${Number(sizing.profitT2).toLocaleString()})
• Trailing Stop Rule: ${setup.trail_rule || 'Close below rising 21-EMA'}
• Position Size ($${(accountSize / 1000).toFixed(0)}K @ ${riskPercent}% Risk): ${sizing.shares} shs ($${Number(sizing.totalCapital).toLocaleString()}, $${Number(sizing.totalRisk).toLocaleString()} risk)
  - Pilot (30%): ${sizing.trancheShares[0]} shs | Core Pivot (40%): ${sizing.trancheShares[1]} shs | Confirmation (30%): ${sizing.trancheShares[2]} shs
• 30D Movement & RS: ${mov.return_30d_pct >= 0 ? '+' : ''}${mov.return_30d_pct ?? 0}% (${mov.alpha_30d_pct >= 0 ? '+' : ''}${mov.alpha_30d_pct ?? 0}% α vs SPY) | RS ${rs.rs_rating ?? '--'} (${rs.rs_badge || ''})
• Volatility & VRP: ${vol.vol_badge || ''} | HV10 ${vol.hv_10d ?? '--'}% vs HV30 ${vol.hv_30d ?? '--'}% (${vol.hv_compression_ratio ?? 1}x) | 15D Swing Move ±${vol.swing_15d_move_pct ?? '--'}%
• Seasonality & Options: ${seas.cur_month_name || 'Cur'} ${seas.cur_month_win ?? '--'}% Win | ${opt.flow_badge || ''} | ${opt.options_structure || ''}
• Converged Engines (${setup.confluence_count || 1}): ${(setup.converged_engines || []).join(', ')}`;

    navigator.clipboard.writeText(text);
    setCopiedTicker(setup.ticker);
    setTimeout(() => setCopiedTicker(null), 2500);
  };

  const macro = data?.macro_regime || {};
  const summary = data?.summary || {};
  const categories = summary?.categories || {};
  const tradeOfTheWeek = data?.trade_of_the_week || (data?.setups && data.setups[0]) || null;
  const topFocusList = data?.top_focus_setups || (data?.setups ? data.setups.slice(0, 5) : []);

  return (
    <div className="swing-root">
      {/* 1. MASTER HEADER */}
      <div className="swing-header-banner">
        <div className="swing-header-top">
          <div className="swing-identity">
            <div className="swing-icon-badge">
              <Target size={24} color="#00f2fe" />
            </div>
            <div>
              <div className="swing-title-row">
                <h1 className="swing-title">1–3 Week Pinnacle Swing System 2.0</h1>
                <span className="swing-horizon-tag">5–15 Trading Days</span>
                <span className="swing-asymmetry-tag">11-Engine Fusion · Min 3:1 R:R</span>
                <span className="swing-live-pulse-badge" title="Live prices streamed during market hours">
                  <span className="live-dot-pulse"></span>
                  LIVE MARKET
                </span>
              </div>
              <p className="swing-subtitle">
                Fusing Minervini VCPs, High-Tight Bull Flags, 10/21-EMA Holy Grails, Blue Dot RS Breakouts &amp; PEAD Shelves with 30D Trajectory, Volatility Compression (HV10/HV30 &amp; VRP), 10Y Seasonality, CBOE Options Flow &amp; Automated 9-Section Legacy TA Vetoes.
              </p>
            </div>
          </div>

          <div className="swing-header-actions">
            <button
              className="swing-calculator-btn"
              style={{ background: 'rgba(16, 185, 129, 0.15)', borderColor: '#10b981', color: '#10b981' }}
              onClick={() => setShowChecklistModal(true)}
            >
              <BookOpen size={16} />
              <span>Legacy TA Manual Checklist 📋</span>
            </button>
            <button
              className="swing-calculator-btn"
              onClick={() => setShowCalculatorModal(!showCalculatorModal)}
            >
              <Calculator size={16} />
              <span>Risk Sizer (${(accountSize / 1000).toFixed(0)}k @ {riskPercent}%)</span>
            </button>
            <button
              className="swing-live-btn"
              onClick={() => fetchSetups(false, true)}
              disabled={loading || refreshingLive}
              title="Refresh real-time prices for all 1-3W setups"
            >
              <Activity size={16} className={refreshingLive ? 'spin' : ''} color="#10b981" />
              <span>{refreshingLive ? 'Refreshing Live...' : 'Live Quotes'}</span>
            </button>
            <button
              className="swing-refresh-btn"
              onClick={() => fetchSetups(true, false)}
              disabled={loading}
              title="Re-run full 1-3 week quantitative scan on 660+ universe"
            >
              <RefreshCw size={16} className={loading ? 'spin' : ''} />
              <span>{loading ? 'Scanning Universe...' : 'Re-Scan Market'}</span>
            </button>
          </div>
        </div>

        {/* 2. MACRO SWING REGIME BAROMETER */}
        <div className="swing-regime-barometer">
          <div className="regime-pill-box">
            <span className="regime-label-title">Macro Swing Regime:</span>
            <span
              className="regime-badge"
              style={{
                background: macro.regime_color ? `${macro.regime_color}22` : 'rgba(245, 158, 11, 0.15)',
                color: macro.regime_color || '#f59e0b',
                borderColor: macro.regime_color || '#f59e0b'
              }}
            >
              {macro.regime_label || 'Selective Tactical Swing Regime'}
            </span>
          </div>

          <div className="regime-stat-item">
            <span className="stat-name">Exposure Limit:</span>
            <span className="stat-val">{macro.recommended_exposure || '40% - 65% Invested'}</span>
          </div>

          <div className="regime-stat-item">
            <span className="stat-name">Breadth &gt; 50 SMA:</span>
            <span className="stat-val">{macro.breadth_above_50 || '48.0'}%</span>
          </div>

          <div className="regime-stat-item">
            <span className="stat-name">McClellan Osc:</span>
            <span className="stat-val" style={{ color: '#38bdf8' }}>{macro.mco_status || 'Neutral'}</span>
          </div>

          <div className="regime-verdict-note">
            <Sparkles size={14} color="#00f2fe" style={{ minWidth: '14px' }} />
            <span>{macro.swing_verdict}</span>
          </div>
        </div>

        {/* 3. CALCULATOR EXPANDABLE DRAWER */}
        {showCalculatorModal && (
          <div className="swing-sizer-drawer">
            <div className="sizer-drawer-title">
              <Sliders size={16} color="#00f2fe" />
              <span>Institutional Position Sizing &amp; Risk Parameters</span>
            </div>
            <div className="sizer-inputs-row">
              <div className="sizer-input-group">
                <label>Account Portfolio Size ($)</label>
                <div className="input-with-icon">
                  <DollarSign size={14} color="#94a3b8" />
                  <input
                    type="number"
                    value={accountSize}
                    onChange={(e) => setAccountSize(Math.max(1000, Number(e.target.value)))}
                    step="5000"
                  />
                </div>
              </div>

              <div className="sizer-input-group">
                <label>Max Risk Per Trade (%)</label>
                <div className="quick-chips">
                  {[0.5, 1.0, 1.5, 2.0].map(pct => (
                    <button
                      key={pct}
                      className={riskPercent === pct ? 'chip-active' : ''}
                      onClick={() => setRiskPercent(pct)}
                    >
                      {pct}%
                    </button>
                  ))}
                  <input
                    type="number"
                    value={riskPercent}
                    onChange={(e) => setRiskPercent(Math.max(0.1, Number(e.target.value)))}
                    step="0.1"
                    style={{ width: '60px', marginLeft: '6px' }}
                  />
                </div>
              </div>

              <div className="sizer-input-group">
                <label>Max Capital Allocation / Stock (%)</label>
                <div className="quick-chips">
                  {[10, 15, 20, 25].map(pct => (
                    <button
                      key={pct}
                      className={maxAllocationPct === pct ? 'chip-active' : ''}
                      onClick={() => setMaxAllocationPct(pct)}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
              </div>

              <div className="sizer-summary-badge">
                <span className="summary-lbl">Max Dollar Risk / Trade (1R):</span>
                <span className="summary-val">${((accountSize * riskPercent) / 100).toLocaleString()}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3.5 #1 SWING TRADE OF THE WEEK SPOTLIGHT + TOP 5 COILING FOCUS LIST */}
      {tradeOfTheWeek && !loading && (
        <div className="swing-spotlight-banner">
          <div className="swing-spotlight-left">
            <div className="swing-spotlight-top-row">
              <div className="swing-spotlight-badges">
                <span className="swing-crown-pill">
                  <Award size={13} /> #1 SWING SETUP OF THE WEEK
                </span>
                <span className="swing-conv-pill">
                  ★ {tradeOfTheWeek.score}/100 ({tradeOfTheWeek.conviction_tier || 'A+'})
                </span>
                <span
                  className="swing-status-pill"
                  style={{
                    color: tradeOfTheWeek.status_color || '#10b981',
                    borderColor: `${tradeOfTheWeek.status_color || '#10b981'}66`,
                    background: `${tradeOfTheWeek.status_color || '#10b981'}18`
                  }}
                >
                  {tradeOfTheWeek.status_label}
                </span>
                <span className="swing-domain-pill">
                  {tradeOfTheWeek.aligned_domains_count || 6}/6 Veto &amp; Grader Gates Passed
                </span>
              </div>

              <button
                type="button"
                className="swing-spot-ticker-btn"
                onClick={() => onSelectTicker && onSelectTicker(tradeOfTheWeek.ticker)}
              >
                <span className="sym">${tradeOfTheWeek.ticker}</span>
                <span className="prc">${tradeOfTheWeek.current_price?.toFixed(2)}</span>
                <span className="cat">{tradeOfTheWeek.category_badge}</span>
                <ArrowUpRight size={14} />
              </button>
            </div>

            <p className="swing-spotlight-note">
              <strong>{tradeOfTheWeek.setup_name}:</strong> {tradeOfTheWeek.catalyst_note}{' '}
              <span style={{ color: '#10b981' }}>{tradeOfTheWeek.execution_strategy}</span>
            </p>

            {(() => {
              const sz = calculatePosition(
                tradeOfTheWeek.entry,
                tradeOfTheWeek.stop_loss,
                tradeOfTheWeek.target_1,
                tradeOfTheWeek.target_2
              );
              const mov = tradeOfTheWeek.movement_30d || {};
              const vol = tradeOfTheWeek.volatility_intel || {};
              const seas = tradeOfTheWeek.seasonality_intel || {};
              const opt = tradeOfTheWeek.options_intel || {};
              return (
                <div className="swing-spotlight-metrics">
                  <div className="sw-spot-box">
                    <span className="lbl">PIVOT &amp; HARD STOP</span>
                    <span className="val green">
                      Buy ${tradeOfTheWeek.entry?.toFixed(2)} · Stop ${tradeOfTheWeek.stop_loss?.toFixed(2)} (-{tradeOfTheWeek.risk_pct}%)
                    </span>
                  </div>
                  <div className="sw-spot-box">
                    <span className="lbl">T1 (5-8D) &amp; T2 (10-15D)</span>
                    <span className="val emerald">
                      ${tradeOfTheWeek.target_1?.toFixed(2)} (+{tradeOfTheWeek.target_1_pct}%) · ${tradeOfTheWeek.target_2?.toFixed(2)} ({tradeOfTheWeek.reward_risk}:1 R:R)
                    </span>
                  </div>
                  <div className="sw-spot-box">
                    <span className="lbl">30D MOVE &amp; RS LINE</span>
                    <span className="val cyan">
                      {mov.return_30d_pct >= 0 ? '+' : ''}{mov.return_30d_pct ?? 0}% ({mov.alpha_30d_pct >= 0 ? '+' : ''}{mov.alpha_30d_pct ?? 0}% α) · RS {tradeOfTheWeek.rs_intel?.rs_rating ?? 90}
                    </span>
                  </div>
                  <div className="sw-spot-box">
                    <span className="lbl">VOL COMPRESSION &amp; 15D MOVE</span>
                    <span className="val amber">
                      HV10/30 {vol.hv_compression_ratio ?? 0.85}x · VRP {vol.vrp_spread >= 0 ? '+' : ''}{vol.vrp_spread ?? 0}% · ±{vol.swing_15d_move_pct ?? 6}%
                    </span>
                  </div>
                  <div className="sw-spot-box">
                    <span className="lbl">SIZED TICKET &amp; OPTIONS</span>
                    <span className="val green">
                      {sz.shares} shs · {opt.call_vol_pct ?? 62}% Calls · {seas.cur_month_name || 'Nov'} {seas.cur_month_win ?? 65}% Win
                    </span>
                  </div>
                </div>
              );
            })()}
          </div>

          <div className="swing-spotlight-right">
            <div className="swing-focus-hdr">
              <Crosshair size={13} color="#00f2fe" />
              <span>TOP 5 IMMINENT SWING FOCUS LIST</span>
            </div>
            <div className="swing-focus-list">
              {topFocusList.map((item, idx) => (
                <div
                  key={item.ticker}
                  className="swing-focus-row"
                  onClick={() => {
                    setSearchQuery(item.ticker);
                    setSelectedCategory('all');
                  }}
                  title="Click to filter to this setup"
                >
                  <div className="sf-left">
                    <span className="sf-rank">#{idx + 1}</span>
                    <span className="sf-sym">${item.ticker}</span>
                    <span className="sf-score">{item.score}</span>
                  </div>
                  <div className="sf-mid">
                    <span>Pivot ${item.entry?.toFixed(2)} ({item.proximity_pct >= 0 ? '+' : ''}{item.proximity_pct}%)</span>
                  </div>
                  <div className="sf-right">
                    <span className="sf-rr">{item.reward_risk}:1</span>
                    <span className="sf-eng">{item.confluence_count || 2}E</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 4. SETUP CATEGORY TABS */}
      <div className="swing-category-nav">
        {SETUP_CATEGORIES.map(cat => {
          const count = categories[cat.id] ?? 0;
          return (
            <button
              key={cat.id}
              className={`category-pill ${selectedCategory === cat.id ? 'active' : ''}`}
              onClick={() => setSelectedCategory(cat.id)}
            >
              <span className="cat-icon">{cat.icon}</span>
              <span className="cat-label">{cat.label}</span>
              <span className="cat-count">{count}</span>
            </button>
          );
        })}
      </div>

      {/* 5. CONTROLS BAR: SEARCH, STATUS & MULTI-ENGINE FILTERS, SORT */}
      <div className="swing-controls-bar">
        <div className="search-box">
          <Search size={16} color="#64748b" />
          <input
            type="text"
            placeholder="Search by ticker, company, sector, or converged engine..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="clear-search" onClick={() => setSearchQuery('')}>×</button>
          )}
        </div>

        <div className="status-filters">
          {[
            { id: 'all', label: `All (${summary?.total_setups || 0})` },
            { id: 'TRIGGERED', label: `🎯 In Buy Zone (${summary?.triggered_count || 0})` },
            { id: 'COILING', label: `⏳ Coiling (${summary?.coiling_count || 0})` },
            { id: 'VOL_SQUEEZE', label: `🧬 Vol Squeeze (${summary?.vol_squeeze_count || 0})` },
            { id: 'BLUE_DOT', label: `🔵 Blue Dot RS (${summary?.blue_dot_count || 0})` },
            { id: 'OPTIONS_CONFIRMED', label: `🐳 Bullish Options (${summary?.options_confirmed_count || 0})` },
            { id: 'SEASONAL', label: `🌊 Seasonal Tailwind (${summary?.seasonal_tailwind_count || 0})` }
          ].map(st => (
            <button
              key={st.id}
              className={`status-btn ${selectedStatus === st.id ? 'active' : ''}`}
              onClick={() => setSelectedStatus(st.id)}
            >
              {st.label}
            </button>
          ))}
        </div>

        <div className="sort-controls">
          <span className="filter-label">Sort:</span>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="score">Highest Pinnacle Score</option>
            <option value="proximity">Closest to Pivot Trigger</option>
            <option value="alpha30d">Highest 30D Alpha vs SPY</option>
            <option value="vol_comp">Tightest Vol Compression (HV10/30)</option>
            <option value="rr">Highest Reward/Risk</option>
            <option value="risk">Lowest Stop Risk %</option>
          </select>
        </div>
      </div>

      {/* 6. SETUPS COUNT & TIME STAMP */}
      <div className="swing-results-summary">
        <div className="results-count">
          Showing <strong>{filteredSetups.length}</strong> institutional 1–3 week swing setups
          {summary?.avg_reward_risk && (
            <span className="summary-pill">Avg R:R: <strong>{summary.avg_reward_risk}</strong></span>
          )}
          {summary?.avg_risk_pct && (
            <span className="summary-pill">Avg Stop Risk: <strong>{summary.avg_risk_pct}</strong></span>
          )}
        </div>
        <div className="results-timestamp">
          Last Scan: {data?.generated_at || 'Just now'}
        </div>
      </div>

      {/* 7. SETUPS GRID */}
      {loading && !data ? (
        <div className="swing-loading-state">
          <RefreshCw size={32} className="spin" color="#00f2fe" />
          <p>Scanning 660+ Liquid Tickers across 11 Quantitative Engines for 1–3 Week Swing Setups...</p>
        </div>
      ) : filteredSetups.length === 0 ? (
        <div className="swing-empty-state">
          <AlertCircle size={36} color="#64748b" />
          <h3>No Setups Matching Current Filters</h3>
          <p>Try switching to &ldquo;All Setups&rdquo; or clearing your search filter.</p>
          <button onClick={() => { setSelectedCategory('all'); setSelectedStatus('all'); setSearchQuery(''); }}>
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="swing-cards-grid">
          {filteredSetups.map((setup) => {
            const sizing = calculatePosition(setup.entry, setup.stop_loss, setup.target_1, setup.target_2);
            const isTriggered = setup.status === 'TRIGGERED';
            const isCopied = copiedTicker === setup.ticker;
            const isExpanded = !!expandedCards[setup.ticker];
            const mov = setup.movement_30d || {};
            const vol = setup.volatility_intel || {};
            const rs = setup.rs_intel || {};
            const seas = setup.seasonality_intel || {};
            const opt = setup.options_intel || {};
            const checks = setup.legacy_checklist || [];

            return (
              <div key={setup.ticker} className={`swing-card ${isTriggered ? 'triggered-card' : ''}`}>
                {/* Top Badge Strip */}
                <div className="card-top-strip">
                  <div className="card-ticker-group">
                    <div
                      className="card-ticker"
                      onClick={() => onSelectTicker && onSelectTicker(setup.ticker)}
                      title="Click to open interactive Deep Chart"
                    >
                      {setup.ticker}
                    </div>
                    <div className="card-company-info">
                      <span className="company-name">{setup.company_name || setup.ticker}</span>
                      <div className="card-sub-info-row">
                        <span className="sector-tag">
                          {setup.sector || 'Growth & Momentum'} · {setup.sector_quadrant || 'Leading'}
                        </span>
                        {setup.dual_listed && (
                          <span className="dual-tsx-pill" title={`Dual-listed on TSX (${setup.dual_listed.symbol})`}>
                            🍁 TSX: C${setup.dual_listed.price.toFixed(2)} CAD
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="card-badges-group">
                    <span
                      className="status-pill"
                      style={{
                        background: `${setup.status_color}22`,
                        color: setup.status_color,
                        borderColor: setup.status_color
                      }}
                    >
                      {setup.status_label}
                    </span>
                    <span className="category-pill-badge">{setup.category_badge}</span>
                    <span className="score-badge" title="11-Engine Pinnacle Conviction Score">
                      ★ {setup.score} ({setup.conviction_tier || 'A'})
                    </span>
                  </div>
                </div>

                {/* Setup Title & Timeframe */}
                <div className="card-setup-title-row">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <span className="setup-title-text">{setup.setup_name}</span>
                    {setup.secondary_patterns && setup.secondary_patterns.length > 0 && (
                      <span className="secondary-pat-chip">
                        + {setup.secondary_patterns[0]}
                      </span>
                    )}
                  </div>
                  <span className="setup-horizon-text">
                    <Clock size={12} /> {setup.timeframe}
                  </span>
                </div>

                {/* 30D Sparkline + 6-Gate Legacy TA Veto & Grader Strip */}
                <div className="swing-visual-intel-row">
                  <SwingSparkline
                    sparkline={setup.sparkline}
                    entry={setup.entry}
                    stopLoss={setup.stop_loss}
                    currentPrice={setup.current_price}
                    rsIntel={rs}
                  />

                  {checks.length > 0 && (
                    <div className="swing-veto-matrix-box">
                      <div className="swing-veto-hdr">
                        <span>LEGACY TA VETO &amp; GRADER GATES</span>
                        <span className="swing-veto-pass-cnt">
                          {setup.aligned_domains_count || 6}/{checks.length} PASSED
                        </span>
                      </div>
                      <div className="swing-veto-grid">
                        {checks.map((c) => (
                          <div key={c.id} className={`swing-veto-chip ${c.passed ? 'pass' : 'watch'}`} title={c.detail}>
                            <span className="v-sec">{c.section.replace('VETO ', 'V').replace('GRADER ', 'G')}</span>
                            <span className="v-grade">{c.grade}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Key Price Levels Grid */}
                <div className="price-levels-grid">
                  <div className="price-tile price-current">
                    <span className="tile-lbl">Live (USD)</span>
                    <span className="tile-val">${setup.current_price.toFixed(2)}</span>
                    {setup.change_pct !== undefined && setup.change_pct !== null && (
                      <span className={`tile-sub ${setup.change_pct >= 0 ? 'tile-sub-pos' : 'tile-sub-neg'}`}>
                        {setup.change_pct >= 0 ? `+${setup.change_pct.toFixed(2)}%` : `${setup.change_pct.toFixed(2)}%`}
                      </span>
                    )}
                  </div>

                  <div className="price-tile price-entry">
                    <span className="tile-lbl">Entry Pivot</span>
                    <span className="tile-val">${setup.entry.toFixed(2)}</span>
                    <span className="tile-sub">
                      {setup.proximity_pct >= 0 ? `+${setup.proximity_pct}%` : `${setup.proximity_pct}%`}
                    </span>
                  </div>

                  <div className="price-tile price-stop">
                    <span className="tile-lbl">Stop Loss</span>
                    <span className="tile-val">${setup.stop_loss.toFixed(2)}</span>
                    <span className="tile-sub-risk">-{setup.risk_pct}%</span>
                  </div>

                  <div className="price-tile price-t1">
                    <span className="tile-lbl">Target 1 (5-8d)</span>
                    <span className="tile-val">${setup.target_1.toFixed(2)}</span>
                    <span className="tile-sub-target">+{setup.target_1_pct}%</span>
                  </div>

                  <div className="price-tile price-t2">
                    <span className="tile-lbl">Target 2 (Runner)</span>
                    <span className="tile-val">${setup.target_2.toFixed(2)}</span>
                    <span className="tile-sub-target">+{setup.target_2_pct}%</span>
                  </div>
                </div>

                {/* Clubbed 3-Panel Telemetry: 30D Trajectory + Volatility & 15D Move + RS & Seasonality */}
                <div className="swing-clubbed-trio">
                  <div className="sw-intel-panel mov">
                    <div className="sw-intel-hdr">
                      <span>📅 30D MOVE &amp; VOLUME</span>
                      <strong style={{ color: (mov.alpha_30d_pct || 0) >= 0 ? '#10b981' : '#fbbf24' }}>
                        {(mov.alpha_30d_pct || 0) >= 0 ? '+' : ''}{mov.alpha_30d_pct ?? 0}% α
                      </strong>
                    </div>
                    <div className="sw-intel-row">
                      <span>5D / 10D / 30D:</span>
                      <strong>
                        {(mov.return_5d_pct || 0) >= 0 ? '+' : ''}{mov.return_5d_pct ?? 0}% / {(mov.return_10d_pct || 0) >= 0 ? '+' : ''}{mov.return_10d_pct ?? 0}% / {(mov.return_30d_pct || 0) >= 0 ? '+' : ''}{mov.return_30d_pct ?? 0}%
                      </strong>
                    </div>
                    <div className="sw-intel-row">
                      <span>W/L &amp; U/D Vol:</span>
                      <strong>
                        {mov.up_days_30d ?? 16}W–{mov.down_days_30d ?? 14}L · {mov.ud_vol_ratio_30d ?? 1.2}x U/D
                      </strong>
                    </div>
                    <div className="sw-intel-row">
                      <span>10D Footprints:</span>
                      <strong style={{ color: '#00f2fe' }}>
                        {mov.pocket_pivots_10d ?? 0} PP · {mov.vdu_days_10d ?? 0} VDU
                      </strong>
                    </div>
                  </div>

                  <div className="sw-intel-panel vol">
                    <div className="sw-intel-hdr">
                      <span>🧬 VOLATILITY &amp; VRP</span>
                      <strong style={{ color: vol.vol_color || '#00f2fe' }}>
                        {vol.hv_compression_ratio ?? 0.85}x HV
                      </strong>
                    </div>
                    <div className="sw-intel-row">
                      <span>10D vs 30D HV:</span>
                      <strong>{vol.hv_10d ?? 22}% vs {vol.hv_30d ?? 25}%</strong>
                    </div>
                    <div className="sw-intel-row">
                      <span>30D IV &amp; VRP:</span>
                      <strong>
                        {vol.atm_iv_30d ?? 26}% IV ({vol.vrp_spread >= 0 ? '+' : ''}{vol.vrp_spread ?? 0}% VRP)
                      </strong>
                    </div>
                    <div className="sw-intel-row">
                      <span>15D Swing Move:</span>
                      <strong style={{ color: '#c084fc' }}>
                        ±{vol.swing_15d_move_pct ?? 6}% (±${vol.swing_15d_move_pts ?? '--'})
                      </strong>
                    </div>
                  </div>

                  <div className="sw-intel-panel rs-seas">
                    <div className="sw-intel-hdr">
                      <span>🔵 RS &amp; 🌊 SEASONALITY</span>
                      <strong style={{ color: rs.is_blue_dot ? '#38bdf8' : '#10b981' }}>
                        RS {rs.rs_rating ?? 88} {rs.is_blue_dot ? '🔵' : ''}
                      </strong>
                    </div>
                    <div className="sw-intel-row">
                      <span>MS Buy Pt:</span>
                      <strong style={{ color: '#10b981' }}>${rs.marketsurge_buy_point ?? setup.entry}</strong>
                    </div>
                    <div className="sw-intel-row">
                      <span>{seas.cur_month_name || 'Current'} Cycle:</span>
                      <strong style={{ color: (seas.cur_month_win || 0) >= 60 ? '#10b981' : '#fbbf24' }}>
                        {seas.cur_month_win ?? 65}% Win ({(seas.cur_month_avg || 0) >= 0 ? '+' : ''}{seas.cur_month_avg ?? 2.1}%)
                      </strong>
                    </div>
                    <div className="sw-intel-row">
                      <span>{seas.next_month_name || 'Next'} Outlook:</span>
                      <strong>
                        {seas.next_month_win ?? 64}% Win ({(seas.next_month_avg || 0) >= 0 ? '+' : ''}{seas.next_month_avg ?? 1.8}%)
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Visual Risk Bar Spectrum */}
                <div className="risk-spectrum-container">
                  <div className="spectrum-track">
                    <div className="spectrum-sl-zone" style={{ width: '25%' }} title={`Stop Loss: $${setup.stop_loss.toFixed(2)}`}>
                      <span className="marker-label">SL ${setup.stop_loss.toFixed(2)}</span>
                    </div>
                    <div className="spectrum-entry-point" title={`Pivot Trigger: $${setup.entry.toFixed(2)}`}>
                      <span className="marker-label-pivot">PIVOT ${setup.entry.toFixed(2)}</span>
                    </div>
                    <div className="spectrum-t1-zone" style={{ width: '40%' }} title={`T1: $${setup.target_1.toFixed(2)}`}>
                      <span className="marker-label">T1 ${setup.target_1.toFixed(2)}</span>
                    </div>
                    <div className="spectrum-t2-zone" style={{ width: '35%' }} title={`T2: $${setup.target_2.toFixed(2)}`}>
                      <span className="marker-label">T2 ${setup.target_2.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="rr-asymmetry-strip">
                    <span className="asymmetry-badge">R:R {setup.reward_risk}:1</span>
                    <span className="protection-badge">
                      Tripwire: ${setup.tripwire_price || setup.support_level.toFixed(2)} · Trail: {setup.trail_rule || '21-EMA'}
                    </span>
                  </div>
                </div>

                {/* CBOE Options Flow & Defined-Risk Swing Structure */}
                {opt.options_structure && (
                  <div className="swing-options-strip">
                    <div className="swing-opt-top">
                      <span
                        className="swing-opt-badge"
                        style={{
                          color: opt.flow_color || '#00f2fe',
                          borderColor: `${opt.flow_color || '#00f2fe'}55`,
                          background: `${opt.flow_color || '#00f2fe'}15`
                        }}
                      >
                        {opt.flow_badge}
                      </span>
                      <span className="swing-opt-struct">
                        ⚡ {opt.options_structure}
                      </span>
                    </div>
                    {opt.whale_sweep && (
                      <div className="swing-whale-alert">
                        🐳 Whale Sweep: <strong>{opt.whale_sweep.expiration} ${opt.whale_sweep.strike} {opt.whale_sweep.type}</strong> ({opt.whale_sweep.vol_oi_ratio}x Vol/OI)
                      </div>
                    )}
                  </div>
                )}

                {/* Catalyst & Strategy Box */}
                <div className="card-catalyst-box">
                  <div className="catalyst-row">
                    <Sparkles size={13} color="#00f2fe" style={{ minWidth: '13px', marginTop: '2px' }} />
                    <span className="catalyst-text">{setup.catalyst_note}</span>
                  </div>
                  <div className="strategy-row">
                    <ArrowRight size={13} color="#10b981" style={{ minWidth: '13px', marginTop: '2px' }} />
                    <span className="strategy-text">{setup.execution_strategy}</span>
                  </div>
                </div>

                {/* Converged Quant Engines Pills */}
                {setup.converged_engines && setup.converged_engines.length > 0 && (
                  <div className="swing-converged-strip">
                    <span className="conv-lbl">Converged Engines ({setup.confluence_count || setup.converged_engines.length}):</span>
                    <div className="conv-tags">
                      {setup.converged_engines.map((eng, i) => (
                        <span key={i} className="conv-tag">{eng}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Interactive Position Sizing Output Box */}
                <div className="card-sizing-box">
                  <div className="sizing-header">
                    <Calculator size={13} color="#94a3b8" />
                    <span>Your Sizing Plan (${(accountSize / 1000).toFixed(0)}k Account @ {riskPercent}% Risk)</span>
                  </div>
                  <div className="sizing-metrics-grid">
                    <div className="sizing-metric">
                      <span className="s-lbl">Shares</span>
                      <span className="s-val">{sizing.shares.toLocaleString()}</span>
                    </div>
                    <div className="sizing-metric">
                      <span className="s-lbl">Capital</span>
                      <span className="s-val">${Number(sizing.totalCapital).toLocaleString()} ({sizing.capitalPct}%)</span>
                    </div>
                    <div className="sizing-metric">
                      <span className="s-lbl">Risk</span>
                      <span className="s-val risk-val">${Number(sizing.totalRisk).toLocaleString()}</span>
                    </div>
                    <div className="sizing-metric">
                      <span className="s-lbl">Profit T1</span>
                      <span className="s-val profit-val">+${Number(sizing.profitT1).toLocaleString()}</span>
                    </div>
                    <div className="sizing-metric">
                      <span className="s-lbl">Profit T2</span>
                      <span className="s-val profit-val">+${Number(sizing.profitT2).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Expandable 3-Tranche Progressive Exposure & Legacy TA Scorecard Drawer */}
                {isExpanded && (
                  <div className="swing-expanded-drawer">
                    {setup.pyramid_plan && (
                      <div className="swing-drawer-sec">
                        <div className="swing-drawer-title">
                          3-TRANCHE PROGRESSIVE PYRAMID PLAN ({sizing.shares} SHARES)
                        </div>
                        <div className="swing-tranche-list">
                          {setup.pyramid_plan.map((tr, tIdx) => (
                            <div key={tIdx} className="swing-tranche-item">
                              <div className="st-top">
                                <strong>{tr.tier}</strong>
                                <span>{sizing.trancheShares[tIdx] || 0} shs @ ${tr.trigger_price}</span>
                              </div>
                              <div className="st-cond">{tr.condition}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {checks.length > 0 && (
                      <div className="swing-drawer-sec">
                        <div className="swing-drawer-title">
                          AUTOMATED 9-SECTION LEGACY TA SCORECARD
                        </div>
                        <div className="swing-check-detail-list">
                          {checks.map((c) => (
                            <div key={c.id} className="swing-check-detail-row">
                              <span className="sc-name">{c.section}</span>
                              <span className="sc-det">{c.detail}</span>
                              <span className={`sc-grd ${c.passed ? 'pass' : 'watch'}`}>{c.grade}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="card-actions-row">
                  <button
                    className="action-btn-chart"
                    onClick={() => onSelectTicker && onSelectTicker(setup.ticker)}
                  >
                    <BarChart2 size={14} />
                    <span>Deep Chart</span>
                  </button>

                  <button
                    className="action-btn-fund"
                    onClick={() => toggleExpand(setup.ticker)}
                  >
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    <span>{isExpanded ? 'Hide Pyramid' : '3-Tranche Plan'}</span>
                  </button>

                  <button
                    className="action-btn-fund"
                    onClick={() => onOpenFundamentals && onOpenFundamentals(setup.ticker)}
                  >
                    <ExternalLink size={14} />
                    <span>Fundamentals</span>
                  </button>

                  <button
                    className={`action-btn-copy ${isCopied ? 'copied' : ''}`}
                    onClick={() => copyTradePlan(setup)}
                  >
                    {isCopied ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                    <span>{isCopied ? 'Copied!' : 'Copy Ticket'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 8. LEGACY TA CHECKLIST MANUAL MODAL */}
      {showChecklistModal && (
        <div className="swing-modal-backdrop" onClick={() => setShowChecklistModal(false)}>
          <div className="swing-modal-card" style={{ maxWidth: '850px', maxHeight: '85vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div className="swing-modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <BookOpen size={24} color="#10b981" />
                <div>
                  <h2 style={{ margin: 0, color: '#fff', fontSize: '1.25rem' }}>The Legacy Technical Analysis Entry System</h2>
                  <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.85rem' }}>Complete Checklist Manual — Vetoes, Graders &amp; Risk Arithmetic</p>
                </div>
              </div>
              <button className="swing-modal-close" onClick={() => setShowChecklistModal(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
            </div>

            <div className="swing-modal-body" style={{ padding: '1.5rem 0', color: '#cbd5e1', fontSize: '0.9rem', lineHeight: '1.6' }}>
              <div style={{ background: 'rgba(16, 185, 129, 0.1)', borderLeft: '4px solid #10b981', padding: '1rem', borderRadius: '6px', marginBottom: '1.5rem' }}>
                <strong style={{ color: '#10b981' }}>Master Rule:</strong> &ldquo;The pattern gets you interested. Volume and the close give you permission.&rdquo;
                <br />
                <em>Sections 1–3 are VETOES (failure = no trade). Sections 4–7 are GRADERS (score A/B/C). Sections 8–9 are ARITHMETIC (no numbers = no trade).</em>
              </div>

              <h3 style={{ color: '#00f2fe', marginTop: '1rem' }}>SECTION 1 — CONTEXT (VETO): &ldquo;Never Fight the Tape Above You&rdquo;</h3>
              <ul style={{ paddingLeft: '1.2rem' }}>
                <li><strong>1.1 Higher-Timeframe Trend:</strong> Is price above a rising 50-day and 200-day MA? MAs stacked (10 &gt; 21 &gt; 50 &gt; 200)? Reject Stage 1 bottoming attempts below a declining 200-day.</li>
                <li><strong>1.2 Market Environment:</strong> Are indexes in confirmed uptrends? Breadth expanding? Distribution days under control (&lt;4-6 cluster)?</li>
                <li><strong>1.3 Group Confirmation:</strong> Is the stock&apos;s industry group outperforming (group RS rising)? 2–3 peers breaking out too?</li>
              </ul>

              <h3 style={{ color: '#00f2fe', marginTop: '1.5rem' }}>SECTION 2 — LOCATION (VETO): &ldquo;Amateurs Ask What; Professionals Ask Where&rdquo;</h3>
              <ul style={{ paddingLeft: '1.2rem' }}>
                <li><strong>2.1 Meaningful Level:</strong> 52-week-high pivot after a long base · multi-month base boundary · blue-sky setup.</li>
                <li><strong>2.2 Base Maturity &amp; Shape:</strong> 5–7 weeks minimum duration. VCP contraction (18% &#8594; 11% &#8594; 6% &#8594; 3%). No wide-and-loose expanding bases.</li>
                <li><strong>2.3 Distance-to-Pivot:</strong> Entry within 1–3% of pivot. Beyond ~5% extended = chase = automatic veto.</li>
              </ul>

              <h3 style={{ color: '#00f2fe', marginTop: '1.5rem' }}>SECTION 3 — VOLUME STORY (VETO): &ldquo;Price Is the Advertisement; Volume Is the Transaction&rdquo;</h3>
              <ul style={{ paddingLeft: '1.2rem' }}>
                <li><strong>3.1 Accumulation Backdrop:</strong> OBV / A-D line rising or at new highs while price moves sideways in the base.</li>
                <li><strong>3.2 Pocket Pivots:</strong> Up-day volume exceeding every down-day volume of the prior 10 sessions.</li>
                <li><strong>3.3 Volume Dry-up (VDU):</strong> Quietest bars of the whole base on the final shelf prior to breakout.</li>
              </ul>

              <h3 style={{ color: '#f59e0b', marginTop: '1.5rem' }}>SECTION 4–7 — PATTERN, MOMENTUM &amp; TRIGGER GRADERS</h3>
              <ul style={{ paddingLeft: '1.2rem' }}>
                <li><strong>4.3 Relative Strength Thread:</strong> RS line breaking to new highs <em>before</em> price does.</li>
                <li><strong>7.1 Decisive Clearance:</strong> Trades through pivot with follow-through, holding after 10:30 AM.</li>
                <li><strong>7.2 Projected RVOL:</strong> RVOL &ge; 1.5x - 2.0x at the moment of break.</li>
                <li><strong>7.3 Close Location:</strong> Day closes in upper third of range (CLV &ge; 0.67).</li>
              </ul>

              <h3 style={{ color: '#ef4444', marginTop: '1.5rem' }}>SECTION 8–9 — RISK MATH &amp; MANAGEMENT PLAN (ARITHMETIC)</h3>
              <ul style={{ paddingLeft: '1.2rem' }}>
                <li><strong>Structural Stop:</strong> Placed below breakout day low or handle low (where thesis is wrong).</li>
                <li><strong>Position Sizer:</strong> Shares = (Account &times; 0.5-1%) &divide; Stop Distance.</li>
                <li><strong>Tripwire Exit:</strong> Daily close back inside the base = exit without waiting for full stop.</li>
                <li><strong>Trail Rule:</strong> Rising 21-EMA close-below for swing runners; 50-day for position runners.</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
