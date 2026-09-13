import React, { useState } from 'react';
import { 
  ShieldCheck, Award, Zap, AlertTriangle, ArrowUpRight, ArrowDownRight, 
  Layers, Compass, Activity, CheckCircle, Flame, ExternalLink, ChevronDown, ChevronUp
} from 'lucide-react';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend, Tooltip as RechartsTooltip } from 'recharts';

export default function ExecutiveMoatView({ moatData, companyInfo }) {
  const [expandedItem, setExpandedItem] = useState(null);

  if (!moatData) {
    return (
      <div className="p-8 text-center bg-slate-900/60 rounded-2xl border border-slate-800 text-slate-400">
        Moat & Catalyst intelligence compiling...
      </div>
    );
  }

  const {
    moat_pillars = {},
    porter_forces = {},
    tailwinds = [],
    headwinds = [],
    net_catalyst_balance = 0.25,
    catalyst_regime = "Constructive Expansion",
    tailwinds_mass = 7.2,
    headwinds_mass = 3.5
  } = moatData;

  // Radar chart data preparation
  const radarData = [
    { subject: 'Network Effects', company: moat_pillars.network_effects || 85, peer: moat_pillars.peer_median_score || 55, fullMark: 100 },
    { subject: 'Cost Advantage', company: moat_pillars.cost_advantage || 78, peer: moat_pillars.peer_median_score || 55, fullMark: 100 },
    { subject: 'Switching Costs', company: moat_pillars.switching_costs || 88, peer: moat_pillars.peer_median_score || 55, fullMark: 100 },
    { subject: 'Intangibles (Brand/IP)', company: moat_pillars.intangible_assets || 92, peer: moat_pillars.peer_median_score || 55, fullMark: 100 },
    { subject: 'Efficient Scale', company: moat_pillars.efficient_scale || 75, peer: moat_pillars.peer_median_score || 55, fullMark: 100 },
  ];

  // Porter's 5 Forces data
  const porterList = [
    { name: 'Barriers to Entry', score: porter_forces.threat_new_entrants || 85, desc: 'High capital & regulatory moat preventing new entrants' },
    { name: 'Supplier Pricing Power', score: porter_forces.supplier_power || 75, desc: 'Insulated from upstream component cost squeeze' },
    { name: 'Customer Bargaining Power', score: porter_forces.buyer_power || 80, desc: 'Low buyer concentration and high product stickiness' },
    { name: 'Threat of Substitutes', score: porter_forces.threat_substitutes || 85, desc: 'Mission-critical ecosystem with few viable substitutes' },
    { name: 'Competitive Rivalry', score: porter_forces.competitive_rivalry || 78, desc: 'Rational pricing dynamics and oligopolistic positioning' },
  ];

  // Seesaw tilt angle: -18 to +18 deg
  const tiltAngle = Math.max(-18, Math.min(18, net_catalyst_balance * 18));
  const isBullish = net_catalyst_balance > 0.05;

  return (
    <div className="space-y-6">
      
      {/* 1. INSTITUTIONAL CATALYST VECTOR & MARGIN LEVERAGE SPECTRUM */}
      {(() => {
        const sumTailwindBps = tailwinds.reduce((acc, t) => acc + (t.quantified_ebit_delta_bps || 0), 0);
        const sumHeadwindBps = headwinds.reduce((acc, h) => acc + Math.abs(h.quantified_ebit_delta_bps || 0), 0);
        const netBps = sumTailwindBps - sumHeadwindBps;
        const clampedBps = Math.max(-500, Math.min(500, netBps));
        const cursorPct = ((clampedBps + 500) / 1000) * 100;

        return (
          <div
            style={{
              background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.95) 0%, rgba(10, 14, 23, 0.95) 100%)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              boxShadow: '0 12px 32px rgba(0,0,0,0.5)'
            }}
            className="p-6 rounded-2xl relative overflow-hidden"
          >
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
              <div>
                <div className="flex items-center gap-2">
                  <Compass className="text-cyan-400" size={18} />
                  <h3 className="text-base font-bold font-mono tracking-tight text-white uppercase">
                    Catalyst Vector & Operating Leverage Spectrum
                  </h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-slate-800 text-slate-400 border border-slate-700">
                    Institutional Teardown
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Quantified basis-point (bps) impact of secular growth drivers vs cyclical margin compression vectors
                </p>
              </div>

              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded-md text-xs font-mono font-bold border ${
                  netBps >= 0 
                    ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' 
                    : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                }`}>
                  {netBps >= 0 ? `+${netBps} bps Net Margin Thrust` : `${netBps} bps Net Margin Drag`}
                </span>
                <span className="px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700">
                  {catalyst_regime}
                </span>
              </div>
            </div>

            {/* 3 Metric Hero Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
              <div className="p-3 rounded-xl bg-rose-500/5 border border-rose-500/20 flex flex-col justify-between">
                <span className="text-[10px] font-mono uppercase text-slate-400">Gross Headwind Drag</span>
                <div className="flex items-baseline justify-between mt-1">
                  <span className="text-2xl font-black font-mono text-rose-400">-{sumHeadwindBps} bps</span>
                  <span className="text-xs font-mono text-slate-400">{headwinds.length} friction factors</span>
                </div>
              </div>
              <div className="p-3 rounded-xl bg-cyan-500/5 border border-cyan-500/20 flex flex-col justify-between">
                <span className="text-[10px] font-mono uppercase text-slate-400">Net Operating Vector</span>
                <div className="flex items-baseline justify-between mt-1">
                  <span className={`text-2xl font-black font-mono ${netBps >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {netBps >= 0 ? `+${netBps}` : netBps} bps
                  </span>
                  <span className="text-xs font-mono text-slate-400">
                    {netBps >= 0 ? 'Accretive Bias' : 'Dilutive Bias'}
                  </span>
                </div>
              </div>
              <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 flex flex-col justify-between">
                <span className="text-[10px] font-mono uppercase text-slate-400">Gross Tailwind Thrust</span>
                <div className="flex items-baseline justify-between mt-1">
                  <span className="text-2xl font-black font-mono text-emerald-400">+{sumTailwindBps} bps</span>
                  <span className="text-xs font-mono text-slate-400">{tailwinds.length} growth drivers</span>
                </div>
              </div>
            </div>

            {/* Precision Segmented Range Meter */}
            <div className="my-4">
              <div className="flex justify-between text-[10px] font-mono text-slate-400 mb-1.5 px-0.5">
                <span className="text-rose-400">-500 bps (Severe Drag)</span>
                <span className="text-slate-400">0 bps (Equilibrium)</span>
                <span className="text-emerald-400">+500 bps (Supercharged)</span>
              </div>

              {/* Meter track with segments */}
              <div className="relative h-6 rounded-md bg-slate-950/80 p-0.5 border border-slate-800 overflow-hidden flex gap-1">
                {/* Zone 1: Severe Drag */}
                <div className="flex-1 rounded-sm bg-rose-600/30 border-r border-rose-500/40 relative flex items-center justify-center">
                  <span className="text-[9px] font-mono font-bold text-rose-400 uppercase tracking-wider">Severe Drag</span>
                </div>
                {/* Zone 2: Moderate Drag */}
                <div className="flex-1 rounded-sm bg-rose-500/20 border-r border-slate-700 relative flex items-center justify-center">
                  <span className="text-[9px] font-mono font-bold text-rose-300 uppercase tracking-wider">Moderate</span>
                </div>
                {/* Zone 3: Accretive Expansion */}
                <div className="flex-1 rounded-sm bg-emerald-500/20 border-r border-emerald-500/40 relative flex items-center justify-center">
                  <span className="text-[9px] font-mono font-bold text-emerald-300 uppercase tracking-wider">Accretive</span>
                </div>
                {/* Zone 4: Supercharged */}
                <div className="flex-1 rounded-sm bg-emerald-500/35 relative flex items-center justify-center">
                  <span className="text-[9px] font-mono font-bold text-emerald-400 uppercase tracking-wider">Supercharged</span>
                </div>

                {/* Precision Cursor Pin */}
                <div
                  className="absolute top-0 bottom-0 z-20 transition-all duration-700 pointer-events-none flex flex-col items-center justify-center"
                  style={{ left: `calc(${cursorPct}% - 6px)` }}
                >
                  <div className="w-3 h-full bg-white rounded shadow-[0_0_12px_#ffffff] border border-slate-900" />
                </div>
              </div>

              {/* Position Marker */}
              <div className="flex justify-center mt-2">
                <span className="text-xs font-mono font-bold text-slate-300 bg-slate-900/80 px-3 py-0.5 rounded border border-slate-800">
                  Current Net Stance: <strong className={netBps >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                    {netBps >= 0 ? `+${netBps} bps Thrust` : `${netBps} bps Drag`}
                  </strong>
                </span>
              </div>
            </div>
          </div>
        );
      })()}


      {/* 2. MOAT RADAR & PORTER'S 5 FORCES */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Radar Spider Chart */}
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl flex flex-col">
          <div className="flex justify-between items-center mb-2">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ShieldCheck className="text-emerald-400" size={18} /> 5-Pillar Economic Moat Radar
              </h3>
              <p className="text-xs text-slate-400">Moat defensibility vs industry peer median</p>
            </div>
            <span className={`px-2.5 py-0.5 rounded text-xs font-bold uppercase border ${
              moat_pillars.moat_rating === 'WIDE' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
            }`}>
              {moat_pillars.moat_rating || 'WIDE'} MOAT ({moat_pillars.composite_score || 85}/100)
            </span>
          </div>

          <div style={{ height: '280px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid stroke="rgba(255,255,255,0.08)" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#cbd5e1', fontSize: 11 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#64748b" tick={{ fill: '#64748b', fontSize: 10 }} />
                <RechartsTooltip contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px' }} />
                <Radar name="Company" dataKey="company" stroke="#10b981" fill="#10b981" fillOpacity={0.4} strokeWidth={2} />
                <Radar name="Peer Median" dataKey="peer" stroke="#64748b" fill="#64748b" fillOpacity={0.15} strokeDasharray="4 4" />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Porter's 5 Forces List */}
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Layers className="text-cyan-400" size={18} /> Porter's 5 Forces Competitive Index
                </h3>
                <p className="text-xs text-slate-400">Industry structural insulation & pricing power</p>
              </div>
              <div className="text-xl font-black text-cyan-400 font-mono">
                {porter_forces.overall_attractiveness || 82}<span className="text-xs text-slate-400">/100</span>
              </div>
            </div>

            <div className="space-y-3 mt-2">
              {porterList.map((p, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-slate-200">{p.name}</span>
                    <span className="font-mono text-cyan-400">{p.score}/100</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-blue-500 to-cyan-400 h-full rounded-full transition-all duration-500" 
                      style={{ width: `${p.score}%` }} 
                    />
                  </div>
                  <div className="text-[10px] text-slate-400">{p.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 3. HIGH-DENSITY INTERACTIVE CATALYSTS (COMPACT PILLS & ACCORDION - NO WALLS OF TEXT) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Tailwinds */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
              <Zap size={15} /> Growth Catalysts & Tailwinds ({tailwinds.length})
            </h4>
            <span className="text-[11px] font-mono text-slate-400">Click to expand details</span>
          </div>

          <div className="space-y-2">
            {tailwinds.map((tw, idx) => {
              const isOpen = expandedItem === `tw-${idx}`;
              return (
                <div
                  key={tw.id || idx}
                  className="rounded-xl bg-slate-950/40 border border-emerald-500/20 hover:border-emerald-500/50 transition-all overflow-hidden cursor-pointer"
                  onClick={() => setExpandedItem(isOpen ? null : `tw-${idx}`)}
                >
                  <div className="p-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                      <span className="text-xs font-bold text-white truncate">{tw.title}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 font-mono">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                        +{tw.quantified_ebit_delta_bps} bps
                      </span>
                      {isOpen ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                    </div>
                  </div>
                  {isOpen && (
                    <div className="px-3 pb-3 pt-1 text-xs text-slate-300 border-t border-emerald-500/10 space-y-2">
                      <p className="leading-relaxed">{tw.description}</p>
                      <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                        <span>Horizon: {tw.duration?.replace('_', ' ')}</span>
                        <span>Source: {tw.source_citation}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Headwinds */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <h4 className="text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center gap-2">
              <AlertTriangle size={15} /> Friction Factors & Headwinds ({headwinds.length})
            </h4>
            <span className="text-[11px] font-mono text-slate-400">Click to expand details</span>
          </div>

          <div className="space-y-2">
            {headwinds.map((hw, idx) => {
              const isOpen = expandedItem === `hw-${idx}`;
              return (
                <div
                  key={hw.id || idx}
                  className="rounded-xl bg-slate-950/40 border border-rose-500/20 hover:border-rose-500/50 transition-all overflow-hidden cursor-pointer"
                  onClick={() => setExpandedItem(isOpen ? null : `hw-${idx}`)}
                >
                  <div className="p-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-2 h-2 rounded-full bg-rose-400 shrink-0" />
                      <span className="text-xs font-bold text-white truncate">{hw.title}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 font-mono">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30">
                        {hw.quantified_ebit_delta_bps} bps
                      </span>
                      {isOpen ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                    </div>
                  </div>
                  {isOpen && (
                    <div className="px-3 pb-3 pt-1 text-xs text-slate-300 border-t border-rose-500/10 space-y-2">
                      <p className="leading-relaxed">{hw.description}</p>
                      <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                        <span>Horizon: {hw.duration?.replace('_', ' ')}</span>
                        <span>Source: {hw.source_citation}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

      </div>

    </div>
  );
}
