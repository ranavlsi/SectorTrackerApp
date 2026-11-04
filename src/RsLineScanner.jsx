import React, { useState, useEffect, useMemo } from 'react';
import {
  RefreshCw,
  Mail,
  Star,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Loader,
  BarChart2,
  X,
  Search,
  Zap,
  Target,
  Shield,
  TrendingUp,
  Award,
  Columns,
  Maximize2,
  Filter,
  ArrowUpDown,
} from 'lucide-react';
import RsSparkline from './RsSparkline';
import UnifiedPlotlyChart from './UnifiedPlotlyChart';

const STRATEGY_PRESETS = [
  { id: 'ALL', label: '🌐 All RS Candidates', desc: 'All stocks passing IBD RS & Base filters' },
  { id: 'BLUE_DOT_3D', label: '🔵 Blue Dot Pivots (3D)', desc: 'RS Line at 52W High BEFORE Price breakout (Last 3 Sessions)' },
  { id: 'BLUE_DOT_TODAY', label: '⚡ Blue Dot TODAY', desc: 'Fresh RS Line 52W High breakout triggered today' },
  { id: 'CUP_AND_HANDLE', label: '☕ Cup & Handle + RS Lead', desc: 'Confirmed MarketSurge Cup & Handle or Cup base with strong RS' },
  { id: 'MONSTER_90', label: '🏆 RS 90+ Monster Leaders', desc: 'Top 10% IBD Relative Strength Rating (>= 90) & positive Mansfield RS' },
  { id: 'POWER_UPTREND', label: '🔥 Power Uptrends (85+)', desc: 'Trend Strength Meter >= 85 (Full Bullish 21EMA > 50SMA > 200SMA Stack + Rising Slopes)' },
  { id: 'NEAR_BUY_POINT', label: '🎯 Near Buy Point (±5%)', desc: 'Trading within -5% to +3% of Official MarketSurge Buy Point' },
  { id: 'DUAL_BENCHMARK', label: '🚀 Dual SPY & QQQ RS High', desc: 'RS Line >= 98% of 52W High vs BOTH S&P 500 (SPY) and Nasdaq-100 (QQQ)' },
  { id: 'TIGHT_INSTITUTIONAL', label: '🟢 Tight ADR Leaders (≤4%)', desc: 'Low-volatility institutional accumulators (ADR <= 4.0%, RS >= 80)' },
  { id: 'WATCHLIST', label: '⭐ Saved Watchlist', desc: 'Your starred RS setups saved in local storage' },
];

const TickerCell = ({ item, onClick, onInspectChart }) => {
  const [hoverInfo, setHoverInfo] = useState(null);
  const [healthData, setHealthData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const handleMouseEnter = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const renderAbove = spaceBelow < 320;

    setHoverInfo({
      x: rect.left,
      y: renderAbove ? rect.top - 6 : rect.bottom + 6,
      renderAbove,
    });

    if (!healthData && !loading) {
      setLoading(true);
      setErrorMsg(null);
      fetch(`/api/search?ticker=${item.ticker}&t=${new Date().getTime()}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.error) {
            setErrorMsg(data.error);
          } else {
            setHealthData(data);
          }
          setLoading(false);
        })
        .catch((err) => {
          setErrorMsg(err.message || 'Network error');
          setLoading(false);
        });
    }
  };

  const stageColor =
    item.stage_tag === 'Stage 2A Pivot'
      ? '#10b981'
      : item.stage_tag === 'Stage 2 Markup'
      ? '#38bdf8'
      : item.stage_tag === 'Stage 2 Pullback'
      ? '#f59e0b'
      : '#94a3b8';

  return (
    <td
      style={{ padding: '10px 12px', cursor: 'pointer', position: 'relative' }}
      onClick={() => onClick && onClick(item.ticker)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setHoverInfo(null)}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span
            style={{
              color: '#38bdf8',
              fontWeight: 900,
              fontSize: '0.95rem',
              fontFamily: 'monospace',
              letterSpacing: '0.02em',
            }}
          >
            {item.ticker}
          </span>
          <span
            style={{
              color: '#e2e8f0',
              fontFamily: 'monospace',
              fontSize: '0.82rem',
              fontWeight: 700,
            }}
          >
            ${Number(item.price || 0).toFixed(2)}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span
            style={{
              fontSize: '0.64rem',
              fontFamily: 'monospace',
              fontWeight: 800,
              padding: '1px 5px',
              borderRadius: '4px',
              background: `${stageColor}1f`,
              border: `1px solid ${stageColor}55`,
              color: stageColor,
            }}
          >
            {item.stage_tag || 'Stage 2'}
          </span>
          {item.above_10w && item.above_40w && (
            <span
              style={{
                fontSize: '0.62rem',
                color: '#10b981',
                fontFamily: 'monospace',
              }}
              title="Price above both 10-Week (50d) and 40-Week (200d) SMAs"
            >
              ✓10W/40W
            </span>
          )}
        </div>
      </div>

      {hoverInfo && (
        <div
          style={{
            position: 'fixed',
            top: hoverInfo.y,
            left: hoverInfo.x,
            transform: hoverInfo.renderAbove ? 'translateY(-100%)' : 'none',
            width: '300px',
            background: 'rgba(9, 13, 22, 0.98)',
            border: '1px solid rgba(56, 189, 248, 0.5)',
            borderRadius: '10px',
            padding: '0.85rem',
            zIndex: 99999,
            boxShadow: '0 15px 35px rgba(0,0,0,0.75)',
            cursor: 'default',
            pointerEvents: 'none',
            fontFamily: 'monospace',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1px solid rgba(148,163,184,0.15)',
              paddingBottom: '6px',
              marginBottom: '6px',
            }}
          >
            <strong style={{ color: '#38bdf8', fontSize: '0.92rem' }}>
              {item.ticker} · ${Number(item.price || 0).toFixed(2)}
            </strong>
            <span style={{ color: '#10b981', fontSize: '0.75rem', fontWeight: 800 }}>
              RS {item.rs_rating} · Alpha {item.rs_alpha_score || item.rs_rating}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', fontSize: '0.73rem', marginBottom: '6px' }}>
            <span style={{ color: '#94a3b8' }}>
              MS Buy Pt: <strong style={{ color: '#10b981' }}>${Number(item.buy_point || 0).toFixed(2)}</strong>
            </span>
            <span style={{ color: '#94a3b8' }}>
              5% Zone: <strong style={{ color: '#34d399' }}>${Number(item.buy_zone_high || 0).toFixed(2)}</strong>
            </span>
            <span style={{ color: '#94a3b8' }}>
              Dist Pivot: <strong style={{ color: '#fbbf24' }}>{item.dist_to_pivot_pct >= 0 ? '+' : ''}{item.dist_to_pivot_pct}%</strong>
            </span>
            <span style={{ color: '#94a3b8' }}>
              -7.5% Stop: <strong style={{ color: '#ef4444' }}>${Number(item.stop_loss || 0).toFixed(2)}</strong>
            </span>
          </div>

          {loading ? (
            <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8' }}>Syncing live technical health...</p>
          ) : healthData && healthData.technicals ? (
            <div style={{ borderTop: '1px solid rgba(148,163,184,0.15)', paddingTop: '6px', fontSize: '0.74rem' }}>
              <p style={{ margin: '0 0 3px 0', color: '#cbd5e1' }}>
                Weinstein Stage:{' '}
                <strong style={{ color: healthData.technicals.stage?.includes('2') ? '#10b981' : '#f59e0b' }}>
                  {healthData.technicals.stage}
                </strong>
              </p>
              <p style={{ margin: '0 0 3px 0', color: '#cbd5e1' }}>
                Momentum:{' '}
                <strong style={{ color: healthData.technicals.momentum_color === 'bullish' ? '#10b981' : '#ef4444' }}>
                  {healthData.technicals.momentum_text}
                </strong>
              </p>
              {healthData.score && (
                <p style={{ margin: 0, color: '#cbd5e1' }}>
                  Master Quant Score: <strong style={{ color: '#38bdf8' }}>{healthData.score}/100</strong>
                </p>
              )}
            </div>
          ) : errorMsg ? (
            <p style={{ margin: 0, fontSize: '0.72rem', color: '#94a3b8' }}>Click ticker to open full report</p>
          ) : null}
        </div>
      )}
    </td>
  );
};

export default function RsLineScanner({ onTickerClick, onOpenDeepChart }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [totalScanned, setTotalScanned] = useState(0);
  const [watchlist, setWatchlist] = useState([]);
  const [hoverInfo, setHoverInfo] = useState(null);
  const [liveAlerts, setLiveAlerts] = useState([]);

  // Chart Inspection & Split View State
  const [activeModalTicker, setActiveModalTicker] = useState(null);
  const [modalFullscreen, setModalFullscreen] = useState(false);
  const [splitView, setSplitView] = useState(false);
  const [selectedTicker, setSelectedTicker] = useState('NVDA');

  // Strategy Preset & Filter State
  const [activePreset, setActivePreset] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [minRating, setMinRating] = useState(80);
  const [minTrendScore, setMinTrendScore] = useState(0); // 0, 55, 70, 85 (Trend Strength Meter filter)
  const [rsBadgeFilter, setRsBadgeFilter] = useState('ALL'); // ALL, 12M RS High, 6M RS High, 3M RS High, 1M RS High
  const [patternFilter, setPatternFilter] = useState('ALL'); // ALL, c_and_h, cup, ANY_BASE
  const [stageFilter, setStageFilter] = useState('ALL'); // ALL, Stage 2A Pivot, Stage 2 Markup, Stage 2 Pullback, Stage 1 Basing
  const [blueDotOnly, setBlueDotOnly] = useState(false);
  const [zacksOnly, setZacksOnly] = useState(false);
  const [skipEarnings, setSkipEarnings] = useState(false);
  const [minAdr, setMinAdr] = useState(1);
  const [maxAdr, setMaxAdr] = useState(15);
  const [personalityFilter, setPersonalityFilter] = useState('ALL'); // ALL, TIGHT, IN_BETWEEN, WIDE
  const [minDailyVol, setMinDailyVol] = useState(400000); // 400K+ shares/day (William O'Neil / MarketSurge daily volume constraint)
  const [minDailyRvol, setMinDailyRvol] = useState(0); // Daily Relative Volume vs 50D avg (e.g. 1.4x = +40% IBD breakout volume)
  const [minDollarVol, setMinDollarVol] = useState(2); // $M/day liquidity filter (reliable across all tickers)
  const [minMcap, setMinMcap] = useState(0); // $B (optional since many tickers have mcap=0 in yq cache)
  const [alertEmail, setAlertEmail] = useState('ranavlsi@gmail.com');

  // Sorting & Pagination State
  const [sortConfig, setSortConfig] = useState({ key: 'rs_alpha_score', direction: 'desc' });
  const [pageSize, setPageSize] = useState(75);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const saved = localStorage.getItem('rsWatchlist');
    if (saved) {
      try {
        setWatchlist(JSON.parse(saved));
      } catch (e) {}
    }
    fetchData();

    const pollAlerts = async () => {
      try {
        const res = await fetch('/live_market_alerts.json?t=' + new Date().getTime());
        if (res.ok) {
          const json = await res.json();
          setLiveAlerts(json.alerts || []);
        }
      } catch (err) {}
    };
    pollAlerts();
    const interval = setInterval(pollAlerts, 12000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const res = await fetch('/rs_scanner_results.json?t=' + new Date().getTime());
      if (res.ok) {
        const json = await res.json();
        const rows = json.results || [];
        setData(rows);
        setLastUpdated(json.last_updated);
        setTotalScanned(json.total_scanned || rows.length);
        if (rows.length > 0 && !selectedTicker) {
          setSelectedTicker(rows[0].ticker);
        }
      }
    } catch (err) {
      console.error('Failed to load RS data', err);
    }
  };

  const runScanner = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/run_rs_scanner', { method: 'POST' });
      if (res.ok) {
        let attempts = 0;
        const interval = setInterval(async () => {
          attempts++;
          await fetchData();
          if (attempts >= 24) {
            clearInterval(interval);
            setLoading(false);
          }
        }, 5000);
      } else {
        alert('Failed to start scanner (server returned error).');
        setLoading(false);
      }
    } catch (err) {
      alert('Failed to start scanner: ' + err.message);
      setLoading(false);
    }
  };

  const toggleWatchlist = (item) => {
    const exists = watchlist.find((w) => w.ticker === item.ticker);
    let updated;
    if (exists) {
      updated = watchlist.filter((w) => w.ticker !== item.ticker);
    } else {
      updated = [...watchlist, { ...item, savedAt: new Date().toISOString() }];
    }
    setWatchlist(updated);
    localStorage.setItem('rsWatchlist', JSON.stringify(updated));
  };

  const handleSendAlert = () => {
    if (!alertEmail) {
      alert('Please enter an email address first.');
      return;
    }
    let body = `Institutional RS Line & Blue Dot Scanner Alert\n\n`;
    filteredAndSortedData.slice(0, 25).forEach((item, i) => {
      body += `${i + 1}. ${item.ticker} ($${Number(item.price || 0).toFixed(2)}) — RS Rating: ${item.rs_rating} | Trend Meter: ${
        item.trend_strength_score || item.rs_rating
      }/100 (${item.trend_meter_label || 'Strong'}) | Badge: ${
        item.is_blue_dot ? 'BLUE DOT PIVOT' : item.rs_badge
      } | Buy Pt: $${Number(item.buy_point || 0).toFixed(2)} (${item.dist_to_pivot_pct >= 0 ? '+' : ''}${
        item.dist_to_pivot_pct
      }%)\n`;
    });
    window.location.href = `mailto:${alertEmail}?subject=Top Institutional RS Line Setups&body=${encodeURIComponent(
      body
    )}`;
  };

  // Summary KPIs across entire loaded dataset
  const summaryStats = useMemo(() => {
    let blueDots3d = 0;
    let blueDotsToday = 0;
    let rs90Plus = 0;
    let powerUptrends = 0;
    let strongUptrends = 0;
    let cupAndHandles = 0;
    let cupsForming = 0;
    let dualHighs = 0;
    let nearBuyPt = 0;

    for (let i = 0; i < data.length; i++) {
      const r = data[i];
      if (r.is_blue_dot) blueDots3d++;
      if (r.is_blue_dot_today) blueDotsToday++;
      if (r.rs_rating >= 90) rs90Plus++;
      if ((r.trend_strength_score || 0) >= 85) powerUptrends++;
      else if ((r.trend_strength_score || 0) >= 70) strongUptrends++;
      if (r.pattern_status === 'c_and_h') cupAndHandles++;
      else if (r.pattern_status === 'cup') cupsForming++;
      if ((r.rs_vs_high || 0) >= 98.0 && (r.rs_qqq_vs_high || 0) >= 98.0) dualHighs++;
      if (
        r.dist_to_pivot_pct !== undefined &&
        r.dist_to_pivot_pct >= -5.0 &&
        r.dist_to_pivot_pct <= 3.0 &&
        r.rs_rating >= 80
      ) {
        nearBuyPt++;
      }
    }

    return {
      total: data.length,
      blueDots3d,
      blueDotsToday,
      rs90Plus,
      powerUptrends,
      strongUptrends,
      cupAndHandles,
      cupsForming,
      dualHighs,
      nearBuyPt,
    };
  }, [data]);

  // Apply Strategy Preset + User Filters + Sorting
  const filteredAndSortedData = useMemo(() => {
    const sourceList = activePreset === 'WATCHLIST' ? watchlist : data;
    const q = searchQuery.trim().toUpperCase();

    const filtered = sourceList.filter((item) => {
      if (q && !item.ticker.toUpperCase().includes(q)) return false;

      // Preset-specific rules
      if (activePreset === 'BLUE_DOT_3D' && !item.is_blue_dot) return false;
      if (activePreset === 'BLUE_DOT_TODAY' && !item.is_blue_dot_today) return false;
      if (activePreset === 'CUP_AND_HANDLE' && item.pattern_status !== 'c_and_h' && item.pattern_status !== 'cup')
        return false;
      if (activePreset === 'MONSTER_90' && (item.rs_rating < 90 || (item.mansfield_rs || 0) < 0)) return false;
      if (activePreset === 'POWER_UPTREND' && (item.trend_strength_score || 0) < 85) return false;
      if (
        activePreset === 'NEAR_BUY_POINT' &&
        (item.dist_to_pivot_pct === undefined ||
          item.dist_to_pivot_pct < -5.0 ||
          item.dist_to_pivot_pct > 3.0 ||
          item.rs_rating < 80)
      )
        return false;
      if (
        activePreset === 'DUAL_BENCHMARK' &&
        ((item.rs_vs_high || 0) < 98.0 || (item.rs_qqq_vs_high || 0) < 98.0)
      )
        return false;
      if (activePreset === 'TIGHT_INSTITUTIONAL' && ((item.adr_pct || 99) > 4.0 || item.rs_rating < 80))
        return false;

      // Manual filters
      if (item.rs_rating < minRating) return false;
      if (minTrendScore > 0 && (item.trend_strength_score || 0) < minTrendScore) return false;
      if (blueDotOnly && !item.is_blue_dot) return false;
      if (rsBadgeFilter !== 'ALL' && item.rs_badge !== rsBadgeFilter) return false;
      if (patternFilter === 'c_and_h' && item.pattern_status !== 'c_and_h') return false;
      if (patternFilter === 'cup' && item.pattern_status !== 'cup') return false;
      if (patternFilter === 'ANY_BASE' && item.pattern_status !== 'c_and_h' && item.pattern_status !== 'cup')
        return false;
      if (stageFilter !== 'ALL' && item.stage_tag !== stageFilter) return false;
      if (zacksOnly && item.zacks_rank > 2) return false;
      if (skipEarnings && item.earnings_days !== 999 && item.earnings_days <= 14) return false;
      if (item.adr_pct < minAdr || item.adr_pct > maxAdr) return false;

      // Daily Trading Volume Constraints (50D Avg Daily Shares & Daily RVOL)
      const avgDailyShares = item.avg_daily_vol_50d ?? Math.round((item.volume_20w_avg || 0) / 5);
      const currDailyShares = item.daily_volume ?? Math.round((item.current_volume || 0) / 5);
      const dRvol = item.daily_rvol ?? item.vol_ratio ?? 1.0;
      if (minDailyVol > 0 && avgDailyShares < minDailyVol && currDailyShares < minDailyVol) return false;
      if (minDailyRvol > 0 && dRvol < minDailyRvol) return false;

      if (minDollarVol > 0 && (item.dollar_vol_m || 0) < minDollarVol) return false;
      if (minMcap > 0 && item.market_cap > 0 && item.market_cap / 1e9 < minMcap) return false;

      if (personalityFilter === 'TIGHT' && item.adr_pct > 3.5) return false;
      if (personalityFilter === 'IN_BETWEEN' && (item.adr_pct <= 3.5 || item.adr_pct > 6.0)) return false;
      if (personalityFilter === 'WIDE' && item.adr_pct <= 6.0) return false;

      return true;
    });

    const { key, direction } = sortConfig;
    const dir = direction === 'asc' ? 1 : -1;

    return [...filtered].sort((a, b) => {
      if (key === 'ticker') {
        return a.ticker.localeCompare(b.ticker) * dir;
      }
      const valA = Number(a[key] ?? -999999);
      const valB = Number(b[key] ?? -999999);
      if (valA === valB) return (b.rs_rating || 0) - (a.rs_rating || 0);
      return (valA - valB) * dir;
    });
  }, [
    data,
    watchlist,
    activePreset,
    searchQuery,
    minRating,
    minTrendScore,
    rsBadgeFilter,
    patternFilter,
    stageFilter,
    blueDotOnly,
    zacksOnly,
    skipEarnings,
    minAdr,
    maxAdr,
    minDailyVol,
    minDailyRvol,
    minDollarVol,
    minMcap,
    personalityFilter,
    sortConfig,
  ]);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [
    activePreset,
    searchQuery,
    minRating,
    minTrendScore,
    rsBadgeFilter,
    patternFilter,
    stageFilter,
    blueDotOnly,
    zacksOnly,
    skipEarnings,
    minAdr,
    maxAdr,
    minDailyVol,
    minDailyRvol,
    minDollarVol,
    minMcap,
    personalityFilter,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSortedData.length / pageSize));
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAndSortedData.slice(start, start + pageSize);
  }, [filteredAndSortedData, currentPage, pageSize]);

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc',
    }));
  };

  const resetAllFilters = () => {
    setActivePreset('ALL');
    setSearchQuery('');
    setMinRating(70);
    setMinTrendScore(0);
    setRsBadgeFilter('ALL');
    setPatternFilter('ALL');
    setStageFilter('ALL');
    setBlueDotOnly(false);
    setZacksOnly(false);
    setSkipEarnings(false);
    setMinAdr(1);
    setMaxAdr(15);
    setPersonalityFilter('ALL');
    setMinDailyVol(0);
    setMinDailyRvol(0);
    setMinDollarVol(0);
    setMinMcap(0);
    setSortConfig({ key: 'rs_alpha_score', direction: 'desc' });
  };

  const formatShares = (shares) => {
    const n = Number(shares || 0);
    if (n <= 0) return '—';
    if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
    if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
    return `${n}`;
  };

  const formatMcap = (val, dollarVolM) => {
    if (val && val > 0) {
      const b = val / 1e9;
      if (b >= 1000) return `$${(b / 1000).toFixed(1)}T`;
      return `$${b.toFixed(1)}B`;
    }
    if (dollarVolM && dollarVolM > 0) {
      return `$${dollarVolM.toFixed(1)}M/d`;
    }
    return 'N/A';
  };

  const SortHeader = ({ label, sortKey, align = 'left', title }) => {
    const isSorted = sortConfig.key === sortKey;
    return (
      <th
        onClick={() => handleSort(sortKey)}
        title={title || `Sort by ${label}`}
        style={{
          padding: '10px 10px',
          textAlign: align,
          cursor: 'pointer',
          userSelect: 'none',
          whiteSpace: 'nowrap',
          color: isSorted ? '#38bdf8' : '#94a3b8',
          fontSize: '0.72rem',
          fontFamily: 'monospace',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          borderBottom: isSorted ? '2px solid #38bdf8' : '1px solid rgba(148,163,184,0.18)',
          background: isSorted ? 'rgba(56, 189, 248, 0.08)' : 'rgba(15, 23, 42, 0.9)',
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          {label}
          {isSorted ? (
            sortConfig.direction === 'desc' ? (
              <ChevronDown size={13} color="#38bdf8" />
            ) : (
              <ChevronUp size={13} color="#38bdf8" />
            )
          ) : (
            <ArrowUpDown size={11} color="#475569" />
          )}
        </span>
      </th>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', color: '#f8fafc' }}>
      {/* ===================================================================== */}
      {/* 1. INSTITUTIONAL COMMAND HEADER & KPI TELEMETRY RIBBON                */}
      {/* ===================================================================== */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.96), rgba(9, 13, 22, 0.98))',
          border: '1px solid rgba(56, 189, 248, 0.25)',
          borderRadius: '12px',
          padding: '1rem 1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.9rem',
        }}
      >
        {/* Top Row: Title, Live Scan Status, Split View Toggle & Actions */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h2
                style={{
                  margin: 0,
                  fontSize: '1.35rem',
                  fontWeight: 900,
                  background: 'linear-gradient(90deg, #38bdf8, #00E676)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <Award size={22} color="#00E676" />
                IBD &amp; MarketSurge Relative Strength (RS) Line Scanner
              </h2>
              <span
                style={{
                  padding: '2px 8px',
                  borderRadius: '5px',
                  background: 'rgba(0, 230, 118, 0.14)',
                  border: '1px solid rgba(0, 230, 118, 0.4)',
                  color: '#00E676',
                  fontFamily: 'monospace',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                }}
              >
                BLUE DOT + MANSFIELD + MARKET-SURGE PIVOTS
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.76rem', color: '#94a3b8', fontFamily: 'monospace' }}>
              <span>
                Universe Scanned: <strong style={{ color: '#e2e8f0' }}>{totalScanned.toLocaleString()}</strong> stocks
              </span>
              <span>·</span>
              <span>
                Matching Filter: <strong style={{ color: '#38bdf8' }}>{filteredAndSortedData.length.toLocaleString()}</strong> setups
              </span>
              {lastUpdated && (
                <>
                  <span>·</span>
                  <span style={{ color: '#10b981' }}>
                    Last Scan: {new Date(lastUpdated).toLocaleString()}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Right Action Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setSplitView((s) => !s)}
              style={{
                padding: '6px 12px',
                borderRadius: '7px',
                border: splitView ? '1px solid #38bdf8' : '1px solid rgba(148,163,184,0.28)',
                background: splitView ? 'rgba(56, 189, 248, 0.22)' : 'rgba(15, 23, 42, 0.8)',
                color: splitView ? '#38bdf8' : '#cbd5e1',
                fontFamily: 'monospace',
                fontSize: '0.76rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
              title="Toggle Split-Screen Interactive RS & MarketSurge Chart Dock alongside the Scanner Table"
            >
              <Columns size={15} />
              {splitView ? 'Hide Split Chart Dock' : 'Split Table + Live Chart'}
            </button>

            <button
              type="button"
              onClick={runScanner}
              disabled={loading}
              style={{
                background: 'linear-gradient(135deg, #059669, #10b981)',
                color: '#ffffff',
                padding: '6px 12px',
                borderRadius: '7px',
                border: '1px solid #34d399',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontFamily: 'monospace',
                fontSize: '0.76rem',
                fontWeight: 800,
              }}
            >
              {loading ? <Loader size={14} className="spin" /> : <RefreshCw size={14} />}
              {loading ? 'Scanning Lakehouse...' : 'Run Fresh RS Scan'}
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <input
                type="email"
                placeholder="alert@email.com"
                value={alertEmail}
                onChange={(e) => setAlertEmail(e.target.value)}
                style={{
                  padding: '5px 8px',
                  borderRadius: '6px',
                  border: '1px solid rgba(148,163,184,0.25)',
                  background: 'rgba(2, 6, 23, 0.7)',
                  color: '#fff',
                  fontSize: '0.74rem',
                  fontFamily: 'monospace',
                  width: '155px',
                }}
              />
              <button
                type="button"
                onClick={handleSendAlert}
                style={{
                  background: 'rgba(59, 130, 246, 0.2)',
                  color: '#60a5fa',
                  padding: '5px 10px',
                  borderRadius: '6px',
                  border: '1px solid rgba(59, 130, 246, 0.45)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                }}
              >
                <Mail size={13} /> Alert
              </button>
            </div>
          </div>
        </div>

        {/* Interactive KPI Cards Strip (Click any card to activate its filter) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))',
            gap: '0.6rem',
          }}
        >
          {[
            {
              id: 'BLUE_DOT_3D',
              title: '🔵 RS BLUE DOT PIVOTS',
              value: summaryStats.blueDots3d,
              sub: `${summaryStats.blueDotsToday} triggered TODAY ⚡`,
              color: '#00E676',
            },
            {
              id: 'MONSTER_90',
              title: '🏆 RS 90+ MONSTER LEADERS',
              value: summaryStats.rs90Plus,
              sub: 'Top 10% 1Y IBD Relative Strength',
              color: '#38bdf8',
            },
            {
              id: 'POWER_UPTREND',
              title: '🔥 POWER UPTRENDS (85+)',
              value: summaryStats.powerUptrends,
              sub: `${summaryStats.strongUptrends} Strong+ (70+ Meter)`,
              color: '#10b981',
            },
            {
              id: 'CUP_AND_HANDLE',
              title: '☕ CUP & HANDLE / BASES',
              value: summaryStats.cupAndHandles + summaryStats.cupsForming,
              sub: `${summaryStats.cupAndHandles} C&H · ${summaryStats.cupsForming} Cups`,
              color: '#c084fc',
            },
            {
              id: 'NEAR_BUY_POINT',
              title: '🎯 IN / NEAR BUY ZONE',
              value: summaryStats.nearBuyPt,
              sub: 'Within -5% to +3% of Buy Pt (RS≥80)',
              color: '#14b8a6',
            },
            {
              id: 'DUAL_BENCHMARK',
              title: '🚀 DUAL SPY + QQQ HIGH',
              value: summaryStats.dualHighs,
              sub: 'RS Line ≥ 98% vs SPY & QQQ',
              color: '#f59e0b',
            },
            {
              id: 'WATCHLIST',
              title: '⭐ SAVED WATCHLIST',
              value: watchlist.length,
              sub: 'Starred RS Line setups',
              color: '#fbbf24',
            },
          ].map((kpi) => {
            const isAct = activePreset === kpi.id;
            return (
              <div
                key={kpi.id}
                onClick={() => setActivePreset(isAct ? 'ALL' : kpi.id)}
                style={{
                  padding: '0.65rem 0.85rem',
                  borderRadius: '9px',
                  background: isAct ? `${kpi.color}1c` : 'rgba(2, 6, 23, 0.65)',
                  border: isAct ? `1px solid ${kpi.color}` : '1px solid rgba(148, 163, 184, 0.14)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ fontSize: '0.66rem', fontFamily: 'monospace', fontWeight: 800, color: kpi.color }}>
                  {kpi.title}
                </div>
                <div
                  style={{
                    fontSize: '1.35rem',
                    fontWeight: 900,
                    fontFamily: 'monospace',
                    color: '#ffffff',
                    marginTop: '2px',
                  }}
                >
                  {kpi.value.toLocaleString()}
                </div>
                <div style={{ fontSize: '0.66rem', color: '#94a3b8', fontFamily: 'monospace' }}>{kpi.sub}</div>
              </div>
            );
          })}
        </div>

        {/* Strategy Preset Ribbon */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          {STRATEGY_PRESETS.map((p) => {
            const active = activePreset === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setActivePreset(p.id)}
                title={p.desc}
                style={{
                  padding: '5px 10px',
                  borderRadius: '6px',
                  border: active ? '1px solid #38bdf8' : '1px solid rgba(148, 163, 184, 0.18)',
                  background: active ? 'rgba(56, 189, 248, 0.2)' : 'rgba(15, 23, 42, 0.65)',
                  color: active ? '#38bdf8' : '#cbd5e1',
                  fontFamily: 'monospace',
                  fontSize: '0.73rem',
                  fontWeight: active ? 800 : 600,
                  cursor: 'pointer',
                }}
              >
                {p.label}
                {p.id === 'WATCHLIST' ? ` (${watchlist.length})` : ''}
              </button>
            );
          })}
          <button
            type="button"
            onClick={resetAllFilters}
            style={{
              marginLeft: 'auto',
              padding: '5px 10px',
              borderRadius: '6px',
              border: '1px solid rgba(248, 113, 113, 0.35)',
              background: 'rgba(239, 68, 68, 0.12)',
              color: '#f87171',
              fontFamily: 'monospace',
              fontSize: '0.71rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Reset Filters
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 2. LIVE INTRADAY BREAKOUT ALERTS (IF PRESENT)                         */}
      {/* ===================================================================== */}
      {liveAlerts.length > 0 && (
        <div
          style={{
            padding: '0.75rem 1rem',
            background: 'rgba(239, 68, 68, 0.09)',
            border: '1px solid rgba(239, 68, 68, 0.45)',
            borderRadius: '10px',
          }}
        >
          <div
            style={{
              fontSize: '0.78rem',
              fontWeight: 900,
              color: '#f87171',
              fontFamily: 'monospace',
              marginBottom: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            🔥 LIVE INTRADAY PIVOT BREAKOUT ALERTS
          </div>
          <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '4px' }}>
            {liveAlerts.map((alert, i) => (
              <div
                key={i}
                onClick={() => onTickerClick && onTickerClick(alert.ticker)}
                style={{
                  cursor: 'pointer',
                  background: 'rgba(15, 23, 42, 0.9)',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  borderLeft: '3px solid #ef4444',
                  minWidth: '185px',
                  fontFamily: 'monospace',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ color: '#fff', fontSize: '0.88rem' }}>{alert.ticker}</strong>
                  <span style={{ color: '#10b981', fontWeight: 800, fontSize: '0.78rem' }}>
                    +{Number(alert.pct_above || 0).toFixed(2)}%
                  </span>
                </div>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '2px' }}>
                  Pivot: ${Number(alert.trigger_price || 0).toFixed(2)} ➔ ${Number(alert.price || 0).toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 3. MULTI-FACTOR QUANT FILTER BAR                                      */}
      {/* ===================================================================== */}
      <div
        style={{
          background: 'rgba(15, 23, 42, 0.85)',
          border: '1px solid rgba(148, 163, 184, 0.16)',
          borderRadius: '10px',
          padding: '0.85rem 1rem',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '14px',
          alignItems: 'flex-end',
        }}
      >
        {/* Ticker Search */}
        <div>
          <label style={{ display: 'block', fontSize: '0.68rem', color: '#94a3b8', fontFamily: 'monospace', marginBottom: '4px' }}>
            SEARCH TICKER
          </label>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: '#090d16',
              border: '1px solid rgba(56, 189, 248, 0.35)',
              borderRadius: '6px',
              padding: '4px 8px',
            }}
          >
            <Search size={13} color="#38bdf8" style={{ marginRight: '5px' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="NVDA, SOFI, PLTR..."
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: '#fff',
                fontFamily: 'monospace',
                fontSize: '0.76rem',
                width: '125px',
              }}
            />
            {searchQuery && (
              <X
                size={12}
                color="#94a3b8"
                style={{ cursor: 'pointer' }}
                onClick={() => setSearchQuery('')}
              />
            )}
          </div>
        </div>

        {/* Min RS Rating */}
        <div>
          <label style={{ display: 'block', fontSize: '0.68rem', color: '#94a3b8', fontFamily: 'monospace', marginBottom: '4px' }}>
            MIN RS RATING
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {[50, 70, 80, 85, 90, 95].map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => setMinRating(val)}
                style={{
                  padding: '4px 7px',
                  borderRadius: '5px',
                  border: minRating === val ? '1px solid #10b981' : '1px solid rgba(148,163,184,0.2)',
                  background: minRating === val ? 'rgba(16, 185, 129, 0.2)' : '#090d16',
                  color: minRating === val ? '#10b981' : '#94a3b8',
                  fontFamily: 'monospace',
                  fontSize: '0.72rem',
                  fontWeight: minRating === val ? 800 : 600,
                  cursor: 'pointer',
                }}
              >
                {val}+
              </button>
            ))}
          </div>
        </div>

        {/* Trend Strength Meter Filter */}
        <div>
          <label
            style={{
              display: 'block',
              fontSize: '0.68rem',
              color: '#00E676',
              fontFamily: 'monospace',
              fontWeight: 800,
              marginBottom: '4px',
            }}
          >
            🔥 TREND STRENGTH METER
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {[
              { val: 0, label: 'Any' },
              { val: 55, label: '55+ Dev' },
              { val: 70, label: '70+ Strong' },
              { val: 85, label: '85+ Power' },
            ].map((opt) => {
              const active = minTrendScore === opt.val;
              return (
                <button
                  key={opt.val}
                  type="button"
                  onClick={() => setMinTrendScore(opt.val)}
                  style={{
                    padding: '4px 7px',
                    borderRadius: '5px',
                    border: active ? '1px solid #00E676' : '1px solid rgba(148,163,184,0.2)',
                    background: active ? 'rgba(0, 230, 118, 0.2)' : '#090d16',
                    color: active ? '#00E676' : '#94a3b8',
                    fontFamily: 'monospace',
                    fontSize: '0.72rem',
                    fontWeight: active ? 800 : 600,
                    cursor: 'pointer',
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* RS Horizon Peak Filter */}
        <div>
          <label style={{ display: 'block', fontSize: '0.68rem', color: '#94a3b8', fontFamily: 'monospace', marginBottom: '4px' }}>
            RS HIGH HORIZON
          </label>
          <select
            value={rsBadgeFilter}
            onChange={(e) => setRsBadgeFilter(e.target.value)}
            style={{
              padding: '5px 8px',
              background: '#090d16',
              border: '1px solid rgba(148,163,184,0.25)',
              color: '#e2e8f0',
              borderRadius: '6px',
              fontFamily: 'monospace',
              fontSize: '0.74rem',
            }}
          >
            <option value="ALL">All RS Horizons</option>
            <option value="12M RS High">⭐ 12M RS New High</option>
            <option value="6M RS High">🌟 6M RS High</option>
            <option value="3M RS High">📈 3M RS High</option>
            <option value="1M RS High">⚡ 1M RS High</option>
          </select>
        </div>

        {/* Base Pattern Filter */}
        <div>
          <label style={{ display: 'block', fontSize: '0.68rem', color: '#94a3b8', fontFamily: 'monospace', marginBottom: '4px' }}>
            MARKET-SURGE PATTERN
          </label>
          <select
            value={patternFilter}
            onChange={(e) => setPatternFilter(e.target.value)}
            style={{
              padding: '5px 8px',
              background: '#090d16',
              border: '1px solid rgba(148,163,184,0.25)',
              color: '#e2e8f0',
              borderRadius: '6px',
              fontFamily: 'monospace',
              fontSize: '0.74rem',
            }}
          >
            <option value="ALL">All Base Structures</option>
            <option value="c_and_h">☕ Cup with Handle Only</option>
            <option value="cup">◡ Forming Cup Base</option>
            <option value="ANY_BASE">🏆 Any Cup / Handle Base</option>
          </select>
        </div>

        {/* Weinstein Stage Filter */}
        <div>
          <label style={{ display: 'block', fontSize: '0.68rem', color: '#94a3b8', fontFamily: 'monospace', marginBottom: '4px' }}>
            STAGE &amp; MA STRUCTURE
          </label>
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            style={{
              padding: '5px 8px',
              background: '#090d16',
              border: '1px solid rgba(148,163,184,0.25)',
              color: '#e2e8f0',
              borderRadius: '6px',
              fontFamily: 'monospace',
              fontSize: '0.74rem',
            }}
          >
            <option value="ALL">All Stages</option>
            <option value="Stage 2A Pivot">🟢 Stage 2A Pivot (Near Buy Pt)</option>
            <option value="Stage 2 Markup">🔵 Stage 2 Markup (&gt;10W/40W)</option>
            <option value="Stage 2 Pullback">🟡 Stage 2 Pullback (&gt;40W)</option>
            <option value="Stage 1 Basing">⚪ Stage 1 Basing</option>
          </select>
        </div>

        {/* Min Daily Trading Volume (Shares/Day — O'Neil / MarketSurge Standard) */}
        <div>
          <label
            style={{
              display: 'block',
              fontSize: '0.68rem',
              color: '#00E676',
              fontFamily: 'monospace',
              fontWeight: 800,
              marginBottom: '4px',
            }}
          >
            DAILY VOLUME (SHARES/DAY)
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {[
              { val: 0, label: 'Any' },
              { val: 250000, label: '250K+' },
              { val: 400000, label: '400K+ (IBD)' },
              { val: 500000, label: '500K+' },
              { val: 1000000, label: '1M+' },
              { val: 2000000, label: '2M+' },
            ].map((opt) => {
              const active = minDailyVol === opt.val;
              return (
                <button
                  key={opt.val}
                  type="button"
                  onClick={() => setMinDailyVol(opt.val)}
                  style={{
                    padding: '4px 7px',
                    borderRadius: '5px',
                    border: active ? '1px solid #00E676' : '1px solid rgba(148,163,184,0.2)',
                    background: active ? 'rgba(0, 230, 118, 0.18)' : '#090d16',
                    color: active ? '#00E676' : '#94a3b8',
                    fontFamily: 'monospace',
                    fontSize: '0.71rem',
                    fontWeight: active ? 800 : 600,
                    cursor: 'pointer',
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Min Daily Relative Volume (RVOL vs 50D Avg) */}
        <div>
          <label style={{ display: 'block', fontSize: '0.68rem', color: '#94a3b8', fontFamily: 'monospace', marginBottom: '4px' }}>
            DAILY RVOL (VS 50D)
          </label>
          <select
            value={minDailyRvol}
            onChange={(e) => setMinDailyRvol(Number(e.target.value))}
            style={{
              padding: '5px 8px',
              background: '#090d16',
              border: '1px solid rgba(148,163,184,0.25)',
              color: '#e2e8f0',
              borderRadius: '6px',
              fontFamily: 'monospace',
              fontSize: '0.74rem',
            }}
          >
            <option value={0}>Any Daily RVOL</option>
            <option value={1.0}>≥ 1.0x (Above 50D Avg)</option>
            <option value={1.25}>≥ 1.25x (+25% Vol)</option>
            <option value={1.4}>🔥 ≥ 1.4x (+40% IBD Breakout)</option>
            <option value={2.0}>🚀 ≥ 2.0x (200% Surge)</option>
          </select>
        </div>

        {/* Min Liquidity ($M/day Dollar Volume) */}
        <div>
          <label style={{ display: 'block', fontSize: '0.68rem', color: '#94a3b8', fontFamily: 'monospace', marginBottom: '4px' }}>
            MIN DOLLAR VOL ($M/D)
          </label>
          <select
            value={minDollarVol}
            onChange={(e) => setMinDollarVol(Number(e.target.value))}
            style={{
              padding: '5px 8px',
              background: '#090d16',
              border: '1px solid rgba(148,163,184,0.25)',
              color: '#e2e8f0',
              borderRadius: '6px',
              fontFamily: 'monospace',
              fontSize: '0.74rem',
            }}
          >
            <option value={0}>Any ($0M+)</option>
            <option value={2}>$2M+ / day</option>
            <option value={10}>$10M+ / day (Liquid)</option>
            <option value={25}>$25M+ / day (Institutional)</option>
            <option value={50}>$50M+ / day (Heavy Inst)</option>
          </select>
        </div>

        {/* ADR% Range */}
        <div>
          <label style={{ display: 'block', fontSize: '0.68rem', color: '#94a3b8', fontFamily: 'monospace', marginBottom: '4px' }}>
            ADR% RANGE
          </label>
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            <input
              type="number"
              value={minAdr}
              onChange={(e) => setMinAdr(Number(e.target.value))}
              style={{
                width: '44px',
                padding: '4px 6px',
                background: '#090d16',
                border: '1px solid rgba(148,163,184,0.25)',
                color: '#fff',
                borderRadius: '5px',
                fontFamily: 'monospace',
                fontSize: '0.74rem',
              }}
            />
            <span style={{ color: '#64748b' }}>-</span>
            <input
              type="number"
              value={maxAdr}
              onChange={(e) => setMaxAdr(Number(e.target.value))}
              style={{
                width: '44px',
                padding: '4px 6px',
                background: '#090d16',
                border: '1px solid rgba(148,163,184,0.25)',
                color: '#fff',
                borderRadius: '5px',
                fontFamily: 'monospace',
                fontSize: '0.74rem',
              }}
            />
          </div>
        </div>

        {/* Ross Haber Personality */}
        <div>
          <label style={{ display: 'block', fontSize: '0.68rem', color: '#94a3b8', fontFamily: 'monospace', marginBottom: '4px' }}>
            STOCK PERSONALITY
          </label>
          <div style={{ display: 'flex', gap: '4px' }}>
            {[
              { key: 'ALL', label: 'All' },
              { key: 'TIGHT', label: '🟢 ≤3.5%' },
              { key: 'IN_BETWEEN', label: '🟡 3.5-6%' },
              { key: 'WIDE', label: '🔴 >6%' },
            ].map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setPersonalityFilter(opt.key)}
                style={{
                  background: personalityFilter === opt.key ? 'rgba(56, 189, 248, 0.2)' : '#090d16',
                  color: personalityFilter === opt.key ? '#38bdf8' : '#94a3b8',
                  border:
                    personalityFilter === opt.key
                      ? '1px solid #38bdf8'
                      : '1px solid rgba(148,163,184,0.2)',
                  padding: '4px 7px',
                  borderRadius: '5px',
                  fontSize: '0.72rem',
                  fontFamily: 'monospace',
                  cursor: 'pointer',
                  fontWeight: personalityFilter === opt.key ? 800 : 500,
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Checkboxes */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingBottom: '3px', flexWrap: 'wrap' }}>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              cursor: 'pointer',
              color: '#00E676',
              fontWeight: 800,
              fontSize: '0.74rem',
              fontFamily: 'monospace',
            }}
          >
            <input
              type="checkbox"
              checked={blueDotOnly}
              onChange={(e) => setBlueDotOnly(e.target.checked)}
            />
            🔵 Blue Dot (3D)
          </label>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              cursor: 'pointer',
              color: '#cbd5e1',
              fontSize: '0.74rem',
              fontFamily: 'monospace',
            }}
          >
            <input
              type="checkbox"
              checked={zacksOnly}
              onChange={(e) => setZacksOnly(e.target.checked)}
            />
            🔥 Zacks #1 &amp; #2
          </label>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              cursor: 'pointer',
              color: '#cbd5e1',
              fontSize: '0.74rem',
              fontFamily: 'monospace',
            }}
          >
            <input
              type="checkbox"
              checked={skipEarnings}
              onChange={(e) => setSkipEarnings(e.target.checked)}
            />
            🛡️ Skip Earnings ≤14d
          </label>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 4. MAIN WORKSPACE: FULL TABLE OR SPLIT-SCREEN TABLE + LIVE RS CHART   */}
      {/* ===================================================================== */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: splitView ? 'minmax(0, 1.15fr) minmax(480px, 0.95fr)' : 'minmax(0, 1fr)',
          gap: '1rem',
          alignItems: 'start',
        }}
      >
        {/* LEFT: High-Density Institutional RS Line Table */}
        <div
          style={{
            background: 'rgba(9, 13, 22, 0.92)',
            border: '1px solid rgba(148, 163, 184, 0.16)',
            borderRadius: '12px',
            overflow: 'hidden',
          }}
        >
          {/* Pagination & Sort Info Strip */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.5rem',
              padding: '0.55rem 0.9rem',
              background: 'rgba(15, 23, 42, 0.95)',
              borderBottom: '1px solid rgba(148, 163, 184, 0.14)',
              fontFamily: 'monospace',
              fontSize: '0.72rem',
            }}
          >
            <div style={{ color: '#94a3b8' }}>
              Showing{' '}
              <strong style={{ color: '#fff' }}>
                {filteredAndSortedData.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}–
                {Math.min(currentPage * pageSize, filteredAndSortedData.length)}
              </strong>{' '}
              of <strong style={{ color: '#38bdf8' }}>{filteredAndSortedData.length.toLocaleString()}</strong> RS leaders
              <span style={{ color: '#64748b', marginLeft: '8px' }}>
                (Click any column header to sort)
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#64748b' }}>Rows:</span>
              {[50, 75, 150, 300].map((sz) => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => setPageSize(sz)}
                  style={{
                    padding: '2px 6px',
                    borderRadius: '4px',
                    border: pageSize === sz ? '1px solid #38bdf8' : '1px solid rgba(148,163,184,0.2)',
                    background: pageSize === sz ? 'rgba(56, 189, 248, 0.18)' : 'transparent',
                    color: pageSize === sz ? '#38bdf8' : '#94a3b8',
                    fontFamily: 'monospace',
                    fontSize: '0.69rem',
                    cursor: 'pointer',
                  }}
                >
                  {sz}
                </button>
              ))}
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '6px' }}>
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  style={{
                    padding: '2px 8px',
                    borderRadius: '4px',
                    border: '1px solid rgba(148,163,184,0.25)',
                    background: 'rgba(15, 23, 42, 0.8)',
                    color: currentPage <= 1 ? '#475569' : '#e2e8f0',
                    cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
                    fontFamily: 'monospace',
                  }}
                >
                  ◀ Prev
                </button>
                <span style={{ color: '#cbd5e1', padding: '0 4px' }}>
                  Page {currentPage}/{totalPages}
                </span>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  style={{
                    padding: '2px 8px',
                    borderRadius: '4px',
                    border: '1px solid rgba(148,163,184,0.25)',
                    background: 'rgba(15, 23, 42, 0.8)',
                    color: currentPage >= totalPages ? '#475569' : '#e2e8f0',
                    cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
                    fontFamily: 'monospace',
                  }}
                >
                  Next ▶
                </button>
              </div>
            </div>
          </div>

          <div style={{ overflowX: 'auto', maxHeight: splitView ? '800px' : 'none' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 5 }}>
                <tr>
                  <th
                    style={{
                      padding: '10px 8px',
                      background: 'rgba(15, 23, 42, 0.9)',
                      borderBottom: '1px solid rgba(148,163,184,0.18)',
                      color: '#94a3b8',
                      fontSize: '0.72rem',
                    }}
                  >
                    ★
                  </th>
                  <SortHeader label="Ticker / Stage" sortKey="ticker" />
                  <th
                    style={{
                      padding: '10px 8px',
                      background: 'rgba(15, 23, 42, 0.9)',
                      borderBottom: '1px solid rgba(148,163,184,0.18)',
                      color: '#94a3b8',
                      fontSize: '0.72rem',
                      fontFamily: 'monospace',
                    }}
                  >
                    CHART / FULL
                  </th>
                  <SortHeader
                    label="RS Alpha"
                    sortKey="rs_alpha_score"
                    title="Composite RS Alpha Score (0-99) combining IBD RS Rating, 52W RS Proximity, Blue Dot Lead, Mansfield RS & Base Quality"
                  />
                  <SortHeader
                    label="Trend Meter"
                    sortKey="trend_strength_score"
                    title="Multi-Factor Institutional Trend Strength Meter (0-99): Moving Average Stack (21EMA > 50SMA > 200SMA), MA Slope, 52W High Proximity & RS Confirmation"
                  />
                  <SortHeader
                    label="IBD RS Rating"
                    sortKey="rs_rating"
                    title="Official William O'Neil 1-Year Weighted Relative Strength Percentile (1-99)"
                  />
                  <SortHeader
                    label="RS Pivot & Blue Dot"
                    sortKey="blue_dot_lead_pct"
                    title="RS Blue Dot Pivot (RS Line at 52W High before Price) and Multi-Timeframe RS High Status"
                  />
                  <SortHeader
                    label="RS vs SPY / QQQ"
                    sortKey="rs_vs_high"
                    title="RS Line Proximity (%) to 52-Week RS Peak vs S&P 500 (SPY) and Nasdaq-100 (QQQ)"
                  />
                  <SortHeader
                    label="Mansfield RS"
                    sortKey="mansfield_rs"
                    title="Stan Weinstein Mansfield RS vs 52-Week SMA Zero-Line & 5-Week Acceleration Slope"
                  />
                  <SortHeader
                    label="MarketSurge Buy Pt"
                    sortKey="dist_to_pivot_pct"
                    title="Detected Base Pattern, Official MarketSurge Buy Point ($), 5% Buy Zone, and Live % Distance to Pivot"
                  />
                  <th
                    style={{
                      padding: '10px 8px',
                      background: 'rgba(15, 23, 42, 0.9)',
                      borderBottom: '1px solid rgba(148,163,184,0.18)',
                      color: '#94a3b8',
                      fontSize: '0.72rem',
                      fontFamily: 'monospace',
                    }}
                  >
                    52W RS LINE
                  </th>
                  <SortHeader
                    label="Daily Vol (50D)"
                    sortKey="avg_daily_vol_50d"
                    title="50-Day Average Daily Trading Volume (Shares/Day), Today's Daily Volume, and Daily RVOL vs 50D Avg"
                  />
                  <SortHeader
                    label="Dollar Vol / MCap"
                    sortKey="dollar_vol_m"
                    title="50-Day Average Daily Dollar Volume ($M/day) and Market Capitalization"
                  />
                  <SortHeader
                    label="ADR% / Tier"
                    sortKey="adr_pct"
                    title="Average Daily Range % and Ross Haber Position Sizing Personality"
                  />
                  <SortHeader label="Zacks / Earn" sortKey="zacks_rank" />
                </tr>
              </thead>
              <tbody>
                {paginatedData.map((item) => {
                  const isSaved = watchlist.some((w) => w.ticker === item.ticker);
                  const isSelectedInSplit = splitView && selectedTicker === item.ticker;

                  let rsColor = '#ef4444';
                  if (item.rs_rating >= 90) rsColor = '#10b981';
                  else if (item.rs_rating >= 80) rsColor = '#38bdf8';
                  else if (item.rs_rating >= 65) rsColor = '#f59e0b';

                  const alphaScore = item.rs_alpha_score || item.rs_rating;
                  const distPivot = Number(item.dist_to_pivot_pct ?? 0);
                  const inBuyZone = distPivot >= 0 && distPivot <= 5.0;
                  const nearPivot = distPivot >= -4.0 && distPivot < 0;

                  let earnColor = '#64748b';
                  let earnText = '—';
                  if (item.earnings_days !== 999 && item.earnings_days !== undefined) {
                    earnText = `${item.earnings_days}d`;
                    if (item.earnings_days <= 7) earnColor = '#ef4444';
                    else if (item.earnings_days <= 14) earnColor = '#f59e0b';
                    else earnColor = '#10b981';
                  }

                  return (
                    <tr
                      key={item.ticker}
                      onClick={() => {
                        if (splitView) setSelectedTicker(item.ticker);
                      }}
                      style={{
                        borderBottom: '1px solid rgba(148, 163, 184, 0.08)',
                        background: isSelectedInSplit
                          ? 'rgba(56, 189, 248, 0.12)'
                          : 'transparent',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelectedInSplit)
                          e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelectedInSplit) e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      {/* 1. Watchlist Star */}
                      <td
                        style={{
                          padding: '10px 8px',
                          cursor: 'pointer',
                          color: isSaved ? '#fbbf24' : '#475569',
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleWatchlist(item);
                        }}
                      >
                        <Star size={15} fill={isSaved ? '#fbbf24' : 'none'} />
                      </td>

                      {/* 2. Ticker, Price & Stage */}
                      <TickerCell
                        item={item}
                        onClick={onTickerClick}
                        onInspectChart={(sym) => {
                          setSelectedTicker(sym);
                          setActiveModalTicker(sym);
                        }}
                      />

                      {/* 3. Chart & Full Chart Action Buttons */}
                      <td style={{ padding: '10px 8px', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTicker(item.ticker);
                              setModalFullscreen(false);
                              setActiveModalTicker(item.ticker);
                            }}
                            title={`Open Interactive 4-Pane RS & MarketSurge Chart for ${item.ticker}`}
                            style={{
                              background: 'rgba(56, 189, 248, 0.15)',
                              border: '1px solid rgba(56, 189, 248, 0.45)',
                              color: '#38bdf8',
                              borderRadius: '5px',
                              padding: '3px 7px',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '0.72rem',
                              fontFamily: 'monospace',
                              fontWeight: 700,
                            }}
                          >
                            <BarChart2 size={12} /> Chart
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (typeof onOpenDeepChart === 'function') {
                                onOpenDeepChart(item.ticker, true);
                              } else {
                                setSelectedTicker(item.ticker);
                                setModalFullscreen(true);
                                setActiveModalTicker(item.ticker);
                              }
                            }}
                            title={`Launch Full-Screen Institutional Chart for ${item.ticker}`}
                            style={{
                              background: 'rgba(0, 230, 118, 0.14)',
                              border: '1px solid rgba(0, 230, 118, 0.45)',
                              color: '#00E676',
                              borderRadius: '5px',
                              padding: '3px 6px',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                              fontSize: '0.7rem',
                              fontFamily: 'monospace',
                              fontWeight: 800,
                            }}
                          >
                            <Maximize2 size={11} /> Full
                          </button>
                        </div>
                      </td>

                      {/* 4. Composite RS Alpha Score */}
                      <td style={{ padding: '10px 8px', fontFamily: 'monospace' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minWidth: '34px',
                            padding: '2px 7px',
                            borderRadius: '6px',
                            fontWeight: 900,
                            fontSize: '0.8rem',
                            background:
                              alphaScore >= 90
                                ? 'rgba(0, 230, 118, 0.18)'
                                : alphaScore >= 80
                                ? 'rgba(56, 189, 248, 0.18)'
                                : 'rgba(245, 158, 11, 0.16)',
                            border:
                              alphaScore >= 90
                                ? '1px solid rgba(0, 230, 118, 0.5)'
                                : alphaScore >= 80
                                ? '1px solid rgba(56, 189, 248, 0.45)'
                                : '1px solid rgba(245, 158, 11, 0.4)',
                            color:
                              alphaScore >= 90
                                ? '#00E676'
                                : alphaScore >= 80
                                ? '#38bdf8'
                                : '#fbbf24',
                          }}
                        >
                          {alphaScore}
                        </span>
                      </td>

                      {/* 4B. Multi-Factor Trend Strength Meter (5-Bar Gauge + Score + MA Stack) */}
                      <td style={{ padding: '10px 8px', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                        {(() => {
                          const tScore = Number(item.trend_strength_score ?? 50);
                          const tBars =
                            item.trend_meter_bars ||
                            (tScore >= 85 ? 5 : tScore >= 70 ? 4 : tScore >= 55 ? 3 : tScore >= 38 ? 2 : 1);
                          const tColor =
                            item.trend_meter_color ||
                            (tScore >= 85
                              ? '#00E676'
                              : tScore >= 70
                              ? '#10b981'
                              : tScore >= 55
                              ? '#38bdf8'
                              : tScore >= 38
                              ? '#f59e0b'
                              : '#ef4444');
                          const tLabel =
                            item.trend_meter_label ||
                            (tScore >= 85
                              ? 'POWER UPTREND'
                              : tScore >= 70
                              ? 'STRONG UPTREND'
                              : tScore >= 55
                              ? 'DEVELOPING'
                              : tScore >= 38
                              ? 'CONSOLIDATING'
                              : 'WEAK / LAGGING');
                          const dist50 = Number(item.dist_50sma_pct ?? 0);
                          return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                              {/* Top Row: 5-Segment Power Bar + Numeric Score + Regime Badge */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <div
                                  title={`Trend Strength Score: ${tScore}/99 (${tLabel})`}
                                  style={{ display: 'inline-flex', alignItems: 'flex-end', gap: '2px', height: '13px' }}
                                >
                                  {[1, 2, 3, 4, 5].map((barIdx) => {
                                    const activeBar = barIdx <= tBars;
                                    const barHeights = ['5px', '7px', '9px', '11px', '13px'];
                                    return (
                                      <span
                                        key={barIdx}
                                        style={{
                                          width: '4px',
                                          height: barHeights[barIdx - 1],
                                          borderRadius: '1.5px',
                                          background: activeBar ? tColor : 'rgba(148, 163, 184, 0.18)',
                                          boxShadow: activeBar && tScore >= 85 ? `0 0 5px ${tColor}80` : 'none',
                                        }}
                                      />
                                    );
                                  })}
                                </div>
                                <span style={{ color: tColor, fontWeight: 900, fontSize: '0.82rem' }}>{tScore}</span>
                                <span
                                  style={{
                                    fontSize: '0.62rem',
                                    fontWeight: 800,
                                    padding: '1px 5px',
                                    borderRadius: '4px',
                                    background: `${tColor}1a`,
                                    border: `1px solid ${tColor}55`,
                                    color: tColor,
                                  }}
                                >
                                  {tScore >= 85 ? '🔥 ' : ''}
                                  {tLabel}
                                </span>
                              </div>
                              {/* Bottom Row: Moving Average Alignment Pills (21E / 50S / 200S) + 50SMA Extension */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.62rem' }}>
                                {[
                                  { k: '21E', ok: item.above_21d !== false },
                                  { k: '50S', ok: item.above_50d !== false },
                                  { k: '200S', ok: item.above_200d !== false },
                                ].map((ma) => (
                                  <span
                                    key={ma.k}
                                    title={ma.ok ? `Price Above ${ma.k}` : `Price Below ${ma.k}`}
                                    style={{
                                      padding: '0px 3.5px',
                                      borderRadius: '3px',
                                      fontWeight: 700,
                                      background: ma.ok ? 'rgba(16, 185, 129, 0.14)' : 'rgba(239, 68, 68, 0.12)',
                                      color: ma.ok ? '#10b981' : '#f87171',
                                      border: ma.ok
                                        ? '1px solid rgba(16, 185, 129, 0.3)'
                                        : '1px solid rgba(239, 68, 68, 0.25)',
                                    }}
                                  >
                                    {ma.k}
                                  </span>
                                ))}
                                <span style={{ color: '#94a3b8', marginLeft: '2px' }}>
                                  50d:{' '}
                                  <strong style={{ color: dist50 >= 0 ? '#cbd5e1' : '#f87171' }}>
                                    {dist50 >= 0 ? `+${dist50.toFixed(1)}%` : `${dist50.toFixed(1)}%`}
                                  </strong>
                                </span>
                              </div>
                            </div>
                          );
                        })()}
                      </td>

                      {/* 5. Official IBD RS Rating + 1Y Weighted Perf */}
                      <td style={{ padding: '10px 8px', fontFamily: 'monospace' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ color: rsColor, fontWeight: 900, fontSize: '0.88rem', width: '22px' }}>
                              {item.rs_rating}
                            </span>
                            <div
                              style={{
                                width: '48px',
                                height: '5px',
                                background: '#1e293b',
                                borderRadius: '3px',
                                overflow: 'hidden',
                              }}
                            >
                              <div
                                style={{
                                  width: `${item.rs_rating}%`,
                                  height: '100%',
                                  background: rsColor,
                                }}
                              />
                            </div>
                          </div>
                          <span style={{ fontSize: '0.66rem', color: '#94a3b8' }}>
                            1Y Wtd:{' '}
                            <strong
                              style={{
                                color: (item.ibd_perf || 0) >= 0 ? '#10b981' : '#f87171',
                              }}
                            >
                              {(item.ibd_perf || 0) >= 0 ? '+' : ''}
                              {((item.ibd_perf || 0) * 100).toFixed(0)}%
                            </strong>
                          </span>
                        </div>
                      </td>

                      {/* 6. RS Pivot & Blue Dot Status */}
                      <td style={{ padding: '10px 8px', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                        {item.is_blue_dot ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span
                              style={{
                                color: '#00E676',
                                background: 'rgba(0, 230, 118, 0.15)',
                                border: '1px solid rgba(0, 230, 118, 0.55)',
                                padding: '2px 7px',
                                borderRadius: '10px',
                                fontSize: '0.71rem',
                                fontWeight: 800,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                            >
                              🔵 Blue Dot{' '}
                              {item.blue_dot_days_ago === 0
                                ? '⚡ TODAY'
                                : `${item.blue_dot_days_ago}d ago`}
                            </span>
                            <span style={{ fontSize: '0.66rem', color: '#38bdf8' }}>
                              +{item.blue_dot_lead_pct}% room to 52W High
                            </span>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            {item.rs_badge === '12M RS High' && (
                              <span
                                style={{
                                  color: '#10b981',
                                  fontSize: '0.73rem',
                                  fontWeight: 800,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                              >
                                <Star size={12} fill="#10b981" /> 12M RS High
                              </span>
                            )}
                            {item.rs_badge === '6M RS High' && (
                              <span
                                style={{
                                  color: '#34d399',
                                  fontSize: '0.73rem',
                                  fontWeight: 700,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                              >
                                <Star size={12} /> 6M RS High
                              </span>
                            )}
                            {item.rs_badge === '3M RS High' && (
                              <span
                                style={{
                                  color: '#f59e0b',
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                }}
                              >
                                <ChevronUp size={13} /> 3M RS High
                              </span>
                            )}
                            {item.rs_badge === '1M RS High' && (
                              <span
                                style={{
                                  color: '#fbbf24',
                                  fontSize: '0.72rem',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                }}
                              >
                                <ChevronUp size={13} /> 1M RS High
                              </span>
                            )}
                            {item.rs_badge === 'None' && (
                              <span style={{ color: '#64748b', fontSize: '0.7rem' }}>Base Forming</span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* 7. Dual Benchmark RS vs 52W High (SPY & QQQ) */}
                      <td style={{ padding: '10px 8px', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '0.71rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <span style={{ color: '#94a3b8', width: '28px' }}>SPY:</span>
                            <strong
                              style={{
                                color: (item.rs_vs_high || 0) >= 98 ? '#00E676' : '#e2e8f0',
                              }}
                            >
                              {Number(item.rs_vs_high || 0).toFixed(1)}%
                            </strong>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <span style={{ color: '#64748b', width: '28px' }}>QQQ:</span>
                            <strong
                              style={{
                                color: (item.rs_qqq_vs_high || 0) >= 98 ? '#38bdf8' : '#94a3b8',
                              }}
                            >
                              {Number(item.rs_qqq_vs_high || 0).toFixed(1)}%
                            </strong>
                          </div>
                        </div>
                      </td>

                      {/* 8. Mansfield RS & 5W Slope */}
                      <td style={{ padding: '10px 8px', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span
                            style={{
                              color: item.mansfield_rs >= 0 ? '#10b981' : '#ef4444',
                              fontWeight: 800,
                              fontSize: '0.78rem',
                            }}
                          >
                            {item.mansfield_rs >= 0
                              ? `+${item.mansfield_rs?.toFixed(1)}%`
                              : `${item.mansfield_rs?.toFixed(1)}%`}
                          </span>
                          <span
                            style={{
                              fontSize: '0.67rem',
                              color: item.mansfield_slope > 0 ? '#34d399' : '#f43f5e',
                            }}
                          >
                            5W Slope: {item.mansfield_slope > 0 ? `+${item.mansfield_slope}` : item.mansfield_slope}
                          </span>
                        </div>
                      </td>

                      {/* 9. MarketSurge Pattern & Official Buy Point */}
                      <td style={{ padding: '10px 8px', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            {item.pattern_status === 'c_and_h' ? (
                              <span
                                style={{
                                  color: '#c084fc',
                                  padding: '1px 6px',
                                  background: 'rgba(192, 132, 252, 0.16)',
                                  border: '1px solid rgba(192, 132, 252, 0.45)',
                                  borderRadius: '6px',
                                  fontSize: '0.68rem',
                                  fontWeight: 800,
                                }}
                              >
                                ☕ Cup &amp; Handle ({item.pattern_score})
                              </span>
                            ) : item.pattern_status === 'cup' ? (
                              <span
                                style={{
                                  color: '#f59e0b',
                                  padding: '1px 6px',
                                  background: 'rgba(245, 158, 11, 0.15)',
                                  border: '1px solid rgba(245, 158, 11, 0.4)',
                                  borderRadius: '6px',
                                  fontSize: '0.68rem',
                                  fontWeight: 700,
                                }}
                              >
                                ◡ Cup Base ({item.pattern_score})
                              </span>
                            ) : (
                              <span
                                style={{
                                  color: '#94a3b8',
                                  fontSize: '0.68rem',
                                }}
                              >
                                🎯 52W Pivot
                              </span>
                            )}
                          </div>
                          {item.buy_point > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.7rem' }}>
                              <span style={{ color: '#cbd5e1' }}>
                                Buy Pt: <strong style={{ color: '#10b981' }}>${Number(item.buy_point).toFixed(2)}</strong>
                              </span>
                              <span
                                style={{
                                  padding: '0px 5px',
                                  borderRadius: '4px',
                                  fontSize: '0.65rem',
                                  fontWeight: 800,
                                  background: inBuyZone
                                    ? 'rgba(16, 185, 129, 0.2)'
                                    : nearPivot
                                    ? 'rgba(56, 189, 248, 0.18)'
                                    : 'rgba(148, 163, 184, 0.12)',
                                  color: inBuyZone
                                    ? '#10b981'
                                    : nearPivot
                                    ? '#38bdf8'
                                    : '#94a3b8',
                                }}
                              >
                                {distPivot >= 0 ? '+' : ''}
                                {distPivot.toFixed(1)}%
                              </span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* 10. 52W RS Line Sparkline */}
                      <td
                        style={{ padding: '8px 8px', cursor: 'pointer' }}
                        onMouseEnter={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const renderBelow = rect.top < 160;
                          setHoverInfo({
                            item,
                            x: rect.left + rect.width / 2,
                            y: renderBelow ? rect.bottom + 8 : rect.top - 8,
                            renderBelow,
                          });
                        }}
                        onMouseLeave={() => setHoverInfo(null)}
                      >
                        <RsSparkline
                          data={item.sparkline}
                          status={item.pattern_status}
                          isBlueDot={item.is_blue_dot}
                          rsVsHigh={item.rs_vs_high}
                        />
                      </td>

                      {/* 11. Daily Trading Volume (50D Avg Shares, Today's Volume & Daily RVOL) */}
                      <td style={{ padding: '10px 8px', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                        {(() => {
                          const avg50d = item.avg_daily_vol_50d ?? Math.round((item.volume_20w_avg || 0) / 5);
                          const todayVol = item.daily_volume ?? Math.round((item.current_volume || 0) / 5);
                          const dRvol = Number(item.daily_rvol ?? item.vol_ratio ?? 1);
                          return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '0.71rem' }}>
                              <span style={{ color: avg50d >= 500000 ? '#10b981' : '#e2e8f0', fontWeight: 800 }}>
                                50D: {formatShares(avg50d)}
                              </span>
                              <span
                                style={{
                                  fontSize: '0.66rem',
                                  color:
                                    dRvol >= 1.4
                                      ? '#00f2fe'
                                      : dRvol <= 0.65
                                      ? '#fbbf24'
                                      : '#94a3b8',
                                  fontWeight: dRvol >= 1.4 ? 800 : 600,
                                }}
                              >
                                Day: {formatShares(todayVol)} ({dRvol.toFixed(2)}x{dRvol >= 1.4 ? ' 🔥' : dRvol <= 0.65 ? ' 💧' : ''})
                              </span>
                            </div>
                          );
                        })()}
                      </td>

                      {/* 11b. Daily Dollar Volume ($M/day) & Market Cap */}
                      <td style={{ padding: '10px 8px', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '0.72rem' }}>
                          <span style={{ color: (item.dollar_vol_m || 0) >= 20 ? '#38bdf8' : '#cbd5e1', fontWeight: 700 }}>
                            ${Number(item.dollar_vol_m || 0).toFixed(1)}M/d
                          </span>
                          <span style={{ fontSize: '0.66rem', color: '#94a3b8' }}>
                            {item.market_cap > 0 ? formatMcap(item.market_cap, 0) : 'Liquid Equity'}
                          </span>
                        </div>
                      </td>

                      {/* 12. ADR% & Ross Haber Personality */}
                      <td style={{ padding: '10px 8px', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <span
                            style={{
                              color:
                                item.adr_pct <= 3.5
                                  ? '#10b981'
                                  : item.adr_pct <= 6.0
                                  ? '#f59e0b'
                                  : '#f87171',
                              fontWeight: 800,
                              fontSize: '0.76rem',
                            }}
                          >
                            {item.adr_pct ? `${item.adr_pct.toFixed(1)}% ADR` : '—'}
                          </span>
                          <span
                            style={{
                              fontSize: '0.64rem',
                              color:
                                item.adr_pct <= 3.5
                                  ? '#34d399'
                                  : item.adr_pct <= 6.0
                                  ? '#fbbf24'
                                  : '#fca5a5',
                            }}
                          >
                            {item.adr_pct <= 3.5
                              ? 'Tight (Full)'
                              : item.adr_pct <= 6.0
                              ? 'In-Between'
                              : 'Wide & Loose'}
                          </span>
                        </div>
                      </td>

                      {/* 13. Zacks Rank & Earnings Countdown */}
                      <td style={{ padding: '10px 8px', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '0.72rem' }}>
                          <span>
                            {item.zacks_rank === 1 && (
                              <strong style={{ color: '#10b981' }}>#1 Strong Buy</strong>
                            )}
                            {item.zacks_rank === 2 && <strong style={{ color: '#34d399' }}>#2 Buy</strong>}
                            {item.zacks_rank === 3 && <span style={{ color: '#f59e0b' }}>#3 Hold</span>}
                            {item.zacks_rank >= 4 && (
                              <span style={{ color: '#64748b' }}>#{item.zacks_rank}</span>
                            )}
                          </span>
                          <span
                            style={{
                              fontSize: '0.66rem',
                              color: earnColor,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                            }}
                          >
                            {(earnColor === '#ef4444' || earnColor === '#f59e0b') && (
                              <AlertCircle size={11} />
                            )}
                            Earn: {earnText}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {filteredAndSortedData.length === 0 && (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8', fontFamily: 'monospace' }}>
                <p style={{ margin: '0 0 8px 0', fontSize: '0.95rem', color: '#e2e8f0' }}>
                  No stocks matched the current filter combination.
                </p>
                <button
                  type="button"
                  onClick={resetAllFilters}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '6px',
                    border: '1px solid #38bdf8',
                    background: 'rgba(56, 189, 248, 0.15)',
                    color: '#38bdf8',
                    fontFamily: 'monospace',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Reset All Filters
                </button>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Split-Screen Live RS Line & MarketSurge Chart Dock */}
        {splitView && (
          <div
            style={{
              background: '#070b12',
              border: '1px solid rgba(56, 189, 248, 0.35)',
              borderRadius: '12px',
              overflow: 'hidden',
              position: 'sticky',
              top: '12px',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              style={{
                padding: '0.65rem 1rem',
                background: 'linear-gradient(90deg, rgba(15, 23, 42, 0.98), rgba(9, 13, 22, 0.98))',
                borderBottom: '1px solid rgba(56, 189, 248, 0.25)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    padding: '3px 9px',
                    borderRadius: '6px',
                    background: 'rgba(0, 230, 118, 0.16)',
                    border: '1px solid #00E676',
                    color: '#00E676',
                    fontFamily: 'monospace',
                    fontWeight: 900,
                    fontSize: '0.9rem',
                  }}
                >
                  {selectedTicker}
                </span>
                <span style={{ fontSize: '0.76rem', color: '#cbd5e1', fontFamily: 'monospace' }}>
                  Live RS Line + MarketSurge Pattern Inspector
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setModalFullscreen(true);
                    setActiveModalTicker(selectedTicker);
                  }}
                  style={{
                    padding: '4px 9px',
                    borderRadius: '5px',
                    border: '1px solid rgba(56, 189, 248, 0.45)',
                    background: 'rgba(56, 189, 248, 0.18)',
                    color: '#38bdf8',
                    fontSize: '0.72rem',
                    fontFamily: 'monospace',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <Maximize2 size={12} /> Full Chart
                </button>
                <button
                  type="button"
                  onClick={() => setSplitView(false)}
                  style={{
                    padding: '4px 7px',
                    borderRadius: '5px',
                    border: '1px solid rgba(148,163,184,0.25)',
                    background: 'transparent',
                    color: '#94a3b8',
                    cursor: 'pointer',
                  }}
                >
                  <X size={14} />
                </button>
              </div>
            </div>
            <div style={{ padding: '0.4rem' }}>
              <UnifiedPlotlyChart
                ticker={selectedTicker}
                onSelectTicker={(sym) => setSelectedTicker(sym)}
              />
            </div>
          </div>
        )}
      </div>

      {/* ===================================================================== */}
      {/* 5. SPARKLINE HOVER TELEMETRY POPOVER                                  */}
      {/* ===================================================================== */}
      {hoverInfo && (
        <div
          style={{
            position: 'fixed',
            top: hoverInfo.y,
            left: hoverInfo.x,
            transform: `translateX(-50%) ${hoverInfo.renderBelow ? '' : 'translateY(-100%)'}`,
            background: 'rgba(9, 13, 22, 0.98)',
            border: '1px solid rgba(56, 189, 248, 0.5)',
            padding: '10px 12px',
            borderRadius: '8px',
            zIndex: 999999,
            width: '215px',
            boxShadow: '0 10px 24px rgba(0,0,0,0.75)',
            pointerEvents: 'none',
            fontFamily: 'monospace',
            fontSize: '0.74rem',
          }}
        >
          <div
            style={{
              color: '#38bdf8',
              fontWeight: 900,
              marginBottom: '6px',
              borderBottom: '1px solid rgba(148,163,184,0.16)',
              paddingBottom: '4px',
              textAlign: 'center',
            }}
          >
            {hoverInfo.item.ticker} · 52W RS Line
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
            <span style={{ color: '#94a3b8' }}>52W RS Peak:</span>
            <strong style={{ color: '#10b981' }}>
              {Math.max(...hoverInfo.item.sparkline).toFixed(3)}
            </strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
            <span style={{ color: '#94a3b8' }}>Current RS:</span>
            <strong style={{ color: '#00E676' }}>
              {hoverInfo.item.sparkline[hoverInfo.item.sparkline.length - 1].toFixed(3)} ({hoverInfo.item.rs_vs_high}%)
            </strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
            <span style={{ color: '#94a3b8' }}>52W RS Low:</span>
            <strong style={{ color: '#ef4444' }}>
              {Math.min(...hoverInfo.item.sparkline).toFixed(3)}
            </strong>
          </div>
          {hoverInfo.item.buy_point > 0 && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                borderTop: '1px solid rgba(148,163,184,0.16)',
                paddingTop: '4px',
                marginTop: '4px',
              }}
            >
              <span style={{ color: '#94a3b8' }}>MS Buy Pt:</span>
              <strong style={{ color: '#c084fc' }}>${Number(hoverInfo.item.buy_point).toFixed(2)}</strong>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* 6. INTERACTIVE RS LINE + MARKET-SURGE CHART MODAL                      */}
      {/* ===================================================================== */}
      {activeModalTicker && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(7, 11, 18, 0.88)',
            backdropFilter: 'blur(8px)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: modalFullscreen ? 0 : '1.25rem',
          }}
          onClick={() => setActiveModalTicker(null)}
        >
          <div
            style={{
              background: '#090d16',
              border: modalFullscreen ? 'none' : '1px solid rgba(56, 189, 248, 0.35)',
              borderRadius: modalFullscreen ? 0 : '14px',
              width: modalFullscreen ? '100vw' : '96vw',
              maxWidth: modalFullscreen ? '100vw' : '1440px',
              height: modalFullscreen ? '100vh' : '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: '0.75rem 1.25rem',
                borderBottom: '1px solid rgba(148, 163, 184, 0.16)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#0f172a',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <div
                  style={{
                    background: 'rgba(0, 230, 118, 0.15)',
                    color: '#00E676',
                    border: '1px solid #00E676',
                    borderRadius: '8px',
                    padding: '4px 12px',
                    fontWeight: 900,
                    fontSize: '1.05rem',
                    fontFamily: 'monospace',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <BarChart2 size={17} />
                  <span>{activeModalTicker}</span>
                </div>
                <span style={{ color: '#cbd5e1', fontSize: '0.84rem', fontFamily: 'monospace' }}>
                  Institutional 4-Pane Chart · <strong>IBD Relative Strength (RS) Line</strong> +{' '}
                  <strong style={{ color: '#c084fc' }}>MarketSurge Official Buy Point</strong>
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setModalFullscreen((f) => !f)}
                  style={{
                    background: 'rgba(56, 189, 248, 0.15)',
                    border: '1px solid rgba(56, 189, 248, 0.45)',
                    color: '#38bdf8',
                    borderRadius: '7px',
                    padding: '5px 11px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    fontSize: '0.78rem',
                    fontFamily: 'monospace',
                    fontWeight: 800,
                  }}
                >
                  <Maximize2 size={14} />
                  {modalFullscreen ? 'Windowed Modal' : 'Expand Full Screen'}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveModalTicker(null)}
                  style={{
                    background: 'rgba(239, 68, 68, 0.16)',
                    border: '1px solid rgba(239, 68, 68, 0.45)',
                    color: '#f87171',
                    borderRadius: '7px',
                    padding: '5px 11px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    fontSize: '0.78rem',
                    fontFamily: 'monospace',
                    fontWeight: 800,
                  }}
                >
                  <X size={15} /> Close
                </button>
              </div>
            </div>

            <div style={{ flex: 1, padding: '0.5rem', overflow: 'y-auto', background: '#070b12' }}>
              <UnifiedPlotlyChart
                ticker={activeModalTicker}
                onSelectTicker={(sym) => setActiveModalTicker(sym)}
                externalFullscreen={modalFullscreen}
                onToggleFullscreen={(val) => setModalFullscreen(val)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
