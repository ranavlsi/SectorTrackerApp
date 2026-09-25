import React, { useEffect, useState, useRef } from 'react';
import { Loader } from 'lucide-react';

export default function UnifiedPlotlyChart({ ticker }) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const plotRef = useRef(null);

    useEffect(() => {
        if (!ticker) return;

        let isMounted = true;
        const fetchData = async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await fetch(`/api/chart_data?ticker=${ticker}`);
                const data = await res.json();
                
                if (!isMounted) return;
                
                if (data.error) {
                    setError(data.error);
                    setLoading(false);
                    return;
                }

                if (!data.candles || !Array.isArray(data.candles)) {
                    throw new Error("Invalid API response: missing candles array");
                }

                // Prepare Data for Plotly
                const dates = data.candles.map(c => c.time);
                const opens = data.candles.map(c => c.open);
                const highs = data.candles.map(c => c.high);
                const lows = data.candles.map(c => c.low);
                const closes = data.candles.map(c => c.close);

                // Prepare shapes for Darkpool/GEX levels
                const shapes = (data.levels || []).map(level => ({
                    type: 'line',
                    xref: 'paper',
                    x0: 0,
                    x1: 1,
                    yref: 'y',
                    y0: level.price,
                    y1: level.price,
                    line: {
                        color: level.color,
                        width: 2,
                        dash: 'dash'
                    }
                }));

                // Prepare annotations for the levels
                const annotations = (data.levels || []).map(level => ({
                    xref: 'paper',
                    x: 1,
                    yref: 'y',
                    y: level.price,
                    text: level.title,
                    showarrow: false,
                    xanchor: 'right',
                    yanchor: 'bottom',
                    font: { color: level.color, size: 12 },
                    bgcolor: 'rgba(15, 23, 42, 0.8)'
                }));

                // Wait for React to complete rendering the div before injecting Plotly
                setTimeout(() => {
                    if (!isMounted) return;
                    if (plotRef.current && window.Plotly) {
                        try {
                            const plotData = [
                                {
                                    x: dates,
                                    close: closes,
                                    decreasing: {line: {color: '#ef4444', width: 1.5}, fillcolor: '#ef4444'},
                                    high: highs,
                                    increasing: {line: {color: '#10b981', width: 1.5}, fillcolor: '#10b981'},
                                    line: {color: '#60a5fa'},
                                    low: lows,
                                    open: opens,
                                    type: 'candlestick',
                                    xaxis: 'x',
                                    yaxis: 'y',
                                    name: `${data.ticker} Price`
                                }
                            ];

                            // Add RS Line vs SPY overlay if present
                            if (data.rs_series && Array.isArray(data.rs_series) && data.rs_series.length > 0) {
                                plotData.push({
                                    x: data.rs_series.map(r => r.time),
                                    y: data.rs_series.map(r => r.value),
                                    type: 'scatter',
                                    mode: 'lines',
                                    name: 'IBD RS Line (vs SPY)',
                                    line: { color: '#00E676', width: 2.5 },
                                    yaxis: 'y2'
                                });
                            }

                            // Add Blue Dot markers overlay on BOTH Price and RS Line if present
                            if (data.blue_dots && Array.isArray(data.blue_dots) && data.blue_dots.length > 0) {
                                // 1. Blue Dots on Price Candles
                                plotData.push({
                                    x: data.blue_dots.map(b => b.time),
                                    y: data.blue_dots.map(b => b.price),
                                    type: 'scatter',
                                    mode: 'markers',
                                    name: '🔵 RS Blue Dot (Price)',
                                    marker: {
                                        color: '#38bdf8',
                                        size: 11,
                                        symbol: 'circle',
                                        line: { color: '#ffffff', width: 2 }
                                    },
                                    yaxis: 'y',
                                    hovertemplate: '<b>🔵 RS Blue Dot Pivot (Price)</b><br>Date: %{x}<br>Price: $%{y:.2f}<extra></extra>'
                                });

                                // 2. Blue Dots on RS Line
                                plotData.push({
                                    x: data.blue_dots.map(b => b.time),
                                    y: data.blue_dots.map(b => b.rs_value),
                                    type: 'scatter',
                                    mode: 'markers',
                                    name: '🔵 RS Blue Dot (RS Line)',
                                    marker: {
                                        color: '#00E676',
                                        size: 11,
                                        symbol: 'circle',
                                        line: { color: '#ffffff', width: 2 }
                                    },
                                    yaxis: 'y2',
                                    hovertemplate: '<b>🔵 RS Blue Dot Pivot (RS Line)</b><br>Date: %{x}<br>RS Level: %{y:.2f}<extra></extra>'
                                });
                            }

                            // Add VCP Contraction Wave shapes & depth callout annotations if present
                            if (data.vcp_waves && Array.isArray(data.vcp_waves) && data.vcp_waves.length > 0) {
                                data.vcp_waves.forEach(wave => {
                                    // 1. Vertical pullback line from Wave Start to Low
                                    shapes.push({
                                        type: 'line',
                                        xref: 'x',
                                        x0: wave.start_date,
                                        x1: wave.end_date,
                                        yref: 'y',
                                        y0: wave.start_price,
                                        y1: wave.end_price,
                                        line: {
                                            color: wave.color,
                                            width: 2,
                                            dash: 'dash'
                                        }
                                    });

                                    // 2. Depth percentage badge annotation
                                    annotations.push({
                                        xref: 'x',
                                        x: wave.end_date,
                                        yref: 'y',
                                        y: wave.end_price,
                                        text: `<b>${wave.name}: -${wave.depth_pct}%</b>`,
                                        showarrow: true,
                                        arrowhead: 2,
                                        arrowcolor: wave.color,
                                        ax: 0,
                                        ay: 25,
                                        font: { color: wave.color, size: 10, family: "'JetBrains Mono', monospace" },
                                        bgcolor: 'rgba(15, 23, 42, 0.9)',
                                        bordercolor: wave.color,
                                        borderwidth: 1
                                    });
                                });
                            }

                            const layout = {
                                dragmode: 'pan',
                                paper_bgcolor: '#090d16',
                                plot_bgcolor: '#090d16',
                                margin: { t: 40, r: 65, l: 65, b: 40 },
                                hovermode: 'x unified',
                                legend: {
                                    orientation: 'h',
                                    yanchor: 'bottom',
                                    y: 1.02,
                                    xanchor: 'right',
                                    x: 1,
                                    font: { color: '#cbd5e1', size: 11 }
                                },
                                xaxis: {
                                    rangeslider: { visible: false },
                                    type: 'category', // Removes Weekend/Holiday blank gap distortions!
                                    gridcolor: 'rgba(255,255,255,0.06)',
                                    tickfont: { color: '#94a3b8', size: 11 },
                                    showspikes: true,
                                    spikemode: 'across',
                                    spikedash: 'dot',
                                    spikecolor: '#64748b',
                                    spikethickness: 1,
                                    nticks: 12
                                },
                                yaxis: {
                                    title: { text: 'Stock Price ($)', font: { color: '#94a3b8', size: 12 } },
                                    gridcolor: 'rgba(255,255,255,0.06)',
                                    tickfont: { color: '#94a3b8', size: 11 },
                                    side: 'right',
                                    showspikes: true,
                                    spikemode: 'across',
                                    spikedash: 'dot',
                                    spikecolor: '#64748b',
                                    spikethickness: 1,
                                    fixedrange: false,
                                    autorange: true
                                },
                                yaxis2: {
                                    title: { text: 'IBD Relative Strength Line', font: { color: '#00E676', size: 12 } },
                                    tickfont: { color: '#00E676', size: 11 },
                                    overlaying: 'y',
                                    side: 'left',
                                    showgrid: false,
                                    fixedrange: false,
                                    autorange: true
                                },
                                shapes: shapes,
                                annotations: annotations,
                                modebar: {
                                    add: ['drawline', 'drawopenpath', 'drawcircle', 'drawrect', 'eraseshape'],
                                    activecolor: '#4facfe'
                                },
                                newshape: {
                                    line: { color: '#4facfe', width: 2 }
                                }
                            };

                            const config = {
                                responsive: true,
                                displayModeBar: true,
                                scrollZoom: true, // CRITICAL: Enables mouse-wheel zooming like TradingView
                                displaylogo: false
                            };

                            window.Plotly.newPlot(plotRef.current, plotData, layout, config);
                        } catch (plotErr) {
                            console.error("Plotly render error:", plotErr);
                            setError("Plotly error: " + plotErr.message);
                            fetch('/api/search?ticker=PLOTLY_ERR_' + encodeURIComponent(plotErr.message));
                        }
                    } else if (!window.Plotly) {
                        const script = document.createElement("script");
                        script.src = "https://cdn.plot.ly/plotly-2.32.0.min.js";
                        script.onload = () => {
                            if (plotRef.current && window.Plotly) {
                                try {
                                    window.Plotly.newPlot(plotRef.current, plotData, layout, config);
                                } catch (e) {
                                    setError("Plotly error: " + e.message);
                                }
                            }
                        };
                        script.onerror = () => setError("Plotly library failed to load globally.");
                        document.head.appendChild(script);
                    }
                }, 100);

            } catch (err) {
                if (isMounted) {
                    const msg = err.message || String(err);
                    setError(msg);
                    fetch('/api/search?ticker=FETCH_ERR_' + encodeURIComponent(msg));
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        fetchData();
        return () => { isMounted = false; };
    }, [ticker]);

    return (
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            {loading && (
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#4facfe', zIndex: 10, background: 'rgba(15, 23, 42, 0.8)' }}>
                    <Loader size={32} className="spin" style={{marginBottom: '1rem'}} />
                    <span>Loading Unified Chart...</span>
                </div>
            )}
            
            {error && (
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#ef4444', zIndex: 10, background: 'rgba(15, 23, 42, 0.8)' }}>
                    <span style={{fontWeight: 'bold', fontSize: '1.2rem'}}>Failed to Load Chart Data</span>
                    <span style={{fontSize: '0.9rem', color: '#94a3b8', marginTop: '5px'}}>{error}</span>
                </div>
            )}

            <div ref={plotRef} style={{ width: '100%', height: '100%', minHeight: '600px' }} />
        </div>
    );
}
