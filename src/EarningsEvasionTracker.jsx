import React, { useState, useEffect } from 'react';
import { Loader2, Calendar, Percent, ArrowRight, Target, Crosshair, BarChart2, Search, Briefcase, Activity } from 'lucide-react';

const EarningsDashboard = ({ ticker }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicker, setSelectedTicker] = useState(ticker || 'NVDA');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);

  // Initial load of the 15 default stocks
  useEffect(() => {
    fetch('/earnings_data.json')
      .then(res => res.json())
      .then(d => {
        setData(d);
        if (d.length > 0 && !ticker) {
          setSelectedTicker(d[0].ticker);
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
    const symbol = searchQuery.toUpperCase();
    
    // If we already have it in the list, just select it
    if (data.find(d => d.ticker === symbol)) {
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
        setData(prev => [newStockData, ...prev]);
        setSelectedTicker(symbol);
      }
    } catch (err) {
      alert("Failed to reach the API server. Ensure backend/server.py is running.");
    }
    setSearchLoading(false);
    setSearchQuery('');
  };

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}><Loader2 className="spin" size={32} /></div>;
  }

  const selectedStock = data.find(d => d.ticker === selectedTicker) || data[0];
  
  if (!selectedStock) {
    return <div style={{ color: 'white', padding: '2rem' }}>No data found.</div>;
  }

  return (
    <div style={{ display: 'flex', gap: '2rem', height: '100%', minHeight: '80vh' }}>
      {/* LEFT RAIL: Calendar & Search */}
      <div className="glass-card" style={{ width: '300px', display: 'flex', flexDirection: 'column', padding: '1.5rem', maxHeight: '80vh' }}>
        
        {/* Search Bar */}
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <input 
            type="text" 
            placeholder="Search any ticker..." 
            value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)} 
            style={{ 
              flex: 1, 
              padding: '0.5rem 0.75rem', 
              borderRadius: '8px', 
              border: '1px solid #334155', 
              background: 'rgba(0,0,0,0.2)', 
              color: 'white' 
            }} 
          />
          <button 
            type="submit" 
            disabled={searchLoading}
            style={{ 
              padding: '0.5rem', 
              background: '#3b82f6', 
              borderRadius: '8px', 
              border: 'none', 
              color: 'white', 
              cursor: searchLoading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {searchLoading ? <Loader2 size={16} className="spin" /> : <Search size={16} />}
          </button>
        </form>

        <h3 style={{ margin: '0 0 1rem 0', color: '#4facfe', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Calendar size={18} /> Earnings Calendar
        </h3>
        <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingRight: '0.5rem' }}>
          {[...data].sort((a,b) => {
            if (a.next_earnings_date === 'Unknown') return 1;
            if (b.next_earnings_date === 'Unknown') return -1;
            return a.next_earnings_date > b.next_earnings_date ? 1 : -1;
          }).map(stock => (
            <div 
              key={stock.ticker}
              onClick={() => setSelectedTicker(stock.ticker)}
              style={{ 
                padding: '0.75rem', 
                background: selectedTicker === stock.ticker ? 'rgba(79, 172, 254, 0.2)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${selectedTicker === stock.ticker ? '#4facfe' : 'transparent'}`,
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                transition: 'all 0.2s'
              }}
            >
              <div>
                <strong style={{ display: 'block', color: 'white' }}>{stock.ticker}</strong>
                <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{stock.next_earnings_date !== 'Unknown' ? stock.next_earnings_date : 'TBD'}</span>
              </div>
              <ArrowRight size={14} color={selectedTicker === stock.ticker ? '#4facfe' : '#475569'} />
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT AREA: Dashboard */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        
        {/* TOP ROW: Options & Fundamentals */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '2rem' }}>
          
          {/* Options: Max Pain & Implied Move */}
          <div className="glass-card" style={{ padding: '1.5rem', borderTop: '3px solid #f59e0b' }}>
            <h3 style={{ margin: '0 0 1.5rem 0', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Crosshair size={18} /> Options Market Positioning
            </h3>
            {selectedStock?.options_data ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <span style={{ color: '#94a3b8', fontSize: '0.8rem', display: 'block', marginBottom: '0.5rem' }}>ATM Implied Move</span>
                    <strong style={{ color: 'white', fontSize: '1.5rem' }}>±{selectedStock.options_data.implied_move_pct}%</strong>
                    <span style={{ color: '#64748b', fontSize: '0.9rem', marginLeft: '0.5rem' }}>(${selectedStock.options_data.implied_move_usd})</span>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <span style={{ color: '#94a3b8', fontSize: '0.8rem', display: 'block', marginBottom: '0.5rem' }}>Put/Call Ratio (OI)</span>
                    <strong style={{ color: selectedStock.options_data.pcr_oi > 1 ? '#ef4444' : '#10b981', fontSize: '1.5rem' }}>
                      {selectedStock.options_data.pcr_oi}
                    </strong>
                  </div>
                </div>

                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Max Pain Strike (Exp: {selectedStock.options_data.expiration.substring(0,10)})</span>
                      <strong style={{ color: '#4facfe', fontSize: '1.2rem' }}>${selectedStock.options_data.max_pain_strike}</strong>
                    </div>
                    <div style={{ width: '100%', height: '8px', background: '#334155', borderRadius: '4px', position: 'relative', marginTop: '1.5rem', marginBottom: '1rem' }}>
                      {/* Plot Current Price vs Max Pain */}
                      <div style={{ position: 'absolute', top: '-25px', left: '50%', transform: 'translateX(-50%)', color: '#94a3b8', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>Current: ${selectedStock.current_price}</div>
                      <div style={{ position: 'absolute', left: '50%', top: '-4px', width: '2px', height: '16px', background: 'white' }}></div>
                      
                      {/* Max Pain indicator */}
                      {(() => {
                         const current = selectedStock.current_price;
                         const pain = selectedStock.options_data.max_pain_strike;
                         if (current === 0) return null;
                         const diffPct = ((pain - current) / current) * 100;
                         // map +-20% to +-50% width
                         let leftPos = 50 + (diffPct * 2.5);
                         leftPos = Math.max(0, Math.min(100, leftPos));
                         return (
                           <div style={{ position: 'absolute', left: `${leftPos}%`, top: '-4px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                             <div style={{ width: '4px', height: '16px', background: '#4facfe', borderRadius: '2px' }}></div>
                             <span style={{ color: '#4facfe', fontSize: '0.75rem', marginTop: '4px', whiteSpace: 'nowrap', transform: 'translateX(-50%)' }}>Max Pain</span>
                           </div>
                         )
                      })()}
                    </div>
                </div>
              </div>
            ) : (
              <p style={{ color: '#64748b' }}>Options chain unavailable or too illiquid.</p>
            )}
          </div>

          {/* Fundamentals: Revisions & Post-Earnings Matrix */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div className="glass-card" style={{ padding: '1.5rem', borderTop: '3px solid #10b981' }}>
              <h3 style={{ margin: '0 0 1rem 0', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Target size={18} /> EPS Revision Trend (Last 30 Days)
              </h3>
              {selectedStock?.eps_trend ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: selectedStock.eps_trend.bar_lowered ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)', padding: '1rem', borderRadius: '8px', border: `1px solid ${selectedStock.eps_trend.bar_lowered ? 'rgba(245, 158, 11, 0.3)' : 'rgba(16, 185, 129, 0.3)'}` }}>
                  <div>
                    <span style={{ color: '#94a3b8', fontSize: '0.8rem', display: 'block' }}>Analyst Consensus</span>
                    <strong style={{ color: 'white' }}>${selectedStock.eps_trend.current_est}</strong> <span style={{ color: '#64748b', fontSize: '0.8rem' }}>(was ${selectedStock.eps_trend.d30_est})</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <strong style={{ color: selectedStock.eps_trend.bar_lowered ? '#f59e0b' : '#10b981', display: 'block' }}>
                      {selectedStock.eps_trend.bar_lowered ? "Bar Lowered" : "Bar Raised"}
                    </strong>
                    <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>{selectedStock.eps_trend.bar_lowered ? "Higher beat probability" : "Expectations increasing"}</span>
                  </div>
                </div>
              ) : (
                <p style={{ color: '#64748b', margin: 0 }}>No 30-day revision data available.</p>
              )}
            </div>
            
            {/* Historical Price Action Matrix */}
            <div className="glass-card" style={{ padding: '1.5rem', borderTop: '3px solid #6366f1', flex: 1, overflowY: 'auto' }}>
              <h3 style={{ margin: '0 0 1rem 0', color: '#6366f1', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <BarChart2 size={18} /> Post-Earnings Price Action
              </h3>
              {selectedStock?.historical_action && selectedStock.historical_action.length > 0 ? (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ color: '#94a3b8', borderBottom: '1px solid #334155' }}>
                      <th style={{ padding: '0.5rem', textAlign: 'left' }}>Date</th>
                      <th style={{ padding: '0.5rem', textAlign: 'right' }}>Surprise</th>
                      <th style={{ padding: '0.5rem', textAlign: 'right' }}>Gap %</th>
                      <th style={{ padding: '0.5rem', textAlign: 'right' }}>T+0 Close</th>
                      <th style={{ padding: '0.5rem', textAlign: 'right' }}>T+5 Close</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedStock.historical_action.map((h, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '0.5rem', color: 'white' }}>{h.date}</td>
                        <td style={{ padding: '0.5rem', textAlign: 'right', color: h.eps_surprise_pct > 0 ? '#10b981' : '#ef4444' }}>{h.eps_surprise_pct}%</td>
                        <td style={{ padding: '0.5rem', textAlign: 'right', color: h.gap_pct > 0 ? '#10b981' : '#ef4444' }}>{h.gap_pct > 0 ? '+' : ''}{h.gap_pct}%</td>
                        <td style={{ padding: '0.5rem', textAlign: 'right', color: h.t0_close_pct > 0 ? '#10b981' : '#ef4444' }}>{h.t0_close_pct > 0 ? '+' : ''}{h.t0_close_pct}%</td>
                        <td style={{ padding: '0.5rem', textAlign: 'right', color: h.t5_close_pct > 0 ? '#10b981' : '#ef4444' }}>{h.t5_close_pct > 0 ? '+' : ''}{h.t5_close_pct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p style={{ color: '#64748b' }}>No historical price action found.</p>
              )}
            </div>
          </div>
        </div>

        {/* BOTTOM WIDGET: Institutional Positioning (Replaces Lie Detector) */}
        <div className="glass-card" style={{ padding: '1.5rem', borderTop: '4px solid #ec4899', flex: 1, display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ margin: '0 0 1.5rem 0', color: '#ec4899', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Briefcase size={18} /> Institutional Positioning & Short Interest
          </h3>
          
          {selectedStock?.institutional ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem', height: '100%' }}>
              
              {/* Short Interest & Fundamentals (Left side of bottom widget) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ color: '#94a3b8', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '0.5rem' }}><Activity size={12} /> Short % of Float</span>
                  <strong style={{ color: selectedStock.institutional.short_percent > 10 ? '#ef4444' : 'white', fontSize: '1.5rem' }}>{selectedStock.institutional.short_percent}%</strong>
                </div>
                
                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ color: '#94a3b8', fontSize: '0.8rem', display: 'block', marginBottom: '0.5rem' }}>Days to Cover (Short Ratio)</span>
                  <strong style={{ color: selectedStock.institutional.short_ratio > 4 ? '#f59e0b' : 'white', fontSize: '1.5rem' }}>{selectedStock.institutional.short_ratio}</strong>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: 'auto' }}>
                  <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: '8px' }}>
                     <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block' }}>Forward P/E</span>
                     <strong style={{ color: '#cbd5e1' }}>{selectedStock.institutional.forward_pe}</strong>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: '8px' }}>
                     <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block' }}>PEG Ratio</span>
                     <strong style={{ color: '#cbd5e1' }}>{selectedStock.institutional.peg_ratio}</strong>
                  </div>
                </div>
              </div>

              {/* Analyst Revisions (Right side of bottom widget) */}
              <div style={{ display: 'flex', flexDirection: 'column', background: 'rgba(0,0,0,0.1)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ padding: '1rem', borderBottom: '1px solid #334155' }}>
                  <strong style={{ color: '#e2e8f0', fontSize: '0.9rem' }}>Recent Analyst Targets (Last 30 Days)</strong>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '200px' }}>
                  {selectedStock.institutional.analyst_revisions && selectedStock.institutional.analyst_revisions.length > 0 ? (
                    selectedStock.institutional.analyst_revisions.map((rev, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: '4px' }}>
                        <div>
                          <strong style={{ display: 'block', color: 'white', fontSize: '0.85rem' }}>{rev.firm}</strong>
                          <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>{rev.date} • {rev.action} ({rev.from_grade || '-'} → {rev.to_grade || '-'})</span>
                        </div>
                        <div style={{ background: '#334155', padding: '0.25rem 0.75rem', borderRadius: '12px' }}>
                          <strong style={{ color: '#4facfe', fontSize: '0.9rem' }}>${rev.price_target}</strong>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p style={{ color: '#64748b', fontSize: '0.85rem', fontStyle: 'italic', margin: 'auto' }}>No analyst revisions in the last 30 days.</p>
                  )}
                </div>
              </div>

            </div>
          ) : (
            <p style={{ color: '#64748b' }}>Institutional data currently unavailable.</p>
          )}
        </div>

      </div>
    </div>
  );
};

export default EarningsDashboard;
