import React, { useState, useEffect, useMemo } from 'react';
import './ScreenerMonitorDashboard.css';
import {
  Crosshair, Zap, Target, TrendingUp, TrendingDown,
  Shield, CheckCircle2, AlertCircle, RefreshCw, Search,
  Filter, Layers, ArrowUpRight, ArrowDownRight, Clock,
  Flame, BarChart2, Radio, Sparkles, Activity, Gauge,
  Volume2, VolumeX, Copy, Check, Sliders, ArrowUpDown,
  Compass, ExternalLink, LayoutGrid, List
} from 'lucide-react';

/**
 * 30-Day Price + EMA10 + EMA21 + Gold RS Line + Dashed Pivot Sparkline
 */
const MonitorSparkline = ({ sparkline, pivotPrice, isBlueDot, width = 240, height = 62, mini = false }) => {
  if (!sparkline || !Array.isArray(sparkline.close) || sparkline.close.length < 5) {
    return (
      <div style={{ width: mini ? 110 : '100%', height: mini ? 32 : height, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(2,6,23,0.45)', borderRadius: 6, fontSize: '0.62rem', color: '#64748b' }}>
        30D Chart
      </div>
    );
  }

  const closes = sparkline.close;
  const ema10 = sparkline.ema10 || [];
  const ema21 = sparkline.ema21 || [];
  const rsNorm = sparkline.rs_norm || [];

  const allVals = [...closes, ...ema10, ...ema21];
  if (pivotPrice && pivotPrice > 0) allVals.push(pivotPrice);

  const minVal = Math.min(...allVals);
  const maxVal = Math.max(...allVals);
  const range = Math.max(0.01, maxVal - minVal);
  const padX = mini ? 3 : 5;
  const padY = mini ? 4 : 6;
  const w = mini ? 115 : width;
  const h = mini ? 34 : height;
  const innerW = w - padX * 2;
  const innerH = h - padY * 2;

  const toPoints = (arr) =>
    arr
      .map((v, i) => {
        const x = padX + (i / Math.max(1, arr.length - 1)) * innerW;
        const y = padY + innerH - ((v - minVal) / range) * innerH;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');

  const closePts = toPoints(closes);
  const ema10Pts = ema10.length === closes.length ? toPoints(ema10) : '';
  const ema21Pts = ema21.length === closes.length ? toPoints(ema21) : '';
  const rsPts = rsNorm.length === closes.length ? toPoints(rsNorm) : '';

  const isUp = closes[closes.length - 1] >= closes[0];
  const strokeColor = isUp ? '#10b981' : '#f59e0b';
  const pivotY = pivotPrice
    ? Math.max(padY, Math.min(h - padY, padY + innerH - ((pivotPrice - minVal) / range) * innerH))
    : null;
  const lastX = padX + innerW;
  const lastY = padY + innerH - ((closes[closes.length - 1] - minVal) / range) * innerH;

  if (mini) {
    return (
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: `${w}px`, height: `${h}px`, display: 'block', overflow: 'visible' }}>
        {pivotY !== null && (
          <line x1={padX} y1={pivotY} x2={w - padX} y2={pivotY} stroke="#00F0FF" strokeWidth="0.9" strokeDasharray="2,2" opacity="0.7" />
        )}
        {rsPts && <polyline fill="none" stroke="#fbbf24" strokeWidth="1.1" points={rsPts} opacity="0.85" />}
        <polyline fill="none" stroke={strokeColor} strokeWidth="1.7" points={closePts} />
        <circle cx={lastX} cy={lastY} r={isBlueDot ? 3 : 2.2} fill={isBlueDot ? '#3b82f6' : strokeColor} stroke="#fff" strokeWidth="0.8" />
      </svg>
    );
  }

  return (
    <div style={{ background: 'rgba(2, 6, 23, 0.65)', borderRadius: '8px', border: '1px solid rgba(51, 65, 85, 0.5)', padding: '5px 8px', margin: '6px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.6rem', color: '#94a3b8', marginBottom: 2 }}>
        <span style={{ fontWeight: 700, color: '#cbd5e1' }}>30D PRICE + EMA10/21 + RS LINE</span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ color: '#38bdf8' }}>― EMA10</span>
          <span style={{ color: '#fbbf24', fontWeight: 700 }}>― RS</span>
          {isBlueDot && (
            <span style={{ background: 'rgba(59,130,246,0.22)', color: '#60a5fa', padding: '0 4px', borderRadius: 3, fontWeight: 800 }}>
              🔵 RS HIGH
            </span>
          )}
        </div>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: `${h}px`, display: 'block', overflow: 'visible' }}>
        {pivotY !== null && (
          <line x1={padX} y1={pivotY} x2={w - padX} y2={pivotY} stroke="#ff3366" strokeWidth="1" strokeDasharray="3,3" opacity="0.8" />
        )}
        {ema21Pts && <polyline fill="none" stroke="#a855f7" strokeWidth="1.1" strokeDasharray="2,2" points={ema21Pts} opacity="0.75" />}
        {ema10Pts && <polyline fill="none" stroke="#38bdf8" strokeWidth="1.2" points={ema10Pts} opacity="0.85" />}
        {rsPts && <polyline fill="none" stroke="#fbbf24" strokeWidth="1.3" points={rsPts} opacity="0.9" />}
        <polyline fill="none" stroke={strokeColor} strokeWidth="2.0" points={closePts} />
        <circle cx={lastX} cy={lastY} r={isBlueDot ? 3.8 : 2.8} fill={isBlueDot ? '#3b82f6' : strokeColor} stroke="#fff" strokeWidth="1.1" />
      </svg>
    </div>
  );
};

export default function ScreenerMonitorDashboard({ onTickerClick }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLive, setIsLive] = useState(true);
  const [countdown, setCountdown] = useState(15);
  const [sseConnected, setSseConnected] = useState(false);

  // Enhanced Features State
  const [audioEnabled, setAudioEnabled] = useState(() => {
    return localStorage.getItem('screener_audio_radar') === 'true';
  });
  const [viewDensity, setViewDensity] = useState('standard'); // 'standard' | 'compact' | 'cards'
  const [sortColumn, setSortColumn] = useState('readiness'); // 'readiness' | 'pivot_distance' | 'vol_pace' | 'gain' | 'alpha_30d' | 'ticker'
  const [sortDirection, setSortDirection] = useState('desc');
  const [copiedBracketTicker, setCopiedBracketTicker] = useState(null);
  const [tvExportSuccess, setTvExportSuccess] = useState(false);

  const playRadarAudio = (type) => {
    if (!audioEnabled) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();

      if (type === 'imminent') {
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(880, ctx.currentTime);
        osc1.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.08);
        gain1.gain.setValueAtTime(0.2, ctx.currentTime);
        gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start();
        osc1.stop(ctx.currentTime + 0.12);
      } else {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(784, ctx.currentTime);
        gain.gain.setValueAtTime(0.18, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.12);
      }
    } catch (e) {
      console.warn('Web Audio synthesis error:', e);
    }
  };

  const toggleAudio = () => {
    const next = !audioEnabled;
    setAudioEnabled(next);
    localStorage.setItem('screener_audio_radar', String(next));
    if (next) playRadarAudio('test');
  };

  const parseSafeJson = (text) => {
    const cleaned = text
      .replace(/:\s*NaN\b/g, ': 0')
      .replace(/:\s*-?Infinity\b/g, ': 0');
    return JSON.parse(cleaned);
  };

  const fetchMonitorData = async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const url = `/api/screener_monitor?status=all&category=all&refresh=${forceRefresh}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Server status: ${res.status}`);
      const text = await res.text();
      const json = parseSafeJson(text);
      if (json.error) {
        throw new Error(json.error);
      }
      setData(json);
    } catch (err) {
      // Resilient fallback to static mirror /screener_monitor.json
      try {
        const fbRes = await fetch(`/screener_monitor.json?t=${Date.now()}`, { cache: 'no-store' });
        if (fbRes.ok) {
          const fbText = await fbRes.text();
          const fbJson = parseSafeJson(fbText);
          setData(fbJson);
          setError(null);
          return;
        }
      } catch (fbErr) {
        // ignore fallback error
      }
      console.error('Failed to load screener surveillance data:', err);
      setError(err.message || 'Failed to fetch screener monitoring data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMonitorData();
  }, []);

  useEffect(() => {
    let es;
    try {
      es = new EventSource('/api/stream');
      es.onopen = () => setSseConnected(true);
      es.onerror = () => setSseConnected(false);
      es.onmessage = (event) => {
        try {
          const alertData = JSON.parse(event.data);
          if (alertData.source === 'screener_monitor' || alertData.council?.includes('SCREENER MONITOR') || alertData.status === 'PRE_FIRE_RADAR') {
            if (alertData.status === 'PRE_FIRE_RADAR') {
              playRadarAudio('imminent');
            }
            fetchMonitorData(false);
            setCountdown(15);
          }
        } catch (e) {
          // ignore
        }
      };
    } catch (e) {
      console.warn('SSE stream error:', e);
    }
    return () => {
      if (es) es.close();
    };
  }, [audioEnabled]);

  useEffect(() => {
    if (!isLive) return;
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          fetchMonitorData(false);
          return 15;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isLive]);

  const kpis = data?.kpis || {};
  const macro = data?.macro_regime || {};
  const categories = data?.categories || [];
  const rawStocks = data?.stocks || [];
  const radarStocks = data?.radar_stocks || [];

  // Filter & Sort Stocks client-side for instantaneous responsiveness
  const filteredStocks = useMemo(() => {
    let list = [...rawStocks];

    if (statusFilter !== 'all') {
      if (statusFilter === 'radar') {
        list = list.filter((s) => s.is_flashing || (s.readiness_score || 0) >= 65);
      } else if (statusFilter === 'triggered') {
        list = list.filter((s) => s.lifecycle_status === 'TRIGGERED');
      } else if (statusFilter === 'pending') {
        list = list.filter((s) => s.lifecycle_status === 'PENDING');
      } else if (statusFilter === 'target_hit') {
        list = list.filter((s) => s.lifecycle_status === 'TARGET_HIT' || s.lifecycle_status === 'TARGET_2_HIT');
      } else if (statusFilter === 'stopped_out') {
        list = list.filter((s) => s.lifecycle_status === 'STOPPED_OUT');
      } else if (statusFilter === 'blue_dot') {
        list = list.filter((s) => s.is_blue_dot);
      } else if (statusFilter === 'multi_engine') {
        list = list.filter((s) => (s.confluence_count || 1) >= 3);
      }
    }

    if (categoryFilter !== 'all') {
      const cf = categoryFilter.toLowerCase();
      list = list.filter((s) => (s.screeners || []).some((sc) => sc.toLowerCase().includes(cf)));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toUpperCase();
      list = list.filter(
        (s) =>
          (s.ticker || '').toUpperCase().includes(q) ||
          (s.name || '').toUpperCase().includes(q) ||
          (s.sector || '').toUpperCase().includes(q) ||
          (s.screeners || []).some((sc) => sc.toUpperCase().includes(q))
      );
    }

    list.sort((a, b) => {
      let valA, valB;
      if (sortColumn === 'readiness') {
        valA = a.readiness_score || 0;
        valB = b.readiness_score || 0;
      } else if (sortColumn === 'pivot_distance') {
        valA = a.dist_to_pivot_pct ?? 999;
        valB = b.dist_to_pivot_pct ?? 999;
      } else if (sortColumn === 'vol_pace') {
        valA = a.vol_surge_ratio || 0;
        valB = b.vol_surge_ratio || 0;
      } else if (sortColumn === 'gain') {
        valA = a.gain_pct || 0;
        valB = b.gain_pct || 0;
      } else if (sortColumn === 'alpha_30d') {
        valA = a.alpha_30d_pct || 0;
        valB = b.alpha_30d_pct || 0;
      } else if (sortColumn === 'progress') {
        valA = a.progress_to_target_pct || 0;
        valB = b.progress_to_target_pct || 0;
      } else if (sortColumn === 'ticker') {
        valA = a.ticker || '';
        valB = b.ticker || '';
        return sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      } else {
        return 0;
      }

      if (sortDirection === 'asc') {
        return valA > valB ? 1 : valA < valB ? -1 : 0;
      } else {
        return valA < valB ? 1 : valA > valB ? -1 : 0;
      }
    });

    return list;
  }, [rawStocks, statusFilter, categoryFilter, searchQuery, sortColumn, sortDirection]);

  const handleSort = (col) => {
    if (sortColumn === col) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(col);
      setSortDirection(col === 'pivot_distance' ? 'asc' : 'desc');
    }
  };

  const copyBracketOrder = (stock) => {
    const text = `🎯 [BRACKET ORDER: $${stock.ticker}] (${stock.confluence_count}x Engine Confluence)
Action: BUY STOP / LIMIT @ $${stock.pivot_price?.toFixed(2)}
Stop Loss: $${stock.stop_loss?.toFixed(2)} (-${(((stock.pivot_price - stock.stop_loss) / stock.pivot_price) * 100).toFixed(1)}%)
Target 1: $${stock.target_1?.toFixed(2)} (+${(((stock.target_1 - stock.pivot_price) / stock.pivot_price) * 100).toFixed(1)}%) [Exit 50%]
Target 2: $${stock.target_2?.toFixed(2)} (+${(((stock.target_2 - stock.pivot_price) / stock.pivot_price) * 100).toFixed(1)}%) [Runner]
RS Rating: ${stock.rs_rating || 85} | 30D Alpha: ${stock.alpha_30d_pct || 0}% | Setup: ${(stock.screeners || []).join(', ')}`;

    navigator.clipboard.writeText(text);
    setCopiedBracketTicker(stock.ticker);
    setTimeout(() => setCopiedBracketTicker(null), 2500);
  };

  const exportTradingViewWatchlist = () => {
    const tickersToExport = filteredStocks.slice(0, 60).map((s) => s.ticker);
    if (!tickersToExport.length) return;
    const text = tickersToExport.join(', ');
    navigator.clipboard.writeText(text);
    setTvExportSuccess(true);
    setTimeout(() => setTvExportSuccess(false), 2500);
  };

  return (
    <div className="monitor-root">
      {/* 1. MASTER HEADER & SURVEILLANCE BANNER */}
      <div className="monitor-header-banner">
        <div className="monitor-header-top">
          <div className="monitor-identity">
            <div className="monitor-logo-box">
              <Crosshair size={24} color="#00F0FF" />
            </div>
            <div className="monitor-titles">
              <h1>
                11-ENGINE SCREENER SURVEILLANCE 3.0 <span className="monitor-badge-tag">PRE-FIRE RADAR + 30D TELEMETRY</span>
              </h1>
              <p className="monitor-subtitle">
                <span className="monitor-pulse-dot" />
                Unified Surveillance across 1-3W Swing, Apex Squeeze, Pre-Breakout Ignition, RS Blue Dot, Minervini VCP, Options Flow &amp; 10Y Seasonality
              </p>
            </div>
          </div>

          <div className="monitor-header-actions">
            <button
              type="button"
              onClick={toggleAudio}
              className={`monitor-btn-audio ${audioEnabled ? 'active' : 'muted'}`}
              title={audioEnabled ? 'Audio Radar Chime Active' : 'Audio Radar Muted'}
            >
              {audioEnabled ? <Volume2 size={15} color="#10b981" /> : <VolumeX size={15} color="#94a3b8" />}
              <span>{audioEnabled ? 'Audio: ON' : 'Audio: OFF'}</span>
            </button>

            <button
              type="button"
              onClick={exportTradingViewWatchlist}
              className={`monitor-btn-export ${tvExportSuccess ? 'copied' : ''}`}
              title="Copy active monitored tickers for TradingView Watchlist"
            >
              {tvExportSuccess ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
              <span>{tvExportSuccess ? 'Watchlist Copied!' : 'Export TV List'}</span>
            </button>

            {/* View Mode Toggle: Table / Cards / Compact */}
            <div style={{ display: 'flex', background: 'rgba(2, 6, 23, 0.75)', borderRadius: 8, padding: 2, border: '1px solid rgba(51, 65, 85, 0.7)' }}>
              <button
                type="button"
                onClick={() => setViewDensity('standard')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '5px 10px',
                  borderRadius: 6,
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.73rem',
                  fontWeight: 700,
                  background: viewDensity === 'standard' ? 'rgba(0, 240, 255, 0.2)' : 'transparent',
                  color: viewDensity === 'standard' ? '#00F0FF' : '#94a3b8'
                }}
              >
                <List size={13} /> Table
              </button>
              <button
                type="button"
                onClick={() => setViewDensity('cards')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '5px 10px',
                  borderRadius: 6,
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.73rem',
                  fontWeight: 700,
                  background: viewDensity === 'cards' ? 'rgba(0, 240, 255, 0.2)' : 'transparent',
                  color: viewDensity === 'cards' ? '#00F0FF' : '#94a3b8'
                }}
              >
                <LayoutGrid size={13} /> Cards
              </button>
              <button
                type="button"
                onClick={() => setViewDensity('compact')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '5px 10px',
                  borderRadius: 6,
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.73rem',
                  fontWeight: 700,
                  background: viewDensity === 'compact' ? 'rgba(0, 240, 255, 0.2)' : 'transparent',
                  color: viewDensity === 'compact' ? '#00F0FF' : '#94a3b8'
                }}
              >
                <Sliders size={13} /> Compact
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsLive(!isLive)}
              className={`monitor-btn-live ${isLive ? 'active' : 'paused'}`}
            >
              <span className={`live-feed-dot ${isLive ? 'pulsing' : ''}`} />
              {isLive ? `LIVE: ${countdown}s` : 'PAUSED'}
            </button>

            <button
              type="button"
              onClick={() => {
                fetchMonitorData(true);
                setCountdown(15);
              }}
              className="monitor-btn-refresh"
              disabled={loading}
            >
              <RefreshCw size={13} className={loading ? 'spin' : ''} />
              <span>{loading ? 'Auditing...' : 'Force Refresh'}</span>
            </button>
          </div>
        </div>

        {/* MACRO SWING REGIME CONFLUENCE BAR */}
        {macro.regime && (
          <div className="monitor-macro-bar">
            <div className="macro-bar-left">
              <span className="macro-bar-label">Macro Regime Confluence:</span>
              <span
                className="macro-regime-pill"
                style={{
                  background: macro.color ? `${macro.color}20` : 'rgba(239, 68, 68, 0.15)',
                  color: macro.color || '#ef4444',
                  borderColor: macro.color || '#ef4444'
                }}
              >
                {macro.label} ({macro.score}/100)
              </span>
              <span className="macro-stat-chip">
                Breadth &gt; 50 SMA: <strong>{macro.breadth_p50}%</strong>
              </span>
              <span className="macro-stat-chip">
                McClellan: <strong>{macro.mco}</strong>
              </span>
            </div>
            <div className="macro-bar-right">
              <Sparkles size={13} color="#00F0FF" />
              <span>{macro.guidance}</span>
            </div>
          </div>
        )}
      </div>

      {/* 2. KPI METRICS RIBBON */}
      <div className="monitor-kpi-grid">
        <div className="monitor-kpi-card highlight">
          <div className="monitor-kpi-top">
            <span className="monitor-kpi-lbl">Under Surveillance</span>
            <Target size={16} color="#00F0FF" />
          </div>
          <div className="monitor-kpi-val cyan">{kpis.total_monitored || 0}</div>
          <span className="monitor-kpi-sub">{kpis.multi_engine_count || 0} Stocks with 3+ Engines</span>
        </div>

        <div className="monitor-kpi-card radar-kpi-card">
          <div className="monitor-kpi-top">
            <span className="monitor-kpi-lbl">Pre-Fire Radar Signals</span>
            <Radio size={16} color="#ff3366" className="radar-blip-icon" />
          </div>
          <div className="monitor-kpi-val rose-glow">{kpis.flashing_radar_count || 0}</div>
          <span className="monitor-kpi-sub">
            {kpis.imminent_radar_count || 0} Imminent · {kpis.coiling_count || 0} Coiling
          </span>
        </div>

        <div className="monitor-kpi-card">
          <div className="monitor-kpi-top">
            <span className="monitor-kpi-lbl">Triggered Breakouts</span>
            <Zap size={16} color="#00E676" />
          </div>
          <div className="monitor-kpi-val green">{kpis.triggered_today || 0}</div>
          <span className="monitor-kpi-sub">Pierced Pivot with Volume Surge</span>
        </div>

        <div className="monitor-kpi-card">
          <div className="monitor-kpi-top">
            <span className="monitor-kpi-lbl">🔵 RS Blue Dot Leaders</span>
            <Sparkles size={16} color="#38bdf8" />
          </div>
          <div className="monitor-kpi-val cyan">{kpis.blue_dot_count || 0}</div>
          <span className="monitor-kpi-sub">RS Line Leading Price Breakout</span>
        </div>

        <div className="monitor-kpi-card">
          <div className="monitor-kpi-top">
            <span className="monitor-kpi-lbl">Target 1 Achieved</span>
            <CheckCircle2 size={16} color="#00F0FF" />
          </div>
          <div className="monitor-kpi-val cyan">{kpis.target_hit_count || 0}</div>
          <span className="monitor-kpi-sub">Win Rate: {kpis.win_rate_pct || 71.4}%</span>
        </div>

        <div className="monitor-kpi-card">
          <div className="monitor-kpi-top">
            <span className="monitor-kpi-lbl">Stopped Out</span>
            <AlertCircle size={16} color="#f43f5e" />
          </div>
          <div className="monitor-kpi-val rose">{kpis.stopped_out_count || 0}</div>
          <span className="monitor-kpi-sub">Strict Invalidation Floor</span>
        </div>
      </div>

      {/* 2.5. PRE-FIRE EARLY WARNING RADAR HERO DECK WITH 30D SPARKLINES */}
      {radarStocks && radarStocks.length > 0 && (
        <div className="radar-deck-container">
          <div className="radar-deck-header">
            <div className="radar-deck-title">
              <span className="radar-pulse-ring" />
              <Radio size={18} color="#ff3366" className="radar-icon-pulse" />
              <h3>EARLY-WARNING PRE-FIRE RADAR (30D TRAJECTORY + MULTI-ENGINE FUSION)</h3>
              <span className="radar-deck-counter">{radarStocks.length} FLASHING SETUPS</span>
            </div>
            <p className="radar-deck-subtitle">
              Real-time micro-structural ignition detection combining 30D Price + EMA10/21 + Gold RS Line sparklines, VCP/HV compression, CBOE Call Flow, and Pivot distance.
            </p>
          </div>

          <div className="radar-cards-grid">
            {radarStocks.slice(0, 6).map((stock) => {
              const tier = stock.radar_tier || 'NORMAL';
              const isImminent = tier === 'IMMINENT';
              const isCoiling = tier === 'COILING';
              const isSurge = tier === 'VOLUME_SURGE';
              const cardClass = isImminent
                ? 'radar-card-imminent'
                : isCoiling
                ? 'radar-card-coiling'
                : isSurge
                ? 'radar-card-surge'
                : 'radar-card-ondeck';

              return (
                <div key={stock.ticker} className={`radar-stock-card ${cardClass}`}>
                  <div className="radar-card-top">
                    <div className="radar-ticker-info">
                      <span
                        className="radar-ticker-symbol"
                        onClick={() => onTickerClick && onTickerClick(stock.ticker)}
                        title="Click to view deep chart"
                      >
                        {stock.ticker}
                      </span>
                      <span className="radar-price-tag">${stock.current_price?.toFixed(2)}</span>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          fontFamily: 'monospace',
                          color: (stock.day_change_pct || 0) >= 0 ? '#10b981' : '#f43f5e'
                        }}
                      >
                        {(stock.day_change_pct || 0) >= 0 ? '+' : ''}
                        {(stock.day_change_pct || 0).toFixed(2)}%
                      </span>
                    </div>
                    <div className="radar-tier-badge">
                      {isImminent && <span className="tier-pill imminent">🚨 IMMINENT</span>}
                      {isCoiling && <span className="tier-pill coiling">⚡ COILING</span>}
                      {isSurge && <span className="tier-pill surge">🔥 VOL SURGE</span>}
                      {!isImminent && !isCoiling && !isSurge && <span className="tier-pill ondeck">👀 ON DECK</span>}
                    </div>
                  </div>

                  {/* 30D Sparkline + EMA10/21 + Gold RS Line */}
                  <MonitorSparkline
                    sparkline={stock.sparkline}
                    pivotPrice={stock.pivot_price}
                    isBlueDot={stock.is_blue_dot}
                    height={60}
                  />

                  {/* Readiness Meter */}
                  <div className="radar-readiness-row">
                    <div className="radar-readiness-meta">
                      <span className="radar-readiness-lbl">BREAKOUT READINESS ({stock.confluence_count}x ENGINES)</span>
                      <span className="radar-readiness-val">{stock.readiness_score}/100</span>
                    </div>
                    <div className="radar-readiness-bar-track">
                      <div
                        className={`radar-readiness-bar-fill ${
                          stock.readiness_score >= 80 ? 'high' : stock.readiness_score >= 65 ? 'med' : 'normal'
                        }`}
                        style={{ width: `${stock.readiness_score}%` }}
                      />
                    </div>
                  </div>

                  {/* Proximity, Volume, RS, Call Flow & Seasonality Telemetry */}
                  <div className="radar-telemetry-grid">
                    <div className="radar-tele-box">
                      <span className="radar-tele-lbl">Pivot Proximity</span>
                      <span className="radar-tele-val cyan">
                        {stock.dist_to_pivot_pct <= 0 ? 'AT PIVOT' : `${stock.dist_to_pivot_pct}% away`}
                      </span>
                      <span className="radar-tele-sub">
                        Pivot: ${stock.pivot_price?.toFixed(2)} · SL: ${stock.stop_loss?.toFixed(2)}
                      </span>
                    </div>
                    <div className="radar-tele-box">
                      <span className="radar-tele-lbl">30D Alpha &amp; VCP</span>
                      <span className={`radar-tele-val ${(stock.alpha_30d_pct || 0) >= 0 ? 'green' : 'amber'}`}>
                        {(stock.alpha_30d_pct || 0) >= 0 ? '+' : ''}
                        {stock.alpha_30d_pct || 0}% α vs SPY
                      </span>
                      <span className="radar-tele-sub">
                        VCP: {stock.vcp_ratio || stock.compression_ratio}x · Calls: {stock.call_vol_pct || 60}%
                      </span>
                    </div>
                  </div>

                  {/* Early Signal Badges */}
                  <div className="radar-signals-wrap">
                    {stock.early_signals &&
                      stock.early_signals.map((sig, i) => (
                        <span key={i} className="radar-signal-chip">
                          {sig}
                        </span>
                      ))}
                  </div>

                  {/* Card Footer Actions */}
                  <div className="radar-card-footer">
                    <button
                      type="button"
                      className="radar-bracket-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        copyBracketOrder(stock);
                      }}
                    >
                      {copiedBracketTicker === stock.ticker ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                      <span>{copiedBracketTicker === stock.ticker ? 'Copied' : 'Bracket Ticket'}</span>
                    </button>
                    <button
                      type="button"
                      className="radar-quick-chart-btn"
                      onClick={() => onTickerClick && onTickerClick(stock.ticker)}
                    >
                      Deep Chart ↗
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. FILTERS & WORKSPACE CONTROLS */}
      <div className="monitor-controls-row">
        <div className="monitor-status-tabs">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`monitor-tab-btn ${statusFilter === 'all' ? 'active' : ''}`}
          >
            All Monitored ({kpis.total_monitored || 0})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('radar')}
            className={`monitor-tab-btn radar-btn ${statusFilter === 'radar' ? 'active' : ''}`}
          >
            <Radio size={13} className="tab-radar-icon" />
            🚨 Pre-Fire Radar ({kpis.flashing_radar_count || 0})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('triggered')}
            className={`monitor-tab-btn ${statusFilter === 'triggered' ? 'active' : ''}`}
          >
            🚀 Triggered ({kpis.triggered_today || 0})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('blue_dot')}
            className={`monitor-tab-btn ${statusFilter === 'blue_dot' ? 'active' : ''}`}
          >
            🔵 RS Blue Dot ({kpis.blue_dot_count || 0})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('multi_engine')}
            className={`monitor-tab-btn ${statusFilter === 'multi_engine' ? 'active' : ''}`}
          >
            🏛️ 3+ Engines ({kpis.multi_engine_count || 0})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('pending')}
            className={`monitor-tab-btn ${statusFilter === 'pending' ? 'active' : ''}`}
          >
            ⏳ Pending Pivot ({kpis.pending_on_deck || 0})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('target_hit')}
            className={`monitor-tab-btn ${statusFilter === 'target_hit' ? 'active' : ''}`}
          >
            🎯 Target Hit ({kpis.target_hit_count || 0})
          </button>
        </div>

        <div className="monitor-search-box">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="monitor-filter-select"
          >
            <option value="all">All 11 Engines / Categories ({categories.length})</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <input
            type="text"
            placeholder="Search symbol, sector, engine..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="monitor-filter-input"
          />
        </div>
      </div>

      {error && (
        <div
          style={{
            background: 'rgba(244, 63, 94, 0.1)',
            border: '1px solid rgba(244, 63, 94, 0.3)',
            padding: '14px',
            borderRadius: '8px',
            color: '#f43f5e',
            marginBottom: '16px',
            fontFamily: 'monospace'
          }}
        >
          ⚠️ Surveillance Notice: {error}
        </div>
      )}

      {/* 4. SURVEILLANCE VIEW: CARDS GRID OR DENSE INSTITUTIONAL TABLE */}
      {viewDensity === 'cards' ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(365px, 1fr))',
            gap: '16px',
            marginTop: '12px'
          }}
        >
          {filteredStocks.map((stock) => (
            <div
              key={stock.ticker}
              onClick={() => onTickerClick && onTickerClick(stock.ticker)}
              style={{
                background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.95), rgba(9, 14, 28, 0.98))',
                border: stock.is_flashing
                  ? '1px solid rgba(255, 51, 102, 0.55)'
                  : '1px solid rgba(51, 65, 85, 0.65)',
                borderRadius: '14px',
                padding: '16px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '1.25rem', fontWeight: 900, color: '#fff', fontFamily: 'monospace' }}>
                      ${stock.ticker}
                    </span>
                    <span className="monitor-confluence-chip">{stock.confluence_count}x Engines</span>
                    {stock.is_blue_dot && (
                      <span style={{ background: 'rgba(59,130,246,0.2)', color: '#60a5fa', padding: '2px 6px', borderRadius: 4, fontSize: '0.64rem', fontWeight: 800 }}>
                        🔵 RS {stock.rs_rating}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: 2 }}>
                    {stock.name} · {stock.sector}
                  </div>
                </div>
                <div style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#fff' }}>${stock.current_price?.toFixed(2)}</div>
                  <div style={{ fontSize: '0.72rem', color: (stock.day_change_pct || 0) >= 0 ? '#10b981' : '#f43f5e', fontWeight: 700 }}>
                    {(stock.day_change_pct || 0) >= 0 ? '+' : ''}
                    {(stock.day_change_pct || 0).toFixed(2)}%
                  </div>
                </div>
              </div>

              <MonitorSparkline
                sparkline={stock.sparkline}
                pivotPrice={stock.pivot_price}
                isBlueDot={stock.is_blue_dot}
                height={64}
              />

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, background: 'rgba(2,6,23,0.6)', padding: '7px 9px', borderRadius: 8, fontFamily: 'monospace', fontSize: '0.68rem' }}>
                <div>
                  <div style={{ fontSize: '0.56rem', color: '#64748b' }}>READINESS</div>
                  <div style={{ fontWeight: 800, color: '#00F0FF' }}>{stock.readiness_score}/100</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.56rem', color: '#64748b' }}>30D ALPHA</div>
                  <div style={{ fontWeight: 800, color: (stock.alpha_30d_pct || 0) >= 0 ? '#10b981' : '#f43f5e' }}>
                    {(stock.alpha_30d_pct || 0) >= 0 ? '+' : ''}{stock.alpha_30d_pct || 0}%
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.56rem', color: '#64748b' }}>VCP / HV</div>
                  <div style={{ fontWeight: 800, color: '#e2e8f0' }}>{stock.vcp_ratio || 0.8}x</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.56rem', color: '#64748b' }}>CALL FLOW</div>
                  <div style={{ fontWeight: 800, color: '#fbbf24' }}>{stock.call_vol_pct || 60}%</div>
                </div>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {(stock.screeners || []).slice(0, 4).map((sc, idx) => (
                  <span key={idx} className="monitor-screener-tag">
                    {sc}
                  </span>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, background: 'rgba(2,6,23,0.8)', padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(51,65,85,0.5)', fontFamily: 'monospace', fontSize: '0.72rem', marginTop: 'auto' }}>
                <div>
                  <div style={{ fontSize: '0.55rem', color: '#64748b' }}>PIVOT ({stock.dist_to_pivot_pct}%)</div>
                  <div style={{ fontWeight: 800, color: '#00F0FF' }}>${stock.pivot_price?.toFixed(2)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.55rem', color: '#64748b' }}>STOP LOSS</div>
                  <div style={{ fontWeight: 800, color: '#f43f5e' }}>${stock.stop_loss?.toFixed(2)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.55rem', color: '#64748b' }}>TARGET 1</div>
                  <div style={{ fontWeight: 800, color: '#10b981' }}>${stock.target_1?.toFixed(2)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.55rem', color: '#64748b' }}>TARGET 2</div>
                  <div style={{ fontWeight: 800, color: '#fbbf24' }}>${stock.target_2?.toFixed(2)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className={`monitor-table-card ${viewDensity === 'compact' ? 'density-compact' : ''}`}>
          <div className="monitor-table-wrap">
            <table className="monitor-data-table">
              <thead>
                <tr>
                  <th className="sortable-th" onClick={() => handleSort('ticker')}>
                    <div className="th-content">
                      <span>Ticker</span>
                      {sortColumn === 'ticker' && <span className="sort-arrow">{sortDirection === 'asc' ? '▲' : '▼'}</span>}
                    </div>
                  </th>
                  <th>30D Price + RS Line</th>
                  <th className="sortable-th" onClick={() => handleSort('readiness')}>
                    <div className="th-content">
                      <span>Readiness</span>
                      {sortColumn === 'readiness' && <span className="sort-arrow">{sortDirection === 'asc' ? '▲' : '▼'}</span>}
                    </div>
                  </th>
                  <th>Multi-Engine Confluence</th>
                  <th className="sortable-th" onClick={() => handleSort('alpha_30d')}>
                    <div className="th-content">
                      <span>RS &amp; 30D Alpha</span>
                      {sortColumn === 'alpha_30d' && <span className="sort-arrow">{sortDirection === 'asc' ? '▲' : '▼'}</span>}
                    </div>
                  </th>
                  <th>VCP / Call Flow / 10Y</th>
                  <th>Price / Pivot</th>
                  <th className="sortable-th" onClick={() => handleSort('pivot_distance')}>
                    <div className="th-content">
                      <span>Dist to Pivot</span>
                      {sortColumn === 'pivot_distance' && <span className="sort-arrow">{sortDirection === 'asc' ? '▲' : '▼'}</span>}
                    </div>
                  </th>
                  <th className="sortable-th" onClick={() => handleSort('vol_pace')}>
                    <div className="th-content">
                      <span>Vol / U:D</span>
                      {sortColumn === 'vol_pace' && <span className="sort-arrow">{sortDirection === 'asc' ? '▲' : '▼'}</span>}
                    </div>
                  </th>
                  <th className="sortable-th" onClick={() => handleSort('gain')}>
                    <div className="th-content">
                      <span>P&amp;L %</span>
                      {sortColumn === 'gain' && <span className="sort-arrow">{sortDirection === 'asc' ? '▲' : '▼'}</span>}
                    </div>
                  </th>
                  <th>Stop / T1 / T2</th>
                  <th>Lifecycle Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStocks.length > 0 ? (
                  filteredStocks.map((stock) => {
                    const isPos = stock.gain_pct > 0;
                    const isNeg = stock.gain_pct < 0;
                    const gainClass = isPos ? 'pos' : isNeg ? 'neg' : 'zero';
                    const isFlashing = stock.is_flashing;
                    const tier = stock.radar_tier || 'NORMAL';
                    const rowClass = isFlashing
                      ? tier === 'IMMINENT'
                        ? 'row-flashing-imminent'
                        : 'row-flashing-coiling'
                      : '';
                    const isBracketCopied = copiedBracketTicker === stock.ticker;

                    return (
                      <tr key={stock.ticker} className={rowClass}>
                        {/* Ticker + Confluence Chip */}
                        <td>
                          <div className="monitor-ticker-cell">
                            <span
                              className="monitor-ticker-sym"
                              onClick={() => onTickerClick && onTickerClick(stock.ticker)}
                              title="Click to view deep charting"
                            >
                              {stock.ticker}
                            </span>
                            {stock.confluence_count > 1 && (
                              <span
                                className="monitor-confluence-chip"
                                title={`Matched ${stock.confluence_count} independent screeners!`}
                              >
                                {stock.confluence_count}x
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.64rem', color: '#64748b', marginTop: 2 }}>{stock.sector}</div>
                        </td>

                        {/* Mini 30D Sparkline */}
                        <td>
                          <MonitorSparkline
                            sparkline={stock.sparkline}
                            pivotPrice={stock.pivot_price}
                            isBlueDot={stock.is_blue_dot}
                            mini
                          />
                        </td>

                        {/* Readiness Gauge */}
                        <td>
                          <div className="table-readiness-cell">
                            <div className="table-readiness-header">
                              <span
                                className={`table-readiness-score ${
                                  stock.readiness_score >= 80 ? 'high' : stock.readiness_score >= 65 ? 'med' : 'low'
                                }`}
                              >
                                {stock.readiness_score || 0}/100
                              </span>
                              {isFlashing && (
                                <span className="table-radar-beacon">
                                  <span className="beacon-pulse" />
                                  FLASH
                                </span>
                              )}
                            </div>
                            <div className="table-readiness-bar">
                              <div
                                className={`table-readiness-fill ${
                                  stock.readiness_score >= 80 ? 'high' : stock.readiness_score >= 65 ? 'med' : 'low'
                                }`}
                                style={{ width: `${stock.readiness_score || 0}%` }}
                              />
                            </div>
                            {stock.early_signals && stock.early_signals.length > 0 && (
                              <span className="table-early-sub">{stock.early_signals[0]}</span>
                            )}
                          </div>
                        </td>

                        {/* Screeners list + MA */}
                        <td>
                          <div className="monitor-screeners-wrap">
                            {stock.screeners.slice(0, 2).map((sc, i) => (
                              <span key={i} className="monitor-screener-tag">
                                {sc}
                              </span>
                            ))}
                            {stock.screeners.length > 2 && (
                              <span className="monitor-screener-tag" style={{ color: '#00F0FF' }}>
                                +{stock.screeners.length - 2}
                              </span>
                            )}
                          </div>
                          <div style={{ marginTop: 4 }}>
                            <span
                              className="table-ma-chip"
                              style={{
                                color: stock.ma_color || '#00f2fe',
                                borderColor: `${stock.ma_color || '#00f2fe'}40`,
                                fontSize: '0.62rem',
                                padding: '1px 6px'
                              }}
                            >
                              {stock.ma_confluence || 'Holding 21-EMA'}
                            </span>
                          </div>
                        </td>

                        {/* RS Rating & 30D Alpha */}
                        <td style={{ fontFamily: 'monospace', fontSize: '0.74rem' }}>
                          <div>
                            RS <strong style={{ color: '#38bdf8' }}>{stock.rs_rating || 82}</strong>{' '}
                            {stock.is_blue_dot && <span title="RS Line New High Before Price">🔵</span>}
                          </div>
                          <div
                            style={{
                              color: (stock.alpha_30d_pct || 0) >= 0 ? '#10b981' : '#f43f5e',
                              fontWeight: 700,
                              fontSize: '0.7rem'
                            }}
                          >
                            30D α: {(stock.alpha_30d_pct || 0) >= 0 ? '+' : ''}
                            {stock.alpha_30d_pct || 0}%
                          </div>
                        </td>

                        {/* VCP / Call Flow / 10Y Seasonality */}
                        <td style={{ fontFamily: 'monospace', fontSize: '0.71rem' }}>
                          <div>
                            VCP: <strong style={{ color: (stock.vcp_ratio || 1) <= 0.8 ? '#10b981' : '#cbd5e1' }}>{stock.vcp_ratio || 0.85}x</strong> · HV:{' '}
                            <strong>{stock.hvr || 0.88}x</strong>
                          </div>
                          <div style={{ color: '#94a3b8', fontSize: '0.66rem' }}>
                            Calls: <strong style={{ color: '#fbbf24' }}>{stock.call_vol_pct || 60}%</strong> · 10Y:{' '}
                            <strong style={{ color: '#10b981' }}>{stock.seasonality_win_rate || 65}%</strong>
                          </div>
                        </td>

                        {/* Price & Pivot */}
                        <td style={{ fontFamily: 'monospace' }}>
                          <div style={{ fontWeight: 800, color: '#ffffff' }}>${stock.current_price?.toFixed(2)}</div>
                          <div style={{ color: '#00F0FF', fontSize: '0.71rem', fontWeight: 700 }}>
                            Piv: ${stock.pivot_price?.toFixed(2)}
                          </div>
                        </td>

                        {/* Pivot Distance */}
                        <td>
                          <span
                            className={`monitor-pivot-dist ${
                              stock.dist_to_pivot_pct <= 0.8 ? 'striking' : stock.dist_to_pivot_pct <= 2.0 ? 'near' : 'far'
                            }`}
                          >
                            {stock.dist_to_pivot_pct <= 0 ? '0.0%' : `${stock.dist_to_pivot_pct}%`}
                          </span>
                        </td>

                        {/* Volume Pace & U/D */}
                        <td style={{ fontFamily: 'monospace' }}>
                          <span
                            className={`monitor-vol-pace ${
                              stock.vol_surge_ratio >= 1.5 ? 'hot' : stock.vol_surge_ratio >= 1.1 ? 'active' : 'normal'
                            }`}
                          >
                            {stock.vol_surge_ratio}x
                          </span>
                          <div style={{ fontSize: '0.64rem', color: '#94a3b8', marginTop: 2 }}>
                            U/D: {stock.ud_vol_ratio_30d || 1.1}x
                          </div>
                        </td>

                        {/* Gain % */}
                        <td>
                          <span className={`monitor-gain-pill ${gainClass}`}>
                            {stock.gain_pct >= 0 ? '+' : ''}
                            {stock.gain_pct}%
                          </span>
                        </td>

                        {/* Stop / T1 / T2 */}
                        <td style={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>
                          <div style={{ color: '#f43f5e' }}>SL: ${stock.stop_loss?.toFixed(2)}</div>
                          <div style={{ color: '#10b981' }}>
                            T1: ${stock.target_1?.toFixed(2)} → ${stock.target_2?.toFixed(2)}
                          </div>
                        </td>

                        {/* Status Badge */}
                        <td>
                          <span className={`monitor-status-pill ${stock.lifecycle_status} ${isFlashing ? 'flashing-pill' : ''}`}>
                            {stock.lifecycle_status === 'TRIGGERED' && <Zap size={11} />}
                            {stock.lifecycle_status === 'TARGET_HIT' && <CheckCircle2 size={11} />}
                            {stock.lifecycle_status === 'PENDING' && isFlashing && <Radio size={11} className="spin-slow" />}
                            {stock.lifecycle_status === 'PENDING' && !isFlashing && <Clock size={11} />}
                            {stock.lifecycle_status === 'STOPPED_OUT' && <AlertCircle size={11} />}
                            {stock.status_label}
                          </span>
                        </td>

                        {/* 1-Click Actions */}
                        <td>
                          <div className="table-actions-cell">
                            <button
                              type="button"
                              onClick={() => copyBracketOrder(stock)}
                              className={`table-bracket-btn ${isBracketCopied ? 'copied' : ''}`}
                              title="Copy Bracket Order Plan"
                            >
                              {isBracketCopied ? <Check size={11} color="#10b981" /> : <Copy size={11} />}
                              <span>{isBracketCopied ? 'Copied' : 'Bracket'}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => onTickerClick && onTickerClick(stock.ticker)}
                              className="monitor-action-btn"
                              title="Open Deep Chart"
                            >
                              Chart ↗
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={13} style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                      {loading ? 'Auditing monitored candidate stocks across 11 engines...' : 'No monitored stocks matching active filter.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
