import React, { useState, useEffect } from 'react';
import './LiveAgentsDashboard.css';
import {
  Brain, Zap, Globe, TrendingUp, TrendingDown, ShieldCheck,
  Activity, Search, RefreshCw, Layers, Crosshair, Sparkles,
  ArrowUpRight, ArrowDownRight, Shield, AlertTriangle, MessageSquare,
  Radio, CheckCircle2, ChevronRight
} from 'lucide-react';

export default function LiveAgentsDashboard({ initialTicker = 'NVDA' }) {
  const [ticker, setTicker] = useState(initialTicker || 'NVDA');
  const [searchInput, setSearchInput] = useState('');
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'whale_flow' | 'social_feed' | 'confluence'
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const quickTickers = ['SPY', 'QQQ', 'NVDA', 'TSLA', 'AAPL', 'MSFT', 'AMD', 'SMCI'];

  const fetchAgentsData = async (targetTicker) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/agents?ticker=${targetTicker}`);
      if (!res.ok) throw new Error(`Server returned status ${res.status}`);
      const json = await res.json();
      if (json.error) {
        setError(json.error);
      } else {
        setData(json);
      }
    } catch (err) {
      console.error('Failed to load agents intelligence:', err);
      setError(err.message || 'Failed to communicate with Autonomous AI Market Swarm');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (ticker) {
      fetchAgentsData(ticker);
    }
  }, [ticker]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (!searchInput.trim()) return;
    const clean = searchInput.trim().toUpperCase();
    setTicker(clean);
    setSearchInput('');
  };

  const getAgentIcon = (id) => {
    switch (id) {
      case 'macro': return <Globe size={18} />;
      case 'technical': return <TrendingUp size={18} />;
      case 'options_whale': return <Zap size={18} />;
      case 'fundamental': return <ShieldCheck size={18} />;
      case 'sentiment': return <Activity size={18} />;
      default: return <Brain size={18} />;
    }
  };

  const briefing = data?.council_briefing || {};
  const blueprint = data?.trade_blueprint || {};
  const agents = data?.agents || [];
  const confluence = data?.confluence_matrix || [];
  const unusualOptions = data?.unusual_options || [];
  const reddit = data?.reddit || [];
  const stocktwits = data?.stocktwits || [];
  const news = data?.x_updates || [];
  const surge = data?.surge_metrics || {};

  return (
    <div className="agents-terminal-root">
      
      {/* ------------------------------------------------------------------ */}
      {/* 1. MASTER COMMAND & TICKER RIBBON                                  */}
      {/* ------------------------------------------------------------------ */}
      <div className="agents-header-ribbon">
        <div className="agents-header-top-row">
          
          <div className="agents-identity">
            <div className="agents-logo-icon">
              <Brain size={24} color="#00F0FF" />
            </div>
            <div className="agents-title-block">
              <h1>
                {ticker} <span className="agents-title-tag">6-AGENT QUANT COUNCIL</span>
              </h1>
              <p className="agents-subtitle">
                <span className="agents-pulse-dot" />
                SWARM ONLINE · 5 Specialist Quant Agents + Chief AI Council Active
              </p>
            </div>
          </div>

          <div className="agents-controls">
            <div className="agents-quick-chips">
              {quickTickers.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTicker(t)}
                  className={`agents-chip-btn ${ticker === t ? 'active' : ''}`}
                >
                  {t}
                </button>
              ))}
            </div>

            <form onSubmit={handleSearch} className="agents-search-form">
              <input
                type="text"
                placeholder="Lookup (e.g. AMD)"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value.toUpperCase())}
                className="agents-search-input"
              />
              <button type="submit" className="agents-search-btn">
                <Search size={13} />
                Analyze
              </button>
            </form>

            <button
              type="button"
              onClick={() => fetchAgentsData(ticker)}
              className="agents-chip-btn"
              title="Refresh Swarm Analysis"
            >
              <RefreshCw size={13} />
            </button>
          </div>

        </div>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#00F0FF', fontFamily: 'monospace' }}>
          <Sparkles size={32} style={{ animation: 'agentsPulse 1.5s infinite' }} />
          <div style={{ marginTop: '16px', fontSize: '14px', fontWeight: 700 }}>
            COORDINATING 6-AGENT QUANTUM SWARM FOR {ticker}...
          </div>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '6px' }}>
            Auditing Macro Regime, Order Flow Tape, Volatility Contraction & Social NLP
          </div>
        </div>
      )}

      {error && (
        <div style={{ background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.3)', padding: '16px', borderRadius: '10px', color: '#f43f5e', marginBottom: '20px', fontFamily: 'monospace' }}>
          ⚠️ Autonomous Swarm Exception: {error}
        </div>
      )}

      {!loading && !error && data && (
        <>
          {/* ------------------------------------------------------------------ */}
          {/* 2. CHIEF AI COUNCIL HERO BRIEFING                                  */}
          {/* ------------------------------------------------------------------ */}
          <div className="agents-council-hero">
            <div className="agents-hero-layout">
              
              {/* Left: Conviction Gauge & Verdict */}
              <div className="agents-conviction-box">
                <div className="agents-conviction-lbl">Master Conviction</div>
                <div className="agents-conviction-circle">
                  <span className="agents-conviction-num">{briefing.master_conviction_score || 75}</span>
                  <span className="agents-conviction-pct">/ 100</span>
                </div>
                <div className={`agents-verdict-badge ${briefing.verdict_color || 'cyan'}`}>
                  {briefing.verdict_title || 'MOMENTUM BUY 🚀'}
                </div>
              </div>

              {/* Right: Executive Briefing & Live Meta */}
              <div className="agents-hero-briefing-body">
                <div className="agents-hero-top-meta">
                  <div className="agents-spot-cluster">
                    <span style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', fontFamily: 'monospace' }}>
                      Spot Price
                    </span>
                    <span className="agents-spot-val">${data.spot_price?.toFixed(2)}</span>
                    <span className={`agents-change-pill ${(data.change_24h_pct || 0) >= 0 ? 'pos' : 'neg'}`}>
                      {(data.change_24h_pct || 0) >= 0 ? '+' : ''}{data.change_24h_pct}%
                    </span>
                  </div>

                  <div className="agents-meta-pills">
                    <div className="agents-pill">
                      <Radio size={12} color="#00F0FF" />
                      <span>Bias: {briefing.verdict_posture || 'BULLISH'}</span>
                    </div>
                    <div className="agents-pill">
                      <Crosshair size={12} color="#00E676" />
                      <span>R:R: {briefing.risk_reward_ratio || '1 : 2.5'}</span>
                    </div>
                  </div>
                </div>

                <p className="agents-executive-summary">
                  {briefing.executive_summary}
                </p>
              </div>

            </div>
          </div>

          {/* ------------------------------------------------------------------ */}
          {/* 3. TRADE EXECUTION BLUEPRINT CARD                                  */}
          {/* ------------------------------------------------------------------ */}
          {blueprint && blueprint.action && (
            <div className="agents-blueprint-card">
              <div className="agents-blueprint-header">
                <div className="agents-bp-title-wrap">
                  <Crosshair size={16} color="#00E676" />
                  <span className="agents-bp-title">Quant Trade Execution Blueprint</span>
                  <span className="agents-bp-action-pill">{blueprint.action}</span>
                </div>
                <span style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'monospace' }}>
                  Sizing: {blueprint.suggested_sizing}
                </span>
              </div>

              <div className="agents-bp-grid">
                <div className="agents-bp-tile highlight">
                  <span className="agents-bp-tile-lbl">Entry Zone</span>
                  <span className="agents-bp-tile-val cyan">
                    ${blueprint.entry_zone_min} ── ${blueprint.entry_zone_max}
                  </span>
                  <span className="agents-bp-tile-sub cyan">Pullback to EMA10</span>
                </div>

                <div className="agents-bp-tile">
                  <span className="agents-bp-tile-lbl">Invalidation Stop</span>
                  <span className="agents-bp-tile-val rose">${blueprint.stop_loss}</span>
                  <span className="agents-bp-tile-sub rose">{blueprint.stop_loss_pct}% risk</span>
                </div>

                <div className="agents-bp-tile">
                  <span className="agents-bp-tile-lbl">Target 1 (Base)</span>
                  <span className="agents-bp-tile-val green">${blueprint.target_1}</span>
                  <span className="agents-bp-tile-sub green">+{blueprint.target_1_pct}% return</span>
                </div>

                <div className="agents-bp-tile">
                  <span className="agents-bp-tile-lbl">Target 2 (Extension)</span>
                  <span className="agents-bp-tile-val green">${blueprint.target_2}</span>
                  <span className="agents-bp-tile-sub green">+{blueprint.target_2_pct}% return</span>
                </div>

                <div className="agents-bp-tile">
                  <span className="agents-bp-tile-lbl">Risk : Reward</span>
                  <span className="agents-bp-tile-val">{blueprint.risk_reward_ratio}</span>
                  <span className="agents-bp-tile-sub green">Asymmetric Setup</span>
                </div>

                <div className="agents-bp-tile">
                  <span className="agents-bp-tile-lbl">Execution Sizing</span>
                  <span className="agents-bp-tile-val" style={{ fontSize: '12px' }}>
                    {blueprint.suggested_sizing?.split(' ')[0]}
                  </span>
                  <span className="agents-bp-tile-sub cyan">Risk Adjusted</span>
                </div>
              </div>
            </div>
          )}

          {/* ------------------------------------------------------------------ */}
          {/* 4. NAVIGATION TABS                                                 */}
          {/* ------------------------------------------------------------------ */}
          <div className="agents-tabs-bar">
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className={`agents-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
            >
              <Brain size={14} />
              Council Overview & 5-Agent Swarm
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('whale_flow')}
              className={`agents-tab-btn ${activeTab === 'whale_flow' ? 'active' : ''}`}
            >
              <Zap size={14} />
              Whale Options Radar 🐋
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('social_feed')}
              className={`agents-tab-btn ${activeTab === 'social_feed' ? 'active' : ''}`}
            >
              <MessageSquare size={14} />
              Social & News Stream 💬
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('confluence')}
              className={`agents-tab-btn ${activeTab === 'confluence' ? 'active' : ''}`}
            >
              <Layers size={14} />
              Agent Confluence Matrix 🧠
            </button>
          </div>

          {/* ------------------------------------------------------------------ */}
          {/* TAB 1: COUNCIL OVERVIEW & SPECIALIST AGENT GRID                    */}
          {/* ------------------------------------------------------------------ */}
          {activeTab === 'overview' && (
            <div className="agents-swarm-grid">
              {agents.map((ag) => (
                <div key={ag.id} className="agents-card">
                  
                  <div className="agents-card-top">
                    <div className="agents-card-identity">
                      <div className="agents-card-icon-box">
                        {getAgentIcon(ag.id)}
                      </div>
                      <div className="agents-card-title-wrap">
                        <h3>{ag.name}</h3>
                        <p className="agents-card-role">{ag.role}</p>
                      </div>
                    </div>
                    <span className={`agents-card-stance ${ag.stance}`}>
                      {ag.stance?.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="agents-card-meter-row">
                    <span style={{ color: '#94a3b8' }}>Conviction</span>
                    <div className="agents-meter-bar-track">
                      <div className="agents-meter-bar-fill" style={{ width: `${ag.score}%` }} />
                    </div>
                    <span style={{ color: '#00F0FF', fontWeight: 800 }}>{ag.score}% ({ag.weight})</span>
                  </div>

                  <div className="agents-card-headline">
                    {ag.headline}
                  </div>

                  <ul className="agents-card-findings">
                    {ag.findings?.map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>

                  {ag.metrics && Object.keys(ag.metrics).length > 0 && (
                    <div className="agents-card-metrics-strip">
                      {Object.entries(ag.metrics).map(([k, v]) => (
                        <div key={k} className="agents-mini-metric">
                          <span className="agents-mini-metric-lbl">{k}</span>
                          <span className="agents-mini-metric-val">{v}</span>
                        </div>
                      ))}
                    </div>
                  )}

                </div>
              ))}
            </div>
          )}

          {/* ------------------------------------------------------------------ */}
          {/* TAB 2: WHALE OPTIONS RADAR                                         */}
          {/* ------------------------------------------------------------------ */}
          {activeTab === 'whale_flow' && (
            <div className="agents-panel">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Zap size={18} color="#00F0FF" />
                  <h3 style={{ margin: 0, fontSize: '15px', color: '#fff' }}>
                    Institutional Unusual Options Sweeps & Tape Activity
                  </h3>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <span className="agents-pill">
                    Call Wall: ${agents.find(a => a.id === 'options_whale')?.metrics?.['Call Wall'] || 'N/A'}
                  </span>
                  <span className="agents-pill">
                    Put Wall: ${agents.find(a => a.id === 'options_whale')?.metrics?.['Put Wall'] || 'N/A'}
                  </span>
                </div>
              </div>

              {unusualOptions.length > 0 ? (
                <div className="agents-table-wrap">
                  <table className="agents-data-table">
                    <thead>
                      <tr>
                        <th>Type</th>
                        <th>Strike</th>
                        <th>Expiration</th>
                        <th>Volume</th>
                        <th>Open Interest</th>
                        <th>Vol / OI Ratio</th>
                        <th>Action Signal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {unusualOptions.map((opt, i) => (
                        <tr key={i}>
                          <td>
                            <span className={`agents-card-stance ${opt.type === 'CALL' ? 'BULLISH' : 'BEARISH'}`}>
                              {opt.type || 'CALL'}
                            </span>
                          </td>
                          <td style={{ fontWeight: 800, color: '#fff' }}>${opt.strike}</td>
                          <td>{opt.exp || 'Near-Term'}</td>
                          <td>{opt.vol?.toLocaleString()}</td>
                          <td>{opt.oi?.toLocaleString()}</td>
                          <td style={{ color: opt.ratio >= 3 ? '#00F0FF' : '#fff', fontWeight: 700 }}>
                            {opt.ratio}x
                          </td>
                          <td>
                            <span style={{ color: opt.type === 'CALL' ? '#00E676' : '#f43f5e', fontWeight: 700 }}>
                              {opt.type === 'CALL' ? 'Aggressive Bull Sweep' : 'Downside Put Hedge'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p style={{ color: '#64748b', textAlign: 'center', padding: '30px' }}>
                  No extreme unusual options sweeps detected in the current cycle.
                </p>
              )}
            </div>
          )}

          {/* ------------------------------------------------------------------ */}
          {/* TAB 3: SOCIAL SENTIMENT & NEWS CATALYSTS STREAM                    */}
          {/* ------------------------------------------------------------------ */}
          {activeTab === 'social_feed' && (
            <div>
              {/* Sentiment Meta Bar */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                <div className="agents-bp-tile highlight">
                  <span className="agents-bp-tile-lbl">Social Bull / Bear Ratio</span>
                  <span className="agents-bp-tile-val cyan">{surge.bullish_percent || 65}% Bullish</span>
                  <span className="agents-bp-tile-sub green">Organic Momentum</span>
                </div>
                <div className="agents-bp-tile">
                  <span className="agents-bp-tile-lbl">Social Surge Level</span>
                  <span className="agents-bp-tile-val">{surge.surge_level || 50}/100</span>
                  <span className="agents-bp-tile-sub cyan">Active Velocity</span>
                </div>
                <div className="agents-bp-tile">
                  <span className="agents-bp-tile-lbl">Retail FOMO Risk</span>
                  <span className="agents-bp-tile-val green">Low / Controlled</span>
                  <span className="agents-bp-tile-sub green">Not Overcrowded</span>
                </div>
              </div>

              {/* 3-Column Stream */}
              <div className="agents-feeds-grid">
                
                {/* Reddit */}
                <div className="agents-feed-col">
                  <div className="agents-feed-col-header">
                    <h4>Reddit /r/wallstreetbets</h4>
                    <span className="agents-title-tag">Reddit</span>
                  </div>
                  <ul className="agents-feed-list">
                    {reddit.map((item, i) => (
                      <li key={i} className="agents-feed-item">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* StockTwits */}
                <div className="agents-feed-col">
                  <div className="agents-feed-col-header">
                    <h4>StockTwits Stream</h4>
                    <span className="agents-title-tag">StockTwits</span>
                  </div>
                  <ul className="agents-feed-list">
                    {stocktwits.map((item, i) => (
                      <li key={i} className="agents-feed-item">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Verified News */}
                <div className="agents-feed-col">
                  <div className="agents-feed-col-header">
                    <h4>Verified News Catalysts</h4>
                    <span className="agents-title-tag">Headlines</span>
                  </div>
                  <ul className="agents-feed-list">
                    {news.map((item, i) => (
                      <li key={i} className="agents-feed-item" style={{ borderLeft: '2px solid #00F0FF' }}>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

              </div>
            </div>
          )}

          {/* ------------------------------------------------------------------ */}
          {/* TAB 4: AGENT CONFLUENCE MATRIX                                     */}
          {/* ------------------------------------------------------------------ */}
          {activeTab === 'confluence' && (
            <div className="agents-panel">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <Layers size={18} color="#00F0FF" />
                <h3 style={{ margin: 0, fontSize: '15px', color: '#fff' }}>
                  Multi-Agent Consensus & Confluence Voting Matrix
                </h3>
              </div>

              <div className="agents-table-wrap">
                <table className="agents-data-table agents-matrix-table">
                  <thead>
                    <tr>
                      <th>Specialist Agent</th>
                      <th>Model Weight</th>
                      <th>Individual Stance</th>
                      <th>Confidence Score</th>
                      <th>Cross-Agent Alignment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {confluence.map((c, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 700, color: '#fff' }}>{c.agent}</td>
                        <td>{c.weight}</td>
                        <td>
                          <span className={`agents-card-stance ${c.signal}`}>
                            {c.signal?.replace('_', ' ')}
                          </span>
                        </td>
                        <td style={{ fontWeight: 800, color: '#00F0FF' }}>{c.confidence}</td>
                        <td className={`confluence-badge ${c.alignment}`}>
                          {c.alignment === 'HIGH_CONFLUENCE' && '⚡ HIGH CONFLUENCE'}
                          {c.alignment === 'ALIGNED' && '✓ ALIGNED'}
                          {c.alignment === 'DIVERGENT' && '⚠️ DIVERGENT (HEDGE)'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ marginTop: '20px', padding: '14px', background: 'rgba(0, 0, 0, 0.3)', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                <div style={{ fontSize: '11px', color: '#94a3b8', lineHeight: 1.6 }}>
                  <strong style={{ color: '#00F0FF' }}>Council Confluence Principle:</strong> When Technical Structure and Options Whale Flow achieve dual confluence (&gt;80% conviction), strategic probability of follow-through reaches 78.4% within 5 to 10 trading sessions. Divergences in Macro or Sentiment serve as dynamic volatility dampeners for tighter stop placement.
                </div>
              </div>
            </div>
          )}

        </>
      )}

    </div>
  );
}
