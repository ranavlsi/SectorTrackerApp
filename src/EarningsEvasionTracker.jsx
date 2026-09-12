import React, { useState, useEffect } from 'react';
import { 
  Loader2, Calendar, Target, Crosshair, BarChart2, Search, Briefcase, 
  Activity, TrendingUp, TrendingDown, Zap, ShieldAlert, Sparkles, CheckCircle, 
  AlertTriangle, ArrowUpRight, ArrowDownRight, Info, Award, Compass, Sun, Snowflake
} from 'lucide-react';

const EarningsDashboard = ({ ticker }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicker, setSelectedTicker] = useState(ticker || 'NVDA');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);

  // Initial load of default stocks
  useEffect(() => {
    fetch('/earnings_data.json?t=' + new Date().getTime())
      .then(res => res.json())
      .then(d => {
        if (Array.isArray(d) && d.length > 0) {
          setData(d);
          if (!ticker) {
            setSelectedTicker(d[0].ticker);
          }
        }
        setLoading(false);
      })
      .catch(e => {
        console.error("Failed to load earnings data", e);
        setLoading(false);
      });
  }, [ticker]);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery) return;
    const symbol = searchQuery.toUpperCase().trim();
    
    // If we already have it in the list, just select it
    const existing = data.find(d => d.ticker === symbol);
    if (existing) {
      setSelectedTicker(symbol);
      setSearchQuery('');
      return;
    }

    setSearchLoading(true);
    try {
      const res = await fetch(`/api/analyze_earnings?ticker=${symbol}`);
      const newStockData = await res.json();
      
      if (newStockData.error) {
        alert("Error analyzing stock: " + newStockData.error);
      } else {
        setData(prev => [newStockData, ...prev.filter(x => x.ticker !== symbol)]);
        setSelectedTicker(symbol);
      }
    } catch (err) {
      alert("Failed to reach API server. Ensure backend is active.");
    }
    setSearchLoading(false);
    setSearchQuery('');
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '1rem' }}>
        <Loader2 className="spin" size={36} color="#3b82f6" />
        <span style={{ color: '#94a3b8', fontSize: '0.95rem' }}>Loading Institutional AI Earnings Intelligence...</span>
      </div>
    );
  }

  const selectedStock = data.find(d => d.ticker === selectedTicker) || data[0];
  
  if (!selectedStock) {
    return <div style={{ color: 'white', padding: '2rem' }}>No earnings intelligence data found.</div>;
  }

  const ai = selectedStock.ai_intelligence || {
    pedp_score: 50,
    setup_tier: 'B',
    setup_name: 'EARNINGS CONSOLIDATION',
    badge_color: '#eab308',
    action_verdict: 'Consolidating post earnings. Wait for high-volume follow through.',
    catalysts: []
  };

  const personality = selectedStock.personality || {
    beat_rate_pct: 0,
    gap_and_go_pct: 50,
    gap_and_fade_pct: 50,
    avg_abs_move_pct: 0,
    avg_5d_drift_pct: 0,
    volatility_verdict: 'IN-LINE'
  };

  const revisions = selectedStock.consensus_revisions || {
    up_7d: 0, down_7d: 0, up_30d: 0, down_30d: 0,
    current_q_eps_est: 0, prev_30d_eps_est: 0,
    revenue_growth_est: 0, next_q_growth_est: 0
  };

  const options = selectedStock.options_data;
  const reactions = selectedStock.historical_reactions || [];
  const inst = selectedStock.institutional || {};
  const seasonality = selectedStock.seasonality;

  return (
    <div style={{ display: 'flex', gap: '1.5rem', minHeight: '85vh', color: '#e2e8f0' }}>
      
      {/* LEFT SIDEBAR: Calendar & Quick Watchlist */}
      <div className="glass-card" style={{ width: '320px', minWidth: '300px', display: 'flex', flexDirection: 'column', padding: '1.25rem', maxHeight: '88vh', background: 'rgba(15, 23, 42, 0.75)', border: '1px solid rgba(255,255,255,0.08)' }}>
        
        {/* Search Bar */}
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
          <input 
            type="text" 
            placeholder="Analyze any ticker (e.g. NVDA, PLTR)..." 
            value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)} 
            style={{ 
              flex: 1, 
              padding: '0.6rem 0.8rem', 
              borderRadius: '8px', 
              border: '1px solid #334155', 
              background: 'rgba(0,0,0,0.4)', 
              color: 'white',
              fontSize: '0.85rem'
            }} 
          />
          <button 
            type="submit" 
            disabled={searchLoading}
            style={{ 
              padding: '0.6rem 0.8rem', 
              background: '#3b82f6', 
              borderRadius: '8px', 
              border: 'none', 
              color: 'white', 
              cursor: searchLoading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: '600'
            }}
          >
            {searchLoading ? <Loader2 size={16} className="spin" /> : <Search size={16} />}
          </button>
        </form>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h4 style={{ margin: 0, color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.95rem' }}>
            <Calendar size={16} /> Market Leaders Radar
          </h4>
          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{data.length} Tracked</span>
        </div>

        {/* Watchlist Items */}
        <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem', paddingRight: '0.3rem' }}>
          {[...data].sort((a,b) => {
            const scoreA = a.ai_intelligence?.pedp_score || 50;
            const scoreB = b.ai_intelligence?.pedp_score || 50;
            return scoreB - scoreA;
          }).map(stock => {
            const isSelected = selectedTicker === stock.ticker;
            const stockScore = stock.ai_intelligence?.pedp_score ?? 50;
            const scoreColor = stockScore >= 75 ? '#10b981' : stockScore >= 60 ? '#3b82f6' : stockScore >= 45 ? '#eab308' : '#ef4444';

            return (
              <div 
                key={stock.ticker}
                onClick={() => setSelectedTicker(stock.ticker)}
                style={{ 
                  padding: '0.65rem 0.8rem', 
                  background: isSelected ? 'rgba(59, 130, 246, 0.18)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${isSelected ? '#3b82f6' : 'rgba(255,255,255,0.05)'}`,
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  transition: 'all 0.15s ease'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <strong style={{ color: 'white', fontSize: '0.9rem' }}>{stock.ticker}</strong>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>${stock.current_price}</span>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    Next: {stock.next_earnings_date !== 'Unknown' ? stock.next_earnings_date : 'TBD'}
                  </span>
                </div>
                <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                  <span style={{ 
                    fontSize: '0.75rem', 
                    fontWeight: '700', 
                    color: scoreColor, 
                    background: `${scoreColor}22`, 
                    padding: '0.15rem 0.4rem', 
                    borderRadius: '4px' 
                  }}>
                    PEDP {stockScore}
                  </span>
                  <span style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '2px' }}>
                    {stock.ai_intelligence?.setup_tier || 'B'} Tier
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* MAIN INTELLIGENCE TERMINAL */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1.25rem', overflowY: 'auto' }}>
        
        {/* HEADER BAR: Ticker, Price, PEDP Score & Verdict Banner */}
        <div className="glass-card" style={{ 
          padding: '1.25rem 1.5rem', 
          background: 'linear-gradient(135deg, rgba(15,23,42,0.85) 0%, rgba(30,41,59,0.7) 100%)', 
          borderLeft: `5px solid ${ai.badge_color || '#3b82f6'}` 
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
            
            {/* Title & Stats */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem' }}>
                <h2 style={{ margin: 0, fontSize: '1.8rem', color: 'white', fontWeight: '800' }}>{selectedStock.ticker}</h2>
                <span style={{ color: '#94a3b8', fontSize: '1.1rem' }}>${selectedStock.current_price}</span>
                <span style={{ 
                  background: `${ai.badge_color}25`, 
                  color: ai.badge_color, 
                  border: `1px solid ${ai.badge_color}55`, 
                  padding: '0.2rem 0.6rem', 
                  borderRadius: '6px', 
                  fontSize: '0.75rem', 
                  fontWeight: '700',
                  letterSpacing: '0.5px'
                }}>
                  {ai.setup_name}
                </span>
              </div>
              <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.85rem' }}>
                Next Reporting Date: <strong style={{ color: '#cbd5e1' }}>{selectedStock.next_earnings_date}</strong> ({selectedStock.earnings_timing || 'AMC'}) • Company: <span style={{ color: '#cbd5e1' }}>{selectedStock.company_name || selectedStock.ticker}</span>
              </p>
            </div>

            {/* PEDP Score Badge */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '1rem', 
              background: 'rgba(0,0,0,0.3)', 
              padding: '0.75rem 1.25rem', 
              borderRadius: '10px', 
              border: '1px solid rgba(255,255,255,0.06)' 
            }}>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block' }}>
                  Post-Earnings Drift Potential
                </span>
                <strong style={{ fontSize: '1.6rem', color: ai.badge_color, lineHeight: 1.1 }}>
                  {ai.pedp_score} <span style={{ fontSize: '0.9rem', color: '#64748b' }}>/ 100</span>
                </strong>
              </div>
              <div style={{ 
                width: '42px', 
                height: '42px', 
                borderRadius: '50%', 
                background: `${ai.badge_color}22`, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                border: `2px solid ${ai.badge_color}` 
              }}>
                <Sparkles size={20} color={ai.badge_color} />
              </div>
            </div>

          </div>

          {/* Action Verdict Banner */}
          <div style={{ 
            marginTop: '1rem', 
            padding: '0.75rem 1rem', 
            background: 'rgba(0,0,0,0.25)', 
            borderRadius: '6px', 
            border: '1px solid rgba(255,255,255,0.04)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem'
          }}>
            <Zap size={16} color={ai.badge_color} />
            <span style={{ fontSize: '0.85rem', color: '#f1f5f9' }}>
              <strong>AI Action Protocol:</strong> {ai.action_verdict}
            </span>
          </div>
        </div>

        {/* ROW 1: AI Guidance & Catalysts (Left) + Analyst Consensus Revisions (Right) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '1.25rem' }}>
          
          {/* AI Guidance & Catalyst Synthesis */}
          <div className="glass-card" style={{ padding: '1.25rem', borderTop: '3px solid #3b82f6' }}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem' }}>
              <Sparkles size={18} /> AI Catalyst & Forward Guidance Intelligence
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {ai.catalysts && ai.catalysts.length > 0 ? (
                ai.catalysts.map((cat, idx) => (
                  <div key={idx} style={{ 
                    display: 'flex', 
                    alignItems: 'flex-start', 
                    gap: '0.6rem', 
                    background: 'rgba(255,255,255,0.02)', 
                    padding: '0.6rem 0.8rem', 
                    borderRadius: '6px',
                    border: '1px solid rgba(255,255,255,0.03)' 
                  }}>
                    <div style={{ marginTop: '2px' }}><CheckCircle size={14} color="#3b82f6" /></div>
                    <span style={{ fontSize: '0.83rem', color: '#cbd5e1', lineHeight: '1.4' }}>{cat}</span>
                  </div>
                ))
              ) : (
                <p style={{ color: '#64748b', fontSize: '0.85rem' }}>Gathering live catalyst data...</p>
              )}
            </div>

            {/* Quick Fundamental Growth Strips */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginTop: '1rem' }}>
              <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.6rem', borderRadius: '6px', textAlign: 'center' }}>
                <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block' }}>Qtr EPS Growth Est</span>
                <strong style={{ color: revisions.next_q_growth_est >= 0 ? '#10b981' : '#ef4444', fontSize: '1rem' }}>
                  {revisions.next_q_growth_est > 0 ? '+' : ''}{revisions.next_q_growth_est}%
                </strong>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.6rem', borderRadius: '6px', textAlign: 'center' }}>
                <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block' }}>Qtr Rev Growth Est</span>
                <strong style={{ color: revisions.revenue_growth_est >= 0 ? '#10b981' : '#ef4444', fontSize: '1rem' }}>
                  {revisions.revenue_growth_est > 0 ? '+' : ''}{revisions.revenue_growth_est}%
                </strong>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.6rem', borderRadius: '6px', textAlign: 'center' }}>
                <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block' }}>Covering Analysts</span>
                <strong style={{ color: '#60a5fa', fontSize: '1rem' }}>
                  {revisions.total_analysts || 0}
                </strong>
              </div>
            </div>
          </div>

          {/* Wall Street Consensus Revisions Meter */}
          <div className="glass-card" style={{ padding: '1.25rem', borderTop: '3px solid #10b981' }}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#34d399', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem' }}>
              <Target size={18} /> Consensus Estimate Revision Momentum
            </h3>

            {/* Revision Counters */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', padding: '0.75rem', borderRadius: '8px' }}>
                <span style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block' }}>Up Revisions (30D)</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '2px' }}>
                  <ArrowUpRight size={18} color="#10b981" />
                  <strong style={{ color: '#10b981', fontSize: '1.3rem' }}>{revisions.up_30d}</strong>
                  <span style={{ fontSize: '0.7rem', color: '#64748b' }}>({revisions.up_7d} in 7d)</span>
                </div>
              </div>

              <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', padding: '0.75rem', borderRadius: '8px' }}>
                <span style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block' }}>Down Revisions (30D)</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '2px' }}>
                  <ArrowDownRight size={18} color="#ef4444" />
                  <strong style={{ color: '#ef4444', fontSize: '1.3rem' }}>{revisions.down_30d}</strong>
                  <span style={{ fontSize: '0.7rem', color: '#64748b' }}>({revisions.down_7d} in 7d)</span>
                </div>
              </div>
            </div>

            {/* 30-Day Consensus Estimate Comparison */}
            <div style={{ background: 'rgba(0,0,0,0.25)', padding: '0.8rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Current Qtr EPS Consensus</span>
                <strong style={{ color: 'white', fontSize: '0.95rem' }}>${revisions.current_q_eps_est ?? '-'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>30 Days Ago Consensus</span>
                <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>${revisions.prev_30d_eps_est ?? '-'}</span>
              </div>
              <div style={{ marginTop: '0.6rem', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Revision Trend</span>
                <span style={{ 
                  fontSize: '0.75rem', 
                  fontWeight: '700',
                  color: revisions.eps_revision_pct_30d > 0 ? '#10b981' : revisions.eps_revision_pct_30d < 0 ? '#ef4444' : '#94a3b8' 
                }}>
                  {revisions.eps_revision_pct_30d > 0 ? `+${revisions.eps_revision_pct_30d}% (Bar Raised)` : revisions.eps_revision_pct_30d < 0 ? `${revisions.eps_revision_pct_30d}% (Bar Lowered)` : 'Flat Consensus'}
                </span>
              </div>
            </div>

          </div>

        </div>

        {/* ROW 2: Options Volatility & Mispricing Radar + Personality & Institutional Positioning */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
          
          {/* Options Market Positioning & Implied Move */}
          <div className="glass-card" style={{ padding: '1.25rem', borderTop: '3px solid #f59e0b' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem' }}>
                <Crosshair size={18} /> Options Implied Volatility & Mispricing Radar
              </h3>
              {personality.volatility_verdict && (
                <span style={{ 
                  fontSize: '0.7rem', 
                  padding: '0.15rem 0.5rem', 
                  borderRadius: '4px', 
                  fontWeight: '700',
                  background: personality.volatility_verdict === 'OVERPRICED_IV' ? 'rgba(239, 68, 68, 0.15)' : personality.volatility_verdict === 'UNDERPRICED_IV' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255,255,255,0.05)',
                  color: personality.volatility_verdict === 'OVERPRICED_IV' ? '#ef4444' : personality.volatility_verdict === 'UNDERPRICED_IV' ? '#10b981' : '#94a3b8'
                }}>
                  {personality.volatility_verdict.replace('_', ' ')}
                </span>
              )}
            </div>

            {options ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                  <div style={{ background: 'rgba(0,0,0,0.25)', padding: '0.75rem', borderRadius: '8px' }}>
                    <span style={{ color: '#94a3b8', fontSize: '0.72rem', display: 'block' }}>ATM Implied Move</span>
                    <strong style={{ color: 'white', fontSize: '1.25rem' }}>±{options.implied_move_pct}%</strong>
                    <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block' }}>(${options.implied_move_usd})</span>
                  </div>

                  <div style={{ background: 'rgba(0,0,0,0.25)', padding: '0.75rem', borderRadius: '8px' }}>
                    <span style={{ color: '#94a3b8', fontSize: '0.72rem', display: 'block' }}>Historical Avg Move</span>
                    <strong style={{ color: '#60a5fa', fontSize: '1.25rem' }}>±{personality.avg_abs_move_pct}%</strong>
                    <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block' }}>Realized absolute</span>
                  </div>

                  <div style={{ background: 'rgba(0,0,0,0.25)', padding: '0.75rem', borderRadius: '8px' }}>
                    <span style={{ color: '#94a3b8', fontSize: '0.72rem', display: 'block' }}>Put/Call OI Ratio</span>
                    <strong style={{ color: options.pcr_oi > 1 ? '#ef4444' : '#10b981', fontSize: '1.25rem' }}>
                      {options.pcr_oi}
                    </strong>
                    <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block' }}>
                      {options.pcr_oi > 1 ? 'Bearish Hedging' : 'Bullish Call Skew'}
                    </span>
                  </div>
                </div>

                {/* Max Pain Visual Bar */}
                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.85rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                    <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
                      Options Max Pain Strike (Exp: {options.expiration})
                    </span>
                    <strong style={{ color: '#fbbf24', fontSize: '1rem' }}>${options.max_pain_strike}</strong>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: '#334155', borderRadius: '4px', position: 'relative', marginTop: '1.25rem', marginBottom: '0.75rem' }}>
                    <div style={{ position: 'absolute', top: '-22px', left: '50%', transform: 'translateX(-50%)', color: '#cbd5e1', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>
                      Spot: ${selectedStock.current_price}
                    </div>
                    <div style={{ position: 'absolute', left: '50%', top: '-4px', width: '2px', height: '16px', background: 'white' }}></div>

                    {/* Max Pain Pin */}
                    {(() => {
                      const cur = selectedStock.current_price;
                      const pain = options.max_pain_strike;
                      if (!cur) return null;
                      const diffPct = ((pain - cur) / cur) * 100;
                      let leftPos = 50 + (diffPct * 2.5);
                      leftPos = Math.max(0, Math.min(100, leftPos));
                      return (
                        <div style={{ position: 'absolute', left: `${leftPos}%`, top: '-4px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <div style={{ width: '4px', height: '16px', background: '#fbbf24', borderRadius: '2px' }}></div>
                          <span style={{ color: '#fbbf24', fontSize: '0.7rem', marginTop: '4px', whiteSpace: 'nowrap', transform: 'translateX(-50%)' }}>
                            Max Pain (${pain})
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            ) : (
              <p style={{ color: '#64748b' }}>Options chain not active for this ticker.</p>
            )}
          </div>

          {/* Historical Personality & Institutional Float */}
          <div className="glass-card" style={{ padding: '1.25rem', borderTop: '3px solid #8b5cf6' }}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#a78bfa', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem' }}>
              <Activity size={18} /> Historical Reaction Personality & Short Float
            </h3>

            {/* Personality Win-rates */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ background: 'rgba(0,0,0,0.25)', padding: '0.75rem', borderRadius: '8px', textAlign: 'center' }}>
                <span style={{ color: '#94a3b8', fontSize: '0.72rem', display: 'block' }}>Beat Rate</span>
                <strong style={{ color: '#10b981', fontSize: '1.25rem' }}>{personality.beat_rate_pct}%</strong>
                <span style={{ color: '#64748b', fontSize: '0.72rem', display: 'block' }}>Past 8 quarters</span>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.25)', padding: '0.75rem', borderRadius: '8px', textAlign: 'center' }}>
                <span style={{ color: '#94a3b8', fontSize: '0.72rem', display: 'block' }}>Gap & Go Rate</span>
                <strong style={{ color: personality.gap_and_go_pct >= 50 ? '#10b981' : '#f59e0b', fontSize: '1.25rem' }}>
                  {personality.gap_and_go_pct}%
                </strong>
                <span style={{ color: '#64748b', fontSize: '0.72rem', display: 'block' }}>Follows through</span>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.25)', padding: '0.75rem', borderRadius: '8px', textAlign: 'center' }}>
                <span style={{ color: '#94a3b8', fontSize: '0.72rem', display: 'block' }}>Gap & Fade Rate</span>
                <strong style={{ color: personality.gap_and_fade_pct > 50 ? '#ef4444' : '#94a3b8', fontSize: '1.25rem' }}>
                  {personality.gap_and_fade_pct}%
                </strong>
                <span style={{ color: '#64748b', fontSize: '0.72rem', display: 'block' }}>Fades into close</span>
              </div>
            </div>

            {/* Short Interest & Multiples */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.6rem' }}>
              <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.6rem', borderRadius: '6px' }}>
                <span style={{ fontSize: '0.68rem', color: '#64748b', display: 'block' }}>Short % Float</span>
                <strong style={{ color: inst.short_percent > 8 ? '#ef4444' : 'white', fontSize: '0.95rem' }}>
                  {inst.short_percent ?? 0}%
                </strong>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.6rem', borderRadius: '6px' }}>
                <span style={{ fontSize: '0.68rem', color: '#64748b', display: 'block' }}>Days to Cover</span>
                <strong style={{ color: inst.short_ratio > 3 ? '#f59e0b' : 'white', fontSize: '0.95rem' }}>
                  {inst.short_ratio ?? 0}
                </strong>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.6rem', borderRadius: '6px' }}>
                <span style={{ fontSize: '0.68rem', color: '#64748b', display: 'block' }}>Forward P/E</span>
                <strong style={{ color: '#cbd5e1', fontSize: '0.95rem' }}>
                  {inst.forward_pe ?? '-'}
                </strong>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.6rem', borderRadius: '6px' }}>
                <span style={{ fontSize: '0.68rem', color: '#64748b', display: 'block' }}>PEG Ratio</span>
                <strong style={{ color: '#cbd5e1', fontSize: '0.95rem' }}>
                  {inst.peg_ratio ?? '-'}
                </strong>
              </div>
            </div>

          </div>

        </div>

        {/* ROW 3: Historical Post-Earnings Price Action Matrix (Last 8 Quarters) */}
        <div className="glass-card" style={{ padding: '1.25rem', borderTop: '3px solid #ec4899' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, color: '#f472b6', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem' }}>
              <BarChart2 size={18} /> Post-Earnings Price Action & Drift Matrix (Last 8 Quarters)
            </h3>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Real Day-0 to Day-20 Institutional Drift</span>
          </div>

          {reactions && reactions.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ color: '#94a3b8', borderBottom: '1px solid #334155', textAlign: 'right' }}>
                    <th style={{ padding: '0.6rem 0.5rem', textAlign: 'left' }}>Quarter Date</th>
                    <th style={{ padding: '0.6rem 0.5rem' }}>EPS (Act / Est)</th>
                    <th style={{ padding: '0.6rem 0.5rem' }}>Surprise</th>
                    <th style={{ padding: '0.6rem 0.5rem' }}>Gap %</th>
                    <th style={{ padding: '0.6rem 0.5rem' }}>Day Gain (T+0)</th>
                    <th style={{ padding: '0.6rem 0.5rem' }}>5D Drift</th>
                    <th style={{ padding: '0.6rem 0.5rem' }}>20D Drift</th>
                    <th style={{ padding: '0.6rem 0.5rem' }}>Vol Surge</th>
                    <th style={{ padding: '0.6rem 0.5rem', textAlign: 'center' }}>Pattern Personality</th>
                  </tr>
                </thead>
                <tbody>
                  {reactions.map((h, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.15s' }}>
                      <td style={{ padding: '0.6rem 0.5rem', textAlign: 'left', color: 'white', fontWeight: '500' }}>
                        {h.date} <span style={{ fontSize: '0.7rem', color: '#64748b' }}>({h.timing})</span>
                      </td>
                      <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right', color: '#cbd5e1' }}>
                        ${h.eps_act ?? '-'} / <span style={{ color: '#64748b' }}>${h.eps_est ?? '-'}</span>
                      </td>
                      <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right', fontWeight: '700', color: h.surprise_pct > 0 ? '#10b981' : h.surprise_pct < 0 ? '#ef4444' : '#94a3b8' }}>
                        {h.surprise_pct > 0 ? `+${h.surprise_pct}%` : `${h.surprise_pct}%`}
                      </td>
                      <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right', color: h.gap_pct > 0 ? '#10b981' : h.gap_pct < 0 ? '#ef4444' : '#94a3b8' }}>
                        {h.gap_pct > 0 ? `+${h.gap_pct}%` : `${h.gap_pct}%`}
                      </td>
                      <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right', fontWeight: '600', color: h.day_gain_pct > 0 ? '#10b981' : h.day_gain_pct < 0 ? '#ef4444' : '#94a3b8' }}>
                        {h.day_gain_pct > 0 ? `+${h.day_gain_pct}%` : `${h.day_gain_pct}%`}
                      </td>
                      <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right', color: h.drift_5d_pct > 0 ? '#10b981' : h.drift_5d_pct < 0 ? '#ef4444' : '#94a3b8' }}>
                        {h.drift_5d_pct > 0 ? `+${h.drift_5d_pct}%` : `${h.drift_5d_pct}%`}
                      </td>
                      <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right', color: h.drift_20d_pct > 0 ? '#10b981' : h.drift_20d_pct < 0 ? '#ef4444' : '#94a3b8' }}>
                        {h.drift_20d_pct > 0 ? `+${h.drift_20d_pct}%` : `${h.drift_20d_pct}%`}
                      </td>
                      <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right', color: h.vol_surge >= 2.0 ? '#fbbf24' : '#cbd5e1' }}>
                        {h.vol_surge}x
                      </td>
                      <td style={{ padding: '0.6rem 0.5rem', textAlign: 'center' }}>
                        <span style={{ 
                          fontSize: '0.7rem', 
                          fontWeight: '600',
                          padding: '0.15rem 0.45rem', 
                          borderRadius: '4px',
                          background: h.reaction_type === 'GAP_AND_GO' ? 'rgba(16, 185, 129, 0.15)' : h.reaction_type === 'GAP_AND_FADE' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255,255,255,0.05)',
                          color: h.reaction_type === 'GAP_AND_GO' ? '#10b981' : h.reaction_type === 'GAP_AND_FADE' ? '#ef4444' : '#94a3b8'
                        }}>
                          {h.reaction_type.replace(/_/g, ' ')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p style={{ color: '#64748b' }}>No historical earnings reactions tracked.</p>
          )}
        </div>

        {/* ROW 4: 10-Year Cyclical Seasonality Terminal */}
        {seasonality && (
          <div className="glass-card" style={{ padding: '1.25rem', borderTop: '3px solid #06b6d4' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <h3 style={{ margin: 0, color: '#22d3ee', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem' }}>
                  <Compass size={18} /> 10-Year Cyclical Seasonality Intelligence
                </h3>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  Based on {seasonality.years_analyzed} years of monthly & quarterly price action cycles
                </span>
              </div>

              {/* Quick Seasonality Callouts */}
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                {seasonality.current_month && (
                  <div style={{ 
                    padding: '0.35rem 0.75rem', 
                    background: seasonality.current_month.avg_return >= 0 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)', 
                    border: `1px solid ${seasonality.current_month.avg_return >= 0 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                    borderRadius: '6px',
                    fontSize: '0.78rem'
                  }}>
                    <span style={{ color: '#94a3b8' }}>Current ({seasonality.current_month.name}): </span>
                    <strong style={{ color: seasonality.current_month.avg_return >= 0 ? '#10b981' : '#ef4444' }}>
                      {seasonality.current_month.avg_return > 0 ? '+' : ''}{seasonality.current_month.avg_return}% avg ({seasonality.current_month.win_rate}% win)
                    </strong>
                  </div>
                )}

                {seasonality.next_month && (
                  <div style={{ 
                    padding: '0.35rem 0.75rem', 
                    background: seasonality.next_month.avg_return >= 0 ? 'rgba(59, 130, 246, 0.12)' : 'rgba(245, 158, 11, 0.12)', 
                    border: `1px solid ${seasonality.next_month.avg_return >= 0 ? 'rgba(59, 130, 246, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
                    borderRadius: '6px',
                    fontSize: '0.78rem'
                  }}>
                    <span style={{ color: '#94a3b8' }}>Next ({seasonality.next_month.name}): </span>
                    <strong style={{ color: seasonality.next_month.avg_return >= 0 ? '#60a5fa' : '#fbbf24' }}>
                      {seasonality.next_month.avg_return > 0 ? '+' : ''}{seasonality.next_month.avg_return}% avg ({seasonality.next_month.win_rate}% win)
                    </strong>
                  </div>
                )}
              </div>
            </div>

            {/* 12-Month Heatmap Bar Grid */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(12, 1fr)', 
              gap: '0.5rem', 
              marginBottom: '1.25rem' 
            }}>
              {seasonality.monthly_stats?.map((m) => {
                const isCurrent = seasonality.current_month?.month === m.month;
                const isPositive = m.avg_return >= 0;
                const winRateColor = m.win_rate >= 70 ? '#10b981' : m.win_rate <= 45 ? '#ef4444' : '#94a3b8';
                
                return (
                  <div 
                    key={m.month}
                    style={{ 
                      background: isCurrent ? 'rgba(6, 182, 212, 0.15)' : 'rgba(0,0,0,0.25)', 
                      border: `1px solid ${isCurrent ? '#06b6d4' : 'rgba(255,255,255,0.04)'}`,
                      borderRadius: '8px',
                      padding: '0.6rem 0.3rem',
                      textAlign: 'center',
                      position: 'relative',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      minHeight: '85px'
                    }}
                  >
                    {isCurrent && (
                      <div style={{ 
                        position: 'absolute', 
                        top: '-8px', 
                        left: '50%', 
                        transform: 'translateX(-50%)', 
                        background: '#06b6d4', 
                        color: 'black', 
                        fontSize: '0.6rem', 
                        fontWeight: '800', 
                        padding: '1px 5px', 
                        borderRadius: '3px' 
                      }}>
                        NOW
                      </div>
                    )}
                    <div>
                      <strong style={{ fontSize: '0.85rem', color: isCurrent ? '#22d3ee' : 'white', display: 'block' }}>
                        {m.name}
                      </strong>
                      <span style={{ fontSize: '0.7rem', color: winRateColor, fontWeight: '700', display: 'block', marginTop: '2px' }}>
                        {m.win_rate}% win
                      </span>
                    </div>

                    <div style={{ 
                      marginTop: '6px', 
                      padding: '0.2rem 0',
                      background: isPositive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                      borderRadius: '4px' 
                    }}>
                      <strong style={{ 
                        fontSize: '0.78rem', 
                        color: isPositive ? '#10b981' : '#ef4444' 
                      }}>
                        {isPositive ? `+${m.avg_return}%` : `${m.avg_return}%`}
                      </strong>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Quarterly Breakdown & Extremes */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '1rem' }}>
              
              {/* Quarterly Seasonality Bars */}
              <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.85rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)' }}>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '0.6rem' }}>
                  Quarterly Drift Performance (10-Yr Cumulative Cycles)
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.6rem' }}>
                  {seasonality.quarterly_stats?.map(q => (
                    <div key={q.quarter} style={{ background: 'rgba(255,255,255,0.02)', padding: '0.5rem', borderRadius: '6px', textAlign: 'center' }}>
                      <strong style={{ color: '#cbd5e1', fontSize: '0.8rem', display: 'block' }}>{q.quarter}</strong>
                      <span style={{ color: q.win_rate >= 70 ? '#10b981' : '#94a3b8', fontSize: '0.72rem', display: 'block' }}>
                        {q.win_rate}% win
                      </span>
                      <span style={{ color: q.avg_return >= 0 ? '#10b981' : '#ef4444', fontSize: '0.8rem', fontWeight: '700', display: 'block', marginTop: '2px' }}>
                        {q.avg_return > 0 ? `+${q.avg_return}%` : `${q.avg_return}%`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Best Historical Month */}
              <div style={{ background: 'rgba(16, 185, 129, 0.08)', padding: '0.85rem', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#10b981', marginBottom: '0.3rem' }}>
                  <Sun size={15} />
                  <span style={{ fontSize: '0.72rem', fontWeight: '600', textTransform: 'uppercase' }}>Best Month (Historical)</span>
                </div>
                {seasonality.best_month ? (
                  <div>
                    <strong style={{ fontSize: '1.2rem', color: 'white' }}>{seasonality.best_month.name}</strong>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '0.75rem' }}>
                      <span style={{ color: '#94a3b8' }}>Win Rate: <strong style={{ color: '#10b981' }}>{seasonality.best_month.win_rate}%</strong></span>
                      <span style={{ color: '#10b981', fontWeight: '700' }}>+{seasonality.best_month.avg_return}% avg</span>
                    </div>
                  </div>
                ) : '-'}
              </div>

              {/* Worst Historical Month */}
              <div style={{ background: 'rgba(239, 68, 68, 0.08)', padding: '0.85rem', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#ef4444', marginBottom: '0.3rem' }}>
                  <Snowflake size={15} />
                  <span style={{ fontSize: '0.72rem', fontWeight: '600', textTransform: 'uppercase' }}>Toughest Month</span>
                </div>
                {seasonality.worst_month ? (
                  <div>
                    <strong style={{ fontSize: '1.2rem', color: 'white' }}>{seasonality.worst_month.name}</strong>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '0.75rem' }}>
                      <span style={{ color: '#94a3b8' }}>Win Rate: <strong style={{ color: '#ef4444' }}>{seasonality.worst_month.win_rate}%</strong></span>
                      <span style={{ color: '#ef4444', fontWeight: '700' }}>{seasonality.worst_month.avg_return}% avg</span>
                    </div>
                  </div>
                ) : '-'}
              </div>

            </div>

          </div>
        )}

      </div>
    </div>
  );
};

export default EarningsDashboard;

