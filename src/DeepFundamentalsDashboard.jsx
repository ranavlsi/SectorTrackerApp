import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  AlertTriangle,
  Briefcase,
  FileText,
  Activity,
  Layers,
  DollarSign,
  PieChart,
  ShieldCheck,
  BarChart2,
  Target,
  Search,
  RefreshCw,
  Sparkles,
  Scale,
  Sliders,
  Award,
  ExternalLink,
  Compass,
  Gauge,
  Flame
} from 'lucide-react';

import CockpitOverviewView from './components/deep_fundamentals/CockpitOverviewView';
import ExecutiveMoatView from './components/deep_fundamentals/ExecutiveMoatView';
import EarningsDeconstructorView from './components/deep_fundamentals/EarningsDeconstructorView';
import DynamicValuationView from './components/deep_fundamentals/DynamicValuationView';
import StatementDuPontView from './components/deep_fundamentals/StatementDuPontView';
import ForensicHealthView from './components/deep_fundamentals/ForensicHealthView';
import CapitalAllocationView from './components/deep_fundamentals/CapitalAllocationView';
import PlainEnglishExplainer from './components/deep_fundamentals/PlainEnglishExplainer';
import DeepBriefDocumentView from './components/deep_fundamentals/DeepBriefDocumentView';

export default function DeepFundamentalsDashboard({ currentTicker = 'NVDA' }) {
  const [selectedTicker, setSelectedTicker] = useState(currentTicker || 'NVDA');
  const [inputTicker, setInputTicker] = useState('');
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'valuation' | 'earnings' | 'statements' | 'forensics' | 'capital' | 'moat' | 'peers_sec'

  const [data, setData] = useState({
    fundamentals: null,
    secFilings: null,
    peerValuation: null,
    macroOutlook: null
  });
  const [loading, setLoading] = useState(true);

  // Sync with prop if changed externally
  useEffect(() => {
    if (currentTicker && currentTicker !== selectedTicker) {
      setSelectedTicker(currentTicker);
    }
  }, [currentTicker]);

  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true);
      try {
        const [fundRes, secRes, peerRes, macroRes] = await Promise.all([
          fetch(`/api/deep_fundamentals?ticker=${selectedTicker}`),
          fetch(`/api/sec_filings?ticker=${selectedTicker}`),
          fetch(`/api/peer_valuation?ticker=${selectedTicker}`),
          fetch(`/api/macro_outlook?ticker=${selectedTicker}`)
        ]);

        setData({
          fundamentals: await fundRes.json(),
          secFilings: await secRes.json(),
          peerValuation: await peerRes.json(),
          macroOutlook: await macroRes.json()
        });
      } catch (err) {
        console.error("Error fetching institutional deep fundamentals:", err);
      } finally {
        setLoading(false);
      }
    };

    if (selectedTicker) fetchAllData();
  }, [selectedTicker]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (inputTicker.trim()) {
      setSelectedTicker(inputTicker.trim().toUpperCase());
      setInputTicker('');
    }
  };

  const quickTickers = ['NVDA', 'AAPL', 'MSFT', 'AMZN', 'GOOGL', 'META', 'TSLA'];
  const { fundamentals, secFilings, peerValuation, macroOutlook } = data;

  const tabs = [
    { id: 'deep_brief', label: '📄 Desk Deep-Brief v2', icon: FileText },
    { id: 'overview', label: 'Cockpit Overview', icon: Gauge },
    { id: 'valuation', label: 'Dynamic Valuation', icon: Sliders },
    { id: 'earnings', label: 'Earnings Teardown', icon: BarChart2 },
    { id: 'statements', label: 'Financial Anatomy', icon: Layers },
    { id: 'forensics', label: 'Forensic Health', icon: ShieldCheck },
    { id: 'capital', label: 'Capital Allocation', icon: Activity },
    { id: 'moat', label: 'Moat & Catalysts', icon: Award },
    { id: 'peers_sec', label: 'Peers & SEC Filings', icon: FileText },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      
      {/* 1. MASTER TERMINAL COMMAND BANNER */}
      <div
        className="glass-card"
        style={{
          padding: '1.5rem 2rem',
          background: 'linear-gradient(135deg, rgba(15,23,42,0.95) 0%, rgba(6,182,212,0.12) 100%)',
          borderLeft: '5px solid #06b6d4',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem' }}>
          
          {/* Left: Ticker & Brand Identity */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div
              style={{
                background: 'rgba(6, 182, 212, 0.2)',
                padding: '0.65rem',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid rgba(6, 182, 212, 0.4)',
                width: '54px',
                height: '54px',
                boxShadow: '0 0 15px rgba(6, 182, 212, 0.2)'
              }}
            >
              {fundamentals?.logo_url ? (
                <img
                  src={fundamentals.logo_url}
                  alt={selectedTicker}
                  style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }}
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              ) : (
                <span style={{ fontSize: '1.4rem', fontWeight: '900', color: '#22d3ee' }}>
                  {selectedTicker}
                </span>
              )}
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <h1 style={{ margin: 0, fontSize: '1.9rem', color: 'white', fontWeight: '800', letterSpacing: '-0.5px' }}>
                  {selectedTicker}
                </h1>
                <span
                  style={{
                    background: 'rgba(6, 182, 212, 0.15)',
                    border: '1px solid rgba(6, 182, 212, 0.3)',
                    color: '#22d3ee',
                    padding: '0.15rem 0.6rem',
                    borderRadius: '9999px',
                    fontSize: '0.72rem',
                    fontWeight: '700',
                    textTransform: 'uppercase'
                  }}
                >
                  {fundamentals?.sector || 'Institutional Coverage'}
                </span>
                {fundamentals?.website && (
                  <a
                    href={fundamentals.website}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: '#64748b' }}
                    title="Official Investor Relations"
                  >
                    <ExternalLink size={14} />
                  </a>
                )}
              </div>
              <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                Institutional Fundamental Research Terminal • {fundamentals?.industry || 'Multi-Engine Synthesis'}
              </span>
            </div>
          </div>

          {/* Right: Quick Ticker Switcher & Search */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '0.35rem', background: 'rgba(0,0,0,0.3)', padding: '0.3rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
              {quickTickers.map((t) => (
                <button
                  key={t}
                  onClick={() => setSelectedTicker(t)}
                  style={{
                    padding: '0.35rem 0.65rem',
                    borderRadius: '6px',
                    fontSize: '0.78rem',
                    fontWeight: '800',
                    cursor: 'pointer',
                    background: selectedTicker === t ? '#06b6d4' : 'transparent',
                    color: selectedTicker === t ? '#090d16' : '#94a3b8',
                    border: 'none',
                    transition: 'all 0.2s',
                    boxShadow: selectedTicker === t ? '0 0 10px rgba(6, 182, 212, 0.4)' : 'none'
                  }}
                >
                  {t}
                </button>
              ))}
            </div>

            <form onSubmit={handleSearch} style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
              <input
                type="text"
                placeholder="Symbol..."
                value={inputTicker}
                onChange={(e) => setInputTicker(e.target.value)}
                style={{
                  background: 'rgba(0,0,0,0.4)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '6px',
                  padding: '0.45rem 0.75rem 0.45rem 2rem',
                  fontSize: '0.8rem',
                  color: 'white',
                  width: '110px',
                  fontFamily: 'monospace',
                  textTransform: 'uppercase',
                  outline: 'none'
                }}
              />
            </form>
          </div>

        </div>

        {/* TOP QUICK STAT STRIP */}
        {fundamentals && !loading && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
              gap: '0.75rem',
              marginTop: '1.25rem',
              paddingTop: '1rem',
              borderTop: '1px solid rgba(255,255,255,0.06)'
            }}
          >
            {/* Conviction */}
            <div style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.08)', padding: '0.5rem 0.8rem', borderRadius: '8px', textAlign: 'center' }}>
              <span style={{ fontSize: '0.68rem', color: '#94a3b8', display: 'block', textTransform: 'uppercase', fontFamily: 'monospace' }}>Conviction</span>
              <strong style={{ color: '#00F0FF', fontSize: '1.1rem', fontFamily: 'monospace' }}>{fundamentals.score ?? 88}/100</strong>
            </div>

            {/* Rating */}
            <div style={{ background: 'rgba(0, 230, 118, 0.1)', border: '1px solid rgba(0, 230, 118, 0.25)', padding: '0.5rem 0.8rem', borderRadius: '8px', textAlign: 'center' }}>
              <span style={{ fontSize: '0.68rem', color: '#6ee7b7', display: 'block', textTransform: 'uppercase', fontFamily: 'monospace' }}>Rating</span>
              <strong style={{ color: '#00E676', fontSize: '0.95rem' }}>{fundamentals.recommendation || 'Strong Buy'}</strong>
            </div>

            {/* DCF Fair Value */}
            <div style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.08)', padding: '0.5rem 0.8rem', borderRadius: '8px', textAlign: 'center' }}>
              <span style={{ fontSize: '0.68rem', color: '#94a3b8', display: 'block', textTransform: 'uppercase', fontFamily: 'monospace' }}>DCF Fair Value</span>
              <strong style={{ color: 'white', fontSize: '1rem', fontFamily: 'monospace' }}>
                ${fundamentals.fair_value_data?.fair_value?.toFixed(2) || '---'}
                <span style={{ fontSize: '0.72rem', marginLeft: '4px', color: fundamentals.fair_value_data?.discount_pct >= 0 ? '#00E676' : '#FF3366' }}>
                  ({fundamentals.fair_value_data?.discount_pct >= 0 ? '+' : ''}{fundamentals.fair_value_data?.discount_pct?.toFixed(0) || 0}%)
                </span>
              </strong>
            </div>

            {/* Moat Strength */}
            <div style={{ background: 'rgba(255, 179, 0, 0.1)', border: '1px solid rgba(255, 179, 0, 0.25)', padding: '0.5rem 0.8rem', borderRadius: '8px', textAlign: 'center' }}>
              <span style={{ fontSize: '0.68rem', color: '#fde68a', display: 'block', textTransform: 'uppercase', fontFamily: 'monospace' }}>Economic Moat</span>
              <strong style={{ color: '#FFB300', fontSize: '0.95rem' }}>
                {fundamentals.moat_catalyst?.moat_classification || 'Wide Moat'} ({fundamentals.moat_catalyst?.overall_moat_score || 85})
              </strong>
            </div>

            {/* Beat Streak */}
            <div style={{ background: 'rgba(0, 230, 118, 0.1)', border: '1px solid rgba(0, 230, 118, 0.25)', padding: '0.5rem 0.8rem', borderRadius: '8px', textAlign: 'center' }}>
              <span style={{ fontSize: '0.68rem', color: '#6ee7b7', display: 'block', textTransform: 'uppercase', fontFamily: 'monospace' }}>EPS Beat Streak</span>
              <strong style={{ color: '#00E676', fontSize: '0.95rem' }}>
                🔥 {fundamentals.earnings_deconstruction?.beat_streak?.consecutive_beats || 4} Quarters
              </strong>
            </div>

            {/* Squeeze Vulnerability */}
            <div style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.08)', padding: '0.5rem 0.8rem', borderRadius: '8px', textAlign: 'center' }}>
              <span style={{ fontSize: '0.68rem', color: '#94a3b8', display: 'block', textTransform: 'uppercase', fontFamily: 'monospace' }}>Squeeze Risk</span>
              <strong style={{ color: 'white', fontSize: '0.95rem', fontFamily: 'monospace' }}>
                {fundamentals.capital_allocation?.short_squeeze?.vulnerability || 'Low'} ({fundamentals.capital_allocation?.short_squeeze?.score || 20}/100)
              </strong>
            </div>
          </div>
        )}

        {/* 2. SUBNAV CYBER TABS */}
        <div
          style={{
            display: 'flex',
            gap: '0.5rem',
            overflowX: 'auto',
            marginTop: '1.25rem',
            paddingTop: '1rem',
            borderTop: '1px solid rgba(255,255,255,0.06)'
          }}
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '0.5rem 0.95rem',
                  borderRadius: '6px',
                  border: `1px solid ${isActive ? '#06b6d4' : 'rgba(255,255,255,0.08)'}`,
                  background: isActive ? 'rgba(6, 182, 212, 0.2)' : 'rgba(0,0,0,0.2)',
                  color: isActive ? '#22d3ee' : '#94a3b8',
                  fontWeight: '700',
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  whiteSpace: 'nowrap',
                  boxShadow: isActive ? '0 0 12px rgba(6, 182, 212, 0.25)' : 'none',
                  transition: 'all 0.2s'
                }}
              >
                <Icon size={14} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. ACTIVE VIEW WORKSPACE */}
      {loading ? (
        <div className="glass-card" style={{ padding: '4rem 2rem', textAlign: 'center', color: '#94a3b8' }}>
          <Compass size={40} className="animate-spin" style={{ color: '#06b6d4', margin: '0 auto 1rem auto' }} />
          <h3 style={{ color: 'white', margin: '0 0 0.5rem 0', fontSize: '1.3rem' }}>
            Compiling Telemetry for {selectedTicker}...
          </h3>
          <p style={{ fontSize: '0.85rem', fontFamily: 'monospace' }}>
            Running 5 institutional engines: Moat Pillars, DCF Sensitivities, DuPont 5-Way, and Capital Allocation.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* 12TH GRADER PLAIN ENGLISH EXPLAINER SUITE */}
          <PlainEnglishExplainer
            ticker={selectedTicker}
            profile={fundamentals?.profile}
            fundamentals={fundamentals}
            isExpandedDefault={true}
          />

          {/* TAB: INSTITUTIONAL DEEP BRIEF V2 */}
          {activeTab === 'deep_brief' && (
            <DeepBriefDocumentView ticker={selectedTicker} />
          )}

          {/* TAB 0: COCKPIT OVERVIEW (DEFAULT) */}
          {activeTab === 'overview' && (
            <CockpitOverviewView
              ticker={selectedTicker}
              fundamentals={fundamentals}
              onNavigateTab={(tabId) => setActiveTab(tabId)}
            />
          )}

          {/* TAB 1: DYNAMIC VALUATION & SLIDERS */}
          {activeTab === 'valuation' && (
            <DynamicValuationView
              currentTicker={selectedTicker}
              valuationData={fundamentals?.dynamic_valuation}
              currentPrice={fundamentals?.fair_value_data?.current_price}
              fundamentals={fundamentals}
            />
          )}

          {/* TAB 2: QUARTERLY EARNINGS & KPI TEARDOWN */}
          {activeTab === 'earnings' && (
            <EarningsDeconstructorView
              ticker={selectedTicker}
              teardownData={fundamentals?.earnings_deconstruction}
              historicalQuarters={fundamentals?.history}
              profile={fundamentals?.profile}
            />
          )}

          {/* TAB 3: FINANCIAL ANATOMY & DUPONT */}
          {activeTab === 'statements' && (
            <StatementDuPontView
              forensicData={fundamentals?.forensic_dupont}
              historicalQuarters={fundamentals?.history}
            />
          )}

          {/* TAB 4: FORENSIC HEALTH & SOLVENCY */}
          {activeTab === 'forensics' && (
            <ForensicHealthView
              forensicData={fundamentals?.forensic_dupont}
              profile={fundamentals?.profile}
            />
          )}

          {/* TAB 5: CAPITAL ALLOCATION & OWNERSHIP */}
          {activeTab === 'capital' && (
            <CapitalAllocationView
              capitalData={fundamentals?.capital_allocation}
            />
          )}

          {/* TAB 6: EXECUTIVE MOAT & CATALYSTS */}
          {activeTab === 'moat' && (
            <ExecutiveMoatView
              moatData={fundamentals?.moat_catalyst}
            />
          )}

          {/* TAB 7: PEERS, SEC FILINGS & MACRO OUTLOOK */}
          {activeTab === 'peers_sec' && (
            <div className="space-y-6">
              {peerValuation?.valuation && (
                <div
                  style={{
                    background: 'linear-gradient(180deg, rgba(18, 24, 38, 0.95) 0%, rgba(10, 14, 23, 0.95) 100%)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
                  }}
                  className="rounded-2xl p-5"
                >
                  <h3 className="text-base font-mono font-bold text-white flex items-center gap-2 mb-3">
                    <Layers className="w-4 h-4 text-emerald-400" /> Sector Peer Valuation Matrix
                  </h3>
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
                        {peerValuation.valuation.map((peer, i) => (
                          <tr
                            key={i}
                            className={`hover:bg-slate-800/30 transition-colors ${peer.Ticker === selectedTicker ? 'bg-cyan-500/15' : ''}`}
                          >
                            <td className="p-3 font-sans font-bold text-white flex items-center gap-2">
                              {peer.Ticker === selectedTicker && <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#00F0FF]"></span>}
                              {peer.Ticker}
                            </td>
                            <td className="p-3 text-slate-300">{peer['Market Cap']}</td>
                            <td className="p-3 text-slate-300">{peer['EV/EBITDA']}</td>
                            <td className="p-3 text-slate-300">{peer['Forward P/E']}</td>
                            <td className="p-3 text-slate-300">{peer['Price/Sales']}</td>
                            <td className="p-3 text-slate-300">{peer['Price/Book']}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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
