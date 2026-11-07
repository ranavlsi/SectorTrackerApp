import React, { useState, useMemo } from 'react';
import {
  Radio, Zap, Flame, TrendingUp, Activity, Target, Search,
  RefreshCw, Layers, Copy, Check, LayoutGrid, List, Sparkles,
  Crosshair, ArrowUpRight, ShieldAlert, BarChart2
} from 'lucide-react';

/**
 * Intraday Session Curve + Anchored VWAP + 15m ORB High/Low Band Sparkline
 */
const IntradaySessionSparkline = ({ intradaySpark, height = 74, width = 280 }) => {
  if (!intradaySpark || !Array.isArray(intradaySpark.price) || intradaySpark.price.length < 5) {
    return (
      <div style={{ width: '100%', height, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(2,6,23,0.5)', borderRadius: 8, fontSize: '0.68rem', color: '#64748b' }}>
        Intraday Tape Loading...
      </div>
    );
  }

  const prices = intradaySpark.price;
  const vwap = intradaySpark.vwap || [];
  const orbHigh = intradaySpark.orb_high;
  const orbLow = intradaySpark.orb_low;

  const allVals = [...prices, ...vwap];
  if (orbHigh) allVals.push(orbHigh);
  if (orbLow) allVals.push(orbLow);

  const minVal = Math.min(...allVals);
  const maxVal = Math.max(...allVals);
  const range = Math.max(0.01, maxVal - minVal);
  const padX = 6;
  const padY = 8;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const toY = (v) => padY + innerH - ((v - minVal) / range) * innerH;
  const toPoints = (arr) =>
    arr
      .map((v, i) => {
        const x = padX + (i / Math.max(1, arr.length - 1)) * innerW;
        const y = toY(v);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');

  const pricePts = toPoints(prices);
  const vwapPts = vwap.length === prices.length ? toPoints(vwap) : '';
  const isUp = prices[prices.length - 1] >= prices[0];
  const strokeColor = isUp ? '#10b981' : '#f43f5e';

  const orbHighY = orbHigh ? Math.max(padY, Math.min(height - padY, toY(orbHigh))) : null;
  const orbLowY = orbLow ? Math.max(padY, Math.min(height - padY, toY(orbLow))) : null;
  const lastX = padX + innerW;
  const lastY = toY(prices[prices.length - 1]);

  return (
    <div style={{ background: 'rgba(2, 6, 23, 0.68)', borderRadius: '8px', border: '1px solid rgba(51, 65, 85, 0.5)', padding: '6px 8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3, fontSize: '0.62rem', color: '#94a3b8' }}>
        <span style={{ fontWeight: 800, color: '#cbd5e1', letterSpacing: '0.03em' }}>INTRADAY TAPE + VWAP + 15M ORB</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ color: '#fbbf24', fontWeight: 700 }}>― VWAP</span>
          <span style={{ color: '#ec4899', fontWeight: 700 }}>-- ORB HIGH</span>
        </div>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: `${height}px`, display: 'block', overflow: 'visible' }}>
        {/* 15m ORB Shaded Zone */}
        {orbHighY !== null && orbLowY !== null && (
          <rect
            x={padX}
            y={Math.min(orbHighY, orbLowY)}
            width={innerW}
            height={Math.max(2, Math.abs(orbLowY - orbHighY))}
            fill="rgba(236, 72, 153, 0.08)"
          />
        )}

        {/* ORB High Dashed Line */}
        {orbHighY !== null && (
          <line x1={padX} y1={orbHighY} x2={width - padX} y2={orbHighY} stroke="#ec4899" strokeWidth="1" strokeDasharray="3,3" opacity="0.85" />
        )}

        {/* Intraday VWAP Line */}
        {vwapPts && <polyline fill="none" stroke="#fbbf24" strokeWidth="1.4" strokeDasharray="2,2" points={vwapPts} opacity="0.9" />}

        {/* Intraday Price Curve */}
        <polyline fill="none" stroke={strokeColor} strokeWidth="2.1" points={pricePts} />

        <circle cx={lastX} cy={lastY} r="3.2" fill={strokeColor} stroke="#fff" strokeWidth="1.2" />
      </svg>
    </div>
  );
};

/**
 * 30-Day Price + EMA10 + EMA21 + Normalized Gold RS Line Sparkline
 */
const MultiDayContextSparkline = ({ sparkline30d, isBlueDot, height = 74, width = 280 }) => {
  if (!sparkline30d || !Array.isArray(sparkline30d.close) || sparkline30d.close.length < 5) {
    return null;
  }

  const closes = sparkline30d.close;
  const ema10 = sparkline30d.ema10 || [];
  const ema21 = sparkline30d.ema21 || [];
  const rsNorm = sparkline30d.rs_norm || [];

  const allVals = [...closes, ...ema10, ...ema21];
  const minVal = Math.min(...allVals);
  const maxVal = Math.max(...allVals);
  const range = Math.max(0.01, maxVal - minVal);
  const padX = 6;
  const padY = 8;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const toPoints = (arr) =>
    arr
      .map((v, i) => {
        const x = padX + (i / Math.max(1, arr.length - 1)) * innerW;
        const y = padY + innerH - ((v - minVal) / range) * innerH;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');

  const closePts = toPoints(closes);
  const ema10Pts = ema10.length === closes.length ? toPoints(ema10) : '';
  const ema21Pts = ema21.length === closes.length ? toPoints(ema21) : '';
  const rsPts = rsNorm.length === closes.length ? toPoints(rsNorm) : '';
  const isUp = closes[closes.length - 1] >= closes[0];
  const strokeColor = isUp ? '#10b981' : '#f59e0b';
  const lastX = padX + innerW;
  const lastY = padY + innerH - ((closes[closes.length - 1] - minVal) / range) * innerH;

  return (
    <div style={{ background: 'rgba(2, 6, 23, 0.68)', borderRadius: '8px', border: '1px solid rgba(51, 65, 85, 0.5)', padding: '6px 8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3, fontSize: '0.62rem', color: '#94a3b8' }}>
        <span style={{ fontWeight: 800, color: '#cbd5e1', letterSpacing: '0.03em' }}>30D TREND + EMA10/21 + GOLD RS LINE</span>
        <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
          <span style={{ color: '#38bdf8' }}>― EMA10</span>
          <span style={{ color: '#fbbf24', fontWeight: 700 }}>― RS</span>
          {isBlueDot && (
            <span style={{ background: 'rgba(59,130,246,0.22)', color: '#60a5fa', padding: '0 4px', borderRadius: 3, fontWeight: 800 }}>
              🔵 RS LEAD
            </span>
          )}
        </div>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: `${height}px`, display: 'block', overflow: 'visible' }}>
        {ema21Pts && <polyline fill="none" stroke="#a855f7" strokeWidth="1.1" strokeDasharray="2,2" points={ema21Pts} opacity="0.75" />}
        {ema10Pts && <polyline fill="none" stroke="#38bdf8" strokeWidth="1.25" points={ema10Pts} opacity="0.85" />}
        {rsPts && <polyline fill="none" stroke="#fbbf24" strokeWidth="1.35" points={rsPts} opacity="0.9" />}
        <polyline fill="none" stroke={strokeColor} strokeWidth="2.0" points={closePts} />
        <circle cx={lastX} cy={lastY} r={isBlueDot ? 3.8 : 2.8} fill={isBlueDot ? '#3b82f6' : strokeColor} stroke="#fff" strokeWidth="1.1" />
      </svg>
    </div>
  );
};

export default function IntradayRadarDashboard({
  intradayData,
  loading,
  onTickerClick,
  onOpenFundamentals,
  onRefresh
}) {
  const [activePlaybook, setActivePlaybook] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('tape_speed_score');
  const [chartMode, setChartMode] = useState('dual'); // 'intraday' | '30d' | 'dual'
  const [viewMode, setViewMode] = useState('cards'); // 'cards' | 'table'
  const [copiedTicker, setCopiedTicker] = useState(null);

  // Normalize whether intradayData is passed as full payload or results array
  const results = useMemo(() => {
    if (!intradayData) return [];
    if (Array.isArray(intradayData)) return intradayData;
    if (Array.isArray(intradayData.results)) return intradayData.results;
    return [];
  }, [intradayData]);

  const kpis = useMemo(() => {
    if (intradayData && !Array.isArray(intradayData) && intradayData.summary_kpis) {
      return intradayData.summary_kpis;
    }
    return {
      total_active_signals: results.length,
      orb_ignitions: results.filter((x) => (x.all_playbooks || []).includes('ORB_IGNITION') || x.current_price >= x.orb_pivot).length,
      vwap_reclaims: results.filter((x) => (x.all_playbooks || []).includes('VWAP_RECLAIM')).length,
      hod_thrusts: results.filter((x) => (x.all_playbooks || []).includes('HOD_THRUST')).length,
      gamma_sweeps: results.filter((x) => (x.all_playbooks || []).includes('GAMMA_SWEEP') || (x.call_put_ratio || 0) >= 1.65).length,
      liquidity_sweeps: results.filter((x) => (x.all_playbooks || []).includes('LIQUIDITY_SWEEP')).length,
      bull_flag_coils: results.filter((x) => (x.all_playbooks || []).includes('BULL_FLAG_COIL')).length,
      blue_dot_leaders: results.filter((x) => x.is_blue_dot).length,
      avg_rvol: results.length
        ? (results.reduce((acc, x) => acc + (x.vol_multiplier || 1), 0) / results.length).toFixed(2)
        : '1.85',
      avg_cp_ratio: results.length
        ? (results.reduce((acc, x) => acc + (x.call_put_ratio || 1), 0) / results.length).toFixed(2)
        : '2.10'
    };
  }, [intradayData, results]);

  const spotlight = useMemo(() => {
    if (intradayData && !Array.isArray(intradayData) && intradayData.spotlight) {
      return intradayData.spotlight;
    }
    return results[0] || null;
  }, [intradayData, results]);

  const filteredResults = useMemo(() => {
    let list = [...results];

    if (activePlaybook !== 'ALL') {
      if (activePlaybook === 'BLUE_DOT') {
        list = list.filter((x) => x.is_blue_dot || (x.rs_rating || 0) >= 88);
      } else {
        list = list.filter(
          (x) =>
            x.playbook_type === activePlaybook ||
            (x.all_playbooks || []).includes(activePlaybook)
        );
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toUpperCase();
      list = list.filter(
        (x) =>
          (x.ticker || '').toUpperCase().includes(q) ||
          (x.name || '').toUpperCase().includes(q) ||
          (x.sector || '').toUpperCase().includes(q) ||
          (x.playbook_label || '').toUpperCase().includes(q) ||
          (x.confluence_engines || []).some((e) => e.toUpperCase().includes(q))
      );
    }

    list.sort((a, b) => {
      if (sortBy === 'tape_speed_score') return (b.tape_speed_score || 0) - (a.tape_speed_score || 0);
      if (sortBy === 'vol_multiplier') return (b.vol_multiplier || 0) - (a.vol_multiplier || 0);
      if (sortBy === 'call_put_ratio') return (b.call_put_ratio || 0) - (a.call_put_ratio || 0);
      if (sortBy === 'day_change_pct') return (b.day_change_pct || 0) - (a.day_change_pct || 0);
      if (sortBy === 'alpha_30d_pct') return (b.alpha_30d_pct || 0) - (a.alpha_30d_pct || 0);
      if (sortBy === 'vwap_slope') return (b.vwap_slope || 0) - (a.vwap_slope || 0);
      return 0;
    });

    return list;
  }, [results, activePlaybook, searchQuery, sortBy]);

  const handleCopyTicket = (e, item) => {
    e.stopPropagation();
    const tp = item.trade_plan || {};
    const text = `📡 [APEX INTRADAY RADAR 3.0 TICKET] $${item.ticker} (${item.setup_grade || 'A+'} | Tape Score ${item.tape_speed_score || 90}/100)
Playbook: ${item.playbook_label || '15m ORB Breakout'}
Entry Trigger: $${tp.entry_trigger || item.current_price} | 15m ORB Pivot: $${item.orb_pivot?.toFixed(2)} | VWAP: $${item.vwap?.toFixed(2) || 'N/A'}
Stop Loss: $${tp.stop_loss || 'N/A'} (-${tp.risk_pct || 1.5}%) [VWAP Stop: $${tp.vwap_stop || 'N/A'}]
Scalp Target 1 (1.8R): $${tp.scalp_target_1 || 'N/A'} | Runner Target 2 (3.2R): $${tp.runner_target_2 || 'N/A'}
RVOL: ${item.vol_multiplier?.toFixed(2)}x | Call/Put: ${item.call_put_ratio?.toFixed(2)}x | HVN POC: $${item.hvn_proxy?.toFixed(2)}`;
    navigator.clipboard.writeText(text);
    setCopiedTicker(item.ticker);
    setTimeout(() => setCopiedTicker(null), 2000);
  };

  const getGradeStyle = (grade) => {
    if (grade === 'A+') {
      return { background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.5)' };
    }
    if (grade === 'A') {
      return { background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.45)' };
    }
    return { background: 'rgba(236, 72, 153, 0.2)', color: '#f472b6', border: '1px solid rgba(236, 72, 153, 0.45)' };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', paddingBottom: '32px' }}>
      {/* 1. EXECUTIVE HEADER & 6-PILLAR INTRADAY KPI RIBBON */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.96), rgba(38, 14, 46, 0.88))',
          border: '1px solid rgba(236, 72, 153, 0.4)',
          borderRadius: '14px',
          padding: '20px 24px',
          boxShadow: '0 12px 32px rgba(0, 0, 0, 0.45)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <span
                style={{
                  background: 'linear-gradient(135deg, #ec4899, #8b5cf6)',
                  color: '#fff',
                  fontWeight: 900,
                  fontSize: '0.7rem',
                  padding: '3px 9px',
                  borderRadius: '6px',
                  letterSpacing: '0.08em'
                }}
              >
                APEX INTRADAY RADAR 3.0
              </span>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontFamily: 'monospace' }}>
                13 MICRO-STRUCTURE ALGOS • 15M ORB • ANCHORED VWAP • VOLUME PROFILE POC • OPTIONS SWEEPS
              </span>
            </div>
            <h2 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Radio size={24} color="#ec4899" className="spin-slow" />
              Live Intraday Tape, 15m ORB, Anchored VWAP &amp; Options Gamma Sweep Terminal
            </h2>
            <p style={{ margin: '6px 0 0 0', fontSize: '0.84rem', color: '#cbd5e1', maxWidth: '890px', lineHeight: 1.45 }}>
              Real-time institutional tape surveillance combining <strong>15-Minute Opening Range Breakouts (ORB)</strong>,{' '}
              <strong>Anchored VWAP Reclaims &amp; Bounces</strong>, <strong>High-of-Day (HOD) / PDH Structural Breakouts</strong>,{' '}
              <strong>Volume Profile Point-of-Control (HVN POC)</strong>, and <strong>Unusual Call Sweep Velocity</strong> with 30D Multi-Timeframe RS Context.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {/* Sparkline Mode Selector */}
            <div style={{ display: 'flex', background: 'rgba(2, 6, 23, 0.75)', borderRadius: '8px', padding: '3px', border: '1px solid rgba(51, 65, 85, 0.65)' }}>
              {[
                { id: 'dual', label: 'Dual Tape + 30D' },
                { id: 'intraday', label: 'Intraday VWAP' },
                { id: '30d', label: '30D RS Context' }
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => setChartMode(m.id)}
                  style={{
                    padding: '5px 10px',
                    borderRadius: '6px',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    background: chartMode === m.id ? 'rgba(236, 72, 153, 0.25)' : 'transparent',
                    color: chartMode === m.id ? '#f9a8d4' : '#94a3b8'
                  }}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {/* View Toggle */}
            <div style={{ display: 'flex', background: 'rgba(2, 6, 23, 0.75)', borderRadius: '8px', padding: '3px', border: '1px solid rgba(51, 65, 85, 0.65)' }}>
              <button
                onClick={() => setViewMode('cards')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '5px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.73rem',
                  fontWeight: 700,
                  background: viewMode === 'cards' ? 'rgba(236, 72, 153, 0.25)' : 'transparent',
                  color: viewMode === 'cards' ? '#f9a8d4' : '#94a3b8'
                }}
              >
                <LayoutGrid size={13} /> Cards
              </button>
              <button
                onClick={() => setViewMode('table')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '5px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.73rem',
                  fontWeight: 700,
                  background: viewMode === 'table' ? 'rgba(236, 72, 153, 0.25)' : 'transparent',
                  color: viewMode === 'table' ? '#f9a8d4' : '#94a3b8'
                }}
              >
                <List size={13} /> Tape Table
              </button>
            </div>

            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={loading}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '7px',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: '1px solid rgba(236, 72, 153, 0.5)',
                  background: 'rgba(236, 72, 153, 0.18)',
                  color: '#f9a8d4',
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  cursor: loading ? 'wait' : 'pointer'
                }}
              >
                <RefreshCw size={14} className={loading ? 'spin' : ''} />
                {loading ? 'Scanning Tape...' : 'Rescan Intraday'}
              </button>
            )}
          </div>
        </div>

        {/* 6-Pillar KPI Strip */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
            gap: '12px',
            marginTop: '18px'
          }}
        >
          {[
            { label: 'ACTIVE TAPE SIGNALS', value: kpis.total_active_signals, sub: `Avg RVOL: ${kpis.avg_rvol}x`, color: '#f8fafc', border: 'rgba(148,163,184,0.3)' },
            { label: '🔥 15M ORB IGNITIONS', value: kpis.orb_ignitions, sub: 'Clearing Opening Range High', color: '#ec4899', border: 'rgba(236,72,153,0.4)' },
            { label: '⚓ VWAP RECLAIMS', value: kpis.vwap_reclaims, sub: 'Institutional AVWAP Support', color: '#fbbf24', border: 'rgba(251,191,36,0.4)' },
            { label: '🚀 HOD / PDH THRUSTS', value: kpis.hod_thrusts, sub: 'Slicing Prev Day High', color: '#10b981', border: 'rgba(16,185,129,0.4)' },
            { label: '⚡ GAMMA CALL SWEEPS', value: kpis.gamma_sweeps, sub: `Avg C/P Ratio: ${kpis.avg_cp_ratio}x`, color: '#a855f7', border: 'rgba(168,85,247,0.4)' },
            { label: '🔵 RS BLUE DOT LEADERS', value: kpis.blue_dot_leaders, sub: 'Multi-Timeframe RS Alignment', color: '#38bdf8', border: 'rgba(56,189,248,0.4)' }
          ].map((k, idx) => (
            <div
              key={idx}
              style={{
                background: 'rgba(2, 6, 23, 0.65)',
                border: `1px solid ${k.border}`,
                borderRadius: '10px',
                padding: '11px 14px'
              }}
            >
              <div style={{ fontSize: '0.66rem', fontWeight: 800, color: '#94a3b8', letterSpacing: '0.06em' }}>{k.label}</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 900, color: k.color, fontFamily: 'monospace', marginTop: '3px' }}>{k.value}</div>
              <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>{k.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. #1 INTRADAY TAPE LEADER SPOTLIGHT HERO BANNER */}
      {spotlight && (
        <div
          onClick={() => onTickerClick && onTickerClick(spotlight.ticker)}
          style={{
            background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.14), rgba(15, 23, 42, 0.96) 45%, rgba(16, 185, 129, 0.12))',
            border: '1px solid rgba(236, 72, 153, 0.5)',
            borderRadius: '14px',
            padding: '18px 22px',
            cursor: 'pointer',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '16px',
            alignItems: 'center'
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
              <span style={{ background: '#ec4899', color: '#fff', fontWeight: 900, fontSize: '0.68rem', padding: '2px 8px', borderRadius: '4px' }}>
                #1 INTRADAY TAPE LEADER
              </span>
              <span style={{ ...getGradeStyle(spotlight.setup_grade || 'A+'), fontSize: '0.7rem', fontWeight: 800, padding: '2px 8px', borderRadius: '4px' }}>
                GRADE {spotlight.setup_grade || 'A+'} • {spotlight.tape_speed_score || 95}/100
              </span>
              <span style={{ background: 'rgba(16,185,129,0.18)', color: '#34d399', border: '1px solid rgba(16,185,129,0.4)', fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '4px' }}>
                {spotlight.playbook_label || '🚀 HOD / ORB Momentum'}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginTop: '4px' }}>
              <span style={{ fontSize: '1.65rem', fontWeight: 900, color: '#f8fafc', fontFamily: 'monospace' }}>${spotlight.ticker}</span>
              <span style={{ fontSize: '0.9rem', color: '#94a3b8', fontWeight: 600 }}>{spotlight.name}</span>
              <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#e2e8f0', fontFamily: 'monospace' }}>${spotlight.current_price?.toFixed(2)}</span>
              <span
                style={{
                  fontSize: '0.84rem',
                  fontWeight: 800,
                  fontFamily: 'monospace',
                  color: (spotlight.day_change_pct || 0) >= 0 ? '#10b981' : '#f43f5e'
                }}
              >
                {(spotlight.day_change_pct || 0) >= 0 ? '+' : ''}
                {(spotlight.day_change_pct || 0).toFixed(2)}%
              </span>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '9px' }}>
              {(spotlight.confluence_engines || ['Intraday Radar']).map((eng, i) => (
                <span
                  key={i}
                  style={{
                    background: 'rgba(56, 189, 248, 0.14)',
                    color: '#7dd3fc',
                    border: '1px solid rgba(56, 189, 248, 0.35)',
                    fontSize: '0.67rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '999px'
                  }}
                >
                  ✓ {eng}
                </span>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginTop: '12px', background: 'rgba(2,6,23,0.65)', padding: '9px 12px', borderRadius: '8px', border: '1px solid rgba(51,65,85,0.5)', fontFamily: 'monospace' }}>
              <div>
                <div style={{ fontSize: '0.6rem', color: '#94a3b8' }}>15M ORB PIVOT</div>
                <div style={{ fontSize: '0.86rem', fontWeight: 800, color: '#ec4899' }}>${spotlight.orb_pivot?.toFixed(2)}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.6rem', color: '#94a3b8' }}>ANCHORED VWAP</div>
                <div style={{ fontSize: '0.86rem', fontWeight: 800, color: '#fbbf24' }}>${(spotlight.vwap || spotlight.orb_pivot)?.toFixed(2)}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.6rem', color: '#94a3b8' }}>RVOL / C:P FLOW</div>
                <div style={{ fontSize: '0.86rem', fontWeight: 800, color: '#10b981' }}>
                  {spotlight.vol_multiplier?.toFixed(1)}x / {spotlight.call_put_ratio?.toFixed(1)}x
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.6rem', color: '#94a3b8' }}>RUNNER T2 (3.2R)</div>
                <div style={{ fontSize: '0.86rem', fontWeight: 800, color: '#38bdf8' }}>
                  ${spotlight.trade_plan?.runner_target_2 || (spotlight.current_price * 1.04).toFixed(2)}
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
            <IntradaySessionSparkline intradaySpark={spotlight.intraday_sparkline} height={82} />
            <MultiDayContextSparkline sparkline30d={spotlight.sparkline_30d} isBlueDot={spotlight.is_blue_dot} height={82} />
          </div>
        </div>
      )}

      {/* 3. PLAYBOOK FILTER TABS & SEARCH / SORT CONTROLS */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          background: 'rgba(15, 23, 42, 0.85)',
          padding: '12px 16px',
          borderRadius: '12px',
          border: '1px solid rgba(51, 65, 85, 0.6)'
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {[
            { id: 'ALL', label: `All Active Signals (${results.length})` },
            { id: 'ORB_IGNITION', label: `🔥 15m ORB Ignition (${kpis.orb_ignitions})` },
            { id: 'VWAP_RECLAIM', label: `⚓ VWAP Bounce / Reclaim (${kpis.vwap_reclaims})` },
            { id: 'HOD_THRUST', label: `🚀 HOD / PDH Thrust (${kpis.hod_thrusts})` },
            { id: 'GAMMA_SWEEP', label: `⚡ Gamma Call Sweeps (${kpis.gamma_sweeps})` },
            { id: 'LIQUIDITY_SWEEP', label: `🪤 Liquidity Sweep (${kpis.liquidity_sweeps})` },
            { id: 'BULL_FLAG_COIL', label: `📐 5m Bull Flag (${kpis.bull_flag_coils})` },
            { id: 'BLUE_DOT', label: `🔵 RS Blue Dot (${kpis.blue_dot_leaders})` }
          ].map((tab) => {
            const active = activePlaybook === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActivePlaybook(tab.id)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: active ? '1px solid #ec4899' : '1px solid rgba(71, 85, 105, 0.45)',
                  background: active ? 'rgba(236, 72, 153, 0.22)' : 'rgba(2, 6, 23, 0.5)',
                  color: active ? '#f9a8d4' : '#cbd5e1',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} color="#64748b" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Search ticker, sector, playbook..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                padding: '7px 12px 7px 30px',
                borderRadius: '8px',
                border: '1px solid rgba(71, 85, 105, 0.6)',
                background: 'rgba(2, 6, 23, 0.75)',
                color: '#f8fafc',
                fontSize: '0.78rem',
                width: '215px'
              }}
            />
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={{
              padding: '7px 12px',
              borderRadius: '8px',
              border: '1px solid rgba(71, 85, 105, 0.6)',
              background: 'rgba(2, 6, 23, 0.75)',
              color: '#e2e8f0',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <option value="tape_speed_score">Sort: Composite Tape Score</option>
            <option value="vol_multiplier">Sort: Relative Volume (RVOL)</option>
            <option value="call_put_ratio">Sort: Call / Put Sweep Ratio</option>
            <option value="day_change_pct">Sort: Intraday % Gain</option>
            <option value="alpha_30d_pct">Sort: 30D Alpha vs SPY</option>
            <option value="vwap_slope">Sort: VWAP Velocity Slope</option>
          </select>
        </div>
      </div>

      {/* 4. MAIN DISPLAY: CARDS GRID OR DENSE TAPE TABLE */}
      {filteredResults.length === 0 ? (
        <div
          style={{
            background: 'rgba(15, 23, 42, 0.7)',
            border: '1px solid rgba(51, 65, 85, 0.5)',
            borderRadius: '12px',
            padding: '48px 24px',
            textAlign: 'center',
            color: '#94a3b8'
          }}
        >
          No intraday signals match the current filter. Select "All Active Signals" to view all setups.
        </div>
      ) : viewMode === 'table' ? (
        <div
          style={{
            background: 'rgba(15, 23, 42, 0.92)',
            border: '1px solid rgba(51, 65, 85, 0.6)',
            borderRadius: '12px',
            overflowX: 'auto'
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(71, 85, 105, 0.6)', background: 'rgba(2, 6, 23, 0.8)', color: '#94a3b8', fontSize: '0.67rem', textTransform: 'uppercase' }}>
                <th style={{ padding: '12px 14px' }}>Ticker</th>
                <th style={{ padding: '12px 10px' }}>Price / 1D %</th>
                <th style={{ padding: '12px 10px' }}>Tape Score</th>
                <th style={{ padding: '12px 10px' }}>Intraday Playbook</th>
                <th style={{ padding: '12px 10px' }}>15m ORB / VWAP / POC</th>
                <th style={{ padding: '12px 10px' }}>RVOL &amp; Options Flow</th>
                <th style={{ padding: '12px 10px' }}>RS &amp; 30D Alpha</th>
                <th style={{ padding: '12px 10px' }}>Stop / T1 / T2</th>
                <th style={{ padding: '12px 14px' }}>Confluence</th>
              </tr>
            </thead>
            <tbody>
              {filteredResults.map((item) => {
                const tp = item.trade_plan || {};
                return (
                  <tr
                    key={item.ticker}
                    onClick={() => onTickerClick && onTickerClick(item.ticker)}
                    style={{ borderBottom: '1px solid rgba(51, 65, 85, 0.35)', cursor: 'pointer' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(30, 41, 59, 0.65)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 800, color: '#f8fafc' }}>
                      <div>${item.ticker}</div>
                      <div style={{ fontSize: '0.65rem', color: '#64748b', fontFamily: 'sans-serif' }}>{item.sector}</div>
                    </td>
                    <td style={{ padding: '10px', fontFamily: 'monospace' }}>
                      <div style={{ fontWeight: 800, color: '#fff' }}>${item.current_price?.toFixed(2)}</div>
                      <div style={{ fontSize: '0.7rem', color: (item.day_change_pct || 0) >= 0 ? '#10b981' : '#f43f5e', fontWeight: 700 }}>
                        {(item.day_change_pct || 0) >= 0 ? '+' : ''}
                        {(item.day_change_pct || 0).toFixed(2)}%
                      </div>
                    </td>
                    <td style={{ padding: '10px', fontFamily: 'monospace' }}>
                      <span style={{ ...getGradeStyle(item.setup_grade || 'A'), padding: '2px 7px', borderRadius: 4, fontWeight: 800, fontSize: '0.72rem' }}>
                        {item.setup_grade || 'A'} • {item.tape_speed_score || 85}
                      </span>
                    </td>
                    <td style={{ padding: '10px' }}>
                      <div style={{ fontWeight: 700, color: '#f9a8d4', fontSize: '0.74rem' }}>{item.playbook_label || '15m ORB Ignition'}</div>
                      <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>VWAP Slope: {item.vwap_slope >= 0 ? '+' : ''}{item.vwap_slope?.toFixed(2)}%</div>
                    </td>
                    <td style={{ padding: '10px', fontFamily: 'monospace', fontSize: '0.71rem' }}>
                      <div>ORB: <strong style={{ color: '#ec4899' }}>${item.orb_pivot?.toFixed(2)}</strong> · VWAP: <strong style={{ color: '#fbbf24' }}>${(item.vwap || item.orb_pivot)?.toFixed(2)}</strong></div>
                      <div>POC: <strong style={{ color: '#38bdf8' }}>${item.hvn_proxy?.toFixed(2)}</strong> · PDH: <strong>${(item.pdh || item.orb_pivot)?.toFixed(2)}</strong></div>
                    </td>
                    <td style={{ padding: '10px', fontFamily: 'monospace', fontSize: '0.72rem' }}>
                      <div>RVOL: <strong style={{ color: '#10b981' }}>{item.vol_multiplier?.toFixed(2)}x</strong></div>
                      <div>C/P: <strong style={{ color: '#a855f7' }}>{item.call_put_ratio?.toFixed(2)}x</strong> ({item.call_vol_pct || 68}% Calls)</div>
                    </td>
                    <td style={{ padding: '10px', fontFamily: 'monospace', fontSize: '0.72rem' }}>
                      <div>RS <strong style={{ color: '#38bdf8' }}>{item.rs_rating || 84}</strong> {item.is_blue_dot ? '🔵' : ''}</div>
                      <div style={{ color: (item.alpha_30d_pct || 0) >= 0 ? '#10b981' : '#f43f5e' }}>
                        30D α: {(item.alpha_30d_pct || 0) >= 0 ? '+' : ''}{item.alpha_30d_pct || 0}%
                      </div>
                    </td>
                    <td style={{ padding: '10px', fontFamily: 'monospace', fontSize: '0.71rem' }}>
                      <div style={{ color: '#f43f5e' }}>SL: ${tp.stop_loss || (item.current_price * 0.985).toFixed(2)}</div>
                      <div style={{ color: '#10b981' }}>T1: ${tp.scalp_target_1} → T2: ${tp.runner_target_2}</div>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {(item.confluence_engines || ['Intraday Radar']).slice(0, 3).map((e, idx) => (
                          <span key={idx} style={{ background: 'rgba(56,189,248,0.14)', color: '#7dd3fc', padding: '1px 6px', borderRadius: 4, fontSize: '0.62rem', fontWeight: 700 }}>
                            {e}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(395px, 1fr))',
            gap: '16px'
          }}
        >
          {filteredResults.map((item) => {
            const tp = item.trade_plan || {};
            return (
              <div
                key={item.ticker}
                onClick={() => onTickerClick && onTickerClick(item.ticker)}
                style={{
                  background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.95), rgba(9, 14, 28, 0.98))',
                  border:
                    (item.tape_speed_score || 0) >= 90
                      ? '1px solid rgba(236, 72, 153, 0.55)'
                      : '1px solid rgba(51, 65, 85, 0.65)',
                  borderRadius: '14px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '11px',
                  cursor: 'pointer',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)'
                }}
              >
                {/* Card Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '1.3rem', fontWeight: 900, color: '#f8fafc', fontFamily: 'monospace' }}>
                        ${item.ticker}
                      </span>
                      <span style={{ ...getGradeStyle(item.setup_grade || 'A+'), fontSize: '0.68rem', fontWeight: 800, padding: '2px 7px', borderRadius: 5 }}>
                        {item.setup_grade || 'A+'} • {item.tape_speed_score || 88}/100
                      </span>
                      {item.is_blue_dot && (
                        <span style={{ background: 'rgba(59,130,246,0.2)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.45)', fontSize: '0.64rem', fontWeight: 800, padding: '2px 6px', borderRadius: 5 }}>
                          🔵 RS {item.rs_rating || 88}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: 2 }}>
                      {item.name || item.ticker} • <span style={{ color: '#64748b' }}>{item.sector || 'Technology'}</span>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                    <div style={{ fontSize: '1.18rem', fontWeight: 800, color: '#f8fafc' }}>
                      ${item.current_price?.toFixed(2)}
                    </div>
                    <div
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: (item.day_change_pct || 0) >= 0 ? '#10b981' : '#f43f5e'
                      }}
                    >
                      {(item.day_change_pct || 0) >= 0 ? '+' : ''}
                      {(item.day_change_pct || 0).toFixed(2)}%
                    </div>
                  </div>
                </div>

                {/* Playbook & Tape Banner */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '6px 10px',
                    borderRadius: '8px',
                    background: 'rgba(236, 72, 153, 0.14)',
                    border: '1px solid rgba(236, 72, 153, 0.35)',
                    fontSize: '0.72rem'
                  }}
                >
                  <span style={{ fontWeight: 800, color: '#f9a8d4' }}>
                    {item.playbook_label || '🔥 15m ORB Breakout Ignition'}
                  </span>
                  <span style={{ fontFamily: 'monospace', fontSize: '0.68rem', color: '#10b981', fontWeight: 700 }}>
                    RVOL {item.vol_multiplier?.toFixed(2)}x • C/P {item.call_put_ratio?.toFixed(2)}x
                  </span>
                </div>

                {/* Sparkline(s): Intraday Session + VWAP + ORB and/or 30D Price + RS Line */}
                {(chartMode === 'intraday' || chartMode === 'dual') && (
                  <IntradaySessionSparkline intradaySpark={item.intraday_sparkline} height={68} />
                )}
                {(chartMode === '30d' || chartMode === 'dual') && item.sparkline_30d && (
                  <MultiDayContextSparkline sparkline30d={item.sparkline_30d} isBlueDot={item.is_blue_dot} height={64} />
                )}

                {/* Structural Key Levels Matrix (15m ORB, VWAP, POC, PDH, 30D Alpha, 10Y Seasonality) */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', fontSize: '0.68rem', fontFamily: 'monospace' }}>
                  <div style={{ background: 'rgba(15, 23, 42, 0.85)', padding: '6px 8px', borderRadius: 6, border: '1px solid rgba(51, 65, 85, 0.45)' }}>
                    <div style={{ fontSize: '0.56rem', color: '#94a3b8' }}>15M ORB PIVOT</div>
                    <div style={{ fontWeight: 800, color: '#ec4899' }}>${item.orb_pivot?.toFixed(2)}</div>
                  </div>
                  <div style={{ background: 'rgba(15, 23, 42, 0.85)', padding: '6px 8px', borderRadius: 6, border: '1px solid rgba(51, 65, 85, 0.45)' }}>
                    <div style={{ fontSize: '0.56rem', color: '#94a3b8' }}>ANCHORED VWAP</div>
                    <div style={{ fontWeight: 800, color: '#fbbf24' }}>
                      ${(item.vwap || item.orb_pivot)?.toFixed(2)} ({item.vwap_slope >= 0 ? '+' : ''}{item.vwap_slope?.toFixed(2)}%)
                    </div>
                  </div>
                  <div style={{ background: 'rgba(15, 23, 42, 0.85)', padding: '6px 8px', borderRadius: 6, border: '1px solid rgba(51, 65, 85, 0.45)' }}>
                    <div style={{ fontSize: '0.56rem', color: '#94a3b8' }}>BLOCK POC (HVN)</div>
                    <div style={{ fontWeight: 800, color: '#38bdf8' }}>${item.hvn_proxy?.toFixed(2)}</div>
                  </div>
                  <div style={{ background: 'rgba(15, 23, 42, 0.85)', padding: '6px 8px', borderRadius: 6, border: '1px solid rgba(51, 65, 85, 0.45)' }}>
                    <div style={{ fontSize: '0.56rem', color: '#94a3b8' }}>PDH / PDL RANGE</div>
                    <div style={{ fontWeight: 700, color: '#e2e8f0' }}>
                      ${(item.pdh || item.orb_pivot)?.toFixed(1)} / ${(item.pdl || item.orb_low || item.orb_pivot)?.toFixed(1)}
                    </div>
                  </div>
                  <div style={{ background: 'rgba(15, 23, 42, 0.85)', padding: '6px 8px', borderRadius: 6, border: '1px solid rgba(51, 65, 85, 0.45)' }}>
                    <div style={{ fontSize: '0.56rem', color: '#94a3b8' }}>30D ALPHA VS SPY</div>
                    <div style={{ fontWeight: 800, color: (item.alpha_30d_pct || 0) >= 0 ? '#10b981' : '#f43f5e' }}>
                      {(item.alpha_30d_pct || 0) >= 0 ? '+' : ''}{item.alpha_30d_pct ?? 0}% (U/D {item.ud_vol_ratio_30d || 1.2}x)
                    </div>
                  </div>
                  <div style={{ background: 'rgba(15, 23, 42, 0.85)', padding: '6px 8px', borderRadius: 6, border: '1px solid rgba(51, 65, 85, 0.45)' }}>
                    <div style={{ fontSize: '0.56rem', color: '#94a3b8' }}>CALL FLOW / 10Y WIN</div>
                    <div style={{ fontWeight: 800, color: '#a855f7' }}>
                      {item.call_vol_pct || 68}% Calls • {item.cur_month_win || 65}%
                    </div>
                  </div>
                </div>

                {/* Multi-Engine Confluence Pills */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {(item.confluence_engines || ['Intraday Radar']).map((eng, i) => (
                    <span
                      key={i}
                      style={{
                        background: 'rgba(56, 189, 248, 0.12)',
                        color: '#7dd3fc',
                        border: '1px solid rgba(56, 189, 248, 0.3)',
                        borderRadius: '999px',
                        padding: '1px 7px',
                        fontSize: '0.62rem',
                        fontWeight: 700
                      }}
                    >
                      {eng}
                    </span>
                  ))}
                </div>

                {/* Day-Trade / Scalp-to-Swing Execution Ticket */}
                <div
                  style={{
                    background: 'rgba(2, 6, 23, 0.8)',
                    border: '1px solid rgba(16, 185, 129, 0.35)',
                    borderRadius: '10px',
                    padding: '9px 11px',
                    marginTop: 'auto'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                    <span style={{ fontSize: '0.61rem', fontWeight: 800, color: '#10b981', letterSpacing: '0.05em' }}>
                      🎯 INTRADAY BRACKET PLAN ({tp.reward_risk || 3.2}:1 R/R)
                    </span>
                    <span style={{ fontSize: '0.62rem', color: '#94a3b8', fontFamily: 'monospace' }}>
                      CLV: {Math.round((item.clv || 0.75) * 100)}%
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, fontFamily: 'monospace', fontSize: '0.72rem' }}>
                    <div>
                      <div style={{ fontSize: '0.55rem', color: '#64748b' }}>TRIGGER</div>
                      <div style={{ fontWeight: 800, color: '#38bdf8' }}>${tp.entry_trigger || item.current_price?.toFixed(2)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.55rem', color: '#64748b' }}>VWAP/ORB STOP</div>
                      <div style={{ fontWeight: 800, color: '#f43f5e' }}>${tp.stop_loss || (item.current_price * 0.985).toFixed(2)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.55rem', color: '#64748b' }}>SCALP T1 (1.8R)</div>
                      <div style={{ fontWeight: 800, color: '#10b981' }}>${tp.scalp_target_1 || (item.current_price * 1.02).toFixed(2)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.55rem', color: '#64748b' }}>RUNNER T2 (3.2R)</div>
                      <div style={{ fontWeight: 800, color: '#fbbf24' }}>${tp.runner_target_2 || (item.current_price * 1.04).toFixed(2)}</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button
                      onClick={(e) => handleCopyTicket(e, item)}
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 5,
                        padding: '5px 8px',
                        borderRadius: 6,
                        border: '1px solid rgba(236, 72, 153, 0.45)',
                        background: 'rgba(236, 72, 153, 0.14)',
                        color: '#f9a8d4',
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      {copiedTicker === item.ticker ? <Check size={12} /> : <Copy size={12} />}
                      {copiedTicker === item.ticker ? 'Ticket Copied!' : 'Copy Intraday Ticket'}
                    </button>

                    {onOpenFundamentals && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenFundamentals(item.ticker);
                        }}
                        style={{
                          padding: '5px 10px',
                          borderRadius: 6,
                          border: '1px solid rgba(56, 189, 248, 0.4)',
                          background: 'rgba(56, 189, 248, 0.12)',
                          color: '#7dd3fc',
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        Fundamentals
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
