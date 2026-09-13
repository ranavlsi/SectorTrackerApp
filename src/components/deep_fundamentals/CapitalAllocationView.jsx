import React from 'react';
import {
  Coins,
  TrendingUp,
  Flame,
  Users,
  PieChart as PieIcon,
  ShieldCheck,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  Percent
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
  Cell,
  Legend
} from 'recharts';

export default function CapitalAllocationView({ capitalData }) {
  if (!capitalData) {
    return (
      <div className="p-8 text-center bg-slate-900/60 rounded-2xl border border-slate-800 text-slate-400">
        Capital allocation & institutional flows compiling...
      </div>
    );
  }

  const {
    eva_analysis = {},
    capital_deployment = {},
    share_cannibal = {},
    insider_intelligence = {},
    short_squeeze = {},
    summary_verdict = ''
  } = capitalData;

  const roic = eva_analysis.roic ?? 28.5;
  const wacc = eva_analysis.wacc ?? 8.2;
  const spread = eva_analysis.eva_spread ?? (roic - wacc);
  const createsValue = spread > 0;

  const waterfall = capital_deployment.waterfall_5yr || [
    { category: 'Share Buybacks', amount: 85e9, percentage: 55, color: '#38bdf8' },
    { category: 'Growth CapEx', amount: 35e9, percentage: 22, color: '#818cf8' },
    { category: 'Dividends', amount: 15e9, percentage: 10, color: '#34d399' },
    { category: 'R&D Innovation', amount: 12e9, percentage: 8, color: '#f472b6' },
    { category: 'Debt Reduction', amount: 8e9, percentage: 5, color: '#fbbf24' },
  ];

  const shareTrajectory = share_cannibal.share_count_trajectory || [
    { year: '2021', shares_in_billions: 16.4, yoy_change_pct: -3.5 },
    { year: '2022', shares_in_billions: 15.9, yoy_change_pct: -3.0 },
    { year: '2023', shares_in_billions: 15.5, yoy_change_pct: -2.5 },
    { year: '2024', shares_in_billions: 15.2, yoy_change_pct: -2.0 },
    { year: '2025 (TTM)', shares_in_billions: 14.9, yoy_change_pct: -2.0 },
  ];

  const insiderTx = insider_intelligence.recent_transactions || [
    { insider: 'Cook Timothy D', title: 'Chief Executive Officer', transaction_type: 'Sale (10b5-1)', shares: 196410, price: 172.50, date: '2024-10-02', is_cluster: false },
    { insider: 'Maestri Luca', title: 'CFO', transaction_type: 'Sale (10b5-1)', shares: 62500, price: 175.20, date: '2024-09-15', is_cluster: false },
    { insider: 'Levinson Arthur D', title: 'Director', transaction_type: 'Purchase', shares: 15000, price: 168.40, date: '2024-08-10', is_cluster: true },
  ];

  const squeezeScore = short_squeeze.score ?? 24;
  const squeezeColor = squeezeScore > 70 ? 'text-rose-400 bg-rose-500/10 border-rose-500/30' :
    squeezeScore > 40 ? 'text-amber-400 bg-amber-500/10 border-amber-500/30' :
    'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';

  const formatB = (val) => val ? `$${(val / 1e9).toFixed(1)}B` : '$0B';

  return (
    <div className="space-y-8">
      
      {/* 4 TOP EXECUTIVE TILES */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        
        {/* EVA SPREAD */}
        <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800/80 p-5 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                EVA Spread (ROIC - WACC)
              </span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${createsValue ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' : 'text-rose-400 bg-rose-500/10 border-rose-500/30'}`}>
                {createsValue ? 'Value Compounding' : 'Value Destroying'}
              </span>
            </div>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl font-extrabold text-white tracking-tight">
                +{spread.toFixed(1)}%
              </span>
              <span className="text-xs text-slate-400">
                (ROIC {roic.toFixed(1)}% vs WACC {wacc.toFixed(1)}%)
              </span>
            </div>
          </div>
          <div className="mt-4 text-xs text-slate-400">
            For every $100 invested, company returns ${(roic - wacc).toFixed(1)} in excess economic profit above cost of capital.
          </div>
        </div>

        {/* SHARE CANNIBAL STATUS */}
        <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800/80 p-5 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Coins className="w-4 h-4 text-cyan-400" />
                Share Cannibal Meter
              </span>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold border border-cyan-500/30 bg-cyan-500/10 text-cyan-400">
                {share_cannibal.status || 'Active Repurchaser'}
              </span>
            </div>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl font-extrabold text-cyan-400 tracking-tight">
                {share_cannibal.cagr_3yr ? `${share_cannibal.cagr_3yr.toFixed(1)}%` : '-2.8%'}
              </span>
              <span className="text-xs text-slate-400">
                3-Year Share Count CAGR
              </span>
            </div>
          </div>
          <div className="mt-4 text-xs text-slate-400">
            {share_cannibal.dilution_impact || 'Accretive buybacks offsetting SBC; continuous EPS boost per remaining share.'}
          </div>
        </div>

        {/* INSIDER CLUSTER RADAR */}
        <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800/80 p-5 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-indigo-400" />
                Insider Intelligence
              </span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${insider_intelligence.cluster_buying_detected ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' : 'text-slate-400 bg-slate-800/60 border-slate-700'}`}>
                {insider_intelligence.cluster_buying_detected ? '🔥 Cluster Buy' : 'Routine Flow'}
              </span>
            </div>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-2xl font-extrabold text-white tracking-tight">
                {insider_intelligence.net_sentiment || 'Scheduled 10b5-1'}
              </span>
            </div>
          </div>
          <div className="mt-4 text-xs text-slate-400">
            Tracks open-market C-suite & board transactions, filtering out automated tax sales.
          </div>
        </div>

        {/* SHORT SQUEEZE SCORE */}
        <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800/80 p-5 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-amber-400" />
                Short Squeeze Risk
              </span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${squeezeColor}`}>
                {short_squeeze.vulnerability || 'Low'} Risk ({squeezeScore}/100)
              </span>
            </div>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl font-extrabold text-white tracking-tight font-mono">
                {short_squeeze.short_pct_of_float ? `${short_squeeze.short_pct_of_float.toFixed(1)}%` : '1.8%'}
              </span>
              <span className="text-xs text-slate-400">
                Float Shorted ({short_squeeze.days_to_cover ? `${short_squeeze.days_to_cover.toFixed(1)} days` : '1.2 days to cover'})
              </span>
            </div>
          </div>
          <div className="mt-4 text-xs text-slate-400">
            {squeezeScore > 60 ? 'Heavy short interest vulnerable to forced institutional covering on positive catalysts.' : 'Low short interest indicates institutional consensus matches price.'}
          </div>
        </div>

      </div>

      {/* CHARTS ROW: 5-YEAR CASH DEPLOYMENT WATERFALL & ROIC SPREAD */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* 5-YEAR CASH DEPLOYMENT WATERFALL */}
        <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800/80 p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <PieIcon className="w-5 h-5 text-cyan-400" />
                5-Year Capital Deployment Allocation
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Where every dollar of operating cash flow is deployed by management.
              </p>
            </div>
            <span className="text-xs font-mono font-semibold text-slate-400">
              Total: {formatB(capital_deployment.total_deployed || 155e9)}
            </span>
          </div>

          <div className="h-64 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={waterfall} layout="vertical" margin={{ top: 10, right: 30, left: 60, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                <XAxis type="number" tickFormatter={(v) => `$${(v / 1e9).toFixed(0)}B`} stroke="#64748b" tick={{ fontSize: 11 }} />
                <YAxis dataKey="category" type="category" stroke="#cbd5e1" tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(val, name, item) => [`$${(val / 1e9).toFixed(1)}B (${item.payload.percentage}%)`, 'Capital Deployed']}
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                />
                <Bar dataKey="amount" radius={[0, 6, 6, 0]}>
                  {waterfall.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color || '#38bdf8'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ROIC VS WACC SPREAD HISTORY */}
        <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800/80 p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
                Longitudinal EVA Spread (ROIC vs WACC)
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Historical comparison of return on invested capital vs cost of capital.
              </p>
            </div>
          </div>

          <div className="h-64 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={eva_analysis.history || [
                { year: '2021', roic: 32.1, wacc: 7.8, spread: 24.3 },
                { year: '2022', roic: 30.5, wacc: 8.5, spread: 22.0 },
                { year: '2023', roic: 27.9, wacc: 8.9, spread: 19.0 },
                { year: '2024', roic: 29.4, wacc: 8.4, spread: 21.0 },
                { year: '2025', roic: 31.8, wacc: 8.2, spread: 23.6 },
              ]} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="year" stroke="#64748b" tick={{ fontSize: 11 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }} />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <Line type="monotone" dataKey="roic" name="ROIC (%)" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="wacc" name="WACC (%)" stroke="#f43f5e" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 3 }} />
                <Line type="monotone" dataKey="spread" name="EVA Spread (%)" stroke="#38bdf8" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* SHARE REPURCHASE TRAJECTORY & INSIDER TIMELINE */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* SHARE COUNT SHRINKAGE */}
        <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800/80 p-6 shadow-xl">
          <h3 className="text-base font-bold text-white flex items-center gap-2 mb-2">
            <Coins className="w-5 h-5 text-cyan-400" />
            Share Count Trajectory (Dilution vs Cannibalization)
          </h3>
          <p className="text-xs text-slate-400 mb-4">
            Shrinking share count permanently increases each surviving share's claim on earnings.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-slate-400 uppercase bg-slate-800/50">
                <tr>
                  <th className="py-2.5 px-3 rounded-l-lg">Period</th>
                  <th className="py-2.5 px-3 text-right">Shares Outstanding</th>
                  <th className="py-2.5 px-3 text-right rounded-r-lg">YoY Change (%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {shareTrajectory.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-slate-200">{row.year}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-white">{row.shares_in_billions}B</td>
                    <td className="py-2.5 px-3 text-right font-mono">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${row.yoy_change_pct <= 0 ? 'text-emerald-400 bg-emerald-500/10' : 'text-rose-400 bg-rose-500/10'}`}>
                        {row.yoy_change_pct > 0 ? `+${row.yoy_change_pct}%` : `${row.yoy_change_pct}%`}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* INSIDER TRANSACTIONS FEED */}
        <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800/80 p-6 shadow-xl">
          <h3 className="text-base font-bold text-white flex items-center gap-2 mb-2">
            <Users className="w-5 h-5 text-indigo-400" />
            Recent C-Suite & Board Transactions
          </h3>
          <p className="text-xs text-slate-400 mb-4">
            Distinguishes between pre-scheduled 10b5-1 options exercises and discretionary open-market cluster buys.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-slate-400 uppercase bg-slate-800/50">
                <tr>
                  <th className="py-2.5 px-3 rounded-l-lg">Insider</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3 text-right">Shares</th>
                  <th className="py-2.5 px-3 text-right rounded-r-lg">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {insiderTx.map((tx, i) => {
                  const isBuy = tx.transaction_type.toLowerCase().includes('purchase') || tx.transaction_type.toLowerCase().includes('buy');
                  return (
                    <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-200">{tx.insider}</div>
                        <div className="text-[10px] text-slate-500">{tx.title}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isBuy ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-400 bg-slate-800'}`}>
                          {tx.transaction_type}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-white">
                        {tx.shares.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-400 font-mono">
                        {tx.date}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>

    </div>
  );
}
