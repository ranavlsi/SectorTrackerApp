import React, { useState, useEffect, useMemo } from 'react';
import './AiPlaybook.css';
import {
  Sparkles, Flame, Shield, TrendingUp,
  Target, RefreshCw, Layers, ChevronDown, ChevronUp,
  Zap, Compass, Copy, Check, ArrowUpRight,
  BarChart2, Activity, Search, AlertCircle,
  Sliders, Award, Crosshair
} from 'lucide-react';

/**
 * Inline 30-Day Price + 10/21 EMA + Normalized RS Line vs SPY Sparkline SVG
 */
function SetupSparkline({ sparkline, execution, currentPrice, rsIntel }) {
  const closes = sparkline?.close || [];
  const ema10 = sparkline?.ema10 || [];
  const ema21 = sparkline?.ema21 || [];
  const rsNorm = sparkline?.rs_norm || [];

  if (!closes || closes.length < 5) {
    return (
      <div className="sparkline-empty">
        <span>30D Price Trajectory Unavailable</span>
      </div>
    );
  }

  const width = 260;
  const height = 92;
  const padX = 6;
  const padY = 8;

  const stopLoss = Number(execution?.stop_loss || 0);
  const entryLow = Number(execution?.entry_range?.[0] || currentPrice || 0);
  const entryHigh = Number(execution?.entry_range?.[1] || currentPrice || 0);

  const allVals = [
    ...closes,
    ...ema10.filter(Boolean),
    ...ema21.filter(Boolean),
    ...rsNorm.filter(Boolean),
    stopLoss > 0 ? stopLoss : closes[0],
    entryLow > 0 ? entryLow : closes[0],
    entryHigh > 0 ? entryHigh : closes[0]
  ].filter(v => Number.isFinite(v) && v > 0);

  const minVal = Math.min(...allVals) * 0.992;
  const maxVal = Math.max(...allVals) * 1.008;
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

  const yEntryTop = Math.max(padY, Math.min(height - padY, toY(entryHigh)));
  const yEntryBot = Math.max(padY, Math.min(height - padY, toY(entryLow)));
  const yStop = stopLoss > 0 ? Math.max(padY, Math.min(height - padY, toY(stopLoss))) : null;
  const lastX = toX(closes.length - 1, closes.length);
  const lastY = toY(closes[closes.length - 1]);
  const lastRsY = rsNorm.length > 0 ? toY(rsNorm[rsNorm.length - 1]) : null;

  const isUp = closes[closes.length - 1] >= closes[0];
  const strokeColor = isUp ? '#00E676' : '#00F0FF';
  const isBlueDot = Boolean(rsIntel?.is_blue_dot || rsIntel?.rs_at_30d_high);

  return (
    <div className="setup-sparkline-box">
      <div className="sparkline-header-strip">
        <span className="sparkline-title">30D PRICE · EMA · RS LINE</span>
        <div className="sparkline-legend">
          <span className="leg-item price">● Price</span>
          <span className="leg-item ema10">─ 10E</span>
          <span className="leg-item ema21">─ 21E</span>
          <span className="leg-item rs" style={{ color: '#fbbf24', fontWeight: 800 }}>
            {isBlueDot ? '🔵 RS High' : '━ RS/SPY'}
          </span>
        </div>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="setup-sparkline-svg" preserveAspectRatio="none">
        <defs>
          <linearGradient id={`sparkGrad-${isUp ? 'up' : 'dn'}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.28" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Entry Corridor Shaded Band */}
        {entryHigh > 0 && entryLow > 0 && (
          <rect
            x={padX}
            y={Math.min(yEntryTop, yEntryBot)}
            width={width - padX * 2}
            height={Math.max(3, Math.abs(yEntryBot - yEntryTop))}
            fill="rgba(0, 230, 118, 0.13)"
            stroke="rgba(0, 230, 118, 0.28)"
            strokeDasharray="2 2"
          />
        )}

        {/* Stop Loss Dashed Line */}
        {yStop !== null && (
          <line
            x1={padX}
            y1={yStop}
            x2={width - padX}
            y2={yStop}
            stroke="rgba(244, 63, 94, 0.65)"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
        )}

        {/* Area under Close */}
        <path d={areaPath} fill={`url(#sparkGrad-${isUp ? 'up' : 'dn'})`} />

        {/* 21 EMA & 10 EMA */}
        {ema21Path && (
          <path d={ema21Path} fill="none" stroke="#a855f7" strokeWidth="1.2" strokeOpacity="0.85" />
        )}
        {ema10Path && (
          <path d={ema10Path} fill="none" stroke="#00F0FF" strokeWidth="1.3" strokeOpacity="0.9" />
        )}

        {/* Gold Normalized 30D RS Line vs SPY */}
        {rsPath && (
          <path
            d={rsPath}
            fill="none"
            stroke="#fbbf24"
            strokeWidth="1.65"
            strokeDasharray="3 1.5"
            strokeOpacity="0.95"
          />
        )}

        {/* Close Line */}
        <path d={closePath} fill="none" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" />

        {/* RS Blue Dot Marker if RS Line is at 30D High */}
        {lastRsY !== null && isBlueDot && (
          <circle cx={lastX} cy={lastRsY} r="3.4" fill="#38bdf8" stroke="#ffffff" strokeWidth="1.2" />
        )}

        {/* Current Spot Dot */}
        <circle cx={lastX} cy={lastY} r="3.2" fill={strokeColor} stroke="#0a0e17" strokeWidth="1.2" />
      </svg>
    </div>
  );
}

/**
 * Visual Risk/Reward Price Ruler (Stop -> Entry Zone -> Spot -> T1 -> T2)
 */
function ExecutionPriceRuler({ currentPrice, execution }) {
  const stop = Number(execution?.stop_loss || 0);
  const entryLow = Number(execution?.entry_range?.[0] || execution?.ideal_entry || currentPrice);
  const entryHigh = Number(execution?.entry_range?.[1] || execution?.ideal_entry || currentPrice);
  const t1 = Number(execution?.target_primary || currentPrice * 1.1);
  const t2 = Number(execution?.target_secondary || currentPrice * 1.2);

  const minP = Math.min(stop, entryLow, currentPrice) * 0.995;
  const maxP = Math.max(t2, t1, currentPrice) * 1.005;
  const span = Math.max(maxP - minP, 0.01);

  const pct = (val) => Math.max(2, Math.min(98, ((val - minP) / span) * 100));

  const stopPos = pct(stop);
  const entryStart = pct(entryLow);
  const entryEnd = pct(entryHigh);
  const spotPos = pct(currentPrice);
  const t1Pos = pct(t1);
  const t2Pos = pct(t2);

  return (
    <div className="price-ruler-container">
      <div className="price-ruler-labels-top">
        <span className="ruler-tag stop">
          STOP ${stop.toFixed(2)} ({execution?.stop_loss_pct}%)
        </span>
        <span className="ruler-tag entry">
          BUY ZONE ${entryLow.toFixed(2)}–${entryHigh.toFixed(2)}
        </span>
        <span className="ruler-tag t1">
          T1 ${t1.toFixed(2)} (+{execution?.target_primary_pct}%)
        </span>
        <span className="ruler-tag t2">
          T2 ${t2.toFixed(2)} (+{execution?.target_secondary_pct}%)
        </span>
      </div>

      <div className="price-ruler-track">
        {/* Danger Zone (Stop to Entry) */}
        <div
          className="ruler-zone risk"
          style={{ left: `${stopPos}%`, width: `${Math.max(1, entryStart - stopPos)}%` }}
        />
        {/* Accumulation Entry Corridor */}
        <div
          className="ruler-zone entry"
          style={{ left: `${entryStart}%`, width: `${Math.max(2.5, entryEnd - entryStart)}%` }}
        />
        {/* Reward Zone to T2 */}
        <div
          className="ruler-zone reward"
          style={{ left: `${entryEnd}%`, width: `${Math.max(2, t2Pos - entryEnd)}%` }}
        />

        {/* Markers */}
        <div className="ruler-marker stop" style={{ left: `${stopPos}%` }} title={`Hard Stop: $${stop}`} />
        <div className="ruler-marker t1" style={{ left: `${t1Pos}%` }} title={`Target 1: $${t1}`} />
        <div className="ruler-marker t2" style={{ left: `${t2Pos}%` }} title={`Target 2: $${t2}`} />
        <div className="ruler-marker spot" style={{ left: `${spotPos}%` }} title={`Current Spot: $${currentPrice}`}>
          <span className="spot-pin-label">SPOT ${currentPrice}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Helper to compute position sizing for a given setup, account capital, and risk %
 */
function computePositionSizing(setup, accountCapital, riskPct) {
  const ex = setup?.execution || {};
  const price = Number(setup?.current_price || ex.ideal_entry || 100);
  const stop = Number(ex.stop_loss || price * 0.96);
  const riskPerShare = Math.max(price - stop, price * 0.005);
  const maxRiskDollars = (accountCapital * (riskPct / 100));

  // Cap single position notional at 25% of total account equity for institutional prudence
  const rawShares = Math.floor(maxRiskDollars / riskPerShare);
  const maxCapShares = Math.floor((accountCapital * 0.25) / price);
  const totalShares = Math.max(1, Math.min(rawShares, maxCapShares));

  const positionDollars = totalShares * price;
  const portfolioWeightPct = (positionDollars / accountCapital) * 100;
  const actualRiskDollars = totalShares * riskPerShare;

  const t1GainPerShare = Math.max(0, Number(ex.target_primary || price * 1.1) - price);
  const t2GainPerShare = Math.max(0, Number(ex.target_secondary || price * 1.2) - price);

  const expectedProfitT1 = totalShares * t1GainPerShare;
  const expectedProfitT2 = totalShares * t2GainPerShare;

  const t1Shares = Math.max(1, Math.round(totalShares * 0.30));
  const t2Shares = Math.max(1, Math.round(totalShares * 0.40));
  const t3Shares = Math.max(0, totalShares - t1Shares - t2Shares);

  return {
    totalShares,
    positionDollars,
    portfolioWeightPct,
    actualRiskDollars,
    riskPerShare,
    expectedProfitT1,
    expectedProfitT2,
    trancheShares: [t1Shares, t2Shares, t3Shares]
  };
}

export default function AiPlaybookDashboard({ onTickerClick }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Filter & Sort State
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL | BUY_ZONE | VOL_SQUEEZE | SEASONAL | OPTIONS_CONFIRMED | A_PLUS
  const [sortBy, setSortBy] = useState('conviction'); // conviction | rr | alpha30d | vol_compression | seasonality | confluence | options | tight_stop
  const [searchQuery, setSearchQuery] = useState('');

  // Interactive Portfolio Position Sizer State
  const [accountCapital, setAccountCapital] = useState(100000);
  const [riskPct, setRiskPct] = useState(1.0);

  // UI Interaction State
  const [copiedTicker, setCopiedTicker] = useState(null);
  const [expandedCards, setExpandedCards] = useState({});

  const fetchPlaybook = async (forceRun = false) => {
    if (forceRun) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const endpoint = forceRun ? '/api/run_ai_playbook' : '/api/ai_playbook';
      const method = forceRun ? 'POST' : 'GET';
      const res = await fetch(endpoint, { method });
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const json = await res.json();
      const payload = json.data || json;
      if (payload.error) {
        setError(payload.error);
      } else {
        setData(payload);
        if (payload?.market_regime?.recommended_risk_pct) {
          setRiskPct(Number(payload.market_regime.recommended_risk_pct));
        }
      }
    } catch (err) {
      console.error('Failed to load AI Playbook:', err);
      // Fallback to static public JSON if API endpoint fails
      try {
        const fallbackRes = await fetch('/ai_playbook.json');
        if (fallbackRes.ok) {
          const fallbackJson = await fallbackRes.json();
          setData(fallbackJson);
          return;
        }
      } catch (_) {}
      setError(err.message || 'Failed to fetch playbook');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPlaybook();
  }, []);

  const toggleExpand = (ticker) => {
    setExpandedCards(prev => ({ ...prev, [ticker]: !prev[ticker] }));
  };

  const handleCopy = (setup) => {
    const ex = setup.execution || {};
    const sizing = computePositionSizing(setup, accountCapital, riskPct);
    const optIntel = ex.options_intel || {};
    const volIntel = ex.volatility_intel || {};
    const mov30 = ex.movement_30d || {};
    const rsIntel = ex.rs_intel || {};
    const seasIntel = ex.seasonality_intel || {};

    const text = `🎯 [AI PLAYBOOK 3.0 CLUBBED INSTITUTIONAL TICKET] $${setup.ticker} (${setup.playbook_name})
Spot: $${setup.current_price} | Conviction: ${setup.conviction_rating} | Domains Aligned: ${ex.aligned_domains_count || 5}/5 | Status: ${ex.action_label || 'ACTIVE'}
Thesis: ${ex.thesis_summary || ''}
• Entry Corridor: $${ex.entry_range ? ex.entry_range[0] : ex.ideal_entry} ── $${ex.entry_range ? ex.entry_range[1] : ex.ideal_entry}
• Hard Invalidation Stop: $${ex.stop_loss} (${ex.stop_loss_pct}% risk · $${sizing.riskPerShare.toFixed(2)}/sh)
• Target 1 (Trim 50%): $${ex.target_primary} (+${ex.target_primary_pct}% · ${ex.risk_reward} R:R · +$${Math.round(sizing.expectedProfitT1).toLocaleString()})
• Target 2 (Runner): $${ex.target_secondary} (+${ex.target_secondary_pct}% · ${ex.risk_reward_t2 || '1:6.0'} R:R · +$${Math.round(sizing.expectedProfitT2).toLocaleString()})
• Position Sizing ($${(accountCapital / 1000).toFixed(0)}K Acct @ ${riskPct}% Risk): ${sizing.totalShares} shs ($${Math.round(sizing.positionDollars).toLocaleString()} · ${sizing.portfolioWeightPct.toFixed(1)}% weight · Max Risk -$${Math.round(sizing.actualRiskDollars).toLocaleString()})
• Last 30D Movement: ${mov30.return_30d_pct >= 0 ? '+' : ''}${mov30.return_30d_pct || 0}% (${mov30.alpha_30d_pct >= 0 ? '+' : ''}${mov30.alpha_30d_pct || 0}% vs SPY · ${mov30.up_days_30d || 0}W/${mov30.down_days_30d || 0}L · Range ${mov30.range_pos_30d_pct || 0}%)
• Volatility & VRP: ${volIntel.vol_badge || ''} | 10D HV ${volIntel.realized_hv_10d || '--'}% vs 30D HV ${volIntel.realized_hv_30d || '--'}% | VRP ${volIntel.vrp_spread >= 0 ? '+' : ''}${volIntel.vrp_spread ?? '--'}% | 30D Implied Move ±${volIntel.expected_move_30d_pct || '--'}%
• RS Line & Seasonality: RS ${rsIntel.rs_rating || '--'} (${rsIntel.rs_badge || ''}) | ${seasIntel.cur_month_name || 'Cur'} ${seasIntel.cur_month_win || '--'}% Win (${seasIntel.cur_month_avg >= 0 ? '+' : ''}${seasIntel.cur_month_avg || 0}%) → ${seasIntel.next_month_name || 'Next'} ${seasIntel.next_month_win || '--'}% Win
• Options Intelligence: ${optIntel.flow_badge || 'Neutral'} | 30D IV: ${optIntel.atm_iv_30d || '--'}% (IVR ${optIntel.iv_rank || '--'}%)
• Options Strategy: ${ex.options_spec}
• 11-Engine Confluence (${setup.confluence_count}): ${(setup.screeners || []).join(', ')}`;

    navigator.clipboard.writeText(text).then(() => {
      setCopiedTicker(setup.ticker);
      setTimeout(() => setCopiedTicker(null), 2200);
    });
  };

  const allSetups = data?.all_setups || [];
  const playbooks = data?.playbooks || {};
  const deskSummary = data?.desk_summary || {};
  const tradeOfTheDay = data?.trade_of_the_day || allSetups[0] || null;
  const focusList = data?.focus_list || allSetups.slice(0, 5);
  const regime = data?.market_regime || {
    label: 'SELECTIVE TACTICAL',
    score: 65,
    color: '#fbbf24',
    recommended_risk_pct: 1.0,
    max_gross_exposure: '60% – 80% Tactical Exposure',
    guidance: 'Standard Tactical Allocation (1.0% risk per trade)'
  };

  // Filter & Sort Setups
  const filteredSetups = useMemo(() => {
    let list = [...allSetups];

    if (activeCategory !== 'ALL') {
      list = list.filter(s => s.playbook_id === activeCategory);
    }

    if (statusFilter === 'BUY_ZONE') {
      list = list.filter(s => s.execution?.action_status === 'IN_BUY_ZONE');
    } else if (statusFilter === 'VOL_SQUEEZE') {
      list = list.filter(s => {
        const vs = s.execution?.volatility_intel?.vol_state;
        return vs === 'VCP_SQUEEZE_CHEAP_VEGA' || vs === 'HV_CONTRACTING' || vs === 'CHEAP_VEGA_DISCOUNT';
      });
    } else if (statusFilter === 'SEASONAL') {
      list = list.filter(s => {
        const ss = s.execution?.seasonality_intel?.seasonal_state;
        return ss === 'STRONG_TAILWIND' || ss === 'FAVORABLE';
      });
    } else if (statusFilter === 'OPTIONS_CONFIRMED') {
      list = list.filter(s => {
        const fs = s.execution?.options_intel?.flow_status;
        return fs === 'CONFIRMED_BULLISH' || fs === 'BULLISH_BIAS';
      });
    } else if (statusFilter === 'A_PLUS') {
      list = list.filter(s => Number(s.conviction_score || 0) >= 88);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toUpperCase();
      list = list.filter(s =>
        s.ticker.toUpperCase().includes(q) ||
        (s.execution?.sector || '').toUpperCase().includes(q) ||
        (s.screeners || []).some(sc => sc.toUpperCase().includes(q))
      );
    }

    list.sort((a, b) => {
      if (sortBy === 'rr') {
        return Number(b.execution?.risk_reward_num || 0) - Number(a.execution?.risk_reward_num || 0);
      }
      if (sortBy === 'alpha30d') {
        return Number(b.execution?.movement_30d?.alpha_30d_pct || 0) - Number(a.execution?.movement_30d?.alpha_30d_pct || 0);
      }
      if (sortBy === 'vol_compression') {
        return Number(a.execution?.volatility_intel?.hv_compression_ratio || 1) - Number(b.execution?.volatility_intel?.hv_compression_ratio || 1);
      }
      if (sortBy === 'seasonality') {
        return Number(b.execution?.seasonality_intel?.cur_month_win || 0) - Number(a.execution?.seasonality_intel?.cur_month_win || 0);
      }
      if (sortBy === 'confluence') {
        return (b.confluence_count - a.confluence_count) || (b.conviction_score - a.conviction_score);
      }
      if (sortBy === 'options') {
        return Number(b.execution?.options_intel?.call_vol_pct || 0) - Number(a.execution?.options_intel?.call_vol_pct || 0);
      }
      if (sortBy === 'tight_stop') {
        return Math.abs(Number(a.execution?.stop_loss_pct || -10)) - Math.abs(Number(b.execution?.stop_loss_pct || -10));
      }
      return Number(b.conviction_score || 0) - Number(a.conviction_score || 0);
    });

    return list;
  }, [allSetups, activeCategory, statusFilter, sortBy, searchQuery]);

  const oneRDollars = Math.round(accountCapital * (riskPct / 100));

  return (
    <div className="ai-playbook-root">
      {/* ================================================================== */}
      {/* 1. EXECUTIVE COMMAND DECK & INTERACTIVE POSITION SIZER             */}
      {/* ================================================================== */}
      <div className="playbook-header-card">
        <div className="playbook-header-top">
          <div className="playbook-identity">
            <div className="playbook-icon-box">
              <Sparkles size={24} color="#00F0FF" />
            </div>
            <div>
              <div className="playbook-title-row">
                <h1>AI PLAYBOOK 3.0 · CLUBBED DECISION ENGINE</h1>
                <span className="playbook-live-pill">
                  <span className="pulse-dot" /> {data?.engines_integrated || 11} ENGINES · VOL + 30D + RS + SEASONALITY + OPTIONS
                </span>
              </div>
              <p className="playbook-subtitle">
                Unified 5-Domain Institutional Decision Matrix clubbing 30-Day Price & Alpha Trajectory, Volatility & VRP Compression, RS Line Scanner, 10Y Cyclical Seasonality & CBOE Options Flow
              </p>
            </div>
          </div>

          <div className="playbook-header-actions">
            <div
              className="playbook-regime-pill"
              style={{ borderColor: `${regime.color}55`, background: `${regime.color}15` }}
            >
              <Compass size={15} color={regime.color} />
              <div className="regime-pill-text">
                <span style={{ color: regime.color, fontWeight: 900 }}>
                  REGIME: {regime.label} ({regime.score}/100)
                </span>
                <span className="regime-guidance">
                  {regime.max_gross_exposure || regime.guidance}
                </span>
              </div>
            </div>

            <button
              type="button"
              className="btn-playbook-regenerate"
              onClick={() => fetchPlaybook(true)}
              disabled={refreshing || loading}
            >
              <RefreshCw size={13} className={refreshing ? 'spin' : ''} />
              {refreshing ? 'Synthesizing 11 Engines...' : '⚡ Re-Synthesize Playbook'}
            </button>
          </div>
        </div>

        {/* Interactive Portfolio Sizer + Desk Telemetry Ribbon */}
        <div className="playbook-sizer-ribbon">
          <div className="sizer-controls-group">
            <div className="sizer-title-tag">
              <Sliders size={13} color="#00F0FF" />
              <span>PORTFOLIO RISK SIZER</span>
            </div>

            <div className="sizer-control-item">
              <span className="ctrl-label">ACCOUNT EQUITY:</span>
              <div className="ctrl-pill-group">
                {[25000, 50000, 100000, 250000, 500000].map((cap) => (
                  <button
                    key={cap}
                    type="button"
                    className={`ctrl-pill ${accountCapital === cap ? 'active' : ''}`}
                    onClick={() => setAccountCapital(cap)}
                  >
                    ${cap >= 1000 ? `${cap / 1000}K` : cap}
                  </button>
                ))}
              </div>
            </div>

            <div className="sizer-control-item">
              <span className="ctrl-label">RISK / TRADE (1R):</span>
              <div className="ctrl-pill-group">
                {[0.5, 1.0, 1.5, 2.0].map((r) => (
                  <button
                    key={r}
                    type="button"
                    className={`ctrl-pill risk ${riskPct === r ? 'active' : ''}`}
                    onClick={() => setRiskPct(r)}
                  >
                    {r.toFixed(1)}%
                  </button>
                ))}
              </div>
            </div>

            <div className="sizer-1r-readout">
              <span className="label">1R UNIT RISK:</span>
              <span className="val">-${oneRDollars.toLocaleString()}</span>
            </div>
          </div>

          <div className="playbook-stats-pills">
            <div className="stat-pill">
              <span className="label">Active Setups:</span>
              <span className="val">{deskSummary.total_setups || allSetups.length}</span>
            </div>
            <div className="stat-pill">
              <span className="label">🎯 In Buy Zone:</span>
              <span className="val" style={{ color: '#00E676' }}>
                {deskSummary.in_buy_zone_count || allSetups.length}
              </span>
            </div>
            <div className="stat-pill">
              <span className="label">🧬 Vol Squeeze / Cheap Vega:</span>
              <span className="val" style={{ color: '#38bdf8' }}>
                {deskSummary.vol_squeeze_count || 0}
              </span>
            </div>
            <div className="stat-pill">
              <span className="label">🌊 Seasonal Tailwind:</span>
              <span className="val" style={{ color: '#10b981' }}>
                {deskSummary.seasonal_tailwind_count || 0}
              </span>
            </div>
            <div className="stat-pill">
              <span className="label">🚀 Options Confirmed:</span>
              <span className="val" style={{ color: '#00F0FF' }}>
                {deskSummary.options_confirmed_count || 0}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ================================================================== */}
      {/* 2. #1 TRADE OF THE DAY SPOTLIGHT + TOP 5 FOCUS STRIP               */}
      {/* ================================================================== */}
      {tradeOfTheDay && !loading && (
        <div className="playbook-spotlight-banner">
          <div className="spotlight-main">
            <div className="spotlight-header-row">
              <div className="spotlight-badge-group">
                <span className="spotlight-crown-pill">
                  <Award size={13} /> #1 TRADE OF THE DAY
                </span>
                <span className="spotlight-conviction-pill">
                  ★ {tradeOfTheDay.conviction_rating}
                </span>
                <span
                  className="spotlight-action-pill"
                  style={{
                    color: tradeOfTheDay.execution?.action_color || '#00E676',
                    borderColor: `${tradeOfTheDay.execution?.action_color || '#00E676'}55`,
                    background: `${tradeOfTheDay.execution?.action_color || '#00E676'}15`
                  }}
                >
                  {tradeOfTheDay.execution?.action_label || '🎯 IN BUY ZONE'}
                </span>
                <span className="spotlight-sector-pill">
                  {tradeOfTheDay.execution?.aligned_domains_count || 5}/5 Domains Aligned · {tradeOfTheDay.execution?.sector || 'Equities'}
                </span>
              </div>

              <div className="spotlight-quick-actions">
                <button
                  type="button"
                  className="spotlight-ticker-btn"
                  onClick={() => onTickerClick && onTickerClick(tradeOfTheDay.ticker)}
                >
                  <span>${tradeOfTheDay.ticker}</span>
                  <span className="spot-price">${tradeOfTheDay.current_price}</span>
                  <span
                    className={`spot-chg ${Number(tradeOfTheDay.execution?.change_1d_pct || 0) >= 0 ? 'pos' : 'neg'}`}
                  >
                    {Number(tradeOfTheDay.execution?.change_1d_pct || 0) >= 0 ? '+' : ''}
                    {tradeOfTheDay.execution?.change_1d_pct || 0}%
                  </span>
                  <ArrowUpRight size={14} />
                </button>
              </div>
            </div>

            <p className="spotlight-thesis-text">
              {tradeOfTheDay.execution?.thesis_summary}
            </p>

            {(() => {
              const ex = tradeOfTheDay.execution || {};
              const sz = computePositionSizing(tradeOfTheDay, accountCapital, riskPct);
              const opt = ex.options_intel || {};
              const vol = ex.volatility_intel || {};
              const mov = ex.movement_30d || {};
              const seas = ex.seasonality_intel || {};
              return (
                <div className="spotlight-metrics-strip">
                  <div className="spot-metric-box">
                    <span className="lbl">ENTRY & STOP</span>
                    <span className="val green">
                      ${ex.entry_range?.[0]}–${ex.entry_range?.[1]} · Stop ${ex.stop_loss}
                    </span>
                  </div>
                  <div className="spot-metric-box">
                    <span className="lbl">LAST 30D MOVE & ALPHA</span>
                    <span className="val emerald">
                      {mov.return_30d_pct >= 0 ? '+' : ''}{mov.return_30d_pct || 0}% ({mov.alpha_30d_pct >= 0 ? '+' : ''}{mov.alpha_30d_pct || 0}% α · {mov.up_days_30d || 0}W/{mov.down_days_30d || 0}L)
                    </span>
                  </div>
                  <div className="spot-metric-box">
                    <span className="lbl">VOLATILITY & VRP</span>
                    <span className="val cyan">
                      HV10 {vol.realized_hv_10d || '--'}% vs HV30 {vol.realized_hv_30d || '--'}% · VRP {vol.vrp_spread >= 0 ? '+' : ''}{vol.vrp_spread ?? '--'}%
                    </span>
                  </div>
                  <div className="spot-metric-box">
                    <span className="lbl">SEASONALITY & RS</span>
                    <span className="val amber">
                      RS {ex.rs_intel?.rs_rating || '--'} · {seas.cur_month_name || 'Nov'} {seas.cur_month_win || '--'}% Win ({seas.cur_month_avg >= 0 ? '+' : ''}{seas.cur_month_avg || 0}%)
                    </span>
                  </div>
                  <div className="spot-metric-box">
                    <span className="lbl">SIZED TICKET & FLOW</span>
                    <span className="val green">
                      {sz.totalShares} shs · {opt.call_vol_pct || 50}% Calls (IVR {opt.iv_rank ?? '--'}%)
                    </span>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Right Side: Top 5 Institutional Focus List */}
          <div className="spotlight-focus-sidebar">
            <div className="focus-sidebar-header">
              <Crosshair size={13} color="#00F0FF" />
              <span>TOP 5 DESK FOCUS LIST</span>
            </div>
            <div className="focus-sidebar-list">
              {focusList.map((item, i) => {
                const ex = item.execution || {};
                return (
                  <div
                    key={item.ticker}
                    className="focus-mini-row"
                    onClick={() => {
                      setSearchQuery(item.ticker);
                      setActiveCategory('ALL');
                    }}
                    title="Click to filter to this setup"
                  >
                    <div className="focus-mini-left">
                      <span className="focus-rank">#{i + 1}</span>
                      <span className="focus-sym">${item.ticker}</span>
                      <span className="focus-score">{item.conviction_score}</span>
                    </div>
                    <div className="focus-mini-mid">
                      <span className="focus-entry">
                        30D {ex.movement_30d?.return_30d_pct >= 0 ? '+' : ''}{ex.movement_30d?.return_30d_pct ?? 0}% · RS {ex.rs_intel?.rs_rating ?? '--'}
                      </span>
                    </div>
                    <div className="focus-mini-right">
                      <span className="focus-rr">{ex.aligned_domains_count || 5}/5D</span>
                      <span className="focus-eng">{item.confluence_count}E</span>
                    </div>
                  </div>
                );
              })}
              {searchQuery && (
                <button
                  type="button"
                  className="focus-clear-btn"
                  onClick={() => setSearchQuery('')}
                >
                  Show All {allSetups.length} Setups
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* 3. MULTI-DIMENSIONAL CATEGORY TABS + FILTER & SORT BAR             */}
      {/* ================================================================== */}
      <div className="playbook-controls-stack">
        <div className="playbook-tabs-nav">
          <button
            type="button"
            className={`playbook-tab-btn ${activeCategory === 'ALL' ? 'active' : ''}`}
            onClick={() => setActiveCategory('ALL')}
          >
            <Sparkles size={14} />
            <span>All Institutional Setups</span>
            <span className="badge">{allSetups.length}</span>
          </button>

          <button
            type="button"
            className={`playbook-tab-btn emerald ${activeCategory === 'alpha_breakout' ? 'active' : ''}`}
            onClick={() => setActiveCategory('alpha_breakout')}
          >
            <TrendingUp size={14} />
            <span>🚀 Alpha Breakouts & VCPs</span>
            <span className="badge">{playbooks.alpha_breakout?.count || 0}</span>
          </button>

          <button
            type="button"
            className={`playbook-tab-btn cyan ${activeCategory === 'ma_pullback' ? 'active' : ''}`}
            onClick={() => setActiveCategory('ma_pullback')}
          >
            <Shield size={14} />
            <span>🛡️ 1st MA Pullbacks & Cushions</span>
            <span className="badge">{playbooks.ma_pullback?.count || 0}</span>
          </button>

          <button
            type="button"
            className={`playbook-tab-btn purple ${activeCategory === 'squeeze_gamma' ? 'active' : ''}`}
            onClick={() => setActiveCategory('squeeze_gamma')}
          >
            <Flame size={14} />
            <span>🔥 Squeeze & Gamma Runners</span>
            <span className="badge">{playbooks.squeeze_gamma?.count || 0}</span>
          </button>

          <button
            type="button"
            className={`playbook-tab-btn amber ${activeCategory === 'fundamental_acceleration' ? 'active' : ''}`}
            onClick={() => setActiveCategory('fundamental_acceleration')}
          >
            <Zap size={14} />
            <span>📈 Fundamental Accelerators</span>
            <span className="badge">{playbooks.fundamental_acceleration?.count || 0}</span>
          </button>
        </div>

        <div className="playbook-filter-bar">
          <div className="playbook-search-box">
            <Search size={14} color="#94a3b8" />
            <input
              type="text"
              placeholder="Filter by ticker, sector, or screener engine..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                className="clear-search-btn"
                onClick={() => setSearchQuery('')}
              >
                ×
              </button>
            )}
          </div>

          <div className="status-filter-pills">
            <button
              type="button"
              className={`status-filter-btn ${statusFilter === 'ALL' ? 'active' : ''}`}
              onClick={() => setStatusFilter('ALL')}
            >
              All ({allSetups.length})
            </button>
            <button
              type="button"
              className={`status-filter-btn green ${statusFilter === 'BUY_ZONE' ? 'active' : ''}`}
              onClick={() => setStatusFilter('BUY_ZONE')}
            >
              🎯 In Buy Zone ({deskSummary.in_buy_zone_count || allSetups.length})
            </button>
            <button
              type="button"
              className={`status-filter-btn cyan ${statusFilter === 'VOL_SQUEEZE' ? 'active' : ''}`}
              onClick={() => setStatusFilter('VOL_SQUEEZE')}
            >
              🧬 Vol Squeeze / Cheap Vega ({deskSummary.vol_squeeze_count || 0})
            </button>
            <button
              type="button"
              className={`status-filter-btn green ${statusFilter === 'SEASONAL' ? 'active' : ''}`}
              onClick={() => setStatusFilter('SEASONAL')}
            >
              🌊 Seasonal Tailwind ({deskSummary.seasonal_tailwind_count || 0})
            </button>
            <button
              type="button"
              className={`status-filter-btn cyan ${statusFilter === 'OPTIONS_CONFIRMED' ? 'active' : ''}`}
              onClick={() => setStatusFilter('OPTIONS_CONFIRMED')}
            >
              🚀 Options Confirmed ({deskSummary.options_confirmed_count || 0})
            </button>
            <button
              type="button"
              className={`status-filter-btn amber ${statusFilter === 'A_PLUS' ? 'active' : ''}`}
              onClick={() => setStatusFilter('A_PLUS')}
            >
              ★ A+ Tier (88+)
            </button>
          </div>

          <div className="sort-selector-box">
            <span className="sort-lbl">SORT BY:</span>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="conviction">Highest Clubbed Conviction Score</option>
              <option value="alpha30d">Highest 30-Day Alpha vs SPY</option>
              <option value="vol_compression">Tightest Vol Compression (HV10/HV30)</option>
              <option value="seasonality">Highest Current Month Seasonal Win %</option>
              <option value="rr">Best Risk/Reward Asymmetry</option>
              <option value="confluence">Most Engine Confluence</option>
              <option value="options">Strongest Call Option Flow %</option>
              <option value="tight_stop">Tightest Stop Loss Risk %</option>
            </select>
          </div>
        </div>
      </div>

      {/* ================================================================== */}
      {/* 4. INSTITUTIONAL PLAYBOOK 3.0 CARDS GRID                           */}
      {/* ================================================================== */}
      {loading ? (
        <div className="playbook-loading-state">
          <RefreshCw size={26} className="spin" color="#00F0FF" />
          <p>Synthesizing 11 quantitative engines, 30D trajectory, volatility compression, RS Line, Seasonality, and CBOE Options Flow...</p>
        </div>
      ) : error ? (
        <div className="playbook-empty-state">
          <AlertCircle size={28} color="#f43f5e" />
          <h3>Unable to load AI Playbook</h3>
          <p>{error}</p>
        </div>
      ) : filteredSetups.length === 0 ? (
        <div className="playbook-empty-state">
          <AlertCircle size={28} color="#94a3b8" />
          <h3>No setups match the selected filter criteria.</h3>
          <p>Try resetting the status filter or clearing your search query.</p>
        </div>
      ) : (
        <div className="ai-playbook-grid playbook-grid">
          {filteredSetups.map((setup, idx) => {
            const ex = setup.execution || {};
            const opt = ex.options_intel || {};
            const vol = ex.volatility_intel || {};
            const mov = ex.movement_30d || {};
            const rs = ex.rs_intel || {};
            const seas = ex.seasonality_intel || {};
            const domainChecks = ex.domain_checks || [];
            const alignedDomains = ex.aligned_domains_count ?? domainChecks.filter(d => d.passed).length;
            const pillars = ex.pillars || {};
            const sizing = computePositionSizing(setup, accountCapital, riskPct);
            const isCopied = copiedTicker === setup.ticker;
            const isExpanded = !!expandedCards[setup.ticker];
            const chg1d = Number(ex.change_1d_pct || 0);

            return (
              <div
                key={setup.ticker}
                className={`ai-playbook-card playbook-card border-${setup.playbook_color || 'emerald'}`}
              >
                {/* 4A. Card Header: Identity, Sector, Actionability, Conviction */}
                <div className="card-top-row">
                  <div className="card-identity-box">
                    <span className="rank-chip">#{idx + 1}</span>
                    <button
                      type="button"
                      className="ticker-btn"
                      onClick={() => onTickerClick && onTickerClick(setup.ticker)}
                      title={`Open interactive Deep Chart for ${setup.ticker}`}
                    >
                      <span className="ticker-sym">${setup.ticker}</span>
                      <ArrowUpRight size={14} className="arrow-hover" />
                    </button>
                    <span className="curr-price">${setup.current_price}</span>
                    <span className={`chg-pill ${chg1d >= 0 ? 'pos' : 'neg'}`}>
                      {chg1d >= 0 ? '+' : ''}{chg1d.toFixed(2)}%
                    </span>
                    {ex.sector && (
                      <span className="sector-quad-pill">
                        {ex.sector} · <strong>{ex.sector_quadrant || 'Leading'}</strong>
                      </span>
                    )}
                  </div>

                  <div className="card-badges-row">
                    {ex.action_label && (
                      <span
                        className="action-status-pill"
                        style={{
                          color: ex.action_color || '#00E676',
                          borderColor: `${ex.action_color || '#00E676'}55`,
                          background: `${ex.action_color || '#00E676'}15`
                        }}
                      >
                        {ex.action_label}
                      </span>
                    )}
                    <span className={`regime-badge ${setup.playbook_color || 'emerald'}`}>
                      {setup.playbook_badge}
                    </span>
                    <span className="conviction-pill">
                      <span className="star-icon">★</span> {setup.conviction_score}/100 ({setup.conviction_tier || 'A'})
                    </span>
                  </div>
                </div>

                {/* 4B. AI Institutional Thesis Narrative */}
                {ex.thesis_summary && (
                  <div className="card-thesis-banner">
                    <span className="thesis-label">CLUBBED INSTITUTIONAL THESIS:</span>{' '}
                    <span className="thesis-body">{ex.thesis_summary}</span>
                  </div>
                )}

                {/* 4B-2. 5-DOMAIN CLUBBED DECISION MATRIX STRIP */}
                {domainChecks.length > 0 && (
                  <div className="clubbed-domain-matrix">
                    <div className="domain-matrix-header">
                      <span className="domain-matrix-title">
                        ⚡ 5-DOMAIN CLUBBED DECISION MATRIX
                      </span>
                      <span
                        className="domain-matrix-score"
                        style={{
                          color: alignedDomains >= 4 ? '#00E676' : alignedDomains >= 3 ? '#00F0FF' : '#fbbf24'
                        }}
                      >
                        {alignedDomains}/{domainChecks.length} DOMAINS ALIGNED
                      </span>
                    </div>
                    <div className="domain-pills-row">
                      {domainChecks.map((d, dIdx) => (
                        <div
                          key={dIdx}
                          className={`domain-check-pill ${d.passed ? 'passed' : 'neutral'}`}
                        >
                          <div className="domain-pill-top">
                            <span className="domain-check-icon">{d.passed ? '✓' : '•'}</span>
                            <span className="domain-name">{d.domain}</span>
                          </div>
                          <div className="domain-detail">{d.detail}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 4C. Visual Telemetry Row: 30D Price + RS Line Sparkline & 6-Pillar Conviction Bars */}
                <div className="card-visual-telemetry-row">
                  <SetupSparkline
                    sparkline={ex.sparkline}
                    execution={ex}
                    currentPrice={setup.current_price}
                    rsIntel={rs}
                  />

                  <div className="pillar-telemetry-box">
                    <div className="pillar-box-header">
                      <span>6-PILLAR CLUBBED CONVICTION</span>
                      <span className="confluence-count-tag">{setup.confluence_count} ENGINES</span>
                    </div>
                    <div className="pillar-bars-list">
                      {Object.entries(pillars).map(([key, p]) => {
                        const score = Number(p?.score || 75);
                        const barColor =
                          score >= 88 ? '#00E676' : score >= 75 ? '#00F0FF' : '#fbbf24';
                        return (
                          <div key={key} className="pillar-bar-row">
                            <span className="pillar-name">{p?.label || key}</span>
                            <div className="pillar-track">
                              <div
                                className="pillar-fill"
                                style={{ width: `${Math.min(100, score)}%`, background: barColor }}
                              />
                            </div>
                            <span className="pillar-val" style={{ color: barColor }}>
                              {score}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* 4C-2. CLUBBED 3-PANEL INTELLIGENCE DECK: 30D MOVEMENT + VOLATILITY & VRP + RS & SEASONALITY */}
                <div className="clubbed-intel-trio-grid">
                  {/* Panel 1: Last 30 Days Movement & Trajectory */}
                  <div className="intel-panel-card movement">
                    <div className="intel-panel-top">
                      <span className="intel-panel-title">📅 LAST 30 DAYS MOVEMENT</span>
                      <span
                        className="intel-panel-badge"
                        style={{
                          color: (mov.alpha_30d_pct || 0) >= 0 ? '#00E676' : '#fbbf24',
                          borderColor: (mov.alpha_30d_pct || 0) >= 0 ? 'rgba(0,230,118,0.4)' : 'rgba(251,191,36,0.4)',
                          background: (mov.alpha_30d_pct || 0) >= 0 ? 'rgba(0,230,118,0.1)' : 'rgba(251,191,36,0.1)'
                        }}
                      >
                        {(mov.alpha_30d_pct || 0) >= 0 ? '+' : ''}{mov.alpha_30d_pct ?? 0}% vs SPY
                      </span>
                    </div>
                    <div className="intel-kv-grid">
                      <div className="intel-kv">
                        <span className="k">5D / 10D / 30D</span>
                        <span className="v">
                          <strong style={{ color: (mov.return_5d_pct || 0) >= 0 ? '#00E676' : '#f87171' }}>
                            {(mov.return_5d_pct || 0) >= 0 ? '+' : ''}{mov.return_5d_pct ?? 0}%
                          </strong>
                          {' / '}
                          <strong style={{ color: (mov.return_10d_pct || 0) >= 0 ? '#00E676' : '#f87171' }}>
                            {(mov.return_10d_pct || 0) >= 0 ? '+' : ''}{mov.return_10d_pct ?? 0}%
                          </strong>
                          {' / '}
                          <strong style={{ color: (mov.return_30d_pct || 0) >= 0 ? '#00E676' : '#f87171' }}>
                            {(mov.return_30d_pct || 0) >= 0 ? '+' : ''}{mov.return_30d_pct ?? 0}%
                          </strong>
                        </span>
                      </div>
                      <div className="intel-kv">
                        <span className="k">30D Win/Loss Days</span>
                        <span className="v">
                          <strong style={{ color: '#00E676' }}>{mov.up_days_30d ?? 16}W</strong>
                          {' – '}
                          <strong style={{ color: '#f87171' }}>{mov.down_days_30d ?? 14}L</strong>
                          {' · U/D '}
                          <strong>{mov.ud_vol_ratio_30d ?? ex.ud_vol_ratio ?? 1.2}x</strong>
                        </span>
                      </div>
                      <div className="intel-kv">
                        <span className="k">30D Range Pos</span>
                        <span className="v">
                          <strong style={{ color: '#00F0FF' }}>{mov.range_pos_30d_pct ?? 75}%</strong>
                          {' (${mov.low_30d ?? "--"}–$${mov.high_30d ?? "--"})'
                            .replace('${mov.low_30d ?? "--"}', mov.low_30d ?? '--')
                            .replace('$${mov.high_30d ?? "--"}', `$${mov.high_30d ?? '--'}`)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Panel 2: Volatility & VRP Compression Intelligence */}
                  <div className="intel-panel-card volatility">
                    <div className="intel-panel-top">
                      <span className="intel-panel-title">🧬 VOLATILITY &amp; VRP INTEL</span>
                      <span
                        className="intel-panel-badge"
                        style={{
                          color: vol.vol_color || '#00F0FF',
                          borderColor: `${vol.vol_color || '#00F0FF'}55`,
                          background: `${vol.vol_color || '#00F0FF'}15`
                        }}
                      >
                        {vol.vol_badge || '⚖️ Balanced Vol'}
                      </span>
                    </div>
                    <div className="intel-kv-grid">
                      <div className="intel-kv">
                        <span className="k">10D vs 30D HV</span>
                        <span className="v">
                          <strong style={{ color: '#00F0FF' }}>{vol.realized_hv_10d ?? '--'}%</strong>
                          {' vs '}
                          <strong>{vol.realized_hv_30d ?? '--'}%</strong>
                          {' ('}
                          <strong style={{ color: (vol.hv_compression_ratio || 1) <= 0.9 ? '#00E676' : '#cbd5e1' }}>
                            {vol.hv_compression_ratio ?? 1.0}x
                          </strong>
                          {')'}
                        </span>
                      </div>
                      <div className="intel-kv">
                        <span className="k">30D IV &amp; VRP Spread</span>
                        <span className="v">
                          <strong>{vol.atm_iv_30d ?? opt.atm_iv_30d ?? '--'}% IV</strong>
                          {' · VRP '}
                          <strong style={{ color: (vol.vrp_spread || 0) <= 0 ? '#00E676' : '#fbbf24' }}>
                            {(vol.vrp_spread || 0) >= 0 ? '+' : ''}{vol.vrp_spread ?? 0}%
                          </strong>
                        </span>
                      </div>
                      <div className="intel-kv">
                        <span className="k">30D Implied Move</span>
                        <span className="v">
                          <strong style={{ color: '#c084fc' }}>
                            ±{vol.expected_move_30d_pct ?? '--'}% (±${vol.expected_move_30d_pts ?? '--'})
                          </strong>
                          {' · BBW '}
                          <strong>{vol.bb_width_percentile ?? 50}%ile</strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Panel 3: RS Line Scanner + 10Y Cyclical Seasonality */}
                  <div className="intel-panel-card rs-seasonality">
                    <div className="intel-panel-top">
                      <span className="intel-panel-title">🔵 RS LINE &amp; 🌊 SEASONALITY</span>
                      <span
                        className="intel-panel-badge"
                        style={{
                          color: seas.seasonal_color || '#10b981',
                          borderColor: `${seas.seasonal_color || '#10b981'}55`,
                          background: `${seas.seasonal_color || '#10b981'}15`
                        }}
                      >
                        RS {rs.rs_rating ?? 85} · {seas.cur_month_name || 'Cur'} {seas.cur_month_win ?? 65}% Win
                      </span>
                    </div>
                    <div className="intel-kv-grid">
                      <div className="intel-kv">
                        <span className="k">RS Line Status</span>
                        <span className="v">
                          <strong style={{ color: rs.is_blue_dot ? '#38bdf8' : '#00E676' }}>
                            {rs.rs_badge || '📈 RS Leading'}
                          </strong>
                          {' ('}
                          {(rs.rs_30d_change_pct || 0) >= 0 ? '+' : ''}{rs.rs_30d_change_pct ?? 0}% 30D)
                        </span>
                      </div>
                      <div className="intel-kv">
                        <span className="k">{seas.cur_month_name || 'Current Mo'} Seasonality</span>
                        <span className="v">
                          <strong style={{ color: (seas.cur_month_win || 0) >= 60 ? '#00E676' : '#fbbf24' }}>
                            {seas.cur_month_win ?? 60}% Win
                          </strong>
                          {' · Avg '}
                          <strong style={{ color: (seas.cur_month_avg || 0) >= 0 ? '#00E676' : '#f87171' }}>
                            {(seas.cur_month_avg || 0) >= 0 ? '+' : ''}{seas.cur_month_avg ?? 0}%
                          </strong>
                        </span>
                      </div>
                      <div className="intel-kv">
                        <span className="k">{seas.next_month_name || 'Next Mo'} Outlook</span>
                        <span className="v">
                          <strong style={{ color: (seas.next_month_win || 0) >= 60 ? '#00F0FF' : '#cbd5e1' }}>
                            {seas.next_month_win ?? 60}% Win
                          </strong>
                          {' · Avg '}
                          <strong style={{ color: (seas.next_month_avg || 0) >= 0 ? '#00E676' : '#f87171' }}>
                            {(seas.next_month_avg || 0) >= 0 ? '+' : ''}{seas.next_month_avg ?? 0}%
                          </strong>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 4D. Visual Risk/Reward Execution Price Ruler */}
                <ExecutionPriceRuler currentPrice={setup.current_price} execution={ex} />

                {/* 4E. 6-Tile Execution Parameters Grid */}
                <div className="playbook-execution-grid">
                  <div className="exec-tile primary">
                    <div className="exec-tile-top">
                      <span className="label">Accumulation Zone</span>
                      <span className="tag green">ENTRY</span>
                    </div>
                    <div className="exec-val green">
                      {ex.entry_range
                        ? `$${ex.entry_range[0]} ── $${ex.entry_range[1]}`
                        : `$${ex.ideal_entry}`}
                    </div>
                    <div className="exec-sub">
                      10E: ${ex.ema_10 || '--'} · 21E: ${ex.ema_21 || '--'}
                    </div>
                  </div>

                  <div className="exec-tile">
                    <div className="exec-tile-top">
                      <span className="label">Invalidation Stop</span>
                      <span className="tag rose">1.0R FLOOR</span>
                    </div>
                    <div className="exec-val rose">${ex.stop_loss}</div>
                    <div className="exec-sub">
                      Risk: {ex.stop_loss_pct}% (${sizing.riskPerShare.toFixed(2)}/sh)
                    </div>
                  </div>

                  <div className="exec-tile">
                    <div className="exec-tile-top">
                      <span className="label">Target 1 (Trim 50%)</span>
                      <span className="tag emerald">{ex.risk_reward}</span>
                    </div>
                    <div className="exec-val emerald">${ex.target_primary}</div>
                    <div className="exec-sub" style={{ color: '#00E676' }}>
                      +{ex.target_primary_pct}% · +${Math.round(sizing.expectedProfitT1).toLocaleString()}
                    </div>
                  </div>

                  <div className="exec-tile">
                    <div className="exec-tile-top">
                      <span className="label">Target 2 (Runner)</span>
                      <span className="tag purple">{ex.risk_reward_t2 || '1:6.0'}</span>
                    </div>
                    <div className="exec-val purple">${ex.target_secondary}</div>
                    <div className="exec-sub" style={{ color: '#c084fc' }}>
                      +{ex.target_secondary_pct}% · +${Math.round(sizing.expectedProfitT2).toLocaleString()}
                    </div>
                  </div>

                  <div className="exec-tile">
                    <div className="exec-tile-top">
                      <span className="label">Sized Allocation</span>
                      <span className="tag cyan">{riskPct}% RISK</span>
                    </div>
                    <div className="exec-val cyan">
                      {sizing.totalShares} shs (${Math.round(sizing.positionDollars).toLocaleString()})
                    </div>
                    <div className="exec-sub">
                      {sizing.portfolioWeightPct.toFixed(1)}% of Acct · Risk -${Math.round(sizing.actualRiskDollars).toLocaleString()}
                    </div>
                  </div>

                  <div className="exec-tile">
                    <div className="exec-tile-top">
                      <span className="label">Options Structure</span>
                      <span className="tag amber">DERIVATIVES</span>
                    </div>
                    <div className="exec-val amber options-text">{ex.options_spec}</div>
                    <div className="exec-sub">
                      {ex.strategy_name || 'Defined-Risk Spread'}
                    </div>
                  </div>
                </div>

                {/* 4F. CBOE Options Flow & IV Intelligence Strip */}
                <div className="options-intel-strip">
                  <div className="options-intel-top">
                    <div className="opt-badge-group">
                      <span
                        className="opt-flow-pill"
                        style={{
                          color: opt.flow_color || '#94a3b8',
                          borderColor: `${opt.flow_color || '#94a3b8'}55`,
                          background: `${opt.flow_color || '#94a3b8'}15`
                        }}
                      >
                        {opt.flow_badge || '⚖️ Neutral Flow'}
                      </span>
                      {opt.has_live_options && (
                        <>
                          <span className="opt-stat-chip">
                            Calls: <strong>{opt.call_vol_pct}%</strong>
                          </span>
                          <span className="opt-stat-chip">
                            Opt Vol: <strong>{opt.opt_vol_ratio}x</strong>
                          </span>
                          <span className="opt-stat-chip">
                            30D IV: <strong>{opt.atm_iv_30d}%</strong> (IVR {opt.iv_rank}%)
                          </span>
                          {opt.max_pain > 0 && (
                            <span className="opt-stat-chip">
                              Max Pain: <strong>${opt.max_pain}</strong>
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {opt.iv_strategy_advice && (
                    <div className="opt-advice-line">
                      <span>💡 {opt.iv_strategy_advice}</span>
                    </div>
                  )}

                  {opt.top_unusual_contract && (
                    <div className="opt-whale-callout">
                      <span>🐳 WHALE SWEEP DETECTED:</span>{' '}
                      <strong>
                        {opt.top_unusual_contract.expiration} ${opt.top_unusual_contract.strike}{' '}
                        {opt.top_unusual_contract.type}
                      </strong>{' '}
                      · Vol: {opt.top_unusual_contract.volume?.toLocaleString()} (
                      {opt.top_unusual_contract.vol_oi_ratio}x Vol/OI · Est. $
                      {opt.top_unusual_contract.est_premium_k}K)
                    </div>
                  )}
                </div>

                {/* 4G. 3-Tranche Progressive Exposure Pyramid Ticket */}
                {ex.pyramid_plan && ex.pyramid_plan.length > 0 && (
                  <div className="pyramid-ticket-box">
                    <div className="pyramid-header">
                      <span>3-TRANCHE PROGRESSIVE EXPOSURE PLAN ({sizing.totalShares} SHARES TOTAL)</span>
                    </div>
                    <div className="pyramid-tranches-grid">
                      {ex.pyramid_plan.map((tr, tIdx) => (
                        <div key={tIdx} className="pyramid-tranche-card">
                          <div className="tranche-top">
                            <span className="tranche-tier">{tr.tier}</span>
                            <span className="tranche-shs">
                              {sizing.trancheShares[tIdx] || 0} shs @ ${tr.trigger_price}
                            </span>
                          </div>
                          <div className="tranche-cond">{tr.condition}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 4H. Multi-Engine Confluence Strip */}
                <div className="card-confluence-strip">
                  <div className="confluence-header">
                    <span className="label">
                      Converged Quant Engines ({setup.confluence_count}):
                    </span>
                    <span className="tech-badge">
                      {ex.stage} · RSI {ex.rsi} · Vol {ex.vol_surge}x · U/D {ex.ud_vol_ratio || 1.2}x
                    </span>
                  </div>
                  <div className="confluence-tags">
                    {(setup.screeners || []).map((sc, i) => (
                      <span key={i} className="confluence-tag">
                        {sc}
                      </span>
                    ))}
                  </div>
                </div>

                {/* 4I. Expandable 5-Phase Execution Blueprint & Screener Evidence */}
                {isExpanded && (
                  <div className="card-expanded-drawer">
                    {setup.metrics && setup.metrics.length > 0 && (
                      <div className="drawer-section">
                        <div className="drawer-sec-title">QUANT ENGINE EVIDENCE SIGNALS</div>
                        <ul className="evidence-list">
                          {setup.metrics.map((m, i) => (
                            <li key={i}>{m.replace(/\*\*/g, '')}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {ex.execution_checklist && (
                      <div className="drawer-section">
                        <div className="drawer-sec-title">5-PHASE INSTITUTIONAL EXECUTION PROTOCOL</div>
                        <div className="playbook-checklist-preview full">
                          {ex.execution_checklist.map((step, sIdx) => (
                            <div key={sIdx} className="checklist-step">
                              <span className="step-num">{sIdx + 1}</span>
                              <span className="step-txt">{step}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 4J. Card Action Footer */}
                <div className="card-action-footer">
                  <button
                    type="button"
                    className="action-btn chart"
                    onClick={() => onTickerClick && onTickerClick(setup.ticker)}
                  >
                    <BarChart2 size={13} />
                    <span>Deep Chart</span>
                  </button>

                  <button
                    type="button"
                    className="action-btn expand"
                    onClick={() => toggleExpand(setup.ticker)}
                  >
                    {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    <span>{isExpanded ? 'Hide Blueprint' : '5-Phase Blueprint'}</span>
                  </button>

                  <button
                    type="button"
                    className="action-btn copy"
                    onClick={() => handleCopy(setup)}
                  >
                    {isCopied ? <Check size={13} color="#00E676" /> : <Copy size={13} />}
                    <span>{isCopied ? 'Ticket Copied!' : 'Copy Sized Ticket'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
