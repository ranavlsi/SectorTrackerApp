import React, { useState, useMemo } from 'react';
import {
  TrendingUp, Target, ShieldCheck, Activity, Search, RefreshCw,
  Copy, Check, LayoutGrid, List, BarChart2, Flame, Layers, Sparkles
} from 'lucide-react';

/**
 * 30-Day Untangled Ribbon Sparkline: Close + 9/13/21/50 SMAs
 */
const RibbonSparkline = ({ sparkline, ticker = 'STK', width = 300, height = 84 }) => {
  if (!sparkline || !Array.isArray(sparkline.close) || sparkline.close.length < 5) {
    return (
      <div
        style={{
          width: '100%',
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(2, 6, 23, 0.55)',
          borderRadius: 8,
          border: '1px solid rgba(51, 65, 85, 0.45)',
          fontSize: '0.7rem',
          color: '#64748b'
        }}
      >
        30D Ribbon Telemetry Pending...
      </div>
    );
  }

  const closes = sparkline.close;
  const s9 = sparkline.sma9 || [];
  const s13 = sparkline.sma13 || [];
  const s21 = sparkline.sma21 || [];
  const s50 = sparkline.sma50 || [];

  const allVals = [...closes, ...s9, ...s13, ...s21, ...s50].filter((v) => Number.isFinite(v));
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
  const s9Pts = s9.length === closes.length ? toPoints(s9) : '';
  const s13Pts = s13.length === closes.length ? toPoints(s13) : '';
  const s21Pts = s21.length === closes.length ? toPoints(s21) : '';
  const s50Pts = s50.length === closes.length ? toPoints(s50) : '';

  const lastX = padX + innerW;
  const lastY = padY + innerH - ((closes[closes.length - 1] - minVal) / range) * innerH;
  const gradId = `cu-grad-${ticker.replace(/[^a-zA-Z0-9]/g, '')}`;

  return (
    <div
      style={{
        width: '100%',
        background: 'rgba(2, 6, 23, 0.65)',
        borderRadius: '9px',
        border: '1px solid rgba(51, 65, 85, 0.5)',
        padding: '6px 8px'
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 4,
          fontSize: '0.62rem',
          color: '#94a3b8',
          flexWrap: 'wrap',
          gap: 6
        }}
      >
        <span style={{ fontWeight: 700, color: '#cbd5e1', letterSpacing: '0.03em' }}>30D UNTANGLED SMA RIBBON</span>
        <div style={{ display: 'flex', gap: 7, fontFamily: 'monospace' }}>
          <span style={{ color: '#38bdf8' }}>― 9</span>
          <span style={{ color: '#fbbf24' }}>― 13</span>
          <span style={{ color: '#a855f7' }}>― 21</span>
          <span style={{ color: '#f43f5e' }}>-- 50</span>
        </div>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: `${height}px`, display: 'block', overflow: 'visible' }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.26" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        <polygon points={`${padX},${height - padY} ${closePts} ${padX + innerW},${height - padY}`} fill={`url(#${gradId})`} />

        {s50Pts && <polyline fill="none" stroke="#f43f5e" strokeWidth="1.2" strokeDasharray="3,2" points={s50Pts} opacity="0.8" />}
        {s21Pts && <polyline fill="none" stroke="#a855f7" strokeWidth="1.2" points={s21Pts} opacity="0.85" />}
        {s13Pts && <polyline fill="none" stroke="#fbbf24" strokeWidth="1.35" points={s13Pts} opacity="0.9" />}
        {s9Pts && <polyline fill="none" stroke="#38bdf8" strokeWidth="1.4" points={s9Pts} opacity="0.95" />}
        <polyline fill="none" stroke="#10b981" strokeWidth="2.1" points={closePts} />

        <circle cx={lastX} cy={lastY} r="3.4" fill="#10b981" stroke="#ffffff" strokeWidth="1.2" />
      </svg>
    </div>
  );
};

export default function CleanUptrendDashboard({
  data,
  loading = false,
  onTickerClick,
  onOpenFundamentals,
  onRefresh,
  compact = false
}) {
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [minVolM, setMinVolM] = useState(0.75);
  const [minMcapB, setMinMcapB] = useState(2);
  const [sortBy, setSortBy] = useState('score');
  const [viewMode, setViewMode] = useState('cards'); // 'cards' | 'table'
  const [copiedTicker, setCopiedTicker] = useState(null);

  const rawStocks = useMemo(() => {
    if (!data || !Array.isArray(data.stocks)) return [];
    return data.stocks;
  }, [data]);

  const liquidStocks = useMemo(() => {
    return rawStocks.filter((s) => {
      const mcap = Number(s?.market_cap_b || 0);
      const volM =
        s?.avg_vol_20_m !== undefined
          ? Number(s.avg_vol_20_m)
          : s?.avg_vol_20
            ? Number(s.avg_vol_20) / 1e6
            : minVolM;
      return mcap >= minMcapB && volM >= minVolM;
    });
  }, [rawStocks, minVolM, minMcapB]);

  const matchesCategory = (s, cat) => {
    if (!s) return false;
    if (cat === 'ALL') return true;
    if (cat === 'FRESH_200') return s.tier === 'FRESH_200_RESOLUTION';
    if (cat === 'STAGE2') return s.tier === 'STAGE2_IGNITION';
    if (cat === 'PULLBACK') return Boolean(s.tested_9sma_today);
    if (cat === 'RIDER_100') return Boolean(s.is_100_pct_rider);
    if (cat === 'ACCUM') return Number(s.ud_vol_ratio || 0) >= 1.5;
    return true;
  };

  const kpis = useMemo(() => {
    return {
      total: liquidStocks.length,
      tier1: liquidStocks.filter((s) => matchesCategory(s, 'FRESH_200')).length,
      tier2: liquidStocks.filter((s) => matchesCategory(s, 'STAGE2')).length,
      pullback: liquidStocks.filter((s) => matchesCategory(s, 'PULLBACK')).length,
      rider100: liquidStocks.filter((s) => matchesCategory(s, 'RIDER_100')).length,
      accum: liquidStocks.filter((s) => matchesCategory(s, 'ACCUM')).length,
      avgScore: liquidStocks.length
        ? (liquidStocks.reduce((acc, s) => acc + Number(s.score || 0), 0) / liquidStocks.length).toFixed(1)
        : '0.0'
    };
  }, [liquidStocks]);

  const filteredStocks = useMemo(() => {
    let list = [...liquidStocks];
    if (activeCategory !== 'ALL') {
      list = list.filter((s) => matchesCategory(s, activeCategory));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toUpperCase();
      list = list.filter(
        (s) =>
          (s.ticker || '').toUpperCase().includes(q) ||
          (s.name || '').toUpperCase().includes(q) ||
          (s.sector || '').toUpperCase().includes(q) ||
          (s.tier_label || '').toUpperCase().includes(q)
      );
    }

    list.sort((a, b) => {
      if (sortBy === 'score') return (b.score || 0) - (a.score || 0);
      if (sortBy === 'freshest') return (a.streak_days || 99) - (b.streak_days || 99);
      if (sortBy === 'closest_9sma') return Math.abs(a.dist_9sma_pct ?? 99) - Math.abs(b.dist_9sma_pct ?? 99);
      if (sortBy === 'avg_vol') return (b.avg_vol_20 || 0) - (a.avg_vol_20 || 0);
      if (sortBy === 'market_cap') return (b.market_cap_b || 0) - (a.market_cap_b || 0);
      if (sortBy === 'efficiency') return (b.efficiency_ratio || 0) - (a.efficiency_ratio || 0);
      return (b.score || 0) - (a.score || 0);
    });

    return list;
  }, [liquidStocks, activeCategory, searchQuery, sortBy]);

  const handleCopyTicket = (e, item) => {
    e.stopPropagation();
    const tp = item.trade_plan || {};
    const text = `[CLEAN UNTANGLED UPTREND 2.0] $${item.ticker} (${item.name || item.ticker})\nTier: ${item.tier_label} | Score: ${item.score}/100 | Cap: $${item.market_cap_b}B | Avg Vol: ${item.avg_vol_20_m}M ($${item.dollar_vol_m}M/d)\nRibbon Stack: Close $${item.close?.toFixed(2)} | 9-SMA $${item.sma9} | 13-SMA $${item.sma13} | 21-SMA $${item.sma21} | 50-SMA $${item.sma50} | 200-SMA $${item.sma200}\n9-SMA Buy Zone: $${tp.buy_zone_low || item.sma9} – $${tp.buy_zone_high || item.close}\n13-SMA Stop: $${tp.stop_loss || item.sma13} (-${tp.risk_pct || 0}%) | T1 (2R): $${tp.target_1} | T2 (3.5R): $${tp.target_2}`;
    navigator.clipboard.writeText(text);
    setCopiedTicker(item.ticker);
    setTimeout(() => setCopiedTicker(null), 1800);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: compact ? '8px' : '28px' }}>
      {/* 1. EXECUTIVE HEADER & 5-KPI STRIP */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.96), rgba(6, 36, 32, 0.85))',
          border: '1px solid rgba(16, 185, 129, 0.35)',
          borderRadius: '14px',
          padding: compact ? '16px 18px' : '20px 24px',
          boxShadow: '0 10px 28px rgba(0, 0, 0, 0.4)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '14px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
              <span
                style={{
                  background: 'linear-gradient(135deg, #10b981, #06b6d4)',
                  color: '#022c22',
                  fontWeight: 900,
                  fontSize: '0.68rem',
                  padding: '3px 9px',
                  borderRadius: '6px',
                  letterSpacing: '0.07em'
                }}
              >
                CLEAN UNTANGLED UPTREND 2.0
              </span>
              <span
                style={{
                  background: 'rgba(16, 185, 129, 0.14)',
                  color: '#34d399',
                  border: '1px solid rgba(16, 185, 129, 0.4)',
                  fontWeight: 800,
                  fontSize: '0.67rem',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  fontFamily: 'monospace'
                }}
              >
                LIQUIDITY GATE: ≥750K AVG VOL • ≥$25M/D • ≥$2B CAP • NO ETFs
              </span>
              {data?.last_updated && (
                <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontFamily: 'monospace' }}>
                  Updated: {data.last_updated} • {data?.total_scanned?.toLocaleString() || '—'} Liquid Screened
                </span>
              )}
            </div>

            <h2 style={{ margin: 0, fontSize: compact ? '1.22rem' : '1.42rem', fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '9px' }}>
              <TrendingUp size={22} color="#10b981" />
              9 / 13 / 21 / 50 SMA Untangled Bullish Ribbon Terminal
            </h2>
            <p style={{ margin: '5px 0 0 0', fontSize: '0.82rem', color: '#cbd5e1', maxWidth: '880px', lineHeight: 1.45 }}>
              Isolates institutional equities ($2B+ market cap, 750K+ avg daily shares) in strict <strong>9 &gt; 13 &gt; 21 &gt; 50 &gt; 200 SMA</strong>{' '}
              uptrends with zero 13-SMA closes, ≥75% 9-SMA respect, and Kaufman ER ≥ 0.35—split into{' '}
              <strong style={{ color: '#34d399' }}>Fresh 200-SMA Resolutions</strong> and{' '}
              <strong style={{ color: '#38bdf8' }}>Stage 2 Ribbon Ignitions</strong>.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', background: 'rgba(2, 6, 23, 0.7)', borderRadius: '8px', padding: '3px', border: '1px solid rgba(51, 65, 85, 0.6)' }}>
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '6px 11px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  background: viewMode === 'cards' ? 'rgba(16, 185, 129, 0.24)' : 'transparent',
                  color: viewMode === 'cards' ? '#34d399' : '#94a3b8'
                }}
              >
                <LayoutGrid size={14} /> Cards
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '6px 11px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  background: viewMode === 'table' ? 'rgba(16, 185, 129, 0.24)' : 'transparent',
                  color: viewMode === 'table' ? '#34d399' : '#94a3b8'
                }}
              >
                <List size={14} /> Matrix Table
              </button>
            </div>

            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                disabled={loading}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '7px',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: '1px solid rgba(16, 185, 129, 0.5)',
                  background: 'rgba(16, 185, 129, 0.16)',
                  color: '#34d399',
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  cursor: loading ? 'not-allowed' : 'pointer'
                }}
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                {loading ? 'Scanning...' : 'Refresh Scan'}
              </button>
            )}
          </div>
        </div>

        {/* 5-KPI Ribbon */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '10px',
            marginTop: '14px'
          }}
        >
          {[
            { label: 'CLEAN UPTRENDS', val: kpis.total, sub: `Avg Score ${kpis.avgScore}`, color: '#f8fafc', border: 'rgba(148,163,184,0.28)' },
            { label: 'FRESH 200-SMA BASE', val: kpis.tier1, sub: 'Tier 1 Resolution (≤45d)', color: '#10b981', border: 'rgba(16,185,129,0.4)' },
            { label: 'STAGE 2 IGNITION', val: kpis.tier2, sub: 'Tier 2 Fast Ribbon Turn', color: '#38bdf8', border: 'rgba(56,189,248,0.4)' },
            { label: '9-SMA PULLBACKS', val: kpis.pullback, sub: 'Low-Risk Support Test', color: '#fbbf24', border: 'rgba(251,191,36,0.4)' },
            { label: '100% 9-SMA RIDERS', val: kpis.rider100, sub: 'Zero 9-SMA Violations', color: '#c084fc', border: 'rgba(192,132,252,0.4)' }
          ].map((k) => (
            <div
              key={k.label}
              style={{
                background: 'rgba(2, 6, 23, 0.6)',
                border: `1px solid ${k.border}`,
                borderRadius: '10px',
                padding: '10px 12px'
              }}
            >
              <div style={{ fontSize: '0.64rem', color: '#94a3b8', fontWeight: 700, fontFamily: 'monospace' }}>{k.label}</div>
              <div style={{ fontSize: '1.35rem', fontWeight: 900, color: k.color, fontFamily: 'monospace', marginTop: 2 }}>{k.val}</div>
              <div style={{ fontSize: '0.67rem', color: '#64748b' }}>{k.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. FILTER & SORT TOOLBAR */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px',
          background: 'rgba(15, 23, 42, 0.85)',
          padding: '12px 16px',
          borderRadius: '12px',
          border: '1px solid rgba(51, 65, 85, 0.6)'
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {[
            { id: 'ALL', label: `All Liquid (${kpis.total})` },
            { id: 'FRESH_200', label: `🚀 Fresh 200-SMA Base (${kpis.tier1})` },
            { id: 'STAGE2', label: `⚡ Stage 2 Ignition (${kpis.tier2})` },
            { id: 'PULLBACK', label: `🎯 9-SMA Pullback (${kpis.pullback})` },
            { id: 'RIDER_100', label: `🏄 100% 9-SMA Rider (${kpis.rider100})` },
            { id: 'ACCUM', label: `🔥 Accumulation U/D≥1.5x (${kpis.accum})` }
          ].map((tab) => {
            const active = activeCategory === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveCategory(tab.id)}
                style={{
                  padding: '6px 11px',
                  borderRadius: '8px',
                  border: active ? '1px solid #10b981' : '1px solid rgba(71, 85, 105, 0.45)',
                  background: active ? 'rgba(16, 185, 129, 0.2)' : 'rgba(2, 6, 23, 0.5)',
                  color: active ? '#6ee7b7' : '#cbd5e1',
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

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} color="#64748b" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Search ticker, name, sector..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                padding: '7px 12px 7px 30px',
                borderRadius: '8px',
                border: '1px solid rgba(71, 85, 105, 0.6)',
                background: 'rgba(2, 6, 23, 0.75)',
                color: '#f8fafc',
                fontSize: '0.76rem',
                width: '195px'
              }}
            />
          </div>

          <select
            value={minVolM}
            onChange={(e) => setMinVolM(Number(e.target.value))}
            style={{
              padding: '7px 10px',
              borderRadius: '8px',
              border: '1px solid rgba(16, 185, 129, 0.45)',
              background: 'rgba(2, 6, 23, 0.8)',
              color: '#34d399',
              fontSize: '0.76rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            <option value={0.75}>Vol: ≥ 750K/d</option>
            <option value={1}>Vol: ≥ 1.0M/d</option>
            <option value={2}>Vol: ≥ 2.0M/d</option>
            <option value={5}>Vol: ≥ 5.0M/d</option>
          </select>

          <select
            value={minMcapB}
            onChange={(e) => setMinMcapB(Number(e.target.value))}
            style={{
              padding: '7px 10px',
              borderRadius: '8px',
              border: '1px solid rgba(56, 189, 248, 0.45)',
              background: 'rgba(2, 6, 23, 0.8)',
              color: '#7dd3fc',
              fontSize: '0.76rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            <option value={2}>Cap: ≥ $2B</option>
            <option value={10}>Cap: ≥ $10B</option>
            <option value={50}>Cap: ≥ $50B</option>
            <option value={100}>Cap: ≥ $100B</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={{
              padding: '7px 12px',
              borderRadius: '8px',
              border: '1px solid rgba(71, 85, 105, 0.6)',
              background: 'rgba(2, 6, 23, 0.75)',
              color: '#e2e8f0',
              fontSize: '0.76rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <option value="score">Sort: Ribbon Score</option>
            <option value="freshest">Sort: Freshest Inception</option>
            <option value="closest_9sma">Sort: Closest to 9-SMA</option>
            <option value="avg_vol">Sort: Highest 20D Volume</option>
            <option value="market_cap">Sort: Largest Market Cap</option>
            <option value="efficiency">Sort: Highest Efficiency (ER)</option>
          </select>
        </div>
      </div>

      {/* 3. RESULTS: CARDS GRID OR MATRIX TABLE */}
      {filteredStocks.length === 0 ? (
        <div
          style={{
            background: 'rgba(15, 23, 42, 0.7)',
            border: '1px solid rgba(51, 65, 85, 0.5)',
            borderRadius: '12px',
            padding: '42px 24px',
            textAlign: 'center',
            color: '#94a3b8'
          }}
        >
          No liquid ≥$2B Clean Untangled Uptrend setups match the active filters.
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
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.76rem', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(71, 85, 105, 0.6)', background: 'rgba(2, 6, 23, 0.78)', color: '#94a3b8', fontSize: '0.67rem', textTransform: 'uppercase' }}>
                <th style={{ padding: '11px 14px' }}>Ticker / Sector</th>
                <th style={{ padding: '11px 10px' }}>Tier</th>
                <th style={{ padding: '11px 10px' }}>Price / 1D</th>
                <th style={{ padding: '11px 10px' }}>Cap / Avg Vol</th>
                <th style={{ padding: '11px 10px' }}>Score</th>
                <th style={{ padding: '11px 10px' }}>Streak / Start</th>
                <th style={{ padding: '11px 10px' }}>9 / 50 / 200 SMA</th>
                <th style={{ padding: '11px 10px' }}>Respect / ER</th>
                <th style={{ padding: '11px 10px' }}>U/D Vol</th>
                <th style={{ padding: '11px 14px' }}>Buy Zone / 13-SMA Stop</th>
              </tr>
            </thead>
            <tbody>
              {filteredStocks.map((item) => {
                const tp = item.trade_plan || {};
                return (
                  <tr
                    key={item.ticker}
                    onClick={() => onTickerClick && onTickerClick(item.ticker)}
                    style={{ borderBottom: '1px solid rgba(51, 65, 85, 0.35)', cursor: 'pointer' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(30, 41, 59, 0.6)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ fontWeight: 900, color: '#f8fafc', fontFamily: 'monospace', fontSize: '0.86rem' }}>${item.ticker}</div>
                      <div style={{ fontSize: '0.66rem', color: '#94a3b8' }}>
                        {item.name} • <span style={{ color: '#64748b' }}>{item.sector}</span>
                      </div>
                    </td>
                    <td style={{ padding: '10px' }}>
                      <span
                        style={{
                          padding: '2px 7px',
                          borderRadius: '5px',
                          fontSize: '0.66rem',
                          fontWeight: 800,
                          color: item.tier_color || '#34d399',
                          background: `${item.tier_color || '#10b981'}20`,
                          border: `1px solid ${item.tier_color || '#10b981'}55`,
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {item.tier_label}
                      </span>
                    </td>
                    <td style={{ padding: '10px', fontFamily: 'monospace' }}>
                      <div style={{ fontWeight: 800, color: '#e2e8f0' }}>${item.close?.toFixed(2)}</div>
                      <div style={{ fontSize: '0.68rem', color: (item.change_pct || 0) >= 0 ? '#10b981' : '#f43f5e' }}>
                        {(item.change_pct || 0) >= 0 ? '+' : ''}
                        {(item.change_pct || 0).toFixed(2)}%
                      </div>
                    </td>
                    <td style={{ padding: '10px', fontFamily: 'monospace', fontSize: '0.72rem' }}>
                      <div style={{ fontWeight: 700, color: '#7dd3fc' }}>${item.market_cap_b}B</div>
                      <div style={{ fontSize: '0.66rem', color: '#34d399' }}>
                        {item.avg_vol_20_m?.toFixed(2)}M (${item.dollar_vol_m}M/d)
                      </div>
                    </td>
                    <td style={{ padding: '10px', fontFamily: 'monospace', fontWeight: 900, color: '#34d399' }}>
                      {item.score}/100
                    </td>
                    <td style={{ padding: '10px', fontFamily: 'monospace' }}>
                      <div style={{ fontWeight: 700, color: '#e2e8f0' }}>{item.streak_days}d</div>
                      <div style={{ fontSize: '0.65rem', color: '#64748b' }}>{item.trend_start_date}</div>
                    </td>
                    <td style={{ padding: '10px', fontFamily: 'monospace', fontSize: '0.7rem' }}>
                      <span style={{ color: '#38bdf8' }}>{item.dist_9sma_pct > 0 ? '+' : ''}{item.dist_9sma_pct}%</span>
                      {' / '}
                      <span style={{ color: '#cbd5e1' }}>+{item.dist_50sma_pct}%</span>
                      {' / '}
                      <span style={{ color: '#10b981' }}>+{item.dist_200sma_pct}%</span>
                    </td>
                    <td style={{ padding: '10px', fontFamily: 'monospace' }}>
                      <div><strong style={{ color: '#c084fc' }}>{item.respect_9sma_pct}%</strong></div>
                      <div style={{ fontSize: '0.66rem', color: '#94a3b8' }}>ER {item.efficiency_ratio}</div>
                    </td>
                    <td style={{ padding: '10px', fontFamily: 'monospace', fontWeight: 800, color: (item.ud_vol_ratio || 1) >= 1.5 ? '#10b981' : '#e2e8f0' }}>
                      {item.ud_vol_ratio}x
                    </td>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: '0.7rem' }}>
                      <div style={{ color: '#38bdf8', fontWeight: 700 }}>${tp.buy_zone_low}–${tp.buy_zone_high}</div>
                      <div style={{ color: '#f43f5e', fontSize: '0.66rem' }}>SL ${tp.stop_loss} (-{tp.risk_pct}%)</div>
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
            gridTemplateColumns: 'repeat(auto-fill, minmax(385px, 1fr))',
            gap: '16px'
          }}
        >
          {filteredStocks.map((item) => {
            const tp = item.trade_plan || {};
            const isTier1 = item.tier === 'FRESH_200_RESOLUTION';
            const tierColor = item.tier_color || (isTier1 ? '#10b981' : '#38bdf8');
            return (
              <div
                key={item.ticker}
                onClick={() => onTickerClick && onTickerClick(item.ticker)}
                style={{
                  background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.95), rgba(9, 14, 28, 0.98))',
                  border: `1px solid ${isTier1 ? 'rgba(16, 185, 129, 0.5)' : 'rgba(56, 189, 248, 0.4)'}`,
                  borderRadius: '14px',
                  padding: '15px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '11px',
                  cursor: 'pointer',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)'
                }}
              >
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '1.28rem', fontWeight: 900, color: '#f8fafc', fontFamily: 'monospace' }}>${item.ticker}</span>
                      <span
                        style={{
                          padding: '2px 7px',
                          borderRadius: '5px',
                          fontSize: '0.67rem',
                          fontWeight: 800,
                          color: tierColor,
                          background: `${tierColor}20`,
                          border: `1px solid ${tierColor}55`
                        }}
                      >
                        {item.tier_label}
                      </span>
                      <span
                        style={{
                          padding: '2px 7px',
                          borderRadius: '5px',
                          fontSize: '0.67rem',
                          fontWeight: 800,
                          background: 'rgba(16, 185, 129, 0.18)',
                          color: '#34d399',
                          border: '1px solid rgba(16, 185, 129, 0.45)',
                          fontFamily: 'monospace'
                        }}
                      >
                        {item.score}/100
                      </span>
                    </div>
                    <div style={{ fontSize: '0.73rem', color: '#94a3b8', marginTop: '3px' }}>
                      {item.name} • <span style={{ color: '#64748b' }}>{item.sector}</span> • Cap <strong style={{ color: '#7dd3fc' }}>${item.market_cap_b}B</strong> • Vol{' '}
                      <strong style={{ color: '#34d399' }}>{item.avg_vol_20_m?.toFixed(2)}M</strong> (${item.dollar_vol_m}M/d)
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', fontFamily: 'monospace', shrink: 0 }}>
                    <div style={{ fontSize: '1.18rem', fontWeight: 800, color: '#f8fafc' }}>${item.close?.toFixed(2)}</div>
                    <div style={{ fontSize: '0.74rem', fontWeight: 700, color: (item.change_pct || 0) >= 0 ? '#10b981' : '#f43f5e' }}>
                      {(item.change_pct || 0) >= 0 ? '+' : ''}
                      {(item.change_pct || 0).toFixed(2)}%
                    </div>
                  </div>
                </div>

                {/* 30D Untangled SMA Ribbon Sparkline */}
                <RibbonSparkline sparkline={item.sparkline} ticker={item.ticker} height={82} />

                {/* Visual SMA Hierarchy Strip */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(5, 1fr)',
                    gap: '4px',
                    background: 'rgba(2, 6, 23, 0.55)',
                    padding: '6px 8px',
                    borderRadius: '8px',
                    border: '1px solid rgba(51, 65, 85, 0.45)',
                    fontFamily: 'monospace',
                    fontSize: '0.66rem',
                    textAlign: 'center'
                  }}
                >
                  <div>
                    <div style={{ color: '#38bdf8', fontWeight: 700 }}>9-SMA</div>
                    <div style={{ color: '#e2e8f0', fontWeight: 800 }}>${item.sma9}</div>
                    <div style={{ color: '#38bdf8', fontSize: '0.58rem' }}>{item.dist_9sma_pct > 0 ? '+' : ''}{item.dist_9sma_pct}%</div>
                  </div>
                  <div>
                    <div style={{ color: '#fbbf24', fontWeight: 700 }}>13-SMA</div>
                    <div style={{ color: '#e2e8f0', fontWeight: 800 }}>${item.sma13}</div>
                    <div style={{ color: '#94a3b8', fontSize: '0.58rem' }}>Floor</div>
                  </div>
                  <div>
                    <div style={{ color: '#a855f7', fontWeight: 700 }}>21-SMA</div>
                    <div style={{ color: '#e2e8f0', fontWeight: 800 }}>${item.sma21}</div>
                    <div style={{ color: '#94a3b8', fontSize: '0.58rem' }}>Core</div>
                  </div>
                  <div>
                    <div style={{ color: '#f43f5e', fontWeight: 700 }}>50-SMA</div>
                    <div style={{ color: '#e2e8f0', fontWeight: 800 }}>${item.sma50}</div>
                    <div style={{ color: '#cbd5e1', fontSize: '0.58rem' }}>+{item.dist_50sma_pct}%</div>
                  </div>
                  <div>
                    <div style={{ color: '#10b981', fontWeight: 700 }}>200-SMA</div>
                    <div style={{ color: '#e2e8f0', fontWeight: 800 }}>${item.sma200}</div>
                    <div style={{ color: '#10b981', fontSize: '0.58rem' }}>+{item.dist_200sma_pct}%</div>
                  </div>
                </div>

                {/* 4-Metric Ribbon Quality Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', fontFamily: 'monospace' }}>
                  <div style={{ background: 'rgba(15, 23, 42, 0.8)', padding: '6px 8px', borderRadius: '6px', border: '1px solid rgba(51,65,85,0.4)' }}>
                    <div style={{ fontSize: '0.57rem', color: '#94a3b8' }}>RIBBON STREAK</div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#34d399' }}>{item.streak_days}d</div>
                  </div>
                  <div style={{ background: 'rgba(15, 23, 42, 0.8)', padding: '6px 8px', borderRadius: '6px', border: '1px solid rgba(51,65,85,0.4)' }}>
                    <div style={{ fontSize: '0.57rem', color: '#94a3b8' }}>9-SMA RESPECT</div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#c084fc' }}>{item.respect_9sma_pct}%</div>
                  </div>
                  <div style={{ background: 'rgba(15, 23, 42, 0.8)', padding: '6px 8px', borderRadius: '6px', border: '1px solid rgba(51,65,85,0.4)' }}>
                    <div style={{ fontSize: '0.57rem', color: '#94a3b8' }}>EFFICIENCY</div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#38bdf8' }}>{item.efficiency_ratio} ER</div>
                  </div>
                  <div style={{ background: 'rgba(15, 23, 42, 0.8)', padding: '6px 8px', borderRadius: '6px', border: '1px solid rgba(51,65,85,0.4)' }}>
                    <div style={{ fontSize: '0.57rem', color: '#94a3b8' }}>U/D VOL</div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 800, color: (item.ud_vol_ratio || 1) >= 1.5 ? '#10b981' : '#e2e8f0' }}>{item.ud_vol_ratio}x</div>
                  </div>
                </div>

                {/* Execution Ticket */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: '6px',
                    background: 'rgba(2, 6, 23, 0.65)',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: '1px solid rgba(51, 65, 85, 0.5)',
                    fontFamily: 'monospace'
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.57rem', color: '#94a3b8' }}>9-SMA BUY ZONE</div>
                    <div style={{ fontSize: '0.73rem', fontWeight: 800, color: '#38bdf8' }}>${tp.buy_zone_low}–${tp.buy_zone_high}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.57rem', color: '#94a3b8' }}>13-SMA STOP</div>
                    <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#f43f5e' }}>${tp.stop_loss} (-{tp.risk_pct}%)</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.57rem', color: '#94a3b8' }}>TARGET 1 (2R)</div>
                    <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#10b981' }}>${tp.target_1}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.57rem', color: '#94a3b8' }}>TARGET 2 (3.5R)</div>
                    <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#fbbf24' }}>${tp.target_2}</div>
                  </div>
                </div>

                {/* Badges + Actions */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap', paddingTop: 2 }}>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {(item.badges || []).slice(1, 4).map((b, i) => (
                      <span
                        key={i}
                        style={{
                          fontSize: '0.62rem',
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: 'rgba(30, 41, 59, 0.85)',
                          color: '#cbd5e1',
                          border: '1px solid rgba(71, 85, 105, 0.45)'
                        }}
                      >
                        {b}
                      </span>
                    ))}
                  </div>

                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={(e) => handleCopyTicket(e, item)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '4px 8px',
                        borderRadius: '6px',
                        border: '1px solid rgba(148,163,184,0.35)',
                        background: 'rgba(15,23,42,0.8)',
                        color: copiedTicker === item.ticker ? '#10b981' : '#cbd5e1',
                        fontSize: '0.67rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      {copiedTicker === item.ticker ? <Check size={11} /> : <Copy size={11} />}
                      {copiedTicker === item.ticker ? 'Copied' : 'Ticket'}
                    </button>
                    {onOpenFundamentals && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenFundamentals(item.ticker);
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '4px 8px',
                          borderRadius: '6px',
                          border: '1px solid rgba(56,189,248,0.4)',
                          background: 'rgba(56,189,248,0.12)',
                          color: '#7dd3fc',
                          fontSize: '0.67rem',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        <Layers size={11} /> Fundamentals
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
