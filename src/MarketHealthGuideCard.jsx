import React, { useState } from 'react';
import { 
  Info, 
  ChevronDown, 
  ChevronUp, 
  CheckCircle2, 
  AlertCircle, 
  Zap, 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  ShieldAlert, 
  Gauge, 
  BookOpen 
} from 'lucide-react';

/**
 * Enhanced Market Health Indicator Card
 * Renders:
 * 1. Rich Header with Title, Subtitle, Live Value Chips & Guide Toggle
 * 2. Live Algorithmic Insight Banner (Lakehouse quantitative observation)
 * 3. Interactive Recharts Chart (children)
 * 4. Structured 3-Column Institutional Intelligence Panel:
 *    - Column 1: 📖 What It Measures (math & institutional theory)
 *    - Column 2: 🎯 Institutional Benchmarks (threshold levels & zones)
 *    - Column 3: ⚡ Tactical Trade Playbook (concrete execution rules)
 */
export function MarketHealthGuideCard({
  icon: Icon = Activity,
  title,
  subtitle,
  badges = [],
  algoInsight,
  biasLabel,
  biasColor = '#3b82f6',
  whatItMeasures,
  benchmarks = [],
  playbook = [],
  children,
  defaultExpanded = true,
  cardBorderColor
}) {
  const [isGuideOpen, setIsGuideOpen] = useState(defaultExpanded);

  return (
    <div 
      className="glass-card" 
      style={{ 
        padding: '1.5rem', 
        border: `1px solid ${cardBorderColor || 'rgba(255, 255, 255, 0.1)'}`,
        borderRadius: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
      }}
    >
      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ 
            width: '40px', 
            height: '40px', 
            borderRadius: '10px', 
            background: `${biasColor}20`, 
            border: `1px solid ${biasColor}50`,
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            color: biasColor,
            flexShrink: 0
          }}>
            <Icon size={22} />
          </div>
          <div>
            <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '1.2rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {title}
            </h3>
            {subtitle && (
              <p style={{ margin: '2px 0 0 0', color: '#94a3b8', fontSize: '0.82rem' }}>
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Live Badges & Guide Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {badges.map((b, idx) => (
            <span 
              key={idx}
              style={{
                padding: '4px 10px',
                borderRadius: '8px',
                fontSize: '0.8rem',
                fontWeight: 600,
                background: b.bg || 'rgba(255,255,255,0.06)',
                color: b.color || '#e2e8f0',
                border: `1px solid ${b.border || 'rgba(255,255,255,0.12)'}`,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              {b.label && <span style={{ color: '#94a3b8', fontWeight: 400 }}>{b.label}:</span>}
              <span>{b.value}</span>
            </span>
          ))}

          {biasLabel && (
            <span style={{
              padding: '4px 10px',
              borderRadius: '8px',
              fontSize: '0.8rem',
              fontWeight: 700,
              background: `${biasColor}20`,
              color: biasColor,
              border: `1px solid ${biasColor}60`,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px'
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: biasColor }}></span>
              {biasLabel}
            </span>
          )}

          {/* Toggle Button */}
          <button
            onClick={() => setIsGuideOpen(!isGuideOpen)}
            style={{
              padding: '4px 10px',
              borderRadius: '8px',
              fontSize: '0.78rem',
              fontWeight: 500,
              background: isGuideOpen ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.05)',
              color: isGuideOpen ? '#93c5fd' : '#cbd5e1',
              border: `1px solid ${isGuideOpen ? 'rgba(59, 130, 246, 0.4)' : 'rgba(255, 255, 255, 0.1)'}`,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'all 0.2s ease'
            }}
            title="Toggle Indicator Guide & Strategy Playbook"
          >
            <BookOpen size={14} />
            <span>{isGuideOpen ? 'Hide Guide' : 'Strategy Guide'}</span>
            {isGuideOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* Algo Insight Callout Banner */}
      {algoInsight && (
        <div style={{
          background: `${biasColor}12`,
          borderLeft: `4px solid ${biasColor}`,
          padding: '0.75rem 1rem',
          borderRadius: '6px',
          fontSize: '0.88rem',
          color: '#f8fafc',
          lineHeight: '1.5',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.6rem'
        }}>
          <Zap size={16} color={biasColor} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong style={{ color: biasColor, textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '1px', display: 'block', marginBottom: '2px' }}>
              Live Algorithmic Diagnosis
            </strong>
            <span>{algoInsight}</span>
          </div>
        </div>
      )}

      {/* Chart Section */}
      <div style={{ position: 'relative', width: '100%' }}>
        {children}
      </div>

      {/* Structured 3-Column Institutional Intelligence Panel */}
      {isGuideOpen && (
        <div style={{
          background: 'rgba(15, 23, 42, 0.65)',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          padding: '1.25rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '1.25rem',
          fontSize: '0.85rem',
          color: '#cbd5e1'
        }}>
          {/* Column 1: What It Measures */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#60a5fa', fontWeight: 600, fontSize: '0.9rem' }}>
              <Info size={16} />
              <span>What It Measures</span>
            </div>
            <p style={{ margin: 0, color: '#e2e8f0', lineHeight: '1.55', fontSize: '0.84rem' }}>
              {whatItMeasures}
            </p>
          </div>

          {/* Column 2: Institutional Benchmarks */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#f59e0b', fontWeight: 600, fontSize: '0.9rem' }}>
              <Gauge size={16} />
              <span>Institutional Benchmarks</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {benchmarks.map((bm, idx) => (
                <div 
                  key={idx} 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'baseline', 
                    gap: '6px', 
                    background: bm.bg || 'rgba(255,255,255,0.03)', 
                    padding: '4px 8px', 
                    borderRadius: '6px',
                    border: `1px solid ${bm.color ? `${bm.color}30` : 'rgba(255,255,255,0.06)'}`
                  }}
                >
                  <span style={{ 
                    fontWeight: 700, 
                    color: bm.color || '#94a3b8', 
                    fontSize: '0.78rem', 
                    whiteSpace: 'nowrap',
                    minWidth: '70px'
                  }}>
                    {bm.level}:
                  </span>
                  <span style={{ color: '#cbd5e1', fontSize: '0.8rem', lineHeight: '1.4' }}>
                    {bm.meaning}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Column 3: Tactical Trade Playbook */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#10b981', fontWeight: 600, fontSize: '0.9rem' }}>
              <Zap size={16} />
              <span>Tactical Trade Playbook</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {playbook.map((rule, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                  <CheckCircle2 size={13} color="#10b981" style={{ flexShrink: 0, marginTop: '3px' }} />
                  <span style={{ color: '#e2e8f0', fontSize: '0.82rem', lineHeight: '1.45' }}>
                    {rule}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * 9-Factor Executive Health Matrix Card
 * Provides an instant multi-dimensional scorecard overview across all 9 factors
 */
export function MarketHealthRadarMatrix({ healthData }) {
  if (!healthData || !healthData.current_health) return null;
  const curr = healthData.current_health;

  const factors = [
    {
      name: 'Composite Health',
      value: `${curr.score_value}/100`,
      status: curr.score_label || 'Active',
      color: curr.score_value >= 60 ? '#10b981' : curr.score_value <= 40 ? '#ef4444' : '#f59e0b',
      delta: curr.score_5d_delta ? `${curr.score_5d_delta > 0 ? '+' : ''}${curr.score_5d_delta} 5D` : null
    },
    {
      name: 'McClellan Oscillator',
      value: curr.mco_value,
      status: curr.mco_status,
      color: curr.mco_value > 300 ? '#f59e0b' : curr.mco_value > 0 ? '#10b981' : curr.mco_value < -300 ? '#ef4444' : '#64748b',
      delta: curr.ad_momentum
    },
    {
      name: 'Breadth (% > 50 SMA)',
      value: `${curr.pct_above_50_value}%`,
      status: curr.breadth_status,
      color: curr.pct_above_50_value > 60 ? '#10b981' : curr.pct_above_50_value < 50 ? '#ef4444' : '#f59e0b',
      delta: curr.macd_p50_val ? `MACD: ${curr.macd_p50_val > 0 ? '+' : ''}${curr.macd_p50_val}` : null
    },
    {
      name: 'New Highs vs Lows',
      value: `${curr.new_highs_count || 0}H / ${curr.new_lows_count || 0}L`,
      status: curr.nhnl_10d_ma > 0 ? 'Net Accumulation' : 'Net Distribution',
      color: curr.nhnl_10d_ma > 0 ? '#10b981' : '#ef4444',
      delta: `10D MA: ${curr.nhnl_10d_ma || 0}`
    },
    {
      name: 'Volatility Skew (VIX)',
      value: `${curr.vix_value || 16.0}`,
      status: curr.vix_structure || 'Contango',
      color: curr.vix_structure?.includes('Contango') ? '#10b981' : '#ef4444',
      delta: `VIX3M: ${curr.vix3m_value || 18.0}`
    },
    {
      name: 'Credit Spreads (HYG/IEF)',
      value: curr.hyg_ratio_val ? `${curr.hyg_ratio_val}` : '0.86',
      status: (curr.hyg_zscore_val || 0) > 0 ? 'Risk Appetite (Z>0)' : 'Credit Risk-Off (Z<0)',
      color: (curr.hyg_zscore_val || 0) > 0 ? '#10b981' : '#ef4444',
      delta: `Z-Score: ${curr.hyg_zscore_val ? `${curr.hyg_zscore_val > 0 ? '+' : ''}${curr.hyg_zscore_val}` : '0'}`
    },
    {
      name: 'Mega-Cap Divergence',
      value: `SPY/RSP ${curr.spy_rsp_ratio_val || '3.5'}`,
      status: 'Mega-Cap Dominance',
      color: '#8b5cf6',
      delta: `Tech (QQQ/SPY): ${curr.qqq_spy_ratio_val || '0.94'}`
    },
    {
      name: '13-Week T-Bill Yield',
      value: `${curr.irx_val || 3.9}%`,
      status: (curr.irx_val || 0) > 4.0 ? 'Elevated Hurdle' : 'Accommodative',
      color: '#38bdf8',
      delta: '^IRX Cash Rate'
    },
    {
      name: 'COT Commercials',
      value: curr.cot_net_val ? `${curr.cot_net_val.toLocaleString()}` : '-50,000',
      status: (curr.cot_net_val || 0) > 0 ? 'Smart Money Long' : 'Hedging Inventory',
      color: (curr.cot_net_val || 0) > 0 ? '#10b981' : '#f59e0b',
      delta: 'CME E-mini Net'
    }
  ];

  return (
    <div style={{ marginBottom: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0, color: '#f1f5f9', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Gauge size={18} color="#3b82f6" /> 9-Factor Market Internals Matrix
        </h3>
        <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Live Multi-Dimensional Radar</span>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '0.85rem'
      }}>
        {factors.map((f, idx) => (
          <div 
            key={idx}
            className="glass-card"
            style={{
              padding: '1rem',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderTop: `3px solid ${f.color}`,
              background: 'rgba(15, 23, 42, 0.5)'
            }}
          >
            <div style={{ color: '#94a3b8', fontSize: '0.78rem', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {f.name}
            </div>
            <div style={{ color: '#f8fafc', fontSize: '1.25rem', fontWeight: 700, margin: '2px 0' }}>
              {f.value}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', fontSize: '0.75rem' }}>
              <span style={{ 
                color: f.color, 
                fontWeight: 600,
                background: `${f.color}15`,
                padding: '2px 6px',
                borderRadius: '4px',
                border: `1px solid ${f.color}30`
              }}>
                {f.status}
              </span>
              {f.delta && <span style={{ color: '#64748b' }}>{f.delta}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Regime Rules of Engagement Playbook
 * Explains cash deployment, sizing, and setups for Risk-On / Cautious / Risk-Off
 */
export function RegimePlaybookCard({ currentRegime = 'RISK_OFF' }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const regimes = [
    {
      id: 'RISK_ON',
      name: 'Risk-On (Score ≥ 60)',
      color: '#10b981',
      cashTarget: '0% - 20% Cash (80-100% Invested)',
      positionSize: 'Full Size (100% Sizing)',
      setups: 'Breakouts, VCP Coils, High-RS Leaders, Episodic Pivots',
      stops: 'Normal Stops (5-8% ATR), Trail along 10/21 EMA',
      isCurrent: currentRegime === 'RISK_ON'
    },
    {
      id: 'CAUTIOUS',
      name: 'Cautious (Score 40 - 59)',
      color: '#f59e0b',
      cashTarget: '40% - 60% Cash (Selective)',
      positionSize: 'Half Size (50% Sizing)',
      setups: 'First Pullbacks to 21-EMA, Deep VCP Tightness, Quick Swings',
      stops: 'Tight Stops (3-5%), Take 1/3 to 1/2 off into strength',
      isCurrent: currentRegime === 'CAUTIOUS'
    },
    {
      id: 'RISK_OFF',
      name: 'Risk-Off (Score < 40)',
      color: '#ef4444',
      cashTarget: '70% - 100% Cash (Preservation)',
      positionSize: 'Quarter Size (25%) or Zero',
      setups: 'Capitulation Oversold Reversals (MCO < -350 hook), Short Weakness',
      stops: 'Breakeven Stops Immediately; No Overnights on Speculative Names',
      isCurrent: currentRegime === 'RISK_OFF'
    }
  ];

  return (
    <div 
      className="glass-card" 
      style={{ 
        padding: '1.25rem 1.5rem', 
        marginBottom: '2rem', 
        borderRadius: '12px',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        background: 'rgba(15, 23, 42, 0.6)'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.8rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <ShieldAlert size={20} color="#60a5fa" />
          <h4 style={{ margin: 0, color: '#f8fafc', fontSize: '1rem', fontWeight: 600 }}>
            Regime Rules of Engagement & Capital Allocation Playbook
          </h4>
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: '#93c5fd',
            padding: '4px 12px',
            borderRadius: '6px',
            fontSize: '0.8rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
        >
          {isExpanded ? 'Collapse Playbook' : 'View Full Playbook Matrix'}
          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {isExpanded && (
        <div style={{ 
          marginTop: '1.25rem', 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
          gap: '1rem',
          fontSize: '0.85rem'
        }}>
          {regimes.map((r) => (
            <div 
              key={r.id}
              style={{
                background: r.isCurrent ? `${r.color}10` : 'rgba(255, 255, 255, 0.03)',
                border: `1.5px solid ${r.isCurrent ? r.color : 'rgba(255, 255, 255, 0.06)'}`,
                borderRadius: '10px',
                padding: '1rem',
                position: 'relative'
              }}
            >
              {r.isCurrent && (
                <span style={{
                  position: 'absolute',
                  top: '-10px',
                  right: '12px',
                  background: r.color,
                  color: '#000',
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: '10px',
                  letterSpacing: '0.5px'
                }}>
                  CURRENT REGIME
                </span>
              )}

              <h4 style={{ margin: '0 0 0.75rem 0', color: r.color, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: r.color }}></span>
                {r.name}
              </h4>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', color: '#cbd5e1' }}>
                <div>
                  <span style={{ color: '#94a3b8', fontSize: '0.78rem', display: 'block' }}>Cash vs Capital Deployment:</span>
                  <strong style={{ color: '#f1f5f9' }}>{r.cashTarget}</strong>
                </div>
                <div>
                  <span style={{ color: '#94a3b8', fontSize: '0.78rem', display: 'block' }}>Position Sizing:</span>
                  <strong style={{ color: '#f1f5f9' }}>{r.positionSize}</strong>
                </div>
                <div>
                  <span style={{ color: '#94a3b8', fontSize: '0.78rem', display: 'block' }}>Focus Setups:</span>
                  <span style={{ color: '#e2e8f0', fontSize: '0.8rem' }}>{r.setups}</span>
                </div>
                <div>
                  <span style={{ color: '#94a3b8', fontSize: '0.78rem', display: 'block' }}>Stop & Trade Management:</span>
                  <span style={{ color: '#e2e8f0', fontSize: '0.8rem' }}>{r.stops}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
