import React, { useState, useEffect } from 'react';
import { 
  FileText, Download, Printer, ShieldCheck, AlertTriangle, 
  ExternalLink, Layers, CheckCircle2, ChevronRight, Sliders,
  RefreshCw, Sparkles, Database, Search, ArrowUpRight
} from 'lucide-react';

export default function DeepBriefDocumentView({ ticker = 'CPRT' }) {
  const [briefData, setBriefData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('executive'); // 'executive' (print view) | 'interactive'
  const [peerInput, setPeerInput] = useState('');
  const [activeChapter, setActiveChapter] = useState('all');

  const fetchBrief = async (peers = '') => {
    setLoading(true);
    setError(null);
    try {
      const url = `/api/deep_brief?ticker=${ticker}${peers ? `&peers=${peers}` : ''}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();
      setBriefData(data);
    } catch (err) {
      console.error("Error fetching deep brief:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (ticker) fetchBrief();
  }, [ticker]);

  const handlePeerSubmit = (e) => {
    e.preventDefault();
    if (peerInput.trim()) {
      fetchBrief(peerInput.trim().toUpperCase());
    }
  };

  const handlePrint = () => {
    window.open(`/api/deep_brief/document?ticker=${ticker}`, '_blank');
  };

  if (loading) {
    return (
      <div className="p-16 text-center bg-[#0a0e17] rounded-2xl border border-cyan-500/20 text-slate-300 font-mono text-sm">
        <RefreshCw size={36} className="animate-spin text-cyan-400 mx-auto mb-4" />
        <h3 className="text-white text-lg font-bold">Compiling Institutional Deep Brief v2 for {ticker}...</h3>
        <p className="text-xs text-slate-400 mt-2 max-w-md mx-auto">
          Executing multi-layer retrieval: Market measures, SEC company facts XBRL, 10-K disclosures, and fail-closed number audit.
        </p>
      </div>
    );
  }

  if (error || !briefData) {
    return (
      <div className="p-12 text-center bg-[#0a0e17] rounded-2xl border border-rose-500/30 text-slate-300 font-mono text-sm">
        <AlertTriangle size={36} className="text-rose-400 mx-auto mb-3" />
        <h3 className="text-white text-base font-bold">Deep Brief Pipeline Error</h3>
        <p className="text-xs text-rose-300 mt-1">{error || "No data received"}</p>
        <button
          onClick={() => fetchBrief()}
          className="mt-4 px-4 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold"
        >
          Retry Compilation
        </button>
      </div>
    );
  }

  const { cover, business_model, competitive, quality, valuation, synthesis, sources } = briefData;

  return (
    <div className="space-y-4">
      {/* COMMAND CONTROL STRIP */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-slate-900/90 border border-slate-700/60 rounded-xl">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/40">
            <FileText size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-black text-white">{ticker} DEEP BRIEF V2</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                <ShieldCheck size={11} /> 100% Sourced · Fail-Closed
              </span>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">
              Institutional Desk Research Document (4–8 Pages)
            </span>
          </div>
        </div>

        {/* View Mode & Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex rounded-lg bg-slate-950 p-1 border border-slate-800">
            <button
              onClick={() => setViewMode('executive')}
              className={`px-3 py-1 rounded text-xs font-mono font-bold transition-all ${
                viewMode === 'executive' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-white'
              }`}
            >
              Desk Print View
            </button>
            <button
              onClick={() => setViewMode('interactive')}
              className={`px-3 py-1 rounded text-xs font-mono font-bold transition-all ${
                viewMode === 'interactive' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-white'
              }`}
            >
              Interactive Chapters
            </button>
          </div>

          <form onSubmit={handlePeerSubmit} className="flex items-center gap-1">
            <input
              type="text"
              placeholder="--peers A,B,C"
              value={peerInput}
              onChange={(e) => setPeerInput(e.target.value)}
              className="px-2.5 py-1 text-xs font-mono bg-slate-950 text-white rounded border border-slate-700/80 w-32 outline-none"
            />
            <button type="submit" className="p-1 px-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono font-bold">
              Set
            </button>
          </form>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all"
            title="Open printable 4-8 page institutional PDF report"
          >
            <Printer size={13} />
            <span>Print / PDF Document</span>
          </button>
        </div>
      </div>

      {/* DOCUMENT CANVAS CONTAINER */}
      <div className="bg-[#ffffff] text-[#0f172a] rounded-xl p-6 sm:p-8 md:p-10 shadow-2xl border border-slate-200 font-sans">
        
        {/* CHAPTER A: COVER STRIP */}
        <div className="border-[1.5px] border-[#0f172a] rounded p-4 bg-[#f8fafc] mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-3">
            <div>
              <div className="font-mono text-3xl font-black tracking-tight text-[#0f172a]">{cover.ticker}</div>
              <div className="text-base font-bold text-slate-800">{cover.company_name}</div>
              <div className="text-xs text-slate-600 mt-1 flex gap-2">
                <span className="font-semibold bg-slate-200 px-1.5 py-0.5 rounded text-[11px]">{cover.exchange}</span>
                <span className="font-semibold bg-slate-200 px-1.5 py-0.5 rounded text-[11px]">{cover.sector}</span>
                <span className="font-semibold bg-slate-200 px-1.5 py-0.5 rounded text-[11px]">{cover.industry}</span>
              </div>
            </div>
            <div className="text-left sm:text-right font-mono text-[11px] text-slate-500">
              <div><strong>Market Data:</strong> {cover.as_of_market}</div>
              <div><strong>Latest 10-K:</strong> {cover.as_of_filing}</div>
              <div><strong>CIK:</strong> {cover.cik || "N/A"}</div>
            </div>
          </div>

          {/* One-Line Thesis Stub */}
          <div className="p-3 bg-white border-l-4 border-cyan-600 border-y border-r border-slate-200 rounded-sm text-sm font-semibold text-slate-900 leading-snug my-3">
            <span className="text-xs font-mono font-black text-cyan-700 uppercase mr-2">[Desk Synthesis]</span>
            {cover.thesis_stub}
          </div>

          {/* Key Stats Ribbon */}
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2 pt-3 border-t border-slate-200">
            <div className="p-2 bg-white border border-slate-300 rounded text-center">
              <span className="block text-[10px] font-mono font-bold text-slate-500 uppercase">Stock Price</span>
              <span className="block text-sm font-mono font-black text-slate-900 mt-0.5">${cover.price.toFixed(2)}</span>
            </div>
            <div className="p-2 bg-white border border-slate-300 rounded text-center">
              <span className="block text-[10px] font-mono font-bold text-slate-500 uppercase">Market Cap</span>
              <span className="block text-sm font-mono font-black text-slate-900 mt-0.5">${cover.market_cap_str}</span>
            </div>
            <div className="p-2 bg-white border border-slate-300 rounded text-center">
              <span className="block text-[10px] font-mono font-bold text-slate-500 uppercase">Enterprise Val</span>
              <span className="block text-sm font-mono font-black text-slate-900 mt-0.5">${cover.enterprise_value_str}</span>
            </div>
            <div className="p-2 bg-white border border-slate-300 rounded text-center">
              <span className="block text-[10px] font-mono font-bold text-slate-500 uppercase">TTM Revenue</span>
              <span className="block text-sm font-mono font-black text-slate-900 mt-0.5">${cover.ttm_revenue_str}</span>
            </div>
            <div className="p-2 bg-white border border-slate-300 rounded text-center">
              <span className="block text-[10px] font-mono font-bold text-slate-500 uppercase">TTM FCF</span>
              <span className="block text-sm font-mono font-black text-slate-900 mt-0.5">${cover.ttm_fcf_str}</span>
            </div>
            <div className="p-2 bg-white border border-slate-300 rounded text-center">
              <span className="block text-[10px] font-mono font-bold text-slate-500 uppercase">Net Debt/Cash</span>
              <span className="block text-sm font-mono font-black text-slate-900 mt-0.5">${cover.net_debt_str}</span>
            </div>
            <div className="p-2 bg-white border border-slate-300 rounded text-center">
              <span className="block text-[10px] font-mono font-bold text-slate-500 uppercase">Employees</span>
              <span className="block text-sm font-mono font-black text-slate-900 mt-0.5">{cover.employees_str}</span>
            </div>
          </div>
        </div>

        {/* CHAPTER B: BUSINESS MODEL */}
        <div className="mb-8">
          <div className="border-b-2 border-slate-900 pb-1 mb-3 flex justify-between items-baseline">
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-900">
              B. Business Model (How They Make Money)
            </h3>
            <span className="text-xs font-mono text-slate-500">Demand Units & Value-Chain Positioning</span>
          </div>

          <div className="border border-slate-300 rounded p-3.5 bg-white mb-3 text-xs leading-relaxed space-y-1.5">
            <div><strong>Target Customers:</strong> {business_model.customers}</div>
            <div><strong>Revenue Contract Model:</strong> {business_model.revenue_model}</div>
            <div><strong>Unit of Demand:</strong> {business_model.unit_of_demand}</div>
          </div>

          {/* Segment & Geography Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
            <div>
              <div className="text-[11px] font-bold text-slate-700 uppercase mb-1">Segment Revenue Mix (10-K Sourced)</div>
              <table className="w-full text-left text-xs border border-slate-200">
                <thead className="bg-slate-900 text-white font-mono text-[10px] uppercase">
                  <tr>
                    <th className="p-1.5">Segment</th>
                    <th className="p-1.5 text-right">Share %</th>
                    <th className="p-1.5 text-right">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono">
                  {business_model.segment_mix.map((s, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="p-1.5 font-sans font-medium text-slate-900">{s.segment}</td>
                      <td className="p-1.5 text-right font-bold">{s.percentage_str}</td>
                      <td className="p-1.5 text-right text-[10px] text-cyan-700">[{s.source}]</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div>
              <div className="text-[11px] font-bold text-slate-700 uppercase mb-1">Geographic Revenue Mix (10-K Sourced)</div>
              <table className="w-full text-left text-xs border border-slate-200">
                <thead className="bg-slate-900 text-white font-mono text-[10px] uppercase">
                  <tr>
                    <th className="p-1.5">Region</th>
                    <th className="p-1.5 text-right">Share %</th>
                    <th className="p-1.5 text-right">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono">
                  {business_model.geographic_mix.map((g, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="p-1.5 font-sans font-medium text-slate-900">{g.region}</td>
                      <td className="p-1.5 text-right font-bold">{g.percentage_str}</td>
                      <td className="p-1.5 text-right text-[10px] text-cyan-700">[{g.source}]</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Value Chain */}
          <div className="border border-slate-300 rounded p-3.5 bg-white mb-3 text-xs leading-relaxed space-y-1">
            <div className="font-bold uppercase font-mono text-slate-700 text-[11px] mb-1">Value-Chain Map: Tier Position & Criticality</div>
            <div><strong>Position:</strong> {business_model.value_chain.tier_position}</div>
            <div><strong>Upstream Inputs:</strong> {business_model.value_chain.upstream}</div>
            <div><strong>Company Role:</strong> {business_model.value_chain.company_role}</div>
            <div><strong>Downstream Delivery:</strong> {business_model.value_chain.downstream}</div>
            <div><strong>Criticality Assessment:</strong> {business_model.value_chain.criticality}</div>
          </div>

          {/* What They Are Not */}
          <div className="border-l-4 border-amber-600 bg-amber-50/80 p-3 rounded text-xs text-amber-950 font-medium">
            <strong className="text-amber-800 font-mono text-[11px] uppercase block mb-0.5">
              What They Explicitly Are NOT (Category Error Filter)
            </strong>
            {business_model.what_they_are_not}
          </div>
        </div>

        {/* CHAPTER C: COMPETITIVE POSITION */}
        <div className="mb-8">
          <div className="border-b-2 border-slate-900 pb-1 mb-3 flex justify-between items-baseline">
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-900">
              C. Competitive Position & Scale Benchmarking
            </h3>
            <span className="text-xs font-mono text-slate-500">Peer Comparisons & Moat Hypotheses</span>
          </div>

          {/* Named Peers Scale Table */}
          <div className="overflow-x-auto mb-3">
            <table className="w-full text-left text-xs border border-slate-200">
              <thead className="bg-slate-900 text-white font-mono text-[10px] uppercase">
                <tr>
                  <th className="p-2">Company</th>
                  <th className="p-2 text-right">Market Cap</th>
                  <th className="p-2 text-right">EV</th>
                  <th className="p-2 text-right">TTM Sales</th>
                  <th className="p-2 text-right">Gross Mgn</th>
                  <th className="p-2 text-right">Op Mgn</th>
                  <th className="p-2 text-right">Fwd P/E</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono">
                {competitive.peers_table.map((p, idx) => (
                  <tr key={idx} className={p.is_target ? "bg-cyan-50 font-bold" : "hover:bg-slate-50"}>
                    <td className="p-2 font-sans text-slate-900">
                      {p.ticker} — {p.company_name} {p.is_target && <span className="text-cyan-700 text-[10px] uppercase font-mono">(Target)</span>}
                    </td>
                    <td className="p-2 text-right">${(p.market_cap / 1e9).toFixed(1)}B</td>
                    <td className="p-2 text-right">${(p.enterprise_value / 1e9).toFixed(1)}B</td>
                    <td className="p-2 text-right">${(p.revenue_ttm / 1e9).toFixed(1)}B</td>
                    <td className="p-2 text-right">{p.gross_margin_pct}%</td>
                    <td className="p-2 text-right">{p.operating_margin_pct}%</td>
                    <td className="p-2 text-right">{p.forward_pe || "---"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Moat Hypotheses */}
          <div className="border border-slate-300 rounded p-3.5 bg-white mb-3 text-xs leading-relaxed">
            <div className="font-bold uppercase font-mono text-slate-700 text-[11px] mb-1.5">
              Moat Hypotheses (Evidenced Only · Labeled as Hypothesis)
            </div>
            <ul className="space-y-1.5 pl-4 list-disc">
              {competitive.moat_hypotheses.map((m, idx) => (
                <li key={idx}>
                  <strong className="text-cyan-800">{m.label} {m.type}:</strong> {m.text}
                </li>
              ))}
            </ul>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-slate-300 rounded p-3 bg-white text-xs">
              <div className="font-bold uppercase font-mono text-slate-700 text-[11px] mb-1">Customer Concentration (10-K Sourced)</div>
              <p className="text-slate-800">{competitive.customer_concentration}</p>
              <span className="text-[10px] text-slate-500 font-mono mt-1 block">Source: {competitive.customer_concentration_source}</span>
            </div>
            <div className="border border-slate-300 rounded p-3 bg-white text-xs">
              <div className="font-bold uppercase font-mono text-slate-700 text-[11px] mb-1">Substitutes & Insourcing Risk</div>
              <p className="text-slate-800">{competitive.substitutes_and_insourcing_risk}</p>
            </div>
          </div>
        </div>

        {/* CHAPTER D: FINANCIAL QUALITY & ECONOMICS */}
        <div className="mb-8">
          <div className="border-b-2 border-slate-900 pb-1 mb-3 flex justify-between items-baseline">
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-900">
              D. Financial Statement Quality & Economics
            </h3>
            <span className="text-xs font-mono text-slate-500">Accruals Credibility & Multi-Year Audited Trends</span>
          </div>

          {/* Growth Ribbon */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-3">
            <div className="p-2 border border-slate-300 rounded text-center bg-white">
              <span className="block text-[10px] font-mono text-slate-500 uppercase">3-Yr Revenue CAGR</span>
              <span className="block text-sm font-mono font-bold text-slate-900 mt-0.5">
                {quality.growth.revenue_3y_cagr ? `+${quality.growth.revenue_3y_cagr}%` : 'N/A'}
              </span>
            </div>
            <div className="p-2 border border-slate-300 rounded text-center bg-white">
              <span className="block text-[10px] font-mono text-slate-500 uppercase">5-Yr Revenue CAGR</span>
              <span className="block text-sm font-mono font-bold text-slate-900 mt-0.5">
                {quality.growth.revenue_5y_cagr ? `+${quality.growth.revenue_5y_cagr}%` : 'N/A'}
              </span>
            </div>
            <div className="p-2 border border-slate-300 rounded text-center bg-white">
              <span className="block text-[10px] font-mono text-slate-500 uppercase">Latest FY Growth</span>
              <span className="block text-sm font-mono font-bold text-slate-900 mt-0.5">
                {quality.growth.latest_fy_growth_pct ? `${quality.growth.latest_fy_growth_pct}%` : 'N/A'}
              </span>
            </div>
            <div className="p-2 border border-slate-300 rounded text-center bg-white">
              <span className="block text-[10px] font-mono text-slate-500 uppercase">CapEx / Sales</span>
              <span className="block text-sm font-mono font-bold text-slate-900 mt-0.5">
                {quality.capital_intensity.capex_to_sales_pct}%
              </span>
            </div>
            <div className="p-2 border border-slate-300 rounded text-center bg-white">
              <span className="block text-[10px] font-mono text-slate-500 uppercase">Return on Equity</span>
              <span className="block text-sm font-mono font-bold text-slate-900 mt-0.5">
                {quality.capital_intensity.return_on_equity_pct ? `${quality.capital_intensity.return_on_equity_pct}%` : 'N/A'}
              </span>
            </div>
          </div>

          {/* Margins Table */}
          <div className="text-[11px] font-bold text-slate-700 uppercase mb-1">Multi-Year Margin History (Audited Annuals + TTM)</div>
          <table className="w-full text-left text-xs border border-slate-200 mb-3">
            <thead className="bg-slate-900 text-white font-mono text-[10px] uppercase">
              <tr>
                <th className="p-1.5">Period</th>
                <th className="p-1.5 text-right">Revenue</th>
                <th className="p-1.5 text-right">Gross Margin</th>
                <th className="p-1.5 text-right">Operating Margin</th>
                <th className="p-1.5 text-right">Net Margin</th>
                <th className="p-1.5 text-right">Source Footnote</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-mono">
              {quality.profitability_table.map((r, idx) => (
                <tr key={idx} className={r.period === 'TTM' ? "bg-cyan-50 font-bold" : "hover:bg-slate-50"}>
                  <td className="p-1.5">{r.period}</td>
                  <td className="p-1.5 text-right">${(r.revenue / 1e9).toFixed(2)}B</td>
                  <td className="p-1.5 text-right">{r.gross_margin_pct}%</td>
                  <td className="p-1.5 text-right">{r.operating_margin_pct}%</td>
                  <td className="p-1.5 text-right">{r.net_margin_pct}%</td>
                  <td className="p-1.5 text-right text-[10px] text-cyan-700">[{r.source_id}]</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Quality Checks */}
          <div className="border border-slate-300 rounded p-3.5 bg-white text-xs">
            <div className="font-bold uppercase font-mono text-slate-700 text-[11px] mb-2">Accounting Quality & Accruals Red Flag Checks</div>
            <div className="space-y-2">
              {quality.quality_checks.map((q, idx) => (
                <div key={idx} className="p-2 rounded bg-slate-50 border border-slate-200">
                  <div className="flex justify-between items-center mb-0.5">
                    <strong>{q.test}</strong>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                      q.status === 'CLEAN' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {q.status}: {q.result}
                    </span>
                  </div>
                  <p className="text-slate-600 text-[11px]">{q.finding}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CHAPTER E: VALUATION IN CONTEXT */}
        <div className="mb-8">
          <div className="border-b-2 border-slate-900 pb-1 mb-3 flex justify-between items-baseline">
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-900">
              E. Valuation in Context
            </h3>
            <span className="text-xs font-mono text-slate-500">Multiples Matrix & Market Implied Pricing</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
            <div className="border border-slate-300 rounded p-3 bg-white text-xs">
              <div className="font-bold uppercase font-mono text-slate-700 text-[11px] mb-2">Absolute Trading Multiples</div>
              <div className="divide-y divide-slate-200 font-mono">
                <div className="flex justify-between py-1"><span>Trailing P/E:</span><strong>{valuation.absolute_multiples.pe_trailing || 'N/A'}</strong></div>
                <div className="flex justify-between py-1"><span>Forward P/E:</span><strong>{valuation.absolute_multiples.pe_forward || 'N/A'}</strong></div>
                <div className="flex justify-between py-1"><span>EV / Sales:</span><strong>{valuation.absolute_multiples.ev_sales || 'N/A'}x</strong></div>
                <div className="flex justify-between py-1"><span>EV / EBITDA:</span><strong>{valuation.absolute_multiples.ev_ebitda || 'N/A'}x</strong></div>
                <div className="flex justify-between py-1"><span>FCF Yield:</span><strong>{valuation.absolute_multiples.fcf_yield_pct || 'N/A'}%</strong></div>
              </div>
            </div>

            <div className="border border-slate-300 rounded p-3 bg-white text-xs">
              <div className="font-bold uppercase font-mono text-slate-700 text-[11px] mb-2">5-Year Historical Range</div>
              <div className="divide-y divide-slate-200 font-mono">
                <div className="flex justify-between py-1"><span>5Y High Price:</span><strong>${valuation.historical_context["5y_high_price"] || 'N/A'}</strong></div>
                <div className="flex justify-between py-1"><span>5Y Low Price:</span><strong>${valuation.historical_context["5y_low_price"] || 'N/A'}</strong></div>
                <div className="flex justify-between py-1"><span>5Y Median Price:</span><strong>${valuation.historical_context["5y_median_price"] || 'N/A'}</strong></div>
                <div className="flex justify-between py-1"><span>Spread vs High:</span><strong>{valuation.historical_context["current_vs_5y_high_pct"] || 'N/A'}%</strong></div>
                <div className="flex justify-between py-1"><span>Spread vs Low:</span><strong>+{valuation.historical_context["current_vs_5y_low_pct"] || 'N/A'}%</strong></div>
              </div>
            </div>
          </div>

          <div className="border border-slate-300 rounded p-3 bg-white text-xs mb-3">
            <div className="font-bold uppercase font-mono text-slate-700 text-[11px] mb-1">What the Market is Pricing (Desk Synthesis)</div>
            <p className="text-slate-800 leading-relaxed">{valuation.what_market_is_pricing}</p>
          </div>

          <div className="border-l-4 border-slate-500 bg-slate-50 p-3 rounded text-xs text-slate-600 font-mono">
            <strong>DCF Policy:</strong> {valuation.dcf_model.disclaimer}
          </div>
        </div>

        {/* CHAPTER F: CATALYSTS, RISKS & WATCHLIST */}
        <div className="mb-8">
          <div className="border-b-2 border-slate-900 pb-1 mb-3 flex justify-between items-baseline">
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-900">
              F. Catalysts, Sourced Risks & Next-Quarter Monitoring
            </h3>
            <span className="text-xs font-mono text-slate-500">Trading Desk Execution Checklist</span>
          </div>

          <table className="w-full text-left text-xs border border-slate-200 mb-3">
            <thead className="bg-slate-900 text-white font-mono text-[10px] uppercase">
              <tr>
                <th className="p-1.5">Catalyst Event</th>
                <th className="p-1.5">Timing</th>
                <th className="p-1.5">Primary Source</th>
                <th className="p-1.5">Desk Implication</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {synthesis.catalysts.map((c, idx) => (
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="p-1.5 font-bold text-slate-900">{c.event}</td>
                  <td className="p-1.5 font-mono text-slate-600">{c.timing}</td>
                  <td className="p-1.5 font-mono text-cyan-800 text-[11px]">{c.source}</td>
                  <td className="p-1.5 text-slate-700">{c.implication}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-slate-300 rounded p-3 bg-white text-xs">
              <div className="font-bold uppercase font-mono text-slate-700 text-[11px] mb-1.5">Categorized 10-K Risks (Item 1A)</div>
              <div className="space-y-1 text-slate-800">
                <div><strong>Operational:</strong> {synthesis.risks.operational}</div>
                <div><strong>Financial:</strong> {synthesis.risks.financial}</div>
                <div><strong>Regulatory:</strong> {synthesis.risks.regulatory}</div>
                <div><strong>Cyclical:</strong> {synthesis.risks.cyclical}</div>
              </div>
            </div>

            <div className="border border-slate-300 rounded p-3 bg-white text-xs">
              <div className="font-bold uppercase font-mono text-slate-700 text-[11px] mb-1.5">Next-Quarter Desk Watchlist</div>
              <ol className="space-y-1 list-decimal pl-4 text-slate-800">
                {synthesis.watchlist.map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ol>
            </div>
          </div>
        </div>

        {/* CHAPTER G: SOURCES APPENDIX */}
        <div className="pt-4 border-t-2 border-slate-900">
          <div className="flex justify-between items-baseline mb-2">
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-900">
              G. Sources Appendix & Audit Trail
            </h3>
            <span className="text-xs font-mono text-slate-500">Every Table Cell Traces to a Verified Source</span>
          </div>

          <div className="space-y-1 font-mono text-[11px] text-slate-600 border border-slate-200 rounded p-3 bg-slate-50">
            {sources.entries.map((src, idx) => (
              <div key={idx} className="flex gap-2">
                <span className="text-cyan-700 font-bold">[{src.id}]</span>
                <span>{src.description} — {src.details}</span>
              </div>
            ))}
          </div>

          {sources.failed_fetches && sources.failed_fetches.length > 0 && (
            <div className="mt-3 p-3 bg-rose-50 border-l-4 border-rose-600 rounded text-xs text-rose-900">
              <strong>Explicit Inventory of Failed Fetches:</strong>
              <ul className="list-disc pl-4 mt-1">
                {sources.failed_fetches.map((f, idx) => (
                  <li key={idx}><strong>{f.field}:</strong> {f.reason}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
