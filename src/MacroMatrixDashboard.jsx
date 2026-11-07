import React, { useState, useEffect, useMemo } from 'react';
import { 
  ActivitySquare, 
  TrendingUp, 
  TrendingDown, 
  ArrowUpRight, 
  ArrowDownRight, 
  RefreshCw, 
  Layers, 
  Info, 
  AlertTriangle, 
  CheckCircle2, 
  ShieldAlert, 
  Zap, 
  DollarSign, 
  Flame, 
  Compass, 
  BarChart2, 
  Sliders,
  RotateCcw,
  Sparkles,
  Target,
  Briefcase,
  ArrowRight,
  Radio,
  Gauge
} from 'lucide-react';

const REGIME_META = {
  REFLATION: {
    id: 'REFLATION',
    quadrant: 'QUADRANT I',
    shortTitle: 'REFLATION',
    subtitle: 'Growth Accelerating ↑ • Inflation / Yields Rising ↑',
    color: '#f59e0b',
    accentText: '#fbbf24',
    bgGlow: 'rgba(245, 158, 11, 0.16)',
    borderColor: 'rgba(245, 158, 11, 0.45)',
    favorsText: 'Energy (XLE), Financials (XLF), Industrials (XLI), Materials (XLB)',
    avoidText: 'Long Bonds (TLT), Utilities (XLU), Real Estate (XLRE)',
    basketIndex: 0
  },
  STAGFLATION: {
    id: 'STAGFLATION',
    quadrant: 'QUADRANT II',
    shortTitle: 'STAGFLATION',
    subtitle: 'Growth Decelerating ↓ • Inflation / Commodities Rising ↑',
    color: '#ef4444',
    accentText: '#f87171',
    bgGlow: 'rgba(239, 68, 68, 0.16)',
    borderColor: 'rgba(239, 68, 68, 0.45)',
    favorsText: 'Gold (GLD), Energy (XLE), Consumer Staples (XLP), Cash (^IRX)',
    avoidText: 'Consumer Discretionary (XLY), Semis (SMH), Small Caps (IWM)',
    basketIndex: 2
  },
  DEFLATION: {
    id: 'DEFLATION',
    quadrant: 'QUADRANT III',
    shortTitle: 'DEFLATION / RISK-OFF',
    subtitle: 'Growth Decelerating ↓ • Inflation / Yields Falling ↓',
    color: '#38bdf8',
    accentText: '#7dd3fc',
    bgGlow: 'rgba(56, 189, 248, 0.16)',
    borderColor: 'rgba(56, 189, 248, 0.45)',
    favorsText: 'Long Treasuries (TLT), Utilities (XLU), Healthcare (XLV), Gold (GLD)',
    avoidText: 'Semiconductors (SMH), High-Beta Tech (XLK), Cyclical Energy (XLE)',
    basketIndex: 3
  },
  GOLDILOCKS: {
    id: 'GOLDILOCKS',
    quadrant: 'QUADRANT IV',
    shortTitle: 'GOLDILOCKS',
    subtitle: 'Growth Accelerating ↑ • Inflation / Yields Falling ↓',
    color: '#10b981',
    accentText: '#34d399',
    bgGlow: 'rgba(16, 185, 129, 0.16)',
    borderColor: 'rgba(16, 185, 129, 0.45)',
    favorsText: 'Technology (XLK), Semiconductors (SMH), Discretionary (XLY), Comm (XLC)',
    avoidText: 'Defensive Staples (XLP), Utilities (XLU), Cash',
    basketIndex: 1
  }
};

export default function MacroMatrixDashboard({ data, onTickerClick }) {
  const [localData, setLocalData] = useState(data);
  const [loading, setLoading] = useState(!data);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState('');

  // Navigation: 'overview', '10-Yr Yield', 'US Dollar (DXY)', 'Crude Oil', 'Gold', 'Bitcoin', 'VIX', 'heatmap', 'sensitivities'
  const [activeTab, setActiveTab] = useState('overview');
  const [sortCol, setSortCol] = useState('corr_tnx');
  const [sortAsc, setSortAsc] = useState(false);

  // "What-If" Simulator State
  const [simYieldShift, setSimYieldShift] = useState(0);   // -50 to +50 bps
  const [simOilShift, setSimOilShift] = useState(0);       // -25% to +25%
  const [simDollarShift, setSimDollarShift] = useState(0); // -5% to +5%

  useEffect(() => {
    if (data) {
      setLocalData(data);
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);

    const loadData = async () => {
      try {
        const res = await fetch('/correlation_results.json?t=' + Date.now());
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (isMounted) {
          setLocalData(json);
          setLoading(false);
        }
      } catch (err) {
        try {
          const apiRes = await fetch('/api/macro_matrix');
          if (!apiRes.ok) throw new Error(`API HTTP ${apiRes.status}`);
          const apiJson = await apiRes.json();
          if (isMounted) {
            setLocalData(apiJson);
            setLoading(false);
          }
        } catch (apiErr) {
          console.error('All macro matrix fetches failed:', apiErr);
          if (isMounted) setLoading(false);
        }
      }
    };

    loadData();
    return () => { isMounted = false; };
  }, [data]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setRefreshMessage('Syncing Lakehouse & Yahoo Finance macro feeds + recomputing 90D cross-asset matrix...');
    try {
      const res = await fetch('/api/macro_matrix?refresh=1', { method: 'POST' });
      if (!res.ok) throw new Error(`Scanner error HTTP ${res.status}`);
      const fresh = await res.json();
      setLocalData(fresh);
      setRefreshMessage('Macro Matrix & 4-Quadrant Regime updated!');
      setTimeout(() => setRefreshMessage(''), 4000);
    } catch (err) {
      console.error('Macro refresh failed:', err);
      try {
        const fallbackRes = await fetch('/correlation_results.json?t=' + Date.now());
        const fallbackJson = await fallbackRes.json();
        setLocalData(fallbackJson);
        setRefreshMessage('Loaded latest cached macro matrix.');
        setTimeout(() => setRefreshMessage(''), 4000);
      } catch (e) {
        setRefreshMessage('Failed to refresh macro data: ' + err.message);
        setTimeout(() => setRefreshMessage(''), 5000);
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  const macroQuotes = localData?.macro_quotes || {};
  const activeRegime = (localData?.active_regime && localData.active_regime.id)
    ? localData.active_regime
    : {
        id: 'DEFLATION',
        name: 'Deflationary / Risk-Off De-Leveraging',
        description: 'Both Growth and Inflation/Yields are decelerating amid elevated volatility. Institutional de-risking pulls equity multiples, bond yields, and cyclical commodities lower simultaneously.',
        favored_sectors: ['TLT (Long Treasuries)', 'XLU (Utilities)', 'XLV (Healthcare)', 'GC=F (Gold)'],
        unfavored_sectors: ['SMH (Semiconductors)', 'XLK (High-Beta Tech)', 'XLE (Cyclical Energy)'],
        confidence: 82,
        driver_summary: 'Volatility Shock & Equity Drawdown paired with falling 10Y Yields and Crude Oil.'
      };

  const regimeStyle = REGIME_META[activeRegime.id] || REGIME_META.DEFLATION;
  const isGrowthRising = activeRegime.id === 'REFLATION' || activeRegime.id === 'GOLDILOCKS';
  const isInflationRising = activeRegime.id === 'REFLATION' || activeRegime.id === 'STAGFLATION';

  const scenarios = localData?.scenarios || [];
  const crossMatrix = localData?.cross_asset_matrix || { assets: [], values: {} };
  const sectorSensitivities = localData?.sector_sensitivities || [];

  const currentScenario = useMemo(() => {
    return scenarios.find(s => s.driver.toLowerCase() === activeTab.toLowerCase()) || scenarios[0];
  }, [scenarios, activeTab]);

  // Simulator Sector Projections calculation
  const simSectorProjections = useMemo(() => {
    if (!sectorSensitivities || sectorSensitivities.length === 0) return [];
    return sectorSensitivities.map(sec => {
      const yieldImpact = (simYieldShift / 10) * sec.corr_tnx * 0.8;
      const oilImpact = (simOilShift / 5) * sec.corr_oil * 0.6;
      const dollarImpact = (simDollarShift / 2) * sec.corr_dxy * 0.5;
      const totalImpact = Math.round((yieldImpact + oilImpact + dollarImpact) * 100) / 100;

      return {
        symbol: sec.symbol,
        name: sec.name,
        expectedReturn: totalImpact,
        corr_tnx: sec.corr_tnx,
        corr_oil: sec.corr_oil,
        corr_dxy: sec.corr_dxy
      };
    }).sort((a, b) => b.expectedReturn - a.expectedReturn);
  }, [sectorSensitivities, simYieldShift, simOilShift, simDollarShift]);

  const sortedSensitivities = useMemo(() => {
    const arr = [...sectorSensitivities];
    arr.sort((a, b) => {
      const va = Number(a[sortCol] ?? 0);
      const vb = Number(b[sortCol] ?? 0);
      return sortAsc ? va - vb : vb - va;
    });
    return arr;
  }, [sectorSensitivities, sortCol, sortAsc]);

  // Top Positive & Negative Cross-Asset Correlations for Heatmap Callout
  const extremePairs = useMemo(() => {
    const assets = crossMatrix.assets || [];
    const values = crossMatrix.values || {};
    const pairs = [];
    for (let i = 0; i < assets.length; i++) {
      for (let j = i + 1; j < assets.length; j++) {
        const a1 = assets[i];
        const a2 = assets[j];
        const v = values[a1.symbol]?.[a2.symbol];
        if (typeof v === 'number') {
          pairs.push({ pair: `${a1.label} ↔ ${a2.label}`, val: v });
        }
      }
    }
    pairs.sort((a, b) => b.val - a.val);
    return {
      topPos: pairs.slice(0, 3),
      topNeg: [...pairs].reverse().slice(0, 3)
    };
  }, [crossMatrix]);

  const applyPreset = (type) => {
    if (type === 'reflation_boom') {
      setSimYieldShift(35);
      setSimOilShift(15);
      setSimDollarShift(1);
    } else if (type === 'rate_cut') {
      setSimYieldShift(-30);
      setSimOilShift(-5);
      setSimDollarShift(-2);
    } else if (type === 'deflation_shock') {
      setSimYieldShift(-30);
      setSimOilShift(-15);
      setSimDollarShift(1.5);
    } else if (type === 'oil_shock') {
      setSimYieldShift(25);
      setSimOilShift(20);
      setSimDollarShift(1.5);
    } else if (type === 'dollar_squeeze') {
      setSimYieldShift(-10);
      setSimOilShift(-12);
      setSimDollarShift(4);
    } else if (type === 'reset') {
      setSimYieldShift(0);
      setSimOilShift(0);
      setSimDollarShift(0);
    }
  };

  const tnxQuote = macroQuotes['^TNX'] || {};
  const dxyQuote = macroQuotes['DX-Y.NYB'] || {};
  const oilQuote = macroQuotes['CL=F'] || {};
  const vixQuote = macroQuotes['^VIX'] || {};

  const baskets = [
    {
      id: 'REFLATION',
      title: '1. Reflationary Cyclical Boom',
      badge: 'GROWTH ↑ • YIELDS ↑',
      color: '#f59e0b',
      desc: 'When GDP growth and inflation/yields accelerate together, capital rotates into energy cash flows, industrials, materials, and asset-sensitive money-center banks.',
      tickers: ['XOM', 'CVX', 'COP', 'JPM', 'GS', 'CAT', 'DE', 'ETN', 'FCX']
    },
    {
      id: 'GOLDILOCKS',
      title: '2. Goldilocks Growth & Multiple Expansion',
      badge: 'GROWTH ↑ • YIELDS ↓',
      color: '#10b981',
      desc: 'When bond yields ease while growth holds firm, long-duration discount rates drop, triggering multiple expansion in AI semiconductors, cloud software, and housing.',
      tickers: ['NVDA', 'AVGO', 'MSFT', 'AAPL', 'AMZN', 'META', 'PLTR', 'HD']
    },
    {
      id: 'STAGFLATION',
      title: '3. Stagflation Hard-Asset & Debasement Shield',
      badge: 'GROWTH ↓ • INFLATION ↑',
      color: '#ef4444',
      desc: 'When inflation stays sticky while real growth slows, purchasing power seeks refuge in gold miners, upstream oil producers, and inelastic consumer staples.',
      tickers: ['NEM', 'GOLD', 'FCX', 'XOM', 'CVX', 'COST', 'WMT', 'PG']
    },
    {
      id: 'DEFLATION',
      title: '4. Deflationary / High-VIX Fortress Defense',
      badge: 'GROWTH ↓ • YIELDS ↓',
      color: '#38bdf8',
      desc: 'When VIX spikes (>21) and both yields and equities de-leverage simultaneously, institutions hide in sovereign duration proxies, regulated utilities, and healthcare fortresses.',
      tickers: ['LLY', 'UNH', 'JNJ', 'ABBV', 'NEE', 'DUK', 'SO', 'KO', 'PG']
    }
  ];

  if (loading && !localData) {
    return (
      <div className="glass-card" style={{ padding: '4rem 2rem', textAlign: 'center', color: '#94a3b8' }}>
        <ActivitySquare size={44} className="spin" style={{ color: '#38bdf8', margin: '0 auto 1.25rem auto' }} />
        <h3 style={{ color: '#f8fafc', margin: '0 0 0.5rem 0', fontSize: '1.35rem' }}>
          Synthesizing Cross-Asset Macro Matrix...
        </h3>
        <p style={{ maxWidth: '520px', margin: '0 auto', fontSize: '0.88rem', lineHeight: '1.5' }}>
          Computing 90-day rolling correlations across 10-Yr Yields, US Dollar (DXY), Crude Oil, Gold, Bitcoin, VIX, and 12 SPDR Sector ETFs.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '1rem' }}>
      {/* 1. TOP COMMAND CENTER RIBBON & 6-DRIVER TELEMETRY STRIP */}
      <div
        className="glass-card"
        style={{
          padding: '1.5rem',
          borderRadius: '16px',
          border: `1px solid ${regimeStyle.borderColor}`,
          borderTop: `4px solid ${regimeStyle.color}`,
          background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.94) 0%, rgba(9, 13, 24, 0.97) 100%)',
          boxShadow: '0 16px 40px rgba(0, 0, 0, 0.45)'
        }}
      >
        {/* Top Header Bar */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
            paddingBottom: '1rem',
            marginBottom: '1.25rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                borderRadius: '999px',
                background: regimeStyle.bgGlow,
                border: `1px solid ${regimeStyle.borderColor}`,
                color: regimeStyle.accentText,
                fontSize: '0.72rem',
                fontWeight: 800,
                letterSpacing: '0.8px',
                textTransform: 'uppercase'
              }}
            >
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: regimeStyle.color, boxShadow: `0 0 8px ${regimeStyle.color}` }} />
              90D CROSS-ASSET ENGINE
            </span>

            <h1 style={{ margin: 0, fontSize: '1.35rem', color: '#f8fafc', fontWeight: 800, letterSpacing: '-0.3px' }}>
              Institutional Macro Transmission & Regime Matrix
            </h1>

            <span
              style={{
                padding: '3px 10px',
                borderRadius: '6px',
                background: regimeStyle.bgGlow,
                border: `1px solid ${regimeStyle.borderColor}`,
                color: regimeStyle.accentText,
                fontSize: '0.76rem',
                fontWeight: 800
              }}
            >
              {regimeStyle.quadrant}: {activeRegime.name} ({activeRegime.confidence}%)
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            {localData?.last_updated && (
              <span style={{
                padding: '4px 9px',
                borderRadius: '6px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                fontSize: '0.74rem',
                color: '#94a3b8',
                fontFamily: 'monospace'
              }}>
                Synced: {localData.last_updated}
              </span>
            )}

            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                background: isRefreshing ? 'rgba(59, 130, 246, 0.25)' : 'rgba(59, 130, 246, 0.16)',
                color: '#93c5fd',
                border: '1px solid rgba(59, 130, 246, 0.45)',
                fontWeight: 700,
                fontSize: '0.78rem',
                cursor: isRefreshing ? 'wait' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <RefreshCw size={14} className={isRefreshing ? 'spin' : ''} />
              <span>{isRefreshing ? 'Recomputing...' : 'Refresh Macro Matrix'}</span>
            </button>
          </div>
        </div>

        {refreshMessage && (
          <div style={{
            marginBottom: '1rem',
            padding: '0.55rem 0.85rem',
            background: 'rgba(59, 130, 246, 0.14)',
            border: '1px solid rgba(59, 130, 246, 0.35)',
            borderRadius: '8px',
            fontSize: '0.78rem',
            color: '#93c5fd'
          }}>
            {refreshMessage}
          </div>
        )}

        {/* 6 Real-Time Macro Driver Cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(195px, 1fr))',
            gap: '0.75rem'
          }}
        >
          {Object.entries(macroQuotes).map(([sym, meta]) => {
            const isSelected = activeTab.toLowerCase() === meta.short_name.toLowerCase();
            const c1d = Number(meta.change_1d ?? 0);
            const c5d = Number(meta.change_5d ?? 0);
            const c20d = Number(meta.change_20d ?? 0);
            const isVix = sym === '^VIX';
            const trendColor = meta.trend === 'Rising'
              ? (isVix ? '#ef4444' : '#10b981')
              : meta.trend === 'Falling'
              ? (isVix ? '#10b981' : '#38bdf8')
              : '#94a3b8';

            return (
              <div
                key={sym}
                onClick={() => setActiveTab(isSelected ? 'overview' : meta.short_name)}
                style={{
                  background: isSelected ? 'rgba(59, 130, 246, 0.18)' : 'rgba(15, 23, 42, 0.72)',
                  border: `1px solid ${isSelected ? '#3b82f6' : 'rgba(255, 255, 255, 0.08)'}`,
                  borderTop: `3px solid ${isSelected ? '#3b82f6' : trendColor}`,
                  borderRadius: '12px',
                  padding: '0.85rem 1rem',
                  cursor: 'pointer',
                  transition: 'all 0.18s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '0.45rem'
                }}
                title={`Click to open ${meta.short_name} 2-Way Institutional Playbook`}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '4px' }}>
                  <div>
                    <div style={{ fontSize: '0.78rem', fontWeight: 800, color: isSelected ? '#60a5fa' : '#f8fafc' }}>
                      {meta.short_name}
                    </div>
                    <div style={{ fontSize: '0.66rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '125px' }}>
                      {meta.category}
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: '0.64rem',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontWeight: 800,
                      background: `${trendColor}18`,
                      color: trendColor,
                      border: `1px solid ${trendColor}40`,
                      textTransform: 'uppercase'
                    }}
                  >
                    {meta.trend}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem', margin: '2px 0' }}>
                  <strong style={{ fontSize: '1.3rem', color: '#f8fafc', fontFamily: 'monospace', fontWeight: 900 }}>
                    {meta.unit === '$' ? `$${Number(meta.current_price).toLocaleString()}` : meta.current_price}
                  </strong>
                  {meta.unit !== '$' && (
                    <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontFamily: 'monospace' }}>
                      {meta.unit}
                    </span>
                  )}
                </div>

                {/* 3-Horizon Telemetry Strip (1D / 5D / 20D) */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '4px',
                    paddingTop: '6px',
                    borderTop: '1px solid rgba(255,255,255,0.06)',
                    fontSize: '0.68rem',
                    fontFamily: 'monospace'
                  }}
                >
                  <div>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '0.6rem' }}>1D</span>
                    <span style={{ color: c1d >= 0 ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                      {c1d >= 0 ? `+${c1d}%` : `${c1d}%`}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '0.6rem' }}>5D</span>
                    <span style={{ color: c5d >= 0 ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                      {c5d >= 0 ? `+${c5d}%` : `${c5d}%`}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '0.6rem' }}>20D</span>
                    <span style={{ color: c20d >= 0 ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                      {c20d >= 0 ? `+${c20d}%` : `${c20d}%`}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. NAVIGATION PILL BAR */}
      <div
        style={{
          display: 'flex',
          gap: '0.45rem',
          flexWrap: 'wrap',
          alignItems: 'center',
          background: 'rgba(15, 23, 42, 0.65)',
          padding: '0.55rem 0.75rem',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.08)'
        }}
      >
        <button
          onClick={() => setActiveTab('overview')}
          style={{
            padding: '0.45rem 0.9rem',
            borderRadius: '8px',
            border: `1px solid ${activeTab === 'overview' ? '#38bdf8' : 'rgba(255,255,255,0.08)'}`,
            background: activeTab === 'overview' ? 'rgba(56, 189, 248, 0.18)' : 'rgba(255,255,255,0.03)',
            color: activeTab === 'overview' ? '#7dd3fc' : '#94a3b8',
            fontWeight: 700,
            fontSize: '0.8rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem'
          }}
        >
          <Sparkles size={14} /> All-Weather Regime & Simulator
        </button>

        {scenarios.map(sc => {
          const isAct = activeTab.toLowerCase() === sc.driver.toLowerCase();
          return (
            <button
              key={sc.driver}
              onClick={() => setActiveTab(sc.driver)}
              style={{
                padding: '0.45rem 0.85rem',
                borderRadius: '8px',
                border: `1px solid ${isAct ? '#3b82f6' : 'rgba(255,255,255,0.08)'}`,
                background: isAct ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255,255,255,0.03)',
                color: isAct ? '#93c5fd' : '#94a3b8',
                fontWeight: 700,
                fontSize: '0.8rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}
            >
              <span>{sc.driver}</span>
              <span style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: sc.trend === 'Rising' ? '#10b981' : sc.trend === 'Falling' ? '#ef4444' : '#64748b'
              }} />
            </button>
          );
        })}

        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => setActiveTab('heatmap')}
            style={{
              padding: '0.45rem 0.9rem',
              borderRadius: '8px',
              border: `1px solid ${activeTab === 'heatmap' ? '#f59e0b' : 'rgba(255,255,255,0.08)'}`,
              background: activeTab === 'heatmap' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255,255,255,0.03)',
              color: activeTab === 'heatmap' ? '#fbbf24' : '#94a3b8',
              fontWeight: 700,
              fontSize: '0.8rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}
          >
            <Layers size={14} /> Cross-Asset Heatmap
          </button>

          <button
            onClick={() => setActiveTab('sensitivities')}
            style={{
              padding: '0.45rem 0.9rem',
              borderRadius: '8px',
              border: `1px solid ${activeTab === 'sensitivities' ? '#06b6d4' : 'rgba(255,255,255,0.08)'}`,
              background: activeTab === 'sensitivities' ? 'rgba(6, 182, 212, 0.2)' : 'rgba(255,255,255,0.03)',
              color: activeTab === 'sensitivities' ? '#22d3ee' : '#94a3b8',
              fontWeight: 700,
              fontSize: '0.8rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}
          >
            <BarChart2 size={14} /> Sector Beta Matrix
          </button>
        </div>
      </div>

      {/* 3. OVERVIEW TAB: 4-QUADRANT REGIME COMPASS + WHAT-IF SIMULATOR + ALL-WEATHER BASKETS */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* 4-QUADRANT MACRO REGIME MAP & EXECUTIVE BRIEFING */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))', gap: '1.25rem', alignItems: 'stretch' }}>
            {/* Left: Dynamic 4-Quadrant Cycle Compass */}
            <div
              className="glass-card"
              style={{
                padding: '1.35rem',
                borderRadius: '14px',
                border: `1px solid ${regimeStyle.borderColor}`,
                borderTop: `4px solid ${regimeStyle.color}`,
                background: 'rgba(15, 23, 42, 0.72)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.9rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '1.1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Target size={18} color={regimeStyle.color} /> 4-Quadrant Macro Economic Cycle
                    </h3>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                      Real-Time Growth (Equities / Cyclicals) vs Inflation (Yields / Commodities) Compass
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontSize: '0.68rem',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        background: 'rgba(255,255,255,0.05)',
                        color: '#cbd5e1',
                        fontWeight: 700,
                        border: '1px solid rgba(255,255,255,0.1)',
                        fontFamily: 'monospace'
                      }}
                    >
                      GROWTH {isGrowthRising ? '↑' : '↓'} • YIELDS/INFL {isInflationRising ? '↑' : '↓'}
                    </span>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        padding: '3px 9px',
                        borderRadius: '6px',
                        background: regimeStyle.bgGlow,
                        color: regimeStyle.accentText,
                        fontWeight: 800,
                        border: `1px solid ${regimeStyle.borderColor}`
                      }}
                    >
                      ACTIVE: {regimeStyle.shortTitle}
                    </span>
                  </div>
                </div>

                {/* Growth Axis Column Headers */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem', marginBottom: '0.5rem', textAlign: 'center' }}>
                  <div
                    style={{
                      fontSize: '0.68rem',
                      color: !isGrowthRising ? regimeStyle.accentText : '#64748b',
                      fontWeight: 800,
                      background: !isGrowthRising ? regimeStyle.bgGlow : 'rgba(255, 255, 255, 0.02)',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      border: `1px solid ${!isGrowthRising ? regimeStyle.borderColor : 'rgba(255, 255, 255, 0.05)'}`
                    }}
                  >
                    ← GROWTH DECELERATING (↓)
                  </div>
                  <div
                    style={{
                      fontSize: '0.68rem',
                      color: isGrowthRising ? regimeStyle.accentText : '#64748b',
                      fontWeight: 800,
                      background: isGrowthRising ? regimeStyle.bgGlow : 'rgba(255, 255, 255, 0.02)',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      border: `1px solid ${isGrowthRising ? regimeStyle.borderColor : 'rgba(255, 255, 255, 0.05)'}`
                    }}
                  >
                    GROWTH EXPANDING (↑) →
                  </div>
                </div>

                {/* 4 Quadrants 2x2 Grid */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gridTemplateRows: '1fr 1fr',
                    gap: '0.65rem',
                    minHeight: '250px'
                  }}
                >
                  {['STAGFLATION', 'REFLATION', 'DEFLATION', 'GOLDILOCKS'].map((qKey) => {
                    const q = REGIME_META[qKey];
                    const isCurr = activeRegime.id === qKey;
                    return (
                      <div
                        key={qKey}
                        style={{
                          background: isCurr ? q.bgGlow : 'rgba(9, 13, 24, 0.6)',
                          border: `2px solid ${isCurr ? q.color : 'rgba(255, 255, 255, 0.06)'}`,
                          borderRadius: '10px',
                          padding: '0.85rem',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          boxShadow: isCurr ? `0 0 20px ${q.color}30` : 'none',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '4px' }}>
                            <strong style={{ color: q.accentText, fontSize: '0.84rem', letterSpacing: '0.2px' }}>
                              {q.quadrant}: {q.shortTitle}
                            </strong>
                            {isCurr && (
                              <span
                                style={{
                                  fontSize: '0.62rem',
                                  background: q.color,
                                  color: '#000',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  fontWeight: 900,
                                  letterSpacing: '0.4px',
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                YOU ARE HERE
                              </span>
                            )}
                          </div>
                          <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block', marginTop: '3px' }}>
                            {q.subtitle}
                          </span>
                        </div>

                        <div style={{ fontSize: '0.72rem', marginTop: '0.6rem', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <div>
                            <strong style={{ color: '#cbd5e1' }}>Favors: </strong>
                            <span style={{ color: q.accentText, fontWeight: 600 }}>{q.favorsText}</span>
                          </div>
                          <div>
                            <strong style={{ color: '#64748b' }}>Avoid: </strong>
                            <span style={{ color: '#94a3b8' }}>{q.avoidText}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Dynamic Capital Flow Vector Ribbon */}
              <div
                style={{
                  marginTop: '0.9rem',
                  background: 'rgba(9, 13, 24, 0.78)',
                  borderRadius: '8px',
                  padding: '0.65rem 0.85rem',
                  border: `1px solid ${regimeStyle.borderColor}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '0.5rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap', fontSize: '0.74rem' }}>
                  <span style={{ fontWeight: 800, color: regimeStyle.accentText, textTransform: 'uppercase', fontSize: '0.68rem' }}>
                    Live Rotation Vector:
                  </span>
                  <span style={{ color: '#f87171', fontWeight: 700, textDecoration: 'line-through' }}>
                    {(activeRegime.unfavored_sectors || []).slice(0, 2).join(', ')}
                  </span>
                  <ArrowRight size={14} color={regimeStyle.color} />
                  <span style={{ color: '#34d399', fontWeight: 800 }}>
                    {(activeRegime.favored_sectors || []).slice(0, 3).join(', ')}
                  </span>
                </div>

                <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontFamily: 'monospace' }}>
                  10Y: <strong style={{ color: '#f8fafc' }}>{tnxQuote.current_price}% ({tnxQuote.change_20d > 0 ? `+${tnxQuote.change_20d}` : tnxQuote.change_20d}% 20D)</strong>
                  {' • '}
                  Oil: <strong style={{ color: '#f8fafc' }}>${oilQuote.current_price} ({oilQuote.change_20d > 0 ? `+${oilQuote.change_20d}` : oilQuote.change_20d}% 20D)</strong>
                  {' • '}
                  VIX: <strong style={{ color: '#fca5a5' }}>{vixQuote.current_price}</strong>
                </div>
              </div>
            </div>

            {/* Right: Active Regime Executive Briefing Card */}
            <div
              className="glass-card"
              style={{
                padding: '1.35rem',
                borderRadius: '14px',
                border: `1px solid ${regimeStyle.borderColor}`,
                borderTop: `4px solid ${regimeStyle.color}`,
                background: 'rgba(15, 23, 42, 0.72)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '1rem'
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <Compass size={17} color={regimeStyle.color} />
                    <span style={{ fontSize: '0.75rem', color: regimeStyle.accentText, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                      Macro Council Executive Briefing
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      color: regimeStyle.accentText,
                      background: regimeStyle.bgGlow,
                      padding: '3px 8px',
                      borderRadius: '6px',
                      fontWeight: 800,
                      border: `1px solid ${regimeStyle.borderColor}`,
                      fontFamily: 'monospace'
                    }}
                  >
                    {activeRegime.confidence}% REGIME CONFIDENCE
                  </span>
                </div>

                <h3 style={{ margin: '0 0 0.6rem 0', fontSize: '1.3rem', color: '#f8fafc', fontWeight: 800 }}>
                  {activeRegime.name}
                </h3>

                <p style={{ color: '#cbd5e1', fontSize: '0.84rem', lineHeight: 1.55, margin: '0 0 0.9rem 0' }}>
                  {activeRegime.description}
                </p>

                <div
                  style={{
                    background: 'rgba(9, 13, 24, 0.72)',
                    padding: '0.75rem 0.9rem',
                    borderRadius: '8px',
                    borderLeft: `3px solid ${regimeStyle.color}`,
                    border: '1px solid rgba(255,255,255,0.06)'
                  }}
                >
                  <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: '3px' }}>
                    Quantitative Driver Confluence:
                  </span>
                  <span style={{ fontSize: '0.8rem', color: '#f1f5f9', lineHeight: 1.45 }}>
                    {activeRegime.driver_summary}
                  </span>
                </div>
              </div>

              {/* Favored vs Unfavored Sector Split */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div style={{ background: 'rgba(16, 185, 129, 0.07)', border: '1px solid rgba(16, 185, 129, 0.22)', borderRadius: '10px', padding: '0.75rem' }}>
                  <span style={{ fontSize: '0.7rem', color: '#34d399', fontWeight: 800, textTransform: 'uppercase', display: 'block', marginBottom: '0.45rem' }}>
                    ✅ Overweight / Favored Assets
                  </span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                    {activeRegime.favored_sectors?.map((sec, i) => (
                      <span
                        key={i}
                        style={{
                          fontSize: '0.74rem',
                          background: 'rgba(16, 185, 129, 0.15)',
                          color: '#6ee7b7',
                          padding: '3px 8px',
                          borderRadius: '5px',
                          border: '1px solid rgba(16, 185, 129, 0.35)',
                          fontWeight: 700
                        }}
                      >
                        {sec}
                      </span>
                    ))}
                  </div>
                </div>

                <div style={{ background: 'rgba(239, 68, 68, 0.07)', border: '1px solid rgba(239, 68, 68, 0.22)', borderRadius: '10px', padding: '0.75rem' }}>
                  <span style={{ fontSize: '0.7rem', color: '#f87171', fontWeight: 800, textTransform: 'uppercase', display: 'block', marginBottom: '0.45rem' }}>
                    ⚠️ Underweight / Avoid Assets
                  </span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                    {activeRegime.unfavored_sectors?.map((sec, i) => (
                      <span
                        key={i}
                        style={{
                          fontSize: '0.74rem',
                          background: 'rgba(239, 68, 68, 0.15)',
                          color: '#fca5a5',
                          padding: '3px 8px',
                          borderRadius: '5px',
                          border: '1px solid rgba(239, 68, 68, 0.35)',
                          fontWeight: 700
                        }}
                      >
                        {sec}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* INTERACTIVE "WHAT-IF" MACRO SHOCK SIMULATOR */}
          <div
            className="glass-card"
            style={{
              padding: '1.35rem 1.5rem',
              borderRadius: '14px',
              border: '1px solid rgba(245, 158, 11, 0.28)',
              borderTop: '4px solid #f59e0b',
              background: 'rgba(15, 23, 42, 0.72)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.1rem' }}>
              <div>
                <h3 style={{ margin: 0, color: '#fbbf24', fontSize: '1.15rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Sliders size={18} /> Interactive Multi-Factor Macro Shock Simulator
                </h3>
                <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                  Stress-test your portfolio against custom 10Y Yield, Crude Oil, and US Dollar shocks using 90-day empirical sector sensitivities.
                </span>
              </div>

              {/* 1-Click Preset Scenario Buttons */}
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                <button
                  onClick={() => applyPreset('deflation_shock')}
                  style={{
                    padding: '0.35rem 0.7rem',
                    borderRadius: '6px',
                    background: 'rgba(56, 189, 248, 0.16)',
                    border: '1px solid rgba(56, 189, 248, 0.4)',
                    color: '#7dd3fc',
                    fontSize: '0.73rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  🛡️ Deflationary De-Risking (-30bps, -15% Oil)
                </button>

                <button
                  onClick={() => applyPreset('rate_cut')}
                  style={{
                    padding: '0.35rem 0.7rem',
                    borderRadius: '6px',
                    background: 'rgba(16, 185, 129, 0.15)',
                    border: '1px solid rgba(16, 185, 129, 0.35)',
                    color: '#34d399',
                    fontSize: '0.73rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  📉 Fed Rate Cut Rally (-30bps, -2% DXY)
                </button>

                <button
                  onClick={() => applyPreset('reflation_boom')}
                  style={{
                    padding: '0.35rem 0.7rem',
                    borderRadius: '6px',
                    background: 'rgba(245, 158, 11, 0.16)',
                    border: '1px solid rgba(245, 158, 11, 0.4)',
                    color: '#fbbf24',
                    fontSize: '0.73rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  🔥 Reflation Boom (+35bps, +15% Oil)
                </button>

                <button
                  onClick={() => applyPreset('oil_shock')}
                  style={{
                    padding: '0.35rem 0.7rem',
                    borderRadius: '6px',
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.35)',
                    color: '#f87171',
                    fontSize: '0.73rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  🛢️ Stagflation Oil Spike (+20% Oil)
                </button>

                <button
                  onClick={() => applyPreset('dollar_squeeze')}
                  style={{
                    padding: '0.35rem 0.7rem',
                    borderRadius: '6px',
                    background: 'rgba(59, 130, 246, 0.15)',
                    border: '1px solid rgba(59, 130, 246, 0.35)',
                    color: '#60a5fa',
                    fontSize: '0.73rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  💵 Dollar Wrecking Ball (+4% DXY)
                </button>

                <button
                  onClick={() => applyPreset('reset')}
                  style={{
                    padding: '0.35rem 0.6rem',
                    borderRadius: '6px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: '#94a3b8',
                    fontSize: '0.73rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem'
                  }}
                >
                  <RotateCcw size={12} /> Reset
                </button>
              </div>
            </div>

            {/* 3 Factor Sliders */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                gap: '1.25rem',
                background: 'rgba(9, 13, 24, 0.68)',
                padding: '1rem 1.25rem',
                borderRadius: '10px',
                border: '1px solid rgba(255,255,255,0.06)',
                marginBottom: '1.15rem'
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                  <span style={{ fontSize: '0.78rem', color: '#cbd5e1', fontWeight: 700 }}>
                    10-Yr Treasury Yield Shift (^TNX):
                  </span>
                  <strong style={{ color: simYieldShift > 0 ? '#f59e0b' : simYieldShift < 0 ? '#38bdf8' : '#94a3b8', fontSize: '0.84rem', fontFamily: 'monospace' }}>
                    {simYieldShift > 0 ? `+${simYieldShift} bps` : `${simYieldShift} bps`}
                  </strong>
                </div>
                <input
                  type="range"
                  min="-50"
                  max="50"
                  step="5"
                  value={simYieldShift}
                  onChange={(e) => setSimYieldShift(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#38bdf8', cursor: 'pointer' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.66rem', color: '#64748b', marginTop: '2px' }}>
                  <span>-50 bps (Yields Drop)</span>
                  <span>0 bps</span>
                  <span>+50 bps (Yields Spike)</span>
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                  <span style={{ fontSize: '0.78rem', color: '#cbd5e1', fontWeight: 700 }}>
                    WTI Crude Oil Shock (CL=F):
                  </span>
                  <strong style={{ color: simOilShift > 0 ? '#f59e0b' : simOilShift < 0 ? '#10b981' : '#94a3b8', fontSize: '0.84rem', fontFamily: 'monospace' }}>
                    {simOilShift > 0 ? `+${simOilShift}%` : `${simOilShift}%`}
                  </strong>
                </div>
                <input
                  type="range"
                  min="-25"
                  max="25"
                  step="5"
                  value={simOilShift}
                  onChange={(e) => setSimOilShift(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#f59e0b', cursor: 'pointer' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.66rem', color: '#64748b', marginTop: '2px' }}>
                  <span>-25% (Deflationary)</span>
                  <span>0%</span>
                  <span>+25% (Supply Shock)</span>
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                  <span style={{ fontSize: '0.78rem', color: '#cbd5e1', fontWeight: 700 }}>
                    US Dollar Index (DXY) Move:
                  </span>
                  <strong style={{ color: simDollarShift > 0 ? '#ef4444' : simDollarShift < 0 ? '#10b981' : '#94a3b8', fontSize: '0.84rem', fontFamily: 'monospace' }}>
                    {simDollarShift > 0 ? `+${simDollarShift}%` : `${simDollarShift}%`}
                  </strong>
                </div>
                <input
                  type="range"
                  min="-5"
                  max="5"
                  step="0.5"
                  value={simDollarShift}
                  onChange={(e) => setSimDollarShift(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#10b981', cursor: 'pointer' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.66rem', color: '#64748b', marginTop: '2px' }}>
                  <span>-5% (Weak USD Tailwind)</span>
                  <span>0%</span>
                  <span>+5% (USD Squeeze)</span>
                </div>
              </div>
            </div>

            {/* Projected Sector Impact Cards with Visual Bars */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(195px, 1fr))', gap: '0.65rem' }}>
              {simSectorProjections.map(sec => {
                const isPos = sec.expectedReturn > 0;
                const isFlat = sec.expectedReturn === 0;
                const color = isPos ? '#10b981' : isFlat ? '#94a3b8' : '#ef4444';
                const barWidth = Math.min(100, Math.abs(sec.expectedReturn) * 28);

                return (
                  <div
                    key={sec.symbol}
                    onClick={() => onTickerClick && onTickerClick(sec.symbol)}
                    style={{
                      background: isPos ? 'rgba(16, 185, 129, 0.08)' : isFlat ? 'rgba(255,255,255,0.03)' : 'rgba(239, 68, 68, 0.08)',
                      border: `1px solid ${isPos ? 'rgba(16, 185, 129, 0.28)' : isFlat ? 'rgba(255,255,255,0.06)' : 'rgba(239, 68, 68, 0.28)'}`,
                      borderRadius: '8px',
                      padding: '0.65rem 0.8rem',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '5px'
                    }}
                    title={`Click to open ${sec.symbol} chart`}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <strong style={{ color: '#f8fafc', fontSize: '0.84rem', fontFamily: 'monospace' }}>{sec.symbol}</strong>
                        <span style={{ fontSize: '0.68rem', color: '#94a3b8', display: 'block' }}>{sec.name}</span>
                      </div>
                      <strong style={{ fontSize: '0.95rem', color, fontFamily: 'monospace' }}>
                        {sec.expectedReturn > 0 ? `+${sec.expectedReturn}%` : `${sec.expectedReturn}%`}
                      </strong>
                    </div>
                    <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.07)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${barWidth}%`, height: '100%', background: color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 4 ALL-WEATHER MACRO REGIME STOCK BASKETS */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '1.1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Briefcase size={18} color="#38bdf8" /> All-Weather Institutional Trade Baskets (1-Click Chart Inspection)
              </h3>
              <span style={{ fontSize: '0.76rem', color: '#94a3b8' }}>
                Automatically highlights the basket aligned with the current live regime ({activeRegime.id})
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
              {baskets.map((b) => {
                const isActiveBasket = activeRegime.id === b.id;
                return (
                  <div
                    key={b.id}
                    className="glass-card"
                    style={{
                      padding: '1.15rem',
                      borderRadius: '12px',
                      border: `1.5px solid ${isActiveBasket ? b.color : 'rgba(255, 255, 255, 0.07)'}`,
                      borderTop: `3px solid ${b.color}`,
                      background: isActiveBasket ? `${b.color}12` : 'rgba(15, 23, 42, 0.65)',
                      boxShadow: isActiveBasket ? `0 8px 25px ${b.color}22` : 'none',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '0.75rem'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px', marginBottom: '0.45rem' }}>
                        <strong style={{ color: '#f8fafc', fontSize: '0.92rem' }}>
                          {b.title}
                        </strong>
                        <span
                          style={{
                            fontSize: '0.64rem',
                            background: isActiveBasket ? b.color : `${b.color}20`,
                            color: isActiveBasket ? '#000' : b.color,
                            padding: '2px 7px',
                            borderRadius: '4px',
                            fontWeight: 900,
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {isActiveBasket ? '★ ACTIVE REGIME' : b.badge}
                        </span>
                      </div>
                      <p style={{ fontSize: '0.77rem', color: '#cbd5e1', margin: 0, lineHeight: 1.45 }}>
                        {b.desc}
                      </p>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.38rem' }}>
                      {b.tickers.map(ticker => (
                        <button
                          key={ticker}
                          onClick={() => onTickerClick && onTickerClick(ticker)}
                          style={{
                            fontSize: '0.75rem',
                            fontFamily: 'monospace',
                            background: `${b.color}16`,
                            border: `1px solid ${b.color}45`,
                            color: '#f8fafc',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                          title={`Open ${ticker} in Deep Charting`}
                        >
                          {ticker}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 4. SINGLE-DRIVER 2-WAY INSTITUTIONAL PLAYBOOK */}
      {activeTab !== 'overview' && activeTab !== 'heatmap' && activeTab !== 'sensitivities' && currentScenario && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Driver Telemetry & Transmission Mechanism Banner */}
          <div
            className="glass-card"
            style={{
              padding: '1.25rem 1.5rem',
              background: 'rgba(15, 23, 42, 0.8)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              borderLeft: '4px solid #3b82f6',
              borderRadius: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.6rem'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                <Info size={18} color="#60a5fa" />
                <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '1.1rem', fontWeight: 800 }}>
                  {currentScenario.full_name} ({currentScenario.symbol}) — Institutional Transmission Playbook
                </h3>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'monospace', fontSize: '0.78rem' }}>
                <span style={{ padding: '3px 9px', borderRadius: '6px', background: 'rgba(255,255,255,0.06)', color: '#f8fafc', fontWeight: 800 }}>
                  Spot: {currentScenario.current_price} {currentScenario.unit}
                </span>
                <span style={{
                  padding: '3px 9px',
                  borderRadius: '6px',
                  background: currentScenario.change_1d >= 0 ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                  color: currentScenario.change_1d >= 0 ? '#10b981' : '#ef4444',
                  fontWeight: 700
                }}>
                  1D: {currentScenario.change_1d >= 0 ? `+${currentScenario.change_1d}%` : `${currentScenario.change_1d}%`}
                </span>
                <span style={{
                  padding: '3px 9px',
                  borderRadius: '6px',
                  background: currentScenario.trend === 'Rising' ? 'rgba(16,185,129,0.18)' : currentScenario.trend === 'Falling' ? 'rgba(239,68,68,0.18)' : 'rgba(255,255,255,0.06)',
                  color: currentScenario.trend === 'Rising' ? '#34d399' : currentScenario.trend === 'Falling' ? '#f87171' : '#94a3b8',
                  fontWeight: 800
                }}>
                  20D Trend: {currentScenario.trend}
                </span>
              </div>
            </div>

            <p style={{ margin: 0, color: '#cbd5e1', fontSize: '0.84rem', lineHeight: 1.5 }}>
              {currentScenario.transmission}
            </p>
          </div>

          {/* TWO-WAY PLAYBOOK GRID */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))', gap: '1.25rem' }}>
            {/* BULL CASE (IF DRIVER RISES) */}
            <div
              className="glass-card"
              style={{
                padding: '1.35rem',
                borderRadius: '14px',
                border: `1.5px solid ${currentScenario.trend === 'Rising' ? '#10b981' : 'rgba(255,255,255,0.08)'}`,
                borderTop: '4px solid #10b981',
                background: 'rgba(15, 23, 42, 0.72)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', gap: '0.5rem' }}>
                <h3 style={{ margin: 0, color: '#34d399', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.08rem', fontWeight: 800 }}>
                  <TrendingUp size={19} /> If {currentScenario.driver} Rallies ↗️
                </h3>
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    background: currentScenario.trend === 'Rising' ? '#10b981' : 'rgba(16, 185, 129, 0.15)',
                    color: currentScenario.trend === 'Rising' ? '#000' : '#10b981',
                    padding: '2px 8px',
                    borderRadius: '4px'
                  }}
                >
                  {currentScenario.trend === 'Rising' ? '★ ACTIVE LIVE TREND' : 'RISING SCENARIO'}
                </span>
              </div>

              <p style={{ color: '#cbd5e1', fontSize: '0.82rem', margin: '0 0 1.1rem 0', lineHeight: 1.45 }}>
                {currentScenario.if_up?.narrative}
              </p>

              {/* Winning Sectors */}
              <div style={{ marginBottom: '1.15rem' }}>
                <span style={{ fontSize: '0.7rem', color: '#6ee7b7', fontWeight: 800, textTransform: 'uppercase', display: 'block', marginBottom: '0.45rem' }}>
                  Favored Sector Rotations:
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {currentScenario.if_up?.favored_sectors?.map((sec, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: 'rgba(16, 185, 129, 0.08)',
                        border: '1px solid rgba(16, 185, 129, 0.22)',
                        padding: '0.5rem 0.75rem',
                        borderRadius: '6px',
                        fontSize: '0.79rem'
                      }}
                    >
                      <strong style={{ color: '#34d399' }}>{sec.sector}: </strong>
                      <span style={{ color: '#cbd5e1' }}>{sec.reason}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Positively Correlated Stocks */}
              <div style={{ marginBottom: '1.15rem' }}>
                <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase', display: 'block', marginBottom: '0.45rem' }}>
                  Top Correlated Equity Beneficiaries (Click to Chart):
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(135px, 1fr))', gap: '0.5rem' }}>
                  {currentScenario.if_up?.winning_stocks?.map(stock => (
                    <div
                      key={stock.ticker}
                      onClick={() => onTickerClick && onTickerClick(stock.ticker)}
                      style={{
                        background: 'rgba(16, 185, 129, 0.09)',
                        border: '1px solid rgba(16, 185, 129, 0.28)',
                        padding: '0.5rem 0.65rem',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                      title={`Inspect ${stock.ticker} chart`}
                    >
                      <div>
                        <strong style={{ color: '#f8fafc', fontSize: '0.84rem', fontFamily: 'monospace' }}>{stock.ticker}</strong>
                        <span style={{ fontSize: '0.68rem', color: '#94a3b8', display: 'block', fontFamily: 'monospace' }}>
                          ${stock.price}
                        </span>
                      </div>
                      <div style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                        <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#10b981', display: 'block' }}>
                          {stock.corr > 0 ? `+${stock.corr}` : stock.corr}
                        </span>
                        {stock.change_1d !== undefined && (
                          <span style={{ fontSize: '0.64rem', color: stock.change_1d >= 0 ? '#34d399' : '#f87171' }}>
                            {stock.change_1d >= 0 ? `+${stock.change_1d}%` : `${stock.change_1d}%`}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* At-Risk Stocks */}
              {currentScenario.if_up?.at_risk_stocks?.length > 0 && (
                <div>
                  <span style={{ fontSize: '0.7rem', color: '#f87171', fontWeight: 800, textTransform: 'uppercase', display: 'block', marginBottom: '0.45rem' }}>
                    Headwind / At-Risk Equities When {currentScenario.driver} Surges:
                  </span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                    {currentScenario.if_up.at_risk_stocks.slice(0, 6).map(stock => (
                      <span
                        key={stock.ticker}
                        onClick={() => onTickerClick && onTickerClick(stock.ticker)}
                        style={{
                          fontSize: '0.73rem',
                          fontFamily: 'monospace',
                          background: 'rgba(239, 68, 68, 0.1)',
                          border: '1px solid rgba(239, 68, 68, 0.28)',
                          color: '#fca5a5',
                          padding: '3px 8px',
                          borderRadius: '5px',
                          cursor: 'pointer'
                        }}
                      >
                        {stock.ticker} ({stock.corr})
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* BEAR CASE (IF DRIVER PULLS BACK) */}
            <div
              className="glass-card"
              style={{
                padding: '1.35rem',
                borderRadius: '14px',
                border: `1.5px solid ${currentScenario.trend === 'Falling' ? '#3b82f6' : 'rgba(255,255,255,0.08)'}`,
                borderTop: '4px solid #3b82f6',
                background: 'rgba(15, 23, 42, 0.72)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', gap: '0.5rem' }}>
                <h3 style={{ margin: 0, color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.08rem', fontWeight: 800 }}>
                  <TrendingDown size={19} /> If {currentScenario.driver} Pulls Back ↘️
                </h3>
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    background: currentScenario.trend === 'Falling' ? '#38bdf8' : 'rgba(59, 130, 246, 0.15)',
                    color: currentScenario.trend === 'Falling' ? '#000' : '#60a5fa',
                    padding: '2px 8px',
                    borderRadius: '4px'
                  }}
                >
                  {currentScenario.trend === 'Falling' ? '★ ACTIVE LIVE TREND' : 'PULLBACK SCENARIO'}
                </span>
              </div>

              <p style={{ color: '#cbd5e1', fontSize: '0.82rem', margin: '0 0 1.1rem 0', lineHeight: 1.45 }}>
                {currentScenario.if_down?.narrative}
              </p>

              {/* Winning Sectors */}
              <div style={{ marginBottom: '1.15rem' }}>
                <span style={{ fontSize: '0.7rem', color: '#93c5fd', fontWeight: 800, textTransform: 'uppercase', display: 'block', marginBottom: '0.45rem' }}>
                  Favored Sector Rotations:
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {currentScenario.if_down?.favored_sectors?.map((sec, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: 'rgba(59, 130, 246, 0.08)',
                        border: '1px solid rgba(59, 130, 246, 0.22)',
                        padding: '0.5rem 0.75rem',
                        borderRadius: '6px',
                        fontSize: '0.79rem'
                      }}
                    >
                      <strong style={{ color: '#60a5fa' }}>{sec.sector}: </strong>
                      <span style={{ color: '#cbd5e1' }}>{sec.reason}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Inversely Correlated Stocks */}
              <div style={{ marginBottom: '1.15rem' }}>
                <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase', display: 'block', marginBottom: '0.45rem' }}>
                  Top Inverse Correlation Beneficiaries (Click to Chart):
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(135px, 1fr))', gap: '0.5rem' }}>
                  {currentScenario.if_down?.winning_stocks?.map(stock => (
                    <div
                      key={stock.ticker}
                      onClick={() => onTickerClick && onTickerClick(stock.ticker)}
                      style={{
                        background: 'rgba(59, 130, 246, 0.09)',
                        border: '1px solid rgba(59, 130, 246, 0.28)',
                        padding: '0.5rem 0.65rem',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                      title={`Inspect ${stock.ticker} chart`}
                    >
                      <div>
                        <strong style={{ color: '#f8fafc', fontSize: '0.84rem', fontFamily: 'monospace' }}>{stock.ticker}</strong>
                        <span style={{ fontSize: '0.68rem', color: '#94a3b8', display: 'block', fontFamily: 'monospace' }}>
                          ${stock.price}
                        </span>
                      </div>
                      <div style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                        <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#60a5fa', display: 'block' }}>
                          {stock.corr}
                        </span>
                        {stock.change_1d !== undefined && (
                          <span style={{ fontSize: '0.64rem', color: stock.change_1d >= 0 ? '#34d399' : '#f87171' }}>
                            {stock.change_1d >= 0 ? `+${stock.change_1d}%` : `${stock.change_1d}%`}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* At-Risk Stocks when driver falls */}
              {currentScenario.if_down?.at_risk_stocks?.length > 0 && (
                <div>
                  <span style={{ fontSize: '0.7rem', color: '#f87171', fontWeight: 800, textTransform: 'uppercase', display: 'block', marginBottom: '0.45rem' }}>
                    Headwind / At-Risk Equities When {currentScenario.driver} Drops:
                  </span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                    {currentScenario.if_down.at_risk_stocks.slice(0, 6).map(stock => (
                      <span
                        key={stock.ticker}
                        onClick={() => onTickerClick && onTickerClick(stock.ticker)}
                        style={{
                          fontSize: '0.73rem',
                          fontFamily: 'monospace',
                          background: 'rgba(239, 68, 68, 0.1)',
                          border: '1px solid rgba(239, 68, 68, 0.28)',
                          color: '#fca5a5',
                          padding: '3px 8px',
                          borderRadius: '5px',
                          cursor: 'pointer'
                        }}
                      >
                        {stock.ticker} ({stock.corr > 0 ? `+${stock.corr}` : stock.corr})
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 5. CROSS-ASSET CORRELATION HEATMAP TAB */}
      {activeTab === 'heatmap' && crossMatrix.assets && (
        <div className="glass-card" style={{ padding: '1.35rem', borderRadius: '14px', borderTop: '4px solid #f59e0b', background: 'rgba(15, 23, 42, 0.75)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h3 style={{ margin: '0 0 0.25rem 0', color: '#fbbf24', fontSize: '1.15rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Layers size={19} /> 90-Day Cross-Asset Correlation Matrix
              </h3>
              <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                Pairwise daily return correlations across Indices (SPY, QQQ), Macro Drivers (^TNX, DXY, Oil, Gold, BTC), and Sector ETFs.
              </span>
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.72rem' }}>
              <span style={{ color: '#94a3b8' }}>Inverse (-1.0)</span>
              <div style={{ width: 14, height: 14, background: '#ef4444', borderRadius: 3 }} />
              <div style={{ width: 14, height: 14, background: 'rgba(239, 68, 68, 0.4)', borderRadius: 3 }} />
              <div style={{ width: 14, height: 14, background: 'rgba(100, 116, 139, 0.3)', borderRadius: 3 }} />
              <div style={{ width: 14, height: 14, background: 'rgba(16, 185, 129, 0.4)', borderRadius: 3 }} />
              <div style={{ width: 14, height: 14, background: '#10b981', borderRadius: 3 }} />
              <span style={{ color: '#94a3b8' }}>Lockstep (+1.0)</span>
            </div>
          </div>

          {/* Strongest Positive & Inverse Pairs Callout Strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
            <div style={{ background: 'rgba(16, 185, 129, 0.07)', border: '1px solid rgba(16, 185, 129, 0.22)', borderRadius: '8px', padding: '0.6rem 0.85rem' }}>
              <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#34d399', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                Strongest Positive Lockstep Pairs (90D)
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.75rem', fontFamily: 'monospace' }}>
                {extremePairs.topPos.map((p, idx) => (
                  <span key={idx} style={{ color: '#e2e8f0' }}>
                    {p.pair}: <strong style={{ color: '#10b981' }}>+{p.val}</strong>
                  </span>
                ))}
              </div>
            </div>

            <div style={{ background: 'rgba(239, 68, 68, 0.07)', border: '1px solid rgba(239, 68, 68, 0.22)', borderRadius: '8px', padding: '0.6rem 0.85rem' }}>
              <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#f87171', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                Strongest Inverse / Hedging Pairs (90D)
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.75rem', fontFamily: 'monospace' }}>
                {extremePairs.topNeg.map((p, idx) => (
                  <span key={idx} style={{ color: '#e2e8f0' }}>
                    {p.pair}: <strong style={{ color: '#ef4444' }}>{p.val}</strong>
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.74rem', textAlign: 'center', fontFamily: 'monospace' }}>
              <thead>
                <tr>
                  <th style={{ padding: '0.55rem', textAlign: 'left', color: '#cbd5e1', borderBottom: '1px solid rgba(255,255,255,0.1)', fontFamily: 'sans-serif' }}>
                    Asset
                  </th>
                  {crossMatrix.assets.map(a => (
                    <th key={a.symbol} style={{ padding: '0.55rem 0.3rem', color: '#cbd5e1', borderBottom: '1px solid rgba(255,255,255,0.1)', whiteSpace: 'nowrap', fontFamily: 'sans-serif' }}>
                      {a.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {crossMatrix.assets.map(rowAsset => (
                  <tr key={rowAsset.symbol} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <td style={{ padding: '0.5rem 0.6rem', textAlign: 'left', fontWeight: 700, color: '#f8fafc', whiteSpace: 'nowrap', fontFamily: 'sans-serif' }}>
                      {rowAsset.label}
                    </td>
                    {crossMatrix.assets.map(colAsset => {
                      const val = crossMatrix.values[rowAsset.symbol]?.[colAsset.symbol];
                      const isSelf = rowAsset.symbol === colAsset.symbol;
                      let bg = 'rgba(0,0,0,0.2)';
                      let color = '#94a3b8';

                      if (isSelf) {
                        bg = 'rgba(255,255,255,0.05)';
                        color = '#64748b';
                      } else if (val !== undefined && val !== null) {
                        if (val >= 0.6) { bg = 'rgba(16, 185, 129, 0.42)'; color = '#6ee7b7'; }
                        else if (val >= 0.25) { bg = 'rgba(16, 185, 129, 0.18)'; color = '#34d399'; }
                        else if (val <= -0.45) { bg = 'rgba(239, 68, 68, 0.42)'; color = '#fca5a5'; }
                        else if (val <= -0.2) { bg = 'rgba(239, 68, 68, 0.18)'; color = '#f87171'; }
                        else { bg = 'rgba(255,255,255,0.02)'; color = '#94a3b8'; }
                      }

                      return (
                        <td
                          key={colAsset.symbol}
                          style={{
                            padding: '0.45rem 0.25rem',
                            background: bg,
                            color,
                            fontWeight: isSelf ? 400 : 700,
                            border: '1px solid rgba(255,255,255,0.03)'
                          }}
                          title={`${rowAsset.label} vs ${colAsset.label}: ${val}`}
                        >
                          {isSelf ? '1.00' : (val !== undefined && val !== null ? (val > 0 ? `+${val}` : `${val}`) : '-')}
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

      {/* 6. SECTOR SENSITIVITY MATRIX TAB */}
      {activeTab === 'sensitivities' && sortedSensitivities.length > 0 && (
        <div className="glass-card" style={{ padding: '1.35rem', borderRadius: '14px', borderTop: '4px solid #06b6d4', background: 'rgba(15, 23, 42, 0.75)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h3 style={{ margin: '0 0 0.25rem 0', color: '#22d3ee', fontSize: '1.15rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <BarChart2 size={19} /> SPDR Sector Macro Sensitivity Rankings (Click Column to Sort)
              </h3>
              <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                90-day empirical correlation betas across 10-Yr Yields, US Dollar (DXY), Crude Oil, Gold, and S&P 500.
              </span>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', fontSize: '0.73rem', textTransform: 'uppercase' }}>
                  <th style={{ padding: '0.7rem', textAlign: 'left' }}>Sector ETF</th>
                  {[
                    { key: 'corr_tnx', label: '10-Yr Yield (^TNX)' },
                    { key: 'corr_dxy', label: 'US Dollar (DXY)' },
                    { key: 'corr_oil', label: 'Crude Oil (CL=F)' },
                    { key: 'corr_gold', label: 'Gold (GC=F)' },
                    { key: 'corr_spy', label: 'S&P 500 (SPY)' }
                  ].map(col => (
                    <th
                      key={col.key}
                      onClick={() => {
                        if (sortCol === col.key) setSortAsc(!sortAsc);
                        else { setSortCol(col.key); setSortAsc(false); }
                      }}
                      style={{
                        padding: '0.7rem',
                        textAlign: 'center',
                        cursor: 'pointer',
                        color: sortCol === col.key ? '#38bdf8' : '#94a3b8'
                      }}
                    >
                      {col.label} {sortCol === col.key ? (sortAsc ? '↑' : '↓') : ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedSensitivities.map(sec => {
                  const renderCell = (val) => {
                    const num = Number(val ?? 0);
                    const c = num >= 0.2 ? '#10b981' : num <= -0.2 ? '#ef4444' : '#94a3b8';
                    const w = Math.min(100, Math.abs(num) * 100);
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', fontFamily: 'monospace' }}>
                        <span style={{ fontWeight: 700, color: c }}>
                          {num > 0 ? `+${num}` : num}
                        </span>
                        <div style={{ width: '64px', height: '4px', background: 'rgba(255,255,255,0.07)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${w}%`, height: '100%', background: c }} />
                        </div>
                      </div>
                    );
                  };

                  return (
                    <tr
                      key={sec.symbol}
                      onClick={() => onTickerClick && onTickerClick(sec.symbol)}
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer' }}
                    >
                      <td style={{ padding: '0.7rem', fontWeight: 700, color: '#f8fafc' }}>
                        <span style={{ color: '#22d3ee', fontFamily: 'monospace', marginRight: '0.5rem' }}>{sec.symbol}</span>
                        {sec.name}
                      </td>
                      <td style={{ padding: '0.7rem' }}>{renderCell(sec.corr_tnx)}</td>
                      <td style={{ padding: '0.7rem' }}>{renderCell(sec.corr_dxy)}</td>
                      <td style={{ padding: '0.7rem' }}>{renderCell(sec.corr_oil)}</td>
                      <td style={{ padding: '0.7rem' }}>{renderCell(sec.corr_gold)}</td>
                      <td style={{ padding: '0.7rem' }}>{renderCell(sec.corr_spy)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
