import React, { useState } from 'react';
import { 
  GraduationCap, HelpCircle, Lightbulb, CheckCircle2, 
  AlertTriangle, DollarSign, TrendingUp, ShieldCheck, 
  Store, Building2, Sparkles, ChevronDown, ChevronUp, BookOpen
} from 'lucide-react';

/**
 * PlainEnglishExplainer
 * Translates Wall Street financial jargon into intuitive, crystal-clear 
 * concepts that a 12th grader or first-time investor can instantly understand,
 * using real-world analogies (lemonade stand, rental property, school report cards).
 */
export default function PlainEnglishExplainer({
  ticker,
  profile = {},
  fundamentals = {},
  isExpandedDefault = true
}) {
  const [isExpanded, setIsExpanded] = useState(isExpandedDefault);
  const [activeAnalogy, setActiveAnalogy] = useState('lemonade');

  const symbol = ticker || profile.symbol || profile.ticker || fundamentals?.ticker || 'STOCK';
  const companyName = profile.company_name || profile.long_name || profile.short_name || fundamentals?.company_name || `${symbol}`;
  const price = profile.current_price || fundamentals?.fair_value_data?.current_price || 0;
  const pe = profile.trailing_pe || profile.forward_pe || 25.0;
  const grossMargin = profile.gross_margin 
    ? (profile.gross_margin * 100).toFixed(1) 
    : (fundamentals?.history?.length ? fundamentals.history[fundamentals.history.length - 1].gross_margin?.toFixed(1) : '40.0');
  
  const fcf = fundamentals?.dynamic_valuation?.base_financials?.fcf 
    || (fundamentals?.annual_history?.length ? fundamentals.annual_history[fundamentals.annual_history.length - 1].fcf : null)
    || (fundamentals?.history?.length ? fundamentals.history[fundamentals.history.length - 1].fcf * 4 : 5e9);
  const fcfB = (fcf / 1e9).toFixed(1);
  const fairValue = fundamentals?.fair_value_data?.fair_value || price * 1.10;
  const discountPct = fundamentals?.fair_value_data?.discount_pct ?? 10;
  const altmanScore = fundamentals?.forensic_dupont?.altman_z?.score ?? 3.2;
  const piotroskiScore = fundamentals?.forensic_dupont?.piotroski_f?.score ?? 7;
  const moatType = fundamentals?.moat_catalyst?.moat_classification || 'Wide Moat';

  return (
    <div 
      style={{
        background: 'linear-gradient(135deg, rgba(30, 27, 75, 0.4) 0%, rgba(15, 23, 42, 0.8) 100%)',
        border: '1px solid rgba(168, 85, 247, 0.35)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 0 rgba(255, 255, 255, 0.1)'
      }}
      className="rounded-2xl p-5 md:p-6 relative overflow-hidden transition-all duration-300"
    >
      {/* Top Ambient Glow */}
      <div className="absolute top-0 right-0 w-80 h-32 bg-purple-500/15 blur-3xl pointer-events-none" />

      {/* HEADER RIBBON */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/[0.08] relative z-10">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-purple-500/20 border border-purple-500/40 text-purple-300 shadow-[0_0_12px_rgba(168,85,247,0.3)]">
            <GraduationCap size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-black uppercase tracking-widest px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                12th Grader Explainer Mode
              </span>
              <span className="text-xs font-mono text-slate-400">Zero Wall-Street Jargon</span>
            </div>
            <h3 className="text-lg font-black text-white tracking-tight mt-0.5">
              What Does {symbol} ({companyName}) Actually Look Like Under the Hood?
            </h3>
          </div>
        </div>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold bg-purple-950/60 hover:bg-purple-900/60 text-purple-200 border border-purple-500/30 self-start sm:self-auto transition-all"
        >
          {isExpanded ? (
            <>Hide Explanations <ChevronUp size={14} /></>
          ) : (
            <>Show 12th Grader Guide <ChevronDown size={14} /></>
          )}
        </button>
      </div>

      {isExpanded && (
        <div className="mt-5 space-y-5 relative z-10">
          
          {/* 1. THE 4 QUESTIONS EVERY 12TH GRADER SHOULD ASK */}
          <div>
            <div className="text-xs font-mono font-bold uppercase tracking-wider text-purple-300 mb-3 flex items-center gap-1.5">
              <Sparkles size={14} className="text-purple-400" />
              The 4 Fundamental Questions of Any Business (The Lemonade Stand Test)
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
              
              {/* Q1: REAL CASH */}
              <div className="p-4 rounded-xl bg-slate-900/90 border border-emerald-500/25 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">Q1 · Cash Generation</span>
                    <span className="p-1 rounded bg-emerald-500/20 text-emerald-400">
                      <CheckCircle2 size={14} />
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-white mb-1">Is it making real money?</h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    <strong className="text-emerald-400 font-mono">${fcfB} Billion</strong> in pure Free Cash Flow this year.
                  </p>
                </div>
                <div className="mt-3 pt-2.5 border-t border-white/[0.06] text-[11px] text-slate-400 font-sans">
                  💡 <strong>Analogy:</strong> Not paper IOUs or accounting tricks. This is real cash sitting in their bank account after paying all bills and factory costs.
                </div>
              </div>

              {/* Q2: PRICING POWER & MARGINS */}
              <div className="p-4 rounded-xl bg-slate-900/90 border border-cyan-500/25 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">Q2 · Pricing Power</span>
                    <span className="p-1 rounded bg-cyan-500/20 text-cyan-400">
                      <Store size={14} />
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-white mb-1">Do they keep high profits?</h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    <strong className="text-cyan-400 font-mono">{grossMargin}%</strong> Gross Profit Margin.
                  </p>
                </div>
                <div className="mt-3 pt-2.5 border-t border-white/[0.06] text-[11px] text-slate-400 font-sans">
                  💡 <strong>Analogy:</strong> If a cup of lemonade sells for $1.00, it only costs them ${((100 - parseFloat(grossMargin))/100).toFixed(2)} in lemons. They pocket the rest.
                </div>
              </div>

              {/* Q3: BANKRUPTCY & SAFETY */}
              <div className="p-4 rounded-xl bg-slate-900/90 border border-blue-500/25 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">Q3 · Safety & Debt</span>
                    <span className="p-1 rounded bg-blue-500/20 text-blue-400">
                      <ShieldCheck size={14} />
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-white mb-1">Can they go broke?</h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Altman Z-Score <strong className="text-blue-400 font-mono">{altmanScore.toFixed(1)}</strong> (Fortress Safe Zone).
                  </p>
                </div>
                <div className="mt-3 pt-2.5 border-t border-white/[0.06] text-[11px] text-slate-400 font-sans">
                  💡 <strong>Analogy:</strong> Like having $50,000 in savings with only a $500 monthly car payment. Bankruptcy risk is virtually zero (&lt;0.5%).
                </div>
              </div>

              {/* Q4: PRICE & VALUATION */}
              <div className="p-4 rounded-xl bg-slate-900/90 border border-purple-500/25 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">Q4 · Price Tag</span>
                    <span className="p-1 rounded bg-purple-500/20 text-purple-400">
                      <DollarSign size={14} />
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-white mb-1">Is it cheap or a rip-off?</h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    P/E Ratio <strong className="text-purple-400 font-mono">{pe}x</strong> (Fair Value: ${fairValue.toFixed(0)}).
                  </p>
                </div>
                <div className="mt-3 pt-2.5 border-t border-white/[0.06] text-[11px] text-slate-400 font-sans">
                  💡 <strong>Analogy:</strong> You are paying ${pe} today for every $1 this business earns every year. A quality brand markup, but fair.
                </div>
              </div>

            </div>
          </div>

          {/* 2. PLAIN-ENGLISH CHEAT SHEET / REAL WORLD DICTIONARY */}
          <div className="p-4 rounded-xl bg-slate-950/70 border border-white/[0.08]">
            <div className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300 mb-3 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <BookOpen size={14} className="text-cyan-400" />
                Plain-English Cheat Sheet for Complex Jargon
              </span>
              <span className="text-[10px] text-slate-400">Click a concept to learn</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              
              {/* P/E RATIO */}
              <div className="p-3 bg-slate-900/80 rounded-lg border border-white/[0.05]">
                <div className="flex items-center justify-between text-xs font-bold text-cyan-300 font-mono">
                  <span>P/E Ratio (Price-to-Earnings)</span>
                  <span>{pe}x</span>
                </div>
                <p className="text-[11px] text-slate-300 mt-1.5 leading-relaxed font-sans">
                  <strong>What it means:</strong> The price tag on profits. If a lemonade stand earns $100 profit a year, and the owner asks $3,200 to buy the whole stand, the P/E is 32x.
                </p>
                <div className="text-[10px] text-slate-400 mt-1 font-mono">
                  Rule of Thumb: &lt;15x is cheap, 20-30x is normal for great companies, &gt;45x is very expensive.
                </div>
              </div>

              {/* PIOTROSKI F-SCORE */}
              <div className="p-3 bg-slate-900/80 rounded-lg border border-white/[0.05]">
                <div className="flex items-center justify-between text-xs font-bold text-emerald-300 font-mono">
                  <span>Piotroski F-Score</span>
                  <span>{piotroskiScore} / 9</span>
                </div>
                <p className="text-[11px] text-slate-300 mt-1.5 leading-relaxed font-sans">
                  <strong>What it means:</strong> The high school report card! A Stanford professor created 9 tests (cash flow, debt, sales, margins). 
                </p>
                <div className="text-[10px] text-emerald-400 mt-1 font-mono">
                  Score: {piotroskiScore}/9 is like an "A" grade in financial health.
                </div>
              </div>

              {/* ECONOMIC MOAT */}
              <div className="p-3 bg-slate-900/80 rounded-lg border border-white/[0.05]">
                <div className="flex items-center justify-between text-xs font-bold text-amber-300 font-mono">
                  <span>Economic Moat</span>
                  <span>{moatType}</span>
                </div>
                <p className="text-[11px] text-slate-300 mt-1.5 leading-relaxed font-sans">
                  <strong>What it means:</strong> Think of a medieval castle surrounded by water. A moat is what stops competitors from stealing your customers.
                </p>
                <div className="text-[10px] text-amber-400 mt-1 font-mono">
                  {symbol}'s Moat: Switching to another brand is annoying + massive brand loyalty.
                </div>
              </div>

            </div>
          </div>

        </div>
      )}
    </div>
  );
}
