import React, { useState, useMemo } from 'react';
import {
  Flame, Zap, ShieldAlert, TrendingUp, Activity, Target, Search,
  RefreshCw, BarChart2, Layers, CheckCircle2, Copy, Check, ArrowUpRight,
  Crosshair, Sparkles, Filter, Eye, LayoutGrid, List
} from 'lucide-react';

/**
 * 30-Day Price + EMA10 (Cyan) + EMA21 (Purple) + Gold RS Line + Dashed Entry Pivot Sparkline
 */
const SqueezeSparkline = ({ sparkline, entryPivot, isBlueDot, width = 280, height = 74 }) => {
  if (!sparkline || !Array.isArray(sparkline.close) || sparkline.close.length < 5) {
    return (
      <div style={{ width, height, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(2,6,23,0.5)', borderRadius: 8, border: '1px solid rgba(51,65,85,0.4)', fontSize: '0.7rem', color: '#64748b' }}>
        30D Telemetry Loading...
      </div>
    );
  }

  const closes = sparkline.close;
  const ema10 = sparkline.ema10 || [];
  const ema21 = sparkline.ema21 || [];
  const rsNorm = sparkline.rs_norm || [];

  const allVals = [...closes, ...ema10, ...ema21];
  if (entryPivot && entryPivot > 0) allVals.push(entryPivot);

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
  const pivotY = entryPivot
    ? Math.max(padY, Math.min(height - padY, padY + innerH - ((entryPivot - minVal) / range) * innerH))
    : null;

  const lastX = padX + innerW;
  const lastY = padY + innerH - ((closes[closes.length - 1] - minVal) / range) * innerH;

  return (
    <div style={{ position: 'relative', width: '100%', background: 'rgba(2, 6, 23, 0.65)', borderRadius: '8px', border: '1px solid rgba(51, 65, 85, 0.5)', padding: '6px 8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3, fontSize: '0.64rem', color: '#94a3b8' }}>
        <span style={{ fontWeight: 700, color: '#cbd5e1', letterSpacing: '0.03em' }}>30D COIL + EMA10/21 + RS LINE</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ color: '#38bdf8' }}>― EMA10</span>
          <span style={{ color: '#a855f7' }}>― EMA21</span>
          <span style={{ color: '#fbbf24', fontWeight: 700 }}>― RS</span>
          {isBlueDot && (
            <span style={{ background: 'rgba(59,130,246,0.22)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.5)', borderRadius: 4, padding: '0px 4px', fontWeight: 800, fontSize: '0.6rem' }}>
              🔵 RS LEAD
            </span>
          )}
        </div>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: `${height}px`, overflow: 'visible', display: 'block' }}>
        <defs>
          <linearGradient id={`sqGrad-${ isUp ? 'up' : 'flat' }`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.28" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Area under Close */}
        <polygon
          points={`${padX},${height - padY} ${closePts} ${padX + innerW},${height - padY}`}
          fill={`url(#sqGrad-${ isUp ? 'up' : 'flat' })`}
        />

        {/* Entry Pivot Dashed Line */}
        {pivotY !== null && (
          <line
            x1={padX}
            y1={pivotY}
            x2={width - padX}
            y2={pivotY}
            stroke="#f43f5e"
            strokeWidth="1"
            strokeDasharray="3,3"
            opacity="0.75"
          />
        )}

        {/* EMA21 & EMA10 */}
        {ema21Pts && <polyline fill="none" stroke="#a855f7" strokeWidth="1.15" strokeDasharray="2,2" points={ema21Pts} opacity="0.8" />}
        {ema10Pts && <polyline fill="none" stroke="#38bdf8" strokeWidth="1.25" points={ema10Pts} opacity="0.85" />}

        {/* Normalized Gold RS Line */}
        {rsPts && <polyline fill="none" stroke="#fbbf24" strokeWidth="1.35" points={rsPts} opacity="0.9" />}

        {/* Price Close Line */}
        <polyline fill="none" stroke={strokeColor} strokeWidth="2.1" points={closePts} />

        {/* Current Price / Blue Dot Node */}
        <circle
          cx={lastX}
          cy={lastY}
          r={isBlueDot ? 4 : 3}
          fill={isBlueDot ? '#3b82f6' : strokeColor}
          stroke="#ffffff"
          strokeWidth="1.2"
        />
      </svg>
    </div>
  );
};

export default function SqueezeRadarDashboard({
  squeezeData,
  loading,
  onTickerClick,
  onOpenFundamentals,
  onRefresh
}) {
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('composite_score');
  const [viewMode, setViewMode] = useState('cards'); // 'cards' | 'table'
  const [copiedTicker, setCopiedTicker] = useState(null);

  // Build unified master list from squeezeData
  const allSqueezes = useMemo(() => {
    if (!squeezeData) return [];
    if (Array.isArray(squeezeData.all_squeezes) && squeezeData.all_squeezes.length > 0) {
      return squeezeData.all_squeezes;
    }
    const mergedMap = new Map();
    const lists = [
      squeezeData.ttm_keltner_squeeze || [],
      squeezeData.gamma_squeeze_setup || [],
      squeezeData.high_short_interest || []
    ];
    lists.forEach((arr) => {
      arr.forEach((item) => {
        if (item && item.ticker && !mergedMap.has(item.ticker)) {
          mergedMap.set(item.ticker, item);
        }
      });
    });
    return Array.from(mergedMap.values());
  }, [squeezeData]);

  const kpis = useMemo(() => {
    if (squeezeData?.summary_kpis) return squeezeData.summary_kpis;
    return {
      total_coiled_squeezes: allSqueezes.length,
      high_squeeze_pro_count: allSqueezes.filter((x) => x.ttm_tier === 'HIGH_SQUEEZE' || (x.ttm_label || '').includes('High Squeeze')).length,
      firing_now_count: allSqueezes.filter((x) => x.squeeze_category === 'SQUEEZE_FIRING' || (x.trade_plan?.dist_to_pivot_pct ?? 99) <= 1.5).length,
      gamma_powder_kegs: allSqueezes.filter((x) => (x.gamma_score || 0) >= 78 || (x.cp_ratio || 0) >= 1.5).length,
      blue_dot_squeezes: allSqueezes.filter((x) => x.is_blue_dot).length,
      vdu_pocket_pivots: allSqueezes.filter((x) => x.is_vdu || x.is_pocket_pivot).length,
      avg_compression_score: allSqueezes.length
        ? (allSqueezes.reduce((acc, x) => acc + (x.composite_score || 0), 0) / allSqueezes.length).toFixed(1)
        : 0
    };
  }, [squeezeData, allSqueezes]);

  const spotlight = useMemo(() => {
    return squeezeData?.spotlight || allSqueezes[0] || null;
  }, [squeezeData, allSqueezes]);

  const filteredSqueezes = useMemo(() => {
    let list = [...allSqueezes];

    // Category Filter
    if (activeCategory === 'HIGH_SQUEEZE') {
      list = list.filter((x) => x.ttm_tier === 'HIGH_SQUEEZE' || (x.ttm_label || '').includes('High Squeeze'));
    } else if (activeCategory === 'FIRING_NOW') {
      list = list.filter((x) => x.squeeze_category === 'SQUEEZE_FIRING' || (x.trade_plan?.dist_to_pivot_pct ?? 99) <= 1.5);
    } else if (activeCategory === 'GAMMA') {
      list = list.filter((x) => (x.gamma_score || 0) >= 75 || (x.cp_ratio || 0) >= 1.45);
    } else if (activeCategory === 'SHORT_KEG') {
      list = list.filter((x) => (x.powder_keg_score || 0) >= 70 || (x.short_pct_num || 0) >= 8.0);
    } else if (activeCategory === 'VDU_PP') {
      list = list.filter((x) => x.is_vdu || x.is_pocket_pivot || (x.vdu_days_10d || 0) >= 3);
    } else if (activeCategory === 'BLUE_DOT') {
      list = list.filter((x) => x.is_blue_dot || (x.rs_rating || 0) >= 85);
    } else if (activeCategory === 'MULTI_ENGINE') {
      list = list.filter((x) => (x.confluence_count || 1) >= 3);
    }

    // Search Filter
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toUpperCase();
      list = list.filter(
        (x) =>
          (x.ticker || '').toUpperCase().includes(q) ||
          (x.name || '').toUpperCase().includes(q) ||
          (x.sector || '').toUpperCase().includes(q) ||
          (x.confluence_engines || []).some((e) => e.toUpperCase().includes(q))
      );
    }

    // Sort
    list.sort((a, b) => {
      if (sortBy === 'composite_score') return (b.composite_score || 0) - (a.composite_score || 0);
      if (sortBy === 'gamma_score') return (b.gamma_score || 0) - (a.gamma_score || 0);
      if (sortBy === 'powder_keg_score') return (b.powder_keg_score || 0) - (a.powder_keg_score || 0);
      if (sortBy === 'dist_to_pivot') return (a.trade_plan?.dist_to_pivot_pct ?? 99) - (b.trade_plan?.dist_to_pivot_pct ?? 99);
      if (sortBy === 'bb_width') return (a.bb_width_pct ?? 99) - (b.bb_width_pct ?? 99);
      if (sortBy === 'alpha_30d') return (b.movement_30d?.alpha_30d_pct ?? -99) - (a.movement_30d?.alpha_30d_pct ?? -99);
      return (b.composite_score || 0) - (a.composite_score || 0);
    });

    return list;
  }, [allSqueezes, activeCategory, searchQuery, sortBy]);

  const handleCopyTicket = (e, item) => {
    e.stopPropagation();
    const tp = item.trade_plan || {};
    const text = `[APEX SQUEEZE 3.0 ORDER TICKET] $${item.ticker} (${item.setup_grade} | Score ${item.composite_score}/100)\nState: ${item.ttm_label}\nBuy Stop Limit: $${tp.entry_pivot || item.price} (Max Chase: $${tp.max_buy_price || item.price})\nStop Loss: $${tp.stop_loss || 'N/A'} (-${tp.risk_pct || 0}%)\nTarget 1 (2.0R): $${tp.target_1 || 'N/A'} | Target 2 (3.5R): $${tp.target_2 || 'N/A'}\nConfluence: ${(item.confluence_engines || []).join(', ')}`;
    navigator.clipboard.writeText(text);
    setCopiedTicker(item.ticker);
    setTimeout(() => setCopiedTicker(null), 2000);
  };

  const getGradeBadgeStyle = (grade) => {
    if (grade === 'A+') {
      return { background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.5)' };
    }
    if (grade === 'A') {
      return { background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.45)' };
    }
    return { background: 'rgba(251, 191, 36, 0.18)', color: '#fbbf24', border: '1px solid rgba(251, 191, 36, 0.4)' };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', paddingBottom: '32px' }}>
      {/* 1. EXECUTIVE HEADER & 6-PILLAR KPI RIBBON */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.96), rgba(30, 17, 45, 0.88))',
          border: '1px solid rgba(244, 63, 94, 0.35)',
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
                  background: 'linear-gradient(135deg, #f43f5e, #f59e0b)',
                  color: '#fff',
                  fontWeight: 900,
                  fontSize: '0.7rem',
                  padding: '3px 9px',
                  borderRadius: '6px',
                  letterSpacing: '0.08em'
                }}
              >
                APEX SQUEEZE RADAR 3.0
              </span>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontFamily: 'monospace' }}>
                11-ENGINE CONFLUENCE • {squeezeData?.total_scanned?.toLocaleString() || '12,817'} TICKERS SCANNED
              </span>
            </div>
            <h2 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Flame size={24} color="#f43f5e" />
              Institutional Volatility, Options Gamma & Short Squeeze Terminal
            </h2>
            <p style={{ margin: '6px 0 0 0', fontSize: '0.84rem', color: '#cbd5e1', maxWidth: '880px', lineHeight: 1.45 }}>
              Blends <strong>TTM Squeeze Pro (1.0x/1.25x/1.5x KC)</strong>, <strong>Minervini VCP ATR5/20 Dampening</strong>,{' '}
              <strong>HV10/HV30 Collapse</strong>, <strong>Richard Arms Ease of Movement (EMV)</strong>, <strong>VDU + Pocket Pivots</strong>, and{' '}
              <strong>CBOE Options Gamma / Trapped Short Fuel</strong> with 30D Price + RS Line Sparklines & Bracket Order Tickets.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ display: 'flex', background: 'rgba(2, 6, 23, 0.7)', borderRadius: '8px', padding: '3px', border: '1px solid rgba(51, 65, 85, 0.6)' }}>
              <button
                onClick={() => setViewMode('cards')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '6px 11px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  background: viewMode === 'cards' ? 'rgba(244, 63, 94, 0.25)' : 'transparent',
                  color: viewMode === 'cards' ? '#fda4af' : '#94a3b8'
                }}
              >
                <LayoutGrid size={14} /> Cards
              </button>
              <button
                onClick={() => setViewMode('table')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '6px 11px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  background: viewMode === 'table' ? 'rgba(244, 63, 94, 0.25)' : 'transparent',
                  color: viewMode === 'table' ? '#fda4af' : '#94a3b8'
                }}
              >
                <List size={14} /> Matrix Table
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
                  border: '1px solid rgba(244, 63, 94, 0.5)',
                  background: 'rgba(244, 63, 94, 0.18)',
                  color: '#fda4af',
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  cursor: loading ? 'wait' : 'pointer'
                }}
              >
                <RefreshCw size={15} className={loading ? 'spin' : ''} />
                {loading ? 'Scanning Lakehouse...' : 'Rescan Squeeze Engine'}
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
            { label: 'TOTAL COILED SQUEEZES', value: kpis.total_coiled_squeezes, sub: 'Stage 2 Liquid Coils', color: '#f8fafc', border: 'rgba(148,163,184,0.3)' },
            { label: '🔥 HIGH SQUEEZE PRO', value: kpis.high_squeeze_pro_count, sub: 'BB inside 1.0x ATR KC', color: '#f43f5e', border: 'rgba(244,63,94,0.4)' },
            { label: '🚀 IMMINENT BREAKOUT', value: kpis.firing_now_count, sub: 'Within 1.5% of Pivot', color: '#10b981', border: 'rgba(16,185,129,0.4)' },
            { label: '⚡ GAMMA POWDER KEGS', value: kpis.gamma_powder_kegs, sub: 'Heavy Call Flow + Coil', color: '#fbbf24', border: 'rgba(251,191,36,0.4)' },
            { label: '🔵 RS BLUE DOT COILS', value: kpis.blue_dot_squeezes, sub: 'RS Line Leading Price', color: '#38bdf8', border: 'rgba(56,189,248,0.4)' },
            { label: '💧 VDU + POCKET PIVOTS', value: kpis.vdu_pocket_pivots, sub: 'Supply Exhaustion + Accumulation', color: '#a855f7', border: 'rgba(168,85,247,0.4)' }
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

      {/* 2. #1 APEX SQUEEZE SPOTLIGHT HERO BANNER */}
      {spotlight && (
        <div
          onClick={() => onTickerClick && onTickerClick(spotlight.ticker)}
          style={{
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(15, 23, 42, 0.95) 45%, rgba(244, 63, 94, 0.12))',
            border: '1px solid rgba(16, 185, 129, 0.45)',
            borderRadius: '14px',
            padding: '18px 22px',
            cursor: 'pointer',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))',
            gap: '18px',
            alignItems: 'center'
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
              <span style={{ background: '#10b981', color: '#022c22', fontWeight: 900, fontSize: '0.68rem', padding: '2px 8px', borderRadius: '4px' }}>
                #1 APEX SQUEEZE OF THE DAY
              </span>
              <span style={{ ...getGradeBadgeStyle(spotlight.setup_grade), fontSize: '0.7rem', fontWeight: 800, padding: '2px 8px', borderRadius: '4px' }}>
                GRADE {spotlight.setup_grade} • {spotlight.composite_score}/100
              </span>
              <span style={{ background: 'rgba(244,63,94,0.18)', color: '#fda4af', border: '1px solid rgba(244,63,94,0.4)', fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '4px' }}>
                {spotlight.ttm_label}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginTop: '4px' }}>
              <span style={{ fontSize: '1.65rem', fontWeight: 900, color: '#f8fafc', fontFamily: 'monospace' }}>${spotlight.ticker}</span>
              <span style={{ fontSize: '0.9rem', color: '#94a3b8', fontWeight: 600 }}>{spotlight.name}</span>
              <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#e2e8f0', fontFamily: 'monospace' }}>${spotlight.price?.toFixed(2)}</span>
              <span
                style={{
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  fontFamily: 'monospace',
                  color: (spotlight.day_change_pct || 0) >= 0 ? '#10b981' : '#f43f5e'
                }}
              >
                {(spotlight.day_change_pct || 0) >= 0 ? '+' : ''}
                {(spotlight.day_change_pct || 0).toFixed(2)}%
              </span>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
              {(spotlight.confluence_engines || []).map((eng, i) => (
                <span
                  key={i}
                  style={{
                    background: 'rgba(56, 189, 248, 0.14)',
                    color: '#7dd3fc',
                    border: '1px solid rgba(56, 189, 248, 0.35)',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '999px'
                  }}
                >
                  ✓ {eng}
                </span>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginTop: '12px', background: 'rgba(2,6,23,0.6)', padding: '9px 12px', borderRadius: '8px', border: '1px solid rgba(51,65,85,0.5)' }}>
              <div>
                <div style={{ fontSize: '0.62rem', color: '#94a3b8' }}>ENTRY PIVOT</div>
                <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#38bdf8', fontFamily: 'monospace' }}>
                  ${spotlight.trade_plan?.entry_pivot} <span style={{ fontSize: '0.68rem' }}>({spotlight.trade_plan?.dist_to_pivot_pct}%)</span>
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.62rem', color: '#94a3b8' }}>STOP LOSS</div>
                <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#f43f5e', fontFamily: 'monospace' }}>
                  ${spotlight.trade_plan?.stop_loss} <span style={{ fontSize: '0.68rem' }}>(-{spotlight.trade_plan?.risk_pct}%)</span>
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.62rem', color: '#94a3b8' }}>TARGET 1 (2R)</div>
                <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#10b981', fontFamily: 'monospace' }}>${spotlight.trade_plan?.target_1}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.62rem', color: '#94a3b8' }}>TARGET 2 (3.5R)</div>
                <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#fbbf24', fontFamily: 'monospace' }}>${spotlight.trade_plan?.target_2}</div>
              </div>
            </div>
          </div>

          <div>
            <SqueezeSparkline
              sparkline={spotlight.sparkline}
              entryPivot={spotlight.trade_plan?.entry_pivot}
              isBlueDot={spotlight.is_blue_dot}
              height={88}
            />
          </div>
        </div>
      )}

      {/* 3. CATEGORY FILTER TABS & SEARCH / SORT CONTROLS */}
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
            { id: 'ALL', label: `All Coiled Squeezes (${allSqueezes.length})` },
            { id: 'HIGH_SQUEEZE', label: `🔥 High Squeeze Pro (${kpis.high_squeeze_pro_count})` },
            { id: 'FIRING_NOW', label: `🚀 Imminent Ignition (${kpis.firing_now_count})` },
            { id: 'GAMMA', label: `⚡ Gamma Squeeze (${kpis.gamma_powder_kegs})` },
            { id: 'SHORT_KEG', label: `💣 Short Powder Keg` },
            { id: 'VDU_PP', label: `💧 VDU + Pocket Pivot (${kpis.vdu_pocket_pivots})` },
            { id: 'BLUE_DOT', label: `🔵 RS Blue Dot (${kpis.blue_dot_squeezes})` },
            { id: 'MULTI_ENGINE', label: `🏛️ 3+ Engine Confluence` }
          ].map((tab) => {
            const active = activeCategory === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveCategory(tab.id)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: active ? '1px solid #f43f5e' : '1px solid rgba(71, 85, 105, 0.45)',
                  background: active ? 'rgba(244, 63, 94, 0.22)' : 'rgba(2, 6, 23, 0.5)',
                  color: active ? '#fda4af' : '#cbd5e1',
                  fontSize: '0.75rem',
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

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} color="#64748b" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Search ticker, sector, engine..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                padding: '7px 12px 7px 30px',
                borderRadius: '8px',
                border: '1px solid rgba(71, 85, 105, 0.6)',
                background: 'rgba(2, 6, 23, 0.75)',
                color: '#f8fafc',
                fontSize: '0.78rem',
                width: '210px'
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
            <option value="composite_score">Sort: Composite Squeeze Score</option>
            <option value="dist_to_pivot">Sort: Closest to Entry Pivot</option>
            <option value="gamma_score">Sort: Options Gamma Score</option>
            <option value="powder_keg_score">Sort: Short Powder Keg Score</option>
            <option value="bb_width">Sort: Tightest Bollinger Width %</option>
            <option value="alpha_30d">Sort: Highest 30D Alpha vs SPY</option>
          </select>
        </div>
      </div>

      {/* 4. MAIN DISPLAY: CARDS GRID OR MATRIX TABLE */}
      {filteredSqueezes.length === 0 ? (
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
          No squeeze setups match the selected filter criteria. Try selecting "All Coiled Squeezes".
        </div>
      ) : viewMode === 'table' ? (
        <div
          style={{
            background: 'rgba(15, 23, 42, 0.9)',
            border: '1px solid rgba(51, 65, 85, 0.6)',
            borderRadius: '12px',
            overflowX: 'auto'
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(71, 85, 105, 0.6)', background: 'rgba(2, 6, 23, 0.75)', color: '#94a3b8', fontSize: '0.68rem', textTransform: 'uppercase' }}>
                <th style={{ padding: '12px 14px' }}>Ticker</th>
                <th style={{ padding: '12px 10px' }}>Price / 1D</th>
                <th style={{ padding: '12px 10px' }}>Score / Grade</th>
                <th style={{ padding: '12px 10px' }}>TTM Squeeze State</th>
                <th style={{ padding: '12px 10px' }}>VCP / HVR / BB%</th>
                <th style={{ padding: '12px 10px' }}>Order Flow & VDU</th>
                <th style={{ padding: '12px 10px' }}>Gamma / Short Fuel</th>
                <th style={{ padding: '12px 10px' }}>RS & 30D Alpha</th>
                <th style={{ padding: '12px 10px' }}>Pivot / Stop / T2</th>
                <th style={{ padding: '12px 14px' }}>Confluence</th>
              </tr>
            </thead>
            <tbody>
              {filteredSqueezes.map((item) => {
                const tp = item.trade_plan || {};
                const mov = item.movement_30d || {};
                return (
                  <tr
                    key={item.ticker}
                    onClick={() => onTickerClick && onTickerClick(item.ticker)}
                    style={{
                      borderBottom: '1px solid rgba(51, 65, 85, 0.35)',
                      cursor: 'pointer',
                      transition: 'background 0.15s'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(30, 41, 59, 0.65)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '10px 14px', fontWeight: 800, color: '#f8fafc', fontFamily: 'monospace' }}>
                      <div>${item.ticker}</div>
                      <div style={{ fontSize: '0.66rem', color: '#64748b', fontFamily: 'sans-serif' }}>{item.sector}</div>
                    </td>
                    <td style={{ padding: '10px', fontFamily: 'monospace' }}>
                      <div style={{ fontWeight: 700, color: '#e2e8f0' }}>${item.price?.toFixed(2)}</div>
                      <div style={{ fontSize: '0.7rem', color: (item.day_change_pct || 0) >= 0 ? '#10b981' : '#f43f5e' }}>
                        {(item.day_change_pct || 0) >= 0 ? '+' : ''}
                        {(item.day_change_pct || 0).toFixed(2)}%
                      </div>
                    </td>
                    <td style={{ padding: '10px', fontFamily: 'monospace' }}>
                      <span style={{ ...getGradeBadgeStyle(item.setup_grade), padding: '2px 7px', borderRadius: 4, fontWeight: 800, fontSize: '0.72rem' }}>
                        {item.setup_grade} • {item.composite_score}
                      </span>
                    </td>
                    <td style={{ padding: '10px' }}>
                      <div style={{ fontWeight: 700, color: '#fda4af', fontSize: '0.74rem' }}>{item.ttm_label}</div>
                      <div style={{ fontSize: '0.66rem', color: '#94a3b8' }}>
                        Ratio: {item.compression_ratio}x • {item.rmv_status}
                      </div>
                    </td>
                    <td style={{ padding: '10px', fontFamily: 'monospace', fontSize: '0.72rem' }}>
                      <div>VCP: <strong style={{ color: '#38bdf8' }}>{item.vcp_ratio}x</strong></div>
                      <div>HVR: <strong style={{ color: '#a855f7' }}>{item.hvr}x</strong> | BB: <strong>{item.bb_width_pct}%</strong></div>
                    </td>
                    <td style={{ padding: '10px', fontSize: '0.72rem' }}>
                      <div>U/D Vol: <strong style={{ color: (item.ud_ratio || 1) >= 1.2 ? '#10b981' : '#cbd5e1' }}>{item.ud_ratio}x</strong></div>
                      <div style={{ fontSize: '0.66rem', color: '#94a3b8' }}>
                        VDU 10D: {item.vdu_days_10d || 0}d • PP: {item.pocket_pivots_10d || 0}
                      </div>
                    </td>
                    <td style={{ padding: '10px', fontFamily: 'monospace', fontSize: '0.72rem' }}>
                      <div>Gamma: <strong style={{ color: '#fbbf24' }}>{item.gamma_score}</strong> ({item.cp_ratio}x C/P)</div>
                      <div>Short: <strong style={{ color: '#f43f5e' }}>{item.short_float}</strong> ({item.short_ratio || 0}d DTC)</div>
                    </td>
                    <td style={{ padding: '10px', fontFamily: 'monospace', fontSize: '0.72rem' }}>
                      <div>
                        RS <strong style={{ color: '#38bdf8' }}>{item.rs_rating || 80}</strong> {item.is_blue_dot ? '🔵' : ''}
                      </div>
                      <div style={{ color: (mov.alpha_30d_pct || 0) >= 0 ? '#10b981' : '#f43f5e' }}>
                        30D α: {(mov.alpha_30d_pct || 0) >= 0 ? '+' : ''}{mov.alpha_30d_pct || 0}%
                      </div>
                    </td>
                    <td style={{ padding: '10px', fontFamily: 'monospace', fontSize: '0.72rem' }}>
                      <div style={{ color: '#38bdf8', fontWeight: 700 }}>Piv: ${tp.entry_pivot} ({tp.dist_to_pivot_pct}%)</div>
                      <div style={{ color: '#94a3b8', fontSize: '0.66rem' }}>SL: ${tp.stop_loss} → T2: ${tp.target_2}</div>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {(item.confluence_engines || []).slice(0, 3).map((e, idx) => (
                          <span key={idx} style={{ background: 'rgba(56,189,248,0.14)', color: '#7dd3fc', padding: '1px 6px', borderRadius: 4, fontSize: '0.63rem', fontWeight: 700 }}>
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
            gridTemplateColumns: 'repeat(auto-fill, minmax(390px, 1fr))',
            gap: '16px'
          }}
        >
          {filteredSqueezes.map((item) => {
            const tp = item.trade_plan || {};
            const mov = item.movement_30d || {};
            const isHighSqueeze = item.ttm_tier === 'HIGH_SQUEEZE' || (item.ttm_label || '').includes('High Squeeze');
            const isImminent = (tp.dist_to_pivot_pct ?? 99) <= 1.5;

            return (
              <div
                key={item.ticker}
                onClick={() => onTickerClick && onTickerClick(item.ticker)}
                style={{
                  background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.95), rgba(9, 14, 28, 0.98))',
                  border: isHighSqueeze
                    ? '1px solid rgba(244, 63, 94, 0.55)'
                    : isImminent
                    ? '1px solid rgba(16, 185, 129, 0.5)'
                    : '1px solid rgba(51, 65, 85, 0.65)',
                  borderRadius: '14px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  cursor: 'pointer',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
                  transition: 'transform 0.15s ease, border-color 0.15s ease'
                }}
              >
                {/* Card Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '1.3rem', fontWeight: 900, color: '#f8fafc', fontFamily: 'monospace' }}>${item.ticker}</span>
                      <span style={{ ...getGradeBadgeStyle(item.setup_grade), fontSize: '0.68rem', fontWeight: 800, padding: '2px 7px', borderRadius: '5px' }}>
                        {item.setup_grade} • {item.composite_score}/100
                      </span>
                      {item.is_blue_dot && (
                        <span style={{ background: 'rgba(59,130,246,0.2)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.45)', fontSize: '0.64rem', fontWeight: 800, padding: '2px 6px', borderRadius: '5px' }}>
                          🔵 RS {item.rs_rating}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.73rem', color: '#94a3b8', marginTop: '2px' }}>
                      {item.name} • <span style={{ color: '#64748b' }}>{item.sector}</span> • Cap ${item.market_cap_b}B
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                    <div style={{ fontSize: '1.18rem', fontWeight: 800, color: '#f8fafc' }}>${item.price?.toFixed(2)}</div>
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

                {/* Squeeze Banner Tag */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '6px 10px',
                    borderRadius: '8px',
                    background: isHighSqueeze ? 'rgba(244, 63, 94, 0.16)' : 'rgba(30, 41, 59, 0.7)',
                    border: isHighSqueeze ? '1px solid rgba(244, 63, 94, 0.4)' : '1px solid rgba(71, 85, 105, 0.4)',
                    fontSize: '0.73rem'
                  }}
                >
                  <span style={{ fontWeight: 800, color: isHighSqueeze ? '#fda4af' : '#e2e8f0' }}>{item.ttm_label}</span>
                  <span style={{ fontFamily: 'monospace', fontSize: '0.69rem', color: '#cbd5e1' }}>
                    {item.rmv_status}
                  </span>
                </div>

                {/* 30D Price + EMA10/21 + Gold RS Line Sparkline */}
                <SqueezeSparkline
                  sparkline={item.sparkline}
                  entryPivot={tp.entry_pivot}
                  isBlueDot={item.is_blue_dot}
                  height={72}
                />

                {/* 30D Movement & Order Flow Strip */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: '6px',
                    background: 'rgba(2, 6, 23, 0.55)',
                    padding: '7px 9px',
                    borderRadius: '8px',
                    border: '1px solid rgba(51, 65, 85, 0.45)',
                    fontSize: '0.68rem',
                    fontFamily: 'monospace'
                  }}
                >
                  <div>
                    <div style={{ color: '#64748b', fontSize: '0.58rem' }}>30D RETURN</div>
                    <div style={{ fontWeight: 800, color: (mov.return_30d_pct || 0) >= 0 ? '#10b981' : '#f43f5e' }}>
                      {(mov.return_30d_pct || 0) >= 0 ? '+' : ''}{mov.return_30d_pct ?? 0}%
                    </div>
                  </div>
                  <div>
                    <div style={{ color: '#64748b', fontSize: '0.58rem' }}>30D VS SPY</div>
                    <div style={{ fontWeight: 800, color: (mov.alpha_30d_pct || 0) >= 0 ? '#38bdf8' : '#f43f5e' }}>
                      {(mov.alpha_30d_pct || 0) >= 0 ? '+' : ''}{mov.alpha_30d_pct ?? 0}%
                    </div>
                  </div>
                  <div>
                    <div style={{ color: '#64748b', fontSize: '0.58rem' }}>U/D VOL 30D</div>
                    <div style={{ fontWeight: 800, color: (item.ud_ratio || 1) >= 1.2 ? '#10b981' : '#e2e8f0' }}>
                      {item.ud_ratio}x
                    </div>
                  </div>
                  <div>
                    <div style={{ color: '#64748b', fontSize: '0.58rem' }}>VDU / PIVOTS</div>
                    <div style={{ fontWeight: 800, color: '#a855f7' }}>
                      {item.vdu_days_10d || 0}d / {item.pocket_pivots_10d || 0}PP
                    </div>
                  </div>
                </div>

                {/* 5-Pillar Volatility Compression & Gamma/Short Matrix */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '6px',
                    fontSize: '0.69rem'
                  }}
                >
                  <div style={{ background: 'rgba(15, 23, 42, 0.8)', padding: '6px 8px', borderRadius: '6px', border: '1px solid rgba(51, 65, 85, 0.4)' }}>
                    <div style={{ fontSize: '0.58rem', color: '#94a3b8' }}>VCP (ATR5/20)</div>
                    <div style={{ fontWeight: 800, color: item.vcp_ratio <= 0.75 ? '#10b981' : '#e2e8f0', fontFamily: 'monospace' }}>
                      {item.vcp_ratio}x {item.vcp_ratio <= 0.75 ? '✓' : ''}
                    </div>
                  </div>
                  <div style={{ background: 'rgba(15, 23, 42, 0.8)', padding: '6px 8px', borderRadius: '6px', border: '1px solid rgba(51, 65, 85, 0.4)' }}>
                    <div style={{ fontSize: '0.58rem', color: '#94a3b8' }}>HV10 / HV30</div>
                    <div style={{ fontWeight: 800, color: item.hvr <= 0.75 ? '#38bdf8' : '#e2e8f0', fontFamily: 'monospace' }}>
                      {item.hvr}x ({item.bb_width_pct}% BB)
                    </div>
                  </div>
                  <div style={{ background: 'rgba(15, 23, 42, 0.8)', padding: '6px 8px', borderRadius: '6px', border: '1px solid rgba(51, 65, 85, 0.4)' }}>
                    <div style={{ fontSize: '0.58rem', color: '#94a3b8' }}>ARMS EMV (14D)</div>
                    <div style={{ fontWeight: 700, color: item.emv_14 >= 0 ? '#10b981' : '#94a3b8', fontSize: '0.65rem' }}>
                      {item.emv_status}
                    </div>
                  </div>
                  <div style={{ background: 'rgba(15, 23, 42, 0.8)', padding: '6px 8px', borderRadius: '6px', border: '1px solid rgba(51, 65, 85, 0.4)' }}>
                    <div style={{ fontSize: '0.58rem', color: '#94a3b8' }}>GAMMA CALL FLOW</div>
                    <div style={{ fontWeight: 800, color: '#fbbf24', fontFamily: 'monospace' }}>
                      {item.call_vol_pct || 60}% Calls ({item.cp_ratio || 1.2}x)
                    </div>
                  </div>
                  <div style={{ background: 'rgba(15, 23, 42, 0.8)', padding: '6px 8px', borderRadius: '6px', border: '1px solid rgba(51, 65, 85, 0.4)' }}>
                    <div style={{ fontSize: '0.58rem', color: '#94a3b8' }}>SHORT POWDER KEG</div>
                    <div style={{ fontWeight: 800, color: '#f43f5e', fontFamily: 'monospace' }}>
                      {item.short_float} ({item.short_ratio || 1.5}d)
                    </div>
                  </div>
                  <div style={{ background: 'rgba(15, 23, 42, 0.8)', padding: '6px 8px', borderRadius: '6px', border: '1px solid rgba(51, 65, 85, 0.4)' }}>
                    <div style={{ fontSize: '0.58rem', color: '#94a3b8' }}>10Y {item.cur_month_name || 'NOV'} SEASONALITY</div>
                    <div style={{ fontWeight: 800, color: (item.cur_month_win || 65) >= 65 ? '#10b981' : '#cbd5e1', fontFamily: 'monospace' }}>
                      {item.cur_month_win || 65}% Win (+{item.cur_month_avg || 1.8}%)
                    </div>
                  </div>
                </div>

                {/* Multi-Engine Confluence Pills */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                  {(item.confluence_engines || []).map((eng, i) => (
                    <span
                      key={i}
                      style={{
                        background: 'rgba(56, 189, 248, 0.12)',
                        color: '#7dd3fc',
                        border: '1px solid rgba(56, 189, 248, 0.3)',
                        borderRadius: '999px',
                        padding: '1px 7px',
                        fontSize: '0.63rem',
                        fontWeight: 700
                      }}
                    >
                      {eng}
                    </span>
                  ))}
                </div>

                {/* Actionable MarketSurge Bracket Execution Ticket */}
                <div
                  style={{
                    background: 'rgba(2, 6, 23, 0.78)',
                    border: '1px solid rgba(16, 185, 129, 0.35)',
                    borderRadius: '10px',
                    padding: '9px 11px',
                    marginTop: 'auto'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '0.62rem', fontWeight: 800, color: '#10b981', letterSpacing: '0.05em' }}>
                      🎯 BRACKET EXECUTION PLAN ({tp.reward_risk || 3.5}:1 R/R)
                    </span>
                    <span
                      style={{
                        fontSize: '0.64rem',
                        fontWeight: 800,
                        fontFamily: 'monospace',
                        color: (tp.dist_to_pivot_pct ?? 5) <= 1.5 ? '#10b981' : '#fbbf24'
                      }}
                    >
                      {(tp.dist_to_pivot_pct ?? 0) <= 1.5 ? '🚀 AT PIVOT EDGE' : `${tp.dist_to_pivot_pct}% TO PIVOT`}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', fontFamily: 'monospace', fontSize: '0.73rem' }}>
                    <div>
                      <div style={{ fontSize: '0.56rem', color: '#64748b' }}>BUY PIVOT</div>
                      <div style={{ fontWeight: 800, color: '#38bdf8' }}>${tp.entry_pivot || item.price}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.56rem', color: '#64748b' }}>STOP (-{tp.risk_pct || 3.5}%)</div>
                      <div style={{ fontWeight: 800, color: '#f43f5e' }}>${tp.stop_loss || 'N/A'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.56rem', color: '#64748b' }}>TARGET 1 (2R)</div>
                      <div style={{ fontWeight: 800, color: '#10b981' }}>${tp.target_1 || 'N/A'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.56rem', color: '#64748b' }}>TARGET 2 (3.5R)</div>
                      <div style={{ fontWeight: 800, color: '#fbbf24' }}>${tp.target_2 || 'N/A'}</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                    <button
                      onClick={(e) => handleCopyTicket(e, item)}
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '5px',
                        padding: '5px 8px',
                        borderRadius: '6px',
                        border: '1px solid rgba(56, 189, 248, 0.4)',
                        background: 'rgba(56, 189, 248, 0.12)',
                        color: '#7dd3fc',
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      {copiedTicker === item.ticker ? <Check size={12} /> : <Copy size={12} />}
                      {copiedTicker === item.ticker ? 'Ticket Copied!' : 'Copy Ticket'}
                    </button>

                    {onOpenFundamentals && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenFundamentals(item.ticker);
                        }}
                        style={{
                          padding: '5px 10px',
                          borderRadius: '6px',
                          border: '1px solid rgba(168, 85, 247, 0.4)',
                          background: 'rgba(168, 85, 247, 0.12)',
                          color: '#d8b4fe',
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
