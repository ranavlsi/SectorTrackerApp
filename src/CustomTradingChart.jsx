import React, { useEffect, useRef, useState } from 'react';
import { createChart, CrosshairMode, CandlestickSeries } from 'lightweight-charts';
import { Loader, Maximize, Minimize } from 'lucide-react';

export default function CustomTradingChart({ ticker }) {
    const chartContainerRef = useRef();
    const chartRef = useRef();
    const [loading, setLoading] = useState(true);
    const [isExpanded, setIsExpanded] = useState(false);
    const [error, setError] = useState(null);
    
    useEffect(() => {
        if (!ticker) return;
        
        let chart;
        let candleSeries;
        let isMounted = true;
        
        const fetchData = async () => {
            setLoading(true);
            setError(null);
            try {
                // Use relative URL to leverage the Vite proxy (fixes CORS/Port issues)
                const res = await fetch(`/api/chart_data?ticker=${ticker}`);
                const data = await res.json();
                
                if (!isMounted) return;
                
                if (data.error) {
                    console.error("Chart data error:", data.error);
                    setLoading(false);
                    return;
                }

                // Initialize Chart safely
                chart = createChart(chartContainerRef.current, {
                    width: chartContainerRef.current.clientWidth || 600,
                    height: chartContainerRef.current.clientHeight || 400,
                    autoSize: true,
                    layout: {
                        background: { type: 'solid', color: '#0f172a' },
                        textColor: '#94a3b8',
                    },
                    grid: {
                        vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
                        horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
                    },
                    crosshair: {
                        mode: CrosshairMode.Normal,
                    },
                    rightPriceScale: {
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                    },
                    timeScale: {
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                        timeVisible: true,
                        secondsVisible: false,
                    },
                });

                chartRef.current = chart;

                // Add Candlestick Series using v5 API
                candleSeries = chart.addSeries(CandlestickSeries, {
                    upColor: '#10b981',
                    downColor: '#ef4444',
                    borderDownColor: '#ef4444',
                    borderUpColor: '#10b981',
                    wickDownColor: '#ef4444',
                    wickUpColor: '#10b981',
                });

                candleSeries.setData(data.candles);

                // Inject GEX and Dark Pool Custom Price Lines!
                if (data.levels && data.levels.length > 0) {
                    data.levels.forEach(level => {
                        candleSeries.createPriceLine({
                            price: level.price,
                            color: level.color,
                            lineWidth: 2,
                            lineStyle: 0, // 0 = Solid, 1 = Dotted, 2 = Dashed
                            axisLabelVisible: true,
                            title: level.title,
                        });
                    });
                }
                
                chart.timeScale().fitContent();
                
            } catch (err) {
                if (isMounted) {
                    console.error("Failed to render chart data:", err);
                    setError(err.message || String(err));
                    // Telemetry ping so I can read the error locally
                    fetch('/api/log_error', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ error: err.message || String(err), stack: err.stack })
                    }).catch(() => {});
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };
        
        fetchData();
        
        return () => {
            isMounted = false;
            if (chart) {
                chart.remove();
            }
        };
    }, [ticker]);

    return (
        <div 
            style={{ 
                position: isExpanded ? 'fixed' : 'relative',
                top: isExpanded ? 0 : 'auto',
                left: isExpanded ? 0 : 'auto',
                width: isExpanded ? '100vw' : '100%',
                height: isExpanded ? '100vh' : '100%',
                zIndex: isExpanded ? 99999 : 1,
                backgroundColor: '#0f172a',
                padding: isExpanded ? '10px' : 0,
                boxSizing: 'border-box',
                display: 'flex',
                flexDirection: 'column'
            }}
        >
            <button 
                onClick={() => setIsExpanded(!isExpanded)}
                style={{
                    position: 'absolute',
                    top: '20px',
                    right: '80px', // Shift left to avoid overlapping the price scale
                    zIndex: 100000,
                    background: 'rgba(15, 23, 42, 0.9)',
                    border: '1px solid #4facfe',
                    borderRadius: '4px',
                    color: '#4facfe',
                    padding: '8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}
            >
                {isExpanded ? <Minimize size={20} /> : <Maximize size={20} />}
            </button>
            
            {loading && (
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#4facfe', zIndex: 10 }}>
                    <Loader size={32} className="spin" style={{marginBottom: '1rem'}} />
                    <span>Rendering Native Chart...</span>
                </div>
            )}
            
            {error && (
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#ef4444', zIndex: 10, textAlign: 'center', padding: '20px', background: 'rgba(15, 23, 42, 0.9)', borderRadius: '8px', border: '1px solid #ef4444' }}>
                    <span style={{fontWeight: 'bold', fontSize: '1.2rem'}}>Failed to Load Native Chart</span>
                    <span style={{fontSize: '0.9rem', color: '#94a3b8', marginTop: '5px'}}>{error}</span>
                </div>
            )}
            
            <div ref={chartContainerRef} style={{ flex: 1, width: '100%', minHeight: 0 }} />
        </div>
    );
}
