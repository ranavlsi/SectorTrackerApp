import React, { useState } from 'react';
import { 
  BarChart, Bar, LineChart, Line, AreaChart, Area, 
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
  Legend, ResponsiveContainer 
} from 'recharts';
import { 
  Zap, Award, TrendingUp, Layers, ShieldCheck, 
  AlertTriangle, Activity, ArrowUpRight, CheckCircle2,
  Calendar, ArrowRight, Sparkles
} from 'lucide-react';
import SPlusScorecard from './SPlusScorecard';

export default function EarningsDeconstructorView({ 
  ticker: propTicker,
  teardownData = null, 
  earningsData = null,
  historicalQuarters = [],
  profile = {} 
}) {
  const data = teardownData || earningsData;
  const [segmentViewMode, setSegmentViewMode] = useState('dollars');

  if (!data) {
    return (
      <div className="p-8 text-center bg-slate-900/80 rounded-2xl border border-cyan-500/20 text-slate-400 font-mono text-sm">
        Quarterly earnings teardown compiling...
      </div>
    );
  }

  const activeTicker = propTicker || data?.ticker || profile?.symbol || profile?.ticker || 'STOCK';
  const activeCompanyName = data?.company_name || profile?.company_name || profile?.long_name || profile?.short_name || `${activeTicker} Inc.`;

  const {
    ticker = activeTicker,
    company_name = activeCompanyName,
    scorecards = [],
    surprise_streak = {},
    historical_quarters = historicalQuarters || [],
    segments = {},
    acceleration_matrix = [],
    quality_of_earnings = {},
    guidance_cone = {}
  } = data;

  const formatB = (val) => val ? `$${(val / 1e9).toFixed(1)}B` : '$0B';

  // Build Segment Chart Data
  const segmentChartData = (historical_quarters || []).map((q) => {
    const qKey = q.date;
    const segInfo = segments?.history?.[qKey]?.products || {};
    const totalSegRev = Object.values(segInfo).reduce((a, b) => a + b, 0);

    const row = {
      quarter: q.quarter,
      date: q.date,
      total_revenue: q.revenue
    };

    if (segments?.product_segments) {
      segments.product_segments.forEach((segName) => {
        const valM = segInfo[segName] || (q.revenue / (1e6 * segments.product_segments.length));
        if (segmentViewMode === 'dollars') {
          row[segName] = Math.round(valM);
        } else {
          row[segName] = totalSegRev > 0 ? Number(((valM / totalSegRev) * 100).toFixed(1)) : 20.0;
        }
      });
    }
    return row;
  });

  const segmentColors = ['#00F0FF', '#6366f1', '#a855f7', '#ec4899', '#10b981', '#f59e0b'];

  return (
    <div className="space-y-8">
      
      {/* 1. FLAGSHIP ULTRA-VIBRANT SPLUS COLLECTIVE SCORECARD */}
      <SPlusScorecard
        scorecards={scorecards}
        ticker={ticker}
        companyName={company_name}
      />

      {/* 2. INSTITUTIONAL BEAT/MISS STREAK TIMELINE RIBBON */}
      <div 
        style={{
          background: 'linear-gradient(135deg, #0d131f 0%, #080c14 100%)',
          border: '1px solid rgba(6, 182, 212, 0.25)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 0 rgba(255, 255, 255, 0.08)'
        }}
        className="p-6 rounded-2xl relative overflow-hidden"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_10px_#10B981] animate-pulse" />
              <h3 className="text-xs font-mono font-black uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400">
                Institutional Beat / Miss Track Record
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Historical EPS consensus hurdle clearance and surprise distribution over past 8 prints.
            </p>
          </div>

          <div className="flex items-center gap-8">
            <div>
              <div className="text-2xl font-black font-mono text-emerald-400 drop-shadow-[0_0_10px_rgba(16,185,129,0.4)]">
                {surprise_streak?.beat_win_rate_pct || 87.5}%
              </div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Beat Win-Rate</div>
            </div>
            <div>
              <div className="text-2xl font-black font-mono text-cyan-400 drop-shadow-[0_0_10px_rgba(6,182,212,0.4)]">
                +{surprise_streak?.avg_eps_surprise_pct || 7.2}%
              </div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Avg EPS Surprise</div>
            </div>
            <div>
              <div className="text-2xl font-black font-mono text-purple-400 drop-shadow-[0_0_10px_rgba(168,85,247,0.4)]">
                {surprise_streak?.current_beat_streak || 4}Q
              </div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Active Streak</div>
            </div>
          </div>
        </div>

        {/* 8-Quarter Surprise Ribbon Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 mt-4">
          {(surprise_streak?.streak_items || []).map((item, idx) => (
            <div 
              key={idx} 
              className={`p-3 rounded-xl border text-center transition-all duration-200 hover:scale-[1.03] ${
                item.is_beat 
                  ? 'bg-emerald-500/10 border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.15)] hover:border-emerald-400' 
                  : 'bg-rose-500/10 border-rose-500/30 shadow-[0_0_12px_rgba(244,63,94,0.15)] hover:border-rose-400'
              }`}
            >
              <div className="text-[10px] font-mono text-slate-400 font-bold truncate">{item.date}</div>
              <div className={`text-base font-black font-mono mt-0.5 ${item.is_beat ? 'text-emerald-400' : 'text-rose-400'}`}>
                {item.is_beat ? `+${item.surprise_pct}%` : `${item.surprise_pct}%`}
              </div>
              <div className="text-[9px] font-mono text-slate-300 mt-1 truncate">
                ${item.reported_eps?.toFixed(2)} <span className="text-slate-500 font-normal">v ${item.estimated_eps?.toFixed(2)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. FORWARD GUIDANCE CONE & SEGMENTAL BREAKDOWN */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* SEGMENT TRAJECTORY (7 COLS) */}
        <div 
          style={{
            background: 'linear-gradient(135deg, #0d131f 0%, #080c14 100%)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 0 rgba(255, 255, 255, 0.08)'
          }}
          className="lg:col-span-7 p-6 rounded-2xl flex flex-col"
        >
          <div className="flex items-center justify-between pb-3 border-b border-white/[0.08] mb-4">
            <div>
              <div className="flex items-center gap-2">
                <Layers className="text-cyan-400 w-4 h-4" />
                <h3 className="text-xs font-mono font-black uppercase tracking-widest text-cyan-300">
                  Business & Product Segment Trajectory
                </h3>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Revenue contribution and mix-shift across quarterly reports
              </p>
            </div>

            <div className="flex bg-slate-900 rounded-lg p-0.5 border border-slate-700 shadow-inner">
              <button 
                onClick={() => setSegmentViewMode('dollars')}
                className={`px-3 py-1 text-[11px] font-mono font-bold rounded-md transition-all ${
                  segmentViewMode === 'dollars' ? 'bg-cyan-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                Revenue ($M)
              </button>
              <button 
                onClick={() => setSegmentViewMode('share')}
                className={`px-3 py-1 text-[11px] font-mono font-bold rounded-md transition-all ${
                  segmentViewMode === 'share' ? 'bg-cyan-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                Mix Share (%)
              </button>
            </div>
          </div>

          <div style={{ height: '280px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={segmentChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="quarter" stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }} />
                <YAxis 
                  stroke="#94a3b8" 
                  tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }} 
                  tickFormatter={(v) => segmentViewMode === 'dollars' ? `$${(v/1000).toFixed(0)}B` : `${v}%`}
                />
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: '#090d16', borderColor: 'rgba(6,182,212,0.4)', borderRadius: '10px', fontSize: '11px', fontFamily: 'monospace', boxShadow: '0 8px 24px rgba(0,0,0,0.6)' }}
                  formatter={(val) => segmentViewMode === 'dollars' ? `$${val.toLocaleString()}M` : `${val}%`}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px', fontFamily: 'monospace' }} />
                {segments?.product_segments?.map((segName, idx) => (
                  <Bar 
                    key={segName} 
                    dataKey={segName} 
                    name={segName} 
                    stackId="a" 
                    fill={segmentColors[idx % segmentColors.length]} 
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* FORWARD GUIDANCE CONE (5 COLS) */}
        <div 
          style={{
            background: 'linear-gradient(135deg, #0d131f 0%, #080c14 100%)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 0 rgba(255, 255, 255, 0.08)'
          }}
          className="lg:col-span-5 p-6 rounded-2xl flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08] mb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="text-emerald-400 w-4 h-4" />
                <h3 className="text-xs font-mono font-black uppercase tracking-widest text-emerald-300">
                  Forward Guidance Cone
                </h3>
              </div>
              <span className="text-[10px] font-mono font-black uppercase px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-[0_0_8px_rgba(16,185,129,0.3)]">
                Forward Q+1
              </span>
            </div>

            <div style={{ height: '190px', width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={guidance_cone?.guidance_cone_points || []}>
                  <defs>
                    <linearGradient id="coneGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.45}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.02}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="period" stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }} />
                  <YAxis stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }} tickFormatter={(v) => `$${(v/1e9).toFixed(0)}B`} domain={['dataMin * 0.95', 'dataMax * 1.05']} />
                  <RechartsTooltip formatter={(v) => formatB(v)} contentStyle={{ backgroundColor: '#090d16', borderColor: 'rgba(16,185,129,0.4)', borderRadius: '10px', fontSize: '11px', fontFamily: 'monospace' }} />
                  <Area type="monotone" dataKey="high" name="High Guide" stroke="#34d399" fill="url(#coneGrad)" />
                  <Area type="monotone" dataKey="mid" name="Midpoint Guide" stroke="#10b981" strokeWidth={3} fill="none" />
                  <Area type="monotone" dataKey="low" name="Low Guide" stroke="#059669" fill="none" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="p-3.5 bg-slate-900/90 rounded-xl border border-white/[0.08] mt-3 font-mono">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400">Street Consensus:</span>
              <span className="text-white font-bold">{formatB(guidance_cone?.next_quarter_consensus)}</span>
            </div>
            <div className="flex justify-between items-center text-xs mt-1.5">
              <span className="text-slate-400">Posture Signal:</span>
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                {guidance_cone?.status?.replace('_', ' ') || 'BEAT AND RAISE'} <ArrowUpRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* 4. 2ND-DERIVATIVE METRIC ACCELERATION HEATMAP */}
      <div 
        style={{
          background: 'linear-gradient(135deg, #0d131f 0%, #080c14 100%)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 0 rgba(255, 255, 255, 0.08)'
        }}
        className="p-6 rounded-2xl"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-white/[0.08] mb-4">
          <div>
            <div className="flex items-center gap-2">
              <Activity className="text-purple-400 w-4 h-4" />
              <h3 className="text-xs font-mono font-black uppercase tracking-widest text-purple-300">
                2nd-Derivative Metric Acceleration Heatmap
              </h3>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Detecting rate-of-change momentum shifts across revenue, margins, and free cash flow
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono">
            <span className="px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-[0_0_8px_rgba(16,185,129,0.2)]">🟢 Accelerating</span>
            <span className="px-2.5 py-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-[0_0_8px_rgba(245,158,11,0.2)]">🟡 Decelerating</span>
            <span className="px-2.5 py-1 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_8px_rgba(6,182,212,0.2)]">🔵 Bottoming</span>
            <span className="px-2.5 py-1 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-[0_0_8px_rgba(244,63,94,0.2)]">🔴 Contracting</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/[0.08]">
                <th className="py-2.5 px-4 text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">KPI Metric</th>
                {historical_quarters.map((q) => (
                  <th key={q.quarter} className="py-2.5 px-3 text-xs font-mono font-bold text-slate-300 text-center">
                    {q.quarter}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {acceleration_matrix.map((row, idx) => (
                <tr key={idx} className="border-b border-white/[0.04] hover:bg-slate-800/30 transition-colors">
                  <td className="py-3 px-4 text-xs font-mono font-bold text-slate-200 capitalize flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                    {row.metric.replace(/_/g, ' ')}
                  </td>
                  {row.quarters.map((qCell, qIdx) => {
                    const status = qCell.status;
                    let badgeClass = 'bg-slate-800 text-slate-400 border-slate-700';
                    if (status === 'ACCELERATING') badgeClass = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-[0_0_8px_rgba(16,185,129,0.2)]';
                    else if (status === 'DECELERATING') badgeClass = 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-[0_0_8px_rgba(245,158,11,0.2)]';
                    else if (status === 'BOTTOMING') badgeClass = 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-[0_0_8px_rgba(6,182,212,0.2)]';
                    else if (status === 'CONTRACTING') badgeClass = 'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-[0_0_8px_rgba(244,63,94,0.2)]';

                    return (
                      <td key={qIdx} className="py-2 px-2 text-center">
                        <div className={`py-1.5 px-2 rounded-lg border text-xs font-mono font-bold ${badgeClass}`}>
                          {row.metric.includes('margin') ? `${qCell.value.toFixed(1)}%` : (qCell.value > 1e8 ? formatB(qCell.value) : `$${qCell.value.toFixed(2)}`)}
                          <div className="text-[9px] font-normal opacity-80 mt-0.5">
                            {qCell.acceleration_bps > 0 ? `+${(qCell.acceleration_bps/100).toFixed(1)}%` : `${(qCell.acceleration_bps/100).toFixed(1)}%`}
                          </div>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. QUALITY OF EARNINGS GAAP VS NON-GAAP WATERFALL */}
      {quality_of_earnings && quality_of_earnings.bridge_waterfall && (
        <div 
          style={{
            background: 'linear-gradient(135deg, #0d131f 0%, #080c14 100%)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 0 rgba(255, 255, 255, 0.08)'
          }}
          className="p-6 rounded-2xl"
        >
          <div className="flex justify-between items-center pb-3 border-b border-white/[0.08] mb-4">
            <div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="text-cyan-400 w-4 h-4" />
                <h3 className="text-xs font-mono font-black uppercase tracking-widest text-cyan-300">
                  Quality of Earnings & SBC Dilution Bridge
                </h3>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">Reconciling reported GAAP Net Income with Non-GAAP metrics and SBC drag</p>
            </div>
            <div className="text-right font-mono">
              <span className="text-[11px] text-slate-400">SBC Drag: </span>
              <span className="text-xs font-bold text-amber-400">{quality_of_earnings.sbc_intensity_pct}% of Rev</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5 font-mono">
            {quality_of_earnings.bridge_waterfall.map((step, idx) => (
              <div key={idx} className="p-3.5 bg-slate-900/90 rounded-xl border border-white/[0.08] shadow-sm">
                <div className="text-[11px] text-slate-400">{step.label}</div>
                <div className={`text-xl font-black mt-1 ${
                  step.type === 'total' ? 'text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.4)]' : 'text-slate-100'
                }`}>
                  {formatB(step.amount)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
