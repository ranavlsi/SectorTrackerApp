import React, { useState, useEffect, useRef } from 'react';
import {
  Bot,
  Send,
  Sparkles,
  RefreshCw,
  Search,
  ArrowUpRight,
  ShieldAlert,
  Compass,
  Zap,
  Flame,
  CheckCircle2,
  Copy,
  Check,
  TrendingUp,
  Activity,
  Layers,
  Radio,
  ExternalLink,
  ChevronRight,
  HelpCircle
} from 'lucide-react';
import './AskAiLive.css';

const DEFAULT_PERSONAS = [
  { id: 'master', label: '🧠 Master AI Council', color: '#8b5cf6', desc: 'Ensemble multi-modal synthesis' },
  { id: 'quant', label: '🎯 Quant Breakout', color: '#00F0FF', desc: 'VCP & MA support corridors' },
  { id: 'options', label: '⚡ Options & GEX', color: '#ec4899', desc: 'Gamma walls & dealer hedging' },
  { id: 'macro', label: '🌐 Macro Regime', color: '#10b981', desc: 'Breadth, VIX & allocation' },
  { id: 'fundamental', label: '📊 Deep Fundamentals', color: '#f59e0b', desc: 'Valuation & earnings drift' }
];

const INITIAL_SUGGESTIONS = [
  "🚀 Top High-Conviction AI Playbook Setups",
  "🧲 What are the SPY Call & Put Walls today?",
  "🛡️ What is the current Market Health regime?",
  "🔥 Find the best Short Squeeze candidates",
  "📈 Show Moving Average Pullback Cushions"
];

export default function AskAiLiveDashboard({
  activeTicker = 'SPY',
  onTickerSelect = null,
  initialPersona = 'master'
}) {
  const [persona, setPersona] = useState(initialPersona);
  const [messages, setMessages] = useState([]);
  const [inputVal, setInputVal] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState(null);
  const [quickPrompts, setQuickPrompts] = useState(INITIAL_SUGGESTIONS);

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Initial welcome message
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          persona: 'master',
          text: `👋 **Welcome to Ask AI Live — Institutional Market Copilot.**\n\nI am connected live to your **GEX Profiler Suite**, **AI Playbook Engine**, **Screener Surveillance**, and **Market Health Regimes**.\n\nAsk me anything about market direction, specific stock levels, options flow, or request top algorithmic setups.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          structured_card: null,
          suggested_prompts: [
            "🚀 What are the top setups for tomorrow?",
            `🧲 Analyze key gamma levels on $${activeTicker}`,
            "🛡️ How is the broader market health right now?",
            "🔥 Show Short Squeeze runners"
          ]
        }
      ]);
    }
  }, []);

  const handlePersonaChange = (newPersona) => {
    setPersona(newPersona);
    if (newPersona === 'options') {
      setQuickPrompts([
        `⚡ Major Call & Put Walls for $${activeTicker}`,
        `🧲 Zero Gamma Flip & Dealer Pin on $${activeTicker}`,
        `📌 OpEx Max Pain & Expected Move for $${activeTicker}`,
        `🌊 Institutional GEX Cascade Risk for $${activeTicker}`
      ]);
    } else if (newPersona === 'fundamental') {
      setQuickPrompts([
        `📊 DCF Fair Value & Margin of Safety for $${activeTicker}`,
        `🛡️ Piotroski Solvency & Debt Health for $${activeTicker}`,
        `💰 Free Cash Flow & Operating Margins on $${activeTicker}`,
        `📈 Compare $${activeTicker} vs Industry Peers`
      ]);
    } else if (newPersona === 'macro') {
      setQuickPrompts([
        "🌐 Current Market Health & Macro Regime",
        "📈 McClellan Oscillator & Breadth Health",
        "📉 10-Year Treasury Yields & Tech Impact",
        "🛡️ Defensive Sector Rotation Status"
      ]);
    } else if (newPersona === 'quant') {
      setQuickPrompts([
        `🎯 High-probability breakout entries for $${activeTicker}`,
        `📉 Moving Average pullback cushions for $${activeTicker}`,
        `🛑 Strictly bounded invalidation stops for $${activeTicker}`,
        "🚀 Top High-Conviction AI Playbook Setups"
      ]);
    } else {
      setQuickPrompts(INITIAL_SUGGESTIONS);
    }
  };

  const handleSend = async (queryText = null, personaOverride = null) => {
    const textToSend = typeof queryText === 'string' ? queryText : inputVal;
    if (!textToSend || !textToSend.trim() || isLoading) return;
    const currentPersona = personaOverride || persona;

    const userMsg = {
      id: Date.now().toString(),
      role: 'user',
      text: textToSend.trim(),
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
          ticker: activeTicker || 'SPY',
          persona: currentPersona,
          context: { activeTicker }
        })
      });

      const data = await res.json();
      
      const aiMsg = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        persona: persona,
        text: data.response || "No response received.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        structured_card: data.structured_card || null,
        suggested_prompts: data.suggested_prompts || []
      };

      setMessages(prev => [...prev, aiMsg]);
      if (data.suggested_prompts && data.suggested_prompts.length > 0) {
        setQuickPrompts(data.suggested_prompts);
      }
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          persona: persona,
          text: `⚠️ **Connection Error**: Unable to reach the AI engine. Please ensure your local server is active.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const activePersonaObj = DEFAULT_PERSONAS.find(p => p.id === persona) || DEFAULT_PERSONAS[0];

  // Helper to render markdown-like formatting simply
  const renderFormattedText = (text) => {
    if (!text) return null;

    // Split paragraphs
    const paragraphs = text.split('\n\n');

    return paragraphs.map((para, pIdx) => {
      // Check for headings
      if (para.startsWith('### ')) {
        return <h4 key={pIdx} className="ai-chat-h4">{para.replace('### ', '')}</h4>;
      }
      if (para.startsWith('## ')) {
        return <h3 key={pIdx} className="ai-chat-h3">{para.replace('## ', '')}</h3>;
      }
      if (para.startsWith('# ')) {
        return <h2 key={pIdx} className="ai-chat-h2">{para.replace('# ', '')}</h2>;
      }

      // Format bullet lines
      const lines = para.split('\n');
      return (
        <div key={pIdx} className="ai-chat-paragraph">
          {lines.map((line, lIdx) => {
            let cleanLine = line;
            const isBullet = cleanLine.startsWith('• ') || cleanLine.startsWith('- ') || cleanLine.startsWith('* ');
            if (isBullet) {
              cleanLine = cleanLine.substring(2);
            }

            // Replace **bold** with <strong>
            const parts = cleanLine.split(/(\*\*.*?\*\*|`.*?`)/g);

            return (
              <div key={lIdx} className={isBullet ? "ai-chat-bullet" : "ai-chat-line"}>
                {isBullet && <span className="bullet-point">▸</span>}
                <span>
                  {parts.map((part, partIdx) => {
                    if (part.startsWith('**') && part.endsWith('**')) {
                      return <strong key={partIdx}>{part.slice(2, -2)}</strong>;
                    }
                    if (part.startsWith('`') && part.endsWith('`')) {
                      return <code key={partIdx} className="ai-code-chip">{part.slice(1, -1)}</code>;
                    }
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
    <div className="ask-ai-container">
      
      {/* ------------------------------------------------------------------ */}
      {/* 1. TOP COMMAND BAR                                                 */}
      {/* ------------------------------------------------------------------ */}
      <div className="ask-ai-top-bar">
        <div className="top-bar-left">
          <div className="ai-logo-pill">
            <Bot size={20} color="#00F0FF" />
            <span>ASK AI LIVE</span>
            <span className="copilot-badge">INSTITUTIONAL COPILOT</span>
          </div>

          {activeTicker && activeTicker !== 'UNKNOWN' && (
            <div className="active-ticker-chip">
              <span className="label">Active Focus:</span>
              <span className="ticker-badge">${activeTicker}</span>
              <button 
                type="button" 
                className="chip-action-btn"
                onClick={() => handleSend(`Analyze $${activeTicker} levels and trade setup`)}
                title={`Ask AI to analyze ${activeTicker}`}
              >
                Analyze Now
              </button>
            </div>
          )}
        </div>

        {/* Persona Selector Tabs */}
        <div className="persona-tabs">
          {DEFAULT_PERSONAS.map(p => (
            <button
              key={p.id}
              type="button"
              className={`persona-tab-btn ${persona === p.id ? 'active' : ''}`}
              style={{
                borderColor: persona === p.id ? p.color : 'transparent',
                color: persona === p.id ? '#fff' : '#94a3b8'
              }}
              onClick={() => handlePersonaChange(p.id)}
              title={p.desc}
            >
              <span className="persona-dot" style={{ backgroundColor: p.color }}></span>
              <span>{p.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 2. CHAT STREAM VIEWPORT                                            */}
      {/* ------------------------------------------------------------------ */}
      <div className="ask-ai-messages-scroll">
        <div className="messages-inner-wrapper">
          {messages.map((msg, idx) => {
            const isUser = msg.role === 'user';
            const card = msg.structured_card;

            return (
              <div key={msg.id || idx} className={`chat-message-row ${isUser ? 'user-row' : 'assistant-row'}`}>
                
                {/* Avatar Icon */}
                <div className={`message-avatar ${isUser ? 'user-avatar' : 'ai-avatar'}`}>
                  {isUser ? <span>ME</span> : <Bot size={18} color="#00F0FF" />}
                </div>

                {/* Message Bubble */}
                <div className={`message-bubble ${isUser ? 'user-bubble' : 'ai-bubble'}`}>
                  
                  {/* Bubble Header */}
                  <div className="bubble-header">
                    <span className="sender-name" style={{ color: isUser ? '#00F0FF' : activePersonaObj.color }}>
                      {isUser ? 'YOU' : activePersonaObj.label}
                    </span>
                    <span className="message-time">{msg.timestamp}</span>

                    {!isUser && (
                      <button
                        type="button"
                        className="btn-copy-bubble"
                        onClick={() => copyToClipboard(msg.text, idx)}
                        title="Copy analysis"
                      >
                        {copiedIdx === idx ? <Check size={12} color="#00E676" /> : <Copy size={12} />}
                      </button>
                    )}
                  </div>

                  {/* Bubble Text Body */}
                  <div className="bubble-body">
                    {renderFormattedText(msg.text)}
                  </div>

                  {/* Interactive Execution Card (If Present) */}
                  {card && card.type === 'trade_setup' && (
                    <div className="ai-execution-card">
                      <div className="card-top-strip">
                        <div className="card-title-group">
                          <span className="card-ticker">${card.ticker}</span>
                          <span className="card-price">${card.price}</span>
                          <span className="card-playbook-pill">{card.playbook}</span>
                        </div>
                        <div className="card-conviction-pill">
                          ★ {card.conviction}
                        </div>
                      </div>

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

                        {card.fundamentals && (
                          <>
                            <div className="card-tile">
                              <span className="tile-lbl">P/E · Fwd P/E</span>
                              <span className="tile-val white">
                                {card.fundamentals.pe ? `${card.fundamentals.pe.toFixed(1)}x` : 'N/A'} · {card.fundamentals.fwd_pe ? `${card.fundamentals.fwd_pe.toFixed(1)}x` : 'N/A'}
                              </span>
                            </div>

                            <div className="card-tile">
                              <span className="tile-lbl">Market Cap</span>
                              <span className="tile-val white">{card.fundamentals.market_cap || 'N/A'}</span>
                            </div>

                            <div className="card-tile">
                              <span className="tile-lbl">Analyst Target</span>
                              <span className="tile-val emerald">
                                {card.fundamentals.target_mean ? `$${card.fundamentals.target_mean.toFixed(2)} (${card.fundamentals.analyst_rec})` : 'N/A'}
                              </span>
                            </div>
                          </>
                        )}
                      </div>

                      {card.quick_actions && (
                        <div className="card-actions-strip">
                          {onTickerSelect && (
                            <button
                              type="button"
                              className="card-action-btn primary"
                              onClick={() => onTickerSelect(card.ticker)}
                            >
                              <Search size={13} /> Deep Chart ${card.ticker}
                            </button>
                          )}
                          <button
                            type="button"
                            className="card-action-btn"
                            onClick={() => {
                              handlePersonaChange('options');
                              handleSend(`Show me gamma profile and option walls for $${card.ticker}`, 'options');
                            }}
                          >
                            <Zap size={13} /> Gamma Walls
                          </button>
                          <button
                            type="button"
                            className="card-action-btn"
                            onClick={() => {
                              handlePersonaChange('fundamental');
                              handleSend(`Check fundamental health and valuation for $${card.ticker}`, 'fundamental');
                            }}
                          >
                            <TrendingUp size={13} /> Fundamentals
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Interactive Fundamental Intelligence Card */}
                  {card && card.type === 'fundamental_card' && (
                    <div className="ai-execution-card">
                      <div className="card-top-strip">
                        <div className="card-title-group">
                          <span className="card-ticker">${card.ticker}</span>
                          <span className="card-price">${card.price}</span>
                          <span className="card-playbook-pill">{card.valuation_status}</span>
                        </div>
                        <div className="card-conviction-pill">
                          ★ Piotroski {card.piotroski_score}/9
                        </div>
                      </div>

                      <div className="card-tiles-grid">
                        <div className="card-tile">
                          <span className="tile-lbl">Fair Value (DCF)</span>
                          <span className="tile-val emerald">${card.fair_value} ({card.margin_of_safety >= 0 ? `+${card.margin_of_safety}%` : `${card.margin_of_safety}%`})</span>
                        </div>

                        <div className="card-tile">
                          <span className="tile-lbl">P/E · Fwd P/E</span>
                          <span className="tile-val cyan">
                            {card.pe_ratio ? `${card.pe_ratio}x` : 'N/A'} · {card.fwd_pe ? `${card.fwd_pe}x` : 'N/A'}
                          </span>
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
                          <span className="tile-val emerald">
                            {card.analyst_target ? `$${card.analyst_target} (${card.analyst_rec})` : 'N/A'}
                          </span>
                        </div>

                        <div className="card-tile">
                          <span className="tile-lbl">Cash / Debt</span>
                          <span className="tile-val white">{card.cash} / {card.debt}</span>
                        </div>

                        <div className="card-tile">
                          <span className="tile-lbl">Market Cap</span>
                          <span className="tile-val white">{card.market_cap}</span>
                        </div>
                      </div>

                      <div className="card-actions-strip">
                        {onTickerSelect && (
                          <button
                            type="button"
                            className="card-action-btn primary"
                            onClick={() => onTickerSelect(card.ticker)}
                          >
                            <Search size={13} /> Deep Chart ${card.ticker}
                          </button>
                        )}
                        <button
                          type="button"
                          className="card-action-btn"
                          onClick={() => {
                            handlePersonaChange('options');
                            handleSend(`Show me gamma profile and option walls for $${card.ticker}`, 'options');
                          }}
                        >
                          <Zap size={13} /> Gamma Walls
                        </button>
                        <button
                          type="button"
                          className="card-action-btn"
                          onClick={() => {
                            handlePersonaChange('quant');
                            handleSend(`Show me institutional trade setup for $${card.ticker}`, 'quant');
                          }}
                        >
                          <TrendingUp size={13} /> Trade Setup
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Interactive Options GEX Profile Card */}
                  {card && card.type === 'gex_card' && (
                    <div className="ai-execution-card">
                      <div className="card-top-strip">
                        <div className="card-title-group">
                          <span className="card-ticker">${card.ticker}</span>
                          <span className="card-price">${typeof card.price === 'number' ? card.price.toFixed(2) : card.price}</span>
                          <span className="card-playbook-pill">{card.regime}</span>
                        </div>
                        <div className="card-conviction-pill">
                          ⚡ {card.squeeze_risk}
                        </div>
                      </div>

                      <div className="card-tiles-grid">
                        <div className="card-tile">
                          <span className="tile-lbl">Call Wall (Resistance)</span>
                          <span className="tile-val emerald">${typeof card.call_wall === 'number' ? card.call_wall.toFixed(2) : card.call_wall}</span>
                        </div>

                        <div className="card-tile">
                          <span className="tile-lbl">Put Wall (Major Floor)</span>
                          <span className="tile-val rose">${typeof card.put_wall === 'number' ? card.put_wall.toFixed(2) : card.put_wall}</span>
                        </div>

                        <div className="card-tile">
                          <span className="tile-lbl">Zero Gamma Flip</span>
                          <span className="tile-val amber">${typeof card.zero_gamma === 'number' ? card.zero_gamma.toFixed(2) : card.zero_gamma}</span>
                        </div>

                        <div className="card-tile">
                          <span className="tile-lbl">Max Pain (OpEx Pin)</span>
                          <span className="tile-val purple">${typeof card.max_pain === 'number' ? card.max_pain.toFixed(2) : card.max_pain}</span>
                        </div>

                        <div className="card-tile">
                          <span className="tile-lbl">Net Gamma (GEX)</span>
                          <span className="tile-val cyan">{card.net_gex}</span>
                        </div>

                        <div className="card-tile">
                          <span className="tile-lbl">Put/Call Ratio</span>
                          <span className="tile-val white">{typeof card.pc_ratio === 'number' ? card.pc_ratio.toFixed(2) : card.pc_ratio}</span>
                        </div>

                        <div className="card-tile">
                          <span className="tile-lbl">1-Day Expected Move</span>
                          <span className="tile-val amber">
                            ±${typeof card.expected_move_1d === 'number' ? card.expected_move_1d.toFixed(2) : (card.expected_move_1d || '0.00')} 
                            {card.expected_move_pct ? ` (±${typeof card.expected_move_pct === 'number' ? card.expected_move_pct.toFixed(2) : card.expected_move_pct}%)` : ''}
                          </span>
                        </div>
                      </div>

                      <div className="card-actions-strip">
                        {onTickerSelect && (
                          <button
                            type="button"
                            className="card-action-btn primary"
                            onClick={() => onTickerSelect(card.ticker)}
                          >
                            <Search size={13} /> Deep Chart ${card.ticker}
                          </button>
                        )}
                        <button
                          type="button"
                          className="card-action-btn"
                          onClick={() => handleSend(`Check fundamental health and valuation for $${card.ticker}`)}
                        >
                          <TrendingUp size={13} /> Fundamentals
                        </button>
                        <button
                          type="button"
                          className="card-action-btn"
                          onClick={() => handleSend(`Generate institutional playbook for $${card.ticker}`)}
                        >
                          <Zap size={13} /> Playbook
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Contextual Suggested Questions Chips */}
                  {msg.suggested_prompts && msg.suggested_prompts.length > 0 && !isUser && (
                    <div className="bubble-suggested-prompts">
                      <span className="suggested-title">Next Insights:</span>
                      <div className="prompts-chips-row">
                        {msg.suggested_prompts.map((promptText, pIdx) => (
                          <button
                            key={pIdx}
                            type="button"
                            className="suggested-prompt-chip"
                            onClick={() => handleSend(promptText)}
                          >
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

          {/* Loading Indicator */}
          {isLoading && (
            <div className="chat-message-row assistant-row">
              <div className="message-avatar ai-avatar">
                <Bot size={18} color="#00F0FF" />
              </div>
              <div className="message-bubble ai-bubble loading-bubble">
                <div className="loading-dots-container">
                  <span className="loading-dot"></span>
                  <span className="loading-dot"></span>
                  <span className="loading-dot"></span>
                </div>
                <span className="loading-caption">Synthesizing institutional telemetry...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 3. SUGGESTION DOCK & INPUT COMPOSER                                */}
      {/* ------------------------------------------------------------------ */}
      <div className="ask-ai-bottom-dock">
        
        {/* Quick Suggestion Chips */}
        <div className="dock-chips-carousel">
          {quickPrompts.slice(0, 4).map((p, idx) => (
            <button
              key={idx}
              type="button"
              className="quick-chip-btn"
              onClick={() => handleSend(p)}
              disabled={isLoading}
            >
              <span>{p}</span>
              <ChevronRight size={12} className="chip-icon" />
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <form className="ask-ai-input-form" onSubmit={(e) => { e.preventDefault(); handleSend(); }}>
          <div className="input-wrapper">
            <input
              type="text"
              placeholder={`Ask the ${activePersonaObj.label} about any ticker, Greek exposure, setup, or macro event...`}
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              disabled={isLoading}
            />
            <button
              type="submit"
              className="btn-send-ai"
              disabled={isLoading || !inputVal.trim()}
              title="Send prompt (Enter)"
            >
              {isLoading ? (
                <RefreshCw size={16} className="spin" color="#00F0FF" />
              ) : (
                <>
                  <span>Send</span>
                  <Send size={15} />
                </>
              )}
            </button>
          </div>
        </form>

        <div className="dock-footnote">
          <span>⚡ Real-time quantitative telemetry powered by GEX Profiler & Autonomous AI Council</span>
        </div>

      </div>

    </div>
  );
}
