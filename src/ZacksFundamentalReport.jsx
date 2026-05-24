import React, { useState, useEffect } from 'react';
import { Loader2, TrendingUp, TrendingDown, BookOpen, DollarSign, Activity, Target } from 'lucide-react';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area } from 'recharts';

const MetricCard = ({ title, value, icon: Icon, color }) => (
  <div style={{ padding: '1rem', background: 'rgba(30, 41, 59, 0.5)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
    <div style={{ padding: '0.75rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', color: color }}>
      <Icon size={24} />
    </div>
    <div>
      <p style={{ color: '#94a3b8', margin: '0 0 0.25rem 0', fontSize: '0.85rem', fontWeight: 'bold' }}>{title}</p>
      <h3 style={{ color: 'white', margin: 0, fontSize: '1.25rem' }}>{value !== null && value !== undefined ? value : 'N/A'}</h3>
    </div>
  </div>
);

const getStyleColor = (score) => {
  if (score === 'A' || score === 'B') return '#10b981'; // Green
  if (score === 'C') return '#f59e0b'; // Yellow
  if (score === 'D' || score === 'F') return '#ef4444'; // Red
  return '#94a3b8';
};

const StyleBadge = ({ label, score }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
    <div style={{ 
      width: label === 'VGM' ? '45px' : '32px', 
      height: '32px', 
      background: getStyleColor(score), 
      borderRadius: '6px', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      color: 'white',
      fontWeight: 'bold',
      fontSize: '1.1rem',
      textShadow: '0 1px 2px rgba(0,0,0,0.5)'
    }}>
      {score || '-'}
    </div>
    <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 'bold' }}>{label}</span>
  </div>
);

const ZacksFundamentalReport = ({ initialTicker }) => {
  const [ticker, setTicker] = useState(initialTicker || 'AAPL');
  const [searchInput, setSearchInput] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (initialTicker) {
      setTicker(initialTicker);
    }
  }, [initialTicker]);

  useEffect(() => {
    if (!ticker) return;
    const fetchFundamentals = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/fundamentals?ticker=${ticker}`);
        const result = await response.json();
        if (result.error) {
          setError(result.error);
        } else {
          setData(result);
        }
      } catch (err) {
        setError("Failed to fetch fundamental data.");
      }
      setLoading(false);
    };
    fetchFundamentals();
  }, [ticker]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchInput.trim()) {
      setTicker(searchInput.toUpperCase());
    }
  };

  const getRankColor = (rank) => {
    if (rank === 1) return '#10b981'; // Green
    if (rank === 2) return '#34d399'; // Light Green
    if (rank === 3) return '#f59e0b'; // Yellow
    if (rank === 4) return '#fb7185'; // Light Red
    return '#ef4444'; // Red
  };

  const formatPercent = (val) => val ? `${(val * 100).toFixed(1)}%` : 'N/A';
  const formatNumber = (val) => val ? val.toFixed(2) : 'N/A';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Search Header */}
      <div className="glass-card" style={{ padding: '2rem' }}>
        <h2 style={{ margin: '0 0 1rem 0', color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <BookOpen size={28} /> AI Fundamental Report (Zacks Style)
        </h2>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '1rem' }}>
          <input 
            type="text" 
            placeholder="Enter ticker (e.g., AAPL, NVDA, TSLA)..." 
            value={searchInput} 
            onChange={(e) => setSearchInput(e.target.value)} 
            style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid #334155', background: 'rgba(0,0,0,0.2)', color: 'white', flex: 1, fontSize: '1rem' }} 
          />
          <button type="submit" style={{ padding: '0.75rem 2rem', background: '#3b82f6', borderRadius: '8px', border: 'none', color: 'white', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem' }}>
            Analyze Fundamentals
          </button>
        </form>
      </div>

      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem' }}>
          <Loader2 size={48} color="#3b82f6" style={{ marginBottom: '1rem', animation: 'spin 1s linear infinite' }} />
          <p style={{ color: '#94a3b8' }}>Aggregating 10-Q/10-K Data for {ticker}...</p>
        </div>
      )}

      {error && !loading && (
        <div style={{ padding: '2rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', borderRadius: '8px', color: '#ef4444', textAlign: 'center' }}>
          {error}
        </div>
      )}

      {data && !loading && !error && (
        <>
          {/* AI Report Section */}
          <div className="glass-card" style={{ padding: '2rem', borderLeft: `6px solid ${getRankColor(data.zacks_rank)}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <p style={{ color: '#94a3b8', margin: '0 0 0.25rem 0', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', fontSize: '0.8rem' }}>AI Equity Research</p>
                <h1 style={{ color: 'white', margin: 0, fontSize: '2.5rem' }}>{ticker} <span style={{ color: '#94a3b8', fontSize: '1.5rem', fontWeight: 'normal' }}>${formatNumber(data.spot)}</span></h1>
              </div>
              
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem 2rem', borderRadius: '12px', border: `2px solid ${getRankColor(data.zacks_rank)}`, textAlign: 'center' }}>
                  <p style={{ color: '#94a3b8', margin: '0 0 0.25rem 0', fontSize: '0.8rem', fontWeight: 'bold' }}>ZACKS RANK PROXY</p>
                  <h2 style={{ color: getRankColor(data.zacks_rank), margin: 0, fontSize: '2rem' }}>#{data.zacks_rank}</h2>
                </div>

                {data.style_scores && (
                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '12px', border: `1px solid rgba(255,255,255,0.1)`, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <p style={{ color: '#94a3b8', margin: '0 0 0.5rem 0', fontSize: '0.8rem', fontWeight: 'bold', textAlign: 'center' }}>STYLE SCORES</p>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                      <StyleBadge label="V" score={data.style_scores.value} />
                      <StyleBadge label="G" score={data.style_scores.growth} />
                      <StyleBadge label="M" score={data.style_scores.momentum} />
                      <div style={{ width: '1px', background: 'rgba(255,255,255,0.2)', margin: '0 0.5rem' }}></div>
                      <StyleBadge label="VGM" score={data.style_scores.vgm} />
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <p style={{ color: 'white', fontSize: '1.15rem', lineHeight: '1.6', margin: 0 }}>
              {data.report}
            </p>
          </div>

          {/* Wall Street Analyst Targets */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem', marginTop: '1.5rem' }}>
            <MetricCard title={`Analyst Consensus (${data.numberOfAnalystOpinions || 0})`} value={(data.recommendationKey || 'N/A').replace('_', ' ').toUpperCase()} icon={Target} color="#c084fc" />
            <MetricCard title="Target Mean" value={data.targetMeanPrice ? `$${formatNumber(data.targetMeanPrice)}` : 'N/A'} icon={Target} color="#60a5fa" />
            <MetricCard title="Target High" value={data.targetHighPrice ? `$${formatNumber(data.targetHighPrice)}` : 'N/A'} icon={TrendingUp} color="#10b981" />
            <MetricCard title="Target Low" value={data.targetLowPrice ? `$${formatNumber(data.targetLowPrice)}` : 'N/A'} icon={TrendingDown} color="#ef4444" />
          </div>

          {/* Valuation Metrics Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
            <MetricCard title="PEG Ratio" value={formatNumber(data.pegRatio)} icon={Activity} color={data.pegRatio < 1.5 ? '#10b981' : (data.pegRatio > 3 ? '#ef4444' : '#f59e0b')} />
            <MetricCard title="Trailing P/E" value={formatNumber(data.trailingPE)} icon={DollarSign} color="#60a5fa" />
            <MetricCard title="Forward P/E" value={formatNumber(data.forwardPE)} icon={TrendingUp} color="#c084fc" />
            <MetricCard title="Revenue Growth" value={formatPercent(data.revenueGrowth)} icon={TrendingUp} color={data.revenueGrowth > 0 ? '#10b981' : '#ef4444'} />
            <MetricCard title="Profit Margins" value={formatPercent(data.profitMargins)} icon={DollarSign} color="#34d399" />
            <MetricCard title="Return on Equity" value={formatPercent(data.returnOnEquity)} icon={Activity} color="#fbc2eb" />
          </div>

          {/* Historical Charts */}
          {data.history && data.history.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              
              <div className="glass-card" style={{ padding: '1.5rem' }}>
                <h3 style={{ margin: '0 0 1rem 0', color: '#60a5fa' }}>Quarterly EPS Trend</h3>
                <div style={{ height: '300px', width: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={data.history}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="date" stroke="#94a3b8" tick={{ fontSize: 12 }} />
                      <YAxis stroke="#94a3b8" />
                      <Tooltip contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', borderColor: '#334155', borderRadius: '8px' }} />
                      <Bar dataKey="eps" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Basic EPS ($)" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="glass-card" style={{ padding: '1.5rem' }}>
                <h3 style={{ margin: '0 0 1rem 0', color: '#c084fc' }}>Quarterly Revenue Trend</h3>
                <div style={{ height: '300px', width: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={data.history}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="date" stroke="#94a3b8" tick={{ fontSize: 12 }} />
                      <YAxis stroke="#94a3b8" tickFormatter={(val) => `$${(val/1e9).toFixed(1)}B`} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', borderColor: '#334155', borderRadius: '8px' }} 
                        formatter={(val) => [`$${(val/1e9).toFixed(2)} Billion`, 'Revenue']}
                      />
                      <Area type="monotone" dataKey="revenue" fill="url(#colorRev)" stroke="#c084fc" name="Total Revenue" />
                      <defs>
                        <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#c084fc" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#c084fc" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>

            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ZacksFundamentalReport;
