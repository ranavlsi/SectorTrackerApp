import React, { useState, useEffect, useMemo } from 'react';
import './SwingTradingSystem.css';
import {
  Target, Activity, Zap, TrendingUp, TrendingDown, Shield, ShieldAlert,
  ShieldCheck, RefreshCw, Search, Filter, Layers, ArrowUpRight,
  ArrowRight, CheckCircle2, AlertCircle, Clock, BarChart2,
  DollarSign, Calculator, Copy, Check, ExternalLink, Sparkles,
  Sliders, Compass, Flame, Info
} from 'lucide-react';

const SETUP_CATEGORIES = [
  { id: 'all', label: 'All Setups', icon: '🎯' },
  { id: 'vcp_coil', label: 'VCP Coils', icon: '🌀' },
  { id: 'bull_flag', label: 'Bull Flags', icon: '🚩' },
  { id: 'ema_pullback', label: '10/21-EMA Pullbacks', icon: '📈' },
  { id: 'rs_leader', label: 'RS Leaders', icon: '🚀' },
  { id: 'pead_drift', label: 'PEAD Shelves', icon: '💥' },
  { id: 'vdu_squeeze', label: 'VDU Squeezes', icon: '⚡' }
];

export default function SwingTradingSystem({ onSelectTicker, onOpenFundamentals }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Filters & Controls
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all'); // 'all' | 'TRIGGERED' | 'COILING' | 'ON_WATCH'
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('score'); // 'score' | 'proximity' | 'rr' | 'risk'

  // Interactive Position Sizing Settings
  const [accountSize, setAccountSize] = useState(100000);
  const [riskPercent, setRiskPercent] = useState(1.0);
  const [maxAllocationPct, setMaxAllocationPct] = useState(20);
  const [showCalculatorModal, setShowCalculatorModal] = useState(false);
  const [copiedTicker, setCopiedTicker] = useState(null);
  const [refreshingLive, setRefreshingLive] = useState(false);

  const fetchSetups = async (forceRefresh = false, liveOnly = false) => {
    if (liveOnly) {
      setRefreshingLive(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const url = `/api/swing_trading_setups?refresh=${forceRefresh}&live=${liveOnly}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.error) {
        setError(json.error);
      } else {
        setData(json);
      }
    } catch (err) {
      console.error('Failed to load swing setups:', err);
      try {
        const fbRes = await fetch('/swing_trading_setups.json');
        if (fbRes.ok) {
          const fbJson = await fbRes.json();
          setData(fbJson);
        } else {
          setError(err.message || 'Failed to load swing setups');
        }
      } catch (fbErr) {
        setError(err.message || 'Failed to load swing setups');
      }
    } finally {
      setLoading(false);
      setRefreshingLive(false);
    }
  };

  useEffect(() => {
    fetchSetups(false);
    const interval = setInterval(() => {
      fetchSetups(false, true);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Filtered & Sorted Setups
  const filteredSetups = useMemo(() => {
    if (!data || !data.setups) return [];
    let list = [...data.setups];

    // Category Filter
    if (selectedCategory !== 'all') {
      list = list.filter(s => s.setup_type === selectedCategory);
    }

    // Status Filter
    if (selectedStatus !== 'all') {
      list = list.filter(s => s.status === selectedStatus);
    }

    // Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(s =>
        s.ticker.toLowerCase().includes(q) ||
        (s.company_name && s.company_name.toLowerCase().includes(q)) ||
        (s.sector && s.sector.toLowerCase().includes(q)) ||
        (s.setup_name && s.setup_name.toLowerCase().includes(q))
      );
    }

    // Sort By
    list.sort((a, b) => {
      if (sortBy === 'score') return b.score - a.score;
      if (sortBy === 'proximity') return Math.abs(a.proximity_pct) - Math.abs(b.proximity_pct);
      if (sortBy === 'rr') return b.reward_risk - a.reward_risk;
      if (sortBy === 'risk') return a.risk_pct - b.risk_pct;
      return 0;
    });

    return list;
  }, [data, selectedCategory, selectedStatus, searchQuery, sortBy]);

  // Position Sizing Calculator Helper
  const calculatePosition = (entry, stopLoss, target1, target2) => {
    const dollarRisk = accountSize * (riskPercent / 100);
    const perShareRisk = Math.max(0.01, entry - stopLoss);
    const rawShares = Math.floor(dollarRisk / perShareRisk);
    const maxCapital = accountSize * (maxAllocationPct / 100);
    const maxSharesAllowed = Math.floor(maxCapital / entry);

    const shares = Math.max(1, Math.min(rawShares, maxSharesAllowed > 0 ? maxSharesAllowed : rawShares));
    const totalCapital = shares * entry;
    const capitalPct = ((totalCapital / accountSize) * 100).toFixed(1);
    const totalRisk = shares * perShareRisk;
    const profitT1 = shares * (target1 - entry);
    const profitT2 = shares * (target2 - entry);

    return {
      shares,
      totalCapital: Math.round(totalCapital),
      capitalPct,
      totalRisk: Math.round(totalRisk),
      profitT1: Math.round(profitT1),
      profitT2: Math.round(profitT2)
    };
  };

  const copyTradePlan = (setup) => {
    const sizing = calculatePosition(setup.entry, setup.stop_loss, setup.target_1, setup.target_2);
    const text = `🎯 [1-3 WEEK SWING SETUP: $${setup.ticker}]
Type: ${setup.setup_name} (${setup.timeframe})
Status: ${setup.status_label}
Current Price: $${setup.current_price.toFixed(2)}
Entry Pivot: $${setup.entry.toFixed(2)} (${setup.proximity_pct >= 0 ? '+' : ''}${setup.proximity_pct.toFixed(1)}%)
Stop Loss: $${setup.stop_loss.toFixed(2)} (-${setup.risk_pct}%)
Target 1 (5-8d Partial): $${setup.target_1.toFixed(2)} (+${setup.target_1_pct}%)
Target 2 (10-15d Runner): $${setup.target_2.toFixed(2)} (+${setup.target_2_pct}%)
Reward/Risk: ${setup.reward_risk}:1
Position Size: ${sizing.shares} shares (~$${Number(sizing.totalCapital).toLocaleString()}, $${Number(sizing.totalRisk).toLocaleString()} risk)
Execution: ${setup.execution_strategy}`;

    navigator.clipboard.writeText(text);
    setCopiedTicker(setup.ticker);
    setTimeout(() => setCopiedTicker(null), 2500);
  };

  const macro = data?.macro_regime || {};
  const summary = data?.summary || {};
  const categories = summary?.categories || {};

  return (
    <div className="swing-root">
      {/* 1. MASTER HEADER */}
      <div className="swing-header-banner">
        <div className="swing-header-top">
          <div className="swing-identity">
            <div className="swing-icon-badge">
              <Target size={24} color="#00f2fe" />
            </div>
            <div>
              <div className="swing-title-row">
                <h1 className="swing-title">1–3 Week Swing Trading System</h1>
                <span className="swing-horizon-tag">5–15 Trading Days</span>
                <span className="swing-asymmetry-tag">Min 3:1 R:R</span>
                <span className="swing-live-pulse-badge" title="Live prices streamed during market hours">
                  <span className="live-dot-pulse"></span>
                  LIVE MARKET
                </span>
              </div>
              <p className="swing-subtitle">
                Institutional momentum setups coiling for explosive expansion. Volatility-adjusted structural invalidation stops (1.5%–3.8% max risk) with multi-tier profit targets.
              </p>
            </div>
          </div>

          <div className="swing-header-actions">
            <button
              className="swing-calculator-btn"
              onClick={() => setShowCalculatorModal(!showCalculatorModal)}
            >
              <Calculator size={16} />
              <span>Risk Sizer (${(accountSize/1000).toFixed(0)}k @ {riskPercent}%)</span>
            </button>
            <button
              className="swing-live-btn"
              onClick={() => fetchSetups(false, true)}
              disabled={loading || refreshingLive}
              title="Refresh real-time prices for all 1-3W setups"
            >
              <Activity size={16} className={refreshingLive ? 'spin' : ''} color="#10b981" />
              <span>{refreshingLive ? 'Refreshing Live...' : 'Live Quotes'}</span>
            </button>
            <button
              className="swing-refresh-btn"
              onClick={() => fetchSetups(true, false)}
              disabled={loading}
              title="Re-run full 1-3 week quantitative scan on 660+ universe"
            >
              <RefreshCw size={16} className={loading ? 'spin' : ''} />
              <span>{loading ? 'Scanning Universe...' : 'Re-Scan Market'}</span>
            </button>
          </div>
        </div>

        {/* 2. MACRO SWING REGIME BAROMETER */}
        <div className="swing-regime-barometer">
          <div className="regime-pill-box">
            <span className="regime-label-title">Macro Swing Regime:</span>
            <span
              className="regime-badge"
              style={{
                background: macro.regime_color ? `${macro.regime_color}22` : 'rgba(239, 68, 68, 0.15)',
                color: macro.regime_color || '#ef4444',
                borderColor: macro.regime_color || '#ef4444'
              }}
            >
              {macro.regime_label || 'Defensive / Capital Preservation'}
            </span>
          </div>

          <div className="regime-stat-item">
            <span className="stat-name">Exposure Limit:</span>
            <span className="stat-val">{macro.recommended_exposure || '0% - 25% Invested'}</span>
          </div>

          <div className="regime-stat-item">
            <span className="stat-name">Breadth &gt; 50 SMA:</span>
            <span className="stat-val">{macro.breadth_above_50 || '32.4'}%</span>
          </div>

          <div className="regime-stat-item">
            <span className="stat-name">McClellan Osc:</span>
            <span className="stat-val" style={{ color: '#ef4444' }}>{macro.mco_status || 'Extreme Oversold'}</span>
          </div>

          <div className="regime-verdict-note">
            <Sparkles size={14} color="#00f2fe" style={{ minWidth: '14px' }} />
            <span>{macro.swing_verdict || 'Defensive Regime: Take quick profits at Target 1 (+5% to +8%). Keep stop losses strictly capped at 2.5%.'}</span>
          </div>
        </div>

        {/* 3. CALCULATOR EXPANDABLE DRAWER */}
        {showCalculatorModal && (
          <div className="swing-sizer-drawer">
            <div className="sizer-drawer-title">
              <Sliders size={16} color="#00f2fe" />
              <span>Institutional Position Sizing &amp; Risk Parameters</span>
            </div>
            <div className="sizer-inputs-row">
              <div className="sizer-input-group">
                <label>Account Portfolio Size ($)</label>
                <div className="input-with-icon">
                  <DollarSign size={14} color="#94a3b8" />
                  <input
                    type="number"
                    value={accountSize}
                    onChange={(e) => setAccountSize(Math.max(1000, Number(e.target.value)))}
                    step="5000"
                  />
                </div>
              </div>

              <div className="sizer-input-group">
                <label>Max Risk Per Trade (%)</label>
                <div className="quick-chips">
                  {[0.5, 1.0, 1.5, 2.0].map(pct => (
                    <button
                      key={pct}
                      className={riskPercent === pct ? 'chip-active' : ''}
                      onClick={() => setRiskPercent(pct)}
                    >
                      {pct}%
                    </button>
                  ))}
                  <input
                    type="number"
                    value={riskPercent}
                    onChange={(e) => setRiskPercent(Math.max(0.1, Number(e.target.value)))}
                    step="0.1"
                    style={{ width: '60px', marginLeft: '6px' }}
                  />
                </div>
              </div>

              <div className="sizer-input-group">
                <label>Max Capital Allocation / Stock (%)</label>
                <div className="quick-chips">
                  {[10, 15, 20, 25].map(pct => (
                    <button
                      key={pct}
                      className={maxAllocationPct === pct ? 'chip-active' : ''}
                      onClick={() => setMaxAllocationPct(pct)}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
              </div>

              <div className="sizer-summary-badge">
                <span className="summary-lbl">Max Dollar Risk / Trade:</span>
                <span className="summary-val">${((accountSize * riskPercent) / 100).toLocaleString()}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4. SETUP CATEGORY TABS */}
      <div className="swing-category-nav">
        {SETUP_CATEGORIES.map(cat => {
          const count = categories[cat.id] ?? 0;
          return (
            <button
              key={cat.id}
              className={`category-pill ${selectedCategory === cat.id ? 'active' : ''}`}
              onClick={() => setSelectedCategory(cat.id)}
            >
              <span className="cat-icon">{cat.icon}</span>
              <span className="cat-label">{cat.label}</span>
              <span className="cat-count">{count}</span>
            </button>
          );
        })}
      </div>

      {/* 5. CONTROLS BAR: SEARCH, STATUS, SORT */}
      <div className="swing-controls-bar">
        <div className="search-box">
          <Search size={16} color="#64748b" />
          <input
            type="text"
            placeholder="Search by ticker, company, or sector..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="clear-search" onClick={() => setSearchQuery('')}>×</button>
          )}
        </div>

        <div className="status-filters">
          <span className="filter-label">Trigger Proximity:</span>
          {[
            { id: 'all', label: 'All' },
            { id: 'TRIGGERED', label: '🎯 In Buy Zone' },
            { id: 'COILING', label: '⏳ Coiling (<3.5%)' },
            { id: 'ON_WATCH', label: '👀 On Watch' }
          ].map(st => (
            <button
              key={st.id}
              className={`status-btn ${selectedStatus === st.id ? 'active' : ''}`}
              onClick={() => setSelectedStatus(st.id)}
            >
              {st.label}
            </button>
          ))}
        </div>

        <div className="sort-controls">
          <span className="filter-label">Sort:</span>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="score">Highest Conviction</option>
            <option value="proximity">Closest to Pivot</option>
            <option value="rr">Highest Reward/Risk</option>
            <option value="risk">Lowest Risk %</option>
          </select>
        </div>
      </div>

      {/* 6. SETUPS COUNT & TIME STAMP */}
      <div className="swing-results-summary">
        <div className="results-count">
          Showing <strong>{filteredSetups.length}</strong> institutional swing setups
          {summary?.avg_reward_risk && (
            <span className="summary-pill">Avg R:R: <strong>{summary.avg_reward_risk}</strong></span>
          )}
          {summary?.avg_risk_pct && (
            <span className="summary-pill">Avg Risk: <strong>{summary.avg_risk_pct}</strong></span>
          )}
        </div>
        <div className="results-timestamp">
          Last Scan: {data?.generated_at || 'Just now'}
        </div>
      </div>

      {/* 7. SETUPS GRID */}
      {loading && !data ? (
        <div className="swing-loading-state">
          <RefreshCw size={32} className="spin" color="#00f2fe" />
          <p>Scanning 650+ Liquid Tickers for Institutional 1-3 Week Setups...</p>
        </div>
      ) : filteredSetups.length === 0 ? (
        <div className="swing-empty-state">
          <AlertCircle size={36} color="#64748b" />
          <h3>No Setups Matching Current Filters</h3>
          <p>Try switching to "All Setups" or clearing your search filter.</p>
          <button onClick={() => { setSelectedCategory('all'); setSelectedStatus('all'); setSearchQuery(''); }}>
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="swing-cards-grid">
          {filteredSetups.map((setup) => {
            const sizing = calculatePosition(setup.entry, setup.stop_loss, setup.target_1, setup.target_2);
            const isTriggered = setup.status === 'TRIGGERED';
            const isCopied = copiedTicker === setup.ticker;

            return (
              <div key={setup.ticker} className={`swing-card ${isTriggered ? 'triggered-card' : ''}`}>
                {/* Top Badge Strip */}
                <div className="card-top-strip">
                  <div className="card-ticker-group">
                    <div
                      className="card-ticker"
                      onClick={() => onSelectTicker && onSelectTicker(setup.ticker)}
                      title="Click to view interactive chart"
                    >
                      {setup.ticker}
                    </div>
                    <div className="card-company-info">
                      <span className="company-name">{setup.company_name || setup.ticker}</span>
                      <div className="card-sub-info-row">
                        <span className="sector-tag">{setup.sector || 'Growth & Momentum'}</span>
                        <span className="currency-pill">NYSE (USD)</span>
                        {setup.dual_listed && (
                          <span className="dual-tsx-pill" title={`Dual-listed on Toronto Stock Exchange (${setup.dual_listed.symbol}) in Canadian Dollars`}>
                            🍁 TSX: C${setup.dual_listed.price.toFixed(2)} CAD
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="card-badges-group">
                    <span
                      className="status-pill"
                      style={{
                        background: `${setup.status_color}22`,
                        color: setup.status_color,
                        borderColor: setup.status_color
                      }}
                    >
                      {setup.status_label}
                    </span>
                    <span className="category-pill-badge">{setup.category_badge}</span>
                    <span className="score-badge" title="Algorithmic Conviction Score">
                      {setup.score}
                    </span>
                  </div>
                </div>

                {/* Setup Title & Timeframe */}
                <div className="card-setup-title-row">
                  <span className="setup-title-text">{setup.setup_name}</span>
                  <span className="setup-horizon-text">
                    <Clock size={12} /> {setup.timeframe}
                  </span>
                </div>

                {/* Key Price Levels Grid */}
                <div className="price-levels-grid">
                  <div className="price-tile price-current">
                    <span className="tile-lbl">Live (USD)</span>
                    <span className="tile-val">${setup.current_price.toFixed(2)}</span>
                    {setup.change_pct !== undefined && setup.change_pct !== null && (
                      <span className={`tile-sub ${setup.change_pct >= 0 ? 'tile-sub-pos' : 'tile-sub-neg'}`}>
                        {setup.change_pct >= 0 ? `+${setup.change_pct.toFixed(2)}%` : `${setup.change_pct.toFixed(2)}%`}
                      </span>
                    )}
                    {setup.dual_listed && (
                      <span className="tile-sub-dual-cad" title={`Equivalent TSX price in CAD`}>
                        C${setup.dual_listed.price.toFixed(2)} CAD
                      </span>
                    )}
                  </div>

                  <div className="price-tile price-entry">
                    <span className="tile-lbl">Entry Pivot</span>
                    <span className="tile-val">${setup.entry.toFixed(2)}</span>
                    <span className="tile-sub">
                      {setup.proximity_pct >= 0 ? `+${setup.proximity_pct}%` : `${setup.proximity_pct}%`}
                    </span>
                  </div>

                  <div className="price-tile price-stop">
                    <span className="tile-lbl">Stop Loss</span>
                    <span className="tile-val">${setup.stop_loss.toFixed(2)}</span>
                    <span className="tile-sub-risk">-{setup.risk_pct}%</span>
                  </div>

                  <div className="price-tile price-t1">
                    <span className="tile-lbl">Target 1 (5-8d)</span>
                    <span className="tile-val">${setup.target_1.toFixed(2)}</span>
                    <span className="tile-sub-target">+{setup.target_1_pct}%</span>
                  </div>

                  <div className="price-tile price-t2">
                    <span className="tile-lbl">Target 2 (Runner)</span>
                    <span className="tile-val">${setup.target_2.toFixed(2)}</span>
                    <span className="tile-sub-target">+{setup.target_2_pct}%</span>
                  </div>
                </div>

                {/* Visual Risk Bar Spectrum */}
                <div className="risk-spectrum-container">
                  <div className="spectrum-track">
                    <div className="spectrum-sl-zone" style={{ width: '25%' }} title={`Stop Loss: $${setup.stop_loss.toFixed(2)}`}>
                      <span className="marker-label">SL ${setup.stop_loss.toFixed(2)}</span>
                    </div>
                    <div className="spectrum-entry-point" title={`Pivot Trigger: $${setup.entry.toFixed(2)}`}>
                      <span className="marker-label-pivot">PIVOT ${setup.entry.toFixed(2)}</span>
                    </div>
                    <div className="spectrum-t1-zone" style={{ width: '40%' }} title={`T1: $${setup.target_1.toFixed(2)}`}>
                      <span className="marker-label">T1 ${setup.target_1.toFixed(2)}</span>
                    </div>
                    <div className="spectrum-t2-zone" style={{ width: '35%' }} title={`T2: $${setup.target_2.toFixed(2)}`}>
                      <span className="marker-label">T2 ${setup.target_2.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="rr-asymmetry-strip">
                    <span className="asymmetry-badge">R:R {setup.reward_risk}:1</span>
                    <span className="protection-badge">Structural Floor: ${setup.support_level.toFixed(2)}</span>
                  </div>
                </div>

                {/* Catalyst & Strategy Box */}
                <div className="card-catalyst-box">
                  <div className="catalyst-row">
                    <Sparkles size={13} color="#00f2fe" style={{ minWidth: '13px', marginTop: '2px' }} />
                    <span className="catalyst-text">{setup.catalyst_note}</span>
                  </div>
                  <div className="strategy-row">
                    <ArrowRight size={13} color="#10b981" style={{ minWidth: '13px', marginTop: '2px' }} />
                    <span className="strategy-text">{setup.execution_strategy}</span>
                  </div>
                </div>

                {/* Interactive Position Sizing Output Box */}
                <div className="card-sizing-box">
                  <div className="sizing-header">
                    <Calculator size={13} color="#94a3b8" />
                    <span>Your Sizing Plan (${(accountSize/1000).toFixed(0)}k Account @ {riskPercent}% Risk)</span>
                  </div>
                  <div className="sizing-metrics-grid">
                    <div className="sizing-metric">
                      <span className="s-lbl">Shares</span>
                      <span className="s-val">{sizing.shares.toLocaleString()}</span>
                    </div>
                    <div className="sizing-metric">
                      <span className="s-lbl">Capital</span>
                      <span className="s-val">${Number(sizing.totalCapital).toLocaleString()} ({sizing.capitalPct}%)</span>
                    </div>
                    <div className="sizing-metric">
                      <span className="s-lbl">Risk</span>
                      <span className="s-val risk-val">${Number(sizing.totalRisk).toLocaleString()}</span>
                    </div>
                    <div className="sizing-metric">
                      <span className="s-lbl">Profit T1</span>
                      <span className="s-val profit-val">+${Number(sizing.profitT1).toLocaleString()}</span>
                    </div>
                    <div className="sizing-metric">
                      <span className="s-lbl">Profit T2</span>
                      <span className="s-val profit-val">+${Number(sizing.profitT2).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="card-actions-row">
                  <button
                    className="action-btn-chart"
                    onClick={() => onSelectTicker && onSelectTicker(setup.ticker)}
                  >
                    <BarChart2 size={14} />
                    <span>Open Chart</span>
                  </button>

                  <button
                    className="action-btn-fund"
                    onClick={() => onOpenFundamentals && onOpenFundamentals(setup.ticker)}
                  >
                    <ExternalLink size={14} />
                    <span>Deep Fundamentals</span>
                  </button>

                  <button
                    className={`action-btn-copy ${isCopied ? 'copied' : ''}`}
                    onClick={() => copyTradePlan(setup)}
                  >
                    {isCopied ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                    <span>{isCopied ? 'Plan Copied!' : 'Copy Plan'}</span>
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
