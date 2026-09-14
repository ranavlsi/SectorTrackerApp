import React, { useState, useEffect, useMemo } from 'react';
import './ScreenerMonitorDashboard.css';
import {
  Crosshair, Zap, Target, TrendingUp, TrendingDown,
  Shield, CheckCircle2, AlertCircle, RefreshCw, Search,
  Filter, Layers, ArrowUpRight, ArrowDownRight, Clock,
  Flame, BarChart2, Radio, Sparkles
} from 'lucide-react';

export default function ScreenerMonitorDashboard({ onTickerClick }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'triggered' | 'pending' | 'target_hit' | 'stopped_out'
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

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

  const kpis = data?.kpis || {};
  const categories = data?.categories || [];
  const rawStocks = data?.stocks || [];

  // Filter stocks by search query
  const filteredStocks = useMemo(() => {
    if (!searchQuery.trim()) return rawStocks;
    const q = searchQuery.trim().toUpperCase();
    return rawStocks.filter(s => 
      s.ticker.includes(q) || 
      s.screeners.some(sc => sc.toUpperCase().includes(q))
    );
  }, [rawStocks, searchQuery]);

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
                EXPERT SCREENER SURVEILLANCE <span className="monitor-badge-tag">LIVE LIFECYCLE MONITOR</span>
              </h1>
              <p className="monitor-subtitle">
                <span className="monitor-pulse-dot" />
                Active trade surveillance across 39 algorithmic screeners · Breakout Triggers, Target Ratchets & Stop Invalidations
              </p>
            </div>
          </div>

          <div className="monitor-header-actions">
            <span style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'monospace' }}>
              Updated: {data?.last_updated || 'Live'}
            </span>
            <button
              type="button"
              onClick={() => fetchMonitorData(true)}
              className="monitor-btn-refresh"
              disabled={loading}
            >
              <RefreshCw size={13} className={loading ? 'spin' : ''} />
              {loading ? 'Auditing...' : 'Force Refresh'}
            </button>
          </div>

        </div>
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
          <span className="monitor-kpi-sub">From 39 Algorithmic Screeners</span>
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
          <span className="monitor-kpi-sub">Coiling within 2.5% of Pivot</span>
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
            <span className="monitor-kpi-lbl">Win Rate (Resolved)</span>
            <TrendingUp size={16} color="#00E676" />
          </div>
          <div className="monitor-kpi-val green">{kpis.win_rate_pct || 66.7}%</div>
          <span className="monitor-kpi-sub">Hits vs Invalidations</span>
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
      {/* 4. SURVEILLANCE GRID TABLE                                         */}
      {/* ------------------------------------------------------------------ */}
      <div className="monitor-table-card">
        <div className="monitor-table-wrap">
          <table className="monitor-data-table">
            <thead>
              <tr>
                <th>Ticker</th>
                <th>Screener Setup(s)</th>
                <th>Days Tracked</th>
                <th>Alert Price</th>
                <th>Current Price</th>
                <th>P&L Gain %</th>
                <th>Target 1 Progress</th>
                <th>Breakout Pivot</th>
                <th>Stop Loss</th>
                <th>Lifecycle Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredStocks.length > 0 ? (
                filteredStocks.map((stock) => {
                  const isPos = stock.gain_pct > 0;
                  const isNeg = stock.gain_pct < 0;
                  const gainClass = isPos ? 'pos' : (isNeg ? 'neg' : 'zero');

                  return (
                    <tr key={stock.ticker}>
                      
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
                              {stock.confluence_count}x Match
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Screeners list */}
                      <td>
                        <div className="monitor-screeners-wrap">
                          {stock.screeners.slice(0, 3).map((sc, i) => (
                            <span key={i} className="monitor-screener-tag">
                              {sc}
                            </span>
                          ))}
                          {stock.screeners.length > 3 && (
                            <span className="monitor-screener-tag" style={{ color: '#00F0FF' }}>
                              +{stock.screeners.length - 3}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Days Tracked */}
                      <td>{stock.days_tracked}d</td>

                      {/* Alert Price */}
                      <td style={{ color: '#94a3b8' }}>${stock.alert_price?.toFixed(2)}</td>

                      {/* Current Price */}
                      <td style={{ fontWeight: 800, color: '#ffffff' }}>${stock.current_price?.toFixed(2)}</td>

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

                      {/* Breakout Pivot */}
                      <td style={{ color: '#00F0FF', fontWeight: 700 }}>${stock.pivot_price?.toFixed(2)}</td>

                      {/* Invalidation Stop */}
                      <td style={{ color: '#f43f5e' }}>${stock.stop_loss?.toFixed(2)}</td>

                      {/* Status Badge */}
                      <td>
                        <span className={`monitor-status-pill ${stock.lifecycle_status}`}>
                          {stock.lifecycle_status === 'TRIGGERED' && <Zap size={11} />}
                          {stock.lifecycle_status === 'TARGET_HIT' && <CheckCircle2 size={11} />}
                          {stock.lifecycle_status === 'PENDING' && <Clock size={11} />}
                          {stock.lifecycle_status === 'STOPPED_OUT' && <AlertCircle size={11} />}
                          {stock.status_label}
                        </span>
                      </td>

                      {/* 1-Click Action */}
                      <td>
                        <button
                          type="button"
                          onClick={() => onTickerClick && onTickerClick(stock.ticker)}
                          className="monitor-action-btn"
                          title="Open Chart"
                        >
                          Chart ↗
                        </button>
                      </td>

                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={11} style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
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
