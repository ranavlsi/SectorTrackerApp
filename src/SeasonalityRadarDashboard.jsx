import React, { useState, useEffect, useMemo } from 'react';
import { 
  Compass, 
  Flame, 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  CheckCircle, 
  AlertTriangle, 
  Zap, 
  BarChart2, 
  Calendar, 
  Search, 
  ArrowUpRight, 
  ArrowDownRight,
  Filter,
  ShieldAlert,
  Sun,
  Snowflake,
  RefreshCw
} from 'lucide-react';

export default function SeasonalityRadarDashboard({ data, onTickerClick }) {
  const [localData, setLocalData] = useState(data);
  const [loading, setLoading] = useState(!data);
  const [isScanning, setIsScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState('');
  const [activeCategory, setActiveCategory] = useState('all'); // 'all', 'breakouts', 'upcoming', 'options', 'traps'
  const [searchQuery, setSearchQuery] = useState('');
  const [minScore, setMinScore] = useState(0); // 0 = all
  const [showAllCandidates, setShowAllCandidates] = useState(false);

  // Auto-fetch data if parent didn't provide it yet
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
        const res = await fetch('/seasonality_results.json?t=' + Date.now());
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (isMounted) {
          setLocalData(json);
          setLoading(false);
        }
      } catch (err) {
        console.warn('Direct JSON fetch failed, attempting API endpoint:', err);
        try {
          const apiRes = await fetch('/api/seasonality_radar');
          if (!apiRes.ok) throw new Error(`API HTTP ${apiRes.status}`);
          const apiJson = await apiRes.json();
          if (isMounted) {
            setLocalData(apiJson);
            setLoading(false);
          }
        } catch (apiErr) {
          console.error('All seasonality fetches failed:', apiErr);
          if (isMounted) setLoading(false);
        }
      }
    };

    loadData();
    return () => { isMounted = false; };
  }, [data]);

  // Handle manual on-demand re-scan
  const handleRescan = async () => {
    setIsScanning(true);
    setScanMessage('Running 10-year monthly cyclical scan & options sweep on 76 tickers...');
    try {
      const res = await fetch('/api/seasonality_radar?refresh=1', { method: 'POST' });
      if (!res.ok) throw new Error(`Scanner error HTTP ${res.status}`);
      const freshData = await res.json();
      setLocalData(freshData);
      setScanMessage('Scan complete! Fresh seasonality intelligence loaded.');
      setTimeout(() => setScanMessage(''), 4000);
    } catch (err) {
      console.error('Re-scan error:', err);
      // Fallback reload
      try {
        const res = await fetch('/seasonality_results.json?t=' + Date.now());
        const json = await res.json();
        setLocalData(json);
        setScanMessage('Loaded latest cached scan results.');
        setTimeout(() => setScanMessage(''), 4000);
      } catch (e) {
        setScanMessage('Failed to run scan: ' + err.message);
        setTimeout(() => setScanMessage(''), 5000);
      }
    } finally {
      setIsScanning(false);
    }
  };

  const currentMonth = localData?.current_month || 'Sep';
  const nextMonth = localData?.next_month || 'Oct';

  // Extract category lists from data
  const topPicks = useMemo(() => {
    if (!localData) return [];
    if (showAllCandidates && localData.all_candidates) return localData.all_candidates;
    return localData.top_picks || localData.all_candidates?.slice(0, 25) || [];
  }, [localData, showAllCandidates]);

  const allCandidatesCount = localData?.all_candidates?.length || localData?.top_picks?.length || 0;
  const breakoutLeaders = useMemo(() => localData?.seasonal_breakout_leaders || [], [localData]);
  const upcomingTailwinds = useMemo(() => localData?.upcoming_monthly_tailwinds || [], [localData]);
  const optionsBacked = useMemo(() => localData?.options_backed_sweeps || [], [localData]);
  const seasonalTraps = useMemo(() => localData?.seasonal_traps_warning || [], [localData]);

  // Determine current active list
  const currentList = useMemo(() => {
    let list = [];
    if (activeCategory === 'all') list = topPicks;
    else if (activeCategory === 'breakouts') list = breakoutLeaders;
    else if (activeCategory === 'upcoming') list = upcomingTailwinds;
    else if (activeCategory === 'options') list = optionsBacked;
    else if (activeCategory === 'traps') list = seasonalTraps;

    return list.filter(item => {
      const matchSearch = !searchQuery || item.ticker?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchScore = activeCategory === 'traps' ? true : (item.score >= minScore);
      return matchSearch && matchScore;
    });
  }, [activeCategory, topPicks, breakoutLeaders, upcomingTailwinds, optionsBacked, seasonalTraps, searchQuery, minScore]);

  if (loading && !localData) {
    return (
      <div className="glass-card" style={{ padding: '4rem 2rem', textAlign: 'center', color: '#94a3b8' }}>
        <Compass size={44} className="animate-spin" style={{ color: '#06b6d4', margin: '0 auto 1.25rem auto' }} />
        <h3 style={{ color: 'white', margin: '0 0 0.5rem 0', fontSize: '1.4rem' }}>
          Loading Seasonality Radar Intelligence...
        </h3>
        <p style={{ maxWidth: '500px', margin: '0 auto', fontSize: '0.9rem', lineHeight: '1.5' }}>
          Analyzing 10-year monthly win-rates, moving average trend alignments, and real-time options order flows across 76 momentum leaders.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* HEADER BANNER */}
      <div className="glass-card" style={{ 
        padding: '1.5rem 2rem', 
        background: 'linear-gradient(135deg, rgba(15,23,42,0.92) 0%, rgba(6,182,212,0.12) 100%)',
        borderLeft: '5px solid #06b6d4'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem' }}>
              <div style={{ 
                background: 'rgba(6, 182, 212, 0.2)', 
                padding: '0.55rem', 
                borderRadius: '10px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                border: '1px solid rgba(6, 182, 212, 0.4)' 
              }}>
                <Compass size={28} color="#22d3ee" />
              </div>
              <div>
                <h1 style={{ margin: 0, fontSize: '1.8rem', color: 'white', fontWeight: '800', letterSpacing: '-0.5px' }}>
                  Seasonality Power Radar
                </h1>
                <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                  Triple-Confluence Screener: 10-Year Monthly Cycles × Moving Average Trends × Real-Time Options Sentiment
                </span>
              </div>
            </div>
            {localData?.last_updated && (
              <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                Last Synced: {localData.last_updated} • Universe: {allCandidatesCount} High-Liquidity Stocks
              </span>
            )}
          </div>

          {/* Action & Macro Metrics */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <button
              onClick={handleRescan}
              disabled={isScanning}
              style={{
                padding: '0.6rem 1.1rem',
                borderRadius: '8px',
                background: isScanning ? 'rgba(6, 182, 212, 0.15)' : 'linear-gradient(135deg, #06b6d4 0%, #0284c7 100%)',
                color: 'white',
                border: '1px solid rgba(6, 182, 212, 0.4)',
                fontWeight: '700',
                fontSize: '0.82rem',
                cursor: isScanning ? 'wait' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                boxShadow: '0 4px 12px rgba(6, 182, 212, 0.2)'
              }}
            >
              <RefreshCw size={15} className={isScanning ? 'animate-spin' : ''} />
              {isScanning ? 'Scanning Universe...' : 'Re-scan Radar'}
            </button>

            <div style={{ 
              background: 'rgba(0,0,0,0.35)', 
              border: '1px solid rgba(255,255,255,0.08)', 
              padding: '0.55rem 0.9rem', 
              borderRadius: '8px',
              textAlign: 'center'
            }}>
              <span style={{ fontSize: '0.68rem', color: '#94a3b8', display: 'block', textTransform: 'uppercase' }}>Cycle</span>
              <strong style={{ color: '#22d3ee', fontSize: '1rem' }}>{currentMonth} ➔ {nextMonth}</strong>
            </div>

            <div style={{ 
              background: 'rgba(16, 185, 129, 0.1)', 
              border: '1px solid rgba(16, 185, 129, 0.25)', 
              padding: '0.55rem 0.9rem', 
              borderRadius: '8px',
              textAlign: 'center'
            }}>
              <span style={{ fontSize: '0.68rem', color: '#6ee7b7', display: 'block', textTransform: 'uppercase' }}>Leaders</span>
              <strong style={{ color: '#10b981', fontSize: '1rem' }}>{topPicks.length} Identified</strong>
            </div>

            <div style={{ 
              background: 'rgba(239, 68, 68, 0.1)', 
              border: '1px solid rgba(239, 68, 68, 0.25)', 
              padding: '0.55rem 0.9rem', 
              borderRadius: '8px',
              textAlign: 'center'
            }}>
              <span style={{ fontSize: '0.68rem', color: '#fca5a5', display: 'block', textTransform: 'uppercase' }}>Traps Warning</span>
              <strong style={{ color: '#ef4444', fontSize: '1rem' }}>{seasonalTraps.length} Avoid</strong>
            </div>
          </div>
        </div>

        {scanMessage && (
          <div style={{ 
            marginTop: '0.85rem', 
            padding: '0.5rem 0.8rem', 
            background: 'rgba(6, 182, 212, 0.15)', 
            border: '1px solid rgba(6, 182, 212, 0.3)', 
            borderRadius: '6px',
            fontSize: '0.78rem',
            color: '#67e8f9'
          }}>
            {scanMessage}
          </div>
        )}

        {/* SUBNAV / CATEGORY TABS & CONTROLS */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginTop: '1.25rem', 
          paddingTop: '1rem', 
          borderTop: '1px solid rgba(255,255,255,0.06)',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          {/* Category Tabs */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => setActiveCategory('all')}
              style={{
                padding: '0.45rem 0.85rem',
                borderRadius: '6px',
                border: `1px solid ${activeCategory === 'all' ? '#06b6d4' : 'rgba(255,255,255,0.08)'}`,
                background: activeCategory === 'all' ? 'rgba(6, 182, 212, 0.2)' : 'rgba(0,0,0,0.2)',
                color: activeCategory === 'all' ? '#22d3ee' : '#94a3b8',
                fontWeight: '600',
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}
            >
              <Flame size={15} /> All Confluence Leaders ({topPicks.length})
            </button>

            <button
              onClick={() => setActiveCategory('breakouts')}
              style={{
                padding: '0.45rem 0.85rem',
                borderRadius: '6px',
                border: `1px solid ${activeCategory === 'breakouts' ? '#10b981' : 'rgba(255,255,255,0.08)'}`,
                background: activeCategory === 'breakouts' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(0,0,0,0.2)',
                color: activeCategory === 'breakouts' ? '#34d399' : '#94a3b8',
                fontWeight: '600',
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}
            >
              <TrendingUp size={15} /> Seasonal Breakouts ({breakoutLeaders.length})
            </button>

            <button
              onClick={() => setActiveCategory('upcoming')}
              style={{
                padding: '0.45rem 0.85rem',
                borderRadius: '6px',
                border: `1px solid ${activeCategory === 'upcoming' ? '#3b82f6' : 'rgba(255,255,255,0.08)'}`,
                background: activeCategory === 'upcoming' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(0,0,0,0.2)',
                color: activeCategory === 'upcoming' ? '#60a5fa' : '#94a3b8',
                fontWeight: '600',
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}
            >
              <Calendar size={15} /> Upcoming {nextMonth} Tailwinds ({upcomingTailwinds.length})
            </button>

            <button
              onClick={() => setActiveCategory('options')}
              style={{
                padding: '0.45rem 0.85rem',
                borderRadius: '6px',
                border: `1px solid ${activeCategory === 'options' ? '#f59e0b' : 'rgba(255,255,255,0.08)'}`,
                background: activeCategory === 'options' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(0,0,0,0.2)',
                color: activeCategory === 'options' ? '#fbbf24' : '#94a3b8',
                fontWeight: '600',
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}
            >
              <Zap size={15} /> Options-Backed Sweeps ({optionsBacked.length})
            </button>

            <button
              onClick={() => setActiveCategory('traps')}
              style={{
                padding: '0.45rem 0.85rem',
                borderRadius: '6px',
                border: `1px solid ${activeCategory === 'traps' ? '#ef4444' : 'rgba(255,255,255,0.08)'}`,
                background: activeCategory === 'traps' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(0,0,0,0.2)',
                color: activeCategory === 'traps' ? '#f87171' : '#94a3b8',
                fontWeight: '600',
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}
            >
              <ShieldAlert size={15} /> Seasonal Traps ({seasonalTraps.length})
            </button>
          </div>

          {/* Search, All toggle, & Min Score Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            {activeCategory === 'all' && (
              <button
                onClick={() => setShowAllCandidates(!showAllCandidates)}
                style={{
                  background: showAllCandidates ? 'rgba(6, 182, 212, 0.2)' : 'rgba(0,0,0,0.3)',
                  border: `1px solid ${showAllCandidates ? '#06b6d4' : 'rgba(255,255,255,0.1)'}`,
                  color: showAllCandidates ? '#22d3ee' : '#94a3b8',
                  padding: '0.35rem 0.65rem',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                {showAllCandidates ? `All ${allCandidatesCount} Stocks` : 'Top 25'}
              </button>
            )}

            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
              <input
                type="text"
                placeholder="Filter ticker..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '6px',
                  padding: '0.38rem 0.75rem 0.38rem 2rem',
                  color: 'white',
                  fontSize: '0.8rem',
                  width: '120px',
                  outline: 'none'
                }}
              />
            </div>

            {activeCategory !== 'traps' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: '#94a3b8' }}>
                <span>Min Score:</span>
                <select 
                  value={minScore} 
                  onChange={(e) => setMinScore(Number(e.target.value))}
                  style={{
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '6px',
                    padding: '0.35rem 0.5rem',
                    color: '#22d3ee',
                    fontSize: '0.8rem',
                    outline: 'none'
                  }}
                >
                  <option value="0">All Setups</option>
                  <option value="50">50+</option>
                  <option value="60">60+</option>
                  <option value="70">70+ (A+ Quality)</option>
                  <option value="75">75+ (Elite)</option>
                </select>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* STOCKS GRID */}
      {currentList.length === 0 ? (
        <div className="glass-card" style={{ padding: '3.5rem 2rem', textAlign: 'center', color: '#64748b' }}>
          <Compass size={32} style={{ color: '#475569', margin: '0 auto 0.75rem auto' }} />
          <p style={{ margin: 0, fontSize: '1rem', color: '#94a3b8' }}>No tickers matched your active filter criteria.</p>
          <span style={{ fontSize: '0.8rem', marginTop: '0.5rem', display: 'block' }}>
            Try setting Min Score to "All Setups" or clearing your search term.
          </span>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: '1.25rem' }}>
          {currentList.map((item) => {
            const scoreColor = item.score >= 75 ? '#10b981' : item.score >= 65 ? '#3b82f6' : item.score >= 50 ? '#f59e0b' : '#ef4444';
            const tech = item.technicals || {};
            const seas = item.seasonality || {};
            const opt = item.options || {};
            const isTrap = activeCategory === 'traps' || (seas.cur_month_win < 40 && seas.cur_month_avg < 0);

            return (
              <div 
                key={item.ticker}
                className="glass-card"
                style={{ 
                  padding: '1.25rem', 
                  borderRadius: '10px',
                  borderTop: `3px solid ${isTrap ? '#ef4444' : item.badge_color || scoreColor}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.9rem',
                  transition: 'transform 0.15s ease, border-color 0.15s ease'
                }}
              >
                {/* CARD TOP BAR */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <span 
                        onClick={() => onTickerClick && onTickerClick(item.ticker)}
                        style={{ 
                          fontSize: '1.4rem', 
                          fontWeight: '800', 
                          color: 'white', 
                          cursor: 'pointer',
                          textDecoration: 'underline',
                          textDecorationColor: 'rgba(255,255,255,0.2)'
                        }}
                        title="Click to inspect chart & full analytics"
                      >
                        {item.ticker}
                      </span>
                      <span style={{ fontSize: '1.05rem', color: '#cbd5e1' }}>
                        ${Number(item.current_price || 0).toFixed(2)}
                      </span>
                    </div>

                    <div style={{ marginTop: '0.25rem' }}>
                      <span style={{ 
                        fontSize: '0.68rem', 
                        fontWeight: '700', 
                        padding: '0.2rem 0.5rem', 
                        borderRadius: '4px',
                        background: `${item.badge_color || scoreColor}22`,
                        color: item.badge_color || scoreColor,
                        border: `1px solid ${item.badge_color || scoreColor}55`
                      }}>
                        {item.setup_label}
                      </span>
                    </div>
                  </div>

                  {/* SCORE BADGE */}
                  <div style={{ 
                    textAlign: 'right', 
                    background: 'rgba(0,0,0,0.3)', 
                    padding: '0.4rem 0.75rem', 
                    borderRadius: '8px', 
                    border: '1px solid rgba(255,255,255,0.06)' 
                  }}>
                    <span style={{ fontSize: '0.65rem', color: '#94a3b8', display: 'block', textTransform: 'uppercase' }}>Confluence</span>
                    <strong style={{ fontSize: '1.3rem', color: scoreColor }}>
                      {item.score} <span style={{ fontSize: '0.75rem', color: '#64748b' }}>/100</span>
                    </strong>
                  </div>
                </div>

                {/* 3-PILLAR CONFLUENCE STRIP */}
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: '1fr 1fr 1fr', 
                  gap: '0.5rem', 
                  background: 'rgba(0,0,0,0.2)', 
                  padding: '0.6rem', 
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.03)'
                }}>
                  {/* Seasonality */}
                  <div style={{ textAlign: 'center' }}>
                    <span style={{ fontSize: '0.68rem', color: '#94a3b8', display: 'block' }}>{currentMonth} Seasonality</span>
                    <strong style={{ 
                      fontSize: '0.85rem', 
                      color: (seas.cur_month_avg || 0) >= 0 ? '#10b981' : '#ef4444' 
                    }}>
                      {(seas.cur_month_avg || 0) > 0 ? '+' : ''}{seas.cur_month_avg || 0}%
                    </strong>
                    <span style={{ fontSize: '0.68rem', color: '#64748b', display: 'block' }}>
                      {seas.cur_month_win || 0}% Win
                    </span>
                  </div>

                  {/* Technicals */}
                  <div style={{ textAlign: 'center', borderLeft: '1px solid rgba(255,255,255,0.05)', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                    <span style={{ fontSize: '0.68rem', color: '#94a3b8', display: 'block' }}>Trend Alignment</span>
                    <strong style={{ 
                      fontSize: '0.85rem', 
                      color: tech.bullish_alignment ? '#10b981' : tech.above_50 ? '#3b82f6' : '#f59e0b' 
                    }}>
                      {tech.bullish_alignment ? 'Stage 2 Bull' : tech.above_50 ? '> 50 SMA' : '> 200 SMA'}
                    </strong>
                    <span style={{ fontSize: '0.68rem', color: '#64748b', display: 'block' }}>
                      {tech.dist_52w_pct !== undefined ? `${tech.dist_52w_pct}% from 52W` : '-'}
                    </span>
                  </div>

                  {/* Options */}
                  <div style={{ textAlign: 'center' }}>
                    <span style={{ fontSize: '0.68rem', color: '#94a3b8', display: 'block' }}>Options Bias</span>
                    <strong style={{ 
                      fontSize: '0.85rem', 
                      color: opt.bullish_flow ? '#10b981' : (opt.pcr_vol > 1.2 ? '#ef4444' : '#94a3b8') 
                    }}>
                      {opt.bullish_flow ? 'Call Sweep' : `PCR ${opt.pcr_vol || opt.pcr_oi || 1.0}`}
                    </strong>
                    <span style={{ fontSize: '0.68rem', color: '#64748b', display: 'block' }}>
                      IV {opt.avg_iv || '-'}%
                    </span>
                  </div>
                </div>

                {/* 12-MONTH MINI HEATMAP STRIP */}
                {seas.monthly_12 && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                      <span style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <Calendar size={12} /> 10-Yr Monthly Cycles
                      </span>
                      {seas.next_month_name && (
                        <span style={{ fontSize: '0.7rem', color: '#60a5fa' }}>
                          Next ({seas.next_month_name}): <strong>{seas.next_month_avg > 0 ? '+' : ''}{seas.next_month_avg}% ({seas.next_month_win}%W)</strong>
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '3px' }}>
                      {seas.monthly_12.map((m) => {
                        const isCurrent = m.name === currentMonth;
                        const isNext = m.name === nextMonth;
                        const isPos = m.avg_return >= 0;
                        const bg = isCurrent 
                          ? 'rgba(6, 182, 212, 0.3)' 
                          : isNext 
                          ? 'rgba(59, 130, 246, 0.2)' 
                          : isPos 
                          ? 'rgba(16, 185, 129, 0.12)' 
                          : 'rgba(239, 68, 68, 0.12)';
                        
                        const border = isCurrent 
                          ? '1px solid #06b6d4' 
                          : isNext 
                          ? '1px solid #3b82f6' 
                          : '1px solid transparent';

                        return (
                          <div 
                            key={m.month}
                            title={`${m.name}: ${m.avg_return}% avg, ${m.win_rate}% win rate`}
                            style={{ 
                              background: bg,
                              border: border,
                              borderRadius: '4px',
                              padding: '0.3rem 1px',
                              textAlign: 'center',
                              fontSize: '0.62rem'
                            }}
                          >
                            <span style={{ color: isCurrent ? '#22d3ee' : isNext ? '#60a5fa' : '#94a3b8', fontWeight: '700', display: 'block' }}>
                              {m.name.charAt(0)}
                            </span>
                            <span style={{ 
                              color: isPos ? '#10b981' : '#ef4444', 
                              fontWeight: '600', 
                              display: 'block', 
                              fontSize: '0.58rem',
                              marginTop: '1px' 
                            }}>
                              {m.avg_return > 0 ? `+${Math.round(m.avg_return)}` : `${Math.round(m.avg_return)}`}%
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* BOTTOM ACTION & STATS */}
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  paddingTop: '0.45rem', 
                  borderTop: '1px solid rgba(255,255,255,0.04)',
                  fontSize: '0.74rem',
                  color: '#94a3b8'
                }}>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <span>ADR: <strong style={{ color: '#cbd5e1' }}>{tech.adr_pct}%</strong></span>
                    <span>Q4 Bias: <strong style={{ color: (seas.next_quarter_avg || 0) >= 0 ? '#10b981' : '#ef4444' }}>
                      {(seas.next_quarter_avg || 0) > 0 ? '+' : ''}{seas.next_quarter_avg}% ({seas.next_quarter_win}%)
                    </strong></span>
                  </div>

                  <button
                    onClick={() => onTickerClick && onTickerClick(item.ticker)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#06b6d4',
                      fontSize: '0.74rem',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.2rem',
                      padding: '0.2rem 0.4rem'
                    }}
                  >
                    Deep Dive <ArrowUpRight size={13} />
                  </button>
                </div>

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
