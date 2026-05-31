import React, { useState, useEffect } from 'react';
import { RefreshCw, Mail, Star, AlertCircle, Coffee, ChevronDown, ChevronUp, Loader } from 'lucide-react';
import RsSparkline from './RsSparkline';

const TickerCell = ({ ticker, onClick }) => {
    const [hoverInfo, setHoverInfo] = useState(null);
    const [healthData, setHealthData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState(null);

    const handleMouseEnter = (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const renderAbove = spaceBelow < 300; // If less than 300px below, flip it up
        
        setHoverInfo({ 
            x: rect.left, 
            y: renderAbove ? rect.top - 5 : rect.bottom + 5,
            renderAbove 
        });
        
        if (!healthData && !loading && !errorMsg) {
            setLoading(true);
            fetch(`/api/search?ticker=${ticker}&t=${new Date().getTime()}`)
                .then(res => res.json())
                .then(data => {
                    if (data.error) setErrorMsg(data.error);
                    else setHealthData(data);
                    setLoading(false);
                })
                .catch(() => {
                    setErrorMsg("Network error");
                    setLoading(false);
                });
        }
    };

    return (
        <td 
            style={{ padding: '10px', cursor: 'pointer', color: '#60a5fa', fontWeight: 'bold' }} 
            onClick={() => onClick(ticker)}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={() => setHoverInfo(null)}
        >
            {ticker}
            {hoverInfo && (
                <div style={{ position: 'fixed', top: hoverInfo.y, left: hoverInfo.x, transform: hoverInfo.renderAbove ? 'translateY(-100%)' : 'none', width: '280px', background: 'rgba(15, 23, 42, 0.95)', border: '1px solid #4facfe', borderRadius: '8px', padding: '1rem', zIndex: 99999, boxShadow: '0 10px 25px rgba(0,0,0,0.5)', cursor: 'default', pointerEvents: 'none' }}>
                    <h4 style={{ margin: '0 0 0.5rem 0', color: '#4facfe' }}>{ticker} Health</h4>
                    {loading ? (
                        <p style={{ margin: 0, fontSize: '0.9rem', color: '#94a3b8' }}>Loading live data...</p>
                    ) : healthData && healthData.technicals ? (
                        <div>
                            <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.9rem', color: '#fff', fontWeight: 'normal' }}>Stage: <strong style={{ color: healthData.technicals.stage?.includes('2') ? '#10b981' : healthData.technicals.stage?.includes('4') ? '#ef4444' : '#f59e0b' }}>{healthData.technicals.stage}</strong></p>
                            <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.9rem', color: '#fff', fontWeight: 'normal' }}>Mom: <strong style={{ color: healthData.technicals.momentum_color === 'bullish' ? '#10b981' : '#ef4444' }}>{healthData.technicals.momentum_text}</strong></p>
                            {healthData.score && <p style={{ margin: 0, fontSize: '0.9rem', color: '#fff', fontWeight: 'normal' }}>Master Score: <strong style={{ color: healthData.score >= 70 ? '#10b981' : healthData.score >= 40 ? '#f59e0b' : '#ef4444' }}>{healthData.score}/100</strong></p>}
                            
                            {healthData.trade_plan && (
                                <>
                                    <h4 style={{ margin: '1rem 0 0.5rem 0', color: '#f59e0b', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.5rem' }}>Trade Plan (ATR)</h4>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.25rem' }}>
                                        <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8', fontWeight: 'normal' }}>Entry: <strong style={{ color: '#fff' }}>${healthData.trade_plan.entry}</strong></p>
                                        <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8', fontWeight: 'normal' }}>Stop: <strong style={{ color: '#ef4444' }}>${healthData.trade_plan.stop_loss}</strong></p>
                                    </div>
                                </>
                            )}
                        </div>
                    ) : (
                        <p style={{ margin: 0, fontSize: '0.9rem', color: '#ef4444' }}>{errorMsg || 'Data unavailable'}</p>
                    )}
                </div>
            )}
        </td>
    );
};

export default function RsLineScanner({ onTickerClick }) {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [watchlist, setWatchlist] = useState([]);
    const [showWatchlist, setShowWatchlist] = useState(false);
    const [hoverInfo, setHoverInfo] = useState(null);
    const [liveAlerts, setLiveAlerts] = useState([]);
    
    // Filters
    const [minRating, setMinRating] = useState(80);
    const [chOnly, setChOnly] = useState(false);
    const [zacksOnly, setZacksOnly] = useState(false);
    const [skipEarnings, setSkipEarnings] = useState(false);
    const [minAdr, setMinAdr] = useState(3);
    const [maxAdr, setMaxAdr] = useState(15);
    const [minMcap, setMinMcap] = useState(5);
    const [alertEmail, setAlertEmail] = useState('ranavlsi@gmail.com');

    useEffect(() => {
        const saved = localStorage.getItem('rsWatchlist');
        if (saved) setWatchlist(JSON.parse(saved));
        fetchData();

        // Intraday Breakout Alert Polling
        const pollAlerts = async () => {
            try {
                const res = await fetch('/live_market_alerts.json?t=' + new Date().getTime());
                if (res.ok) {
                    const json = await res.json();
                    setLiveAlerts(json.alerts || []);
                }
            } catch (err) {}
        };
        pollAlerts();
        const interval = setInterval(pollAlerts, 10000);
        return () => clearInterval(interval);
    }, []);

    const fetchData = async () => {
        try {
            const res = await fetch('/rs_scanner_results.json?t=' + new Date().getTime());
            if (res.ok) {
                const json = await res.json();
                setData(json.results || []);
            }
        } catch (err) {
            console.error("Failed to load RS data", err);
        }
    };

    const runScanner = async () => {
        setLoading(true);
        try {
            await fetch('http://localhost:5001/api/run_rs_scanner', { method: 'POST' });
            alert("RS Line Scanner started in the background. Please wait ~1-2 minutes, then refresh the UI.");
        } catch (err) {
            alert("Failed to start scanner.");
        }
        setLoading(false);
    };

    const toggleWatchlist = (item) => {
        const exists = watchlist.find(w => w.ticker === item.ticker);
        let updated;
        if (exists) {
            updated = watchlist.filter(w => w.ticker !== item.ticker);
        } else {
            updated = [...watchlist, { ...item, savedAt: new Date().toISOString() }];
        }
        setWatchlist(updated);
        localStorage.setItem('rsWatchlist', JSON.stringify(updated));
    };

    const handleSendAlert = () => {
        if (!alertEmail) {
            alert("Please enter an email address first.");
            return;
        }
        let body = `RS Line Scanner Alert\n\n`;
        filteredData.slice(0, 20).forEach((item, i) => {
            body += `${i+1}. ${item.ticker} - RS Rating: ${item.rs_rating} | Badge: ${item.rs_badge} | Pattern: ${item.pattern_status === 'c_and_h' ? 'Cup & Handle' : item.pattern_status}\n`;
        });
        window.location.href = `mailto:${alertEmail}?subject=Top RS Line Setups&body=${encodeURIComponent(body)}`;
    };

    const filteredData = data.filter(item => {
        if (item.rs_rating < minRating) return false;
        if (chOnly && item.pattern_status !== 'c_and_h') return false;
        if (zacksOnly && item.zacks_rank > 2) return false;
        if (skipEarnings && item.earnings_days !== 999 && item.earnings_days <= 14) return false;
        if (item.adr_pct < minAdr || item.adr_pct > maxAdr) return false;
        if (item.market_cap > 0 && (item.market_cap / 1e9) < minMcap) return false;
        return true;
    }).sort((a, b) => b.rs_rating - a.rs_rating);

    const formatMcap = (val) => {
        if (!val || val === 0) return 'N/A';
        const b = val / 1e9;
        if (b >= 1000) return `$${(b/1000).toFixed(1)}T`;
        return `$${b.toFixed(1)}B`;
    };

    return (
        <div style={{ padding: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h2 style={{ margin: 0, color: '#4facfe', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <RefreshCw /> Advanced RS Line Scanner
                </h2>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <input 
                        type="email" 
                        placeholder="alert@email.com" 
                        value={alertEmail} 
                        onChange={e => setAlertEmail(e.target.value)}
                        style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #334155', background: 'rgba(0,0,0,0.2)', color: '#fff' }}
                    />
                    <button onClick={handleSendAlert} style={{ background: '#3b82f6', color: 'white', padding: '0.5rem 1rem', borderRadius: '4px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <Mail size={16} /> Send Alert
                    </button>
                    <button onClick={() => setShowWatchlist(!showWatchlist)} style={{ background: showWatchlist ? '#f59e0b' : 'rgba(245,158,11,0.2)', color: showWatchlist ? '#fff' : '#f59e0b', padding: '0.5rem 1rem', borderRadius: '4px', border: '1px solid #f59e0b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <Star size={16} /> Watchlist ({watchlist.length})
                    </button>
                </div>
            </div>

            {/* Intraday Live Alerts Bar */}
            {liveAlerts.length > 0 && (
                <div style={{ marginBottom: '2rem', padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', borderRadius: '8px' }}>
                    <h3 style={{ margin: '0 0 10px 0', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        🔥 LIVE INTRADAY BREAKOUT ALERTS
                    </h3>
                    <div style={{ display: 'flex', gap: '15px', overflowX: 'auto', paddingBottom: '5px' }}>
                        {liveAlerts.map((alert, i) => (
                            <div key={i} onClick={() => onTickerClick(alert.ticker)} style={{ cursor: 'pointer', background: 'rgba(15, 23, 42, 0.8)', padding: '10px 15px', borderRadius: '6px', borderLeft: '3px solid #ef4444', minWidth: '200px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <strong style={{ color: '#fff', fontSize: '1.1rem' }}>{alert.ticker}</strong>
                                    <span style={{ color: '#ef4444', fontWeight: 'bold' }}>+{alert.pct_above.toFixed(2)}%</span>
                                </div>
                                <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '5px' }}>
                                    Breakout: ${alert.trigger_price.toFixed(2)} ➔ Now: ${alert.price.toFixed(2)}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Filter Bar */}
            <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '2rem', display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'center' }}>
                <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '5px' }}>Min RS Rating</label>
                    <input type="number" value={minRating} onChange={e => setMinRating(Number(e.target.value))} style={{ width: '60px', padding: '5px', background: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} />
                </div>
                <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '5px' }}>ADR% Range</label>
                    <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                        <input type="number" value={minAdr} onChange={e => setMinAdr(Number(e.target.value))} style={{ width: '50px', padding: '5px', background: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} />
                        <span style={{color: '#94a3b8'}}>-</span>
                        <input type="number" value={maxAdr} onChange={e => setMaxAdr(Number(e.target.value))} style={{ width: '50px', padding: '5px', background: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} />
                    </div>
                </div>
                <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '5px' }}>Min MCap ($B)</label>
                    <input type="number" value={minMcap} onChange={e => setMinMcap(Number(e.target.value))} style={{ width: '60px', padding: '5px', background: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '15px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', color: '#e2e8f0' }}>
                        <input type="checkbox" checked={chOnly} onChange={e => setChOnly(e.target.checked)} />
                        ☕ C&H Only
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', color: '#e2e8f0' }}>
                        <input type="checkbox" checked={skipEarnings} onChange={e => setSkipEarnings(e.target.checked)} />
                        Skip Earnings ≤14d
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', color: '#e2e8f0', marginLeft: '10px' }}>
                        <input type="checkbox" checked={zacksOnly} onChange={e => setZacksOnly(e.target.checked)} />
                        🔥 Zacks #1 & #2
                    </label>
                </div>
                <div style={{ marginLeft: 'auto', marginTop: '15px' }}>
                    <button onClick={runScanner} disabled={loading} style={{ background: '#10b981', color: 'white', padding: '0.5rem 1rem', borderRadius: '4px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        {loading ? <Loader size={16} className="spin" /> : <RefreshCw size={16} />} Run New Scan
                    </button>
                    <button onClick={fetchData} style={{ marginLeft: '10px', background: '#475569', color: 'white', padding: '0.5rem 1rem', borderRadius: '4px', border: 'none', cursor: 'pointer' }}>
                        Refresh UI
                    </button>
                </div>
            </div>

            {showWatchlist ? (
                <div>
                    <h3 style={{ color: '#f59e0b', borderBottom: '1px solid #f59e0b', paddingBottom: '10px' }}>Your Saved Setups</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '15px' }}>
                        {watchlist.length === 0 ? <p style={{ color: '#94a3b8' }}>No saved stocks yet.</p> : 
                            watchlist.map(item => (
                                <div key={item.ticker} className="glass-card" style={{ padding: '1rem', borderLeft: '3px solid #f59e0b', cursor: 'pointer' }} onClick={() => onTickerClick(item.ticker)}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <h2 style={{ margin: 0, color: '#fff' }}>{item.ticker}</h2>
                                        <button onClick={(e) => { e.stopPropagation(); toggleWatchlist(item); }} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1.2rem' }}>×</button>
                                    </div>
                                    <p style={{ color: '#10b981', fontWeight: 'bold', margin: '5px 0' }}>RS Rating: {item.rs_rating}</p>
                                    <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0 }}>Added: {new Date(item.savedAt).toLocaleDateString()}</p>
                                </div>
                            ))
                        }
                    </div>
                </div>
            ) : (
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid #334155', color: '#94a3b8' }}>
                                <th style={{ padding: '10px' }}>★</th>
                                <th style={{ padding: '10px' }}>Ticker</th>
                                <th style={{ padding: '10px' }}>RS Rating</th>
                                <th style={{ padding: '10px' }}>RS Status</th>
                                <th style={{ padding: '10px' }}>C&H Pattern</th>
                                <th style={{ padding: '10px' }}>RS Sparkline</th>
                                <th style={{ padding: '10px' }}>Zacks Rank</th>
                                <th style={{ padding: '10px' }}>ADR%</th>
                                <th style={{ padding: '10px' }}>Earnings</th>
                                <th style={{ padding: '10px' }}>MCap</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredData.map(item => {
                                const isSaved = watchlist.find(w => w.ticker === item.ticker);
                                let rsColor = '#ef4444';
                                if (item.rs_rating >= 90) rsColor = '#10b981';
                                else if (item.rs_rating >= 60) rsColor = '#f59e0b';
                                
                                let earnColor = '#94a3b8';
                                let earnText = 'Unknown';
                                if (item.earnings_days !== 999) {
                                    earnText = `${item.earnings_days}d`;
                                    if (item.earnings_days <= 7) earnColor = '#ef4444';
                                    else if (item.earnings_days <= 14) earnColor = '#f59e0b';
                                    else earnColor = '#10b981';
                                }

                                return (
                                    <tr key={item.ticker} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                        <td style={{ padding: '10px', cursor: 'pointer', color: isSaved ? '#f59e0b' : '#475569' }} onClick={() => toggleWatchlist(item)}>
                                            <Star size={16} fill={isSaved ? '#f59e0b' : 'none'} />
                                        </td>
                                        <TickerCell ticker={item.ticker} onClick={onTickerClick} />
                                        <td style={{ padding: '10px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <span style={{ color: rsColor, fontWeight: 'bold', width: '25px' }}>{item.rs_rating}</span>
                                                <div style={{ width: '50px', height: '6px', background: '#1e293b', borderRadius: '3px', overflow: 'hidden' }}>
                                                    <div style={{ width: `${item.rs_rating}%`, height: '100%', background: rsColor }}></div>
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ padding: '10px' }}>
                                            {item.rs_badge === '12M RS High' && <span style={{ color: '#10b981', display: 'flex', gap: '5px', alignItems: 'center' }}><Star size={14} fill="#10b981"/> 12M RS High</span>}
                                            {item.rs_badge === '6M RS High' && <span style={{ color: '#34d399', display: 'flex', gap: '5px', alignItems: 'center' }}><Star size={14} fill="none"/> 6M RS High</span>}
                                            {item.rs_badge === '3M RS High' && <span style={{ color: '#f59e0b', display: 'flex', gap: '5px', alignItems: 'center' }}><ChevronUp size={14} /> 3M RS High</span>}
                                            {item.rs_badge === '1M RS High' && <span style={{ color: '#fbbf24', display: 'flex', gap: '5px', alignItems: 'center' }}><ChevronUp size={14} /> 1M RS High</span>}
                                        </td>
                                        <td style={{ padding: '10px' }}>
                                            {item.pattern_status === 'c_and_h' && <span style={{ color: '#c47aff', padding: '2px 8px', background: 'rgba(196,122,255,0.1)', borderRadius: '12px', fontSize: '0.85rem' }}>☕ C&H ({item.pattern_score})</span>}
                                            {item.pattern_status === 'cup' && <span style={{ color: '#f59e0b', padding: '2px 8px', background: 'rgba(245,158,11,0.1)', borderRadius: '12px', fontSize: '0.85rem' }}>◡ Cup</span>}
                                        </td>
                                        <td 
                                            style={{ padding: '10px', cursor: 'pointer' }} 
                                            onMouseEnter={(e) => { 
                                                const rect = e.currentTarget.getBoundingClientRect();
                                                const spaceAbove = rect.top;
                                                const renderBelow = spaceAbove < 150;
                                                setHoverInfo({ 
                                                    item, 
                                                    x: rect.left + (rect.width / 2), 
                                                    y: renderBelow ? rect.bottom + 10 : rect.top - 10,
                                                    renderBelow
                                                }); 
                                            }} 
                                            onMouseLeave={() => setHoverInfo(null)}
                                        >
                                            <RsSparkline data={item.sparkline} status={item.pattern_status} />
                                        </td>
                                        <td style={{ padding: '10px', fontWeight: 'bold' }}>
                                            {item.zacks_rank === 1 && <span style={{ color: '#10b981' }}>#1 Strong Buy</span>}
                                            {item.zacks_rank === 2 && <span style={{ color: '#34d399' }}>#2 Buy</span>}
                                            {item.zacks_rank === 3 && <span style={{ color: '#f59e0b' }}>#3 Hold</span>}
                                            {item.zacks_rank >= 4 && <span style={{ color: '#ef4444' }}>#{item.zacks_rank} Sell</span>}
                                        </td>
                                        <td style={{ padding: '10px', color: (item.adr_pct < 3 || item.adr_pct > 15) ? '#ef4444' : '#10b981' }}>
                                            {item.adr_pct ? item.adr_pct.toFixed(1) + '%' : '-'}
                                        </td>
                                        <td style={{ padding: '10px', color: earnColor, display: 'flex', alignItems: 'center', gap: '5px' }}>
                                            {(earnColor === '#ef4444' || earnColor === '#f59e0b') && <AlertCircle size={14} />} {earnText}
                                        </td>
                                        <td style={{ padding: '10px', color: '#94a3b8' }}>
                                            {formatMcap(item.market_cap)}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    {filteredData.length === 0 && (
                        <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                            No stocks matched the current filter criteria.
                        </div>
                    )}
                </div>
            )}
            
            {/* Global Fixed Tooltip */}
            {hoverInfo && (
                <div style={{ 
                    position: 'fixed', 
                    top: hoverInfo.y, 
                    left: hoverInfo.x, 
                    transform: `translateX(-50%) ${hoverInfo.renderBelow ? '' : 'translateY(-100%)'}`,
                    background: '#1e293b', 
                    border: '1px solid #334155', 
                    padding: '10px', 
                    borderRadius: '8px', 
                    zIndex: 999999, 
                    width: '180px', 
                    boxShadow: '0 8px 16px rgba(0,0,0,0.6)',
                    pointerEvents: 'none'
                }}>
                    <h4 style={{ margin: '0 0 8px 0', color: '#60a5fa', textAlign: 'center', fontSize: '0.9rem' }}>{hoverInfo.item.ticker} RS Stats</h4>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                        <span style={{ color: '#94a3b8' }}>52w High:</span>
                        <span style={{ color: '#10b981', fontWeight: 'bold' }}>{Math.max(...hoverInfo.item.sparkline).toFixed(3)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginTop: '5px' }}>
                        <span style={{ color: '#94a3b8' }}>52w Low:</span>
                        <span style={{ color: '#ef4444', fontWeight: 'bold' }}>{Math.min(...hoverInfo.item.sparkline).toFixed(3)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginTop: '5px', borderTop: '1px solid #334155', paddingTop: '5px' }}>
                        <span style={{ color: '#94a3b8' }}>Current:</span>
                        <span style={{ color: '#f59e0b', fontWeight: 'bold' }}>{hoverInfo.item.sparkline[hoverInfo.item.sparkline.length-1].toFixed(3)}</span>
                    </div>
                </div>
            )}
        </div>
    );
}
