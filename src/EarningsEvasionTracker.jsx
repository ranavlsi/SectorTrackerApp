import React, { useState, useEffect, useMemo } from 'react';
import {
  Loader2, Calendar, Target, Crosshair, BarChart2, Search,
  Activity, TrendingUp, Zap, Sparkles, CheckCircle,
  ArrowUpRight, ArrowDownRight, Compass, Sun, Snowflake,
  Shield, Layers, Flame, ExternalLink, Award, Filter
} from 'lucide-react';

/**
 * 30-Day Price + EMA10/21 + Gold RS Line vs SPY Sparkline SVG
 */
const PreEarningsSparkline = ({ sparkline, pivotPrice, currentPrice }) => {
  if (!sparkline || !Array.isArray(sparkline.close) || sparkline.close.length < 5) {
    return (
      <div style={{ height: '115px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '0.78rem' }}>
        30D Price & RS Sparkline unavailable
      </div>
    );
  }

  const width = 460;
  const height = 115;
  const padX = 10;
  const padY = 12;

  const closes = sparkline.close;
  const ema10 = sparkline.ema10 || [];
  const ema21 = sparkline.ema21 || [];
  const rsNorm = sparkline.rs_norm || [];

  const allVals = [
    ...closes,
    ...ema10,
    ...ema21,
    ...rsNorm,
    ...(pivotPrice && pivotPrice > 0 ? [pivotPrice] : [])
  ].filter(v => typeof v === 'number' && !isNaN(v));

  const minVal = Math.min(...allVals);
  const maxVal = Math.max(...allVals);
  const span = maxVal - minVal || 1;

  const toX = (i, len) => padX + (i / Math.max(1, len - 1)) * (width - padX * 2);
  const toY = (v) => height - padY - ((v - minVal) / span) * (height - padY * 2);

  const buildPath = (arr) => {
    if (!arr || arr.length < 2) return '';
    return arr
      .map((v, i) => `${i === 0 ? 'M' : 'L'}${toX(i, arr.length).toFixed(1)},${toY(v).toFixed(1)}`)
      .join(' ');
  };

  const closePath = buildPath(closes);
  const ema10Path = buildPath(ema10);
  const ema21Path = buildPath(ema21);
  const rsPath = buildPath(rsNorm);

  const isUp30d = closes[closes.length - 1] >= closes[0];
  const priceStroke = isUp30d ? '#10b981' : '#f43f5e';
  const areaFillId = `earnSparkGrad_${Math.round((currentPrice || 100) * 10)}`;

  const areaPath = closePath
    ? `${closePath} L${toX(closes.length - 1, closes.length).toFixed(1)},${height - padY} L${padX},${height - padY} Z`
    : '';

  const pivotY = pivotPrice && pivotPrice >= minVal && pivotPrice <= maxVal ? toY(pivotPrice) : null;

  return (
    <div style={{ position: 'relative', background: 'rgba(2, 6, 23, 0.55)', borderRadius: '8px', padding: '0.5rem 0.65rem', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', fontSize: '0.68rem', color: '#94a3b8' }}>
        <span style={{ fontWeight: 700, color: '#cbd5e1' }}>30D PRE-PRINT TRAJECTORY & RS LINE</span>
        <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center' }}>
          <span style={{ color: priceStroke, fontWeight: 700 }}>● Price</span>
          <span style={{ color: '#38bdf8' }}>― 10EMA</span>
          <span style={{ color: '#a855f7' }}>― 21EMA</span>
          <span style={{ color: '#fbbf24', fontWeight: 700 }}>╌ RS vs SPY</span>
        </div>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: '105px', overflow: 'visible' }}>
        <defs>
          <linearGradient id={areaFillId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={priceStroke} stopOpacity="0.28" />
            <stop offset="100%" stopColor={priceStroke} stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {areaPath && <path d={areaPath} fill={`url(#${areaFillId})`} />}

        {pivotY !== null && (
          <g>
            <line
              x1={padX}
              y1={pivotY}
              x2={width - padX}
              y2={pivotY}
              stroke="#10b981"
              strokeWidth="1.2"
              strokeDasharray="4 3"
              opacity="0.75"
            />
            <text
              x={width - padX - 4}
              y={Math.max(11, pivotY - 4)}
              fill="#10b981"
              fontSize="9"
              fontWeight="700"
              textAnchor="end"
            >
              MS Pivot ${pivotPrice}
            </text>
          </g>
        )}

        {ema21Path && <path d={ema21Path} fill="none" stroke="#a855f7" strokeWidth="1.3" opacity="0.8" />}
        {ema10Path && <path d={ema10Path} fill="none" stroke="#38bdf8" strokeWidth="1.3" opacity="0.85" />}
        {rsPath && (
          <path
            d={rsPath}
            fill="none"
            stroke="#fbbf24"
            strokeWidth="1.6"
            strokeDasharray="3 2"
            opacity="0.95"
          />
        )}
        {closePath && <path d={closePath} fill="none" stroke={priceStroke} strokeWidth="2.2" />}

        {closes.length > 0 && (
          <circle
            cx={toX(closes.length - 1, closes.length)}
            cy={toY(closes[closes.length - 1])}
            r="3.8"
            fill={priceStroke}
            stroke="#0f172a"
            strokeWidth="1.5"
          />
        )}
      </svg>
    </div>
  );
};

const EarningsDashboard = ({ initialTicker, ticker, onSelectTicker, onOpenFundamentals }) => {
  const defaultSymbol = (initialTicker || ticker || 'NVDA').toUpperCase();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicker, setSelectedTicker] = useState(defaultSymbol);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('PEDP');

  useEffect(() => {
    const target = (initialTicker || ticker || '').toUpperCase();
    if (target) {
      setSelectedTicker(target);
    }
  }, [initialTicker, ticker]);

  useEffect(() => {
    fetch('/earnings_data.json?t=' + new Date().getTime())
      .then(res => res.json())
      .then(d => {
        if (Array.isArray(d) && d.length > 0) {
          setData(d);
          const initSym = (initialTicker || ticker || '').toUpperCase();
          const hasInit = initSym && d.some(item => item.ticker === initSym);
          if (hasInit) {
            setSelectedTicker(initSym);
          } else {
            setSelectedTicker(d[0].ticker);
          }
        }
        setLoading(false);
      })
      .catch(e => {
        console.error("Failed to load earnings data", e);
        setLoading(false);
      });
  }, []);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery) return;
    const symbol = searchQuery.toUpperCase().trim();

    const existing = data.find(d => d.ticker === symbol);
    if (existing) {
      setSelectedTicker(symbol);
      setSearchQuery('');
      return;
    }

    setSearchLoading(true);
    try {
      const res = await fetch(`/api/analyze_earnings?ticker=${symbol}`);
      const newStockData = await res.json();

      if (newStockData.error) {
        alert("Error analyzing stock: " + newStockData.error);
      } else {
        setData(prev => [newStockData, ...prev.filter(x => x.ticker !== symbol)]);
        setSelectedTicker(symbol);
      }
    } catch (err) {
      alert("Failed to reach API server. Ensure backend is active.");
    }
    setSearchLoading(false);
    setSearchQuery('');
  };

  const filteredAndSortedList = useMemo(() => {
    let list = [...data];
    if (activeFilter === 'A_PLUS') {
      list = list.filter(s => (s.ai_intelligence?.pedp_score || 0) >= 75);
    } else if (activeFilter === 'COILED') {
      list = list.filter(s => s.pre_earnings_30d?.runup_state === 'COILED_ACCUMULATION');
    } else if (activeFilter === 'CHEAP_IV') {
      list = list.filter(s =>
        (s.volatility_crush_intel?.implied_vs_hist_ratio || 1) <= 1.0 ||
        s.personality?.volatility_verdict === 'UNDERPRICED_IV'
      );
    } else if (activeFilter === 'CRUSH_RISK') {
      list = list.filter(s =>
        (s.volatility_crush_intel?.implied_vs_hist_ratio || 1) >= 1.25 ||
        s.personality?.volatility_verdict === 'OVERPRICED_IV'
      );
    } else if (activeFilter === 'RS_LEADERS') {
      list = list.filter(s =>
        (s.rs_and_confluence?.rs_rating || 0) >= 85 ||
        s.rs_and_confluence?.is_blue_dot
      );
    }

    list.sort((a, b) => {
      if (sortBy === 'IMPLIED_MOVE') {
        return (b.volatility_crush_intel?.implied_move_pct || b.options_data?.implied_move_pct || 0) -
               (a.volatility_crush_intel?.implied_move_pct || a.options_data?.implied_move_pct || 0);
      }
      if (sortBy === 'ALPHA_30D') {
        return (b.pre_earnings_30d?.alpha_30d_pct || 0) - (a.pre_earnings_30d?.alpha_30d_pct || 0);
      }
      if (sortBy === 'RS') {
        return (b.rs_and_confluence?.rs_rating || 0) - (a.rs_and_confluence?.rs_rating || 0);
      }
      return (b.ai_intelligence?.pedp_score || 50) - (a.ai_intelligence?.pedp_score || 50);
    });

    return list;
  }, [data, activeFilter, sortBy]);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '1rem' }}>
        <Loader2 className="spin" size={36} color="#3b82f6" />
        <span style={{ color: '#94a3b8', fontSize: '0.95rem' }}>Loading Institutional AI Earnings Intelligence 3.0...</span>
      </div>
    );
  }

  const selectedStock = data.find(d => d.ticker === selectedTicker) || filteredAndSortedList[0] || data[0];

  if (!selectedStock) {
    return <div style={{ color: 'white', padding: '2rem' }}>No earnings intelligence data found.</div>;
  }

  const ai = selectedStock.ai_intelligence || {
    pedp_score: 50,
    setup_tier: 'B',
    setup_name: 'EARNINGS CONSOLIDATION',
    badge_color: '#eab308',
    action_verdict: 'Consolidating post earnings. Wait for high-volume follow through.',
    catalysts: []
  };

  const personality = selectedStock.personality || {
    beat_rate_pct: 0,
    gap_and_go_pct: 50,
    gap_and_fade_pct: 50,
    avg_abs_move_pct: 0,
    avg_5d_drift_pct: 0,
    avg_20d_drift_pct: 0,
    volatility_verdict: 'IN-LINE'
  };

  const revisions = selectedStock.consensus_revisions || {
    up_7d: 0, down_7d: 0, up_30d: 0, down_30d: 0,
    current_q_eps_est: 0, prev_30d_eps_est: 0,
    revenue_growth_est: 0, next_q_growth_est: 0,
    eps_revision_pct_30d: 0
  };

  const pre30d = selectedStock.pre_earnings_30d || {
    return_5d_pct: 0,
    return_10d_pct: 0,
    return_30d_pct: 0,
    alpha_30d_pct: 0,
    up_days_30d: 15,
    down_days_30d: 15,
    ud_vol_ratio_30d: 1.0,
    pocket_pivots_10d: 0,
    vdu_days_10d: 0,
    dist_from_21ema_pct: 0,
    runup_state: 'CONSTRUCTIVE_BASE',
    runup_badge: '⚖️ ORDERLY PRE-PRINT BASE',
    runup_color: '#3b82f6',
    runup_verdict: 'Orderly 30D positioning into print.',
    sparkline: { close: [], ema10: [], ema21: [], rs_norm: [] }
  };

  const volIntel = selectedStock.volatility_crush_intel || {
    hv_10d: 25,
    hv_30d: 28,
    hv_compression_ratio: 0.89,
    atm_iv_30d: 35,
    iv_rank: 50,
    vrp_spread: 7,
    implied_move_pct: selectedStock.options_data?.implied_move_pct || 5.0,
    implied_move_usd: selectedStock.options_data?.implied_move_usd || 0,
    avg_abs_move_pct: personality.avg_abs_move_pct || 4.5,
    implied_vs_hist_ratio: 1.0,
    expected_iv_crush_pct: -25.0,
    upper_breakeven: 0,
    lower_breakeven: 0,
    call_vol_pct: 55,
    opt_vol_ratio: 1.2,
    whale_sweep: false,
    skew_state: 'BALANCED FLOW',
    pre_earnings_options_play: 'Defined-Risk Bull Call Spread',
    post_earnings_pead_play: 'Buy Day-1 15-min Opening Range Breakout (ORB) on >1.8x volume'
  };

  const rsConf = selectedStock.rs_and_confluence || {
    rs_rating: 75,
    is_blue_dot: false,
    rs_badge: 'RS 75',
    marketsurge_pattern: 'Consolidation Base',
    marketsurge_buy_point: selectedStock.current_price,
    distance_to_pivot_pct: 0,
    converged_engines: [],
    confluence_count: 0,
    pead_execution_plan: {
      entry_pivot: selectedStock.current_price,
      orb_trigger_rule: '15-Min Opening Range High + VWAP Hold on >1.8x RVOL',
      gap_stop_loss: +(selectedStock.current_price * 0.955).toFixed(2),
      stop_pct: 4.5,
      target_1_5d: +(selectedStock.current_price * 1.06).toFixed(2),
      target_2_20d: +(selectedStock.current_price * 1.14).toFixed(2),
      reward_risk: '3.1:1'
    }
  };

  const sixDomain = selectedStock.six_domain_matrix || {
    gates: [],
    pass_count: 4,
    veto_count: 0,
    summary_badge: '4/6 GATES PASSED'
  };

  const options = selectedStock.options_data;
  const reactions = selectedStock.historical_reactions || [];
  const inst = selectedStock.institutional || {};
  const seasonality = selectedStock.seasonality;
  const peadPlan = rsConf.pead_execution_plan || {};

  return (
    <div style={{ display: 'flex', gap: '1.25rem', minHeight: '86vh', color: '#e2e8f0' }}>

      {/* LEFT SIDEBAR: Institutional Leader Radar, Filters & Sort */}
      <div
        className="glass-card"
        style={{
          width: '340px',
          minWidth: '320px',
          display: 'flex',
          flexDirection: 'column',
          padding: '1.1rem',
          maxHeight: '90vh',
          background: 'rgba(15, 23, 42, 0.82)',
          border: '1px solid rgba(255,255,255,0.08)'
        }}
      >
        {/* On-Demand Search Bar */}
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.45rem', marginBottom: '0.85rem' }}>
          <input
            type="text"
            placeholder="Live Earnings Scan (e.g. NVDA,LLY)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: 1,
              padding: '0.55rem 0.75rem',
              borderRadius: '8px',
              border: '1px solid #334155',
              background: 'rgba(2, 6, 23, 0.65)',
              color: 'white',
              fontSize: '0.82rem'
            }}
          />
          <button
            type="submit"
            disabled={searchLoading}
            style={{
              padding: '0.55rem 0.75rem',
              background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
              borderRadius: '8px',
              border: 'none',
              color: 'white',
              cursor: searchLoading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: '700'
            }}
          >
            {searchLoading ? <Loader2 size={15} className="spin" /> : <Search size={15} />}
          </button>
        </form>

        {/* Quick Filter Pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.75rem' }}>
          {[
            { id: 'ALL', label: `All (${data.length})` },
            { id: 'A_PLUS', label: '🔥 A+ PEAD' },
            { id: 'COILED', label: '⚡ Coiled 30D' },
            { id: 'CHEAP_IV', label: '💎 Cheap IV' },
            { id: 'CRUSH_RISK', label: '⚠️ IV Crush' },
            { id: 'RS_LEADERS', label: '🔵 RS 85+' }
          ].map(tab => {
            const active = activeFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveFilter(tab.id)}
                style={{
                  padding: '0.28rem 0.55rem',
                  fontSize: '0.7rem',
                  fontWeight: active ? '700' : '600',
                  borderRadius: '6px',
                  border: `1px solid ${active ? '#3b82f6' : 'rgba(255,255,255,0.08)'}`,
                  background: active ? 'rgba(59, 130, 246, 0.22)' : 'rgba(255,255,255,0.03)',
                  color: active ? '#60a5fa' : '#94a3b8',
                  cursor: 'pointer'
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Radar Header + Sort Selector */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
          <h4 style={{ margin: 0, color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.86rem' }}>
            <Calendar size={14} /> AI Earnings Radar ({filteredAndSortedList.length})
          </h4>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={{
              background: 'rgba(2, 6, 23, 0.7)',
              color: '#cbd5e1',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '5px',
              padding: '0.2rem 0.4rem',
              fontSize: '0.7rem'
            }}
          >
            <option value="PEDP">Sort: PEDP Score</option>
            <option value="IMPLIED_MOVE">Sort: Implied ±%</option>
            <option value="ALPHA_30D">Sort: 30D Alpha</option>
            <option value="RS">Sort: RS Rating</option>
          </select>
        </div>

        {/* Watchlist Items */}
        <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.45rem', paddingRight: '0.25rem' }}>
          {filteredAndSortedList.map(stock => {
            const isSelected = selectedStock.ticker === stock.ticker;
            const stockScore = stock.ai_intelligence?.pedp_score ?? 50;
            const scoreColor = stockScore >= 75 ? '#10b981' : stockScore >= 60 ? '#3b82f6' : stockScore >= 45 ? '#eab308' : '#ef4444';
            const ret30 = stock.pre_earnings_30d?.return_30d_pct ?? 0;
            const rsRating = stock.rs_and_confluence?.rs_rating ?? 70;
            const isBlueDot = stock.rs_and_confluence?.is_blue_dot;
            const impMove = stock.volatility_crush_intel?.implied_move_pct ?? stock.options_data?.implied_move_pct ?? 0;

            return (
              <div
                key={stock.ticker}
                onClick={() => setSelectedTicker(stock.ticker)}
                style={{
                  padding: '0.65rem 0.75rem',
                  background: isSelected ? 'rgba(59, 130, 246, 0.18)' : 'rgba(255,255,255,0.025)',
                  border: `1px solid ${isSelected ? '#3b82f6' : 'rgba(255,255,255,0.05)'}`,
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  transition: 'all 0.15s ease'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <strong style={{ color: 'white', fontSize: '0.92rem' }}>{stock.ticker}</strong>
                    <span style={{ fontSize: '0.76rem', color: '#cbd5e1', fontFamily: 'monospace' }}>${stock.current_price}</span>
                    <span
                      style={{
                        fontSize: '0.64rem',
                        padding: '1px 5px',
                        borderRadius: '4px',
                        background: isBlueDot ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255,255,255,0.06)',
                        color: isBlueDot ? '#38bdf8' : '#94a3b8',
                        fontWeight: 700
                      }}
                    >
                      {isBlueDot ? '🔵 ' : ''}RS {rsRating}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '3px', fontSize: '0.7rem' }}>
                    <span style={{ color: '#64748b' }}>
                      {stock.next_earnings_date !== 'Unknown' ? stock.next_earnings_date : 'TBD'}
                    </span>
                    <span style={{ color: ret30 >= 0 ? '#10b981' : '#f43f5e', fontWeight: 600 }}>
                      30D: {ret30 >= 0 ? `+${ret30}%` : `${ret30}%`}
                    </span>
                    {impMove > 0 && (
                      <span style={{ color: '#fbbf24' }}>±{impMove}%</span>
                    )}
                  </div>
                </div>

                <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                  <span
                    style={{
                      fontSize: '0.73rem',
                      fontWeight: '800',
                      color: scoreColor,
                      background: `${scoreColor}22`,
                      border: `1px solid ${scoreColor}44`,
                      padding: '0.12rem 0.45rem',
                      borderRadius: '4px'
                    }}
                  >
                    PEDP {stockScore}
                  </span>
                  <span style={{ fontSize: '0.66rem', color: '#94a3b8', marginTop: '2px' }}>
                    {stock.ai_intelligence?.setup_tier || 'B'} Tier • {stock.six_domain_matrix?.pass_count ?? 4}/6 Gates
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* MAIN INTELLIGENCE TERMINAL */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1.15rem', overflowY: 'auto', paddingRight: '0.25rem' }}>

        {/* EXECUTIVE HEADER BAR: Ticker, Clubbed Badges, PEDP Gauge, Deep Chart Action */}
        <div
          className="glass-card"
          style={{
            padding: '1.25rem 1.4rem',
            background: 'linear-gradient(135deg, rgba(15,23,42,0.92) 0%, rgba(30,41,59,0.78) 100%)',
            borderLeft: `5px solid ${ai.badge_color || '#3b82f6'}`
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap', marginBottom: '0.4rem' }}>
                <h2 style={{ margin: 0, fontSize: '1.85rem', color: 'white', fontWeight: '800', letterSpacing: '-0.02em' }}>
                  {selectedStock.ticker}
                </h2>
                <span style={{ color: '#e2e8f0', fontSize: '1.2rem', fontWeight: 700, fontFamily: 'monospace' }}>
                  ${selectedStock.current_price}
                </span>

                {/* Setup Name Badge */}
                <span
                  style={{
                    background: `${ai.badge_color}25`,
                    color: ai.badge_color,
                    border: `1px solid ${ai.badge_color}55`,
                    padding: '0.22rem 0.6rem',
                    borderRadius: '6px',
                    fontSize: '0.73rem',
                    fontWeight: '800',
                    letterSpacing: '0.4px'
                  }}
                >
                  {ai.setup_tier} • {ai.setup_name}
                </span>

                {/* RS Line Badge */}
                <span
                  style={{
                    background: rsConf.is_blue_dot ? 'rgba(56, 189, 248, 0.18)' : 'rgba(168, 85, 247, 0.15)',
                    color: rsConf.is_blue_dot ? '#38bdf8' : '#c084fc',
                    border: `1px solid ${rsConf.is_blue_dot ? 'rgba(56, 189, 248, 0.4)' : 'rgba(168, 85, 247, 0.35)'}`,
                    padding: '0.22rem 0.55rem',
                    borderRadius: '6px',
                    fontSize: '0.72rem',
                    fontWeight: '700'
                  }}
                >
                  {rsConf.rs_badge}
                </span>

                {/* 30D Run-Up State Badge */}
                <span
                  style={{
                    background: `${pre30d.runup_color || '#3b82f6'}20`,
                    color: pre30d.runup_color || '#60a5fa',
                    border: `1px solid ${pre30d.runup_color || '#3b82f6'}45`,
                    padding: '0.22rem 0.55rem',
                    borderRadius: '6px',
                    fontSize: '0.72rem',
                    fontWeight: '700'
                  }}
                >
                  {pre30d.runup_badge}
                </span>
              </div>

              <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.83rem' }}>
                Next Earnings: <strong style={{ color: '#f8fafc' }}>{selectedStock.next_earnings_date}</strong> ({selectedStock.earnings_timing || 'AMC'}) •{' '}
                <span style={{ color: '#cbd5e1' }}>{selectedStock.company_name || selectedStock.ticker}</span> •{' '}
                MarketSurge Pattern: <strong style={{ color: '#38bdf8' }}>{rsConf.marketsurge_pattern}</strong> (Pivot <strong style={{ color: '#10b981' }}>${rsConf.marketsurge_buy_point}</strong>)
              </p>
            </div>

            {/* Right: Deep Chart Button + PEDP Score Box */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              {onSelectTicker && (
                <button
                  onClick={() => onSelectTicker(selectedStock.ticker)}
                  style={{
                    padding: '0.55rem 0.9rem',
                    borderRadius: '8px',
                    border: '1px solid rgba(56, 189, 248, 0.45)',
                    background: 'rgba(14, 165, 233, 0.16)',
                    color: '#38bdf8',
                    fontWeight: 700,
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem'
                  }}
                >
                  <ExternalLink size={14} /> Deep Chart
                </button>
              )}

              {onOpenFundamentals && (
                <button
                  onClick={() => onOpenFundamentals(selectedStock.ticker)}
                  style={{
                    padding: '0.55rem 0.85rem',
                    borderRadius: '8px',
                    border: '1px solid rgba(168, 85, 247, 0.4)',
                    background: 'rgba(168, 85, 247, 0.14)',
                    color: '#c084fc',
                    fontWeight: 700,
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem'
                  }}
                >
                  <Layers size={14} /> Fundamentals
                </button>
              )}

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.85rem',
                  background: 'rgba(2, 6, 23, 0.55)',
                  padding: '0.65rem 1.1rem',
                  borderRadius: '10px',
                  border: '1px solid rgba(255,255,255,0.08)'
                }}
              >
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.66rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block' }}>
                    PEDP Drift Score
                  </span>
                  <strong style={{ fontSize: '1.55rem', color: ai.badge_color, lineHeight: 1.05, fontFamily: 'monospace' }}>
                    {ai.pedp_score}<span style={{ fontSize: '0.82rem', color: '#64748b' }}>/100</span>
                  </strong>
                  <span style={{ display: 'block', fontSize: '0.65rem', color: sixDomain.veto_count > 0 ? '#f43f5e' : '#10b981', fontWeight: 700 }}>
                    {sixDomain.summary_badge}
                  </span>
                </div>
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: `${ai.badge_color}22`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: `2px solid ${ai.badge_color}`
                  }}
                >
                  <Sparkles size={19} color={ai.badge_color} />
                </div>
              </div>
            </div>
          </div>

          {/* AI Action Verdict Banner */}
          <div
            style={{
              marginTop: '0.9rem',
              padding: '0.7rem 0.95rem',
              background: 'rgba(2, 6, 23, 0.45)',
              borderRadius: '7px',
              border: '1px solid rgba(255,255,255,0.06)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.6rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
              <Zap size={16} color={ai.badge_color} />
              <span style={{ fontSize: '0.84rem', color: '#f1f5f9' }}>
                <strong>AI Execution Protocol:</strong> {ai.action_verdict}
              </span>
            </div>

            {/* Multi-Engine Confluence Strip */}
            {rsConf.converged_engines && rsConf.converged_engines.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 700 }}>
                  {rsConf.confluence_count}X CONFLUENCE:
                </span>
                {rsConf.converged_engines.map((eng, i) => (
                  <span
                    key={i}
                    style={{
                      fontSize: '0.66rem',
                      padding: '0.14rem 0.45rem',
                      borderRadius: '4px',
                      background: 'rgba(16, 185, 129, 0.14)',
                      border: '1px solid rgba(16, 185, 129, 0.35)',
                      color: '#34d399',
                      fontWeight: 700
                    }}
                  >
                    ✓ {eng}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* SECTION 1: 6-DOMAIN INSTITUTIONAL EARNINGS DECISION MATRIX */}
        {sixDomain.gates && sixDomain.gates.length > 0 && (
          <div className="glass-card" style={{ padding: '1rem 1.2rem', borderTop: '3px solid #38bdf8' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h3 style={{ margin: 0, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.94rem' }}>
                <Shield size={17} /> 6-Domain Clubbed Earnings Decision Matrix (Revisions • Personality • 30D RS • IV Edge • Options Skew • Seasonality)
              </h3>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  padding: '0.18rem 0.6rem',
                  borderRadius: '5px',
                  background: sixDomain.veto_count > 0 ? 'rgba(239, 68, 68, 0.18)' : 'rgba(16, 185, 129, 0.18)',
                  color: sixDomain.veto_count > 0 ? '#f87171' : '#34d399',
                  border: `1px solid ${sixDomain.veto_count > 0 ? 'rgba(239, 68, 68, 0.35)' : 'rgba(16, 185, 129, 0.35)'}`
                }}
              >
                {sixDomain.summary_badge}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '0.6rem' }}>
              {sixDomain.gates.map((g, idx) => (
                <div
                  key={idx}
                  style={{
                    background: 'rgba(2, 6, 23, 0.5)',
                    border: `1px solid ${g.color}44`,
                    borderTop: `3px solid ${g.color}`,
                    borderRadius: '8px',
                    padding: '0.6rem 0.65rem',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.25rem', marginBottom: '0.35rem' }}>
                    <span style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 700 }}>{g.gate}</span>
                    <span
                      style={{
                        fontSize: '0.62rem',
                        fontWeight: 800,
                        padding: '1px 5px',
                        borderRadius: '4px',
                        background: `${g.color}22`,
                        color: g.color
                      }}
                    >
                      {g.status}
                    </span>
                  </div>
                  <strong style={{ fontSize: '0.84rem', color: '#f8fafc', fontFamily: 'monospace' }}>{g.metric}</strong>
                  <span style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '3px' }}>{g.detail}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SECTION 2: 30-DAY PRE-PRINT TRAJECTORY & SPARKLINE (Left) + PEAD / ORB EXECUTION TICKET & OPTIONS PLAYBOOK (Right) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr', gap: '1.15rem' }}>

          {/* Left: 30-Day Pre-Earnings Run-Up, Sparkline & Volume Footprint */}
          <div className="glass-card" style={{ padding: '1.15rem', borderTop: '3px solid #10b981', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h3 style={{ margin: 0, color: '#34d399', display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.96rem' }}>
                <TrendingUp size={17} /> 30-Day Pre-Earnings Run-Up & RS Line Trajectory
              </h3>
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  padding: '0.18rem 0.55rem',
                  borderRadius: '5px',
                  background: `${pre30d.runup_color || '#10b981'}22`,
                  color: pre30d.runup_color || '#10b981',
                  border: `1px solid ${pre30d.runup_color || '#10b981'}44`
                }}
              >
                {pre30d.runup_badge}
              </span>
            </div>

            {/* 30D Price + EMA10/21 + Gold RS Line Sparkline */}
            <PreEarningsSparkline
              sparkline={pre30d.sparkline}
              pivotPrice={rsConf.marketsurge_buy_point}
              currentPrice={selectedStock.current_price}
            />

            {/* 6-Metric Pre-Print Movement Telemetry */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.55rem' }}>
              <div style={{ background: 'rgba(2, 6, 23, 0.45)', padding: '0.55rem 0.65rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.04)' }}>
                <span style={{ fontSize: '0.67rem', color: '#94a3b8', display: 'block' }}>5D / 10D / 30D Return</span>
                <strong style={{ fontSize: '0.82rem', color: '#f8fafc', fontFamily: 'monospace' }}>
                  <span style={{ color: pre30d.return_5d_pct >= 0 ? '#10b981' : '#f43f5e' }}>{pre30d.return_5d_pct >= 0 ? `+${pre30d.return_5d_pct}%` : `${pre30d.return_5d_pct}%`}</span>
                  {' / '}
                  <span style={{ color: pre30d.return_10d_pct >= 0 ? '#10b981' : '#f43f5e' }}>{pre30d.return_10d_pct >= 0 ? `+${pre30d.return_10d_pct}%` : `${pre30d.return_10d_pct}%`}</span>
                  {' / '}
                  <span style={{ color: pre30d.return_30d_pct >= 0 ? '#10b981' : '#f43f5e' }}>{pre30d.return_30d_pct >= 0 ? `+${pre30d.return_30d_pct}%` : `${pre30d.return_30d_pct}%`}</span>
                </strong>
              </div>

              <div style={{ background: 'rgba(2, 6, 23, 0.45)', padding: '0.55rem 0.65rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.04)' }}>
                <span style={{ fontSize: '0.67rem', color: '#94a3b8', display: 'block' }}>30D Alpha vs SPY</span>
                <strong style={{ fontSize: '0.9rem', color: pre30d.alpha_30d_pct >= 0 ? '#fbbf24' : '#f43f5e', fontFamily: 'monospace' }}>
                  {pre30d.alpha_30d_pct >= 0 ? `+${pre30d.alpha_30d_pct}%` : `${pre30d.alpha_30d_pct}%`}
                </strong>
              </div>

              <div style={{ background: 'rgba(2, 6, 23, 0.45)', padding: '0.55rem 0.65rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.04)' }}>
                <span style={{ fontSize: '0.67rem', color: '#94a3b8', display: 'block' }}>30D Up/Down Vol Ratio</span>
                <strong style={{ fontSize: '0.9rem', color: pre30d.ud_vol_ratio_30d >= 1.15 ? '#10b981' : '#cbd5e1', fontFamily: 'monospace' }}>
                  {pre30d.ud_vol_ratio_30d}x ({pre30d.up_days_30d}U/{pre30d.down_days_30d}D)
                </strong>
              </div>

              <div style={{ background: 'rgba(2, 6, 23, 0.45)', padding: '0.55rem 0.65rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.04)' }}>
                <span style={{ fontSize: '0.67rem', color: '#94a3b8', display: 'block' }}>10D Pocket Pivots & VDU</span>
                <strong style={{ fontSize: '0.86rem', color: '#38bdf8', fontFamily: 'monospace' }}>
                  {pre30d.pocket_pivots_10d} PP • {pre30d.vdu_days_10d} VDU Days
                </strong>
              </div>

              <div style={{ background: 'rgba(2, 6, 23, 0.45)', padding: '0.55rem 0.65rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.04)' }}>
                <span style={{ fontSize: '0.67rem', color: '#94a3b8', display: 'block' }}>Extension vs 21-EMA</span>
                <strong style={{ fontSize: '0.86rem', color: Math.abs(pre30d.dist_from_21ema_pct) <= 5 ? '#10b981' : '#f59e0b', fontFamily: 'monospace' }}>
                  {pre30d.dist_from_21ema_pct >= 0 ? `+${pre30d.dist_from_21ema_pct}%` : `${pre30d.dist_from_21ema_pct}%`}
                </strong>
              </div>

              <div style={{ background: 'rgba(2, 6, 23, 0.45)', padding: '0.55rem 0.65rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.04)' }}>
                <span style={{ fontSize: '0.67rem', color: '#94a3b8', display: 'block' }}>MarketSurge Pivot Dist</span>
                <strong style={{ fontSize: '0.86rem', color: '#c084fc', fontFamily: 'monospace' }}>
                  ${rsConf.marketsurge_buy_point} ({rsConf.distance_to_pivot_pct >= 0 ? `+${rsConf.distance_to_pivot_pct}%` : `${rsConf.distance_to_pivot_pct}%`})
                </strong>
              </div>
            </div>

            {/* Run-up Verdict Callout */}
            <div style={{ background: 'rgba(16, 185, 129, 0.07)', border: '1px solid rgba(16, 185, 129, 0.22)', borderRadius: '6px', padding: '0.55rem 0.75rem', fontSize: '0.78rem', color: '#cbd5e1' }}>
              <strong style={{ color: '#34d399' }}>Pre-Print Bar Diagnosis:</strong> {pre30d.runup_verdict}
            </div>
          </div>

          {/* Right: Post-Earnings PEAD / ORB Execution Ticket & Options Structure */}
          <div className="glass-card" style={{ padding: '1.15rem', borderTop: '3px solid #a855f7', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '0.8rem' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h3 style={{ margin: 0, color: '#c084fc', display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.96rem' }}>
                  <Award size={17} /> Post-Earnings PEAD / ORB Execution Ticket
                </h3>
                <span style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 800, background: 'rgba(16,185,129,0.15)', padding: '2px 7px', borderRadius: '4px' }}>
                  R:R {peadPlan.reward_risk || '3.0:1'}
                </span>
              </div>

              {/* 4-Box Execution Price Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.6rem', marginBottom: '0.8rem' }}>
                <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.28)', padding: '0.65rem 0.75rem', borderRadius: '8px' }}>
                  <span style={{ fontSize: '0.68rem', color: '#94a3b8', display: 'block' }}>PEAD / ORB Entry Pivot</span>
                  <strong style={{ fontSize: '1.15rem', color: '#10b981', fontFamily: 'monospace' }}>${peadPlan.entry_pivot}</strong>
                  <span style={{ fontSize: '0.66rem', color: '#64748b', display: 'block', marginTop: '2px' }}>
                    {rsConf.marketsurge_pattern}
                  </span>
                </div>

                <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.28)', padding: '0.65rem 0.75rem', borderRadius: '8px' }}>
                  <span style={{ fontSize: '0.68rem', color: '#94a3b8', display: 'block' }}>Gap-Day Invalidation Stop</span>
                  <strong style={{ fontSize: '1.15rem', color: '#f87171', fontFamily: 'monospace' }}>${peadPlan.gap_stop_loss}</strong>
                  <span style={{ fontSize: '0.66rem', color: '#64748b', display: 'block', marginTop: '2px' }}>
                    -{peadPlan.stop_pct}% Hard Stop (Gap Day Low)
                  </span>
                </div>

                <div style={{ background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.28)', padding: '0.65rem 0.75rem', borderRadius: '8px' }}>
                  <span style={{ fontSize: '0.68rem', color: '#94a3b8', display: 'block' }}>Target 1 (T+5 Day Drift)</span>
                  <strong style={{ fontSize: '1.1rem', color: '#60a5fa', fontFamily: 'monospace' }}>${peadPlan.target_1_5d}</strong>
                  <span style={{ fontSize: '0.66rem', color: '#64748b', display: 'block', marginTop: '2px' }}>
                    Trim 1/3 & move stop to breakeven
                  </span>
                </div>

                <div style={{ background: 'rgba(168, 85, 247, 0.08)', border: '1px solid rgba(168, 85, 247, 0.28)', padding: '0.65rem 0.75rem', borderRadius: '8px' }}>
                  <span style={{ fontSize: '0.68rem', color: '#94a3b8', display: 'block' }}>Target 2 (T+20 Day PEAD)</span>
                  <strong style={{ fontSize: '1.1rem', color: '#c084fc', fontFamily: 'monospace' }}>${peadPlan.target_2_20d}</strong>
                  <span style={{ fontSize: '0.66rem', color: '#64748b', display: 'block', marginTop: '2px' }}>
                    Trail rest along 10-EMA / 21-EMA
                  </span>
                </div>
              </div>

              {/* Defined-Risk Pre-Earnings Options Strategy vs Post-Print ORB Play */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                <div style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.28)', borderRadius: '7px', padding: '0.6rem 0.75rem' }}>
                  <span style={{ fontSize: '0.68rem', color: '#fbbf24', fontWeight: 800, textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>
                    ⚡ Defined-Risk Pre-Earnings Options Structure
                  </span>
                  <span style={{ fontSize: '0.8rem', color: '#f1f5f9' }}>{volIntel.pre_earnings_options_play}</span>
                </div>

                <div style={{ background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.28)', borderRadius: '7px', padding: '0.6rem 0.75rem' }}>
                  <span style={{ fontSize: '0.68rem', color: '#38bdf8', fontWeight: 800, textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>
                    🎯 Post-Earnings Day-1 ORB / PEAD Trigger
                  </span>
                  <span style={{ fontSize: '0.8rem', color: '#f1f5f9' }}>{volIntel.post_earnings_pead_play}</span>
                </div>
              </div>
            </div>

            <div style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.5rem' }}>
              <span>ORB Rule: <strong style={{ color: '#cbd5e1' }}>{peadPlan.orb_trigger_rule}</strong></span>
            </div>
          </div>
        </div>

        {/* SECTION 3: VOLATILITY, IV CRUSH & ±1σ CONE (Left) + CONSENSUS REVISIONS & PERSONALITY (Right) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: '1.15rem' }}>

          {/* Options Implied Volatility, IV Crush & ±1σ Expected Move Cone */}
          <div className="glass-card" style={{ padding: '1.15rem', borderTop: '3px solid #f59e0b' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
              <h3 style={{ margin: 0, color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.96rem' }}>
                <Crosshair size={17} /> Volatility, IV Crush & ±1σ Expected Move Cone
              </h3>
              {personality.volatility_verdict && (
                <span
                  style={{
                    fontSize: '0.7rem',
                    padding: '0.16rem 0.55rem',
                    borderRadius: '4px',
                    fontWeight: '800',
                    background: personality.volatility_verdict === 'OVERPRICED_IV' ? 'rgba(239, 68, 68, 0.18)' : personality.volatility_verdict === 'UNDERPRICED_IV' ? 'rgba(16, 185, 129, 0.18)' : 'rgba(255,255,255,0.06)',
                    color: personality.volatility_verdict === 'OVERPRICED_IV' ? '#f87171' : personality.volatility_verdict === 'UNDERPRICED_IV' ? '#34d399' : '#cbd5e1'
                  }}
                >
                  {personality.volatility_verdict.replace('_', ' ')} • Ratio {volIntel.implied_vs_hist_ratio}x
                </span>
              )}
            </div>

            {/* 6-Card Volatility & IV Crush Telemetry */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.6rem', marginBottom: '0.9rem' }}>
              <div style={{ background: 'rgba(2, 6, 23, 0.45)', padding: '0.65rem', borderRadius: '8px' }}>
                <span style={{ color: '#94a3b8', fontSize: '0.68rem', display: 'block' }}>ATM Implied Move</span>
                <strong style={{ color: 'white', fontSize: '1.15rem', fontFamily: 'monospace' }}>±{volIntel.implied_move_pct}%</strong>
                <span style={{ color: '#64748b', fontSize: '0.7rem', display: 'block' }}>(±${volIntel.implied_move_usd})</span>
              </div>

              <div style={{ background: 'rgba(2, 6, 23, 0.45)', padding: '0.65rem', borderRadius: '8px' }}>
                <span style={{ color: '#94a3b8', fontSize: '0.68rem', display: 'block' }}>Historical Avg Move</span>
                <strong style={{ color: '#60a5fa', fontSize: '1.15rem', fontFamily: 'monospace' }}>±{personality.avg_abs_move_pct}%</strong>
                <span style={{ color: '#64748b', fontSize: '0.7rem', display: 'block' }}>Last 8 Qtrs Realized</span>
              </div>

              <div style={{ background: 'rgba(2, 6, 23, 0.45)', padding: '0.65rem', borderRadius: '8px' }}>
                <span style={{ color: '#94a3b8', fontSize: '0.68rem', display: 'block' }}>Est. Post-Print IV Crush</span>
                <strong style={{ color: '#f43f5e', fontSize: '1.15rem', fontFamily: 'monospace' }}>{volIntel.expected_iv_crush_pct}%</strong>
                <span style={{ color: '#64748b', fontSize: '0.7rem', display: 'block' }}>VRP Spread: {volIntel.vrp_spread > 0 ? `+${volIntel.vrp_spread}` : volIntel.vrp_spread} pts</span>
              </div>

              <div style={{ background: 'rgba(2, 6, 23, 0.45)', padding: '0.65rem', borderRadius: '8px' }}>
                <span style={{ color: '#94a3b8', fontSize: '0.68rem', display: 'block' }}>30D ATM IV / IV Rank</span>
                <strong style={{ color: '#fbbf24', fontSize: '0.98rem', fontFamily: 'monospace' }}>
                  {volIntel.atm_iv_30d}% ({volIntel.iv_rank}% IVR)
                </strong>
                <span style={{ color: '#64748b', fontSize: '0.68rem', display: 'block' }}>HV10: {volIntel.hv_10d}% | HV30: {volIntel.hv_30d}%</span>
              </div>

              <div style={{ background: 'rgba(2, 6, 23, 0.45)', padding: '0.65rem', borderRadius: '8px' }}>
                <span style={{ color: '#94a3b8', fontSize: '0.68rem', display: 'block' }}>CBOE Call Volume %</span>
                <strong style={{ color: volIntel.call_vol_pct >= 55 ? '#10b981' : '#f59e0b', fontSize: '0.98rem', fontFamily: 'monospace' }}>
                  {volIntel.call_vol_pct}% Calls
                </strong>
                <span style={{ color: '#64748b', fontSize: '0.68rem', display: 'block' }}>{volIntel.skew_state}</span>
              </div>

              <div style={{ background: 'rgba(2, 6, 23, 0.45)', padding: '0.65rem', borderRadius: '8px' }}>
                <span style={{ color: '#94a3b8', fontSize: '0.68rem', display: 'block' }}>Put/Call OI & Max Pain</span>
                <strong style={{ color: (options?.pcr_oi || 0.8) > 1 ? '#f43f5e' : '#10b981', fontSize: '0.98rem', fontFamily: 'monospace' }}>
                  {options?.pcr_oi ?? '0.85'} PCR
                </strong>
                <span style={{ color: '#fbbf24', fontSize: '0.68rem', display: 'block' }}>Max Pain: ${options?.max_pain_strike ?? selectedStock.current_price}</span>
              </div>
            </div>

            {/* Visual ±1σ Expected Move Breakeven Cone Bar */}
            <div style={{ background: 'rgba(2, 6, 23, 0.5)', padding: '0.8rem 0.9rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', fontSize: '0.75rem' }}>
                <span style={{ color: '#f87171', fontWeight: 700 }}>
                  -1σ Lower Cone: ${volIntel.lower_breakeven || (selectedStock.current_price * 0.95).toFixed(2)}
                </span>
                <span style={{ color: '#e2e8f0', fontWeight: 700 }}>
                  Spot: ${selectedStock.current_price}
                </span>
                <span style={{ color: '#34d399', fontWeight: 700 }}>
                  +1σ Upper Cone: ${volIntel.upper_breakeven || (selectedStock.current_price * 1.05).toFixed(2)}
                </span>
              </div>

              <div style={{ width: '100%', height: '10px', background: 'linear-gradient(90deg, rgba(239,68,68,0.35) 0%, rgba(59,130,246,0.45) 50%, rgba(16,185,129,0.35) 100%)', borderRadius: '5px', position: 'relative', margin: '0.6rem 0' }}>
                {/* Spot Marker at Center */}
                <div style={{ position: 'absolute', left: '50%', top: '-4px', width: '3px', height: '18px', background: '#ffffff', borderRadius: '2px' }} />
                {/* Max Pain Pin */}
                {options?.max_pain_strike && selectedStock.current_price > 0 && (() => {
                  const cur = selectedStock.current_price;
                  const pain = options.max_pain_strike;
                  const diffPct = ((pain - cur) / cur) * 100;
                  const leftPos = Math.max(5, Math.min(95, 50 + diffPct * 3));
                  return (
                    <div style={{ position: 'absolute', left: `${leftPos}%`, top: '-4px' }} title={`Max Pain: $${pain}`}>
                      <div style={{ width: '4px', height: '18px', background: '#fbbf24', borderRadius: '2px' }} />
                    </div>
                  );
                })()}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: '#64748b' }}>
                <span>Straddle Lower Breakeven</span>
                <span style={{ color: '#fbbf24' }}>▮ Max Pain Strike: ${options?.max_pain_strike ?? selectedStock.current_price} (Exp: {options?.expiration ?? 'Front'})</span>
                <span>Straddle Upper Breakeven</span>
              </div>
            </div>
          </div>

          {/* Right: Consensus Estimate Revisions + Historical Personality & Short Float */}
          <div className="glass-card" style={{ padding: '1.15rem', borderTop: '3px solid #8b5cf6', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            <h3 style={{ margin: 0, color: '#a78bfa', display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.96rem' }}>
              <Activity size={17} /> Consensus Revisions, Reaction Personality & Short Float
            </h3>

            {/* Up vs Down 30D Revisions + EPS Bar */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr', gap: '0.6rem' }}>
              <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', padding: '0.6rem', borderRadius: '8px' }}>
                <span style={{ fontSize: '0.68rem', color: '#94a3b8', display: 'block' }}>Up Revisions (30D)</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '2px' }}>
                  <ArrowUpRight size={16} color="#10b981" />
                  <strong style={{ color: '#10b981', fontSize: '1.2rem', fontFamily: 'monospace' }}>{revisions.up_30d}</strong>
                  <span style={{ fontSize: '0.66rem', color: '#64748b' }}>({revisions.up_7d} 7d)</span>
                </div>
              </div>

              <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', padding: '0.6rem', borderRadius: '8px' }}>
                <span style={{ fontSize: '0.68rem', color: '#94a3b8', display: 'block' }}>Down Revisions (30D)</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '2px' }}>
                  <ArrowDownRight size={16} color="#ef4444" />
                  <strong style={{ color: '#ef4444', fontSize: '1.2rem', fontFamily: 'monospace' }}>{revisions.down_30d}</strong>
                  <span style={{ fontSize: '0.66rem', color: '#64748b' }}>({revisions.down_7d} 7d)</span>
                </div>
              </div>

              <div style={{ background: 'rgba(2, 6, 23, 0.45)', border: '1px solid rgba(255,255,255,0.05)', padding: '0.6rem', borderRadius: '8px' }}>
                <span style={{ fontSize: '0.68rem', color: '#94a3b8', display: 'block' }}>Qtr EPS Est vs 30D Ago</span>
                <strong style={{ color: 'white', fontSize: '0.95rem', fontFamily: 'monospace' }}>
                  ${revisions.current_q_eps_est ?? '-'} <span style={{ color: '#64748b', fontSize: '0.78rem' }}>vs ${revisions.prev_30d_eps_est ?? '-'}</span>
                </strong>
                <span
                  style={{
                    fontSize: '0.66rem',
                    display: 'block',
                    fontWeight: 700,
                    color: revisions.eps_revision_pct_30d > 0 ? '#10b981' : revisions.eps_revision_pct_30d < 0 ? '#f43f5e' : '#94a3b8'
                  }}
                >
                  {revisions.eps_revision_pct_30d > 0 ? `+${revisions.eps_revision_pct_30d}% (Bar Raised)` : revisions.eps_revision_pct_30d < 0 ? `${revisions.eps_revision_pct_30d}% (Bar Lowered)` : 'Stable Consensus'}
                </span>
              </div>
            </div>

            {/* Personality Win-rates */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.55rem' }}>
              <div style={{ background: 'rgba(2, 6, 23, 0.45)', padding: '0.6rem', borderRadius: '7px', textAlign: 'center' }}>
                <span style={{ color: '#94a3b8', fontSize: '0.66rem', display: 'block' }}>Beat Rate (8Q)</span>
                <strong style={{ color: '#10b981', fontSize: '1.1rem', fontFamily: 'monospace' }}>{personality.beat_rate_pct}%</strong>
              </div>
              <div style={{ background: 'rgba(2, 6, 23, 0.45)', padding: '0.6rem', borderRadius: '7px', textAlign: 'center' }}>
                <span style={{ color: '#94a3b8', fontSize: '0.66rem', display: 'block' }}>Gap & Go Rate</span>
                <strong style={{ color: personality.gap_and_go_pct >= 50 ? '#10b981' : '#f59e0b', fontSize: '1.1rem', fontFamily: 'monospace' }}>
                  {personality.gap_and_go_pct}%
                </strong>
              </div>
              <div style={{ background: 'rgba(2, 6, 23, 0.45)', padding: '0.6rem', borderRadius: '7px', textAlign: 'center' }}>
                <span style={{ color: '#94a3b8', fontSize: '0.66rem', display: 'block' }}>Avg 5D Drift</span>
                <strong style={{ color: (personality.avg_5d_drift_pct || 0) >= 0 ? '#38bdf8' : '#f43f5e', fontSize: '1.1rem', fontFamily: 'monospace' }}>
                  {(personality.avg_5d_drift_pct || 0) > 0 ? `+${personality.avg_5d_drift_pct}%` : `${personality.avg_5d_drift_pct || 0}%`}
                </strong>
              </div>
              <div style={{ background: 'rgba(2, 6, 23, 0.45)', padding: '0.6rem', borderRadius: '7px', textAlign: 'center' }}>
                <span style={{ color: '#94a3b8', fontSize: '0.66rem', display: 'block' }}>Avg 20D Drift</span>
                <strong style={{ color: (personality.avg_20d_drift_pct || 0) >= 0 ? '#c084fc' : '#f43f5e', fontSize: '1.1rem', fontFamily: 'monospace' }}>
                  {(personality.avg_20d_drift_pct || 0) > 0 ? `+${personality.avg_20d_drift_pct}%` : `${personality.avg_20d_drift_pct || 0}%`}
                </strong>
              </div>
            </div>

            {/* Growth & Short Float Strip */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.55rem' }}>
              <div style={{ background: 'rgba(2, 6, 23, 0.35)', padding: '0.5rem 0.6rem', borderRadius: '6px' }}>
                <span style={{ fontSize: '0.65rem', color: '#64748b', display: 'block' }}>Qtr EPS / Rev Growth</span>
                <strong style={{ color: '#10b981', fontSize: '0.84rem', fontFamily: 'monospace' }}>
                  {revisions.next_q_growth_est > 0 ? `+${revisions.next_q_growth_est}%` : `${revisions.next_q_growth_est}%`} / {revisions.revenue_growth_est > 0 ? `+${revisions.revenue_growth_est}%` : `${revisions.revenue_growth_est}%`}
                </strong>
              </div>
              <div style={{ background: 'rgba(2, 6, 23, 0.35)', padding: '0.5rem 0.6rem', borderRadius: '6px' }}>
                <span style={{ fontSize: '0.65rem', color: '#64748b', display: 'block' }}>Short % Float</span>
                <strong style={{ color: inst.short_percent > 8 ? '#f43f5e' : 'white', fontSize: '0.88rem', fontFamily: 'monospace' }}>
                  {inst.short_percent ?? 0}% ({inst.short_ratio ?? 0}d DTC)
                </strong>
              </div>
              <div style={{ background: 'rgba(2, 6, 23, 0.35)', padding: '0.5rem 0.6rem', borderRadius: '6px' }}>
                <span style={{ fontSize: '0.65rem', color: '#64748b', display: 'block' }}>Forward P/E</span>
                <strong style={{ color: '#cbd5e1', fontSize: '0.88rem', fontFamily: 'monospace' }}>
                  {inst.forward_pe ?? '-'}x
                </strong>
              </div>
              <div style={{ background: 'rgba(2, 6, 23, 0.35)', padding: '0.5rem 0.6rem', borderRadius: '6px' }}>
                <span style={{ fontSize: '0.65rem', color: '#64748b', display: 'block' }}>Covering Analysts</span>
                <strong style={{ color: '#60a5fa', fontSize: '0.88rem', fontFamily: 'monospace' }}>
                  {revisions.total_analysts || 0} Firms
                </strong>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 4: AI CATALYST SYNTHESIS + 10-YEAR CYCLICAL SEASONALITY */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.35fr', gap: '1.15rem' }}>
          {/* AI Catalyst Synthesis */}
          <div className="glass-card" style={{ padding: '1.15rem', borderTop: '3px solid #3b82f6' }}>
            <h3 style={{ margin: '0 0 0.85rem 0', color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.96rem' }}>
              <Sparkles size={17} /> Clubbed AI Catalyst & Narrative Synthesis
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {ai.catalysts && ai.catalysts.map((cat, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.55rem',
                    background: 'rgba(2, 6, 23, 0.45)',
                    padding: '0.55rem 0.75rem',
                    borderRadius: '6px',
                    border: '1px solid rgba(255,255,255,0.04)'
                  }}
                >
                  <div style={{ marginTop: '2px' }}><CheckCircle size={13} color="#38bdf8" /></div>
                  <span style={{ fontSize: '0.8rem', color: '#cbd5e1', lineHeight: '1.4' }}>{cat}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 10-Year Cyclical Seasonality Heatmap */}
          {seasonality && (
            <div className="glass-card" style={{ padding: '1.15rem', borderTop: '3px solid #06b6d4' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <h3 style={{ margin: 0, color: '#22d3ee', display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.96rem' }}>
                    <Compass size={17} /> 10-Year Cyclical Seasonality ({seasonality.years_analyzed}Y History)
                  </h3>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.73rem' }}>
                  {seasonality.current_month && (
                    <span style={{ padding: '2px 8px', borderRadius: '4px', background: 'rgba(6, 182, 212, 0.14)', color: '#22d3ee', fontWeight: 700 }}>
                      Now ({seasonality.current_month.name}): {seasonality.current_month.avg_return > 0 ? `+${seasonality.current_month.avg_return}%` : `${seasonality.current_month.avg_return}%`} ({seasonality.current_month.win_rate}% Win)
                    </span>
                  )}
                  {seasonality.next_month && (
                    <span style={{ padding: '2px 8px', borderRadius: '4px', background: 'rgba(59, 130, 246, 0.14)', color: '#60a5fa', fontWeight: 700 }}>
                      Next ({seasonality.next_month.name}): {seasonality.next_month.avg_return > 0 ? `+${seasonality.next_month.avg_return}%` : `${seasonality.next_month.avg_return}%`} ({seasonality.next_month.win_rate}% Win)
                    </span>
                  )}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '0.35rem', marginBottom: '0.75rem' }}>
                {seasonality.monthly_stats?.map((m) => {
                  const isCurrent = seasonality.current_month?.month === m.month;
                  const isPositive = m.avg_return >= 0;
                  const winRateColor = m.win_rate >= 65 ? '#10b981' : m.win_rate <= 45 ? '#ef4444' : '#94a3b8';

                  return (
                    <div
                      key={m.month}
                      style={{
                        background: isCurrent ? 'rgba(6, 182, 212, 0.18)' : 'rgba(2, 6, 23, 0.45)',
                        border: `1px solid ${isCurrent ? '#06b6d4' : 'rgba(255,255,255,0.04)'}`,
                        borderRadius: '6px',
                        padding: '0.45rem 0.2rem',
                        textAlign: 'center'
                      }}
                    >
                      <strong style={{ fontSize: '0.74rem', color: isCurrent ? '#22d3ee' : 'white', display: 'block' }}>
                        {m.name}
                      </strong>
                      <span style={{ fontSize: '0.63rem', color: winRateColor, fontWeight: '700', display: 'block', marginTop: '2px' }}>
                        {m.win_rate}%
                      </span>
                      <strong style={{ fontSize: '0.68rem', color: isPositive ? '#10b981' : '#ef4444', display: 'block', marginTop: '3px' }}>
                        {isPositive ? `+${m.avg_return}%` : `${m.avg_return}%`}
                      </strong>
                    </div>
                  );
                })}
              </div>

              {/* Quarterly Strip */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
                {seasonality.quarterly_stats?.map(q => (
                  <div key={q.quarter} style={{ background: 'rgba(2, 6, 23, 0.35)', padding: '0.45rem', borderRadius: '6px', textAlign: 'center', fontSize: '0.74rem' }}>
                    <strong style={{ color: '#cbd5e1' }}>{q.quarter}: </strong>
                    <span style={{ color: q.avg_return >= 0 ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                      {q.avg_return > 0 ? `+${q.avg_return}%` : `${q.avg_return}%`}
                    </span>
                    <span style={{ color: '#64748b', fontSize: '0.68rem' }}> ({q.win_rate}% win)</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* SECTION 5: HISTORICAL POST-EARNINGS DRIFT MATRIX (Last 8 Quarters) */}
        <div className="glass-card" style={{ padding: '1.15rem', borderTop: '3px solid #ec4899' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
            <h3 style={{ margin: 0, color: '#f472b6', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.96rem' }}>
              <BarChart2 size={18} /> Post-Earnings Price Action & PEAD Drift Matrix (Last 8 Quarters)
            </h3>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Real Day-0 Gap to Day-20 Institutional Drift</span>
          </div>

          {reactions && reactions.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ color: '#94a3b8', borderBottom: '1px solid #334155', textAlign: 'right' }}>
                    <th style={{ padding: '0.55rem 0.5rem', textAlign: 'left' }}>Quarter Date</th>
                    <th style={{ padding: '0.55rem 0.5rem' }}>EPS (Act / Est)</th>
                    <th style={{ padding: '0.55rem 0.5rem' }}>Surprise</th>
                    <th style={{ padding: '0.55rem 0.5rem' }}>Opening Gap %</th>
                    <th style={{ padding: '0.55rem 0.5rem' }}>Day Gain (T+0)</th>
                    <th style={{ padding: '0.55rem 0.5rem' }}>5D PEAD Drift</th>
                    <th style={{ padding: '0.55rem 0.5rem' }}>20D PEAD Drift</th>
                    <th style={{ padding: '0.55rem 0.5rem' }}>Vol Surge</th>
                    <th style={{ padding: '0.55rem 0.5rem', textAlign: 'center' }}>Reaction Archetype</th>
                  </tr>
                </thead>
                <tbody>
                  {reactions.map((h, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '0.55rem 0.5rem', textAlign: 'left', color: 'white', fontWeight: '600', fontFamily: 'monospace' }}>
                        {h.date} <span style={{ fontSize: '0.68rem', color: '#64748b' }}>({h.timing})</span>
                      </td>
                      <td style={{ padding: '0.55rem 0.5rem', textAlign: 'right', color: '#cbd5e1', fontFamily: 'monospace' }}>
                        ${h.eps_act ?? '-'} / <span style={{ color: '#64748b' }}>${h.eps_est ?? '-'}</span>
                      </td>
                      <td style={{ padding: '0.55rem 0.5rem', textAlign: 'right', fontWeight: '700', fontFamily: 'monospace', color: h.surprise_pct > 0 ? '#10b981' : h.surprise_pct < 0 ? '#ef4444' : '#94a3b8' }}>
                        {h.surprise_pct > 0 ? `+${h.surprise_pct}%` : `${h.surprise_pct}%`}
                      </td>
                      <td style={{ padding: '0.55rem 0.5rem', textAlign: 'right', fontFamily: 'monospace', color: h.gap_pct > 0 ? '#10b981' : h.gap_pct < 0 ? '#ef4444' : '#94a3b8' }}>
                        {h.gap_pct > 0 ? `+${h.gap_pct}%` : `${h.gap_pct}%`}
                      </td>
                      <td style={{ padding: '0.55rem 0.5rem', textAlign: 'right', fontWeight: '700', fontFamily: 'monospace', color: h.day_gain_pct > 0 ? '#10b981' : h.day_gain_pct < 0 ? '#ef4444' : '#94a3b8' }}>
                        {h.day_gain_pct > 0 ? `+${h.day_gain_pct}%` : `${h.day_gain_pct}%`}
                      </td>
                      <td style={{ padding: '0.55rem 0.5rem', textAlign: 'right', fontFamily: 'monospace', color: h.drift_5d_pct > 0 ? '#10b981' : h.drift_5d_pct < 0 ? '#ef4444' : '#94a3b8' }}>
                        {h.drift_5d_pct > 0 ? `+${h.drift_5d_pct}%` : `${h.drift_5d_pct}%`}
                      </td>
                      <td style={{ padding: '0.55rem 0.5rem', textAlign: 'right', fontFamily: 'monospace', color: h.drift_20d_pct > 0 ? '#10b981' : h.drift_20d_pct < 0 ? '#ef4444' : '#94a3b8' }}>
                        {h.drift_20d_pct > 0 ? `+${h.drift_20d_pct}%` : `${h.drift_20d_pct}%`}
                      </td>
                      <td style={{ padding: '0.55rem 0.5rem', textAlign: 'right', fontFamily: 'monospace', color: h.vol_surge >= 2.0 ? '#fbbf24' : '#cbd5e1' }}>
                        {h.vol_surge}x
                      </td>
                      <td style={{ padding: '0.55rem 0.5rem', textAlign: 'center' }}>
                        <span
                          style={{
                            fontSize: '0.68rem',
                            fontWeight: '700',
                            padding: '0.15rem 0.45rem',
                            borderRadius: '4px',
                            background: h.reaction_type === 'GAP_AND_GO' ? 'rgba(16, 185, 129, 0.15)' : h.reaction_type === 'GAP_AND_FADE' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255,255,255,0.05)',
                            color: h.reaction_type === 'GAP_AND_GO' ? '#10b981' : h.reaction_type === 'GAP_AND_FADE' ? '#ef4444' : '#94a3b8'
                          }}
                        >
                          {h.reaction_type.replace(/_/g, ' ')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p style={{ color: '#64748b' }}>No historical earnings reactions tracked.</p>
          )}
        </div>

      </div>
    </div>
  );
};

export default EarningsDashboard;
