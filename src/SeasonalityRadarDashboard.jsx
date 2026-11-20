import React, { useState, useEffect, useMemo } from 'react';
import {
  Compass,
  Flame,
  TrendingUp,
  Calendar,
  Search,
  ArrowUpRight,
  ShieldAlert,
  Zap,
  RefreshCw,
  LayoutGrid,
  Table as TableIcon,
  Crosshair,
  BarChart2,
  ArrowUpDown,
  ChevronRight
} from 'lucide-react';

export default function SeasonalityRadarDashboard({ data, onTickerClick }) {
  const [localData, setLocalData] = useState(data);
  const [loading, setLoading] = useState(!data);
  const [isScanning, setIsScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState('');
  const [activeCategory, setActiveCategory] = useState('all'); // 'all' | 'breakouts' | 'upcoming' | 'options' | 'traps'
  const [searchQuery, setSearchQuery] = useState('');
  const [minScore, setMinScore] = useState(0);
  const [showAllCandidates, setShowAllCandidates] = useState(false);
  const [sortBy, setSortBy] = useState('score'); // 'score' | 'cur_ret' | 'cur_win' | 'next_ret' | 'pcr'
  const [viewMode, setViewMode] = useState('cards'); // 'cards' | 'table'
  const [radarHorizon, setRadarHorizon] = useState('current'); // 'current' | 'next'
  const [hoveredDot, setHoveredDot] = useState(null);
  const [activeSector, setActiveSector] = useState('ALL');
  const [expandedTicker, setExpandedTicker] = useState(null);

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

  const handleRescan = async () => {
    setIsScanning(true);
    setScanMessage('Running 10-year monthly cyclical scan & options sweep on universe...');
    try {
      const res = await fetch('/api/seasonality_radar?refresh=1', { method: 'POST' });
      if (!res.ok) throw new Error(`Scanner error HTTP ${res.status}`);
      const freshData = await res.json();
      setLocalData(freshData);
      setScanMessage('Scan complete! Fresh seasonality intelligence loaded.');
      setTimeout(() => setScanMessage(''), 4000);
    } catch (err) {
      console.error('Re-scan error:', err);
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

  const currentMonth = localData?.current_month || 'Nov';
  const nextMonth = localData?.next_month || 'Dec';

  const allUniverse = useMemo(() => {
    if (!localData) return [];
    return localData.all_candidates || localData.top_picks || [];
  }, [localData]);

  const topPicks = useMemo(() => {
    if (!localData) return [];
    if (showAllCandidates && localData.all_candidates) return localData.all_candidates;
    return localData.top_picks || localData.all_candidates?.slice(0, 25) || [];
  }, [localData, showAllCandidates]);

  const allCandidatesCount = allUniverse.length;
  const breakoutLeaders = useMemo(() => localData?.seasonal_breakout_leaders || [], [localData]);
  const upcomingTailwinds = useMemo(() => localData?.upcoming_monthly_tailwinds || [], [localData]);
  const optionsBacked = useMemo(() => localData?.options_backed_sweeps || [], [localData]);
  const seasonalTraps = useMemo(() => localData?.seasonal_traps_warning || [], [localData]);

  // Universe-wide 12-month breadth & average return strip
  const universeMonthlyBreadth = useMemo(() => {
    if (!allUniverse.length) return [];
    const monthBuckets = Array.from({ length: 12 }, (_, idx) => ({
      month: idx + 1,
      name: '',
      sumRet: 0,
      sumWin: 0,
      posCount: 0,
      count: 0
    }));
    allUniverse.forEach(item => {
      const m12 = item.seasonality?.monthly_12 || [];
      m12.forEach(m => {
        const b = monthBuckets[(m.month || 1) - 1];
        if (!b) return;
        b.name = b.name || m.name;
        b.sumRet += Number(m.avg_return || 0);
        b.sumWin += Number(m.win_rate || 0);
        if ((m.avg_return || 0) > 0) b.posCount += 1;
        b.count += 1;
      });
    });
    return monthBuckets.filter(b => b.count > 0).map(b => ({
      month: b.month,
      name: b.name,
      avgRet: Number((b.sumRet / b.count).toFixed(2)),
      avgWin: Math.round(b.sumWin / b.count),
      posPct: Math.round((b.posCount / b.count) * 100)
    }));
  }, [allUniverse]);

  // Universe summary stats
  const universeStats = useMemo(() => {
    if (!allUniverse.length) return { posCurPct: 0, avgCurRet: 0, stage2Count: 0 };
    let posCur = 0;
    let sumCur = 0;
    let stage2 = 0;
    allUniverse.forEach(item => {
      const r = Number(item.seasonality?.cur_month_avg || 0);
      if (r > 0) posCur += 1;
      sumCur += r;
      if (item.technicals?.bullish_alignment) stage2 += 1;
    });
    return {
      posCurPct: Math.round((posCur / allUniverse.length) * 100),
      avgCurRet: (sumCur / allUniverse.length).toFixed(2),
      stage2Count: stage2
    };
  }, [allUniverse]);

  // Sector Seasonal Rotation Breakdown across the universe
  const sectorBreakdown = useMemo(() => {
    const map = new Map();
    allUniverse.forEach(item => {
      const sec = item.sector || 'Other';
      if (!map.has(sec)) map.set(sec, { sector: sec, count: 0, sumCur: 0, sumNext: 0, sumWin: 0 });
      const b = map.get(sec);
      b.count += 1;
      b.sumCur += Number(item.seasonality?.cur_month_avg || 0);
      b.sumNext += Number(item.seasonality?.next_month_avg || 0);
      b.sumWin += Number(item.seasonality?.cur_month_win || 0);
    });
    return Array.from(map.values())
      .map(b => ({
        sector: b.sector,
        count: b.count,
        avgCur: Number((b.sumCur / b.count).toFixed(1)),
        avgNext: Number((b.sumNext / b.count).toFixed(1)),
        avgWin: Math.round(b.sumWin / b.count)
      }))
      .sort((a, b) => b.avgCur - a.avgCur);
  }, [allUniverse]);

  // Filtered & sorted list
  const currentList = useMemo(() => {
    let list = [];
    if (activeCategory === 'all') list = topPicks;
    else if (activeCategory === 'breakouts') list = breakoutLeaders;
    else if (activeCategory === 'upcoming') list = upcomingTailwinds;
    else if (activeCategory === 'options') list = optionsBacked;
    else if (activeCategory === 'traps') list = seasonalTraps;

    const filtered = list.filter(item => {
      const matchSearch = !searchQuery || item.ticker?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchScore = activeCategory === 'traps' ? true : (item.score >= minScore);
      const matchSector = activeSector === 'ALL' || (item.sector || 'Other') === activeSector;
      return matchSearch && matchScore && matchSector;
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === 'cur_ret') return (b.seasonality?.cur_month_avg || 0) - (a.seasonality?.cur_month_avg || 0);
      if (sortBy === 'cur_win') return (b.seasonality?.cur_month_win || 0) - (a.seasonality?.cur_month_win || 0);
      if (sortBy === 'next_ret') return (b.seasonality?.next_month_avg || 0) - (a.seasonality?.next_month_avg || 0);
      if (sortBy === 'pcr') return (a.options?.pcr_vol || 9) - (b.options?.pcr_vol || 9);
      return (b.score || 0) - (a.score || 0);
    });
  }, [activeCategory, topPicks, breakoutLeaders, upcomingTailwinds, optionsBacked, seasonalTraps, searchQuery, minScore, sortBy, activeSector]);

  // Radar scatter coordinates (Win Rate % vs Avg Return %)
  const radarPoints = useMemo(() => {
    const source = currentList.length > 0 ? currentList : allUniverse;
    return source.map(item => {
      const seas = item.seasonality || {};
      const xWin = radarHorizon === 'current' ? Number(seas.cur_month_win ?? 50) : Number(seas.next_month_win ?? 50);
      const yRet = radarHorizon === 'current' ? Number(seas.cur_month_avg ?? 0) : Number(seas.next_month_avg ?? 0);
      const isTrap = (seas.cur_month_win < 40 && seas.cur_month_avg < 0);
      const color = isTrap
        ? '#ef4444'
        : item.score >= 75
        ? '#10b981'
        : item.options?.bullish_flow
        ? '#f59e0b'
        : '#38bdf8';
      return { item, xWin, yRet, color, isTrap };
    });
  }, [currentList, allUniverse, radarHorizon]);

  const radarBounds = useMemo(() => {
    if (!radarPoints.length) return { minY: -8, maxY: 12 };
    const ys = radarPoints.map(p => p.yRet);
    const minY = Math.min(-4, Math.floor(Math.min(...ys) - 1));
    const maxY = Math.max(6, Math.ceil(Math.max(...ys) + 1));
    return { minY, maxY };
  }, [radarPoints]);

  if (loading && !localData) {
    return (
      <div className="glass-card" style={{ padding: '4rem 2rem', textAlign: 'center', color: '#94a3b8' }}>
        <Compass size={44} className="animate-spin" style={{ color: '#06b6d4', margin: '0 auto 1.25rem auto' }} />
        <h3 style={{ color: 'white', margin: '0 0 0.5rem 0', fontSize: '1.4rem' }}>
          Loading Seasonality Power Radar...
        </h3>
        <p style={{ maxWidth: '500px', margin: '0 auto', fontSize: '0.9rem', lineHeight: '1.5' }}>
          Analyzing 10-year monthly win-rates, Stage 2 trend alignments, and real-time options order flows.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* COMMAND HEADER */}
      <div
        className="glass-card"
        style={{
          padding: '1.4rem 1.75rem',
          background: 'linear-gradient(135deg, rgba(10, 15, 28, 0.96) 0%, rgba(6, 182, 212, 0.12) 55%, rgba(16, 185, 129, 0.08) 100%)',
          borderLeft: '4px solid #06b6d4',
          borderRadius: '12px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.25rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div
                style={{
                  background: 'linear-gradient(135deg, rgba(6,182,212,0.25), rgba(16,185,129,0.2))',
                  padding: '0.6rem',
                  borderRadius: '10px',
                  border: '1px solid rgba(34, 211, 238, 0.4)',
                  display: 'flex'
                }}
              >
                <Compass size={26} color="#22d3ee" />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                  <h1 style={{ margin: 0, fontSize: '1.65rem', color: 'white', fontWeight: '800', letterSpacing: '-0.4px' }}>
                    Seasonality Power Radar
                  </h1>
                  <span
                    style={{
                      fontSize: '0.68rem',
                      fontWeight: '700',
                      padding: '2px 8px',
                      borderRadius: '999px',
                      background: 'rgba(34, 211, 238, 0.15)',
                      color: '#22d3ee',
                      border: '1px solid rgba(34, 211, 238, 0.35)'
                    }}
                  >
                    10Y CYCLES × TREND × OPTIONS
                  </span>
                </div>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '3px' }}>
                  {localData?.last_updated ? `Synced ${localData.last_updated} • ` : ''}
                  {allCandidatesCount} Liquid Equities • {universeStats.stage2Count} in Stage 2 Uptrend
                </div>
              </div>
            </div>
          </div>

          {/* KPI Strip + Rescan */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={kpiBox('#06b6d4')}>
              <span style={kpiLabel}>Cycle Window</span>
              <strong style={{ color: '#22d3ee', fontSize: '0.98rem' }}>{currentMonth} ➔ {nextMonth}</strong>
            </div>
            <div style={kpiBox('#38bdf8')}>
              <span style={kpiLabel}>{currentMonth} Breadth</span>
              <strong style={{ color: Number(universeStats.avgCurRet) >= 0 ? '#10b981' : '#ef4444', fontSize: '0.98rem' }}>
                {universeStats.posCurPct}% Pos ({Number(universeStats.avgCurRet) >= 0 ? '+' : ''}{universeStats.avgCurRet}%)
              </strong>
            </div>
            <div style={kpiBox('#10b981')}>
              <span style={kpiLabel}>A+ Leaders</span>
              <strong style={{ color: '#10b981', fontSize: '0.98rem' }}>{topPicks.length}</strong>
            </div>
            <div style={kpiBox('#ef4444')}>
              <span style={kpiLabel}>Traps</span>
              <strong style={{ color: '#f87171', fontSize: '0.98rem' }}>{seasonalTraps.length}</strong>
            </div>
            <button
              onClick={handleRescan}
              disabled={isScanning}
              style={{
                padding: '0.62rem 1rem',
                borderRadius: '8px',
                background: isScanning ? 'rgba(6, 182, 212, 0.15)' : 'linear-gradient(135deg, #06b6d4 0%, #0284c7 100%)',
                color: 'white',
                border: '1px solid rgba(34, 211, 238, 0.45)',
                fontWeight: '700',
                fontSize: '0.8rem',
                cursor: isScanning ? 'wait' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                boxShadow: '0 4px 14px rgba(6, 182, 212, 0.25)'
              }}
            >
              <RefreshCw size={14} className={isScanning ? 'animate-spin' : ''} />
              {isScanning ? 'Scanning...' : 'Re-scan Radar'}
            </button>
          </div>
        </div>

        {scanMessage && (
          <div
            style={{
              marginTop: '0.85rem',
              padding: '0.5rem 0.85rem',
              background: 'rgba(6, 182, 212, 0.15)',
              border: '1px solid rgba(6, 182, 212, 0.3)',
              borderRadius: '6px',
              fontSize: '0.78rem',
              color: '#67e8f9'
            }}
          >
            {scanMessage}
          </div>
        )}
      </div>

      {/* VISUAL INTELLIGENCE ROW: POWER RADAR QUADRANT + UNIVERSE 12-MONTH BREADTH */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(340px, 1.35fr) minmax(300px, 1fr)', gap: '1.25rem' }}>
        {/* Left: Seasonality Power Radar Scatter */}
        <div className="glass-card" style={{ padding: '1.1rem 1.25rem', borderRadius: '12px', position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Crosshair size={16} color="#22d3ee" />
              <strong style={{ color: 'white', fontSize: '0.92rem' }}>
                Power Radar Matrix ({radarHorizon === 'current' ? currentMonth : nextMonth} Win% × Avg Return)
              </strong>
            </div>
            <div style={{ display: 'flex', gap: '0.35rem' }}>
              {['current', 'next'].map(h => (
                <button
                  key={h}
                  onClick={() => setRadarHorizon(h)}
                  style={{
                    padding: '0.25rem 0.6rem',
                    fontSize: '0.72rem',
                    fontWeight: '700',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    border: `1px solid ${radarHorizon === h ? '#06b6d4' : 'rgba(255,255,255,0.1)'}`,
                    background: radarHorizon === h ? 'rgba(6,182,212,0.22)' : 'rgba(0,0,0,0.25)',
                    color: radarHorizon === h ? '#22d3ee' : '#94a3b8'
                  }}
                >
                  {h === 'current' ? `${currentMonth} (Now)` : `${nextMonth} (Next)`}
                </button>
              ))}
            </div>
          </div>

          <div style={{ position: 'relative', width: '100%', height: '240px', background: 'rgba(2, 6, 23, 0.55)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
            <svg viewBox="0 0 600 240" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
              {/* Quadrant Shading: Top-Right Sweet Spot */}
              {(() => {
                const { minY, maxY } = radarBounds;
                const yRange = Math.max(1, maxY - minY);
                const x50 = 42 + (50 / 100) * 538;
                const x60 = 42 + (60 / 100) * 538;
                const y0 = 212 - ((0 - minY) / yRange) * 192;
                return (
                  <>
                    <rect x={x60} y={20} width={580 - x60} height={Math.max(0, y0 - 20)} fill="rgba(16, 185, 129, 0.08)" />
                    <rect x={42} y={y0} width={Math.max(0, x50 - 42)} height={Math.max(0, 212 - y0)} fill="rgba(239, 68, 68, 0.07)" />
                    {/* Grid & Axes */}
                    <line x1="42" y1={y0} x2="580" y2={y0} stroke="rgba(148,163,184,0.35)" strokeDasharray="4 4" />
                    <line x1={x50} y1="20" x2={x50} y2="212" stroke="rgba(148,163,184,0.35)" strokeDasharray="4 4" />
                    <line x1={x60} y1="20" x2={x60} y2="212" stroke="rgba(16,185,129,0.3)" strokeDasharray="2 3" />
                    {/* Labels */}
                    <text x="574" y="34" textAnchor="end" fill="#34d399" fontSize="10" fontWeight="700">POWERHOUSE QUADRANT (≥60%W &amp; +RET)</text>
                    <text x="48" y="204" textAnchor="start" fill="#f87171" fontSize="10" fontWeight="700">TRAP ZONE (&lt;50%W &amp; -RET)</text>
                    {/* X-Axis Ticks */}
                    {[0, 25, 50, 75, 100].map(w => {
                      const x = 42 + (w / 100) * 538;
                      return (
                        <g key={w}>
                          <line x1={x} y1="212" x2={x} y2="216" stroke="#475569" />
                          <text x={x} y="229" textAnchor="middle" fill="#64748b" fontSize="10" fontFamily="monospace">{w}%</text>
                        </g>
                      );
                    })}
                    {/* Y-Axis Labels */}
                    <text x="36" y="25" textAnchor="end" fill="#64748b" fontSize="10" fontFamily="monospace">+{maxY}%</text>
                    <text x="36" y={y0 + 3} textAnchor="end" fill="#94a3b8" fontSize="10" fontFamily="monospace">0%</text>
                    <text x="36" y="212" textAnchor="end" fill="#64748b" fontSize="10" fontFamily="monospace">{minY}%</text>

                    {/* Plot Dots */}
                    {radarPoints.map((pt, i) => {
                      const cx = 42 + (Math.max(0, Math.min(100, pt.xWin)) / 100) * 538;
                      const cy = 212 - ((pt.yRet - minY) / yRange) * 192;
                      const r = Math.max(4, Math.min(9.5, (pt.item.score || 50) / 10));
                      const isHigh = pt.xWin >= 70 && pt.yRet >= 3;
                      return (
                        <g
                          key={`${pt.item.ticker}-${i}`}
                          style={{ cursor: 'pointer' }}
                          onMouseEnter={() => setHoveredDot({ ...pt, cx, cy })}
                          onMouseLeave={() => setHoveredDot(null)}
                          onClick={() => onTickerClick && onTickerClick(pt.item.ticker)}
                        >
                          <circle cx={cx} cy={cy} r={r} fill={pt.color} fillOpacity={0.78} stroke="rgba(255,255,255,0.7)" strokeWidth={1} />
                          {isHigh && (
                            <text x={cx} y={cy - r - 3} textAnchor="middle" fill="#e2e8f0" fontSize="9" fontWeight="700" fontFamily="monospace">
                              {pt.item.ticker}
                            </text>
                          )}
                        </g>
                      );
                    })}
                  </>
                );
              })()}
            </svg>

            {hoveredDot && (
              <div
                style={{
                  position: 'absolute',
                  top: '10px',
                  left: '52px',
                  background: 'rgba(15, 23, 42, 0.95)',
                  border: `1px solid ${hoveredDot.color}`,
                  borderRadius: '7px',
                  padding: '0.45rem 0.7rem',
                  fontSize: '0.75rem',
                  color: 'white',
                  pointerEvents: 'none',
                  zIndex: 10,
                  boxShadow: '0 8px 20px rgba(0,0,0,0.45)'
                }}
              >
                <strong style={{ color: hoveredDot.color }}>{hoveredDot.item.ticker}</strong> • Score {hoveredDot.item.score}/100
                <div style={{ color: '#cbd5e1', marginTop: '2px' }}>
                  {radarHorizon === 'current' ? currentMonth : nextMonth}:{' '}
                  <strong>{hoveredDot.yRet > 0 ? '+' : ''}{hoveredDot.yRet}%</strong> ({hoveredDot.xWin}% Win)
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: 12-Month Universe Breadth & Seasonality Curve */}
        <div className="glass-card" style={{ padding: '1.1rem 1.25rem', borderRadius: '12px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <BarChart2 size={16} color="#22d3ee" />
              <strong style={{ color: 'white', fontSize: '0.92rem' }}>Universe 12-Month Cycle Curve ({allCandidatesCount} Stocks)</strong>
            </div>
            <span style={{ fontSize: '0.7rem', color: '#64748b' }}>10Y Avg Return &amp; Breadth</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '6px', alignItems: 'end', height: '175px', padding: '12px 6px 4px 6px', background: 'rgba(2, 6, 23, 0.5)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
            {universeMonthlyBreadth.map(m => {
              const isCur = m.name === currentMonth;
              const isNext = m.name === nextMonth;
              const maxAbs = Math.max(3, ...universeMonthlyBreadth.map(x => Math.abs(x.avgRet)));
              const barH = Math.max(10, Math.round((Math.abs(m.avgRet) / maxAbs) * 95));
              const isPos = m.avgRet >= 0;
              return (
                <div
                  key={m.month}
                  title={`${m.name}: ${m.avgRet > 0 ? '+' : ''}${m.avgRet}% avg | ${m.posPct}% stocks positive (${m.avgWin}% avg win)`}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    height: '100%',
                    borderRadius: '5px',
                    padding: '4px 2px',
                    background: isCur ? 'rgba(6, 182, 212, 0.14)' : isNext ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                    border: isCur ? '1px solid rgba(34, 211, 238, 0.5)' : isNext ? '1px solid rgba(96, 165, 250, 0.35)' : '1px solid transparent'
                  }}
                >
                  <span style={{ fontSize: '0.62rem', fontWeight: '700', color: isPos ? '#34d399' : '#f87171', marginBottom: '3px', fontFamily: 'monospace' }}>
                    {isPos ? `+${m.avgRet.toFixed(1)}` : m.avgRet.toFixed(1)}%
                  </span>
                  <div
                    style={{
                      width: '70%',
                      height: `${barH}px`,
                      borderRadius: '3px',
                      background: isPos
                        ? isCur
                          ? 'linear-gradient(180deg, #22d3ee, #10b981)'
                          : 'linear-gradient(180deg, #10b981, rgba(16,185,129,0.35))'
                        : 'linear-gradient(180deg, #ef4444, rgba(239,68,68,0.35))'
                    }}
                  />
                  <span style={{ fontSize: '0.66rem', fontWeight: '800', color: isCur ? '#22d3ee' : isNext ? '#60a5fa' : '#94a3b8', marginTop: '5px' }}>
                    {m.name}
                  </span>
                  <span style={{ fontSize: '0.56rem', color: '#64748b' }}>{m.posPct}%+</span>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.6rem', fontSize: '0.73rem', color: '#94a3b8' }}>
            <span>● <strong style={{ color: '#22d3ee' }}>{currentMonth}</strong> Active Window</span>
            <span>● <strong style={{ color: '#60a5fa' }}>{nextMonth}</strong> Forward Rotation</span>
            <span>Click any radar dot or ticker to Deep Dive</span>
          </div>
        </div>
      </div>

      {/* SECTOR SEASONAL ROTATION STRIP */}
      {sectorBreakdown.length > 0 && (
        <div className="glass-card" style={{ padding: '0.75rem 1.1rem', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '0.55rem', overflowX: 'auto' }}>
          <span style={{ fontSize: '0.72rem', fontWeight: '700', color: '#94a3b8', whiteSpace: 'nowrap', marginRight: '0.2rem' }}>
            SECTOR ROTATION:
          </span>
          <button
            onClick={() => setActiveSector('ALL')}
            style={{
              padding: '0.32rem 0.7rem',
              borderRadius: '6px',
              border: `1px solid ${activeSector === 'ALL' ? '#06b6d4' : 'rgba(255,255,255,0.08)'}`,
              background: activeSector === 'ALL' ? 'rgba(6,182,212,0.2)' : 'rgba(2,6,23,0.45)',
              color: activeSector === 'ALL' ? '#22d3ee' : '#94a3b8',
              fontSize: '0.72rem',
              fontWeight: '700',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            All ({allCandidatesCount})
          </button>
          {sectorBreakdown.map(sec => {
            const isSel = activeSector === sec.sector;
            const isPos = sec.avgCur >= 0;
            return (
              <button
                key={sec.sector}
                onClick={() => setActiveSector(isSel ? 'ALL' : sec.sector)}
                style={{
                  padding: '0.32rem 0.7rem',
                  borderRadius: '6px',
                  border: `1px solid ${isSel ? '#06b6d4' : 'rgba(255,255,255,0.08)'}`,
                  background: isSel ? 'rgba(6,182,212,0.2)' : 'rgba(2,6,23,0.45)',
                  color: isSel ? 'white' : '#cbd5e1',
                  fontSize: '0.72rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem'
                }}
              >
                <span>{sec.sector}</span>
                <span style={{ color: isPos ? '#10b981' : '#ef4444', fontWeight: '800', fontFamily: 'monospace' }}>
                  {isPos ? '+' : ''}{sec.avgCur}%
                </span>
                <span style={{ color: '#64748b', fontSize: '0.66rem' }}>({sec.avgWin}%W)</span>
              </button>
            );
          })}
        </div>
      )}

      {/* FILTER BAR, SORT & VIEW CONTROLS */}
      <div className="glass-card" style={{ padding: '0.9rem 1.15rem', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.85rem' }}>
        <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
          <TabBtn active={activeCategory === 'all'} color="#06b6d4" onClick={() => setActiveCategory('all')} icon={<Flame size={14} />} label={`All Leaders (${topPicks.length})`} />
          <TabBtn active={activeCategory === 'breakouts'} color="#10b981" onClick={() => setActiveCategory('breakouts')} icon={<TrendingUp size={14} />} label={`Breakouts (${breakoutLeaders.length})`} />
          <TabBtn active={activeCategory === 'upcoming'} color="#3b82f6" onClick={() => setActiveCategory('upcoming')} icon={<Calendar size={14} />} label={`${nextMonth} Tailwinds (${upcomingTailwinds.length})`} />
          <TabBtn active={activeCategory === 'options'} color="#f59e0b" onClick={() => setActiveCategory('options')} icon={<Zap size={14} />} label={`Options Sweeps (${optionsBacked.length})`} />
          <TabBtn active={activeCategory === 'traps'} color="#ef4444" onClick={() => setActiveCategory('traps')} icon={<ShieldAlert size={14} />} label={`Traps (${seasonalTraps.length})`} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          {activeCategory === 'all' && (
            <button
              onClick={() => setShowAllCandidates(!showAllCandidates)}
              style={{
                background: showAllCandidates ? 'rgba(6, 182, 212, 0.2)' : 'rgba(0,0,0,0.3)',
                border: `1px solid ${showAllCandidates ? '#06b6d4' : 'rgba(255,255,255,0.1)'}`,
                color: showAllCandidates ? '#22d3ee' : '#94a3b8',
                padding: '0.38rem 0.65rem',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              {showAllCandidates ? `All ${allCandidatesCount}` : 'Top 25'}
            </button>
          )}

          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
            <input
              type="text"
              placeholder="Ticker..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '6px',
                padding: '0.36rem 0.65rem 0.36rem 1.8rem',
                color: 'white',
                fontSize: '0.78rem',
                width: '105px',
                outline: 'none'
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', color: '#94a3b8' }}>
            <ArrowUpDown size={13} />
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={selectStyle}>
              <option value="score">Score</option>
              <option value="cur_ret">{currentMonth} Return</option>
              <option value="cur_win">{currentMonth} Win %</option>
              <option value="next_ret">{nextMonth} Return</option>
              <option value="pcr">Bullish PCR</option>
            </select>
          </div>

          {activeCategory !== 'traps' && (
            <select value={minScore} onChange={(e) => setMinScore(Number(e.target.value))} style={selectStyle}>
              <option value="0">All Scores</option>
              <option value="50">50+ Score</option>
              <option value="65">65+ Strong</option>
              <option value="75">75+ Elite</option>
            </select>
          )}

          <div style={{ display: 'flex', background: 'rgba(0,0,0,0.35)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden' }}>
            <button onClick={() => setViewMode('cards')} title="Card View" style={viewBtnStyle(viewMode === 'cards')}>
              <LayoutGrid size={14} />
            </button>
            <button onClick={() => setViewMode('table')} title="Matrix Table View" style={viewBtnStyle(viewMode === 'table')}>
              <TableIcon size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* RESULTS AREA */}
      {currentList.length === 0 ? (
        <div className="glass-card" style={{ padding: '3.5rem 2rem', textAlign: 'center', color: '#64748b' }}>
          <Compass size={32} style={{ color: '#475569', margin: '0 auto 0.75rem auto' }} />
          <p style={{ margin: 0, fontSize: '1rem', color: '#94a3b8' }}>No tickers matched your active filter criteria.</p>
          <span style={{ fontSize: '0.8rem', marginTop: '0.4rem', display: 'block' }}>
            Try lowering Min Score or clearing your ticker search.
          </span>
        </div>
      ) : viewMode === 'table' ? (
        <div className="glass-card" style={{ borderRadius: '10px', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ background: 'rgba(2, 6, 23, 0.7)', color: '#94a3b8', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <th style={thStyle}>Ticker</th>
                <th style={thStyle}>Price</th>
                <th style={thStyle}>Score</th>
                <th style={thStyle}>{currentMonth} Avg / Win</th>
                <th style={thStyle}>{nextMonth} Avg / Win</th>
                <th style={thStyle}>Trend</th>
                <th style={thStyle}>Options / IV / PCR</th>
                <th style={thStyle}>Setup</th>
                <th style={thStyle}></th>
              </tr>
            </thead>
            <tbody>
              {currentList.map(item => {
                const seas = item.seasonality || {};
                const tech = item.technicals || {};
                const opt = item.options || {};
                const scoreColor = item.score >= 75 ? '#10b981' : item.score >= 65 ? '#3b82f6' : item.score >= 50 ? '#f59e0b' : '#ef4444';
                return (
                  <tr key={item.ticker} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={tdStyle}>
                      <strong onClick={() => onTickerClick && onTickerClick(item.ticker)} style={{ color: 'white', cursor: 'pointer', fontSize: '0.9rem' }}>
                        {item.ticker}
                      </strong>
                    </td>
                    <td style={{ ...tdStyle, fontFamily: 'monospace', color: '#cbd5e1' }}>${Number(item.current_price || 0).toFixed(2)}</td>
                    <td style={tdStyle}>
                      <span style={{ color: scoreColor, fontWeight: '800', fontFamily: 'monospace' }}>{item.score}/100</span>
                    </td>
                    <td style={{ ...tdStyle, fontFamily: 'monospace' }}>
                      <span style={{ color: (seas.cur_month_avg || 0) >= 0 ? '#10b981' : '#ef4444', fontWeight: '700' }}>
                        {(seas.cur_month_avg || 0) > 0 ? '+' : ''}{seas.cur_month_avg || 0}%
                      </span>{' '}
                      <span style={{ color: '#64748b' }}>({seas.cur_month_win || 0}%)</span>
                    </td>
                    <td style={{ ...tdStyle, fontFamily: 'monospace' }}>
                      <span style={{ color: (seas.next_month_avg || 0) >= 0 ? '#60a5fa' : '#f87171', fontWeight: '700' }}>
                        {(seas.next_month_avg || 0) > 0 ? '+' : ''}{seas.next_month_avg || 0}%
                      </span>{' '}
                      <span style={{ color: '#64748b' }}>({seas.next_month_win || 0}%)</span>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ color: tech.bullish_alignment ? '#10b981' : tech.above_50 ? '#3b82f6' : '#f59e0b', fontWeight: '700' }}>
                        {tech.bullish_alignment ? 'Stage 2' : tech.above_50 ? '>50 SMA' : '>200 SMA'}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, fontFamily: 'monospace', color: '#cbd5e1' }}>
                      {opt.bullish_flow ? <span style={{ color: '#10b981', fontWeight: '700' }}>Call Sweep</span> : `PCR ${opt.pcr_vol || opt.pcr_oi || 1}`} • IV {opt.avg_iv || '-'}%
                    </td>
                    <td style={tdStyle}>
                      <span style={{ fontSize: '0.68rem', padding: '2px 6px', borderRadius: '4px', background: `${item.badge_color || scoreColor}20`, color: item.badge_color || scoreColor }}>
                        {item.setup_label}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <button onClick={() => onTickerClick && onTickerClick(item.ticker)} style={{ background: 'transparent', border: 'none', color: '#22d3ee', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                        <ChevronRight size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '1.1rem' }}>
          {currentList.map(item => {
            const scoreColor = item.score >= 75 ? '#10b981' : item.score >= 65 ? '#3b82f6' : item.score >= 50 ? '#f59e0b' : '#ef4444';
            const tech = item.technicals || {};
            const seas = item.seasonality || {};
            const opt = item.options || {};
            const isTrap = activeCategory === 'traps' || (seas.cur_month_win < 40 && seas.cur_month_avg < 0);
            const maxMonthAbs = Math.max(4, ...(seas.monthly_12 || []).map(m => Math.abs(m.avg_return || 0)));

            return (
              <div
                key={item.ticker}
                className="glass-card"
                style={{
                  padding: '1.15rem',
                  borderRadius: '12px',
                  borderTop: `3px solid ${isTrap ? '#ef4444' : item.badge_color || scoreColor}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.8rem'
                }}
              >
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span
                        onClick={() => onTickerClick && onTickerClick(item.ticker)}
                        style={{ fontSize: '1.35rem', fontWeight: '800', color: 'white', cursor: 'pointer' }}
                      >
                        {item.ticker}
                      </span>
                      <span style={{ fontSize: '0.98rem', color: '#cbd5e1', fontFamily: 'monospace' }}>
                        ${Number(item.current_price || 0).toFixed(2)}
                      </span>
                      {tech.dist_52w_pct !== undefined && (
                        <span style={{ fontSize: '0.68rem', color: '#94a3b8', background: 'rgba(255,255,255,0.05)', padding: '1px 6px', borderRadius: '4px' }}>
                          {tech.dist_52w_pct}% 52W
                        </span>
                      )}
                      {item.sector && (
                        <span style={{ fontSize: '0.64rem', color: '#38bdf8', background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.25)', padding: '1px 6px', borderRadius: '4px' }}>
                          {item.sector}
                        </span>
                      )}
                      {opt.earnings_in_days !== null && opt.earnings_in_days !== undefined && opt.earnings_in_days <= 30 && (
                        <span
                          title={`Earnings on ${opt.earnings_date}`}
                          style={{ fontSize: '0.64rem', fontWeight: '700', color: '#fbbf24', background: 'rgba(245,158,11,0.14)', border: '1px solid rgba(245,158,11,0.35)', padding: '1px 6px', borderRadius: '4px' }}
                        >
                          ⚡ ER {opt.earnings_in_days}d
                        </span>
                      )}
                    </div>
                    <div style={{ marginTop: '0.3rem' }}>
                      <span
                        style={{
                          fontSize: '0.66rem',
                          fontWeight: '700',
                          padding: '2px 7px',
                          borderRadius: '4px',
                          background: `${item.badge_color || scoreColor}20`,
                          color: item.badge_color || scoreColor,
                          border: `1px solid ${item.badge_color || scoreColor}44`
                        }}
                      >
                        {item.setup_label}
                      </span>
                    </div>
                  </div>

                  {/* Confluence Gauge */}
                  <div
                    style={{
                      width: '54px',
                      height: '54px',
                      borderRadius: '50%',
                      background: `conic-gradient(${scoreColor} ${item.score * 3.6}deg, rgba(255,255,255,0.08) 0deg)`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <div
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '50%',
                        background: '#0b1120',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <strong style={{ fontSize: '0.95rem', color: scoreColor, lineHeight: 1 }}>{item.score}</strong>
                      <span style={{ fontSize: '0.5rem', color: '#64748b' }}>SCORE</span>
                    </div>
                  </div>
                </div>

                {/* 3-Pillar Confluence */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr',
                    gap: '0.45rem',
                    background: 'rgba(2, 6, 23, 0.5)',
                    padding: '0.6rem',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.05)'
                  }}
                >
                  <div style={{ textAlign: 'center' }}>
                    <span style={{ fontSize: '0.66rem', color: '#94a3b8', display: 'block' }}>{currentMonth} Edge</span>
                    <strong style={{ fontSize: '0.88rem', color: (seas.cur_month_avg || 0) >= 0 ? '#10b981' : '#ef4444' }}>
                      {(seas.cur_month_avg || 0) > 0 ? '+' : ''}{seas.cur_month_avg || 0}%
                    </strong>
                    <span style={{ fontSize: '0.64rem', color: '#cbd5e1', display: 'block' }}>
                      {seas.cur_month_win || 0}%W
                      {seas.cur_month_med !== undefined && (
                        <span style={{ color: seas.outlier_skew ? '#fbbf24' : '#94a3b8' }}>
                          {' '}• Med {seas.cur_month_med > 0 ? '+' : ''}{seas.cur_month_med}%
                        </span>
                      )}
                    </span>
                  </div>

                  <div style={{ textAlign: 'center', borderLeft: '1px solid rgba(255,255,255,0.06)', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
                    <span style={{ fontSize: '0.66rem', color: '#94a3b8', display: 'block' }}>Trend &amp; ADR</span>
                    <strong style={{ fontSize: '0.85rem', color: tech.bullish_alignment ? '#10b981' : tech.above_50 ? '#3b82f6' : '#f59e0b' }}>
                      {tech.bullish_alignment ? 'Stage 2 Bull' : tech.above_50 ? '> 50 SMA' : '> 200 SMA'}
                    </strong>
                    <span style={{ fontSize: '0.66rem', color: '#64748b', display: 'block' }}>ADR {tech.adr_pct || '-'}%</span>
                  </div>

                  <div style={{ textAlign: 'center' }}>
                    <span style={{ fontSize: '0.66rem', color: '#94a3b8', display: 'block' }}>Options Flow</span>
                    <strong style={{ fontSize: '0.85rem', color: opt.bullish_flow ? '#10b981' : opt.pcr_vol > 1.2 ? '#ef4444' : '#cbd5e1' }}>
                      {opt.bullish_flow ? 'Call Sweep' : `PCR ${opt.pcr_vol || opt.pcr_oi || 1.0}`}
                    </strong>
                    <span style={{ fontSize: '0.66rem', color: '#64748b', display: 'block' }}>
                      IV {opt.avg_iv || '-'}% • ±{opt.implied_move_pct || '-'}%
                    </span>
                  </div>
                </div>

                {/* Proportional 12-Month Cycle Bars */}
                {seas.monthly_12 && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                      <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <Calendar size={12} /> 10Y Monthly Profile
                      </span>
                      {seas.next_month_name && (
                        <span style={{ fontSize: '0.7rem', color: '#60a5fa' }}>
                          Next ({seas.next_month_name}): <strong>{seas.next_month_avg > 0 ? '+' : ''}{seas.next_month_avg}% ({seas.next_month_win}%W)</strong>
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '3px', alignItems: 'end', height: '78px', padding: '5px 4px 4px 4px', background: 'rgba(2,6,23,0.45)', borderRadius: '6px' }}>
                      {seas.monthly_12.map(m => {
                        const isCur = m.name === currentMonth;
                        const isNext = m.name === nextMonth;
                        const isPos = m.avg_return >= 0;
                        const barH = Math.max(4, Math.round((Math.abs(m.avg_return || 0) / maxMonthAbs) * 22));
                        return (
                          <div
                            key={m.month}
                            title={`${m.name}: ${m.avg_return > 0 ? '+' : ''}${m.avg_return}% avg, ${m.win_rate}% win`}
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'flex-end',
                              height: '100%',
                              borderRadius: '4px',
                              paddingBottom: '2px',
                              background: isCur ? 'rgba(6, 182, 212, 0.2)' : isNext ? 'rgba(59, 130, 246, 0.14)' : 'transparent',
                              border: isCur ? '1px solid #06b6d4' : isNext ? '1px solid #3b82f6' : '1px solid transparent'
                            }}
                          >
                            <span style={{ fontSize: '0.54rem', fontWeight: '700', color: isPos ? '#34d399' : '#f87171', fontFamily: 'monospace', marginBottom: '2px', lineHeight: 1 }}>
                              {m.avg_return > 0 ? `+${Math.round(m.avg_return)}` : Math.round(m.avg_return)}%
                            </span>
                            <div
                              style={{
                                width: '68%',
                                height: `${barH}px`,
                                borderRadius: '2px',
                                background: isPos ? '#10b981' : '#ef4444',
                                opacity: Math.max(0.45, (m.win_rate || 50) / 100)
                              }}
                            />
                            <span style={{ fontSize: '0.58rem', color: isCur ? '#22d3ee' : isNext ? '#60a5fa' : '#94a3b8', fontWeight: '800', marginTop: '2px', lineHeight: 1 }}>
                              {m.name.charAt(0)}
                            </span>
                            <span style={{ fontSize: '0.52rem', color: (m.win_rate || 0) >= 65 ? '#cbd5e1' : '#64748b', fontFamily: 'monospace', marginTop: '1px', lineHeight: 1 }}>
                              {m.win_rate ?? 0}%
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Footer */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.4rem', borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: '0.73rem', color: '#94a3b8', flexWrap: 'wrap', gap: '0.4rem' }}>
                  <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                    <span>
                      {seas.next_quarter_name || 'Next Q'}:{' '}
                      <strong style={{ color: (seas.next_quarter_avg || 0) >= 0 ? '#10b981' : '#ef4444' }}>
                        {(seas.next_quarter_avg || 0) > 0 ? '+' : ''}{seas.next_quarter_avg}% ({seas.next_quarter_win}%)
                      </strong>
                    </span>
                    <span style={{ color: '#64748b' }}>•</span>
                    <span>C/P: <strong style={{ color: '#cbd5e1' }}>{opt.call_vol || 0}/{opt.put_vol || 0}</strong></span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    {seas.cur_years && seas.cur_years.length > 0 && (
                      <button
                        onClick={() => setExpandedTicker(expandedTicker === item.ticker ? null : item.ticker)}
                        style={{
                          background: expandedTicker === item.ticker ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255,255,255,0.05)',
                          border: `1px solid ${expandedTicker === item.ticker ? '#38bdf8' : 'rgba(255,255,255,0.1)'}`,
                          borderRadius: '6px',
                          color: expandedTicker === item.ticker ? '#38bdf8' : '#cbd5e1',
                          fontSize: '0.7rem',
                          fontWeight: '700',
                          cursor: 'pointer',
                          padding: '0.24rem 0.5rem'
                        }}
                      >
                        {expandedTicker === item.ticker ? 'Hide 10Y' : '10Y Years'}
                      </button>
                    )}

                    <button
                      onClick={() => onTickerClick && onTickerClick(item.ticker)}
                      style={{
                        background: 'rgba(6, 182, 212, 0.12)',
                        border: '1px solid rgba(6, 182, 212, 0.35)',
                        borderRadius: '6px',
                        color: '#22d3ee',
                        fontSize: '0.72rem',
                        fontWeight: '700',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.2rem',
                        padding: '0.25rem 0.55rem'
                      }}
                    >
                      Deep Dive <ArrowUpRight size={13} />
                    </button>
                  </div>
                </div>

                {/* Expandable 10-Year Yearly Breakdown */}
                {expandedTicker === item.ticker && seas.cur_years && (
                  <div style={{ background: 'rgba(2, 6, 23, 0.65)', border: '1px solid rgba(56, 189, 248, 0.25)', borderRadius: '8px', padding: '0.6rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem', fontSize: '0.68rem' }}>
                      <span style={{ color: '#38bdf8', fontWeight: '700' }}>
                        {currentMonth} Year-by-Year Consistency ({seas.cur_years.length}Y)
                      </span>
                      <span style={{ color: seas.outlier_skew ? '#fbbf24' : '#34d399', fontWeight: '700' }}>
                        {seas.outlier_skew ? '⚠ Outlier Skewed (Check Median)' : '✓ Consistent Seasonal Edge'}
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${seas.cur_years.length}, 1fr)`, gap: '4px', alignItems: 'end', height: '54px' }}>
                      {(() => {
                        const maxYAbs = Math.max(5, ...seas.cur_years.map(y => Math.abs(y.ret)));
                        return seas.cur_years.map(yr => {
                          const isPos = yr.ret >= 0;
                          const h = Math.max(4, Math.round((Math.abs(yr.ret) / maxYAbs) * 28));
                          return (
                            <div key={yr.year} title={`${currentMonth} ${yr.year}: ${yr.ret > 0 ? '+' : ''}${yr.ret}%`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                              <span style={{ fontSize: '0.55rem', color: isPos ? '#34d399' : '#f87171', fontFamily: 'monospace', marginBottom: '2px' }}>
                                {yr.ret > 0 ? `+${Math.round(yr.ret)}` : Math.round(yr.ret)}
                              </span>
                              <div style={{ width: '72%', height: `${h}px`, borderRadius: '2px', background: isPos ? '#10b981' : '#ef4444' }} />
                              <span style={{ fontSize: '0.55rem', color: '#64748b', marginTop: '2px' }}>{String(yr.year).slice(-2)}</span>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TabBtn({ active, color, onClick, icon, label }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '0.42rem 0.78rem',
        borderRadius: '6px',
        border: `1px solid ${active ? color : 'rgba(255,255,255,0.08)'}`,
        background: active ? `${color}28` : 'rgba(0,0,0,0.25)',
        color: active ? 'white' : '#94a3b8',
        fontWeight: '600',
        fontSize: '0.78rem',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '0.35rem'
      }}
    >
      <span style={{ color: active ? color : '#64748b', display: 'flex' }}>{icon}</span>
      {label}
    </button>
  );
}

const kpiBox = (accent) => ({
  background: 'rgba(2, 6, 23, 0.55)',
  border: `1px solid ${accent}33`,
  padding: '0.45rem 0.8rem',
  borderRadius: '8px',
  textAlign: 'center'
});

const kpiLabel = {
  fontSize: '0.64rem',
  color: '#94a3b8',
  display: 'block',
  textTransform: 'uppercase',
  letterSpacing: '0.03em'
};

const selectStyle = {
  background: 'rgba(0,0,0,0.35)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '6px',
  padding: '0.34rem 0.5rem',
  color: '#22d3ee',
  fontSize: '0.76rem',
  outline: 'none'
};

const viewBtnStyle = (active) => ({
  background: active ? 'rgba(6,182,212,0.25)' : 'transparent',
  color: active ? '#22d3ee' : '#64748b',
  border: 'none',
  padding: '0.38rem 0.55rem',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center'
});

const thStyle = { padding: '0.75rem 0.85rem', fontWeight: '700', fontSize: '0.72rem', textTransform: 'uppercase' };
const tdStyle = { padding: '0.7rem 0.85rem' };
