import React, { useState, useMemo } from 'react';
import { 
  Sliders, TrendingUp, AlertCircle, CheckCircle, HelpCircle, 
  RefreshCw, Award, Gauge, ArrowUpRight, ArrowDownRight, Layers
} from 'lucide-react';
import { calculateDCF, solveReverseDCF, generateSensitivityMatrix } from '../../utils/dcfEngine';

export default function DynamicValuationView({ 
  currentTicker,
  currentPrice,
  valuationData,
  fundamentals
}) {
  const activeTicker = currentTicker || valuationData?.ticker || fundamentals?.ticker || 'STOCK';
  const livePrice = valuationData?.current_price || currentPrice || fundamentals?.fair_value_data?.current_price || 100.0;

  const baseFinancials = useMemo(() => {
    if (valuationData?.base_financials) {
      return valuationData.base_financials;
    }
    const latestAnn = fundamentals?.annual_history?.length ? fundamentals.annual_history[fundamentals.annual_history.length - 1] : {};
    const latestQ = fundamentals?.history?.length ? fundamentals.history[fundamentals.history.length - 1] : {};
    const dynRev = latestAnn.revenue || (latestQ.revenue ? latestQ.revenue * 4 : 20e9);
    const dynFcf = latestAnn.fcf || (latestQ.fcf ? latestQ.fcf * 4 : dynRev * 0.15);
    const shares = fundamentals?.profile?.shares_outstanding || 1e9;
    return {
      revenue: dynRev,
      fcf: dynFcf,
      shares: shares,
      cash: (fundamentals?.profile?.market_cap ? fundamentals.profile.market_cap * 0.08 : 5e9),
      debt: (fundamentals?.profile?.market_cap ? fundamentals.profile.market_cap * 0.12 : 8e9),
      historical_margin: fundamentals?.profile?.operating_margin || 0.22,
      beta: fundamentals?.profile?.beta || 1.05
    };
  }, [valuationData, fundamentals]);

  // Presets
  const presets = {
    bear: { growth: 0.03, margin: 0.22, tg: 0.018, wacc: 0.105, exitMult: 14 },
    base: { growth: 0.10, margin: 0.28, tg: 0.025, wacc: 0.088, exitMult: 20 },
    bull: { growth: 0.18, margin: 0.34, tg: 0.032, wacc: 0.078, exitMult: 26 }
  };

  const [activePreset, setActivePreset] = useState('base');
  const [growthRate, setGrowthRate] = useState(presets.base.growth);
  const [operatingMargin, setOperatingMargin] = useState(presets.base.margin);
  const [terminalGrowth, setTerminalGrowth] = useState(presets.base.tg);
  const [wacc, setWacc] = useState(presets.base.wacc);
  const [useExitMultiple, setUseExitMultiple] = useState(false);
  const [exitMultiple, setExitMultiple] = useState(presets.base.exitMult);

  const applyPreset = (key) => {
    setActivePreset(key);
    setGrowthRate(presets[key].growth);
    setOperatingMargin(presets[key].margin);
    setTerminalGrowth(presets[key].tg);
    setWacc(presets[key].wacc);
    setExitMultiple(presets[key].exitMult);
  };

  const dcfParams = useMemo(() => ({
    baseRevenue: baseFinancials.revenue,
    baseFCF: baseFinancials.fcf,
    sharesOutstanding: baseFinancials.shares,
    totalCash: baseFinancials.cash,
    totalDebt: baseFinancials.debt,
    growthRate5Y: growthRate,
    targetOperatingMargin: operatingMargin,
    terminalGrowthRate: terminalGrowth,
    wacc: wacc,
    useMargin: true,
    exitMultiple: useExitMultiple ? exitMultiple : null,
    currentPrice: livePrice
  }), [baseFinancials, growthRate, operatingMargin, terminalGrowth, wacc, useExitMultiple, exitMultiple, livePrice]);

  const valuation = useMemo(() => calculateDCF(dcfParams), [dcfParams]);
  const reverseDcf = useMemo(() => solveReverseDCF(dcfParams, livePrice), [dcfParams, livePrice]);
  const sensitivityMatrix = useMemo(() => generateSensitivityMatrix(dcfParams, livePrice), [dcfParams, livePrice]);

  const isUndervalued = valuation.fairValue > livePrice;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl text-slate-100 space-y-8">
      
      {/* Header & Scenario Presets */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div className="flex items-center gap-3">
          <span className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Sliders size={22} />
          </span>
          <div>
            <h2 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
              Dynamic DCF & Sensitivity Engine
              <span className="text-xs uppercase px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-mono font-bold">
                60 FPS Live Modeler
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Stress-test revenue CAGR, operating margin, discount rates, and terminal exit multiples in real time.
            </p>
          </div>
        </div>

        {/* Preset Buttons */}
        <div className="flex items-center bg-slate-800/60 p-1.5 rounded-2xl border border-slate-700/60">
          <button
            onClick={() => applyPreset('bear')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activePreset === 'bear' 
                ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/25' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Bear Case
          </button>
          <button
            onClick={() => applyPreset('base')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activePreset === 'base' 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Base Case
          </button>
          <button
            onClick={() => applyPreset('bull')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activePreset === 'bull' 
                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Bull Case
          </button>
        </div>
      </div>

      {/* Intrinsic Valuation Callout Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 bg-slate-800/40 p-6 rounded-2xl border border-slate-700/50">
        <div className="flex flex-col justify-center">
          <span className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Intrinsic Fair Value</span>
          <div className="flex items-baseline gap-3">
            <span className="text-5xl font-black text-white tracking-tight font-mono">
              ${valuation.fairValue.toFixed(2)}
            </span>
            <span className="text-sm font-semibold text-slate-400 font-mono">
              vs ${livePrice.toFixed(2)} Mkt
            </span>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span className={`flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full border ${
              isUndervalued 
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
            }`}>
              {isUndervalued ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}
              {Math.abs(valuation.upsidePct)}% {isUndervalued ? 'Undervalued (Upside)' : 'Overvalued (Downside)'}
            </span>
          </div>
        </div>

        {/* Reverse DCF Market Reality Check */}
        <div className="lg:col-span-2 flex flex-col justify-center bg-slate-900/70 p-5 rounded-xl border border-slate-700/60">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Gauge size={18} className="text-cyan-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Reverse DCF Market Implication
              </span>
            </div>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${reverseDcf.bg} ${reverseDcf.color}`}>
              {reverseDcf.category}
            </span>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed">
            At the current market price of <span className="font-bold text-white">${livePrice.toFixed(2)}</span>, 
            the market is pricing in exactly <span className="font-black text-cyan-400">{reverseDcf.impliedGrowthPct}% annual revenue growth</span> for the next 5 years (with {(terminalGrowth * 100).toFixed(1)}% terminal growth and {(wacc * 100).toFixed(1)}% WACC).
          </p>
        </div>
      </div>

      {/* Sliders Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Slider 1: Revenue Growth */}
        <div className="bg-slate-800/30 p-5 rounded-2xl border border-slate-700/40 space-y-3">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300">5-Year Revenue CAGR</label>
            <div className="bg-slate-900 px-3 py-1 rounded-lg border border-slate-700">
              <span className="text-blue-400 font-mono font-black text-sm">{(growthRate * 100).toFixed(1)}%</span>
            </div>
          </div>
          <input
            type="range"
            min="-0.10"
            max="0.50"
            step="0.005"
            value={growthRate}
            onChange={(e) => {
              setActivePreset('custom');
              setGrowthRate(parseFloat(e.target.value));
            }}
            className="w-full accent-blue-500 bg-slate-700 h-2 rounded-lg cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
            <span>-10% (Contraction)</span>
            <span>+15% (Healthy)</span>
            <span>+50% (Hyper Growth)</span>
          </div>
        </div>

        {/* Slider 2: Target Operating Margin */}
        <div className="bg-slate-800/30 p-5 rounded-2xl border border-slate-700/40 space-y-3">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300">Target Operating Margin</label>
            <div className="bg-slate-900 px-3 py-1 rounded-lg border border-slate-700">
              <span className="text-purple-400 font-mono font-black text-sm">{(operatingMargin * 100).toFixed(1)}%</span>
            </div>
          </div>
          <input
            type="range"
            min="0.05"
            max="0.60"
            step="0.005"
            value={operatingMargin}
            onChange={(e) => {
              setActivePreset('custom');
              setOperatingMargin(parseFloat(e.target.value));
            }}
            className="w-full accent-purple-500 bg-slate-700 h-2 rounded-lg cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
            <span>5% (Commodity)</span>
            <span>30% (Standard)</span>
            <span>60% (Monopolist)</span>
          </div>
        </div>

        {/* Slider 3: Terminal Value Method */}
        <div className="bg-slate-800/30 p-5 rounded-2xl border border-slate-700/40 space-y-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                {useExitMultiple ? 'Exit Multiple (EV/FCF)' : 'Terminal Growth (g)'}
              </label>
              <button 
                onClick={() => setUseExitMultiple(!useExitMultiple)} 
                className="text-[9px] uppercase font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20 hover:bg-cyan-500/20"
              >
                Switch to {useExitMultiple ? 'Perpetuity' : 'Multiple'}
              </button>
            </div>
            <div className="bg-slate-900 px-3 py-1 rounded-lg border border-slate-700">
              <span className="text-cyan-400 font-mono font-black text-sm">
                {useExitMultiple ? `${exitMultiple.toFixed(1)}x` : `${(terminalGrowth * 100).toFixed(2)}%`}
              </span>
            </div>
          </div>
          {useExitMultiple ? (
            <input
              type="range"
              min="10"
              max="40"
              step="1"
              value={exitMultiple}
              onChange={(e) => {
                setActivePreset('custom');
                setExitMultiple(parseFloat(e.target.value));
              }}
              className="w-full accent-cyan-500 bg-slate-700 h-2 rounded-lg cursor-pointer"
            />
          ) : (
            <input
              type="range"
              min="0.015"
              max="0.040"
              step="0.001"
              value={terminalGrowth}
              onChange={(e) => {
                setActivePreset('custom');
                setTerminalGrowth(parseFloat(e.target.value));
              }}
              className="w-full accent-cyan-500 bg-slate-700 h-2 rounded-lg cursor-pointer"
            />
          )}
          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
            <span>{useExitMultiple ? '10x' : '1.5% (Conservative)'}</span>
            <span>{useExitMultiple ? '25x' : '2.5% (GDP Match)'}</span>
            <span>{useExitMultiple ? '40x' : '4.0% (Aggressive)'}</span>
          </div>
        </div>

        {/* Slider 4: Discount Rate (WACC) */}
        <div className="bg-slate-800/30 p-5 rounded-2xl border border-slate-700/40 space-y-3">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300">Discount Rate (WACC)</label>
            <div className="bg-slate-900 px-3 py-1 rounded-lg border border-slate-700">
              <span className="text-amber-400 font-mono font-black text-sm">{(wacc * 100).toFixed(1)}%</span>
            </div>
          </div>
          <input
            type="range"
            min="0.06"
            max="0.16"
            step="0.002"
            value={wacc}
            onChange={(e) => {
              setActivePreset('custom');
              setWacc(parseFloat(e.target.value));
            }}
            className="w-full accent-amber-500 bg-slate-700 h-2 rounded-lg cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
            <span>6% (Mega-Cap Safety)</span>
            <span>10% (Market Average)</span>
            <span>16% (High Beta / Debt)</span>
          </div>
        </div>
      </div>

      {/* Tornado Sensitivity Matrix (5x5 Grid) */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-black text-white flex items-center gap-2">
              <Layers className="text-blue-400" size={20} />
              Tornado Valuation Sensitivity (WACC vs Terminal Growth)
            </h3>
            <p className="text-xs text-slate-400">
              Fair value per share across variations in cost of capital and perpetuity assumptions.
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs font-bold">
            <span className="flex items-center gap-1 text-emerald-400">
              <span className="w-2.5 h-2.5 rounded bg-emerald-500/60 inline-block"></span> Undervalued
            </span>
            <span className="flex items-center gap-1 text-rose-400">
              <span className="w-2.5 h-2.5 rounded bg-rose-500/60 inline-block"></span> Overvalued
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-center border-collapse text-xs">
            <thead>
              <tr>
                <th className="p-3 bg-slate-800 text-slate-400 uppercase font-black tracking-wider border border-slate-700/60 rounded-tl-xl">
                  WACC \ Term. Growth
                </th>
                {sensitivityMatrix[0].map((cell, idx) => (
                  <th key={idx} className="p-3 bg-slate-800 text-cyan-300 font-mono font-bold border border-slate-700/60">
                    {cell.terminalGrowth}%
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sensitivityMatrix.map((row, rowIdx) => (
                <tr key={rowIdx}>
                  <td className="p-3 bg-slate-800/90 text-amber-300 font-mono font-black border border-slate-700/60">
                    {row[0].wacc}%
                  </td>
                  {row.map((cell, colIdx) => {
                    const isCellUndervalued = cell.fairValue > livePrice;
                    const diff = cell.fairValue - livePrice;
                    const pct = ((diff / livePrice) * 100);

                    let bgStyle = 'bg-slate-800/40 text-slate-300';
                    if (pct > 20) bgStyle = 'bg-emerald-600/30 text-emerald-300 font-bold';
                    else if (pct > 5) bgStyle = 'bg-emerald-500/15 text-emerald-400';
                    else if (pct < -20) bgStyle = 'bg-rose-600/30 text-rose-300 font-bold';
                    else if (pct < -5) bgStyle = 'bg-rose-500/15 text-rose-400';

                    return (
                      <td 
                        key={colIdx} 
                        className={`p-3 border border-slate-700/60 font-mono transition-colors relative ${bgStyle} ${
                          cell.isBase ? 'ring-2 ring-blue-400 z-10' : ''
                        }`}
                      >
                        <div className="text-sm font-black">${cell.fairValue.toFixed(2)}</div>
                        <div className={`text-[10px] ${isCellUndervalued ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {pct > 0 ? '+' : ''}{pct.toFixed(0)}%
                        </div>
                        {cell.isBase && (
                          <span className="absolute -top-1.5 -right-1.5 bg-blue-500 text-white text-[8px] font-black uppercase px-1 rounded">
                            Base
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
