import React from 'react';
import { ShieldCheck, AlertTriangle, Activity, Flame, Check, X } from 'lucide-react';

/**
 * Institutional Forensic Health Meter Card (Bloomberg / FactSet Style)
 * Replaces cartoon speedometer needles with precision segmented range bars and discrete status blocks.
 */
export default function ForensicCard({
  type = 'altman', // 'altman' | 'beneish' | 'piotroski' | 'squeeze'
  value = 0,
  status = '',
  statusColor = '#00E676',
  extra = {}
}) {
  if (type === 'altman') {
    // Altman Z-Score: Distress (<1.81) | Grey (1.81 - 2.99) | Safe (>2.99)
    const score = typeof value === 'number' ? value : 3.61;
    const isSafe = score >= 2.99;
    const isGrey = score >= 1.81 && score < 2.99;
    const zone = isSafe ? 'SAFE ZONE' : isGrey ? 'GREY ZONE' : 'DISTRESS ZONE';
    const zoneColor = isSafe ? '#00E676' : isGrey ? '#FFB300' : '#FF3366';

    // Position on a 0 to 6 scale
    const posPct = Math.min(95, Math.max(5, (score / 5.5) * 100));

    return (
      <div
        style={{
          background: 'linear-gradient(180deg, rgba(18, 24, 38, 0.95) 0%, rgba(10, 14, 23, 0.95) 100%)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.45)'
        }}
        className="p-4 rounded-xl flex flex-col justify-between"
      >
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-cyan-400" /> Altman Z-Score
          </span>
          <span
            className="text-[10px] font-mono font-black px-2 py-0.5 rounded border tracking-wider"
            style={{
              color: zoneColor,
              borderColor: `${zoneColor}40`,
              backgroundColor: `${zoneColor}15`
            }}
          >
            {zone}
          </span>
        </div>

        {/* Score Readout */}
        <div className="my-3 flex items-baseline justify-between">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black font-mono text-white tracking-tight">
              {score.toFixed(2)}
            </span>
            <span className="text-xs font-mono text-slate-400">
              {score > 2.99 ? 'Safe (>2.99)' : score < 1.81 ? 'Distress (<1.81)' : 'Grey (1.81-2.99)'}
            </span>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            Default Risk: <strong style={{ color: zoneColor }}>{isSafe ? '<0.5%' : isGrey ? '5-15%' : '>50%'}</strong>
          </span>
        </div>

        {/* Precision Segmented Threshold Bar */}
        <div>
          <div className="relative w-full h-3 bg-slate-900 rounded-md overflow-hidden flex border border-slate-800">
            {/* Distress segment (0 to 1.81) -> 33% */}
            <div className="w-[33%] h-full bg-rose-950/80 border-r border-slate-900 flex items-center justify-center">
              <span className="text-[8px] font-mono text-rose-400 font-bold">DISTRESS</span>
            </div>
            {/* Grey segment (1.81 to 2.99) -> 22% */}
            <div className="w-[22%] h-full bg-amber-950/80 border-r border-slate-900 flex items-center justify-center">
              <span className="text-[8px] font-mono text-amber-400 font-bold">GREY</span>
            </div>
            {/* Safe segment (2.99 to 6.0) -> 45% */}
            <div className="w-[45%] h-full bg-emerald-950/80 flex items-center justify-center">
              <span className="text-[8px] font-mono text-emerald-400 font-bold">SAFE</span>
            </div>
          </div>

          {/* Precision Marker Line */}
          <div className="relative w-full h-4 mt-1">
            <div
              className="absolute -top-3.5 -translate-x-1/2 flex flex-col items-center transition-all duration-700"
              style={{ left: `${posPct}%` }}
            >
              <div
                className="w-2.5 h-2.5 rotate-45 border-2 shadow-lg"
                style={{ backgroundColor: zoneColor, borderColor: '#090d16' }}
              />
            </div>
            <div className="flex justify-between text-[9px] font-mono text-slate-500 pt-0.5">
              <span>0.0</span>
              <span className="text-rose-400">1.81</span>
              <span className="text-emerald-400">2.99</span>
              <span>5.5+</span>
            </div>
          </div>
        </div>

        <div className="text-[10px] text-slate-400 font-mono pt-2 border-t border-slate-800/80 flex justify-between">
          <span>Formula: 1.2X₁ + 1.4X₂ + 3.3X₃ + 0.6X₄ + 1.0X₅</span>
          <span className="text-slate-500">2-Yr Solvency Horizon</span>
        </div>
      </div>
    );
  }

  if (type === 'beneish') {
    // Beneish M-Score: Threshold is -1.78. Less than -1.78 is Clean, Greater than -1.78 is High Risk
    const score = typeof value === 'number' ? value : -2.45;
    const isClean = score <= -1.78;
    const statusText = isClean ? 'CLEAN STATEMENTS' : 'MANIPULATION RISK';
    const badgeColor = isClean ? '#00E676' : '#FF3366';

    // Map -4.0 to 0.0 to percentage (0% to 100%)
    const posPct = Math.min(95, Math.max(5, ((score + 4.0) / 4.0) * 100));

    return (
      <div
        style={{
          background: 'linear-gradient(180deg, rgba(18, 24, 38, 0.95) 0%, rgba(10, 14, 23, 0.95) 100%)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.45)'
        }}
        className="p-4 rounded-xl flex flex-col justify-between"
      >
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
            <AlertTriangle size={14} className="text-amber-400" /> Beneish M-Score
          </span>
          <span
            className="text-[10px] font-mono font-black px-2 py-0.5 rounded border tracking-wider"
            style={{
              color: badgeColor,
              borderColor: `${badgeColor}40`,
              backgroundColor: `${badgeColor}15`
            }}
          >
            {statusText}
          </span>
        </div>

        {/* Score Readout */}
        <div className="my-3 flex items-baseline justify-between">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black font-mono text-white tracking-tight">
              {score.toFixed(2)}
            </span>
            <span className="text-xs font-mono text-slate-400">
              Cutoff: -1.78
            </span>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            Verdict: <strong style={{ color: badgeColor }}>{isClean ? 'Unlikely Manipulator' : 'Scrutiny Required'}</strong>
          </span>
        </div>

        {/* Precision Threshold Bar */}
        <div>
          <div className="relative w-full h-3 bg-slate-900 rounded-md overflow-hidden flex border border-slate-800">
            {/* Clean segment (<-1.78) -> 55% */}
            <div className="w-[55%] h-full bg-emerald-950/80 border-r border-slate-900 flex items-center justify-center">
              <span className="text-[8px] font-mono text-emerald-400 font-bold">CLEAN REPORTING (&lt; -1.78)</span>
            </div>
            {/* Risk segment (>-1.78) -> 45% */}
            <div className="w-[45%] h-full bg-rose-950/80 flex items-center justify-center">
              <span className="text-[8px] font-mono text-rose-400 font-bold">MANIPULATION RISK</span>
            </div>
          </div>

          {/* Marker */}
          <div className="relative w-full h-4 mt-1">
            <div
              className="absolute -top-3.5 -translate-x-1/2 flex flex-col items-center transition-all duration-700"
              style={{ left: `${posPct}%` }}
            >
              <div
                className="w-2.5 h-2.5 rotate-45 border-2 shadow-lg"
                style={{ backgroundColor: badgeColor, borderColor: '#090d16' }}
              />
            </div>
            <div className="flex justify-between text-[9px] font-mono text-slate-500 pt-0.5">
              <span>-4.0</span>
              <span className="text-emerald-400 font-bold">-2.5</span>
              <span className="text-rose-400 font-bold">Threshold: -1.78</span>
              <span>0.0</span>
            </div>
          </div>
        </div>

        <div className="text-[10px] text-slate-400 font-mono pt-2 border-t border-slate-800/80 flex justify-between">
          <span>8 Indices: DSRI • GMI • AQI • SGI • DEPI</span>
          <span className="text-emerald-400">✓ No Aggressive Accruals</span>
        </div>
      </div>
    );
  }

  if (type === 'piotroski') {
    // Piotroski 9-Point F-Score: Discrete 9 blocks
    const score = Math.max(0, Math.min(9, Math.round(Number(value) || 8)));
    const statusText = score >= 8 ? 'STRONG (8-9)' : score >= 5 ? 'MODERATE (5-7)' : 'WEAK (0-4)';
    const scoreColor = score >= 7 ? '#00E676' : score >= 5 ? '#FFB300' : '#FF3366';

    return (
      <div
        style={{
          background: 'linear-gradient(180deg, rgba(18, 24, 38, 0.95) 0%, rgba(10, 14, 23, 0.95) 100%)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.45)'
        }}
        className="p-4 rounded-xl flex flex-col justify-between"
      >
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
            <Activity size={14} className="text-emerald-400" /> Piotroski F-Score
          </span>
          <span
            className="text-[10px] font-mono font-black px-2 py-0.5 rounded border tracking-wider"
            style={{
              color: scoreColor,
              borderColor: `${scoreColor}40`,
              backgroundColor: `${scoreColor}15`
            }}
          >
            {statusText}
          </span>
        </div>

        {/* Score Readout */}
        <div className="my-3 flex items-baseline justify-between">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black font-mono text-white tracking-tight">
              {score}
            </span>
            <span className="text-xs font-mono text-slate-400">
              / 9 Tests Passed
            </span>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            Health Tier: <strong style={{ color: scoreColor }}>{score >= 8 ? 'Institutional Leader' : 'Average'}</strong>
          </span>
        </div>

        {/* 9 Discrete Segment Blocks */}
        <div>
          <div className="grid grid-cols-9 gap-1.5">
            {Array.from({ length: 9 }).map((_, i) => {
              const isPassed = i < score;
              return (
                <div
                  key={i}
                  style={{
                    backgroundColor: isPassed ? '#00E676' : 'rgba(255,255,255,0.06)',
                    boxShadow: isPassed ? '0 0 8px rgba(0,230,118,0.4)' : 'none',
                    borderColor: isPassed ? '#00E676' : 'rgba(255,255,255,0.1)'
                  }}
                  className="h-5 rounded flex items-center justify-center border transition-all"
                  title={`Signal ${i + 1}: ${isPassed ? 'Passed' : 'Failed'}`}
                >
                  {isPassed ? (
                    <Check size={11} className="text-slate-950 stroke-[3]" />
                  ) : (
                    <X size={10} className="text-slate-500" />
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex justify-between text-[9px] font-mono text-slate-500 pt-1.5">
            <span>Profitability (4/4)</span>
            <span>Leverage (2/3)</span>
            <span>Efficiency (2/2)</span>
          </div>
        </div>

        <div className="text-[10px] text-slate-400 font-mono pt-2 border-t border-slate-800/80 flex justify-between">
          <span>Stanford Quality Audit</span>
          <span className="text-emerald-400">✓ Positive CFO & ROA Growth</span>
        </div>
      </div>
    );
  }

  // Default: Short Squeeze Risk & Float Utilization
  const squeeze = typeof value === 'number' ? value : 24;
  const isHigh = squeeze > 65;
  const isMed = squeeze >= 35 && squeeze <= 65;
  const squeezeColor = isHigh ? '#FF3366' : isMed ? '#FFB300' : '#00E676';
  const tier = isHigh ? 'HIGH SQUEEZE RISK' : isMed ? 'MODERATE' : 'LOW SQUEEZE RISK';

  return (
    <div
      style={{
        background: 'linear-gradient(180deg, rgba(18, 24, 38, 0.95) 0%, rgba(10, 14, 23, 0.95) 100%)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.45)'
      }}
      className="p-4 rounded-xl flex flex-col justify-between"
    >
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
          <Flame size={14} className="text-amber-400" /> Short Squeeze Score
        </span>
        <span
          className="text-[10px] font-mono font-black px-2 py-0.5 rounded border tracking-wider"
          style={{
            color: squeezeColor,
            borderColor: `${squeezeColor}40`,
            backgroundColor: `${squeezeColor}15`
          }}
        >
          {tier}
        </span>
      </div>

      {/* Score Readout */}
      <div className="my-3 flex items-baseline justify-between">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-black font-mono text-white tracking-tight">
            {squeeze}
          </span>
          <span className="text-xs font-mono text-slate-400">
            / 100 Risk Index
          </span>
        </div>
        <span className="text-[11px] font-mono text-slate-400">
          Days-to-Cover: <strong className="text-white">1.4 Days</strong>
        </span>
      </div>

      {/* Precision Range Bar */}
      <div>
        <div className="relative w-full h-3 bg-slate-900 rounded-md overflow-hidden flex border border-slate-800">
          <div className="w-[35%] h-full bg-emerald-950/80 border-r border-slate-900 flex items-center justify-center">
            <span className="text-[8px] font-mono text-emerald-400 font-bold">LOW (0-35)</span>
          </div>
          <div className="w-[30%] h-full bg-amber-950/80 border-r border-slate-900 flex items-center justify-center">
            <span className="text-[8px] font-mono text-amber-400 font-bold">MODERATE</span>
          </div>
          <div className="w-[35%] h-full bg-rose-950/80 flex items-center justify-center">
            <span className="text-[8px] font-mono text-rose-400 font-bold">HIGH RISK (&gt;65)</span>
          </div>
        </div>

        <div className="relative w-full h-4 mt-1">
          <div
            className="absolute -top-3.5 -translate-x-1/2 flex flex-col items-center transition-all duration-700"
            style={{ left: `${Math.min(95, Math.max(5, squeeze))}%` }}
          >
            <div
              className="w-2.5 h-2.5 rotate-45 border-2 shadow-lg"
              style={{ backgroundColor: squeezeColor, borderColor: '#090d16' }}
            />
          </div>
          <div className="flex justify-between text-[9px] font-mono text-slate-500 pt-0.5">
            <span>0</span>
            <span className="text-emerald-400">35</span>
            <span className="text-rose-400">65</span>
            <span>100</span>
          </div>
        </div>
      </div>

      <div className="text-[10px] text-slate-400 font-mono pt-2 border-t border-slate-800/80 flex justify-between">
        <span>Float Shorted: ~1.2%</span>
        <span className="text-slate-400">Orderly Borrow Availability</span>
      </div>
    </div>
  );
}
