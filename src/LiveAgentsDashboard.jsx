import React, { useState, useEffect, useMemo } from 'react';
import './LiveAgentsDashboard.css';
import {
  Brain, Zap, Globe, TrendingUp, TrendingDown, ShieldCheck,
  Activity, Search, RefreshCw, Layers, Crosshair, Sparkles,
  Shield, AlertTriangle, MessageSquare, Radio, ChevronDown,
  ChevronUp, Clock, Compass, Award, Send, Bot, Flame
} from 'lucide-react';

export default function LiveAgentsDashboard({ initialTicker = 'NVDA' }) {
  const [ticker, setTicker] = useState((initialTicker || 'NVDA').toUpperCase());
  const [searchInput, setSearchInput] = useState('');
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'ask_council' | 'confluence' | 'whale_flow' | 'social_feed'
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dispatching, setDispatching] = useState(false);
  const [dispatchSuccess, setDispatchSuccess] = useState(false);
  const [expandedTelemetry, setExpandedTelemetry] = useState({});
  const [showScannerStrip, setShowScannerStrip] = useState(true);

  // Interactive Ask-the-Council state
  const [chatHistory, setChatHistory] = useState([]);
  const [customQuestion, setCustomQuestion] = useState('');

  const quickTickers = ['SPY', 'QQQ', 'NVDA', 'TSLA', 'AAPL', 'MSFT', 'AMD', 'META', 'PLTR', 'SMCI'];

  const fetchAgentsData = async (targetTicker) => {
    setLoading(true);
    setError(null);
    const clean = (targetTicker || 'NVDA').toUpperCase().trim();
    const urls = [
      `/api/agents?ticker=${encodeURIComponent(clean)}`,
      `http://127.0.0.1:5000/api/agents?ticker=${encodeURIComponent(clean)}`
    ];
    for (const url of urls) {
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const json = await res.json();
        if (json && !json.error) {
          setData(json);
          const qaList = json.council_briefing?.qa_knowledge || [];
          setChatHistory(
            qaList.length > 0
              ? [{ role: 'assistant', title: `8-Agent Executive Briefing for ${clean}`, text: json.council_briefing?.executive_summary || json.synthesis }]
              : []
          );
          setLoading(false);
          return;
        }
      } catch (err) {
        // try fallback
      }
    }
    setError(`Failed to communicate with 8-Agent Autonomous Swarm for ${clean}.`);
    setLoading(false);
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

  const toggleTelemetry = (id) => {
    setExpandedTelemetry((prev) => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleDispatchTelegram = async () => {
    if (!data) return;
    setDispatching(true);
    try {
      await fetch('/api/webhook_alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticker,
          source: '8-Agent Chief AI Council',
          message: data.synthesis || `AI Council Alert for ${ticker}`,
          priority: 'HIGH'
        })
      });
      setDispatchSuccess(true);
      setTimeout(() => setDispatchSuccess(false), 3500);
    } catch (err) {
      console.error('Dispatch error:', err);
    } finally {
      setDispatching(false);
    }
  };

  const getAgentIcon = (id) => {
    switch (id) {
      case 'macro': return <Globe size={18} color="#38bdf8" />;
      case 'stage_canslim': return <Award size={18} color="#fbbf24" />;
      case 'technical': return <TrendingUp size={18} color="#10b981" />;
      case 'options_whale': return <Zap size={18} color="#00F0FF" />;
      case 'wyckoff_vsa': return <Layers size={18} color="#c084fc" />;
      case 'classical_geometry': return <Compass size={18} color="#f472b6" />;
      case 'fundamental': return <ShieldCheck size={18} color="#34d399" />;
      case 'sentiment': return <Activity size={18} color="#fb923c" />;
      default: return <Brain size={18} color="#00F0FF" />;
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
  const scanner = data?.market_scanner || {};
  const voteTally = briefing.vote_tally || {
    bullish: agents.filter((a) => (a.stance || '').includes('BULLISH')).length,
    neutral: agents.filter((a) => a.stance === 'NEUTRAL').length,
    bearish: agents.filter((a) => (a.stance || '').includes('BEARISH')).length,
    total: agents.length || 8
  };

  // Dynamic Q&A Synthesizer using all 8 agents' live data
  const answerUserQuestion = (qText) => {
    const qLower = qText.toLowerCase();
    const qaPreset = (briefing.qa_knowledge || []).find((item) => item.q.toLowerCase() === qLower);
    if (qaPreset) {
      return qaPreset.a;
    }

    const kl = blueprint.key_levels || {};
    const optStrat = blueprint.options_strategy || {};
    const stageAg = agents.find((a) => a.id === 'stage_canslim') || {};
    const wyckAg = agents.find((a) => a.id === 'wyckoff_vsa') || {};
    const gannAg = agents.find((a) => a.id === 'classical_geometry') || {};
    const optAg = agents.find((a) => a.id === 'options_whale') || {};
    const macroAg = agents.find((a) => a.id === 'macro') || {};

    if (qLower.includes('gann') || qLower.includes('elliott') || qLower.includes('square') || qLower.includes('time')) {
      return `📐 **W.D. Gann & Elliott Wave Council (${gannAg.score || 68}%):** ${gannAg.headline || ''}\n• ${(gannAg.findings || []).join('\n• ')}`;
    }
    if (qLower.includes('wyckoff') || qLower.includes('stage') || qLower.includes('canslim') || qLower.includes('vcp')) {
      return `🏛️ **Weinstein Stage & Wyckoff Synthesis:**\n• **Stage/CANSLIM (${stageAg.score}%):** ${stageAg.headline}\n• **Wyckoff VSA (${wyckAg.score}%):** ${wyckAg.headline}\n• ${(stageAg.findings || []).slice(0, 2).join('\n• ')}`;
    }
    if (qLower.includes('option') || qLower.includes('gex') || qLower.includes('wall') || qLower.includes('call') || qLower.includes('put')) {
      return `🐋 **Options Whale & GEX Council (${optAg.score}%):** ${optAg.headline}\n• **Recommended Strategy:** ${optStrat.strategy_name || 'Vertical Spread'} — ${optStrat.structure || ''}\n• **Rationale:** ${optStrat.rationale || ''}\n• ${(optAg.findings || []).join('\n• ')}`;
    }
    if (qLower.includes('bottom') || qLower.includes('top') || qLower.includes('macro') || qLower.includes('sector')) {
      return `🧭 **Macro & 10-Year Sector Flow Council (${macroAg.score}%):** ${macroAg.headline}\n• ${(macroAg.findings || []).join('\n• ')}`;
    }
    if (qLower.includes('stop') || qLower.includes('entry') || qLower.includes('target') || qLower.includes('buy') || qLower.includes('trade')) {
      return `🎯 **Execution Blueprint for ${ticker} (Spot $${data?.spot_price?.toFixed(2)}):**\n• **Action:** ${blueprint.action} (${blueprint.suggested_sizing})\n• **Entry Zone:** $${blueprint.entry_zone_min} – $${blueprint.entry_zone_max} (AVWAP $${kl.avwap || '—'} / 10-EMA $${kl.ema10 || '—'})\n• **Invalidation Stop:** $${blueprint.stop_loss} (${blueprint.stop_loss_pct}%)\n• **Targets:** Target 1 $${blueprint.target_1} (+${blueprint.target_1_pct}%) · Target 2 $${blueprint.target_2} (+${blueprint.target_2_pct}%) · R/R ${blueprint.risk_reward_ratio}`;
    }

    return (
      `🧠 **8-Council Omni-Quant Synthesis for ${ticker} (Conviction: ${briefing.master_conviction_score}% — ${briefing.verdict_title}):**\n` +
      `• **Action Directive:** ${blueprint.action} | Entry: $${blueprint.entry_zone_min}–$${blueprint.entry_zone_max} | Stop: $${blueprint.stop_loss} | T1: $${blueprint.target_1} | T2: $${blueprint.target_2}\n` +
      `• **Stage & Wyckoff:** ${stageAg.headline} | ${wyckAg.headline}\n` +
      `• **Options & Gann:** ${optAg.headline} | ${gannAg.headline}\n` +
      `• **Chief Skeptic Risk:** ${briefing.chief_skeptic}`
    );
  };

  const handleAskQuestion = (qStr) => {
    const cleanQ = (qStr || customQuestion).trim();
    if (!cleanQ) return;
    const reply = answerUserQuestion(cleanQ);
    setChatHistory((prev) => [
      ...prev,
      { role: 'user', text: cleanQ },
      { role: 'assistant', title: `8-Council Response · ${ticker}`, text: reply }
    ]);
    setCustomQuestion('');
  };

  // 8-Axis Octagonal Radar Chart
  const renderConfluenceRadar = () => {
    const radarData = data?.radar_data && data.radar_data.length >= 5 ? data.radar_data : [
      { axis: 'Stage/CANSLIM', score: 75, weight: '20%' },
      { axis: 'Whale & GEX', score: 74, weight: '18%' },
      { axis: 'Tech/Squeeze', score: 65, weight: '15%' },
      { axis: 'Macro/SecFlow', score: 55, weight: '15%' },
      { axis: 'Wyckoff VSA', score: 62, weight: '12%' },
      { axis: 'Gann/Elliott', score: 68, weight: '10%' },
      { axis: 'Fundamentals', score: 80, weight: '5%' },
      { axis: 'Sentiment/NLP', score: 65, weight: '5%' }
    ];

    const cx = 195;
    const cy = 148;
    const R = 95;
    const numAxes = radarData.length;

    const getPolygonPoints = (radiusRatio) =>
      radarData.map((_, i) => {
        const angle = -Math.PI / 2 + (i * 2 * Math.PI) / numAxes;
        const x = cx + R * radiusRatio * Math.cos(angle);
        const y = cy + R * radiusRatio * Math.sin(angle);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      }).join(' ');

    const dataPoints = radarData.map((d, i) => {
      const ratio = Math.max(Math.min((d.score || 50) / 100, 1), 0.12);
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / numAxes;
      const x = cx + R * ratio * Math.cos(angle);
      const y = cy + R * ratio * Math.sin(angle);
      return { x, y, score: d.score, axis: d.axis, weight: d.weight };
    });

    const dataPolygonString = dataPoints.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

    return (
      <div className="agents-radar-container">
        <div className="agents-radar-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={14} color="#00F0FF" />
            <span className="agents-radar-title">{numAxes}-Council Omni-Quant Confluence Geometry Radar</span>
          </div>
          <span className="agents-radar-badge">Multi-Engine Octagonal Synthesis</span>
        </div>

        <div className="agents-radar-content-row">
          <div className="agents-radar-svg-wrap">
            <svg viewBox="0 0 390 296" className="agents-radar-svg">
              <defs>
                <linearGradient id="polyGradient8" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#00F0FF" stopOpacity="0.42" />
                  <stop offset="50%" stopColor="#a855f7" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.38" />
                </linearGradient>
              </defs>

              {[0.25, 0.5, 0.75, 1.0].map((ring, idx) => (
                <polygon
                  key={idx}
                  points={getPolygonPoints(ring)}
                  fill={idx === 3 ? 'rgba(15, 23, 42, 0.45)' : 'none'}
                  stroke="rgba(255, 255, 255, 0.09)"
                  strokeWidth={idx === 3 ? '1.5' : '1'}
                  strokeDasharray={idx === 3 ? 'none' : '3,3'}
                />
              ))}

              {radarData.map((_, i) => {
                const angle = -Math.PI / 2 + (i * 2 * Math.PI) / numAxes;
                const x = cx + R * Math.cos(angle);
                const y = cy + R * Math.sin(angle);
                return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(255, 255, 255, 0.15)" strokeWidth="1" />;
              })}

              <polygon
                points={dataPolygonString}
                fill="url(#polyGradient8)"
                stroke="#00F0FF"
                strokeWidth="2.4"
                style={{ filter: 'drop-shadow(0 0 8px rgba(0, 240, 255, 0.4))' }}
              />

              {dataPoints.map((p, i) => {
                const angle = -Math.PI / 2 + (i * 2 * Math.PI) / numAxes;
                const labelDist = R + 24;
                const lx = cx + labelDist * Math.cos(angle);
                const ly = cy + labelDist * Math.sin(angle) + 3;
                return (
                  <g key={i}>
                    <circle cx={p.x} cy={p.y} r="4.5" fill={p.score >= 70 ? '#00E676' : p.score >= 50 ? '#fbbf24' : '#f43f5e'} stroke="#060910" strokeWidth="2" />
                    <text x={lx} y={ly} textAnchor="middle" fill="#e2e8f0" fontSize="9.5" fontFamily="monospace" fontWeight="700">
                      {p.axis} ({p.score}%)
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="agents-radar-legend-col">
            <div className="agents-radar-stat-box">
              <span className="agents-radar-stat-lbl">8-Council Consensus</span>
              <span className="agents-radar-stat-val cyan">
                {briefing.master_conviction_score || 70}%
              </span>
              <span className="agents-radar-stat-sub">
                {voteTally.bullish} Bull · {voteTally.neutral} Neut · {voteTally.bearish} Bear
              </span>
            </div>

            <div className="agents-radar-axes-list">
              {radarData.map((d, i) => (
                <div key={i} className="agents-radar-axis-row">
                  <span className="agents-radar-axis-name">{d.axis}</span>
                  <div className="agents-radar-mini-bar">
                    <div
                      className="agents-radar-mini-fill"
                      style={{
                        width: `${d.score}%`,
                        background: d.score >= 70 ? '#10b981' : d.score >= 50 ? '#38bdf8' : '#f43f5e'
                      }}
                    />
                  </div>
                  <span className="agents-radar-axis-score">{d.score}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

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
                {ticker} <span className="agents-title-tag">8-COUNCIL OMNI-QUANT AI AGENT v3.0</span>
              </h1>
              <p className="agents-subtitle">
                <span className="agents-pulse-dot" />
                FUSING STAGE/CANSLIM · WYCKOFF VSA · GANN SQ9 · ELLIOTT WAVE · DEALER GEX · 10Y SECTOR FLOW · FUNDAMENTALS · NLP
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
                placeholder="Any Ticker (e.g. AVGO)"
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
              onClick={() => setShowScannerStrip(!showScannerStrip)}
              className="agents-chip-btn"
              title="Toggle Market-Wide AI Opportunity & Sector Flow Radar"
            >
              <Flame size={13} color="#fbbf24" />
              <span style={{ marginLeft: '4px' }}>{showScannerStrip ? 'Hide Radar' : 'Market Radar'}</span>
            </button>

            <button
              type="button"
              onClick={() => fetchAgentsData(ticker)}
              className="agents-chip-btn"
              title="Refresh 8-Council Swarm Analysis"
            >
              <RefreshCw size={13} />
            </button>

            <button
              type="button"
              onClick={handleDispatchTelegram}
              disabled={dispatching}
              className={`agents-chip-btn agents-dispatch-btn ${dispatchSuccess ? 'success' : ''}`}
              title="Dispatch Trade Blueprint & Alert to Telegram"
            >
              <Radio size={13} className={dispatching ? 'animate-pulse' : ''} />
              <span>{dispatchSuccess ? 'Dispatched ✓' : (dispatching ? 'Sending...' : 'Dispatch Alert')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 1B. MARKET-WIDE AUTONOMOUS OPPORTUNITY & SECTOR ROTATION STRIP     */}
      {/* ------------------------------------------------------------------ */}
      {showScannerStrip && scanner && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))',
          gap: '12px',
          marginBottom: '18px'
        }}>
          {/* Col 1: Top Cross-Engine Bullish Setups */}
          <div style={{
            background: 'rgba(13, 21, 38, 0.92)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '12px',
            padding: '12px 14px'
          }}>
            <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#10b981', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
              🔥 Autonomous AI Top Bullish Setups (Click to Inspect)
            </div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {(scanner.top_bull_picks || []).map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => p.ticker && setTicker(p.ticker)}
                  style={{
                    background: ticker === p.ticker ? 'rgba(16, 185, 129, 0.25)' : 'rgba(30, 41, 59, 0.7)',
                    border: `1px solid ${ticker === p.ticker ? '#10b981' : 'rgba(16, 185, 129, 0.3)'}`,
                    borderRadius: '8px',
                    padding: '5px 9px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    color: '#f8fafc',
                    fontSize: '0.73rem'
                  }}
                >
                  <div style={{ fontWeight: 900, color: '#34d399', fontFamily: 'monospace' }}>
                    {p.ticker} {p.price ? `$${Number(p.price).toFixed(0)}` : ''}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>
                    Score {p.score} • {p.source}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Col 2: 10Y Sector Flow Inflow Leaders */}
          <div style={{
            background: 'rgba(13, 21, 38, 0.92)',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            borderRadius: '12px',
            padding: '12px 14px'
          }}>
            <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#38bdf8', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
              🟢 20D Institutional Sector Inflow Leaders
            </div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {(scanner.sector_inflow_leaders || []).map((s, idx) => (
                <button
                  key={idx}
                  onClick={() => setTicker(s.ticker)}
                  style={{
                    background: 'rgba(30, 41, 59, 0.7)',
                    border: '1px solid rgba(56, 189, 248, 0.3)',
                    borderRadius: '8px',
                    padding: '5px 9px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontSize: '0.73rem'
                  }}
                >
                  <div style={{ fontWeight: 900, color: '#38bdf8', fontFamily: 'monospace' }}>
                    {s.ticker} ({s.cmf_20d >= 0 ? '+' : ''}{Number(s.cmf_20d).toFixed(3)})
                  </div>
                  <div style={{ fontSize: '0.65rem', color: '#cbd5e1' }}>{s.name}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Col 3: 10Y Sector Flow Distribution / Outflow Warnings */}
          <div style={{
            background: 'rgba(13, 21, 38, 0.92)',
            border: '1px solid rgba(244, 63, 94, 0.3)',
            borderRadius: '12px',
            padding: '12px 14px'
          }}>
            <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#f43f5e', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
              🔻 Heavy Sector Distribution / Outflow Warnings
            </div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {(scanner.sector_outflow_warnings || []).map((s, idx) => (
                <button
                  key={idx}
                  onClick={() => setTicker(s.ticker)}
                  style={{
                    background: 'rgba(30, 41, 59, 0.7)',
                    border: '1px solid rgba(244, 63, 94, 0.35)',
                    borderRadius: '8px',
                    padding: '5px 9px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontSize: '0.73rem'
                  }}
                >
                  <div style={{ fontWeight: 900, color: '#fda4af', fontFamily: 'monospace' }}>
                    {s.ticker} ({s.cmf_20d >= 0 ? '+' : ''}{Number(s.cmf_20d).toFixed(3)})
                  </div>
                  <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>{s.name}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#00F0FF', fontFamily: 'monospace' }}>
          <Sparkles size={32} style={{ animation: 'agentsPulse 1.5s infinite' }} />
          <div style={{ marginTop: '16px', fontSize: '14px', fontWeight: 700 }}>
            COORDINATING 8-COUNCIL OMNI-QUANT AI SWARM FOR {ticker}...
          </div>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '6px' }}>
            Auditing Weinstein 12-Stage, Wyckoff VSA, W.D. Gann Sq9, Dealer GEX, SQLite Options OI & 10Y Sector Flow
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
          {/* 2. CHIEF AI COUNCIL HERO BRIEFING & BULL/BEAR DEBATE ARENA         */}
          {/* ------------------------------------------------------------------ */}
          <div className="agents-council-hero">
            <div className="agents-hero-layout">
              {/* Left: Conviction Gauge, Verdict & 8-Council Vote Tally */}
              <div className="agents-conviction-box">
                <div className="agents-conviction-lbl">8-Council Conviction</div>
                <div className="agents-conviction-circle">
                  <span className="agents-conviction-num">{briefing.master_conviction_score || 70}</span>
                  <span className="agents-conviction-pct">/ 100</span>
                </div>
                <div className={`agents-verdict-badge ${briefing.verdict_color || 'cyan'}`}>
                  {briefing.verdict_title || 'TACTICAL WATCH'}
                </div>
                <div style={{ display: 'flex', gap: '6px', marginTop: '10px', fontSize: '0.7rem', fontFamily: 'monospace', fontWeight: 800 }}>
                  <span style={{ color: '#10b981', background: 'rgba(16,185,129,0.14)', padding: '2px 6px', borderRadius: '4px' }}>
                    {voteTally.bullish} BULL
                  </span>
                  <span style={{ color: '#fbbf24', background: 'rgba(251,191,36,0.14)', padding: '2px 6px', borderRadius: '4px' }}>
                    {voteTally.neutral} NEUT
                  </span>
                  <span style={{ color: '#f43f5e', background: 'rgba(244,63,94,0.14)', padding: '2px 6px', borderRadius: '4px' }}>
                    {voteTally.bearish} BEAR
                  </span>
                </div>
              </div>

              {/* Right: Executive Briefing & Bull vs Bear Debate */}
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
                      <span>Posture: {briefing.verdict_posture || 'NEUTRAL'}</span>
                    </div>
                    <div className="agents-pill">
                      <Crosshair size={12} color="#00E676" />
                      <span>R:R: {briefing.risk_reward_ratio || '1 : 2.5'}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('ask_council')}
                      style={{
                        background: 'rgba(0, 240, 255, 0.16)',
                        border: '1px solid #00F0FF',
                        color: '#00F0FF',
                        borderRadius: '999px',
                        padding: '4px 12px',
                        fontSize: '0.73rem',
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px'
                      }}
                    >
                      <Bot size={13} /> Ask AI Council Q&A ↗
                    </button>
                  </div>
                </div>

                <p className="agents-executive-summary">
                  {briefing.executive_summary}
                </p>

                {/* Head-to-Head Bull vs. Bear Debate Arena */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))',
                  gap: '10px',
                  marginTop: '10px'
                }}>
                  <div style={{
                    background: 'rgba(16, 185, 129, 0.07)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    borderRadius: '9px',
                    padding: '10px 12px'
                  }}>
                    <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#10b981', marginBottom: '5px' }}>
                      🐂 BULL COUNCIL THESIS (SUPPORTING EVIDENCE)
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '0.74rem', color: '#cbd5e1', lineHeight: 1.45 }}>
                      {(briefing.bull_points || []).map((pt, i) => (
                        <li key={i} style={{ marginBottom: '3px' }}>{pt}</li>
                      ))}
                    </ul>
                  </div>

                  <div style={{
                    background: 'rgba(244, 63, 94, 0.07)',
                    border: '1px solid rgba(244, 63, 94, 0.3)',
                    borderRadius: '9px',
                    padding: '10px 12px'
                  }}>
                    <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#f43f5e', marginBottom: '5px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <AlertTriangle size={13} color="#f43f5e" /> CHIEF SKEPTIC / BEAR THESIS (RISK VECTORS)
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '0.74rem', color: '#fda4af', lineHeight: 1.45 }}>
                      {(briefing.bear_points || [briefing.chief_skeptic]).filter(Boolean).map((pt, i) => (
                        <li key={i} style={{ marginBottom: '3px' }}>{pt}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ------------------------------------------------------------------ */}
          {/* 3. MULTI-HORIZON TRADE BLUEPRINT + OPTIONS STRATEGY + KEY LEVELS   */}
          {/* ------------------------------------------------------------------ */}
          {blueprint && blueprint.action && (
            <div className="agents-blueprint-card">
              <div className="agents-blueprint-header">
                <div className="agents-bp-title-wrap">
                  <Crosshair size={16} color="#00E676" />
                  <span className="agents-bp-title">Multi-Engine Trade Execution & Options Blueprint</span>
                  <span className="agents-bp-action-pill">{blueprint.action}</span>
                </div>
                <span style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'monospace' }}>
                  Sizing: {blueprint.suggested_sizing}
                </span>
              </div>

              <div className="agents-bp-grid">
                <div className="agents-bp-tile highlight">
                  <span className="agents-bp-tile-lbl">Entry Corridor</span>
                  <span className="agents-bp-tile-val cyan">
                    ${blueprint.entry_zone_min} ── ${blueprint.entry_zone_max}
                  </span>
                  <span className="agents-bp-tile-sub cyan">AVWAP / 10-EMA / Gann S1</span>
                </div>

                <div className="agents-bp-tile">
                  <span className="agents-bp-tile-lbl">Invalidation Stop</span>
                  <span className="agents-bp-tile-val rose">${blueprint.stop_loss}</span>
                  <span className="agents-bp-tile-sub rose">{blueprint.stop_loss_pct}% structural risk</span>
                </div>

                <div className="agents-bp-tile">
                  <span className="agents-bp-tile-lbl">Target 1 (Gann Sq9 R1)</span>
                  <span className="agents-bp-tile-val green">${blueprint.target_1}</span>
                  <span className="agents-bp-tile-sub green">+{blueprint.target_1_pct}% upside</span>
                </div>

                <div className="agents-bp-tile">
                  <span className="agents-bp-tile-lbl">Target 2 (Call Wall / R2)</span>
                  <span className="agents-bp-tile-val green">${blueprint.target_2}</span>
                  <span className="agents-bp-tile-sub green">+{blueprint.target_2_pct}% extension</span>
                </div>

                <div className="agents-bp-tile">
                  <span className="agents-bp-tile-lbl">Risk : Reward</span>
                  <span className="agents-bp-tile-val">{blueprint.risk_reward_ratio}</span>
                  <span className="agents-bp-tile-sub green">Asymmetric Edge</span>
                </div>

                <div className="agents-bp-tile">
                  <span className="agents-bp-tile-lbl">AI Options Play</span>
                  <span className="agents-bp-tile-val" style={{ fontSize: '11.5px', color: '#fbbf24' }}>
                    {blueprint.options_strategy?.structure || 'Vertical Spread'}
                  </span>
                  <span className="agents-bp-tile-sub cyan">{blueprint.options_strategy?.strategy_name || 'GEX Aligned'}</span>
                </div>
              </div>

              {/* Unified Cross-Engine Key Price Levels Strip */}
              {blueprint.key_levels && (
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '8px',
                  background: 'rgba(9, 14, 28, 0.85)',
                  border: '1px solid rgba(148, 163, 184, 0.16)',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  marginTop: '10px',
                  fontSize: '0.73rem',
                  fontFamily: 'monospace'
                }}>
                  <span style={{ color: '#94a3b8', fontWeight: 800 }}>CROSS-ENGINE KEY LEVELS:</span>
                  <span style={{ color: '#f43f5e' }}>Put Wall: <strong>${blueprint.key_levels.put_wall}</strong></span>
                  <span style={{ color: '#fb7185' }}>Gann S1: <strong>${blueprint.key_levels.sq9_s1}</strong></span>
                  <span style={{ color: '#fbbf24' }}>21-EMA: <strong>${blueprint.key_levels.ema21}</strong></span>
                  <span style={{ color: '#38bdf8' }}>AVWAP: <strong>${blueprint.key_levels.avwap}</strong></span>
                  <span style={{ color: '#ffffff', background: 'rgba(56,189,248,0.2)', padding: '2px 6px', borderRadius: '4px' }}>
                    SPOT: <strong>${blueprint.key_levels.spot}</strong>
                  </span>
                  <span style={{ color: '#34d399' }}>Gann R1: <strong>${blueprint.key_levels.sq9_r1}</strong></span>
                  <span style={{ color: '#10b981' }}>Call Wall: <strong>${blueprint.key_levels.call_wall}</strong></span>
                  <span style={{ color: '#a855f7' }}>Gann R2: <strong>${blueprint.key_levels.sq9_r2}</strong></span>
                </div>
              )}

              {(blueprint.time_invalidation || blueprint.volume_invalidation) && (
                <div className="agents-inval-strip" style={{ marginTop: '10px' }}>
                  {blueprint.time_invalidation && (
                    <div className="agents-inval-item">
                      <Clock size={13} color="#00F0FF" />
                      <span><strong>Gann Time Invalidation:</strong> {blueprint.time_invalidation}</span>
                    </div>
                  )}
                  {blueprint.volume_invalidation && (
                    <div className="agents-inval-item">
                      <Activity size={13} color="#f43f5e" />
                      <span><strong>Volume / GEX Stop:</strong> {blueprint.volume_invalidation}</span>
                    </div>
                  )}
                </div>
              )}
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
              8-Agent Specialist Swarm ({agents.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('ask_council')}
              className={`agents-tab-btn ${activeTab === 'ask_council' ? 'active' : ''}`}
            >
              <Bot size={14} />
              Ask the AI Council (Interactive Q&A) 🤖
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('confluence')}
              className={`agents-tab-btn ${activeTab === 'confluence' ? 'active' : ''}`}
            >
              <Layers size={14} />
              8-Axis Octagonal Radar & Matrix 🧠
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('whale_flow')}
              className={`agents-tab-btn ${activeTab === 'whale_flow' ? 'active' : ''}`}
            >
              <Zap size={14} />
              Whale Options & GEX Tape 🐋
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('social_feed')}
              className={`agents-tab-btn ${activeTab === 'social_feed' ? 'active' : ''}`}
            >
              <MessageSquare size={14} />
              Social & News Catalysts 💬
            </button>
          </div>

          {/* ------------------------------------------------------------------ */}
          {/* TAB 1: 8-AGENT SPECIALIST SWARM GRID                               */}
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
                      <div
                        className="agents-meter-bar-fill"
                        style={{
                          width: `${ag.score}%`,
                          background: ag.score >= 70 ? '#10b981' : ag.score >= 50 ? '#00F0FF' : '#f43f5e'
                        }}
                      />
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

                  {ag.telemetry && Object.keys(ag.telemetry).length > 0 && (
                    <div className="agents-card-telemetry-section">
                      <button
                        type="button"
                        onClick={() => toggleTelemetry(ag.id)}
                        className="agents-telemetry-toggle-btn"
                      >
                        <span>Quant Telemetry & Engine Math</span>
                        {expandedTelemetry[ag.id] ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </button>

                      {expandedTelemetry[ag.id] && (
                        <div className="agents-telemetry-drawer">
                          <div className="agents-telemetry-grid">
                            {Object.entries(ag.telemetry).map(([tk, tv]) => (
                              <div key={tk} className="agents-telemetry-chip">
                                <span className="agents-telemetry-lbl">{tk}</span>
                                <span className="agents-telemetry-val">{tv}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ------------------------------------------------------------------ */}
          {/* TAB 2: INTERACTIVE ASK THE 8-AGENT AI COUNCIL TERMINAL             */}
          {/* ------------------------------------------------------------------ */}
          {activeTab === 'ask_council' && (
            <div className="agents-panel" style={{ padding: '18px' }}>
              <div style={{ marginBottom: '14px' }}>
                <h3 style={{ margin: '0 0 6px 0', color: '#f8fafc', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Bot size={18} color="#00F0FF" /> Interactive 8-Council AI Market Agent Q&A ({ticker})
                </h3>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8' }}>
                  Click any institutional prompt below or ask your own question to query the live Stage/CANSLIM, Wyckoff, W.D. Gann, Options GEX, and 10-Year Sector Flow engines.
                </p>
              </div>

              {/* Instant Prompt Pills */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
                {(briefing.qa_knowledge || []).map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleAskQuestion(item.q)}
                    style={{
                      background: 'rgba(56, 189, 248, 0.12)',
                      border: '1px solid rgba(56, 189, 248, 0.38)',
                      color: '#38bdf8',
                      borderRadius: '8px',
                      padding: '7px 12px',
                      fontSize: '0.76rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                  >
                    💬 {item.q}
                  </button>
                ))}
              </div>

              {/* Chat Conversation Stream */}
              <div style={{
                background: 'rgba(9, 14, 28, 0.9)',
                border: '1px solid rgba(148, 163, 184, 0.2)',
                borderRadius: '10px',
                padding: '14px',
                maxHeight: '360px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                marginBottom: '12px'
              }}>
                {chatHistory.map((msg, idx) => (
                  <div
                    key={idx}
                    style={{
                      alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                      maxWidth: '88%',
                      background: msg.role === 'user' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(30, 41, 59, 0.78)',
                      border: `1px solid ${msg.role === 'user' ? '#38bdf8' : 'rgba(148, 163, 184, 0.25)'}`,
                      borderRadius: '10px',
                      padding: '10px 14px',
                      fontSize: '0.8rem',
                      color: '#f8fafc',
                      lineHeight: 1.5,
                      whiteSpace: 'pre-line'
                    }}
                  >
                    {msg.title && (
                      <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#00F0FF', marginBottom: '4px' }}>
                        🧠 {msg.title}
                      </div>
                    )}
                    {msg.text}
                  </div>
                ))}
              </div>

              {/* Custom Input Form */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleAskQuestion(customQuestion);
                }}
                style={{ display: 'flex', gap: '8px' }}
              >
                <input
                  type="text"
                  value={customQuestion}
                  onChange={(e) => setCustomQuestion(e.target.value)}
                  placeholder={`Ask the 8-Agent Council anything about ${ticker} (e.g., "What are the Gann & Options targets?", "Where is my stop loss?")...`}
                  style={{
                    flex: 1,
                    background: 'rgba(15, 23, 42, 0.9)',
                    border: '1px solid rgba(56, 189, 248, 0.35)',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    color: '#f8fafc',
                    fontSize: '0.82rem'
                  }}
                />
                <button
                  type="submit"
                  style={{
                    background: 'linear-gradient(135deg, #0284c7, #00F0FF)',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '0 18px',
                    color: '#060910',
                    fontWeight: 900,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Send size={14} /> Ask Council
                </button>
              </form>
            </div>
          )}

          {/* ------------------------------------------------------------------ */}
          {/* TAB 3: 8-AXIS OCTAGONAL CONFLUENCE MATRIX                          */}
          {/* ------------------------------------------------------------------ */}
          {activeTab === 'confluence' && (
            <div className="agents-panel">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Layers size={18} color="#00F0FF" />
                  <h3 style={{ margin: 0, fontSize: '15px', color: '#fff' }}>
                    8-Council Multi-Engine Consensus & Confluence Voting Matrix
                  </h3>
                </div>
                <div className="agents-pill">
                  <span>Swarm Convergence: {briefing.master_conviction_score || 70}% Conviction</span>
                </div>
              </div>

              {renderConfluenceRadar()}

              <div className="agents-table-wrap">
                <table className="agents-data-table agents-matrix-table">
                  <thead>
                    <tr>
                      <th>Specialist Quant Council</th>
                      <th>Model Weight</th>
                      <th>Individual Stance</th>
                      <th>Confidence Score</th>
                      <th>Cross-Engine Alignment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {confluence.map((c, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 700, color: '#fff' }}>{c.agent}</td>
                        <td style={{ color: '#94a3b8' }}>{c.weight}</td>
                        <td>
                          <span className={`agents-card-stance ${c.signal}`}>
                            {c.signal?.replace('_', ' ')}
                          </span>
                        </td>
                        <td style={{ fontWeight: 800, color: '#00F0FF' }}>{c.confidence}</td>
                        <td>
                          <span style={{ color: c.alignment === 'HIGH_CONFLUENCE' ? '#00E676' : c.alignment === 'ALIGNED' ? '#38bdf8' : '#f59e0b', fontWeight: 700 }}>
                            {c.alignment?.replace('_', ' ')}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ------------------------------------------------------------------ */}
          {/* TAB 4: WHALE OPTIONS RADAR                                         */}
          {/* ------------------------------------------------------------------ */}
          {activeTab === 'whale_flow' && (
            <div className="agents-panel">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Zap size={18} color="#00F0FF" />
                  <h3 style={{ margin: 0, fontSize: '15px', color: '#fff' }}>
                    Institutional Unusual Options Sweeps, GEX Walls & Multi-Day OI Tape
                  </h3>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <span className="agents-pill">
                    Call Wall: {agents.find((a) => a.id === 'options_whale')?.metrics?.['Call Wall'] || 'N/A'}
                  </span>
                  <span className="agents-pill">
                    Put Wall: {agents.find((a) => a.id === 'options_whale')?.metrics?.['Put Wall'] || 'N/A'}
                  </span>
                  <span className="agents-pill">
                    5D Call OI Δ: {agents.find((a) => a.id === 'options_whale')?.metrics?.['5D Call OI Δ'] || 'N/A'}
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
                              {opt.type === 'CALL' ? 'Aggressive Bull Sweep' : 'Institutional Put Hedge'}
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
          {/* TAB 5: SOCIAL SENTIMENT & NEWS CATALYSTS STREAM                    */}
          {/* ------------------------------------------------------------------ */}
          {activeTab === 'social_feed' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                <div className="agents-bp-tile highlight">
                  <span className="agents-bp-tile-lbl">Social Bull / Bear Ratio</span>
                  <span className="agents-bp-tile-val cyan">{surge.bullish_percent || 65}% Bullish</span>
                  <span className="agents-bp-tile-sub green">Multi-Feed Polarity</span>
                </div>
                <div className="agents-bp-tile">
                  <span className="agents-bp-tile-lbl">Social Surge Level</span>
                  <span className="agents-bp-tile-val">{surge.surge_level || 50}/100</span>
                  <span className="agents-bp-tile-sub cyan">Attention Velocity</span>
                </div>
                <div className="agents-bp-tile">
                  <span className="agents-bp-tile-lbl">Retail FOMO Risk</span>
                  <span className="agents-bp-tile-val green">
                    {agents.find((a) => a.id === 'sentiment')?.metrics?.['FOMO Risk'] || 'Low'}
                  </span>
                  <span className="agents-bp-tile-sub green">Contrarian Crowding Check</span>
                </div>
              </div>

              <div className="agents-feeds-grid">
                <div className="agents-feed-col">
                  <div className="agents-feed-col-header">
                    <h4>Reddit /r/wallstreetbets</h4>
                    <span className="agents-title-tag">Reddit</span>
                  </div>
                  <ul className="agents-feed-list">
                    {reddit.map((item, i) => (
                      <li key={i} className="agents-feed-item">{item}</li>
                    ))}
                  </ul>
                </div>

                <div className="agents-feed-col">
                  <div className="agents-feed-col-header">
                    <h4>StockTwits Stream</h4>
                    <span className="agents-title-tag">StockTwits</span>
                  </div>
                  <ul className="agents-feed-list">
                    {stocktwits.map((item, i) => (
                      <li key={i} className="agents-feed-item">{item}</li>
                    ))}
                  </ul>
                </div>

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
        </>
      )}
    </div>
  );
}
