import React, { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, ComposedChart } from 'recharts';
import { TrendingUp, AlertTriangle, Briefcase, FileText, Activity, Layers, DollarSign, PieChart, ShieldAlert, BarChart2, Target } from 'lucide-react';

export default function DeepFundamentalsDashboard({ currentTicker = 'AAPL' }) {
  const [data, setData] = useState({
    fundamentals: null,
    secFilings: null,
    peerValuation: null,
    macroOutlook: null
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true);
      try {
        const [fundRes, secRes, peerRes, macroRes] = await Promise.all([
          fetch(`/api/deep_fundamentals?ticker=${currentTicker}`),
          fetch(`/api/sec_filings?ticker=${currentTicker}`),
          fetch(`/api/peer_valuation?ticker=${currentTicker}`),
          fetch(`/api/macro_outlook?ticker=${currentTicker}`)
        ]);

        setData({
          fundamentals: await fundRes.json(),
          secFilings: await secRes.json(),
          peerValuation: await peerRes.json(),
          macroOutlook: await macroRes.json()
        });
      } catch (err) {
        console.error("Error fetching deep fundamentals:", err);
      } finally {
        setLoading(false);
      }
    };
    
    if (currentTicker) fetchAllData();
  }, [currentTicker]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-slate-800 rounded-lg border-2 border-slate-700">
        <Activity className="w-12 h-12 text-blue-400 animate-spin mb-4" />
        <h3 className="text-slate-300 font-mono text-lg">Running Deep Fundamental AI Scan...</h3>
      </div>
    );
  }

  const { fundamentals, secFilings, peerValuation, macroOutlook } = data;

  // Format big numbers
  const formatBillions = (val) => val ? `$${(val / 1e9).toFixed(1)}B` : '0';

  // Format markdown-like text safely
  const renderMarkdown = (text) => {
    if (!text) return null;
    return text.split('\n').map((line, i) => {
      if (line.startsWith('###')) return <h3 key={i} className="text-lg font-bold text-slate-100 mt-4 mb-2">{line.replace('###', '').trim()}</h3>;
      if (line.startsWith('**')) return <p key={i} className="font-bold text-slate-200 mt-2">{line.replace(/\*\*/g, '')}</p>;
      if (line.startsWith('-') || line.startsWith('*') || /^\d+\./.test(line)) return <li key={i} className="ml-4 text-slate-300 list-disc">{line.replace(/^[-*\d.]+\s/, '')}</li>;
      return <p key={i} className="text-slate-300 mb-2">{line}</p>;
    });
  };

  const getRecommendationColor = (rec) => {
    if (!rec) return 'bg-slate-700 text-slate-200';
    if (rec.includes('Buy')) return 'bg-green-500 text-white';
    if (rec.includes('Sell')) return 'bg-red-500 text-white';
    return 'bg-yellow-500 text-white';
  };

  return (
    <div className="space-y-6">
      
      {/* SECTION 0: Company Overview & Brand Portfolio */}
      {fundamentals && fundamentals.company_overview && (
        <div className="glass-card" style={{ padding: '2rem' }}>
          <div className="flex flex-col md:flex-row items-stretch gap-8">
            {/* Left Column: Brand Identity */}
            <div className="w-full md:w-1/4 flex flex-col items-center justify-center p-8 bg-slate-800/80 rounded-2xl border border-slate-700/50 shadow-inner relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-cyan-400"></div>
              
              <div className="w-32 h-32 flex items-center justify-center bg-white/5 rounded-2xl mb-6 p-4 border border-white/10 shadow-lg group-hover:scale-105 transition-transform duration-500">
                {fundamentals.logo_url ? (
                  <img src={fundamentals.logo_url} alt={`${fundamentals.ticker} logo`} className="w-full h-full object-contain filter drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]" onError={(e) => e.target.style.display = 'none'} />
                ) : (
                  <div className="text-4xl font-black text-slate-500">{fundamentals.ticker}</div>
                )}
              </div>
              
              <h3 className="text-3xl font-black text-white text-center tracking-tight">{fundamentals.ticker}</h3>
              <div className="text-xs font-bold text-cyan-400 text-center mt-2 uppercase tracking-widest bg-cyan-500/10 px-3 py-1 rounded-full border border-cyan-500/20">{fundamentals.sector}</div>
              <div className="text-sm text-slate-400 text-center mt-3 font-medium">{fundamentals.industry}</div>
              
              {fundamentals.website && (
                <a href={fundamentals.website} target="_blank" rel="noreferrer" className="mt-6 w-full text-center py-3 bg-slate-700/50 text-slate-300 rounded-xl text-sm font-bold hover:bg-blue-500 hover:text-white transition-all duration-300 border border-slate-600 hover:border-blue-400 shadow-sm">
                  Visit Official Website
                </a>
              )}
            </div>
            
            {/* Right Column: Overview & Products */}
            <div className="w-full md:w-3/4 flex flex-col gap-6">
              
              {/* Executive Summary Box */}
              <div className="bg-slate-800/40 p-6 rounded-2xl border border-slate-700/50">
                <h3 className="text-xl font-bold text-white flex items-center gap-3 mb-4">
                  <Briefcase className="text-blue-400" size={24} /> 
                  Company Overview & Core Portfolio
                </h3>
                <div className="text-slate-300 text-sm leading-relaxed space-y-4">
                  {/* Split the massive block of text into readable paragraphs */}
                  {fundamentals.company_overview.split('. ').slice(0, 4).join('. ') + '.'}
                  <br/><br/>
                  <span className="text-slate-400">
                    {fundamentals.company_overview.split('. ').slice(4).join('. ')}
                  </span>
                </div>
              </div>
              
              {/* Fundamental Velocity (Acceleration) Grid */}
              {fundamentals.acceleration_metrics && Object.keys(fundamentals.acceleration_metrics).length > 0 && (
                <div className="bg-slate-800/40 p-6 rounded-2xl border border-slate-700/50">
                  <h3 className="text-xl font-bold text-white flex items-center gap-3 mb-4">
                    <TrendingUp className="text-purple-400" size={24} /> 
                    Fundamental Velocity (QoQ Rate of Change)
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {Object.entries(fundamentals.acceleration_metrics).map(([key, metric]) => {
                      const title = key.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
                      
                      const getStatusIcon = (status) => {
                        if (status === 'Accelerating' || status === 'Expanding') return <TrendingUp size={16} className="text-green-400" />;
                        if (status === 'Decelerating' || status === 'Contracting') return <TrendingUp size={16} className="text-red-400 transform rotate-180" />;
                        return <Activity size={16} className="text-yellow-400" />;
                      };
                      
                      const getStatusColor = (status) => {
                        if (status === 'Accelerating' || status === 'Expanding') return 'bg-green-500/10 border-green-500/20 text-green-400';
                        if (status === 'Decelerating' || status === 'Contracting') return 'bg-red-500/10 border-red-500/20 text-red-400';
                        return 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400';
                      };

                      return (
                        <div key={key} className="bg-slate-900/50 rounded-xl p-4 border border-slate-700">
                          <div className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">{title}</div>
                          
                          <div className="flex items-center gap-2 mb-3">
                            <span className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-bold border ${getStatusColor(metric.status)}`}>
                              {getStatusIcon(metric.status)}
                              {metric.status}
                            </span>
                          </div>
                          
                          {metric.growth_q2 !== undefined ? (
                            <div className="text-sm text-slate-300">
                              <span className="font-bold text-white">{metric.growth_q2 > 0 ? '+' : ''}{metric.growth_q2}%</span> vs prev {metric.growth_q1 > 0 ? '+' : ''}{metric.growth_q1}%
                            </div>
                          ) : (
                            <div className="text-sm text-slate-300">
                              <span className="font-bold text-white">{metric.bps_change > 0 ? '+' : ''}{metric.bps_change} bps</span> change
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              


            </div>
          </div>
        </div>
      )}
      
      {/* SECTION 1: Fundamental Recommendation Banner */}
      {fundamentals && !fundamentals.error && (
        <div className="glass-card relative overflow-hidden" style={{ padding: '2rem', borderTop: `4px solid ${getRecommendationColor(fundamentals.recommendation).split(' ')[0].replace('bg-', '')}` }}>
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob"></div>
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
            <div>
              <h2 className="text-4xl font-black uppercase tracking-tight mb-2 flex items-center gap-3 text-white">
                <Target size={32} style={{ color: '#4facfe' }} /> Fundamental Rating: 
                <span style={{ color: getRecommendationColor(fundamentals.recommendation).includes('green') ? '#10b981' : getRecommendationColor(fundamentals.recommendation).includes('red') ? '#ef4444' : '#f59e0b' }}>
                   {fundamentals.recommendation}
                </span>
              </h2>
              <div className="flex gap-2 flex-wrap mt-3">
                {fundamentals.reasons && fundamentals.reasons.map((r, i) => (
                  <span key={i} style={{ background: 'rgba(79, 172, 254, 0.1)', border: '1px solid rgba(79, 172, 254, 0.2)' }} className="px-3 py-1 rounded-full text-sm font-bold text-blue-300 shadow-sm">
                    {r}
                  </span>
                ))}
              </div>
            </div>
            <div className="text-right">
              <div className="text-7xl font-black" style={{ background: 'linear-gradient(to right, #4facfe 0%, #00f2fe 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                {fundamentals.score}
              </div>
              <div className="text-sm font-bold uppercase opacity-80 tracking-widest text-slate-300">Conviction Score</div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 1.5: Fair Value Assessment (DCF Model) */}
      {fundamentals && fundamentals.fair_value_data && !fundamentals.fair_value_data.error && (
        <div className="glass-card" style={{ padding: '2rem' }}>
          <h3 className="text-xl font-bold text-white flex items-center gap-2 mb-6">
            <DollarSign className={fundamentals.fair_value_data.discount_pct > 0 ? "text-green-400" : "text-red-400"} /> 
            Intrinsic Valuation (DCF Model)
          </h3>
          
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="w-full md:w-1/3">
              <div className="text-5xl font-black text-white mb-2">${fundamentals.fair_value_data.fair_value.toFixed(2)}</div>
              <div className="text-slate-400 font-bold uppercase tracking-wider text-sm mb-4">Calculated Fair Value</div>
              
              <div className="inline-block px-4 py-2 rounded-lg font-bold" style={{
                background: fundamentals.fair_value_data.discount_pct > 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                color: fundamentals.fair_value_data.discount_pct > 0 ? '#10b981' : '#ef4444',
                border: `1px solid ${fundamentals.fair_value_data.discount_pct > 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`
              }}>
                {Math.abs(fundamentals.fair_value_data.discount_pct).toFixed(1)}% {fundamentals.fair_value_data.valuation_status}
              </div>
            </div>
            
            <div className="w-full md:w-2/3 relative h-32 flex items-center px-4">
              {/* Premium Gradient Track */}
              <div className="w-full h-5 rounded-full relative" style={{ 
                background: 'linear-gradient(90deg, rgba(16,185,129,0.8) 0%, rgba(245,158,11,0.8) 50%, rgba(239,68,68,0.8) 100%)', 
                boxShadow: 'inset 0 2px 5px rgba(0,0,0,0.6), 0 0 15px rgba(255,255,255,0.05)' 
              }}>
                {/* Fair Value Center Pin */}
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-1 h-12 bg-white shadow-[0_0_12px_rgba(255,255,255,0.8)] z-10 rounded-full"></div>
                <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 text-white font-bold text-xs uppercase tracking-widest whitespace-nowrap bg-blue-500/20 px-3 py-1.5 rounded-md border border-blue-500/30 backdrop-blur-md shadow-lg">Fair Value</div>
                
                {/* Current Price Marker */}
                {(() => {
                  const fv = fundamentals.fair_value_data.fair_value;
                  const cp = fundamentals.fair_value_data.current_price;
                  const isUndervalued = cp < fv;
                  
                  let positionPct = 50; 
                  if (fv > 0) {
                     const ratio = cp / fv;
                     positionPct = Math.min(Math.max((ratio / 2) * 100, 5), 95);
                  }
                  
                  return (
                    <div className="absolute top-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center transition-all duration-1000 ease-out hover:scale-110 cursor-pointer" style={{ left: `${positionPct}%` }}>
                      {/* Glow effect behind pointer */}
                      <div className="absolute w-10 h-10 rounded-full blur-md animate-pulse" style={{ background: isUndervalued ? '#10b981' : '#ef4444', opacity: 0.6 }}></div>
                      
                      {/* Pointer Node */}
                      <div className="w-7 h-7 rounded-full border-4 border-slate-900 relative z-30 flex items-center justify-center shadow-xl" style={{ background: isUndervalued ? '#34d399' : '#f87171' }}>
                        <div className="w-2 h-2 bg-slate-900 rounded-full"></div>
                      </div>
                      
                      {/* Floating Label */}
                      <div className="absolute top-10 flex flex-col items-center bg-slate-800 border border-slate-600/80 px-3 py-1 rounded-lg shadow-xl z-50">
                        <div className="font-black text-lg text-white whitespace-nowrap">${cp.toFixed(2)}</div>
                        <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Current</div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {fundamentals && fundamentals.fair_value_data && fundamentals.fair_value_data.error && (
         <div className="glass-card" style={{ padding: '1rem', borderLeft: '4px solid #f59e0b' }}>
           <h3 className="text-sm font-bold text-yellow-500 flex items-center gap-2"><AlertTriangle size={16}/> Valuation Unavailable</h3>
           <p className="text-slate-400 text-xs mt-1">{fundamentals.fair_value_data.error}</p>
         </div>
      )}

      {/* SECTION 2: 10-Quarter Financial Charts */}
      {fundamentals && fundamentals.history && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
            <h3 className="text-xl font-bold text-white flex items-center gap-2 mb-4" style={{ textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>
              <BarChart2 className="text-blue-400" /> Revenue vs Net Income
            </h3>
            <div style={{ height: '350px', width: '100%', minHeight: '350px', flex: 1 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={fundamentals.history}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4facfe" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#00f2fe" stopOpacity={0.2}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="quarter" stroke="#94a3b8" tick={{ fill: '#94a3b8' }} axisLine={false} />
                  <YAxis yAxisId="left" tickFormatter={(v) => `$${(v/1e9).toFixed(1)}B`} stroke="#94a3b8" tick={{ fill: '#94a3b8' }} axisLine={false} />
                  <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `$${(v/1e9).toFixed(1)}B`} stroke="#94a3b8" tick={{ fill: '#94a3b8' }} axisLine={false} />
                  <RechartsTooltip cursor={{fill: 'rgba(255,255,255,0.05)'}} contentStyle={{backgroundColor: 'rgba(15, 23, 42, 0.9)', borderColor: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)', borderRadius: '8px'}} formatter={(val) => formatBillions(val)} />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} />
                  <Bar yAxisId="left" dataKey="revenue" name="Revenue" fill="url(#colorRev)" radius={[4, 4, 0, 0]} />
                  <Line yAxisId="right" type="monotone" dataKey="net_income" name="Net Income" stroke="#10b981" strokeWidth={3} dot={{r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#0f172a'}} activeDot={{ r: 6 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
            <h3 className="text-xl font-bold text-white flex items-center gap-2 mb-4" style={{ textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>
              <Activity className="text-purple-400" /> Margins & Free Cash Flow
            </h3>
            <div style={{ height: '350px', width: '100%', minHeight: '350px', flex: 1 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={fundamentals.history}>
                  <defs>
                    <linearGradient id="colorFcf" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.2}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="quarter" stroke="#94a3b8" tick={{ fill: '#94a3b8' }} axisLine={false} />
                  <YAxis yAxisId="left" tickFormatter={(v) => `${v.toFixed(0)}%`} stroke="#94a3b8" tick={{ fill: '#94a3b8' }} axisLine={false} />
                  <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `$${(v/1e9).toFixed(1)}B`} stroke="#94a3b8" tick={{ fill: '#94a3b8' }} axisLine={false} />
                  <RechartsTooltip cursor={{fill: 'rgba(255,255,255,0.05)'}} contentStyle={{backgroundColor: 'rgba(15, 23, 42, 0.9)', borderColor: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)', borderRadius: '8px'}} />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} />
                  <Line yAxisId="left" type="monotone" dataKey="gross_margin" name="Gross Margin %" stroke="#38bdf8" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                  <Line yAxisId="left" type="monotone" dataKey="operating_margin" name="Operating Margin %" stroke="#f472b6" strokeWidth={2} strokeDasharray="3 3" dot={false} />
                  <Line yAxisId="left" type="monotone" dataKey="net_margin" name="Net Margin %" stroke="#a855f7" strokeWidth={3} dot={{r: 4, fill: '#a855f7', strokeWidth: 2, stroke: '#0f172a'}} activeDot={{ r: 6 }} />
                  <Bar yAxisId="right" dataKey="fcf" name="Free Cash Flow" fill="url(#colorFcf)" radius={[4, 4, 0, 0]} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
            <h3 className="text-xl font-bold text-white flex items-center gap-2 mb-4" style={{ textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>
              <TrendingUp className="text-cyan-400" /> Earnings Per Share (EPS) Trajectory
            </h3>
            <div style={{ height: '350px', width: '100%', minHeight: '350px', flex: 1 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={fundamentals.history}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="quarter" stroke="#94a3b8" tick={{ fill: '#94a3b8' }} axisLine={false} />
                  <YAxis tickFormatter={(v) => `$${v.toFixed(2)}`} stroke="#94a3b8" tick={{ fill: '#94a3b8' }} axisLine={false} />
                  <RechartsTooltip cursor={{fill: 'rgba(255,255,255,0.05)'}} contentStyle={{backgroundColor: 'rgba(15, 23, 42, 0.9)', borderColor: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)', borderRadius: '8px'}} />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} />
                  <Line type="monotone" dataKey="eps" name="Diluted EPS" stroke="#06b6d4" strokeWidth={3} dot={{r: 4, fill: '#06b6d4', strokeWidth: 2, stroke: '#0f172a'}} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
            <h3 className="text-xl font-bold text-white flex items-center gap-2 mb-4" style={{ textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>
              <ShieldAlert className="text-rose-400" /> Debt-to-Equity Ratio
            </h3>
            <div style={{ height: '350px', width: '100%', minHeight: '350px', flex: 1 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={fundamentals.history}>
                  <defs>
                    <linearGradient id="colorDebt" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.2}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="quarter" stroke="#94a3b8" tick={{ fill: '#94a3b8' }} axisLine={false} />
                  <YAxis tickFormatter={(v) => `${v.toFixed(2)}x`} stroke="#94a3b8" tick={{ fill: '#94a3b8' }} axisLine={false} />
                  <RechartsTooltip cursor={{fill: 'rgba(255,255,255,0.05)'}} contentStyle={{backgroundColor: 'rgba(15, 23, 42, 0.9)', borderColor: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)', borderRadius: '8px'}} />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} />
                  <Bar dataKey="debt_to_equity" name="Debt to Equity" fill="url(#colorDebt)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: Peer Valuation Matrix */}
      {peerValuation && peerValuation.valuation && (
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <h3 className="text-xl font-bold text-white flex items-center gap-2 mb-4">
            <Layers className="text-emerald-400" /> Sector Peer Valuation Matrix
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  <th className="p-4 text-slate-400 font-bold uppercase tracking-wider text-sm">Ticker</th>
                  <th className="p-4 text-slate-400 font-bold uppercase tracking-wider text-sm">Market Cap</th>
                  <th className="p-4 text-slate-400 font-bold uppercase tracking-wider text-sm">EV / EBITDA</th>
                  <th className="p-4 text-slate-400 font-bold uppercase tracking-wider text-sm">Forward P/E</th>
                  <th className="p-4 text-slate-400 font-bold uppercase tracking-wider text-sm">Price / Sales</th>
                  <th className="p-4 text-slate-400 font-bold uppercase tracking-wider text-sm">Price / Book</th>
                </tr>
              </thead>
              <tbody>
                {peerValuation.valuation.map((peer, i) => (
                  <tr key={i} className="transition-colors hover:bg-white/5" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', backgroundColor: peer.Ticker === currentTicker ? 'rgba(79, 172, 254, 0.1)' : 'transparent' }}>
                    <td className="p-4 font-bold text-white flex items-center gap-2">
                      {peer.Ticker === currentTicker && <span className="w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_8px_#4facfe]"></span>}
                      {peer.Ticker}
                    </td>
                    <td className="p-4 text-slate-300 font-mono">{peer['Market Cap']}</td>
                    <td className="p-4 text-slate-300 font-mono">{peer['EV/EBITDA']}</td>
                    <td className="p-4 text-slate-300 font-mono">{peer['Forward P/E']}</td>
                    <td className="p-4 text-slate-300 font-mono">{peer['Price/Sales']}</td>
                    <td className="p-4 text-slate-300 font-mono">{peer['Price/Book']}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-slate-400 text-sm mt-4 italic">Lower multiples (EV/EBITDA, P/E) relative to peers generally suggest undervaluation.</p>
        </div>
      )}

      {/* SEC & MACRO GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* SECTION 4: Macro Sector Strategist */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <h3 className="text-xl font-bold text-white flex items-center gap-2 mb-4 border-b border-white/10 pb-3">
            <PieChart className="text-orange-400" /> AI Sector Macro Strategist
          </h3>
          <div className="prose prose-invert max-w-none text-sm text-slate-300 leading-relaxed">
            {macroOutlook && renderMarkdown(macroOutlook.outlook)}
          </div>
        </div>

        {/* SECTION 5: SEC Filings Viewer */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <h3 className="text-xl font-bold text-white flex items-center gap-2 mb-4 border-b border-white/10 pb-3">
            <Briefcase className="text-indigo-400" /> Latest SEC Filings (10-K / 10-Q)
          </h3>
          <div className="space-y-4">
            {secFilings && secFilings.filings && secFilings.filings.map((filing, i) => (
              <div key={i} style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)' }} className="p-4 rounded-lg hover:border-indigo-500/50 transition-colors">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-indigo-400" />
                    <span className="font-bold text-white">{filing.form}</span>
                    <span className="text-slate-500 text-sm">{filing.date}</span>
                  </div>
                  <a href={filing.document_url} target="_blank" rel="noreferrer" style={{ background: 'linear-gradient(to right, #6366f1, #8b5cf6)' }} className="text-xs text-white px-3 py-1.5 rounded-md font-bold shadow-[0_0_10px_rgba(99,102,241,0.4)] hover:shadow-[0_0_15px_rgba(99,102,241,0.6)] transition-all">
                    Read Full
                  </a>
                </div>
                {filing.summary && (
                  <div className="mt-3 text-sm text-slate-400 border-l-2 border-indigo-500/50 pl-3">
                    <span className="text-indigo-300 font-bold mb-1 block">Extracted Risk/Op Summary:</span> 
                    {filing.summary}
                  </div>
                )}
              </div>
            ))}
            {(!secFilings || !secFilings.filings || secFilings.filings.length === 0) && (
              <p className="text-slate-400 italic">No recent SEC filings retrieved.</p>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
