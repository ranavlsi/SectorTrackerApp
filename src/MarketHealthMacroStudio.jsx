import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Camera, Info, RefreshCw, Activity, Layers,
  Sliders, TrendingUp, BarChart2, RotateCcw
} from 'lucide-react';
import SectorFlowTopBottomPredictor from './SectorFlowTopBottomPredictor';
import './MarketHealthMacroStudio.css';

const MACRO_Q_META = {
  REFLATION: {
    id: 'REFLATION',
    short: 'Q1 REFL',
    title: 'Reflation',
    axis: 'Growth ↑ · Infl ↑',
    color: '#fbbf24',
    bg: 'rgba(251, 191, 36, 0.14)',
    basket: ['XOM', 'CVX', 'COP', 'JPM', 'GS', 'CAT', 'DE', 'ETN', 'FCX'],
  },
  STAGFLATION: {
    id: 'STAGFLATION',
    short: 'Q2 STAG',
    title: 'Stagflation',
    axis: 'Growth ↓ · Infl ↑',
    color: '#ff3366',
    bg: 'rgba(255, 51, 102, 0.14)',
    basket: ['NEM', 'FCX', 'XOM', 'CVX', 'COST', 'WMT', 'PG', 'KO'],
  },
  DEFLATION: {
    id: 'DEFLATION',
    short: 'Q3 DEFL',
    title: 'Deflation / Risk-Off',
    axis: 'Growth ↓ · Infl ↓',
    color: '#00F0FF',
    bg: 'rgba(0, 240, 255, 0.14)',
    basket: ['LLY', 'UNH', 'JNJ', 'ABBV', 'NEE', 'DUK', 'SO', 'KO', 'PG'],
  },
  GOLDILOCKS: {
    id: 'GOLDILOCKS',
    short: 'Q4 GOLD',
    title: 'Goldilocks',
    axis: 'Growth ↑ · Infl ↓',
    color: '#00E676',
    bg: 'rgba(0, 230, 118, 0.14)',
    basket: ['NVDA', 'AVGO', 'MSFT', 'AAPL', 'AMZN', 'META', 'PLTR', 'HD'],
  },
};

const DRIVER_SHORT_CAT = {
  '^TNX': 'Rates · Cost of Cap',
  'DX-Y.NYB': 'USD Global Liq',
  'CL=F': 'Energy · CPI Risk',
  'GC=F': 'Safe Haven Hedge',
  'BTC-USD': 'M2 Risk Beta',
  '^VIX': 'Dealer Vol Fear',
};

const ALL_WEATHER_BASKETS = [
  {
    id: 'REFLATION',
    title: 'Q1 Reflation Boom',
    tag: 'GROWTH ↑ · YIELDS ↑',
    color: '#fbbf24',
    desc: 'Inflation & growth expand together: asset-sensitive banks, energy, industrials lead.',
    tickers: ['XOM', 'CVX', 'COP', 'JPM', 'GS', 'CAT', 'DE', 'ETN', 'FCX'],
  },
  {
    id: 'GOLDILOCKS',
    title: 'Q4 Goldilocks Growth',
    tag: 'GROWTH ↑ · YIELDS ↓',
    color: '#00E676',
    desc: 'Disinflationary expansion: lower discount rates fuel AI semis, cloud, discretionary.',
    tickers: ['NVDA', 'AVGO', 'MSFT', 'AAPL', 'AMZN', 'META', 'PLTR', 'HD'],
  },
  {
    id: 'STAGFLATION',
    title: 'Q2 Stagflation Shield',
    tag: 'GROWTH ↓ · INFL ↑',
    color: '#ff3366',
    desc: 'Sticky costs + slowing growth: hard assets, gold miners, upstream oil, staples.',
    tickers: ['NEM', 'FCX', 'XOM', 'CVX', 'COST', 'WMT', 'PG', 'KO'],
  },
  {
    id: 'DEFLATION',
    title: 'Q3 Deflation Defense',
    tag: 'GROWTH ↓ · YIELDS ↓',
    color: '#00F0FF',
    desc: 'VIX elevated & yields drop: duration bonds, regulated utilities, pharma fortresses.',
    tickers: ['LLY', 'UNH', 'JNJ', 'ABBV', 'NEE', 'DUK', 'SO', 'KO', 'PG'],
  },
];

function usePlotWidth(ref) {
  const [w, setW] = useState(1100);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const upd = () => { if (el.clientWidth > 0) setW(el.clientWidth); };
    upd();
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(upd);
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener('resize', upd);
    return () => window.removeEventListener('resize', upd);
  }, [ref]);
  return w;
}

function MiniSparkline({ values = [], color = '#38bdf8' }) {
  if (!Array.isArray(values) || values.length < 2) return null;
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const span = Math.max(maxV - minV, 1e-6);
  const w = 100;
  const h = 20;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - 2 - ((v - minV) / span) * (h - 4);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: 'block' }}>
      <polyline fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" points={pts} />
    </svg>
  );
}

const fmtSigned = (n, d = 1, s = '') => {
  const v = Number(n);
  if (!Number.isFinite(v)) return `0${s}`;
  return `${v >= 0 ? '+' : ''}${v.toFixed(d)}${s}`;
};

const shortHealthTag = (score) => {
  if (score >= 80) return 'Euphoria Risk';
  if (score >= 60) return 'Risk-On Bull';
  if (score >= 40) return 'Choppy Neutral';
  if (score >= 20) return 'Risk-Off Weak';
  return 'Extreme Washout';
};

export default function MarketHealthMacroStudio({
  healthData,
  macroData,
  cycle50yData,
  onRefreshHealth,
  onRefreshMacro,
  onRefreshCycle50y,
  onTickerClick,
}) {
  const [viewMode, setViewMode] = useState('command'); // 'command' | 'cycle_50y' | 'breadth' | 'vol_credit' | 'macro_lab' | 'flow_10y'
  const [lookbackDays, setLookbackDays] = useState(120); // 60 | 120 | 252
  const [lowerRibbon, setLowerRibbon] = useState('mco'); // 'mco' | 'breadth' | 'vix' | 'credit' | 'curve_move' | 'cycle_50y'
  const [showSignals, setShowSignals] = useState(true);
  const [showRegimes, setShowRegimes] = useState(true);
  const [showGuide, setShowGuide] = useState(false);

  // 50-Year Cycle Tab Controls
  const [localCycle50y, setLocalCycle50y] = useState(cycle50yData || null);
  const [cycleHorizon, setCycleHorizon] = useState('50Y'); // '50Y' | '25Y' | '10Y' | '5Y'
  const [cycleLogScale, setCycleLogScale] = useState(true);
  const [show50yBottoms, setShow50yBottoms] = useState(true);
  const [show50yTops, setShow50yTops] = useState(true);

  const [macroSubView, setMacroSubView] = useState('simulator'); // 'simulator' | 'playbooks' | 'heatmap' | 'betas'
  const [selectedDriver, setSelectedDriver] = useState('10-Yr Yield');
  const [sortCol, setSortCol] = useState('corr_tnx');
  const [sortAsc, setSortAsc] = useState(false);

  // Macro Stress Simulator sliders
  const [simYieldShift, setSimYieldShift] = useState(0);
  const [simOilShift, setSimOilShift] = useState(0);
  const [simDollarShift, setSimDollarShift] = useState(0);

  // Live refresh & Auto 5m polling
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Plotly readiness & responsive width
  const [plotlyReady, setPlotlyReady] = useState(Boolean(typeof window !== 'undefined' && window.Plotly));
  const mainPlotRef = useRef(null);
  const labPlotRef = useRef(null);
  const plotWidth = usePlotWidth(mainPlotRef);
  const labPlotWidth = usePlotWidth(labPlotRef);

  useEffect(() => {
    if (plotlyReady) return undefined;
    const timer = setInterval(() => {
      if (typeof window !== 'undefined' && window.Plotly) {
        setPlotlyReady(true);
        clearInterval(timer);
      }
    }, 150);
    return () => clearInterval(timer);
  }, [plotlyReady]);

  useEffect(() => {
    if (cycle50yData) {
      setLocalCycle50y(cycle50yData);
      return;
    }
    fetch('/api/market_cycle_50y')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.current_verdict) setLocalCycle50y(d);
      })
      .catch(() => {});
  }, [cycle50yData]);

  const handleLiveRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      const [hRes, mRes, cRes] = await Promise.allSettled([
        fetch('/api/market_health?refresh=1', { method: 'POST' }),
        fetch('/api/macro_matrix?refresh=1', { method: 'POST' }),
        fetch('/api/market_cycle_50y?refresh=1', { method: 'POST' }),
      ]);
      if (hRes.status === 'fulfilled' && hRes.value.ok) {
        const txt = await hRes.value.text();
        const freshH = JSON.parse(txt.replace(/:\s*NaN\b/g, ': null'));
        if (freshH?.current_health && onRefreshHealth) onRefreshHealth(freshH);
      }
      if (mRes.status === 'fulfilled' && mRes.value.ok) {
        const txt = await mRes.value.text();
        const freshM = JSON.parse(txt.replace(/:\s*NaN\b/g, ': null'));
        if (freshM && onRefreshMacro) onRefreshMacro(freshM);
      }
      if (cRes.status === 'fulfilled' && cRes.value.ok) {
        const txt = await cRes.value.text();
        const freshC = JSON.parse(txt.replace(/:\s*NaN\b/g, ': null'));
        if (freshC?.current_verdict) {
          setLocalCycle50y(freshC);
          if (onRefreshCycle50y) onRefreshCycle50y(freshC);
        }
      }
    } catch (err) {
      console.error('Market Health & Macro refresh error:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (!autoRefresh) return undefined;
    const id = setInterval(() => { handleLiveRefresh(); }, 300000);
    return () => clearInterval(id);
  }, [autoRefresh]); // eslint-disable-line react-hooks/exhaustive-deps

  const curr = healthData?.current_health || {};
  const dataMeta = healthData?.data_meta || {};
  const cycleData = localCycle50y || cycle50yData || null;
  const cycleVerdict = cycleData?.current_verdict || null;
  const cycleEmp = cycleData?.empirical_stats || {};
  const recent252Map = useMemo(() => {
    const m = {};
    (cycleData?.recent_252d || []).forEach((r) => { m[r.date] = r; });
    return m;
  }, [cycleData]);
  const allHist = useMemo(() => (Array.isArray(healthData?.historical_data) ? healthData.historical_data : []), [healthData]);
  const histSlice = useMemo(() => allHist.slice(-Math.min(lookbackDays, Math.max(allHist.length, 1))), [allHist, lookbackDays]);

  const macroQuotes = macroData?.macro_quotes || {};
  const activeRegime = macroData?.active_regime?.id
    ? macroData.active_regime
    : {
        id: 'DEFLATION',
        name: 'Deflationary / Risk-Off De-Leveraging',
        confidence: 82,
        favored_sectors: ['TLT', 'XLU', 'XLV', 'GC=F'],
        unfavored_sectors: ['SMH', 'XLK', 'XLE'],
        driver_summary: 'Elevated VIX & negative breadth paired with softening yields/oil.',
      };
  const qMeta = MACRO_Q_META[activeRegime.id] || MACRO_Q_META.DEFLATION;
  const regimeTrail = useMemo(() => (Array.isArray(macroData?.regime_trail) ? macroData.regime_trail : []), [macroData]);
  const scenarios = useMemo(() => (Array.isArray(macroData?.scenarios) ? macroData.scenarios : []), [macroData]);
  const crossMatrix = macroData?.cross_asset_matrix || { assets: [], values: {} };
  const sectorSensitivities = useMemo(() => (Array.isArray(macroData?.sector_sensitivities) ? macroData.sector_sensitivities : []), [macroData]);

  // Scalar telemetry values
  const score = Number(curr.score_value ?? 50);
  const delta5d = Number(curr.score_5d_delta ?? 0);
  const regime = curr.health_regime || (score >= 60 ? 'RISK_ON' : score <= 40 ? 'RISK_OFF' : 'CAUTIOUS');
  const regimeColor = score >= 60 ? '#00E676' : score <= 40 ? '#ff3366' : '#fbbf24';

  const adv = Number(curr.advances_count ?? 0);
  const dec = Number(curr.declines_count ?? 0);
  const upVolPct = Number(curr.up_vol_pct ?? 50);
  const p50 = Number(curr.pct_above_50_value ?? 0);
  const p200 = Number(curr.pct_above_200_value ?? 0);

  const mcoVal = Number(curr.mco_value ?? 0);
  const mcoColor = mcoVal > 300 ? '#fbbf24' : mcoVal > 0 ? '#00E676' : '#ff3366';
  const zbtVal = Number(curr.zbt_val ?? 50);
  const zbtTag = curr.zbt_thrust_active ? 'THRUST!' : zbtVal < 40 ? '<40% OS' : zbtVal >= 50 ? 'RECOVER' : 'WEAK';

  const vixVal = Number(curr.vix_value ?? 16);
  const vixRatio = Number(curr.vix_ratio ?? 1.0);
  const vixContango = curr.vix_structure?.includes('Contango') || vixRatio < 1.0;
  const moveVal = Number(curr.move_val ?? 95);

  const hygZ = Number(curr.hyg_zscore_val ?? 0);
  const ycBps = Number(curr.yield_curve_bps ?? Math.round((Number(curr.tnx_val ?? 4.5) - Number(curr.irx_val ?? 4.0)) * 100));

  const lastTrailPt = regimeTrail.length ? regimeTrail[regimeTrail.length - 1] : { growth_score: -1.5, inflation_score: -1.5 };

  const factorAttribs = useMemo(() => {
    if (Array.isArray(curr.factor_attribution) && curr.factor_attribution.length > 0) {
      return curr.factor_attribution;
    }
    return [
      { key: 'mco', label: 'MCO', z: 0, raw: mcoVal, unit: '' },
      { key: 'p50', label: '>50d', z: 0, raw: p50, unit: '%' },
      { key: 'nhnl', label: 'NH-NL', z: 0, raw: Number(curr.nhnl_10d_ma ?? 0), unit: '' },
      { key: 'vix', label: 'VIX Inv', z: 0, raw: vixVal, unit: '' },
      { key: 'credit', label: 'Credit', z: hygZ, raw: Number(curr.hyg_ratio_val ?? 0.85), unit: '' },
    ];
  }, [curr, mcoVal, p50, vixVal, hygZ]);

  // Simulated Sector Impacts
  const simProjections = useMemo(() => (
    sectorSensitivities.map((sec) => {
      const yImp = (simYieldShift / 10) * sec.corr_tnx * 0.8;
      const oImp = (simOilShift / 5) * sec.corr_oil * 0.6;
      const dImp = (simDollarShift / 2) * sec.corr_dxy * 0.5;
      const expectedReturn = Math.round((yImp + oImp + dImp) * 100) / 100;
      return { ...sec, expectedReturn };
    }).sort((a, b) => b.expectedReturn - a.expectedReturn)
  ), [sectorSensitivities, simYieldShift, simOilShift, simDollarShift]);

  const sortedBetas = useMemo(() => {
    const arr = [...sectorSensitivities];
    arr.sort((a, b) => {
      const va = Number(a[sortCol] ?? 0);
      const vb = Number(b[sortCol] ?? 0);
      return sortAsc ? va - vb : vb - va;
    });
    return arr;
  }, [sectorSensitivities, sortCol, sortAsc]);

  const extremePairs = useMemo(() => {
    const assets = crossMatrix.assets || [];
    const values = crossMatrix.values || {};
    const pairs = [];
    for (let i = 0; i < assets.length; i += 1) {
      for (let j = i + 1; j < assets.length; j += 1) {
        const v = values[assets[i].symbol]?.[assets[j].symbol];
        if (typeof v === 'number') pairs.push({ pair: `${assets[i].label} ↔ ${assets[j].label}`, val: v });
      }
    }
    pairs.sort((a, b) => b.val - a.val);
    return { topPos: pairs.slice(0, 3), topNeg: [...pairs].reverse().slice(0, 3) };
  }, [crossMatrix]);

  const currentScenario = useMemo(
    () => scenarios.find((s) => s.driver.toLowerCase() === selectedDriver.toLowerCase()) || scenarios[0],
    [scenarios, selectedDriver],
  );

  // =========================================================================
  // MAIN PLOTLY CANVAS EFFECT (command | breadth | vol_credit)
  // =========================================================================
  useEffect(() => {
    if (!plotlyReady || !mainPlotRef.current) return undefined;
    if (viewMode === 'macro_lab' || viewMode === 'flow_10y') return undefined;
    if (viewMode !== 'cycle_50y' && !histSlice.length) return undefined;
    if (viewMode === 'cycle_50y' && !cycleData?.series_50y_weekly?.length) return undefined;

    const Plotly = window.Plotly;
    const el = mainPlotRef.current;
    const isNarrow = plotWidth < 840;
    const dates = histSlice.map((d) => d.date);

    let traces = [];
    let layout = {};

    try {
      if (viewMode === 'command') {
        const healthArr = histSlice.map((d) => Number(d.health_oscillator ?? 50));
        const spyArr = histSlice.map((d) => Number(d.spy ?? 0));
        const dotColors = healthArr.map((v) => (v >= 60 ? '#00E676' : v >= 40 ? '#fbbf24' : '#ff3366'));

        const shapes = [];
        const annotations = [
          {
            xref: 'paper', yref: 'paper', x: 0.0, y: 1.016, xanchor: 'left', yanchor: 'bottom',
            text: `<b>COMPOSITE HEALTH (0–100) vs SPY</b> · ${lookbackDays}D`,
            showarrow: false, font: { color: '#e2e8f0', size: isNarrow ? 8.5 : 9.5, family: 'JetBrains Mono, monospace' },
          },
          {
            xref: 'paper', yref: 'paper', x: 0.90, y: 1.016, xanchor: 'center', yanchor: 'bottom',
            text: '<b>5-FACTOR Z-SCORE ATTRIBUTION</b>',
            showarrow: false, font: { color: '#38bdf8', size: isNarrow ? 8.2 : 9, family: 'JetBrains Mono, monospace' },
          },
          {
            xref: 'paper', yref: 'paper', x: 0.90, y: 0.442, xanchor: 'center', yanchor: 'bottom',
            text: '<b>MACRO CYCLE TRAIL (12W)</b>',
            showarrow: false, font: { color: qMeta.color, size: isNarrow ? 8.2 : 9, family: 'JetBrains Mono, monospace' },
          },
        ];

        const leftEnd = isNarrow ? 0.64 : 0.675;
        const rightStart = isNarrow ? 0.795 : 0.805;
        const spyMin = Math.min(...spyArr);
        const spyMax = Math.max(...spyArr);
        const spyPad = Math.max(spyMax - spyMin, 5) * 0.14;

        if (showRegimes) {
          shapes.push(
            { type: 'rect', xref: 'x5', yref: 'y', x0: dates[0], x1: dates[dates.length - 1], y0: 60, y1: 100, fillcolor: 'rgba(0, 230, 118, 0.06)', line: { width: 0 }, layer: 'below' },
            { type: 'rect', xref: 'x5', yref: 'y', x0: dates[0], x1: dates[dates.length - 1], y0: 40, y1: 60, fillcolor: 'rgba(251, 191, 36, 0.04)', line: { width: 0 }, layer: 'below' },
            { type: 'rect', xref: 'x5', yref: 'y', x0: dates[0], x1: dates[dates.length - 1], y0: 0, y1: 40, fillcolor: 'rgba(255, 51, 102, 0.07)', line: { width: 0 }, layer: 'below' },
            { type: 'line', xref: 'x5', yref: 'y', x0: dates[0], x1: dates[dates.length - 1], y0: 60, y1: 60, line: { color: 'rgba(0, 230, 118, 0.45)', width: 1, dash: 'dash' } },
            { type: 'line', xref: 'x5', yref: 'y', x0: dates[0], x1: dates[dates.length - 1], y0: 40, y1: 40, line: { color: 'rgba(255, 51, 102, 0.45)', width: 1, dash: 'dash' } },
          );
        }

        // 1. SPY Price (Left-Top Overlay Axis y2 — unpinned from zero so trend & inflection signals pop)
        traces.push({
          type: 'scatter', mode: 'lines', x: dates, y: spyArr, xaxis: 'x5', yaxis: 'y2', name: 'SPY Price',
          line: { color: '#cbd5e1', width: 1.85 },
          hovertemplate: '%{x}<br>SPY: <b>$%{y:.2f}</b><extra></extra>',
        });

        // 2. Composite Health Oscillator (Left-Top Main Axis y)
        traces.push({
          type: 'scatter', mode: 'lines+markers', x: dates, y: healthArr, xaxis: 'x5', yaxis: 'y', name: 'Health Score',
          line: { color: '#00F0FF', width: 2.3 },
          marker: { size: 3.5, color: dotColors },
          hovertemplate: '%{x}<br>Health Score: <b>%{y:.1f}/100</b><extra></extra>',
        });

        // 3. Debounced Signals on SPY curve (prevents noisy clustering on consecutive bars)
        if (showSignals) {
          const buyPts = [];
          const sellPts = [];
          const recentCalls = [];
          let lastBuyIdx = -99;
          let lastSellIdx = -99;

          histSlice.forEach((d, idx) => {
            const isHindOnset = Boolean(d.hindenburg) && (idx === 0 || !histSlice[idx - 1]?.hindenburg);
            const isTitOnset = Boolean(d.titanic) && (idx === 0 || !histSlice[idx - 1]?.titanic);

            if ((d.mco_signal === 'BUY' || d.vix_bb_buy) && idx - lastBuyIdx >= 7) {
              const label = d.mco_signal === 'BUY' ? (d.mco_signal_type || 'MCO BUY') : 'VIX BB Re-entry';
              const note = d.mco_signal === 'BUY' ? (d.mco_signal_note || '') : 'VIX closed back inside 2σ BB';
              const pt = { x: d.date, y: Number(d.spy), label, note, text: d.mco_signal === 'BUY' ? `▲ ${label}` : '▲ VIX BB BUY', buy: true, idx };
              buyPts.push(pt);
              recentCalls.push(pt);
              lastBuyIdx = idx;
            }
            if (d.mco_signal === 'SELL' && idx - lastSellIdx >= 7) {
              const label = d.mco_signal_type || 'MCO SELL';
              const pt = { x: d.date, y: Number(d.spy), label, note: d.mco_signal_note || '', text: `▼ ${label}`, buy: false, idx };
              sellPts.push(pt);
              recentCalls.push(pt);
              lastSellIdx = idx;
            } else if ((isHindOnset || isTitOnset) && idx - lastSellIdx >= 10) {
              const nm = isHindOnset ? 'Hindenburg' : 'Titanic';
              const pt = { x: d.date, y: Number(d.spy), label: nm, note: 'Breadth divergence onset', text: `▼ ${nm}`, buy: false, idx };
              sellPts.push(pt);
              recentCalls.push(pt);
              lastSellIdx = idx;
            }
          });

          if (buyPts.length > 0) {
            traces.push({
              type: 'scatter', mode: 'markers', x: buyPts.map((p) => p.x), y: buyPts.map((p) => p.y),
              xaxis: 'x5', yaxis: 'y2', name: '▲ BUY Signal',
              marker: { symbol: 'triangle-up', size: 10, color: '#00E676', line: { color: '#052e16', width: 1.2 } },
              text: buyPts.map((p) => `${p.label}<br>${p.note}`),
              hovertemplate: '<b>▲ BUY</b> · %{x}<br>SPY $%{y:.2f}<br>%{text}<extra></extra>',
            });
          }
          if (sellPts.length > 0) {
            traces.push({
              type: 'scatter', mode: 'markers', x: sellPts.map((p) => p.x), y: sellPts.map((p) => p.y),
              xaxis: 'x5', yaxis: 'y2', name: '▼ SELL Signal',
              marker: { symbol: 'triangle-down', size: 10, color: '#ff3366', line: { color: '#450a0a', width: 1.2 } },
              text: sellPts.map((p) => `${p.label}<br>${p.note}`),
              hovertemplate: '<b>▼ SELL</b> · %{x}<br>SPY $%{y:.2f}<br>%{text}<extra></extra>',
            });
          }

          // Debounced 50-Year Structural Bottom/Top Cycle Markers on SPY
          const c50Bot = [];
          const c50Top = [];
          let last50B = -99;
          let last50T = -99;
          histSlice.forEach((d, idx) => {
            const c = recent252Map[d.date];
            if (!c) return;
            if ((c.bottom_stage1 || c.bottom_confirmed) && idx - last50B >= 20) {
              c50Bot.push({
                x: d.date, y: Number(d.spy), idx,
                text: `${c.bottom_confirmed ? '50Y Confirmed Bot' : '50Y Washout'} (${c.bottom_score})`,
              });
              last50B = idx;
            }
            if (c.top_confirmed && idx - last50T >= 20) {
              c50Top.push({
                x: d.date, y: Number(d.spy), idx,
                text: `50Y Top Brk (${c.top_score})`,
              });
              last50T = idx;
            }
          });
          if (c50Bot.length > 0) {
            traces.push({
              type: 'scatter', mode: 'markers', x: c50Bot.map((p) => p.x), y: c50Bot.map((p) => p.y),
              xaxis: 'x5', yaxis: 'y2', name: '★ 50Y BOT',
              marker: { symbol: 'star', size: 12, color: '#00F0FF', line: { color: '#052e16', width: 1.2 } },
              text: c50Bot.map((p) => p.text),
              hovertemplate: '<b>★ 50Y BOTTOM</b> · %{x}<br>SPY $%{y:.2f}<br>%{text}<extra></extra>',
            });
            const latest50B = c50Bot[c50Bot.length - 1];
            if (latest50B.idx >= histSlice.length - 12) {
              annotations.push({
                xref: 'x5', yref: 'y2', x: latest50B.x, y: latest50B.y,
                text: `<b>★ 50Y BOT ${cycleVerdict?.bottom_score ?? ''}</b>`,
                showarrow: true, arrowhead: 2, arrowsize: 0.7, arrowwidth: 1.2, arrowcolor: '#00F0FF',
                ax: -22, ay: 6, xanchor: 'right', yanchor: 'middle',
                font: { color: '#ffffff', size: 8, family: 'JetBrains Mono, monospace' },
                bgcolor: 'rgba(6, 78, 59, 0.94)', bordercolor: '#00F0FF', borderwidth: 1, borderpad: 2,
              });
            }
          }
          if (c50Top.length > 0) {
            traces.push({
              type: 'scatter', mode: 'markers', x: c50Top.map((p) => p.x), y: c50Top.map((p) => p.y),
              xaxis: 'x5', yaxis: 'y2', name: '◆ 50Y TOP',
              marker: { symbol: 'diamond', size: 10, color: '#fb923c', line: { color: '#450a0a', width: 1.2 } },
              text: c50Top.map((p) => p.text),
              hovertemplate: '<b>◆ 50Y TOP</b> · %{x}<br>SPY $%{y:.2f}<br>%{text}<extra></extra>',
            });
            const latest50T = c50Top[c50Top.length - 1];
            if (latest50T.idx >= histSlice.length - 12) {
              annotations.push({
                xref: 'x5', yref: 'y2', x: latest50T.x, y: latest50T.y,
                text: `<b>◆ 50Y TOP ${cycleVerdict?.top_score ?? ''}</b>`,
                showarrow: true, arrowhead: 2, arrowsize: 0.7, arrowwidth: 1.2, arrowcolor: '#ff3366',
                ax: -22, ay: -16, xanchor: 'right', yanchor: 'bottom',
                font: { color: '#ffffff', size: 8, family: 'JetBrains Mono, monospace' },
                bgcolor: 'rgba(127, 29, 29, 0.94)', bordercolor: '#ff3366', borderwidth: 1, borderpad: 2,
              });
            }
          }

          // Pick latest valid SELL and latest valid BUY cleanly inside [0.08..0.90] X & >=0.22 apart
          const placedCallN = [];
          const candidateList = [
            ...[...sellPts].reverse().slice(0, 1),
            ...[...buyPts].reverse().slice(0, 1),
            ...[...recentCalls].reverse().slice(0, 6),
          ];
          candidateList.forEach((c) => {
            if (placedCallN.length >= 2) return;
            const nx = c.idx / Math.max(1, histSlice.length - 1);
            if (nx < 0.08 || nx > 0.90) return;
            if (placedCallN.some((px) => Math.abs(px - nx) < 0.22)) return;
            placedCallN.push(nx);
            const ny = (c.y - spyMin) / Math.max(spyMax - spyMin, 1);
            const col = c.buy ? '#00E676' : '#ff3366';
            annotations.push({
              xref: 'x5', yref: 'y2', x: c.x, y: c.y,
              text: `<b>${c.text}</b>`,
              showarrow: true, arrowhead: 2, arrowsize: 0.7, arrowwidth: 1.2, arrowcolor: col,
              ax: nx > 0.70 ? -18 : 16,
              ay: ny > 0.65 ? 24 : -24,
              xanchor: nx > 0.70 ? 'right' : 'left',
              yanchor: ny > 0.65 ? 'top' : 'bottom',
              font: { color: '#ffffff', size: 8, family: 'JetBrains Mono, monospace' },
              bgcolor: c.buy ? 'rgba(6, 78, 59, 0.92)' : 'rgba(127, 29, 29, 0.92)',
              bordercolor: col, borderwidth: 1, borderpad: 2,
            });
          });
        }

        // 4. Lower Synchronized Ribbon (xaxis: 'x', yaxis5: 'y5')
        let ribbonTitle = '';
        let y5Config = { domain: [0.00, 0.285], anchor: 'x', tickfont: { size: 8.5, color: '#94a3b8', family: 'JetBrains Mono, monospace' }, gridcolor: 'rgba(255,255,255,0.05)', zerolinecolor: 'rgba(255,255,255,0.18)' };
        let y6Config = null;

        if (lowerRibbon === 'mco') {
          ribbonTitle = 'MCCLELLAN OSCILLATOR (MCO) + SUMMATION INDEX';
          const mcoArr = histSlice.map((d) => Number(d.mco ?? 0));
          const sumArr = histSlice.map((d) => Number(d.summation_index ?? 0));
          const minM = Math.min(...mcoArr, -350);
          const maxM = Math.max(...mcoArr, 350);
          const pad = Math.max(Math.abs(minM), Math.abs(maxM)) * 0.14;
          y5Config = { ...y5Config, range: [minM - pad, maxM + pad] };
          y6Config = { overlaying: 'y5', side: 'right', anchor: 'x', showgrid: false, showticklabels: false };
          traces.push(
            {
              type: 'bar', x: dates, y: mcoArr, xaxis: 'x', yaxis: 'y5', name: 'MCO',
              marker: { color: mcoArr.map((v) => (v >= 0 ? 'rgba(0, 230, 118, 0.8)' : 'rgba(255, 51, 102, 0.8)')) },
              hovertemplate: '%{x}<br>MCO: <b>%{y:.1f}</b><extra></extra>',
            },
            {
              type: 'scatter', mode: 'lines', x: dates, y: sumArr, xaxis: 'x', yaxis: 'y6', name: 'Summation Index',
              line: { color: '#38bdf8', width: 1.5, dash: 'dot' },
              hovertemplate: '%{x}<br>Summation: <b>%{y:,.0f}</b><extra></extra>',
            },
          );
          shapes.push(
            { type: 'line', xref: 'x', yref: 'y5', x0: dates[0], x1: dates[dates.length - 1], y0: 300, y1: 300, line: { color: 'rgba(251, 191, 36, 0.4)', width: 1, dash: 'dot' } },
            { type: 'line', xref: 'x', yref: 'y5', x0: dates[0], x1: dates[dates.length - 1], y0: -300, y1: -300, line: { color: 'rgba(0, 230, 118, 0.4)', width: 1, dash: 'dot' } },
          );
        } else if (lowerRibbon === 'breadth') {
          ribbonTitle = 'BREADTH % >50/200 SMA + ZWEIG 10D EMA';
          y5Config = { ...y5Config, range: [0, 100], ticksuffix: '%' };
          traces.push(
            {
              type: 'scatter', mode: 'lines', x: dates, y: histSlice.map((d) => Number(d.pct_above_50 ?? 50)),
              xaxis: 'x', yaxis: 'y5', name: '% > 50 SMA', fill: 'tozeroy',
              fillcolor: 'rgba(56, 189, 248, 0.14)', line: { color: '#38bdf8', width: 2 },
            },
            {
              type: 'scatter', mode: 'lines', x: dates, y: histSlice.map((d) => Number(d.pct_above_200 ?? 50)),
              xaxis: 'x', yaxis: 'y5', name: '% > 200 SMA', line: { color: '#94a3b8', width: 1.3, dash: 'dash' },
            },
            {
              type: 'scatter', mode: 'lines', x: dates, y: histSlice.map((d) => Number(d.zbt ?? 50)),
              xaxis: 'x', yaxis: 'y5', name: 'Zweig 10D EMA', line: { color: '#fbbf24', width: 1.6 },
            },
          );
          shapes.push(
            { type: 'line', xref: 'x', yref: 'y5', x0: dates[0], x1: dates[dates.length - 1], y0: 50, y1: 50, line: { color: 'rgba(148,163,184,0.45)', width: 1, dash: 'dash' } },
            { type: 'line', xref: 'x', yref: 'y5', x0: dates[0], x1: dates[dates.length - 1], y0: 61.5, y1: 61.5, line: { color: 'rgba(0,230,118,0.4)', width: 1, dash: 'dot' } },
          );
        } else if (lowerRibbon === 'vix') {
          ribbonTitle = 'VIX vs VIX3M TERM STRUCTURE + UPPER 2σ BB';
          traces.push(
            { type: 'scatter', mode: 'lines', x: dates, y: histSlice.map((d) => Number(d.vix ?? 16)), xaxis: 'x', yaxis: 'y5', name: 'Spot VIX', line: { color: '#ff3366', width: 2 } },
            { type: 'scatter', mode: 'lines', x: dates, y: histSlice.map((d) => Number(d.vix3m ?? 18)), xaxis: 'x', yaxis: 'y5', name: 'VIX3M', line: { color: '#38bdf8', width: 1.6, dash: 'dash' } },
            { type: 'scatter', mode: 'lines', x: dates, y: histSlice.map((d) => d.vix_upper_bb), xaxis: 'x', yaxis: 'y5', name: 'Upper 2σ BB', line: { color: '#fbbf24', width: 1.2, dash: 'dot' } },
          );
        } else if (lowerRibbon === 'credit') {
          ribbonTitle = 'HIGH-YIELD CREDIT SPREADS (HYG/IEF 126D Z-SCORE)';
          const zArr = histSlice.map((d) => Number(d.hyg_zscore ?? 0));
          y5Config = { ...y5Config, range: [Math.min(-3.5, Math.min(...zArr) - 0.4), Math.max(3.0, Math.max(...zArr) + 0.4)] };
          traces.push({
            type: 'bar', x: dates, y: zArr, xaxis: 'x', yaxis: 'y5', name: 'HYG/IEF Z',
            marker: { color: zArr.map((v) => (v >= 0 ? 'rgba(0,230,118,0.8)' : v < -1.5 ? 'rgba(255,51,102,0.9)' : 'rgba(251,191,36,0.8)')) },
          });
          shapes.push({ type: 'line', xref: 'x', yref: 'y5', x0: dates[0], x1: dates[dates.length - 1], y0: -1.5, y1: -1.5, line: { color: '#ff3366', width: 1.2, dash: 'dash' } });
        } else if (lowerRibbon === 'cycle_50y') {
          ribbonTitle = '50-YEAR CYCLE: BOTTOM SCORE (EMERALD) vs TOP RISK SCORE (CRIMSON)';
          const bArr = histSlice.map((d) => Number(recent252Map[d.date]?.bottom_score ?? 0));
          const tArr = histSlice.map((d) => Number(recent252Map[d.date]?.top_score ?? 0));
          y5Config = { ...y5Config, range: [0, 102] };
          traces.push(
            {
              type: 'scatter', mode: 'lines', x: dates, y: bArr, xaxis: 'x', yaxis: 'y5', name: '50Y Bottom Score',
              fill: 'tozeroy', fillcolor: 'rgba(0, 230, 118, 0.14)', line: { color: '#00E676', width: 2 },
              hovertemplate: '%{x}<br>50Y Bottom: <b>%{y:.1f}/100</b><extra></extra>',
            },
            {
              type: 'scatter', mode: 'lines', x: dates, y: tArr, xaxis: 'x', yaxis: 'y5', name: '50Y Top Risk',
              fill: 'tozeroy', fillcolor: 'rgba(255, 51, 102, 0.12)', line: { color: '#ff3366', width: 2 },
              hovertemplate: '%{x}<br>50Y Top Risk: <b>%{y:.1f}/100</b><extra></extra>',
            },
          );
          shapes.push({ type: 'line', xref: 'x', yref: 'y5', x0: dates[0], x1: dates[dates.length - 1], y0: 70, y1: 70, line: { color: 'rgba(251, 191, 36, 0.65)', width: 1.2, dash: 'dash' } });
        } else {
          ribbonTitle = '10Y-3M YIELD CURVE SLOPE (%) + BOND VOL (MOVE)';
          y6Config = { overlaying: 'y5', side: 'right', anchor: 'x', showgrid: false, tickfont: { size: 8, color: '#c084fc' } };
          traces.push(
            { type: 'scatter', mode: 'lines', x: dates, y: histSlice.map((d) => Number(d.yield_curve_10y3m ?? 0)), xaxis: 'x', yaxis: 'y5', name: '10Y-3M (%)', fill: 'tozeroy', fillcolor: 'rgba(56,189,248,0.14)', line: { color: '#38bdf8', width: 2 } },
            { type: 'scatter', mode: 'lines', x: dates, y: histSlice.map((d) => Number(d.move ?? 95)), xaxis: 'x', yaxis: 'y6', name: 'MOVE', line: { color: '#c084fc', width: 1.5, dash: 'dot' } },
          );
        }

        annotations.push({
          xref: 'paper', yref: 'paper', x: 0.0, y: 0.305, xanchor: 'left', yanchor: 'bottom',
          text: `<b>${ribbonTitle}</b>`,
          showarrow: false, font: { color: '#94a3b8', size: 8.5, family: 'JetBrains Mono, monospace' },
        });

        // 5. Right-Top: 5-Factor Z-Score Attribution Horizontal Bars (x3, y3)
        const reversedFactors = [...factorAttribs].reverse();
        const fLabels = reversedFactors.map((f) => {
          if (f.key === 'mco') return 'MCO';
          if (f.key === 'p50') return '>50d';
          if (f.key === 'nhnl') return 'NH-NL';
          if (f.key === 'vix') return 'VIX';
          return 'Credit';
        });
        const fZ = reversedFactors.map((f) => Number(f.z ?? 0));
        const minFZ = Math.min(-2.5, ...fZ) - 1.25;
        const maxFZ = Math.max(1.8, ...fZ) + 1.25;
        traces.push({
          type: 'bar', orientation: 'h',
          x: fZ, y: fLabels,
          xaxis: 'x3', yaxis: 'y3', name: 'Factor Z',
          marker: { color: fZ.map((z) => (z >= 0 ? '#00E676' : z > -1.2 ? '#fbbf24' : '#ff3366')) },
          text: fZ.map((z) => `${z >= 0 ? '+' : ''}${z.toFixed(1)}σ`),
          textposition: fZ.map((z) => (Math.abs(z) >= 1.2 ? 'inside' : 'outside')),
          insidetextanchor: 'middle',
          textfont: { size: 8.2, color: '#ffffff', family: 'JetBrains Mono, monospace' },
          customdata: reversedFactors.map((f) => `${f.label}: ${f.raw}${f.unit}`),
          hovertemplate: '%{customdata}<br>Z-Score: <b>%{x:+.2f}σ</b><extra></extra>',
        });

        // 6. Right-Bottom: 4-Quadrant Macro Cycle Trajectory (x4, y4)
        const trailX = regimeTrail.map((p) => Number(p.growth_score ?? 0));
        const trailY = regimeTrail.map((p) => Number(p.inflation_score ?? 0));
        const trailLabels = regimeTrail.map((p) => `${p.label} (${p.quadrant})`);

        // Shaded quadrant backgrounds + axes zero lines
        shapes.push(
          { type: 'rect', xref: 'x4', yref: 'y4', x0: -3.6, x1: 0, y0: 0, y1: 3.6, fillcolor: 'rgba(255, 51, 102, 0.09)', line: { width: 0 }, layer: 'below' },
          { type: 'rect', xref: 'x4', yref: 'y4', x0: 0, x1: 3.6, y0: 0, y1: 3.6, fillcolor: 'rgba(251, 191, 36, 0.09)', line: { width: 0 }, layer: 'below' },
          { type: 'rect', xref: 'x4', yref: 'y4', x0: -3.6, x1: 0, y0: -3.6, y1: 0, fillcolor: 'rgba(0, 240, 255, 0.09)', line: { width: 0 }, layer: 'below' },
          { type: 'rect', xref: 'x4', yref: 'y4', x0: 0, x1: 3.6, y0: -3.6, y1: 0, fillcolor: 'rgba(0, 230, 118, 0.09)', line: { width: 0 }, layer: 'below' },
          { type: 'line', xref: 'x4', yref: 'y4', x0: -3.6, x1: 3.6, y0: 0, y1: 0, line: { color: 'rgba(255,255,255,0.2)', width: 1 } },
          { type: 'line', xref: 'x4', yref: 'y4', x0: 0, x1: 0, y0: -3.6, y1: 3.6, line: { color: 'rgba(255,255,255,0.2)', width: 1 } },
        );

        annotations.push(
          { xref: 'x4', yref: 'y4', x: -3.45, y: 3.45, xanchor: 'left', yanchor: 'top', text: 'STAG', showarrow: false, font: { size: 8, color: '#ff3366', family: 'JetBrains Mono, monospace' } },
          { xref: 'x4', yref: 'y4', x: 3.45, y: 3.45, xanchor: 'right', yanchor: 'top', text: 'REFL', showarrow: false, font: { size: 8, color: '#fbbf24', family: 'JetBrains Mono, monospace' } },
          { xref: 'x4', yref: 'y4', x: -3.45, y: -3.45, xanchor: 'left', yanchor: 'bottom', text: 'DEFL', showarrow: false, font: { size: 8, color: '#00F0FF', family: 'JetBrains Mono, monospace' } },
          { xref: 'x4', yref: 'y4', x: 3.45, y: -3.45, xanchor: 'right', yanchor: 'bottom', text: 'GOLD', showarrow: false, font: { size: 8, color: '#00E676', family: 'JetBrains Mono, monospace' } },
        );

        if (trailX.length > 0) {
          traces.push({
            type: 'scatter', mode: 'lines+markers', x: trailX, y: trailY, xaxis: 'x4', yaxis: 'y4', name: '12W Trail',
            line: { color: '#94a3b8', width: 1.5, dash: 'dot' },
            marker: { size: trailX.map((_, idx) => (idx === trailX.length - 1 ? 0 : 4.5 + (idx * 0.25))), color: 'rgba(226, 232, 240, 0.7)' },
            text: trailLabels,
            hovertemplate: '%{text}<br>Growth %{x:+.2f} · Infl %{y:+.2f}<extra></extra>',
          });
          const lx = trailX[trailX.length - 1];
          const ly = trailY[trailY.length - 1];
          const lDate = regimeTrail[regimeTrail.length - 1]?.label || 'Now';
          traces.push({
            type: 'scatter', mode: 'markers', x: [lx], y: [ly], xaxis: 'x4', yaxis: 'y4', name: 'Current Cycle',
            marker: { symbol: 'star', size: 11, color: qMeta.color, line: { color: '#ffffff', width: 1 } },
            hovertemplate: `<b>NOW (${lDate})</b> · ${qMeta.title}<br>Growth ${lx >= 0 ? '+' : ''}${lx.toFixed(2)} · Infl ${ly >= 0 ? '+' : ''}${ly.toFixed(2)}<extra></extra>`,
          });
          // Point "Now" annotation inward toward (0,0) so it never touches outer corner label
          annotations.push({
            xref: 'x4', yref: 'y4', x: lx, y: ly,
            text: `<b>NOW ${lDate}</b>`,
            showarrow: true, arrowhead: 0, arrowwidth: 1, arrowcolor: qMeta.color,
            ax: lx >= 0 ? -18 : 18,
            ay: ly >= 0 ? 16 : -16,
            xanchor: lx >= 0 ? 'right' : 'left',
            yanchor: ly >= 0 ? 'top' : 'bottom',
            font: { size: 8, color: '#ffffff', family: 'JetBrains Mono, monospace' },
            bgcolor: 'rgba(11, 17, 30, 0.92)', bordercolor: qMeta.color, borderwidth: 1, borderpad: 2,
          });
        }

        layout = {
          paper_bgcolor: '#060910',
          plot_bgcolor: '#090d16',
          height: isNarrow ? 408 : 426,
          margin: { l: 40, r: 12, t: 25, b: 24 },
          showlegend: false,
          hovermode: 'closest',
          dragmode: 'pan',
          shapes,
          annotations,
          xaxis5: { domain: [0, leftEnd], anchor: 'y', matches: 'x', showticklabels: false, gridcolor: 'rgba(255,255,255,0.04)', zeroline: false },
          yaxis: { domain: [0.39, 1.00], range: [0, 102], tickfont: { size: 9, color: '#94a3b8', family: 'JetBrains Mono, monospace' }, gridcolor: 'rgba(255,255,255,0.05)', zeroline: false },
          yaxis2: { overlaying: 'y', side: 'right', anchor: 'x5', range: [spyMin - spyPad, spyMax + spyPad], showgrid: false, tickprefix: '$', tickfont: { size: 8.5, color: '#cbd5e1', family: 'JetBrains Mono, monospace' } },
          xaxis: { domain: [0, leftEnd], anchor: 'y5', tickfont: { size: 8.5, color: '#94a3b8', family: 'JetBrains Mono, monospace' }, gridcolor: 'rgba(255,255,255,0.04)', nticks: 8 },
          yaxis5: y5Config,
          ...(y6Config ? { yaxis6: y6Config } : {}),
          xaxis3: { domain: [rightStart, 0.995], anchor: 'y3', range: [minFZ, maxFZ], zerolinecolor: 'rgba(255,255,255,0.28)', tickfont: { size: 8, color: '#94a3b8', family: 'JetBrains Mono, monospace' }, gridcolor: 'rgba(255,255,255,0.04)' },
          yaxis3: { domain: [0.58, 1.00], anchor: 'x3', tickfont: { size: 9, color: '#e2e8f0', family: 'JetBrains Mono, monospace' }, showgrid: false },
          xaxis4: { domain: [rightStart, 0.995], anchor: 'y4', range: [-3.6, 3.6], showticklabels: false, zeroline: false, gridcolor: 'rgba(255,255,255,0.04)' },
          yaxis4: { domain: [0.00, 0.42], anchor: 'x4', range: [-3.6, 3.6], showticklabels: false, zeroline: false, gridcolor: 'rgba(255,255,255,0.04)' },
        };
      } else if (viewMode === 'breadth') {
        // =========================================================================
        // VIEW 2: SYNCHRONIZED 2x2 MARKET BREADTH LAB
        // =========================================================================
        const mcoArr = histSlice.map((d) => Number(d.mco ?? 0));
        const sumArr = histSlice.map((d) => Number(d.summation_index ?? 0));
        const bMin = Math.min(...mcoArr, -350);
        const bMax = Math.max(...mcoArr, 350);
        const bPad = Math.max(Math.abs(bMin), Math.abs(bMax)) * 0.14;

        // Indexed Ratios Base=100 from first bar of histSlice
        const mkIdx = (key, defVal) => {
          const base = Number(histSlice[0]?.[key] || defVal || 1);
          return histSlice.map((d) => Number((((Number(d[key] ?? base)) / Math.max(base, 1e-6)) * 100).toFixed(2)));
        };

        const buyB = [];
        const sellB = [];
        let lastBuyB = -99;
        let lastSellB = -99;
        histSlice.forEach((d, idx) => {
          if (d.mco_signal === 'BUY' && idx - lastBuyB >= 7) {
            buyB.push(d);
            lastBuyB = idx;
          } else if (d.mco_signal === 'SELL' && idx - lastSellB >= 7) {
            sellB.push(d);
            lastSellB = idx;
          }
        });

        traces = [
          // 1. MCO + Summation (x, y)
          { type: 'bar', x: dates, y: mcoArr, xaxis: 'x', yaxis: 'y', name: 'MCO', marker: { color: mcoArr.map((v) => (v >= 0 ? '#00E676' : '#ff3366')) } },
          { type: 'scatter', mode: 'lines', x: dates, y: sumArr, xaxis: 'x', yaxis: 'y5', name: 'Summation', line: { color: '#38bdf8', width: 1.6, dash: 'dot' } },
          { type: 'scatter', mode: 'markers', x: buyB.map((d) => d.date), y: buyB.map((d) => d.mco), xaxis: 'x', yaxis: 'y', name: '▲ MCO Buy', marker: { symbol: 'triangle-up', size: 9, color: '#00E676', line: { color: '#052e16', width: 1 } } },
          { type: 'scatter', mode: 'markers', x: sellB.map((d) => d.date), y: sellB.map((d) => d.mco), xaxis: 'x', yaxis: 'y', name: '▼ MCO Sell', marker: { symbol: 'triangle-down', size: 9, color: '#ff3366', line: { color: '#450a0a', width: 1 } } },

          // 2. % > SMAs + Zweig Thrust (x2, y2)
          { type: 'scatter', mode: 'lines', x: dates, y: histSlice.map((d) => Number(d.pct_above_20 ?? 50)), xaxis: 'x2', yaxis: 'y2', name: '>20 SMA', line: { color: '#38bdf8', width: 1.3 } },
          { type: 'scatter', mode: 'lines', x: dates, y: histSlice.map((d) => Number(d.pct_above_50 ?? 50)), xaxis: 'x2', yaxis: 'y2', name: '>50 SMA', line: { color: '#00F0FF', width: 2.3 } },
          { type: 'scatter', mode: 'lines', x: dates, y: histSlice.map((d) => Number(d.pct_above_200 ?? 50)), xaxis: 'x2', yaxis: 'y2', name: '>200 SMA', line: { color: '#94a3b8', width: 1.4, dash: 'dash' } },
          { type: 'scatter', mode: 'lines', x: dates, y: histSlice.map((d) => Number(d.zbt ?? 50)), xaxis: 'x2', yaxis: 'y2', name: 'Zweig 10D', line: { color: '#fbbf24', width: 1.8 } },

          // 3. New Highs vs New Lows + 10D MA (x3, y3)
          { type: 'bar', x: dates, y: histSlice.map((d) => Number(d.new_highs ?? 0)), xaxis: 'x3', yaxis: 'y3', name: 'New Highs', marker: { color: 'rgba(0, 230, 118, 0.78)' } },
          { type: 'bar', x: dates, y: histSlice.map((d) => -Math.abs(Number(d.new_lows ?? 0))), xaxis: 'x3', yaxis: 'y3', name: 'New Lows (-)', marker: { color: 'rgba(255, 51, 102, 0.78)' } },
          { type: 'scatter', mode: 'lines', x: dates, y: histSlice.map((d) => Number(d.nhnl_10 ?? 0)), xaxis: 'x3', yaxis: 'y3', name: '10D Diff MA', line: { color: '#00F0FF', width: 2 } },

          // 4. Indexed Style Participation Ratios Base=100 (x4, y4)
          { type: 'scatter', mode: 'lines', x: dates, y: mkIdx('rsp_spy_ratio', 0.28), xaxis: 'x4', yaxis: 'y4', name: 'RSP/SPY (Equal)', line: { color: '#00E676', width: 2.1 } },
          { type: 'scatter', mode: 'lines', x: dates, y: mkIdx('qqq_spy_ratio', 0.9), xaxis: 'x4', yaxis: 'y4', name: 'QQQ/SPY (Tech)', line: { color: '#c084fc', width: 1.8 } },
          { type: 'scatter', mode: 'lines', x: dates, y: mkIdx('smh_spy_ratio', 0.35), xaxis: 'x4', yaxis: 'y4', name: 'SMH/SPY (Semis)', line: { color: '#fbbf24', width: 1.6 } },
          { type: 'scatter', mode: 'lines', x: dates, y: mkIdx('xlk_xlu_ratio', 4.0), xaxis: 'x4', yaxis: 'y4', name: 'XLK/XLU (Risk)', line: { color: '#38bdf8', width: 1.5, dash: 'dot' } },
          { type: 'scatter', mode: 'lines', x: dates, y: mkIdx('xly_xlp_ratio', 2.0), xaxis: 'x4', yaxis: 'y4', name: 'XLY/XLP (Cons)', line: { color: '#fb7185', width: 1.4, dash: 'dash' } },
        ];

        layout = {
          paper_bgcolor: '#060910',
          plot_bgcolor: '#090d16',
          height: 550,
          margin: { l: 48, r: 22, t: 26, b: 26 },
          barmode: 'relative',
          showlegend: false,
          hovermode: 'closest',
          dragmode: 'pan',
          annotations: [
            { xref: 'paper', yref: 'paper', x: 0.0, y: 1.025, xanchor: 'left', yanchor: 'bottom', text: '<b>McCLELLAN OSCILLATOR & SUMMATION INDEX</b>', showarrow: false, font: { size: 9, color: '#e2e8f0', family: 'JetBrains Mono, monospace' } },
            { xref: 'paper', yref: 'paper', x: 0.54, y: 1.025, xanchor: 'left', yanchor: 'bottom', text: '<b>SMA PARTICIPATION (% >20/50/200) + ZWEIG THRUST</b>', showarrow: false, font: { size: 9, color: '#00F0FF', family: 'JetBrains Mono, monospace' } },
            { xref: 'paper', yref: 'paper', x: 0.0, y: 0.435, xanchor: 'left', yanchor: 'bottom', text: '<b>20D NEW HIGHS vs NEW LOWS + 10D NET MA</b>', showarrow: false, font: { size: 9, color: '#00E676', family: 'JetBrains Mono, monospace' } },
            { xref: 'paper', yref: 'paper', x: 0.54, y: 0.435, xanchor: 'left', yanchor: 'bottom', text: '<b>RELATIVE BREADTH RATIOS (BASE = 100 START)</b>', showarrow: false, font: { size: 9, color: '#fbbf24', family: 'JetBrains Mono, monospace' } },
          ],
          shapes: [
            { type: 'line', xref: 'x2', yref: 'y2', x0: dates[0], x1: dates[dates.length - 1], y0: 50, y1: 50, line: { color: 'rgba(148,163,184,0.45)', width: 1, dash: 'dash' } },
            { type: 'line', xref: 'x2', yref: 'y2', x0: dates[0], x1: dates[dates.length - 1], y0: 61.5, y1: 61.5, line: { color: 'rgba(0,230,118,0.45)', width: 1, dash: 'dot' } },
            { type: 'line', xref: 'x2', yref: 'y2', x0: dates[0], x1: dates[dates.length - 1], y0: 40, y1: 40, line: { color: 'rgba(255,51,102,0.45)', width: 1, dash: 'dot' } },
            { type: 'line', xref: 'x4', yref: 'y4', x0: dates[0], x1: dates[dates.length - 1], y0: 100, y1: 100, line: { color: 'rgba(255,255,255,0.22)', width: 1, dash: 'dot' } },
          ],
          xaxis: { domain: [0.00, 0.455], anchor: 'y', matches: 'x3', showticklabels: false, gridcolor: 'rgba(255,255,255,0.04)' },
          yaxis: { domain: [0.55, 1.00], anchor: 'x', range: [bMin - bPad, bMax + bPad], tickfont: { size: 8.5, color: '#94a3b8' }, gridcolor: 'rgba(255,255,255,0.05)' },
          yaxis5: { overlaying: 'y', side: 'right', anchor: 'x', showgrid: false, showticklabels: false },
          xaxis2: { domain: [0.54, 0.995], anchor: 'y2', matches: 'x3', showticklabels: false, gridcolor: 'rgba(255,255,255,0.04)' },
          yaxis2: { domain: [0.55, 1.00], anchor: 'x2', range: [0, 100], ticksuffix: '%', tickfont: { size: 8.5, color: '#94a3b8' }, gridcolor: 'rgba(255,255,255,0.05)' },
          xaxis3: { domain: [0.00, 0.455], anchor: 'y3', tickfont: { size: 8.5, color: '#94a3b8' }, gridcolor: 'rgba(255,255,255,0.04)', nticks: 6 },
          yaxis3: { domain: [0.00, 0.415], anchor: 'x3', tickfont: { size: 8.5, color: '#94a3b8' }, gridcolor: 'rgba(255,255,255,0.05)' },
          xaxis4: { domain: [0.54, 0.995], anchor: 'y4', matches: 'x3', tickfont: { size: 8.5, color: '#94a3b8' }, gridcolor: 'rgba(255,255,255,0.04)', nticks: 6 },
          yaxis4: { domain: [0.00, 0.415], anchor: 'x4', tickfont: { size: 8.5, color: '#94a3b8' }, gridcolor: 'rgba(255,255,255,0.05)' },
        };
      } else if (viewMode === 'vol_credit') {
        // =========================================================================
        // VIEW 3: SYNCHRONIZED 2x2 VOLATILITY, CREDIT, CURVE & POSITIONING
        // =========================================================================
        const zArr = histSlice.map((d) => Number(d.hyg_zscore ?? 0));
        const vixBbBuys = histSlice.filter((d) => d.vix_bb_buy);

        traces = [
          // 1. VIX vs VIX3M + 2σ BB (x, y)
          { type: 'scatter', mode: 'lines', x: dates, y: histSlice.map((d) => Number(d.vix ?? 16)), xaxis: 'x', yaxis: 'y', name: 'Spot VIX', line: { color: '#ff3366', width: 2.2 } },
          { type: 'scatter', mode: 'lines', x: dates, y: histSlice.map((d) => Number(d.vix3m ?? 18)), xaxis: 'x', yaxis: 'y', name: 'VIX3M', line: { color: '#38bdf8', width: 1.7, dash: 'dash' } },
          { type: 'scatter', mode: 'lines', x: dates, y: histSlice.map((d) => d.vix_upper_bb), xaxis: 'x', yaxis: 'y', name: 'Upper 2σ BB', line: { color: '#fbbf24', width: 1.3, dash: 'dot' } },
          ...(vixBbBuys.length > 0 ? [{ type: 'scatter', mode: 'markers', x: vixBbBuys.map((d) => d.date), y: vixBbBuys.map((d) => d.vix), xaxis: 'x', yaxis: 'y', name: 'VIX BB Re-entry', marker: { symbol: 'triangle-up', size: 10, color: '#00E676' } }] : []),

          // 2. HYG/IEF + 126D Z-Score (x2, y2 / y6)
          { type: 'bar', x: dates, y: zArr, xaxis: 'x2', yaxis: 'y2', name: '126D Z-Score', marker: { color: zArr.map((v) => (v >= 0 ? 'rgba(0,230,118,0.75)' : v < -1.5 ? 'rgba(255,51,102,0.88)' : 'rgba(251,191,36,0.75)')) } },
          { type: 'scatter', mode: 'lines', x: dates, y: histSlice.map((d) => Number(d.hyg_ratio ?? 0.85)), xaxis: 'x2', yaxis: 'y6', name: 'HYG/IEF Ratio', line: { color: '#fbbf24', width: 1.8 } },

          // 3. 10Y vs 3M + 10Y-3M Slope + MOVE (x3, y3 / y7)
          { type: 'scatter', mode: 'lines', x: dates, y: histSlice.map((d) => Number(d.tnx ?? 4.5)), xaxis: 'x3', yaxis: 'y3', name: '10Y Yield (%)', line: { color: '#fbbf24', width: 2 } },
          { type: 'scatter', mode: 'lines', x: dates, y: histSlice.map((d) => Number(d.irx ?? 4.0)), xaxis: 'x3', yaxis: 'y3', name: '3M T-Bill (%)', line: { color: '#38bdf8', width: 1.5, dash: 'dash' } },
          { type: 'scatter', mode: 'lines', x: dates, y: histSlice.map((d) => Number(d.move ?? 95)), xaxis: 'x3', yaxis: 'y7', name: 'MOVE Index', line: { color: '#c084fc', width: 1.5, dash: 'dot' } },

          // 4. CFTC COT + USD/JPY Carry (x4, y4 / y8)
          { type: 'bar', x: dates, y: histSlice.map((d) => Number(d.cot_net ?? 0)), xaxis: 'x4', yaxis: 'y4', name: 'COT Commercial Net', marker: { color: histSlice.map((d) => ((Number(d.cot_net ?? 0)) >= 0 ? 'rgba(0,230,118,0.78)' : 'rgba(251,191,36,0.72)')) } },
          { type: 'scatter', mode: 'lines', x: dates, y: histSlice.map((d) => Number(d.jpy ?? 150)), xaxis: 'x4', yaxis: 'y8', name: 'USD/JPY Carry', line: { color: '#00F0FF', width: 1.7 } },
        ];

        layout = {
          paper_bgcolor: '#060910',
          plot_bgcolor: '#090d16',
          height: 500,
          margin: { l: 46, r: 42, t: 24, b: 26 },
          showlegend: false,
          hovermode: 'closest',
          dragmode: 'pan',
          annotations: [
            { xref: 'paper', yref: 'paper', x: 0.0, y: 1.025, xanchor: 'left', yanchor: 'bottom', text: '<b>VIX vs VIX3M TERM STRUCTURE + 2σ BOLLINGER BAND</b>', showarrow: false, font: { size: 9, color: '#ff3366', family: 'JetBrains Mono, monospace' } },
            { xref: 'paper', yref: 'paper', x: 0.54, y: 1.025, xanchor: 'left', yanchor: 'bottom', text: '<b>CREDIT APPETITE: HYG/IEF RATIO & 126D Z-SCORE</b>', showarrow: false, font: { size: 9, color: '#fbbf24', family: 'JetBrains Mono, monospace' } },
            { xref: 'paper', yref: 'paper', x: 0.0, y: 0.435, xanchor: 'left', yanchor: 'bottom', text: '<b>TREASURY RATES (10Y vs 3M) & MOVE BOND VOL</b>', showarrow: false, font: { size: 9, color: '#c084fc', family: 'JetBrains Mono, monospace' } },
            { xref: 'paper', yref: 'paper', x: 0.54, y: 0.435, xanchor: 'left', yanchor: 'bottom', text: '<b>CFTC S&P 500 COMMERCIALS NET & USD/JPY CARRY</b>', showarrow: false, font: { size: 9, color: '#00F0FF', family: 'JetBrains Mono, monospace' } },
          ],
          shapes: [
            { type: 'line', xref: 'x', yref: 'y', x0: dates[0], x1: dates[dates.length - 1], y0: 20, y1: 20, line: { color: 'rgba(251,191,36,0.45)', width: 1, dash: 'dash' } },
            { type: 'line', xref: 'x2', yref: 'y2', x0: dates[0], x1: dates[dates.length - 1], y0: -1.5, y1: -1.5, line: { color: '#ff3366', width: 1, dash: 'dash' } },
          ],
          xaxis: { domain: [0.00, 0.455], anchor: 'y', matches: 'x3', showticklabels: false, gridcolor: 'rgba(255,255,255,0.04)' },
          yaxis: { domain: [0.55, 1.00], anchor: 'x', tickfont: { size: 8.5, color: '#94a3b8' }, gridcolor: 'rgba(255,255,255,0.05)' },
          xaxis2: { domain: [0.54, 0.995], anchor: 'y2', matches: 'x3', showticklabels: false, gridcolor: 'rgba(255,255,255,0.04)' },
          yaxis2: { domain: [0.55, 1.00], anchor: 'x2', tickfont: { size: 8.5, color: '#94a3b8' }, gridcolor: 'rgba(255,255,255,0.05)' },
          y6Config_unused: undefined,
          yaxis6: { overlaying: 'y2', side: 'right', anchor: 'x2', showgrid: false, tickfont: { size: 8, color: '#fbbf24' } },
          xaxis3: { domain: [0.00, 0.455], anchor: 'y3', tickfont: { size: 8.5, color: '#94a3b8' }, gridcolor: 'rgba(255,255,255,0.04)', nticks: 6 },
          yaxis3: { domain: [0.00, 0.415], anchor: 'x3', ticksuffix: '%', tickfont: { size: 8.5, color: '#94a3b8' }, gridcolor: 'rgba(255,255,255,0.05)' },
          yaxis7: { overlaying: 'y3', side: 'right', anchor: 'x3', showgrid: false, tickfont: { size: 8, color: '#c084fc' } },
          xaxis4: { domain: [0.54, 0.995], anchor: 'y4', matches: 'x3', tickfont: { size: 8.5, color: '#94a3b8' }, gridcolor: 'rgba(255,255,255,0.04)', nticks: 6 },
          yaxis4: { domain: [0.00, 0.415], anchor: 'x4', tickfont: { size: 8.5, color: '#94a3b8' }, gridcolor: 'rgba(255,255,255,0.05)' },
          yaxis8: { overlaying: 'y4', side: 'right', anchor: 'x4', showgrid: false, tickfont: { size: 8, color: '#00F0FF' } },
        };
      } else if (viewMode === 'cycle_50y') {
        // =========================================================================
        // VIEW 6: 50-YEAR S&P 500 TOP & BOTTOM SIGNALS + EMPIRICAL EDGE
        // =========================================================================
        const yrsBack = cycleHorizon === '5Y' ? 5 : cycleHorizon === '10Y' ? 10 : cycleHorizon === '25Y' ? 25 : 50;
        const wkAll = cycleData?.series_50y_weekly || [];
        const endDateStr = wkAll[wkAll.length - 1]?.date || '2026-11-20';
        const endYr = Number(endDateStr.slice(0, 4)) - yrsBack;
        const startCut = yrsBack >= 50 ? '1900-01-01' : `${endYr}${endDateStr.slice(4)}`;
        const wkSlice = wkAll.filter((r) => r.date >= startCut);
        const wDates = wkSlice.map((r) => r.date);
        const wSpx = wkSlice.map((r) => Number(r.spx ?? 100));
        const wBot = wkSlice.map((r) => Number(r.bottom_score ?? 0));
        const wTop = wkSlice.map((r) => Number(r.top_score ?? 0));

        const bSigs = (cycleData?.bottom_signals || []).filter((s) => s.date >= startCut);
        const tSigs = (cycleData?.top_signals || []).filter((s) => s.date >= startCut);

        const leftEnd = isNarrow ? 0.65 : 0.685;
        const rightStart = isNarrow ? 0.79 : 0.795;

        const isBotDom = (cycleVerdict?.bottom_score ?? 0) >= (cycleVerdict?.top_score ?? 0);
        const activePillars = isBotDom ? (cycleVerdict?.bottom_pillars || []) : (cycleVerdict?.top_pillars || []);
        const shortPillarLabel = (lbl) => {
          if (lbl.includes('Daily RSI')) return 'D-RSI';
          if (lbl.includes('Weekly RSI')) return 'W-RSI';
          if (lbl.includes('Vol Level')) return 'Vol Lvl';
          if (lbl.includes('Vol Z')) return 'Vol Z';
          if (lbl.includes('200D')) return '200D';
          if (lbl.includes('52W')) return '52W DD';
          if (lbl.includes('Curve')) return 'Curve';
          if (lbl.includes('Complacency')) return 'VolComp';
          return 'Diverge';
        };
        const revPil = [...activePillars].reverse();
        const pLabels = revPil.map((p) => shortPillarLabel(p.label));
        const pScores = revPil.map((p) => Number(p.score ?? 0));

        const b1Stats = cycleEmp.bottom_stage1 || {};
        const t2Stats = cycleEmp.top_confirmed || {};
        const baseStats = cycleEmp.baseline_all || {};
        const horizons = ['1M', '3M', '6M', '12M'];
        const hKeys = ['1m', '3m', '6m', '12m'];

        const lastPt = wkSlice[wkSlice.length - 1];
        const annotations50 = [
          { xref: 'paper', yref: 'paper', x: 0.0, y: 1.016, xanchor: 'left', yanchor: 'bottom', text: `<b>S&amp;P 500 (${cycleHorizon}) · HISTORIC 50Y TOP &amp; BOTTOM SIGNALS</b>`, showarrow: false, font: { size: 9, color: '#e2e8f0', family: 'JetBrains Mono, monospace' } },
          { xref: 'paper', yref: 'paper', x: 0.895, y: 1.016, xanchor: 'center', yanchor: 'bottom', text: `<b>${isBotDom ? 'BOTTOM WASHOUT PILLARS' : 'TOP RISK PILLARS'} (0–100)</b>`, showarrow: false, font: { size: 8.5, color: isBotDom ? '#00E676' : '#ff3366', family: 'JetBrains Mono, monospace' } },
          { xref: 'paper', yref: 'paper', x: 0.0, y: 0.305, xanchor: 'left', yanchor: 'bottom', text: '<b>50Y BOTTOM SCORE (EMERALD) vs TOP RISK SCORE (CRIMSON)</b>', showarrow: false, font: { size: 8.5, color: '#94a3b8', family: 'JetBrains Mono, monospace' } },
          { xref: 'paper', yref: 'paper', x: 0.895, y: 0.432, xanchor: 'center', yanchor: 'bottom', text: '<b>50Y MEDIAN FWD SPX RETURN (%)</b>', showarrow: false, font: { size: 8.5, color: '#fbbf24', family: 'JetBrains Mono, monospace' } },
        ];

        if (lastPt) {
          annotations50.push({
            xref: 'x5', yref: 'y', x: lastPt.date, y: cycleLogScale ? Math.log10(Math.max(1, Number(lastPt.spx))) : Number(lastPt.spx),
            text: `<b>TODAY ${Number(lastPt.spx).toFixed(0)} · B=${cycleVerdict?.bottom_score ?? 0}</b>`,
            showarrow: true, arrowhead: 2, arrowsize: 0.7, arrowwidth: 1.2, arrowcolor: cycleVerdict?.phase_color || '#fbbf24',
            ax: -16, ay: 18, xanchor: 'right', yanchor: 'top',
            font: { size: 8, color: '#ffffff', family: 'JetBrains Mono, monospace' },
            bgcolor: 'rgba(11, 17, 30, 0.94)', bordercolor: cycleVerdict?.phase_color || '#fbbf24', borderwidth: 1, borderpad: 2,
          });
        }

        traces = [
          // 1. S&P 500 Index Curve
          {
            type: 'scatter', mode: 'lines', x: wDates, y: wSpx, xaxis: 'x5', yaxis: 'y', name: 'S&P 500',
            line: { color: '#cbd5e1', width: 1.75 },
            hovertemplate: '%{x}<br>S&P 500: <b>%{y:,.1f}</b><extra></extra>',
          },
          // Today Star Marker
          ...(lastPt ? [{
            type: 'scatter', mode: 'markers', x: [lastPt.date], y: [Number(lastPt.spx)], xaxis: 'x5', yaxis: 'y', name: 'Today',
            marker: { symbol: 'star', size: 12, color: cycleVerdict?.phase_color || '#fbbf24', line: { color: '#ffffff', width: 1 } },
            hovertemplate: `<b>TODAY (${lastPt.date})</b><br>SPX %{y:,.1f}<br>Bottom Score: ${cycleVerdict?.bottom_score} · Top Risk: ${cycleVerdict?.top_score}<extra></extra>`,
          }] : []),
          // Historical Bottom Signals
          ...(show50yBottoms && bSigs.length > 0 ? [{
            type: 'scatter', mode: 'markers', x: bSigs.map((s) => s.date), y: bSigs.map((s) => s.spx),
            xaxis: 'x5', yaxis: 'y', name: '▲ 50Y Bottom',
            marker: { symbol: 'triangle-up', size: 10, color: '#00E676', line: { color: '#052e16', width: 1.1 } },
            text: bSigs.map((s) => `${s.event}<br>Score ${s.score} · DD ${s.dd252}% · VIX ${s.vol_50y}<br>3M ${s.fwd_3m ?? '—'}% · 6M ${s.fwd_6m ?? '—'}% · 12M ${s.fwd_12m ?? '—'}%`),
            hovertemplate: '<b>▲ 50Y BOTTOM</b> · %{x}<br>SPX %{y:,.1f}<br>%{text}<extra></extra>',
          }] : []),
          // Historical Top Breakdown Signals
          ...(show50yTops && tSigs.length > 0 ? [{
            type: 'scatter', mode: 'markers', x: tSigs.map((s) => s.date), y: tSigs.map((s) => s.spx),
            xaxis: 'x5', yaxis: 'y', name: '▼ 50Y Top',
            marker: { symbol: 'triangle-down', size: 9.5, color: '#ff3366', line: { color: '#450a0a', width: 1.1 } },
            text: tSigs.map((s) => `${s.event}<br>Top Risk ${s.score} · YC ${s.yc}%<br>12M MaxDD ${s.max_dd_12m ?? '—'}% · 12M ${s.fwd_12m ?? '—'}%`),
            hovertemplate: '<b>▼ 50Y TOP BREAK</b> · %{x}<br>SPX %{y:,.1f}<br>%{text}<extra></extra>',
          }] : []),
          // 2. Lower Ribbon: 50Y Bottom Score vs Top Risk Score
          {
            type: 'scatter', mode: 'lines', x: wDates, y: wBot, xaxis: 'x', yaxis: 'y5', name: 'Bottom Score',
            fill: 'tozeroy', fillcolor: 'rgba(0, 230, 118, 0.14)', line: { color: '#00E676', width: 1.6 },
            hovertemplate: '%{x}<br>Bottom Score: <b>%{y:.1f}/100</b><extra></extra>',
          },
          {
            type: 'scatter', mode: 'lines', x: wDates, y: wTop, xaxis: 'x', yaxis: 'y5', name: 'Top Risk',
            fill: 'tozeroy', fillcolor: 'rgba(255, 51, 102, 0.11)', line: { color: '#ff3366', width: 1.5 },
            hovertemplate: '%{x}<br>Top Risk: <b>%{y:.1f}/100</b><extra></extra>',
          },
          // 3. Right-Top: Horizontal Active Pillar Bars
          {
            type: 'bar', orientation: 'h', x: pScores, y: pLabels, xaxis: 'x3', yaxis: 'y3', name: 'Pillar Score',
            marker: { color: pScores.map((v) => (v >= 70 ? (isBotDom ? '#00E676' : '#ff3366') : v >= 40 ? '#fbbf24' : '#38bdf8')) },
            text: pScores.map((v) => `${v.toFixed(0)}`),
            textposition: pScores.map((v) => (v >= 45 ? 'inside' : 'outside')),
            insidetextanchor: 'middle',
            textfont: { size: 8.5, color: '#ffffff', family: 'JetBrains Mono, monospace' },
            customdata: revPil.map((p) => `${p.label}: ${p.raw}`),
            hovertemplate: '%{customdata}<br>Score: <b>%{x:.1f}/100</b><extra></extra>',
          },
          // 4. Right-Bottom: 50Y Empirical Forward Return Edge Bars
          {
            type: 'bar', x: horizons, y: hKeys.map((k) => Number(b1Stats[`fwd_${k}_med`] ?? 0)),
            xaxis: 'x4', yaxis: 'y4', name: 'Bot >=70', marker: { color: '#00E676' },
            text: hKeys.map((k) => `${Number(b1Stats[`fwd_${k}_med`] ?? 0) >= 0 ? '+' : ''}${Number(b1Stats[`fwd_${k}_med`] ?? 0).toFixed(1)}%`),
            textposition: 'outside',
            constraintext: 'none',
            textfont: { size: 8.5, color: '#6ee7b7', family: 'JetBrains Mono, monospace' },
            hovertemplate: '50Y Bottom (>=70) %{x}<br>Median: <b>%{y:+.1f}%</b><extra></extra>',
          },
          {
            type: 'bar', x: horizons, y: hKeys.map((k) => Number(baseStats[`fwd_${k}_med`] ?? 0)),
            xaxis: 'x4', yaxis: 'y4', name: '50Y Avg', marker: { color: '#64748b' },
            hovertemplate: '50Y All-Time Baseline %{x}<br>Median: <b>%{y:+.1f}%</b><extra></extra>',
          },
          {
            type: 'bar', x: horizons, y: hKeys.map((k) => Number(t2Stats[`fwd_${k}_med`] ?? 0)),
            xaxis: 'x4', yaxis: 'y4', name: 'Top Brk', marker: { color: '#ff3366' },
            hovertemplate: '50Y Confirmed Top %{x}<br>Median: <b>%{y:+.1f}%</b><extra></extra>',
          },
        ];

        const maxRetEdge = Math.max(26, ...hKeys.map((k) => Number(b1Stats[`fwd_${k}_med`] ?? 0))) * 1.24;
        layout = {
          paper_bgcolor: '#060910',
          plot_bgcolor: '#090d16',
          height: isNarrow ? 395 : 408,
          margin: { l: 46, r: 12, t: 25, b: 24 },
          barmode: 'group',
          showlegend: false,
          hovermode: 'closest',
          dragmode: 'pan',
          annotations: annotations50,
          shapes: [
            { type: 'line', xref: 'x', yref: 'y5', x0: wDates[0], x1: wDates[wDates.length - 1], y0: 70, y1: 70, line: { color: 'rgba(251,191,36,0.65)', width: 1.2, dash: 'dash' } },
          ],
          xaxis5: { domain: [0, leftEnd], anchor: 'y', matches: 'x', showticklabels: false, gridcolor: 'rgba(255,255,255,0.04)' },
          yaxis: { domain: [0.39, 1.00], type: cycleLogScale ? 'log' : 'linear', tickfont: { size: 8.5, color: '#cbd5e1', family: 'JetBrains Mono, monospace' }, gridcolor: 'rgba(255,255,255,0.05)' },
          xaxis: { domain: [0, leftEnd], anchor: 'y5', tickfont: { size: 8.5, color: '#94a3b8', family: 'JetBrains Mono, monospace' }, gridcolor: 'rgba(255,255,255,0.04)', nticks: 10 },
          yaxis5: { domain: [0.00, 0.285], anchor: 'x', range: [0, 104], tickfont: { size: 8.5, color: '#94a3b8', family: 'JetBrains Mono, monospace' }, gridcolor: 'rgba(255,255,255,0.05)' },
          xaxis3: { domain: [rightStart, 0.995], anchor: 'y3', range: [0, 118], tickfont: { size: 8, color: '#94a3b8', family: 'JetBrains Mono, monospace' }, gridcolor: 'rgba(255,255,255,0.04)' },
          yaxis3: { domain: [0.56, 1.00], anchor: 'x3', tickfont: { size: 8.5, color: '#e2e8f0', family: 'JetBrains Mono, monospace' }, showgrid: false },
          xaxis4: { domain: [rightStart, 0.995], anchor: 'y4', tickfont: { size: 8.5, color: '#cbd5e1', family: 'JetBrains Mono, monospace' }, showgrid: false },
          yaxis4: { domain: [0.00, 0.41], anchor: 'x4', range: [0, maxRetEdge], ticksuffix: '%', tickfont: { size: 8, color: '#94a3b8', family: 'JetBrains Mono, monospace' }, gridcolor: 'rgba(255,255,255,0.05)' },
        };
      }

      delete layout.y6Config_unused;
      Plotly.react(el, traces, layout, { responsive: true, displayModeBar: false });
    } catch (err) {
      console.error('MarketHealthMacroStudio Plotly render error:', err);
    }

    return () => {
      if (el && window.Plotly) {
        try { window.Plotly.purge(el); } catch (_) { /* noop */ }
      }
    };
  }, [
    plotlyReady, viewMode, histSlice, lookbackDays, lowerRibbon, showSignals,
    showRegimes, plotWidth, factorAttribs, regimeTrail, qMeta.color, qMeta.title,
    cycleData, cycleVerdict, cycleEmp, recent252Map, cycleHorizon, cycleLogScale,
    show50yBottoms, show50yTops,
  ]);

  // =========================================================================
  // MACRO LAB SECONDARY PLOTLY CANVAS (Simulator Bar Chart OR 18x18 Heatmap)
  // =========================================================================
  useEffect(() => {
    if (!plotlyReady || !labPlotRef.current) return undefined;
    if (viewMode !== 'macro_lab') return undefined;
    if (macroSubView !== 'simulator' && macroSubView !== 'heatmap') return undefined;

    const Plotly = window.Plotly;
    const el = labPlotRef.current;

    try {
      if (macroSubView === 'simulator' && simProjections.length > 0) {
        const rev = [...simProjections].reverse();
        const xVals = rev.map((s) => s.expectedReturn);
        const yLabels = rev.map((s) => `${s.symbol} (${s.name})`);
        const maxM = Math.max(2.0, ...xVals.map((v) => Math.abs(v))) * 1.25;
        Plotly.react(el, [{
          type: 'bar', orientation: 'h', x: xVals, y: yLabels,
          marker: { color: xVals.map((v) => (v > 0.35 ? '#00E676' : v < -0.35 ? '#ff3366' : '#64748b')) },
          text: xVals.map((v) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`),
          textposition: 'outside',
          textfont: { size: 10, color: '#e2e8f0', family: 'JetBrains Mono, monospace' },
          hovertemplate: '<b>%{y}</b><br>Projected Impact: %{x:+.2f}%<extra></extra>',
        }], {
          paper_bgcolor: '#060910', plot_bgcolor: '#090d16', height: 255,
          margin: { l: 155, r: 44, t: 24, b: 28 },
          title: { text: 'SIMULATED SECTOR PERFORMANCE SHOCK (%)', font: { size: 10, color: '#38bdf8', family: 'JetBrains Mono, monospace' }, x: 0.02 },
          xaxis: { range: [-maxM, maxM], zerolinecolor: 'rgba(255,255,255,0.3)', tickfont: { size: 9, color: '#94a3b8' }, gridcolor: 'rgba(255,255,255,0.05)' },
          yaxis: { tickfont: { size: 10, color: '#f1f5f9', family: 'JetBrains Mono, monospace' }, showgrid: false },
        }, { responsive: true, displayModeBar: false });
      } else if (macroSubView === 'heatmap' && crossMatrix.assets?.length > 0) {
        const assets = crossMatrix.assets;
        const labels = assets.map((a) => a.label);
        const zMat = assets.map((rowA) => assets.map((colA) => Number(crossMatrix.values[rowA.symbol]?.[colA.symbol] ?? 0)));
        const txtMat = zMat.map((row) => row.map((v) => v.toFixed(2)));
        Plotly.react(el, [{
          type: 'heatmap',
          x: labels, y: labels, z: zMat, text: txtMat,
          texttemplate: labPlotWidth > 760 ? '%{text}' : '',
          textfont: { size: 8, color: '#f8fafc', family: 'JetBrains Mono, monospace' },
          zmin: -1, zmax: 1, zmid: 0,
          colorscale: [[0, '#be123c'], [0.25, '#fb7185'], [0.5, '#0f172a'], [0.75, '#34d399'], [1, '#047857']],
          colorbar: {
            title: { text: 'Corr ρ', side: 'top', font: { size: 9.5, color: '#fbbf24', family: 'JetBrains Mono, monospace' } },
            tickfont: { size: 9, color: '#94a3b8' },
            len: 0.84,
            thickness: 12,
            xpad: 14,
          },
          hovertemplate: '%{y} vs %{x}<br>90D Corr: <b>%{z:+.2f}</b><extra></extra>',
        }], {
          paper_bgcolor: '#060910', plot_bgcolor: '#090d16', height: 470,
          margin: { l: 96, r: 40, t: 32, b: 84 },
          title: { text: '90-DAY CROSS-ASSET & SECTOR CORRELATION MATRIX', font: { size: 10.5, color: '#fbbf24', family: 'JetBrains Mono, monospace' }, x: 0.02 },
          xaxis: { tickangle: -40, tickfont: { size: 8.5, color: '#cbd5e1', family: 'JetBrains Mono, monospace' } },
          yaxis: { autorange: 'reversed', tickfont: { size: 8.5, color: '#cbd5e1', family: 'JetBrains Mono, monospace' } },
        }, { responsive: true, displayModeBar: false });
      }
    } catch (err) {
      console.error('Macro Lab Plotly render error:', err);
    }

    return () => {
      if (el && window.Plotly) {
        try { window.Plotly.purge(el); } catch (_) { /* noop */ }
      }
    };
  }, [plotlyReady, viewMode, macroSubView, simProjections, crossMatrix, labPlotWidth]);

  const handleDownloadPng = () => {
    const target = (viewMode === 'macro_lab' ? labPlotRef.current : mainPlotRef.current);
    if (!target || !window.Plotly) return;
    window.Plotly.downloadImage(target, {
      format: 'png',
      filename: `MarketHealthMacro_${viewMode}_${healthData?.trade_date || 'live'}`,
      width: 1400,
      height: viewMode === 'command' ? 540 : 640,
      scale: 2,
    });
  };

  const applyPreset = (type) => {
    if (type === 'reflation_boom') { setSimYieldShift(35); setSimOilShift(15); setSimDollarShift(1); }
    else if (type === 'rate_cut') { setSimYieldShift(-30); setSimOilShift(-5); setSimDollarShift(-2); }
    else if (type === 'deflation_shock') { setSimYieldShift(-30); setSimOilShift(-15); setSimDollarShift(1.5); }
    else if (type === 'oil_shock') { setSimYieldShift(25); setSimOilShift(20); setSimDollarShift(1.5); }
    else if (type === 'dollar_squeeze') { setSimYieldShift(-10); setSimOilShift(-12); setSimDollarShift(4); }
    else { setSimYieldShift(0); setSimOilShift(0); setSimDollarShift(0); }
  };

  const toggleSort = (col) => {
    if (sortCol === col) setSortAsc((v) => !v);
    else { setSortCol(col); setSortAsc(false); }
  };

  const issuesList = Array.isArray(curr.issues_list) ? curr.issues_list : [];
  const strengthsList = Array.isArray(curr.strengths_list) ? curr.strengths_list : [];
  const tnxQ = macroQuotes['^TNX'];
  const dxyQ = macroQuotes['DX-Y.NYB'];
  const pct1y = curr.percentiles_1y || {};

  const p50y = cycleVerdict?.percentiles_50y || {};
  const b1Stat = cycleEmp.bottom_stage1 || {};
  const t2Stat = cycleEmp.top_confirmed || {};
  const verdictShort = cycleVerdict?.phase_code === 'CONFIRMED_BOTTOM'
    ? 'CONFIRMED BOT'
    : cycleVerdict?.phase_code === 'APPROACHING_BOTTOM'
      ? 'APPROACH BOT'
      : cycleVerdict?.phase_code === 'CONFIRMED_TOP'
        ? 'CONFIRMED TOP'
        : cycleVerdict?.phase_code === 'APPROACHING_TOP'
          ? 'APPROACH TOP'
          : 'MID-CYCLE';

  return (
    <div className="mhm-shell">
      {/* =================================================================== */}
      {/* STRICT 2-ROW COMMAND BAR                                            */}
      {/* =================================================================== */}
      <div className="mhm-cmdbar">
        {/* ROW 1: Views, Lookback, Live Freshness, Controls */}
        <div className="mhm-cmd-row">
          <div className="mhm-cmd-left">
            <div className="mhm-pill-group">
              {[
                { id: 'command', label: '⚡ Command', cls: 'cyan' },
                { id: 'cycle_50y', label: '🏛️ 50Y Top/Bot', cls: 'amber' },
                { id: 'breadth', label: '📊 Breadth', cls: 'emerald' },
                { id: 'vol_credit', label: '🌊 Vol/Cred', cls: 'violet' },
                { id: 'macro_lab', label: '🌐 Macro Lab', cls: 'amber' },
                { id: 'flow_10y', label: '🔄 10Y Flow', cls: '' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setViewMode(t.id)}
                  className={`mhm-btn ${viewMode === t.id ? `active ${t.cls}` : ''}`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {(viewMode === 'command' || viewMode === 'breadth' || viewMode === 'vol_credit') && (
              <div className="mhm-pill-group">
                <span className="mhm-group-lbl">WINDOW</span>
                {[60, 120, 252].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setLookbackDays(d)}
                    className={`mhm-btn ${lookbackDays === d ? 'active cyan' : ''}`}
                  >
                    {d === 252 ? '1Y' : `${d}D`}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="mhm-cmd-right">
            <span
              className={`mhm-feed-pill ${dataMeta.is_market_open ? 'open' : 'closed'}`}
              title={`Trade Date ${healthData?.trade_date || '-'} · ${Number(curr.total_universe || 0).toLocaleString()} Equities`}
            >
              <span className="mhm-feed-dot" />
              {dataMeta.is_market_open ? 'LIVE' : 'RTH'} {String(healthData?.trade_date || '—').slice(5)} · {(Number(curr.total_universe || 0) / 1000).toFixed(1)}k
            </span>

            <button
              type="button"
              onClick={handleLiveRefresh}
              disabled={isRefreshing}
              className="mhm-btn"
              title="Recompute Market Health + Macro Matrix + 50Y Cycle live"
            >
              <RefreshCw size={11} className={isRefreshing ? 'mhm-spin' : ''} />
              {isRefreshing ? 'Syncing' : 'Live'}
            </button>

            <button
              type="button"
              onClick={() => setAutoRefresh((v) => !v)}
              className={`mhm-btn ${autoRefresh ? 'active emerald' : ''}`}
              title="Auto-refresh every 5 minutes"
            >
              {autoRefresh ? 'Auto 5m ON' : 'Auto 5m'}
            </button>

            <button type="button" onClick={handleDownloadPng} className="mhm-btn" title="Download Chart PNG">
              <Camera size={11} /> PNG
            </button>

            <button
              type="button"
              onClick={() => setShowGuide((v) => !v)}
              className={`mhm-btn ${showGuide ? 'active cyan' : ''}`}
            >
              <Info size={11} /> Guide
            </button>
          </div>
        </div>

        {/* ROW 2: Contextual Sub-Controls + Clickable Cross-Asset Live Tape */}
        <div className="mhm-cmd-row secondary">
          <div className="mhm-cmd-left">
            {viewMode === 'command' && (
              <>
                <div className="mhm-pill-group">
                  <span className="mhm-group-lbl">RIBBON</span>
                  {[
                    { id: 'mco', label: 'MCO' },
                    { id: 'breadth', label: 'Breadth' },
                    { id: 'vix', label: 'VIX' },
                    { id: 'credit', label: 'Credit' },
                    { id: 'curve_move', label: 'Curve' },
                    { id: 'cycle_50y', label: '50Y' },
                  ].map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setLowerRibbon(r.id)}
                      className={`mhm-btn ${lowerRibbon === r.id ? 'active cyan' : ''}`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>

                <div className="mhm-pill-group">
                  <button type="button" onClick={() => setShowSignals((v) => !v)} className={`mhm-btn ${showSignals ? 'active emerald' : ''}`}>
                    🎯 Signals
                  </button>
                  <button type="button" onClick={() => setShowRegimes((v) => !v)} className={`mhm-btn ${showRegimes ? 'active amber' : ''}`}>
                    ▦ Regimes
                  </button>
                </div>
              </>
            )}

            {viewMode === 'cycle_50y' && (
              <>
                <div className="mhm-pill-group">
                  <span className="mhm-group-lbl">HORIZON</span>
                  {['50Y', '25Y', '10Y', '5Y'].map((hz) => (
                    <button
                      key={hz}
                      type="button"
                      onClick={() => setCycleHorizon(hz)}
                      className={`mhm-btn ${cycleHorizon === hz ? 'active amber' : ''}`}
                    >
                      {hz}
                    </button>
                  ))}
                </div>
                <div className="mhm-pill-group">
                  <button type="button" onClick={() => setShow50yBottoms((v) => !v)} className={`mhm-btn ${show50yBottoms ? 'active emerald' : ''}`}>
                    ▲ Bottoms
                  </button>
                  <button type="button" onClick={() => setShow50yTops((v) => !v)} className={`mhm-btn ${show50yTops ? 'active crimson' : ''}`}>
                    ▼ Tops
                  </button>
                  <button type="button" onClick={() => setCycleLogScale((v) => !v)} className={`mhm-btn ${cycleLogScale ? 'active cyan' : ''}`}>
                    Log
                  </button>
                </div>
              </>
            )}

            {viewMode === 'macro_lab' && (
              <div className="mhm-pill-group">
                <span className="mhm-group-lbl">LAB VIEW</span>
                {[
                  { id: 'simulator', label: '⚡ Stress Simulator' },
                  { id: 'playbooks', label: '🧭 6-Driver Playbooks' },
                  { id: 'heatmap', label: '🗺️ Correlation Matrix' },
                  { id: 'betas', label: '📊 Sector Betas' },
                ].map((sv) => (
                  <button
                    key={sv.id}
                    type="button"
                    onClick={() => setMacroSubView(sv.id)}
                    className={`mhm-btn ${macroSubView === sv.id ? 'active amber' : ''}`}
                  >
                    {sv.label}
                  </button>
                ))}
              </div>
            )}

            {viewMode === 'breadth' && (
              <div className="mhm-pill-group">
                <span className="mhm-group-lbl">BREADTH LAB</span>
                <span style={{ fontSize: '10px', color: '#94a3b8', padding: '2px 6px', fontFamily: 'JetBrains Mono, monospace' }}>
                  Adv {adv.toLocaleString()} / Dec {dec.toLocaleString()} · UpVol {upVolPct.toFixed(1)}% · Hindenburg {curr.hindenburg_active ? 'ACTIVE' : 'CLEAR'} · Titanic {curr.titanic_active ? 'ACTIVE' : 'CLEAR'}
                </span>
              </div>
            )}

            {viewMode === 'vol_credit' && (
              <div className="mhm-pill-group">
                <span className="mhm-group-lbl">VOL &amp; CREDIT</span>
                <span style={{ fontSize: '10px', color: '#94a3b8', padding: '2px 6px', fontFamily: 'JetBrains Mono, monospace' }}>
                  VIX {vixVal.toFixed(2)} ({vixRatio}x) · MOVE {moveVal} · HYG/IEF {Number(curr.hyg_ratio_val || 0.85).toFixed(3)} ({fmtSigned(hygZ, 2, 'σ')}) · COT {Number(curr.cot_net_val || 0).toLocaleString()}
                </span>
              </div>
            )}

            {viewMode === 'flow_10y' && (
              <div className="mhm-pill-group">
                <span className="mhm-group-lbl">SECTOR FLOW</span>
                <span style={{ fontSize: '10px', color: '#94a3b8', padding: '2px 6px', fontFamily: 'JetBrains Mono, monospace' }}>
                  10-Year Multi-Sector Chaikin Money Flow Top &amp; Bottom Predictor (2016–2026)
                </span>
              </div>
            )}
          </div>

          {/* Clickable Cross-Asset Live Tape */}
          <div className="mhm-tape-group">
            {curr.spy_price && (
              <button type="button" onClick={() => onTickerClick && onTickerClick('SPY')} className="mhm-tape-chip clickable">
                <span className="mhm-tape-sym">SPY</span>
                <strong>${Number(curr.spy_price).toFixed(2)}</strong>
                <span style={{ color: Number(curr.spy_1d_chg ?? 0) >= 0 ? '#00E676' : '#ff3366' }}>
                  {fmtSigned(curr.spy_1d_chg ?? 0, 2, '%')}
                </span>
              </button>
            )}
            {curr.qqq_price && (
              <button type="button" onClick={() => onTickerClick && onTickerClick('QQQ')} className="mhm-tape-chip clickable">
                <span className="mhm-tape-sym">QQQ</span>
                <strong>${Number(curr.qqq_price).toFixed(2)}</strong>
                <span style={{ color: Number(curr.qqq_1d_chg ?? 0) >= 0 ? '#00E676' : '#ff3366' }}>
                  {fmtSigned(curr.qqq_1d_chg ?? 0, 2, '%')}
                </span>
              </button>
            )}
            <span className="mhm-tape-chip">
              <span className="mhm-tape-sym">10Y</span>
              <strong>{Number(curr.tnx_val ?? tnxQ?.current_price ?? 4.5).toFixed(2)}%</strong>
            </span>
            <span className="mhm-tape-chip">
              <span className="mhm-tape-sym">10Y-3M</span>
              <strong style={{ color: ycBps >= 0 ? '#38bdf8' : '#ff3366' }}>{ycBps >= 0 ? `+${ycBps}` : ycBps}bp</strong>
            </span>
            {dxyQ && (
              <span className="mhm-tape-chip">
                <span className="mhm-tape-sym">DXY</span>
                <strong>{dxyQ.current_price}</strong>
              </span>
            )}
            <span className={`mhm-tape-chip ${!vixContango ? 'alert' : ''}`}>
              <span className="mhm-tape-sym">VIX</span>
              <strong style={{ color: vixContango ? '#00E676' : '#ff3366' }}>{vixVal.toFixed(1)}</strong>
              <span style={{ color: '#94a3b8' }}>({vixRatio}x)</span>
            </span>
          </div>
        </div>
      </div>

      {/* Collapsible Institutional Guide */}
      {showGuide && (
        <div className="mhm-guide-drawer">
          <div className="mhm-guide-box">
            <h4>Health Oscillator &amp; Attribution</h4>
            <div>
              Synthesizes 5 uncorrelated z-scored engines into a 0–100 sigmoid regime index: <strong>MCO Velocity</strong>, <strong>% &gt;50 SMA</strong>, <strong>10D NH-NL</strong>, <strong>Inverted VIX</strong>, and <strong>HYG/IEF Credit Spreads</strong>. Risk-On &ge;60 · Cautious 40–59 · Risk-Off &lt;40.
            </div>
          </div>
          <div className="mhm-guide-box">
            <h4>Signals &amp; Zweig Thrust</h4>
            <div>
              BUY beacons mark <strong>MCO &lt;-350 hook</strong>, <strong>MCO zero-cross</strong>, <strong>VIX 2σ BB re-entry</strong>, and <strong>Zweig Breadth Thrust</strong> (&lt;40% to &ge;61.5% in 10d). SELL beacons warn on MCO climax rollovers, Hindenburg Omens, and Titanic Syndromes.
            </div>
          </div>
          <div className="mhm-guide-box">
            <h4>4-Quadrant Macro Cycle</h4>
            <div>
              Maps trailing 20D Growth (SPY &amp; VIX) vs Inflation/Yields (10Y Yield &amp; Crude Oil) across <strong>Q1 Reflation</strong>, <strong>Q2 Stagflation</strong>, <strong>Q3 Deflation/Risk-Off</strong>, and <strong>Q4 Goldilocks</strong> over a 12-week weekly path.
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 6 ZERO-TRUNCATION TELEMETRY KPI TILES                               */}
      {/* =================================================================== */}
      {viewMode === 'cycle_50y' ? (
        <div className="mhm-telemetry">
          <div className="mhm-tile" style={{ borderTop: `2px solid ${cycleVerdict?.phase_color || '#fbbf24'}` }}>
            <span className="mhm-tile-lbl">50Y VERDICT</span>
            <span className="mhm-tile-val" style={{ color: cycleVerdict?.phase_color || '#fbbf24' }}>
              {verdictShort}
            </span>
            <span className="mhm-tile-sub">
              {cycleData?.start_date?.slice(0, 4) || '1976'}–{cycleData?.end_date?.slice(0, 4) || '2026'} ({Number(cycleData?.trading_days || 12604).toLocaleString()}d)
            </span>
          </div>

          <div className="mhm-tile" style={{ borderTop: '2px solid #00E676' }}>
            <span className="mhm-tile-lbl">BOTTOM SCORE</span>
            <span className="mhm-tile-val" style={{ color: (cycleVerdict?.bottom_score ?? 0) >= 70 ? '#00E676' : '#f8fafc' }}>
              {Number(cycleVerdict?.bottom_score ?? 0).toFixed(1)} / 100
            </span>
            <span className="mhm-tile-sub">
              {p50y.bottom_score ?? '—'}th 50Y% · ZBT {zbtVal.toFixed(1)}%
            </span>
          </div>

          <div className="mhm-tile" style={{ borderTop: '2px solid #ff3366' }}>
            <span className="mhm-tile-lbl">TOP RISK SCORE</span>
            <span className="mhm-tile-val" style={{ color: (cycleVerdict?.top_score ?? 0) >= 68 ? '#ff3366' : '#f8fafc' }}>
              {Number(cycleVerdict?.top_score ?? 0).toFixed(1)} / 100
            </span>
            <span className="mhm-tile-sub">
              {p50y.top_score ?? '—'}th 50Y% · YC {fmtSigned(cycleVerdict?.yc ?? 0, 2, '%')}
            </span>
          </div>

          <div className="mhm-tile">
            <span className="mhm-tile-lbl">50Y VOL · Z-SHOCK</span>
            <span className="mhm-tile-val" style={{ color: Number(cycleVerdict?.vol_50y ?? 0) >= 30 ? '#ff3366' : '#00E676' }}>
              VIX {Number(cycleVerdict?.vol_50y ?? vixVal).toFixed(1)} ({p50y.vol_50y ?? '—'}%)
            </span>
            <span className="mhm-tile-sub">
              {fmtSigned(cycleVerdict?.vol_z ?? 0, 2, 'σ')} · {p50y.vol_z ?? '—'}th 50Y%
            </span>
          </div>

          <div className="mhm-tile">
            <span className="mhm-tile-lbl">50Y RSI (D / W)</span>
            <span className="mhm-tile-val" style={{ color: Number(cycleVerdict?.rsi14 ?? 50) <= 30 ? '#00E676' : '#f8fafc' }}>
              {Number(cycleVerdict?.rsi14 ?? 50).toFixed(1)} / {Number(cycleVerdict?.w_rsi14 ?? 50).toFixed(1)}
            </span>
            <span className="mhm-tile-sub">
              D {p50y.rsi14 ?? '—'}% · W {p50y.w_rsi14 ?? '—'}%
            </span>
          </div>

          <div className="mhm-tile" style={{ borderTop: '2px solid #00F0FF' }}>
            <span className="mhm-tile-lbl">{(cycleVerdict?.top_score ?? 0) > (cycleVerdict?.bottom_score ?? 0) ? '50Y TOP BREAK RISK' : '50Y BOT 12M EDGE'}</span>
            <span className="mhm-tile-val" style={{ color: (cycleVerdict?.top_score ?? 0) > (cycleVerdict?.bottom_score ?? 0) ? '#ff3366' : '#00E676' }}>
              {(cycleVerdict?.top_score ?? 0) > (cycleVerdict?.bottom_score ?? 0)
                ? `MaxDD ${t2Stat.med_max_dd_12m ?? -9.4}%`
                : `+${b1Stat.fwd_12m_med ?? 24.1}% Med`}
            </span>
            <span className="mhm-tile-sub">
              {(cycleVerdict?.top_score ?? 0) > (cycleVerdict?.bottom_score ?? 0)
                ? `${t2Stat.pct_10dd_12m ?? 45.5}% >=10% DD (n=${t2Stat.n ?? 22})`
                : `${b1Stat.win_12m ?? 78.6}% Win · 3M +${b1Stat.fwd_3m_med ?? 8.3}%`}
            </span>
          </div>
        </div>
      ) : (
        <div className="mhm-telemetry">
          <div className="mhm-tile" style={{ borderTop: `2px solid ${regimeColor}` }}>
            <span className="mhm-tile-lbl">HEALTH SCORE</span>
            <span className="mhm-tile-val" style={{ color: regimeColor }}>
              {score.toFixed(1)} / 100
            </span>
            <span className="mhm-tile-sub">
              {shortHealthTag(score)} · {fmtSigned(delta5d, 1)} 5D
            </span>
          </div>

          <div className="mhm-tile" style={{ borderTop: `2px solid ${qMeta.color}` }}>
            <span className="mhm-tile-lbl">MACRO CYCLE</span>
            <span className="mhm-tile-val" style={{ color: qMeta.color }}>
              {qMeta.short} · {activeRegime.confidence || 82}%
            </span>
            <span className="mhm-tile-sub">
              G {fmtSigned(lastTrailPt.growth_score, 1)} · I {fmtSigned(lastTrailPt.inflation_score, 1)}
            </span>
          </div>

          <div className="mhm-tile">
            <span className="mhm-tile-lbl">BREADTH TAPE</span>
            <span className="mhm-tile-val" style={{ color: p50 >= 50 ? '#00E676' : '#ff3366' }}>
              {p50.toFixed(1)}% &gt;50d
            </span>
            <span className="mhm-tile-sub">
              A/D {curr.adv_dec_ratio ?? 1}x · UpV {upVolPct.toFixed(0)}%
            </span>
          </div>

          <div className="mhm-tile">
            <span className="mhm-tile-lbl">MCO · ZWEIG</span>
            <span className="mhm-tile-val" style={{ color: mcoColor }}>
              {mcoVal >= 0 ? `+${mcoVal.toFixed(0)}` : mcoVal.toFixed(0)} MCO
            </span>
            <span className="mhm-tile-sub">
              ZBT {zbtVal.toFixed(1)}% · {zbtTag}
            </span>
          </div>

          <div className="mhm-tile">
            <span className="mhm-tile-lbl">VOL · MOVE</span>
            <span className="mhm-tile-val" style={{ color: vixContango ? '#00E676' : '#ff3366' }}>
              VIX {vixVal.toFixed(2)}
            </span>
            <span className="mhm-tile-sub">
              {vixRatio}x {vixContango ? 'Cont' : 'Back'} · MOVE {moveVal.toFixed(0)}
            </span>
          </div>

          <div className="mhm-tile">
            <span className="mhm-tile-lbl">CREDIT · CURVE</span>
            <span className="mhm-tile-val" style={{ color: hygZ >= 0 ? '#00E676' : '#ff3366' }}>
              {fmtSigned(hygZ, 2, 'σ')} HYG
            </span>
            <span className="mhm-tile-sub">
              10Y-3M {ycBps >= 0 ? `+${ycBps}` : ycBps}bp · {Number(curr.irx_val ?? 4.0).toFixed(2)}%
            </span>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* PLOTLY CANVAS FOR command / cycle_50y / breadth / vol_credit        */}
      {/* =================================================================== */}
      {(viewMode === 'command' || viewMode === 'cycle_50y' || viewMode === 'breadth' || viewMode === 'vol_credit') && (
        <div className="mhm-canvas-wrap">
          {!plotlyReady ? (
            <div style={{ height: 420, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>
              Loading interactive Plotly engine...
            </div>
          ) : (
            <div ref={mainPlotRef} style={{ width: '100%' }} />
          )}

          <div className="mhm-micro-legend">
            {viewMode === 'command' && (
              <>
                <span><strong style={{ color: '#00F0FF' }}>CYAN</strong> Health (0–100)</span>
                <span><strong style={{ color: '#cbd5e1' }}>SILVER LINE</strong> SPY Price</span>
                <span><strong style={{ color: '#00E676' }}>▲ EMERALD</strong> Buy / Bullish</span>
                <span><strong style={{ color: '#ff3366' }}>▼ CRIMSON</strong> Sell / Stress</span>
                <span><strong style={{ color: '#fbbf24' }}>★ TRAIL</strong> 12W Macro Path</span>
              </>
            )}
            {viewMode === 'cycle_50y' && (
              <>
                <span><strong style={{ color: '#cbd5e1' }}>SILVER</strong> S&amp;P 500 ({cycleHorizon})</span>
                <span><strong style={{ color: '#00E676' }}>▲ 50Y BOT</strong> ≥70 Washout Cluster (n={b1Stat.n ?? 15})</span>
                <span><strong style={{ color: '#ff3366' }}>▼ 50Y TOP</strong> Confirmed Breakdown (n={t2Stat.n ?? 22})</span>
                <span><strong style={{ color: '#fbbf24' }}>DASH 70</strong> Turn Trigger</span>
                <span><strong style={{ color: '#64748b' }}>SLATE</strong> 50Y All-Time Avg</span>
              </>
            )}
            {viewMode === 'breadth' && (
              <>
                <span><strong style={{ color: '#00E676' }}>EMERALD/CRIMSON</strong> MCO · New Highs/Lows</span>
                <span><strong style={{ color: '#00F0FF' }}>CYAN</strong> % &gt;50 SMA · 10D NH-NL MA</span>
                <span><strong style={{ color: '#fbbf24' }}>GOLD</strong> Zweig 10D · SMH/SPY</span>
                <span><strong style={{ color: '#c084fc' }}>VIOLET</strong> QQQ/SPY</span>
              </>
            )}
            {viewMode === 'vol_credit' && (
              <>
                <span><strong style={{ color: '#ff3366' }}>CRIMSON</strong> VIX · Credit Z &lt;-1.5σ</span>
                <span><strong style={{ color: '#38bdf8' }}>BLUE</strong> VIX3M · 3M T-Bill</span>
                <span><strong style={{ color: '#fbbf24' }}>GOLD</strong> 2σ BB · HYG/IEF · 10Y</span>
                <span><strong style={{ color: '#c084fc' }}>VIOLET</strong> MOVE</span>
                <span><strong style={{ color: '#00F0FF' }}>CYAN</strong> USD/JPY Carry</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* 4x1 INSTITUTIONAL ACTION DECK BELOW COMMAND CANVAS */}
      {viewMode === 'command' && (
        <div className="mhm-action-grid">
          <div className={`mhm-action-card ${regime === 'RISK_ON' ? 'emerald' : regime === 'CAUTIOUS' ? 'amber' : 'crimson'}`}>
            <div className="mhm-action-top">
              <span className="mhm-action-title">1. EXECUTION POSTURE</span>
              <span className="mhm-action-badge" style={{ color: regimeColor }}>
                {regime === 'RISK_ON' ? '80–100% LONG' : regime === 'CAUTIOUS' ? '40–60% SELECT' : '70–100% CASH'}
              </span>
            </div>
            <div className="mhm-action-main" style={{ color: regimeColor }}>
              {regime === 'RISK_ON' ? 'Full Breakouts & Leaders' : regime === 'CAUTIOUS' ? 'Half-Size First Pullbacks' : 'Pilot 0–25% · Capital Protect'}
            </div>
            <div className="mhm-action-sub">
              {curr.historical_context || `Health ${score.toFixed(1)}/100 · >200 SMA at ${p200.toFixed(1)}% · TRIN ${Number(curr.trin_10_val ?? 1).toFixed(2)}`}
            </div>
          </div>

          <div className="mhm-action-card cyan">
            <div className="mhm-action-top">
              <span className="mhm-action-title">2. MACRO PLAYBOOK</span>
              <span className="mhm-action-badge" style={{ color: qMeta.color }}>{qMeta.short}</span>
            </div>
            <div className="mhm-action-main">
              Favors: {(activeRegime.favored_sectors || []).slice(0, 3).map((s) => s.split(' ')[0]).join(', ')}
            </div>
            <div className="mhm-ticker-row">
              {qMeta.basket.slice(0, 6).map((t) => (
                <button key={t} type="button" onClick={() => onTickerClick && onTickerClick(t)} className="mhm-tkr-pill">
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className={`mhm-action-card ${issuesList.length > strengthsList.length ? 'crimson' : 'emerald'}`}>
            <div className="mhm-action-top">
              <span className="mhm-action-title">3. ACTIVE SIGNALS</span>
              <span className="mhm-action-badge">{issuesList.length}▼ · {strengthsList.length}▲</span>
            </div>
            <div className="mhm-action-main">
              {curr.latest_signal ? `${curr.latest_signal.signal} · ${curr.latest_signal.type} (${curr.latest_signal.date.slice(5)})` : 'Scanning Signal Triggers'}
            </div>
            <div className="mhm-action-sub">
              {issuesList[0] || strengthsList[0] || 'No active deterioration triggers'}
            </div>
          </div>

          <div className="mhm-action-card amber">
            <div className="mhm-action-top">
              <span className="mhm-action-title">4. 50Y TOP/BOTTOM</span>
              <button
                type="button"
                onClick={() => setViewMode('cycle_50y')}
                className="mhm-tkr-pill"
                title="Open 50-Year Market Cycle Top & Bottom Proof"
              >
                50Y Proof →
              </button>
            </div>
            <div className="mhm-action-main" style={{ color: cycleVerdict?.phase_color || '#fbbf24' }}>
              {verdictShort} · Bot {cycleVerdict?.bottom_score ?? '—'}
            </div>
            <div className="mhm-action-sub">
              Top {cycleVerdict?.top_score ?? 0} · 3M {b1Stat.win_3m ?? 85.7}% Win (+{b1Stat.fwd_3m_med ?? 8.3}%) · ZBT {zbtVal.toFixed(1)}%
            </div>
          </div>
        </div>
      )}

      {/* 50Y STAGE 2 CHECKLIST + NEAREST HISTORICAL ANALOGS */}
      {viewMode === 'cycle_50y' && cycleVerdict && (
        <div className="mhm-cycle-proof-grid">
          <div className="mhm-cycle-card" style={{ borderTop: `2px solid ${cycleVerdict.phase_color || '#fbbf24'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
              <strong style={{ fontSize: 11, color: '#f8fafc' }}>STAGE 2 CONFIRMATION CHECKLIST</strong>
              <span className="mhm-action-badge" style={{ color: cycleVerdict.phase_color || '#fbbf24' }}>
                {(cycleVerdict.confirmation_checklist || []).filter((c) => c.met).length}/{(cycleVerdict.confirmation_checklist || []).length} MET
              </span>
            </div>
            <div style={{ fontSize: 10, color: '#cbd5e1', lineHeight: 1.35 }}>
              {cycleVerdict.action_summary}
            </div>
            {(cycleVerdict.confirmation_checklist || []).map((chk) => (
              <div key={chk.label} className="mhm-check-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                  <span className={`mhm-check-pill ${chk.met ? 'met' : 'wait'}`}>{chk.met ? 'MET' : 'WAIT'}</span>
                  <span style={{ color: '#e2e8f0' }}>{chk.label}</span>
                </div>
                <span style={{ color: '#94a3b8', whiteSpace: 'nowrap' }}>
                  {chk.current} → <strong style={{ color: '#f8fafc' }}>{chk.target}</strong>
                </span>
              </div>
            ))}
          </div>

          <div className="mhm-cycle-card" style={{ borderTop: '2px solid #00F0FF' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
              <strong style={{ fontSize: 11, color: '#f8fafc' }}>TOP 5 NEAREST 50-YEAR HISTORICAL ANALOGS (1976–2026)</strong>
              <span className="mhm-action-badge">FWD SPX RETURNS</span>
            </div>
            <div className="mhm-table-wrap">
              <table className="mhm-analog-table">
                <thead>
                  <tr>
                    <th>Episode Date</th>
                    <th>Sim</th>
                    <th>52W DD</th>
                    <th>Vol</th>
                    <th>3M</th>
                    <th>6M</th>
                    <th>12M</th>
                    <th>MaxDD 3M</th>
                  </tr>
                </thead>
                <tbody>
                  {(cycleData?.nearest_analogs || []).map((a) => (
                    <tr key={a.date}>
                      <td>
                        <strong style={{ color: '#f8fafc' }}>{a.date}</strong>{' '}
                        <span style={{ color: '#94a3b8' }}>· {a.event}</span>
                      </td>
                      <td style={{ color: '#00F0FF', fontWeight: 800 }}>{a.similarity_pct}%</td>
                      <td style={{ color: '#fbbf24' }}>{a.dd252}%</td>
                      <td>{a.vol_50y}</td>
                      <td style={{ color: Number(a.fwd_3m) >= 0 ? '#00E676' : '#ff3366', fontWeight: 700 }}>{fmtSigned(a.fwd_3m, 1, '%')}</td>
                      <td style={{ color: Number(a.fwd_6m) >= 0 ? '#00E676' : '#ff3366', fontWeight: 700 }}>{fmtSigned(a.fwd_6m, 1, '%')}</td>
                      <td style={{ color: Number(a.fwd_12m) >= 0 ? '#00E676' : '#ff3366', fontWeight: 700 }}>{fmtSigned(a.fwd_12m, 1, '%')}</td>
                      <td style={{ color: '#ff3366' }}>{fmtSigned(a.max_dd_63d, 1, '%')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 1Y PERCENTILE RANK STRIP BELOW VOL & CREDIT */}
      {viewMode === 'vol_credit' && (
        <div className="mhm-pct-strip">
          {[
            { label: 'SCORE 1Y%', val: pct1y.score ?? 50, col: '#00F0FF' },
            { label: 'MCO 1Y%', val: pct1y.mco ?? 50, col: '#00E676' },
            { label: '>50 SMA 1Y%', val: pct1y.pct_above_50 ?? 50, col: '#38bdf8' },
            { label: 'VIX 1Y%', val: pct1y.vix ?? 50, col: '#ff3366' },
            { label: 'MOVE 1Y%', val: pct1y.move ?? 50, col: '#c084fc' },
            { label: 'CREDIT 1Y%', val: pct1y.hyg_ratio ?? 50, col: '#fbbf24' },
            { label: '10Y-3M 1Y%', val: pct1y.yield_curve_10y3m ?? 50, col: '#38bdf8' },
            { label: 'COT NET 1Y%', val: pct1y.cot_net ?? 50, col: '#fbbf24' },
          ].map((item) => (
            <div key={item.label} className="mhm-pct-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#94a3b8' }}>
                <span>{item.label}</span>
                <strong style={{ color: item.col }}>{Number(item.val).toFixed(0)}th</strong>
              </div>
              <div className="mhm-pct-bar">
                <div style={{ width: `${Math.min(100, Math.max(4, Number(item.val)))}%`, height: '100%', background: item.col }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* =================================================================== */}
      {/* VIEW 4: MACRO LAB (6-DRIVER TELEMETRY + SIM / PLAYBOOKS / HEATMAP)   */}
      {/* =================================================================== */}
      {viewMode === 'macro_lab' && (
        <>
          {/* Compact 6-Driver Telemetry Strip with 20D SVG Sparklines */}
          <div className="mhm-driver-strip">
            {Object.entries(macroQuotes).map(([sym, meta]) => {
              const isSel = macroSubView === 'playbooks' && selectedDriver.toLowerCase() === meta.short_name.toLowerCase();
              const c1d = Number(meta.change_1d ?? 0);
              const c20d = Number(meta.change_20d ?? 0);
              const isVix = sym === '^VIX';
              const trendCol = meta.trend === 'Rising' ? (isVix ? '#ff3366' : '#00E676') : meta.trend === 'Falling' ? (isVix ? '#00E676' : '#38bdf8') : '#94a3b8';
              return (
                <div
                  key={sym}
                  onClick={() => { setSelectedDriver(meta.short_name); setMacroSubView('playbooks'); }}
                  className={`mhm-driver-card ${isSel ? 'active' : ''}`}
                  style={{ borderTop: `2px solid ${trendCol}` }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 4 }}>
                    <strong style={{ fontSize: 10.5, color: '#f8fafc' }}>{meta.short_name}</strong>
                    <span style={{ fontSize: 8.5, color: trendCol, fontWeight: 800 }}>{meta.trend.toUpperCase()}</span>
                  </div>
                  <div style={{ fontSize: 9, color: '#64748b' }}>{DRIVER_SHORT_CAT[sym] || meta.category}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <strong style={{ fontSize: 14, color: '#ffffff' }}>
                      {meta.unit === '$' ? `$${Number(meta.current_price).toLocaleString()}` : meta.current_price}
                      {meta.unit !== '$' ? <span style={{ fontSize: 9.5, color: '#94a3b8', marginLeft: 3 }}>{meta.unit}</span> : null}
                    </strong>
                    <span style={{ fontSize: 9.5, color: c1d >= 0 ? '#00E676' : '#ff3366' }}>{fmtSigned(c1d, 2, '%')}</span>
                  </div>
                  <MiniSparkline values={meta.sparkline_20d || []} color={trendCol} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#94a3b8' }}>
                    <span>5D {fmtSigned(meta.change_5d ?? 0, 1, '%')}</span>
                    <span style={{ color: c20d >= 0 ? '#00E676' : '#ff3366' }}>20D {fmtSigned(c20d, 1, '%')}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {macroSubView === 'simulator' && (
            <div className="mhm-lab-panel">
              <div className="mhm-sim-controls">
                <div className="mhm-sim-presets">
                  <span className="mhm-group-lbl" style={{ paddingLeft: 0 }}>
                    <Sliders size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />SHOCK PRESETS:
                  </span>
                  {[
                    { id: 'reflation_boom', label: '⚡ Reflation Boom', cls: 'amber' },
                    { id: 'rate_cut', label: '✂️ Dovish Cut', cls: 'emerald' },
                    { id: 'deflation_shock', label: '📉 Deflation Shock', cls: 'cyan' },
                    { id: 'oil_shock', label: '🛢️ Oil Spike', cls: 'crimson' },
                    { id: 'dollar_squeeze', label: '💵 USD Squeeze', cls: '' },
                  ].map((p) => (
                    <button key={p.id} type="button" onClick={() => applyPreset(p.id)} className={`mhm-btn ${p.cls}`}>
                      {p.label}
                    </button>
                  ))}
                  <button type="button" onClick={() => applyPreset('reset')} className="mhm-btn" style={{ marginLeft: 'auto' }}>
                    <RotateCcw size={10} /> Reset
                  </button>
                </div>

                <div className="mhm-slider-row">
                  <div className="mhm-slider-box">
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                      <span style={{ color: '#94a3b8' }}>10Y Yield (^TNX) Shock</span>
                      <strong style={{ color: simYieldShift >= 0 ? '#fbbf24' : '#38bdf8' }}>{simYieldShift >= 0 ? `+${simYieldShift}` : simYieldShift} bps</strong>
                    </div>
                    <input type="range" min={-50} max={50} step={5} value={simYieldShift} onChange={(e) => setSimYieldShift(Number(e.target.value))} />
                  </div>
                  <div className="mhm-slider-box">
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                      <span style={{ color: '#94a3b8' }}>WTI Crude (CL=F) Shock</span>
                      <strong style={{ color: simOilShift >= 0 ? '#fbbf24' : '#38bdf8' }}>{simOilShift >= 0 ? `+${simOilShift}` : simOilShift}%</strong>
                    </div>
                    <input type="range" min={-25} max={25} step={2.5} value={simOilShift} onChange={(e) => setSimOilShift(Number(e.target.value))} />
                  </div>
                  <div className="mhm-slider-box">
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                      <span style={{ color: '#94a3b8' }}>US Dollar (DXY) Shock</span>
                      <strong style={{ color: simDollarShift >= 0 ? '#ff3366' : '#00E676' }}>{simDollarShift >= 0 ? `+${simDollarShift}` : simDollarShift}%</strong>
                    </div>
                    <input type="range" min={-5} max={5} step={0.5} value={simDollarShift} onChange={(e) => setSimDollarShift(Number(e.target.value))} />
                  </div>
                </div>
              </div>

              <div ref={labPlotRef} style={{ width: '100%' }} />

              <div className="mhm-baskets-grid">
                {ALL_WEATHER_BASKETS.map((b) => {
                  const isAct = activeRegime.id === b.id;
                  return (
                    <div
                      key={b.id}
                      className="mhm-action-card"
                      style={{
                        borderLeft: `3px solid ${b.color}`,
                        background: isAct ? `${b.color}14` : 'rgba(11,16,28,0.92)',
                        borderColor: isAct ? b.color : 'rgba(255,255,255,0.08)',
                      }}
                    >
                      <div className="mhm-action-top">
                        <span className="mhm-action-title" style={{ color: b.color }}>{b.title}</span>
                        <span className="mhm-action-badge">{isAct ? 'ACTIVE' : b.tag}</span>
                      </div>
                      <div className="mhm-action-sub">{b.desc}</div>
                      <div className="mhm-ticker-row">
                        {b.tickers.map((t) => (
                          <button key={t} type="button" onClick={() => onTickerClick && onTickerClick(t)} className="mhm-tkr-pill">
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {macroSubView === 'playbooks' && currentScenario && (
            <div className="mhm-lab-panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <div className="mhm-pill-group">
                  {scenarios.map((sc) => (
                    <button
                      key={sc.driver}
                      type="button"
                      onClick={() => setSelectedDriver(sc.driver)}
                      className={`mhm-btn ${currentScenario.driver === sc.driver ? 'active cyan' : ''}`}
                    >
                      {sc.driver}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>
                  <span style={{ padding: '3px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.06)', color: '#f8fafc' }}>
                    Spot: <strong>{currentScenario.current_value || `${currentScenario.current_price ?? '-'} ${currentScenario.unit || ''}`}</strong>
                  </span>
                  <span style={{ padding: '3px 8px', borderRadius: 6, background: 'rgba(56,189,248,0.12)', color: Number(currentScenario.change_1d ?? 0) >= 0 ? '#00E676' : '#ff3366' }}>
                    1D: <strong>{fmtSigned(currentScenario.change_1d ?? 0, 2, '%')}</strong>
                  </span>
                </div>
              </div>

              <div style={{ fontSize: 11.5, color: '#cbd5e1', background: 'rgba(15,23,42,0.7)', padding: '8px 10px', borderRadius: 8, borderLeft: '3px solid #38bdf8' }}>
                <strong style={{ color: '#38bdf8' }}>{currentScenario.full_name} Transmission: </strong>
                {currentScenario.transmission}
              </div>

              <div className="mhm-playbooks-grid">
                {[currentScenario.if_up, currentScenario.if_down].map((side, idx) => side && (
                  <div key={idx} className="mhm-playbook-card" style={{ borderTop: `3px solid ${idx === 0 ? '#00E676' : '#38bdf8'}` }}>
                    <strong style={{ fontSize: 12.5, color: idx === 0 ? '#00E676' : '#38bdf8' }}>{side.label}</strong>
                    <div style={{ color: '#94a3b8' }}>{side.narrative}</div>
                    <div>
                      <div style={{ fontSize: 9.5, fontWeight: 800, color: '#00E676', marginBottom: 4 }}>WINNING / POSITIVELY CORRELATED</div>
                      <div className="mhm-stock-chips">
                        {(side.winning_stocks || []).slice(0, 8).map((st) => (
                          <button key={st.ticker} type="button" onClick={() => onTickerClick && onTickerClick(st.ticker)} className="mhm-stock-chip buy">
                            <strong>{st.ticker}</strong>
                            <span>ρ {st.corr >= 0 ? `+${st.corr.toFixed(2)}` : st.corr.toFixed(2)}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 9.5, fontWeight: 800, color: '#ff3366', marginBottom: 4 }}>AT-RISK / INVERSE HEADWIND</div>
                      <div className="mhm-stock-chips">
                        {(side.at_risk_stocks || []).slice(0, 6).map((st) => (
                          <button key={st.ticker} type="button" onClick={() => onTickerClick && onTickerClick(st.ticker)} className="mhm-stock-chip avoid">
                            <strong>{st.ticker}</strong>
                            <span>ρ {st.corr >= 0 ? `+${st.corr.toFixed(2)}` : st.corr.toFixed(2)}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {macroSubView === 'heatmap' && (
            <div className="mhm-lab-panel">
              <div ref={labPlotRef} style={{ width: '100%' }} />
              <div className="mhm-playbooks-grid">
                <div className="mhm-action-card emerald">
                  <div className="mhm-action-top">
                    <span className="mhm-action-title">STRONGEST POSITIVE CO-MOVEMENT</span>
                    <span className="mhm-action-badge">TOP +ρ</span>
                  </div>
                  {extremePairs.topPos.map((p) => (
                    <div key={p.pair} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: '#e2e8f0' }}>
                      <span>{p.pair}</span>
                      <strong style={{ color: '#00E676' }}>+{p.val.toFixed(2)}</strong>
                    </div>
                  ))}
                </div>
                <div className="mhm-action-card crimson">
                  <div className="mhm-action-top">
                    <span className="mhm-action-title">STRONGEST INVERSE HEDGE PAIRS</span>
                    <span className="mhm-action-badge">TOP -ρ</span>
                  </div>
                  {extremePairs.topNeg.map((p) => (
                    <div key={p.pair} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: '#e2e8f0' }}>
                      <span>{p.pair}</span>
                      <strong style={{ color: '#ff3366' }}>{p.val.toFixed(2)}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {macroSubView === 'betas' && (
            <div className="mhm-lab-panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: 12, color: '#f8fafc', fontFamily: 'JetBrains Mono, monospace' }}>
                  <BarChart2 size={13} style={{ verticalAlign: 'middle', marginRight: 6, color: '#38bdf8' }} />
                  90-DAY SPDR SECTOR FACTOR SENSITIVITIES (CLICK HEADERS TO SORT)
                </strong>
              </div>
              <div className="mhm-table-wrap">
                <table className="mhm-table">
                  <thead>
                    <tr>
                      <th>Sector ETF</th>
                      {[
                        { col: 'corr_tnx', label: '10Y Yield (^TNX)' },
                        { col: 'corr_dxy', label: 'US Dollar (DXY)' },
                        { col: 'corr_oil', label: 'Crude Oil (CL=F)' },
                        { col: 'corr_gold', label: 'Gold (GC=F)' },
                        { col: 'corr_spy', label: 'S&P 500 (SPY)' },
                      ].map((h) => (
                        <th key={h.col} onClick={() => toggleSort(h.col)}>
                          {h.label} {sortCol === h.col ? (sortAsc ? '▲' : '▼') : ''}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedBetas.map((sec) => (
                      <tr key={sec.symbol}>
                        <td>
                          <button type="button" onClick={() => onTickerClick && onTickerClick(sec.symbol)} className="mhm-tkr-pill" style={{ marginRight: 6 }}>
                            {sec.symbol}
                          </button>
                          <span style={{ color: '#cbd5e1' }}>{sec.name}</span>
                        </td>
                        {['corr_tnx', 'corr_dxy', 'corr_oil', 'corr_gold', 'corr_spy'].map((k) => {
                          const v = Number(sec[k] ?? 0);
                          return (
                            <td key={k} style={{ color: v >= 0.2 ? '#00E676' : v <= -0.2 ? '#ff3366' : '#cbd5e1', fontWeight: 700 }}>
                              {v >= 0 ? `+${v.toFixed(2)}` : v.toFixed(2)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* =================================================================== */}
      {/* VIEW 5: 10-YEAR SECTOR FLOW TOP / BOTTOM PREDICTOR                  */}
      {/* =================================================================== */}
      {viewMode === 'flow_10y' && (
        <SectorFlowTopBottomPredictor onTickerClick={onTickerClick} />
      )}
    </div>
  );
}
