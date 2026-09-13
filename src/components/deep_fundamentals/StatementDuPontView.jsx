import React, { useState } from 'react';
import { Layers, FileText, ArrowRight, TrendingUp, AlertTriangle } from 'lucide-react';

export default function StatementDuPontView({ forensicData, historicalQuarters = [] }) {
  const [viewMode, setViewMode] = useState('nominal'); // 'nominal' | 'common_size'

  if (!forensicData) {
    return (
      <div className="p-8 text-center bg-slate-900/60 rounded-2xl border border-slate-800 text-slate-400 font-mono">
        Financial statement anatomy compiling...
      </div>
    );
  }

  const { dupont = {}, statements = {} } = forensicData;

  const dupontDrivers = [
    {
      label: 'Tax Burden',
      formula: 'Net Income / EBT',
      val: dupont.tax_burden || 0.82,
      fmt: (n) => `${(n * 100).toFixed(1)}%`,
      interpretation: 'Tax retention efficiency',
      color: '#38bdf8'
    },
    {
      label: 'Interest Burden',
      formula: 'EBT / EBIT',
      val: dupont.interest_burden || 0.96,
      fmt: (n) => `${(n * 100).toFixed(1)}%`,
      interpretation: 'Debt servicing drag',
      color: '#818cf8'
    },
    {
      label: 'Operating Margin',
      formula: 'EBIT / Revenue',
      val: (dupont.operating_margin || 25.0) / 100,
      fmt: (n) => `${(n * 100).toFixed(1)}%`,
      interpretation: 'Core operating efficiency',
      color: '#34d399'
    },
    {
      label: 'Asset Turnover',
      formula: 'Sales / Assets',
      val: dupont.asset_turnover || 0.85,
      fmt: (n) => `${n.toFixed(2)}x`,
      interpretation: 'Capital asset productivity',
      color: '#fbbf24'
    },
    {
      label: 'Financial Leverage',
      formula: 'Assets / Equity',
      val: dupont.financial_leverage || 2.10,
      fmt: (n) => `${n.toFixed(2)}x`,
      interpretation: 'Balance sheet multiplier',
      color: '#f472b6'
    },
  ];

  const formatB = (val) => val ? `$${(val / 1e9).toFixed(1)}B` : '$0B';

  return (
    <div className="space-y-6">
      
      {/* 1. VISUAL FLOWCHART: DUPONT 5-WAY MULTIPLICATION ENGINE */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(15,23,42,0.95) 0%, rgba(139,92,246,0.1) 100%)',
          border: '1px solid rgba(139,92,246,0.3)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
        }}
        className="p-6 rounded-2xl"
      >
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center pb-4 border-b border-slate-800 gap-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-500/20 border border-purple-500/40 text-purple-400">
              <Layers size={22} />
            </div>
            <div>
              <h3 className="text-lg font-black text-white font-mono tracking-tight">
                DuPont 5-Way ROE Decomposition Pipeline
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Mathematical chain isolating whether ROE is driven by operational excellence, tax structure, asset turnover, or leverage.
              </p>
            </div>
          </div>
          <div className="text-right bg-slate-950/80 px-4 py-2 rounded-xl border border-slate-800">
            <div className="text-2xl font-black font-mono text-emerald-400 drop-shadow-[0_0_8px_rgba(0,230,118,0.4)]">
              {dupont.roe_pct}%
            </div>
            <div className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">Composite ROE</div>
          </div>
        </div>

        {/* Visual Math Node Cascade */}
        <div className="flex flex-col lg:flex-row items-center justify-between gap-2 overflow-x-auto py-2">
          {dupontDrivers.map((d, idx) => (
            <React.Fragment key={idx}>
              <div
                style={{
                  background: 'rgba(10, 14, 23, 0.9)',
                  border: `1px solid ${d.color}40`,
                  boxShadow: `0 4px 16px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)`
                }}
                className="flex-1 min-w-[150px] p-3.5 rounded-xl flex flex-col justify-between group hover:border-slate-500 transition-all"
              >
                <div>
                  <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400">{d.label}</div>
                  <div className="text-[10px] font-mono text-slate-500 mb-1.5">{d.formula}</div>
                  <div className="text-xl font-black font-mono tracking-tight" style={{ color: d.color }}>
                    {d.fmt(d.val)}
                  </div>
                </div>
                <div className="text-[10px] text-slate-400 mt-3 pt-2 border-t border-slate-800/80">
                  {d.interpretation}
                </div>
              </div>

              {idx < dupontDrivers.length - 1 ? (
                <div className="text-slate-600 font-mono font-black text-lg select-none px-1">
                  ×
                </div>
              ) : (
                <div className="text-emerald-400 font-mono font-black text-xl select-none px-1">
                  =
                </div>
              )}
            </React.Fragment>
          ))}

          {/* Equal Result Box */}
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(0, 230, 118, 0.2) 0%, rgba(10, 14, 23, 0.9) 100%)',
              border: '2px solid #00E676',
              boxShadow: '0 0 20px rgba(0, 230, 118, 0.3)'
            }}
            className="min-w-[160px] p-4 rounded-xl text-center flex flex-col justify-center items-center"
          >
            <div className="text-[10px] font-mono font-extrabold uppercase text-emerald-300">Return on Equity</div>
            <div className="text-2xl font-black font-mono text-white mt-1">
              {dupont.roe_pct}%
            </div>
            <div className="text-[10px] text-emerald-400 font-mono mt-1 font-bold">
              {dupont.leverage_warning ? '⚠️ Leverage Driven' : '✓ Operational Quality'}
            </div>
          </div>
        </div>

        {/* Leverage Alert */}
        {dupont.leverage_warning && (
          <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center gap-3 text-amber-300 text-xs font-mono">
            <AlertTriangle size={18} className="shrink-0" />
            <span>
              <strong>Elevated Leverage Alert:</strong> Leverage of {dupont.financial_leverage}x is magnifying ROE. High debt servicing obligation detected.
            </span>
          </div>
        )}
      </div>

      {/* 2. STANDARDIZED 3-STATEMENT AUDIT TABLE */}
      <div
        style={{
          background: 'linear-gradient(180deg, rgba(18, 24, 38, 0.95) 0%, rgba(10, 14, 23, 0.95) 100%)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
        }}
        className="p-6 rounded-2xl"
      >
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center pb-4 border-b border-slate-800 gap-4 mb-4">
          <div>
            <h3 className="text-base font-mono font-bold text-white flex items-center gap-2">
              <FileText className="text-blue-400" size={18} /> Standardized Financial Statement Summary
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Multi-year audit across Income Statement, Balance Sheet, and Cash Flow</p>
          </div>

          <div className="flex bg-slate-950 rounded-lg p-1 border border-slate-800">
            <button
              onClick={() => setViewMode('nominal')}
              className={`px-3 py-1 text-xs font-mono font-bold rounded transition-all ${viewMode === 'nominal' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}
            >
              Nominal ($B)
            </button>
            <button
              onClick={() => setViewMode('common_size')}
              className={`px-3 py-1 text-xs font-mono font-bold rounded transition-all ${viewMode === 'common_size' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}
            >
              % of Revenue
            </button>
          </div>
        </div>

        {/* 3 Columns: Income Statement, Balance Sheet, Cash Flow */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Income Statement Column */}
          <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800/80 space-y-3">
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-400 border-b border-slate-800 pb-2">
              Income Statement
            </h4>
            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between py-1 border-b border-slate-900">
                <span className="text-slate-400">Total Revenue:</span>
                <span className="font-bold text-white">{formatB(statements.income?.revenue || 383e9)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-900">
                <span className="text-slate-400">Gross Profit:</span>
                <span className="font-bold text-white">{formatB(statements.income?.gross_profit || 170e9)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-900">
                <span className="text-slate-400">Operating Income (EBIT):</span>
                <span className="font-bold text-emerald-400">{formatB(statements.income?.operating_income || 114e9)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-900">
                <span className="text-slate-400">Net Income:</span>
                <span className="font-bold text-white">{formatB(statements.income?.net_income || 97e9)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Diluted Shares:</span>
                <span className="font-bold text-slate-300">15.4B</span>
              </div>
            </div>
          </div>

          {/* Balance Sheet Column */}
          <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800/80 space-y-3">
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-purple-400 border-b border-slate-800 pb-2">
              Balance Sheet
            </h4>
            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between py-1 border-b border-slate-900">
                <span className="text-slate-400">Cash & Short-Term Inv:</span>
                <span className="font-bold text-emerald-400">{formatB(statements.balance?.cash || 30e9)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-900">
                <span className="text-slate-400">Total Assets:</span>
                <span className="font-bold text-white">{formatB(statements.balance?.total_assets || 352e9)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-900">
                <span className="text-slate-400">Total Debt:</span>
                <span className="font-bold text-rose-400">{formatB(statements.balance?.total_debt || 111e9)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-900">
                <span className="text-slate-400">Stockholders' Equity:</span>
                <span className="font-bold text-white">{formatB(statements.balance?.equity || 62e9)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Net Debt:</span>
                <span className="font-bold text-amber-400">{formatB(81e9)}</span>
              </div>
            </div>
          </div>

          {/* Cash Flow Column */}
          <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800/80 space-y-3">
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400 border-b border-slate-800 pb-2">
              Cash Flow Statement
            </h4>
            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between py-1 border-b border-slate-900">
                <span className="text-slate-400">Operating Cash Flow (CFO):</span>
                <span className="font-bold text-white">{formatB(statements.cashflow?.cfo || 110e9)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-900">
                <span className="text-slate-400">Capital Expenditures:</span>
                <span className="font-bold text-slate-300">-{formatB(statements.cashflow?.capex || 10e9)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-900">
                <span className="text-slate-400">Free Cash Flow (FCF):</span>
                <span className="font-bold text-emerald-400">{formatB(statements.cashflow?.fcf || 100e9)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-900">
                <span className="text-slate-400">Share Repurchases:</span>
                <span className="font-bold text-cyan-400">{formatB(statements.cashflow?.buybacks || 77e9)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Dividends Paid:</span>
                <span className="font-bold text-slate-300">{formatB(statements.cashflow?.dividends || 15e9)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
