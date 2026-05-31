import React, { useState, useEffect } from 'react';
import { RefreshCw, Mail, Star, AlertCircle, Coffee, ChevronDown, ChevronUp, Loader } from 'lucide-react';
import RsSparkline from './RsSparkline';

export default function RsLineScanner({ onTickerClick }) {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [watchlist, setWatchlist] = useState([]);
    const [showWatchlist, setShowWatchlist] = useState(false);
    
    // Filters
    const [minRating, setMinRating] = useState(80);
    const [chOnly, setChOnly] = useState(false);
    const [skipEarnings, setSkipEarnings] = useState(false);
    const [minAdr, setMinAdr] = useState(3);
    const [maxAdr, setMaxAdr] = useState(15);
    const [minMcap, setMinMcap] = useState(5);
    const [alertEmail, setAlertEmail] = useState('ranavlsi@gmail.com');

    useEffect(() => {
        const saved = localStorage.getItem('rsWatchlist');
        if (saved) setWatchlist(JSON.parse(saved));
        fetchData();
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
                                        <td style={{ padding: '10px', cursor: 'pointer', color: '#60a5fa', fontWeight: 'bold' }} onClick={() => onTickerClick(item.ticker)}>
                                            {item.ticker}
                                        </td>
                                        <td style={{ padding: '10px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <span style={{ color: rsColor, fontWeight: 'bold', width: '25px' }}>{item.rs_rating}</span>
                                                <div style={{ width: '50px', height: '6px', background: '#1e293b', borderRadius: '3px', overflow: 'hidden' }}>
                                                    <div style={{ width: `${item.rs_rating}%`, height: '100%', background: rsColor }}></div>
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ padding: '10px' }}>
                                            {item.rs_badge === 'New High' && <span style={{ color: '#10b981', display: 'flex', gap: '5px', alignItems: 'center' }}><Star size={14} fill="#10b981"/> New High</span>}
                                            {item.rs_badge === 'Near High' && <span style={{ color: '#f59e0b', display: 'flex', gap: '5px', alignItems: 'center' }}><ChevronUp size={14} /> Near High</span>}
                                            {item.rs_badge === 'Watch' && <span style={{ color: '#94a3b8' }}>◉ Watch</span>}
                                        </td>
                                        <td style={{ padding: '10px' }}>
                                            {item.pattern_status === 'c_and_h' && <span style={{ color: '#c47aff', padding: '2px 8px', background: 'rgba(196,122,255,0.1)', borderRadius: '12px', fontSize: '0.85rem' }}>☕ C&H ({item.pattern_score})</span>}
                                            {item.pattern_status === 'cup' && <span style={{ color: '#f59e0b', padding: '2px 8px', background: 'rgba(245,158,11,0.1)', borderRadius: '12px', fontSize: '0.85rem' }}>◡ Cup</span>}
                                        </td>
                                        <td style={{ padding: '10px' }}>
                                            <RsSparkline data={item.sparkline} status={item.pattern_status} />
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
        </div>
    );
}
