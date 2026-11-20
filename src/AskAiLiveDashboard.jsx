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
  Terminal
} from 'lucide-react';
import './AskAiLive.css';

const DEFAULT_PERSONAS = [
  { id: 'master', label: '🧠 Master Council', color: '#8b5cf6', desc: 'Ensemble multi-modal synthesis' },
  { id: 'quant', label: '🎯 Quant Breakout', color: '#00F0FF', desc: 'VCP & MA support corridors' },
  { id: 'options', label: '⚡ Options & GEX', color: '#ec4899', desc: 'Gamma walls & dealer hedging' },
  { id: 'macro', label: '🌐 Macro Regime', color: '#10b981', desc: 'Breadth, VIX & allocation' },
  { id: 'fundamental', label: '📊 Fundamentals', color: '#f59e0b', desc: 'Valuation & earnings drift' }
];

const SLASH_COMMANDS = [
  { cmd: '/gex', label: 'Gamma Walls & VEX', template: (t) => `Analyze key gamma levels, Call/Put walls, Zero Gamma, and VEX for $${t}`, persona: 'options' },
  { cmd: '/setup', label: 'Trade Setup & Stops', template: (t) => `Analyze $${t} levels, accumulation corridor, and trade setup`, persona: 'quant' },
  { cmd: '/dcf', label: 'DCF & Fundamentals', template: (t) => `Check DCF fair value, Piotroski solvency, and margins for $${t}`, persona: 'fundamental' },
  { cmd: '/macro', label: 'Market Health Regime', template: () => `What is the current Market Health regime and risk budget?`, persona: 'macro' },
  { cmd: '/top', label: 'Top AI Playbook Picks', template: () => `Top High-Conviction AI Playbook Setups`, persona: 'master' },
  { cmd: '/squeeze', label: 'Short Squeeze Scan', template: () => `Find the best Short Squeeze candidates`, persona: 'quant' }
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

export default function AskAiLiveDashboard({
  activeTicker = 'SPY',
  onTickerSelect = null,
  initialPersona = 'master'
}) {
  const [focusedTicker, setFocusedTicker] = useState((activeTicker || 'SPY').toUpperCase());
  const [tickerInput, setTickerInput] = useState((activeTicker || 'SPY').toUpperCase());
  const [persona, setPersona] = useState(initialPersona);
  const [messages, setMessages] = useState([]);
  const [inputVal, setInputVal] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState(null);
  const [showRail, setShowRail] = useState(true);
  const [pinnedCards, setPinnedCards] = useState([]);

  // Live Telemetry Rail State
  const [liveGex, setLiveGex] = useState(null);
  const [gexLoading, setGexLoading] = useState(false);
  const [marketHealth, setMarketHealth] = useState(null);
  const [playbookTop, setPlaybookTop] = useState([]);

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

  // Fetch Market Health & AI Playbook once for Live Context Rail
  useEffect(() => {
    let mounted = true;
    const loadStaticFeeds = async () => {
      try {
        const mhRes = await fetch('/market_health.json?t=' + Date.now());
        if (mhRes.ok) {
          const mhJson = await mhRes.json();
          if (mounted) setMarketHealth(mhJson.current_health || mhJson);
        }
      } catch (e) { /* ignore */ }
      try {
        const pbRes = await fetch('/ai_playbook.json?t=' + Date.now());
        if (pbRes.ok) {
          const pbJson = await pbRes.json();
          if (mounted) setPlaybookTop((pbJson.focus_list || []).slice(0, 4));
        }
      } catch (e) { /* ignore */ }
    };
    loadStaticFeeds();
    return () => { mounted = false; };
  }, []);

  // Fetch Live GEX Telemetry whenever focusedTicker changes
  useEffect(() => {
    if (!focusedTicker) return;
    let cancelled = false;
    setGexLoading(true);
    fetch(`/api/gex?ticker=${encodeURIComponent(focusedTicker)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!cancelled && d && !d.error) setLiveGex(d);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setGexLoading(false); });
    return () => { cancelled = true; };
  }, [focusedTicker]);

  // Initial welcome message
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          persona: 'master',
          text: `👋 **Welcome to Ask AI Live — Institutional Market Copilot.**\n\nI am wired live into your **GEX Profiler & VEX/Spot-Vol Engine**, **AI Playbook**, **DCF Fundamentals**, and **Market Health Regimes**.\n\nType any question, use **`/`** slash commands (\`/gex\`, \`/setup\`, \`/dcf\`, \`/macro\`), or click any live level in the right Intelligence Rail.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          structured_card: null,
          suggested_prompts: [
            `🧲 Analyze key gamma & VEX levels on $${focusedTicker}`,
            `🚀 Top High-Conviction AI Playbook Setups`,
            `🛡️ What is the current Market Health regime?`,
            `📊 Check DCF Fair Value & margins for $${focusedTicker}`
          ]
        }
      ]);
    }
  }, []);

  const quickPrompts = useMemo(() => {
    if (persona === 'options') {
      return [
        `⚡ Major Call & Put Walls for $${focusedTicker}`,
        `🧲 Zero Gamma Flip & Dealer Pin on $${focusedTicker}`,
        `📌 OpEx Max Pain & Expected Move for $${focusedTicker}`,
        `🌊 Institutional GEX & VEX Risk for $${focusedTicker}`
      ];
    }
    if (persona === 'fundamental') {
      return [
        `📊 DCF Fair Value & Margin of Safety for $${focusedTicker}`,
        `🛡️ Piotroski Solvency & Debt Health for $${focusedTicker}`,
        `💰 Free Cash Flow & Operating Margins on $${focusedTicker}`,
        `📈 Compare $${focusedTicker} vs Industry Peers`
      ];
    }
    if (persona === 'macro') {
      return [
        '🌐 Current Market Health & Macro Regime',
        '📈 McClellan Oscillator & Breadth Health',
        '🛡️ Defensive Sector Rotation Status',
        '🚀 Top setups for current regime'
      ];
    }
    if (persona === 'quant') {
      return [
        `🎯 High-probability breakout entries for $${focusedTicker}`,
        `📉 Moving Average pullback cushions for $${focusedTicker}`,
        `🛑 Strictly bounded invalidation stops for $${focusedTicker}`,
        '🚀 Top High-Conviction AI Playbook Setups'
      ];
    }
    return [
      '🚀 Top High-Conviction AI Playbook Setups',
      `🧲 What are $${focusedTicker} Call & Put Walls today?`,
      '🛡️ What is the current Market Health regime?',
      '🔥 Find the best Short Squeeze candidates'
    ];
  }, [persona, focusedTicker]);

  // Detect ticker mention in prompt so focusedTicker stays synced automatically
  const extractTickerFromPrompt = (txt) => {
    const dollarMatch = txt.match(/\$([A-Za-z]{1,5})\b/);
    if (dollarMatch) return dollarMatch[1].toUpperCase();
    return null;
  };

  const handleSend = async (queryText = null, personaOverride = null, tickerOverride = null) => {
    const textToSend = typeof queryText === 'string' ? queryText : inputVal;
    if (!textToSend || !textToSend.trim() || isLoading) return;

    const currentPersona = personaOverride || persona;
    const detected = extractTickerFromPrompt(textToSend);
    const targetTicker = (tickerOverride || detected || focusedTicker || 'SPY').toUpperCase();
    if (detected && detected !== focusedTicker) {
      setFocusedTicker(detected);
      setTickerInput(detected);
    }

    const userMsg = {
      id: Date.now().toString(),
      role: 'user',
      text: textToSend.trim(),
      ticker: targetTicker,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
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
          context: { activeTicker: targetTicker }
        })
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
        suggested_prompts: data.suggested_prompts || []
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          persona: currentPersona,
          text: `⚠️ **Connection Error**: Unable to reach the AI engine. Please ensure your local server is active.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
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
    setPinnedCards(prev => {
      if (prev.some(p => p.msgId === msgId)) return prev;
      return [{ msgId, card, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }, ...prev].slice(0, 6);
    });
  };

  const copyToClipboard = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const activePersonaObj = DEFAULT_PERSONAS.find(p => p.id === persona) || DEFAULT_PERSONAS[0];
  const slashMatches = inputVal.startsWith('/')
    ? SLASH_COMMANDS.filter(s => s.cmd.startsWith(inputVal.toLowerCase().split(' ')[0]))
    : [];

  const renderFormattedText = (text) => {
    if (!text) return null;
    const paragraphs = text.split('\n\n');
    return paragraphs.map((para, pIdx) => {
      if (para.startsWith('### ')) return <h4 key={pIdx} className="ai-chat-h4">{para.replace('### ', '')}</h4>;
      if (para.startsWith('## ')) return <h3 key={pIdx} className="ai-chat-h3">{para.replace('## ', '')}</h3>;
      if (para.startsWith('# ')) return <h2 key={pIdx} className="ai-chat-h2">{para.replace('# ', '')}</h2>;

      const lines = para.split('\n');
      return (
        <div key={pIdx} className="ai-chat-paragraph">
          {lines.map((line, lIdx) => {
            let cleanLine = line;
            const trimmed = cleanLine.trim();
            const isBullet = trimmed.startsWith('• ') || trimmed.startsWith('- ') || trimmed.startsWith('* ');
            if (isBullet) cleanLine = trimmed.substring(2);
            const parts = cleanLine.split(/(\*\*.*?\*\*|`.*?`)/g);
            return (
              <div key={lIdx} className={isBullet ? 'ai-chat-bullet' : 'ai-chat-line'}>
                {isBullet && <span className="bullet-point">▸</span>}
                <span>
                  {parts.map((part, partIdx) => {
                    if (part.startsWith('**') && part.endsWith('**')) return <strong key={partIdx}>{part.slice(2, -2)}</strong>;
                    if (part.startsWith('`') && part.endsWith('`')) return <code key={partIdx} className="ai-code-chip">{part.slice(1, -1)}</code>;
                    return part;
                  })}
                </span>
              </div>
            );
          })}
        </div>
      );
    });
  };

  return (
    <div className="ask-ai-container" style={{ height: '86vh' }}>
      {/* 1. TOP COMMAND BAR */}
      <div className="ask-ai-top-bar" style={{ flexWrap: 'wrap' }}>
        <div className="top-bar-left" style={{ flexWrap: 'wrap' }}>
          <div className="ai-logo-pill">
            <Bot size={20} color="#00F0FF" />
            <span>ASK AI LIVE</span>
            <span className="copilot-badge">COPILOT 2.0</span>
          </div>

          {/* Interactive Ticker Focus Switcher */}
          <form onSubmit={handleTickerSubmit} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'rgba(2,6,23,0.65)', padding: '3px 8px', borderRadius: '8px', border: '1px solid rgba(0,240,255,0.28)' }}>
            <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>FOCUS</span>
            <input
              type="text"
              value={tickerInput}
              onChange={(e) => setTickerInput(e.target.value.toUpperCase())}
              style={{ width: '58px', background: 'transparent', border: 'none', color: '#00E676', fontWeight: 800, fontSize: '0.82rem', outline: 'none', fontFamily: 'monospace' }}
              title="Type ticker & press Enter"
            />
            <button
              type="button"
              className="chip-action-btn"
              onClick={() => handleSend(`Analyze $${focusedTicker} levels, GEX walls, and trade setup`)}
            >
              Brief
            </button>
          </form>

          {/* Quick Watchlist Pills */}
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {WATCHLIST_PILLS.slice(0, 6).map(sym => (
              <button
                key={sym}
                type="button"
                onClick={() => { setFocusedTicker(sym); setTickerInput(sym); }}
                style={{
                  padding: '2px 7px',
                  borderRadius: '5px',
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  fontFamily: 'monospace',
                  cursor: 'pointer',
                  border: `1px solid ${focusedTicker === sym ? '#00F0FF' : 'rgba(255,255,255,0.08)'}`,
                  background: focusedTicker === sym ? 'rgba(0,240,255,0.16)' : 'rgba(255,255,255,0.03)',
                  color: focusedTicker === sym ? '#00F0FF' : '#94a3b8'
                }}
              >
                {sym}
              </button>
            ))}
          </div>
        </div>

        {/* Persona Tabs + Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <div className="persona-tabs">
            {DEFAULT_PERSONAS.map(p => (
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
            onClick={() => setMessages(prev => prev.slice(0, 1))}
            title="Clear Chat"
            style={iconCtrlBtn}
          >
            <Trash2 size={14} />
          </button>
          <button
            type="button"
            onClick={() => setShowRail(!showRail)}
            title={showRail ? 'Hide Live Intelligence Rail' : 'Show Live Intelligence Rail'}
            style={iconCtrlBtn}
          >
            {showRail ? <PanelRightClose size={15} /> : <PanelRightOpen size={15} />}
          </button>
        </div>
      </div>

      {/* 2. MAIN WORKSPACE: CHAT TERMINAL + LIVE INTELLIGENCE RAIL */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {/* Left: Chat Viewport & Composer */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
          <div className="ask-ai-messages-scroll" style={{ flex: 1 }}>
            <div className="messages-inner-wrapper">
              {messages.map((msg, idx) => {
                const isUser = msg.role === 'user';
                const card = msg.structured_card;
                const msgPersona = DEFAULT_PERSONAS.find(p => p.id === msg.persona) || activePersonaObj;

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
                              <button
                                type="button"
                                className="btn-copy-bubble"
                                onClick={() => handlePinCard(card, msg.id || idx)}
                                title="Pin card to Session Scratchpad"
                              >
                                <Pin size={12} color="#fbbf24" />
                              </button>
                            )}
                            <button
                              type="button"
                              className="btn-copy-bubble"
                              onClick={() => copyToClipboard(msg.text, idx)}
                              title="Copy analysis"
                            >
                              {copiedIdx === idx ? <Check size={12} color="#00E676" /> : <Copy size={12} />}
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="bubble-body">{renderFormattedText(msg.text)}</div>

                      {/* CARD 1: TRADE SETUP + VISUAL RISK LADDER */}
                      {card && card.type === 'trade_setup' && (
                        <div className="ai-execution-card">
                          <div className="card-top-strip">
                            <div className="card-title-group">
                              <span className="card-ticker">${card.ticker}</span>
                              <span className="card-price">${card.price}</span>
                              <span className="card-playbook-pill">{card.playbook}</span>
                            </div>
                            <div className="card-conviction-pill">★ {card.conviction}</div>
                          </div>

                          {/* Visual Risk-Reward Price Ladder */}
                          {card.stop_loss > 0 && card.target_primary > card.stop_loss && (
                            <PriceLadderBar
                              stop={card.stop_loss}
                              spot={card.price}
                              t1={card.target_primary}
                              t2={card.target_secondary || card.target_primary}
                            />
                          )}

                          <div className="card-tiles-grid">
                            <div className="card-tile">
                              <span className="tile-lbl">Corridor</span>
                              <span className="tile-val green">
                                ${card.entry_range ? `${card.entry_range[0]} ── $${card.entry_range[1]}` : card.price}
                              </span>
                            </div>
                            <div className="card-tile">
                              <span className="tile-lbl">Stop Loss</span>
                              <span className="tile-val rose">${card.stop_loss} ({card.stop_loss_pct}%)</span>
                            </div>
                            <div className="card-tile">
                              <span className="tile-lbl">Target 1 (Pin)</span>
                              <span className="tile-val emerald">${card.target_primary} (+{card.target_primary_pct}%)</span>
                            </div>
                            <div className="card-tile">
                              <span className="tile-lbl">Target 2 (Runner)</span>
                              <span className="tile-val purple">${card.target_secondary} (+{card.target_secondary_pct}%)</span>
                            </div>
                            <div className="card-tile">
                              <span className="tile-lbl">Quant Asymmetry</span>
                              <span className="tile-val amber">{card.risk_reward}</span>
                            </div>
                            <div className="card-tile">
                              <span className="tile-lbl">Options Spec</span>
                              <span className="tile-val cyan" title={card.options_spec}>{card.options_spec}</span>
                            </div>
                          </div>

                          <div className="card-actions-strip">
                            {onTickerSelect && (
                              <button type="button" className="card-action-btn primary" onClick={() => onTickerSelect(card.ticker)}>
                                <Search size={13} /> Deep Chart ${card.ticker}
                              </button>
                            )}
                            <button
                              type="button"
                              className="card-action-btn"
                              onClick={() => {
                                setPersona('options');
                                handleSend(`Show me gamma profile and option walls for $${card.ticker}`, 'options', card.ticker);
                              }}
                            >
                              <Zap size={13} /> Gamma Walls
                            </button>
                            <button
                              type="button"
                              className="card-action-btn"
                              onClick={() => {
                                setPersona('fundamental');
                                handleSend(`Check fundamental health and valuation for $${card.ticker}`, 'fundamental', card.ticker);
                              }}
                            >
                              <TrendingUp size={13} /> Fundamentals
                            </button>
                          </div>
                        </div>
                      )}

                      {/* CARD 2: GEX CARD + VISUAL GAMMA CORRIDOR */}
                      {card && card.type === 'gex_card' && (
                        <div className="ai-execution-card">
                          <div className="card-top-strip">
                            <div className="card-title-group">
                              <span className="card-ticker">${card.ticker}</span>
                              <span className="card-price">${typeof card.price === 'number' ? card.price.toFixed(2) : card.price}</span>
                              <span className="card-playbook-pill">{card.regime}</span>
                            </div>
                            <div className="card-conviction-pill">⚡ {card.squeeze_risk}</div>
                          </div>

                          {typeof card.put_wall === 'number' && typeof card.call_wall === 'number' && card.call_wall > card.put_wall && (
                            <GexCorridorBar
                              putWall={card.put_wall}
                              zeroGamma={card.zero_gamma}
                              spot={card.price}
                              callWall={card.call_wall}
                            />
                          )}

                          <div className="card-tiles-grid">
                            <div className="card-tile">
                              <span className="tile-lbl">Call Wall (Resistance)</span>
                              <span className="tile-val emerald">${typeof card.call_wall === 'number' ? card.call_wall.toFixed(2) : card.call_wall}</span>
                            </div>
                            <div className="card-tile">
                              <span className="tile-lbl">Put Wall (Floor)</span>
                              <span className="tile-val rose">${typeof card.put_wall === 'number' ? card.put_wall.toFixed(2) : card.put_wall}</span>
                            </div>
                            <div className="card-tile">
                              <span className="tile-lbl">Zero Gamma Flip</span>
                              <span className="tile-val amber">${typeof card.zero_gamma === 'number' ? card.zero_gamma.toFixed(2) : card.zero_gamma}</span>
                            </div>
                            <div className="card-tile">
                              <span className="tile-lbl">Max Pain</span>
                              <span className="tile-val purple">${typeof card.max_pain === 'number' ? card.max_pain.toFixed(2) : card.max_pain}</span>
                            </div>
                            <div className="card-tile">
                              <span className="tile-lbl">Net Gamma (GEX)</span>
                              <span className="tile-val cyan">{card.net_gex}</span>
                            </div>
                            <div className="card-tile">
                              <span className="tile-lbl">1D Expected Move</span>
                              <span className="tile-val amber">
                                ±${typeof card.expected_move_1d === 'number' ? card.expected_move_1d.toFixed(2) : (card.expected_move_1d || '0.00')}
                                {card.expected_move_pct ? ` (±${Number(card.expected_move_pct).toFixed(2)}%)` : ''}
                              </span>
                            </div>
                          </div>

                          <div className="card-actions-strip">
                            {onTickerSelect && (
                              <button type="button" className="card-action-btn primary" onClick={() => onTickerSelect(card.ticker)}>
                                <Search size={13} /> Deep Chart ${card.ticker}
                              </button>
                            )}
                            <button type="button" className="card-action-btn" onClick={() => handleSend(`Check fundamental health and valuation for $${card.ticker}`, 'fundamental', card.ticker)}>
                              <TrendingUp size={13} /> Fundamentals
                            </button>
                            <button type="button" className="card-action-btn" onClick={() => handleSend(`Analyze $${card.ticker} levels and trade setup`, 'quant', card.ticker)}>
                              <Target size={13} /> Trade Setup
                            </button>
                          </div>
                        </div>
                      )}

                      {/* CARD 3: FUNDAMENTAL CARD */}
                      {card && card.type === 'fundamental_card' && (
                        <div className="ai-execution-card">
                          <div className="card-top-strip">
                            <div className="card-title-group">
                              <span className="card-ticker">${card.ticker}</span>
                              <span className="card-price">${card.price}</span>
                              <span className="card-playbook-pill">{card.valuation_status}</span>
                            </div>
                            <div className="card-conviction-pill">★ Piotroski {card.piotroski_score}/9</div>
                          </div>

                          <div className="card-tiles-grid">
                            <div className="card-tile">
                              <span className="tile-lbl">Fair Value (DCF)</span>
                              <span className="tile-val emerald">${card.fair_value} ({card.margin_of_safety >= 0 ? `+${card.margin_of_safety}%` : `${card.margin_of_safety}%`})</span>
                            </div>
                            <div className="card-tile">
                              <span className="tile-lbl">P/E · Fwd P/E</span>
                              <span className="tile-val cyan">{card.pe_ratio ? `${card.pe_ratio}x` : 'N/A'} · {card.fwd_pe ? `${card.fwd_pe}x` : 'N/A'}</span>
                            </div>
                            <div className="card-tile">
                              <span className="tile-lbl">Operating Margin</span>
                              <span className="tile-val green">{card.operating_margin ? `${card.operating_margin}%` : 'N/A'}</span>
                            </div>
                            <div className="card-tile">
                              <span className="tile-lbl">Revenue Growth</span>
                              <span className="tile-val purple">{card.revenue_growth ? `${card.revenue_growth}% YoY` : 'N/A'}</span>
                            </div>
                            <div className="card-tile">
                              <span className="tile-lbl">Free Cash Flow</span>
                              <span className="tile-val amber">{card.fcf} ({card.fcf_yield})</span>
                            </div>
                            <div className="card-tile">
                              <span className="tile-lbl">Analyst Target</span>
                              <span className="tile-val emerald">{card.analyst_target ? `$${card.analyst_target} (${card.analyst_rec})` : 'N/A'}</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* CARD 4: MARKET HEALTH CARD (PREVIOUSLY MISSING!) */}
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
                          <div style={{ height: '7px', background: 'rgba(255,255,255,0.08)', borderRadius: '999px', overflow: 'hidden', margin: '0.5rem 0 0.75rem 0' }}>
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
                    <span className="loading-caption">Synthesizing live GEX, Fundamentals &amp; Playbook telemetry...</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* 3. SUGGESTION DOCK & SLASH-COMMAND COMPOSER */}
          <div className="ask-ai-bottom-dock" style={{ position: 'relative' }}>
            {slashMatches.length > 0 && (
              <div style={{ position: 'absolute', bottom: '100%', left: '1.25rem', right: '1.25rem', background: 'rgba(15,23,42,0.98)', border: '1px solid rgba(0,240,255,0.35)', borderRadius: '10px', padding: '0.45rem', marginBottom: '6px', zIndex: 20, boxShadow: '0 -10px 30px rgba(0,0,0,0.5)' }}>
                <div style={{ fontSize: '0.68rem', color: '#94a3b8', padding: '2px 8px 6px 8px', fontWeight: 700 }}>
                  ⚡ SLASH COMMANDS (Focused on ${focusedTicker})
                </div>
                {slashMatches.map(s => (
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
                    <span style={{ color: '#64748b', fontSize: '0.72rem' }}>Enter ↵</span>
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
                <Terminal size={15} color="#64748b" style={{ marginRight: '8px', flexShrink: 0 }} />
                <input
                  type="text"
                  placeholder={`Ask ${activePersonaObj.label} about $${focusedTicker} or type / for commands (/gex, /setup, /dcf, /macro)...`}
                  value={inputVal}
                  onChange={(e) => setInputVal(e.target.value)}
                  disabled={isLoading}
                />
                <button type="submit" className="btn-send-ai" disabled={isLoading || !inputVal.trim()} title="Send prompt (Enter)">
                  {isLoading ? <RefreshCw size={16} className="spin" color="#00F0FF" /> : <><span>Send</span><Send size={15} /></>}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right: LIVE INTELLIGENCE RAIL */}
        {showRail && (
          <div style={{ width: '310px', flexShrink: 0, borderLeft: '1px solid rgba(255,255,255,0.08)', background: 'rgba(8, 12, 24, 0.85)', overflowY: 'auto', padding: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {/* Widget 1: Active Ticker Live GEX & VEX Telemetry */}
            <div style={railCardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={railTitleStyle}><Zap size={13} color="#ec4899" /> ${focusedTicker} LIVE TELEMETRY</span>
                {liveGex?.spot_price && <strong style={{ color: '#00E676', fontFamily: 'monospace', fontSize: '0.88rem' }}>${Number(liveGex.spot_price).toFixed(2)}</strong>}
              </div>

              {gexLoading && !liveGex ? (
                <div style={{ fontSize: '0.74rem', color: '#64748b' }}>Loading live chain...</div>
              ) : liveGex ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem', fontSize: '0.73rem' }}>
                  <div style={miniStatBox}>
                    <span style={miniLbl}>Call Wall</span>
                    <strong style={{ color: '#10b981', fontFamily: 'monospace' }}>${liveGex.key_levels?.call_wall ?? '--'}</strong>
                  </div>
                  <div style={miniStatBox}>
                    <span style={miniLbl}>Put Wall</span>
                    <strong style={{ color: '#f43f5e', fontFamily: 'monospace' }}>${liveGex.key_levels?.put_wall ?? '--'}</strong>
                  </div>
                  <div style={miniStatBox}>
                    <span style={miniLbl}>Zero Gamma</span>
                    <strong style={{ color: '#fbbf24', fontFamily: 'monospace' }}>${liveGex.key_levels?.zero_gamma ?? '--'}</strong>
                  </div>
                  <div style={miniStatBox}>
                    <span style={miniLbl}>Net GEX</span>
                    <strong style={{ color: (liveGex.totals?.total_net_gex ?? 0) >= 0 ? '#10b981' : '#f43f5e', fontFamily: 'monospace' }}>
                      {formatCompact(liveGex.totals?.total_net_gex)}
                    </strong>
                  </div>
                  <div style={miniStatBox}>
                    <span style={miniLbl}>Net VEX</span>
                    <strong style={{ color: (liveGex.totals?.total_net_vex ?? 0) >= 0 ? '#38bdf8' : '#fb7185', fontFamily: 'monospace' }}>
                      {formatCompact(liveGex.totals?.total_net_vex)}
                    </strong>
                  </div>
                  <div style={miniStatBox}>
                    <span style={miniLbl}>Spot-Vol ρ</span>
                    <strong style={{ color: liveGex.totals?.spot_vol_color || '#38bdf8', fontFamily: 'monospace' }}>
                      {liveGex.totals?.spot_vol_corr !== undefined ? `${liveGex.totals.spot_vol_corr >= 0 ? '+' : ''}${liveGex.totals.spot_vol_corr}` : '--'}
                    </strong>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: '0.74rem', color: '#64748b' }}>Enter any ticker above to inspect live GEX/VEX.</div>
              )}

              <button
                type="button"
                onClick={() => handleSend(`Explain $${focusedTicker} Call Wall, Put Wall, Zero Gamma, and VEX positioning today`, 'options', focusedTicker)}
                style={railActionBtn}
              >
                Ask AI About ${focusedTicker} Levels →
              </button>
            </div>

            {/* Widget 2: Market Health Pulse */}
            {marketHealth && (
              <div style={railCardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
                  <span style={railTitleStyle}><Activity size={13} color="#10b981" /> MARKET HEALTH</span>
                  <strong style={{ color: marketHealth.color || '#10b981', fontFamily: 'monospace', fontSize: '0.85rem' }}>
                    {Number(marketHealth.score || 0).toFixed(0)}/100
                  </strong>
                </div>
                <div style={{ fontSize: '0.74rem', color: '#e2e8f0', fontWeight: 700 }}>{marketHealth.label || 'Active Regime'}</div>
                <button
                  type="button"
                  onClick={() => handleSend('What is the current Market Health regime and risk budget?', 'macro')}
                  style={railActionBtn}
                >
                  Macro Risk Briefing →
                </button>
              </div>
            )}

            {/* Widget 3: AI Playbook Top Setups */}
            {playbookTop.length > 0 && (
              <div style={railCardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={railTitleStyle}><Layers size={13} color="#8b5cf6" /> TOP PLAYBOOK SIGNALS</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {playbookTop.map(pb => (
                    <button
                      key={pb.ticker}
                      type="button"
                      onClick={() => {
                        setFocusedTicker(pb.ticker);
                        setTickerInput(pb.ticker);
                        handleSend(`Analyze $${pb.ticker} levels and trade setup`, 'quant', pb.ticker);
                      }}
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', padding: '5px 8px', cursor: 'pointer', color: 'white', fontSize: '0.75rem' }}
                    >
                      <span><strong>${pb.ticker}</strong> <span style={{ color: '#94a3b8', fontSize: '0.68rem' }}>{pb.playbook_badge || 'SETUP'}</span></span>
                      <span style={{ color: '#10b981', fontWeight: 700, fontFamily: 'monospace' }}>{pb.conviction_rating || pb.conviction_score}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Widget 4: Pinned Session Briefs */}
            {pinnedCards.length > 0 && (
              <div style={railCardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
                  <span style={railTitleStyle}><Pin size={13} color="#fbbf24" /> PINNED BRIEFS ({pinnedCards.length})</span>
                  <button type="button" onClick={() => setPinnedCards([])} style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: '0.68rem', cursor: 'pointer' }}>Clear</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {pinnedCards.map(p => (
                    <div key={p.msgId} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '6px', padding: '6px 8px', fontSize: '0.72rem', border: '1px solid rgba(251,191,36,0.2)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#fbbf24', fontWeight: 700 }}>
                        <span>${p.card.ticker || p.card.type}</span>
                        <span style={{ color: '#64748b' }}>{p.time}</span>
                      </div>
                      <div style={{ color: '#cbd5e1', marginTop: '2px' }}>
                        {p.card.type === 'trade_setup' && `Stop $${p.card.stop_loss} → T1 $${p.card.target_primary} (${p.card.risk_reward})`}
                        {p.card.type === 'gex_card' && `PW $${p.card.put_wall} | ZG $${p.card.zero_gamma} | CW $${p.card.call_wall}`}
                        {p.card.type === 'fundamental_card' && `DCF $${p.card.fair_value} (${p.card.valuation_status})`}
                        {p.card.type === 'market_health' && `Regime: ${p.card.label} (${p.card.score})`}
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
    <div style={{ margin: '0.4rem 0 0.75rem 0', padding: '0.45rem 0.65rem', background: 'rgba(2,6,23,0.55)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: '#94a3b8', marginBottom: '4px', fontFamily: 'monospace' }}>
        <span style={{ color: '#f43f5e' }}>Stop ${stop}</span>
        <span style={{ color: '#fff' }}>Spot ${spot}</span>
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
    <div style={{ margin: '0.4rem 0 0.75rem 0', padding: '0.45rem 0.65rem', background: 'rgba(2,6,23,0.55)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', fontFamily: 'monospace', marginBottom: '4px' }}>
        <span style={{ color: '#f43f5e' }}>PW ${putWall}</span>
        <span style={{ color: '#fbbf24' }}>ZG ${zeroGamma}</span>
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
  alignItems: 'center'
};

const railCardStyle = {
  background: 'rgba(15, 23, 42, 0.72)',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  borderRadius: '10px',
  padding: '0.75rem'
};

const railTitleStyle = {
  fontSize: '0.7rem',
  fontWeight: 800,
  color: '#cbd5e1',
  display: 'flex',
  alignItems: 'center',
  gap: '0.35rem',
  letterSpacing: '0.04em'
};

const miniStatBox = {
  background: 'rgba(2, 6, 23, 0.55)',
  borderRadius: '6px',
  padding: '4px 7px',
  border: '1px solid rgba(255,255,255,0.04)'
};

const miniLbl = {
  display: 'block',
  fontSize: '0.62rem',
  color: '#64748b'
};

const railActionBtn = {
  marginTop: '0.55rem',
  width: '100%',
  background: 'rgba(0, 240, 255, 0.1)',
  border: '1px solid rgba(0, 240, 255, 0.25)',
  borderRadius: '6px',
  color: '#00F0FF',
  fontSize: '0.72rem',
  fontWeight: 700,
  padding: '5px 8px',
  cursor: 'pointer'
};
