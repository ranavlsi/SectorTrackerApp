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
                                    decreasing: {line: {color: '#ef4444'}},
                                    high: highs,
                                    increasing: {line: {color: '#10b981'}},
                                    line: {color: 'rgba(31,119,180,1)'},
                                    low: lows,
                                    open: opens,
                                    type: 'candlestick',
                                    xaxis: 'x',
                                    yaxis: 'y',
                                    name: data.ticker
                                }
                            ];

                            const layout = {
                                dragmode: 'pan', // Default to panning like TradingView
                                paper_bgcolor: 'transparent',
                                plot_bgcolor: 'transparent',
                                margin: { t: 20, r: 50, l: 50, b: 40 },
                                hovermode: 'x unified', // Show unified tooltip across all series
                                xaxis: {
                                    rangeslider: { visible: false },
                                    gridcolor: 'rgba(255,255,255,0.05)',
                                    tickfont: { color: '#94a3b8' },
                                    showspikes: true, // TradingView style crosshair
                                    spikemode: 'across',
                                    spikedash: 'dot',
                                    spikecolor: '#94a3b8',
                                    spikethickness: 1
                                },
                                yaxis: {
                                    gridcolor: 'rgba(255,255,255,0.05)',
                                    tickfont: { color: '#94a3b8' },
                                    side: 'right',
                                    showspikes: true,
                                    spikemode: 'across',
                                    spikedash: 'dot',
                                    spikecolor: '#94a3b8',
                                    spikethickness: 1,
                                    fixedrange: false
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
                        setError("Plotly library failed to load globally.");
                        fetch('/api/search?ticker=PLOTLY_MISSING');
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
