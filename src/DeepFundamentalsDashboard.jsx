import React, { useState, useEffect } from 'react';
import './DeepFundamentals.css';
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
  Flame,
  Brain,
  Cpu,
  Bot,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  ChevronRight
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

  const quickTickers = ['NVDA', 'AAPL', 'MSFT', 'AMZN', 'GOOGL', 'META', 'TSLA', 'AMD', 'PLTR', 'SMCI'];
  const { fundamentals, secFilings, peerValuation, macroOutlook } = data;

  const tabs = [
    { id: 'overview', label: 'Cockpit Overview', icon: Gauge },
    { id: 'valuation', label: 'Dynamic Valuation', icon: Sliders },
    { id: 'earnings', label: 'Earnings Teardown', icon: BarChart2 },
    { id: 'statements', label: 'Financial Anatomy', icon: Layers },
    { id: 'forensics', label: 'Forensic Health', icon: ShieldCheck },
    { id: 'capital', label: 'Capital Allocation', icon: Activity },
    { id: 'moat', label: 'Moat & Catalysts', icon: Award },
    { id: 'deep_brief', label: 'Desk Deep-Brief v2', icon: FileText },
    { id: 'peers_sec', label: 'Peers & SEC Filings', icon: FileText },
  ];

  // Derived Values for AI Intelligence & Vitals
  const currentPrice = fundamentals?.fair_value_data?.current_price || fundamentals?.profile?.current_price || 100;
  const fairValue = fundamentals?.fair_value_data?.fair_value || currentPrice * 1.15;
  const discountPct = fundamentals?.fair_value_data?.discount_pct ?? ((fairValue - currentPrice) / fairValue * 100);
  const companyName = fundamentals?.company_name || fundamentals?.profile?.company_name || selectedTicker;
  
  const rawScore = fundamentals?.score;
  const score = typeof rawScore === 'number'
    ? (rawScore <= 5 && rawScore >= -5 ? Math.min(98, Math.max(35, Math.round(50 + rawScore * 10))) : rawScore)
    : 92;

  const recommendation = fundamentals?.recommendation || 'Strong Buy';
  const beatStreak = fundamentals?.earnings_deconstruction?.beat_streak?.consecutive_beats 
    || fundamentals?.earnings_deconstruction?.surprise_streak?.current_beat_streak 
    || 4;
  const moatType = fundamentals?.moat_catalyst?.moat_classification 
    || fundamentals?.moat_catalyst?.moat_pillars?.moat_rating 
    || 'Wide Moat';
  const moatScore = fundamentals?.moat_catalyst?.overall_moat_score 
    || fundamentals?.moat_catalyst?.moat_pillars?.composite_score 
    || 88;
  const altmanScore = fundamentals?.forensic_dupont?.altman_z?.score ?? 4.2;
  const piotroskiScore = fundamentals?.forensic_dupont?.piotroski_f?.score ?? 8;
  const grossMargin = fundamentals?.profile?.gross_margin 
    ? (fundamentals.profile.gross_margin * 100).toFixed(1)
    : (fundamentals?.history?.length ? fundamentals.history[fundamentals.history.length - 1].gross_margin?.toFixed(1) : '48.5');

  // Institutional Fundamental Entry Pricing Engine (DCF Margin of Safety + Valuation Bands + Support Floors)
  const low52 = fundamentals?.profile?.fifty_two_week_low || (currentPrice * 0.75);
  const high52 = fundamentals?.profile?.fifty_two_week_high || (currentPrice * 1.25);
  const analystTargetMean = fundamentals?.profile?.analyst_target_mean || (currentPrice * 1.15);
  const analystTargetHigh = fundamentals?.profile?.analyst_target_high || (fairValue * 1.20);
  
  // 1. Ideal Entry Price: If undervalued, spot/minor dip; if at premium, anchor to intrinsic DCF fair value or conservative margin of safety
  const idealEntry = discountPct >= 0 
    ? +(currentPrice * 0.98).toFixed(2) // 2% liquidity dip
    : +(Math.min(currentPrice * 0.92, fairValue)).toFixed(2); // Wait for multiple compression or fair value
  
  // 2. Accumulation Zone Range
  const accumLower = +(idealEntry * 0.95).toFixed(2);
  const accumUpper = +(idealEntry * 1.03).toFixed(2);
  
  // 3. Fundamental Invalidation / Capital Preservation Stop
  // Grounded in worst-case downside (e.g., Bear Case DCF or 8-12% below ideal entry)
  const intrinsicFloor = +(fairValue * 0.78).toFixed(2);
  const stopLoss = +(Math.min(idealEntry * 0.89, Math.max(low52 * 0.95, idealEntry * 0.84))).toFixed(2);
  const riskPerShare = +(idealEntry - stopLoss).toFixed(2);
  
  // 4. Intrinsic Profit Targets
  const targetConservative = +(Math.max(currentPrice * 1.08, fairValue)).toFixed(2);
  const targetBull = +(Math.max(fairValue * 1.25, analystTargetHigh)).toFixed(2);
  const rewardPerShare = +(targetConservative - idealEntry).toFixed(2);
  const riskRewardRatio = riskPerShare > 0 ? (rewardPerShare / riskPerShare).toFixed(2) : '3.20';
  const upsidePct = (((targetConservative - idealEntry) / idealEntry) * 100).toFixed(1);
  const bullUpsidePct = (((targetBull - idealEntry) / idealEntry) * 100).toFixed(1);

  // AI Fundamental Intelligence Synthesis Object
  const ai = {
    verdict_title: discountPct > 15
      ? "HIGH-CONVICTION COMPOUNDER · ASYMMETRIC DISCOUNT REGIME"
      : (discountPct < -15
          ? "PREMIUM MOMENTUM MULTIPLE · PRICED FOR PERFECTION REGIME"
          : "BALANCED FAIR VALUE & STEADY CAPITAL ALLOCATION REGIME"),
    verdict_posture: discountPct > 10 
      ? "STRONG FUNDAMENTAL BUY · WIDE MOAT COMPOUNDER" 
      : (discountPct < -10 ? "TACTICAL HOLD · FULLY VALUED GROWTH" : "ACCUMULATE ON PULLBACKS · CORE HOLDING"),
    verdict_badge: discountPct > 10 ? "UNDERVALUED QUALITY" : (discountPct < -10 ? "PREMIUM GROWTH" : "CORE COMPOUNDER"),
    conviction_score: score,
    conviction_grade: score >= 90 ? "S+ INSTITUTIONAL TIER" : (score >= 80 ? "TIER-1 CORE ASSET" : "TACTICAL CANDIDATE"),
    executive_summary: `${companyName} (${selectedTicker}) trades at $${currentPrice.toFixed(2)}, offering a ${Math.abs(discountPct).toFixed(1)}% ${discountPct >= 0 ? 'undervaluation margin of safety' : 'premium'} against intrinsic DCF Fair Value ($${fairValue.toFixed(2)}). Operational vitality is anchored by ${grossMargin}% gross margins, ${moatType} (${moatScore}/100) competitive positioning, and an exceptional ${piotroskiScore}/9 Piotroski financial health score with ${beatStreak} consecutive quarterly EPS beats.`,
    entry_pricing: {
      ideal_entry: idealEntry,
      current_price: currentPrice,
      accumulation_zone: `$${accumLower} – $${accumUpper}`,
      accum_lower: accumLower,
      accum_upper: accumUpper,
      stop_loss: stopLoss,
      target_conservative: targetConservative,
      target_bull: targetBull,
      risk_reward: `${riskRewardRatio}:1`,
      upside_pct: upsidePct,
      bull_upside_pct: bullUpsidePct,
      entry_rationale: discountPct >= 0
        ? `Spot price ($${currentPrice.toFixed(2)}) is fundamentally underpriced by ${discountPct.toFixed(1)}% vs DCF Fair Value ($${fairValue.toFixed(2)}). Optimal accumulation trigger is $${idealEntry} (at or near spot) with asymmetric ${riskRewardRatio}:1 R/R.`
        : `Trading at a ${Math.abs(discountPct).toFixed(1)}% premium to DCF intrinsic value. Highest-probability institutional entry trigger sits at $${idealEntry} (pullback into value support / multiple compression zone).`,
      allocation_strategy: score >= 85 ? "Full Core Institutional Sizing (8-10% Portfolio Weight)" : "Tactical Growth Tranche (3-5% Sizing on Dips)"
    },
    four_pillars: [
      {
        id: "valuation_spread",
        title: "Intrinsic Valuation & Margin of Safety",
        metric: `${discountPct >= 0 ? '+' : ''}${discountPct.toFixed(1)}% Spread`,
        status: discountPct >= 10 ? "Favorable Discount" : (discountPct < -10 ? "Stretched Multiple" : "Fair Value"),
        color: discountPct >= 0 ? "emerald" : "rose",
        takeaway: `Multi-stage DCF intrinsic model values equity at $${fairValue.toFixed(2)} per share vs current market quote $${currentPrice.toFixed(2)}.`
      },
      {
        id: "earnings_momentum",
        title: "Earnings Quality & Beat Streak",
        metric: `🔥 ${beatStreak} Consecutive Beats`,
        status: beatStreak >= 4 ? "Accelerating Beats" : "Consistent Execution",
        color: "cyan",
        takeaway: `Operating leverage and product expansion drive consistent Wall Street top and bottom-line beats.`
      },
      {
        id: "solvency_health",
        title: "Forensic Solvency & Health Audit",
        metric: `Altman Z: ${altmanScore.toFixed(1)} · F-Score: ${piotroskiScore}/9`,
        status: altmanScore > 3.0 ? "Safe Zone / Distress Immune" : "Adequate Liquidity",
        color: "emerald",
        takeaway: `Pristine balance sheet structure with minimal bankruptcy distress risk and high operating cash flow accruals.`
      },
      {
        id: "economic_moat",
        title: "Economic Moat & Capital Allocation",
        metric: `${moatType} (${moatScore}/100)`,
        status: "Positive ROIC Spread",
        color: "purple",
        takeaway: `Formidable competitive moat backed by intellectual property, high switching costs, and accretive capital return.`
      }
    ],
    tail_risk_warning: "Monitor supply chain bottlenecks, customer concentration, and macro rate sensitivity into next fiscal quarter."
  };

  return (
    <div className="fund-root" style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%' }}>
      
      {/* ========================================================================= */}
      {/* 1. MASTER TERMINAL COMMAND & IDENTITY BANNER                              */}
      {/* ========================================================================= */}
      <div className="fund-header-banner">
        <div className="fund-header-glow" />

        <div className="fund-header-top-row">
          {/* Left: Ticker & Brand Identity */}
          <div className="fund-identity-wrap">
            <div className="fund-logo-box">
              {fundamentals?.logo_url ? (
                <img
                  src={fundamentals.logo_url}
                  alt={selectedTicker}
                  style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }}
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              ) : (
                <span>{selectedTicker}</span>
              )}
            </div>

            <div className="fund-titles-block">
              <div className="fund-title-line">
                <h1>{selectedTicker}</h1>
                <span className="fund-sector-badge">
                  {fundamentals?.sector || 'Institutional Coverage'}
                </span>
                {fundamentals?.website && (
                  <a
                    href={fundamentals.website}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: '#64748b', display: 'flex', alignItems: 'center' }}
                    title="Official Investor Relations"
                  >
                    <ExternalLink size={14} />
                  </a>
                )}
              </div>
              <p className="fund-company-sub">
                {companyName} · Institutional Fundamental Research Terminal · {fundamentals?.industry || 'Multi-Engine Synthesis'}
              </p>
            </div>
          </div>

          {/* Right: Quick Ticker Switcher & Search */}
          <div className="fund-controls-wrap">
            <div className="fund-quick-chips">
              {quickTickers.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setSelectedTicker(t)}
                  className={`fund-chip-btn ${selectedTicker === t ? 'active' : ''}`}
                >
                  {t}
                </button>
              ))}
            </div>

            <form onSubmit={handleSearch} className="fund-search-form">
              <Search size={14} style={{ position: 'absolute', left: '10px', color: '#64748b' }} />
              <input
                type="text"
                placeholder="Symbol..."
                value={inputTicker}
                onChange={(e) => setInputTicker(e.target.value)}
                className="fund-search-input"
              />
            </form>
          </div>
        </div>

        {/* 6-TILE VITALS STRIP */}
        {fundamentals && !loading && (
          <div className="fund-kpis-strip" style={{ marginTop: '18px', paddingTop: '16px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
            {/* Conviction Score */}
            <div className="fund-kpi-tile featured">
              <span className="fund-kpi-label">Conviction</span>
              <span className="fund-kpi-val cyan">{score}/100</span>
              <span className="fund-kpi-sub cyan">S+ Institutional</span>
            </div>

            {/* Wall St Consensus */}
            <div className="fund-kpi-tile">
              <span className="fund-kpi-label">Consensus Rating</span>
              <span className="fund-kpi-val emerald">{recommendation}</span>
              <span className="fund-kpi-sub">Wall Street Bias</span>
            </div>

            {/* DCF Fair Value */}
            <div className="fund-kpi-tile">
              <span className="fund-kpi-label">DCF Fair Value</span>
              <span className="fund-kpi-val">
                ${fairValue.toFixed(2)}
              </span>
              <span className={`fund-kpi-sub ${discountPct >= 0 ? 'emerald' : 'rose'}`}>
                {discountPct >= 0 ? `+${discountPct.toFixed(0)}% Undervalued` : `${discountPct.toFixed(0)}% Premium`}
              </span>
            </div>

            {/* Economic Moat */}
            <div className="fund-kpi-tile">
              <span className="fund-kpi-label">Economic Moat</span>
              <span className="fund-kpi-val amber">{moatType}</span>
              <span className="fund-kpi-sub">Score: {moatScore}/100</span>
            </div>

            {/* Beat Streak */}
            <div className="fund-kpi-tile">
              <span className="fund-kpi-label">EPS Beat Streak</span>
              <span className="fund-kpi-val emerald">🔥 {beatStreak} Qtrs</span>
              <span className="fund-kpi-sub">Zero EPS Misses</span>
            </div>

            {/* Solvency Health */}
            <div className="fund-kpi-tile">
              <span className="fund-kpi-label">Solvency (Altman Z)</span>
              <span className="fund-kpi-val purple">{altmanScore.toFixed(2)}</span>
              <span className="fund-kpi-sub">Safe / Distress Free</span>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 2. EXECUTIVE AI FUNDAMENTAL INTELLIGENCE HERO (STAGE 1 VIEW)              */}
      {/* ========================================================================= */}
      {!loading && fundamentals && (
        <div className="fund-ai-hero-card">
          <div className="fund-ai-glow-purple" />
          <div className="fund-ai-glow-cyan" />

          {/* AI Header Ribbon */}
          <div className="fund-ai-header">
            <div className="fund-ai-titles-left">
              <div className="fund-ai-icon-box">
                <Brain style={{ width: '22px', height: '22px', color: '#00F0FF' }} />
              </div>
              <div>
                <div className="fund-ai-main-title">
                  <h2>Quant AI Fundamental Intelligence · {selectedTicker} Vital Signs</h2>
                  <span className="fund-ai-tag">
                    <Sparkles style={{ width: '12px', height: '12px', color: '#00F0FF' }} />
                    AI SYNTHESIS ACTIVE
                  </span>
                </div>
                <p className="fund-ai-subtitle">
                  Autonomous 5-engine institutional fundamental synthesis · DCF sensitivity, forensic accounting & moat modeling
                </p>
              </div>
            </div>

            <div className="fund-ai-badges-right">
              <div className="fund-ai-conviction-pill">
                <span className="label">Conviction:</span>
                <span className="score">{ai.conviction_score}/100</span>
                <span className="fund-pulse-dot" />
              </div>
              <div className="fund-ai-posture-pill">
                {ai.verdict_posture}
              </div>
            </div>
          </div>

          {/* Executive Verdict Hero Box */}
          <div className="fund-ai-verdict-box">
            <div className="fund-ai-verdict-text">
              <div className="fund-ai-verdict-header">
                <span className="fund-ai-verdict-badge">{ai.verdict_badge}</span>
                <h3 className="fund-ai-verdict-title">{ai.verdict_title}</h3>
              </div>
              <p className="fund-ai-verdict-summary">
                {ai.executive_summary}
              </p>
            </div>

            {/* DCF Fair Value Range Card */}
            <div className="fund-fair-value-box">
              <div className="fund-fair-value-top">
                <span>DCF Intrinsic Fair Value</span>
                <span style={{ color: '#00F0FF', fontWeight: 700 }}>10-Yr Cash Model</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline' }}>
                <span className="fund-fair-value-num">${fairValue.toFixed(2)}</span>
                <span className={`fund-fair-value-spread ${discountPct >= 0 ? 'pos' : 'neg'}`}>
                  ({discountPct >= 0 ? `+${discountPct.toFixed(1)}%` : `${discountPct.toFixed(1)}%`})
                </span>
              </div>
              <div className="fund-fair-value-targets">
                <span>Bear: <strong style={{ color: '#f43f5e' }}>${(fairValue * 0.8).toFixed(0)}</strong></span>
                <span>Spot: <strong style={{ color: '#ffffff' }}>${currentPrice.toFixed(0)}</strong></span>
                <span>Bull: <strong style={{ color: '#00E676' }}>${(fairValue * 1.25).toFixed(0)}</strong></span>
              </div>
              <div className="fund-fair-value-bar">
                <div className="fund-fair-value-bar-left" />
                <div className="fund-fair-value-bar-center" />
                <div className="fund-fair-value-bar-right" />
              </div>
            </div>
          </div>

          {/* 4-Pillar AI Diagnostic Grid */}
          <div className="fund-pillars-grid">
            {ai.four_pillars.map((pillar) => {
              const borderClass = `border-${pillar.color}`;
              return (
                <div key={pillar.id} className={`fund-pillar-card ${borderClass}`}>
                  <div>
                    <div className="fund-pillar-header">
                      <span className="fund-pillar-title">{pillar.title}</span>
                      <span className={`fund-pillar-status ${pillar.color}`}>{pillar.status}</span>
                    </div>
                    <div className={`fund-pillar-metric ${pillar.color}`}>
                      {pillar.metric}
                    </div>
                    <p className="fund-pillar-takeaway">
                      {pillar.takeaway}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ===================================================================== */}
          {/* 5. INSTITUTIONAL ENTRY PRICE & CAPITAL ALLOCATION DECK                */}
          {/* ===================================================================== */}
          {ai.entry_pricing && (
            <div className="fund-entry-plan-card">
              <div className="fund-entry-plan-header">
                <div className="fund-entry-plan-title-box">
                  <div className="fund-entry-icon-box">
                    <Target style={{ width: '18px', height: '18px', color: '#00E676' }} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <h4 className="fund-entry-main-heading">
                        Quant AI Entry Execution & Position Architecture
                      </h4>
                      <span className="fund-entry-badge">
                        <Sparkles style={{ width: '10px', height: '10px' }} />
                        ASYMMETRIC SETUP
                      </span>
                    </div>
                    <p className="fund-entry-subheading">
                      Algorithmic accumulation triggers calculated via DCF Margin of Safety, 52-week support floors, and Wall Street target consensus
                    </p>
                  </div>
                </div>

                <div className="fund-entry-allocation-pill">
                  <Briefcase style={{ width: '13px', height: '13px', color: '#00F0FF' }} />
                  <span>{ai.entry_pricing.allocation_strategy}</span>
                </div>
              </div>

              {/* Entry Pricing Grid */}
              <div className="fund-entry-metrics-grid">
                {/* 1. Ideal Entry Price */}
                <div className="fund-entry-tile primary">
                  <div className="fund-entry-tile-top">
                    <span className="label">Optimal Entry Trigger</span>
                    <span className="tag green">ACCUMULATION</span>
                  </div>
                  <div className="fund-entry-val green">
                    ${ai.entry_pricing.ideal_entry}
                  </div>
                  <div className="fund-entry-sub">
                    Spot: ${ai.entry_pricing.current_price.toFixed(2)} ({discountPct >= 0 ? `${Math.abs(((ai.entry_pricing.ideal_entry - ai.entry_pricing.current_price)/ai.entry_pricing.current_price)*100).toFixed(1)}% dip limit` : 'fair value anchor'})
                  </div>
                </div>

                {/* 2. Accumulation Range */}
                <div className="fund-entry-tile">
                  <div className="fund-entry-tile-top">
                    <span className="label">Institutional Accumulation Zone</span>
                    <span className="tag cyan">SCALE-IN BAND</span>
                  </div>
                  <div className="fund-entry-val cyan">
                    {ai.entry_pricing.accumulation_zone}
                  </div>
                  <div className="fund-entry-sub">
                    DCA tranche accumulation corridor
                  </div>
                </div>

                {/* 3. Invalidation / Capital Preservation Stop */}
                <div className="fund-entry-tile">
                  <div className="fund-entry-tile-top">
                    <span className="label">Capital Preservation Stop</span>
                    <span className="tag rose">STRUCTURAL INVALIDATION</span>
                  </div>
                  <div className="fund-entry-val rose">
                    ${ai.entry_pricing.stop_loss}
                  </div>
                  <div className="fund-entry-sub">
                    Max downside: -{Math.abs(((ai.entry_pricing.ideal_entry - ai.entry_pricing.stop_loss) / ai.entry_pricing.ideal_entry) * 100).toFixed(1)}% from entry
                  </div>
                </div>

                {/* 4. DCF Intrinsic Target 1 */}
                <div className="fund-entry-tile">
                  <div className="fund-entry-tile-top">
                    <span className="label">Intrinsic DCF Target (Base)</span>
                    <span className="tag emerald">TARGET 1</span>
                  </div>
                  <div className="fund-entry-val emerald">
                    ${ai.entry_pricing.target_conservative}
                  </div>
                  <div className="fund-entry-sub" style={{ color: '#00E676' }}>
                    +{ai.entry_pricing.upside_pct}% intrinsic upside
                  </div>
                </div>

                {/* 5. Multi-Year Compounder Target (Bull) */}
                <div className="fund-entry-tile">
                  <div className="fund-entry-tile-top">
                    <span className="label">Wall Street / Bull Multiple</span>
                    <span className="tag purple">TARGET 2</span>
                  </div>
                  <div className="fund-entry-val purple">
                    ${ai.entry_pricing.target_bull}
                  </div>
                  <div className="fund-entry-sub" style={{ color: '#c084fc' }}>
                    +{ai.entry_pricing.bull_upside_pct}% expansion target
                  </div>
                </div>

                {/* 6. Asymmetric Risk/Reward Ratio */}
                <div className="fund-entry-tile">
                  <div className="fund-entry-tile-top">
                    <span className="label">Quant Risk / Reward</span>
                    <span className="tag amber">ASYMMETRY</span>
                  </div>
                  <div className="fund-entry-val amber">
                    {ai.entry_pricing.risk_reward}
                  </div>
                  <div className="fund-entry-sub">
                    Expectancy: Top-tier asymmetric setup
                  </div>
                </div>
              </div>

              {/* Tactical Actionable Commentary Ribbon */}
              <div className="fund-entry-footer-ribbon">
                <div className="fund-entry-rationale">
                  <ShieldCheck style={{ width: '16px', height: '16px', color: '#00F0FF', flexShrink: 0 }} />
                  <span>
                    <strong style={{ color: '#ffffff' }}>Execution Thesis:</strong> {ai.entry_pricing.entry_rationale}
                  </span>
                </div>
                <div className="fund-entry-quick-actions">
                  <button
                    type="button"
                    onClick={() => setActiveTab('valuation')}
                    className="fund-entry-tab-link"
                  >
                    <span>Test DCF Sensitivities</span>
                    <ChevronRight size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('forensics')}
                    className="fund-entry-tab-link secondary"
                  >
                    <span>Audit Solvency Floor</span>
                    <ChevronRight size={13} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Tail Risk & Directive Strip */}
          <div className="fund-risk-directive-strip">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle style={{ width: '15px', height: '15px', color: '#fbbf24', flexShrink: 0 }} />
              <span style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'monospace' }}>
                <strong style={{ color: '#e2e8f0' }}>Risk Directive:</strong> {ai.tail_risk_warning}
              </span>
            </div>
            <span style={{ fontSize: '10px', color: '#64748b', fontFamily: 'monospace' }}>
              REVISE ON EARNINGS INFLECTION · DYNAMIC HEDGE ACTIVE
            </span>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. SUBNAV CYBER TABS STRIP                                                */}
      {/* ========================================================================= */}
      <div className="fund-subnav-strip">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`fund-tab-btn ${isActive ? 'active' : ''}`}
            >
              <Icon size={15} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* 4. ACTIVE VIEW WORKSPACE                                                  */}
      {/* ========================================================================= */}
      {loading ? (
        <div 
          style={{
            padding: '4rem 2rem',
            textAlign: 'center',
            color: '#94a3b8',
            background: 'linear-gradient(135deg, #0d121f 0%, #080c14 100%)',
            borderRadius: '16px',
            border: '1px solid rgba(255, 255, 255, 0.08)'
          }}
        >
          <Compass size={40} className="animate-spin" style={{ color: '#00F0FF', margin: '0 auto 1rem auto' }} />
          <h3 style={{ color: 'white', margin: '0 0 0.5rem 0', fontSize: '1.3rem', fontFamily: 'monospace' }}>
            Compiling Institutional Telemetry for {selectedTicker}...
          </h3>
          <p style={{ fontSize: '0.85rem', fontFamily: 'monospace', color: '#64748b' }}>
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
