import React from 'react';
import { ShieldCheck, ShieldAlert, AlertTriangle, Activity } from 'lucide-react';

export const StockPersonalityBadge = ({ personality, compact = false }) => {
  if (!personality || !personality.tier_label) return null;

  const isTight = personality.personality_tier === 'TIGHT_AND_ORDERLY' || (personality.adr_metrics?.adr_10d <= 3.5);
  const isLoose = personality.personality_tier === 'WIDE_AND_LOOSE' || (personality.adr_metrics?.adr_10d > 6.0);
  
  const tierColor = isTight ? '#10b981' : isLoose ? '#ef4444' : '#f59e0b';
  const bgColor = isTight ? 'rgba(16, 185, 129, 0.15)' : isLoose ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)';
  const borderColor = isTight ? '#10b981' : isLoose ? '#ef4444' : '#f59e0b';

  const adrText = personality.adr_metrics ? `${personality.adr_metrics.adr_10d}%` : '';

  if (compact) {
    return (
      <span 
        style={{ 
          display: 'inline-flex', 
          alignItems: 'center', 
          gap: '4px',
          background: bgColor, 
          color: tierColor, 
          border: `1px solid ${borderColor}`,
          padding: '2px 8px', 
          borderRadius: '12px', 
          fontSize: '0.78rem',
          fontWeight: '600'
        }}
        title={`Ross Haber Stock Personality: ${personality.tier_label} (${personality.sizing_recommendation})`}
      >
        {isTight && <ShieldCheck size={12} />}
        {isLoose && <AlertTriangle size={12} />}
        {!isTight && !isLoose && <Activity size={12} />}
        {personality.tier_label} {adrText && `(${adrText})`}
      </span>
    );
  }

  return (
    <div style={{
      background: 'rgba(15, 23, 42, 0.7)',
      border: `1px solid ${borderColor}`,
      borderRadius: '8px',
      padding: '0.75rem 1rem',
      marginTop: '0.75rem',
      boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {isTight && <ShieldCheck size={16} color="#10b981" />}
          {isLoose && <AlertTriangle size={16} color="#ef4444" />}
          {!isTight && !isLoose && <Activity size={16} color="#f59e0b" />}
          <strong style={{ color: tierColor, fontSize: '0.9rem' }}>
            {personality.tier_label}
          </strong>
        </div>
        <span style={{ fontSize: '0.8rem', color: '#94a3b8', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px' }}>
          ADR 10D: <strong style={{ color: '#fff' }}>{personality.adr_metrics?.adr_10d}%</strong> | 20D: <strong style={{ color: '#fff' }}>{personality.adr_metrics?.adr_20d}%</strong>
        </span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#cbd5e1', marginTop: '4px' }}>
        <span>Sizing: <strong style={{ color: tierColor }}>{personality.sizing_recommendation?.split('(')[0] || personality.tier_label}</strong></span>
        {personality.guardian_ma && (
          <span>Guardian MA: <strong style={{ color: '#60a5fa' }}>{personality.guardian_ma}</strong> ({personality.guardian_respect_score}%)</span>
        )}
      </div>

      {personality.character_change && personality.character_change.character_change_detected && (
        <div style={{ 
          marginTop: '0.5rem', 
          padding: '0.4rem 0.6rem', 
          background: 'rgba(239, 68, 68, 0.2)', 
          borderLeft: '3px solid #ef4444', 
          borderRadius: '4px',
          color: '#fca5a5',
          fontSize: '0.78rem',
          lineHeight: '1.4'
        }}>
          {personality.character_change.signal}
        </div>
      )}
    </div>
  );
};

export const RossHaberPersonalityPanel = ({ personality }) => {
  if (!personality || !personality.tier_label) return null;

  const isTight = personality.personality_tier === 'TIGHT_AND_ORDERLY';
  const isLoose = personality.personality_tier === 'WIDE_AND_LOOSE';
  const tierColor = isTight ? '#10b981' : isLoose ? '#ef4444' : '#f59e0b';
  const borderHighlight = `4px solid ${tierColor}`;

  return (
    <div className="neo-panel" style={{ marginBottom: '1.5rem', borderLeft: borderHighlight, background: 'rgba(15, 23, 42, 0.6)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #1e293b', paddingBottom: '0.5rem' }}>
        <h3 style={{ margin: 0, color: tierColor, display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem' }}>
          <ShieldCheck size={20} /> Ross Haber Stock Personality
        </h3>
        <span style={{ 
          background: personality.badge_color || 'rgba(255,255,255,0.05)', 
          color: tierColor, 
          padding: '4px 10px', 
          borderRadius: '16px', 
          fontSize: '0.8rem',
          fontWeight: 'bold',
          border: `1px solid ${tierColor}`
        }}>
          {personality.tier_label}
        </span>
      </div>

      {/* ADR Stat Chips */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1rem' }}>
        <div style={{ background: 'rgba(255,255,255,0.04)', padding: '0.75rem', borderRadius: '8px', textAlign: 'center' }}>
          <span style={{ color: '#94a3b8', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px' }}>10-Day ADR</span>
          <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: tierColor, marginTop: '2px' }}>
            {personality.adr_metrics?.adr_10d}%
          </div>
          <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Short-Term Pulse</span>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.04)', padding: '0.75rem', borderRadius: '8px', textAlign: 'center' }}>
          <span style={{ color: '#94a3b8', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px' }}>20-Day ADR</span>
          <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#e2e8f0', marginTop: '2px' }}>
            {personality.adr_metrics?.adr_20d}%
          </div>
          <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Position Baseline</span>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.04)', padding: '0.75rem', borderRadius: '8px', textAlign: 'center' }}>
          <span style={{ color: '#94a3b8', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px' }}>50-Day ADR</span>
          <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#94a3b8', marginTop: '2px' }}>
            {personality.adr_metrics?.adr_50d}%
          </div>
          <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Macro Baseline</span>
        </div>
      </div>

      {/* Position Sizing & Playbook */}
      <div style={{ background: 'rgba(0,0,0,0.25)', padding: '0.85rem 1rem', borderRadius: '8px', marginBottom: '1rem', borderLeft: `3px solid ${tierColor}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Tactical Allocation Rule:</span>
          <strong style={{ color: tierColor, fontSize: '0.9rem' }}>{personality.sizing_recommendation}</strong>
        </div>
        <p style={{ margin: 0, fontSize: '0.82rem', color: '#cbd5e1', lineHeight: '1.4' }}>
          {personality.playbook}
        </p>
      </div>

      {/* Guardian MA Respect Section */}
      <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.85rem 1rem', borderRadius: '8px', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Guardian Moving Average (Institutional Defense):</span>
          <span style={{ color: '#60a5fa', fontWeight: 'bold', fontSize: '0.95rem' }}>
            🛡️ {personality.guardian_ma} ({personality.guardian_respect_score}% fidelity)
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
          {personality.ma_matrix && Object.entries(personality.ma_matrix).map(([ma, score]) => (
            <div key={ma} style={{ flex: 1, background: ma === personality.guardian_ma ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255,255,255,0.02)', padding: '6px', borderRadius: '4px', textAlign: 'center', border: ma === personality.guardian_ma ? '1px solid #3b82f6' : '1px solid transparent' }}>
              <div style={{ fontSize: '0.75rem', color: ma === personality.guardian_ma ? '#93c5fd' : '#64748b' }}>{ma}</div>
              <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: ma === personality.guardian_ma ? '#fff' : '#94a3b8' }}>{score}%</div>
            </div>
          ))}
        </div>
      </div>

      {/* Character Change & 21-SMA Sell Rule Monitor */}
      <div style={{ 
        padding: '0.85rem 1rem', 
        borderRadius: '8px', 
        background: personality.character_change?.character_change_detected ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.08)',
        border: personality.character_change?.character_change_detected ? '1px solid #ef4444' : '1px solid rgba(16, 185, 129, 0.2)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: '600', color: personality.character_change?.character_change_detected ? '#fca5a5' : '#6ee7b7' }}>
            {personality.character_change?.character_change_detected ? '🚨 Character Change Signal' : '✅ Trend Integrity Check'}
          </span>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
            Status: {personality.character_change?.status || 'NORMAL'}
          </span>
        </div>
        <p style={{ margin: 0, fontSize: '0.82rem', color: '#e2e8f0', lineHeight: '1.4' }}>
          {personality.character_change?.signal || 'Stock behaving orderly above key support averages.'}
        </p>
      </div>
    </div>
  );
};

export default StockPersonalityBadge;
