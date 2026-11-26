import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Bot,
  Send,
  RefreshCw,
  Search,
  Zap,
  Copy,
  Check,
  TrendingUp,
  Activity,
  Layers,
  ChevronRight,
  Pin,
  Trash2,
  PanelRightClose,
  PanelRightOpen,
  Shield,
  Target,
  Sparkles,
  Terminal,
  Scale,
} from 'lucide-react';
import './AskAiLive.css';

const DEFAULT_PERSONAS = [
  { id: 'master', label: '🧠 Master Council', color: '#8b5cf6', desc: 'Multi-engine walk-forward synthesis' },
  { id: 'quant', label: '🎯 Quant Breakout', color: '#00F0FF', desc: 'Stage 2 bases, squeezes & stops' },
  { id: 'options', label: '⚡ Options & GEX', color: '#ec4899', desc: 'Dealer gamma walls & SQLite flow' },
  { id: 'macro', label: '🌐 Macro Regime', color: '#10b981', desc: 'Market Health & risk budget' },
  { id: 'fundamental', label: '📊 Fundamentals', color: '#f59e0b', desc: 'Verified DCF & multiples' },
];

const SLASH_COMMANDS = [
  { cmd: '/top', label: 'Top High-Conviction Multi-Engine Setups', template: () => `Top High-Conviction AI Playbook Setups`, persona: 'master' },
  { cmd: '/squeeze', label: 'Coiled & Firing TTM Squeeze Setups', template: () => `Find the best Short Squeeze candidates`, persona: 'quant' },
  { cmd: '/gex', label: 'Gamma Walls & SQLite Options Flow', template: (t) => `Analyze key gamma levels, Call/Put walls, Zero Gamma, and VEX for $${t}`, persona: 'options' },
  { cmd: '/setup', label: 'Quantitative Stage & Bracket Audit', template: (t) => `Analyze $${t} levels, accumulation corridor, and trade setup`, persona: 'quant' },
  { cmd: '/dcf', label: 'Verified DCF & Financial Ratios', template: (t) => `Check DCF fair value and financials for $${t}`, persona: 'fundamental' },
  { cmd: '/macro', label: 'Market Health Regime & Risk Sizing', template: () => `What is the current Market Health regime?`, persona: 'macro' },
];

const WATCHLIST_PILLS = ['SPY', 'QQQ', 'NVDA', 'AMD', 'TSLA', 'AAPL', 'META', 'MSFT'];

const formatCompact = (num) => {
  if (num === null || num === undefined || isNaN(Number(num))) return '--';
  const n = Number(num);
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '+';
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(0)}`;
};

const gradeBadgeColor = (grade) => {
  if (grade === 'A+') return '#34d399';
  if (grade === 'A') return '#38bdf8';
  if (grade === 'B+') return '#c084fc';
  if (grade === 'B') return '#fbbf24';
  return '#f87171';
};

/* ── Clean Inline Markdown Parser (**bold**, *italic*, `code`) ── */
const renderInlineTokens = (line) => {
  const parts = line.split(/(\*\*.*?\*\*|`[^`]+`|\*[^*]+\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return <code key={i} className="ai-code-chip">{part.slice(1, -1)}</code>;
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return <em key={i} style={{ color: '#cbd5e1' }}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
};

export default function AskAiLiveDashboard({
  activeTicker = 'SPY',
  onTickerSelect = null,
  initialPersona = 'master',
}) {
  const [focusedTicker, setFocusedTicker] = useState((activeTicker || 'SPY').toUpperCase());
  const [tickerInput, setTickerInput] = useState((activeTicker || 'SPY').toUpperCase());
  const [persona, setPersona] = useState(initialPersona || 'master');
  const [messages, setMessages] = useState([]);
  const [inputVal, setInputVal] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState(null);
  const [showRail, setShowRail] = useState(true);
  const [showWfDrawer, setShowWfDrawer] = useState(false);
  const [pinnedCards, setPinnedCards] = useState([]);

  // Synchronized Live Context Rail State
  const [liveGex, setLiveGex] = useState(null);
  const [gexLoading, setGexLoading] = useState(false);
  const [marketHealth, setMarketHealth] = useState(null);
  const [topSetups, setTopSetups] = useState([]);
  const [wfCalibration, setWfCalibration] = useState(null);

  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (activeTicker && activeTicker !== 'UNKNOWN') {
      const up = activeTicker.toUpperCase();
      setFocusedTicker(up);
      setTickerInput(up);
    }
  }, [activeTicker]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Load synchronized Market Health + Calibrated Multi-Engine Context from backend API
  useEffect(() => {
    let mounted = true;
    const loadContext = async () => {
      try {
        const res = await fetch('/api/ask_ai/context');
        if (res.ok) {
          const ctx = await res.json();
          if (!mounted) return;
          if (ctx.market_health) setMarketHealth(ctx.market_health);
          if (Array.isArray(ctx.top_conviction)) setTopSetups(ctx.top_conviction);
          if (ctx.backtest_calibration) setWfCalibration(ctx.backtest_calibration);
          return;
        }
      } catch (e) { /* fallback below */ }

      try {
        const mhRes = await fetch('/market_health.json?t=' + Date.now());
        if (mhRes.ok) {
          const mhJson = await mhRes.json();
          if (mounted) setMarketHealth(mhJson.current_health || mhJson);
        }
      } catch (e) { /* ignore */ }
    };
    loadContext();
    return () => { mounted = false; };
  }, []);

  // Fetch Live GEX Telemetry whenever focusedTicker changes
  useEffect(() => {
    if (!focusedTicker) return;
    let cancelled = false;
    setGexLoading(true);
    fetch(`/api/gex?ticker=${encodeURIComponent(focusedTicker)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d && !d.error) setLiveGex(d);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setGexLoading(false);
      });
    return () => { cancelled = true; };
  }, [focusedTicker]);

  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          persona: persona || 'master',
          text:
            `👋 **Ask AI Live 3.0 — Institutional Multi-Engine Copilot**\n\n` +
            `Connected live to your DuckDB lakehouse, **SQLite Options Chain GEX**, **Apex Squeeze 4.0**, **Market Health Regime**, and **5Y Walk-Forward Conviction Calibrator**.\n\n` +
            `Ask for ranked top setups, head-to-head stock comparisons (\`$NVDA vs $AMD\`), single-ticker audits, or type \`/\` for quick commands.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          structured_card: null,
          suggested_prompts: [
            `🚀 Top High-Conviction AI Playbook Setups`,
            `🔥 Find the best Short Squeeze candidates`,
            `Compare $NVDA vs $AMD`,
            `🛡️ What is the current Market Health regime?`,
          ],
        },
      ]);
    }
  }, []);

  const quickPrompts = useMemo(() => {
    if (persona === 'options') {
      return [
        `⚡ Major Call & Put Walls for $${focusedTicker}`,
        `🧲 Zero Gamma & SQLite Flow for $${focusedTicker}`,
        `🚀 Top High-Conviction AI Playbook Setups`,
        `Compare $NVDA vs $AMD`,
      ];
    }
    if (persona === 'fundamental') {
      return [
        `📊 DCF Fair Value & financials for $${focusedTicker}`,
        `Compare $MSFT vs $AAPL`,
        `Analyze $AI levels and trade setup`,
        `🚀 Top High-Conviction AI Playbook Setups`,
      ];
    }
    if (persona === 'macro') {
      return [
        `🛡️ What is the current Market Health regime?`,
        `🚀 Top High-Conviction AI Playbook Setups`,
        `🔴 Show Bearish Short Setups`,
        `⚡ Major Call & Put Walls for $SPY`,
      ];
    }
    return [
      `🚀 Top High-Conviction AI Playbook Setups`,
      `What are the highest conviction stocks right now?`,
      `🔥 Find the best Short Squeeze candidates`,
      `Analyze $${focusedTicker} levels and trade setup`,
    ];
  }, [persona, focusedTicker]);

  // Only update focusedTicker UI pill on explicit $TICKER mention
  const extractExplicitDollarTicker = (txt) => {
    const m = (txt || '').match(/\$([A-Za-z]{1,5})\b/);
    return m ? m[1].toUpperCase() : null;
  };

  const handleSend = async (queryText = null, personaOverride = null, tickerOverride = null) => {
    const textToSend = typeof queryText === 'string' ? queryText : inputVal;
    if (!textToSend || !textToSend.trim() || isLoading) return;

    const currentPersona = personaOverride || persona;
    const explicitSym = extractExplicitDollarTicker(textToSend);
    const targetTicker = (tickerOverride || explicitSym || focusedTicker || 'SPY').toUpperCase();
    if (explicitSym && explicitSym !== focusedTicker) {
      setFocusedTicker(explicitSym);
      setTickerInput(explicitSym);
    }

    const userMsg = {
      id: Date.now().toString(),
      role: 'user',
      text: textToSend.trim(),
      ticker: targetTicker,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputVal('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: textToSend.trim(),
          ticker: targetTicker,
          persona: currentPersona,
          context: { activeTicker: targetTicker },
        }),
      });
      const data = await res.json();

      const aiMsg = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        persona: currentPersona,
        ticker: targetTicker,
        text: data.response || 'No response received.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        structured_card: data.structured_card || null,
        suggested_prompts: data.suggested_prompts || [],
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          persona: currentPersona,
          text: `⚠️ **Connection Error**: Unable to reach Ask AI Live API endpoint.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTickerSubmit = (e) => {
    e.preventDefault();
    const clean = tickerInput.trim().toUpperCase().replace(/[^A-Z0-9.-]/g, '');
    if (!clean) return;
    setFocusedTicker(clean);
    setTickerInput(clean);
  };

  const handlePinCard = (card, msgId) => {
    if (!card) return;
    setPinnedCards((prev) => {
      if (prev.some((p) => p.msgId === msgId)) return prev;
      return [{ msgId, card, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }, ...prev].slice(0, 6);
    });
  };

  const copyToClipboard = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 1800);
  };

  const activePersonaObj = DEFAULT_PERSONAS.find((p) => p.id === persona) || DEFAULT_PERSONAS[0];
  const slashMatches = inputVal.startsWith('/')
    ? SLASH_COMMANDS.filter((s) => s.cmd.startsWith(inputVal.toLowerCase().split(' ')[0]))
    : [];

  /* ── Line-by-Line Clean Markdown Renderer (no heading swallow bug!) ── */
  const renderFormattedText = (text) => {
    if (!text) return null;
    const paragraphs = text.split('\n\n');
    return paragraphs.map((para, pIdx) => {
      const lines = para.split('\n').filter((l) => l.trim() !== '');
      return (
        <div key={pIdx} className="ai-chat-paragraph">
          {lines.map((rawLine, lIdx) => {
            const trimmed = rawLine.trim();
            if (trimmed.startsWith('### ')) {
              return <h4 key={lIdx} className="ai-chat-h4">{renderInlineTokens(trimmed.slice(4))}</h4>;
            }
            if (trimmed.startsWith('## ')) {
              return <h3 key={lIdx} className="ai-chat-h3">{renderInlineTokens(trimmed.slice(3))}</h3>;
            }
            if (trimmed.startsWith('# ')) {
              return <h2 key={lIdx} className="ai-chat-h2">{renderInlineTokens(trimmed.slice(2))}</h2>;
            }
            const isBullet = trimmed.startsWith('• ') || trimmed.startsWith('- ') || trimmed.startsWith('* ');
            const content = isBullet ? trimmed.slice(2) : trimmed;
            return (
              <div key={lIdx} className={isBullet ? 'ai-chat-bullet' : 'ai-chat-line'}>
                {isBullet && <span className="bullet-point">▸</span>}
                <span>{renderInlineTokens(content)}</span>
              </div>
            );
          })}
        </div>
      );
    });
  };

  const mhScore = marketHealth?.score_value ?? marketHealth?.score ?? null;
  const mhLabel = marketHealth?.health_regime_label || marketHealth?.label || 'Active Regime';
  const mhColor = marketHealth?.health_regime_color || marketHealth?.color || '#10b981';

  return (
    <div className="ask-ai-container">
      {/* 1. TOP COMMAND BAR */}
      <div className="ask-ai-top-bar">
        <div className="top-bar-left">
          <div className="ai-logo-pill">
            <Bot size={19} color="#00F0FF" />
            <span>ASK AI LIVE</span>
            <span className="copilot-badge">COPILOT 3.0</span>
          </div>

          <form
            onSubmit={handleTickerSubmit}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              background: 'rgba(2,6,23,0.72)',
              padding: '3px 8px',
              borderRadius: '7px',
              border: '1px solid rgba(0,240,255,0.28)',
            }}
          >
            <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>FOCUS</span>
            <input
              type="text"
              value={tickerInput}
              onChange={(e) => setTickerInput(e.target.value.toUpperCase())}
              style={{ width: '56px', background: 'transparent', border: 'none', color: '#00E676', fontWeight: 800, fontSize: '0.8rem', outline: 'none', fontFamily: 'monospace' }}
            />
            <button type="button" className="chip-action-btn" onClick={() => handleSend(`Analyze $${focusedTicker} levels, GEX walls, and trade setup`)}>
              Brief
            </button>
          </form>

          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {WATCHLIST_PILLS.slice(0, 6).map((sym) => (
              <button
                key={sym}
                type="button"
                onClick={() => {
                  setFocusedTicker(sym);
                  setTickerInput(sym);
                }}
                style={{
                  padding: '2px 7px',
                  borderRadius: '5px',
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  fontFamily: 'monospace',
                  cursor: 'pointer',
                  border: `1px solid ${focusedTicker === sym ? '#00F0FF' : 'rgba(255,255,255,0.08)'}`,
                  background: focusedTicker === sym ? 'rgba(0,240,255,0.16)' : 'rgba(255,255,255,0.03)',
                  color: focusedTicker === sym ? '#00F0FF' : '#94a3b8',
                }}
              >
                {sym}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
          <div className="persona-tabs">
            {DEFAULT_PERSONAS.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`persona-tab-btn ${persona === p.id ? 'active' : ''}`}
                style={{ borderColor: persona === p.id ? p.color : 'transparent', color: persona === p.id ? '#fff' : '#94a3b8' }}
                onClick={() => setPersona(p.id)}
                title={p.desc}
              >
                <span className="persona-dot" style={{ backgroundColor: p.color }}></span>
                <span>{p.label}</span>
              </button>
            ))}
          </div>

          <button
            type="button"
            className="persona-tab-btn"
            style={{ borderColor: showWfDrawer ? '#a855f7' : 'rgba(168,85,247,0.35)', color: '#d8b4fe' }}
            onClick={() => setShowWfDrawer((v) => !v)}
          >
            <Shield size={13} /> 5Y Proof {showWfDrawer ? '▲' : '▼'}
          </button>

          <button type="button" onClick={() => setMessages((prev) => prev.slice(0, 1))} title="Clear Chat" style={iconCtrlBtn}>
            <Trash2 size={14} />
          </button>
          <button type="button" onClick={() => setShowRail(!showRail)} title="Toggle Intelligence Rail" style={iconCtrlBtn}>
            {showRail ? <PanelRightClose size={15} /> : <PanelRightOpen size={15} />}
          </button>
        </div>
      </div>

      {/* 1B. COLLAPSIBLE 5Y WALK-FORWARD CALIBRATION PROOF */}
      {showWfDrawer && wfCalibration && (
        <div className="ai-wf-drawer">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <strong style={{ color: '#f8fafc' }}>
              5-Year Zero-Lookahead Walk-Forward Calibration ({wfCalibration.train_period} → {wfCalibration.oos_period}, {wfCalibration.slippage_bps_roundtrip} bps slippage)
            </strong>
            <span style={{ color: '#34d399', fontWeight: 700 }}>{wfCalibration.oos_trades} Out-Of-Sample Trades</span>
          </div>
          <table className="ai-wf-table">
            <thead>
              <tr>
                <th>Grade Tier</th>
                <th>Train Trades</th>
                <th>Train PF</th>
                <th>OOS Trades</th>
                <th>OOS Win%</th>
                <th>OOS +10D</th>
                <th>OOS Exp(R)</th>
                <th>OOS PF</th>
              </tr>
            </thead>
            <tbody>
              {['A+', 'A', 'B+', 'BASELINE'].map((tier) => {
                const tr = wfCalibration.tiers?.[tier]?.train || {};
                const oo = wfCalibration.tiers?.[tier]?.oos || {};
                return (
                  <tr key={tier} style={{ background: tier === 'A+' ? 'rgba(16,185,129,0.08)' : undefined }}>
                    <td style={{ fontWeight: 800, color: tier === 'A+' ? '#34d399' : '#e2e8f0' }}>{tier}</td>
                    <td>{tr.n ?? '-'}</td>
                    <td>{tr.pf ?? '-'}</td>
                    <td>{oo.n ?? '-'}</td>
                    <td>{oo.win_pct ?? '-'}%</td>
                    <td style={{ color: (oo.avg_ret_10d ?? 0) >= 0 ? '#34d399' : '#f87171' }}>{(oo.avg_ret_10d ?? 0) >= 0 ? '+' : ''}{oo.avg_ret_10d ?? '-'}%</td>
                    <td style={{ fontWeight: 800, color: (oo.exp_r ?? 0) >= 0 ? '#34d399' : '#f87171' }}>{(oo.exp_r ?? 0) >= 0 ? '+' : ''}{oo.exp_r ?? '-'}R</td>
                    <td style={{ fontWeight: 800, color: (oo.pf ?? 0) >= 1.25 ? '#34d399' : '#cbd5e1' }}>{oo.pf ?? '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 2. MAIN WORKSPACE */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {/* Left: Chat Viewport & Composer */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
          <div className="ask-ai-messages-scroll">
            <div className="messages-inner-wrapper">
              {messages.map((msg, idx) => {
                const isUser = msg.role === 'user';
                const card = msg.structured_card;
                const msgPersona = DEFAULT_PERSONAS.find((p) => p.id === msg.persona) || activePersonaObj;

                return (
                  <div key={msg.id || idx} className={`chat-message-row ${isUser ? 'user-row' : 'assistant-row'}`}>
                    <div className={`message-avatar ${isUser ? 'user-avatar' : 'ai-avatar'}`}>
                      {isUser ? <span>ME</span> : <Bot size={18} color="#00F0FF" />}
                    </div>

                    <div className={`message-bubble ${isUser ? 'user-bubble' : 'ai-bubble'}`}>
                      <div className="bubble-header">
                        <span className="sender-name" style={{ color: isUser ? '#00F0FF' : msgPersona.color }}>
                          {isUser ? 'YOU' : msgPersona.label}
                        </span>
                        <span className="message-time">{msg.timestamp}</span>
                        {!isUser && (
                          <div style={{ display: 'flex', gap: '4px' }}>
                            {card && (
                              <button type="button" className="btn-copy-bubble" onClick={() => handlePinCard(card, msg.id || idx)} title="Pin card">
                                <Pin size={12} color="#fbbf24" />
                              </button>
                            )}
                            <button type="button" className="btn-copy-bubble" onClick={() => copyToClipboard(msg.text, idx)} title="Copy">
                              {copiedIdx === idx ? <Check size={12} color="#00E676" /> : <Copy size={12} />}
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="bubble-body">{renderFormattedText(msg.text)}</div>

                      {/* CARD TYPE A: RANKED MULTI-STOCK HIGH-CONVICTION LEADERBOARD */}
                      {card && card.type === 'top_picks_card' && (
                        <div className="ai-execution-card">
                          <div className="card-top-strip">
                            <div className="card-title-group">
                              <Sparkles size={15} color="#34d399" />
                              <span className="card-ticker">{card.title}</span>
                              <span className="card-playbook-pill">{card.trade_date} · {card.total_qualified} Qualified ($2B+)</span>
                            </div>
                            <div className="card-conviction-pill">
                              Health {card.market_health_score}/100 ({card.market_health_label})
                            </div>
                          </div>

                          <div className="ai-top-picks-list">
                            {(card.items || []).map((it, rIdx) => {
                              const gColor = gradeBadgeColor(it.grade);
                              return (
                                <div key={it.ticker} className="ai-top-pick-row">
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                    <span style={{ color: '#64748b', fontWeight: 800 }}>#{rIdx + 1}</span>
                                    <span style={{ fontWeight: 900, color: '#fff', fontSize: '0.95rem' }}>${it.ticker}</span>
                                    <span style={{ fontSize: '0.7rem', fontWeight: 800, padding: '1px 6px', borderRadius: 4, background: it.direction === 'BEARISH' ? 'rgba(244,63,94,0.16)' : 'rgba(16,185,129,0.16)', color: it.direction === 'BEARISH' ? '#fb7185' : '#34d399' }}>
                                      {it.direction}
                                    </span>
                                    <span style={{ fontSize: '0.72rem', fontWeight: 800, color: gColor, border: `1px solid ${gColor}`, padding: '1px 6px', borderRadius: 4 }}>
                                      {it.grade} · {it.conviction_score}
                                    </span>
                                    <span style={{ fontSize: '0.78rem', color: '#cbd5e1', fontWeight: 700 }}>
                                      ${it.price?.toFixed(2)} ({it.change_pct >= 0 ? '+' : ''}{it.change_pct}%)
                                    </span>
                                  </div>

                                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: '0.74rem', color: '#94a3b8' }}>
                                    <span>{(it.engines || []).slice(0, 2).join(' · ')}</span>
                                    <span>Pivot <b style={{ color: '#38bdf8' }}>${it.entry_pivot}</b></span>
                                    <span>Stop <b style={{ color: '#f87171' }}>${it.stop_loss}</b></span>
                                    <span>R:R <b style={{ color: '#34d399' }}>{it.risk_reward}</b></span>
                                    {it.options_available && (
                                      <span>GEX <b style={{ color: (it.net_gex ?? 0) < 0 ? '#fbbf24' : '#cbd5e1' }}>{it.net_gex}M</b></span>
                                    )}
                                  </div>

                                  <div style={{ display: 'flex', gap: 5 }}>
                                    <button type="button" className="card-action-btn primary" onClick={() => handleSend(`Analyze $${it.ticker} levels and trade setup`, 'quant', it.ticker)}>
                                      Brief
                                    </button>
                                    {onTickerSelect && (
                                      <button type="button" className="card-action-btn" onClick={() => onTickerSelect(it.ticker)}>
                                        Chart
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* CARD TYPE B: HEAD-TO-HEAD COMPARISON MATRIX */}
                      {card && card.type === 'comparison_card' && card.left && card.right && (
                        <div className="ai-execution-card">
                          <div className="card-top-strip">
                            <div className="card-title-group">
                              <Scale size={15} color="#38bdf8" />
                              <span className="card-ticker">${card.left.ticker} vs ${card.right.ticker}</span>
                            </div>
                            <div className="card-conviction-pill">Edge Leader: ${card.winner}</div>
                          </div>

                          <table className="ai-compare-table">
                            <thead>
                              <tr>
                                <th>Metric</th>
                                <th>${card.left.ticker}</th>
                                <th>${card.right.ticker}</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr><td>Spot / Day%</td><td>${card.left.spot} ({card.left.chg_pct}%)</td><td>${card.right.spot} ({card.right.chg_pct}%)</td></tr>
                              <tr><td>Grade / Score</td><td style={{ color: gradeBadgeColor(card.left.grade), fontWeight: 800 }}>{card.left.grade} · {card.left.conviction_score}</td><td style={{ color: gradeBadgeColor(card.right.grade), fontWeight: 800 }}>{card.right.grade} · {card.right.conviction_score}</td></tr>
                              <tr><td>Stage</td><td>{card.left.stage}</td><td>{card.right.stage}</td></tr>
                              <tr><td>RSI(14) / 30D Alpha</td><td>{card.left.rsi14} / {card.left.alpha_30d}%</td><td>{card.right.rsi14} / {card.right.alpha_30d}%</td></tr>
                              <tr><td>SQLite Net GEX / Call%</td><td>{card.left.net_gex !== null ? `${card.left.net_gex}M (${card.left.call_vol_pct}%)` : 'N/A'}</td><td>{card.right.net_gex !== null ? `${card.right.net_gex}M (${card.right.call_vol_pct}%)` : 'N/A'}</td></tr>
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* CARD TYPE C: SINGLE STOCK TRADE SETUP CARD */}
                      {card && card.type === 'trade_setup' && (
                        <div className="ai-execution-card">
                          <div className="card-top-strip">
                            <div className="card-title-group">
                              <span className="card-ticker">${card.ticker}</span>
                              <span className="card-price">${Number(card.price).toFixed(2)}</span>
                              <span className="card-playbook-pill">{card.playbook}</span>
                            </div>
                            <div className="card-conviction-pill" style={{ color: gradeBadgeColor(card.grade), borderColor: gradeBadgeColor(card.grade) }}>
                              {card.conviction}
                            </div>
                          </div>

                          {card.stop_loss > 0 && card.target_primary > card.stop_loss && (
                            <PriceLadderBar stop={card.stop_loss} spot={card.price} t1={card.target_primary} t2={card.target_secondary || card.target_primary} />
                          )}

                          <div className="card-tiles-grid">
                            <div className="card-tile">
                              <span className="tile-lbl">Corridor</span>
                              <span className="tile-val green">
                                ${card.entry_range ? `${card.entry_range[0]} – $${card.entry_range[1]}` : card.price}
                              </span>
                            </div>
                            <div className="card-tile">
                              <span className="tile-lbl">Stop Loss</span>
                              <span className="tile-val rose">${card.stop_loss} ({card.stop_loss_pct}%)</span>
                            </div>
                            <div className="card-tile">
                              <span className="tile-lbl">Target 1 (2R)</span>
                              <span className="tile-val emerald">${card.target_primary} (+{card.target_primary_pct}%)</span>
                            </div>
                            <div className="card-tile">
                              <span className="tile-lbl">Target 2 (3.5R)</span>
                              <span className="tile-val purple">${card.target_secondary} (+{card.target_secondary_pct}%)</span>
                            </div>
                            <div className="card-tile">
                              <span className="tile-lbl">Asymmetry</span>
                              <span className="tile-val amber">{card.risk_reward}</span>
                            </div>
                            <div className="card-tile">
                              <span className="tile-lbl">Options Spec</span>
                              <span className="tile-val cyan">{card.options_spec}</span>
                            </div>
                          </div>

                          <div className="card-actions-strip">
                            {onTickerSelect && (
                              <button type="button" className="card-action-btn primary" onClick={() => onTickerSelect(card.ticker)}>
                                <Search size={13} /> Deep Chart ${card.ticker}
                              </button>
                            )}
                            <button type="button" className="card-action-btn" onClick={() => { setPersona('options'); handleSend(`Show gamma walls & SQLite options flow for $${card.ticker}`, 'options', card.ticker); }}>
                              <Zap size={13} /> Gamma Walls
                            </button>
                            <button type="button" className="card-action-btn" onClick={() => { setPersona('fundamental'); handleSend(`Check DCF fair value and financials for $${card.ticker}`, 'fundamental', card.ticker); }}>
                              <TrendingUp size={13} /> Fundamentals
                            </button>
                          </div>
                        </div>
                      )}

                      {/* CARD TYPE D: GEX CARD */}
                      {card && card.type === 'gex_card' && (
                        <div className="ai-execution-card">
                          <div className="card-top-strip">
                            <div className="card-title-group">
                              <span className="card-ticker">${card.ticker}</span>
                              <span className="card-price">${Number(card.price).toFixed(2)}</span>
                              <span className="card-playbook-pill">{card.regime}</span>
                            </div>
                            <div className="card-conviction-pill">⚡ {card.squeeze_risk}</div>
                          </div>

                          {typeof card.put_wall === 'number' && typeof card.call_wall === 'number' && card.call_wall > card.put_wall && (
                            <GexCorridorBar putWall={card.put_wall} zeroGamma={card.zero_gamma} spot={card.price} callWall={card.call_wall} />
                          )}

                          <div className="card-tiles-grid">
                            <div className="card-tile"><span className="tile-lbl">Call Wall</span><span className="tile-val emerald">${card.call_wall}</span></div>
                            <div className="card-tile"><span className="tile-lbl">Put Wall</span><span className="tile-val rose">${card.put_wall}</span></div>
                            <div className="card-tile"><span className="tile-lbl">Zero Gamma</span><span className="tile-val amber">{card.zero_gamma ? `$${card.zero_gamma}` : 'N/A'}</span></div>
                            <div className="card-tile"><span className="tile-lbl">Max Pain</span><span className="tile-val purple">{card.max_pain ? `$${card.max_pain}` : 'N/A'}</span></div>
                            <div className="card-tile"><span className="tile-lbl">Net GEX</span><span className="tile-val cyan">{card.net_gex}</span></div>
                            <div className="card-tile"><span className="tile-lbl">1D Expected Move</span><span className="tile-val amber">{card.expected_move_1d ? `±$${card.expected_move_1d}` : 'N/A'}</span></div>
                          </div>
                        </div>
                      )}

                      {/* CARD TYPE E: FUNDAMENTAL CARD */}
                      {card && card.type === 'fundamental_card' && (
                        <div className="ai-execution-card">
                          <div className="card-top-strip">
                            <div className="card-title-group">
                              <span className="card-ticker">${card.ticker}</span>
                              <span className="card-price">${Number(card.price).toFixed(2)}</span>
                              <span className="card-playbook-pill">{card.valuation_status}</span>
                            </div>
                          </div>
                          <div className="card-tiles-grid">
                            <div className="card-tile"><span className="tile-lbl">DCF Fair Value</span><span className="tile-val emerald">{card.fair_value ? `$${card.fair_value} (${card.margin_of_safety >= 0 ? `+${card.margin_of_safety}%` : `${card.margin_of_safety}%`})` : 'Unavailable'}</span></div>
                            <div className="card-tile"><span className="tile-lbl">P/E · Fwd P/E</span><span className="tile-val cyan">{card.pe_ratio ? `${card.pe_ratio}x` : 'N/A'} · {card.fwd_pe ? `${card.fwd_pe}x` : 'N/A'}</span></div>
                            <div className="card-tile"><span className="tile-lbl">Op Margin</span><span className="tile-val green">{card.operating_margin !== null ? `${card.operating_margin}%` : 'N/A'}</span></div>
                            <div className="card-tile"><span className="tile-lbl">Rev Growth</span><span className="tile-val purple">{card.revenue_growth !== null ? `${card.revenue_growth}% YoY` : 'N/A'}</span></div>
                            <div className="card-tile"><span className="tile-lbl">Free Cash Flow</span><span className="tile-val amber">{card.fcf} ({card.fcf_yield})</span></div>
                            <div className="card-tile"><span className="tile-lbl">Analyst Target</span><span className="tile-val emerald">{card.analyst_target ? `$${card.analyst_target} (${card.analyst_rec})` : 'N/A'}</span></div>
                          </div>
                        </div>
                      )}

                      {/* CARD TYPE F: MARKET HEALTH CARD */}
                      {card && card.type === 'market_health' && (
                        <div className="ai-execution-card" style={{ borderColor: `${card.color || '#10b981'}55` }}>
                          <div className="card-top-strip">
                            <div className="card-title-group">
                              <Shield size={16} color={card.color || '#10b981'} />
                              <span className="card-ticker">MARKET REGIME</span>
                              <span className="card-playbook-pill" style={{ color: card.color || '#10b981' }}>{card.label}</span>
                            </div>
                            <div className="card-conviction-pill">{Number(card.score || 0).toFixed(1)} / 100</div>
                          </div>
                          <div style={{ height: '7px', background: 'rgba(255,255,255,0.08)', borderRadius: '999px', overflow: 'hidden', margin: '0.4rem 0 0.7rem 0' }}>
                            <div style={{ width: `${Math.min(100, Math.max(0, Number(card.score || 0)))}%`, height: '100%', background: card.color || '#10b981' }} />
                          </div>
                          <div className="card-actions-strip">
                            <button type="button" className="card-action-btn primary" onClick={() => handleSend('Top High-Conviction AI Playbook Setups', 'master')}>
                              <Sparkles size={13} /> Top Setups for Regime
                            </button>
                            <button type="button" className="card-action-btn" onClick={() => handleSend('Analyze $SPY gamma levels today', 'options', 'SPY')}>
                              <Zap size={13} /> Audit SPY GEX
                            </button>
                          </div>
                        </div>
                      )}

                      {msg.suggested_prompts && msg.suggested_prompts.length > 0 && !isUser && (
                        <div className="bubble-suggested-prompts">
                          <span className="suggested-title">Next Insights:</span>
                          <div className="prompts-chips-row">
                            {msg.suggested_prompts.map((promptText, pIdx) => (
                              <button key={pIdx} type="button" className="suggested-prompt-chip" onClick={() => handleSend(promptText)}>
                                {promptText}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {isLoading && (
                <div className="chat-message-row assistant-row">
                  <div className="message-avatar ai-avatar"><Bot size={18} color="#00F0FF" /></div>
                  <div className="message-bubble ai-bubble loading-bubble">
                    <div className="loading-dots-container">
                      <span className="loading-dot"></span>
                      <span className="loading-dot"></span>
                      <span className="loading-dot"></span>
                    </div>
                    <span className="loading-caption">Querying Lakehouse, SQLite GEX &amp; Calibrated Scanners...</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* 3. SUGGESTION DOCK & COMPOSER */}
          <div className="ask-ai-bottom-dock" style={{ position: 'relative' }}>
            {slashMatches.length > 0 && (
              <div style={{ position: 'absolute', bottom: '100%', left: '1.15rem', right: '1.15rem', background: 'rgba(15,23,42,0.98)', border: '1px solid rgba(0,240,255,0.35)', borderRadius: '10px', padding: '0.45rem', marginBottom: '6px', zIndex: 20, boxShadow: '0 -10px 30px rgba(0,0,0,0.5)' }}>
                <div style={{ fontSize: '0.68rem', color: '#94a3b8', padding: '2px 8px 6px 8px', fontWeight: 700 }}>
                  ⚡ SLASH COMMANDS (Focused on ${focusedTicker})
                </div>
                {slashMatches.map((s) => (
                  <button
                    key={s.cmd}
                    type="button"
                    onClick={() => {
                      setPersona(s.persona);
                      handleSend(s.template(focusedTicker), s.persona, focusedTicker);
                    }}
                    style={{ width: '100%', textAlign: 'left', background: 'transparent', border: 'none', padding: '6px 10px', borderRadius: '6px', color: '#e2e8f0', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}
                  >
                    <span><strong style={{ color: '#00F0FF', fontFamily: 'monospace' }}>{s.cmd}</strong> — {s.label}</span>
                    <span style={{ color: '#64748b', fontSize: '0.72rem' }}>Run ↵</span>
                  </button>
                ))}
              </div>
            )}

            <div className="dock-chips-carousel">
              {quickPrompts.slice(0, 4).map((p, idx) => (
                <button key={idx} type="button" className="quick-chip-btn" onClick={() => handleSend(p)} disabled={isLoading}>
                  <span>{p}</span>
                  <ChevronRight size={12} className="chip-icon" />
                </button>
              ))}
            </div>

            <form className="ask-ai-input-form" onSubmit={(e) => { e.preventDefault(); handleSend(); }}>
              <div className="input-wrapper">
                <Terminal size={15} color="#64748b" style={{ flexShrink: 0 }} />
                <input
                  type="text"
                  placeholder={`Ask ${activePersonaObj.label} (e.g. "highest conviction stocks", "Compare $NVDA vs $AMD", "/top", "/gex")...`}
                  value={inputVal}
                  onChange={(e) => setInputVal(e.target.value)}
                  disabled={isLoading}
                />
                <button type="submit" className="btn-send-ai" disabled={isLoading || !inputVal.trim()} title="Send prompt">
                  {isLoading ? <RefreshCw size={15} className="spin" color="#fff" /> : <><span>Send</span><Send size={14} /></>}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right: SYNCHRONIZED LIVE INTELLIGENCE RAIL */}
        {showRail && (
          <div style={{ width: '295px', flexShrink: 0, borderLeft: '1px solid rgba(255,255,255,0.08)', background: 'rgba(8, 12, 24, 0.88)', overflowY: 'auto', padding: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            {/* Live Telemetry */}
            <div style={railCardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
                <span style={railTitleStyle}><Zap size={13} color="#ec4899" /> ${focusedTicker} LIVE TELEMETRY</span>
                {liveGex?.spot_price && <strong style={{ color: '#00E676', fontFamily: 'monospace', fontSize: '0.86rem' }}>${Number(liveGex.spot_price).toFixed(2)}</strong>}
              </div>

              {gexLoading && !liveGex ? (
                <div style={{ fontSize: '0.73rem', color: '#64748b' }}>Loading live chain...</div>
              ) : liveGex ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', fontSize: '0.72rem' }}>
                  <div style={miniStatBox}><span style={miniLbl}>Call Wall</span><strong style={{ color: '#10b981', fontFamily: 'monospace' }}>${liveGex.key_levels?.call_wall ?? '--'}</strong></div>
                  <div style={miniStatBox}><span style={miniLbl}>Put Wall</span><strong style={{ color: '#f43f5e', fontFamily: 'monospace' }}>${liveGex.key_levels?.put_wall ?? '--'}</strong></div>
                  <div style={miniStatBox}><span style={miniLbl}>Zero Gamma</span><strong style={{ color: '#fbbf24', fontFamily: 'monospace' }}>${liveGex.key_levels?.zero_gamma ?? '--'}</strong></div>
                  <div style={miniStatBox}><span style={miniLbl}>Net GEX</span><strong style={{ color: (liveGex.totals?.total_net_gex ?? 0) >= 0 ? '#10b981' : '#f43f5e', fontFamily: 'monospace' }}>{formatCompact(liveGex.totals?.total_net_gex)}</strong></div>
                  <div style={miniStatBox}><span style={miniLbl}>Net VEX</span><strong style={{ color: (liveGex.totals?.total_net_vex ?? 0) >= 0 ? '#38bdf8' : '#fb7185', fontFamily: 'monospace' }}>{formatCompact(liveGex.totals?.total_net_vex)}</strong></div>
                  <div style={miniStatBox}><span style={miniLbl}>Spot-Vol ρ</span><strong style={{ color: '#38bdf8', fontFamily: 'monospace' }}>{liveGex.totals?.spot_vol_corr ?? '--'}</strong></div>
                </div>
              ) : (
                <div style={{ fontSize: '0.73rem', color: '#64748b' }}>Enter any ticker above to inspect live GEX/VEX.</div>
              )}

              <button type="button" onClick={() => handleSend(`Explain $${focusedTicker} Call Wall, Put Wall, Zero Gamma, and VEX positioning today`, 'options', focusedTicker)} style={railActionBtn}>
                Ask AI About ${focusedTicker} Levels →
              </button>
            </div>

            {/* Synchronized Market Health Pulse */}
            {marketHealth && (
              <div style={railCardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <span style={railTitleStyle}><Activity size={13} color={mhColor} /> MARKET HEALTH</span>
                  <strong style={{ color: mhColor, fontFamily: 'monospace', fontSize: '0.86rem' }}>
                    {mhScore !== null ? `${Number(mhScore).toFixed(1)}/100` : '--'}
                  </strong>
                </div>
                <div style={{ fontSize: '0.74rem', color: '#e2e8f0', fontWeight: 700 }}>{mhLabel}</div>
                <button type="button" onClick={() => handleSend('What is the current Market Health regime and risk budget?', 'macro')} style={railActionBtn}>
                  Macro Risk Briefing →
                </button>
              </div>
            )}

            {/* Walk-Forward Calibrated Multi-Engine Leaders */}
            {topSetups.length > 0 && (
              <div style={railCardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
                  <span style={railTitleStyle}><Layers size={13} color="#8b5cf6" /> CALIBRATED TOP SETUPS</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.38rem' }}>
                  {topSetups.map((st) => (
                    <button
                      key={st.ticker}
                      type="button"
                      onClick={() => {
                        setFocusedTicker(st.ticker);
                        setTickerInput(st.ticker);
                        handleSend(`Analyze $${st.ticker} levels and trade setup`, 'quant', st.ticker);
                      }}
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '6px', padding: '5px 8px', cursor: 'pointer', color: '#fff', fontSize: '0.74rem' }}
                    >
                      <span>
                        <strong>${st.ticker}</strong>{' '}
                        <span style={{ color: st.direction === 'BEARISH' ? '#fb7185' : '#94a3b8', fontSize: '0.67rem' }}>
                          {st.direction === 'BEARISH' ? 'SHORT' : `${st.confluence_count} Eng`}
                        </span>
                      </span>
                      <span style={{ color: gradeBadgeColor(st.grade), fontWeight: 800, fontFamily: 'monospace' }}>
                        {st.grade} · {st.conviction_score}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Pinned Briefs */}
            {pinnedCards.length > 0 && (
              <div style={railCardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
                  <span style={railTitleStyle}><Pin size={13} color="#fbbf24" /> PINNED BRIEFS ({pinnedCards.length})</span>
                  <button type="button" onClick={() => setPinnedCards([])} style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: '0.68rem', cursor: 'pointer' }}>Clear</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.38rem' }}>
                  {pinnedCards.map((p) => (
                    <div key={p.msgId} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '6px', padding: '6px 8px', fontSize: '0.71rem', border: '1px solid rgba(251,191,36,0.2)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#fbbf24', fontWeight: 700 }}>
                        <span>{p.card.ticker ? `$${p.card.ticker}` : p.card.title || p.card.type}</span>
                        <span style={{ color: '#64748b' }}>{p.time}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function PriceLadderBar({ stop, spot, t1, t2 }) {
  const minP = Math.min(stop, spot) * 0.995;
  const maxP = Math.max(t2, t1, spot) * 1.005;
  const span = Math.max(0.01, maxP - minP);
  const pct = (v) => Math.max(0, Math.min(100, ((v - minP) / span) * 100));
  return (
    <div style={{ margin: '0.35rem 0 0.7rem 0', padding: '0.45rem 0.65rem', background: 'rgba(2,6,23,0.58)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: '#94a3b8', marginBottom: '4px', fontFamily: 'monospace' }}>
        <span style={{ color: '#f43f5e' }}>Stop ${stop}</span>
        <span style={{ color: '#fff' }}>Spot ${Number(spot).toFixed(2)}</span>
        <span style={{ color: '#10b981' }}>T1 ${t1}</span>
        {t2 > t1 && <span style={{ color: '#c084fc' }}>T2 ${t2}</span>}
      </div>
      <div style={{ position: 'relative', height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '999px' }}>
        <div style={{ position: 'absolute', left: `${pct(stop)}%`, width: `${Math.max(2, pct(t1) - pct(stop))}%`, height: '100%', background: 'linear-gradient(90deg, #f43f5e, #fbbf24, #10b981)', borderRadius: '999px' }} />
        <div style={{ position: 'absolute', left: `${pct(spot)}%`, top: '-3px', width: '4px', height: '12px', background: '#fff', borderRadius: '2px', transform: 'translateX(-50%)' }} />
      </div>
    </div>
  );
}

function GexCorridorBar({ putWall, zeroGamma, spot, callWall }) {
  const minP = Math.min(putWall, spot) * 0.995;
  const maxP = Math.max(callWall, spot) * 1.005;
  const span = Math.max(0.01, maxP - minP);
  const pct = (v) => Math.max(0, Math.min(100, ((v - minP) / span) * 100));
  return (
    <div style={{ margin: '0.35rem 0 0.7rem 0', padding: '0.45rem 0.65rem', background: 'rgba(2,6,23,0.58)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', fontFamily: 'monospace', marginBottom: '4px' }}>
        <span style={{ color: '#f43f5e' }}>PW ${putWall}</span>
        {zeroGamma && <span style={{ color: '#fbbf24' }}>ZG ${zeroGamma}</span>}
        <span style={{ color: '#fff' }}>Spot ${Number(spot).toFixed(2)}</span>
        <span style={{ color: '#10b981' }}>CW ${callWall}</span>
      </div>
      <div style={{ position: 'relative', height: '6px', background: 'linear-gradient(90deg, rgba(244,63,94,0.5), rgba(251,191,36,0.5), rgba(16,185,129,0.5))', borderRadius: '999px' }}>
        {zeroGamma && <div style={{ position: 'absolute', left: `${pct(zeroGamma)}%`, top: '-2px', width: '3px', height: '10px', background: '#fbbf24', transform: 'translateX(-50%)' }} />}
        <div style={{ position: 'absolute', left: `${pct(spot)}%`, top: '-4px', width: '5px', height: '14px', background: '#00F0FF', borderRadius: '2px', transform: 'translateX(-50%)', boxShadow: '0 0 8px #00F0FF' }} />
      </div>
    </div>
  );
}

const iconCtrlBtn = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '6px',
  color: '#94a3b8',
  padding: '6px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
};

const railCardStyle = {
  background: 'rgba(15, 23, 42, 0.78)',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  borderRadius: '10px',
  padding: '0.72rem',
};

const railTitleStyle = {
  fontSize: '0.69rem',
  fontWeight: 800,
  color: '#cbd5e1',
  display: 'flex',
  alignItems: 'center',
  gap: '0.35rem',
  letterSpacing: '0.04em',
};

const miniStatBox = {
  background: 'rgba(2, 6, 23, 0.55)',
  borderRadius: '6px',
  padding: '4px 7px',
  border: '1px solid rgba(255,255,255,0.04)',
};

const miniLbl = {
  display: 'block',
  fontSize: '0.61rem',
  color: '#64748b',
};

const railActionBtn = {
  marginTop: '0.5rem',
  width: '100%',
  background: 'rgba(0, 240, 255, 0.1)',
  border: '1px solid rgba(0, 240, 255, 0.25)',
  borderRadius: '6px',
  color: '#00F0FF',
  fontSize: '0.71rem',
  fontWeight: 700,
  padding: '5px 8px',
  cursor: 'pointer',
};
