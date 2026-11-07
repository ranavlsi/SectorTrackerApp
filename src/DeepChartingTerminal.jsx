import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Activity,
  BarChart2,
  Search,
  Shield,
  Target,
  Zap,
  TrendingUp,
  TrendingDown,
  Layers,
  CheckCircle2,
  XCircle,
  Radio,
  Loader,
  PanelRightClose,
  PanelRightOpen,
  Sparkles,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { AdvancedRealTimeChart } from 'react-ts-tradingview-widgets';
import UnifiedPlotlyChart from './UnifiedPlotlyChart';
import { RossHaberPersonalityPanel } from './StockPersonalityBadge';

const QUICK_TICKERS = ['SPY', 'QQQ', 'NVDA', 'TSLA', 'AAPL', 'MSFT', 'META', 'PLTR', 'AMD', 'AVGO', 'HOOD', 'SMH'];

export default function DeepChartingTerminal({
  expertTickerData,
  isSearching,
  searchError,
  onSelectTicker,
  dnaData,
  loadingDna,
  onFetchDna,
}) {
  const [localInput, setLocalInput] = useState('');
  const [chartData, setChartData] = useState(null);
  const [dockTab, setDockTab] = useState('quant_ma'); // 'quant_ma', 'options_gex', 'dna_personality', 'fund_news'
  const [showRightDock, setShowRightDock] = useState(true);
  const [chartViewMode, setChartViewMode] = useState('quant_4pane'); // 'quant_4pane' | 'full_price' | 'tradingview_full'
  const [isFullChartScreen, setIsFullChartScreen] = useState(false);

  const activeTicker = expertTickerData?.ticker || chartData?.ticker || 'NVDA';

  // Auto-load default ticker (NVDA) if user opens Deep Charting tab directly without selecting a stock first
  useEffect(() => {
    if (!expertTickerData && !isSearching && typeof onSelectTicker === 'function') {
      onSelectTicker('NVDA');
    }
  }, []);

  // Auto-fetch 10-Year Historical DNA when user switches to DNA tab or changes ticker while on DNA tab
  useEffect(() => {
    if (dockTab === 'dna_personality' && activeTicker && typeof onFetchDna === 'function') {
      if (!dnaData || dnaData.ticker !== activeTicker) {
        onFetchDna(activeTicker);
      }
    }
  }, [dockTab, activeTicker]);

  const handleTickerSubmit = (e) => {
    e.preventDefault();
    const sym = localInput.trim().toUpperCase();
    if (!sym) return;
    if (typeof onSelectTicker === 'function') {
      onSelectTicker(sym);
    }
    setLocalInput('');
  };

  const sm = chartData?.summary_metrics || {};
  const maRibbon = chartData?.ma_ribbon || {};
  const td = chartData?.trend_diagnostics || null;
  const trendTemplate = chartData?.trend_template || { checks: [], passed: 0, total: 8 };
  const vp = chartData?.volume_profile || {};
  const opt = chartData?.options_intel || null;
  const tp = chartData?.trade_plan || expertTickerData?.trade_plan || null;

  const spotPrice = sm.last_price || expertTickerData?.trade_plan?.entry || 0;
  const chg1d = sm.change_1d_pct ?? expertTickerData?.technicals?.perf ?? 0;
  const stageText = td?.stage_label || expertTickerData?.technicals?.stage || 'Stage Analysis';
  const stageColor =
    td?.stage_color ||
    (stageText.includes('Stage 2')
      ? '#10b981'
      : stageText.includes('Stage 4')
      ? '#ef4444'
      : '#f59e0b');
  const masterScore = expertTickerData?.score ?? null;
  const scoreColor =
    masterScore >= 70 ? '#10b981' : masterScore >= 45 ? '#f59e0b' : '#ef4444';

  return (
    <div
      style={{
        width: '100%',
        minHeight: 'calc(100vh - 115px)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.65rem',
        color: '#f8fafc',
      }}
    >
      {/* ===================================================================== */}
      {/* 1. TOP INSTITUTIONAL COMMAND HEADER & INSTANT TICKER SWITCHER         */}
      {/* ===================================================================== */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(9, 13, 22, 0.98))',
          border: '1px solid rgba(56, 189, 248, 0.25)',
          borderRadius: '10px',
          padding: '0.65rem 0.9rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.55rem',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          {/* Left: Ticker Identity, Spot Price, Stage & Key Vital Badges */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
              <span
                style={{
                  fontSize: '1.65rem',
                  fontWeight: 900,
                  color: '#ffffff',
                  fontFamily: 'monospace',
                  letterSpacing: '0.02em',
                }}
              >
                {activeTicker}
              </span>
              <span style={{ fontSize: '0.82rem', color: '#94a3b8', fontWeight: 500 }}>
                {expertTickerData?.name || ''}
              </span>
            </div>

            {spotPrice > 0 && (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', fontFamily: 'monospace' }}>
                <span style={{ fontSize: '1.35rem', fontWeight: 800, color: '#f8fafc' }}>
                  ${spotPrice.toFixed(2)}
                </span>
                <span
                  style={{
                    fontSize: '0.8rem',
                    fontWeight: 800,
                    padding: '2px 7px',
                    borderRadius: '5px',
                    background: chg1d >= 0 ? 'rgba(16, 185, 129, 0.16)' : 'rgba(239, 68, 68, 0.16)',
                    border: `1px solid ${chg1d >= 0 ? 'rgba(16, 185, 129, 0.45)' : 'rgba(239, 68, 68, 0.45)'}`,
                    color: chg1d >= 0 ? '#10b981' : '#f87171',
                  }}
                >
                  {chg1d >= 0 ? '+' : ''}
                  {chg1d.toFixed(2)}%
                </span>
              </div>
            )}

            {/* Weinstein / Minervini Sub-Stage Pill */}
            <span
              style={{
                padding: '3px 9px',
                borderRadius: '6px',
                background: `${stageColor}1f`,
                border: `1px solid ${stageColor}77`,
                color: stageColor,
                fontSize: '0.73rem',
                fontWeight: 800,
                fontFamily: 'monospace',
              }}
              title={td?.narrative || stageText}
            >
              🏛️ {stageText}
            </span>

            {/* Trend Alignment Stack Pill */}
            {td?.regime_short && (
              <span
                style={{
                  padding: '3px 9px',
                  borderRadius: '6px',
                  background: `${td.regime_color || '#38bdf8'}1a`,
                  border: `1px solid ${td.regime_color || '#38bdf8'}66`,
                  color: td.regime_color || '#38bdf8',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  fontFamily: 'monospace',
                }}
                title={td.trend_regime}
              >
                📐 {td.regime_short}
              </span>
            )}

            {/* Where We Are In Trend Pill */}
            {td?.maturity_phase && (
              <span
                style={{
                  padding: '3px 9px',
                  borderRadius: '6px',
                  background: 'rgba(56, 189, 248, 0.14)',
                  border: '1px solid rgba(56, 189, 248, 0.45)',
                  color: '#38bdf8',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  fontFamily: 'monospace',
                }}
                title="Where We Are in the Current Trend Cycle vs 50-SMA"
              >
                📍 {td.maturity_phase}
              </span>
            )}

            {/* Overall Overextension / Stretch Verdict Badge */}
            {td?.verdict_short && (
              <span
                style={{
                  padding: '3px 9px',
                  borderRadius: '6px',
                  background: `${td.verdict_color || '#f59e0b'}1f`,
                  border: `1px solid ${td.verdict_color || '#f59e0b'}77`,
                  color: td.verdict_color || '#f59e0b',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  fontFamily: 'monospace',
                }}
                title={`${td.verdict} — ${td.tactical_zone}`}
              >
                {td.verdict_short}
              </span>
            )}

            {/* Minervini Trend Template Score */}
            <span
              style={{
                padding: '3px 9px',
                borderRadius: '6px',
                background:
                  trendTemplate.passed >= 6
                    ? 'rgba(16, 185, 129, 0.14)'
                    : trendTemplate.passed >= 4
                    ? 'rgba(245, 158, 11, 0.14)'
                    : 'rgba(239, 68, 68, 0.14)',
                border: `1px solid ${
                  trendTemplate.passed >= 6
                    ? 'rgba(16, 185, 129, 0.45)'
                    : trendTemplate.passed >= 4
                    ? 'rgba(245, 158, 11, 0.45)'
                    : 'rgba(239, 68, 68, 0.45)'
                }`,
                color:
                  trendTemplate.passed >= 6
                    ? '#10b981'
                    : trendTemplate.passed >= 4
                    ? '#fbbf24'
                    : '#f87171',
                fontSize: '0.72rem',
                fontWeight: 700,
                fontFamily: 'monospace',
              }}
              title="Mark Minervini 8-Point Stage 2 Trend Template Score"
            >
              Trend Template: {trendTemplate.passed}/8
            </span>

            {/* Master Algo Score */}
            {masterScore !== null && (
              <span
                style={{
                  padding: '3px 9px',
                  borderRadius: '6px',
                  background: `${scoreColor}1a`,
                  border: `1px solid ${scoreColor}66`,
                  color: scoreColor,
                  fontSize: '0.73rem',
                  fontWeight: 800,
                  fontFamily: 'monospace',
                }}
              >
                ⚡ Algo Score: {masterScore}/100
              </span>
            )}

            {/* Quick Microstructure Pills */}
            {sm.adr_20_pct !== undefined && (
              <span
                style={{
                  fontSize: '0.72rem',
                  fontFamily: 'monospace',
                  color: '#cbd5e1',
                  background: 'rgba(255,255,255,0.04)',
                  padding: '2px 7px',
                  borderRadius: '5px',
                  border: '1px solid rgba(148,163,184,0.16)',
                }}
              >
                20D ADR: <strong style={{ color: '#38bdf8' }}>{sm.adr_20_pct}%</strong> · ATR:{' '}
                <strong style={{ color: '#f59e0b' }}>${sm.atr_14}</strong>
              </span>
            )}

            {sm.ud_vol_ratio_20d !== undefined && (
              <span
                style={{
                  fontSize: '0.72rem',
                  fontFamily: 'monospace',
                  color: '#cbd5e1',
                  background: 'rgba(255,255,255,0.04)',
                  padding: '2px 7px',
                  borderRadius: '5px',
                  border: '1px solid rgba(148,163,184,0.16)',
                }}
              >
                20D U/D Vol:{' '}
                <strong style={{ color: sm.ud_vol_ratio_20d >= 1.2 ? '#10b981' : '#f87171' }}>
                  {sm.ud_vol_ratio_20d}x
                </strong>
              </span>
            )}
          </div>

          {/* Right: Chart Mode Switcher + Instant Ticker Search Bar + Full Chart + Dock Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
            {/* 3-Way Chart View Mode Switcher */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
                background: 'rgba(2, 6, 23, 0.8)',
                border: '1px solid rgba(148, 163, 184, 0.2)',
                borderRadius: '6px',
                padding: '2px',
              }}
            >
              {[
                { id: 'quant_4pane', label: '📊 4-Pane Quant' },
                { id: 'full_price', label: '📈 Full Price' },
                { id: 'tradingview_full', label: '🏛️ TradingView Full Chart' },
              ].map((m) => {
                const isAct = chartViewMode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setChartViewMode(m.id);
                      if (m.id === 'full_price' || m.id === 'tradingview_full') {
                        setShowRightDock(false);
                      } else {
                        setShowRightDock(true);
                      }
                    }}
                    style={{
                      padding: '3px 8px',
                      borderRadius: '4px',
                      border: isAct ? '1px solid rgba(56, 189, 248, 0.5)' : '1px solid transparent',
                      background: isAct ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
                      color: isAct ? '#38bdf8' : '#94a3b8',
                      fontSize: '0.7rem',
                      fontFamily: 'monospace',
                      fontWeight: isAct ? 800 : 600,
                      cursor: 'pointer',
                    }}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>

            <form onSubmit={handleTickerSubmit} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: 'rgba(2, 6, 23, 0.75)',
                  border: '1px solid rgba(56, 189, 248, 0.35)',
                  borderRadius: '6px',
                  padding: '3px 8px',
                }}
              >
                <Search size={13} color="#38bdf8" style={{ marginRight: '5px' }} />
                <input
                  type="text"
                  value={localInput}
                  onChange={(e) => setLocalInput(e.target.value)}
                  placeholder="Load ticker (e.g. NVDA, PLTR)..."
                  style={{
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: '#f8fafc',
                    fontFamily: 'monospace',
                    fontSize: '0.76rem',
                    width: '155px',
                  }}
                />
              </div>
              <button
                type="submit"
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: '1px solid #38bdf8',
                  background: 'rgba(56, 189, 248, 0.2)',
                  color: '#38bdf8',
                  fontSize: '0.73rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                Plot
              </button>
            </form>

            {/* Full-Screen Full Chart Button */}
            <button
              type="button"
              onClick={() => {
                setIsFullChartScreen((f) => {
                  const next = !f;
                  if (next) setShowRightDock(false);
                  return next;
                });
              }}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                border: '1px solid rgba(16, 185, 129, 0.45)',
                background: isFullChartScreen ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.16)',
                color: isFullChartScreen ? '#f87171' : '#10b981',
                fontSize: '0.72rem',
                fontFamily: 'monospace',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
              title="Expand Active Chart to Fullscreen (100vw × 100vh)"
            >
              {isFullChartScreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
              {isFullChartScreen ? 'Exit Full Chart' : 'Full Chart'}
            </button>

            <button
              type="button"
              onClick={() => setShowRightDock((d) => !d)}
              style={{
                padding: '4px 8px',
                borderRadius: '6px',
                border: '1px solid rgba(148, 163, 184, 0.25)',
                background: 'rgba(15, 23, 42, 0.8)',
                color: '#cbd5e1',
                fontSize: '0.72rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
              title={showRightDock ? 'Collapse Right Quant Telemetry Dock' : 'Open Right Quant Telemetry Dock'}
            >
              {showRightDock ? <PanelRightClose size={14} /> : <PanelRightOpen size={14} />}
              {showRightDock ? 'Hide Dock' : 'Quant Dock'}
            </button>
          </div>
        </div>

        {/* Quick Market Leaders & Benchmarks Strip */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.5rem',
            paddingTop: '0.35rem',
            borderTop: '1px solid rgba(148, 163, 184, 0.12)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.69rem', color: '#64748b', fontWeight: 700, marginRight: '4px' }}>
              QUICK SWITCH:
            </span>
            {QUICK_TICKERS.map((sym) => {
              const isCurr = sym === activeTicker;
              return (
                <button
                  key={sym}
                  type="button"
                  onClick={() => onSelectTicker && onSelectTicker(sym)}
                  style={{
                    padding: '2px 7px',
                    borderRadius: '4px',
                    border: isCurr ? '1px solid #38bdf8' : '1px solid rgba(148, 163, 184, 0.16)',
                    background: isCurr ? 'rgba(56, 189, 248, 0.22)' : 'rgba(2, 6, 23, 0.45)',
                    color: isCurr ? '#38bdf8' : '#cbd5e1',
                    fontSize: '0.7rem',
                    fontFamily: 'monospace',
                    fontWeight: isCurr ? 800 : 600,
                    cursor: 'pointer',
                  }}
                >
                  {sym}
                </button>
              );
            })}
          </div>

          {/* 52-Week Range & Footprint Counters */}
          {sm.high_52w > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.71rem', fontFamily: 'monospace', color: '#94a3b8' }}>
              <span>
                52W Range: <strong style={{ color: '#ef4444' }}>${sm.low_52w}</strong> —{' '}
                <strong style={{ color: '#10b981' }}>${sm.high_52w}</strong> (
                <span style={{ color: sm.pct_off_52w_high >= -10 ? '#10b981' : '#f59e0b' }}>
                  {sm.pct_off_52w_high}% vs High
                </span>
                )
              </span>
              <span>·</span>
              <span style={{ color: '#00f2fe' }}>⚡ {sm.pocket_pivot_count || 0} Pocket Pivots</span>
              <span>·</span>
              <span style={{ color: '#fbbf24' }}>💧 {sm.vdu_count || 0} VDU Bars</span>
              <span>·</span>
              <span style={{ color: '#38bdf8' }}>🔵 {sm.blue_dot_count || 0} RS Blue Dots</span>
            </div>
          )}
        </div>

        {/* Row 3: Live SMA Overextension Telemetry & Where-In-Trend Strip */}
        {Object.keys(maRibbon).length > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.5rem',
              paddingTop: '0.4rem',
              borderTop: '1px solid rgba(148, 163, 184, 0.12)',
              fontFamily: 'monospace',
              fontSize: '0.69rem',
            }}
          >
            {/* Individual SMA Stretch & Overextension Pills */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
              <span style={{ color: '#64748b', fontWeight: 800 }}>SMA STRETCH &amp; EXTENSION:</span>
              {Object.values(maRibbon).map((m) => {
                if (m.dist_pct === null || m.dist_pct === undefined) return null;
                const stColor = m.state_color || '#94a3b8';
                return (
                  <span
                    key={m.label}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '2px 7px',
                      borderRadius: '5px',
                      background: 'rgba(2, 6, 23, 0.65)',
                      border: `1px solid ${stColor}55`,
                    }}
                    title={`${m.label} ($${m.value}): ${m.dist_pct >= 0 ? '+' : ''}${m.dist_pct}% (${m.atr_multiple >= 0 ? '+' : ''}${m.atr_multiple}x ATR | ${m.pct_rank_1y}th 1Y %ile) — ${m.stretch_state}`}
                  >
                    <strong style={{ color: m.color }}>{m.label}:</strong>
                    <span style={{ color: m.dist_pct >= 0 ? '#10b981' : '#f87171', fontWeight: 700 }}>
                      {m.dist_pct >= 0 ? '+' : ''}
                      {m.dist_pct}%
                    </span>
                    {m.atr_multiple !== undefined && m.atr_multiple !== null && (
                      <span style={{ color: '#94a3b8', fontSize: '0.64rem' }}>
                        ({m.atr_multiple >= 0 ? '+' : ''}
                        {m.atr_multiple}x ATR)
                      </span>
                    )}
                    <span
                      style={{
                        padding: '1px 5px',
                        borderRadius: '3px',
                        background: `${stColor}22`,
                        color: stColor,
                        fontSize: '0.62rem',
                        fontWeight: 800,
                      }}
                    >
                      {m.stretch_state}
                    </span>
                  </span>
                );
              })}
            </div>

            {/* Tactical Zone Summary */}
            {td?.tactical_zone && (
              <div
                style={{
                  color: td.verdict_color || '#38bdf8',
                  fontWeight: 700,
                  background: 'rgba(2, 6, 23, 0.65)',
                  padding: '2px 8px',
                  borderRadius: '5px',
                  border: `1px solid ${(td.verdict_color || '#38bdf8')}44`,
                }}
              >
                {td.tactical_zone}
              </div>
            )}
          </div>
        )}

        {/* Row 4: MarketSurge Pattern Recognition & Official Buy Point Strip */}
        {chartData?.marketsurge?.buy_point > 0 && (() => {
          const ms = chartData.marketsurge;
          const distPct = ms.distance_to_pivot_pct ?? ms.dist_to_pivot_pct ?? 0;
          const pColor = ms.pivot_status_color || ms.status_color || '#10b981';
          const pStage = ms.pattern_stage || `${ms.base_length_weeks || 5}w Base`;
          return (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.5rem',
                paddingTop: '0.35rem',
                borderTop: '1px solid rgba(192, 132, 252, 0.22)',
                fontFamily: 'monospace',
                fontSize: '0.7rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: '5px',
                    background: 'rgba(192, 132, 252, 0.18)',
                    border: '1px solid rgba(192, 132, 252, 0.55)',
                    color: '#c084fc',
                    fontWeight: 900,
                  }}
                >
                  🏆 MARKET-SURGE PATTERN: {ms.pattern_name} ({pStage})
                </span>
                <span style={{ color: '#e2e8f0' }}>
                  Official Buy Pt: <strong style={{ color: '#10b981' }}>${ms.buy_point.toFixed(2)}</strong>
                </span>
                <span style={{ color: '#94a3b8' }}>
                  5% Buy Zone: <strong style={{ color: '#34d399' }}>${ms.buy_point.toFixed(2)} – ${ms.buy_zone_high.toFixed(2)}</strong>
                </span>
                <span style={{ color: '#94a3b8' }}>
                  -7.5% Stop: <strong style={{ color: '#ef4444' }}>${ms.stop_loss.toFixed(2)}</strong>
                </span>
                <span style={{ color: '#94a3b8' }}>
                  +20-25% Goal: <strong style={{ color: '#38bdf8' }}>${ms.profit_goal_20.toFixed(2)} – ${ms.profit_goal_25.toFixed(2)}</strong>
                </span>
                {ms.base_depth_pct > 0 && (
                  <span style={{ color: '#94a3b8' }}>
                    Depth: <strong style={{ color: '#fbbf24' }}>-{ms.base_depth_pct}%</strong> ({ms.base_length_weeks}w)
                  </span>
                )}
                {ms.handle_depth_pct > 0 && (
                  <span style={{ color: '#94a3b8' }}>
                    Handle: <strong style={{ color: '#f59e0b' }}>-{ms.handle_depth_pct}%</strong>
                  </span>
                )}
              </div>
              <span
                style={{
                  padding: '2px 8px',
                  borderRadius: '5px',
                  background: `${pColor}22`,
                  border: `1px solid ${pColor}66`,
                  color: pColor,
                  fontWeight: 800,
                }}
              >
                {ms.pivot_badge || ms.pivot_status} ({distPct >= 0 ? '+' : ''}{distPct}% vs ${ms.buy_point.toFixed(2)})
              </span>
            </div>
          );
        })()}
      </div>

      {/* ===================================================================== */}
      {/* 2. MAIN PRO TERMINAL WORKSPACE: 4-PANE CHART + QUANT TELEMETRY DOCK   */}
      {/* ===================================================================== */}
      <div
        style={{
          flex: 1,
          width: '100%',
          display: 'grid',
          gridTemplateColumns: showRightDock ? 'minmax(0, 1fr) 375px' : 'minmax(0, 1fr)',
          gap: '0.75rem',
          alignItems: 'stretch',
        }}
      >
        {/* LEFT: Interactive Institutional Chart (4-Pane Quant, Full Price, or TradingView Full Chart) */}
        <div style={{ minHeight: '720px', width: '100%', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          {chartViewMode === 'tradingview_full' ? (
            (() => {
              const tvNode = (
                <div
                  style={{
                    position: isFullChartScreen ? 'fixed' : 'relative',
                    inset: isFullChartScreen ? 0 : 'auto',
                    top: isFullChartScreen ? 0 : 'auto',
                    left: isFullChartScreen ? 0 : 'auto',
                    width: isFullChartScreen ? '100vw' : '100%',
                    height: isFullChartScreen ? '100vh' : '760px',
                    zIndex: isFullChartScreen ? 999999 : 1,
                    background: '#070b12',
                    border: '1px solid rgba(56, 189, 248, 0.25)',
                    borderRadius: isFullChartScreen ? 0 : '10px',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                  }}
                >
                  {/* TradingView Full Chart Top Control Strip */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.45rem 0.85rem',
                      background: 'rgba(15, 23, 42, 0.96)',
                      borderBottom: '1px solid rgba(148, 163, 184, 0.16)',
                      flexWrap: 'wrap',
                      gap: '0.5rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#38bdf8', fontFamily: 'monospace' }}>
                        🏛️ TRADINGVIEW FULL INTERACTIVE CHART · {activeTicker}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                        (Full Drawing Toolbar, Fibonacci, Multi-Timeframe &amp; 100+ Indicators)
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setChartViewMode('quant_4pane');
                          setShowRightDock(true);
                        }}
                        style={{
                          padding: '3px 9px',
                          borderRadius: '5px',
                          border: '1px solid rgba(56, 189, 248, 0.4)',
                          background: 'rgba(56, 189, 248, 0.15)',
                          color: '#38bdf8',
                          fontSize: '0.7rem',
                          fontFamily: 'monospace',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        📊 Switch to 4-Pane Quant + GEX
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsFullChartScreen((f) => !f)}
                        style={{
                          padding: '3px 9px',
                          borderRadius: '5px',
                          border: '1px solid rgba(16, 185, 129, 0.45)',
                          background: isFullChartScreen ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.16)',
                          color: isFullChartScreen ? '#f87171' : '#10b981',
                          fontSize: '0.7rem',
                          fontFamily: 'monospace',
                          fontWeight: 800,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        {isFullChartScreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                        {isFullChartScreen ? 'Exit Fullscreen' : 'Fullscreen'}
                      </button>
                    </div>
                  </div>
                  <div
                    className="tv-full-widget-host"
                    style={{
                      flex: 1,
                      width: '100%',
                      height: isFullChartScreen ? 'calc(100vh - 45px)' : '710px',
                      minHeight: isFullChartScreen ? 'calc(100vh - 45px)' : '710px',
                    }}
                  >
                    <AdvancedRealTimeChart
                      symbol={activeTicker}
                      theme="dark"
                      autosize
                      interval="D"
                      timezone="America/New_York"
                      style="1"
                      locale="en"
                      toolbar_bg="#0b101b"
                      enable_publishing={false}
                      withdateranges={true}
                      hide_side_toolbar={false}
                      allow_symbol_change={true}
                      save_image={true}
                      details={true}
                      hotlist={false}
                      calendar={false}
                      studies={[
                        'MASimple@tv-basicstudies',
                        'MAExp@tv-basicstudies',
                        'RSI@tv-basicstudies',
                        'Volume@tv-basicstudies',
                      ]}
                    />
                  </div>
                </div>
              );
              return isFullChartScreen && typeof document !== 'undefined'
                ? createPortal(tvNode, document.body)
                : tvNode;
            })()
          ) : (
            <UnifiedPlotlyChart
              ticker={activeTicker}
              onChartDataLoaded={setChartData}
              onSelectTicker={onSelectTicker}
              externalPaneLayout={chartViewMode === 'full_price' ? 'full_price' : '4pane'}
              onPaneLayoutChange={(mode) => {
                setChartViewMode(mode === 'full_price' ? 'full_price' : 'quant_4pane');
                if (mode === 'full_price') setShowRightDock(false);
              }}
              externalFullscreen={isFullChartScreen}
              onToggleFullscreen={(nextFs) => {
                setIsFullChartScreen(nextFs);
                if (nextFs) setShowRightDock(false);
              }}
            />
          )}
        </div>

        {/* RIGHT: High-Density Institutional Quant Telemetry Dock */}
        {showRightDock && (
          <div
            style={{
              background: 'rgba(11, 16, 27, 0.95)',
              border: '1px solid rgba(148, 163, 184, 0.16)',
              borderRadius: '10px',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '780px',
              overflow: 'hidden',
            }}
          >
            {/* Dock Sub-Navigation Tabs */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '2px',
                padding: '4px',
                background: 'rgba(2, 6, 23, 0.85)',
                borderBottom: '1px solid rgba(148, 163, 184, 0.14)',
              }}
            >
              {[
                { id: 'quant_ma', label: '🧭 Quant & MA' },
                { id: 'options_gex', label: '🛡️ GEX & IV' },
                { id: 'dna_personality', label: '🧬 10Y DNA' },
                { id: 'fund_news', label: '🏛️ Fund & AI' },
              ].map((tb) => {
                const active = dockTab === tb.id;
                return (
                  <button
                    key={tb.id}
                    type="button"
                    onClick={() => setDockTab(tb.id)}
                    style={{
                      padding: '6px 4px',
                      borderRadius: '6px',
                      border: active ? '1px solid rgba(56, 189, 248, 0.45)' : '1px solid transparent',
                      background: active ? 'rgba(56, 189, 248, 0.16)' : 'transparent',
                      color: active ? '#38bdf8' : '#94a3b8',
                      fontSize: '0.7rem',
                      fontWeight: active ? 800 : 600,
                      cursor: 'pointer',
                      textAlign: 'center',
                    }}
                  >
                    {tb.label}
                  </button>
                );
              })}
            </div>

            {/* Dock Scrollable Body */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '0.75rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
              }}
            >
              {/* =============================================================== */}
              {/* DOCK TAB 1: QUANT & MOVING AVERAGE MATRIX + TRADE PLAN          */}
              {/* =============================================================== */}
              {dockTab === 'quant_ma' && (
                <>
                  {/* 0. Stage, Trend Lifecycle & Where We Are In Trend Card */}
                  {td && (
                    <div
                      style={{
                        background: 'linear-gradient(145deg, rgba(15, 23, 42, 0.85), rgba(9, 13, 22, 0.95))',
                        border: `1px solid ${(td.stage_color || '#38bdf8')}55`,
                        borderRadius: '8px',
                        padding: '0.7rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.55rem',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '0.4rem',
                        }}
                      >
                        <span
                          style={{
                            fontSize: '0.73rem',
                            fontWeight: 800,
                            color: '#38bdf8',
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                          }}
                        >
                          🧭 Where We Are in Trend &amp; Stage
                        </span>
                        <span
                          style={{
                            padding: '2px 7px',
                            borderRadius: '4px',
                            background: `${td.stage_color || '#10b981'}22`,
                            border: `1px solid ${td.stage_color || '#10b981'}66`,
                            color: td.stage_color || '#10b981',
                            fontSize: '0.68rem',
                            fontWeight: 800,
                            fontFamily: 'monospace',
                          }}
                        >
                          {td.stage_code}
                        </span>
                      </div>

                      {/* 6-Stage Visual Lifecycle Progress Bar */}
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(6, 1fr)',
                          gap: '3px',
                        }}
                      >
                        {(td.lifecycle_steps || []).map((st) => {
                          const isHere = st.step === td.stage_index;
                          const stepColor =
                            st.step === 1
                              ? '#38bdf8'
                              : st.step === 2
                              ? '#00f2fe'
                              : st.step === 3
                              ? '#10b981'
                              : st.step === 4
                              ? '#f59e0b'
                              : st.step === 5
                              ? '#fb923c'
                              : '#ef4444';
                          return (
                            <div
                              key={st.step}
                              style={{
                                padding: '4px 2px',
                                borderRadius: '5px',
                                textAlign: 'center',
                                background: isHere ? `${stepColor}28` : 'rgba(2, 6, 23, 0.6)',
                                border: isHere
                                  ? `1.5px solid ${stepColor}`
                                  : '1px solid rgba(148, 163, 184, 0.14)',
                                boxShadow: isHere ? `0 0 10px ${stepColor}40` : 'none',
                              }}
                            >
                              <div
                                style={{
                                  fontSize: '0.6rem',
                                  fontWeight: 800,
                                  fontFamily: 'monospace',
                                  color: isHere ? stepColor : '#64748b',
                                }}
                              >
                                {isHere ? `📍 ${st.code}` : st.code}
                              </div>
                              <div
                                style={{
                                  fontSize: '0.58rem',
                                  color: isHere ? '#f8fafc' : '#475569',
                                  fontWeight: isHere ? 700 : 500,
                                }}
                              >
                                {st.label}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Stage, Regime & Run Maturity Telemetry Grid */}
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr',
                          gap: '0.35rem',
                          fontFamily: 'monospace',
                          fontSize: '0.7rem',
                        }}
                      >
                        <div
                          style={{
                            background: 'rgba(2, 6, 23, 0.6)',
                            padding: '5px 8px',
                            borderRadius: '6px',
                            borderLeft: `3px solid ${td.stage_color || '#10b981'}`,
                          }}
                        >
                          <div style={{ fontSize: '0.62rem', color: '#94a3b8' }}>WEINSTEIN / MINERVINI STAGE</div>
                          <div style={{ fontWeight: 800, color: td.stage_color || '#f8fafc', fontSize: '0.73rem' }}>
                            {td.stage_label}
                          </div>
                        </div>

                        <div
                          style={{
                            background: 'rgba(2, 6, 23, 0.6)',
                            padding: '5px 8px',
                            borderRadius: '6px',
                            borderLeft: `3px solid ${td.regime_color || '#38bdf8'}`,
                          }}
                        >
                          <div style={{ fontSize: '0.62rem', color: '#94a3b8' }}>TREND STRUCTURE &amp; MA ALIGNMENT</div>
                          <div style={{ fontWeight: 700, color: '#e2e8f0', fontSize: '0.71rem' }}>
                            {td.trend_regime}
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.35rem' }}>
                          <div
                            style={{
                              background: 'rgba(2, 6, 23, 0.6)',
                              padding: '5px 8px',
                              borderRadius: '6px',
                            }}
                          >
                            <div style={{ fontSize: '0.61rem', color: '#94a3b8' }}>POSITION IN TREND LEG</div>
                            <div style={{ fontWeight: 800, color: '#38bdf8', fontSize: '0.7rem', marginTop: '2px' }}>
                              {td.maturity_phase}
                            </div>
                          </div>

                          <div
                            style={{
                              background: 'rgba(2, 6, 23, 0.6)',
                              padding: '5px 8px',
                              borderRadius: '6px',
                            }}
                          >
                            <div style={{ fontSize: '0.61rem', color: '#94a3b8' }}>STRETCH THERMOMETER</div>
                            <div
                              style={{
                                fontWeight: 800,
                                color: td.verdict_color || '#f59e0b',
                                fontSize: '0.72rem',
                                marginTop: '2px',
                              }}
                            >
                              {td.stretch_index}/100 · {td.verdict_short}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Tactical Action Zone & Narrative */}
                      <div
                        style={{
                          background: `${td.verdict_color || '#38bdf8'}14`,
                          border: `1px solid ${td.verdict_color || '#38bdf8'}44`,
                          borderRadius: '6px',
                          padding: '6px 8px',
                          fontSize: '0.69rem',
                          lineHeight: 1.4,
                          color: '#e2e8f0',
                        }}
                      >
                        <div style={{ fontWeight: 800, color: td.verdict_color || '#38bdf8', marginBottom: '2px' }}>
                          {td.verdict}
                        </div>
                        <div style={{ color: '#cbd5e1', fontSize: '0.67rem' }}>{td.narrative}</div>
                      </div>
                    </div>
                  )}

                  {/* 1. Moving Average Overextension & Stretch Matrix */}
                  <div
                    style={{
                      background: 'rgba(15, 23, 42, 0.65)',
                      border: '1px solid rgba(148, 163, 184, 0.14)',
                      borderRadius: '8px',
                      padding: '0.65rem',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '0.73rem',
                        fontWeight: 800,
                        color: '#38bdf8',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        marginBottom: '0.45rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span>📈 SMA Overextension &amp; Stretch Matrix</span>
                      <span style={{ color: '#94a3b8', fontSize: '0.67rem' }}>Spot ${spotPrice.toFixed(2)}</span>
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'monospace', fontSize: '0.69rem' }}>
                      <thead>
                        <tr style={{ color: '#64748b', borderBottom: '1px solid rgba(148,163,184,0.12)', textAlign: 'left' }}>
                          <th style={{ padding: '3px 0' }}>MA</th>
                          <th style={{ padding: '3px 0' }}>Level</th>
                          <th style={{ padding: '3px 0' }}>% / ATR</th>
                          <th style={{ padding: '3px 0' }}>1Y %ile</th>
                          <th style={{ padding: '3px 0', textAlign: 'right' }}>Extension State</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.values(maRibbon).map((m) => {
                          const stColor = m.state_color || (m.above ? '#10b981' : '#f87171');
                          return (
                            <tr key={m.label} style={{ borderBottom: '1px solid rgba(148,163,184,0.06)' }}>
                              <td style={{ padding: '5px 0', fontWeight: 800, color: m.color }}>
                                {m.label}
                                <span
                                  style={{
                                    marginLeft: '3px',
                                    fontSize: '0.62rem',
                                    color:
                                      m.slope === 'Rising'
                                        ? '#10b981'
                                        : m.slope === 'Falling'
                                        ? '#f87171'
                                        : '#94a3b8',
                                  }}
                                  title={`Slope: ${m.slope}`}
                                >
                                  {m.slope === 'Rising' ? '↗' : m.slope === 'Falling' ? '↘' : '→'}
                                </span>
                              </td>
                              <td style={{ padding: '5px 0', color: '#e2e8f0' }}>
                                {m.value ? `$${m.value.toFixed(2)}` : '—'}
                              </td>
                              <td
                                style={{
                                  padding: '5px 0',
                                  fontWeight: 700,
                                  color: m.dist_pct >= 0 ? '#10b981' : '#f87171',
                                }}
                              >
                                {m.dist_pct !== null ? `${m.dist_pct >= 0 ? '+' : ''}${m.dist_pct}%` : '—'}
                                {m.atr_multiple !== undefined && m.atr_multiple !== null && (
                                  <div style={{ fontSize: '0.61rem', color: '#94a3b8', fontWeight: 600 }}>
                                    {m.atr_multiple >= 0 ? '+' : ''}
                                    {m.atr_multiple}x ATR
                                  </div>
                                )}
                              </td>
                              <td style={{ padding: '5px 0', color: '#cbd5e1', fontSize: '0.66rem' }}>
                                {m.pct_rank_1y !== undefined && m.pct_rank_1y !== null ? `${m.pct_rank_1y}%` : '—'}
                              </td>
                              <td style={{ padding: '5px 0', textAlign: 'right' }}>
                                <span
                                  style={{
                                    padding: '2px 5px',
                                    borderRadius: '4px',
                                    fontSize: '0.61rem',
                                    fontWeight: 800,
                                    background: `${stColor}22`,
                                    border: `1px solid ${stColor}55`,
                                    color: stColor,
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {m.stretch_state || (m.above ? 'ABOVE' : 'BELOW')}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* 1.5 MarketSurge Official Pattern & Buy Point Card */}
                  {chartData?.marketsurge?.buy_point > 0 && (() => {
                    const ms = chartData.marketsurge;
                    const distPct = ms.distance_to_pivot_pct ?? ms.dist_to_pivot_pct ?? 0;
                    const pColor = ms.pivot_status_color || ms.status_color || '#10b981';
                    return (
                      <div
                        style={{
                          background: 'linear-gradient(145deg, rgba(88, 28, 135, 0.16), rgba(9, 13, 22, 0.92))',
                          border: '1px solid rgba(192, 132, 252, 0.45)',
                          borderRadius: '8px',
                          padding: '0.65rem',
                        }}
                      >
                        <div
                          style={{
                            fontSize: '0.73rem',
                            fontWeight: 800,
                            color: '#c084fc',
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            marginBottom: '0.45rem',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          <span>🏆 MarketSurge Buy Point</span>
                          <span
                            style={{
                              fontFamily: 'monospace',
                              fontSize: '0.64rem',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              background: `${pColor}22`,
                              border: `1px solid ${pColor}66`,
                              color: pColor,
                            }}
                          >
                            {ms.pivot_badge || 'PIVOT'} ({distPct >= 0 ? '+' : ''}{distPct}%)
                          </span>
                        </div>
                        <div
                          style={{
                            fontSize: '0.73rem',
                            fontWeight: 800,
                            color: '#f8fafc',
                            marginBottom: '0.4rem',
                            fontFamily: 'monospace',
                            display: 'flex',
                            justifyContent: 'space-between',
                          }}
                        >
                          <span>{ms.pattern_name}</span>
                          <span style={{ color: '#fbbf24', fontSize: '0.67rem' }}>
                            -{ms.base_depth_pct}% Depth · {ms.base_length_weeks}w
                          </span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', fontFamily: 'monospace' }}>
                          <div style={{ background: 'rgba(2,6,23,0.6)', padding: '6px 8px', borderRadius: '6px', borderLeft: '3px solid #10b981' }}>
                            <div style={{ fontSize: '0.62rem', color: '#94a3b8' }}>Official Buy Point</div>
                            <div style={{ fontSize: '0.92rem', fontWeight: 900, color: '#10b981' }}>
                              ${ms.buy_point.toFixed(2)}
                            </div>
                          </div>
                          <div style={{ background: 'rgba(2,6,23,0.6)', padding: '6px 8px', borderRadius: '6px', borderLeft: '3px solid #34d399' }}>
                            <div style={{ fontSize: '0.62rem', color: '#94a3b8' }}>5% Buy Zone</div>
                            <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#34d399', marginTop: '2px' }}>
                              ${ms.buy_point.toFixed(2)} – ${ms.buy_zone_high.toFixed(2)}
                            </div>
                          </div>
                          <div style={{ background: 'rgba(2,6,23,0.6)', padding: '6px 8px', borderRadius: '6px', borderLeft: '3px solid #ef4444' }}>
                            <div style={{ fontSize: '0.62rem', color: '#94a3b8' }}>-7.5% Hard Stop</div>
                            <div style={{ fontSize: '0.86rem', fontWeight: 800, color: '#ef4444' }}>
                              ${ms.stop_loss.toFixed(2)}
                            </div>
                          </div>
                          <div style={{ background: 'rgba(2,6,23,0.6)', padding: '6px 8px', borderRadius: '6px', borderLeft: '3px solid #38bdf8' }}>
                            <div style={{ fontSize: '0.62rem', color: '#94a3b8' }}>+20-25% Profit Goal</div>
                            <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#38bdf8', marginTop: '2px' }}>
                              ${ms.profit_goal_20.toFixed(2)} – ${ms.profit_goal_25.toFixed(2)}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* 2. Algorithmic ATR Trade Plan Card */}
                  {tp && (
                    <div
                      style={{
                        background: 'rgba(16, 185, 129, 0.06)',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        borderRadius: '8px',
                        padding: '0.65rem',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '0.74rem',
                          fontWeight: 800,
                          color: '#10b981',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                          marginBottom: '0.45rem',
                          display: 'flex',
                          justifyContent: 'space-between',
                        }}
                      >
                        <span>🎯 Algorithmic ATR Trade Plan</span>
                        <span style={{ fontFamily: 'monospace', color: '#34d399' }}>R:R 2.0 : 1</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem', fontFamily: 'monospace' }}>
                        <div style={{ background: 'rgba(2,6,23,0.55)', padding: '6px 8px', borderRadius: '6px' }}>
                          <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Pivot Entry</div>
                          <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#ffffff' }}>
                            ${tp.entry?.toFixed(2)}
                          </div>
                        </div>
                        <div style={{ background: 'rgba(2,6,23,0.55)', padding: '6px 8px', borderRadius: '6px' }}>
                          <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Stop Loss (-1.5 ATR)</div>
                          <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#ef4444' }}>
                            ${tp.stop_loss?.toFixed(2)} (-{tp.risk_pct}%)
                          </div>
                        </div>
                        <div style={{ background: 'rgba(2,6,23,0.55)', padding: '6px 8px', borderRadius: '6px' }}>
                          <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Scale-Out T1 (+2 ATR)</div>
                          <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#38bdf8' }}>
                            ${(tp.target_1 || tp.entry * 1.04)?.toFixed(2)}
                          </div>
                        </div>
                        <div style={{ background: 'rgba(2,6,23,0.55)', padding: '6px 8px', borderRadius: '6px' }}>
                          <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Target T2 (+3 ATR)</div>
                          <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#10b981' }}>
                            ${tp.profit_target?.toFixed(2)} (+{tp.reward_pct || (tp.risk_pct * 2).toFixed(1)}%)
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 3. Volume Profile & Institutional Order Flow Levels */}
                  <div
                    style={{
                      background: 'rgba(15, 23, 42, 0.65)',
                      border: '1px solid rgba(148, 163, 184, 0.14)',
                      borderRadius: '8px',
                      padding: '0.65rem',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '0.74rem',
                        fontWeight: 800,
                        color: '#a855f7',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        marginBottom: '0.45rem',
                      }}
                    >
                      📊 Volume-by-Price &amp; Value Area
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.4rem', fontFamily: 'monospace' }}>
                      <div style={{ background: 'rgba(2,6,23,0.55)', padding: '6px', borderRadius: '6px', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.64rem', color: '#94a3b8' }}>POC (HVN)</div>
                        <div style={{ fontSize: '0.86rem', fontWeight: 800, color: '#38bdf8' }}>
                          {vp.poc_price ? `$${vp.poc_price.toFixed(2)}` : '—'}
                        </div>
                      </div>
                      <div style={{ background: 'rgba(2,6,23,0.55)', padding: '6px', borderRadius: '6px', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.64rem', color: '#94a3b8' }}>VAH (70% High)</div>
                        <div style={{ fontSize: '0.86rem', fontWeight: 800, color: '#818cf8' }}>
                          {vp.vah_price ? `$${vp.vah_price.toFixed(2)}` : '—'}
                        </div>
                      </div>
                      <div style={{ background: 'rgba(2,6,23,0.55)', padding: '6px', borderRadius: '6px', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.64rem', color: '#94a3b8' }}>VAL (70% Low)</div>
                        <div style={{ fontSize: '0.86rem', fontWeight: 800, color: '#818cf8' }}>
                          {vp.val_price ? `$${vp.val_price.toFixed(2)}` : '—'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 4. Minervini 8-Point Stage 2 Trend Template Checklist */}
                  <div
                    style={{
                      background: 'rgba(15, 23, 42, 0.65)',
                      border: '1px solid rgba(148, 163, 184, 0.14)',
                      borderRadius: '8px',
                      padding: '0.65rem',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '0.74rem',
                        fontWeight: 800,
                        color: '#f59e0b',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        marginBottom: '0.45rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span>🏆 Minervini Trend Template</span>
                      <span style={{ fontFamily: 'monospace' }}>
                        {trendTemplate.passed}/{trendTemplate.total} Passed
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {(trendTemplate.checks || []).map((chk, i) => (
                        <div
                          key={i}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: '0.71rem',
                            padding: '3px 6px',
                            borderRadius: '4px',
                            background: chk.passed ? 'rgba(16,185,129,0.07)' : 'rgba(239,68,68,0.06)',
                          }}
                        >
                          <span style={{ color: chk.passed ? '#e2e8f0' : '#94a3b8' }}>{chk.rule}</span>
                          <span
                            style={{
                              fontFamily: 'monospace',
                              fontWeight: 800,
                              color: chk.passed ? '#10b981' : '#ef4444',
                            }}
                          >
                            {chk.passed ? '✓ PASS' : '✗ FAIL'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* =============================================================== */}
              {/* DOCK TAB 2: REAL OPTIONS GEX WALLS & VOLATILITY SURFACE         */}
              {/* =============================================================== */}
              {dockTab === 'options_gex' && (
                <>
                  {opt ? (
                    <>
                      <div
                        style={{
                          background: 'rgba(15, 23, 42, 0.65)',
                          border: '1px solid rgba(168, 85, 247, 0.3)',
                          borderRadius: '8px',
                          padding: '0.65rem',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '0.5rem',
                          }}
                        >
                          <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#c084fc' }}>
                            🛡️ DEALER GAMMA &amp; KEY WALLS
                          </span>
                          <span
                            style={{
                              fontSize: '0.66rem',
                              fontFamily: 'monospace',
                              fontWeight: 800,
                              padding: '2px 6px',
                              borderRadius: '4px',
                              background: `${opt.gamma_color || '#38bdf8'}22`,
                              color: opt.gamma_color || '#38bdf8',
                              border: `1px solid ${opt.gamma_color || '#38bdf8'}55`,
                            }}
                          >
                            {opt.gamma_badge || opt.gamma_regime}
                          </span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem', fontFamily: 'monospace' }}>
                          <div style={{ background: 'rgba(2,6,23,0.55)', padding: '6px 8px', borderRadius: '6px' }}>
                            <div style={{ fontSize: '0.64rem', color: '#94a3b8' }}>Call Wall (GEX Res)</div>
                            <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#10b981' }}>
                              ${opt.call_wall?.toFixed(2)}
                            </div>
                          </div>
                          <div style={{ background: 'rgba(2,6,23,0.55)', padding: '6px 8px', borderRadius: '6px' }}>
                            <div style={{ fontSize: '0.64rem', color: '#94a3b8' }}>Put Wall (GEX Sup)</div>
                            <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#ef4444' }}>
                              ${opt.put_wall?.toFixed(2)}
                            </div>
                          </div>
                          <div style={{ background: 'rgba(2,6,23,0.55)', padding: '6px 8px', borderRadius: '6px' }}>
                            <div style={{ fontSize: '0.64rem', color: '#94a3b8' }}>Zero Gamma Flip</div>
                            <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#f59e0b' }}>
                              ${opt.zero_gamma?.toFixed(2)}
                            </div>
                          </div>
                          <div style={{ background: 'rgba(2,6,23,0.55)', padding: '6px 8px', borderRadius: '6px' }}>
                            <div style={{ fontSize: '0.64rem', color: '#94a3b8' }}>Options Max Pain</div>
                            <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#a855f7' }}>
                              ${opt.max_pain?.toFixed(2)}
                            </div>
                          </div>
                        </div>

                        <div
                          style={{
                            marginTop: '0.5rem',
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontSize: '0.72rem',
                            fontFamily: 'monospace',
                            color: '#cbd5e1',
                            paddingTop: '0.4rem',
                            borderTop: '1px solid rgba(148,163,184,0.12)',
                          }}
                        >
                          <span>
                            Net GEX:{' '}
                            <strong style={{ color: (opt.net_gex || 0) >= 0 ? '#10b981' : '#ef4444' }}>
                              {(opt.net_gex || 0) >= 0 ? '+' : ''}${opt.net_gex}M
                            </strong>
                          </span>
                          <span>
                            Call Flow: <strong style={{ color: '#10b981' }}>{opt.call_vol_pct}%</strong>
                          </span>
                          <span>
                            OI PCR: <strong style={{ color: '#38bdf8' }}>{opt.pcr_oi}</strong>
                          </span>
                        </div>
                      </div>

                      {/* Implied Volatility, 25Δ Skew & Expected Move */}
                      <div
                        style={{
                          background: 'rgba(15, 23, 42, 0.65)',
                          border: '1px solid rgba(148, 163, 184, 0.14)',
                          borderRadius: '8px',
                          padding: '0.65rem',
                        }}
                      >
                        <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#38bdf8', marginBottom: '0.45rem' }}>
                          ⚡ 30D ATM IV, 25Δ SKEW &amp; EXPECTED MOVE
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem', fontFamily: 'monospace' }}>
                          <div style={{ background: 'rgba(2,6,23,0.55)', padding: '6px 8px', borderRadius: '6px' }}>
                            <div style={{ fontSize: '0.64rem', color: '#94a3b8' }}>30D ATM IV (Rank)</div>
                            <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#c084fc' }}>
                              {opt.atm_iv_30d}% ({opt.iv_rank_30d}% Rank)
                            </div>
                          </div>
                          <div style={{ background: 'rgba(2,6,23,0.55)', padding: '6px 8px', borderRadius: '6px' }}>
                            <div style={{ fontSize: '0.64rem', color: '#94a3b8' }}>25Δ Put-Call Skew</div>
                            <div
                              style={{
                                fontSize: '0.88rem',
                                fontWeight: 800,
                                color: (opt.skew_25d || 0) > 3 ? '#f87171' : '#10b981',
                              }}
                            >
                              {opt.skew_25d > 0 ? '+' : ''}
                              {opt.skew_25d}% ({opt.skew_rank_30d}% Rk)
                            </div>
                          </div>
                          <div style={{ background: 'rgba(2,6,23,0.55)', padding: '6px 8px', borderRadius: '6px' }}>
                            <div style={{ fontSize: '0.64rem', color: '#94a3b8' }}>1-Day Implied Move</div>
                            <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#38bdf8' }}>
                              ±${opt.expected_move_1d}
                            </div>
                          </div>
                          <div style={{ background: 'rgba(2,6,23,0.55)', padding: '6px 8px', borderRadius: '6px' }}>
                            <div style={{ fontSize: '0.64rem', color: '#94a3b8' }}>5-Day Implied Move</div>
                            <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#f59e0b' }}>
                              ±${opt.expected_move_5d}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* AI Options Strategy Playbook */}
                      {opt.ai_recommendation && (
                        <div
                          style={{
                            background: 'rgba(56, 189, 248, 0.06)',
                            border: '1px solid rgba(56, 189, 248, 0.28)',
                            borderRadius: '8px',
                            padding: '0.65rem',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              marginBottom: '0.35rem',
                            }}
                          >
                            <span style={{ fontSize: '0.73rem', fontWeight: 800, color: '#38bdf8' }}>
                              🤖 AI OPTIONS STRATEGY
                            </span>
                            <span
                              style={{
                                fontSize: '0.66rem',
                                fontFamily: 'monospace',
                                fontWeight: 800,
                                color: opt.ai_recommendation.bias_color || '#10b981',
                              }}
                            >
                              {opt.ai_recommendation.directional_bias} ({opt.ai_recommendation.conviction_score}/100)
                            </span>
                          </div>
                          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#f8fafc', marginBottom: '4px' }}>
                            {opt.ai_recommendation.strategy_name}
                          </div>
                          <div style={{ fontSize: '0.71rem', color: '#cbd5e1', lineHeight: 1.45 }}>
                            {opt.ai_recommendation.executive_summary}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div style={{ padding: '1.5rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem' }}>
                      No active options chain found in DuckDB lakehouse for {activeTicker}.
                    </div>
                  )}
                </>
              )}

              {/* =============================================================== */}
              {/* DOCK TAB 3: 10-YEAR HISTORICAL DNA & ROSS HABER PERSONALITY     */}
              {/* =============================================================== */}
              {dockTab === 'dna_personality' && (
                <>
                  {expertTickerData?.personality && (
                    <RossHaberPersonalityPanel personality={expertTickerData.personality} />
                  )}

                  <div
                    style={{
                      background: 'rgba(15, 23, 42, 0.65)',
                      border: '1px solid rgba(236, 72, 153, 0.3)',
                      borderRadius: '8px',
                      padding: '0.65rem',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '0.5rem',
                      }}
                    >
                      <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#ec4899' }}>
                        🧬 10-YEAR HISTORICAL DNA
                      </span>
                      <button
                        type="button"
                        onClick={() => onFetchDna && onFetchDna(activeTicker)}
                        disabled={loadingDna}
                        style={{
                          padding: '3px 8px',
                          borderRadius: '5px',
                          border: '1px solid #ec4899',
                          background: 'rgba(236, 72, 153, 0.18)',
                          color: '#f472b6',
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {loadingDna ? 'Analyzing...' : 'Refresh DNA'}
                      </button>
                    </div>

                    {loadingDna ? (
                      <div style={{ padding: '1rem', textAlign: 'center', color: '#f472b6', fontSize: '0.78rem' }}>
                        Computing 10-year Moving Average respect &amp; extension profile...
                      </div>
                    ) : dnaData && !dnaData.error ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.73rem' }}>
                        <div style={{ background: 'rgba(2,6,23,0.55)', padding: '8px', borderRadius: '6px' }}>
                          <div style={{ fontSize: '0.66rem', color: '#94a3b8', marginBottom: '4px' }}>
                            Moving Average Respect Matrix
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'monospace' }}>
                            {Object.entries(dnaData.ma_respect || {}).map(([ma, score]) => (
                              <div key={ma} style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>{ma}</div>
                                <div
                                  style={{
                                    fontWeight: 800,
                                    color: ma === dnaData.best_ma ? '#10b981' : '#e2e8f0',
                                  }}
                                >
                                  {score}%
                                </div>
                              </div>
                            ))}
                          </div>
                          <div style={{ marginTop: '4px', fontSize: '0.69rem', color: '#10b981', fontWeight: 700 }}>
                            ► Primary Guardian MA: {dnaData.best_ma}
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem', fontFamily: 'monospace' }}>
                          <div style={{ background: 'rgba(2,6,23,0.55)', padding: '6px 8px', borderRadius: '6px' }}>
                            <div style={{ fontSize: '0.64rem', color: '#94a3b8' }}>Max Ext. 50-SMA</div>
                            <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#f59e0b' }}>
                              +{dnaData.max_ext_50}%
                            </div>
                          </div>
                          <div style={{ background: 'rgba(2,6,23,0.55)', padding: '6px 8px', borderRadius: '6px' }}>
                            <div style={{ fontSize: '0.64rem', color: '#94a3b8' }}>Max Ext. 200-SMA</div>
                            <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#ef4444' }}>
                              +{dnaData.max_ext_200}%
                            </div>
                          </div>
                        </div>

                        <div style={{ background: 'rgba(2,6,23,0.55)', padding: '8px', borderRadius: '6px' }}>
                          <div style={{ color: '#cbd5e1', lineHeight: 1.4 }}>{dnaData.whale_insight}</div>
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.73rem', color: '#94a3b8' }}>
                        Click &quot;Refresh DNA&quot; to compute 10-year historical moving average adherence.
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* =============================================================== */}
              {/* DOCK TAB 4: FUNDAMENTALS, AI AGENT INSIGHT & LIVE NEWS          */}
              {/* =============================================================== */}
              {dockTab === 'fund_news' && (
                <>
                  {expertTickerData?.agent_insight && (
                    <div
                      style={{
                        background: 'rgba(168, 85, 247, 0.07)',
                        border: '1px solid rgba(168, 85, 247, 0.35)',
                        borderRadius: '8px',
                        padding: '0.65rem',
                      }}
                    >
                      <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#c084fc', marginBottom: '0.35rem' }}>
                        🤖 AI QUANT COUNCIL OBSERVATION
                      </div>
                      <div style={{ fontSize: '0.73rem', color: '#e2e8f0', lineHeight: 1.48 }}>
                        {expertTickerData.agent_insight}
                      </div>
                    </div>
                  )}

                  {expertTickerData?.fundamentals && (
                    <div
                      style={{
                        background: 'rgba(15, 23, 42, 0.65)',
                        border: '1px solid rgba(148, 163, 184, 0.14)',
                        borderRadius: '8px',
                        padding: '0.65rem',
                      }}
                    >
                      <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#f59e0b', marginBottom: '0.45rem' }}>
                        🏛️ CORE FUNDAMENTAL VITALS
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem', fontFamily: 'monospace' }}>
                        <div style={{ background: 'rgba(2,6,23,0.55)', padding: '6px 8px', borderRadius: '6px' }}>
                          <div style={{ fontSize: '0.64rem', color: '#94a3b8' }}>Rev Growth YoY</div>
                          <div
                            style={{
                              fontSize: '0.9rem',
                              fontWeight: 800,
                              color: expertTickerData.fundamentals.revenue_growth > 20 ? '#10b981' : '#f8fafc',
                            }}
                          >
                            {expertTickerData.fundamentals.revenue_growth.toFixed(1)}%
                          </div>
                        </div>
                        <div style={{ background: 'rgba(2,6,23,0.55)', padding: '6px 8px', borderRadius: '6px' }}>
                          <div style={{ fontSize: '0.64rem', color: '#94a3b8' }}>Profit Margin</div>
                          <div
                            style={{
                              fontSize: '0.9rem',
                              fontWeight: 800,
                              color: expertTickerData.fundamentals.profit_margin > 15 ? '#10b981' : '#f8fafc',
                            }}
                          >
                            {expertTickerData.fundamentals.profit_margin.toFixed(1)}%
                          </div>
                        </div>
                        <div style={{ background: 'rgba(2,6,23,0.55)', padding: '6px 8px', borderRadius: '6px' }}>
                          <div style={{ fontSize: '0.64rem', color: '#94a3b8' }}>Return on Equity</div>
                          <div
                            style={{
                              fontSize: '0.9rem',
                              fontWeight: 800,
                              color: expertTickerData.fundamentals.roe > 15 ? '#10b981' : '#f8fafc',
                            }}
                          >
                            {expertTickerData.fundamentals.roe.toFixed(1)}%
                          </div>
                        </div>
                        <div style={{ background: 'rgba(2,6,23,0.55)', padding: '6px 8px', borderRadius: '6px' }}>
                          <div style={{ fontSize: '0.64rem', color: '#94a3b8' }}>PEG Ratio</div>
                          <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#38bdf8' }}>
                            {expertTickerData.fundamentals.peg_ratio
                              ? expertTickerData.fundamentals.peg_ratio.toFixed(2)
                              : 'N/A'}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {expertTickerData?.news && expertTickerData.news.length > 0 && (
                    <div
                      style={{
                        background: 'rgba(15, 23, 42, 0.65)',
                        border: '1px solid rgba(148, 163, 184, 0.14)',
                        borderRadius: '8px',
                        padding: '0.65rem',
                      }}
                    >
                      <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#ec4899', marginBottom: '0.45rem' }}>
                        📰 LIVE CATALYST NEWS WIRE
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                        {expertTickerData.news.map((headline, idx) => (
                          <div
                            key={idx}
                            style={{
                              fontSize: '0.72rem',
                              color: '#cbd5e1',
                              lineHeight: 1.4,
                              paddingBottom: idx < expertTickerData.news.length - 1 ? '0.45rem' : 0,
                              borderBottom:
                                idx < expertTickerData.news.length - 1
                                  ? '1px dashed rgba(148,163,184,0.14)'
                                  : 'none',
                            }}
                          >
                            <span style={{ color: '#ec4899', marginRight: '5px' }}>▶</span>
                            {headline}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
