import React, { useState, useEffect, useMemo } from 'react';
import './AiPlaybook.css';
import {
  Sparkles, Flame, Shield, TrendingUp, TrendingDown,
  Target, RefreshCw, Layers, CheckCircle2, ChevronRight,
  Briefcase, Zap, Compass, Copy, Check, ArrowUpRight,
  BarChart2, Radio, Activity, Search, AlertCircle, ShieldCheck
} from 'lucide-react';

export default function AiPlaybookDashboard({ onTickerClick }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [copiedTicker, setCopiedTicker] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchPlaybook = async (forceRun = false) => {
    if (forceRun) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const endpoint = forceRun ? '/api/run_ai_playbook' : '/api/ai_playbook';
      const method = forceRun ? 'POST' : 'GET';
      const res = await fetch(endpoint, { method });
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const json = await res.json();
      const payload = json.data || json;
      if (payload.error) {
        setError(payload.error);
      } else {
        setData(payload);
      }
    } catch (err) {
      console.error('Failed to load AI Playbook:', err);
      setError(err.message || 'Failed to fetch playbook');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPlaybook();
  }, []);

  const handleCopy = (setup) => {
    const ex = setup.execution || {};
    const text = `🎯 [AI PLAYBOOK SETUP] $${setup.ticker} (${setup.playbook_name})
Current: $${setup.current_price} | Conviction: ${setup.conviction_rating}
• Accumulation Corridor: $${ex.entry_range ? ex.entry_range[0] : ex.ideal_entry} ── $${ex.entry_range ? ex.entry_range[1] : ex.ideal_entry}
• Invalidation Stop: $${ex.stop_loss} (${ex.stop_loss_pct}% risk)
• Target 1 (Pin): $${ex.target_primary} (+${ex.target_primary_pct}%) - Trim 50% & Breakeven
• Target 2 (Runner): $${ex.target_secondary} (+${ex.target_secondary_pct}%) - 15m Trailing
• Options Contract: ${ex.options_spec}
• Risk/Reward: ${ex.risk_reward}
• Confluence: ${setup.screeners.join(', ')}`;

    navigator.clipboard.writeText(text).then(() => {
      setCopiedTicker(setup.ticker);
      setTimeout(() => setCopiedTicker(null), 2000);
    });
  };

  const allSetups = data?.all_setups || [];
  const playbooks = data?.playbooks || {};
  const regime = data?.market_regime || {
    label: 'HEALTHY BULL MARKET',
    score: 75,
    color: '#00E676',
    guidance: 'Standard Tactical Allocation'
  };

  // Filter setups
  const filteredSetups = useMemo(() => {
    let list = allSetups;
    if (activeCategory !== 'ALL') {
      list = list.filter(s => s.playbook_id === activeCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toUpperCase();
      list = list.filter(s =>
        s.ticker.includes(q) ||
        s.screeners.some(sc => sc.toUpperCase().includes(q))
      );
    }
    return list;
  }, [allSetups, activeCategory, searchQuery]);

  const avgAsymmetry = useMemo(() => {
    if (!allSetups.length) return '1:3.2';
    const ratios = allSetups
      .map(s => parseFloat(s.execution?.risk_reward?.replace('1:', '')))
      .filter(r => !isNaN(r));
    if (!ratios.length) return '1:3.2';
    const avg = ratios.reduce((a, b) => a + b, 0) / ratios.length;
    return `1:${avg.toFixed(1)}`;
  }, [allSetups]);

  return (
    <div className="ai-playbook-root">
      
      {/* ------------------------------------------------------------------ */}
      {/* 1. COMMAND BANNER & REGIME RIBBON                                  */}
      {/* ------------------------------------------------------------------ */}
      <div className="playbook-header-card">
        <div className="playbook-header-top">
          
          <div className="playbook-identity">
            <div className="playbook-icon-box">
              <Sparkles size={24} color="#00F0FF" />
            </div>
            <div>
              <div className="playbook-title-row">
                <h1>QUANTITATIVE AI PLAYBOOK</h1>
                <span className="playbook-live-pill">
                  <span className="pulse-dot" /> LIVE EXECUTION DECK
                </span>
              </div>
              <p className="playbook-subtitle">
                Overnight multi-screener convergence clustered into 4 high-probability tactical regimes with strict risk boundaries
              </p>
            </div>
          </div>

          <div className="playbook-header-actions">
            <div className="playbook-regime-pill" style={{ borderColor: `${regime.color}55`, background: `${regime.color}15` }}>
              <Compass size={14} color={regime.color} />
              <span style={{ color: regime.color, fontWeight: 800 }}>{regime.label} ({regime.score}/100)</span>
              <span className="regime-guidance">· {regime.guidance}</span>
            </div>

            <button
              type="button"
              className="btn-playbook-regenerate"
              onClick={() => fetchPlaybook(true)}
              disabled={refreshing || loading}
            >
              <RefreshCw size={13} className={refreshing ? 'spin' : ''} />
              {refreshing ? 'Regenerating...' : '⚡ Re-Generate Playbook'}
            </button>
          </div>

        </div>

        {/* Search and Summary Sub-strip */}
        <div className="playbook-substrip">
          <div className="playbook-search-box">
            <Search size={14} color="#94a3b8" />
            <input
              type="text"
              placeholder="Search ticker or screener setup..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="playbook-stats-pills">
            <div className="stat-pill">
              <span className="label">Total Setups:</span>
              <span className="val">{allSetups.length}</span>
            </div>
            <div className="stat-pill">
              <span className="label">Avg Asymmetry:</span>
              <span className="val" style={{ color: '#fbbf24' }}>{avgAsymmetry}</span>
            </div>
            <div className="stat-pill">
              <span className="label">Generated:</span>
              <span className="val">{data?.date_str || 'Live Today'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 2. PLAYBOOK CATEGORY FILTER TABS                                   */}
      {/* ------------------------------------------------------------------ */}
      <div className="playbook-tabs-nav">
        <button
          type="button"
          className={`playbook-tab-btn ${activeCategory === 'ALL' ? 'active' : ''}`}
          onClick={() => setActiveCategory('ALL')}
        >
          <Sparkles size={14} />
          <span>All Top Setups</span>
          <span className="badge">{allSetups.length}</span>
        </button>

        <button
          type="button"
          className={`playbook-tab-btn emerald ${activeCategory === 'alpha_breakout' ? 'active' : ''}`}
          onClick={() => setActiveCategory('alpha_breakout')}
        >
          <TrendingUp size={14} />
          <span>🚀 Alpha Breakouts & VCPs</span>
          <span className="badge">{playbooks.alpha_breakout?.count || 0}</span>
        </button>

        <button
          type="button"
          className={`playbook-tab-btn cyan ${activeCategory === 'ma_pullback' ? 'active' : ''}`}
          onClick={() => setActiveCategory('ma_pullback')}
        >
          <Shield size={14} />
          <span>🛡️ MA Pullbacks & Cushions</span>
          <span className="badge">{playbooks.ma_pullback?.count || 0}</span>
        </button>

        <button
          type="button"
          className={`playbook-tab-btn purple ${activeCategory === 'squeeze_gamma' ? 'active' : ''}`}
          onClick={() => setActiveCategory('squeeze_gamma')}
        >
          <Flame size={14} />
          <span>🔥 Squeeze & Gamma Runners</span>
          <span className="badge">{playbooks.squeeze_gamma?.count || 0}</span>
        </button>

        <button
          type="button"
          className={`playbook-tab-btn amber ${activeCategory === 'fundamental_acceleration' ? 'active' : ''}`}
          onClick={() => setActiveCategory('fundamental_acceleration')}
        >
          <Zap size={14} />
          <span>📈 Fundamental Accelerators</span>
          <span className="badge">{playbooks.fundamental_acceleration?.count || 0}</span>
        </button>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 3. PLAYBOOK CARDS GRID                                             */}
      {/* ------------------------------------------------------------------ */}
      {loading ? (
        <div className="playbook-loading-state">
          <RefreshCw size={24} className="spin" color="#00F0FF" />
          <p>Auditing overnight confluence and generating institutional execution corridors...</p>
        </div>
      ) : filteredSetups.length === 0 ? (
        <div className="playbook-empty-state">
          <AlertCircle size={28} color="#94a3b8" />
          <h3>No setups match the selected filter.</h3>
          <p>Try switching to "All Top Setups" or clearing your search term.</p>
        </div>
      ) : (
        <div className="ai-playbook-grid playbook-grid">
          {filteredSetups.map((setup, idx) => {
            const ex = setup.execution || {};
            const isCopied = copiedTicker === setup.ticker;

            return (
              <div key={setup.ticker} className={`ai-playbook-card playbook-card border-${setup.playbook_color || 'emerald'}`}>
                
                {/* Card Header */}
                <div className="card-top-row">
                  <div className="card-identity-box">
                    <button
                      type="button"
                      className="ticker-btn"
                      onClick={() => onTickerClick && onTickerClick(setup.ticker)}
                      title={`Open deep chart for ${setup.ticker}`}
                    >
                      <span className="ticker-sym">${setup.ticker}</span>
                      <ArrowUpRight size={14} className="arrow-hover" />
                    </button>
                    <span className="curr-price">${setup.current_price}</span>
                  </div>

                  <div className="card-badges-row">
                    <span className={`regime-badge ${setup.playbook_color || 'emerald'}`}>
                      {setup.playbook_badge}
                    </span>
                    <span className="conviction-pill">
                      <span className="star-icon">★</span> {setup.conviction_rating}
                    </span>
                  </div>
                </div>

                {/* Subtitle Strategy Name */}
                <div className="strategy-subtitle">
                  <span className="strategy-label">{ex.strategy_name || setup.playbook_name}</span>
                </div>

                {/* 6-Tile Execution Deck */}
                <div className="playbook-execution-grid">
                  
                  {/* Tile 1: Entry Corridor */}
                  <div className="exec-tile primary">
                    <div className="exec-tile-top">
                      <span className="label">Accumulation Corridor</span>
                      <span className="tag green">ENTRY</span>
                    </div>
                    <div className="exec-val green">
                      {ex.entry_range
                        ? `$${ex.entry_range[0]} ── $${ex.entry_range[1]}`
                        : `$${ex.ideal_entry}`}
                    </div>
                    <div className="exec-sub">
                      Spot: ${setup.current_price} {ex.entry_range && setup.current_price >= ex.entry_range[0] && setup.current_price <= ex.entry_range[1] ? '🎯 In Zone' : ''}
                    </div>
                  </div>

                  {/* Tile 2: Invalidation Floor */}
                  <div className="exec-tile">
                    <div className="exec-tile-top">
                      <span className="label">Invalidation Stop</span>
                      <span className="tag rose">STOP LOSS</span>
                    </div>
                    <div className="exec-val rose">
                      ${ex.stop_loss}
                    </div>
                    <div className="exec-sub">
                      Max Risk: {ex.stop_loss_pct}%
                    </div>
                  </div>

                  {/* Tile 3: Target 1 Pin */}
                  <div className="exec-tile">
                    <div className="exec-tile-top">
                      <span className="label">Target 1 (Pin)</span>
                      <span className="tag emerald">TRIM 50%</span>
                    </div>
                    <div className="exec-val emerald">
                      ${ex.target_primary}
                    </div>
                    <div className="exec-sub" style={{ color: '#00E676' }}>
                      +{ex.target_primary_pct}% Gain · Breakeven
                    </div>
                  </div>

                  {/* Tile 4: Target 2 Runner */}
                  <div className="exec-tile">
                    <div className="exec-tile-top">
                      <span className="label">Target 2 (Runner)</span>
                      <span className="tag purple">RUNNER</span>
                    </div>
                    <div className="exec-val purple">
                      ${ex.target_secondary}
                    </div>
                    <div className="exec-sub" style={{ color: '#c084fc' }}>
                      +{ex.target_secondary_pct}% Trailing Stop
                    </div>
                  </div>

                  {/* Tile 5: Options Contract Spec */}
                  <div className="exec-tile">
                    <div className="exec-tile-top">
                      <span className="label">Options Contract</span>
                      <span className="tag cyan">STRATEGY</span>
                    </div>
                    <div className="exec-val cyan options-text">
                      {ex.options_spec}
                    </div>
                    <div className="exec-sub">
                      Defined Risk Spread
                    </div>
                  </div>

                  {/* Tile 6: Risk / Reward Expectancy */}
                  <div className="exec-tile">
                    <div className="exec-tile-top">
                      <span className="label">Quant Asymmetry</span>
                      <span className="tag amber">EDGE</span>
                    </div>
                    <div className="exec-val amber">
                      {ex.risk_reward || '1:3.0'}
                    </div>
                    <div className="exec-sub">
                      High Expected Value
                    </div>
                  </div>

                </div>

                {/* Confluence Badges & Technical Health Card */}
                <div className="card-confluence-strip">
                  <div className="confluence-header">
                    <span className="label">Multi-Screener Confluence ({setup.confluence_count}):</span>
                    <span className="tech-badge">{ex.stage} · RSI: {ex.rsi} · Vol: {ex.vol_surge}x</span>
                  </div>
                  <div className="confluence-tags">
                    {setup.screeners.map((sc, i) => (
                      <span key={i} className="confluence-tag">
                        {sc}
                      </span>
                    ))}
                  </div>
                </div>

                {/* 5-Phase Checklist Box */}
                {ex.execution_checklist && (
                  <div className="playbook-checklist-preview">
                    <div className="checklist-step">
                      <span className="step-num">1</span>
                      <span className="step-txt">{ex.execution_checklist[0]}</span>
                    </div>
                    <div className="checklist-step">
                      <span className="step-num">4</span>
                      <span className="step-txt">{ex.execution_checklist[3]}</span>
                    </div>
                  </div>
                )}

                {/* Card Action Footer */}
                <div className="card-action-footer">
                  <button
                    type="button"
                    className="action-btn chart"
                    onClick={() => onTickerClick && onTickerClick(setup.ticker)}
                  >
                    <BarChart2 size={13} />
                    <span>Deep Charting</span>
                  </button>

                  <button
                    type="button"
                    className="action-btn copy"
                    onClick={() => handleCopy(setup)}
                  >
                    {isCopied ? <Check size={13} color="#00E676" /> : <Copy size={13} />}
                    <span>{isCopied ? 'Copied Plan!' : 'Copy Plan'}</span>
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
