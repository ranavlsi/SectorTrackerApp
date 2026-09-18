import React, { useState, useEffect, useMemo, useRef } from 'react';
import './ScreenerMonitorDashboard.css';
import {
  Crosshair, Zap, Target, TrendingUp, TrendingDown,
  Shield, CheckCircle2, AlertCircle, RefreshCw, Search,
  Filter, Layers, ArrowUpRight, ArrowDownRight, Clock,
  Flame, BarChart2, Radio, Sparkles, Activity, Gauge,
  Volume2, VolumeX, Copy, Check, Sliders, ArrowUpDown,
  Compass, ExternalLink
} from 'lucide-react';

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
  const [viewDensity, setViewDensity] = useState('standard'); // 'standard' | 'compact'
  const [sortColumn, setSortColumn] = useState('readiness'); // 'readiness' | 'pivot_distance' | 'vol_pace' | 'gain' | 'progress' | 'ticker'
  const [sortDirection, setSortDirection] = useState('desc'); // 'asc' | 'desc'
  const [copiedBracketTicker, setCopiedBracketTicker] = useState(null);
  const [tvExportSuccess, setTvExportSuccess] = useState(false);

  // Audio synthesizer using browser Web Audio API
  const playRadarAudio = (type) => {
    if (!audioEnabled) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();

      if (type === 'imminent') {
        // High-tech dual pulse sonar chirp (880Hz -> 1760Hz)
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

        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(1175, ctx.currentTime + 0.14);
        osc2.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.24);
        gain2.gain.setValueAtTime(0.25, ctx.currentTime + 0.14);
        gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(ctx.currentTime + 0.14);
        osc2.stop(ctx.currentTime + 0.28);
      } else if (type === 'triggered') {
        // Harmonic major triad chime
        [587.33, 880, 1174.66].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.08);
          gain.gain.setValueAtTime(0.22, ctx.currentTime + i * 0.08);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.08 + 0.25);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(ctx.currentTime + i * 0.08);
          osc.stop(ctx.currentTime + i * 0.08 + 0.25);
        });
      } else {
        // Simple test blip
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
    if (next) {
      playRadarAudio('test');
    }
  };

  const fetchMonitorData = async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const url = `/api/screener_monitor?status=${statusFilter}&category=${categoryFilter}&refresh=${forceRefresh}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Server status: ${res.status}`);
      const json = await res.json();
      if (json.error) {
        setError(json.error);
      } else {
        setData(json);
      }
    } catch (err) {
      console.error('Failed to load screener surveillance data:', err);
      setError(err.message || 'Failed to fetch screener monitoring data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMonitorData();
  }, [statusFilter, categoryFilter]);

  // Live SSE stream with sound chime triggers
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
            } else if (alertData.status === 'TRIGGERED') {
              playRadarAudio('triggered');
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

  // 15-second background polling cycle
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
  }, [isLive, statusFilter, categoryFilter]);

  const kpis = data?.kpis || {};
  const macro = data?.macro_regime || {};
  const categories = data?.categories || [];
  const rawStocks = data?.stocks || [];
  const radarStocks = data?.radar_stocks || [];

  // Filter & Sort Stocks
  const filteredStocks = useMemo(() => {
    let list = [...rawStocks];

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toUpperCase();
      list = list.filter(s => 
        s.ticker.includes(q) || 
        s.screeners.some(sc => sc.toUpperCase().includes(q))
      );
    }

    // Dynamic Column Sorting
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
      } else if (sortColumn === 'progress') {
        valA = a.progress_to_target_pct || 0;
        valB = b.progress_to_target_pct || 0;
      } else if (sortColumn === 'ticker') {
        valA = a.ticker;
        valB = b.ticker;
        return sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      } else {
        return 0;
      }

      if (sortDirection === 'asc') {
        return valA > valB ? 1 : (valA < valB ? -1 : 0);
      } else {
        return valA < valB ? 1 : (valA > valB ? -1 : 0);
      }
    });

    return list;
  }, [rawStocks, searchQuery, sortColumn, sortDirection]);

  const handleSort = (col) => {
    if (sortColumn === col) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(col);
      setSortDirection('desc');
    }
  };

  const copyBracketOrder = (stock) => {
    const text = `🎯 [BRACKET ORDER: $${stock.ticker}]
Action: BUY STOP / LIMIT @ $${stock.pivot_price.toFixed(2)}
Stop Loss: $${stock.stop_loss.toFixed(2)} (-${((stock.pivot_price - stock.stop_loss)/stock.pivot_price*100).toFixed(1)}%)
Target 1: $${stock.target_1.toFixed(2)} (+${((stock.target_1 - stock.pivot_price)/stock.pivot_price*100).toFixed(1)}%) [Exit 50%]
Target 2: $${stock.target_2.toFixed(2)} (+${((stock.target_2 - stock.pivot_price)/stock.pivot_price*100).toFixed(1)}%) [Runner]
R:R: 4.5:1 | Setup: ${stock.screeners?.[0] || 'Expert Screener'}`;

    navigator.clipboard.writeText(text);
    setCopiedBracketTicker(stock.ticker);
    setTimeout(() => setCopiedBracketTicker(null), 2500);
  };

  const exportTradingViewWatchlist = () => {
    const tickersToExport = filteredStocks.slice(0, 60).map(s => s.ticker);
    if (!tickersToExport.length) return;
    const text = tickersToExport.join(', ');
    navigator.clipboard.writeText(text);
    setTvExportSuccess(true);
    setTimeout(() => setTvExportSuccess(false), 2500);
  };

  return (
    <div className="monitor-root">
      
      {/* ------------------------------------------------------------------ */}
      {/* 1. MASTER HEADER & SURVEILLANCE BANNER                             */}
      {/* ------------------------------------------------------------------ */}
      <div className="monitor-header-banner">
        <div className="monitor-header-top">
          
          <div className="monitor-identity">
            <div className="monitor-logo-box">
              <Crosshair size={24} color="#00F0FF" />
            </div>
            <div className="monitor-titles">
              <h1>
                EXPERT SCREENER SURVEILLANCE <span className="monitor-badge-tag">EARLY-WARNING RADAR</span>
              </h1>
              <p className="monitor-subtitle">
                <span className="monitor-pulse-dot" />
                Vectorized Parquet Ingestion · Flashing pre-breakout signals well before pivot breach with sub-second latency
              </p>
            </div>
          </div>

          <div className="monitor-header-actions">
            {/* Audio Radar Toggle */}
            <button
              type="button"
              onClick={toggleAudio}
              className={`monitor-btn-audio ${audioEnabled ? 'active' : 'muted'}`}
              title={audioEnabled ? 'Audio Radar Chime Active (Click to mute)' : 'Audio Radar Muted (Click to enable)'}
            >
              {audioEnabled ? <Volume2 size={15} color="#10b981" /> : <VolumeX size={15} color="#94a3b8" />}
              <span>{audioEnabled ? 'Audio: ON' : 'Audio: OFF'}</span>
            </button>

            {/* Export to TradingView */}
            <button
              type="button"
              onClick={exportTradingViewWatchlist}
              className={`monitor-btn-export ${tvExportSuccess ? 'copied' : ''}`}
              title="Copy active monitored tickers for TradingView Watchlist"
            >
              {tvExportSuccess ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
              <span>{tvExportSuccess ? 'Watchlist Copied!' : 'Export TV List'}</span>
            </button>

            {/* View Density Toggle */}
            <button
              type="button"
              onClick={() => setViewDensity(prev => prev === 'standard' ? 'compact' : 'standard')}
              className="monitor-btn-density"
              title="Toggle standard vs compact table density"
            >
              <Sliders size={14} />
              <span>{viewDensity === 'compact' ? 'Compact' : 'Standard'}</span>
            </button>

            {/* Live Polling Toggle */}
            <button
              type="button"
              onClick={() => setIsLive(!isLive)}
              className={`monitor-btn-live ${isLive ? 'active' : 'paused'}`}
              title={isLive ? 'Click to pause real-time auto-streaming' : 'Click to resume real-time auto-streaming'}
            >
              <span className={`live-feed-dot ${isLive ? 'pulsing' : ''}`} />
              {isLive ? `LIVE: ${countdown}s` : 'PAUSED'}
            </button>

            {sseConnected && (
              <span className="monitor-sse-badge" title="SSE Real-Time Push Stream Connected">
                ⚡ SSE Live
              </span>
            )}

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

        {/* 1.5. MACRO SWING REGIME CONFLUENCE BAR */}
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

      {/* ------------------------------------------------------------------ */}
      {/* 2. KPI METRICS RIBBON                                              */}
      {/* ------------------------------------------------------------------ */}
      <div className="monitor-kpi-grid">
        
        <div className="monitor-kpi-card highlight">
          <div className="monitor-kpi-top">
            <span className="monitor-kpi-lbl">Under Surveillance</span>
            <Target size={16} color="#00F0FF" />
          </div>
          <div className="monitor-kpi-val cyan">{kpis.total_monitored || 0}</div>
          <span className="monitor-kpi-sub">Vectorized Lakehouse Audit</span>
        </div>

        <div className="monitor-kpi-card radar-kpi-card">
          <div className="monitor-kpi-top">
            <span className="monitor-kpi-lbl">Pre-Fire Radar Signals</span>
            <Radio size={16} color="#ff3366" className="radar-blip-icon" />
          </div>
          <div className="monitor-kpi-val rose-glow">{kpis.flashing_radar_count || 0}</div>
          <span className="monitor-kpi-sub">{kpis.imminent_radar_count || 0} Imminent · {kpis.coiling_count || 0} Coiling</span>
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
            <span className="monitor-kpi-lbl">Pending on Deck</span>
            <Clock size={16} color="#fbbf24" />
          </div>
          <div className="monitor-kpi-val amber">{kpis.pending_on_deck || 0}</div>
          <span className="monitor-kpi-sub">Consolidating near Pivot</span>
        </div>

        <div className="monitor-kpi-card">
          <div className="monitor-kpi-top">
            <span className="monitor-kpi-lbl">Target 1 Achieved</span>
            <CheckCircle2 size={16} color="#00F0FF" />
          </div>
          <div className="monitor-kpi-val cyan">{kpis.target_hit_count || 0}</div>
          <span className="monitor-kpi-sub">+8% Gain · Stop at Breakeven</span>
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

      {/* ------------------------------------------------------------------ */}
      {/* 2.5. PRE-FIRE EARLY WARNING RADAR HERO DECK                        */}
      {/* ------------------------------------------------------------------ */}
      {radarStocks && radarStocks.length > 0 && (
        <div className="radar-deck-container">
          <div className="radar-deck-header">
            <div className="radar-deck-title">
              <span className="radar-pulse-ring" />
              <Radio size={18} color="#ff3366" className="radar-icon-pulse" />
              <h3>EARLY-WARNING PRE-FIRE RADAR</h3>
              <span className="radar-deck-counter">{radarStocks.length} FLASHING SETUPS</span>
            </div>
            <p className="radar-deck-subtitle">
              Micro-structural activity detected before nominal trigger fire: Volume tape velocity surging, tight VCP coil compression, and striking distance to breakout pivot.
            </p>
          </div>

          <div className="radar-cards-grid">
            {radarStocks.slice(0, 6).map((stock) => {
              const tier = stock.radar_tier || 'NORMAL';
              const isImminent = tier === 'IMMINENT';
              const isCoiling = tier === 'COILING';
              const isSurge = tier === 'VOLUME_SURGE';
              const cardClass = isImminent ? 'radar-card-imminent' : (isCoiling ? 'radar-card-coiling' : (isSurge ? 'radar-card-surge' : 'radar-card-ondeck'));

              return (
                <div 
                  key={stock.ticker} 
                  className={`radar-stock-card ${cardClass}`}
                >
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
                    </div>
                    <div className="radar-tier-badge">
                      {isImminent && <span className="tier-pill imminent">🚨 IMMINENT</span>}
                      {isCoiling && <span className="tier-pill coiling">⚡ COILING</span>}
                      {isSurge && <span className="tier-pill surge">🔥 VOL SURGE</span>}
                      {!isImminent && !isCoiling && !isSurge && <span className="tier-pill ondeck">👀 ON DECK</span>}
                    </div>
                  </div>

                  {/* Readiness Meter */}
                  <div className="radar-readiness-row">
                    <div className="radar-readiness-meta">
                      <span className="radar-readiness-lbl">BREAKOUT READINESS</span>
                      <span className="radar-readiness-val">{stock.readiness_score}/100</span>
                    </div>
                    <div className="radar-readiness-bar-track">
                      <div 
                        className={`radar-readiness-bar-fill ${stock.readiness_score >= 80 ? 'high' : (stock.readiness_score >= 65 ? 'med' : 'normal')}`}
                        style={{ width: `${stock.readiness_score}%` }}
                      />
                    </div>
                  </div>

                  {/* Proximity & Volume Telemetry */}
                  <div className="radar-telemetry-grid">
                    <div className="radar-tele-box">
                      <span className="radar-tele-lbl">Pivot Proximity</span>
                      <span className="radar-tele-val cyan">
                        {stock.dist_to_pivot_pct <= 0 ? 'AT PIVOT' : `${stock.dist_to_pivot_pct}% away`}
                      </span>
                      <span className="radar-tele-sub">Pivot: ${stock.pivot_price?.toFixed(2)}</span>
                    </div>
                    <div className="radar-tele-box">
                      <span className="radar-tele-lbl">Volume Pace</span>
                      <span className={`radar-tele-val ${stock.vol_surge_ratio >= 1.4 ? 'green' : 'amber'}`}>
                        {stock.vol_surge_ratio}x Avg
                      </span>
                      <span className="radar-tele-sub">Compression: {stock.compression_ratio}x ATR</span>
                    </div>
                  </div>

                  {/* Moving Average Confluence Pill */}
                  {stock.ma_confluence && (
                    <div className="radar-ma-row">
                      <span className="radar-ma-pill" style={{ color: stock.ma_color, borderColor: `${stock.ma_color}40` }}>
                        {stock.ma_confluence}
                      </span>
                    </div>
                  )}

                  {/* Early Signal Badges */}
                  <div className="radar-signals-wrap">
                    {stock.early_signals && stock.early_signals.map((sig, i) => (
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
                      <span>{copiedBracketTicker === stock.ticker ? 'Copied' : 'Bracket'}</span>
                    </button>
                    <button 
                      type="button" 
                      className="radar-quick-chart-btn"
                      onClick={() => onTickerClick && onTickerClick(stock.ticker)}
                    >
                      Chart ↗
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 3. FILTERS & WORKSPACE CONTROLS                                    */}
      {/* ------------------------------------------------------------------ */}
      <div className="monitor-controls-row">
        
        {/* Status Tabs */}
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
            🚀 Triggered Breakouts ({kpis.triggered_today || 0})
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
            🎯 Target Achieved ({kpis.target_hit_count || 0})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('stopped_out')}
            className={`monitor-tab-btn ${statusFilter === 'stopped_out' ? 'active' : ''}`}
          >
            🛑 Stopped Out ({kpis.stopped_out_count || 0})
          </button>
        </div>

        {/* Category & Search Filter */}
        <div className="monitor-search-box">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="monitor-filter-select"
          >
            <option value="all">All Screener Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <input
            type="text"
            placeholder="Search symbol..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="monitor-filter-input"
          />
        </div>

      </div>

      {error && (
        <div style={{ background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.3)', padding: '14px', borderRadius: '8px', color: '#f43f5e', marginBottom: '16px', fontFamily: 'monospace' }}>
          ⚠️ Surveillance Error: {error}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 4. SURVEILLANCE GRID TABLE (SORTABLE & DENSE)                      */}
      {/* ------------------------------------------------------------------ */}
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
                <th className="sortable-th" onClick={() => handleSort('readiness')}>
                  <div className="th-content">
                    <span>Early Radar Readiness</span>
                    {sortColumn === 'readiness' && <span className="sort-arrow">{sortDirection === 'asc' ? '▲' : '▼'}</span>}
                  </div>
                </th>
                <th>Screener Setup(s)</th>
                <th>MA Confluence</th>
                <th>Current Price</th>
                <th>Breakout Pivot</th>
                <th className="sortable-th" onClick={() => handleSort('pivot_distance')}>
                  <div className="th-content">
                    <span>Pivot Distance</span>
                    {sortColumn === 'pivot_distance' && <span className="sort-arrow">{sortDirection === 'asc' ? '▲' : '▼'}</span>}
                  </div>
                </th>
                <th className="sortable-th" onClick={() => handleSort('vol_pace')}>
                  <div className="th-content">
                    <span>Volume Pace</span>
                    {sortColumn === 'vol_pace' && <span className="sort-arrow">{sortDirection === 'asc' ? '▲' : '▼'}</span>}
                  </div>
                </th>
                <th className="sortable-th" onClick={() => handleSort('gain')}>
                  <div className="th-content">
                    <span>P&amp;L Gain %</span>
                    {sortColumn === 'gain' && <span className="sort-arrow">{sortDirection === 'asc' ? '▲' : '▼'}</span>}
                  </div>
                </th>
                <th className="sortable-th" onClick={() => handleSort('progress')}>
                  <div className="th-content">
                    <span>Target 1 Progress</span>
                    {sortColumn === 'progress' && <span className="sort-arrow">{sortDirection === 'asc' ? '▲' : '▼'}</span>}
                  </div>
                </th>
                <th>Stop Loss</th>
                <th>Lifecycle Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredStocks.length > 0 ? (
                filteredStocks.map((stock) => {
                  const isPos = stock.gain_pct > 0;
                  const isNeg = stock.gain_pct < 0;
                  const gainClass = isPos ? 'pos' : (isNeg ? 'neg' : 'zero');
                  const isFlashing = stock.is_flashing;
                  const tier = stock.radar_tier || 'NORMAL';
                  const rowClass = isFlashing 
                    ? (tier === 'IMMINENT' ? 'row-flashing-imminent' : 'row-flashing-coiling') 
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
                            <span className="monitor-confluence-chip" title={`Matched ${stock.confluence_count} independent expert screeners!`}>
                              {stock.confluence_count}x
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Early Radar Readiness Gauge */}
                      <td>
                        <div className="table-readiness-cell">
                          <div className="table-readiness-header">
                            <span className={`table-readiness-score ${stock.readiness_score >= 80 ? 'high' : (stock.readiness_score >= 65 ? 'med' : 'low')}`}>
                              {stock.readiness_score || 0}/100
                            </span>
                            {isFlashing && (
                              <span className="table-radar-beacon" title="Flashing Pre-Breakout Radar Signal!">
                                <span className="beacon-pulse" />
                                FLASHING
                              </span>
                            )}
                          </div>
                          <div className="table-readiness-bar">
                            <div 
                              className={`table-readiness-fill ${stock.readiness_score >= 80 ? 'high' : (stock.readiness_score >= 65 ? 'med' : 'low')}`}
                              style={{ width: `${stock.readiness_score || 0}%` }}
                            />
                          </div>
                          {stock.early_signals && stock.early_signals.length > 0 && (
                            <span className="table-early-sub">
                              {stock.early_signals[0]}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Screeners list */}
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
                      </td>

                      {/* MA Confluence */}
                      <td>
                        <span 
                          className="table-ma-chip"
                          style={{
                            color: stock.ma_color || '#00f2fe',
                            borderColor: `${stock.ma_color || '#00f2fe'}40`
                          }}
                        >
                          {stock.ma_confluence || 'Holding 21-EMA'}
                        </span>
                      </td>

                      {/* Current Price */}
                      <td style={{ fontWeight: 800, color: '#ffffff' }}>${stock.current_price?.toFixed(2)}</td>

                      {/* Breakout Pivot */}
                      <td style={{ color: '#00F0FF', fontWeight: 700 }}>${stock.pivot_price?.toFixed(2)}</td>

                      {/* Pivot Distance */}
                      <td>
                        <span className={`monitor-pivot-dist ${stock.dist_to_pivot_pct <= 0.8 ? 'striking' : (stock.dist_to_pivot_pct <= 2.0 ? 'near' : 'far')}`}>
                          {stock.dist_to_pivot_pct <= 0 ? '0.0%' : `${stock.dist_to_pivot_pct}%`}
                        </span>
                      </td>

                      {/* Volume Pace */}
                      <td>
                        <span className={`monitor-vol-pace ${stock.vol_surge_ratio >= 1.5 ? 'hot' : (stock.vol_surge_ratio >= 1.1 ? 'active' : 'normal')}`}>
                          {stock.vol_surge_ratio}x
                        </span>
                      </td>

                      {/* Gain % */}
                      <td>
                        <span className={`monitor-gain-pill ${gainClass}`}>
                          {stock.gain_pct >= 0 ? '+' : ''}{stock.gain_pct}%
                        </span>
                      </td>

                      {/* Target 1 Progress Bar */}
                      <td>
                        <div className="monitor-progress-wrap">
                          <div className="monitor-progress-track">
                            <div 
                              className="monitor-progress-fill" 
                              style={{ width: `${stock.progress_to_target_pct}%` }} 
                            />
                          </div>
                          <span className="monitor-progress-num">{stock.progress_to_target_pct}%</span>
                        </div>
                      </td>

                      {/* Invalidation Stop */}
                      <td style={{ color: '#f43f5e' }}>${stock.stop_loss?.toFixed(2)}</td>

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

                      {/* 1-Click Actions: Bracket Order & Chart */}
                      <td>
                        <div className="table-actions-cell">
                          <button
                            type="button"
                            onClick={() => copyBracketOrder(stock)}
                            className={`table-bracket-btn ${isBracketCopied ? 'copied' : ''}`}
                            title="Copy Bracket Order Plan (Entry, Stop Loss, Target 1, Target 2)"
                          >
                            {isBracketCopied ? <Check size={11} color="#10b981" /> : <Copy size={11} />}
                            <span>{isBracketCopied ? 'Copied' : 'Bracket'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => onTickerClick && onTickerClick(stock.ticker)}
                            className="monitor-action-btn"
                            title="Open Chart"
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
                    {loading ? 'Auditing monitored candidate stocks...' : 'No monitored stocks matching active filter.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
