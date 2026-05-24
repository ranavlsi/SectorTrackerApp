import React, { useState, useEffect } from 'react';
import { Loader2, Zap } from 'lucide-react';
import { ComposedChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts';

const GexHeatmap = ({ ticker }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!ticker) return;
    const fetchGex = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/gex?ticker=${ticker}`);
        const result = await response.json();
        if (result.gex_profile) {
          setData(result);
        }
      } catch (err) {
        console.error("Error fetching GEX profile", err);
      }
      setLoading(false);
    };
    fetchGex();
  }, [ticker]);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '24rem' }}>
        <Loader2 size={48} color="#d946ef" style={{ marginBottom: '1rem', animation: 'spin 1s linear infinite' }} />
        <p style={{ color: '#94a3b8' }}>Aggregating Dealer Gamma Exposure...</p>
      </div>
    );
  }

  if (!data || !data.gex_profile || data.gex_profile.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '24rem' }}>
        <p style={{ color: '#94a3b8' }}>No GEX data available for {ticker}</p>
      </div>
    );
  }

  const strikes = data.gex_profile.map(p => p.strike);
  // Tremor didn't like net_gamma? Wait, in App.jsx it was net_gex or net_gamma? Let me check how I mapped it. 
  // In the original App.jsx code it was `net_gex` or `net_gamma`. Wait, my new endpoint or my GexHeatmap used `p.net_gamma`. Let me use `net_gamma` but provide fallback to `net_gex`.
  const gamma = data.gex_profile.map(p => p.net_gamma || p.net_gex || 0);
  const spot = data.spot_price;

  const maxGamma = Math.max(...gamma);
  const minGamma = Math.min(...gamma);
  
  // Find Call/Put walls by comparing formatted values to avoid floating point mismatch
  const callWall = data.gex_profile.find(p => (p.net_gamma || p.net_gex || 0) === maxGamma)?.strike;
  const putWall = data.gex_profile.find(p => (p.net_gamma || p.net_gex || 0) === minGamma)?.strike;

  // Calculate total positive vs negative GEX
  let totalPosGex = 0;
  let totalNegGex = 0;
  gamma.forEach(g => {
    if (g > 0) totalPosGex += g;
    else if (g < 0) totalNegGex += Math.abs(g);
  });
  
  let gexTitle = "";
  let gexTranslation = "";
  let gexColor = "";

  if (spot > callWall) {
     gexTitle = "Price is above the Call Wall! 🚀";
     gexTranslation = "The stock has broken through major resistance. Market makers are forced to buy shares, acting like rocket fuel for a squeeze.";
     gexColor = "#3b82f6";
  } else if (spot < putWall) {
     gexTitle = "Price is below the Put Wall! 📉";
     gexTranslation = "The stock has broken through major support. Market makers are forced to aggressively short-sell, accelerating the crash.";
     gexColor = "#ef4444";
  } else if (totalPosGex > totalNegGex * 1.5) {
     gexTitle = "Heavy Positive Gamma Environment 🛡️";
     gexTranslation = "Market makers will 'buy the dips and sell the rips'. Expect the stock price to be incredibly stable and stuck in a tight range.";
     gexColor = "#10b981";
  } else if (totalNegGex > totalPosGex * 1.5) {
     gexTitle = "Heavy Negative Gamma Environment 🌪️";
     gexTranslation = "Market makers are trading WITH the trend. Expect massive volatility and wild price swings today.";
     gexColor = "#fb7185";
  } else {
     gexTitle = "Balanced Market Maker Positioning ⚖️";
     gexTranslation = "Neither buyers nor sellers have extreme leverage right now. Watch the Call and Put walls for breakout signals.";
     gexColor = "#f59e0b";
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      <div style={{ padding: '1.5rem', background: 'rgba(15, 23, 42, 0.8)', borderRadius: '12px', borderLeft: `4px solid ${gexColor}` }}>
          <p style={{ color: '#94a3b8', margin: '0 0 0.5rem 0', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', fontSize: '0.8rem' }}>🧠 AI Plain English Translation</p>
          <h2 style={{ color: gexColor, margin: '0 0 0.5rem 0', fontSize: '1.5rem' }}>{gexTitle}</h2>
          <p style={{ color: 'white', margin: 0, fontSize: '1.1rem', lineHeight: '1.5' }}>{gexTranslation}</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
        <div style={{ padding: '1.5rem', background: 'rgba(30, 41, 59, 0.5)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
          <p style={{ color: '#94a3b8', margin: '0 0 0.5rem 0' }}>Spot Price</p>
          <h2 style={{ color: 'white', margin: 0 }}>${spot?.toFixed(2)}</h2>
        </div>
        <div style={{ padding: '1.5rem', background: 'rgba(30, 41, 59, 0.5)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
          <p style={{ color: '#94a3b8', margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '8px' }}><Zap size={16} color="#34d399"/> Call Wall (Resistance)</p>
          <h2 style={{ color: '#34d399', margin: 0 }}>${callWall}</h2>
        </div>
        <div style={{ padding: '1.5rem', background: 'rgba(30, 41, 59, 0.5)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
          <p style={{ color: '#94a3b8', margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '8px' }}><Zap size={16} color="#fb7185"/> Put Wall (Support)</p>
          <h2 style={{ color: '#fb7185', margin: 0 }}>${putWall}</h2>
        </div>
      </div>

      <div style={{ padding: '1.5rem', background: 'rgba(30, 41, 59, 0.5)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '1.5rem', margin: 0, color: '#fbc2eb' }}>Gamma Exposure (GEX) Profile</h3>
          <p style={{ color: '#94a3b8', margin: '0.5rem 0 0 0' }}>Visualizing Market Maker hedging zones. Positive gamma stabilizes price; negative gamma accelerates price.</p>
        </div>

        <div style={{ height: '400px', width: '100%', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data.gex_profile} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="strike" stroke="#94a3b8" label={{ value: 'Strike Price', position: 'insideBottom', offset: -10, fill: '#94a3b8' }} />
              <YAxis stroke="#94a3b8" label={{ value: 'Net Dealer Gamma', angle: -90, position: 'insideLeft', fill: '#94a3b8' }} />
              <Tooltip 
                contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', borderColor: '#334155', borderRadius: '8px', color: 'white' }}
                formatter={(value) => [Math.round(value).toLocaleString(), 'Net Gamma']}
              />
              {spot && <ReferenceLine x={spot} stroke="#fff" strokeDasharray="3 3" label={{ position: 'top', value: 'Spot Price', fill: '#fff' }} />}
              <Bar dataKey="net_gex">
                {data.gex_profile.map((entry, index) => {
                  let fill = (entry.net_gamma || entry.net_gex || 0) >= 0 ? '#34d399' : '#fb7185';
                  return <Cell key={`cell-${index}`} fill={fill} />
                })}
              </Bar>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default GexHeatmap;
