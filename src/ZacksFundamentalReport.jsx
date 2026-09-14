import React, { useState, useEffect } from 'react';
import { 
  Loader2, 
  TrendingUp, 
  TrendingDown, 
  BookOpen, 
  DollarSign, 
  Activity, 
  Target, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowUpRight, 
  ArrowDownRight, 
  Award, 
  BarChart3, 
  Calendar, 
  ShieldCheck, 
  Layers, 
  Search,
  Sparkles
} from 'lucide-react';
import { 
  ComposedChart, 
  Bar, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  Area 
} from 'recharts';

const MetricCard = ({ title, value, subtext, icon: Icon, color }) => (
  <div style={{ 
    padding: '1.25rem', 
    background: 'rgba(15, 23, 42, 0.75)', 
    borderRadius: '12px', 
    border: '1px solid rgba(255,255,255,0.08)', 
    display: 'flex', 
    alignItems: 'flex-start', 
    gap: '1rem',
    backdropFilter: 'blur(8px)',
    transition: 'transform 0.15s ease, border-color 0.15s ease'
  }}>
    <div style={{ 
      padding: '0.75rem', 
      background: 'rgba(0,0,0,0.3)', 
      borderRadius: '10px', 
      color: color || '#00F0FF',
      border: `1px solid ${color ? `${color}40` : 'rgba(0, 240, 255, 0.2)'}`
    }}>
      <Icon size={22} />
    </div>
    <div style={{ flex: 1 }}>
      <p style={{ color: '#94a3b8', margin: '0 0 0.35rem 0', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{title}</p>
      <h3 style={{ color: 'white', margin: 0, fontSize: '1.35rem', fontWeight: '800' }}>{value !== null && value !== undefined ? value : 'N/A'}</h3>
      {subtext && <p style={{ color: '#64748b', margin: '0.35rem 0 0 0', fontSize: '0.75rem', fontWeight: '500' }}>{subtext}</p>}
    </div>
  </div>
);

const getStyleColor = (score) => {
  if (score === 'A') return '#00E676'; // Bright green
  if (score === 'B') return '#10b981'; // Green
  if (score === 'C') return '#f59e0b'; // Amber
  if (score === 'D') return '#f97316'; // Orange
  if (score === 'F') return '#ef4444'; // Red
  return '#94a3b8';
};

const StyleBadge = ({ label, score, description }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem' }} title={description}>
    <div style={{ 
      width: label === 'VGM' ? '54px' : '40px', 
      height: '40px', 
      background: `${getStyleColor(score)}15`,
      border: `2px solid ${getStyleColor(score)}`,
      borderRadius: '8px', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      color: getStyleColor(score),
      fontWeight: '900',
      fontSize: label === 'VGM' ? '1.3rem' : '1.2rem',
      textShadow: `0 0 12px ${getStyleColor(score)}60`,
      boxShadow: `0 4px 15px rgba(0,0,0,0.3)`
    }}>
      {score || '-'}
    </div>
    <span style={{ fontSize: '0.75rem', color: '#cbd5e1', fontWeight: '700', letterSpacing: '0.5px' }}>{label}</span>
  </div>
);

const ZacksFundamentalReport = ({ initialTicker }) => {
  const [ticker, setTicker] = useState(initialTicker || 'NVDA');
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
        setError("Failed to fetch fundamental data from institutional Zacks engine.");
      }
      setLoading(false);
    };
    fetchFundamentals();
  }, [ticker]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchInput.trim()) {
      setTicker(searchInput.trim().toUpperCase());
    }
  };

  const getRankColor = (rank) => {
    if (rank === 1) return '#00E676'; // Bright Green (Strong Buy)
    if (rank === 2) return '#10b981'; // Green (Buy)
    if (rank === 3) return '#f59e0b'; // Amber (Hold)
    if (rank === 4) return '#f97316'; // Orange (Sell)
    return '#ef4444'; // Red (Strong Sell)
  };

  const formatPercent = (val) => (val !== null && val !== undefined && !isNaN(val)) ? `${(val * 100).toFixed(1)}%` : 'N/A';
  const formatNumber = (val) => (val !== null && val !== undefined && !isNaN(val)) ? val.toFixed(2) : 'N/A';
  const formatLargeNum = (val) => {
    if (!val || isNaN(val)) return 'N/A';
    if (Math.abs(val) >= 1e12) return `$${(val / 1e12).toFixed(2)}T`;
    if (Math.abs(val) >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
    if (Math.abs(val) >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
    return `$${val.toLocaleString()}`;
  };

  const rankColor = getRankColor(data?.zacks_rank || 3);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem', paddingBottom: '3rem' }}>
      
      {/* ------------------------------------------------------------------ */}
      {/* 1. TOP HEADER & SEARCH COMMAND BAR                                 */}
      {/* ------------------------------------------------------------------ */}
      <div className="glass-card" style={{ 
        padding: '1.75rem 2rem', 
        background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.8) 100%)',
        borderRadius: '16px',
        border: '1px solid rgba(255,255,255,0.1)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
          <div>
            <h2 style={{ margin: 0, color: '#00F0FF', display: 'flex', alignItems: 'center', gap: '0.65rem', fontSize: '1.4rem', fontWeight: '800' }}>
              <BookOpen size={26} color="#00F0FF" /> Institutional Zacks Fundamental Model
            </h2>
            <p style={{ color: '#94a3b8', margin: '0.35rem 0 0 0', fontSize: '0.85rem' }}>
              4-Pillar Quantitative Revision Architecture · Agreement, Magnitude, Upside & Surprise Streak
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {['NVDA', 'AAPL', 'MSFT', 'MU', 'TSLA', 'PLTR'].map(quickTkr => (
              <button
                key={quickTkr}
                type="button"
                onClick={() => setTicker(quickTkr)}
                style={{
                  background: ticker === quickTkr ? 'rgba(0, 240, 255, 0.15)' : 'rgba(255,255,255,0.05)',
                  border: ticker === quickTkr ? '1px solid #00F0FF' : '1px solid rgba(255,255,255,0.1)',
                  color: ticker === quickTkr ? '#00F0FF' : '#cbd5e1',
                  borderRadius: '6px',
                  padding: '4px 10px',
                  fontSize: '0.8rem',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                ${quickTkr}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.85rem' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <input 
              type="text" 
              placeholder="Enter any stock symbol (e.g., NVDA, AAPL, AMZN, PLTR, TSLA)..." 
              value={searchInput} 
              onChange={(e) => setSearchInput(e.target.value)} 
              style={{ 
                width: '100%',
                padding: '0.85rem 1.25rem', 
                borderRadius: '10px', 
                border: '1px solid rgba(255,255,255,0.12)', 
                background: 'rgba(0,0,0,0.35)', 
                color: 'white', 
                fontSize: '1rem',
                fontWeight: '600'
              }} 
            />
          </div>
          <button 
            type="submit" 
            style={{ 
              padding: '0.85rem 2rem', 
              background: 'linear-gradient(135deg, #00F0FF 0%, #0077B6 100%)', 
              borderRadius: '10px', 
              border: 'none', 
              color: '#000', 
              cursor: 'pointer', 
              fontWeight: '800', 
              fontSize: '0.95rem',
              letterSpacing: '0.5px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <Search size={16} color="#000" /> Audit Fundamentals
          </button>
        </form>
      </div>

      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '5rem', background: 'rgba(15, 23, 42, 0.4)', borderRadius: '16px' }}>
          <Loader2 size={50} color="#00F0FF" style={{ marginBottom: '1.25rem', animation: 'spin 1s linear infinite' }} />
          <p style={{ color: '#00F0FF', fontWeight: '700', fontSize: '1.1rem' }}>Executing 4-Pillar Quantitative Model for ${ticker}...</p>
          <p style={{ color: '#64748b', fontSize: '0.85rem' }}>Auditing Wall Street EPS Revisions, Surprise Streaks & Balance Sheet Quality</p>
        </div>
      )}

      {error && !loading && (
        <div style={{ padding: '2rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', borderRadius: '12px', color: '#ef4444', textAlign: 'center' }}>
          <AlertTriangle size={32} style={{ margin: '0 auto 0.5rem auto' }} />
          <h3 style={{ margin: '0 0 0.5rem 0' }}>Notice for ${ticker}</h3>
          <p style={{ margin: 0 }}>{error}</p>
        </div>
      )}

      {data && !loading && !error && (
        <>
          {/* ------------------------------------------------------------------ */}
          {/* 2. EXECUTIVE HERO: ZACKS RANK & VGM STYLE SCORES                    */}
          {/* ------------------------------------------------------------------ */}
          <div className="glass-card" style={{ 
            padding: '2.25rem', 
            borderRadius: '16px',
            borderLeft: `8px solid ${rankColor}`,
            background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(20, 30, 48, 0.85) 100%)',
            boxShadow: '0 10px 40px rgba(0,0,0,0.4)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1.5rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem' }}>
                  <span style={{ color: '#00F0FF', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px', fontSize: '0.85rem' }}>
                    {data.sector || 'EQUITY'} · {data.industry || 'TECHNOLOGY'}
                  </span>
                  <span style={{ background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: '4px', color: '#94a3b8', fontSize: '0.75rem', fontWeight: '600' }}>
                    Market Cap: {formatLargeNum(data.market_cap)}
                  </span>
                </div>
                <h1 style={{ color: 'white', margin: 0, fontSize: '2.8rem', fontWeight: '900', display: 'flex', alignItems: 'baseline', gap: '0.85rem' }}>
                  ${ticker} 
                  <span style={{ color: '#00F0FF', fontSize: '1.8rem', fontWeight: '700' }}>${formatNumber(data.spot)}</span>
                  <span style={{ color: '#94a3b8', fontSize: '1.2rem', fontWeight: '400' }}>({data.company_name})</span>
                </h1>
              </div>
              
              <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
                
                {/* Big Zacks Rank Box */}
                <div style={{ 
                  background: 'rgba(0,0,0,0.4)', 
                  padding: '1.25rem 2rem', 
                  borderRadius: '14px', 
                  border: `2px solid ${rankColor}`, 
                  textAlign: 'center',
                  boxShadow: `0 0 25px ${rankColor}25`
                }}>
                  <p style={{ color: '#94a3b8', margin: '0 0 0.25rem 0', fontSize: '0.75rem', fontWeight: '800', letterSpacing: '1px' }}>ZACKS RANK</p>
                  <h2 style={{ color: rankColor, margin: 0, fontSize: '2.5rem', fontWeight: '900' }}>#{data.zacks_rank}</h2>
                  <span style={{ color: rankColor, fontSize: '0.85rem', fontWeight: '800', textTransform: 'uppercase' }}>
                    {data.zacks_rank_label}
                  </span>
                </div>

                {/* Style Scores Card */}
                {data.style_scores && (
                  <div style={{ 
                    background: 'rgba(0,0,0,0.3)', 
                    padding: '1.25rem 1.5rem', 
                    borderRadius: '14px', 
                    border: `1px solid rgba(255,255,255,0.1)`, 
                    display: 'flex', 
                    flexDirection: 'column', 
                    justifyContent: 'center' 
                  }}>
                    <p style={{ color: '#94a3b8', margin: '0 0 0.75rem 0', fontSize: '0.75rem', fontWeight: '800', textAlign: 'center', letterSpacing: '0.5px' }}>
                      STYLE SCORES (A–F)
                    </p>
                    <div style={{ display: 'flex', gap: '0.85rem', justifyContent: 'center', alignItems: 'center' }}>
                      <StyleBadge label="V" score={data.style_scores.value} description="Value Score based on Forward P/E, PEG, P/S, EV/EBITDA" />
                      <StyleBadge label="G" score={data.style_scores.growth} description="Growth Score based on YoY Revenue & Projected EPS Growth" />
                      <StyleBadge label="M" score={data.style_scores.momentum} description="Momentum Score based on 52W relative performance and MA alignment" />
                      <div style={{ width: '1px', height: '40px', background: 'rgba(255,255,255,0.15)', margin: '0 0.35rem' }}></div>
                      <StyleBadge label="VGM" score={data.style_scores.vgm} description="Composite Weighted Score (35% Value, 40% Growth, 25% Momentum)" />
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* AI Research Narrative */}
            <div style={{ 
              background: 'rgba(0,0,0,0.25)', 
              borderRadius: '10px', 
              padding: '1.25rem', 
              border: '1px solid rgba(255,255,255,0.06)' 
            }}>
              <p style={{ color: '#f1f5f9', fontSize: '1.05rem', lineHeight: '1.7', margin: 0 }}>
                {data.report}
              </p>
            </div>
          </div>

          {/* ------------------------------------------------------------------ */}
          {/* 3. FOUR-PILLAR QUANTITATIVE DEEP DIVE                               */}
          {/* ------------------------------------------------------------------ */}
          <div>
            <h3 style={{ color: '#00F0FF', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.15rem', fontWeight: '800' }}>
              <Layers size={20} color="#00F0FF" /> 4-Pillar Quantitative Breakdown
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
              
              {/* Pillar 1: Agreement */}
              <div className="glass-card" style={{ padding: '1.25rem', background: 'rgba(15, 23, 42, 0.7)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
                <span style={{ color: '#a78bfa', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase' }}>Pillar 1 · Agreement</span>
                <h4 style={{ color: '#fff', margin: '0.4rem 0 0.85rem 0', fontSize: '1.25rem', fontWeight: '800' }}>
                  {data.agreement_and_magnitude?.up_revisions_30d || 0} Up / {data.agreement_and_magnitude?.down_revisions_30d || 0} Down
                </h4>
                <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: 0, lineHeight: '1.5' }}>
                  Wall Street estimate revisions over the last 30 days. Higher upward consensus directly drives a #1 or #2 Rank.
                </p>
              </div>

              {/* Pillar 2: Magnitude */}
              <div className="glass-card" style={{ padding: '1.25rem', background: 'rgba(15, 23, 42, 0.7)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
                <span style={{ color: '#38bdf8', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase' }}>Pillar 2 · Magnitude</span>
                <h4 style={{ color: (data.agreement_and_magnitude?.avg_magnitude_pct || 0) >= 0 ? '#00E676' : '#ef4444', margin: '0.4rem 0 0.85rem 0', fontSize: '1.25rem', fontWeight: '800' }}>
                  {(data.agreement_and_magnitude?.avg_magnitude_pct || 0) >= 0 ? '+' : ''}{data.agreement_and_magnitude?.avg_magnitude_pct || 0}%
                </h4>
                <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: 0, lineHeight: '1.5' }}>
                  Average 90-day percentage revision magnitude across Current & Next Year EPS forecasts.
                </p>
              </div>

              {/* Pillar 3: Upside */}
              <div className="glass-card" style={{ padding: '1.25rem', background: 'rgba(15, 23, 42, 0.7)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
                <span style={{ color: '#fbbf24', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase' }}>Pillar 3 · Upside</span>
                <h4 style={{ color: (data.analyst_targets?.upside_pct || 0) >= 0 ? '#00E676' : '#ef4444', margin: '0.4rem 0 0.85rem 0', fontSize: '1.25rem', fontWeight: '800' }}>
                  {(data.analyst_targets?.upside_pct || 0) >= 0 ? '+' : ''}{data.analyst_targets?.upside_pct || 0}%
                </h4>
                <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: 0, lineHeight: '1.5' }}>
                  Consensus target mean (${data.analyst_targets?.targetMeanPrice || 'N/A'}) potential upside relative to spot price.
                </p>
              </div>

              {/* Pillar 4: Surprise */}
              <div className="glass-card" style={{ padding: '1.25rem', background: 'rgba(15, 23, 42, 0.7)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
                <span style={{ color: '#00E676', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase' }}>Pillar 4 · Surprise</span>
                <h4 style={{ color: data.earnings_surprises?.streak_direction === 'beat' ? '#00E676' : '#ef4444', margin: '0.4rem 0 0.85rem 0', fontSize: '1.25rem', fontWeight: '800' }}>
                  {data.earnings_surprises?.streak_count || 0}Q {data.earnings_surprises?.streak_direction?.toUpperCase() || 'STREAK'}
                </h4>
                <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: 0, lineHeight: '1.5' }}>
                  Consecutive quarterly beats vs consensus estimates with an average surprise of +{data.earnings_surprises?.avg_surprise_pct || 0}%.
                </p>
              </div>

            </div>
          </div>

          {/* ------------------------------------------------------------------ */}
          {/* 4. WALL STREET ESTIMATE REVISIONS BREAKDOWN (TABLE)                */}
          {/* ------------------------------------------------------------------ */}
          {data.agreement_and_magnitude?.magnitude_table && data.agreement_and_magnitude.magnitude_table.length > 0 && (
            <div className="glass-card" style={{ padding: '1.5rem', background: 'rgba(15, 23, 42, 0.85)', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <h3 style={{ color: '#60a5fa', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem', fontWeight: '800' }}>
                <BarChart3 size={20} color="#60a5fa" /> Wall Street Consensus EPS Revision Trajectory
              </h3>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.12)', color: '#94a3b8' }}>
                      <th style={{ padding: '10px 12px' }}>Period</th>
                      <th style={{ padding: '10px 12px' }}>Current EPS Est</th>
                      <th style={{ padding: '10px 12px' }}>30 Days Ago</th>
                      <th style={{ padding: '10px 12px' }}>90 Days Ago</th>
                      <th style={{ padding: '10px 12px' }}>30D Revision %</th>
                      <th style={{ padding: '10px 12px' }}>90D Revision %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.agreement_and_magnitude.magnitude_table.map((row, rIdx) => (
                      <tr key={rIdx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '12px', color: '#fff', fontWeight: '700' }}>{row.period}</td>
                        <td style={{ padding: '12px', color: '#00F0FF', fontWeight: '700' }}>${row.current ?? 'N/A'}</td>
                        <td style={{ padding: '12px', color: '#cbd5e1' }}>${row['30daysAgo'] ?? 'N/A'}</td>
                        <td style={{ padding: '12px', color: '#94a3b8' }}>${row['90daysAgo'] ?? 'N/A'}</td>
                        <td style={{ padding: '12px', color: row.pct_change_30d >= 0 ? '#00E676' : '#ef4444', fontWeight: '700' }}>
                          {row.pct_change_30d >= 0 ? '+' : ''}{row.pct_change_30d}%
                        </td>
                        <td style={{ padding: '12px', color: row.pct_change_90d >= 0 ? '#00E676' : '#ef4444', fontWeight: '700' }}>
                          {row.pct_change_90d >= 0 ? '+' : ''}{row.pct_change_90d}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ------------------------------------------------------------------ */}
          {/* 5. VALUATION & FINANCIAL QUALITY CARDS                             */}
          {/* ------------------------------------------------------------------ */}
          <div>
            <h3 style={{ color: '#00F0FF', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.15rem', fontWeight: '800' }}>
              <DollarSign size={20} color="#00F0FF" /> Core Valuation Multiples & Quality Indicators
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <MetricCard 
                title="Trailing P/E" 
                value={formatNumber(data.valuation_metrics?.trailingPE)} 
                subtext={`Fwd P/E: ${formatNumber(data.valuation_metrics?.forwardPE)}x`}
                icon={DollarSign} 
                color="#60a5fa" 
              />
              <MetricCard 
                title="PEG Ratio" 
                value={formatNumber(data.valuation_metrics?.pegRatio)} 
                subtext={data.valuation_metrics?.pegRatio < 1.5 ? "Attractive Growth Value" : "Premium Multiple"}
                icon={Activity} 
                color={data.valuation_metrics?.pegRatio < 1.5 ? '#00E676' : '#f59e0b'} 
              />
              <MetricCard 
                title="Price / Sales" 
                value={`${formatNumber(data.valuation_metrics?.priceToSales)}x`} 
                subtext={`P/B: ${formatNumber(data.valuation_metrics?.priceToBook)}x`}
                icon={DollarSign} 
                color="#c084fc" 
              />
              <MetricCard 
                title="Revenue Growth YoY" 
                value={formatPercent(data.valuation_metrics?.revenueGrowth)} 
                subtext={data.valuation_metrics?.revenueGrowth > 0.15 ? "High Acceleration" : "Moderate"}
                icon={TrendingUp} 
                color={data.valuation_metrics?.revenueGrowth > 0 ? '#00E676' : '#ef4444'} 
              />
              <MetricCard 
                title="Operating Margin" 
                value={formatPercent(data.valuation_metrics?.operatingMargins)} 
                subtext={`Net Margin: ${formatPercent(data.valuation_metrics?.profitMargins)}`}
                icon={ShieldCheck} 
                color="#34d399" 
              />
              <MetricCard 
                title="Return on Equity" 
                value={formatPercent(data.valuation_metrics?.returnOnEquity)} 
                subtext={data.valuation_metrics?.returnOnEquity > 0.20 ? "Elite Capital Efficiency" : "Standard"}
                icon={Award} 
                color="#fbc2eb" 
              />
            </div>
          </div>

          {/* ------------------------------------------------------------------ */}
          {/* 6. EARNINGS SURPRISE TRACKER (ESTIMATE VS ACTUAL)                  */}
          {/* ------------------------------------------------------------------ */}
          {data.earnings_dates && data.earnings_dates.length > 0 && (
            <div className="glass-card" style={{ padding: '1.75rem', background: 'rgba(15, 23, 42, 0.85)', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
                <h3 style={{ margin: 0, color: '#00E676', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem', fontWeight: '800' }}>
                  <Activity size={22} color="#00E676" /> Expected vs Actual EPS (Surprise Streak Tracker)
                </h3>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <span style={{ color: '#00E676', fontSize: '0.85rem', fontWeight: '700' }}>
                    ✔ {data.positive_surprises || 0} Positive Beats
                  </span>
                  <span style={{ color: '#ef4444', fontSize: '0.85rem', fontWeight: '700' }}>
                    ✖ {data.negative_surprises || 0} Misses
                  </span>
                </div>
              </div>

              <div style={{ height: '320px', width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={data.earnings_dates}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="date" stroke="#94a3b8" tick={{ fontSize: 12 }} />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', borderColor: '#334155', borderRadius: '8px', color: '#fff' }} />
                    <Legend wrapperStyle={{ paddingTop: '15px' }} />
                    <Bar dataKey="eps_estimate" fill="#64748b" radius={[4, 4, 0, 0]} name="EPS Estimate ($)" />
                    <Bar dataKey="eps_reported" fill="#00E676" radius={[4, 4, 0, 0]} name="Reported EPS ($)" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* ------------------------------------------------------------------ */}
          {/* 7. QUARTERLY HISTORICAL TRENDS (EPS & REVENUE)                     */}
          {/* ------------------------------------------------------------------ */}
          {data.history && data.history.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              
              <div className="glass-card" style={{ padding: '1.5rem', background: 'rgba(15, 23, 42, 0.85)', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.08)' }}>
                <h3 style={{ margin: '0 0 1rem 0', color: '#60a5fa', fontSize: '1.05rem', fontWeight: '800' }}>Quarterly EPS Trajectory ($)</h3>
                <div style={{ height: '280px', width: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={data.history}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="date" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                      <YAxis stroke="#94a3b8" />
                      <Tooltip contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', borderColor: '#334155', borderRadius: '8px' }} />
                      <Bar dataKey="eps" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Basic EPS ($)" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="glass-card" style={{ padding: '1.5rem', background: 'rgba(15, 23, 42, 0.85)', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.08)' }}>
                <h3 style={{ margin: '0 0 1rem 0', color: '#c084fc', fontSize: '1.05rem', fontWeight: '800' }}>Quarterly Revenue Trajectory ($B)</h3>
                <div style={{ height: '280px', width: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={data.history}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="date" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                      <YAxis stroke="#94a3b8" tickFormatter={(val) => `$${(val/1e9).toFixed(1)}B`} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', borderColor: '#334155', borderRadius: '8px' }} 
                        formatter={(val) => [`$${(val/1e9).toFixed(2)} Billion`, 'Revenue']}
                      />
                      <Area type="monotone" dataKey="revenue" fill="url(#colorRevZacks)" stroke="#c084fc" name="Total Revenue" />
                      <defs>
                        <linearGradient id="colorRevZacks" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#c084fc" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#c084fc" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>

            </div>
          )}

          {/* ------------------------------------------------------------------ */}
          {/* 8. FORWARD-LOOKING CONSENSUS ESTIMATES                              */}
          {/* ------------------------------------------------------------------ */}
          {data.forward_estimates && (data.forward_estimates.eps?.length > 0 || data.forward_estimates.revenue?.length > 0) && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              
              {data.forward_estimates.eps?.length > 0 && (
                <div className="glass-card" style={{ padding: '1.5rem', background: 'rgba(15, 23, 42, 0.85)', borderRadius: '14px', borderTop: '4px solid #00E676' }}>
                  <h3 style={{ margin: '0 0 1rem 0', color: '#00E676', fontSize: '1.05rem', fontWeight: '800' }}>
                    Forward Consensus EPS Targets
                  </h3>
                  <div style={{ height: '280px', width: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={data.forward_estimates.eps}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="period" stroke="#94a3b8" tick={{ fontSize: 12 }} />
                        <YAxis stroke="#94a3b8" />
                        <Tooltip contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', borderColor: '#334155', borderRadius: '8px' }} />
                        <Bar dataKey="estimate" fill="#00E676" radius={[4, 4, 0, 0]} name="Expected EPS ($)" />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {data.forward_estimates.revenue?.length > 0 && (
                <div className="glass-card" style={{ padding: '1.5rem', background: 'rgba(15, 23, 42, 0.85)', borderRadius: '14px', borderTop: '4px solid #f59e0b' }}>
                  <h3 style={{ margin: '0 0 1rem 0', color: '#f59e0b', fontSize: '1.05rem', fontWeight: '800' }}>
                    Forward Consensus Revenue Targets
                  </h3>
                  <div style={{ height: '280px', width: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={data.forward_estimates.revenue}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="period" stroke="#94a3b8" tick={{ fontSize: 12 }} />
                        <YAxis stroke="#94a3b8" tickFormatter={(val) => `$${(val/1e9).toFixed(1)}B`} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', borderColor: '#334155', borderRadius: '8px' }} 
                          formatter={(val) => [`$${(val/1e9).toFixed(2)} Billion`, 'Expected Revenue']}
                        />
                        <Area type="monotone" dataKey="estimate" fill="url(#colorRevEstZacks)" stroke="#f59e0b" name="Expected Revenue" />
                        <defs>
                          <linearGradient id="colorRevEstZacks" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4}/>
                            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

            </div>
          )}

        </>
      )}

    </div>
  );
};

export default ZacksFundamentalReport;
