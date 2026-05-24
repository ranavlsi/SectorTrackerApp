import React, { useState, useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';

const VolatilitySurface3D = ({ ticker }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedExpiry, setSelectedExpiry] = useState('All');
  const plotRef = useRef(null);

  useEffect(() => {
    if (!ticker) return;
    const fetchSurface = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/volatility_surface?ticker=${ticker}`);
        const result = await response.json();
        if (result.surface) {
          setData(result);
        }
      } catch (err) {
        console.error("Error fetching volatility surface", err);
      }
      setLoading(false);
    };
    fetchSurface();
  }, [ticker]);

  useEffect(() => {
    if (data && data.surface && data.surface.length > 0 && plotRef.current && window.Plotly) {
      if (selectedExpiry === 'All') {
        // RENDER 3D SURFACE
        const expirations = [...new Set(data.surface.map(item => item.expiry))].sort();
        const strikes = [...new Set(data.surface.map(item => item.strike))].sort((a,b)=>a-b);
        
        let zData = expirations.map(expiry => {
          return strikes.map(strike => {
            const point = data.surface.find(p => p.expiry === expiry && p.strike === strike);
            return point ? point.iv : null;
          });
        });

        // Interpolate missing IVs (nulls) to prevent Plotly from failing to draw polygons on sparse chains
        for (let j = 0; j < strikes.length; j++) {
          let lastValid = null;
          // Forward pass
          for (let i = 0; i < expirations.length; i++) {
            if (zData[i][j] !== null) lastValid = zData[i][j];
            else if (lastValid !== null) zData[i][j] = lastValid;
          }
          // Backward pass
          lastValid = null;
          for (let i = expirations.length - 1; i >= 0; i--) {
            if (zData[i][j] !== null) lastValid = zData[i][j];
            else if (lastValid !== null) zData[i][j] = lastValid;
          }
        }

        const plotData = [{
          z: zData,
          x: strikes,
          y: expirations,
          type: 'surface',
          colorscale: 'Viridis',
          showscale: true,
          colorbar: { title: 'Implied Volatility', tickfont: { color: 'white' }, titlefont: { color: 'white' } }
        }];

        const layout = {
          width: 800,
          height: 600,
          margin: { l: 0, r: 0, b: 0, t: 0 },
          paper_bgcolor: 'transparent',
          plot_bgcolor: 'transparent',
          scene: {
            xaxis: { title: 'Strike Price', gridcolor: '#333', color: 'white' },
            yaxis: { title: 'Expiration Date', gridcolor: '#333', color: 'white' },
            zaxis: { title: 'Implied Volatility (IV)', gridcolor: '#333', color: 'white' },
            camera: { eye: { x: 1.5, y: 1.5, z: 0.5 } }
          }
        };

        window.Plotly.newPlot(plotRef.current, plotData, layout, { responsive: true, displayModeBar: false });
      } else {
        // RENDER 2D VOLATILITY SKEW
        const filteredData = data.surface.filter(p => p.expiry === selectedExpiry).sort((a,b) => a.strike - b.strike);
        const strikes = filteredData.map(p => p.strike);
        const ivs = filteredData.map(p => p.iv);

        const plotData = [{
           x: strikes,
           y: ivs,
           type: 'scatter',
           mode: 'lines+markers',
           line: { color: '#60a5fa', width: 3, shape: 'spline' },
           marker: { size: 8, color: '#fbc2eb' },
           fill: 'tozeroy',
           fillcolor: 'rgba(96, 165, 250, 0.1)'
        }];

        const spot = data.spot;
        const layout = {
          width: 800,
          height: 600,
          margin: { l: 60, r: 40, b: 60, t: 40 },
          paper_bgcolor: 'transparent',
          plot_bgcolor: 'transparent',
          title: { text: `Volatility Skew for ${selectedExpiry}`, font: { color: 'white' } },
          xaxis: { title: 'Strike Price', gridcolor: '#334155', color: 'white' },
          yaxis: { title: 'Implied Volatility (IV)', gridcolor: '#334155', color: 'white', tickformat: '.1%' },
          shapes: spot ? [{ type: 'line', x0: spot, x1: spot, y0: 0, y1: Math.max(...ivs), line: { color: 'white', width: 2, dash: 'dash' } }] : [],
          annotations: spot ? [{ x: spot, y: Math.max(...ivs), text: 'Spot Price', showarrow: true, arrowcolor: 'white', font: { color: 'white' } }] : []
        };

        window.Plotly.newPlot(plotRef.current, plotData, layout, { responsive: true, displayModeBar: false });
      }
    }
  }, [data, selectedExpiry]);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '24rem' }}>
        <Loader2 size={48} color="#3b82f6" style={{ marginBottom: '1rem', animation: 'spin 1s linear infinite' }} />
        <p style={{ color: '#94a3b8' }}>Calibrating Stochastic IV Grid...</p>
      </div>
    );
  }

  if (!data || !data.surface || data.surface.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '24rem' }}>
        <p style={{ color: '#94a3b8' }}>No volatility data available for {ticker}</p>
      </div>
    );
  }

  const availableExpirations = [...new Set(data.surface.map(item => item.expiry))].sort();

  const spot = data.spot;
  let totalCallIV = 0, callCount = 0;
  let totalPutIV = 0, putCount = 0;

  data.surface.forEach(p => {
    if (selectedExpiry !== 'All' && p.expiry !== selectedExpiry) return;
    if (p.strike > spot) { totalCallIV += p.iv; callCount++; }
    else if (p.strike < spot) { totalPutIV += p.iv; putCount++; }
  });

  const avgCallIV = callCount ? totalCallIV / callCount : 0;
  const avgPutIV = putCount ? totalPutIV / putCount : 0;
  const skewDiff = avgCallIV - avgPutIV;

  let skewTitle = "";
  let skewTranslation = "";
  let skewColor = "";

  if (skewDiff > 0.05) {
      skewTitle = "Calls are way more expensive than Puts! 🚀";
      skewTranslation = "The market is greedy. People are frantically buying 'lottery tickets' expecting the stock to shoot up.";
      skewColor = "#10b981";
  } else if (skewDiff < -0.05) {
      skewTitle = "Puts are way more expensive than Calls! 📉";
      skewTranslation = "The market is scared. People are paying high premiums for 'crash insurance' expecting the stock to drop.";
      skewColor = "#ef4444";
  } else {
      skewTitle = "Calls and Puts cost about the same. ⚖️";
      skewTranslation = "The market is calm. Traders don't expect any massive moves in either direction right now.";
      skewColor = "#f59e0b";
  }

  return (
    <div style={{ padding: '1.5rem', background: 'rgba(30, 41, 59, 0.5)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h3 style={{ fontSize: '1.5rem', margin: 0, color: '#60a5fa' }}>3D Implied Volatility Surface</h3>
          <p style={{ color: '#94a3b8', margin: '0.5rem 0 0 0' }}>Interactive WebGL visualization of {ticker} options pricing anomalies.</p>
        </div>
        <select 
          value={selectedExpiry} 
          onChange={(e) => setSelectedExpiry(e.target.value)}
          style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid #334155', background: 'rgba(0,0,0,0.5)', color: 'white', cursor: 'pointer' }}
        >
          <option value="All">All Expirations</option>
          {availableExpirations.map(exp => (
            <option key={exp} value={exp}>{exp}</option>
          ))}
        </select>
      </div>

      <div style={{ padding: '1.5rem', background: 'rgba(15, 23, 42, 0.8)', borderRadius: '12px', borderLeft: `4px solid ${skewColor}`, marginBottom: '2rem' }}>
          <p style={{ color: '#94a3b8', margin: '0 0 0.5rem 0', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', fontSize: '0.8rem' }}>🧠 AI Plain English Translation</p>
          <h2 style={{ color: skewColor, margin: '0 0 0.5rem 0', fontSize: '1.5rem' }}>{skewTitle}</h2>
          <p style={{ color: 'white', margin: 0, fontSize: '1.1rem', lineHeight: '1.5' }}>{skewTranslation}</p>
          <div style={{ display: 'flex', gap: '2rem', marginTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem', flexWrap: 'wrap' }}>
              <div>
                  <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Avg Call IV (Upside):</span>
                  <strong style={{ color: '#10b981', marginLeft: '8px' }}>{(avgCallIV * 100).toFixed(1)}%</strong>
              </div>
              <div>
                  <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Avg Put IV (Downside):</span>
                  <strong style={{ color: '#ef4444', marginLeft: '8px' }}>{(avgPutIV * 100).toFixed(1)}%</strong>
              </div>
              <div>
                  <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Spot Price:</span>
                  <strong style={{ color: 'white', marginLeft: '8px' }}>${spot?.toFixed(2)}</strong>
              </div>
          </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', background: 'rgba(0,0,0,0.2)', padding: '0.5rem', borderRadius: '8px' }}>
        <div ref={plotRef} style={{ width: '800px', height: '600px' }}></div>
      </div>
    </div>
  );
};

export default VolatilitySurface3D;
