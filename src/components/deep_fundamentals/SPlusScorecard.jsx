import React, { useState } from 'react';
import { 
  TrendingUp, TrendingDown, Clock, CheckCircle2, 
  AlertCircle, ArrowUpRight, ArrowDownRight, Layers,
  Compass, Share2, Sparkles, SlidersHorizontal, Sun, Moon,
  Zap, ArrowRight, ShieldAlert, Award
} from 'lucide-react';

/**
 * SPlusScorecard
 * Ultra-Vibrant Institutional & Editorial Earnings Review Scorecard modeled on
 * S-Plus Collective (First Fellow) ER Graphics, supercharged with vibrant neon
 * accents, interactive hurdle meters, PEAD drift horizons, and theme toggles.
 */
export default function SPlusScorecard({
  scorecards = [],
  ticker = 'STOCK',
  companyName,
  onSelectQuarter = null
}) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [themeMode, setThemeMode] = useState('vibrant_dark'); // 'vibrant_dark' (default neon terminal) | 'ivory' (tweet beige)
  const [copied, setCopied] = useState(false);

  const activeCard = (scorecards && scorecards.length > 0) ? scorecards[selectedIdx] : null;
  const displayTicker = ticker || activeCard?.ticker || 'STOCK';
  const displayCompanyName = companyName || activeCard?.company_name || `${displayTicker} Inc.`;

  if (!activeCard) {
    return (
      <div className="p-8 text-center bg-slate-900/80 rounded-2xl border border-cyan-500/20 text-slate-400 font-mono text-sm">
        Compiling vibrant quarterly review scorecard...
      </div>
    );
  }

  const {
    quarter = 'Q3 2026',
    release_date = 'September 10, 2026',
    verdict = 'PRINT MISS',
    verdict_type = 'miss',
    fundamentals = {},
    versus_consensus = {},
    growth = {},
    market_reaction = {},
    guidance_story = {},
    segments_breakdown = []
  } = activeCard;

  const isDark = themeMode === 'vibrant_dark';
  const isBeat = verdict_type === 'beat' || verdict.includes('BEAT');
  const isMiss = verdict_type === 'miss' || verdict.includes('MISS');

  const copySnapshot = () => {
    const summary = `${ticker} (${quarter}) Earnings Scorecard:\n` +
      `• Verdict: ${verdict}\n` +
      `• Revenue: ${fundamentals?.revenue_str} vs ${versus_consensus?.revenue?.street_str} (${versus_consensus?.revenue?.status_label})\n` +
      `• EPS: ${fundamentals?.eps_str} vs ${versus_consensus?.eps?.street_str} (${versus_consensus?.eps?.status_label})\n` +
      `• Market Reaction: ${market_reaction?.reaction_str} ${market_reaction?.session} — "${market_reaction?.headline}"`;
    navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Color Tokens
  const verdictBadgeBg = isBeat 
    ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-[0_0_15px_rgba(16,185,129,0.5)]' 
    : (isMiss 
        ? 'bg-gradient-to-r from-rose-600 to-red-700 text-white shadow-[0_0_15px_rgba(244,63,94,0.5)]' 
        : 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-[0_0_15px_rgba(245,158,11,0.5)]');

  return (
    <div className="space-y-4">
      
      {/* 1. TOP CONTROL BAR */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-950 rounded-xl border border-white/[0.1] shadow-lg">
        
        {/* Quarter Selector Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-1">
          <span className="text-[11px] font-mono text-cyan-400 uppercase tracking-widest font-bold flex items-center gap-1 mr-2">
            <Zap className="w-3.5 h-3.5 text-cyan-400" />
            Tenor:
          </span>
          {scorecards.map((sc, idx) => (
            <button
              key={idx}
              onClick={() => {
                setSelectedIdx(idx);
                if (onSelectQuarter) onSelectQuarter(sc);
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
                selectedIdx === idx
                  ? 'bg-cyan-500 text-slate-950 shadow-[0_0_12px_rgba(6,182,212,0.6)] scale-[1.03]'
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 border border-white/[0.05]'
              }`}
            >
              {sc.quarter}
            </button>
          ))}
        </div>

        {/* Theme & Share Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setThemeMode(isDark ? 'ivory' : 'vibrant_dark')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all border ${
              isDark 
                ? 'bg-slate-800 text-amber-300 border-amber-500/30 hover:bg-slate-700' 
                : 'bg-amber-100 text-slate-900 border-amber-300 hover:bg-amber-200'
            }`}
          >
            {isDark ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-slate-700" />}
            <span>{isDark ? 'S-Plus Ivory' : 'Vibrant Dark'}</span>
          </button>

          <button
            onClick={copySnapshot}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 shadow-sm"
          >
            <Share2 className="w-3.5 h-3.5 text-cyan-400" />
            <span>{copied ? 'Copied!' : 'Export'}</span>
          </button>
        </div>
      </div>

      {/* 2. THE SCORECARD CANVAS */}
      <div 
        className={`rounded-2xl p-6 md:p-8 transition-all duration-200 border shadow-2xl relative overflow-hidden ${
          isDark 
            ? 'bg-[#0B0F17] border-white/[0.12] text-slate-100' 
            : 'bg-[#F4E7E1] border-black/10 text-[#1A1817]'
        }`}
      >
        {/* Ambient Top Glow in Dark Mode */}
        {isDark && (
          <div 
            className={`absolute top-0 left-0 right-0 h-48 pointer-events-none opacity-20 blur-3xl ${
              isBeat 
                ? 'bg-gradient-to-b from-emerald-500 via-cyan-500 to-transparent' 
                : 'bg-gradient-to-b from-rose-600 via-red-900 to-transparent'
            }`}
          />
        )}

        {/* MASTHEAD HEADER */}
        <div className={`flex flex-col md:flex-row justify-between items-start md:items-center pb-6 border-b relative z-10 ${
          isDark ? 'border-white/[0.08]' : 'border-[#E3D3CB]'
        }`}>
          <div>
            <div className={`text-[11px] font-mono uppercase tracking-[0.25em] font-bold ${
              isDark ? 'text-cyan-400' : 'text-slate-500'
            }`}>
              SPLUS COLLECTIVE
            </div>
            <div className={`text-xs uppercase tracking-[0.2em] font-black mt-0.5 ${
              isDark ? 'text-slate-400' : 'text-slate-600'
            }`}>
              QUARTERLY REVIEW
            </div>
            <h1 className={`text-4xl md:text-5xl font-black uppercase tracking-tight mt-1 ${
              isDark 
                ? 'text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-slate-400' 
                : 'text-[#1A1817]'
            }`}>
              SCORECARD
            </h1>
            <div className="mt-3">
              <span className={`px-4 py-1.5 rounded-md text-xs font-mono font-black uppercase tracking-widest inline-flex items-center gap-1.5 ${verdictBadgeBg}`}>
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                {verdict}
              </span>
            </div>
          </div>

          <div className="text-left md:text-right mt-5 md:mt-0">
            <div className={`text-4xl md:text-5xl font-mono font-black tracking-tight ${
              isDark 
                ? 'text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400' 
                : 'text-[#1A1817]'
            }`}>
              ${displayTicker}
            </div>
            <div className={`text-sm font-semibold mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              {displayCompanyName}
            </div>
            <div className={`text-xs font-mono mt-1 font-bold ${isDark ? 'text-cyan-400/80' : 'text-slate-500'}`}>
              {quarter} &nbsp;·&nbsp; {release_date}
            </div>
          </div>
        </div>

        {/* 01 FUNDAMENTALS (What they reported) */}
        <div className="mt-8 relative z-10">
          <div className="flex justify-between items-baseline mb-3">
            <h2 className={`text-base font-bold font-mono tracking-tight flex items-center gap-2 ${
              isDark ? 'text-slate-100' : 'text-slate-900'
            }`}>
              <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#00F0FF]" />
              01 &nbsp;Fundamentals
            </h2>
            <span className={`text-xs font-mono font-semibold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              What they reported
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
            {/* REVENUE */}
            <div 
              className={`p-4 rounded-xl border relative overflow-hidden transition-all duration-200 hover:scale-[1.02] shadow-sm ${
                isDark 
                  ? 'bg-slate-900/90 border-cyan-500/20 shadow-[inset_0_1px_0_0_rgba(6,182,212,0.2)]' 
                  : 'bg-white border-black/10'
              }`}
            >
              <div className="h-1 absolute top-0 left-0 right-0 bg-gradient-to-r from-cyan-500 to-blue-500" />
              <div className="text-[10px] font-mono uppercase font-bold tracking-wider text-slate-400">
                REVENUE
              </div>
              <div className={`text-3xl font-mono font-black mt-1 ${isDark ? 'text-cyan-300' : 'text-slate-900'}`}>
                {fundamentals?.revenue_str}
              </div>
              <div className="text-xs font-mono font-bold mt-1.5 flex items-center gap-1">
                <span className={`px-2 py-0.5 rounded ${
                  fundamentals?.revenue_yoy >= 0 
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                    : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                }`}>
                  {fundamentals?.revenue_yoy >= 0 ? `▲ +${fundamentals?.revenue_yoy}%` : `▼ ${fundamentals?.revenue_yoy}%`} YoY
                </span>
              </div>
            </div>

            {/* EPS */}
            <div 
              className={`p-4 rounded-xl border relative overflow-hidden transition-all duration-200 hover:scale-[1.02] shadow-sm ${
                isDark 
                  ? 'bg-slate-900/90 border-emerald-500/20 shadow-[inset_0_1px_0_0_rgba(16,185,129,0.2)]' 
                  : 'bg-white border-black/10'
              }`}
            >
              <div className="h-1 absolute top-0 left-0 right-0 bg-gradient-to-r from-emerald-500 to-teal-500" />
              <div className="text-[10px] font-mono uppercase font-bold tracking-wider text-slate-400">
                EPS
              </div>
              <div className={`text-3xl font-mono font-black mt-1 ${isDark ? 'text-emerald-300' : 'text-slate-900'}`}>
                {fundamentals?.eps_str}
              </div>
              <div className="text-xs font-mono font-medium mt-1.5 text-slate-400">
                vs Street <span className="font-bold text-slate-300">{versus_consensus?.eps?.street_str}</span>
              </div>
            </div>

            {/* SURPRISE */}
            <div 
              className={`p-4 rounded-xl border relative overflow-hidden transition-all duration-200 hover:scale-[1.02] shadow-sm ${
                isDark 
                  ? 'bg-slate-900/90 border-purple-500/20 shadow-[inset_0_1px_0_0_rgba(168,85,247,0.2)]' 
                  : 'bg-white border-black/10'
              }`}
            >
              <div className="h-1 absolute top-0 left-0 right-0 bg-gradient-to-r from-purple-500 to-pink-500" />
              <div className="text-[10px] font-mono uppercase font-bold tracking-wider text-slate-400">
                SURPRISE
              </div>
              <div className={`text-3xl font-mono font-black mt-1 ${
                fundamentals?.surprise_pct >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}>
                {fundamentals?.surprise_pct >= 0 ? `+${fundamentals?.surprise_pct}%` : `${fundamentals?.surprise_pct}%`}
              </div>
              <div className="text-xs font-mono font-medium mt-1.5 text-slate-400">
                {fundamentals?.surprise_label || 'EPS vs Street'}
              </div>
            </div>

            {/* MARKET CAP */}
            <div 
              className={`p-4 rounded-xl border relative overflow-hidden transition-all duration-200 hover:scale-[1.02] shadow-sm ${
                isDark 
                  ? 'bg-slate-900/90 border-blue-500/20 shadow-[inset_0_1px_0_0_rgba(59,130,246,0.2)]' 
                  : 'bg-white border-black/10'
              }`}
            >
              <div className="h-1 absolute top-0 left-0 right-0 bg-gradient-to-r from-blue-500 to-indigo-500" />
              <div className="text-[10px] font-mono uppercase font-bold tracking-wider text-slate-400">
                MARKET CAP
              </div>
              <div className={`text-3xl font-mono font-black mt-1 ${isDark ? 'text-blue-300' : 'text-slate-900'}`}>
                {fundamentals?.market_cap_str}
              </div>
              <div className="text-xs font-mono font-bold mt-1.5 text-slate-400">
                Ticker: {ticker}
              </div>
            </div>
          </div>
        </div>

        {/* 02 VERSUS CONSENSUS (Street vs printed) */}
        <div className="mt-8 relative z-10">
          <div className="flex justify-between items-baseline mb-3">
            <h2 className={`text-base font-bold font-mono tracking-tight flex items-center gap-2 ${
              isDark ? 'text-slate-100' : 'text-slate-900'
            }`}>
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#10B981]" />
              02 &nbsp;Versus consensus
            </h2>
            <span className={`text-xs font-mono font-semibold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Street vs printed
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* REVENUE CONSENSUS CARD */}
            <div 
              className={`rounded-xl border overflow-hidden shadow-lg flex flex-col justify-between ${
                isDark ? 'bg-slate-900/90 border-white/[0.08]' : 'bg-white border-black/10'
              }`}
            >
              <div className="p-5 space-y-3">
                <div className="flex justify-between items-center mb-1">
                  <div className="text-xs font-mono uppercase font-black tracking-wider text-slate-400">
                    REVENUE HURDLE
                  </div>
                  <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                    versus_consensus?.revenue?.status === 'beat'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-rose-500/20 text-rose-400'
                  }`}>
                    {versus_consensus?.revenue?.status === 'beat' ? 'BEAT' : 'MISS'}
                  </span>
                </div>

                <div className="flex justify-between items-center text-sm font-mono py-1 border-b border-white/[0.05]">
                  <span className="text-slate-400">Street Target</span>
                  <span className={`text-base font-bold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    {versus_consensus?.revenue?.street_str}
                  </span>
                </div>

                <div className="flex justify-between items-center text-sm font-mono py-1">
                  <span className="text-slate-400">Printed Result</span>
                  <span className={`text-lg font-black ${
                    versus_consensus?.revenue?.status === 'beat' ? 'text-emerald-400' : 'text-rose-400'
                  }`}>
                    {versus_consensus?.revenue?.printed_str}
                  </span>
                </div>
              </div>

              {/* High-Impact Bottom Banner */}
              <div 
                className={`py-3 px-4 text-center text-sm font-mono font-black uppercase tracking-widest text-white shadow-inner ${
                  versus_consensus?.revenue?.status === 'beat' 
                    ? 'bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-700' 
                    : 'bg-gradient-to-r from-rose-900 via-rose-800 to-red-900'
                }`}
              >
                {versus_consensus?.revenue?.status_label}
              </div>
            </div>

            {/* EPS CONSENSUS CARD */}
            <div 
              className={`rounded-xl border overflow-hidden shadow-lg flex flex-col justify-between ${
                isDark ? 'bg-slate-900/90 border-white/[0.08]' : 'bg-white border-black/10'
              }`}
            >
              <div className="p-5 space-y-3">
                <div className="flex justify-between items-center mb-1">
                  <div className="text-xs font-mono uppercase font-black tracking-wider text-slate-400">
                    EPS HURDLE
                  </div>
                  <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                    versus_consensus?.eps?.status === 'beat'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-rose-500/20 text-rose-400'
                  }`}>
                    {versus_consensus?.eps?.status === 'beat' ? 'BEAT' : 'MISS'}
                  </span>
                </div>

                <div className="flex justify-between items-center text-sm font-mono py-1 border-b border-white/[0.05]">
                  <span className="text-slate-400">Street Target</span>
                  <span className={`text-base font-bold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    {versus_consensus?.eps?.street_str}
                  </span>
                </div>

                <div className="flex justify-between items-center text-sm font-mono py-1">
                  <span className="text-slate-400">Printed Result</span>
                  <span className={`text-lg font-black ${
                    versus_consensus?.eps?.status === 'beat' ? 'text-emerald-400' : 'text-rose-400'
                  }`}>
                    {versus_consensus?.eps?.printed_str}
                  </span>
                </div>
              </div>

              {/* High-Impact Bottom Banner */}
              <div 
                className={`py-3 px-4 text-center text-sm font-mono font-black uppercase tracking-widest text-white shadow-inner ${
                  versus_consensus?.eps?.status === 'beat' 
                    ? 'bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-700' 
                    : 'bg-gradient-to-r from-rose-900 via-rose-800 to-red-900'
                }`}
              >
                {versus_consensus?.eps?.status_label}
              </div>
            </div>

          </div>
        </div>

        {/* 03 GROWTH (QoQ and YoY) */}
        <div className="mt-8 relative z-10">
          <div className="flex justify-between items-baseline mb-3">
            <h2 className={`text-base font-bold font-mono tracking-tight flex items-center gap-2 ${
              isDark ? 'text-slate-100' : 'text-slate-900'
            }`}>
              <span className="w-2 h-2 rounded-full bg-purple-400 shadow-[0_0_8px_#C084FC]" />
              03 &nbsp;Growth
            </h2>
            <span className={`text-xs font-mono font-semibold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              QoQ and YoY
            </span>
          </div>

          <div 
            className={`rounded-xl border overflow-hidden shadow-xl ${
              isDark ? 'bg-slate-900/90 border-white/[0.08]' : 'bg-white border-black/10'
            }`}
          >
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className={`border-b font-mono ${
                  isDark ? 'border-white/[0.08] bg-slate-950/80' : 'border-[#EDE0DA] bg-[#EDE0DA]'
                }`}>
                  <th className="py-3 px-5 text-xs font-bold uppercase tracking-wider text-slate-300">
                    METRIC
                  </th>
                  <th className="py-3 px-5 text-xs font-bold uppercase tracking-wider text-right text-slate-300">
                    QOQ
                  </th>
                  <th className="py-3 px-5 text-xs font-bold uppercase tracking-wider text-right text-slate-300">
                    YOY
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y font-mono text-sm divide-white/[0.04]">
                {(growth?.metrics || []).map((row, rIdx) => {
                  const isQoqPos = (row.qoq_val >= 0);
                  const isYoyPos = (row.yoy_val >= 0);

                  const qoqClass = isDark
                    ? (isQoqPos 
                        ? 'bg-emerald-500/15 text-emerald-300 font-bold border-l border-emerald-500/20' 
                        : 'bg-rose-500/15 text-rose-300 font-bold border-l border-rose-500/20')
                    : (isQoqPos 
                        ? 'bg-emerald-100 text-emerald-800 font-bold' 
                        : 'bg-rose-100 text-rose-800 font-bold');

                  const yoyClass = isDark
                    ? (isYoyPos 
                        ? 'bg-emerald-500/15 text-emerald-300 font-bold border-l border-emerald-500/20' 
                        : 'bg-rose-500/15 text-rose-300 font-bold border-l border-rose-500/20')
                    : (isYoyPos 
                        ? 'bg-emerald-100 text-emerald-800 font-bold' 
                        : 'bg-rose-100 text-rose-800 font-bold');

                  return (
                    <tr key={rIdx} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-5 font-semibold text-slate-200">
                        {row.metric}
                      </td>
                      <td className={`py-3 px-5 text-right ${qoqClass}`}>
                        {row.qoq}
                      </td>
                      <td className={`py-3 px-5 text-right ${yoyClass}`}>
                        {row.yoy}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Synthesis Callout Bar */}
            <div 
              className={`p-4 text-xs font-sans font-medium border-t flex items-center gap-3 ${
                isDark 
                  ? 'bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-white/[0.08] text-slate-300' 
                  : 'bg-[#EDE0DA] text-slate-900'
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
              <span className="font-semibold leading-relaxed">{growth?.synthesis}</span>
            </div>
          </div>
        </div>

        {/* HERO MARKET REACTION STADIUM BANNER */}
        <div 
          className={`mt-8 rounded-2xl overflow-hidden text-white flex flex-col md:flex-row shadow-2xl border relative ${
            market_reaction?.direction === 'negative'
              ? 'bg-gradient-to-r from-rose-950 via-[#2A080C] to-slate-950 border-rose-500/40 shadow-[0_0_30px_rgba(244,63,94,0.2)]'
              : 'bg-gradient-to-r from-emerald-950 via-[#062919] to-slate-950 border-emerald-500/40 shadow-[0_0_30px_rgba(16,185,129,0.2)]'
          }`}
        >
          {/* Left Block (Reaction % & Session) */}
          <div className="p-6 md:p-8 flex flex-col justify-center items-center md:items-start md:border-r border-white/10 min-w-[220px]">
            <div className="text-[11px] font-mono uppercase tracking-[0.25em] font-black text-emerald-300 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              MARKET REACTION
            </div>
            <div className="text-5xl md:text-6xl font-mono font-black tracking-tight mt-1.5 text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.4)]">
              {market_reaction?.reaction_str}
            </div>
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] font-bold text-emerald-300/80 mt-1">
              {market_reaction?.session}
            </div>
          </div>

          {/* Right Block (Editorial Headline & Commentary) */}
          <div className="p-6 md:p-8 flex flex-col justify-center flex-1">
            <h3 className="text-2xl md:text-3xl font-black tracking-tight text-white mb-2 flex items-center gap-2">
              <span>{market_reaction?.headline}</span>
            </h3>
            <p className="text-sm md:text-base text-slate-200 leading-relaxed font-sans font-medium">
              {market_reaction?.narrative}
            </p>
          </div>
        </div>

        {/* 04 INSTITUTIONAL CATALYST: FORWARD GUIDANCE & PEAD HORIZONS ("MORE THAN THIS") */}
        <div className={`mt-8 pt-6 border-t relative z-10 ${
          isDark ? 'border-white/[0.08]' : 'border-[#E3D3CB]'
        }`}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Forward Guidance Box */}
            <div 
              className={`p-5 rounded-xl border shadow-lg ${
                isDark ? 'bg-slate-900/90 border-white/[0.08]' : 'bg-white border-black/10'
              }`}
            >
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-[11px] font-mono uppercase font-black tracking-wider text-cyan-400 flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5" />
                  FORWARD GUIDANCE CATALYST
                </span>
                <span className="px-2.5 py-1 rounded text-[10px] font-mono font-black uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  {guidance_story?.posture || 'RAISED'}
                </span>
              </div>
              <div className="text-sm font-bold font-mono text-slate-100">
                Q+1 Revenue Guide: <span className="text-cyan-300">{guidance_story?.q1_revenue_guide}</span>
              </div>
              <div className="text-xs font-mono mt-1 text-slate-300">
                Q+1 EPS Guide: <span className="text-emerald-300">{guidance_story?.q1_eps_guide}</span>
              </div>
              <p className="text-xs mt-2.5 leading-relaxed text-slate-400 font-sans">
                {guidance_story?.summary}
              </p>
            </div>

            {/* PEAD Drift Horizons Box */}
            <div 
              className={`p-5 rounded-xl border shadow-lg ${
                isDark ? 'bg-slate-900/90 border-white/[0.08]' : 'bg-white border-black/10'
              }`}
            >
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-[11px] font-mono uppercase font-black tracking-wider text-purple-400 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  PEAD DRIFT HORIZONS
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  Post-Earnings Announcement Drift
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2 mt-2">
                {(market_reaction?.pead_horizons || []).map((h, hIdx) => (
                  <div 
                    key={hIdx} 
                    className={`p-2.5 rounded-lg text-center border ${
                      isDark ? 'bg-slate-950/80 border-white/[0.06]' : 'bg-[#F7EFEA] border-[#E3D3CB]'
                    }`}
                  >
                    <div className="text-[9px] font-mono uppercase text-slate-400 truncate">
                      {h.horizon}
                    </div>
                    <div className="text-base font-mono font-black mt-0.5 text-emerald-400">
                      {h.return_pct >= 0 ? `+${h.return_pct}%` : `${h.return_pct}%`}
                    </div>
                    <div className="text-[9px] font-sans truncate text-slate-500 mt-0.5">
                      {h.status}
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* FOOTER ATTRIBUTION */}
        <div className={`mt-8 pt-4 border-t flex flex-col md:flex-row justify-between items-center text-[10px] font-mono uppercase tracking-widest ${
          isDark ? 'border-white/[0.08] text-slate-500' : 'border-[#E3D3CB] text-slate-600'
        }`}>
          <div>
            COMPANY RESULTS &nbsp;·&nbsp; SEC 10-Q FILINGS &nbsp;·&nbsp; YAHOO FINANCE
          </div>
          <div className="mt-1 md:mt-0 font-bold text-cyan-500/80">
            SCORECARD by SPLUS COLLECTIVE &nbsp;·&nbsp; INSTITUTIONAL TERMINAL SUITE
          </div>
        </div>

      </div>
    </div>
  );
}
