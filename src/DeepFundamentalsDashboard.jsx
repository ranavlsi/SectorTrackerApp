import React, { useState, useEffect, useMemo } from 'react';
import {
  Search, ShieldCheck, Activity, Layers, Award, FileText,
  Gauge, Sliders, BarChart2, TrendingUp, AlertTriangle,
  CheckCircle2, ExternalLink, Compass, Target, Sparkles,
  Briefcase, ChevronRight, ChevronDown, ChevronUp, BrainCircuit,
  ArrowUpRight, ArrowDownRight, Scale
} from 'lucide-react';
import './DeepFundamentals.css';

import CockpitOverviewView from './components/deep_fundamentals/CockpitOverviewView';
import ExecutiveMoatView from './components/deep_fundamentals/ExecutiveMoatView';
import EarningsDeconstructorView from './components/deep_fundamentals/EarningsDeconstructorView';
import DynamicValuationView from './components/deep_fundamentals/DynamicValuationView';
import StatementDuPontView from './components/deep_fundamentals/StatementDuPontView';
import ForensicHealthView from './components/deep_fundamentals/ForensicHealthView';
import CapitalAllocationView from './components/deep_fundamentals/CapitalAllocationView';
import PlainEnglishExplainer from './components/deep_fundamentals/PlainEnglishExplainer';
import DeepBriefDocumentView from './components/deep_fundamentals/DeepBriefDocumentView';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:5000';

const QUICK_TICKERS = ['NVDA', 'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'TSLA', 'AMD'];

const TABS = [
  { id: 'overview', label: 'Cockpit Overview', icon: Gauge },
  { id: 'valuation', label: 'Dynamic Valuation', icon: Sliders },
  { id: 'earnings', label: 'Earnings Teardown', icon: BarChart2 },
  { id: 'statements', label: 'Financial Anatomy', icon: Layers },
  { id: 'forensics', label: 'Forensic Health', icon: ShieldCheck },
  { id: 'capital', label: 'Capital Allocation', icon: Activity },
  { id: 'moat', label: 'Moat & Catalysts', icon: Award },
  { id: 'deep_brief', label: 'Desk Deep-Brief v2', icon: FileText },
  { id: 'peers_sec', label: 'Peers & SEC Filings', icon: Scale },
];

function parseNumericMultiple(val) {
  if (val === null || val === undefined) return null;
  const num = parseFloat(String(val).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(num) && num > 0 ? num : null;
}

function ConvictionRing({ score = 0, recommendation = 'HOLD' }) {
  const clamped = Math.max(0, Math.min(100, Number(score) || 0));
  const radius = 23;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  const color =
    clamped >= 75 ? '#00E676' :
    clamped >= 55 ? '#00F0FF' :
    clamped >= 40 ? '#fbbf24' : '#f43f5e';

  return (
    <div className="df2-conviction-badge">
      <div style={{ position: 'relative', width: '56px', height: '56px', flexShrink: 0 }}>
        <svg width="56" height="56" viewBox="0 0 56 56" style={{ transform: 'rotate(-90deg)' }}>
          <circle
            cx="28"
            cy="28"
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="5"
          />
          <circle
            cx="28"
            cy="28"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.5s ease' }}
          />
        </svg>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          <span style={{ fontSize: '14px', fontWeight: 900, color: '#fff', lineHeight: 1 }}>
            {Math.round(clamped)}
          </span>
          <span style={{ fontSize: '8px', color: '#64748b', fontWeight: 700 }}>/100</span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <span style={{ fontSize: '9px', fontFamily: 'monospace', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
          Quant Rating
        </span>
        <span
          style={{
            fontSize: '12px',
            fontFamily: "'JetBrains Mono', monospace",
            fontWeight: 900,
            color,
            letterSpacing: '0.4px',
          }}
        >
          {recommendation}
        </span>
      </div>
    </div>
  );
}

function PriceExecutionLadder({ entryPricing, currentPrice, discountPct }) {
  if (!entryPricing) return null;

  const stop = Number(entryPricing.stop_loss) || 0;
  const ideal = Number(entryPricing.ideal_entry) || 0;
  const spot = Number(entryPricing.current_price || currentPrice) || 0;
  const target1 = Number(entryPricing.target_conservative) || 0;
  const target2 = Number(entryPricing.target_bull) || 0;

  const validPoints = [stop, ideal, spot, target1, target2].filter((v) => v > 0);
  if (validPoints.length < 2) return null;

  const minVal = Math.min(...validPoints) * 0.94;
  const maxVal = Math.max(...validPoints) * 1.04;
  const span = Math.max(1, maxVal - minVal);
  const pctOf = (v) => Math.max(3, Math.min(97, ((v - minVal) / span) * 100));

  const markers = [
    { key: 'stop', label: 'STOP', price: stop, color: '#f43f5e', pos: pctOf(stop), top: true },
    { key: 'ideal', label: 'ENTRY', price: ideal, color: '#00E676', pos: pctOf(ideal), top: false },
    { key: 'spot', label: 'SPOT', price: spot, color: '#ffffff', pos: pctOf(spot), top: true },
    { key: 't1', label: 'DCF', price: target1, color: '#00F0FF', pos: pctOf(target1), top: false },
    { key: 't2', label: 'BULL', price: target2, color: '#c084fc', pos: pctOf(target2), top: true },
  ].filter((m) => m.price > 0);

  return (
    <div className="df2-ladder-wrap">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Target size={15} style={{ color: '#00E676' }} />
          <span style={{ fontSize: '12px', fontFamily: "'JetBrains Mono', monospace", fontWeight: 800, color: '#f8fafc' }}>
            Valuation & Execution Price Ladder
          </span>
          <span
            className="df2-pill"
            style={{ background: 'rgba(0, 230, 118, 0.14)', color: '#00E676', border: '1px solid rgba(0, 230, 118, 0.35)' }}
          >
            R:R {entryPricing.risk_reward || 'N/A'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', fontSize: '11px', fontFamily: 'monospace' }}>
          <span style={{ color: '#94a3b8' }}>
            Accum Zone: <strong style={{ color: '#00F0FF' }}>{entryPricing.accumulation_zone}</strong>
          </span>
          <span style={{ color: '#94a3b8' }}>
            DCF Upside: <strong style={{ color: Number(entryPricing.upside_pct) >= 0 ? '#00E676' : '#f43f5e' }}>
              {Number(entryPricing.upside_pct) >= 0 ? '+' : ''}{entryPricing.upside_pct}%
            </strong>
          </span>
          <span style={{ color: '#94a3b8' }}>
            Bull Target: <strong style={{ color: '#c084fc' }}>+{entryPricing.bull_upside_pct}%</strong>
          </span>
        </div>
      </div>

      <div className="df2-ladder-track">
        {markers.map((m) => (
          <div key={m.key} className="df2-ladder-marker" style={{ left: `${m.pos}%` }}>
            {m.top ? (
              <span className="df2-ladder-label-top" style={{ color: m.color }}>
                {m.label} ${m.price.toFixed(0)}
              </span>
            ) : (
              <span className="df2-ladder-label-bot" style={{ color: m.color }}>
                {m.label} ${m.price.toFixed(0)}
              </span>
            )}
            <div
              className="df2-ladder-dot"
              style={{
                background: m.color,
                boxShadow: `0 0 10px ${m.color}`,
              }}
            />
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', fontSize: '11px', color: '#94a3b8' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Briefcase size={13} style={{ color: '#00F0FF', flexShrink: 0 }} />
          <span><strong style={{ color: '#e2e8f0' }}>Allocation:</strong> {entryPricing.allocation_strategy}</span>
        </div>
        {entryPricing.entry_rationale && (
          <span style={{ color: '#cbd5e1' }}>
            <strong style={{ color: '#00E676' }}>Execution Note:</strong> {entryPricing.entry_rationale}
          </span>
        )}
      </div>
    </div>
  );
}

export default function DeepFundamentalsDashboard({ currentTicker = 'NVDA' }) {
  const [selectedTicker, setSelectedTicker] = useState(currentTicker || 'NVDA');
  const [inputTicker, setInputTicker] = useState(currentTicker || 'NVDA');
  const [activeTab, setActiveTab] = useState('overview');
  const [showAiBrief, setShowAiBrief] = useState(true);
  const [secFilter, setSecFilter] = useState('ALL');
  const [secSearchQuery, setSecSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const [data, setData] = useState({
    fundamentals: null,
    secFilings: null,
    peerValuation: null,
    macroOutlook: null,
  });

  useEffect(() => {
    if (currentTicker && currentTicker.toUpperCase() !== selectedTicker) {
      const upper = currentTicker.toUpperCase();
      setSelectedTicker(upper);
      setInputTicker(upper);
    }
  }, [currentTicker]);

  useEffect(() => {
    let isMounted = true;
    const fetchAll = async () => {
      setLoading(true);
      setErrorMsg('');
      try {
        const [fundRes, secRes, peerRes, macroRes] = await Promise.all([
          fetch(`${API_BASE}/api/deep_fundamentals?ticker=${selectedTicker}`).then((r) => r.json()),
          fetch(`${API_BASE}/api/sec_filings?ticker=${selectedTicker}`).then((r) => r.json()).catch(() => null),
          fetch(`${API_BASE}/api/peer_valuation?ticker=${selectedTicker}`).then((r) => r.json()).catch(() => null),
          fetch(`${API_BASE}/api/macro_outlook?ticker=${selectedTicker}`).then((r) => r.json()).catch(() => null),
        ]);

        if (!isMounted) return;
        setData({
          fundamentals: fundRes?.error ? null : fundRes,
          secFilings: secRes?.error ? null : secRes,
          peerValuation: peerRes?.error ? null : peerRes,
          macroOutlook: macroRes?.error ? null : macroRes,
        });
        if (fundRes?.error) {
          setErrorMsg(fundRes.error);
        }
      } catch (err) {
        if (isMounted) setErrorMsg(err?.message || 'Failed to load fundamental telemetry.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchAll();
    return () => {
      isMounted = false;
    };
  }, [selectedTicker]);

  const selectNewTicker = (tickerStr) => {
    const clean = (tickerStr || '').trim().toUpperCase();
    if (!clean) return;
    setSelectedTicker(clean);
    setInputTicker(clean);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    selectNewTicker(inputTicker);
  };

  const { fundamentals, secFilings, peerValuation, macroOutlook } = data;
  const profile = fundamentals?.profile || {};
  const fairValueData = fundamentals?.fair_value_data || {};
  const currentPrice = Number(fairValueData.current_price || profile.current_price || 0);
  const fairValue = Number(fairValueData.fair_value || 0);
  const discountPct =
    fairValue > 0 && currentPrice > 0
      ? ((fairValue - currentPrice) / currentPrice) * 100
      : Number(fairValueData.discount_pct || 0);

  const ai = fundamentals?.ai_synthesis || null;
  const score = Number(ai?.conviction_score ?? fundamentals?.scorecard?.overall_score ?? 0);
  const recommendation = ai?.recommendation || (score >= 75 ? 'STRONG BUY' : score >= 55 ? 'ACCUMULATE' : 'HOLD');

  const piotroskiScore = fundamentals?.forensic_dupont?.piotroski?.score ?? '—';
  const altmanScore = fundamentals?.forensic_dupont?.altman_z?.score;
  const altmanZone = fundamentals?.forensic_dupont?.altman_z?.zone || 'N/A';
  const surpriseStreak = fundamentals?.earnings_deconstruction?.surprise_streak || {};
  const beatStreak = surpriseStreak.current_beat_streak ?? fundamentals?.earnings_deconstruction?.beat_streak ?? 0;
  const beatWinRate = surpriseStreak.beat_win_rate_pct;
  const totalQuartersTracked = surpriseStreak.total_quarters_tracked;
  const moatType = fundamentals?.moat_catalyst?.moat_rating || 'Narrow Moat';
  const moatScore = fundamentals?.moat_catalyst?.moat_score ?? '—';

  const bestPeerMultiples = useMemo(() => {
    const rows = peerValuation?.valuation || [];
    const fwdPEs = rows.map((r) => parseNumericMultiple(r['Forward P/E'])).filter(Boolean);
    const evEbitdas = rows.map((r) => parseNumericMultiple(r['EV/EBITDA'])).filter(Boolean);
    return {
      minFwdPE: fwdPEs.length ? Math.min(...fwdPEs) : null,
      minEvEbitda: evEbitdas.length ? Math.min(...evEbitdas) : null,
    };
  }, [peerValuation]);

  const mosColor = discountPct >= 10 ? '#00E676' : discountPct >= -5 ? '#00F0FF' : '#f43f5e';
  const mosLabel =
    discountPct >= 10
      ? `+${discountPct.toFixed(1)}% Undervalued`
      : discountPct >= -5
        ? `${discountPct >= 0 ? '+' : ''}${discountPct.toFixed(1)}% Fair Value`
        : `${discountPct.toFixed(1)}% Premium`;

  const shouldRenderBrief = Boolean(ai) && (showAiBrief || activeTab === 'overview');

  return (
    <div className="fund-root">
      {/* ===================================================================== */}
      {/* 1. UNIFIED INSTITUTIONAL COMMAND HEADER + CONVICTION RING + VITALS    */}
      {/* ===================================================================== */}
      <div className="df2-command-shell">
        <div className="df2-command-glow" />

        <div className="df2-header-main">
          {/* Left: Identity + Price + Margin of Safety */}
          <div className="df2-identity-cluster">
            <div className="df2-ticker-avatar">{selectedTicker}</div>
            <div>
              <div className="df2-title-row">
                <h1 className="df2-ticker-name">{selectedTicker}</h1>
                {currentPrice > 0 && (
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '1.15rem', fontWeight: 800, color: '#e2e8f0' }}>
                    ${currentPrice.toFixed(2)}
                  </span>
                )}
                {fairValue > 0 && (
                  <span
                    className="df2-pill"
                    style={{
                      background: `${mosColor}1a`,
                      color: mosColor,
                      border: `1px solid ${mosColor}55`,
                    }}
                  >
                    {discountPct >= 0 ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
                    {mosLabel}
                  </span>
                )}
              </div>

              <div className="df2-company-sub">
                <span style={{ color: '#e2e8f0', fontWeight: 600 }}>
                  {profile.company_name || `${selectedTicker} Institutional Dossier`}
                </span>
                {profile.sector && (
                  <span className="df2-pill" style={{ background: 'rgba(148,163,184,0.12)', color: '#cbd5e1', border: '1px solid rgba(148,163,184,0.2)' }}>
                    {profile.sector}
                  </span>
                )}
                {profile.industry && (
                  <span style={{ color: '#64748b', fontSize: '11px' }}>· {profile.industry}</span>
                )}
              </div>
            </div>
          </div>

          {/* Right: Quick Tickers + Search + Conviction Ring */}
          <div className="df2-controls-cluster">
            <div className="df2-quick-strip">
              {QUICK_TICKERS.map((tk) => (
                <button
                  key={tk}
                  type="button"
                  onClick={() => selectNewTicker(tk)}
                  className={`df2-quick-btn ${selectedTicker === tk ? 'active' : ''}`}
                >
                  {tk}
                </button>
              ))}
            </div>

            <form onSubmit={handleSearch} className="df2-search-form">
              <Search size={13} style={{ color: '#64748b' }} />
              <input
                type="text"
                value={inputTicker}
                onChange={(e) => setInputTicker(e.target.value.toUpperCase())}
                placeholder="TICKER"
                className="df2-search-input"
              />
              <button type="submit" className="df2-search-btn">
                ANALYZE
              </button>
            </form>

            {ai && <ConvictionRing score={score} recommendation={recommendation} />}
          </div>
        </div>

        {/* 6-Metric Vitals Ribbon */}
        <div className="df2-vitals-grid">
          <div className="df2-vital-cell">
            <div className="df2-vital-label">
              <span>Market Cap</span>
              <span style={{ color: '#00F0FF' }}>SIZE</span>
            </div>
            <div className="df2-vital-val">{profile.market_cap_fmt || profile.market_cap || '—'}</div>
            <div className="df2-vital-sub">{profile.exchange || 'US Equity'}</div>
          </div>

          <div className="df2-vital-cell">
            <div className="df2-vital-label">
              <span>DCF Intrinsic Value</span>
              <span style={{ color: mosColor }}>TARGET</span>
            </div>
            <div className="df2-vital-val" style={{ color: mosColor }}>
              {fairValue > 0 ? `$${fairValue.toFixed(2)}` : '—'}
            </div>
            <div className="df2-vital-sub">{mosLabel}</div>
          </div>

          <div className="df2-vital-cell">
            <div className="df2-vital-label">
              <span>Piotroski F-Score</span>
              <span style={{ color: Number(piotroskiScore) >= 7 ? '#00E676' : '#fbbf24' }}>QUALITY</span>
            </div>
            <div className="df2-vital-val">
              {piotroskiScore !== '—' ? `${piotroskiScore} / 9` : '—'}
            </div>
            <div className="df2-vital-sub">
              {Number(piotroskiScore) >= 7 ? 'Institutional Grade' : Number(piotroskiScore) >= 4 ? 'Neutral Core' : 'Weak Fundamentals'}
            </div>
          </div>

          <div className="df2-vital-cell">
            <div className="df2-vital-label">
              <span>Altman Z-Score</span>
              <span style={{ color: Number(altmanScore) >= 3 ? '#00E676' : '#fbbf24' }}>SOLVENCY</span>
            </div>
            <div className="df2-vital-val">
              {altmanScore !== undefined && altmanScore !== null ? Number(altmanScore).toFixed(2) : '—'}
            </div>
            <div className="df2-vital-sub">{altmanZone}</div>
          </div>

          <div className="df2-vital-cell">
            <div className="df2-vital-label">
              <span>EPS Beat Streak</span>
              <span style={{ color: '#00F0FF' }}>EXECUTION</span>
            </div>
            <div className="df2-vital-val">{beatStreak} Qtrs</div>
            <div className="df2-vital-sub">
              {beatWinRate != null && totalQuartersTracked
                ? `${beatWinRate}% Win Rate (${totalQuartersTracked}Q)`
                : 'Consecutive Beats'}
            </div>
          </div>

          <div className="df2-vital-cell">
            <div className="df2-vital-label">
              <span>Economic Moat</span>
              <span style={{ color: '#c084fc' }}>DURABILITY</span>
            </div>
            <div className="df2-vital-val" style={{ fontSize: '0.95rem' }}>{moatType}</div>
            <div className="df2-vital-sub">Moat Index: {moatScore}/100</div>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 2. ABOVE-THE-FOLD PILL NAVIGATION DOCK + AI BRIEF TOGGLE              */}
      {/* ===================================================================== */}
      <div className="df2-nav-dock">
        <div className="df2-tabs-scroll">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`df2-tab-pill ${isActive ? 'active' : ''}`}
              >
                <Icon size={14} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {ai && activeTab !== 'overview' && (
          <button
            type="button"
            onClick={() => setShowAiBrief((v) => !v)}
            className={`df2-ai-toggle-btn ${showAiBrief ? 'open' : ''}`}
          >
            <BrainCircuit size={14} />
            <span>AI Thesis & Ladder</span>
            {showAiBrief ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        )}
      </div>

      {/* ===================================================================== */}
      {/* 3. AI EXECUTIVE SYNTHESIS + PRICE EXECUTION LADDER                    */}
      {/* ===================================================================== */}
      {!loading && shouldRenderBrief && (
        <div className="df2-brief-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 520px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <Sparkles size={14} style={{ color: '#c084fc' }} />
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', fontWeight: 800, color: '#c084fc', letterSpacing: '0.5px' }}>
                  INSTITUTIONAL AI RESEARCH SYNTHESIS
                </span>
              </div>
              <h3 style={{ margin: '0 0 6px 0', fontSize: '1.05rem', fontWeight: 800, color: '#ffffff' }}>
                {ai.headline || `${selectedTicker} Fundamental Verdict: ${recommendation}`}
              </h3>
              <p style={{ margin: 0, fontSize: '0.84rem', color: '#cbd5e1', lineHeight: 1.55 }}>
                {ai.executive_summary}
              </p>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setActiveTab('valuation')}
                className="fund-entry-tab-link"
              >
                <span>DCF Sliders</span>
                <ChevronRight size={13} />
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('forensics')}
                className="fund-entry-tab-link secondary"
              >
                <span>Solvency Audit</span>
                <ChevronRight size={13} />
              </button>
            </div>
          </div>

          <PriceExecutionLadder
            entryPricing={ai.entry_pricing}
            currentPrice={currentPrice}
            discountPct={discountPct}
          />

          {Array.isArray(ai.pillars) && ai.pillars.length > 0 && (
            <div className="df2-pillars-grid">
              {ai.pillars.map((pillar, idx) => {
                const statusColor =
                  pillar.status === 'BULLISH' || pillar.status === 'STRONG'
                    ? '#00E676'
                    : pillar.status === 'NEUTRAL'
                      ? '#00F0FF'
                      : '#fbbf24';
                return (
                  <div key={idx} className="df2-pillar-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', fontFamily: "'JetBrains Mono', monospace", fontWeight: 800, color: '#f1f5f9' }}>
                        {pillar.name}
                      </span>
                      <span
                        className="df2-pill"
                        style={{
                          background: `${statusColor}18`,
                          color: statusColor,
                          border: `1px solid ${statusColor}44`,
                        }}
                      >
                        {pillar.status}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: '11.5px', color: '#94a3b8', lineHeight: 1.45 }}>
                      {pillar.summary}
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          {ai.tail_risk_warning && (
            <div className="fund-risk-directive-strip" style={{ marginTop: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={14} style={{ color: '#fbbf24', flexShrink: 0 }} />
                <span style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'monospace' }}>
                  <strong style={{ color: '#e2e8f0' }}>Risk Directive:</strong> {ai.tail_risk_warning}
                </span>
              </div>
              <span style={{ fontSize: '10px', color: '#64748b', fontFamily: 'monospace' }}>
                REVISE ON EARNINGS INFLECTION · DYNAMIC HEDGE ACTIVE
              </span>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* 4. ACTIVE VIEW WORKSPACE                                              */}
      {/* ===================================================================== */}
      {loading ? (
        <div
          style={{
            padding: '4rem 2rem',
            textAlign: 'center',
            color: '#94a3b8',
            background: 'linear-gradient(135deg, #0d121f 0%, #080c14 100%)',
            borderRadius: '16px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <Compass size={40} className="animate-spin" style={{ color: '#00F0FF', margin: '0 auto 1rem auto' }} />
          <h3 style={{ color: 'white', margin: '0 0 0.5rem 0', fontSize: '1.2rem', fontFamily: 'monospace' }}>
            Compiling Institutional Telemetry for {selectedTicker}...
          </h3>
          <p style={{ fontSize: '0.82rem', fontFamily: 'monospace', color: '#64748b' }}>
            Running Moat Pillars, DCF Sensitivities, DuPont 5-Way, and Capital Allocation engines.
          </p>
        </div>
      ) : errorMsg && !fundamentals ? (
        <div
          style={{
            padding: '2.5rem',
            textAlign: 'center',
            background: 'rgba(15, 23, 42, 0.85)',
            borderRadius: '16px',
            border: '1px solid rgba(244, 63, 94, 0.35)',
          }}
        >
          <AlertTriangle size={32} style={{ color: '#f43f5e', margin: '0 auto 10px auto' }} />
          <h3 style={{ color: '#fff', fontFamily: 'monospace', margin: '0 0 6px 0' }}>
            Unable to Load Telemetry for {selectedTicker}
          </h3>
          <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>{errorMsg}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Compact 1-click Plain English Explainer */}
          <PlainEnglishExplainer
            ticker={selectedTicker}
            profile={fundamentals?.profile}
            fundamentals={fundamentals}
            isExpandedDefault={false}
          />

          {activeTab === 'deep_brief' && <DeepBriefDocumentView ticker={selectedTicker} />}

          {activeTab === 'overview' && (
            <CockpitOverviewView
              ticker={selectedTicker}
              fundamentals={fundamentals}
              secFilings={secFilings}
              onNavigateTab={(tabId) => setActiveTab(tabId)}
            />
          )}

          {activeTab === 'valuation' && (
            <DynamicValuationView
              currentTicker={selectedTicker}
              valuationData={fundamentals?.dynamic_valuation}
              currentPrice={fundamentals?.fair_value_data?.current_price}
              fundamentals={fundamentals}
            />
          )}

          {activeTab === 'earnings' && (
            <EarningsDeconstructorView
              ticker={selectedTicker}
              teardownData={fundamentals?.earnings_deconstruction}
              historicalQuarters={fundamentals?.history}
              profile={fundamentals?.profile}
            />
          )}

          {activeTab === 'statements' && (
            <StatementDuPontView
              forensicData={fundamentals?.forensic_dupont}
              historicalQuarters={fundamentals?.history}
            />
          )}

          {activeTab === 'forensics' && (
            <ForensicHealthView
              forensicData={fundamentals?.forensic_dupont}
              profile={fundamentals?.profile}
            />
          )}

          {activeTab === 'capital' && (
            <CapitalAllocationView capitalData={fundamentals?.capital_allocation} />
          )}

          {activeTab === 'moat' && (
            <ExecutiveMoatView moatData={fundamentals?.moat_catalyst} />
          )}

          {activeTab === 'peers_sec' && (
            <div className="space-y-6">
              {/* 1. SECTOR PEER VALUATION MATRIX (Interactive Peer Switcher + Best-Multiple Highlights) */}
              {peerValuation?.valuation && (
                <div
                  style={{
                    background: 'linear-gradient(180deg, rgba(18, 24, 38, 0.95) 0%, rgba(10, 14, 23, 0.95) 100%)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                  }}
                  className="rounded-2xl p-5"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                    <h3 className="text-base font-mono font-bold text-white flex items-center gap-2">
                      <Layers className="w-4 h-4 text-emerald-400" /> Sector Peer Valuation Matrix
                    </h3>
                    <span className="text-[11px] font-mono text-slate-400">
                      Click any peer ticker to pivot dossier · Green = lowest sector multiple
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="text-slate-400 uppercase bg-slate-950/60 font-mono text-[11px]">
                        <tr>
                          <th className="p-3 rounded-l-lg font-sans">Ticker</th>
                          <th className="p-3">Market Cap</th>
                          <th className="p-3">EV / EBITDA</th>
                          <th className="p-3">Forward P/E</th>
                          <th className="p-3">Price / Sales</th>
                          <th className="p-3 rounded-r-lg">Price / Book</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono">
                        {peerValuation.valuation.map((peer, i) => {
                          const isCurrent = peer.Ticker === selectedTicker;
                          const evVal = parseNumericMultiple(peer['EV/EBITDA']);
                          const peVal = parseNumericMultiple(peer['Forward P/E']);
                          const isLowestEv = evVal !== null && bestPeerMultiples.minEvEbitda === evVal;
                          const isLowestPe = peVal !== null && bestPeerMultiples.minFwdPE === peVal;
                          return (
                            <tr
                              key={i}
                              className={`hover:bg-slate-800/30 transition-colors ${isCurrent ? 'bg-cyan-500/15' : ''}`}
                            >
                              <td className="p-3">
                                <button
                                  type="button"
                                  onClick={() => selectNewTicker(peer.Ticker)}
                                  className="df2-peer-chip-btn"
                                  style={
                                    isCurrent
                                      ? { borderColor: '#00F0FF', color: '#00F0FF', background: 'rgba(0,240,255,0.14)' }
                                      : undefined
                                  }
                                >
                                  {isCurrent && <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#00F0FF]" />}
                                  <span>{peer.Ticker}</span>
                                </button>
                              </td>
                              <td className="p-3 text-slate-300">{peer['Market Cap']}</td>
                              <td className="p-3" style={{ color: isLowestEv ? '#00E676' : '#cbd5e1', fontWeight: isLowestEv ? 800 : 500 }}>
                                {peer['EV/EBITDA']}
                              </td>
                              <td className="p-3" style={{ color: isLowestPe ? '#00E676' : '#cbd5e1', fontWeight: isLowestPe ? 800 : 500 }}>
                                {peer['Forward P/E']}
                              </td>
                              <td className="p-3 text-slate-300">{peer['Price/Sales']}</td>
                              <td className="p-3 text-slate-300">{peer['Price/Book']}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 2. SEC FILINGS & DISCLOSURE EXPLORER */}
              <div
                style={{
                  background: 'linear-gradient(180deg, rgba(18, 24, 38, 0.95) 0%, rgba(10, 14, 23, 0.95) 100%)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                }}
                className="rounded-2xl p-5 space-y-4"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-white/[0.08]">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="p-1.5 rounded-md bg-purple-500/15 text-purple-400 border border-purple-500/30">
                        <FileText size={18} />
                      </span>
                      <h3 className="text-base font-mono font-bold text-white flex items-center gap-2">
                        Official SEC EDGAR Filings & Disclosures
                      </h3>
                      <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono font-bold flex items-center gap-1">
                        <CheckCircle2 size={11} /> SEC Verified Live
                      </span>
                      {secFilings?.cik && (
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-white/[0.08] text-[10px] font-mono">
                          CIK: {secFilings.cik}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      Direct access to audited 10-K Annual Reports, 10-Q Quarterlies, and 8-K Material Event statements with interactive SEC iXBRL viewers
                    </p>
                  </div>

                  <a
                    href={secFilings?.sec_profile_url || `https://www.sec.gov/edgar/browse/?CIK=${selectedTicker}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#181E2B] text-cyan-400 border border-cyan-500/30 text-xs font-mono font-bold hover:bg-cyan-500/10 transition-all shadow-sm shrink-0"
                  >
                    <ExternalLink size={13} /> View on SEC.gov ↗
                  </a>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {[
                      { id: 'ALL', label: 'All Filings' },
                      { id: '10-K', label: '10-K (Annual)' },
                      { id: '10-Q', label: '10-Q (Quarterly)' },
                      { id: '8-K', label: '8-K (Events)' },
                    ].map((tab) => {
                      const count = secFilings?.filings
                        ? (tab.id === 'ALL'
                            ? secFilings.filings.length
                            : secFilings.filings.filter((f) => f.form.includes(tab.id)).length)
                        : 0;
                      const isActive = secFilter === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setSecFilter(tab.id)}
                          className={`px-3 py-1 rounded-md text-xs font-mono font-bold transition-all border ${
                            isActive
                              ? 'bg-purple-500/25 text-purple-200 border-purple-500/50 shadow-[0_0_10px_rgba(168,85,247,0.25)]'
                              : 'bg-[#0B0E14] text-slate-400 border-white/[0.06] hover:text-white'
                          }`}
                        >
                          {tab.label} {count > 0 && <span className="text-[10px] opacity-75 font-normal">({count})</span>}
                        </button>
                      );
                    })}
                  </div>

                  <div className="relative w-full sm:w-64">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Search disclosures, forms..."
                      value={secSearchQuery}
                      onChange={(e) => setSecSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1 bg-[#0B0E14] border border-white/[0.08] rounded-md text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
                    />
                  </div>
                </div>

                {(() => {
                  const allFilings = secFilings?.filings || [];
                  const filtered = allFilings.filter((f) => {
                    const matchCategory = secFilter === 'ALL' || f.form.includes(secFilter);
                    const matchQuery =
                      !secSearchQuery ||
                      f.form.toLowerCase().includes(secSearchQuery.toLowerCase()) ||
                      (f.description && f.description.toLowerCase().includes(secSearchQuery.toLowerCase())) ||
                      (f.summary && f.summary.toLowerCase().includes(secSearchQuery.toLowerCase())) ||
                      (f.date && f.date.includes(secSearchQuery));
                    return matchCategory && matchQuery;
                  });

                  if (filtered.length === 0) {
                    return (
                      <div className="p-8 text-center font-mono text-xs text-slate-500 bg-[#0B0E14] rounded-lg border border-white/[0.06]">
                        No SEC filings matching current filter criteria.
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-2.5">
                      {filtered.map((filing, idx) => {
                        const is10K = filing.form.includes('10-K');
                        const is10Q = filing.form.includes('10-Q');

                        const badgeClass = is10K
                          ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                          : is10Q
                            ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                            : 'bg-amber-500/20 text-amber-300 border-amber-500/40';

                        return (
                          <div
                            key={filing.accession_no || idx}
                            className="bg-[#0B0E14] p-4 rounded-xl border border-white/[0.06] hover:border-white/[0.14] transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                          >
                            <div className="space-y-1.5 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={`px-2.5 py-0.5 rounded font-mono font-bold text-xs border ${badgeClass}`}>
                                  {filing.form}
                                </span>
                                <span className="text-white font-mono text-xs font-bold">
                                  {filing.description || `Form ${filing.form}`}
                                </span>
                                <span className="text-slate-500 font-mono text-[11px]">·</span>
                                <span className="text-slate-400 font-mono text-xs">
                                  Filed: <strong className="text-slate-200">{filing.date}</strong>
                                </span>
                                {filing.report_date && filing.report_date !== filing.date && (
                                  <>
                                    <span className="text-slate-500 font-mono text-[11px]">·</span>
                                    <span className="text-slate-400 font-mono text-xs">
                                      Period Ended: <strong className="text-slate-200">{filing.report_date}</strong>
                                    </span>
                                  </>
                                )}
                              </div>

                              <p className="text-xs text-slate-300 font-sans leading-relaxed">{filing.summary}</p>

                              {filing.accession_no && (
                                <div className="text-[10px] font-mono text-slate-500">
                                  Accession No: {filing.accession_no}
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {filing.viewer_url && (
                                <a
                                  href={filing.viewer_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 px-3 py-1.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 text-xs font-mono font-bold hover:bg-cyan-500/20 transition-all"
                                >
                                  <ExternalLink size={12} /> Interactive iXBRL ↗
                                </a>
                              )}
                              {filing.document_url && (
                                <a
                                  href={filing.document_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 px-3 py-1.5 rounded bg-slate-800 text-slate-300 border border-white/[0.08] text-xs font-mono hover:text-white hover:bg-slate-700 transition-all"
                                >
                                  <FileText size={12} /> Raw Doc ↗
                                </a>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              {/* 3. MACRO ECONOMIC CLIMATE & SECTOR SENSITIVITY */}
              {macroOutlook?.outlook && (
                <div
                  style={{
                    background: 'linear-gradient(180deg, rgba(18, 24, 38, 0.95) 0%, rgba(10, 14, 23, 0.95) 100%)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                  }}
                  className="rounded-2xl p-5 space-y-3"
                >
                  <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        <TrendingUp size={18} />
                      </span>
                      <h3 className="text-base font-mono font-bold text-white">
                        Macro Economic Outlook & Sector Sensitivity ({macroOutlook.sector || 'General'})
                      </h3>
                    </div>
                    <span className="text-xs font-mono text-slate-400">
                      Industry: {macroOutlook.industry || 'Diversified'}
                    </span>
                  </div>

                  <div className="bg-[#0B0E14] p-4 rounded-xl border border-white/[0.06] text-xs text-slate-300 font-sans leading-relaxed whitespace-pre-line">
                    {macroOutlook.outlook}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
