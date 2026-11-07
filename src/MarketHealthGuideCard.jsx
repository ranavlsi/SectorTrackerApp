import React, { useState } from 'react';
import { 
  Info, 
  ChevronDown, 
  ChevronUp, 
  CheckCircle2, 
  AlertCircle, 
  Zap, 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  ShieldAlert, 
  ShieldCheck,
  Gauge, 
  BookOpen,
  RefreshCw,
  Layers,
  BarChart2,
  Flame,
  Radio,
  Target,
  Compass,
  ArrowRight,
  Sliders,
  Sparkles,
  ActivitySquare
} from 'lucide-react';

const MACRO_QUADRANT_STYLE = {
  REFLATION: {
    id: 'REFLATION',
    quadrant: 'QUADRANT I',
    shortTitle: 'REFLATION',
    axisLabel: 'Growth ↑ • Yields/Inflation ↑',
    color: '#f59e0b',
    accent: '#fbbf24',
    bg: 'rgba(245, 158, 11, 0.14)',
    border: 'rgba(245, 158, 11, 0.45)',
    basket: ['XOM', 'CVX', 'COP', 'JPM', 'GS', 'CAT', 'DE', 'ETN', 'FCX']
  },
  STAGFLATION: {
    id: 'STAGFLATION',
    quadrant: 'QUADRANT II',
    shortTitle: 'STAGFLATION',
    axisLabel: 'Growth ↓ • Inflation ↑',
    color: '#ef4444',
    accent: '#f87171',
    bg: 'rgba(239, 68, 68, 0.14)',
    border: 'rgba(239, 68, 68, 0.45)',
    basket: ['NEM', 'GOLD', 'FCX', 'XOM', 'CVX', 'COST', 'WMT', 'PG']
  },
  DEFLATION: {
    id: 'DEFLATION',
    quadrant: 'QUADRANT III',
    shortTitle: 'DEFLATION / RISK-OFF',
    axisLabel: 'Growth ↓ • Yields/Inflation ↓',
    color: '#38bdf8',
    accent: '#7dd3fc',
    bg: 'rgba(56, 189, 248, 0.14)',
    border: 'rgba(56, 189, 248, 0.45)',
    basket: ['LLY', 'UNH', 'JNJ', 'ABBV', 'NEE', 'DUK', 'SO', 'KO', 'PG']
  },
  GOLDILOCKS: {
    id: 'GOLDILOCKS',
    quadrant: 'QUADRANT IV',
    shortTitle: 'GOLDILOCKS',
    axisLabel: 'Growth ↑ • Yields/Inflation ↓',
    color: '#10b981',
    accent: '#34d399',
    bg: 'rgba(16, 185, 129, 0.14)',
    border: 'rgba(16, 185, 129, 0.45)',
    basket: ['NVDA', 'AVGO', 'MSFT', 'AAPL', 'AMZN', 'META', 'PLTR', 'HD']
  }
};

/**
 * Unified Institutional Market Health & Macro Command Cockpit
 * Synthesizes Bottom-Up Market Breadth Internals (12,742 Equities) + Top-Down Cross-Asset Macro Matrix (4-Quadrant Cycle & 6 Drivers)
 * into a single 4-quadrant executive terminal header.
 */
export function MarketHealthHeroCockpit({
  healthData,
  macroData,
  onRefresh,
  onRefreshMacro,
  onTickerClick,
  activeSection = 'unified',
  onSectionChange,
  chartCategory = 'all',
  onChartCategoryChange
}) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  if (!healthData || !healthData.current_health) return null;
  const curr = healthData.current_health;

  const score = Number(curr.score_value ?? 50);
  const delta5d = Number(curr.score_5d_delta ?? 0);
  const regime = curr.health_regime || (score >= 60 ? 'RISK_ON' : score <= 40 ? 'RISK_OFF' : 'CAUTIOUS');
  const regimeColor = score >= 60 ? '#10b981' : score <= 40 ? '#ef4444' : '#f59e0b';

  // Macro Regime Data
  const macroQuotes = macroData?.macro_quotes || {};
  const activeMacroRegime = (macroData?.active_regime && macroData.active_regime.id)
    ? macroData.active_regime
    : {
        id: 'DEFLATION',
        name: 'Deflationary / Risk-Off De-Leveraging',
        confidence: 82,
        favored_sectors: ['TLT (Long Treasuries)', 'XLU (Utilities)', 'XLV (Healthcare)', 'GC=F (Gold)'],
        unfavored_sectors: ['SMH (Semiconductors)', 'XLK (High-Beta Tech)', 'XLE (Cyclical Energy)'],
        driver_summary: 'Volatility Shock & Equity Drawdown paired with falling 10Y Yields and Crude Oil.'
      };
  const qStyle = MACRO_QUADRANT_STYLE[activeMacroRegime.id] || MACRO_QUADRANT_STYLE.DEFLATION;

  // Breadth Metrics
  const adv = Number(curr.advances_count ?? 0);
  const dec = Number(curr.declines_count ?? 0);
  const totalActive = Math.max(adv + dec, 1);
  const advPct = ((adv / totalActive) * 100).toFixed(1);
  const decPct = ((dec / totalActive) * 100).toFixed(1);

  const upVolPct = Number(curr.up_vol_pct ?? 50);
  const downVolPct = Math.max(0, 100 - upVolPct).toFixed(1);

  const p20 = Number(curr.pct_above_20_value ?? 0);
  const p50 = Number(curr.pct_above_50_value ?? 0);
  const p200 = Number(curr.pct_above_200_value ?? 0);

  const nh = Number(curr.new_highs_count ?? 0);
  const nl = Number(curr.new_lows_count ?? 0);
  const nhTotal = Math.max(nh + nl, 1);
  const nhPct = ((nh / nhTotal) * 100).toFixed(0);

  // SVG Semi-Circle Gauge math
  const radius = 74;
  const circumference = Math.PI * radius;
  const clampedScore = Math.max(0, Math.min(100, score));
  const strokeDashoffset = circumference - (clampedScore / 100) * circumference;

  const handleUnifiedRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      const [hRes, mRes] = await Promise.allSettled([
        fetch('/api/market_health?refresh=1', { method: 'POST' }),
        fetch('/api/macro_matrix?refresh=1', { method: 'POST' })
      ]);
      if (hRes.status === 'fulfilled' && hRes.value.ok) {
        const freshH = await hRes.value.json();
        if (freshH && freshH.current_health && onRefresh) onRefresh(freshH);
      }
      if (mRes.status === 'fulfilled' && mRes.value.ok) {
        const freshM = await mRes.value.json();
        if (freshM && onRefreshMacro) onRefreshMacro(freshM);
      }
    } catch (err) {
      console.error('Unified refresh failed:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const issuesList = Array.isArray(curr.issues_list) ? curr.issues_list : [];
  const strengthsList = Array.isArray(curr.strengths_list) ? curr.strengths_list : [];

  const tnxQuote = macroQuotes['^TNX'];
  const dxyQuote = macroQuotes['DX-Y.NYB'];
  const oilQuote = macroQuotes['CL=F'];
  const goldQuote = macroQuotes['GC=F'];
  const btcQuote = macroQuotes['BTC-USD'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '1.5rem' }}>
      <div
        className="glass-card"
        style={{
          padding: '1.4rem 1.5rem',
          borderRadius: '16px',
          border: `1px solid ${regimeColor}40`,
          borderTop: `4px solid ${regimeColor}`,
          background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.95) 0%, rgba(9, 13, 24, 0.98) 100%)',
          boxShadow: '0 16px 40px rgba(0, 0, 0, 0.45)'
        }}
      >
        {/* 1. TOP COMMAND RIBBON + CROSS-ASSET TICKER TAPE */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.85rem',
            paddingBottom: '0.95rem',
            marginBottom: '1.15rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', flexWrap: 'wrap' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                borderRadius: '999px',
                background: `${regimeColor}18`,
                border: `1px solid ${regimeColor}50`,
                color: regimeColor,
                fontSize: '0.72rem',
                fontWeight: 800,
                letterSpacing: '0.8px',
                textTransform: 'uppercase'
              }}
            >
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: regimeColor, boxShadow: `0 0 8px ${regimeColor}` }} />
              UNIFIED INTERNALS + MACRO TERMINAL
            </span>

            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.2px' }}>
              Market Health &amp; Cross-Asset Macro Command Center
            </h2>

            {curr.trade_date && (
              <span style={{
                padding: '3px 8px',
                borderRadius: '6px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#cbd5e1',
                fontSize: '0.74rem',
                fontFamily: 'monospace'
              }}>
                Session: {curr.trade_date}
              </span>
            )}

            {curr.total_universe && (
              <span style={{
                padding: '3px 8px',
                borderRadius: '6px',
                background: 'rgba(59, 130, 246, 0.12)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                color: '#93c5fd',
                fontSize: '0.74rem',
                fontWeight: 600
              }}>
                {Number(curr.total_universe).toLocaleString()} Equities + 6 Macro Drivers
              </span>
            )}
          </div>

          {/* Live Index & Macro Tape + Unified Refresh */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            {curr.spy_price && (
              <div
                onClick={() => onTickerClick && onTickerClick('SPY')}
                style={{
                  padding: '3px 8px',
                  borderRadius: '7px',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.09)',
                  fontSize: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontFamily: 'monospace',
                  cursor: 'pointer'
                }}
              >
                <span style={{ color: '#94a3b8', fontWeight: 600 }}>SPY</span>
                <span style={{ color: '#f8fafc', fontWeight: 700 }}>${Number(curr.spy_price).toFixed(2)}</span>
                {curr.spy_chg_pct !== undefined && (
                  <span style={{ color: curr.spy_chg_pct >= 0 ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                    {curr.spy_chg_pct >= 0 ? '+' : ''}{curr.spy_chg_pct}%
                  </span>
                )}
              </div>
            )}

            {curr.qqq_price && (
              <div
                onClick={() => onTickerClick && onTickerClick('QQQ')}
                style={{
                  padding: '3px 8px',
                  borderRadius: '7px',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.09)',
                  fontSize: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontFamily: 'monospace',
                  cursor: 'pointer'
                }}
              >
                <span style={{ color: '#94a3b8', fontWeight: 600 }}>QQQ</span>
                <span style={{ color: '#f8fafc', fontWeight: 700 }}>${Number(curr.qqq_price).toFixed(2)}</span>
                {curr.qqq_chg_pct !== undefined && (
                  <span style={{ color: curr.qqq_chg_pct >= 0 ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                    {curr.qqq_chg_pct >= 0 ? '+' : ''}{curr.qqq_chg_pct}%
                  </span>
                )}
              </div>
            )}

            {tnxQuote && (
              <div style={{
                padding: '3px 8px',
                borderRadius: '7px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.09)',
                fontSize: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                fontFamily: 'monospace'
              }}>
                <span style={{ color: '#94a3b8', fontWeight: 600 }}>10Y</span>
                <span style={{ color: '#f8fafc', fontWeight: 700 }}>{tnxQuote.current_price}%</span>
                <span style={{ color: tnxQuote.change_1d >= 0 ? '#f59e0b' : '#38bdf8', fontWeight: 700 }}>
                  {tnxQuote.change_1d >= 0 ? '+' : ''}{tnxQuote.change_1d}%
                </span>
              </div>
            )}

            {dxyQuote && (
              <div style={{
                padding: '3px 8px',
                borderRadius: '7px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.09)',
                fontSize: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                fontFamily: 'monospace'
              }}>
                <span style={{ color: '#94a3b8', fontWeight: 600 }}>DXY</span>
                <span style={{ color: '#f8fafc', fontWeight: 700 }}>{dxyQuote.current_price}</span>
              </div>
            )}

            {oilQuote && (
              <div style={{
                padding: '3px 8px',
                borderRadius: '7px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.09)',
                fontSize: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                fontFamily: 'monospace'
              }}>
                <span style={{ color: '#94a3b8', fontWeight: 600 }}>WTI</span>
                <span style={{ color: '#f8fafc', fontWeight: 700 }}>${oilQuote.current_price}</span>
              </div>
            )}

            <div style={{
              padding: '3px 8px',
              borderRadius: '7px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              fontSize: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              fontFamily: 'monospace'
            }}>
              <span style={{ color: '#fca5a5', fontWeight: 600 }}>VIX</span>
              <span style={{ color: '#f8fafc', fontWeight: 700 }}>{curr.vix_value}</span>
              <span style={{ color: (curr.vix_ratio || 0) > 1 ? '#ef4444' : '#10b981', fontSize: '0.7rem' }}>
                ({curr.vix_ratio}x)
              </span>
            </div>

            <button
              onClick={handleUnifiedRefresh}
              disabled={isRefreshing}
              style={{
                padding: '5px 12px',
                borderRadius: '8px',
                background: isRefreshing ? 'rgba(59, 130, 246, 0.25)' : 'rgba(59, 130, 246, 0.16)',
                border: '1px solid rgba(59, 130, 246, 0.45)',
                color: '#93c5fd',
                fontSize: '0.76rem',
                fontWeight: 700,
                cursor: isRefreshing ? 'wait' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
              title="Recompute both Market Health Internals & Cross-Asset Macro Matrix"
            >
              <RefreshCw size={13} className={isRefreshing ? 'spin' : ''} />
              <span>{isRefreshing ? 'Syncing All...' : 'Refresh Health & Macro'}</span>
            </button>
          </div>
        </div>

        {/* 2. 4-PILLAR UNIFIED EXECUTIVE COCKPIT GRID */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))',
            gap: '1rem',
            alignItems: 'stretch'
          }}
        >
          {/* PILLAR 1: Internal Composite Health Gauge & Sizing Posture */}
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.68)',
              border: `1px solid ${regimeColor}35`,
              borderRadius: '14px',
              padding: '1.1rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              alignItems: 'center',
              textAlign: 'center'
            }}
          >
            <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                1. Internal Health Score
              </span>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  padding: '2px 7px',
                  borderRadius: '5px',
                  background: delta5d >= 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  color: delta5d >= 0 ? '#10b981' : '#ef4444',
                  border: `1px solid ${delta5d >= 0 ? 'rgba(16,185,129,0.35)' : 'rgba(239,68,68,0.35)'}`,
                  fontFamily: 'monospace'
                }}
              >
                {delta5d >= 0 ? '+' : ''}{delta5d} (5D)
              </span>
            </div>

            <div style={{ position: 'relative', width: '190px', height: '108px', marginTop: '0.2rem' }}>
              <svg width="190" height="108" viewBox="0 0 190 108">
                <path
                  d="M 21 95 A 74 74 0 0 1 169 95"
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.08)"
                  strokeWidth="13"
                  strokeLinecap="round"
                />
                <path
                  d="M 21 95 A 74 74 0 0 1 169 95"
                  fill="none"
                  stroke={regimeColor}
                  strokeWidth="13"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  style={{
                    transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
                    filter: `drop-shadow(0 0 8px ${regimeColor}80)`
                  }}
                />
              </svg>
              <div style={{ position: 'absolute', bottom: '2px', left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ fontSize: '2.35rem', fontWeight: 900, color: regimeColor, lineHeight: 1, fontFamily: 'monospace' }}>
                  {score.toFixed(1)}
                </div>
                <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 700, marginTop: '2px' }}>
                  OUT OF 100
                </div>
              </div>
            </div>

            <div style={{ width: '100%', marginTop: '0.4rem' }}>
              <div
                style={{
                  padding: '5px 10px',
                  borderRadius: '8px',
                  background: `${regimeColor}18`,
                  border: `1px solid ${regimeColor}50`,
                  color: '#f8fafc',
                  fontWeight: 800,
                  fontSize: '0.82rem',
                  marginBottom: '0.6rem'
                }}
              >
                {curr.score_label}
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '0.45rem',
                  textAlign: 'left',
                  background: 'rgba(9, 13, 24, 0.65)',
                  padding: '0.55rem 0.7rem',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.06)',
                  fontSize: '0.74rem'
                }}
              >
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.65rem', textTransform: 'uppercase' }}>Target Exposure</span>
                  <strong style={{ color: '#f1f5f9' }}>
                    {regime === 'RISK_ON' ? '80% - 100% Long' : regime === 'CAUTIOUS' ? '40% - 60% Selective' : '70% - 100% Cash'}
                  </strong>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.65rem', textTransform: 'uppercase' }}>Max Position Size</span>
                  <strong style={{ color: regimeColor }}>
                    {regime === 'RISK_ON' ? 'Full Size (100%)' : regime === 'CAUTIOUS' ? 'Half Size (50%)' : 'Pilot Only (0-25%)'}
                  </strong>
                </div>
              </div>
            </div>
          </div>

          {/* PILLAR 2: Live Breadth & Participation Tape */}
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.68)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '14px',
              padding: '1.1rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '0.7rem'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                2. Breadth &amp; Participation Tape
              </span>
              <span style={{ fontSize: '0.72rem', color: '#60a5fa', fontWeight: 700, fontFamily: 'monospace' }}>
                A/D: {curr.adv_dec_ratio ?? '1.00'}x
              </span>
            </div>

            {/* Advances vs Declines Bar */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.73rem', marginBottom: '3px', fontFamily: 'monospace' }}>
                <span style={{ color: '#10b981', fontWeight: 700 }}>▲ {adv.toLocaleString()} ({advPct}%)</span>
                <span style={{ color: '#ef4444', fontWeight: 700 }}>▼ {dec.toLocaleString()} ({decPct}%)</span>
              </div>
              <div style={{ width: '100%', height: '7px', borderRadius: '999px', background: 'rgba(239, 68, 68, 0.35)', overflow: 'hidden', display: 'flex' }}>
                <div style={{ width: `${advPct}%`, background: '#10b981', height: '100%' }} />
                <div style={{ width: `${decPct}%`, background: '#ef4444', height: '100%' }} />
              </div>
            </div>

            {/* Up Volume vs Down Volume Bar */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.73rem', marginBottom: '3px', fontFamily: 'monospace' }}>
                <span style={{ color: '#38bdf8', fontWeight: 700 }}>Up Vol: {upVolPct.toFixed(1)}%</span>
                <span style={{ color: '#f43f5e', fontWeight: 700 }}>Down Vol: {downVolPct}%</span>
              </div>
              <div style={{ width: '100%', height: '7px', borderRadius: '999px', background: 'rgba(244, 63, 94, 0.3)', overflow: 'hidden', display: 'flex' }}>
                <div style={{ width: `${upVolPct}%`, background: '#38bdf8', height: '100%' }} />
                <div style={{ width: `${downVolPct}%`, background: '#f43f5e', height: '100%' }} />
              </div>
            </div>

            {/* Multi-Timeframe SMA Participation */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.45rem' }}>
              {[
                { label: '% > 20 SMA', val: p20 },
                { label: '% > 50 SMA', val: p50 },
                { label: '% > 200 SMA', val: p200 }
              ].map((item, i) => {
                const barColor = item.val >= 55 ? '#10b981' : item.val >= 40 ? '#f59e0b' : '#ef4444';
                return (
                  <div
                    key={i}
                    style={{
                      background: 'rgba(9, 13, 24, 0.65)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      borderRadius: '8px',
                      padding: '0.45rem 0.55rem'
                    }}
                  >
                    <div style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 600 }}>{item.label}</div>
                    <div style={{ fontSize: '1rem', fontWeight: 800, color: barColor, fontFamily: 'monospace', margin: '2px 0' }}>
                      {item.val.toFixed(1)}%
                    </div>
                    <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min(100, item.val)}%`, height: '100%', background: barColor }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 20D Highs/Lows & Structural Crash Warnings */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem' }}>
              <div style={{ fontSize: '0.73rem', color: '#cbd5e1', fontFamily: 'monospace' }}>
                <span style={{ color: '#94a3b8', fontFamily: 'sans-serif' }}>20D H/L: </span>
                <strong style={{ color: '#10b981' }}>{nh.toLocaleString()}H</strong>
                {' / '}
                <strong style={{ color: '#ef4444' }}>{nl.toLocaleString()}L</strong>
              </div>

              <div style={{ display: 'flex', gap: '0.35rem' }}>
                <span
                  style={{
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: curr.hindenburg_active ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.12)',
                    color: curr.hindenburg_active ? '#fca5a5' : '#6ee7b7',
                    border: `1px solid ${curr.hindenburg_active ? '#ef4444' : 'rgba(16,185,129,0.3)'}`
                  }}
                >
                  Hindenburg: {curr.hindenburg_active ? 'ACTIVE' : 'CLEAR'}
                </span>
                <span
                  style={{
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: curr.titanic_active ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.12)',
                    color: curr.titanic_active ? '#fca5a5' : '#6ee7b7',
                    border: `1px solid ${curr.titanic_active ? '#ef4444' : 'rgba(16,185,129,0.3)'}`
                  }}
                >
                  Titanic: {curr.titanic_active ? 'ACTIVE' : 'CLEAR'}
                </span>
              </div>
            </div>
          </div>

          {/* PILLAR 3: 4-Quadrant Macro Economic Cycle & Sector Rotation */}
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.68)',
              border: `1px solid ${qStyle.border}`,
              borderRadius: '14px',
              padding: '1.1rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '0.65rem'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: qStyle.accent, textTransform: 'uppercase', letterSpacing: '0.8px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Target size={14} color={qStyle.color} /> 3. Macro Cycle ({qStyle.quadrant})
              </span>
              <span style={{
                fontSize: '0.68rem',
                fontWeight: 800,
                padding: '2px 7px',
                borderRadius: '5px',
                background: qStyle.bg,
                color: qStyle.accent,
                border: `1px solid ${qStyle.border}`,
                fontFamily: 'monospace'
              }}>
                {activeMacroRegime.confidence || 82}% CONFIDENCE
              </span>
            </div>

            {/* Mini 2x2 Quadrant Compass */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem' }}>
              {['STAGFLATION', 'REFLATION', 'DEFLATION', 'GOLDILOCKS'].map((key) => {
                const m = MACRO_QUADRANT_STYLE[key];
                const isAct = activeMacroRegime.id === key;
                return (
                  <div
                    key={key}
                    onClick={() => onSectionChange && onSectionChange('macro')}
                    style={{
                      padding: '0.45rem 0.6rem',
                      borderRadius: '8px',
                      background: isAct ? m.bg : 'rgba(9, 13, 24, 0.6)',
                      border: `1.5px solid ${isAct ? m.color : 'rgba(255,255,255,0.06)'}`,
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px'
                    }}
                    title="Click to jump to full Macro Matrix & Simulator"
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '0.71rem', color: isAct ? m.accent : '#94a3b8' }}>
                        {m.shortTitle}
                      </strong>
                      {isAct && (
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: m.color, boxShadow: `0 0 8px ${m.color}` }} />
                      )}
                    </div>
                    <span style={{ fontSize: '0.62rem', color: '#64748b' }}>{m.axisLabel}</span>
                  </div>
                );
              })}
            </div>

            {/* Favored vs Avoid Sectors */}
            <div style={{ background: 'rgba(9, 13, 24, 0.68)', borderRadius: '8px', padding: '0.55rem 0.7rem', border: '1px solid rgba(255,255,255,0.06)', fontSize: '0.73rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                <span style={{ color: '#10b981', fontWeight: 800, fontSize: '0.68rem' }}>FAVORED:</span>
                <span style={{ color: '#6ee7b7', fontWeight: 600 }}>
                  {(activeMacroRegime.favored_sectors || []).join(' • ')}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                <span style={{ color: '#ef4444', fontWeight: 800, fontSize: '0.68rem' }}>AVOID:</span>
                <span style={{ color: '#fca5a5' }}>
                  {(activeMacroRegime.unfavored_sectors || []).join(' • ')}
                </span>
              </div>
            </div>

            {/* 1-Click Active Macro Basket */}
            <div>
              <span style={{ fontSize: '0.66rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                Active Regime Playbook Tickers (Click to Chart):
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.32rem' }}>
                {qStyle.basket.map((t) => (
                  <button
                    key={t}
                    onClick={() => onTickerClick && onTickerClick(t)}
                    style={{
                      padding: '2px 7px',
                      borderRadius: '5px',
                      background: qStyle.bg,
                      border: `1px solid ${qStyle.border}`,
                      color: '#f8fafc',
                      fontSize: '0.71rem',
                      fontWeight: 700,
                      fontFamily: 'monospace',
                      cursor: 'pointer'
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* PILLAR 4: Council Quantitative Diagnosis (Internals + Macro) */}
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.68)',
              border: '1px solid rgba(59, 130, 246, 0.25)',
              borderRadius: '14px',
              padding: '1.1rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '0.65rem'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.8px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Zap size={14} color="#60a5fa" /> 4. Council Synthesis
              </span>
              <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                {issuesList.length} Headwinds • {strengthsList.length} Tailwinds
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '195px', overflowY: 'auto', paddingRight: '3px' }}>
              {issuesList.length > 0 && (
                <div style={{ background: 'rgba(239, 68, 68, 0.07)', border: '1px solid rgba(239, 68, 68, 0.22)', borderRadius: '8px', padding: '0.5rem 0.65rem' }}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#f87171', textTransform: 'uppercase', marginBottom: '3px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <AlertCircle size={12} color="#ef4444" /> Deteriorating Internals
                  </div>
                  {issuesList.map((issue, idx) => (
                    <div key={idx} style={{ fontSize: '0.74rem', color: '#e2e8f0', lineHeight: 1.32, display: 'flex', alignItems: 'flex-start', gap: '5px', marginTop: '2px' }}>
                      <span style={{ color: '#ef4444', fontWeight: 900 }}>•</span>
                      <span>{issue}</span>
                    </div>
                  ))}
                </div>
              )}

              {strengthsList.length > 0 && (
                <div style={{ background: 'rgba(16, 185, 129, 0.07)', border: '1px solid rgba(16, 185, 129, 0.22)', borderRadius: '8px', padding: '0.5rem 0.65rem' }}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#34d399', textTransform: 'uppercase', marginBottom: '3px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <CheckCircle2 size={12} color="#10b981" /> Constructive Pillars
                  </div>
                  {strengthsList.map((str, idx) => (
                    <div key={idx} style={{ fontSize: '0.74rem', color: '#e2e8f0', lineHeight: 1.32, display: 'flex', alignItems: 'flex-start', gap: '5px', marginTop: '2px' }}>
                      <span style={{ color: '#10b981', fontWeight: 900 }}>•</span>
                      <span>{str}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {activeMacroRegime.driver_summary && (
              <div style={{
                background: 'rgba(9, 13, 24, 0.75)',
                borderLeft: `3px solid ${qStyle.color}`,
                padding: '0.45rem 0.65rem',
                borderRadius: '6px',
                fontSize: '0.72rem',
                color: '#cbd5e1',
                lineHeight: 1.35
              }}>
                <strong style={{ color: qStyle.accent }}>Macro Confluence: </strong>
                {activeMacroRegime.driver_summary}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. UNIFIED WORKSPACE MODE BAR & CHART CATEGORY FILTER */}
      {onSectionChange && (
        <div
          className="glass-card"
          style={{
            padding: '0.65rem 1rem',
            borderRadius: '12px',
            background: 'rgba(15, 23, 42, 0.78)',
            border: '1px solid rgba(255, 255, 255, 0.09)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem'
          }}
        >
          {/* Left: Primary View Mode Switcher */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginRight: '4px' }}>
              Workspace View:
            </span>
            {[
              { id: 'unified', label: '⚡ Unified Command (Internals + Macro)', color: '#38bdf8' },
              { id: 'internals', label: '📊 Market Breadth & 9 Internals Charts', color: '#10b981' },
              { id: 'macro', label: '🌐 Macro Matrix, Drivers & Stress Lab', color: '#f59e0b' }
            ].map((tab) => {
              const isAct = activeSection === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => onSectionChange(tab.id)}
                  style={{
                    padding: '6px 13px',
                    borderRadius: '8px',
                    border: `1px solid ${isAct ? tab.color : 'rgba(255,255,255,0.08)'}`,
                    background: isAct ? `${tab.color}20` : 'rgba(255,255,255,0.03)',
                    color: isAct ? '#f8fafc' : '#94a3b8',
                    fontSize: '0.79rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Right: Internals Chart Category Filter (when internals are visible) */}
          {activeSection !== 'macro' && onChartCategoryChange && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginRight: '2px' }}>
                Chart Filter:
              </span>
              {[
                { id: 'all', label: 'All (9)' },
                { id: 'breadth', label: 'Breadth & Momentum (4)' },
                { id: 'vol_credit', label: 'Volatility & Credit (3)' },
                { id: 'macro_cot', label: 'Liquidity & COT (2)' }
              ].map((cat) => {
                const isCat = chartCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => onChartCategoryChange(cat.id)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      border: `1px solid ${isCat ? '#60a5fa' : 'rgba(255,255,255,0.07)'}`,
                      background: isCat ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255,255,255,0.03)',
                      color: isCat ? '#93c5fd' : '#94a3b8',
                      fontSize: '0.74rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Enhanced Market Health Indicator Card
 */
export function MarketHealthGuideCard({
  icon: Icon = Activity,
  title,
  subtitle,
  badges = [],
  algoInsight,
  biasLabel,
  biasColor = '#3b82f6',
  whatItMeasures,
  benchmarks = [],
  playbook = [],
  children,
  defaultExpanded = false,
  cardBorderColor
}) {
  const [isGuideOpen, setIsGuideOpen] = useState(defaultExpanded);

  return (
    <div 
      className="glass-card" 
      style={{ 
        padding: '1.35rem', 
        border: `1px solid ${cardBorderColor || 'rgba(255, 255, 255, 0.09)'}`,
        borderRadius: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        background: 'rgba(15, 23, 42, 0.7)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
      }}
    >
      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ 
            width: '38px', 
            height: '38px', 
            borderRadius: '10px', 
            background: `${biasColor}18`, 
            border: `1px solid ${biasColor}45`,
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            color: biasColor,
            flexShrink: 0
          }}>
            <Icon size={20} />
          </div>
          <div>
            <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '1.08rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {title}
            </h3>
            {subtitle && (
              <p style={{ margin: '2px 0 0 0', color: '#94a3b8', fontSize: '0.78rem' }}>
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Live Badges & Guide Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
          {badges.map((b, idx) => (
            <span 
              key={idx}
              style={{
                padding: '3px 9px',
                borderRadius: '7px',
                fontSize: '0.76rem',
                fontWeight: 600,
                background: b.bg || 'rgba(255,255,255,0.05)',
                color: b.color || '#e2e8f0',
                border: `1px solid ${b.border || 'rgba(255,255,255,0.1)'}`,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontFamily: 'monospace'
              }}
            >
              {b.label && <span style={{ color: '#94a3b8', fontWeight: 400, fontFamily: 'sans-serif' }}>{b.label}:</span>}
              <span>{b.value}</span>
            </span>
          ))}

          {biasLabel && (
            <span style={{
              padding: '3px 9px',
              borderRadius: '7px',
              fontSize: '0.75rem',
              fontWeight: 700,
              background: `${biasColor}18`,
              color: biasColor,
              border: `1px solid ${biasColor}50`,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px'
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: biasColor }}></span>
              {biasLabel}
            </span>
          )}

          {/* Toggle Button */}
          <button
            onClick={() => setIsGuideOpen(!isGuideOpen)}
            style={{
              padding: '3px 9px',
              borderRadius: '7px',
              fontSize: '0.75rem',
              fontWeight: 600,
              background: isGuideOpen ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.05)',
              color: isGuideOpen ? '#93c5fd' : '#cbd5e1',
              border: `1px solid ${isGuideOpen ? 'rgba(59, 130, 246, 0.4)' : 'rgba(255, 255, 255, 0.1)'}`,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'all 0.2s ease'
            }}
            title="Toggle Indicator Guide & Strategy Playbook"
          >
            <BookOpen size={13} />
            <span>{isGuideOpen ? 'Hide Guide' : 'Playbook & Guide'}</span>
            {isGuideOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>
      </div>

      {/* Algo Insight Callout Banner */}
      {algoInsight && (
        <div style={{
          background: `${biasColor}10`,
          borderLeft: `3px solid ${biasColor}`,
          padding: '0.6rem 0.85rem',
          borderRadius: '6px',
          fontSize: '0.82rem',
          color: '#f1f5f9',
          lineHeight: '1.45',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.55rem'
        }}>
          <Zap size={15} color={biasColor} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong style={{ color: biasColor, textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.8px', marginRight: '6px' }}>
              Live Telemetry:
            </strong>
            <span>{algoInsight}</span>
          </div>
        </div>
      )}

      {/* Chart Section */}
      <div style={{ position: 'relative', width: '100%' }}>
        {children}
      </div>

      {/* Structured 3-Column Institutional Intelligence Panel */}
      {isGuideOpen && (
        <div style={{
          background: 'rgba(9, 13, 24, 0.75)',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          padding: '1.1rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '1.1rem',
          fontSize: '0.82rem',
          color: '#cbd5e1'
        }}>
          {/* Column 1: What It Measures */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#60a5fa', fontWeight: 700, fontSize: '0.85rem' }}>
              <Info size={15} />
              <span>What It Measures</span>
            </div>
            <p style={{ margin: 0, color: '#e2e8f0', lineHeight: '1.5', fontSize: '0.8rem' }}>
              {whatItMeasures}
            </p>
          </div>

          {/* Column 2: Institutional Benchmarks */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#f59e0b', fontWeight: 700, fontSize: '0.85rem' }}>
              <Gauge size={15} />
              <span>Institutional Benchmarks</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              {benchmarks.map((bm, idx) => (
                <div 
                  key={idx} 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'baseline', 
                    gap: '6px', 
                    background: bm.bg || 'rgba(255,255,255,0.03)', 
                    padding: '4px 8px', 
                    borderRadius: '6px',
                    border: `1px solid ${bm.color ? `${bm.color}30` : 'rgba(255,255,255,0.06)'}`
                  }}
                >
                  <span style={{ 
                    fontWeight: 700, 
                    color: bm.color || '#94a3b8', 
                    fontSize: '0.75rem', 
                    whiteSpace: 'nowrap',
                    minWidth: '68px'
                  }}>
                    {bm.level}:
                  </span>
                  <span style={{ color: '#cbd5e1', fontSize: '0.77rem', lineHeight: '1.35' }}>
                    {bm.meaning}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Column 3: Tactical Trade Playbook */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#10b981', fontWeight: 700, fontSize: '0.85rem' }}>
              <Zap size={15} />
              <span>Tactical Trade Playbook</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              {playbook.map((rule, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                  <CheckCircle2 size={13} color="#10b981" style={{ flexShrink: 0, marginTop: '3px' }} />
                  <span style={{ color: '#e2e8f0', fontSize: '0.78rem', lineHeight: '1.4' }}>
                    {rule}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * 9-Factor Executive Health Matrix Card
 * Provides an instant multi-dimensional scorecard overview across all 9 factors
 */
export function MarketHealthRadarMatrix({ healthData }) {
  if (!healthData || !healthData.current_health) return null;
  const curr = healthData.current_health;

  const factors = [
    {
      name: '1. Composite Health',
      value: `${curr.score_value}/100`,
      status: curr.score_label?.split('(')[0]?.trim() || 'Active',
      color: curr.score_value >= 60 ? '#10b981' : curr.score_value <= 40 ? '#ef4444' : '#f59e0b',
      delta: curr.score_5d_delta !== undefined ? `${curr.score_5d_delta > 0 ? '+' : ''}${curr.score_5d_delta} (5D)` : null,
      pctBar: Math.max(5, Math.min(100, Number(curr.score_value || 0)))
    },
    {
      name: '2. McClellan Oscillator',
      value: curr.mco_value,
      status: curr.mco_status,
      color: curr.mco_value > 300 ? '#f59e0b' : curr.mco_value > 0 ? '#10b981' : curr.mco_value < -300 ? '#ef4444' : '#f87171',
      delta: `SumIdx: ${curr.summation_index_val ?? 0}`,
      pctBar: Math.max(5, Math.min(100, ((Number(curr.mco_value || 0) + 500) / 1000) * 100))
    },
    {
      name: '3. Breadth (% > 50 SMA)',
      value: `${curr.pct_above_50_value}%`,
      status: curr.breadth_status,
      color: curr.pct_above_50_value > 60 ? '#10b981' : curr.pct_above_50_value < 50 ? '#ef4444' : '#f59e0b',
      delta: `>200 SMA: ${curr.pct_above_200_value}%`,
      pctBar: Math.max(5, Math.min(100, Number(curr.pct_above_50_value || 0)))
    },
    {
      name: '4. 20D Highs vs Lows',
      value: `${(curr.new_highs_count || 0).toLocaleString()}H / ${(curr.new_lows_count || 0).toLocaleString()}L`,
      status: (curr.nhnl_10d_ma || 0) > 0 ? 'Net Accumulation' : 'Net Distribution',
      color: (curr.nhnl_10d_ma || 0) > 0 ? '#10b981' : '#ef4444',
      delta: `10D MA: ${curr.nhnl_10d_ma || 0}`,
      pctBar: Math.max(5, Math.min(100, ((curr.new_highs_count || 0) / Math.max(1, (curr.new_highs_count || 0) + (curr.new_lows_count || 0))) * 100))
    },
    {
      name: '5. Volatility Skew (VIX)',
      value: `${curr.vix_value || 16.0}`,
      status: curr.vix_structure || 'Contango',
      color: curr.vix_structure?.includes('Contango') ? '#10b981' : '#ef4444',
      delta: `VIX3M: ${curr.vix3m_value || 18.0} (${curr.vix_ratio}x)`,
      pctBar: curr.vix_structure?.includes('Contango') ? 75 : 22
    },
    {
      name: '6. Credit Spreads (HYG/IEF)',
      value: curr.hyg_ratio_val ? `${curr.hyg_ratio_val}` : '0.86',
      status: (curr.hyg_zscore_val || 0) > 0 ? 'Risk Appetite (Z>0)' : 'Credit Stress (Z<0)',
      color: (curr.hyg_zscore_val || 0) > 0 ? '#10b981' : '#ef4444',
      delta: `Z-Score: ${curr.hyg_zscore_val > 0 ? '+' : ''}${curr.hyg_zscore_val ?? 0}σ`,
      pctBar: Math.max(5, Math.min(100, ((Number(curr.hyg_zscore_val || 0) + 3) / 6) * 100))
    },
    {
      name: '7. Cap-Weight vs Equal',
      value: `SPY/RSP ${curr.spy_rsp_ratio_val || '3.5'}`,
      status: 'Size Rotation',
      color: '#8b5cf6',
      delta: `QQQ/SPY: ${curr.qqq_spy_ratio_val || '0.88'}`,
      pctBar: 58
    },
    {
      name: '8. 13-Week T-Bill (^IRX)',
      value: `${curr.irx_val || 3.59}%`,
      status: (curr.irx_val || 0) > 4.0 ? 'Elevated Hurdle' : 'Accommodative',
      color: (curr.irx_val || 0) > 4.0 ? '#f59e0b' : '#38bdf8',
      delta: 'Risk-Free Hurdle',
      pctBar: (curr.irx_val || 0) > 4.0 ? 45 : 75
    },
    {
      name: '9. CFTC COT Commercials',
      value: curr.cot_net_val !== undefined ? `${curr.cot_net_val > 0 ? '+' : ''}${curr.cot_net_val.toLocaleString()}` : '-50,000',
      status: (curr.cot_net_val || 0) > 0 ? 'Smart Money Long' : 'Hedging Inventory',
      color: (curr.cot_net_val || 0) > 0 ? '#10b981' : '#f59e0b',
      delta: 'CME E-Mini S&P',
      pctBar: (curr.cot_net_val || 0) > 0 ? 82 : 45
    }
  ];

  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <h3 style={{ margin: 0, color: '#f1f5f9', fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Gauge size={17} color="#3b82f6" /> 9-Factor Market Internals Matrix
        </h3>
        <span style={{ color: '#94a3b8', fontSize: '0.76rem' }}>Multi-Factor Quantitative Telemetry</span>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: '0.75rem'
      }}>
        {factors.map((f, idx) => (
          <div 
            key={idx}
            className="glass-card"
            style={{
              padding: '0.85rem 1rem',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.07)',
              borderTop: `3px solid ${f.color}`,
              background: 'rgba(15, 23, 42, 0.6)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}
          >
            <div style={{ color: '#94a3b8', fontSize: '0.74rem', fontWeight: 600, marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {f.name}
            </div>
            <div style={{ color: '#f8fafc', fontSize: '1.15rem', fontWeight: 800, fontFamily: 'monospace', margin: '2px 0 6px 0' }}>
              {f.value}
            </div>
            <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.07)', borderRadius: '4px', overflow: 'hidden', marginBottom: '6px' }}>
              <div style={{ width: `${f.pctBar}%`, height: '100%', background: f.color }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', gap: '4px' }}>
              <span style={{ 
                color: f.color, 
                fontWeight: 700,
                background: `${f.color}15`,
                padding: '1px 6px',
                borderRadius: '4px',
                border: `1px solid ${f.color}30`,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                {f.status}
              </span>
              {f.delta && <span style={{ color: '#94a3b8', fontFamily: 'monospace', fontSize: '0.7rem', whiteSpace: 'nowrap' }}>{f.delta}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Regime Rules of Engagement Playbook
 */
export function RegimePlaybookCard({ currentRegime = 'RISK_OFF' }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const regimes = [
    {
      id: 'RISK_ON',
      name: 'Risk-On (Score ≥ 60)',
      color: '#10b981',
      cashTarget: '0% - 20% Cash (80-100% Invested)',
      positionSize: 'Full Size (100% Sizing)',
      setups: 'Breakouts, VCP Coils, High-RS Leaders, Episodic Pivots',
      stops: 'Normal Stops (5-8% ATR), Trail along 10/21 EMA',
      isCurrent: currentRegime === 'RISK_ON'
    },
    {
      id: 'CAUTIOUS',
      name: 'Cautious (Score 40 - 59)',
      color: '#f59e0b',
      cashTarget: '40% - 60% Cash (Selective)',
      positionSize: 'Half Size (50% Sizing)',
      setups: 'First Pullbacks to 21-EMA, Deep VCP Tightness, Quick Swings',
      stops: 'Tight Stops (3-5%), Take 1/3 to 1/2 off into strength',
      isCurrent: currentRegime === 'CAUTIOUS'
    },
    {
      id: 'RISK_OFF',
      name: 'Risk-Off (Score < 40)',
      color: '#ef4444',
      cashTarget: '70% - 100% Cash (Preservation)',
      positionSize: 'Quarter Size (25%) or Zero',
      setups: 'Capitulation Oversold Reversals (MCO < -350 hook), Short Weakness',
      stops: 'Breakeven Stops Immediately; No Overnights on Speculative Names',
      isCurrent: currentRegime === 'RISK_OFF'
    }
  ];

  const activeRegimeObj = regimes.find((r) => r.isCurrent) || regimes[2];

  return (
    <div 
      className="glass-card" 
      style={{ 
        padding: '1rem 1.25rem', 
        marginBottom: '1.5rem', 
        borderRadius: '12px',
        border: `1px solid ${activeRegimeObj.color}35`,
        background: 'rgba(15, 23, 42, 0.65)'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.8rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <ShieldAlert size={18} color={activeRegimeObj.color} />
          <h4 style={{ margin: 0, color: '#f8fafc', fontSize: '0.95rem', fontWeight: 700 }}>
            Regime Rules of Engagement:
          </h4>
          <span style={{
            padding: '2px 9px',
            borderRadius: '6px',
            background: `${activeRegimeObj.color}20`,
            border: `1px solid ${activeRegimeObj.color}50`,
            color: activeRegimeObj.color,
            fontSize: '0.76rem',
            fontWeight: 800
          }}>
            {activeRegimeObj.name}
          </span>
          <span style={{ color: '#cbd5e1', fontSize: '0.8rem' }}>
            • <strong>Setups:</strong> {activeRegimeObj.setups}
          </span>
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: '#93c5fd',
            padding: '4px 12px',
            borderRadius: '6px',
            fontSize: '0.76rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
        >
          {isExpanded ? 'Hide Full Matrix' : 'Compare All 3 Regimes'}
          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {isExpanded && (
        <div style={{ 
          marginTop: '1rem', 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
          gap: '1rem',
          fontSize: '0.82rem'
        }}>
          {regimes.map((r) => (
            <div 
              key={r.id}
              style={{
                background: r.isCurrent ? `${r.color}10` : 'rgba(255, 255, 255, 0.03)',
                border: `1.5px solid ${r.isCurrent ? r.color : 'rgba(255, 255, 255, 0.06)'}`,
                borderRadius: '10px',
                padding: '1rem',
                position: 'relative'
              }}
            >
              {r.isCurrent && (
                <span style={{
                  position: 'absolute',
                  top: '-10px',
                  right: '12px',
                  background: r.color,
                  color: '#000',
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: '10px',
                  letterSpacing: '0.5px'
                }}>
                  ACTIVE REGIME
                </span>
              )}

              <h4 style={{ margin: '0 0 0.65rem 0', color: r.color, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: r.color }}></span>
                {r.name}
              </h4>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', color: '#cbd5e1' }}>
                <div>
                  <span style={{ color: '#94a3b8', fontSize: '0.74rem', display: 'block' }}>Cash vs Capital Deployment:</span>
                  <strong style={{ color: '#f1f5f9' }}>{r.cashTarget}</strong>
                </div>
                <div>
                  <span style={{ color: '#94a3b8', fontSize: '0.74rem', display: 'block' }}>Position Sizing:</span>
                  <strong style={{ color: '#f1f5f9' }}>{r.positionSize}</strong>
                </div>
                <div>
                  <span style={{ color: '#94a3b8', fontSize: '0.74rem', display: 'block' }}>Focus Setups:</span>
                  <span style={{ color: '#e2e8f0', fontSize: '0.78rem' }}>{r.setups}</span>
                </div>
                <div>
                  <span style={{ color: '#94a3b8', fontSize: '0.74rem', display: 'block' }}>Stop & Trade Management:</span>
                  <span style={{ color: '#e2e8f0', fontSize: '0.78rem' }}>{r.stops}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
