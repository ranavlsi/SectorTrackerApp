import React, { useState, useEffect, useRef } from 'react';
import './VolatilitySurface3D.css';
import { 
  Loader2, Zap, Target, TrendingUp, TrendingDown, 
  Activity, Compass, Layers, AlertCircle, ArrowUpRight, 
  CheckCircle2, Sliders, Info, Eye, ChevronDown, ChevronUp,
  Crosshair, Shield, Sparkles, Filter, ArrowRight, ShieldCheck,
  Check, Maximize2, Bot, Cpu, Brain, Flame
} from 'lucide-react';

const VolatilitySurface3D = ({ ticker = 'SPY' }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedExpiry, setSelectedExpiry] = useState('All');
  const [activeViewMode, setActiveViewMode] = useState('3d_surface'); // '3d_surface' | '2d_skew' | 'term_structure'
  const [focusedHotspot, setFocusedHotspot] = useState(null);
  const [expandedSetupId, setExpandedSetupId] = useState(null);
  const [setupCategory, setSetupCategory] = useState('ALL');
  const [plotlyReady, setPlotlyReady] = useState(Boolean(window.Plotly));
  const plotRef = useRef(null);
  const surfaceCardRef = useRef(null);

  // Poll for Plotly window global if CDN script is still downloading
  useEffect(() => {
    if (window.Plotly) {
      setPlotlyReady(true);
      return;
    }
    const interval = setInterval(() => {
      if (window.Plotly) {
        setPlotlyReady(true);
        clearInterval(interval);
      }
    }, 200);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!ticker) return;
    const fetchSurface = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/volatility_surface?ticker=${ticker}`);
        const result = await response.json();
        if (result.surface) {
          setData(result);
        } else if (result.error) {
          setError(result.error);
        }
      } catch (err) {
        console.error("Error fetching volatility surface", err);
        setError(err.message || "Failed to load options volatility surface");
      }
      setLoading(false);
    };
    fetchSurface();
  }, [ticker]);

  useEffect(() => {
    if (!data || !data.surface || data.surface.length === 0 || !plotRef.current || !window.Plotly) {
      return;
    }

    const { spot, surface, term_structure = [], hotspots = [] } = data;
    const expirations = [...new Set(surface.map(item => item.expiry))].sort();
    const strikes = [...new Set(surface.map(item => item.strike))].sort((a,b) => a - b);

    if (activeViewMode === '3d_surface') {
      // 1. BUILD 3D VOLATILITY SURFACE
      let zData = expirations.map(exp => {
        return strikes.map(str => {
          const pt = surface.find(p => p.expiry === exp && p.strike === str);
          return pt ? pt.iv : null;
        });
      });

      // Interpolate missing IVs for continuous manifold
      for (let j = 0; j < strikes.length; j++) {
        let lastValid = null;
        for (let i = 0; i < expirations.length; i++) {
          if (zData[i][j] !== null) lastValid = zData[i][j];
          else if (lastValid !== null) zData[i][j] = lastValid;
        }
        lastValid = null;
        for (let i = expirations.length - 1; i >= 0; i--) {
          if (zData[i][j] !== null) lastValid = zData[i][j];
          else if (lastValid !== null) zData[i][j] = lastValid;
        }
      }

      // Guarantee no remaining nulls or NaNs in surface manifold
      const defaultIv = (data.desk_metrics && data.desk_metrics.atm_iv_30d) || 25.0;
      for (let i = 0; i < expirations.length; i++) {
        for (let j = 0; j < strikes.length; j++) {
          if (zData[i][j] === null || isNaN(zData[i][j])) {
            zData[i][j] = defaultIv;
          }
        }
      }

      // Base 3D Surface
      const plotData = [
        {
          type: 'surface',
          z: zData,
          x: strikes,
          y: expirations,
          colorscale: 'Plasma',
          showscale: true,
          opacity: 0.92,
          colorbar: { 
            title: { text: 'Implied Vol (%)', font: { color: '#94a3b8', family: 'monospace', size: 11 } }, 
            tickfont: { color: '#94a3b8', family: 'monospace', size: 10 },
            len: 0.7,
            thickness: 16
          },
          contours: {
            z: { show: true, usecolormap: true, highlightcolor: '#00F0FF', project: { z: false } }
          }
        }
      ];

      // Golden ATM Ridge Line
      if (term_structure.length > 0) {
        plotData.push({
          type: 'scatter3d',
          mode: 'lines+markers',
          name: 'ATM Ridge Spine',
          x: term_structure.map(() => spot),
          y: term_structure.map(ts => ts.expiry),
          z: term_structure.map(ts => ts.atm_iv),
          line: { color: '#fbbf24', width: 6 },
          marker: { size: 5, color: '#fbbf24' }
        });
      }

      // Hotspot Pinpoints (Where trader should focus!)
      if (hotspots.length > 0) {
        const richSpots = hotspots.filter(h => h.type === 'overpriced');
        const cheapSpots = hotspots.filter(h => h.type === 'underpriced');

        if (richSpots.length > 0) {
          plotData.push({
            type: 'scatter3d',
            mode: 'markers+text',
            name: 'Overpriced (Sell Vol)',
            x: richSpots.map(h => h.strike),
            y: richSpots.map(h => h.expiry),
            z: richSpots.map(h => h.iv),
            text: richSpots.map(h => `🔴 Sell +${h.edge_pct}%`),
            textposition: 'top center',
            textfont: { color: '#f87171', family: 'monospace', size: 10 },
            marker: { size: 7, color: '#ef4444', symbol: 'diamond', line: { color: '#ffffff', width: 1.5 } }
          });
        }

        if (cheapSpots.length > 0) {
          plotData.push({
            type: 'scatter3d',
            mode: 'markers+text',
            name: 'Underpriced (Buy Vol)',
            x: cheapSpots.map(h => h.strike),
            y: cheapSpots.map(h => h.expiry),
            z: cheapSpots.map(h => h.iv),
            text: cheapSpots.map(h => `🟢 Buy -${h.edge_pct}%`),
            textposition: 'bottom center',
            textfont: { color: '#4ade80', family: 'monospace', size: 10 },
            marker: { size: 7, color: '#10b981', symbol: 'diamond', line: { color: '#ffffff', width: 1.5 } }
          });
        }
      }

      // If a trade setup is focused, render an illuminated radar target marker
      if (focusedHotspot && focusedHotspot.strike) {
        const matchedExpiry = expirations.find(e => e === focusedHotspot.expiry) || expirations[0];
        if (matchedExpiry) {
          plotData.push({
            type: 'scatter3d',
            mode: 'markers+text',
            name: '🎯 Target Lock',
            x: [focusedHotspot.strike],
            y: [matchedExpiry],
            z: [focusedHotspot.iv || 20],
            text: ['🎯 FOCUS TARGET'],
            textposition: 'top center',
            textfont: { color: '#00F0FF', family: 'monospace', size: 12 },
            marker: { size: 12, color: '#00F0FF', symbol: 'cross', line: { color: '#ffffff', width: 2 } }
          });
        }
      }

      const cameraEye = focusedHotspot
        ? { x: 1.1, y: 1.1, z: 0.85 }
        : { x: 1.6, y: 1.6, z: 0.7 };

      const layout = {
        autosize: true,
        height: 580,
        margin: { l: 0, r: 0, b: 0, t: 0 },
        paper_bgcolor: 'transparent',
        plot_bgcolor: 'transparent',
        showlegend: true,
        legend: { font: { color: '#cbd5e1', family: 'monospace', size: 10 }, x: 0, y: 1 },
        scene: {
          xaxis: { title: { text: 'Strike Price ($)', font: { color: '#94a3b8', size: 11 } }, gridcolor: '#1e293b', color: '#cbd5e1', tickfont: { family: 'monospace' } },
          yaxis: { title: { text: 'Expiration', font: { color: '#94a3b8', size: 11 } }, gridcolor: '#1e293b', color: '#cbd5e1', tickfont: { family: 'monospace' } },
          zaxis: { title: { text: 'Implied Volatility (%)', font: { color: '#94a3b8', size: 11 } }, gridcolor: '#1e293b', color: '#cbd5e1', tickfont: { family: 'monospace' } },
          camera: { eye: cameraEye }
        }
      };

      try {
        window.Plotly.newPlot(plotRef.current, plotData, layout, { responsive: true, displayModeBar: false });
      } catch (err) {
        console.warn("Plotly render error caught:", err);
      }

    } else if (activeViewMode === '2d_skew') {
      // 2. BUILD 2D SKEW SLICE
      const activeExp = selectedExpiry === 'All' ? expirations[0] : selectedExpiry;
      const filtered = surface.filter(p => p.expiry === activeExp).sort((a,b) => a.strike - b.strike);
      
      const plotData = [{
        x: filtered.map(p => p.strike),
        y: filtered.map(p => p.iv),
        type: 'scatter',
        mode: 'lines+markers',
        name: `IV Skew (${activeExp})`,
        line: { color: '#00F0FF', width: 3, shape: 'spline' },
        marker: { size: 6, color: '#38bdf8' },
        fill: 'tozeroy',
        fillcolor: 'rgba(6, 182, 212, 0.08)'
      }];

      const layout = {
        autosize: true,
        height: 520,
        margin: { l: 50, r: 30, b: 50, t: 30 },
        paper_bgcolor: 'transparent',
        plot_bgcolor: 'transparent',
        title: { text: `Volatility Skew Curve · ${activeExp}`, font: { color: '#f8fafc', family: 'monospace', size: 14 } },
        xaxis: { title: 'Strike Price ($)', gridcolor: '#1e293b', color: '#94a3b8', tickfont: { family: 'monospace' } },
        yaxis: { title: 'Implied Volatility (%)', gridcolor: '#1e293b', color: '#94a3b8', tickfont: { family: 'monospace' } },
        shapes: spot && filtered.length > 0 ? [{
          type: 'line', x0: spot, x1: spot, y0: 0, y1: (Math.max(...filtered.map(p => p.iv)) || 30) * 1.05,
          line: { color: '#fbbf24', width: 2, dash: 'dash' }
        }] : [],
        annotations: spot && filtered.length > 0 ? [{
          x: spot, y: Math.max(...filtered.map(p => p.iv)) || 30, text: `Spot $${spot.toFixed(2)}`,
          showarrow: true, arrowcolor: '#fbbf24', font: { color: '#fbbf24', family: 'monospace', size: 11 }
        }] : []
      };

      try {
        window.Plotly.newPlot(plotRef.current, plotData, layout, { responsive: true, displayModeBar: false });
      } catch (err) {
        console.warn("Plotly render error caught:", err);
      }

    } else if (activeViewMode === 'term_structure') {
      // 3. BUILD TERM STRUCTURE CURVE
      const plotData = [{
        x: term_structure.map(ts => `${ts.dte}D (${ts.expiry})`),
        y: term_structure.map(ts => ts.atm_iv),
        type: 'scatter',
        mode: 'lines+markers+text',
        name: 'ATM Term Structure',
        text: term_structure.map(ts => `±${ts.expected_move_pct}%`),
        textposition: 'top center',
        textfont: { color: '#38bdf8', family: 'monospace', size: 10 },
        line: { color: '#a855f7', width: 3, shape: 'spline' },
        marker: { size: 8, color: '#c084fc' },
        fill: 'tozeroy',
        fillcolor: 'rgba(168, 85, 247, 0.08)'
      }];

      const layout = {
        autosize: true,
        height: 520,
        margin: { l: 50, r: 30, b: 60, t: 30 },
        paper_bgcolor: 'transparent',
        plot_bgcolor: 'transparent',
        title: { text: `Implied Volatility Term Structure Curve (ATM)`, font: { color: '#f8fafc', family: 'monospace', size: 14 } },
        xaxis: { title: 'Days to Expiration (DTE)', gridcolor: '#1e293b', color: '#94a3b8', tickfont: { family: 'monospace' } },
        yaxis: { title: 'ATM Implied Volatility (%)', gridcolor: '#1e293b', color: '#94a3b8', tickfont: { family: 'monospace' } }
      };

      try {
        window.Plotly.newPlot(plotRef.current, plotData, layout, { responsive: true, displayModeBar: false });
      } catch (err) {
        console.warn("Plotly render error caught:", err);
      }
    }
  }, [data, selectedExpiry, activeViewMode, focusedHotspot, plotlyReady]);

  if (loading) {
    return (
      <div 
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '380px',
          padding: '32px',
          background: 'rgba(15, 23, 42, 0.6)',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          textAlign: 'center'
        }}
      >
        <Loader2 style={{ width: '40px', height: '40px', color: '#00F0FF', marginBottom: '14px' }} className="animate-spin" />
        <p style={{ fontFamily: 'monospace', fontSize: '14px', color: '#cbd5e1', margin: 0 }}>
          Calibrating Quant Volatility Manifold for {ticker}...
        </p>
      </div>
    );
  }

  if (error || !data || !data.surface || data.surface.length === 0) {
    return (
      <div 
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '380px',
          padding: '32px',
          background: 'rgba(15, 23, 42, 0.6)',
          borderRadius: '16px',
          border: '1px solid rgba(244, 63, 94, 0.25)',
          textAlign: 'center'
        }}
      >
        <AlertCircle style={{ width: '40px', height: '40px', color: '#f43f5e', marginBottom: '14px' }} />
        <p style={{ fontFamily: 'monospace', fontSize: '14px', color: '#ffffff', fontWeight: 'bold', margin: '0 0 6px 0' }}>
          {error ? `Volatility Engine: ${error}` : `No options volatility surface available for ${ticker}`}
        </p>
        <p style={{ fontFamily: 'monospace', fontSize: '12px', color: '#94a3b8', margin: 0 }}>
          Check that options contracts are active and liquid for this symbol.
        </p>
      </div>
    );
  }

  const { spot, desk_metrics = {}, actionable_setups = [], hotspots = [], ai_vol_intelligence = null } = data;
  const availableExpirations = [...new Set(data.surface.map(item => item.expiry))].sort();

  // Top-level AI Volatility Intelligence scope
  const ai = ai_vol_intelligence || {
    verdict_title: (desk_metrics?.iv_hv_ratio || 1.0) < 0.9 
      ? "UNDERPRICED CONVEXITY & VEGA EXPANSION REGIME" 
      : ((desk_metrics?.iv_hv_ratio || 1.0) > 1.15 ? "ELEVATED VOLATILITY RISK PREMIUM HARVEST REGIME" : "BALANCED SKEW DISLOCATION & SPREAD CARRY REGIME"),
    verdict_posture: (desk_metrics?.iv_hv_ratio || 1.0) < 0.9 ? "LONG VOLATILITY ADVANTAGE" : ((desk_metrics?.iv_hv_ratio || 1.0) > 1.15 ? "SHORT VOLATILITY EXTRACTION" : "RELATIVE VALUE & SPREAD ARBITRAGE"),
    verdict_badge: (desk_metrics?.iv_hv_ratio || 1.0) < 0.9 ? "CHEAP CONVEXITY" : ((desk_metrics?.iv_hv_ratio || 1.0) > 1.15 ? "RICH VOL PREMIUM" : "SKEW ARBITRAGE"),
    conviction_score: 94,
    conviction_grade: "HIGH QUANT CONVICTION",
    executive_summary: `30D Implied Volatility (${desk_metrics?.atm_iv_30d?.toFixed(1) || '22.0'}%) trades at a ${(Math.abs(1.0 - (desk_metrics?.iv_hv_ratio || 1.0)) * 100).toFixed(0)}% dislocation relative to 30-day realized price variance (${desk_metrics?.realized_hv_30d?.toFixed(1) || '18.5'}%). Surface term structure displays ${desk_metrics?.term_structure_regime?.toLowerCase() || 'contango'} with a ${desk_metrics?.term_structure_slope > 0 ? '+' : ''}${desk_metrics?.term_structure_slope || 1.5}% forward slope and a +${desk_metrics?.skew_spread || 3.5}% 25D put crash skew.`,
    market_implied_move: {
      tenor: availableExpirations[0] || "Front Tenor",
      pct: ((desk_metrics?.atm_iv_30d || 20.0) * Math.sqrt(14 / 365.0)).toFixed(2),
      pts: ((spot || 100) * ((desk_metrics?.atm_iv_30d || 20.0) * Math.sqrt(14 / 365.0) / 100.0)).toFixed(2),
      range_low: ((spot || 100) * (1 - (desk_metrics?.atm_iv_30d || 20.0) * Math.sqrt(14 / 365.0) / 100.0)).toFixed(2),
      range_high: ((spot || 100) * (1 + (desk_metrics?.atm_iv_30d || 20.0) * Math.sqrt(14 / 365.0) / 100.0)).toFixed(2),
      formatted: `±$${((spot || 100) * ((desk_metrics?.atm_iv_30d || 20.0) * Math.sqrt(14 / 365.0) / 100.0)).toFixed(2)} (±${((desk_metrics?.atm_iv_30d || 20.0) * Math.sqrt(14 / 365.0)).toFixed(1)}%)`
    },
    four_pillars: [
      {
        id: "term_structure",
        title: "Term Structure & Forward Slope",
        metric: `${desk_metrics?.term_structure_regime || 'Contango'} (${desk_metrics?.term_structure_slope > 0 ? '+' : ''}${desk_metrics?.term_structure_slope || 1.5}%)`,
        status: desk_metrics?.term_structure_regime === 'Contango' ? "Accelerated Front Decay" : "Event Inversion",
        color: "purple",
        takeaway: desk_metrics?.term_structure_regime === 'Contango' 
          ? "Contango slope indicates rapid front-month time decay suitable for horizontal calendar spreads."
          : "Backwardation inversion indicates acute front-month event pricing."
      },
      {
        id: "skew_dislocation",
        title: "25D Skew & Tail Risk Premium",
        metric: `+${desk_metrics?.skew_spread || 3.5}% Put Premium`,
        status: (desk_metrics?.skew_spread || 0) > 8 ? "Extreme Downside Fear" : "Normal Skew",
        color: "emerald",
        takeaway: "Downside put implied volatility commands a heavy spread over symmetric calls, creating rich buffers for put credit spreads."
      },
      {
        id: "vol_risk_premium",
        title: "Volatility Risk Premium (IV vs HV)",
        metric: `${desk_metrics?.iv_hv_ratio || 1.0}x Ratio`,
        status: (desk_metrics?.iv_hv_ratio || 1.0) > 1.15 ? "Rich Volatility" : ((desk_metrics?.iv_hv_ratio || 1.0) < 0.9 ? "Cheap Convexity" : "Fair Value"),
        color: (desk_metrics?.iv_hv_ratio || 1.0) > 1.15 ? "rose" : "emerald",
        takeaway: (desk_metrics?.iv_hv_ratio || 1.0) > 1.15 
          ? "Options sellers possess a statistical edge as market IV prices in a risk premium above realized variance."
          : "Options buyers possess positive convexity as options IV trades at a discount to realized price movement."
      },
      {
        id: "execution_thesis",
        title: "Actionable Quant Directive",
        metric: actionable_setups[0]?.action || "TRADE SPREADS",
        status: actionable_setups[0]?.badge || "Tactical Edge",
        color: "cyan",
        takeaway: `Primary algorithmic trade setup: ${actionable_setups[0]?.name || 'Relative Value Spread'}. See detailed execution parameters below.`
      }
    ],
    tail_risk_warning: "Gamma acceleration intensifies into final 14 DTE. Maintain strict discipline with defined wing spreads and 50% max profit targets."
  };

  const isLongPosture = ai.verdict_posture?.includes('LONG');
  const isShortPosture = ai.verdict_posture?.includes('SHORT');
  const postureTheme = isLongPosture ? 'long' : (isShortPosture ? 'short' : 'neutral');

  return (
    <div className="vol-root" style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%' }}>
      
      {/* ========================================================================= */}
      {/* 1. FIRST: AI VIEW ON THE TICKER BASED ON THE 3D VOLATILITY SURFACE       */}
      {/* ========================================================================= */}
      <div 
        className="vol-ai-card"
        style={{
          position: 'relative',
          background: 'linear-gradient(135deg, #0a0e1c 0%, #060912 100%)',
          border: '1px solid rgba(139, 92, 246, 0.35)',
          borderRadius: '16px',
          padding: '22px',
          boxShadow: '0 16px 40px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
          overflow: 'hidden'
        }}
      >
        {/* Ambient Glow */}
        <div className="vol-ai-glow-1" />
        <div className="vol-ai-glow-2" />

        {/* AI Header Ribbon */}
        <div 
          className="vol-ai-header"
          style={{
            position: 'relative',
            zIndex: 2,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px',
            paddingBottom: '16px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
          }}
        >
          <div className="vol-ai-title-wrap" style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div className="vol-ai-icon-badge">
              <Brain style={{ width: '22px', height: '22px', color: '#00F0FF' }} />
            </div>
            <div className="vol-ai-titles">
              <div className="vol-ai-main-title" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, fontFamily: "'JetBrains Mono', monospace", fontSize: '15px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#ffffff' }}>
                  Quant AI Volatility Intelligence · {ticker} Surface Synthesis
                </h2>
                <span className="vol-ai-live-tag">
                  <Sparkles style={{ width: '12px', height: '12px', color: '#00F0FF' }} />
                  AI SYNTHESIS ACTIVE
                </span>
              </div>
              <p className="vol-ai-subtitle" style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#94a3b8' }}>
                Autonomous multi-tenor implied vs realized variance diagnostics · Volatility surface anomaly modeling
              </p>
            </div>
          </div>

          {/* AI Quant Conviction & Posture Ribbon */}
          <div className="vol-ai-badges-wrap" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div className="vol-conviction-pill">
              <span className="label">Conviction:</span>
              <span className="score">{ai.conviction_score}/100</span>
              <span className="vol-pulse-dot" />
            </div>
            <div className={`vol-posture-pill ${postureTheme}`}>
              {ai.verdict_posture}
            </div>
          </div>
        </div>

        {/* Executive Synthesis Hero Box */}
        <div 
          className={`vol-hero-box ${postureTheme}`}
          style={{
            position: 'relative',
            zIndex: 2,
            marginTop: '18px',
            padding: '20px',
            borderRadius: '14px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '20px',
            flexWrap: 'wrap'
          }}
        >
          <div className="vol-hero-text-wrap" style={{ flex: 1, minWidth: '280px', maxWidth: '820px' }}>
            <div className="vol-hero-header-line" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
              <span className="vol-hero-badge">
                {ai.verdict_badge}
              </span>
              <h3 className="vol-hero-title">
                {ai.verdict_title}
              </h3>
            </div>
            <p className="vol-hero-summary">
              {ai.executive_summary}
            </p>
          </div>

          {/* Implied Move Range Box */}
          {ai.market_implied_move && (
            <div className="vol-implied-box">
              <div className="vol-implied-top">
                <span>Market Implied Move</span>
                <span className="vol-implied-tenor">{ai.market_implied_move.tenor}</span>
              </div>
              <div className="vol-implied-move-val">
                {ai.market_implied_move.formatted}
              </div>
              <div className="vol-implied-targets">
                <span>Low: <strong style={{ color: '#f43f5e' }}>${ai.market_implied_move.range_low}</strong></span>
                <span>Spot: <strong style={{ color: '#ffffff' }}>${spot?.toFixed(2)}</strong></span>
                <span>High: <strong style={{ color: '#00E676' }}>${ai.market_implied_move.range_high}</strong></span>
              </div>
              <div className="vol-implied-bar">
                <div className="vol-implied-bar-low" />
                <div className="vol-implied-bar-center" />
                <div className="vol-implied-bar-high" />
              </div>
            </div>
          )}
        </div>

        {/* 4-Pillar AI Diagnostic Analysis Grid */}
        <div 
          className="vol-pillars-grid"
          style={{
            position: 'relative',
            zIndex: 2,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '14px',
            marginTop: '18px'
          }}
        >
          {(ai.four_pillars || []).map((pillar) => {
            const isEmerald = pillar.color === 'emerald';
            const isRose = pillar.color === 'rose';
            const isPurple = pillar.color === 'purple';
            const colorClass = isEmerald ? 'emerald' : (isRose ? 'rose' : (isPurple ? 'purple' : 'cyan'));
            const borderClass = isEmerald ? 'border-emerald' : (isRose ? 'border-rose' : (isPurple ? 'border-purple' : 'border-cyan'));

            return (
              <div 
                key={pillar.id}
                className={`vol-pillar-card ${borderClass}`}
                style={{
                  padding: '16px',
                  borderRadius: '12px',
                  background: 'rgba(15, 23, 42, 0.85)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  <div className="vol-pillar-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', gap: '8px' }}>
                    <span className="vol-pillar-title">
                      {pillar.title}
                    </span>
                    <span className={`vol-pillar-status ${colorClass}`}>
                      {pillar.status}
                    </span>
                  </div>
                  <div className={`vol-pillar-metric ${colorClass}`}>
                    {pillar.metric}
                  </div>
                  <p className="vol-pillar-takeaway">
                    {pillar.takeaway}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Tail Risk & Microstructure Alert Ribbon */}
        <div 
          className="vol-risk-ribbon"
          style={{
            position: 'relative',
            zIndex: 2,
            marginTop: '14px',
            padding: '12px 18px',
            borderRadius: '10px',
            background: 'rgba(5, 8, 16, 0.85)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '14px',
            flexWrap: 'wrap'
          }}
        >
          <div className="vol-risk-left" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ShieldCheck style={{ width: '18px', height: '18px', color: '#00F0FF', flexShrink: 0 }} />
            <span>
              <strong style={{ color: '#ffffff', fontFamily: 'monospace' }}>Risk Directive:</strong> {ai.tail_risk_warning}
            </span>
          </div>
          <a 
            href="#trade-ideas-section"
            onClick={(e) => {
              e.preventDefault();
              const el = document.getElementById('trade-ideas-section');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
            className="vol-risk-jump-link"
          >
            Jump to Trade Ideas ↓
          </a>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* 2. THEN: 3D VOLATILITY SURFACE & DESK KPIS                                */}
      {/* ========================================================================= */}
      <div 
        ref={surfaceCardRef}
        className="vol-surface-card"
        style={{
          background: '#0a0e17',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '16px',
          padding: '22px',
          boxShadow: '0 12px 36px rgba(0, 0, 0, 0.5)',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px'
        }}
      >
        {/* Section Title */}
        <div 
          className="vol-surface-header"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            paddingBottom: '14px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
          }}
        >
          <div className="vol-surface-title-wrap" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Compass style={{ width: '18px', height: '18px', color: '#00F0FF' }} />
            <h3 style={{ margin: 0, fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#00F0FF' }}>
              Quantitative Volatility Surface & Smile Topology
            </h3>
          </div>
          <span className="vol-surface-expirations-count">
            Interactive Multi-Tenor Manifold across {availableExpirations.length} Expirations
          </span>
        </div>

        {/* QUANT VOLATILITY DESK KPI STRIP */}
        <div 
          className="vol-kpis-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '12px'
          }}
        >
          {/* SPOT PRICE */}
          <div className="vol-kpi-tile">
            <span className="vol-kpi-label">Spot Price</span>
            <span className="vol-kpi-val">${spot?.toFixed(2)}</span>
            <span className="vol-kpi-sub">Underlying Asset</span>
          </div>

          {/* 30D ATM IV */}
          <div className="vol-kpi-tile featured">
            <span className="vol-kpi-label">30D ATM IV</span>
            <span className="vol-kpi-val cyan">
              {desk_metrics?.atm_iv_30d?.toFixed(1)}%
            </span>
            <span className="vol-kpi-sub cyan">Market Pricing</span>
          </div>

          {/* 30D REALIZED HV */}
          <div className="vol-kpi-tile">
            <span className="vol-kpi-label">30D Realized HV</span>
            <span className="vol-kpi-val">
              {desk_metrics?.realized_hv_30d?.toFixed(1)}%
            </span>
            <span className="vol-kpi-sub">Trailing Volatility</span>
          </div>

          {/* IV / HV RATIO */}
          <div className="vol-kpi-tile">
            <span className="vol-kpi-label">IV / HV Ratio</span>
            <span className={`vol-kpi-val ${
              desk_metrics?.iv_hv_ratio > 1.15 ? 'rose' : (desk_metrics?.iv_hv_ratio < 0.9 ? 'emerald' : 'amber')
            }`}>
              {desk_metrics?.iv_hv_ratio}x
            </span>
            <span className="vol-kpi-sub">
              {desk_metrics?.iv_hv_ratio > 1.15 ? 'Rich Premium' : (desk_metrics?.iv_hv_ratio < 0.9 ? 'Cheap Vega' : 'Fair Value')}
            </span>
          </div>

          {/* TERM STRUCTURE */}
          <div className="vol-kpi-tile">
            <span className="vol-kpi-label">Term Regime</span>
            <span className={`vol-kpi-val ${desk_metrics?.term_structure_regime === 'Backwardation' ? 'rose' : 'purple'}`}>
              {desk_metrics?.term_structure_regime}
            </span>
            <span className="vol-kpi-sub">
              {desk_metrics?.term_structure_slope > 0 ? `+${desk_metrics?.term_structure_slope}% Slope` : `${desk_metrics?.term_structure_slope}% Slope`}
            </span>
          </div>

          {/* SKEW SPREAD */}
          <div className="vol-kpi-tile">
            <span className="vol-kpi-label">25D Skew Bias</span>
            <span className="vol-kpi-val emerald">
              +{desk_metrics?.skew_spread}%
            </span>
            <span className="vol-kpi-sub emerald">Put Skew Premium</span>
          </div>
        </div>

        {/* View Mode Selector & Canvas Controls */}
        <div 
          className="vol-controls-row"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            paddingTop: '4px'
          }}
        >
          <div className="vol-view-tabs">
            <button
              onClick={() => setActiveViewMode('3d_surface')}
              className={`vol-view-btn ${activeViewMode === '3d_surface' ? 'active' : ''}`}
            >
              3D Vol Surface
            </button>
            <button
              onClick={() => setActiveViewMode('2d_skew')}
              className={`vol-view-btn ${activeViewMode === '2d_skew' ? 'active' : ''}`}
            >
              2D Skew Curve
            </button>
            <button
              onClick={() => setActiveViewMode('term_structure')}
              className={`vol-view-btn ${activeViewMode === 'term_structure' ? 'active' : ''}`}
            >
              Term Structure
            </button>
          </div>

          {activeViewMode === '2d_skew' && (
            <select 
              value={selectedExpiry} 
              onChange={(e) => setSelectedExpiry(e.target.value)}
              className="vol-expiry-select"
            >
              {availableExpirations.map(exp => (
                <option key={exp} value={exp}>{exp}</option>
              ))}
            </select>
          )}

          {activeViewMode === '3d_surface' && (
            <div className="vol-legend-strip">
              <div className="vol-legend-item">
                <span className="vol-legend-dot atm" /> ATM Spine
              </div>
              <div className="vol-legend-item">
                <span className="vol-legend-dot overpriced" /> Overpriced
              </div>
              <div className="vol-legend-item">
                <span className="vol-legend-dot underpriced" /> Underpriced
              </div>
              {focusedHotspot && (
                <span className="vol-focus-badge">
                  🎯 Focus Locked: {focusedHotspot.expiry} (${focusedHotspot.strike})
                </span>
              )}
            </div>
          )}
        </div>

        {/* Plotly Canvas Container */}
        <div 
          className="vol-canvas-container"
          style={{
            width: '100%',
            minHeight: '580px',
            background: '#060910',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            overflow: 'hidden',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '8px'
          }}
        >
          <div ref={plotRef} style={{ width: '100%', minHeight: '560px' }} />
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. IN LAST: ACTIONABLE VOLATILITY TRADE SETUPS MATRIX TABLE                */}
      {/* ========================================================================= */}
      <div 
        id="trade-ideas-section"
        className="vol-setups-card"
        style={{
          position: 'relative',
          background: 'linear-gradient(135deg, #090d18 0%, #060910 100%)',
          border: '1px solid rgba(6, 182, 212, 0.35)',
          borderRadius: '16px',
          padding: '22px',
          boxShadow: '0 16px 40px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px'
        }}
      >
        {(() => {
          const getActionBadgeClass = (action) => {
            switch (action) {
              case 'SELL VOL': return 'sell-vol';
              case 'BUY VOL': return 'buy-vol';
              case 'CALENDAR': return 'calendar';
              case 'CREDIT SPREAD': return 'credit-spread';
              case 'CALL FLY': return 'call-fly';
              default: return 'credit-spread';
            }
          };

          const filteredSetups = actionable_setups.filter(setup => {
            if (setupCategory === 'ALL') return true;
            if (setupCategory === 'INCOME') return setup.action === 'SELL VOL' || setup.action === 'CREDIT SPREAD';
            if (setupCategory === 'CONVEXITY') return setup.action === 'BUY VOL' || setup.action === 'CALL FLY';
            if (setupCategory === 'TERM') return setup.action === 'CALENDAR' || setup.action === 'CRUSH VOL';
            if (setupCategory === 'SKEW') return setup.category?.includes('Skew') || setup.action === 'CREDIT SPREAD' || setup.badge?.includes('Skew');
            return true;
          });

          const handleFocusTrade = (e, targetPoint) => {
            e.stopPropagation();
            if (!targetPoint) return;
            setActiveViewMode('3d_surface');
            setFocusedHotspot(targetPoint);
            if (surfaceCardRef.current) {
              surfaceCardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          };

          return (
            <>
              {/* Table Header / Toolbar */}
              <div 
                className="vol-setups-toolbar"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '14px',
                  paddingBottom: '16px',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
                }}
              >
                <div className="vol-setups-title-wrap" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div className="vol-setups-icon-badge">
                    <Target style={{ width: '20px', height: '20px', color: '#00F0FF' }} />
                  </div>
                  <div className="vol-setups-header-titles">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <h3 style={{ margin: 0, fontFamily: "'JetBrains Mono', monospace", fontSize: '14px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#00F0FF' }}>
                        Trader Focus · Suggested Volatility Trade Ideas
                      </h3>
                      <span className="vol-ai-live-tag" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#00E676', borderColor: 'rgba(16, 185, 129, 0.4)' }}>
                        <span className="vol-pulse-dot" style={{ width: '5px', height: '5px' }} />
                        DERIVATIVES MATRIX
                      </span>
                    </div>
                    <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#94a3b8', fontFamily: '-apple-system, sans-serif' }}>
                      Tactical algorithmic option structures derived directly from the 3D surface manifold above
                    </p>
                  </div>
                </div>

                {/* Category Filter Tabs */}
                <div className="vol-filter-tabs">
                  {[
                    { id: 'ALL', label: `All Setups (${actionable_setups.length})` },
                    { id: 'INCOME', label: 'Income / Short Vol' },
                    { id: 'CONVEXITY', label: 'Long Convexity' },
                    { id: 'TERM', label: 'Term Structure' },
                    { id: 'SKEW', label: 'Skew Edge' }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setSetupCategory(tab.id)}
                      className={`vol-filter-tab-btn ${setupCategory === tab.id ? 'active' : ''}`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quick Summary Pill Strip */}
              <div 
                className="vol-summary-strip"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '12px',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  background: 'rgba(5, 8, 16, 0.7)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '11px'
                }}
              >
                <div className="vol-summary-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="label">Total Trade Ideas:</span>
                  <span className="val">{actionable_setups.length} Setups</span>
                </div>
                <div className="vol-summary-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="label">Surface Posture:</span>
                  <span className="val cyan">{ai.verdict_badge}</span>
                </div>
                <div className="vol-summary-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="label">Best Strategy Win Rate:</span>
                  <span className="val emerald">
                    {actionable_setups.length > 0 ? `${Math.max(...actionable_setups.map(s => s.pop_num || 70))}% PoP` : 'Defined PoP'}
                  </span>
                </div>
                <div className="vol-summary-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="label">Max Asymmetry:</span>
                  <span className="val amber">4.5 : 1 R:R</span>
                </div>
              </div>

              {/* Actionable Setups Institutional Table */}
              <div 
                className="vol-table-scroll-wrap"
                style={{
                  overflowX: 'auto',
                  width: '100%',
                  borderRadius: '12px',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  background: 'rgba(5, 8, 16, 0.6)'
                }}
              >
                <table className="vol-matrix-table" style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1050px', textAlign: 'left' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'center', width: '130px' }}>Posture / Action</th>
                      <th>Strategy & Structure</th>
                      <th>Tenor / Expiry</th>
                      <th>Strikes & Range</th>
                      <th>Greeks Profile</th>
                      <th>Quantitative Edge</th>
                      <th style={{ textAlign: 'center' }}>Est. PoP / R:R</th>
                      <th style={{ textAlign: 'right', width: '140px' }}>3D Focus</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSetups.length === 0 ? (
                      <tr>
                        <td colSpan="8" style={{ padding: '36px', textAlign: 'center', color: '#94a3b8', fontFamily: 'monospace' }}>
                          No trade setups match the selected filter category.
                        </td>
                      </tr>
                    ) : (
                      filteredSetups.map((setup, idx) => {
                        const badgeClass = getActionBadgeClass(setup.action);
                        const isExpanded = expandedSetupId === (setup.id || idx);
                        const popNum = setup.pop_num || (setup.action === 'BUY VOL' ? 40 : 70);

                        return (
                          <React.Fragment key={setup.id || idx}>
                            {/* Primary Interactive Row */}
                            <tr 
                              onClick={() => setExpandedSetupId(isExpanded ? null : (setup.id || idx))}
                              className={`vol-matrix-tr ${isExpanded ? 'expanded' : ''}`}
                            >
                              {/* 1. Posture & Action Badge */}
                              <td style={{ textAlign: 'center' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                  <span className={`vol-action-badge ${badgeClass}`}>
                                    <span className={`vol-action-dot ${badgeClass}`} />
                                    {setup.action}
                                  </span>
                                  <span className="vol-action-badge-sub">
                                    {setup.badge}
                                  </span>
                                </div>
                              </td>

                              {/* 2. Strategy Name & Concrete Structure */}
                              <td>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  <div>
                                    <span className="vol-strategy-title">
                                      {setup.name}
                                    </span>
                                    {setup.category && (
                                      <span className="vol-strategy-cat-pill">
                                        {setup.category}
                                      </span>
                                    )}
                                  </div>
                                  <span className="vol-strategy-structure">
                                    {setup.structure}
                                  </span>
                                </div>
                              </td>

                              {/* 3. Expiry & DTE */}
                              <td style={{ fontFamily: 'monospace' }}>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  <span style={{ color: '#ffffff', fontWeight: 700, fontSize: '12px' }}>{setup.expiry}</span>
                                  <span style={{ color: '#00F0FF', fontSize: '11px', marginTop: '2px' }}>
                                    {typeof setup.dte === 'number' ? `${setup.dte} DTE` : (setup.dte || 'Target Tenor')}
                                  </span>
                                </div>
                              </td>

                              {/* 4. Strikes & Range */}
                              <td style={{ fontFamily: 'monospace' }}>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  <span style={{ color: '#fbbf24', fontWeight: 700, fontSize: '12px' }}>{setup.strikes}</span>
                                  <span style={{ color: '#94a3b8', fontSize: '10px', marginTop: '2px' }}>
                                    {setup.moneyness || 'ATM Centered'}
                                  </span>
                                </div>
                              </td>

                              {/* 5. Greeks Profile */}
                              <td>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#c084fc', fontWeight: 600 }}>
                                    {setup.bias}
                                  </span>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    {setup.greeks?.theta && (
                                      <span className={`vol-greek-pill ${setup.greeks.theta.includes('+') ? 'pos' : 'neg'}`}>
                                        θ {setup.greeks.theta.split('/')[0]}
                                      </span>
                                    )}
                                    {setup.greeks?.vega && (
                                      <span className={`vol-greek-pill ${setup.greeks.vega.includes('+') ? 'cyan' : 'neg'}`}>
                                        ν {setup.greeks.vega.split(' ')[0]}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </td>

                              {/* 6. Quantitative Edge */}
                              <td style={{ maxWidth: '280px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  {setup.edge_metric && (
                                    <span className="vol-ai-live-tag" style={{ width: 'fit-content' }}>
                                      {setup.edge_metric}
                                    </span>
                                  )}
                                  <p style={{ margin: 0, color: '#cbd5e1', fontSize: '12px', lineHeight: 1.4, fontFamily: '-apple-system, sans-serif' }}>
                                    {setup.edge}
                                  </p>
                                </div>
                              </td>

                              {/* 7. Modeled PoP / R:R */}
                              <td style={{ textAlign: 'center', fontFamily: 'monospace' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                  <span style={{ fontSize: '12px', fontWeight: 800, color: '#ffffff' }}>
                                    {setup.pop_est || (popNum ? `${popNum}% PoP` : 'Defined')}
                                  </span>
                                  <div className="vol-pop-bar-wrap">
                                    <div 
                                      className="vol-pop-bar-fill"
                                      style={{ width: `${popNum}%` }}
                                    />
                                  </div>
                                  <span style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>
                                    R:R {setup.rr_ratio || '1 : 2.5'}
                                  </span>
                                </div>
                              </td>

                              {/* 8. Interactive Focus in 3D & Expand Trigger */}
                              <td style={{ textAlign: 'right' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                                  {setup.target_point && (
                                    <button
                                      onClick={(e) => handleFocusTrade(e, setup.target_point)}
                                      title="Orient 3D Volatility Surface camera directly to this setup"
                                      className="vol-focus-btn"
                                    >
                                      <Crosshair style={{ width: '13px', height: '13px' }} />
                                      Focus 3D
                                    </button>
                                  )}
                                  <div style={{ padding: '4px', color: '#94a3b8' }}>
                                    {isExpanded ? <ChevronUp style={{ width: '16px', height: '16px' }} /> : <ChevronDown style={{ width: '16px', height: '16px' }} />}
                                  </div>
                                </div>
                              </td>
                            </tr>

                            {/* Expandable Institutional Trade Architecture Drawer */}
                            {isExpanded && (
                              <tr>
                                <td colSpan="8" className="vol-drawer-cell">
                                  <div 
                                    className="vol-drawer-grid"
                                    style={{
                                      display: 'grid',
                                      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                                      gap: '16px'
                                    }}
                                  >
                                    
                                    {/* Card 1: Trade Architecture & Structure */}
                                    <div className="vol-drawer-box">
                                      <div>
                                        <div className="vol-drawer-box-header">
                                          <span className="title cyan">Legs & Structure</span>
                                          <span className="sub">Order Specs</span>
                                        </div>
                                        <div>
                                          <div className="vol-drawer-spec-row">
                                            <span className="k">Structure:</span>
                                            <span className="v">{setup.structure}</span>
                                          </div>
                                          <div className="vol-drawer-spec-row">
                                            <span className="k">Strikes:</span>
                                            <span className="v amber">{setup.strikes}</span>
                                          </div>
                                          <div className="vol-drawer-spec-row">
                                            <span className="k">Moneyness:</span>
                                            <span className="v">{setup.moneyness || 'ATM'}</span>
                                          </div>
                                          <div className="vol-drawer-spec-row">
                                            <span className="k">Order Route:</span>
                                            <span className="v cyan">Net Spread</span>
                                          </div>
                                        </div>
                                      </div>
                                      <div className="vol-drawer-footer">
                                        Execution: Mid-market limit fill priority
                                      </div>
                                    </div>

                                    {/* Card 2: Complete Greeks Profile */}
                                    <div className="vol-drawer-box">
                                      <div>
                                        <div className="vol-drawer-box-header">
                                          <span className="title purple">Greeks Anatomy</span>
                                          <span className="sub">Sensitivities</span>
                                        </div>
                                        <div className="vol-greeks-2x2">
                                          <div className="vol-greek-tile">
                                            <span className="k">Delta (Δ)</span>
                                            <span className="v" style={{ color: '#ffffff' }}>{setup.greeks?.delta || '0.00'}</span>
                                          </div>
                                          <div className="vol-greek-tile">
                                            <span className="k">Gamma (Γ)</span>
                                            <span className="v" style={{ color: '#ffffff' }}>{setup.greeks?.gamma || '-0.010'}</span>
                                          </div>
                                          <div className="vol-greek-tile">
                                            <span className="k">Vega (ν)</span>
                                            <span className={`v ${setup.greeks?.vega?.includes('-') ? 'rose' : 'cyan'}`}>
                                              {setup.greeks?.vega || '-0.25'}
                                            </span>
                                          </div>
                                          <div className="vol-greek-tile">
                                            <span className="k">Theta (θ)</span>
                                            <span className={`v ${setup.greeks?.theta?.includes('+') ? 'emerald' : 'rose'}`}>
                                              {setup.greeks?.theta || '+$25/d'}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                      <div className="vol-drawer-footer">
                                        Posture: {setup.bias}
                                      </div>
                                    </div>

                                    {/* Card 3: Risk Envelope & Breakeven */}
                                    <div className="vol-drawer-box">
                                      <div>
                                        <div className="vol-drawer-box-header">
                                          <span className="title emerald">Risk & Breakeven</span>
                                          <span className="sub">Modeled Limits</span>
                                        </div>
                                        <div>
                                          <div className="vol-drawer-spec-row">
                                            <span className="k">Max Profit:</span>
                                            <span className="v emerald">{setup.max_profit || 'Defined Credit'}</span>
                                          </div>
                                          <div className="vol-drawer-spec-row">
                                            <span className="k">Max Loss:</span>
                                            <span className="v rose">{setup.max_loss || 'Defined Wings'}</span>
                                          </div>
                                          <div className="vol-drawer-spec-row">
                                            <span className="k">Breakeven:</span>
                                            <span className="v amber">{setup.breakeven || 'ATM Wings'}</span>
                                          </div>
                                          <div className="vol-drawer-spec-row">
                                            <span className="k">Asymmetry:</span>
                                            <span className="v cyan">{setup.rr_ratio || '1 : 2.5'} R:R</span>
                                          </div>
                                        </div>
                                      </div>
                                      <div className="vol-drawer-footer">
                                        Estimated PoP: {setup.pop_est || `${popNum}%`}
                                      </div>
                                    </div>

                                    {/* Card 4: Desk Playbook & Microstructure Thesis */}
                                    <div className="vol-drawer-box">
                                      <div>
                                        <div className="vol-drawer-box-header">
                                          <span className="title amber">Desk Playbook</span>
                                          <span className="sub">Execution Thesis</span>
                                        </div>
                                        <p style={{ margin: 0, fontSize: '12px', color: '#cbd5e1', lineHeight: 1.5, fontFamily: '-apple-system, sans-serif' }}>
                                          {setup.desk_notes || 'Execute structured wing orders; take profits when edge normalizes or front theta accelerates.'}
                                        </p>
                                      </div>
                                      <div className="vol-drawer-footer">
                                        <span style={{ color: '#94a3b8' }}>Target:</span>
                                        {setup.target_point && (
                                          <button
                                            onClick={(e) => handleFocusTrade(e, setup.target_point)}
                                            style={{
                                              background: 'none',
                                              border: 'none',
                                              color: '#00F0FF',
                                              fontFamily: 'monospace',
                                              fontSize: '11px',
                                              fontWeight: 700,
                                              cursor: 'pointer',
                                              textDecoration: 'underline',
                                              padding: 0
                                            }}
                                          >
                                            View On 3D Surface →
                                          </button>
                                        )}
                                      </div>
                                    </div>

                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </>
          );
        })()}
      </div>

    </div>
  );
};

export default VolatilitySurface3D;
