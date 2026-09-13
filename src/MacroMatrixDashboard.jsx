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
  HelpCircle
} from 'lucide-react';

export default function MacroMatrixDashboard({ data, onTickerClick }) {
  const [localData, setLocalData] = useState(data);
  const [loading, setLoading] = useState(!data);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState('');
  
  // Selected driver for deep-dive playbook ('10-Yr Yield', 'US Dollar (DXY)', 'Crude Oil', 'Gold', 'Bitcoin', 'VIX', 'heatmap', 'sensitivities')
  const [activeTab, setActiveTab] = useState('10-Yr Yield');
  const [heatmapFilter, setHeatmapFilter] = useState('all'); // 'all', 'macro', 'sectors'

  // Auto-fetch if parent did not provide data yet
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

  // Currently active scenario
  const currentScenario = useMemo(() => {
    return scenarios.find(s => s.driver.toLowerCase() === activeTab.toLowerCase()) || scenarios[0];
  }, [scenarios, activeTab]);

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
        background: 'linear-gradient(135deg, rgba(15,23,42,0.95) 0%, rgba(30,58,138,0.2) 100%)',
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
                Cross-Asset Regimes • Economic Transmission Mechanisms • Sector Rotation Playbooks
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {localData?.last_updated && (
              <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                Updated: {localData.last_updated}
              </span>
            )}
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              style={{
                padding: '0.55rem 1rem',
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

      {/* 2. ACTIVE MACRO REGIME BAROMETER */}
      {activeRegime.name && (
        <div className="glass-card" style={{ 
          padding: '1.5rem', 
          borderTop: '3px solid #10b981',
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.06) 0%, rgba(15, 23, 42, 0.8) 100%)' 
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '0.85rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                <Zap size={18} color="#10b981" />
                <span style={{ fontSize: '0.75rem', color: '#6ee7b7', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Detected Macro Regime
                </span>
              </div>
              <h2 style={{ margin: 0, fontSize: '1.45rem', color: 'white', fontWeight: '800' }}>
                {activeRegime.name}
              </h2>
            </div>

            <div style={{ 
              background: 'rgba(16, 185, 129, 0.15)', 
              border: '1px solid rgba(16, 185, 129, 0.3)', 
              padding: '0.4rem 0.85rem', 
              borderRadius: '8px', 
              textAlign: 'right' 
            }}>
              <span style={{ fontSize: '0.65rem', color: '#94a3b8', display: 'block', textTransform: 'uppercase' }}>Regime Confidence</span>
              <strong style={{ fontSize: '1.2rem', color: '#10b981' }}>
                {activeRegime.confidence}%
              </strong>
            </div>
          </div>

          <p style={{ color: '#cbd5e1', fontSize: '0.9rem', lineHeight: '1.5', margin: '0 0 1rem 0' }}>
            {activeRegime.description}
          </p>

          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
            gap: '1rem',
            background: 'rgba(0,0,0,0.25)',
            padding: '0.85rem 1.1rem',
            borderRadius: '8px',
            border: '1px solid rgba(255,255,255,0.04)'
          }}>
            <div>
              <span style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: '700', textTransform: 'uppercase', display: 'block', marginBottom: '0.4rem' }}>
                🚀 Overweight / Favored Sectors:
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {activeRegime.favored_sectors?.map((sec, i) => (
                  <span key={i} style={{ 
                    fontSize: '0.78rem', 
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

            <div>
              <span style={{ fontSize: '0.72rem', color: '#ef4444', fontWeight: '700', textTransform: 'uppercase', display: 'block', marginBottom: '0.4rem' }}>
                ⚠️ Underweight / Lagging Sectors:
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {activeRegime.unfavored_sectors?.map((sec, i) => (
                  <span key={i} style={{ 
                    fontSize: '0.78rem', 
                    background: 'rgba(239, 68, 68, 0.12)', 
                    color: '#f87171', 
                    padding: '0.2rem 0.6rem', 
                    borderRadius: '4px',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    fontWeight: '600'
                  }}>
                    {sec}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. SUBNAV TABS (DRIVERS & ANALYTICAL VIEWS) */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.75rem' }}>
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

      {/* 4. DRIVER PLAYBOOK (DEFAULT VIEW FOR SPECIFIC DRIVER) */}
      {activeTab !== 'heatmap' && activeTab !== 'sensitivities' && currentScenario && (
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
                <h3 style={{ margin: 0, color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.15rem' }}>
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

              {/* Inversely Correlated Stocks (Rally when driver falls) */}
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
