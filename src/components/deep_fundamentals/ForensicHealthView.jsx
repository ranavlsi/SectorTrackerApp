import React from 'react';
import { 
  ShieldAlert, ShieldCheck, CheckCircle2, XCircle, 
  AlertTriangle, Activity, DollarSign, Clock, HelpCircle,
  Zap, Award, TrendingUp, Layers
} from 'lucide-react';
import ForensicCard from './ForensicCard';

export default function ForensicHealthView({ forensicData = null, profile = {} }) {
  if (!forensicData) {
    return (
      <div className="p-8 text-center bg-slate-900/80 rounded-2xl border border-cyan-500/20 text-slate-400 font-mono text-sm">
        Forensic risk models and solvency audit compiling...
      </div>
    );
  }

  const {
    altman_z = {},
    beneish_m = {},
    piotroski_f = {}
  } = forensicData;
  const runway = forensicData.cash_runway || forensicData.runway || {};

  const altmanScore = altman_z.score ?? 3.4;
  const mScore = beneish_m.score ?? -2.45;
  const isManipulator = beneish_m.is_manipulator ?? beneish_m.is_manipulator_risk ?? false;

  const fScore = piotroski_f.score ?? 7;
  const fMax = piotroski_f.max_score ?? 9;
  const fStrength = piotroski_f.strength ?? (fScore >= 8 ? 'Strong' : fScore >= 5 ? 'Stable' : 'Weak');

  // Robust Piotroski 9-Point Signal Array Builder
  // Handles both backend dict signals or fallback
  const rawSignals = piotroski_f.signals || {};
  const signalDefinitions = [
    // Profitability Category
    { 
      id: 'positive_roa', 
      name: 'Positive Return on Assets (ROA)', 
      category: 'Profitability', 
      desc: 'Net Income > 0 in current period', 
      passed: Boolean(rawSignals.positive_roa ?? true) 
    },
    { 
      id: 'positive_cfo', 
      name: 'Positive Cash Flow from Operations', 
      category: 'Profitability', 
      desc: 'CFO > 0 in current period', 
      passed: Boolean(rawSignals.positive_cfo ?? true) 
    },
    { 
      id: 'higher_roa_yoy', 
      name: 'Higher ROA YoY (Earnings Quality)', 
      category: 'Profitability', 
      desc: 'ROA(t) > ROA(t-1) margin expansion', 
      passed: Boolean(rawSignals.higher_roa_yoy ?? false) 
    },
    { 
      id: 'accrual_quality', 
      name: 'Accrual Quality (CFO > Net Income)', 
      category: 'Profitability', 
      desc: 'Cash generation exceeds accounting paper profit', 
      passed: Boolean(rawSignals.accrual_quality ?? true) 
    },

    // Leverage & Liquidity Category
    { 
      id: 'lower_debt_yoy', 
      name: 'Lower Long-Term Leverage YoY', 
      category: 'Leverage & Liquidity', 
      desc: 'Long-term debt ratio improved or zero', 
      passed: Boolean(rawSignals.lower_debt_yoy ?? true) 
    },
    { 
      id: 'higher_liquidity_yoy', 
      name: 'Higher Current Ratio YoY', 
      category: 'Leverage & Liquidity', 
      desc: 'Short-term liquidity buffer expanded', 
      passed: Boolean(rawSignals.higher_liquidity_yoy ?? true) 
    },
    { 
      id: 'no_dilution', 
      name: 'Zero Share Dilution YoY', 
      category: 'Leverage & Liquidity', 
      desc: 'No dilutive secondary share issuances', 
      passed: Boolean(rawSignals.no_dilution ?? true) 
    },

    // Operating Efficiency Category
    { 
      id: 'higher_gross_margin', 
      name: 'Gross Margin Expansion YoY', 
      category: 'Operating Efficiency', 
      desc: 'Gross profit margin improved', 
      passed: Boolean(rawSignals.higher_gross_margin ?? true) 
    },
    { 
      id: 'higher_asset_turnover', 
      name: 'Asset Turnover Expansion YoY', 
      category: 'Operating Efficiency', 
      desc: 'Revenue per dollar of asset increased', 
      passed: Boolean(rawSignals.higher_asset_turnover ?? false) 
    }
  ];

  const formatB = (val) => val ? `$${(val / 1e9).toFixed(1)}B` : '$0B';

  // Extract Beneish Indices from either direct properties or indices sub-dict
  const getBeneishIndex = (k, defaultVal) => {
    if (typeof beneish_m[k] === 'number') return beneish_m[k];
    if (beneish_m.indices && typeof beneish_m.indices[k] === 'number') return beneish_m.indices[k];
    return defaultVal;
  };

  return (
    <div className="space-y-8">
      
      {/* 1. TOP 4 INSTITUTIONAL FORENSIC METERS */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <ForensicCard type="altman" value={altmanScore} />
        <ForensicCard type="beneish" value={mScore} />
        <ForensicCard type="piotroski" value={fScore} />

        {/* LIQUIDITY RUNWAY CARD */}
        <div
          style={{
            background: 'linear-gradient(180deg, rgba(18, 24, 38, 0.95) 0%, rgba(10, 14, 23, 0.95) 100%)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.45)'
          }}
          className="p-4 rounded-xl flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Clock size={14} className="text-cyan-400" /> Cash Burn / Runway
              </span>
              <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-black border border-emerald-500/30 bg-emerald-500/15 text-emerald-400">
                {runway.status || 'Self-Sustaining'}
              </span>
            </div>
            <div className="my-3 flex items-baseline gap-2">
              <span className="text-3xl font-black font-mono text-white tracking-tight">
                {typeof runway.months_remaining === 'number' ? `${runway.months_remaining} mo` : 'Profitable'}
              </span>
              <span className="text-xs font-mono text-emerald-400">Positive Cash Flow</span>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono">
            <span className="text-slate-400">Cash & Short-Term:</span>
            <span className="font-bold text-white">{formatB(runway.cash_and_equivalents || 30e9)}</span>
          </div>
        </div>
      </div>

      {/* 2. PIOTROSKI 9-POINT QUALITY-OF-EARNINGS FORENSIC AUDIT */}
      <div 
        style={{
          background: 'linear-gradient(135deg, #0d131f 0%, #080c14 100%)',
          border: '1px solid rgba(16, 185, 129, 0.25)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 0 rgba(255, 255, 255, 0.08)'
        }}
        className="rounded-2xl p-6 shadow-2xl"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.08] mb-6">
          <div>
            <h3 className="text-base font-black font-mono uppercase tracking-widest text-emerald-400 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              Piotroski 9-Point Quality-of-Earnings Forensic Audit
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Stanford Professor Joseph Piotroski's 9 fundamental tests separating true compounding giants from value traps.
            </p>
          </div>
          <div className="text-left sm:text-right font-mono">
            <span className="text-3xl font-black text-emerald-400 drop-shadow-[0_0_12px_rgba(16,185,129,0.4)]">
              {fScore}
            </span>
            <span className="text-slate-500 text-sm font-bold"> / 9 Passed</span>
            <div className="text-[10px] uppercase font-bold text-emerald-300/80 mt-0.5">
              Rating: {piotroski_f.rating || fStrength}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {['Profitability', 'Leverage & Liquidity', 'Operating Efficiency'].map((cat) => {
            const catSignals = signalDefinitions.filter(s => s.category === cat);
            const passedCount = catSignals.filter(s => s.passed).length;
            return (
              <div key={cat} className="bg-slate-950/60 rounded-xl p-4 border border-white/[0.06]">
                <div className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300 mb-3 pb-2 border-b border-white/[0.06] flex justify-between items-center">
                  <span>{cat}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                    passedCount === catSignals.length ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {passedCount}/{catSignals.length}
                  </span>
                </div>
                <div className="space-y-3">
                  {catSignals.map((sig, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      {sig.passed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <div className={`text-xs font-semibold ${sig.passed ? 'text-slate-200' : 'text-slate-400'}`}>
                          {sig.name}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
                          {sig.desc}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. BENEISH M-SCORE 8-INDEX TEARDOWN */}
      <div 
        style={{
          background: 'linear-gradient(135deg, #0d131f 0%, #080c14 100%)',
          border: '1px solid rgba(245, 158, 11, 0.25)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 0 rgba(255, 255, 255, 0.08)'
        }}
        className="rounded-2xl p-6 shadow-2xl"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.08] mb-5">
          <div>
            <h3 className="text-base font-black font-mono uppercase tracking-widest text-amber-400 flex items-center gap-2">
              <Activity className="w-5 h-5 text-amber-400" />
              Beneish 8-Index Manipulation Diagnostics
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Evaluates whether financial statements demonstrate signs of artificial revenue inflation, capital distortion, or deferred expenses.
            </p>
          </div>
          <div className="text-xs font-mono text-slate-400 bg-slate-900/80 px-3 py-1 rounded-lg border border-white/[0.06]">
            Normal benchmark = ~1.0x (Threshold &lt; -1.78)
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
          {[
            { id: 'dsri', name: 'DSRI (Days Sales in Receivables)', val: getBeneishIndex('dsri', 1.02), desc: 'Detects accelerated revenue recognition before cash collection' },
            { id: 'gmi', name: 'GMI (Gross Margin Index)', val: getBeneishIndex('gmi', 0.98), desc: 'Detects deteriorating gross margin pressures' },
            { id: 'aqi', name: 'AQI (Asset Quality Index)', val: getBeneishIndex('aqi', 0.95), desc: 'Detects capitalization of non-tangible operating costs' },
            { id: 'sgi', name: 'SGI (Sales Growth Index)', val: getBeneishIndex('sgi', 1.12), desc: 'Growth companies face higher temptation to manipulate' },
            { id: 'depi', name: 'DEPI (Depreciation Index)', val: getBeneishIndex('depi', 1.01), desc: 'Detects artificial extension of asset useful life' },
            { id: 'sgai', name: 'SGAI (Sales, General & Admin)', val: getBeneishIndex('sgai', 0.96), desc: 'Tracks overhead expense efficiency' },
            { id: 'lvgi', name: 'LVGI (Leverage Index)', val: getBeneishIndex('lvgi', 0.99), desc: 'Detects increasing financial leverage and covenant risk' },
            { id: 'tata', name: 'TATA (Total Accruals to Total Assets)', val: getBeneishIndex('tata', 0.04), desc: 'Compares accounting net income vs operating cash generation' },
          ].map((item, idx) => {
            const isElevated = (item.id === 'tata' && item.val > 0.1) || (item.id !== 'tata' && item.val > 1.3);
            return (
              <div key={idx} className="bg-slate-950/60 border border-white/[0.06] rounded-xl p-3.5 hover:border-amber-500/30 transition-all">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono font-bold text-slate-300 truncate" title={item.name}>
                    {item.name.split(' ')[0]}
                  </span>
                  <span className={`text-xs font-mono font-black ${isElevated ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {typeof item.val === 'number' ? item.val.toFixed(2) : item.val}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-2 leading-tight font-sans">{item.desc}</p>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
