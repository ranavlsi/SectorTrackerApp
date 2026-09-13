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
  Search,
  Sliders,
  HelpCircle,
  Play,
  RotateCcw,
  Sparkles,
  Target,
  Briefcase
} from 'lucide-react';

export default function MacroMatrixDashboard({ data, onTickerClick }) {
  const [localData, setLocalData] = useState(data);
  const [loading, setLoading] = useState(!data);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState('');
  
  // Navigation: 'overview', '10-Yr Yield', 'US Dollar (DXY)', 'Crude Oil', 'Gold', 'Bitcoin', 'VIX', 'heatmap', 'sensitivities'
  const [activeTab, setActiveTab] = useState('overview');

  // "What-If" Simulator State
  const [simYieldShift, setSimYieldShift] = useState(0); // -50 to +50 bps
  const [simOilShift, setSimOilShift] = useState(0);     // -25% to +25%
  const [simDollarShift, setSimDollarShift] = useState(0); // -5% to +5%

  // Auto-fetch if data not yet provided
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
        console.warn('Direct correlation JSON fetch failed, attempting API:', err);
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

  // Handle on-demand refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    setRefreshMessage('Updating live macro driver prices & recalculating 90-day correlation matrix...');
    try {
      const res = await fetch('/api/macro_matrix?refresh=1', { method: 'POST' });
      if (!res.ok) throw new Error(`Scanner error HTTP ${res.status}`);
      const fresh = await res.json();
      setLocalData(fresh);
      setRefreshMessage('Macro Matrix successfully updated!');
      setTimeout(() => setRefreshMessage(''), 4000);
    } catch (err) {
      console.error('Macro refresh failed:', err);
      try {
        const fallbackRes = await fetch('/correlation_results.json?t=' + Date.now());
        const fallbackJson = await fallbackRes.json();
        setLocalData(fallbackJson);
        setRefreshMessage('Loaded latest cached macro data.');
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
  const activeRegime = localData?.active_regime || {};
  const scenarios = localData?.scenarios || [];
  const crossMatrix = localData?.cross_asset_matrix || { assets: [], values: {} };
  const sectorSensitivities = localData?.sector_sensitivities || [];

  // Active scenario for single-driver deep dives
  const currentScenario = useMemo(() => {
    return scenarios.find(s => s.driver.toLowerCase() === activeTab.toLowerCase()) || scenarios[0];
  }, [scenarios, activeTab]);

  // Simulator Sector Projections calculation
  const simSectorProjections = useMemo(() => {
    if (!sectorSensitivities || sectorSensitivities.length === 0) return [];
    
    return sectorSensitivities.map(sec => {
      // Impact = (yield_shift * corr_tnx * weight) + (oil_shift * corr_oil * weight) + (dollar_shift * corr_dxy * weight)
      const yieldImpact = (simYieldShift / 10) * sec.corr_tnx * 0.8;
      const oilImpact = (simOilShift / 5) * sec.corr_oil * 0.6;
      const dollarImpact = (simDollarShift / 2) * sec.corr_dxy * 0.5;
      const totalImpact = roundTo2(yieldImpact + oilImpact + dollarImpact);

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

  function roundTo2(num) {
    return Math.round(num * 100) / 100;
  }

  // Preset Simulator Scenarios
  const applyPreset = (type) => {
    if (type === 'reflation_boom') {
      setSimYieldShift(35);
      setSimOilShift(15);
      setSimDollarShift(1);
    } else if (type === 'rate_cut') {
      setSimYieldShift(-30);
      setSimOilShift(-5);
      setSimDollarShift(-2);
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

  if (loading && !localData) {
    return (
      <div className="glass-card" style={{ padding: '4rem 2rem', textAlign: 'center', color: '#94a3b8' }}>
        <ActivitySquare size={44} className="animate-spin" style={{ color: '#4facfe', margin: '0 auto 1.25rem auto' }} />
        <h3 style={{ color: 'white', margin: '0 0 0.5rem 0', fontSize: '1.4rem' }}>
          Initializing Institutional Macro Matrix...
        </h3>
        <p style={{ maxWidth: '500px', margin: '0 auto', fontSize: '0.9rem', lineHeight: '1.5' }}>
          Mapping real-time transmission mechanisms across 10-Yr Treasury Yields, US Dollar, WTI Crude Oil, Gold, Bitcoin, and SPDR Sector rotations.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      
      {/* 1. HEADER & LIVE DRIVER COMMAND BAR */}
      <div className="glass-card" style={{ 
        padding: '1.5rem 2rem', 
        background: 'linear-gradient(135deg, rgba(15,23,42,0.96) 0%, rgba(30,58,138,0.25) 100%)',
        borderLeft: '5px solid #4facfe'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ 
              background: 'rgba(79, 172, 254, 0.2)', 
              padding: '0.6rem', 
              borderRadius: '10px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              border: '1px solid rgba(79, 172, 254, 0.4)' 
            }}>
              <ActivitySquare size={28} color="#4facfe" />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.8rem', color: 'white', fontWeight: '800', letterSpacing: '-0.5px' }}>
                Macro Transmission Matrix
              </h1>
              <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                Cross-Asset Regimes • Economic Transmission Mechanisms • Interactive "What-If" Simulator
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {localData?.last_updated && (
              <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                Synced: {localData.last_updated}
              </span>
            )}
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              style={{
                padding: '0.55rem 1.1rem',
                borderRadius: '8px',
                background: isRefreshing ? 'rgba(79, 172, 254, 0.15)' : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                color: 'white',
                border: '1px solid rgba(79, 172, 254, 0.4)',
                fontWeight: '700',
                fontSize: '0.82rem',
                cursor: isRefreshing ? 'wait' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)'
              }}
            >
              <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
              {isRefreshing ? 'Recalculating...' : 'Refresh Macro Data'}
            </button>
          </div>
        </div>

        {refreshMessage && (
          <div style={{ 
            marginBottom: '1rem', 
            padding: '0.5rem 0.8rem', 
            background: 'rgba(59, 130, 246, 0.15)', 
            border: '1px solid rgba(59, 130, 246, 0.3)', 
            borderRadius: '6px',
            fontSize: '0.78rem',
            color: '#93c5fd'
          }}>
            {refreshMessage}
          </div>
        )}

        {/* 6 Real-Time Driver Cards */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', 
          gap: '0.85rem' 
        }}>
          {Object.entries(macroQuotes).map(([sym, meta]) => {
            const isSelected = activeTab.toLowerCase() === meta.short_name.toLowerCase();
            const isPositive = meta.change_1d >= 0;

            return (
              <div
                key={sym}
                onClick={() => setActiveTab(meta.short_name)}
                style={{
                  background: isSelected ? 'rgba(59, 130, 246, 0.25)' : 'rgba(0,0,0,0.35)',
                  border: `1px solid ${isSelected ? '#3b82f6' : 'rgba(255,255,255,0.06)'}`,
                  borderRadius: '8px',
                  padding: '0.85rem 1rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: isSelected ? '0 0 14px rgba(59, 130, 246, 0.25)' : 'none'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: '700', color: isSelected ? '#60a5fa' : '#cbd5e1' }}>
                    {meta.short_name}
                  </span>
                  <span style={{ 
                    fontSize: '0.65rem', 
                    padding: '0.1rem 0.35rem', 
                    borderRadius: '4px',
                    fontWeight: '700',
                    background: meta.trend === 'Rising' ? 'rgba(16, 185, 129, 0.15)' : meta.trend === 'Falling' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255,255,255,0.06)',
                    color: meta.trend === 'Rising' ? '#10b981' : meta.trend === 'Falling' ? '#ef4444' : '#94a3b8'
                  }}>
                    {meta.trend}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
                  <strong style={{ fontSize: '1.25rem', color: 'white' }}>
                    {meta.current_price}
                  </strong>
                  <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                    {meta.unit}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.35rem', fontSize: '0.72rem' }}>
                  <span style={{ color: isPositive ? '#10b981' : '#ef4444', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '2px' }}>
                    {isPositive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                    {isPositive ? `+${meta.change_1d}%` : `${meta.change_1d}%`} (1D)
                  </span>
                  <span style={{ color: '#64748b' }}>
                    {meta.change_5d > 0 ? `+${meta.change_5d}%` : `${meta.change_5d}%`} 5D
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. MAIN NAVIGATION TABS */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.75rem' }}>
        <button
          onClick={() => setActiveTab('overview')}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '6px',
            border: `1px solid ${activeTab === 'overview' ? '#4facfe' : 'rgba(255,255,255,0.08)'}`,
            background: activeTab === 'overview' ? 'rgba(79, 172, 254, 0.2)' : 'rgba(0,0,0,0.2)',
            color: activeTab === 'overview' ? '#60a5fa' : '#94a3b8',
            fontWeight: '700',
            fontSize: '0.85rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem'
          }}
        >
          <Sparkles size={15} /> Macro Overview & Simulator
        </button>

        {scenarios.map(sc => (
          <button
            key={sc.driver}
            onClick={() => setActiveTab(sc.driver)}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              border: `1px solid ${activeTab.toLowerCase() === sc.driver.toLowerCase() ? '#3b82f6' : 'rgba(255,255,255,0.08)'}`,
              background: activeTab.toLowerCase() === sc.driver.toLowerCase() ? 'rgba(59, 130, 246, 0.2)' : 'rgba(0,0,0,0.2)',
              color: activeTab.toLowerCase() === sc.driver.toLowerCase() ? '#60a5fa' : '#94a3b8',
              fontWeight: '700',
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}
          >
            {sc.driver}
          </button>
        ))}

        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => setActiveTab('heatmap')}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              border: `1px solid ${activeTab === 'heatmap' ? '#f59e0b' : 'rgba(255,255,255,0.08)'}`,
              background: activeTab === 'heatmap' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(0,0,0,0.2)',
              color: activeTab === 'heatmap' ? '#fbbf24' : '#94a3b8',
              fontWeight: '700',
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}
          >
            <Layers size={15} /> Cross-Asset Heatmap
          </button>

          <button
            onClick={() => setActiveTab('sensitivities')}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              border: `1px solid ${activeTab === 'sensitivities' ? '#06b6d4' : 'rgba(255,255,255,0.08)'}`,
              background: activeTab === 'sensitivities' ? 'rgba(6, 182, 212, 0.2)' : 'rgba(0,0,0,0.2)',
              color: activeTab === 'sensitivities' ? '#22d3ee' : '#94a3b8',
              fontWeight: '700',
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}
          >
            <BarChart2 size={15} /> Sector Sensitivity Matrix
          </button>
        </div>
      </div>

      {/* 3. OVERVIEW TAB: REGIME MAP + WHAT-IF SIMULATOR + CURATED BASKETS */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
          
          {/* 4-QUADRANT MACRO REGIME MAP & BAROMETER */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '1.5rem', alignItems: 'stretch' }}>
            
            {/* Visual 4-Quadrant Matrix */}
            <div className="glass-card" style={{ 
              padding: '1.5rem', 
              borderTop: `4px solid ${
                activeRegime.id === 'REFLATION' ? '#f59e0b' : 
                activeRegime.id === 'STAGFLATION' ? '#ef4444' : 
                activeRegime.id === 'DEFLATION' ? '#94a3b8' : '#10b981'
              }` 
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <h3 style={{ 
                    margin: 0, 
                    color: activeRegime.id === 'REFLATION' ? '#fbbf24' : activeRegime.id === 'STAGFLATION' ? '#f87171' : '#34d399', 
                    fontSize: '1.15rem', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '0.5rem' 
                  }}>
                    <Target size={18} /> 4-Quadrant Macro Economic Cycle
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                    Growth (GDP / Liquidity) vs Inflation (Yields / Commodities) Matrix
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                  <span style={{ 
                    fontSize: '0.68rem', 
                    padding: '0.15rem 0.5rem', 
                    borderRadius: '4px', 
                    background: 'rgba(245, 158, 11, 0.15)', 
                    color: '#fbbf24', 
                    fontWeight: '700',
                    border: '1px solid rgba(245, 158, 11, 0.3)'
                  }}>
                    GROWTH ↑ • INFLATION/YIELDS ↑
                  </span>
                  <span style={{ 
                    fontSize: '0.72rem', 
                    padding: '0.2rem 0.6rem', 
                    borderRadius: '4px', 
                    background: activeRegime.id === 'REFLATION' ? 'rgba(245, 158, 11, 0.25)' : 'rgba(16, 185, 129, 0.2)', 
                    color: activeRegime.id === 'REFLATION' ? '#fbbf24' : '#10b981', 
                    fontWeight: '700',
                    border: `1px solid ${activeRegime.id === 'REFLATION' ? '#f59e0b' : '#10b981'}`
                  }}>
                    ACTIVE: {activeRegime.name?.toUpperCase() || 'REFLATIONARY EXPANSION'}
                  </span>
                </div>
              </div>

              {/* 4 Quadrants Grid */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 1fr', 
                gridTemplateRows: '1fr 1fr', 
                gap: '0.65rem',
                minHeight: '260px'
              }}>
                {/* Quadrant 2: STAGFLATION (Growth Down, Inflation Up) */}
                <div style={{ 
                  background: activeRegime.id === 'STAGFLATION' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(0,0,0,0.3)', 
                  border: `2px solid ${activeRegime.id === 'STAGFLATION' ? '#ef4444' : 'rgba(255,255,255,0.05)'}`,
                  borderRadius: '8px', 
                  padding: '0.85rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between'
                }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ color: '#f87171', fontSize: '0.88rem' }}>QUADRANT II: STAGFLATION</strong>
                      {activeRegime.id === 'STAGFLATION' && <span style={{ fontSize: '0.65rem', background: '#ef4444', color: 'white', padding: '1px 5px', borderRadius: '3px', fontWeight: '800' }}>YOU ARE HERE</span>}
                    </div>
                    <span style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginTop: '2px' }}>
                      Growth Decelerating ↓ • Inflation Accelerating ↑
                    </span>
                  </div>
                  <div style={{ fontSize: '0.74rem', marginTop: '0.5rem' }}>
                    <strong style={{ color: '#cbd5e1' }}>Favors: </strong>
                    <span style={{ color: '#fca5a5' }}>Gold (GLD), Cash, Oil/Energy (XLE)</span>
                  </div>
                </div>

                {/* Quadrant 1: REFLATION (Growth Up, Inflation Up) */}
                <div style={{ 
                  background: activeRegime.id === 'REFLATION' ? 'rgba(245, 158, 11, 0.25)' : 'rgba(0,0,0,0.3)', 
                  border: `2px solid ${activeRegime.id === 'REFLATION' ? '#f59e0b' : 'rgba(255,255,255,0.05)'}`,
                  borderRadius: '8px', 
                  padding: '0.85rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: activeRegime.id === 'REFLATION' ? '0 0 15px rgba(245, 158, 11, 0.2)' : 'none'
                }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ color: '#fbbf24', fontSize: '0.88rem' }}>QUADRANT I: REFLATION</strong>
                      {activeRegime.id === 'REFLATION' && <span style={{ fontSize: '0.65rem', background: '#f59e0b', color: 'black', padding: '1px 5px', borderRadius: '3px', fontWeight: '800' }}>YOU ARE HERE</span>}
                    </div>
                    <span style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginTop: '2px' }}>
                      Growth Accelerating ↑ • Inflation / Yields Rising ↑
                    </span>
                  </div>
                  <div style={{ fontSize: '0.74rem', marginTop: '0.5rem' }}>
                    <strong style={{ color: '#cbd5e1' }}>Favors: </strong>
                    <span style={{ color: '#fde68a' }}>Energy (XLE), Financials (XLF), Industrials (XLI), Materials (XLB)</span>
                  </div>
                </div>

                {/* Quadrant 3: DEFLATION (Growth Down, Inflation Down) */}
                <div style={{ 
                  background: activeRegime.id === 'DEFLATION' ? 'rgba(148, 163, 184, 0.2)' : 'rgba(0,0,0,0.3)', 
                  border: `2px solid ${activeRegime.id === 'DEFLATION' ? '#94a3b8' : 'rgba(255,255,255,0.05)'}`,
                  borderRadius: '8px', 
                  padding: '0.85rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between'
                }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ color: '#cbd5e1', fontSize: '0.88rem' }}>QUADRANT III: DEFLATION</strong>
                      {activeRegime.id === 'DEFLATION' && <span style={{ fontSize: '0.65rem', background: '#94a3b8', color: 'black', padding: '1px 5px', borderRadius: '3px', fontWeight: '800' }}>YOU ARE HERE</span>}
                    </div>
                    <span style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginTop: '2px' }}>
                      Growth Decelerating ↓ • Inflation Falling ↓
                    </span>
                  </div>
                  <div style={{ fontSize: '0.74rem', marginTop: '0.5rem' }}>
                    <strong style={{ color: '#cbd5e1' }}>Favors: </strong>
                    <span style={{ color: '#e2e8f0' }}>Long Bonds (TLT), Utilities (XLU), Healthcare (XLV)</span>
                  </div>
                </div>

                {/* Quadrant 4: GOLDILOCKS (Growth Up, Inflation Down) */}
                <div style={{ 
                  background: activeRegime.id === 'GOLDILOCKS' ? 'rgba(16, 185, 129, 0.25)' : 'rgba(0,0,0,0.3)', 
                  border: `2px solid ${activeRegime.id === 'GOLDILOCKS' ? '#10b981' : 'rgba(255,255,255,0.05)'}`,
                  borderRadius: '8px', 
                  padding: '0.85rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between'
                }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ color: '#34d399', fontSize: '0.88rem' }}>QUADRANT IV: GOLDILOCKS</strong>
                      {activeRegime.id === 'GOLDILOCKS' && (
                        <span style={{ fontSize: '0.65rem', background: '#10b981', color: 'black', padding: '1px 5px', borderRadius: '3px', fontWeight: '800' }}>YOU ARE HERE</span>
                      )}
                    </div>
                    <span style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginTop: '2px' }}>
                      Growth Accelerating ↑ • Inflation / Yields Falling ↓
                    </span>
                  </div>
                  <div style={{ fontSize: '0.74rem', marginTop: '0.5rem' }}>
                    <strong style={{ color: '#cbd5e1' }}>Favors: </strong>
                    <span style={{ color: '#6ee7b7' }}>Technology (XLK), Semis (SMH), Discretionary (XLY)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Active Regime Executive Summary Card */}
            <div className="glass-card" style={{ 
              padding: '1.5rem', 
              borderTop: `4px solid ${activeRegime.id === 'REFLATION' ? '#f59e0b' : '#3b82f6'}`, 
              display: 'flex', 
              flexDirection: 'column', 
              justifyContent: 'space-between' 
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
                  <Compass size={16} color="#60a5fa" />
                  <span style={{ fontSize: '0.75rem', color: '#93c5fd', fontWeight: '700', textTransform: 'uppercase' }}>
                    Macro Trader's Executive Briefing
                  </span>
                </div>

                <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1.3rem', color: 'white', fontWeight: '800' }}>
                  {activeRegime.name}
                </h3>

                <p style={{ color: '#cbd5e1', fontSize: '0.86rem', lineHeight: '1.5', margin: '0 0 1rem 0' }}>
                  {activeRegime.description}
                </p>

                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.75rem', borderRadius: '6px', marginBottom: '1rem', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <span style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginBottom: '0.25rem' }}>Active Driver Confluence:</span>
                  <span style={{ fontSize: '0.8rem', color: '#e2e8f0' }}>{activeRegime.driver_summary}</span>
                </div>
              </div>

              <div>
                <span style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: '700', textTransform: 'uppercase', display: 'block', marginBottom: '0.4rem' }}>
                  Highest Conviction Sectors:
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {activeRegime.favored_sectors?.map((sec, i) => (
                    <span key={i} style={{ 
                      fontSize: '0.75rem', 
                      background: 'rgba(16, 185, 129, 0.15)', 
                      color: '#34d399', 
                      padding: '0.2rem 0.6rem', 
                      borderRadius: '4px',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      fontWeight: '600'
                    }}>
                      {sec}
                    </span>
                  ))}
                </div>
              </div>
            </div>

          </div>

          {/* INTERACTIVE "WHAT-IF" MACRO SIMULATOR */}
          <div className="glass-card" style={{ padding: '1.5rem 2rem', borderTop: '4px solid #f59e0b' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ margin: 0, color: '#fbbf24', fontSize: '1.3rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Sliders size={20} /> Interactive "What-If" Macro Simulator
                </h3>
                <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
                  Slide macro inputs to project how individual sectors and stock baskets will rotate in real time.
                </span>
              </div>

              {/* 1-Click Preset Scenario Buttons */}
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                <button
                  onClick={() => applyPreset('reflation_boom')}
                  style={{
                    padding: '0.35rem 0.75rem',
                    borderRadius: '6px',
                    background: 'rgba(245, 158, 11, 0.2)',
                    border: '1px solid rgba(245, 158, 11, 0.4)',
                    color: '#fbbf24',
                    fontSize: '0.75rem',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  🔥 Reflationary Boom (Growth↑, Yields↑)
                </button>

                <button
                  onClick={() => applyPreset('rate_cut')}
                  style={{
                    padding: '0.35rem 0.75rem',
                    borderRadius: '6px',
                    background: 'rgba(16, 185, 129, 0.15)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    color: '#34d399',
                    fontSize: '0.75rem',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  📉 Fed Rate Cut Rally
                </button>

                <button
                  onClick={() => applyPreset('oil_shock')}
                  style={{
                    padding: '0.35rem 0.75rem',
                    borderRadius: '6px',
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#f87171',
                    fontSize: '0.75rem',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  🛢️ Oil Supply Spike (+20%)
                </button>

                <button
                  onClick={() => applyPreset('dollar_squeeze')}
                  style={{
                    padding: '0.35rem 0.75rem',
                    borderRadius: '6px',
                    background: 'rgba(59, 130, 246, 0.15)',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    color: '#60a5fa',
                    fontSize: '0.75rem',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  💵 Dollar Liquidity Squeeze
                </button>

                <button
                  onClick={() => applyPreset('reset')}
                  style={{
                    padding: '0.35rem 0.6rem',
                    borderRadius: '6px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#94a3b8',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem'
                  }}
                  title="Reset sliders to neutral"
                >
                  <RotateCcw size={12} /> Reset
                </button>
              </div>
            </div>

            {/* Slider Controls */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
              gap: '1.5rem',
              background: 'rgba(0,0,0,0.3)',
              padding: '1.25rem',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.05)',
              marginBottom: '1.5rem'
            }}>
              {/* 10-Yr Yield Slider */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                  <span style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: '600' }}>
                    10-Yr Yield Shift:
                  </span>
                  <strong style={{ color: simYieldShift > 0 ? '#ef4444' : simYieldShift < 0 ? '#10b981' : '#94a3b8', fontSize: '0.85rem' }}>
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
                  style={{ width: '100%', accentColor: '#4facfe', cursor: 'pointer' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: '#64748b', marginTop: '2px' }}>
                  <span>-50 bps (Rates Fall)</span>
                  <span>Neutral (0)</span>
                  <span>+50 bps (Rates Surge)</span>
                </div>
              </div>

              {/* Crude Oil Slider */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                  <span style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: '600' }}>
                    Crude Oil Shock:
                  </span>
                  <strong style={{ color: simOilShift > 0 ? '#f59e0b' : simOilShift < 0 ? '#10b981' : '#94a3b8', fontSize: '0.85rem' }}>
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
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: '#64748b', marginTop: '2px' }}>
                  <span>-25% (Energy Drop)</span>
                  <span>Neutral (0)</span>
                  <span>+25% (Oil Spike)</span>
                </div>
              </div>

              {/* US Dollar Slider */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                  <span style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: '600' }}>
                    US Dollar (DXY) Trend:
                  </span>
                  <strong style={{ color: simDollarShift > 0 ? '#60a5fa' : simDollarShift < 0 ? '#10b981' : '#94a3b8', fontSize: '0.85rem' }}>
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
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: '#64748b', marginTop: '2px' }}>
                  <span>-5% (Dollar Softens)</span>
                  <span>Neutral (0)</span>
                  <span>+5% (Dollar Squeeze)</span>
                </div>
              </div>
            </div>

            {/* Simulated Sector Impact Bar Chart */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#cbd5e1', textTransform: 'uppercase' }}>
                  Projected Sector Rotation Impact:
                </span>
                <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                  Calculated from 90-day multi-asset beta sensitivities
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.65rem' }}>
                {simSectorProjections.map(sec => {
                  const isPositive = sec.expectedReturn > 0;
                  const isFlat = sec.expectedReturn === 0;
                  const color = isPositive ? '#10b981' : isFlat ? '#94a3b8' : '#ef4444';
                  const bg = isPositive ? 'rgba(16, 185, 129, 0.12)' : isFlat ? 'rgba(255,255,255,0.03)' : 'rgba(239, 68, 68, 0.12)';
                  const border = isPositive ? '1px solid rgba(16, 185, 129, 0.25)' : isFlat ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(239, 68, 68, 0.25)';

                  return (
                    <div 
                      key={sec.symbol}
                      style={{
                        background: bg,
                        border: border,
                        borderRadius: '6px',
                        padding: '0.6rem 0.8rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div>
                        <strong style={{ color: 'white', fontSize: '0.82rem' }}>{sec.symbol}</strong>
                        <span style={{ fontSize: '0.68rem', color: '#94a3b8', display: 'block' }}>{sec.name}</span>
                      </div>
                      <strong style={{ fontSize: '0.95rem', color: color }}>
                        {sec.expectedReturn > 0 ? `+${sec.expectedReturn}%` : `${sec.expectedReturn}%`}
                      </strong>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* CURATED HIGH-CONVICTION MACRO THEMES & BASKETS */}
          <div>
            <h3 style={{ margin: '0 0 1rem 0', color: 'white', fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Briefcase size={20} color="#4facfe" /> Curated Macro Trade Baskets (1-Click Execution)
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
              
              {/* Basket 1: Reflationary Cyclical Expansion (Active Macro Regime) */}
              <div className="glass-card" style={{ 
                padding: '1.25rem', 
                borderTop: '3px solid #f59e0b',
                background: activeRegime.id === 'REFLATION' ? 'rgba(245, 158, 11, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                boxShadow: activeRegime.id === 'REFLATION' ? '0 0 15px rgba(245, 158, 11, 0.15)' : 'none'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <strong style={{ color: '#fbbf24', fontSize: '0.95rem' }}>
                    1. Reflationary Boom (Growth↑, Yields/Inflation↑)
                  </strong>
                  <span style={{ fontSize: '0.68rem', background: 'rgba(245, 158, 11, 0.25)', color: '#fbbf24', padding: '1px 6px', borderRadius: '4px', fontWeight: '800', border: '1px solid rgba(245, 158, 11, 0.4)' }}>
                    ACTIVE REGIME
                  </span>
                </div>
                <p style={{ fontSize: '0.78rem', color: '#cbd5e1', margin: '0 0 0.85rem 0', lineHeight: '1.4' }}>
                  When GDP growth and inflation/yields accelerate together, capital shifts into cyclicals, industrials, energy cash flows, and asset-sensitive banks.
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {['XOM', 'CVX', 'COP', 'JPM', 'CAT', 'DE', 'PWR', 'ETN', 'FCX'].map(ticker => (
                    <span 
                      key={ticker}
                      onClick={() => onTickerClick && onTickerClick(ticker)}
                      style={{
                        fontSize: '0.78rem',
                        background: 'rgba(245, 158, 11, 0.15)',
                        border: '1px solid rgba(245, 158, 11, 0.35)',
                        color: '#fde68a',
                        padding: '0.25rem 0.55rem',
                        borderRadius: '6px',
                        fontWeight: '700',
                        cursor: 'pointer'
                      }}
                      title={`Inspect ${ticker}`}
                    >
                      {ticker}
                    </span>
                  ))}
                </div>
              </div>

              {/* Basket 2: Falling Yields / Growth Beta */}
              <div className="glass-card" style={{ padding: '1.25rem', borderTop: '3px solid #10b981' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <strong style={{ color: '#34d399', fontSize: '0.95rem' }}>
                    2. Falling Yields & Multiple Expansion
                  </strong>
                  <span style={{ fontSize: '0.68rem', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '1px 6px', borderRadius: '4px', fontWeight: '700' }}>
                    GROWTH BETA
                  </span>
                </div>
                <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: '0 0 0.85rem 0', lineHeight: '1.4' }}>
                  When bond yields ease, long-duration discount rates drop, triggering sharp multiple expansion for hyper-growth technology and semiconductors.
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {['NVDA', 'AAPL', 'MSFT', 'AMZN', 'HD', 'SHW', 'NEE'].map(ticker => (
                    <span 
                      key={ticker}
                      onClick={() => onTickerClick && onTickerClick(ticker)}
                      style={{
                        fontSize: '0.78rem',
                        background: 'rgba(16, 185, 129, 0.12)',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        color: '#34d399',
                        padding: '0.25rem 0.55rem',
                        borderRadius: '6px',
                        fontWeight: '700',
                        cursor: 'pointer'
                      }}
                      title={`Inspect ${ticker}`}
                    >
                      {ticker}
                    </span>
                  ))}
                </div>
              </div>

              {/* Basket 3: Soft Dollar & Global Liquidity */}
              <div className="glass-card" style={{ padding: '1.25rem', borderTop: '3px solid #06b6d4' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <strong style={{ color: '#22d3ee', fontSize: '0.95rem' }}>
                    3. Soft Dollar (DXY) & Global Liquidity
                  </strong>
                  <span style={{ fontSize: '0.68rem', background: 'rgba(6, 182, 212, 0.15)', color: '#22d3ee', padding: '1px 6px', borderRadius: '4px', fontWeight: '700' }}>
                    DEBASEMENT
                  </span>
                </div>
                <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: '0 0 0.85rem 0', lineHeight: '1.4' }}>
                  A falling US Dollar reduces foreign exchange headwinds for multinationals and unleashes capital into hard assets, gold, and digital liquidity.
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {['NEM', 'FCX', 'TSLA', 'ORCL', 'COIN', 'PLTR'].map(ticker => (
                    <span 
                      key={ticker}
                      onClick={() => onTickerClick && onTickerClick(ticker)}
                      style={{
                        fontSize: '0.78rem',
                        background: 'rgba(6, 182, 212, 0.12)',
                        border: '1px solid rgba(6, 182, 212, 0.3)',
                        color: '#22d3ee',
                        padding: '0.25rem 0.55rem',
                        borderRadius: '6px',
                        fontWeight: '700',
                        cursor: 'pointer'
                      }}
                      title={`Inspect ${ticker}`}
                    >
                      {ticker}
                    </span>
                  ))}
                </div>
              </div>

              {/* Basket 4: High VIX Fortress & Defensive Stability */}
              <div className="glass-card" style={{ padding: '1.25rem', borderTop: '3px solid #a855f7' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <strong style={{ color: '#c084fc', fontSize: '0.95rem' }}>
                    4. Volatility Fortress (High VIX Defense)
                  </strong>
                  <span style={{ fontSize: '0.68rem', background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', padding: '1px 6px', borderRadius: '4px', fontWeight: '700' }}>
                    CAPITAL PRESERV.
                  </span>
                </div>
                <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: '0 0 0.85rem 0', lineHeight: '1.4' }}>
                  When market volatility spikes above 20, capital flees speculative momentum and parks in inelastic consumer demand and balance-sheet fortresses.
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {['LLY', 'UNH', 'COST', 'WMT', 'PG', 'JNJ', 'KO'].map(ticker => (
                    <span 
                      key={ticker}
                      onClick={() => onTickerClick && onTickerClick(ticker)}
                      style={{
                        fontSize: '0.78rem',
                        background: 'rgba(168, 85, 247, 0.12)',
                        border: '1px solid rgba(168, 85, 247, 0.3)',
                        color: '#c084fc',
                        padding: '0.25rem 0.55rem',
                        borderRadius: '6px',
                        fontWeight: '700',
                        cursor: 'pointer'
                      }}
                      title={`Inspect ${ticker}`}
                    >
                      {ticker}
                    </span>
                  ))}
                </div>
              </div>

            </div>
          </div>

        </div>
      )}

      {/* 4. DRIVER PLAYBOOK (DEFAULT VIEW FOR SPECIFIC DRIVER) */}
      {activeTab !== 'overview' && activeTab !== 'heatmap' && activeTab !== 'sensitivities' && currentScenario && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Transmission Mechanism Banner */}
          <div className="glass-card" style={{ 
            padding: '1.25rem 1.5rem', 
            background: 'rgba(59, 130, 246, 0.08)', 
            border: '1px solid rgba(59, 130, 246, 0.25)',
            borderRadius: '8px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
              <Info size={16} color="#60a5fa" />
              <strong style={{ color: '#60a5fa', fontSize: '0.88rem' }}>
                How {currentScenario.full_name} Impacts Equity Markets:
              </strong>
            </div>
            <p style={{ margin: 0, color: '#cbd5e1', fontSize: '0.86rem', lineHeight: '1.5' }}>
              {currentScenario.transmission}
            </p>
          </div>

          {/* TWO-WAY PLAYBOOK GRID */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '1.5rem' }}>
            
            {/* BULL CASE (IF DRIVER GOES UP) */}
            <div className="glass-card" style={{ padding: '1.5rem', borderTop: '4px solid #10b981' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0, color: '#34d399', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.15rem' }}>
                  <TrendingUp size={20} /> If {currentScenario.driver} Rallies ↗️
                </h3>
                <span style={{ 
                  fontSize: '0.7rem', 
                  fontWeight: '700', 
                  background: 'rgba(16, 185, 129, 0.15)', 
                  color: '#10b981', 
                  padding: '0.2rem 0.5rem', 
                  borderRadius: '4px' 
                }}>
                  EXPANSION BENEFICIARIES
                </span>
              </div>

              <p style={{ color: '#94a3b8', fontSize: '0.84rem', margin: '0 0 1.25rem 0', lineHeight: '1.4' }}>
                {currentScenario.if_up?.narrative}
              </p>

              {/* Winning Sectors */}
              <div style={{ marginBottom: '1.25rem' }}>
                <span style={{ fontSize: '0.72rem', color: '#6ee7b7', fontWeight: '700', textTransform: 'uppercase', display: 'block', marginBottom: '0.5rem' }}>
                  Favored Sector Rotations:
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {currentScenario.if_up?.favored_sectors?.map((sec, idx) => (
                    <div key={idx} style={{ 
                      background: 'rgba(16, 185, 129, 0.08)', 
                      border: '1px solid rgba(16, 185, 129, 0.2)', 
                      padding: '0.5rem 0.75rem', 
                      borderRadius: '6px',
                      fontSize: '0.8rem'
                    }}>
                      <strong style={{ color: '#34d399' }}>{sec.sector}: </strong>
                      <span style={{ color: '#cbd5e1' }}>{sec.reason}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Positively Correlated Stocks */}
              <div style={{ marginBottom: '1.25rem' }}>
                <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', display: 'block', marginBottom: '0.5rem' }}>
                  Top Positive Correlation Stocks (Buy Candidates):
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '0.5rem' }}>
                  {currentScenario.if_up?.winning_stocks?.map(stock => (
                    <div 
                      key={stock.ticker}
                      onClick={() => onTickerClick && onTickerClick(stock.ticker)}
                      style={{
                        background: 'rgba(16, 185, 129, 0.1)',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        padding: '0.45rem 0.6rem',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                      title={`Click to inspect ${stock.ticker} chart`}
                    >
                      <div>
                        <strong style={{ color: 'white', fontSize: '0.85rem' }}>{stock.ticker}</strong>
                        <span style={{ fontSize: '0.68rem', color: '#94a3b8', display: 'block' }}>${stock.price}</span>
                      </div>
                      <span style={{ fontSize: '0.72rem', fontWeight: '700', color: '#10b981' }}>
                        +{stock.corr}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* At-Risk Stocks */}
              {currentScenario.if_up?.at_risk_stocks?.length > 0 && (
                <div>
                  <span style={{ fontSize: '0.72rem', color: '#f87171', fontWeight: '700', textTransform: 'uppercase', display: 'block', marginBottom: '0.5rem' }}>
                    Suffer Most When {currentScenario.driver} Surges (Avoid / Short):
                  </span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                    {currentScenario.if_up.at_risk_stocks.slice(0, 6).map(stock => (
                      <span 
                        key={stock.ticker}
                        onClick={() => onTickerClick && onTickerClick(stock.ticker)}
                        style={{
                          fontSize: '0.74rem',
                          background: 'rgba(239, 68, 68, 0.1)',
                          border: '1px solid rgba(239, 68, 68, 0.25)',
                          color: '#f87171',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
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

            {/* BEAR CASE (IF DRIVER GOES DOWN) */}
            <div className="glass-card" style={{ padding: '1.5rem', borderTop: '4px solid #3b82f6' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0, color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '115rem' }}>
                  <TrendingDown size={20} /> If {currentScenario.driver} Pulls Back ↘️
                </h3>
                <span style={{ 
                  fontSize: '0.7rem', 
                  fontWeight: '700', 
                  background: 'rgba(59, 130, 246, 0.15)', 
                  color: '#60a5fa', 
                  padding: '0.2rem 0.5rem', 
                  borderRadius: '4px' 
                }}>
                  RELIEF BENEFICIARIES
                </span>
              </div>

              <p style={{ color: '#94a3b8', fontSize: '0.84rem', margin: '0 0 1.25rem 0', lineHeight: '1.4' }}>
                {currentScenario.if_down?.narrative}
              </p>

              {/* Winning Sectors */}
              <div style={{ marginBottom: '1.25rem' }}>
                <span style={{ fontSize: '0.72rem', color: '#93c5fd', fontWeight: '700', textTransform: 'uppercase', display: 'block', marginBottom: '0.5rem' }}>
                  Favored Sector Rotations:
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {currentScenario.if_down?.favored_sectors?.map((sec, idx) => (
                    <div key={idx} style={{ 
                      background: 'rgba(59, 130, 246, 0.08)', 
                      border: '1px solid rgba(59, 130, 246, 0.2)', 
                      padding: '0.5rem 0.75rem', 
                      borderRadius: '6px',
                      fontSize: '0.8rem'
                    }}>
                      <strong style={{ color: '#60a5fa' }}>{sec.sector}: </strong>
                      <span style={{ color: '#cbd5e1' }}>{sec.reason}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Inversely Correlated Stocks */}
              <div style={{ marginBottom: '1.25rem' }}>
                <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', display: 'block', marginBottom: '0.5rem' }}>
                  Top Inverse Correlation Stocks (Buy on Driver Dips):
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '0.5rem' }}>
                  {currentScenario.if_down?.winning_stocks?.map(stock => (
                    <div 
                      key={stock.ticker}
                      onClick={() => onTickerClick && onTickerClick(stock.ticker)}
                      style={{
                        background: 'rgba(59, 130, 246, 0.1)',
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                        padding: '0.45rem 0.6rem',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                      title={`Click to inspect ${stock.ticker} chart`}
                    >
                      <div>
                        <strong style={{ color: 'white', fontSize: '0.85rem' }}>{stock.ticker}</strong>
                        <span style={{ fontSize: '0.68rem', color: '#94a3b8', display: 'block' }}>${stock.price}</span>
                      </div>
                      <span style={{ fontSize: '0.72rem', fontWeight: '700', color: '#60a5fa' }}>
                        {stock.corr}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* At-Risk Stocks when driver falls */}
              {currentScenario.if_down?.at_risk_stocks?.length > 0 && (
                <div>
                  <span style={{ fontSize: '0.72rem', color: '#f87171', fontWeight: '700', textTransform: 'uppercase', display: 'block', marginBottom: '0.5rem' }}>
                    Suffer Most When {currentScenario.driver} Drops (Avoid / Short):
                  </span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                    {currentScenario.if_down.at_risk_stocks.slice(0, 6).map(stock => (
                      <span 
                        key={stock.ticker}
                        onClick={() => onTickerClick && onTickerClick(stock.ticker)}
                        style={{
                          fontSize: '0.74rem',
                          background: 'rgba(239, 68, 68, 0.1)',
                          border: '1px solid rgba(239, 68, 68, 0.25)',
                          color: '#f87171',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        {stock.ticker} (+{stock.corr})
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
        <div className="glass-card" style={{ padding: '1.5rem', borderTop: '4px solid #f59e0b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h3 style={{ margin: '0 0 0.25rem 0', color: '#fbbf24', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Layers size={20} /> 90-Day Cross-Asset Correlation Heatmap Matrix
              </h3>
              <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                Pairwise daily return correlations between S&P 500, Nasdaq, Macro Drivers, and Key Industry Sectors.
              </span>
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.72rem' }}>
              <span style={{ color: '#94a3b8' }}>Strong Neg (-1.0)</span>
              <div style={{ width: '14px', height: '14px', background: '#ef4444', borderRadius: '3px' }}></div>
              <div style={{ width: '14px', height: '14px', background: 'rgba(239, 68, 68, 0.4)', borderRadius: '3px' }}></div>
              <div style={{ width: '14px', height: '14px', background: 'rgba(100, 116, 139, 0.3)', borderRadius: '3px' }}></div>
              <div style={{ width: '14px', height: '14px', background: 'rgba(16, 185, 129, 0.4)', borderRadius: '3px' }}></div>
              <div style={{ width: '14px', height: '14px', background: '#10b981', borderRadius: '3px' }}></div>
              <span style={{ color: '#94a3b8' }}>Strong Pos (+1.0)</span>
            </div>
          </div>

          {/* Responsive Scrollable Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'center' }}>
              <thead>
                <tr>
                  <th style={{ padding: '0.5rem', textAlign: 'left', color: '#cbd5e1', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    Asset
                  </th>
                  {crossMatrix.assets.map(a => (
                    <th key={a.symbol} style={{ padding: '0.5rem 0.25rem', color: '#cbd5e1', borderBottom: '1px solid rgba(255,255,255,0.1)', whiteSpace: 'nowrap' }}>
                      {a.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {crossMatrix.assets.map(rowAsset => (
                  <tr key={rowAsset.symbol} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <td style={{ padding: '0.45rem 0.6rem', textAlign: 'left', fontWeight: '700', color: 'white', whiteSpace: 'nowrap' }}>
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
                        if (val >= 0.7) { bg = 'rgba(16, 185, 129, 0.45)'; color = '#6ee7b7'; }
                        else if (val >= 0.35) { bg = 'rgba(16, 185, 129, 0.2)'; color = '#34d399'; }
                        else if (val <= -0.5) { bg = 'rgba(239, 68, 68, 0.45)'; color = '#fca5a5'; }
                        else if (val <= -0.25) { bg = 'rgba(239, 68, 68, 0.2)'; color = '#f87171'; }
                        else { bg = 'rgba(255,255,255,0.02)'; color = '#94a3b8'; }
                      }

                      return (
                        <td 
                          key={colAsset.symbol}
                          style={{
                            padding: '0.4rem 0.25rem',
                            background: bg,
                            color: color,
                            fontWeight: isSelf ? '400' : '700',
                            border: '1px solid rgba(255,255,255,0.02)'
                          }}
                          title={`${rowAsset.label} vs ${colAsset.label}: ${val}`}
                        >
                          {isSelf ? '1.0' : (val !== undefined && val !== null ? (val > 0 ? `+${val}` : `${val}`) : '-')}
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
      {activeTab === 'sensitivities' && sectorSensitivities.length > 0 && (
        <div className="glass-card" style={{ padding: '1.5rem', borderTop: '4px solid #06b6d4' }}>
          <div style={{ marginBottom: '1.25rem' }}>
            <h3 style={{ margin: '0 0 0.25rem 0', color: '#22d3ee', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <BarChart2 size={20} /> SPDR Sector Macro Sensitivity Rankings
            </h3>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
              Identifies which sectors are most responsive to swings in 10-Yr Yields, US Dollar, Crude Oil, and Gold.
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                  <th style={{ padding: '0.75rem', textAlign: 'left' }}>Sector ETF</th>
                  <th style={{ padding: '0.75rem', textAlign: 'center' }}>10-Yr Yield Sensitivity</th>
                  <th style={{ padding: '0.75rem', textAlign: 'center' }}>US Dollar (DXY)</th>
                  <th style={{ padding: '0.75rem', textAlign: 'center' }}>Crude Oil</th>
                  <th style={{ padding: '0.75rem', textAlign: 'center' }}>Gold</th>
                  <th style={{ padding: '0.75rem', textAlign: 'center' }}>S&P 500 Correlation</th>
                </tr>
              </thead>
              <tbody>
                {sectorSensitivities.map(sec => {
                  const tnxColor = sec.corr_tnx > 0.2 ? '#10b981' : sec.corr_tnx < -0.2 ? '#ef4444' : '#94a3b8';
                  const dxyColor = sec.corr_dxy > 0.2 ? '#10b981' : sec.corr_dxy < -0.2 ? '#ef4444' : '#94a3b8';
                  const oilColor = sec.corr_oil > 0.2 ? '#10b981' : sec.corr_oil < -0.2 ? '#ef4444' : '#94a3b8';
                  const goldColor = sec.corr_gold > 0.2 ? '#10b981' : sec.corr_gold < -0.2 ? '#ef4444' : '#94a3b8';

                  return (
                    <tr 
                      key={sec.symbol} 
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', transition: 'background 0.15s' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '0.75rem', fontWeight: '700', color: 'white' }}>
                        <span style={{ color: '#06b6d4', marginRight: '0.5rem' }}>{sec.symbol}</span>
                        {sec.name}
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'center', fontWeight: '700', color: tnxColor }}>
                        {sec.corr_tnx > 0 ? `+${sec.corr_tnx}` : sec.corr_tnx}
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'center', fontWeight: '700', color: dxyColor }}>
                        {sec.corr_dxy > 0 ? `+${sec.corr_dxy}` : sec.corr_dxy}
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'center', fontWeight: '700', color: oilColor }}>
                        {sec.corr_oil > 0 ? `+${sec.corr_oil}` : sec.corr_oil}
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'center', fontWeight: '700', color: goldColor }}>
                        {sec.corr_gold > 0 ? `+${sec.corr_gold}` : sec.corr_gold}
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'center', fontWeight: '700', color: '#60a5fa' }}>
                        +{sec.corr_spy}
                      </td>
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
