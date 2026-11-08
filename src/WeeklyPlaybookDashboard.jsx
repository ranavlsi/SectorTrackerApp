import React, { useState, useMemo } from 'react';
import { 
  Compass, 
  TrendingUp, 
  TrendingDown, 
  ShieldAlert, 
  ShieldCheck, 
  AlertTriangle, 
  Activity, 
  Copy, 
  Check, 
  Target, 
  ArrowUpRight, 
  Flame, 
  Layers, 
  SlidersHorizontal,
  ExternalLink,
  Percent,
  Zap,
  ActivitySquare,
  RefreshCw,
  LayoutGrid,
  Table as TableIcon,
  Award,
  Search
} from 'lucide-react';
import { StockPersonalityBadge } from './StockPersonalityBadge';

// =========================================================================
// 30-Day Price + EMA10/21 + Gold RS Line Sparkline (Weekly Playbook 3.0)
// =========================================================================
const PlaybookSparkline = ({ spark, width = 148, height = 44 }) => {
  if (!spark || !Array.isArray(spark.close) || spark.close.length < 5) {
    return (
      <div style={{ width, height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', fontSize: '0.68rem' }}>
        No 30D Curve
      </div>
    );
  }
  const closes = spark.close;
  const ema10 = spark.ema10 || [];
  const ema21 = spark.ema21 || [];
  const rs = spark.rs_norm || [];
  const allVals = [...closes, ...ema10, ...ema21].filter(v => typeof v === 'number' && !isNaN(v));
  const minP = Math.min(...allVals);
  const maxP = Math.max(...allVals);
  const rng = Math.max(0.001, maxP - minP);
  const padX = 3;
  const padY = 4;
  const w = width - padX * 2;
  const h = height - padY * 2;

  const toPts = (arr, lo = minP, r = rng) =>
    arr
      .map((v, i) => {
        if (typeof v !== 'number' || isNaN(v)) return null;
        const x = padX + (i / Math.max(1, arr.length - 1)) * w;
        const y = padY + h - ((v - lo) / r) * h;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .filter(Boolean)
      .join(' ');

  const closePts = toPts(closes);
  const ema10Pts = ema10.length === closes.length ? toPts(ema10) : '';
  const ema21Pts = ema21.length === closes.length ? toPts(ema21) : '';
  const rsPts = rs.length === closes.length ? toPts(rs, 0, 100) : '';
  const isUp = closes[closes.length - 1] >= closes[0];
  const strokeCol = isUp ? '#10b981' : '#f43f5e';
  const lastX = padX + w;
  const lastY = padY + h - ((closes[closes.length - 1] - minP) / rng) * h;

  return (
    <svg width={width} height={height} style={{ display: 'block', overflow: 'visible' }}>
      {rsPts && (
        <polyline
          fill="none"
          stroke="#f59e0b"
          strokeWidth="1.15"
          strokeDasharray="2,2"
          opacity="0.75"
          points={rsPts}
        />
      )}
      {ema21Pts && (
        <polyline fill="none" stroke="#a855f7" strokeWidth="1.05" opacity="0.55" points={ema21Pts} />
      )}
      {ema10Pts && (
        <polyline fill="none" stroke="#38bdf8" strokeWidth="1.1" opacity="0.65" points={ema10Pts} />
      )}
      <polyline fill="none" stroke={strokeCol} strokeWidth="1.85" points={closePts} />
      <circle cx={lastX} cy={lastY} r="2.5" fill={strokeCol} />
    </svg>
  );
};

export const WeeklyPlaybookDashboard = ({ playbook, onTickerClick, onRefresh }) => {
  const [copied, setCopied] = useState(false);
  const [copiedTicket, setCopiedTicket] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState('');
  const [filterSetup, setFilterSetup] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('conviction'); // 'conviction' | 'alpha' | 'rr' | 'rs'
  const [viewMode, setViewMode] = useState('cards'); // 'cards' | 'table'

  if (!playbook) return null;

  const regime = playbook.regime_briefing || {
    score_value: 50.0,
    score_label: 'Neutral',
    regime_status: 'NEUTRAL',
    regime_color: '#f59e0b',
    recommended_exposure: 'Moderate Exposure (40% - 60% Invested)',
    exposure_percent: 50,
    mco_status: 'Neutral',
    mco_value: 0,
    breadth_above_50: 50,
    breadth_above_200: 50,
    actionable_takeaway: 'Trade selectively with strict risk management.',
    distribution_warning: false,
    sizing_rules: {
      core_position_pct: '8% - 10%',
      pilot_position_pct: '4% - 5%',
      max_open_risk_bps: '50 bps per trade',
      max_new_positions: '3 - 4 positions',
      profit_taking_rule: 'Trim 1/3 at +2R; trail 21-EMA'
    }
  };

  const kpis = playbook.summary_kpis || {};
  const focusList = playbook.focus_list || playbook.top_3_picks || [];
  const spotlight = playbook.trade_of_the_week || focusList[0] || null;
  const sectorRotation = playbook.sector_rotation || { leading_sectors: [], weakening_sectors: [], lagging_sectors: [] };
  const characterWatch = playbook.character_change_watch || [];
  const stocksThatRan = playbook.stocks_that_ran || [];
  const aboutToFly = playbook.about_to_fly || [];

  // Filter & Sort Focus List
  const filteredFocus = useMemo(() => {
    let list = [...focusList];
    if (filterSetup !== 'ALL') {
      list = list.filter(item => {
        const st = (item.setup_type || '').toUpperCase();
        const engs = (item.confluence_engines || []).join(' ').toUpperCase();
        if (filterSetup === 'VCP') return st.includes('VCP') || st.includes('ASCENDING');
        if (filterSetup === 'FLAG') return st.includes('FLAG') || st.includes('BREAKOUT') || st.includes('PIVOT') || st.includes('PARABOLIC');
        if (filterSetup === 'BASE') return st.includes('BASE') || st.includes('FLAT');
        if (filterSetup === 'PULLBACK') return st.includes('PULLBACK') || st.includes('SUPPORT') || st.includes('REVERSION');
        if (filterSetup === 'TIGHT') return item.personality?.personality_tier === 'TIGHT_AND_ORDERLY';
        if (filterSetup === 'MULTI_ENGINE') return (item.engine_count || (item.confluence_engines || []).length) >= 3;
        if (filterSetup === 'SQUEEZE') return Boolean(item.is_squeezing) || engs.includes('SQUEEZE');
        return true;
      });
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(item =>
        (item.ticker || '').toLowerCase().includes(q) ||
        (item.name || '').toLowerCase().includes(q) ||
        (item.sector || '').toLowerCase().includes(q) ||
        (item.setup_type || '').toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      if (sortBy === 'alpha') return (b.alpha_30d || 0) - (a.alpha_30d || 0);
      if (sortBy === 'rr') return (b.rr_num || 0) - (a.rr_num || 0);
      if (sortBy === 'rs') return (b.rs_rating || 0) - (a.rs_rating || 0);
      return (b.conviction_score || 0) - (a.conviction_score || 0);
    });
    return list;
  }, [focusList, filterSetup, searchQuery, sortBy]);

  // Copy tickers for TradingView watchlist
  const handleCopyTickers = () => {
    const tickers = focusList.map(item => item.ticker).join(', ');
    navigator.clipboard.writeText(tickers).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }).catch(err => {
      console.error('Failed to copy tickers:', err);
    });
  };

  // Copy single Bracket Order Ticket
  const handleCopyBracketTicket = (e, pick) => {
    e.stopPropagation();
    const text = `${pick.ticker} (${pick.setup_type}) | Entry: ${pick.entry_price} | Stop: ${pick.stop_loss} (${pick.risk_pct} risk) | Target: ${pick.profit_target} (${pick.reward_risk} R:R) | Sizing: ${pick.personality?.sizing_recommendation || 'Core'} | Guardian: ${pick.personality?.guardian_ma || '21-SMA'}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedTicket(pick.ticker);
      setTimeout(() => setCopiedTicket(null), 2000);
    });
  };

  // Trigger Playbook 3.0 Re-generation
  const handleRefreshPlaybook = async () => {
    try {
      setRefreshing(true);
      setRefreshMessage('Synthesizing 11 Quantitative Engines, RRG Sector Flow & Ross Haber Personality Matrix...');
      const res = await fetch('/api/run_weekly_playbook', { method: 'POST' });
      const data = await res.json();
      setRefreshMessage(data.message || 'Playbook 3.0 generation started.');
      setTimeout(async () => {
        setRefreshMessage('Loading updated Weekly Playbook 3.0...');
        try {
          const freshRes = await fetch('/api/weekly_playbook?t=' + Date.now());
          const freshData = await freshRes.json();
          if (freshData && freshData.date && !freshData.error) {
            if (onRefresh) onRefresh(freshData);
            setRefreshing(false);
            setRefreshMessage('Weekly Playbook 3.0 updated!');
            setTimeout(() => setRefreshMessage(''), 3000);
            return;
          }
        } catch (e) {
          console.warn('Could not fetch fresh playbook via API, falling back to reload:', e);
        }
        window.location.reload();
      }, 3500);
    } catch (err) {
      console.error('Error refreshing playbook:', err);
      setRefreshing(false);
      setRefreshMessage('Error triggering playbook refresh.');
    }
  };

  return (
    <div style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* 1. Executive Header Banner & Quick Actions */}
      <div className="glass-card" style={{ padding: '1.5rem 1.75rem', background: 'linear-gradient(135deg, rgba(15,23,42,0.92) 0%, rgba(30,41,59,0.82) 100%)', border: '1px solid rgba(56,189,248,0.22)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <Compass size={28} color="#38bdf8" />
              <h1 style={{ margin: 0, fontSize: '1.75rem', color: '#fff', fontWeight: '900', letterSpacing: '-0.5px' }}>
                Institutional Weekly Playbook 3.0
              </h1>
              <span style={{ 
                background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.2), rgba(16, 185, 129, 0.2))', 
                color: '#38bdf8', 
                border: '1px solid rgba(56, 189, 248, 0.4)', 
                padding: '3px 11px', 
                borderRadius: '999px', 
                fontSize: '0.72rem', 
                fontWeight: '800', 
                letterSpacing: '0.07em', 
                textTransform: 'uppercase' 
              }}>
                11-Engine Synthesis + RRG Flow + Ross Haber Sizing
              </span>
            </div>
            <p style={{ margin: '6px 0 0 0', color: '#94a3b8', fontSize: '0.9rem' }}>
              Week of <strong style={{ color: '#e2e8f0' }}>{playbook.date}</strong> • Macro Exposure Matrix, Multi-Timeframe Sector Rotation & 30D RS Sparkline Execution Tickets
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {/* View Mode Toggle */}
            <div style={{
              display: 'inline-flex',
              background: 'rgba(2,6,23,0.65)',
              border: '1px solid rgba(148,163,184,0.2)',
              borderRadius: '8px',
              padding: '3px'
            }}>
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  background: viewMode === 'cards' ? 'rgba(56,189,248,0.22)' : 'transparent',
                  color: viewMode === 'cards' ? '#38bdf8' : '#94a3b8',
                  border: 'none', padding: '7px 12px', borderRadius: '6px',
                  fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer'
                }}
              >
                <LayoutGrid size={14} /> Cards
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  background: viewMode === 'table' ? 'rgba(56,189,248,0.22)' : 'transparent',
                  color: viewMode === 'table' ? '#38bdf8' : '#94a3b8',
                  border: 'none', padding: '7px 12px', borderRadius: '6px',
                  fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer'
                }}
              >
                <TableIcon size={14} /> Table
              </button>
            </div>

            <button
              onClick={handleRefreshPlaybook}
              disabled={refreshing}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'rgba(255,255,255,0.06)',
                color: '#e2e8f0',
                border: '1px solid rgba(255,255,255,0.15)',
                padding: '9px 15px',
                borderRadius: '8px',
                fontWeight: '700',
                fontSize: '0.84rem',
                cursor: refreshing ? 'not-allowed' : 'pointer'
              }}
            >
              <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
              {refreshing ? 'Synthesizing...' : 'Re-Calculate Playbook'}
            </button>

            <button
              onClick={handleCopyTickers}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: copied ? '#10b981' : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                color: '#fff',
                border: 'none',
                padding: '9px 16px',
                borderRadius: '8px',
                fontWeight: '700',
                fontSize: '0.84rem',
                cursor: 'pointer',
                boxShadow: copied ? '0 0 15px rgba(16, 185, 129, 0.4)' : '0 4px 12px rgba(37, 99, 235, 0.3)'
              }}
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? `Copied ${focusList.length} Tickers!` : 'Copy TV Watchlist'}
            </button>
          </div>
        </div>

        {/* Executive KPI Strip */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))',
          gap: '10px',
          marginTop: '16px'
        }}>
          {[
            { id: 'ALL', label: 'Curated Focus Leaders', val: kpis.focus_leaders_count ?? focusList.length, sub: `${kpis.a_plus_count ?? focusList.length} Grade A+ Setups`, col: '#38bdf8' },
            { id: 'MULTI_ENGINE', label: '🏛️ 3+ Engine Confluence', val: kpis.multi_engine_count ?? 0, sub: 'Cross-Engine Agreement', col: '#10b981' },
            { id: 'SQUEEZE', label: '⚡ Active Volatility Coils', val: kpis.squeeze_coils_count ?? aboutToFly.length, sub: 'BB Inside KC Compression', col: '#f59e0b' },
            { id: 'ALL', label: '🔵 RS Blue-Dot Leaders', val: kpis.rs_blue_dots_count ?? 0, sub: 'RS New High Before Price', col: '#a855f7' },
            { id: 'TIGHT', label: '🛡️ Avg Reward : Risk', val: `${kpis.avg_rr ?? 3.0} : 1`, sub: 'Asymmetric Trade Plans', col: '#34d399' },
            { id: 'ALL', label: '⚠️ Character Warnings', val: kpis.character_warnings_count ?? characterWatch.length, sub: '21-SMA Sell Rule Triggered', col: '#f43f5e' }
          ].map((card, idx) => (
            <div
              key={idx}
              onClick={() => setFilterSetup(card.id)}
              style={{
                background: 'rgba(2,6,23,0.55)',
                border: '1px solid rgba(148,163,184,0.14)',
                borderRadius: '10px',
                padding: '10px 13px',
                cursor: 'pointer'
              }}
            >
              <div style={{ fontSize: '0.69rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {card.label}
              </div>
              <div style={{ fontSize: '1.45rem', fontWeight: 900, color: card.col, marginTop: '2px' }}>
                {card.val}
              </div>
              <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '2px' }}>{card.sub}</div>
            </div>
          ))}
        </div>

        {refreshMessage && (
          <div style={{ marginTop: '12px', padding: '8px 12px', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '6px', fontSize: '0.85rem', color: '#38bdf8' }}>
            ℹ️ {refreshMessage}
          </div>
        )}
      </div>

      {/* 2. #1 Trade of the Week Hero Spotlight */}
      {spotlight && (
        <div
          onClick={() => onTickerClick && onTickerClick(spotlight.ticker)}
          className="glass-card"
          style={{
            padding: '1.35rem 1.65rem',
            background: 'linear-gradient(135deg, rgba(16,185,129,0.13) 0%, rgba(15,23,42,0.94) 45%, rgba(56,189,248,0.12) 100%)',
            border: '1px solid rgba(16,185,129,0.45)',
            boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
            cursor: 'pointer',
            display: 'grid',
            gridTemplateColumns: '1.35fr 1fr 1.2fr auto',
            gap: '18px',
            alignItems: 'center'
          }}
        >
          {/* Left: Identity & Thesis */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
              <span style={{
                background: 'rgba(16,185,129,0.2)',
                color: '#34d399',
                border: '1px solid rgba(16,185,129,0.5)',
                padding: '2px 10px',
                borderRadius: '999px',
                fontSize: '0.7rem',
                fontWeight: 800,
                textTransform: 'uppercase'
              }}>
                ★ #1 Trade of the Week
              </span>
              <span style={{
                background: 'rgba(56,189,248,0.18)',
                color: '#38bdf8',
                border: '1px solid rgba(56,189,248,0.35)',
                padding: '2px 9px',
                borderRadius: '6px',
                fontSize: '0.73rem',
                fontWeight: 800
              }}>
                {spotlight.setup_type}
              </span>
              {(spotlight.confluence_engines || []).map(eng => (
                <span
                  key={eng}
                  style={{
                    background: 'rgba(168,85,247,0.18)',
                    color: '#d8b4fe',
                    border: '1px solid rgba(168,85,247,0.35)',
                    padding: '2px 7px',
                    borderRadius: '4px',
                    fontSize: '0.67rem',
                    fontWeight: 700
                  }}
                >
                  {eng}
                </span>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '1.75rem', fontWeight: 900, color: '#fff' }}>{spotlight.ticker}</span>
              <span style={{ fontSize: '0.92rem', color: '#94a3b8', fontWeight: 600 }}>
                {spotlight.name} • {spotlight.sector}
              </span>
              {spotlight.close && (
                <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#e2e8f0' }}>
                  ${spotlight.close.toFixed(2)}
                </span>
              )}
              {spotlight.return_5d !== undefined && (
                <span style={{
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  color: spotlight.return_5d >= 0 ? '#10b981' : '#f43f5e'
                }}>
                  {spotlight.return_5d >= 0 ? '+' : ''}{spotlight.return_5d}% (5D)
                </span>
              )}
            </div>

            <p style={{ margin: '6px 0 0 0', fontSize: '0.8rem', color: '#cbd5e1', lineHeight: 1.45 }}>
              {spotlight.reasoning}
            </p>
          </div>

          {/* Middle: 30D Sparkline + Conviction & RS */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div>
              <div style={{ fontSize: '0.65rem', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '3px' }}>
                30D Price + EMA10/21 + RS Line
              </div>
              <PlaybookSparkline spark={spotlight.sparkline} width={165} height={48} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '0.75rem' }}>
              <span style={{ color: '#94a3b8' }}>
                Conviction: <strong style={{ color: '#10b981' }}>{spotlight.conviction_score} ({spotlight.grade})</strong>
              </span>
              <span style={{ color: '#94a3b8' }}>
                RS Rating: <strong style={{ color: '#fbbf24' }}>{spotlight.rs_rating}{spotlight.is_blue_dot ? ' 🔵' : ''}</strong>
              </span>
              <span style={{ color: '#94a3b8' }}>
                30D Alpha: <strong style={{ color: (spotlight.alpha_30d || 0) >= 0 ? '#10b981' : '#f43f5e' }}>
                  {(spotlight.alpha_30d || 0) >= 0 ? '+' : ''}{spotlight.alpha_30d ?? 0}%
                </strong>
              </span>
              <span style={{ color: '#94a3b8' }}>
                Guardian: <strong style={{ color: '#60a5fa' }}>{spotlight.personality?.guardian_ma}</strong>
              </span>
            </div>
          </div>

          {/* Right: Bracket Execution Plan */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '8px',
            background: 'rgba(2,6,23,0.68)',
            padding: '10px 12px',
            borderRadius: '10px',
            border: '1px solid rgba(148,163,184,0.16)'
          }}>
            <div>
              <div style={{ fontSize: '0.65rem', color: '#94a3b8', textTransform: 'uppercase' }}>Entry Pivot</div>
              <div style={{ fontSize: '0.98rem', fontWeight: 800, color: '#38bdf8' }}>{spotlight.entry_price}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.65rem', color: '#94a3b8', textTransform: 'uppercase' }}>Stop Loss</div>
              <div style={{ fontSize: '0.98rem', fontWeight: 800, color: '#f43f5e' }}>{spotlight.stop_loss}</div>
              <div style={{ fontSize: '0.64rem', color: '#f87171' }}>Risk {spotlight.risk_pct}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.65rem', color: '#94a3b8', textTransform: 'uppercase' }}>Target</div>
              <div style={{ fontSize: '0.98rem', fontWeight: 800, color: '#10b981' }}>{spotlight.profit_target}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.65rem', color: '#94a3b8', textTransform: 'uppercase' }}>Reward:Risk</div>
              <div style={{ fontSize: '0.98rem', fontWeight: 800, color: '#fbbf24' }}>{spotlight.reward_risk}</div>
            </div>
          </div>

          {/* Copy Ticket Button */}
          <div>
            <button
              type="button"
              onClick={(e) => handleCopyBracketTicket(e, spotlight)}
              style={{
                background: copiedTicket === spotlight.ticker ? '#10b981' : 'rgba(56,189,248,0.18)',
                color: copiedTicket === spotlight.ticker ? '#022c22' : '#38bdf8',
                border: '1px solid rgba(56,189,248,0.4)',
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '0.78rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {copiedTicket === spotlight.ticker ? <Check size={14} /> : <Copy size={14} />}
              {copiedTicket === spotlight.ticker ? 'Ticket Copied' : 'Copy Ticket'}
            </button>
          </div>
        </div>
      )}

      {/* 3. Macro Health, Exposure Regime & Position Sizing Matrix */}
      <div className="glass-card" style={{ 
        padding: '1.65rem', 
        borderLeft: `6px solid ${regime.regime_color}`,
        background: 'linear-gradient(135deg, rgba(15,23,42,0.9) 0%, rgba(30,41,59,0.8) 100%)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.25rem', marginBottom: '1.25rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px', flexWrap: 'wrap' }}>
              <span style={{ 
                background: `${regime.regime_color}20`, 
                color: regime.regime_color, 
                border: `1px solid ${regime.regime_color}40`,
                padding: '4px 12px', 
                borderRadius: '6px', 
                fontSize: '0.82rem', 
                fontWeight: 'bold', 
                letterSpacing: '0.06em', 
                textTransform: 'uppercase',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <Activity size={14} /> Market Regime: {regime.score_label}
              </span>
              {regime.distribution_warning && (
                <span style={{ 
                  background: 'rgba(239, 68, 68, 0.2)', 
                  color: '#f87171', 
                  border: '1px solid #ef4444', 
                  padding: '4px 10px', 
                  borderRadius: '6px', 
                  fontSize: '0.78rem', 
                  fontWeight: 'bold' 
                }}>
                  ⚠️ Elevated Distribution Risk — Enforce Pilot Sizing
                </span>
              )}
            </div>
            <h2 style={{ margin: '4px 0 0 0', color: '#fff', fontSize: '1.45rem', fontWeight: '800' }}>
              Recommended Exposure: <span style={{ color: regime.regime_color }}>{regime.recommended_exposure}</span>
            </h2>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px' }}>Macro Health Score</div>
            <div style={{ fontSize: '2.25rem', fontWeight: '900', color: regime.regime_color, lineHeight: '1.1' }}>
              {regime.score_value} <span style={{ fontSize: '1.1rem', color: '#64748b' }}>/ 100</span>
            </div>
          </div>
        </div>

        {/* Exposure Progress Bar */}
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '6px', color: '#cbd5e1' }}>
            <span>Invested Allocation: <strong style={{ color: regime.regime_color }}>{regime.exposure_percent}%</strong></span>
            <span>Tactical Cash Reserve: <strong style={{ color: '#38bdf8' }}>{100 - regime.exposure_percent}%</strong></span>
          </div>
          <div style={{ width: '100%', height: '9px', background: 'rgba(255,255,255,0.1)', borderRadius: '6px', overflow: 'hidden', display: 'flex' }}>
            <div style={{ width: `${regime.exposure_percent}%`, background: regime.regime_color, transition: 'width 0.5s' }} />
            <div style={{ width: `${100 - regime.exposure_percent}%`, background: '#38bdf8', opacity: 0.7, transition: 'width 0.5s' }} />
          </div>
        </div>

        {/* Key Breadth & Position Sizing Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))', gap: '0.85rem', marginBottom: '1.25rem' }}>
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.75rem 0.95rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase' }}>McClellan Oscillator</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 'bold', color: regime.mco_value >= 0 ? '#10b981' : '#ef4444', marginTop: '2px' }}>
              {regime.mco_value} ({regime.mco_status})
            </div>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.75rem 0.95rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase' }}>Stocks &gt; 50 / 200 SMA</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 'bold', color: regime.breadth_above_50 >= 50 ? '#10b981' : '#f59e0b', marginTop: '2px' }}>
              {regime.breadth_above_50}% / {regime.breadth_above_200}%
            </div>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.75rem 0.95rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase' }}>Core / Pilot Position Size</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 'bold', color: '#38bdf8', marginTop: '2px' }}>
              {regime.sizing_rules?.core_position_pct || '8% - 10%'}
            </div>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.75rem 0.95rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase' }}>Max Open Portfolio Risk</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 'bold', color: '#fbbf24', marginTop: '2px' }}>
              {regime.sizing_rules?.max_open_risk_bps || '50 bps / trade'}
            </div>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.75rem 0.95rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase' }}>SPY 5D / 30D Pace</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: playbook.market_summary?.spy_weekly_return?.startsWith('+') ? '#10b981' : '#ef4444', marginTop: '2px' }}>
              {playbook.market_summary?.spy_weekly_return || '0.00%'} / {playbook.market_summary?.spy_30d_return || '0.00%'}
            </div>
          </div>
        </div>

        {/* Actionable Directive Box */}
        <div style={{ 
          background: 'rgba(0,0,0,0.32)', 
          padding: '0.9rem 1.15rem', 
          borderRadius: '8px', 
          borderLeft: `4px solid ${regime.regime_color}`,
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px'
        }}>
          <Target size={20} color={regime.regime_color} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong style={{ color: '#fff', fontSize: '0.9rem', display: 'block', marginBottom: '2px' }}>
              Tactical Playbook Directive ({regime.sizing_rules?.profit_taking_rule || 'Discipline First'}):
            </strong>
            <p style={{ margin: 0, fontSize: '0.86rem', color: '#cbd5e1', lineHeight: '1.5' }}>
              {regime.actionable_takeaway} {playbook.market_summary?.text}
            </p>
          </div>
        </div>
      </div>

      {/* 4. Sector Rotation & Money Flow Matrix */}
      <div>
        <h2 style={{ color: '#fff', fontSize: '1.3rem', margin: '0 0 0.85rem 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Layers size={21} color="#38bdf8" /> Institutional RRG Sector Flow & Money Rotation
        </h2>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
          {/* Leading Sectors */}
          <div className="glass-card" style={{ padding: '1.35rem', borderLeft: '4px solid #10b981', background: 'rgba(15,23,42,0.75)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
              <h3 style={{ margin: 0, color: '#10b981', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.05rem' }}>
                <TrendingUp size={19} /> Leading Sectors (Accumulation)
              </h3>
              <span style={{ fontSize: '0.72rem', color: '#6ee7b7', background: 'rgba(16, 185, 129, 0.12)', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
                Weekly Inflows
              </span>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {sectorRotation.leading_sectors?.map(sec => (
                <div key={sec.ticker} style={{ background: 'rgba(255,255,255,0.03)', padding: '10px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <div>
                      <strong style={{ color: '#fff', fontSize: '0.92rem' }}>{sec.ticker}</strong>
                      <span style={{ color: '#94a3b8', fontSize: '0.82rem', marginLeft: '6px' }}>({sec.name})</span>
                    </div>
                    <span style={{ color: '#10b981', fontWeight: 'bold', fontSize: '0.82rem' }}>
                      RS: {sec.rs_ratio}
                    </span>
                  </div>
                  {sec.note && (
                    <div style={{ fontSize: '0.72rem', color: '#6ee7b7', marginBottom: '6px' }}>
                      {sec.note}
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Top Leaders:</span>
                    {sec.top_stocks?.map(st => (
                      <span 
                        key={st}
                        onClick={() => onTickerClick && onTickerClick(st)}
                        style={{ 
                          cursor: 'pointer', 
                          background: 'rgba(16, 185, 129, 0.15)', 
                          color: '#6ee7b7', 
                          border: '1px solid rgba(16, 185, 129, 0.3)', 
                          padding: '1px 7px', 
                          borderRadius: '4px', 
                          fontSize: '0.75rem', 
                          fontWeight: '600'
                        }}
                      >
                        {st}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Rotating Out / Weakening Sectors */}
          {sectorRotation.weakening_sectors && sectorRotation.weakening_sectors.length > 0 && (
            <div className="glass-card" style={{ padding: '1.35rem', borderLeft: '4px solid #f59e0b', background: 'rgba(15,23,42,0.75)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                <h3 style={{ margin: 0, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.05rem' }}>
                  <AlertTriangle size={19} /> Rotating Out (Weakening)
                </h3>
                <span style={{ fontSize: '0.72rem', color: '#f59e0b', background: 'rgba(245, 158, 11, 0.12)', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
                  Momentum Decay
                </span>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {sectorRotation.weakening_sectors.map(sec => (
                  <div key={sec.ticker} style={{ background: 'rgba(255,255,255,0.03)', padding: '10px 12px', borderRadius: '6px', border: '1px solid rgba(245, 158, 11, 0.15)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <div>
                        <strong style={{ color: '#fff', fontSize: '0.92rem' }}>{sec.ticker}</strong>
                        <span style={{ color: '#94a3b8', fontSize: '0.82rem', marginLeft: '6px' }}>({sec.name})</span>
                      </div>
                      <span style={{ color: '#f59e0b', fontWeight: 'bold', fontSize: '0.82rem' }}>
                        RS: {sec.rs_ratio}
                      </span>
                    </div>
                    {sec.note && (
                      <div style={{ fontSize: '0.72rem', color: '#fcd34d', marginBottom: '6px' }}>
                        {sec.note}
                      </div>
                    )}
                    {sec.rs_stocks && sec.rs_stocks.length > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.72rem', color: '#34d399' }}>RS Islands:</span>
                        {sec.rs_stocks.map(st => (
                          <span 
                            key={st}
                            onClick={() => onTickerClick && onTickerClick(st)}
                            style={{ 
                              cursor: 'pointer', 
                              background: 'rgba(16, 185, 129, 0.15)', 
                              color: '#6ee7b7', 
                              border: '1px solid rgba(16, 185, 129, 0.3)', 
                              padding: '1px 7px', 
                              borderRadius: '4px', 
                              fontSize: '0.75rem', 
                              fontWeight: '600'
                            }}
                          >
                            {st}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Lagging Sectors */}
          <div className="glass-card" style={{ padding: '1.35rem', borderLeft: '4px solid #ef4444', background: 'rgba(15,23,42,0.75)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
              <h3 style={{ margin: 0, color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.05rem' }}>
                <TrendingDown size={19} /> Lagging Sectors (Outflow)
              </h3>
              <span style={{ fontSize: '0.72rem', color: '#fca5a5', background: 'rgba(239, 68, 68, 0.12)', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
                Avoid / Short Candidate Pool
              </span>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {sectorRotation.lagging_sectors?.map(sec => (
                <div key={sec.ticker} style={{ background: 'rgba(255,255,255,0.03)', padding: '10px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <div>
                      <strong style={{ color: '#fff', fontSize: '0.92rem' }}>{sec.ticker}</strong>
                      <span style={{ color: '#94a3b8', fontSize: '0.82rem', marginLeft: '6px' }}>({sec.name})</span>
                    </div>
                    <span style={{ color: '#ef4444', fontWeight: 'bold', fontSize: '0.82rem' }}>
                      RS: {sec.rs_ratio}
                    </span>
                  </div>
                  {sec.note && (
                    <div style={{ fontSize: '0.72rem', color: '#fca5a5', marginBottom: '6px' }}>
                      {sec.note}
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Laggards:</span>
                    {sec.top_stocks?.map(st => (
                      <span 
                        key={st}
                        onClick={() => onTickerClick && onTickerClick(st)}
                        style={{ 
                          cursor: 'pointer', 
                          background: 'rgba(239, 68, 68, 0.15)', 
                          color: '#fca5a5', 
                          border: '1px solid rgba(239, 68, 68, 0.3)', 
                          padding: '1px 7px', 
                          borderRadius: '4px', 
                          fontSize: '0.75rem', 
                          fontWeight: '600'
                        }}
                      >
                        {st}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 5. Curated Focus List: True Market Leaders */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <h2 style={{ color: '#fff', fontSize: '1.35rem', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Flame size={23} color="#f59e0b" /> Multi-Engine Institutional Focus List ({filteredFocus.length})
            </h2>
            <p style={{ margin: '3px 0 0 0', color: '#94a3b8', fontSize: '0.84rem' }}>
              30D Price + EMA10/21 + RS Line Sparklines, Multi-Engine Confluence Badges, Ross Haber Personality & 1-Click Bracket Tickets
            </p>
          </div>

          {/* Filter Pills + Search + Sort */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '4px', background: 'rgba(15,23,42,0.7)', padding: '4px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)', flexWrap: 'wrap' }}>
              {[
                { id: 'ALL', label: 'All Leaders' },
                { id: 'MULTI_ENGINE', label: '🏛️ 3+ Engines' },
                { id: 'SQUEEZE', label: '⚡ Squeeze Coil' },
                { id: 'FLAG', label: 'Breakouts & Pivots' },
                { id: 'VCP', label: 'VCP / Ascending' },
                { id: 'BASE', label: 'Flat Base' },
                { id: 'TIGHT', label: 'Tight & Orderly' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setFilterSetup(tab.id)}
                  style={{
                    background: filterSetup === tab.id ? '#38bdf8' : 'transparent',
                    color: filterSetup === tab.id ? '#0f172a' : '#94a3b8',
                    border: 'none',
                    padding: '5px 10px',
                    borderRadius: '6px',
                    fontSize: '0.76rem',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <input
              type="text"
              placeholder="Filter ticker or sector..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                background: 'rgba(15,23,42,0.8)',
                border: '1px solid rgba(148,163,184,0.22)',
                color: '#e2e8f0',
                padding: '6px 10px',
                borderRadius: '8px',
                fontSize: '0.78rem',
                width: '165px'
              }}
            />

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{
                background: 'rgba(15,23,42,0.8)',
                border: '1px solid rgba(148,163,184,0.22)',
                color: '#e2e8f0',
                padding: '6px 10px',
                borderRadius: '8px',
                fontSize: '0.78rem',
                fontWeight: 700
              }}
            >
              <option value="conviction">Sort: Conviction Score</option>
              <option value="alpha">Sort: 30D Alpha vs SPY</option>
              <option value="rs">Sort: RS Rating</option>
              <option value="rr">Sort: Reward : Risk</option>
            </select>
          </div>
        </div>

        {/* Cards Mode vs Table Mode */}
        {viewMode === 'cards' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '1.25rem' }}>
            {filteredFocus.map((pick, i) => {
              const pTier = pick.personality?.personality_tier || 'TIGHT_AND_ORDERLY';
              const tierColor = pick.personality?.tier_color || '#10b981';
              const gradeCol = pick.grade === 'A+' ? '#10b981' : '#38bdf8';

              return (
                <div 
                  key={pick.ticker} 
                  className="glass-card" 
                  onClick={() => onTickerClick && onTickerClick(pick.ticker)}
                  style={{ 
                    padding: '1.25rem 1.35rem', 
                    background: 'linear-gradient(145deg, rgba(15,23,42,0.92) 0%, rgba(30,41,59,0.78) 100%)', 
                    border: '1px solid rgba(148,163,184,0.16)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}
                >
                  {/* Top Row: Rank, Ticker, Price, Grade & Personality */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.9rem', fontWeight: '800', color: '#64748b' }}>#{i + 1}</span>
                        <h3 style={{ margin: 0, fontSize: '1.45rem', color: '#fff', fontWeight: '900' }}>
                          {pick.ticker}
                        </h3>
                        {pick.close && (
                          <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#e2e8f0' }}>
                            ${pick.close.toFixed(2)}
                          </span>
                        )}
                        {pick.rs_rating && (
                          <span style={{
                            background: 'rgba(245,158,11,0.16)',
                            color: '#fbbf24',
                            border: '1px solid rgba(245,158,11,0.35)',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            fontSize: '0.68rem',
                            fontWeight: 800
                          }}>
                            RS {pick.rs_rating}{pick.is_blue_dot ? ' 🔵' : ''}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.73rem', color: '#94a3b8', marginTop: '2px' }}>
                        {pick.name || pick.ticker} • {pick.sector || 'Leader'}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        background: `${gradeCol}20`,
                        color: gradeCol,
                        border: `1px solid ${gradeCol}55`,
                        padding: '3px 9px',
                        borderRadius: '999px',
                        fontSize: '0.74rem',
                        fontWeight: 900
                      }}>
                        {pick.grade || 'A+'} • {pick.conviction_score ?? 90}
                      </span>
                      {pick.personality && (
                        <div style={{ fontSize: '0.7rem', color: tierColor, fontWeight: 700, marginTop: '3px' }}>
                          {pick.personality.tier_label} ({pick.personality.adr_10d}% ADR)
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Setup Badge + Multi-Engine Confluence Pills */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                    <span style={{ 
                      padding: '2px 8px', 
                      background: 'rgba(56, 189, 248, 0.16)', 
                      color: '#38bdf8', 
                      border: '1px solid rgba(56, 189, 248, 0.35)',
                      borderRadius: '5px', 
                      fontSize: '0.73rem', 
                      fontWeight: '800' 
                    }}>
                      {pick.setup_type}
                    </span>
                    {(pick.confluence_engines || []).map(eng => (
                      <span
                        key={eng}
                        style={{
                          background: 'rgba(168,85,247,0.15)',
                          color: '#d8b4fe',
                          border: '1px solid rgba(168,85,247,0.32)',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '0.66rem',
                          fontWeight: 700
                        }}
                      >
                        {eng}
                      </span>
                    ))}
                  </div>

                  {/* 30D Sparkline + Alpha & Guardian Strip */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '10px',
                    background: 'rgba(2,6,23,0.48)',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: '1px solid rgba(148,163,184,0.1)'
                  }}>
                    <div>
                      <div style={{ fontSize: '0.63rem', color: '#64748b', textTransform: 'uppercase', marginBottom: '2px' }}>
                        30D Price + EMA10/21 + RS Line
                      </div>
                      <PlaybookSparkline spark={pick.sparkline} width={148} height={42} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '0.72rem', textAlign: 'right' }}>
                      <span style={{ color: '#94a3b8' }}>
                        30D Alpha: <strong style={{ color: (pick.alpha_30d || 0) >= 0 ? '#10b981' : '#f43f5e' }}>
                          {(pick.alpha_30d || 0) >= 0 ? '+' : ''}{pick.alpha_30d ?? 0}%
                        </strong>
                      </span>
                      <span style={{ color: '#94a3b8' }}>
                        Dist 52W High: <strong style={{ color: '#e2e8f0' }}>{pick.dist_52w ?? 0}%</strong>
                      </span>
                      <span style={{ color: '#94a3b8' }}>
                        Guardian: <strong style={{ color: '#60a5fa' }}>{pick.personality?.guardian_ma} ({pick.personality?.guardian_respect_score}%)</strong>
                      </span>
                    </div>
                  </div>

                  {/* Execution Plan Grid */}
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(3, 1fr)', 
                    gap: '8px', 
                    background: 'rgba(0,0,0,0.32)', 
                    padding: '10px', 
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.05)'
                  }}>
                    <div>
                      <div style={{ fontSize: '0.66rem', color: '#94a3b8', textTransform: 'uppercase' }}>Entry Pivot</div>
                      <div style={{ fontSize: '1.02rem', fontWeight: '800', color: '#38bdf8' }}>{pick.entry_price}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.66rem', color: '#94a3b8', textTransform: 'uppercase' }}>Stop Loss</div>
                      <div style={{ fontSize: '1.02rem', fontWeight: '800', color: '#ef4444' }}>{pick.stop_loss}</div>
                      <div style={{ fontSize: '0.65rem', color: '#f87171' }}>Risk: {pick.risk_pct}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.66rem', color: '#94a3b8', textTransform: 'uppercase' }}>Target</div>
                      <div style={{ fontSize: '1.02rem', fontWeight: '800', color: '#10b981' }}>{pick.profit_target}</div>
                      <div style={{ fontSize: '0.65rem', color: '#34d399' }}>R:R {pick.reward_risk}</div>
                    </div>
                  </div>

                  {/* Strategic Reasoning */}
                  <p style={{ margin: 0, fontSize: '0.79rem', color: '#cbd5e1', lineHeight: '1.45' }}>
                    {pick.reasoning}
                  </p>

                  {/* Footer: Stage + Copy Ticket */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: 'auto',
                    paddingTop: '6px',
                    borderTop: '1px solid rgba(148,163,184,0.1)'
                  }}>
                    <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
                      {pick.health?.stage || 'Stage 2'} • RSI <strong style={{ color: '#fff' }}>{pick.health?.rsi || 55}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={(e) => handleCopyBracketTicket(e, pick)}
                      style={{
                        background: copiedTicket === pick.ticker ? '#10b981' : 'rgba(56,189,248,0.14)',
                        color: copiedTicket === pick.ticker ? '#022c22' : '#38bdf8',
                        border: '1px solid rgba(56,189,248,0.35)',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px'
                      }}
                    >
                      {copiedTicket === pick.ticker ? <Check size={12} /> : <Copy size={12} />}
                      {copiedTicket === pick.ticker ? 'Copied' : 'Bracket Ticket'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="glass-card" style={{ overflowX: 'auto', padding: '0.5rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(148,163,184,0.2)', color: '#94a3b8', textAlign: 'left', fontSize: '0.72rem', textTransform: 'uppercase' }}>
                  <th style={{ padding: '10px 12px' }}>Ticker & Sector</th>
                  <th style={{ padding: '10px 12px' }}>30D Price + RS Curve</th>
                  <th style={{ padding: '10px 12px' }}>Setup & Confluence</th>
                  <th style={{ padding: '10px 12px' }}>Conviction & RS</th>
                  <th style={{ padding: '10px 12px' }}>Entry / Stop / Target</th>
                  <th style={{ padding: '10px 12px' }}>Guardian & ADR</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>Ticket</th>
                </tr>
              </thead>
              <tbody>
                {filteredFocus.map((pick) => (
                  <tr
                    key={pick.ticker}
                    onClick={() => onTickerClick && onTickerClick(pick.ticker)}
                    style={{ borderBottom: '1px solid rgba(148,163,184,0.08)', cursor: 'pointer' }}
                  >
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ fontWeight: 900, color: '#fff', fontSize: '0.98rem' }}>
                        {pick.ticker} <span style={{ color: '#38bdf8', fontSize: '0.84rem' }}>${pick.close?.toFixed(2)}</span>
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{pick.name} • {pick.sector}</div>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <PlaybookSparkline spark={pick.sparkline} width={135} height={38} />
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ color: '#38bdf8', fontWeight: 800, marginBottom: '3px' }}>{pick.setup_type}</div>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {(pick.confluence_engines || []).map(e => (
                          <span key={e} style={{ fontSize: '0.65rem', background: 'rgba(168,85,247,0.16)', color: '#d8b4fe', padding: '1px 5px', borderRadius: '4px' }}>
                            {e}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ color: '#10b981', fontWeight: 800 }}>{pick.grade} ({pick.conviction_score})</div>
                      <div style={{ fontSize: '0.72rem', color: '#fbbf24' }}>
                        RS {pick.rs_rating} • 30D α: {pick.alpha_30d >= 0 ? '+' : ''}{pick.alpha_30d}%
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ color: '#e2e8f0', fontWeight: 700 }}>
                        E: <span style={{ color: '#38bdf8' }}>{pick.entry_price}</span> • S: <span style={{ color: '#f43f5e' }}>{pick.stop_loss}</span> • T: <span style={{ color: '#10b981' }}>{pick.profit_target}</span>
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Risk {pick.risk_pct} • R:R {pick.reward_risk}</div>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ color: '#60a5fa', fontWeight: 700 }}>{pick.personality?.guardian_ma} ({pick.personality?.guardian_respect_score}%)</div>
                      <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>10D ADR: {pick.personality?.adr_10d}%</div>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                      <button
                        type="button"
                        onClick={(e) => handleCopyBracketTicket(e, pick)}
                        style={{
                          background: 'rgba(56,189,248,0.15)',
                          color: '#38bdf8',
                          border: '1px solid rgba(56,189,248,0.35)',
                          padding: '5px 10px',
                          borderRadius: '6px',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        {copiedTicket === pick.ticker ? 'Copied!' : 'Copy Ticket'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 6. Character Change & Sell Rule Watchlist */}
      {characterWatch.length > 0 && (
        <div className="glass-card" style={{ 
          padding: '1.5rem', 
          borderLeft: '5px solid #ef4444', 
          background: 'linear-gradient(135deg, rgba(30,10,15,0.7) 0%, rgba(15,23,42,0.85) 100%)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <ShieldAlert size={22} color="#ef4444" />
              <div>
                <h3 style={{ margin: 0, color: '#f87171', fontSize: '1.18rem', fontWeight: '800' }}>
                  Character Change & Distribution Watchlist ({characterWatch.length})
                </h3>
                <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                  Ross Haber Sell Rule: Consecutive closes below 21-day SMA or Volatility Blowout. Avoid new buys; trim into strength.
                </span>
              </div>
            </div>
            <span style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5', border: '1px solid #ef4444', padding: '3px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold' }}>
              Capital Preservation Defense
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.85rem' }}>
            {characterWatch.map(item => (
              <div 
                key={item.ticker}
                onClick={() => onTickerClick && onTickerClick(item.ticker)}
                style={{ 
                  background: 'rgba(15, 23, 42, 0.65)', 
                  padding: '10px 14px', 
                  borderRadius: '8px', 
                  border: '1px solid rgba(239, 68, 68, 0.28)',
                  cursor: 'pointer'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <strong style={{ color: '#fff', fontSize: '1.02rem' }}>{item.ticker}</strong>
                    <span style={{ color: '#94a3b8', fontSize: '0.82rem' }}>{item.price}</span>
                  </div>
                  <span style={{ fontSize: '0.7rem', color: '#fca5a5', background: 'rgba(239, 68, 68, 0.25)', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                    {item.status}
                  </span>
                </div>
                <p style={{ margin: '0 0 6px 0', fontSize: '0.78rem', color: '#fca5a5', lineHeight: '1.35' }}>
                  {item.signal}
                </p>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#94a3b8', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '5px' }}>
                  <span>Breached: <strong style={{ color: '#f87171' }}>{item.guardian_ma}</strong></span>
                  <span>Action: <strong style={{ color: '#fbbf24' }}>{item.action}</strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 7. Stocks That Ran & Volatility Squeeze Watchlists */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem', marginBottom: '1rem' }}>
        {/* Stocks That Ran */}
        <div className="glass-card" style={{ padding: '1.35rem', borderLeft: '4px solid #10b981', background: 'rgba(15,23,42,0.75)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
            <h3 style={{ margin: 0, color: '#10b981', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.05rem' }}>
              <TrendingUp size={18} /> Stocks That Ran (Top 5-Day Momentum)
            </h3>
            <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Wait for 10/21-EMA Pullback</span>
          </div>
          {stocksThatRan.map(s => (
            <div 
              key={s.ticker} 
              onClick={() => onTickerClick && onTickerClick(s.ticker)}
              style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                borderBottom: '1px solid rgba(255,255,255,0.06)', 
                padding: '0.6rem 0',
                cursor: 'pointer'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <strong style={{ color: '#fff', fontSize: '0.92rem' }}>{s.ticker}</strong>
                <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>{s.price}</span>
                {s.rs_rating && (
                  <span style={{ fontSize: '0.68rem', color: '#fbbf24', fontWeight: 700 }}>RS {s.rs_rating}</span>
                )}
              </div>
              <span style={{ color: '#10b981', fontWeight: 'bold', fontSize: '0.88rem' }}>{s.return}</span>
            </div>
          ))}
        </div>

        {/* About to Fly (Squeeze) */}
        <div className="glass-card" style={{ padding: '1.35rem', borderLeft: '4px solid #f59e0b', background: 'rgba(15,23,42,0.75)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
            <h3 style={{ margin: 0, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.05rem' }}>
              <ActivitySquare size={18} /> About to Fly (Squeeze Near 52W High)
            </h3>
            <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Coiling Energy</span>
          </div>
          {aboutToFly.map(s => (
            <div 
              key={s.ticker} 
              onClick={() => onTickerClick && onTickerClick(s.ticker)}
              style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                borderBottom: '1px solid rgba(255,255,255,0.06)', 
                padding: '0.6rem 0',
                cursor: 'pointer'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <strong style={{ color: '#fff', fontSize: '0.92rem' }}>{s.ticker}</strong>
                <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>{s.price}</span>
                {s.rs_rating && (
                  <span style={{ fontSize: '0.68rem', color: '#fbbf24', fontWeight: 700 }}>RS {s.rs_rating}</span>
                )}
              </div>
              <span style={{ color: '#f59e0b', fontWeight: 'bold', fontSize: '0.84rem' }}>
                {s.dist_ath} from ATH
              </span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};

export default WeeklyPlaybookDashboard;
