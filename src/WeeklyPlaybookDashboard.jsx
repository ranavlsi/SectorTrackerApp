import React, { useState } from 'react';
import { 
  Compass, 
  TrendingUp, 
  TrendingDown, 
  ShieldAlert, 
  ShieldCheck, 
  AlertTriangle, 
  Activity, 
  Copy, 
  Check, 
  Target, 
  ArrowUpRight, 
  Flame, 
  Layers, 
  SlidersHorizontal,
  ExternalLink,
  Percent,
  Zap,
  ActivitySquare,
  RefreshCw
} from 'lucide-react';
import { StockPersonalityBadge } from './StockPersonalityBadge';

export const WeeklyPlaybookDashboard = ({ playbook, onTickerClick }) => {
  const [copied, setCopied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState('');
  const [filterSetup, setFilterSetup] = useState('ALL');

  if (!playbook) return null;

  const regime = playbook.regime_briefing || {
    score_value: 50.0,
    score_label: 'Neutral',
    regime_status: 'NEUTRAL',
    regime_color: '#f59e0b',
    recommended_exposure: 'Moderate Exposure (40% - 60% Invested)',
    exposure_percent: 50,
    mco_status: 'Neutral',
    mco_value: 0,
    breadth_above_50: 50,
    breadth_above_200: 50,
    actionable_takeaway: 'Trade selectively with strict risk management.',
    distribution_warning: false
  };

  const focusList = playbook.focus_list || playbook.top_3_picks || [];
  const sectorRotation = playbook.sector_rotation || { leading_sectors: [], lagging_sectors: [] };
  const characterWatch = playbook.character_change_watch || [];
  const stocksThatRan = playbook.stocks_that_ran || [];
  const aboutToFly = playbook.about_to_fly || [];

  // Filter Focus List
  const filteredFocus = focusList.filter(item => {
    if (filterSetup === 'ALL') return true;
    if (filterSetup === 'VCP') return item.setup_type?.includes('VCP');
    if (filterSetup === 'FLAG') return item.setup_type?.includes('Flag') || item.setup_type?.includes('Breakout');
    if (filterSetup === 'BASE') return item.setup_type?.includes('Base');
    if (filterSetup === 'PULLBACK') return item.setup_type?.includes('Pullback') || item.setup_type?.includes('Support');
    if (filterSetup === 'TIGHT') return item.personality?.personality_tier === 'TIGHT_AND_ORDERLY';
    return true;
  });

  // Copy tickers for TradingView watchlist
  const handleCopyTickers = () => {
    const tickers = focusList.map(item => item.ticker).join(', ');
    navigator.clipboard.writeText(tickers).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }).catch(err => {
      console.error('Failed to copy tickers:', err);
    });
  };

  // Trigger Playbook 2.0 Re-generation
  const handleRefreshPlaybook = async () => {
    try {
      setRefreshing(true);
      setRefreshMessage('Running Lakehouse TradeCouncil & Ross Haber Engine...');
      const res = await fetch('/api/run_weekly_playbook', { method: 'POST' });
      const data = await res.json();
      setRefreshMessage(data.message || 'Playbook generation started.');
      setTimeout(() => {
        setRefreshMessage('Refreshing playbook data...');
        window.location.reload();
      }, 4000);
    } catch (err) {
      console.error('Error refreshing playbook:', err);
      setRefreshing(false);
      setRefreshMessage('Error triggering playbook refresh.');
    }
  };

  return (
    <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* 1. Header Banner & Quick Actions */}
      <div className="glass-card" style={{ padding: '1.75rem 2rem', background: 'linear-gradient(135deg, rgba(15,23,42,0.85) 0%, rgba(30,41,59,0.75) 100%)', border: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Compass size={28} color="#38bdf8" />
              <h1 style={{ margin: 0, fontSize: '1.8rem', color: '#fff', fontWeight: '800', letterSpacing: '-0.5px' }}>
                Weekly Playbook 2.0
              </h1>
              <span style={{ 
                background: 'rgba(56, 189, 248, 0.15)', 
                color: '#38bdf8', 
                border: '1px solid rgba(56, 189, 248, 0.3)', 
                padding: '3px 10px', 
                borderRadius: '20px', 
                fontSize: '0.75rem', 
                fontWeight: 'bold', 
                letterSpacing: '1px', 
                textTransform: 'uppercase' 
              }}>
                Tactical Intelligence
              </span>
            </div>
            <p style={{ margin: '6px 0 0 0', color: '#94a3b8', fontSize: '0.95rem' }}>
              Week of {playbook.date} • Quantitative macro regime, institutional sector flow, and Ross Haber stock personality focus list
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <button
              onClick={handleRefreshPlaybook}
              disabled={refreshing}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'rgba(255,255,255,0.06)',
                color: '#e2e8f0',
                border: '1px solid rgba(255,255,255,0.15)',
                padding: '10px 16px',
                borderRadius: '8px',
                fontWeight: '600',
                fontSize: '0.9rem',
                cursor: refreshing ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s'
              }}
              title="Re-run quantitative TradeCouncil and Ross Haber engine"
            >
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
              {refreshing ? 'Calculating...' : 'Re-Calculate Playbook'}
            </button>

            <button
              onClick={handleCopyTickers}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: copied ? '#10b981' : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                color: '#fff',
                border: 'none',
                padding: '10px 18px',
                borderRadius: '8px',
                fontWeight: '600',
                fontSize: '0.9rem',
                cursor: 'pointer',
                boxShadow: copied ? '0 0 15px rgba(16, 185, 129, 0.4)' : '0 4px 12px rgba(37, 99, 235, 0.3)',
                transition: 'all 0.2s'
              }}
            >
              {copied ? <Check size={18} /> : <Copy size={18} />}
              {copied ? `Copied ${focusList.length} Tickers!` : 'Copy Focus Tickers (TradingView)'}
            </button>
          </div>
        </div>

        {refreshMessage && (
          <div style={{ marginTop: '12px', padding: '8px 12px', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '6px', fontSize: '0.85rem', color: '#38bdf8' }}>
            ℹ️ {refreshMessage}
          </div>
        )}
      </div>

      {/* 2. Macro Health & Exposure Regime Banner */}
      <div className="glass-card" style={{ 
        padding: '2rem', 
        borderLeft: `6px solid ${regime.regime_color}`,
        background: 'linear-gradient(135deg, rgba(15,23,42,0.9) 0%, rgba(30,41,59,0.8) 100%)',
        boxShadow: `0 8px 30px rgba(0,0,0,0.3)`
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.5rem', marginBottom: '1.5rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <span style={{ 
                background: `${regime.regime_color}20`, 
                color: regime.regime_color, 
                border: `1px solid ${regime.regime_color}40`,
                padding: '4px 12px', 
                borderRadius: '6px', 
                fontSize: '0.85rem', 
                fontWeight: 'bold', 
                letterSpacing: '1px', 
                textTransform: 'uppercase',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <Activity size={14} /> Market Regime: {regime.score_label}
              </span>
              {regime.distribution_warning && (
                <span style={{ 
                  background: 'rgba(239, 68, 68, 0.2)', 
                  color: '#f87171', 
                  border: '1px solid #ef4444', 
                  padding: '4px 10px', 
                  borderRadius: '6px', 
                  fontSize: '0.8rem', 
                  fontWeight: 'bold' 
                }}>
                  ⚠️ Elevated Distribution Risk
                </span>
              )}
            </div>
            <h2 style={{ margin: '4px 0 0 0', color: '#fff', fontSize: '1.6rem', fontWeight: '700' }}>
              Recommended Exposure: <span style={{ color: regime.regime_color }}>{regime.recommended_exposure}</span>
            </h2>
          </div>

          {/* Health Score Pill */}
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.85rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px' }}>Macro Health Score</div>
            <div style={{ fontSize: '2.5rem', fontWeight: '900', color: regime.regime_color, lineHeight: '1.1' }}>
              {regime.score_value} <span style={{ fontSize: '1.2rem', color: '#64748b' }}>/ 100</span>
            </div>
          </div>
        </div>

        {/* Exposure Progress Bar */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '6px', color: '#cbd5e1' }}>
            <span>Invested Allocation: <strong style={{ color: regime.regime_color }}>{regime.exposure_percent}%</strong></span>
            <span>Cash Reserve: <strong style={{ color: '#38bdf8' }}>{100 - regime.exposure_percent}%</strong></span>
          </div>
          <div style={{ width: '100%', height: '10px', background: 'rgba(255,255,255,0.1)', borderRadius: '6px', overflow: 'hidden', display: 'flex' }}>
            <div style={{ width: `${regime.exposure_percent}%`, background: regime.regime_color, transition: 'width 0.5s' }} />
            <div style={{ width: `${100 - regime.exposure_percent}%`, background: '#38bdf8', opacity: 0.7, transition: 'width 0.5s' }} />
          </div>
        </div>

        {/* Key Indicators Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.85rem 1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>McClellan Oscillator</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: regime.mco_value >= 0 ? '#10b981' : '#ef4444', marginTop: '2px' }}>
              {regime.mco_value}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Status: {regime.mco_status}</div>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.85rem 1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>Stocks &gt; 50-SMA</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: regime.breadth_above_50 >= 50 ? '#10b981' : '#f59e0b', marginTop: '2px' }}>
              {regime.breadth_above_50}%
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Intermediate Breadth</div>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.85rem 1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>Stocks &gt; 200-SMA</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: regime.breadth_above_200 >= 50 ? '#10b981' : '#ef4444', marginTop: '2px' }}>
              {regime.breadth_above_200}%
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Structural Health</div>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.85rem 1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>SPY 5-Day Return</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: playbook.market_summary?.spy_weekly_return?.startsWith('+') ? '#10b981' : '#ef4444', marginTop: '2px' }}>
              {playbook.market_summary?.spy_weekly_return || '0.00%'}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Macro Index Pace</div>
          </div>
        </div>

        {/* Actionable Directive Box */}
        <div style={{ 
          background: 'rgba(0,0,0,0.3)', 
          padding: '1rem 1.25rem', 
          borderRadius: '8px', 
          borderLeft: `4px solid ${regime.regime_color}`,
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px'
        }}>
          <Target size={20} color={regime.regime_color} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong style={{ color: '#fff', fontSize: '0.95rem', display: 'block', marginBottom: '2px' }}>
              Tactical Playbook Directive:
            </strong>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#cbd5e1', lineHeight: '1.5' }}>
              {regime.actionable_takeaway} {playbook.market_summary?.text}
            </p>
          </div>
        </div>
      </div>

      {/* 3. Sector Rotation & Money Flow Matrix */}
      <div>
        <h2 style={{ color: '#fff', fontSize: '1.35rem', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Layers size={22} color="#38bdf8" /> Institutional Sector Flow & Money Rotation
        </h2>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
          {/* Leading Sectors */}
          <div className="glass-card" style={{ padding: '1.5rem', borderLeft: '4px solid #10b981', background: 'rgba(15,23,42,0.7)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, color: '#10b981', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem' }}>
                <TrendingUp size={20} /> Leading Sectors (Accumulation)
              </h3>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8', background: 'rgba(16, 185, 129, 0.1)', padding: '2px 8px', borderRadius: '4px' }}>
                Weekly Inflows
              </span>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {sectorRotation.leading_sectors?.map(sec => (
                <div key={sec.ticker} style={{ background: 'rgba(255,255,255,0.03)', padding: '10px 14px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <div>
                      <strong style={{ color: '#fff', fontSize: '0.95rem' }}>{sec.ticker}</strong>
                      <span style={{ color: '#94a3b8', fontSize: '0.85rem', marginLeft: '6px' }}>({sec.name})</span>
                    </div>
                    <span style={{ color: '#10b981', fontWeight: 'bold', fontSize: '0.85rem' }}>
                      RS: {sec.rs_ratio}
                    </span>
                  </div>
                  {sec.note && (
                    <div style={{ fontSize: '0.74rem', color: '#6ee7b7', marginBottom: '6px' }}>
                      {sec.note}
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Top Leaders:</span>
                    {sec.top_stocks?.map(st => (
                      <span 
                        key={st}
                        onClick={() => onTickerClick && onTickerClick(st)}
                        style={{ 
                          cursor: 'pointer', 
                          background: 'rgba(16, 185, 129, 0.15)', 
                          color: '#6ee7b7', 
                          border: '1px solid rgba(16, 185, 129, 0.3)', 
                          padding: '1px 7px', 
                          borderRadius: '4px', 
                          fontSize: '0.78rem', 
                          fontWeight: '600',
                          transition: 'all 0.15s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(16, 185, 129, 0.3)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(16, 185, 129, 0.15)'}
                      >
                        {st}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Rotating Out / Weakening Sectors */}
          {sectorRotation.weakening_sectors && sectorRotation.weakening_sectors.length > 0 && (
            <div className="glass-card" style={{ padding: '1.5rem', borderLeft: '4px solid #f59e0b', background: 'rgba(15,23,42,0.7)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem' }}>
                  <AlertTriangle size={20} /> Rotating Out (Weakening)
                </h3>
                <span style={{ fontSize: '0.75rem', color: '#f59e0b', background: 'rgba(245, 158, 11, 0.1)', padding: '2px 8px', borderRadius: '4px' }}>
                  Momentum Decay
                </span>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {sectorRotation.weakening_sectors.map(sec => (
                  <div key={sec.ticker} style={{ background: 'rgba(255,255,255,0.03)', padding: '10px 14px', borderRadius: '6px', border: '1px solid rgba(245, 158, 11, 0.15)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <div>
                        <strong style={{ color: '#fff', fontSize: '0.95rem' }}>{sec.ticker}</strong>
                        <span style={{ color: '#94a3b8', fontSize: '0.85rem', marginLeft: '6px' }}>({sec.name})</span>
                      </div>
                      <span style={{ color: '#f59e0b', fontWeight: 'bold', fontSize: '0.85rem' }}>
                        RS: {sec.rs_ratio}
                      </span>
                    </div>
                    {sec.note && (
                      <div style={{ fontSize: '0.74rem', color: '#fcd34d', marginBottom: '6px' }}>
                        {sec.note}
                      </div>
                    )}
                    {sec.drag_stocks && sec.drag_stocks.length > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: sec.rs_stocks && sec.rs_stocks.length > 0 ? '6px' : '0' }}>
                        <span style={{ fontSize: '0.75rem', color: '#f87171' }}>Distribution Drag:</span>
                        {sec.drag_stocks.map(st => (
                          <span 
                            key={st}
                            onClick={() => onTickerClick && onTickerClick(st)}
                            style={{ 
                              cursor: 'pointer', 
                              background: 'rgba(239, 68, 68, 0.15)', 
                              color: '#fca5a5', 
                              border: '1px solid rgba(239, 68, 68, 0.3)', 
                              padding: '1px 7px', 
                              borderRadius: '4px', 
                              fontSize: '0.78rem', 
                              fontWeight: '600',
                              transition: 'all 0.15s'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.3)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)'}
                          >
                            {st}
                          </span>
                        ))}
                      </div>
                    )}

                    {sec.rs_stocks && sec.rs_stocks.length > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.75rem', color: '#34d399' }}>RS Islands (Bucking Trend):</span>
                        {sec.rs_stocks.map(st => (
                          <span 
                            key={st}
                            onClick={() => onTickerClick && onTickerClick(st)}
                            style={{ 
                              cursor: 'pointer', 
                              background: 'rgba(16, 185, 129, 0.15)', 
                              color: '#6ee7b7', 
                              border: '1px solid rgba(16, 185, 129, 0.3)', 
                              padding: '1px 7px', 
                              borderRadius: '4px', 
                              fontSize: '0.78rem', 
                              fontWeight: '600',
                              transition: 'all 0.15s'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(16, 185, 129, 0.3)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'rgba(16, 185, 129, 0.15)'}
                          >
                            {st}
                          </span>
                        ))}
                      </div>
                    )}

                    {(!sec.drag_stocks || sec.drag_stocks.length === 0) && (!sec.rs_stocks || sec.rs_stocks.length === 0) && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Holdings:</span>
                        {sec.top_stocks?.map(st => (
                          <span 
                            key={st}
                            onClick={() => onTickerClick && onTickerClick(st)}
                            style={{ 
                              cursor: 'pointer', 
                              background: 'rgba(245, 158, 11, 0.15)', 
                              color: '#fcd34d', 
                              border: '1px solid rgba(245, 158, 11, 0.3)', 
                              padding: '1px 7px', 
                              borderRadius: '4px', 
                              fontSize: '0.78rem', 
                              fontWeight: '600',
                              transition: 'all 0.15s'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(245, 158, 11, 0.3)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'rgba(245, 158, 11, 0.15)'}
                          >
                            {st}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Lagging Sectors */}
          <div className="glass-card" style={{ padding: '1.5rem', borderLeft: '4px solid #ef4444', background: 'rgba(15,23,42,0.7)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem' }}>
                <TrendingDown size={20} /> Lagging Sectors (Outflow)
              </h3>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8', background: 'rgba(239, 68, 68, 0.1)', padding: '2px 8px', borderRadius: '4px' }}>
                Underperforming SPY
              </span>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {sectorRotation.lagging_sectors?.map(sec => (
                <div key={sec.ticker} style={{ background: 'rgba(255,255,255,0.03)', padding: '10px 14px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <div>
                      <strong style={{ color: '#fff', fontSize: '0.95rem' }}>{sec.ticker}</strong>
                      <span style={{ color: '#94a3b8', fontSize: '0.85rem', marginLeft: '6px' }}>({sec.name})</span>
                    </div>
                    <span style={{ color: '#ef4444', fontWeight: 'bold', fontSize: '0.85rem' }}>
                      RS: {sec.rs_ratio}
                    </span>
                  </div>
                  {sec.note && (
                    <div style={{ fontSize: '0.74rem', color: '#fca5a5', marginBottom: '6px' }}>
                      {sec.note}
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Lagging Stocks:</span>
                    {sec.top_stocks?.map(st => (
                      <span 
                        key={st}
                        onClick={() => onTickerClick && onTickerClick(st)}
                        style={{ 
                          cursor: 'pointer', 
                          background: 'rgba(239, 68, 68, 0.15)', 
                          color: '#fca5a5', 
                          border: '1px solid rgba(239, 68, 68, 0.3)', 
                          padding: '1px 7px', 
                          borderRadius: '4px', 
                          fontSize: '0.78rem', 
                          fontWeight: '600',
                          transition: 'all 0.15s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.3)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)'}
                      >
                        {st}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 4. Curated Focus List: True Market Leaders */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
          <div>
            <h2 style={{ color: '#fff', fontSize: '1.4rem', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Flame size={24} color="#f59e0b" /> True Market Leaders Focus List ({filteredFocus.length})
            </h2>
            <p style={{ margin: '4px 0 0 0', color: '#94a3b8', fontSize: '0.88rem' }}>
              Pre-calculated trade execution setups enriched with Ross Haber Stock Personality, Guardian MAs, and risk-adjusted targets
            </p>
          </div>

          {/* Filter Pills */}
          <div style={{ display: 'flex', gap: '8px', background: 'rgba(15,23,42,0.6)', padding: '4px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
            {[
              { id: 'ALL', label: 'All Setups' },
              { id: 'BASE', label: 'Flat Base' },
              { id: 'FLAG', label: 'Flags & Breakouts' },
              { id: 'PULLBACK', label: 'Pullbacks' },
              { id: 'VCP', label: 'True VCP' },
              { id: 'TIGHT', label: 'Tight & Orderly' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setFilterSetup(tab.id)}
                style={{
                  background: filterSetup === tab.id ? '#38bdf8' : 'transparent',
                  color: filterSetup === tab.id ? '#0f172a' : '#94a3b8',
                  border: 'none',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Focus List Cards Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '1.5rem' }}>
          {filteredFocus.map((pick, i) => {
            const pTier = pick.personality?.personality_tier || 'TIGHT_AND_ORDERLY';
            const tierColor = pick.personality?.tier_color || '#10b981';
            
            return (
              <div 
                key={pick.ticker} 
                className="glass-card" 
                onClick={() => onTickerClick && onTickerClick(pick.ticker)}
                style={{ 
                  padding: '1.5rem', 
                  background: 'linear-gradient(135deg, rgba(15,23,42,0.85) 0%, rgba(30,41,59,0.7) 100%)', 
                  border: '1px solid rgba(255,255,255,0.08)',
                  cursor: 'pointer',
                  transition: 'transform 0.2s, border 0.2s, box-shadow 0.2s',
                  position: 'relative',
                  overflow: 'hidden'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-3px)';
                  e.currentTarget.style.border = `1px solid ${tierColor}80`;
                  e.currentTarget.style.boxShadow = `0 12px 28px rgba(0,0,0,0.4), 0 0 15px ${tierColor}20`;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.border = '1px solid rgba(255,255,255,0.08)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                {/* Top Row: Rank, Ticker, Setup Badge & Action Hint */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#64748b' }}>#{i+1}</span>
                      <h3 style={{ margin: 0, fontSize: '1.7rem', color: '#fff', fontWeight: '800', letterSpacing: '-0.5px' }}>
                        {pick.ticker}
                      </h3>
                      <ArrowUpRight size={18} color="#94a3b8" style={{ marginTop: '2px' }} />
                    </div>
                    <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ 
                        display: 'inline-block', 
                        padding: '2px 8px', 
                        background: 'rgba(56, 189, 248, 0.15)', 
                        color: '#38bdf8', 
                        borderRadius: '4px', 
                        fontSize: '0.8rem', 
                        fontWeight: '600' 
                      }}>
                        {pick.setup_type}
                      </span>
                    </div>
                  </div>

                  {/* Ross Haber Personality Badge */}
                  {pick.personality && (
                    <div style={{ textAlign: 'right' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        background: pick.personality.badge_color || 'rgba(16, 185, 129, 0.15)',
                        color: tierColor,
                        border: `1px solid ${tierColor}40`,
                        padding: '3px 9px',
                        borderRadius: '12px',
                        fontSize: '0.78rem',
                        fontWeight: 'bold'
                      }}>
                        {pTier === 'TIGHT_AND_ORDERLY' && <ShieldCheck size={13} />}
                        {pTier === 'WIDE_AND_LOOSE' && <AlertTriangle size={13} />}
                        {pTier === 'IN_BETWEEN' && <Activity size={13} />}
                        {pick.personality.tier_label}
                      </span>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>
                        10D ADR: <strong style={{ color: tierColor }}>{pick.personality.adr_10d}%</strong>
                      </div>
                    </div>
                  )}
                </div>

                {/* Tactical Sizing & Guardian MA bar */}
                {pick.personality && (
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    background: 'rgba(255,255,255,0.03)', 
                    padding: '6px 10px', 
                    borderRadius: '6px', 
                    fontSize: '0.8rem', 
                    marginBottom: '1rem',
                    border: '1px solid rgba(255,255,255,0.04)'
                  }}>
                    <span style={{ color: '#cbd5e1' }}>
                      Sizing: <strong style={{ color: tierColor }}>{pick.personality.sizing_recommendation?.split('(')[0] || 'Core Leader'}</strong>
                    </span>
                    <span style={{ color: '#94a3b8' }}>
                      Guardian MA: <strong style={{ color: '#60a5fa' }}>{pick.personality.guardian_ma}</strong> ({pick.personality.guardian_respect_score}% win)
                    </span>
                  </div>
                )}

                {/* Execution Plan Grid */}
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(3, 1fr)', 
                  gap: '8px', 
                  background: 'rgba(0,0,0,0.3)', 
                  padding: '12px', 
                  borderRadius: '8px',
                  marginBottom: '1rem',
                  border: '1px solid rgba(255,255,255,0.05)'
                }}>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase' }}>Entry Pivot</div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 'bold', color: '#38bdf8', marginTop: '2px' }}>
                      {pick.entry_price}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Max 5% chase</div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase' }}>Stop Loss</div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 'bold', color: '#ef4444', marginTop: '2px' }}>
                      {pick.stop_loss}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#f87171' }}>Risk: {pick.risk_pct}</div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase' }}>Target</div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 'bold', color: '#10b981', marginTop: '2px' }}>
                      {pick.profit_target}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#34d399' }}>R:R {pick.reward_risk}</div>
                  </div>
                </div>

                {/* Strategic Reasoning */}
                <div style={{ marginBottom: '1rem' }}>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#cbd5e1', lineHeight: '1.5' }}>
                    <strong style={{ color: '#fff' }}>Plan:</strong> {pick.reasoning}
                  </p>
                </div>

                {/* Technical Health Strip */}
                {pick.health && (
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    background: 'rgba(0,0,0,0.2)', 
                    padding: '8px 12px', 
                    borderRadius: '6px',
                    borderLeft: `3px solid ${pick.health.momentum_color === 'bullish' ? '#10b981' : '#f59e0b'}`
                  }}>
                    <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                      Stage: <strong style={{ color: pick.health.stage?.includes('Stage 2') ? '#10b981' : '#e2e8f0' }}>{pick.health.stage}</strong>
                    </span>
                    <span style={{ fontSize: '0.8rem', color: pick.health.momentum_color === 'bullish' ? '#10b981' : '#f59e0b', fontWeight: 'bold' }}>
                      {pick.health.momentum_text}
                    </span>
                    <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                      RSI: <strong style={{ color: '#fff' }}>{pick.health.rsi}</strong>
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. Character Change & Sell Rule Watchlist */}
      {characterWatch.length > 0 && (
        <div className="glass-card" style={{ 
          padding: '1.75rem', 
          borderLeft: '5px solid #ef4444', 
          background: 'linear-gradient(135deg, rgba(30,10,15,0.7) 0%, rgba(15,23,42,0.85) 100%)',
          boxShadow: '0 4px 20px rgba(239, 68, 68, 0.15)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <ShieldAlert size={24} color="#ef4444" />
              <div>
                <h3 style={{ margin: 0, color: '#f87171', fontSize: '1.25rem', fontWeight: '700' }}>
                  Character Change & Distribution Watchlist ({characterWatch.length})
                </h3>
                <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
                  Ross Haber Sell Rule: 2 consecutive closes below 21-day SMA or Volatility Blowout. Avoid new buys; trim on strength.
                </span>
              </div>
            </div>
            <span style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5', border: '1px solid #ef4444', padding: '3px 10px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 'bold' }}>
              Capital Preservation Defense
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
            {characterWatch.map(item => (
              <div 
                key={item.ticker}
                onClick={() => onTickerClick && onTickerClick(item.ticker)}
                style={{ 
                  background: 'rgba(15, 23, 42, 0.6)', 
                  padding: '12px 16px', 
                  borderRadius: '8px', 
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(15, 23, 42, 0.6)'}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <strong style={{ color: '#fff', fontSize: '1.1rem' }}>{item.ticker}</strong>
                    <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{item.price}</span>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: '#fca5a5', background: 'rgba(239, 68, 68, 0.25)', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                    {item.status}
                  </span>
                </div>
                <p style={{ margin: '0 0 6px 0', fontSize: '0.82rem', color: '#fca5a5', lineHeight: '1.4' }}>
                  {item.signal}
                </p>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#94a3b8', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '6px' }}>
                  <span>Breached: <strong style={{ color: '#f87171' }}>{item.guardian_ma}</strong></span>
                  <span>Action: <strong style={{ color: '#fbbf24' }}>{item.action}</strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. Stocks That Ran & Volatility Squeeze Watchlists */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '1rem' }}>
        {/* Stocks That Ran */}
        <div className="glass-card" style={{ padding: '1.5rem', borderLeft: '4px solid #10b981', background: 'rgba(15,23,42,0.7)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, color: '#10b981', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem' }}>
              <TrendingUp size={18} /> Stocks That Ran (Top 5-Day Momentum)
            </h3>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Do Not Chase</span>
          </div>
          {stocksThatRan.map(s => (
            <div 
              key={s.ticker} 
              onClick={() => onTickerClick && onTickerClick(s.ticker)}
              style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                borderBottom: '1px solid rgba(255,255,255,0.06)', 
                padding: '0.65rem 0',
                cursor: 'pointer',
                transition: 'background 0.15s'
              }}
              onMouseEnter={e => e.currentTarget.style.paddingLeft = '6px'}
              onMouseLeave={e => e.currentTarget.style.paddingLeft = '0'}
            >
              <div>
                <strong style={{ color: '#fff', fontSize: '0.95rem' }}>{s.ticker}</strong>
                <span style={{ color: '#94a3b8', fontSize: '0.8rem', marginLeft: '8px' }}>{s.price}</span>
              </div>
              <span style={{ color: '#10b981', fontWeight: 'bold', fontSize: '0.9rem' }}>{s.return}</span>
            </div>
          ))}
        </div>

        {/* About to Fly (Squeeze) */}
        <div className="glass-card" style={{ padding: '1.5rem', borderLeft: '4px solid #f59e0b', background: 'rgba(15,23,42,0.7)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem' }}>
              <ActivitySquare size={18} /> About to Fly (TTM Squeeze Near 52W High)
            </h3>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Coiling Energy</span>
          </div>
          {aboutToFly.map(s => (
            <div 
              key={s.ticker} 
              onClick={() => onTickerClick && onTickerClick(s.ticker)}
              style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                borderBottom: '1px solid rgba(255,255,255,0.06)', 
                padding: '0.65rem 0',
                cursor: 'pointer',
                transition: 'background 0.15s'
              }}
              onMouseEnter={e => e.currentTarget.style.paddingLeft = '6px'}
              onMouseLeave={e => e.currentTarget.style.paddingLeft = '0'}
            >
              <div>
                <strong style={{ color: '#fff', fontSize: '0.95rem' }}>{s.ticker}</strong>
                <span style={{ color: '#94a3b8', fontSize: '0.8rem', marginLeft: '8px' }}>{s.price}</span>
              </div>
              <span style={{ color: '#f59e0b', fontWeight: 'bold', fontSize: '0.85rem' }}>
                {s.dist_ath} from ATH
              </span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};

export default WeeklyPlaybookDashboard;
