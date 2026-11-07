import React, { useState, useEffect, useMemo } from 'react';
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, ReferenceArea, Cell, LabelList
} from 'recharts';
import {
  TrendingUp, TrendingDown, AlertCircle, Activity, ActivitySquare,
  Compass, Zap, List, Layers, ShieldAlert, ShieldCheck, Search, BarChart2
} from 'lucide-react';

const COLORS = [
  "#38bdf8", "#00f2fe", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#ec4899",
  "#14b8a6", "#f97316", "#06b6d4", "#84cc16", "#a855f7", "#eab308", "#f43f5e",
  "#0ea5e9", "#22c55e", "#d946ef", "#94a3b8", "#f87171", "#fbbf24", "#34d399",
  "#60a5fa", "#c084fc", "#fb923c", "#2dd4bf", "#a3e635", "#fb7185"
];

const BASKET_MAP = {
  XLK: 'Growth & Tech',
  SMH: 'Growth & Tech',
  IGV: 'Growth & Tech',
  XLC: 'Growth & Tech',
  ARKK: 'Growth & Tech',
  BOTZ: 'Growth & Tech',
  QTUM: 'Growth & Tech',
  XLY: 'Growth & Tech',

  XLF: 'Cyclicals & Financials',
  KRE: 'Cyclicals & Financials',
  XLI: 'Cyclicals & Financials',
  IYT: 'Cyclicals & Financials',
  JETS: 'Cyclicals & Financials',
  ITB: 'Cyclicals & Financials',
  XRT: 'Cyclicals & Financials',
  XLB: 'Cyclicals & Financials',

  XLU: 'Defensive & Yield',
  XLP: 'Defensive & Yield',
  XLV: 'Defensive & Yield',
  XLRE: 'Defensive & Yield',
  IBB: 'Defensive & Yield',

  XLE: 'Hard Assets & Energy',
  GDX: 'Hard Assets & Energy',
  XME: 'Hard Assets & Energy',
  URNM: 'Hard Assets & Energy',
  ICLN: 'Hard Assets & Energy',
  TAN: 'Hard Assets & Energy'
};

const BASKET_COLORS = {
  'Growth & Tech': '#38bdf8',
  'Cyclicals & Financials': '#f59e0b',
  'Defensive & Yield': '#10b981',
  'Hard Assets & Energy': '#a855f7'
};

const QUAD_META = {
  Leading: { color: '#10b981', bg: 'rgba(16, 185, 129, 0.14)', border: 'rgba(16, 185, 129, 0.35)', short: 'LEAD' },
  Improving: { color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.14)', border: 'rgba(59, 130, 246, 0.35)', short: 'IMPR' },
  Weakening: { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.14)', border: 'rgba(245, 158, 11, 0.35)', short: 'WEAK' },
  Lagging: { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.14)', border: 'rgba(239, 68, 68, 0.35)', short: 'LAG' },
  Unknown: { color: '#64748b', bg: 'rgba(100, 116, 139, 0.14)', border: 'rgba(100, 116, 139, 0.3)', short: 'N/A' }
};

export const getQuadrant = (x, y) => {
  if (x >= 100 && y >= 100) return 'Leading';
  if (x >= 100 && y < 100) return 'Weakening';
  if (x < 100 && y < 100) return 'Lagging';
  if (x < 100 && y >= 100) return 'Improving';
  return 'Unknown';
};

const formatDollarFlow = (num) => {
  if (num === null || num === undefined || isNaN(num)) return '$0';
  const sign = num >= 0 ? '+' : '-';
  const abs = Math.abs(num);
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(0)}K`;
  return `${sign}$${Math.round(abs)}`;
};

const formatSignedInt = (num) => {
  if (num === null || num === undefined || isNaN(num)) return '0';
  const sign = num > 0 ? '+' : '';
  if (Math.abs(num) >= 1000) return `${sign}${(num / 1000).toFixed(1)}K`;
  return `${sign}${Math.round(num)}`;
};

const getVectorClassification = (dx, dy) => {
  if (dx >= 0 && dy >= 0) {
    return {
      label: 'Power Thrust (NE)',
      short: '↗ Power Inflow',
      desc: 'Trend & Momentum both expanding',
      color: '#10b981',
      dir: 'NE'
    };
  }
  if (dx < 0 && dy >= 0) {
    return {
      label: 'Stealth Hook (NW)',
      short: '↖ Early Accumulation',
      desc: 'Momentum rebounding ahead of trend',
      color: '#38bdf8',
      dir: 'NW'
    };
  }
  if (dx >= 0 && dy < 0) {
    return {
      label: 'Momentum Rollover (SE)',
      short: '↘ Distribution Fade',
      desc: 'Trend positive but momentum bleeding',
      color: '#f59e0b',
      dir: 'SE'
    };
  }
  return {
    label: 'Capitulation Drain (SW)',
    short: '↙ Heavy Outflow',
    desc: 'Both trend & momentum contracting',
    color: '#ef4444',
    dir: 'SW'
  };
};

/**
 * Evaluates RRG Equity Rotation vs Institutional Options Order Flow
 * to detect High-Conviction Confirmations vs Under-the-Hood Divergences.
 */
const classifyOptionsConfluence = (curQuad, dx, dy, flowScore, opt) => {
  if (!opt) {
    return {
      type: 'NEUTRAL',
      badge: '⏳ No Options Data',
      shortBadge: 'N/A',
      color: '#64748b',
      bg: 'rgba(100, 116, 139, 0.14)',
      border: 'rgba(100, 116, 139, 0.3)',
      isDivergence: false,
      isConfirmed: false,
      headline: 'Options telemetry unavailable',
      detail: ''
    };
  }

  const callPct = Number(opt.call_vol_pct || 50);
  const pcrVol = Number(opt.pcr_vol || 1.0);
  const netDelta = Number(opt.net_delta_flow || 0);
  const netGex = Number(opt.net_gex || 0);
  const netCallOi5d = Number(opt.net_call_acc_5d || 0);

  // RRG posture
  const rrgBullishPosition = curQuad === 'Leading' || curQuad === 'Improving';
  const rrgExpanding = flowScore >= 1.5 || dy >= 1.5;
  const rrgPullingBack = dy < -1.5 || flowScore < -1.5;

  // Options posture
  const optionsBullish = (callPct >= 56 && netDelta > 0) || (callPct >= 62) || (netDelta >= 25e6 && callPct >= 52);
  const optionsBearish = (callPct <= 45 && netDelta < -5e6) || (pcrVol >= 1.35 && netDelta < 0) || (netDelta <= -100e6);

  // 1. BEARISH OPTIONS DIVERGENCE: RRG is Leading/Rising, but Options Flow shows heavy Put Hedging / Negative Delta
  if ((rrgBullishPosition || rrgExpanding) && optionsBearish) {
    return {
      type: 'BEARISH_DIVERGENCE',
      badge: '⚠️ Bearish Div: Put Hedging into Strength',
      shortBadge: '⚠️ BEAR DIV (PUT HEDGE)',
      color: '#f59e0b',
      bg: 'rgba(245, 158, 11, 0.15)',
      border: 'rgba(245, 158, 11, 0.45)',
      isDivergence: true,
      isConfirmed: false,
      headline: `RRG is ${curQuad}, but Options Flow shows ${callPct.toFixed(0)}% Calls (${pcrVol.toFixed(2)} PCR) & ${formatDollarFlow(netDelta)} Net Δ`,
      detail: netCallOi5d < -10000
        ? `Institutions shed ${formatSignedInt(netCallOi5d)} net call OI over 5D while bidding downside puts into strength.`
        : `Smart-money dealers are absorbing heavy put hedging despite elevated RRG trend — watch for momentum rollover.`
    };
  }

  // 2. BULLISH OPTIONS DIVERGENCE: RRG is Pulling Back / Weakening / Lagging, but Options Flow shows Aggressive Call Accumulation
  if ((!rrgBullishPosition || rrgPullingBack) && optionsBullish) {
    return {
      type: 'BULLISH_DIVERGENCE',
      badge: '🎣 Bullish Div: Smart-Money Call Buying on Dip',
      shortBadge: '🎣 BULL DIV (CALL DIP-BUY)',
      color: '#38bdf8',
      bg: 'rgba(56, 189, 248, 0.15)',
      border: 'rgba(56, 189, 248, 0.45)',
      isDivergence: true,
      isConfirmed: false,
      headline: `RRG ${rrgPullingBack ? `pulled back (ΔMom ${dy.toFixed(1)})` : `in ${curQuad}`}, but Options surged ${callPct.toFixed(0)}% Calls & ${formatDollarFlow(netDelta)} Net Δ`,
      detail: netCallOi5d > 500
        ? `5D Net Call OI expanded by ${formatSignedInt(netCallOi5d)} contracts (${netGex >= 0 ? `+${netGex.toFixed(1)}M Supportive GEX` : `${netGex.toFixed(1)}M GEX`}) — institutions accumulating the dip.`
        : `Dealers are forced to buy underlying delta into the RRG pullback (${pcrVol.toFixed(2)} PCR) — high-probability hook candidate.`
    };
  }

  // 3. CONFIRMED BULLISH CONFLUENCE: RRG Expanding/Leading + Options Bullish Call Flow
  if ((rrgBullishPosition || rrgExpanding) && optionsBullish) {
    return {
      type: 'CONFIRMED_BULLISH',
      badge: '✅ Confirmed Bullish: RRG + Call Flow Aligned',
      shortBadge: '✅ CONFIRMED BULL',
      color: '#10b981',
      bg: 'rgba(16, 185, 129, 0.15)',
      border: 'rgba(16, 185, 129, 0.45)',
      isDivergence: false,
      isConfirmed: true,
      headline: `RRG ${curQuad} (ΔFlow ${flowScore >= 0 ? '+' : ''}${flowScore.toFixed(1)}) backed by ${callPct.toFixed(0)}% Calls & ${formatDollarFlow(netDelta)} Net Δ`,
      detail: `Dealer GEX is ${netGex >= 0 ? `+${netGex.toFixed(1)}M (Supportive Pin/Trend)` : `${netGex.toFixed(1)}M`} with 5D Call OI ${formatSignedInt(netCallOi5d)}.`
    };
  }

  // 4. CONFIRMED BEARISH BREAKDOWN: RRG Weakening/Lagging + Options Bearish Put Flow / Negative GEX
  if ((!rrgBullishPosition || rrgPullingBack) && optionsBearish) {
    return {
      type: 'CONFIRMED_BEARISH',
      badge: '🩸 Confirmed Bearish: RRG Outflow + Put Pressure',
      shortBadge: '🩸 CONFIRMED BEAR',
      color: '#ef4444',
      bg: 'rgba(239, 68, 68, 0.15)',
      border: 'rgba(239, 68, 68, 0.45)',
      isDivergence: false,
      isConfirmed: true,
      headline: `RRG ${curQuad} (ΔFlow ${flowScore.toFixed(1)}) compounded by ${pcrVol.toFixed(2)} PCR & ${formatDollarFlow(netDelta)} Net Δ`,
      detail: netGex < 0
        ? `Deep Negative Dealer GEX (${netGex.toFixed(1)}M) accelerates downside dealer short-hedging cascades.`
        : `Sustained institutional put demand (${(100 - callPct).toFixed(0)}% Put Vol) confirms capital exit.`
    };
  }

  return {
    type: 'NEUTRAL_BALANCED',
    badge: '⚖️ Balanced Options & RRG Flow',
    shortBadge: '⚖️ BALANCED',
    color: '#94a3b8',
    bg: 'rgba(148, 163, 184, 0.12)',
    border: 'rgba(148, 163, 184, 0.25)',
    isDivergence: false,
    isConfirmed: false,
    headline: `Two-way options positioning (${callPct.toFixed(0)}% Calls, ${formatDollarFlow(netDelta)} Net Δ)`,
    detail: `Dealer GEX ${netGex >= 0 ? '+' : ''}${netGex.toFixed(1)}M • 5D Net Call OI ${formatSignedInt(netCallOi5d)}`
  };
};

const EnhancedRrgTooltip = ({ active, payload, lookback }) => {
  if (!active || !payload || !payload.length) return null;
  const pt = payload[0].payload;
  const sec = pt.sectorTelemetry;
  const quad = getQuadrant(pt.x, pt.y);
  const qStyle = QUAD_META[quad] || QUAD_META.Unknown;

  return (
    <div style={{
      backgroundColor: 'rgba(9, 13, 22, 0.96)',
      border: `1px solid ${qStyle.border}`,
      borderRadius: '10px',
      padding: '12px 14px',
      minWidth: '275px',
      boxShadow: '0 12px 28px rgba(0,0,0,0.65)',
      backdropFilter: 'blur(8px)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
        <div>
          <strong style={{ color: '#f8fafc', fontSize: '0.92rem' }}>{sec?.name || pt.sectorName}</strong>
          <span style={{ color: '#38bdf8', fontSize: '0.78rem', marginLeft: '6px', fontFamily: 'monospace', fontWeight: 700 }}>
            ({sec?.ticker || ''})
          </span>
        </div>
        <span style={{
          fontSize: '0.68rem',
          fontWeight: 800,
          padding: '2px 7px',
          borderRadius: '999px',
          background: qStyle.bg,
          color: qStyle.color,
          border: `1px solid ${qStyle.border}`
        }}>
          {quad.toUpperCase()}
        </span>
      </div>

      <div style={{ fontSize: '0.73rem', color: '#94a3b8', marginBottom: '8px', fontFamily: 'monospace' }}>
        Session: <strong style={{ color: '#e2e8f0' }}>{pt.date || 'Latest'}</strong>
        {pt.stepLabel ? <span style={{ marginLeft: '6px', color: '#64748b' }}>({pt.stepLabel})</span> : null}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px', background: 'rgba(15, 23, 42, 0.7)', padding: '7px 9px', borderRadius: '6px' }}>
        <div>
          <div style={{ fontSize: '0.66rem', color: '#64748b', textTransform: 'uppercase' }}>RS-Ratio (Trend)</div>
          <div style={{ fontSize: '0.88rem', fontWeight: 800, color: pt.x >= 100 ? '#10b981' : '#f87171', fontFamily: 'monospace' }}>
            {Number(pt.x).toFixed(2)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: '0.66rem', color: '#64748b', textTransform: 'uppercase' }}>RS-Momentum</div>
          <div style={{ fontSize: '0.88rem', fontWeight: 800, color: pt.y >= 100 ? '#10b981' : '#f87171', fontFamily: 'monospace' }}>
            {Number(pt.y).toFixed(2)}
          </div>
        </div>
      </div>

      {sec && (
        <>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '7px', marginTop: '4px', fontSize: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
              <span style={{ color: '#94a3b8' }}>Last {lookback} Sess Δ Ratio / Mom:</span>
              <strong style={{ color: sec.flowScore >= 0 ? '#10b981' : '#ef4444', fontFamily: 'monospace' }}>
                {sec.dx >= 0 ? '+' : ''}{sec.dx.toFixed(1)} / {sec.dy >= 0 ? '+' : ''}{sec.dy.toFixed(1)}
              </strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '3px' }}>
              <span style={{ color: '#94a3b8' }}>RRG Vector:</span>
              <span style={{ color: sec.vector.color, fontWeight: 700, fontSize: '0.73rem' }}>
                {sec.vector.short} (Vel {sec.velocity.toFixed(1)})
              </span>
            </div>
          </div>

          {sec.opt && (
            <div style={{
              marginTop: '7px',
              paddingTop: '7px',
              borderTop: '1px solid rgba(255,255,255,0.08)',
              fontSize: '0.73rem'
            }}>
              <div style={{
                padding: '3px 7px',
                borderRadius: '5px',
                background: sec.confluence.bg,
                border: `1px solid ${sec.confluence.border}`,
                color: sec.confluence.color,
                fontWeight: 800,
                fontSize: '0.7rem',
                marginBottom: '5px'
              }}>
                {sec.confluence.badge}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'monospace', color: '#cbd5e1' }}>
                <span>Call Vol: <strong style={{ color: sec.opt.call_vol_pct >= 55 ? '#10b981' : sec.opt.call_vol_pct <= 45 ? '#f87171' : '#e2e8f0' }}>{sec.opt.call_vol_pct?.toFixed(1)}%</strong></span>
                <span>Net Δ: <strong style={{ color: sec.opt.net_delta_flow >= 0 ? '#10b981' : '#f87171' }}>{formatDollarFlow(sec.opt.net_delta_flow)}</strong></span>
                <span>GEX: <strong style={{ color: sec.opt.net_gex >= 0 ? '#10b981' : '#f87171' }}>{sec.opt.net_gex >= 0 ? '+' : ''}{sec.opt.net_gex?.toFixed(1)}M</strong></span>
              </div>
            </div>
          )}

          {sec.topStocksList && sec.topStocksList.length > 0 && (
            <div style={{ marginTop: '7px', paddingTop: '6px', borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: '0.72rem', color: '#94a3b8' }}>
              Key Leaders: <strong style={{ color: '#38bdf8' }}>{sec.topStocksList.slice(0, 4).map(s => s.ticker).join(', ')}</strong>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default function RrgMoneyFlowDashboard({
  data,
  timeframe,
  setTimeframe,
  setModalData,
  fetchTickerData,
  multiTimeframeFocusList = [],
  emergingLeadersList = []
}) {
  const [lookback, setLookback] = useState(3); // 1, 3, 5, 10 sessions
  const [tailLength, setTailLength] = useState(5); // 3, 5, 8, 15 trail points on chart
  const [quickFilter, setQuickFilter] = useState('ALL');
  const [hiddenLines, setHiddenLines] = useState({});
  const [hoveredSector, setHoveredSector] = useState(null);
  const [selectedInspectorName, setSelectedInspectorName] = useState(null);
  const [tableSortField, setTableSortField] = useState('flowScore');
  const [tableSortAsc, setTableSortAsc] = useState(false);
  const [tableSearch, setTableSearch] = useState('');
  const [optionsMap, setOptionsMap] = useState({});
  const [optionsSyncDate, setOptionsSyncDate] = useState(null);

  // Fetch live institutional options telemetry for all 27 ETFs and their component stocks
  useEffect(() => {
    let mounted = true;
    fetch('/api/options_screener/summary')
      .then(res => (res.ok ? res.json() : null))
      .then(json => {
        if (!mounted || !json || !Array.isArray(json.records)) return;
        const map = {};
        json.records.forEach(r => {
          if (r && r.ticker) map[r.ticker] = r;
        });
        setOptionsMap(map);
        setOptionsSyncDate(json.latest_date || null);
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, []);

  const rrgData = useMemo(() => (data?.rrg?.[timeframe] || []), [data, timeframe]);

  // Compute rich multi-session telemetry + Options Flow Confluence/Divergence for every sector
  const telemetryList = useMemo(() => {
    const monthlyMap = new Map((data?.rrg?.monthly || []).map(s => [s.ticker, s]));
    const weeklyMap = new Map((data?.rrg?.weekly || []).map(s => [s.ticker, s]));
    const dailyMap = new Map((data?.rrg?.daily || []).map(s => [s.ticker, s]));
    const intraMap = new Map((data?.rrg?.intraday || []).map(s => [s.ticker, s]));

    const sortedByRatio = [...rrgData].sort((a, b) => {
      const ax = a.trail?.[a.trail.length - 1]?.x || 0;
      const bx = b.trail?.[b.trail.length - 1]?.x || 0;
      return bx - ax;
    });
    const rankMap = new Map(sortedByRatio.map((s, idx) => [s.name, idx + 1]));

    return rrgData.map((sec, idx) => {
      const trail = sec.trail || [];
      const len = trail.length;
      const cur = len > 0 ? trail[len - 1] : { x: 100, y: 100, date: '' };
      const prevIdx = Math.max(0, len - 1 - lookback);
      const prev = len > 0 ? trail[prevIdx] : cur;
      const prev1 = len > 1 ? trail[len - 2] : cur;

      const dx = cur.x - prev.x;
      const dy = cur.y - prev.y;
      const dx1 = cur.x - prev1.x;
      const dy1 = cur.y - prev1.y;

      const velocity = Math.sqrt(dx * dx + dy * dy);
      const prev2 = len > 2 ? trail[len - 3] : prev1;
      const recentStepSpeed = Math.sqrt(dx1 * dx1 + dy1 * dy1);
      const priorStepSpeed = Math.sqrt(Math.pow(prev1.x - prev2.x, 2) + Math.pow(prev1.y - prev2.y, 2));
      const acceleration = recentStepSpeed - priorStepSpeed;

      const flowScore = (dx * 0.55) + (dy * 0.45);

      const curQuad = getQuadrant(cur.x, cur.y);
      const prevQuad = getQuadrant(prev.x, prev.y);
      const hasCrossover = curQuad !== prevQuad;

      let crossoverDetail = null;
      if (hasCrossover && len >= 2) {
        for (let i = len - 1; i > prevIdx; i--) {
          const qNow = getQuadrant(trail[i].x, trail[i].y);
          const qBefore = getQuadrant(trail[i - 1].x, trail[i - 1].y);
          if (qNow !== qBefore) {
            const sessionsAgo = (len - 1) - i;
            crossoverDetail = {
              from: qBefore,
              to: qNow,
              date: trail[i].date,
              sessionsAgo
            };
            break;
          }
        }
      }

      const getLatestQuad = (mapObj) => {
        const item = mapObj.get(sec.ticker);
        if (!item || !item.trail || !item.trail.length) return 'Unknown';
        const last = item.trail[item.trail.length - 1];
        return getQuadrant(last.x, last.y);
      };

      const mQuad = getLatestQuad(monthlyMap);
      const wQuad = getLatestQuad(weeklyMap);
      const dQuad = getLatestQuad(dailyMap);
      const iQuad = getLatestQuad(intraMap);

      const vector = getVectorClassification(dx, dy);
      const basket = BASKET_MAP[sec.ticker] || 'Cyclicals & Financials';
      const color = COLORS[idx % COLORS.length];

      // Options telemetry for the sector ETF
      const opt = optionsMap[sec.ticker] || null;
      const confluence = classifyOptionsConfluence(curQuad, dx, dy, flowScore, opt);

      // Enrich component stocks with their own options telemetry
      const topStocksList = (sec.top_stocks || []).map(st => ({
        ...st,
        opt: optionsMap[st.ticker] || null
      }));

      return {
        ...sec,
        color,
        basket,
        rank: rankMap.get(sec.name) || 99,
        x: cur.x,
        y: cur.y,
        latestDate: cur.date,
        prevX: prev.x,
        prevY: prev.y,
        prevDate: prev.date,
        dx,
        dy,
        velocity,
        acceleration,
        flowScore,
        curQuad,
        prevQuad,
        hasCrossover,
        crossoverDetail,
        mQuad,
        wQuad,
        dQuad,
        iQuad,
        vector,
        opt,
        callVolPct: opt?.call_vol_pct ?? 50,
        pcrVol: opt?.pcr_vol ?? 1,
        netDeltaFlow: opt?.net_delta_flow ?? 0,
        netGex: opt?.net_gex ?? 0,
        netCallOi5d: opt?.net_call_acc_5d ?? 0,
        confluence,
        topStocksList,
        topStocksStr: topStocksList.slice(0, 3).map(s => s.ticker).join(', ')
      };
    });
  }, [rrgData, data, lookback, optionsMap]);

  // Under-the-Hood Multi-Session Synthesis + Options Divergence Categorization
  const underHoodSummary = useMemo(() => {
    if (!telemetryList.length) return null;

    const byFlowDesc = [...telemetryList].sort((a, b) => b.flowScore - a.flowScore);
    const topInflows = byFlowDesc.slice(0, 5);
    const topOutflows = [...byFlowDesc].reverse().slice(0, 5);

    const crossovers = telemetryList
      .filter(s => s.hasCrossover && s.crossoverDetail)
      .sort((a, b) => Math.abs(b.flowScore) - Math.abs(a.flowScore));

    // Options Confluence & Divergence Buckets
    const bearishDivergences = telemetryList
      .filter(s => s.confluence.type === 'BEARISH_DIVERGENCE')
      .sort((a, b) => a.netDeltaFlow - b.netDeltaFlow);

    const bullishDivergences = telemetryList
      .filter(s => s.confluence.type === 'BULLISH_DIVERGENCE')
      .sort((a, b) => b.netDeltaFlow - a.netDeltaFlow);

    const confirmedBullish = telemetryList
      .filter(s => s.confluence.type === 'CONFIRMED_BULLISH')
      .sort((a, b) => b.flowScore - a.flowScore);

    const confirmedBearish = telemetryList
      .filter(s => s.confluence.type === 'CONFIRMED_BEARISH')
      .sort((a, b) => a.flowScore - b.flowScore);

    const quadCounts = { Leading: 0, Improving: 0, Weakening: 0, Lagging: 0 };
    telemetryList.forEach(s => {
      if (quadCounts[s.curQuad] !== undefined) quadCounts[s.curQuad] += 1;
    });

    const basketNames = ['Growth & Tech', 'Cyclicals & Financials', 'Defensive & Yield', 'Hard Assets & Energy'];
    const baskets = basketNames.map(bName => {
      const members = telemetryList.filter(s => s.basket === bName);
      const count = members.length || 1;
      const avgDx = members.reduce((acc, s) => acc + s.dx, 0) / count;
      const avgDy = members.reduce((acc, s) => acc + s.dy, 0) / count;
      const avgFlow = members.reduce((acc, s) => acc + s.flowScore, 0) / count;
      const totalNetDelta = members.reduce((acc, s) => acc + (s.netDeltaFlow || 0), 0);
      const avgCallPct = members.reduce((acc, s) => acc + (s.callVolPct || 50), 0) / count;
      const bullishCount = members.filter(s => s.curQuad === 'Leading' || s.curQuad === 'Improving').length;
      const bestMember = [...members].sort((a, b) => b.flowScore - a.flowScore)[0];
      const worstMember = [...members].sort((a, b) => a.flowScore - b.flowScore)[0];

      return {
        name: bName,
        color: BASKET_COLORS[bName],
        members,
        avgDx,
        avgDy,
        avgFlow,
        totalNetDelta,
        avgCallPct,
        bullishCount,
        totalCount: members.length,
        bestMember,
        worstMember
      };
    }).sort((a, b) => b.avgFlow - a.avgFlow);

    const growthBasket = baskets.find(b => b.name === 'Growth & Tech');
    const cycBasket = baskets.find(b => b.name === 'Cyclicals & Financials');
    const defBasket = baskets.find(b => b.name === 'Defensive & Yield');
    const hardBasket = baskets.find(b => b.name === 'Hard Assets & Energy');

    const offensiveFlow = ((growthBasket?.avgFlow || 0) + (cycBasket?.avgFlow || 0)) / 2;
    const defensiveFlow = ((defBasket?.avgFlow || 0) + (hardBasket?.avgFlow || 0)) / 2;
    const netRiskSpread = offensiveFlow - defensiveFlow;

    let rotationRegime = 'BALANCED SECTOR ROTATION';
    let rotationColor = '#38bdf8';
    if (netRiskSpread > 3.5) {
      rotationRegime = 'RISK-ON OFFENSIVE ACCUMULATION';
      rotationColor = '#10b981';
    } else if (netRiskSpread < -3.5) {
      rotationRegime = 'DEFENSIVE / HARD-ASSET ROTATION SHIELD';
      rotationColor = '#f59e0b';
    }

    return {
      topInflows,
      topOutflows,
      crossovers,
      bearishDivergences,
      bullishDivergences,
      confirmedBullish,
      confirmedBearish,
      quadCounts,
      baskets,
      offensiveFlow,
      defensiveFlow,
      netRiskSpread,
      rotationRegime,
      rotationColor
    };
  }, [telemetryList]);

  // 4-Stage Rotation Lifecycle buckets
  const lifecycleBuckets = useMemo(() => {
    const stealthAccumulation = [];
    const dominantExpansion = [];
    const distributionWarning = [];
    const structuralDrag = [];

    telemetryList.forEach(sec => {
      if ((sec.curQuad === 'Improving' && sec.dy >= -1) || (sec.curQuad === 'Lagging' && sec.dy >= 3.0)) {
        stealthAccumulation.push(sec);
      } else if (sec.curQuad === 'Leading' && sec.dy >= -2.5) {
        dominantExpansion.push(sec);
      } else if (sec.curQuad === 'Weakening' || (sec.curQuad === 'Leading' && sec.dy < -2.5)) {
        distributionWarning.push(sec);
      } else {
        structuralDrag.push(sec);
      }
    });

    stealthAccumulation.sort((a, b) => b.dy - a.dy);
    dominantExpansion.sort((a, b) => b.flowScore - a.flowScore);
    distributionWarning.sort((a, b) => a.dy - b.dy);
    structuralDrag.sort((a, b) => a.flowScore - b.flowScore);

    return { stealthAccumulation, dominantExpansion, distributionWarning, structuralDrag };
  }, [telemetryList]);

  // Multi-Timeframe Playbook
  const multiTimeframePlaybooks = useMemo(() => {
    const pullbackBuys = [];
    const emergingLeaders = [];
    const exhaustionWarnings = [];
    const fullThrottle = [];

    telemetryList.forEach(sec => {
      const { mQuad, wQuad, dQuad } = sec;
      const item = {
        ...sec,
        status: `[M: ${mQuad}] [W: ${wQuad}] [D: ${dQuad}]`
      };
      if ((mQuad === 'Leading' || mQuad === 'Improving') && wQuad === 'Leading' && (dQuad === 'Weakening' || dQuad === 'Lagging')) {
        pullbackBuys.push(item);
      } else if ((mQuad === 'Lagging' || mQuad === 'Improving') && (wQuad === 'Improving' || wQuad === 'Leading') && dQuad === 'Leading') {
        emergingLeaders.push(item);
      } else if (mQuad === 'Leading' && (wQuad === 'Weakening' || wQuad === 'Lagging') && dQuad === 'Lagging') {
        exhaustionWarnings.push(item);
      } else if (mQuad === 'Leading' && wQuad === 'Leading' && dQuad === 'Leading') {
        fullThrottle.push(item);
      }
    });

    return { pullbackBuys, emergingLeaders, exhaustionWarnings, fullThrottle };
  }, [telemetryList]);

  // Selected sector for the Right-Hand Under-the-Hood Inspector
  const inspectedSector = useMemo(() => {
    if (!telemetryList.length) return null;
    if (hoveredSector) {
      const hovered = telemetryList.find(s => s.name === hoveredSector);
      if (hovered) return hovered;
    }
    if (selectedInspectorName) {
      const found = telemetryList.find(s => s.name === selectedInspectorName);
      if (found) return found;
    }
    return underHoodSummary?.topInflows?.[0] || telemetryList[0];
  }, [telemetryList, hoveredSector, selectedInspectorName, underHoodSummary]);

  // Filter visible sectors on RRG canvas
  const isSectorVisibleOnChart = (sec) => {
    if (hiddenLines[sec.name]) return false;
    if (quickFilter === 'ALL' || quickFilter === 'GRID') return true;
    if (quickFilter === 'TOP5') return sec.rank <= 5;
    if (quickFilter === 'INFLOW_SURGE') {
      return underHoodSummary?.topInflows?.some(x => x.name === sec.name);
    }
    if (quickFilter === 'CROSSOVERS') return sec.hasCrossover;
    if (quickFilter === 'OPT_DIVERGENCE') return sec.confluence?.isDivergence;
    if (quickFilter === 'OPT_CONFIRMED') return sec.confluence?.isConfirmed;
    if (quickFilter === 'GROWTH') return sec.basket === 'Growth & Tech';
    if (quickFilter === 'CYCLICALS') return sec.basket === 'Cyclicals & Financials';
    if (quickFilter === 'DEFENSIVE') return sec.basket === 'Defensive & Yield';
    if (quickFilter === 'HARD_ASSETS') return sec.basket === 'Hard Assets & Energy';
    return true;
  };

  // Sorted & searched table rows
  const sortedTableRows = useMemo(() => {
    const q = tableSearch.trim().toLowerCase();
    const filtered = telemetryList.filter(sec => {
      if (!q) return true;
      return (
        sec.name.toLowerCase().includes(q) ||
        sec.ticker.toLowerCase().includes(q) ||
        sec.basket.toLowerCase().includes(q) ||
        sec.curQuad.toLowerCase().includes(q) ||
        sec.topStocksStr.toLowerCase().includes(q) ||
        (sec.confluence?.shortBadge || '').toLowerCase().includes(q)
      );
    });

    return filtered.sort((a, b) => {
      const av = a[tableSortField] ?? 0;
      const bv = b[tableSortField] ?? 0;
      return tableSortAsc ? av - bv : bv - av;
    });
  }, [telemetryList, tableSearch, tableSortField, tableSortAsc]);

  const handleSortClick = (field) => {
    if (tableSortField === field) {
      setTableSortAsc(!tableSortAsc);
    } else {
      setTableSortField(field);
      setTableSortAsc(field === 'rank');
    }
  };

  const toggleLine = (name) => {
    setHiddenLines(prev => ({ ...prev, [name]: !prev[name] }));
  };

  const timeframeLabel = {
    intraday: 'Intraday (15m Bars)',
    daily: 'Daily (Short-Term Sessions)',
    weekly: 'Weekly (Medium-Term Swing)',
    monthly: 'Monthly (Macro Structural)'
  }[timeframe] || timeframe;

  const sessionUnit = timeframe === 'intraday' ? 'Bars (15m)' : 'Sessions';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

      {/* =====================================================================
          1. TOP COMMAND HEADER & MULTI-SESSION + OPTIONS CONFLUENCE CONTROLS
      ===================================================================== */}
      <div className="glass-card" style={{
        padding: '18px 22px',
        background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.92) 0%, rgba(9, 13, 22, 0.98) 100%)',
        border: '1px solid rgba(56, 189, 248, 0.25)',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.45)'
      }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
          <div>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
              <span style={{
                background: 'rgba(56, 189, 248, 0.15)',
                border: '1px solid rgba(56, 189, 248, 0.4)',
                color: '#38bdf8',
                padding: '3px 9px',
                borderRadius: '6px',
                fontSize: '0.7rem',
                fontWeight: 800,
                letterSpacing: '0.08em'
              }}>
                JDK RRG + OPTIONS DEALER FLOW CONFLUENCE
              </span>
              {underHoodSummary && (
                <span style={{
                  background: `${underHoodSummary.rotationColor}20`,
                  border: `1px solid ${underHoodSummary.rotationColor}66`,
                  color: underHoodSummary.rotationColor,
                  padding: '3px 10px',
                  borderRadius: '6px',
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  letterSpacing: '0.06em'
                }}>
                  {underHoodSummary.rotationRegime}
                </span>
              )}
              {optionsSyncDate && (
                <span style={{
                  background: 'rgba(16, 185, 129, 0.14)',
                  border: '1px solid rgba(16, 185, 129, 0.35)',
                  color: '#10b981',
                  padding: '3px 9px',
                  borderRadius: '6px',
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  fontFamily: 'monospace'
                }}>
                  OPTIONS GEX/Δ SYNC: {optionsSyncDate}
                </span>
              )}
            </div>
            <h1 style={{ margin: '6px 0 2px 0', fontSize: '1.45rem', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Compass size={22} color="#38bdf8" /> Institutional RRG Rotation & Options Flow Divergence Center
            </h1>
            <p style={{ margin: 0, fontSize: '0.84rem', color: '#94a3b8' }}>
              Cross-verifies multi-session RRG equity rotation (ΔX, ΔY) against live Options Dealer Net Delta ($Δ), Call/Put Volume, 5D Call OI, and Net GEX across all 27 ETFs.
            </p>
          </div>

          {/* Timeframe + Lookback + Trail Tail Controls */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
            <div style={{
              display: 'flex',
              background: 'rgba(9, 13, 22, 0.85)',
              padding: '4px',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.08)'
            }}>
              {[
                { id: 'intraday', label: '15m Intraday' },
                { id: 'daily', label: 'Daily' },
                { id: 'weekly', label: 'Weekly' },
                { id: 'monthly', label: 'Monthly' }
              ].map(tf => (
                <button
                  key={tf.id}
                  onClick={() => { setTimeframe(tf.id); setHiddenLines({}); }}
                  style={{
                    background: timeframe === tf.id ? 'linear-gradient(135deg, #0284c7, #2563eb)' : 'transparent',
                    color: timeframe === tf.id ? '#fff' : '#94a3b8',
                    border: 'none',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  {tf.label}
                </button>
              ))}
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              background: 'rgba(9, 13, 22, 0.85)',
              padding: '4px 8px',
              borderRadius: '8px',
              border: '1px solid rgba(16, 185, 129, 0.25)'
            }}>
              <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 700, marginRight: '4px', textTransform: 'uppercase' }}>
                Flow Delta:
              </span>
              {[1, 3, 5, 10].map(n => (
                <button
                  key={n}
                  onClick={() => setLookback(n)}
                  style={{
                    background: lookback === n ? 'rgba(16, 185, 129, 0.22)' : 'transparent',
                    color: lookback === n ? '#10b981' : '#94a3b8',
                    border: lookback === n ? '1px solid rgba(16, 185, 129, 0.5)' : '1px solid transparent',
                    padding: '4px 8px',
                    borderRadius: '5px',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    fontFamily: 'monospace'
                  }}
                >
                  {n}S
                </button>
              ))}
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              background: 'rgba(9, 13, 22, 0.85)',
              padding: '4px 8px',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.08)'
            }}>
              <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 700, marginRight: '4px', textTransform: 'uppercase' }}>
                Trail Tail:
              </span>
              {[3, 5, 8, 15].map(t => (
                <button
                  key={t}
                  onClick={() => setTailLength(t)}
                  style={{
                    background: tailLength === t ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
                    color: tailLength === t ? '#38bdf8' : '#94a3b8',
                    border: tailLength === t ? '1px solid rgba(56, 189, 248, 0.45)' : '1px solid transparent',
                    padding: '4px 8px',
                    borderRadius: '5px',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    fontFamily: 'monospace'
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Executive "Under the Hood" Narrative Synthesis */}
        {underHoodSummary && (
          <div style={{
            background: 'rgba(15, 23, 42, 0.75)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderLeft: `4px solid ${underHoodSummary.rotationColor}`,
            borderRadius: '8px',
            padding: '12px 16px',
            marginBottom: '16px',
            display: 'grid',
            gridTemplateColumns: '1.8fr 1fr',
            gap: '16px',
            alignItems: 'center'
          }}>
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '4px' }}>
                🔍 Under-the-Hood Equity + Options Synthesis (Last {lookback} {sessionUnit})
              </div>
              <div style={{ fontSize: '0.85rem', color: '#e2e8f0', lineHeight: 1.55 }}>
                Over the last <strong>{lookback} {sessionUnit.toLowerCase()}</strong>, RRG velocity surged in{' '}
                <strong style={{ color: '#10b981' }}>
                  {underHoodSummary.topInflows.slice(0, 3).map(s => `${s.name} (${s.ticker})`).join(', ')}
                </strong>
                {' '}while bleeding in{' '}
                <strong style={{ color: '#f87171' }}>
                  {underHoodSummary.topOutflows.slice(0, 3).map(s => `${s.name} (${s.ticker})`).join(', ')}
                </strong>.
                {underHoodSummary.bearishDivergences.length > 0 && (
                  <span>
                    {' '}⚠️ <strong>Hollow Rally Alert:</strong>{' '}
                    <span style={{ color: '#fbbf24', fontWeight: 700 }}>
                      {underHoodSummary.bearishDivergences.slice(0, 3).map(s => `${s.ticker} (${s.callVolPct.toFixed(0)}% Call / ${formatDollarFlow(s.netDeltaFlow)} Δ)`).join(', ')}
                    </span>{' '}
                    are Leading on RRG but facing heavy institutional put hedging.
                  </span>
                )}
                {underHoodSummary.bullishDivergences.length > 0 && (
                  <span>
                    {' '}🎣 <strong>Smart-Money Dip Buying:</strong>{' '}
                    <span style={{ color: '#38bdf8', fontWeight: 700 }}>
                      {underHoodSummary.bullishDivergences.slice(0, 3).map(s => `${s.ticker} (${s.callVolPct.toFixed(0)}% Call / ${formatDollarFlow(s.netDeltaFlow)} Δ)`).join(', ')}
                    </span>{' '}
                    are pulling back on RRG while institutions aggressively accumulate calls.
                  </span>
                )}
              </div>
            </div>

            {/* Offensive vs Defensive Capital Flow Tug-of-War Meter */}
            <div style={{
              background: 'rgba(9, 13, 22, 0.75)',
              padding: '10px 14px',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.06)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', fontWeight: 700, marginBottom: '6px' }}>
                <span style={{ color: '#38bdf8' }}>⚡ Offensive Flow: {underHoodSummary.offensiveFlow >= 0 ? '+' : ''}{underHoodSummary.offensiveFlow.toFixed(1)}</span>
                <span style={{ color: '#10b981' }}>🛡️ Defensive/Hard Flow: {underHoodSummary.defensiveFlow >= 0 ? '+' : ''}{underHoodSummary.defensiveFlow.toFixed(1)}</span>
              </div>
              {(() => {
                const clamped = Math.max(-20, Math.min(20, underHoodSummary.netRiskSpread));
                const offPct = Math.round(50 + (clamped / 20) * 40);
                return (
                  <div style={{ width: '100%', height: '8px', background: 'rgba(16, 185, 129, 0.35)', borderRadius: '999px', overflow: 'hidden', display: 'flex' }}>
                    <div style={{ width: `${offPct}%`, background: 'linear-gradient(90deg, #0284c7, #38bdf8)', height: '100%', transition: 'width 0.3s ease' }} />
                  </div>
                );
              })()}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: '#94a3b8', marginTop: '5px' }}>
                <span>Confirmed: <strong style={{ color: '#10b981' }}>{underHoodSummary.confirmedBullish.length + underHoodSummary.confirmedBearish.length}</strong></span>
                <span>Bear Div: <strong style={{ color: '#f59e0b' }}>{underHoodSummary.bearishDivergences.length}</strong></span>
                <span>Bull Div: <strong style={{ color: '#38bdf8' }}>{underHoodSummary.bullishDivergences.length}</strong></span>
                <span>Crossovers: <strong style={{ color: '#a855f7' }}>{underHoodSummary.crossovers.length}</strong></span>
              </div>
            </div>
          </div>
        )}

        {/* 4 Institutional Capital Basket Telemetry Cards */}
        {underHoodSummary && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '12px' }}>
            {underHoodSummary.baskets.map((b, i) => {
              const isPos = b.avgFlow >= 0;
              return (
                <div
                  key={b.name}
                  onClick={() => {
                    const filterKey = {
                      'Growth & Tech': 'GROWTH',
                      'Cyclicals & Financials': 'CYCLICALS',
                      'Defensive & Yield': 'DEFENSIVE',
                      'Hard Assets & Energy': 'HARD_ASSETS'
                    }[b.name];
                    setQuickFilter(prev => prev === filterKey ? 'ALL' : filterKey);
                  }}
                  style={{
                    cursor: 'pointer',
                    background: 'rgba(15, 23, 42, 0.72)',
                    border: `1px solid ${isPos ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.25)'}`,
                    borderTop: `3px solid ${b.color}`,
                    borderRadius: '8px',
                    padding: '11px 14px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#f8fafc' }}>
                      #{i + 1} {b.name}
                    </span>
                    <span style={{
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      fontFamily: 'monospace',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: isPos ? 'rgba(16, 185, 129, 0.16)' : 'rgba(239, 68, 68, 0.16)',
                      color: isPos ? '#10b981' : '#f87171'
                    }}>
                      RRG {b.avgFlow >= 0 ? '+' : ''}{b.avgFlow.toFixed(1)}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#94a3b8', fontFamily: 'monospace', marginBottom: '5px' }}>
                    <span>ΔRatio: <strong style={{ color: b.avgDx >= 0 ? '#10b981' : '#f87171' }}>{b.avgDx >= 0 ? '+' : ''}{b.avgDx.toFixed(1)}</strong></span>
                    <span>ΔMom: <strong style={{ color: b.avgDy >= 0 ? '#10b981' : '#f87171' }}>{b.avgDy >= 0 ? '+' : ''}{b.avgDy.toFixed(1)}</strong></span>
                    <span>Avg Call: <strong style={{ color: b.avgCallPct >= 52 ? '#10b981' : '#f59e0b' }}>{b.avgCallPct.toFixed(0)}%</strong></span>
                  </div>

                  <div style={{ fontSize: '0.71rem', color: '#64748b', display: 'flex', justifyContent: 'space-between', fontFamily: 'monospace' }}>
                    <span>Opt Net Δ: <strong style={{ color: b.totalNetDelta >= 0 ? '#10b981' : '#f87171' }}>{formatDollarFlow(b.totalNetDelta)}</strong></span>
                    <span>Top: <strong style={{ color: '#38bdf8' }}>{b.bestMember?.ticker}</strong></span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* =====================================================================
          2. OPTIONS FLOW vs. RRG ROTATION DIVERGENCE & CONFIRMATION RADAR
      ===================================================================== */}
      {underHoodSummary && (
        <div className="glass-card" style={{
          padding: '18px 20px',
          border: '1px solid rgba(245, 158, 11, 0.28)',
          background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.9) 0%, rgba(9, 13, 22, 0.95) 100%)'
        }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.15rem', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldAlert size={20} color="#f59e0b" /> RRG Equity Flow vs. Institutional Options Order Flow — Divergence & Confirmation Radar
              </h2>
              <p style={{ margin: '3px 0 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
                Exposes where options dealer delta ($Δ), Call/Put volume ratios, and 5D Open Interest either <strong>confirm</strong> or <strong>contradict</strong> the visible RRG sector trajectory.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setQuickFilter(prev => prev === 'OPT_DIVERGENCE' ? 'ALL' : 'OPT_DIVERGENCE')}
                style={{
                  background: quickFilter === 'OPT_DIVERGENCE' ? 'rgba(245, 158, 11, 0.25)' : 'rgba(15, 23, 42, 0.8)',
                  color: '#fbbf24',
                  border: '1px solid rgba(245, 158, 11, 0.45)',
                  borderRadius: '6px',
                  padding: '5px 11px',
                  fontSize: '0.74rem',
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                {quickFilter === 'OPT_DIVERGENCE' ? 'Showing Divergences on RRG ✓' : 'Isolate Divergences on RRG'}
              </button>
              <button
                onClick={() => setQuickFilter(prev => prev === 'OPT_CONFIRMED' ? 'ALL' : 'OPT_CONFIRMED')}
                style={{
                  background: quickFilter === 'OPT_CONFIRMED' ? 'rgba(16, 185, 129, 0.25)' : 'rgba(15, 23, 42, 0.8)',
                  color: '#10b981',
                  border: '1px solid rgba(16, 185, 129, 0.45)',
                  borderRadius: '6px',
                  padding: '5px 11px',
                  fontSize: '0.74rem',
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                {quickFilter === 'OPT_CONFIRMED' ? 'Showing Confirmed on RRG ✓' : 'Isolate Confirmed on RRG'}
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: '14px' }}>

            {/* Card 1: Bearish Options Divergence (Hollow Rally / Put Hedging into Strength) */}
            <div style={{
              background: 'rgba(245, 158, 11, 0.07)',
              border: '1px solid rgba(245, 158, 11, 0.35)',
              borderRadius: '10px',
              padding: '14px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <h3 style={{ margin: 0, fontSize: '0.92rem', color: '#fbbf24' }}>
                  ⚠️ Bearish Divergence (Put Hedge into Strength)
                </h3>
                <span style={{ fontSize: '0.68rem', background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', padding: '2px 7px', borderRadius: '999px', fontWeight: 800 }}>
                  {underHoodSummary.bearishDivergences.length} ALERTS
                </span>
              </div>
              <p style={{ fontSize: '0.74rem', color: '#94a3b8', marginBottom: '10px' }}>
                Sector is <strong>Leading/Improving on RRG</strong>, but options flow shows heavy Put buying & negative Net Delta (institutions hedging or distributing into strength).
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', maxHeight: '260px', overflowY: 'auto' }}>
                {underHoodSummary.bearishDivergences.length === 0 ? (
                  <span style={{ fontSize: '0.78rem', color: '#64748b' }}>No hollow-rally put divergences detected.</span>
                ) : (
                  underHoodSummary.bearishDivergences.map(sec => (
                    <div
                      key={sec.name}
                      onClick={() => { setSelectedInspectorName(sec.name); setModalData(sec); }}
                      onMouseEnter={() => setHoveredSector(sec.name)}
                      onMouseLeave={() => setHoveredSector(null)}
                      style={{
                        cursor: 'pointer',
                        background: 'rgba(15, 23, 42, 0.78)',
                        border: '1px solid rgba(245, 158, 11, 0.3)',
                        borderRadius: '7px',
                        padding: '8px 10px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
                        <strong style={{ color: '#f8fafc' }}>{sec.name} <span style={{ color: '#fbbf24', fontFamily: 'monospace' }}>({sec.ticker})</span></strong>
                        <span style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 700 }}>RRG: {sec.curQuad}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', fontFamily: 'monospace', color: '#f87171', marginTop: '3px', fontWeight: 700 }}>
                        <span>Calls: {sec.callVolPct.toFixed(1)}% (PCR {sec.pcrVol.toFixed(2)})</span>
                        <span>Net Δ: {formatDollarFlow(sec.netDeltaFlow)}</span>
                      </div>
                      <div style={{ fontSize: '0.69rem', color: '#94a3b8', marginTop: '3px' }}>
                        5D Call OI: <strong style={{ color: sec.netCallOi5d >= 0 ? '#10b981' : '#f87171' }}>{formatSignedInt(sec.netCallOi5d)}</strong> • GEX: <strong>{sec.netGex >= 0 ? '+' : ''}{sec.netGex.toFixed(1)}M</strong>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Card 2: Bullish Options Divergence (Smart-Money Call Buying on RRG Pullback) */}
            <div style={{
              background: 'rgba(56, 189, 248, 0.07)',
              border: '1px solid rgba(56, 189, 248, 0.35)',
              borderRadius: '10px',
              padding: '14px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <h3 style={{ margin: 0, fontSize: '0.92rem', color: '#38bdf8' }}>
                  🎣 Bullish Divergence (Call Buying on RRG Dip)
                </h3>
                <span style={{ fontSize: '0.68rem', background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', padding: '2px 7px', borderRadius: '999px', fontWeight: 800 }}>
                  {underHoodSummary.bullishDivergences.length} SIGNALS
                </span>
              </div>
              <p style={{ fontSize: '0.74rem', color: '#94a3b8', marginBottom: '10px' }}>
                Sector is <strong>pulling back or Lagging on RRG</strong>, but smart-money options traders are sweeping Calls & forcing positive dealer delta buying.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', maxHeight: '260px', overflowY: 'auto' }}>
                {underHoodSummary.bullishDivergences.length === 0 ? (
                  <span style={{ fontSize: '0.78rem', color: '#64748b' }}>No smart-money dip call divergences detected.</span>
                ) : (
                  underHoodSummary.bullishDivergences.map(sec => (
                    <div
                      key={sec.name}
                      onClick={() => { setSelectedInspectorName(sec.name); setModalData(sec); }}
                      onMouseEnter={() => setHoveredSector(sec.name)}
                      onMouseLeave={() => setHoveredSector(null)}
                      style={{
                        cursor: 'pointer',
                        background: 'rgba(15, 23, 42, 0.78)',
                        border: '1px solid rgba(56, 189, 248, 0.3)',
                        borderRadius: '7px',
                        padding: '8px 10px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
                        <strong style={{ color: '#f8fafc' }}>{sec.name} <span style={{ color: '#38bdf8', fontFamily: 'monospace' }}>({sec.ticker})</span></strong>
                        <span style={{ fontSize: '0.7rem', color: '#f59e0b', fontFamily: 'monospace' }}>RRG ΔMom: {sec.dy.toFixed(1)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', fontFamily: 'monospace', color: '#10b981', marginTop: '3px', fontWeight: 700 }}>
                        <span>Calls: {sec.callVolPct.toFixed(1)}% (PCR {sec.pcrVol.toFixed(2)})</span>
                        <span>Net Δ: {formatDollarFlow(sec.netDeltaFlow)}</span>
                      </div>
                      <div style={{ fontSize: '0.69rem', color: '#94a3b8', marginTop: '3px' }}>
                        5D Call OI: <strong style={{ color: sec.netCallOi5d >= 0 ? '#10b981' : '#cbd5e1' }}>{formatSignedInt(sec.netCallOi5d)}</strong> • Signal: <strong style={{ color: '#38bdf8' }}>{sec.opt?.flow_signal_badge || 'Call Inflow'}</strong>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Card 3: Confirmed Bullish Confluence (RRG + Options Call Alignment) */}
            <div style={{
              background: 'rgba(16, 185, 129, 0.07)',
              border: '1px solid rgba(16, 185, 129, 0.35)',
              borderRadius: '10px',
              padding: '14px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <h3 style={{ margin: 0, fontSize: '0.92rem', color: '#10b981' }}>
                  ✅ Confirmed Bullish (RRG + Options Aligned)
                </h3>
                <span style={{ fontSize: '0.68rem', background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', padding: '2px 7px', borderRadius: '999px', fontWeight: 800 }}>
                  {underHoodSummary.confirmedBullish.length} CONFIRMED
                </span>
              </div>
              <p style={{ fontSize: '0.74rem', color: '#94a3b8', marginBottom: '10px' }}>
                Highest-conviction leadership: RRG trend/momentum is expanding <strong>AND</strong> options dealers are net buying underlying shares on call flow.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', maxHeight: '260px', overflowY: 'auto' }}>
                {underHoodSummary.confirmedBullish.length === 0 ? (
                  <span style={{ fontSize: '0.78rem', color: '#64748b' }}>No sectors currently have dual bullish confirmation.</span>
                ) : (
                  underHoodSummary.confirmedBullish.map(sec => (
                    <div
                      key={sec.name}
                      onClick={() => { setSelectedInspectorName(sec.name); setModalData(sec); }}
                      onMouseEnter={() => setHoveredSector(sec.name)}
                      onMouseLeave={() => setHoveredSector(null)}
                      style={{
                        cursor: 'pointer',
                        background: 'rgba(15, 23, 42, 0.78)',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        borderRadius: '7px',
                        padding: '8px 10px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
                        <strong style={{ color: '#f8fafc' }}>{sec.name} <span style={{ color: '#10b981', fontFamily: 'monospace' }}>({sec.ticker})</span></strong>
                        <span style={{ fontSize: '0.7rem', color: '#10b981', fontFamily: 'monospace', fontWeight: 700 }}>
                          RRG Δ: {sec.flowScore >= 0 ? '+' : ''}{sec.flowScore.toFixed(1)}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', fontFamily: 'monospace', color: '#10b981', marginTop: '3px', fontWeight: 700 }}>
                        <span>Calls: {sec.callVolPct.toFixed(1)}% (PCR {sec.pcrVol.toFixed(2)})</span>
                        <span>Net Δ: {formatDollarFlow(sec.netDeltaFlow)}</span>
                      </div>
                      <div style={{ fontSize: '0.69rem', color: '#94a3b8', marginTop: '3px' }}>
                        GEX: <strong style={{ color: sec.netGex >= 0 ? '#10b981' : '#f59e0b' }}>{sec.netGex >= 0 ? '+' : ''}{sec.netGex.toFixed(1)}M</strong> • Leaders: <strong style={{ color: '#38bdf8' }}>{sec.topStocksStr}</strong>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Card 4: Confirmed Bearish Breakdown (RRG Outflow + Put/Negative GEX Cascade) */}
            <div style={{
              background: 'rgba(239, 68, 68, 0.07)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              borderRadius: '10px',
              padding: '14px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <h3 style={{ margin: 0, fontSize: '0.92rem', color: '#f87171' }}>
                  🩸 Confirmed Bearish (RRG + Put/Neg-GEX Cascade)
                </h3>
                <span style={{ fontSize: '0.68rem', background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', padding: '2px 7px', borderRadius: '999px', fontWeight: 800 }}>
                  {underHoodSummary.confirmedBearish.length} BREAKDOWNS
                </span>
              </div>
              <p style={{ fontSize: '0.74rem', color: '#94a3b8', marginBottom: '10px' }}>
                Maximum institutional pressure: RRG relative strength is collapsing <strong>AND</strong> options dealers face heavy put sweeps / negative gamma.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', maxHeight: '260px', overflowY: 'auto' }}>
                {underHoodSummary.confirmedBearish.length === 0 ? (
                  <span style={{ fontSize: '0.78rem', color: '#64748b' }}>No confirmed dual-bearish breakdowns.</span>
                ) : (
                  underHoodSummary.confirmedBearish.map(sec => (
                    <div
                      key={sec.name}
                      onClick={() => { setSelectedInspectorName(sec.name); setModalData(sec); }}
                      onMouseEnter={() => setHoveredSector(sec.name)}
                      onMouseLeave={() => setHoveredSector(null)}
                      style={{
                        cursor: 'pointer',
                        background: 'rgba(15, 23, 42, 0.78)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: '7px',
                        padding: '8px 10px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
                        <strong style={{ color: '#f8fafc' }}>{sec.name} <span style={{ color: '#f87171', fontFamily: 'monospace' }}>({sec.ticker})</span></strong>
                        <span style={{ fontSize: '0.7rem', color: '#f87171', fontFamily: 'monospace', fontWeight: 700 }}>
                          RRG Δ: {sec.flowScore.toFixed(1)}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', fontFamily: 'monospace', color: '#f87171', marginTop: '3px', fontWeight: 700 }}>
                        <span>Calls: {sec.callVolPct.toFixed(1)}% (PCR {sec.pcrVol.toFixed(2)})</span>
                        <span>Net Δ: {formatDollarFlow(sec.netDeltaFlow)}</span>
                      </div>
                      <div style={{ fontSize: '0.69rem', color: '#94a3b8', marginTop: '3px' }}>
                        Dealer GEX: <strong style={{ color: sec.netGex < 0 ? '#ef4444' : '#cbd5e1' }}>{sec.netGex.toFixed(1)}M</strong> • 5D Call OI: <strong>{formatSignedInt(sec.netCallOi5d)}</strong>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* =====================================================================
          3. MULTI-SESSION UNDER-THE-HOOD PULSE (CROSSOVERS, SURGES, DRAINS)
      ===================================================================== */}
      {underHoodSummary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>

          {/* Panel A: Fresh Quadrant Crossovers */}
          <div className="glass-card" style={{ padding: '16px 18px', border: '1px solid rgba(56, 189, 248, 0.22)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h3 style={{ margin: 0, fontSize: '0.95rem', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '7px' }}>
                <Zap size={17} color="#38bdf8" /> Quadrant Crossovers (Last {lookback} {sessionUnit})
              </h3>
              <span style={{ fontSize: '0.72rem', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '2px 8px', borderRadius: '999px', fontWeight: 800 }}>
                {underHoodSummary.crossovers.length} Shifts
              </span>
            </div>
            <p style={{ fontSize: '0.76rem', color: '#94a3b8', margin: '0 0 10px 0' }}>
              Sectors that structurally changed RRG quadrants between {lookback} {sessionUnit.toLowerCase()} ago and today.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', maxHeight: '250px', overflowY: 'auto' }}>
              {underHoodSummary.crossovers.length === 0 ? (
                <div style={{ padding: '18px', textAlign: 'center', color: '#64748b', fontSize: '0.82rem' }}>
                  No quadrant crossovers over the last {lookback} {sessionUnit.toLowerCase()}. Try increasing Flow Delta to 5S or 10S.
                </div>
              ) : (
                underHoodSummary.crossovers.map(sec => {
                  const fromStyle = QUAD_META[sec.prevQuad] || QUAD_META.Unknown;
                  const toStyle = QUAD_META[sec.curQuad] || QUAD_META.Unknown;
                  return (
                    <div
                      key={sec.name}
                      onClick={() => { setSelectedInspectorName(sec.name); setModalData(sec); }}
                      onMouseEnter={() => setHoveredSector(sec.name)}
                      onMouseLeave={() => setHoveredSector(null)}
                      style={{
                        cursor: 'pointer',
                        background: 'rgba(15, 23, 42, 0.72)',
                        border: `1px solid ${toStyle.border}`,
                        borderRadius: '7px',
                        padding: '8px 10px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <strong style={{ color: '#f8fafc', fontSize: '0.83rem' }}>{sec.name}</strong>
                          <span style={{ color: '#38bdf8', fontSize: '0.74rem', fontFamily: 'monospace', fontWeight: 700 }}>({sec.ticker})</span>
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>
                          Crossed <span style={{ color: '#cbd5e1', fontFamily: 'monospace' }}>{sec.crossoverDetail?.date}</span> • <span style={{ color: sec.confluence.color, fontWeight: 700 }}>{sec.confluence.shortBadge}</span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span style={{ fontSize: '0.67rem', padding: '2px 6px', borderRadius: '4px', background: fromStyle.bg, color: fromStyle.color, fontWeight: 700 }}>
                          {fromStyle.short}
                        </span>
                        <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>➔</span>
                        <span style={{ fontSize: '0.67rem', padding: '2px 6px', borderRadius: '4px', background: toStyle.bg, color: toStyle.color, border: `1px solid ${toStyle.border}`, fontWeight: 800 }}>
                          {toStyle.short}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Panel B: Top 5 Multi-Session Institutional Inflow Velocity */}
          <div className="glass-card" style={{ padding: '16px 18px', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h3 style={{ margin: 0, fontSize: '0.95rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '7px' }}>
                <TrendingUp size={17} color="#10b981" /> Top RRG Inflow Velocity (Last {lookback} {sessionUnit})
              </h3>
              <span style={{ fontSize: '0.72rem', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '2px 8px', borderRadius: '999px', fontWeight: 800 }}>
                ACCUMULATION
              </span>
            </div>
            <p style={{ fontSize: '0.76rem', color: '#94a3b8', margin: '0 0 10px 0' }}>
              Sectors capturing the strongest positive RS-Ratio + RS-Momentum expansion under the hood.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
              {underHoodSummary.topInflows.map((sec, idx) => (
                <div
                  key={sec.name}
                  onClick={() => { setSelectedInspectorName(sec.name); setModalData(sec); }}
                  onMouseEnter={() => setHoveredSector(sec.name)}
                  onMouseLeave={() => setHoveredSector(null)}
                  style={{
                    cursor: 'pointer',
                    background: 'rgba(15, 23, 42, 0.72)',
                    border: '1px solid rgba(16, 185, 129, 0.22)',
                    borderRadius: '7px',
                    padding: '8px 10px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem' }}>
                    <div>
                      <span style={{ color: '#10b981', fontWeight: 800, marginRight: '6px', fontFamily: 'monospace' }}>#{idx + 1}</span>
                      <strong style={{ color: '#f8fafc' }}>{sec.name}</strong>
                      <span style={{ color: '#38bdf8', fontSize: '0.73rem', marginLeft: '5px', fontFamily: 'monospace' }}>({sec.ticker})</span>
                    </div>
                    <div style={{ fontFamily: 'monospace', fontSize: '0.76rem', fontWeight: 800, color: '#10b981' }}>
                      ΔRatio {sec.dx >= 0 ? '+' : ''}{sec.dx.toFixed(1)} | ΔMom {sec.dy >= 0 ? '+' : ''}{sec.dy.toFixed(1)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', fontSize: '0.7rem', color: '#94a3b8' }}>
                    <span style={{ color: sec.confluence.color, fontWeight: 700 }}>{sec.confluence.shortBadge}</span>
                    <span style={{ fontFamily: 'monospace' }}>Call: <strong>{sec.callVolPct.toFixed(0)}%</strong> • Net Δ: <strong style={{ color: sec.netDeltaFlow >= 0 ? '#10b981' : '#f87171' }}>{formatDollarFlow(sec.netDeltaFlow)}</strong></span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Panel C: Top 5 Multi-Session Institutional Outflow / Distribution */}
          <div className="glass-card" style={{ padding: '16px 18px', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h3 style={{ margin: 0, fontSize: '0.95rem', color: '#f87171', display: 'flex', alignItems: 'center', gap: '7px' }}>
                <TrendingDown size={17} color="#f87171" /> Heavy RRG Outflow & Rollovers (Last {lookback} {sessionUnit})
              </h3>
              <span style={{ fontSize: '0.72rem', background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', padding: '2px 8px', borderRadius: '999px', fontWeight: 800 }}>
                DISTRIBUTION
              </span>
            </div>
            <p style={{ fontSize: '0.76rem', color: '#94a3b8', margin: '0 0 10px 0' }}>
              Sectors suffering the sharpest relative trend & momentum bleed over the last {lookback} {sessionUnit.toLowerCase()}.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
              {underHoodSummary.topOutflows.map((sec, idx) => (
                <div
                  key={sec.name}
                  onClick={() => { setSelectedInspectorName(sec.name); setModalData(sec); }}
                  onMouseEnter={() => setHoveredSector(sec.name)}
                  onMouseLeave={() => setHoveredSector(null)}
                  style={{
                    cursor: 'pointer',
                    background: 'rgba(15, 23, 42, 0.72)',
                    border: '1px solid rgba(239, 68, 68, 0.22)',
                    borderRadius: '7px',
                    padding: '8px 10px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem' }}>
                    <div>
                      <span style={{ color: '#ef4444', fontWeight: 800, marginRight: '6px', fontFamily: 'monospace' }}>#{idx + 1}</span>
                      <strong style={{ color: '#f8fafc' }}>{sec.name}</strong>
                      <span style={{ color: '#f87171', fontSize: '0.73rem', marginLeft: '5px', fontFamily: 'monospace' }}>({sec.ticker})</span>
                    </div>
                    <div style={{ fontFamily: 'monospace', fontSize: '0.76rem', fontWeight: 800, color: '#f87171' }}>
                      ΔRatio {sec.dx >= 0 ? '+' : ''}{sec.dx.toFixed(1)} | ΔMom {sec.dy >= 0 ? '+' : ''}{sec.dy.toFixed(1)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', fontSize: '0.7rem', color: '#94a3b8' }}>
                    <span style={{ color: sec.confluence.color, fontWeight: 700 }}>{sec.confluence.shortBadge}</span>
                    <span style={{ fontFamily: 'monospace' }}>Call: <strong>{sec.callVolPct.toFixed(0)}%</strong> • Net Δ: <strong style={{ color: sec.netDeltaFlow >= 0 ? '#10b981' : '#f87171' }}>{formatDollarFlow(sec.netDeltaFlow)}</strong></span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* =====================================================================
          4. INTERACTIVE RRG CANVAS + LIVE UNDER-THE-HOOD SECTOR INSPECTOR
      ===================================================================== */}
      <div style={{ display: 'grid', gridTemplateColumns: quickFilter === 'GRID' ? '1fr' : '1.85fr 1.05fr', gap: '18px', alignItems: 'stretch' }}>

        {/* Left: RRG Chart Card */}
        <div className="glass-card" style={{ padding: '18px 20px', position: 'relative' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.15rem', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Activity color="#38bdf8" size={20} /> Relative Rotation Graph — {timeframeLabel}
                </h2>
                <span style={{ fontSize: '0.76rem', color: '#94a3b8' }}>
                  Showing last <strong>{tailLength}</strong> trail points per sector • Hover or click any sector for Options GEX/Δ & Trail Ledger
                </span>
              </div>

              {/* Direct Timeframe Switcher on RRG Graph Card (including 15m Intraday) */}
              <div style={{
                display: 'flex',
                background: 'rgba(9, 13, 22, 0.9)',
                padding: '3px',
                borderRadius: '8px',
                border: '1px solid rgba(56, 189, 248, 0.3)'
              }}>
                {[
                  { id: 'intraday', label: '⚡ 15m Intraday' },
                  { id: 'daily', label: 'Daily' },
                  { id: 'weekly', label: 'Weekly' },
                  { id: 'monthly', label: 'Monthly' }
                ].map(tf => (
                  <button
                    key={tf.id}
                    onClick={() => { setTimeframe(tf.id); setHiddenLines({}); }}
                    style={{
                      background: timeframe === tf.id ? 'linear-gradient(135deg, #0284c7, #2563eb)' : 'transparent',
                      color: timeframe === tf.id ? '#fff' : '#94a3b8',
                      border: 'none',
                      padding: '5px 10px',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      cursor: 'pointer'
                    }}
                  >
                    {tf.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Isolation Filter Pills */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {[
                { id: 'ALL', label: 'All (27)' },
                { id: 'OPT_DIVERGENCE', label: '⚠️ Options Divergences' },
                { id: 'OPT_CONFIRMED', label: '✅ Options Confirmed' },
                { id: 'INFLOW_SURGE', label: '🔥 Inflow Surges' },
                { id: 'CROSSOVERS', label: '⚡ Crossovers' },
                { id: 'TOP5', label: 'Top 5 Trend' },
                { id: 'GROWTH', label: 'Tech/Growth' },
                { id: 'CYCLICALS', label: 'Cyclicals' },
                { id: 'DEFENSIVE', label: 'Defensives' },
                { id: 'HARD_ASSETS', label: 'Hard Assets' },
                { id: 'GRID', label: 'Grid View' }
              ].map(btn => (
                <button
                  key={btn.id}
                  onClick={() => { setQuickFilter(btn.id); setHiddenLines({}); }}
                  style={{
                    background: quickFilter === btn.id ? 'rgba(56, 189, 248, 0.22)' : 'rgba(15, 23, 42, 0.7)',
                    color: quickFilter === btn.id ? '#38bdf8' : '#cbd5e1',
                    border: quickFilter === btn.id ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '6px',
                    padding: '5px 10px',
                    fontSize: '0.73rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>

          {quickFilter !== 'GRID' ? (
            <div style={{ position: 'relative' }}>
              {/* Quadrant Corner Watermarks */}
              <div style={{ position: 'absolute', top: '28px', right: '28px', textAlign: 'right', pointerEvents: 'none', zIndex: 2 }}>
                <div style={{ color: '#10b981', fontWeight: 900, fontSize: '1.05rem', opacity: 0.65, letterSpacing: '0.06em' }}>
                  LEADING ({underHoodSummary?.quadCounts?.Leading || 0})
                </div>
                <div style={{ color: '#10b981', fontSize: '0.7rem', opacity: 0.55 }}>Strong Trend + Rising Mom</div>
              </div>
              <div style={{ position: 'absolute', bottom: '115px', right: '28px', textAlign: 'right', pointerEvents: 'none', zIndex: 2 }}>
                <div style={{ color: '#f59e0b', fontWeight: 900, fontSize: '1.05rem', opacity: 0.65, letterSpacing: '0.06em' }}>
                  WEAKENING ({underHoodSummary?.quadCounts?.Weakening || 0})
                </div>
                <div style={{ color: '#f59e0b', fontSize: '0.7rem', opacity: 0.55 }}>Strong Trend + Fading Mom</div>
              </div>
              <div style={{ position: 'absolute', bottom: '115px', left: '68px', textAlign: 'left', pointerEvents: 'none', zIndex: 2 }}>
                <div style={{ color: '#ef4444', fontWeight: 900, fontSize: '1.05rem', opacity: 0.65, letterSpacing: '0.06em' }}>
                  LAGGING ({underHoodSummary?.quadCounts?.Lagging || 0})
                </div>
                <div style={{ color: '#ef4444', fontSize: '0.7rem', opacity: 0.55 }}>Weak Trend + Weak Mom</div>
              </div>
              <div style={{ position: 'absolute', top: '28px', left: '68px', textAlign: 'left', pointerEvents: 'none', zIndex: 2 }}>
                <div style={{ color: '#3b82f6', fontWeight: 900, fontSize: '1.05rem', opacity: 0.65, letterSpacing: '0.06em' }}>
                  IMPROVING ({underHoodSummary?.quadCounts?.Improving || 0})
                </div>
                <div style={{ color: '#3b82f6', fontSize: '0.7rem', opacity: 0.55 }}>Weak Trend + Rising Mom</div>
              </div>

              <div style={{ height: '580px', width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 18, right: 24, bottom: 18, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <ReferenceArea x1={100} y1={100} fill="rgba(16, 185, 129, 0.045)" />
                    <ReferenceArea x1={100} y2={100} fill="rgba(245, 158, 11, 0.045)" />
                    <ReferenceArea x2={100} y2={100} fill="rgba(239, 68, 68, 0.045)" />
                    <ReferenceArea x2={100} y1={100} fill="rgba(59, 130, 246, 0.045)" />
                    <ReferenceLine x={100} stroke="rgba(255,255,255,0.28)" strokeWidth={2} />
                    <ReferenceLine y={100} stroke="rgba(255,255,255,0.28)" strokeWidth={2} />
                    <XAxis
                      type="number"
                      dataKey="x"
                      name="RS-Ratio"
                      domain={['dataMin - 3', 'dataMax + 4']}
                      stroke="rgba(255,255,255,0.45)"
                      tick={{ fill: '#94a3b8', fontSize: 11 }}
                    />
                    <YAxis
                      type="number"
                      dataKey="y"
                      name="RS-Momentum"
                      domain={['dataMin - 3', 'dataMax + 4']}
                      stroke="rgba(255,255,255,0.45)"
                      tick={{ fill: '#94a3b8', fontSize: 11 }}
                    />
                    <Tooltip content={<EnhancedRrgTooltip lookback={lookback} />} cursor={{ strokeDasharray: '3 3' }} />

                    {telemetryList.map((sector) => {
                      if (!isSectorVisibleOnChart(sector)) return null;
                      const isHovered = hoveredSector === sector.name || selectedInspectorName === sector.name;
                      const isAnotherHovered = hoveredSector !== null && hoveredSector !== sector.name;
                      const slicedTrail = (sector.trail || []).slice(-tailLength);
                      const divMarker = sector.confluence?.type === 'BEARISH_DIVERGENCE'
                        ? ' ⚠️'
                        : sector.confluence?.type === 'BULLISH_DIVERGENCE'
                          ? ' 🎣'
                          : sector.confluence?.type === 'CONFIRMED_BULLISH'
                            ? ' ✓'
                            : '';
                      const mappedTrail = slicedTrail.map((pt, i) => ({
                        ...pt,
                        sectorName: sector.name,
                        sectorTelemetry: sector,
                        stepLabel: i === slicedTrail.length - 1 ? 'Current Head' : `-${slicedTrail.length - 1 - i} sess`,
                        labelName: i === slicedTrail.length - 1 ? `${sector.ticker}${divMarker}` : ''
                      }));

                      return (
                        <Scatter
                          key={sector.name}
                          name={sector.name}
                          data={mappedTrail}
                          fill={sector.color}
                          line={{ type: 'monotone', stroke: sector.color, strokeWidth: isHovered ? 3.8 : 2 }}
                          opacity={isAnotherHovered ? 0.14 : 1}
                          style={{ cursor: 'pointer' }}
                          onClick={() => { setSelectedInspectorName(sector.name); setModalData(sector); }}
                          onMouseEnter={() => setHoveredSector(sector.name)}
                          onMouseLeave={() => setHoveredSector(null)}
                        >
                          <LabelList
                            dataKey="labelName"
                            position="right"
                            offset={7}
                            style={{
                              fill: '#f8fafc',
                              fontSize: isHovered ? '13px' : '11px',
                              fontWeight: 800,
                              fontFamily: 'monospace',
                              textShadow: `0px 0px 4px ${sector.color}, 0px 0px 8px #000`
                            }}
                          />
                          {mappedTrail.map((entry, index) => {
                            const isLast = index === mappedTrail.length - 1;
                            const isStart = index === 0;
                            return (
                              <Cell
                                key={`cell-${index}`}
                                fill={sector.color}
                                r={isLast ? (isHovered ? 10 : 7) : isStart ? 3 : 2}
                                opacity={isLast ? 1 : 0.45}
                              />
                            );
                          })}
                        </Scatter>
                      );
                    })}
                  </ScatterChart>
                </ResponsiveContainer>
              </div>

              {/* Interactive Sector Toggle Legend Pills */}
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '6px',
                justifyContent: 'center',
                marginTop: '10px',
                paddingTop: '10px',
                borderTop: '1px solid rgba(255,255,255,0.06)'
              }}>
                {telemetryList.map(sec => {
                  const hidden = !isSectorVisibleOnChart(sec);
                  return (
                    <button
                      key={sec.name}
                      onClick={() => toggleLine(sec.name)}
                      onMouseEnter={() => setHoveredSector(sec.name)}
                      onMouseLeave={() => setHoveredSector(null)}
                      style={{
                        cursor: 'pointer',
                        background: hidden ? 'rgba(15, 23, 42, 0.4)' : 'rgba(15, 23, 42, 0.85)',
                        border: `1px solid ${hidden ? 'rgba(255,255,255,0.06)' : sec.color}`,
                        color: hidden ? '#475569' : '#f8fafc',
                        borderRadius: '6px',
                        padding: '3px 8px',
                        fontSize: '0.72rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        opacity: hoveredSector && hoveredSector !== sec.name ? 0.4 : 1
                      }}
                    >
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: hidden ? '#475569' : sec.color }} />
                      <strong style={{ fontFamily: 'monospace' }}>{sec.ticker}</strong>
                      <span style={{ color: '#94a3b8', fontSize: '0.68rem' }}>{sec.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Small-Multiples Grid View */
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '14px', marginTop: '10px' }}>
              {telemetryList.map((sector) => {
                const qStyle = QUAD_META[sector.curQuad] || QUAD_META.Unknown;
                return (
                  <div
                    key={sector.name}
                    className="stat-card"
                    style={{
                      padding: '12px',
                      height: '250px',
                      cursor: 'pointer',
                      border: `1px solid ${qStyle.border}`,
                      background: 'rgba(15, 23, 42, 0.7)'
                    }}
                    onClick={() => { setSelectedInspectorName(sector.name); setModalData(sector); }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <strong style={{ color: sector.color, fontSize: '0.84rem' }}>{sector.name} ({sector.ticker})</strong>
                      <span style={{ fontSize: '0.66rem', padding: '1px 6px', borderRadius: '4px', background: qStyle.bg, color: qStyle.color, fontWeight: 800 }}>
                        {sector.curQuad}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.68rem', color: sector.confluence.color, fontWeight: 700, marginBottom: '4px' }}>
                      {sector.confluence.shortBadge} • Call {sector.callVolPct.toFixed(0)}%
                    </div>
                    <ResponsiveContainer width="100%" height="74%">
                      <ScatterChart margin={{ top: 5, right: 12, bottom: 5, left: 5 }}>
                        <ReferenceArea x1={100} y1={100} fill="rgba(16, 185, 129, 0.05)" />
                        <ReferenceArea x1={100} y2={100} fill="rgba(245, 158, 11, 0.05)" />
                        <ReferenceArea x2={100} y2={100} fill="rgba(239, 68, 68, 0.05)" />
                        <ReferenceArea x2={100} y1={100} fill="rgba(59, 130, 246, 0.05)" />
                        <ReferenceLine x={100} stroke="rgba(255,255,255,0.2)" strokeWidth={1} />
                        <ReferenceLine y={100} stroke="rgba(255,255,255,0.2)" strokeWidth={1} />
                        <XAxis type="number" dataKey="x" domain={['dataMin - 2', 'dataMax + 2']} hide />
                        <YAxis type="number" dataKey="y" domain={['dataMin - 2', 'dataMax + 2']} hide />
                        <Scatter
                          name={sector.name}
                          data={(sector.trail || []).slice(-tailLength)}
                          fill={sector.color}
                          line={{ type: 'monotone', stroke: sector.color, strokeWidth: 2 }}
                        >
                          {(sector.trail || []).slice(-tailLength).map((entry, index, arr) => {
                            const isLast = index === arr.length - 1;
                            return <Cell key={`mini-${index}`} fill={sector.color} r={isLast ? 5 : 0} opacity={isLast ? 1 : 0} />;
                          })}
                        </Scatter>
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Live Under-the-Hood Sector Trail + Options GEX/Delta Inspector */}
        {quickFilter !== 'GRID' && inspectedSector && (
          <div className="glass-card" style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px', border: '1px solid rgba(56, 189, 248, 0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '10px' }}>
              <div>
                <span style={{ fontSize: '0.68rem', color: '#38bdf8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  🎯 Under-the-Hood Sector & Options Inspector
                </span>
                <h3 style={{ margin: '3px 0 0 0', fontSize: '1.15rem', color: '#f8fafc' }}>
                  {inspectedSector.name} <span style={{ color: '#38bdf8', fontFamily: 'monospace' }}>({inspectedSector.ticker})</span>
                </h3>
                <span style={{ fontSize: '0.73rem', color: '#94a3b8' }}>
                  Basket: <strong style={{ color: BASKET_COLORS[inspectedSector.basket] }}>{inspectedSector.basket}</strong> • Rank #{inspectedSector.rank}/27
                </span>
              </div>

              <span style={{
                padding: '4px 10px',
                borderRadius: '999px',
                fontSize: '0.74rem',
                fontWeight: 800,
                background: QUAD_META[inspectedSector.curQuad]?.bg,
                color: QUAD_META[inspectedSector.curQuad]?.color,
                border: `1px solid ${QUAD_META[inspectedSector.curQuad]?.border}`
              }}>
                {inspectedSector.curQuad.toUpperCase()}
              </span>
            </div>

            {/* RRG × Options Confluence Verdict Banner */}
            <div style={{
              background: inspectedSector.confluence.bg,
              border: `1px solid ${inspectedSector.confluence.border}`,
              borderRadius: '8px',
              padding: '9px 11px'
            }}>
              <div style={{ fontSize: '0.76rem', fontWeight: 800, color: inspectedSector.confluence.color, marginBottom: '3px' }}>
                {inspectedSector.confluence.badge}
              </div>
              <div style={{ fontSize: '0.73rem', color: '#e2e8f0', lineHeight: 1.4 }}>
                {inspectedSector.confluence.headline}
              </div>
              {inspectedSector.confluence.detail && (
                <div style={{ fontSize: '0.69rem', color: '#94a3b8', marginTop: '3px' }}>
                  {inspectedSector.confluence.detail}
                </div>
              )}
            </div>

            {/* Institutional Options & Dealer Gamma Telemetry Grid */}
            {inspectedSector.opt && (
              <div style={{
                background: 'rgba(15, 23, 42, 0.8)',
                borderRadius: '8px',
                padding: '9px 11px',
                border: '1px solid rgba(255,255,255,0.07)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase' }}>
                    ETF Options Order Flow & Dealer GEX
                  </span>
                  <span style={{ fontSize: '0.68rem', color: inspectedSector.opt.flow_signal_color || '#38bdf8', fontWeight: 800 }}>
                    {inspectedSector.opt.flow_signal_badge || ''}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '7px', fontFamily: 'monospace' }}>
                  <div>
                    <div style={{ fontSize: '0.63rem', color: '#64748b' }}>Call Vol / PCR</div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 800, color: inspectedSector.callVolPct >= 55 ? '#10b981' : inspectedSector.callVolPct <= 45 ? '#f87171' : '#e2e8f0' }}>
                      {inspectedSector.callVolPct.toFixed(1)}% ({inspectedSector.pcrVol.toFixed(2)})
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.63rem', color: '#64748b' }}>Net Delta ($Δ)</div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 800, color: inspectedSector.netDeltaFlow >= 0 ? '#10b981' : '#f87171' }}>
                      {formatDollarFlow(inspectedSector.netDeltaFlow)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.63rem', color: '#64748b' }}>Dealer Net GEX</div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 800, color: inspectedSector.netGex >= 0 ? '#10b981' : '#f87171' }}>
                      {inspectedSector.netGex >= 0 ? '+' : ''}{inspectedSector.netGex.toFixed(1)}M
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.63rem', color: '#64748b' }}>5D Net Call OI</div>
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: inspectedSector.netCallOi5d >= 0 ? '#10b981' : '#f87171' }}>
                      {formatSignedInt(inspectedSector.netCallOi5d)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.63rem', color: '#64748b' }}>30D IV Rank</div>
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#e2e8f0' }}>
                      {Number(inspectedSector.opt.iv_rank || 0).toFixed(0)}% (IV {Number(inspectedSector.opt.atm_iv_30d || 0).toFixed(1)}%)
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.63rem', color: '#64748b' }}>Max Pain / Spot</div>
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#cbd5e1' }}>
                      ${Number(inspectedSector.opt.max_pain || 0).toFixed(0)} / ${Number(inspectedSector.opt.spot_price || 0).toFixed(1)}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Cross-Timeframe Quadrant Strip */}
            <div>
              <div style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', marginBottom: '5px' }}>
                Multi-Timeframe Quadrant Alignment
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                {[
                  { label: 'Monthly', q: inspectedSector.mQuad },
                  { label: 'Weekly', q: inspectedSector.wQuad },
                  { label: 'Daily', q: inspectedSector.dQuad },
                  { label: '15m Intra', q: inspectedSector.iQuad }
                ].map(tf => {
                  const st = QUAD_META[tf.q] || QUAD_META.Unknown;
                  return (
                    <div key={tf.label} style={{ background: st.bg, border: `1px solid ${st.border}`, borderRadius: '6px', padding: '5px', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.63rem', color: '#cbd5e1' }}>{tf.label}</div>
                      <div style={{ fontSize: '0.73rem', fontWeight: 800, color: st.color }}>{st.short}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Session-by-Session Trail Ledger (Last 5 Sessions) */}
            <div>
              <div style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', marginBottom: '5px' }}>
                Session-by-Session Rotation Trail (Last 5 Bars)
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem', fontFamily: 'monospace' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#64748b', textAlign: 'left' }}>
                      <th style={{ padding: '4px 6px' }}>Session</th>
                      <th style={{ padding: '4px 6px' }}>Ratio</th>
                      <th style={{ padding: '4px 6px' }}>Mom</th>
                      <th style={{ padding: '4px 6px' }}>1S Δ</th>
                      <th style={{ padding: '4px 6px' }}>Quad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...(inspectedSector.trail || []).slice(-5)].reverse().map((pt, i, arr) => {
                      const prevPt = arr[i + 1];
                      const stepDx = prevPt ? pt.x - prevPt.x : 0;
                      const stepDy = prevPt ? pt.y - prevPt.y : 0;
                      const q = getQuadrant(pt.x, pt.y);
                      const qSt = QUAD_META[q] || QUAD_META.Unknown;
                      return (
                        <tr key={pt.date + i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: i === 0 ? 'rgba(56, 189, 248, 0.08)' : 'transparent' }}>
                          <td style={{ padding: '4px 6px', color: i === 0 ? '#f8fafc' : '#94a3b8', fontWeight: i === 0 ? 800 : 400 }}>
                            {pt.date?.slice(5) || pt.date} {i === 0 ? '(Now)' : ''}
                          </td>
                          <td style={{ padding: '4px 6px', color: pt.x >= 100 ? '#10b981' : '#f87171', fontWeight: 700 }}>{pt.x.toFixed(1)}</td>
                          <td style={{ padding: '4px 6px', color: pt.y >= 100 ? '#10b981' : '#f87171', fontWeight: 700 }}>{pt.y.toFixed(1)}</td>
                          <td style={{ padding: '4px 6px', color: (stepDx + stepDy) >= 0 ? '#10b981' : '#f87171' }}>
                            {prevPt ? `${stepDx >= 0 ? '+' : ''}${stepDx.toFixed(1)} / ${stepDy >= 0 ? '+' : ''}${stepDy.toFixed(1)}` : '—'}
                          </td>
                          <td style={{ padding: '4px 6px' }}>
                            <span style={{ color: qSt.color, fontWeight: 800 }}>{qSt.short}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Underlying Component Stocks with Options Telemetry */}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', marginBottom: '5px' }}>
                Component Stocks + Options Flow (Click for Deep Chart)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {(inspectedSector.topStocksList || []).map(st => (
                  <div
                    key={st.ticker}
                    onClick={() => fetchTickerData(st.ticker)}
                    style={{
                      cursor: 'pointer',
                      background: 'rgba(15, 23, 42, 0.8)',
                      border: '1px solid rgba(255,255,255,0.07)',
                      borderRadius: '6px',
                      padding: '6px 9px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <strong style={{ color: '#38bdf8', fontSize: '0.82rem', fontFamily: 'monospace' }}>{st.ticker}</strong>
                      <span style={{ fontSize: '0.68rem', color: st.stage?.includes('2') ? '#10b981' : '#94a3b8', marginLeft: '6px' }}>
                        {st.stage}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.71rem', fontFamily: 'monospace', display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {st.opt && (
                        <span style={{ color: st.opt.call_vol_pct >= 55 ? '#10b981' : st.opt.call_vol_pct <= 45 ? '#f87171' : '#cbd5e1' }}>
                          {Number(st.opt.call_vol_pct || 0).toFixed(0)}%C ({formatDollarFlow(st.opt.net_delta_flow)})
                        </span>
                      )}
                      <span style={{ color: st.perf >= 0 ? '#10b981' : '#f87171', fontWeight: 700 }}>
                        {st.perf >= 0 ? '+' : ''}{Number(st.perf || 0).toFixed(2)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* =====================================================================
          5. 4-STAGE INSTITUTIONAL MONEY FLOW LIFECYCLE MATRIX
      ===================================================================== */}
      <div className="glass-card" style={{ padding: '18px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.15rem', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={20} color="#f59e0b" /> 4-Stage Institutional Rotation Lifecycle ({timeframeLabel})
            </h2>
            <p style={{ margin: '3px 0 0 0', fontSize: '0.82rem', color: '#94a3b8' }}>
              Categorizes all 27 sectors by their current RRG position combined with their last {lookback}-{sessionUnit.toLowerCase()} velocity vector and options confirmation badge.
            </p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))', gap: '14px' }}>
          {/* Stage 1: Stealth Accumulation */}
          <div style={{ background: 'rgba(59, 130, 246, 0.07)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '10px', padding: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <h3 style={{ margin: 0, fontSize: '0.95rem', color: '#60a5fa' }}>🌱 1. Stealth Accumulation</h3>
              <span style={{ fontSize: '0.68rem', background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', padding: '2px 7px', borderRadius: '999px', fontWeight: 800 }}>
                {lifecycleBuckets.stealthAccumulation.length} SECTORS
              </span>
            </div>
            <p style={{ fontSize: '0.76rem', color: '#94a3b8', marginBottom: '10px' }}>
              Improving quadrant or hooking up sharply from Lagging (ΔMom &gt; 0). Institutional early entry before trend breakout.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
              {lifecycleBuckets.stealthAccumulation.map(sec => (
                <div key={sec.name} onClick={() => { setSelectedInspectorName(sec.name); setModalData(sec); }} style={{ cursor: 'pointer', background: 'rgba(15, 23, 42, 0.65)', padding: '8px 10px', borderRadius: '6px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                    <strong style={{ color: '#f8fafc' }}>{sec.name} <span style={{ color: '#60a5fa', fontFamily: 'monospace' }}>({sec.ticker})</span></strong>
                    <span style={{ color: '#10b981', fontFamily: 'monospace', fontWeight: 700, fontSize: '0.74rem' }}>
                      ΔMom {sec.dy >= 0 ? '+' : ''}{sec.dy.toFixed(1)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.69rem', marginTop: '3px' }}>
                    <span style={{ color: sec.confluence.color, fontWeight: 700 }}>{sec.confluence.shortBadge}</span>
                    <span style={{ color: '#94a3b8', fontFamily: 'monospace' }}>Net Δ: {formatDollarFlow(sec.netDeltaFlow)}</span>
                  </div>
                </div>
              ))}
              {lifecycleBuckets.stealthAccumulation.length === 0 && <span style={{ color: '#64748b', fontSize: '0.8rem' }}>No sectors in early ignition.</span>}
            </div>
          </div>

          {/* Stage 2: Dominant Trend Expansion */}
          <div style={{ background: 'rgba(16, 185, 129, 0.07)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '10px', padding: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <h3 style={{ margin: 0, fontSize: '0.95rem', color: '#10b981' }}>🚀 2. Dominant Expansion</h3>
              <span style={{ fontSize: '0.68rem', background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', padding: '2px 7px', borderRadius: '999px', fontWeight: 800 }}>
                {lifecycleBuckets.dominantExpansion.length} SECTORS
              </span>
            </div>
            <p style={{ fontSize: '0.76rem', color: '#94a3b8', marginBottom: '10px' }}>
              Firmly inside Leading quadrant (Ratio ≥ 100, Mom ≥ 100) with sustained institutional inflows.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', maxHeight: '310px', overflowY: 'auto' }}>
              {lifecycleBuckets.dominantExpansion.map(sec => (
                <div key={sec.name} onClick={() => { setSelectedInspectorName(sec.name); setModalData(sec); }} style={{ cursor: 'pointer', background: 'rgba(15, 23, 42, 0.65)', padding: '8px 10px', borderRadius: '6px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                    <strong style={{ color: '#f8fafc' }}>#{sec.rank} {sec.name} <span style={{ color: '#10b981', fontFamily: 'monospace' }}>({sec.ticker})</span></strong>
                    <span style={{ color: sec.dy >= 0 ? '#10b981' : '#f59e0b', fontFamily: 'monospace', fontWeight: 700, fontSize: '0.74rem' }}>
                      ΔFlow {sec.flowScore >= 0 ? '+' : ''}{sec.flowScore.toFixed(1)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.69rem', marginTop: '3px' }}>
                    <span style={{ color: sec.confluence.color, fontWeight: 700 }}>{sec.confluence.shortBadge}</span>
                    <span style={{ color: '#94a3b8', fontFamily: 'monospace' }}>Net Δ: {formatDollarFlow(sec.netDeltaFlow)}</span>
                  </div>
                </div>
              ))}
              {lifecycleBuckets.dominantExpansion.length === 0 && <span style={{ color: '#64748b', fontSize: '0.8rem' }}>No sectors in dominant expansion.</span>}
            </div>
          </div>

          {/* Stage 3: Distribution & Rollover Warning */}
          <div style={{ background: 'rgba(245, 158, 11, 0.07)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '10px', padding: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <h3 style={{ margin: 0, fontSize: '0.95rem', color: '#f59e0b' }}>⚠️ 3. Distribution & Rollover</h3>
              <span style={{ fontSize: '0.68rem', background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b', padding: '2px 7px', borderRadius: '999px', fontWeight: 800 }}>
                {lifecycleBuckets.distributionWarning.length} SECTORS
              </span>
            </div>
            <p style={{ fontSize: '0.76rem', color: '#94a3b8', marginBottom: '10px' }}>
              Weakening quadrant or Leading sectors losing velocity (ΔMom &lt; -2.5). Watch Bullish Divs for dip-buys vs Confirmed Bearish rollovers.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', maxHeight: '310px', overflowY: 'auto' }}>
              {lifecycleBuckets.distributionWarning.map(sec => (
                <div key={sec.name} onClick={() => { setSelectedInspectorName(sec.name); setModalData(sec); }} style={{ cursor: 'pointer', background: 'rgba(15, 23, 42, 0.65)', padding: '8px 10px', borderRadius: '6px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                    <strong style={{ color: '#f8fafc' }}>#{sec.rank} {sec.name} <span style={{ color: '#f59e0b', fontFamily: 'monospace' }}>({sec.ticker})</span></strong>
                    <span style={{ color: '#ef4444', fontFamily: 'monospace', fontWeight: 700, fontSize: '0.74rem' }}>
                      ΔMom {sec.dy.toFixed(1)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.69rem', marginTop: '3px' }}>
                    <span style={{ color: sec.confluence.color, fontWeight: 700 }}>{sec.confluence.shortBadge}</span>
                    <span style={{ color: '#94a3b8', fontFamily: 'monospace' }}>Net Δ: {formatDollarFlow(sec.netDeltaFlow)}</span>
                  </div>
                </div>
              ))}
              {lifecycleBuckets.distributionWarning.length === 0 && <span style={{ color: '#64748b', fontSize: '0.8rem' }}>No sectors showing distribution.</span>}
            </div>
          </div>

          {/* Stage 4: Capitulation & Structural Drag */}
          <div style={{ background: 'rgba(239, 68, 68, 0.07)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '10px', padding: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <h3 style={{ margin: 0, fontSize: '0.95rem', color: '#ef4444' }}>🩸 4. Structural Drag (Lagging)</h3>
              <span style={{ fontSize: '0.68rem', background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', padding: '2px 7px', borderRadius: '999px', fontWeight: 800 }}>
                {lifecycleBuckets.structuralDrag.length} SECTORS
              </span>
            </div>
            <p style={{ fontSize: '0.76rem', color: '#94a3b8', marginBottom: '10px' }}>
              Trapped in Lagging quadrant (Ratio &lt; 100, Mom &lt; 100) with negative flow. Avoid unhedged longs unless Options Bull Div appears.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', maxHeight: '310px', overflowY: 'auto' }}>
              {lifecycleBuckets.structuralDrag.map(sec => (
                <div key={sec.name} onClick={() => { setSelectedInspectorName(sec.name); setModalData(sec); }} style={{ cursor: 'pointer', background: 'rgba(15, 23, 42, 0.65)', padding: '8px 10px', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                    <strong style={{ color: '#f8fafc' }}>#{sec.rank} {sec.name} <span style={{ color: '#ef4444', fontFamily: 'monospace' }}>({sec.ticker})</span></strong>
                    <span style={{ color: '#f87171', fontFamily: 'monospace', fontWeight: 700, fontSize: '0.74rem' }}>
                      ΔFlow {sec.flowScore.toFixed(1)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.69rem', marginTop: '3px' }}>
                    <span style={{ color: sec.confluence.color, fontWeight: 700 }}>{sec.confluence.shortBadge}</span>
                    <span style={{ color: '#94a3b8', fontFamily: 'monospace' }}>Net Δ: {formatDollarFlow(sec.netDeltaFlow)}</span>
                  </div>
                </div>
              ))}
              {lifecycleBuckets.structuralDrag.length === 0 && <span style={{ color: '#64748b', fontSize: '0.8rem' }}>No sectors in structural drag.</span>}
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================================
          6. MULTI-TIMEFRAME ALIGNMENT PLAYBOOK & FOCUS STOCK GRIDS
      ===================================================================== */}
      <div className="glass-card" style={{ padding: '18px 20px' }}>
        <h2 style={{ margin: '0 0 6px 0', fontSize: '1.15rem', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Compass color="#a855f7" size={20} /> Cross-Timeframe Institutional Trade Playbook (Monthly × Weekly × Daily)
        </h2>
        <p style={{ color: '#94a3b8', fontSize: '0.82rem', margin: '0 0 14px 0' }}>
          Synthesizes Monthly structural trend, Weekly swing posture, and Daily short-term velocity to isolate high-probability sector setups.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
          {/* Pullback Buys */}
          <div className="stat-card" style={{ padding: '14px' }}>
            <h3 style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 6px 0', fontSize: '0.92rem' }}>
              <ActivitySquare size={17} /> Pullback Buys (M/W Up, D Dip)
            </h3>
            <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '0 0 10px 0' }}>Macro leaders experiencing a short-term daily breather.</p>
            {multiTimeframePlaybooks.pullbackBuys.length === 0 ? <p style={{ color: '#64748b', fontSize: '0.8rem' }}>No active setups.</p> : multiTimeframePlaybooks.pullbackBuys.map((s, i) => (
              <div key={i} onClick={() => setModalData(s)} style={{ cursor: 'pointer', marginBottom: '10px', fontSize: '0.82rem', paddingBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <strong style={{ color: '#f8fafc' }}>{s.name} ({s.ticker})</strong>
                <span style={{ color: '#94a3b8', display: 'block', fontSize: '0.7rem', fontFamily: 'monospace', marginTop: '2px' }}>{s.status}</span>
                <span style={{ color: s.confluence?.color, display: 'block', fontSize: '0.7rem', fontWeight: 700, marginTop: '2px' }}>{s.confluence?.shortBadge}</span>
              </div>
            ))}
          </div>

          {/* Emerging Leaders */}
          <div className="stat-card" style={{ padding: '14px' }}>
            <h3 style={{ color: '#3b82f6', display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 6px 0', fontSize: '0.92rem' }}>
              <TrendingUp size={17} /> Emerging Turnarounds (W/D Leading)
            </h3>
            <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '0 0 10px 0' }}>Beaten-down macro sectors igniting on Daily & Weekly.</p>
            {multiTimeframePlaybooks.emergingLeaders.length === 0 ? <p style={{ color: '#64748b', fontSize: '0.8rem' }}>No active setups.</p> : multiTimeframePlaybooks.emergingLeaders.map((s, i) => (
              <div key={i} onClick={() => setModalData(s)} style={{ cursor: 'pointer', marginBottom: '10px', fontSize: '0.82rem', paddingBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <strong style={{ color: '#f8fafc' }}>{s.name} ({s.ticker})</strong>
                <span style={{ color: '#94a3b8', display: 'block', fontSize: '0.7rem', fontFamily: 'monospace', marginTop: '2px' }}>{s.status}</span>
                <span style={{ color: s.confluence?.color, display: 'block', fontSize: '0.7rem', fontWeight: 700, marginTop: '2px' }}>{s.confluence?.shortBadge}</span>
              </div>
            ))}
          </div>

          {/* Full Throttle */}
          <div className="stat-card" style={{ padding: '14px' }}>
            <h3 style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 6px 0', fontSize: '0.92rem' }}>
              <Zap size={17} /> Full-Throttle Alignment (M+W+D Lead)
            </h3>
            <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '0 0 10px 0' }}>Simultaneously Leading across Monthly, Weekly, and Daily.</p>
            {multiTimeframePlaybooks.fullThrottle.length === 0 ? <p style={{ color: '#64748b', fontSize: '0.8rem' }}>No active setups.</p> : multiTimeframePlaybooks.fullThrottle.map((s, i) => (
              <div key={i} onClick={() => setModalData(s)} style={{ cursor: 'pointer', marginBottom: '10px', fontSize: '0.82rem', paddingBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <strong style={{ color: '#f8fafc' }}>{s.name} ({s.ticker})</strong>
                <span style={{ color: '#94a3b8', display: 'block', fontSize: '0.7rem', fontFamily: 'monospace', marginTop: '2px' }}>{s.status}</span>
                <span style={{ color: s.confluence?.color, display: 'block', fontSize: '0.7rem', fontWeight: 700, marginTop: '2px' }}>{s.confluence?.shortBadge}</span>
              </div>
            ))}
          </div>

          {/* Exhaustion Warnings */}
          <div className="stat-card" style={{ padding: '14px' }}>
            <h3 style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 6px 0', fontSize: '0.92rem' }}>
              <AlertCircle size={17} /> Exhaustion Breakdowns
            </h3>
            <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '0 0 10px 0' }}>Monthly leaders rolling over on Weekly & Daily.</p>
            {multiTimeframePlaybooks.exhaustionWarnings.length === 0 ? <p style={{ color: '#64748b', fontSize: '0.8rem' }}>No active warnings.</p> : multiTimeframePlaybooks.exhaustionWarnings.map((s, i) => (
              <div key={i} onClick={() => setModalData(s)} style={{ cursor: 'pointer', marginBottom: '10px', fontSize: '0.82rem', paddingBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <strong style={{ color: '#f8fafc' }}>{s.name} ({s.ticker})</strong>
                <span style={{ color: '#94a3b8', display: 'block', fontSize: '0.7rem', fontFamily: 'monospace', marginTop: '2px' }}>{s.status}</span>
                <span style={{ color: s.confluence?.color, display: 'block', fontSize: '0.7rem', fontWeight: 700, marginTop: '2px' }}>{s.confluence?.shortBadge}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* =====================================================================
          7. QUANTITATIVE MULTI-SESSION SECTOR + OPTIONS FLOW LEDGER
      ===================================================================== */}
      <div className="glass-card" style={{ padding: '18px 20px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.15rem', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <List color="#38bdf8" size={20} /> Quantitative Sector Rotation & Options Confluence Ledger ({timeframeLabel})
            </h2>
            <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
              Click any column header to sort • Compare {lookback}-Session RRG Flow vs. Options Call %, Net Delta ($Δ), and Dealer GEX
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(9, 13, 22, 0.85)', padding: '6px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <Search size={15} color="#94a3b8" />
            <input
              type="text"
              value={tableSearch}
              onChange={(e) => setTableSearch(e.target.value)}
              placeholder="Filter sector, ETF, divergence..."
              style={{ background: 'transparent', border: 'none', color: '#f8fafc', fontSize: '0.8rem', outline: 'none', width: '210px' }}
            />
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.79rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.12)', color: '#94a3b8', fontSize: '0.7rem', textTransform: 'uppercase' }}>
                <th onClick={() => handleSortClick('rank')} style={{ padding: '10px 6px', cursor: 'pointer' }}>Rank {tableSortField === 'rank' ? (tableSortAsc ? '↑' : '↓') : ''}</th>
                <th style={{ padding: '10px 6px' }}>Sector / ETF</th>
                <th style={{ padding: '10px 6px' }}>Quadrant</th>
                <th style={{ padding: '10px 6px' }}>MTF (M/W/D)</th>
                <th onClick={() => handleSortClick('x')} style={{ padding: '10px 6px', cursor: 'pointer' }}>Ratio {tableSortField === 'x' ? (tableSortAsc ? '↑' : '↓') : ''}</th>
                <th onClick={() => handleSortClick('y')} style={{ padding: '10px 6px', cursor: 'pointer' }}>Mom {tableSortField === 'y' ? (tableSortAsc ? '↑' : '↓') : ''}</th>
                <th onClick={() => handleSortClick('dx')} style={{ padding: '10px 6px', cursor: 'pointer', color: '#38bdf8' }}>{lookback}S ΔRatio {tableSortField === 'dx' ? (tableSortAsc ? '↑' : '↓') : ''}</th>
                <th onClick={() => handleSortClick('dy')} style={{ padding: '10px 6px', cursor: 'pointer', color: '#38bdf8' }}>{lookback}S ΔMom {tableSortField === 'dy' ? (tableSortAsc ? '↑' : '↓') : ''}</th>
                <th onClick={() => handleSortClick('callVolPct')} style={{ padding: '10px 6px', cursor: 'pointer', color: '#fbbf24' }}>Call % (PCR) {tableSortField === 'callVolPct' ? (tableSortAsc ? '↑' : '↓') : ''}</th>
                <th onClick={() => handleSortClick('netDeltaFlow')} style={{ padding: '10px 6px', cursor: 'pointer', color: '#fbbf24' }}>Opt Net Δ ($) {tableSortField === 'netDeltaFlow' ? (tableSortAsc ? '↑' : '↓') : ''}</th>
                <th onClick={() => handleSortClick('netGex')} style={{ padding: '10px 6px', cursor: 'pointer', color: '#fbbf24' }}>Dealer GEX {tableSortField === 'netGex' ? (tableSortAsc ? '↑' : '↓') : ''}</th>
                <th style={{ padding: '10px 6px' }}>RRG × Options Verdict</th>
                <th style={{ padding: '10px 6px' }}>Top Component Stocks</th>
              </tr>
            </thead>
            <tbody>
              {sortedTableRows.map((sec) => {
                const qStyle = QUAD_META[sec.curQuad] || QUAD_META.Unknown;
                return (
                  <tr
                    key={sec.name}
                    onClick={() => { setSelectedInspectorName(sec.name); setModalData(sec); }}
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer', transition: 'background 0.15s' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(56, 189, 248, 0.06)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <td style={{ padding: '9px 6px', fontFamily: 'monospace', fontWeight: 800, color: '#cbd5e1' }}>#{sec.rank}</td>
                    <td style={{ padding: '9px 6px' }}>
                      <strong style={{ color: '#f8fafc' }}>{sec.name}</strong>{' '}
                      <span style={{ color: '#38bdf8', fontFamily: 'monospace', fontWeight: 700 }}>({sec.ticker})</span>
                    </td>
                    <td style={{ padding: '9px 6px' }}>
                      <span style={{
                        fontSize: '0.67rem',
                        fontWeight: 800,
                        padding: '2px 7px',
                        borderRadius: '999px',
                        background: qStyle.bg,
                        color: qStyle.color,
                        border: `1px solid ${qStyle.border}`
                      }}>
                        {sec.curQuad}
                      </span>
                    </td>
                    <td style={{ padding: '9px 6px', fontFamily: 'monospace', fontSize: '0.72rem' }}>
                      <span style={{ color: QUAD_META[sec.mQuad]?.color, fontWeight: 700 }}>{QUAD_META[sec.mQuad]?.short?.[0]}</span>
                      {'/'}
                      <span style={{ color: QUAD_META[sec.wQuad]?.color, fontWeight: 700 }}>{QUAD_META[sec.wQuad]?.short?.[0]}</span>
                      {'/'}
                      <span style={{ color: QUAD_META[sec.dQuad]?.color, fontWeight: 700 }}>{QUAD_META[sec.dQuad]?.short?.[0]}</span>
                    </td>
                    <td style={{ padding: '9px 6px', fontFamily: 'monospace', fontWeight: 700, color: sec.x >= 100 ? '#10b981' : '#f87171' }}>
                      {sec.x.toFixed(1)}
                    </td>
                    <td style={{ padding: '9px 6px', fontFamily: 'monospace', fontWeight: 700, color: sec.y >= 100 ? '#10b981' : '#f87171' }}>
                      {sec.y.toFixed(1)}
                    </td>
                    <td style={{ padding: '9px 6px', fontFamily: 'monospace', fontWeight: 800, color: sec.dx >= 0 ? '#10b981' : '#f87171' }}>
                      {sec.dx >= 0 ? '+' : ''}{sec.dx.toFixed(1)}
                    </td>
                    <td style={{ padding: '9px 6px', fontFamily: 'monospace', fontWeight: 800, color: sec.dy >= 0 ? '#10b981' : '#f87171' }}>
                      {sec.dy >= 0 ? '+' : ''}{sec.dy.toFixed(1)}
                    </td>
                    <td style={{ padding: '9px 6px', fontFamily: 'monospace', fontWeight: 700, color: sec.callVolPct >= 56 ? '#10b981' : sec.callVolPct <= 45 ? '#f87171' : '#cbd5e1' }}>
                      {sec.callVolPct.toFixed(1)}% <span style={{ color: '#64748b', fontSize: '0.68rem' }}>({sec.pcrVol.toFixed(2)})</span>
                    </td>
                    <td style={{ padding: '9px 6px', fontFamily: 'monospace', fontWeight: 800, color: sec.netDeltaFlow >= 0 ? '#10b981' : '#f87171' }}>
                      {formatDollarFlow(sec.netDeltaFlow)}
                    </td>
                    <td style={{ padding: '9px 6px', fontFamily: 'monospace', fontWeight: 700, color: sec.netGex >= 0 ? '#10b981' : '#ef4444' }}>
                      {sec.netGex >= 0 ? '+' : ''}{sec.netGex.toFixed(1)}M
                    </td>
                    <td style={{ padding: '9px 6px' }}>
                      <span style={{
                        fontSize: '0.67rem',
                        fontWeight: 800,
                        padding: '2px 7px',
                        borderRadius: '5px',
                        background: sec.confluence.bg,
                        color: sec.confluence.color,
                        border: `1px solid ${sec.confluence.border}`,
                        whiteSpace: 'nowrap'
                      }}>
                        {sec.confluence.shortBadge}
                      </span>
                    </td>
                    <td style={{ padding: '9px 6px' }} onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {(sec.topStocksList || []).slice(0, 3).map(st => (
                          <button
                            key={st.ticker}
                            onClick={() => fetchTickerData(st.ticker)}
                            style={{
                              cursor: 'pointer',
                              background: 'rgba(56, 189, 248, 0.12)',
                              border: '1px solid rgba(56, 189, 248, 0.3)',
                              color: '#38bdf8',
                              borderRadius: '4px',
                              padding: '2px 6px',
                              fontSize: '0.7rem',
                              fontFamily: 'monospace',
                              fontWeight: 700
                            }}
                          >
                            {st.ticker}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
