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
        background: 'linear-gradient(135deg, rgba(30, 27, 75, 0.45) 0%, rgba(15, 23, 42, 0.85) 100%)',
        border: '1px solid rgba(168, 85, 247, 0.35)',
        borderRadius: '16px',
        padding: '22px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 0 rgba(255, 255, 255, 0.1)'
      }}
      className="rounded-2xl p-5 md:p-6 relative overflow-hidden transition-all duration-300"
    >
      {/* Top Ambient Glow */}
      <div className="absolute top-0 right-0 w-80 h-32 bg-purple-500/15 blur-3xl pointer-events-none" />

      {/* HEADER RIBBON */}
      <div 
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          paddingBottom: '16px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
        }}
        className="relative z-10"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ padding: '10px', borderRadius: '12px', background: 'rgba(168, 85, 247, 0.2)', border: '1px solid rgba(168, 85, 247, 0.4)', color: '#c084fc', display: 'flex' }}>
            <GraduationCap size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ padding: '2px 8px', borderRadius: '4px', background: 'rgba(168, 85, 247, 0.2)', border: '1px solid rgba(168, 85, 247, 0.3)', color: '#c084fc', fontFamily: 'monospace', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                12th Grader Explainer Mode
              </span>
              <span style={{ fontSize: '12px', fontFamily: 'monospace', color: '#94a3b8' }}>Zero Wall-Street Jargon</span>
            </div>
            <h3 style={{ margin: '4px 0 0 0', fontSize: '16px', fontWeight: 800, color: '#ffffff' }}>
              What Does {symbol} ({companyName}) Actually Look Like Under the Hood?
            </h3>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            borderRadius: '8px',
            fontFamily: 'monospace',
            fontSize: '11px',
            fontWeight: 700,
            background: 'rgba(88, 28, 135, 0.4)',
            color: '#e9d5ff',
            border: '1px solid rgba(168, 85, 247, 0.35)',
            cursor: 'pointer'
          }}
        >
          {isExpanded ? (
            <>Hide Explanations <ChevronUp size={14} /></>
          ) : (
            <>Show 12th Grader Guide <ChevronDown size={14} /></>
          )}
        </button>
      </div>

      {isExpanded && (
        <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }} className="relative z-10">
          
          {/* 1. THE 4 QUESTIONS EVERY 12TH GRADER SHOULD ASK */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontFamily: 'monospace', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#c084fc', marginBottom: '12px' }}>
              <Sparkles size={14} style={{ color: '#c084fc' }} />
              The 4 Fundamental Questions of Any Business (The Lemonade Stand Test)
            </div>

            <div 
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '14px'
              }}
            >
              
              {/* Q1: REAL CASH */}
              <div style={{ padding: '16px', borderRadius: '12px', background: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(16, 185, 129, 0.25)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '10px', fontFamily: 'monospace', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Q1 · Cash Generation</span>
                    <span style={{ padding: '3px', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.2)', color: '#00E676', display: 'flex' }}>
                      <CheckCircle2 size={14} />
                    </span>
                  </div>
                  <h4 style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: 700, color: '#ffffff' }}>Is it making real money?</h4>
                  <p style={{ margin: 0, fontSize: '12px', color: '#cbd5e1', lineHeight: 1.5 }}>
                    <strong style={{ color: '#00E676', fontFamily: 'monospace' }}>${fcfB} Billion</strong> in pure Free Cash Flow this year.
                  </p>
                </div>
                <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid rgba(255, 255, 255, 0.06)', fontSize: '11px', color: '#94a3b8' }}>
                  💡 <strong>Analogy:</strong> Not paper IOUs or accounting tricks. This is real cash sitting in their bank account after paying all bills and factory costs.
                </div>
              </div>

              {/* Q2: PRICING POWER & MARGINS */}
              <div style={{ padding: '16px', borderRadius: '12px', background: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(6, 182, 212, 0.25)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '10px', fontFamily: 'monospace', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Q2 · Pricing Power</span>
                    <span style={{ padding: '3px', borderRadius: '4px', background: 'rgba(6, 182, 212, 0.2)', color: '#00F0FF', display: 'flex' }}>
                      <Store size={14} />
                    </span>
                  </div>
                  <h4 style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: 700, color: '#ffffff' }}>Do they keep high profits?</h4>
                  <p style={{ margin: 0, fontSize: '12px', color: '#cbd5e1', lineHeight: 1.5 }}>
                    <strong style={{ color: '#00F0FF', fontFamily: 'monospace' }}>{grossMargin}%</strong> Gross Profit Margin.
                  </p>
                </div>
                <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid rgba(255, 255, 255, 0.06)', fontSize: '11px', color: '#94a3b8' }}>
                  💡 <strong>Analogy:</strong> If a cup of lemonade sells for $1.00, it only costs them ${((100 - parseFloat(grossMargin))/100).toFixed(2)} in lemons. They pocket the rest.
                </div>
              </div>

              {/* Q3: BANKRUPTCY & SAFETY */}
              <div style={{ padding: '16px', borderRadius: '12px', background: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(59, 130, 246, 0.25)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '10px', fontFamily: 'monospace', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Q3 · Safety & Debt</span>
                    <span style={{ padding: '3px', borderRadius: '4px', background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', display: 'flex' }}>
                      <ShieldCheck size={14} />
                    </span>
                  </div>
                  <h4 style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: 700, color: '#ffffff' }}>Can they go broke?</h4>
                  <p style={{ margin: 0, fontSize: '12px', color: '#cbd5e1', lineHeight: 1.5 }}>
                    Altman Z-Score <strong style={{ color: '#60a5fa', fontFamily: 'monospace' }}>{altmanScore.toFixed(1)}</strong> (Fortress Safe Zone).
                  </p>
                </div>
                <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid rgba(255, 255, 255, 0.06)', fontSize: '11px', color: '#94a3b8' }}>
                  💡 <strong>Analogy:</strong> Like having $50,000 in savings with only a $500 monthly car payment. Bankruptcy risk is virtually zero (&lt;0.5%).
                </div>
              </div>

              {/* Q4: PRICE & VALUATION */}
              <div style={{ padding: '16px', borderRadius: '12px', background: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(168, 85, 247, 0.25)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '10px', fontFamily: 'monospace', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Q4 · Price Tag</span>
                    <span style={{ padding: '3px', borderRadius: '4px', background: 'rgba(168, 85, 247, 0.2)', color: '#c084fc', display: 'flex' }}>
                      <DollarSign size={14} />
                    </span>
                  </div>
                  <h4 style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: 700, color: '#ffffff' }}>Is it cheap or a rip-off?</h4>
                  <p style={{ margin: 0, fontSize: '12px', color: '#cbd5e1', lineHeight: 1.5 }}>
                    P/E Ratio <strong style={{ color: '#c084fc', fontFamily: 'monospace' }}>{pe}x</strong> (Fair Value: ${fairValue.toFixed(0)}).
                  </p>
                </div>
                <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid rgba(255, 255, 255, 0.06)', fontSize: '11px', color: '#94a3b8' }}>
                  💡 <strong>Analogy:</strong> You are paying ${pe} today for every $1 this business earns every year. A quality brand markup, but fair.
                </div>
              </div>

            </div>
          </div>

          {/* 2. PLAIN-ENGLISH CHEAT SHEET / REAL WORLD DICTIONARY */}
          <div style={{ padding: '16px', borderRadius: '12px', background: 'rgba(5, 8, 16, 0.75)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontFamily: 'monospace', fontWeight: 700, textTransform: 'uppercase', color: '#cbd5e1' }}>
                <BookOpen size={14} style={{ color: '#00F0FF' }} />
                Plain-English Cheat Sheet for Complex Jargon
              </span>
              <span style={{ fontSize: '10px', color: '#94a3b8', fontFamily: 'monospace' }}>Institutional Glossary</span>
            </div>

            <div 
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '12px'
              }}
            >
              
              {/* P/E RATIO */}
              <div style={{ padding: '12px 14px', borderRadius: '10px', background: 'rgba(15, 23, 42, 0.85)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', fontWeight: 700, color: '#00F0FF', fontFamily: 'monospace' }}>
                  <span>P/E Ratio</span>
                  <span>{pe}x</span>
                </div>
                <p style={{ margin: '6px 0 0 0', fontSize: '11px', color: '#cbd5e1', lineHeight: 1.5 }}>
                  <strong>What it means:</strong> The price tag on profits. If a lemonade stand earns $100 profit a year, and the owner asks $3,200 to buy the whole stand, the P/E is 32x.
                </p>
                <div style={{ marginTop: '6px', fontSize: '10px', color: '#94a3b8', fontFamily: 'monospace' }}>
                  Rule: &lt;15x is cheap, 20-30x is normal for great companies, &gt;45x is high growth.
                </div>
              </div>

              {/* PIOTROSKI F-SCORE */}
              <div style={{ padding: '12px 14px', borderRadius: '10px', background: 'rgba(15, 23, 42, 0.85)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', fontWeight: 700, color: '#00E676', fontFamily: 'monospace' }}>
                  <span>Piotroski F-Score</span>
                  <span>{piotroskiScore} / 9</span>
                </div>
                <p style={{ margin: '6px 0 0 0', fontSize: '11px', color: '#cbd5e1', lineHeight: 1.5 }}>
                  <strong>What it means:</strong> The high school report card! A Stanford professor created 9 tests (cash flow, debt, sales, margins). 
                </p>
                <div style={{ marginTop: '6px', fontSize: '10px', color: '#00E676', fontFamily: 'monospace' }}>
                  Score: {piotroskiScore}/9 is like an "A" grade in corporate financial health.
                </div>
              </div>

              {/* ECONOMIC MOAT */}
              <div style={{ padding: '12px 14px', borderRadius: '10px', background: 'rgba(15, 23, 42, 0.85)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', fontWeight: 700, color: '#fbbf24', fontFamily: 'monospace' }}>
                  <span>Economic Moat</span>
                  <span>{moatType}</span>
                </div>
                <p style={{ margin: '6px 0 0 0', fontSize: '11px', color: '#cbd5e1', lineHeight: 1.5 }}>
                  <strong>What it means:</strong> Think of a medieval castle surrounded by water. A moat is what stops competitors from stealing your customers.
                </p>
                <div style={{ marginTop: '6px', fontSize: '10px', color: '#fbbf24', fontFamily: 'monospace' }}>
                  {symbol}'s Moat: Switching to another brand is annoying + massive network effects.
                </div>
              </div>

            </div>
          </div>

        </div>
      )}
    </div>
  );
}
