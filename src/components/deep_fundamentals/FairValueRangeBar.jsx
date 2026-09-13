import React from 'react';
import { DollarSign, Target, TrendingUp, AlertCircle, ArrowUpRight, ArrowDownRight } from 'lucide-react';

/**
 * Finbox / SimplyWallSt Style Multi-Point Valuation Range Bar
 * Visualizes 52W Low, Current Market Price, Wall St Consensus Target, and DCF Intrinsic Fair Value.
 */
export default function FairValueRangeBar({
  currentPrice = 185.0,
  fairValue = 214.50,
  targetPrice = 205.0,
  week52Low = 164.0,
  week52High = 237.0,
  discountPct = 15.9
}) {
  const minRange = Math.min(week52Low * 0.95, currentPrice * 0.9, fairValue * 0.9);
  const maxRange = Math.max(week52High * 1.05, currentPrice * 1.1, fairValue * 1.1);
  const span = maxRange - minRange || 1;

  const getPct = (val) => Math.min(96, Math.max(4, ((val - minRange) / span) * 100));

  const currentPos = getPct(currentPrice);
  const fairValuePos = getPct(fairValue);
  const targetPos = getPct(targetPrice);

  const isUndervalued = fairValue >= currentPrice;
  const statusColor = isUndervalued ? '#00E676' : '#FF3366';

  return (
    <div
      style={{
        background: '#12161F',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.06)'
      }}
      className="p-4 rounded-lg flex flex-col justify-between"
    >
      <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <DollarSign size={16} />
          </div>
          <div>
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200">
              Valuation Spectrum Barometer
            </h4>
            <span className="text-[10px] text-slate-400 font-mono">
              Current vs. DCF Fair Value vs. Wall St Target
            </span>
          </div>
        </div>

        <span
          className="text-xs font-mono font-black px-2.5 py-1 rounded-md border"
          style={{
            color: statusColor,
            borderColor: `${statusColor}50`,
            backgroundColor: `${statusColor}15`
          }}
        >
          {Math.abs(discountPct).toFixed(1)}% {isUndervalued ? 'Undervalued' : 'Overvalued'}
        </span>
      </div>

      {/* Spectrum Bar Body */}
      <div className="py-6 px-3 relative">
        {/* Multi-zone gradient track */}
        <div
          className="w-full h-3.5 rounded-full relative overflow-hidden shadow-inner"
          style={{
            background: 'linear-gradient(90deg, rgba(0, 230, 118, 0.7) 0%, rgba(255, 179, 0, 0.7) 50%, rgba(255, 51, 102, 0.7) 100%)'
          }}
        />

        {/* 52W Low Marker (Left) */}
        <div className="absolute left-3 top-1 text-[10px] font-mono text-slate-500">
          52W L: ${week52Low.toFixed(0)}
        </div>

        {/* 52W High Marker (Right) */}
        <div className="absolute right-3 top-1 text-[10px] font-mono text-slate-500">
          52W H: ${week52High.toFixed(0)}
        </div>

        {/* Current Price Pin */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex flex-col items-center z-20 transition-all duration-700"
          style={{ left: `${currentPos}%` }}
        >
          <div className="w-5 h-5 rounded-full bg-slate-950 border-2 border-white flex items-center justify-center shadow-[0_0_12px_#ffffff]">
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-400"></div>
          </div>
          <div className="absolute top-6 whitespace-nowrap bg-slate-900/90 border border-slate-700 px-2 py-0.5 rounded text-[10px] font-mono font-bold text-white shadow-lg">
            Mkt: ${currentPrice.toFixed(2)}
          </div>
        </div>

        {/* Fair Value Pin */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex flex-col items-center z-30 transition-all duration-700"
          style={{ left: `${fairValuePos}%` }}
        >
          <div
            className="w-5 h-5 rounded-full bg-slate-950 border-2 flex items-center justify-center shadow-lg"
            style={{
              borderColor: statusColor,
              boxShadow: `0 0 12px ${statusColor}`
            }}
          >
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: statusColor }}></div>
          </div>
          <div
            className="absolute -top-6 whitespace-nowrap px-2 py-0.5 rounded text-[10px] font-mono font-black border shadow-lg"
            style={{
              color: statusColor,
              borderColor: `${statusColor}60`,
              backgroundColor: '#090d16'
            }}
          >
            DCF: ${fairValue.toFixed(2)}
          </div>
        </div>

        {/* Wall St Consensus Target Pin */}
        {targetPrice > 0 && Math.abs(targetPos - fairValuePos) > 6 && Math.abs(targetPos - currentPos) > 6 && (
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex flex-col items-center z-15"
            style={{ left: `${targetPos}%` }}
          >
            <div className="w-3.5 h-3.5 rounded-full bg-slate-900 border border-amber-400 flex items-center justify-center">
              <div className="w-1 h-1 rounded-full bg-amber-400"></div>
            </div>
            <div className="absolute top-6 whitespace-nowrap bg-slate-950/80 border border-slate-800 px-1.5 py-0.2 rounded text-[9px] font-mono text-amber-300">
              Analyst: ${targetPrice.toFixed(0)}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Summary Grid */}
      <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-800 text-center font-mono">
        <div className="bg-slate-950/60 p-1.5 rounded border border-slate-800">
          <span className="text-[9px] text-slate-400 block uppercase">Current Quote</span>
          <strong className="text-white text-xs">${currentPrice.toFixed(2)}</strong>
        </div>
        <div className="bg-slate-950/60 p-1.5 rounded border border-slate-800">
          <span className="text-[9px] text-slate-400 block uppercase">DCF Intrinsic</span>
          <strong style={{ color: statusColor }} className="text-xs">${fairValue.toFixed(2)}</strong>
        </div>
        <div className="bg-slate-950/60 p-1.5 rounded border border-slate-800">
          <span className="text-[9px] text-slate-400 block uppercase">Spread</span>
          <strong style={{ color: statusColor }} className="text-xs">
            {discountPct >= 0 ? `+${discountPct.toFixed(1)}%` : `${discountPct.toFixed(1)}%`}
          </strong>
        </div>
      </div>
    </div>
  );
}
