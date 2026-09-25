import React, { useState, useEffect, useRef, useMemo } from 'react';
import './VolatilitySurface3D.css';
import { 
  Loader2, Zap, Target, TrendingUp, TrendingDown, 
  Activity, Compass, Layers, AlertCircle, ArrowUpRight, 
  CheckCircle2, Sliders, Info, Eye, ChevronDown, ChevronUp,
  Crosshair, Shield, Sparkles, Filter, ArrowRight, ShieldCheck,
  Check, Maximize2, Bot, Cpu, Brain, Flame, Camera, RotateCw, Download
} from 'lucide-react';

const COLOR_PALETTES = [
  { id: 'HedgingRegimes', label: '🛡️ Hedging Regimes (Over/Under)' },
  { id: 'Plasma', label: 'Plasma (Purple / Gold)' },
  { id: 'Viridis', label: 'Viridis (Teal / Emerald)' },
  { id: 'Turbo', label: 'Turbo (Full Spectrum)' },
  { id: 'Inferno', label: 'Inferno (Fire / Gold)' },
  { id: 'Electric', label: 'Electric (Neon Cyan)' },
  { id: 'Cividis', label: 'Cividis (Navy / Titanium)' },
  { id: 'Hot', label: 'Thermal Hot (Maroon / White)' },
  { id: 'Ice', label: 'Arctic Ice (Cyan / White)' }
];

const BG_THEMES = [
  { id: '#060910', name: 'Deep Space', text: '#cbd5e1', grid: '#1e293b' },
  { id: '#000000', name: 'Obsidian OLED', text: '#f1f5f9', grid: '#262626' },
  { id: '#0a1128', name: 'Navy Terminal', text: '#cbd5e1', grid: '#1e293b' },
  { id: '#181f2a', name: 'Graphite Slate', text: '#f1f5f9', grid: '#334155' },
  { id: '#091519', name: 'Midnight Aurora', text: '#cbd5e1', grid: '#132e35' },
  { id: '#f8fafc', name: 'Classic Light', text: '#0f172a', grid: '#cbd5e1' }
];

const CAMERA_PRESETS = {
  iso: { eye: { x: 1.6, y: 1.6, z: 0.7 }, label: '📐 Isometric' },
  skew: { eye: { x: 0.05, y: 2.1, z: 0.2 }, label: '📉 Skew Face' },
  term: { eye: { x: 2.1, y: 0.05, z: 0.2 }, label: '⏳ Term Side' },
  top: { eye: { x: 0.01, y: 0.01, z: 2.5 }, label: '🗺️ Top-Down' }
};

const VolatilitySurface3D = ({ ticker = 'SPY' }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedExpiry, setSelectedExpiry] = useState('All');
  const [activeViewMode, setActiveViewMode] = useState('3d_surface'); // '3d_surface' | '2d_skew' | 'term_structure' | 'heatmap'
  const [surfaceColor, setSurfaceColor] = useState('Plasma');
  const [surfaceBg, setSurfaceBg] = useState('#060910');
  const [cameraPreset, setCameraPreset] = useState('iso');
  const [autoRotate, setAutoRotate] = useState(false);
  const [strikeMode, setStrikeMode] = useState('strike'); // 'strike' | 'moneyness'
  const [heatmapFilter, setHeatmapFilter] = useState('core'); // 'core' | 'all'
  const [showHvPlane, setShowHvPlane] = useState(true);
  const [show3dLabels, setShow3dLabels] = useState(true);
  const [showHedgingGuide, setShowHedgingGuide] = useState(true);
  const [highlightedSetupId, setHighlightedSetupId] = useState(null);
  const [focusedHotspot, setFocusedHotspot] = useState(null);
  const [expandedSetupId, setExpandedSetupId] = useState(null);
  const [setupCategory, setSetupCategory] = useState('ALL');
  const [plotlyReady, setPlotlyReady] = useState(Boolean(window.Plotly));
  const plotRef = useRef(null);
  const surfaceCardRef = useRef(null);
  const rotateAngleRef = useRef(0);
  const animFrameRef = useRef(null);

  // Algorithmic Air Pocket Scanner (Cheapest Volatility Valleys across the Surface)
  const detectedAirPockets = useMemo(() => {
    if (!data || !data.surface || data.surface.length === 0) return [];

    const spotPrice = data.spot || 100;
    const underpriced = (data.hotspots || [])
      .filter(h => h.type === 'underpriced')
      .map(h => ({
        id: h.id || `pocket-${h.expiry}-${h.strike}`,
        expiry: h.expiry,
        strike: h.strike,
        iv: h.iv,
        benchmark_iv: h.benchmark_iv || (data.desk_metrics?.atm_iv_30d || 25.0),
        edge_pct: h.edge_pct || 20.0,
        type: h.strike < spotPrice ? 'otm_put' : 'otm_call',
        moneyness: (h.strike / spotPrice).toFixed(2),
        playbook: h.strike < spotPrice 
          ? `Downside wing depression. Buy $${h.strike}P put calendar or debit spread; sell higher strike puts to harvest cheap tail convexity.`
          : `Upside call wing depression. Buy $${h.strike}C call spread or broken-wing fly; capture upside expansion at steep vega discount.`
      }));

    // Find genuine model-calibrated air pockets (depressed vol valleys)
    const valleys = [];
    (data.surface || []).forEach(p => {
      // Point is a calibrated underhedged depression with significant dislocation (< -12%)
      if (p.hedge_state === 'underhedged' && p.dislocation_pct <= -12) {
        const isCall = p.strike >= spotPrice;
        valleys.push({
          id: `valley-${p.expiry}-${p.strike}`,
          expiry: p.expiry,
          dte: p.dte,
          strike: p.strike,
          iv: p.iv,
          benchmark_iv: p.fit_iv,
          edge_pct: Math.abs(p.dislocation_pct),
          type: isCall ? 'otm_call' : 'otm_put',
          moneyness: (p.strike / spotPrice).toFixed(2),
          playbook: isCall 
            ? `Compressed call vega. Buy $${p.strike}C & sell front/ATM calls in a diagonal spread to monetize cheap upside expansion.`
            : `Compressed put vega. Buy $${p.strike}P cheap wings & sell higher strike premium in a ratio spread for asymmetric hedge.`
        });
      }
    });

    const combined = [...underpriced];
    valleys.forEach(v => {
      if (!combined.some(c => c.expiry === v.expiry && Math.abs(c.strike - v.strike) < 1.0)) {
        combined.push(v);
      }
    });

    // Sort by largest discount edge and take top 4
    return combined.sort((a, b) => (b.edge_pct || 0) - (a.edge_pct || 0)).slice(0, 4);
  }, [data]);

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

  // Turntable Auto-Rotate Loop (60fps orbital rotation via Plotly.relayout)
  useEffect(() => {
    if (!autoRotate || activeViewMode !== '3d_surface' || !plotRef.current || !window.Plotly) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }

    const radius = 2.2;
    const zHeight = 0.75;
    let isRunning = true;

    const animateTurntable = () => {
      if (!isRunning) return;
      rotateAngleRef.current += 0.008;
      const x = radius * Math.cos(rotateAngleRef.current);
      const y = radius * Math.sin(rotateAngleRef.current);

      try {
        window.Plotly.relayout(plotRef.current, {
          'scene.camera.eye': { x, y, z: zHeight }
        });
      } catch (err) {
        // ignore
      }

      animFrameRef.current = requestAnimationFrame(animateTurntable);
    };

    animFrameRef.current = requestAnimationFrame(animateTurntable);

    return () => {
      isRunning = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [autoRotate, activeViewMode]);

  const handleCameraPreset = (presetKey) => {
    setCameraPreset(presetKey);
    setAutoRotate(false);
    if (plotRef.current && window.Plotly && CAMERA_PRESETS[presetKey]) {
      try {
        window.Plotly.relayout(plotRef.current, {
          'scene.camera.eye': CAMERA_PRESETS[presetKey].eye
        });
      } catch (err) {
        // ignore
      }
    }
  };

  const handleExportSnapshot = () => {
    if (!plotRef.current || !window.Plotly) return;
    try {
      window.Plotly.downloadImage(plotRef.current, {
        format: 'png',
        width: 1400,
        height: 800,
        filename: `${ticker}_Vol_Surface_${activeViewMode}`
      });
    } catch (err) {
      console.error("Snapshot export error:", err);
    }
  };

  useEffect(() => {
    if (!data || !data.surface || data.surface.length === 0 || !plotRef.current || !window.Plotly) {
      return;
    }

    try {
      window.Plotly.purge(plotRef.current);
    } catch (e) {
      // ignore
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

      const xValues = strikeMode === 'moneyness' 
        ? strikes.map(s => +(s / (spot || 1)).toFixed(3)) 
        : strikes;
      const xAxisTitle = strikeMode === 'moneyness' ? 'Moneyness (K/S)' : 'Strike Price ($)';

      const currentBg = BG_THEMES.find(t => t.id === surfaceBg) || BG_THEMES[0];

      // Construct Point Map for Rich Hover & Dislocation Surface Color
      const pointMap = new Map();
      (surface || []).forEach(p => {
        pointMap.set(`${p.expiry}-${p.strike}`, p);
      });

      let surfaceColorscale = surfaceColor;
      let surfaceColorMatrix = undefined;
      let cminVal = undefined;
      let cmaxVal = undefined;
      let colorbarTitle = 'Implied Vol (%)';

      if (surfaceColor === 'HedgingRegimes') {
        surfaceColorMatrix = expirations.map(exp => {
          return strikes.map(st => {
            const p = pointMap.get(`${exp}-${st}`);
            return p ? (p.dislocation_pct || 0) : 0;
          });
        });

        surfaceColorscale = [
          [0.0, '#10b981'],  // Deep Underhedged (Emerald Green)
          [0.35, '#059669'], // Mild Underhedged
          [0.45, '#1e293b'], // Approaching Balanced (Slate)
          [0.5, '#334155'],  // Balanced 0% Dislocation
          [0.55, '#1e293b'], // Approaching Balanced
          [0.65, '#dc2626'], // Mild Overhedged
          [1.0, '#ef4444']   // Deep Overhedged (Crimson Red)
        ];
        cminVal = -20;
        cmaxVal = 20;
        colorbarTitle = 'Hedge Dislocation (%)';
      }

      // Rich hover template matrix
      const hoverTextMatrix = expirations.map(exp => {
        return strikes.map(st => {
          const p = pointMap.get(`${exp}-${st}`);
          if (!p) return `Strike: $${st}<br>Expiry: ${exp}`;
          const dis = p.dislocation_pct !== undefined ? (p.dislocation_pct > 0 ? `+${p.dislocation_pct}%` : `${p.dislocation_pct}%`) : '0%';
          const state = p.hedge_label || 'BALANCED (Fair Value)';
          const fit = p.fit_iv || p.iv;
          const optType = p.type === 'otm_put' ? 'PUT' : (p.type === 'otm_call' ? 'CALL' : 'ATM');
          return `<b>${optType} $${p.strike}</b> (${(p.strike / (spot || 1)).toFixed(2)}x Spot)<br>` +
                 `Tenor: ${p.expiry} (${p.dte}d)<br>` +
                 `Market IV: <b>${p.iv}%</b><br>` +
                 `Smile Baseline: ${fit}%<br>` +
                 `Dislocation: <b>${dis}</b><br>` +
                 `State: <b>${state}</b>`;
        });
      });

      // Base 3D Surface with HD Mesh Lighting & Crisp Contour Lines
      const baseSurfaceTrace = {
        type: 'surface',
        z: zData,
        x: xValues,
        y: expirations,
        colorscale: surfaceColorscale,
        showscale: true,
        opacity: 0.90,
        lighting: {
          ambient: 0.82,
          diffuse: 0.90,
          fresnel: 0.20,
          specular: 0.40,
          roughness: 0.35
        },
        hoverinfo: 'text',
        text: hoverTextMatrix,
        colorbar: { 
          title: { text: colorbarTitle, font: { color: currentBg.text, family: 'monospace', size: 11 } }, 
          tickfont: { color: currentBg.text, family: 'monospace', size: 10 },
          len: 0.8,
          thickness: 14,
          xpad: 10
        },
        contours: {
          x: { show: true, color: 'rgba(255, 255, 255, 0.20)', width: 1 },
          y: { show: true, color: 'rgba(255, 255, 255, 0.20)', width: 1 },
          z: { show: true, usecolormap: true, highlightcolor: '#00F0FF', project: { z: true }, width: 2 }
        }
      };

      if (surfaceColor === 'HedgingRegimes' && surfaceColorMatrix) {
        baseSurfaceTrace.surfacecolor = surfaceColorMatrix;
        baseSurfaceTrace.cmin = -20;
        baseSurfaceTrace.cmax = 20;
      }

      const plotData = [baseSurfaceTrace];

      // Floating 3D Overhedge / Underhedge Radar Callout Pins (Anti-Collision & Staggered)
      const topOver = data.hedging_diagnostics?.top_overhedged || [];
      const topUnder = data.hedging_diagnostics?.top_underhedged || [];

      // Alternating label positions to guarantee zero overlap
      const overPositions = ['top center', 'top right', 'top left', 'middle right'];
      const underPositions = ['bottom center', 'bottom left', 'bottom right', 'middle left'];

      if (topOver.length > 0) {
        plotData.push({
          type: 'scatter3d',
          mode: show3dLabels ? 'markers+text' : 'markers',
          name: '🔴 Overhedged Peaks',
          x: topOver.map(h => strikeMode === 'moneyness' ? +(h.strike / (spot || 1)).toFixed(3) : h.strike),
          y: topOver.map(h => h.expiry),
          z: topOver.map(h => h.iv * 1.05),
          text: topOver.map(h => `+$${h.strike} (+${Math.round(h.dislocation_pct)}%)`),
          textposition: topOver.map((_, idx) => overPositions[idx % overPositions.length]),
          textfont: { color: '#ef4444', family: "'JetBrains Mono', monospace", size: 12, weight: 'bold' },
          hoverinfo: 'text',
          hovertext: topOver.map(h => 
            `<b>🔴 OVERHEDGED PEAK (Rich Premium)</b><br>` +
            `Strike: <b>$${h.strike}</b> (${h.type === 'otm_put' ? 'PUT' : 'CALL'})<br>` +
            `Expiry: <b>${h.expiry}</b><br>` +
            `Market IV: <b>${h.iv}%</b> (Baseline: ${h.fit_iv || h.iv}%)<br>` +
            `Dislocation: <b>+${h.dislocation_pct}% Rich</b><br>` +
            `<i>Strategy: ${h.strategy || 'Sell Vol / Credit Spread'}</i>`
          ),
          marker: { size: 10, color: '#ef4444', symbol: 'diamond', line: { color: '#ffffff', width: 2 } }
        });
      }

      if (topUnder.length > 0) {
        plotData.push({
          type: 'scatter3d',
          mode: show3dLabels ? 'markers+text' : 'markers',
          name: '🟢 Underhedged Valleys',
          x: topUnder.map(h => strikeMode === 'moneyness' ? +(h.strike / (spot || 1)).toFixed(3) : h.strike),
          y: topUnder.map(h => h.expiry),
          z: topUnder.map(h => h.iv * 0.95),
          text: topUnder.map(h => `-$${h.strike} (${Math.round(h.dislocation_pct)}%)`),
          textposition: topUnder.map((_, idx) => underPositions[idx % underPositions.length]),
          textfont: { color: '#10b981', family: "'JetBrains Mono', monospace", size: 12, weight: 'bold' },
          hoverinfo: 'text',
          hovertext: topUnder.map(h => 
            `<b>🟢 UNDERHEDGED VOL VALLEY (Cheap Convexity)</b><br>` +
            `Strike: <b>$${h.strike}</b> (${h.type === 'otm_put' ? 'PUT' : 'CALL'})<br>` +
            `Expiry: <b>${h.expiry}</b><br>` +
            `Market IV: <b>${h.iv}%</b> (Baseline: ${h.fit_iv || h.iv}%)<br>` +
            `Dislocation: <b>${h.dislocation_pct}% Cheap</b><br>` +
            `<b>Trader Meaning:</b> Statistical IV discount. Buy cheap gamma/vega with asymmetric upside.<br>` +
            `<i>Strategy: ${h.strategy || 'Buy Cheap Wings / Diagonal'}</i>`
          ),
          marker: { size: 10, color: '#10b981', symbol: 'diamond', line: { color: '#ffffff', width: 2 } }
        });
      }

      // Realized HV Horizon Cutoff Plane (Z = HV_30d) with VRP diagnostics
      const hvLevel = data.desk_metrics?.realized_hv_30d;
      const atmIv = data.desk_metrics?.atm_iv_30d;
      const vrpSpread = (atmIv !== undefined && hvLevel !== undefined) ? (atmIv - hvLevel) : null;
      if (showHvPlane && hvLevel && hvLevel > 0) {
        const vrpSign = vrpSpread !== null ? (vrpSpread >= 0 ? `+${vrpSpread.toFixed(1)}%` : `${vrpSpread.toFixed(1)}%`) : '';
        const vrpEdge = vrpSpread !== null ? (vrpSpread > 1.5 ? 'Sell Vol Edge (Rich)' : vrpSpread < -1.5 ? 'Buy Vol Edge (Cheap Vega)' : 'Fair Value Vol') : '';
        const planeLabel = `30D Realized HV Floor: ${hvLevel}% | VRP Spread: ${vrpSign} (${vrpEdge})`;
        plotData.push({
          type: 'surface',
          name: `30D Realized HV Floor (${hvLevel}%)`,
          x: [xValues[0], xValues[xValues.length - 1]],
          y: [expirations[0], expirations[expirations.length - 1]],
          z: [[hvLevel, hvLevel], [hvLevel, hvLevel]],
          showscale: false,
          opacity: 0.22,
          colorscale: [[0, '#38bdf8'], [1, '#38bdf8']],
          hoverinfo: 'text',
          text: [
            [planeLabel, planeLabel],
            [planeLabel, planeLabel]
          ]
        });
      }

      // Golden ATM Ridge Line
      if (term_structure.length > 0) {
        const atmX = strikeMode === 'moneyness' ? 1.00 : spot;
        plotData.push({
          type: 'scatter3d',
          mode: 'lines+markers',
          name: 'ATM Ridge Spine',
          x: term_structure.map(() => atmX),
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
            x: richSpots.map(h => strikeMode === 'moneyness' ? +(h.strike / (spot || 1)).toFixed(3) : h.strike),
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
            x: cheapSpots.map(h => strikeMode === 'moneyness' ? +(h.strike / (spot || 1)).toFixed(3) : h.strike),
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
            x: [strikeMode === 'moneyness' ? +(focusedHotspot.strike / (spot || 1)).toFixed(3) : focusedHotspot.strike],
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
        : (CAMERA_PRESETS[cameraPreset]?.eye || { x: 1.6, y: 1.6, z: 0.7 });

      const layout = {
        autosize: true,
        height: 640,
        margin: { l: 0, r: 0, b: 0, t: 0 },
        paper_bgcolor: 'transparent',
        plot_bgcolor: 'transparent',
        showlegend: true,
        legend: { 
          font: { color: '#ffffff', family: "'JetBrains Mono', monospace", size: 12, weight: 'bold' }, 
          x: 0, 
          y: 1,
          bgcolor: 'rgba(15, 23, 42, 0.85)',
          bordercolor: 'rgba(255, 255, 255, 0.15)',
          borderwidth: 1
        },
        scene: {
          xaxis: { 
            title: { text: xAxisTitle, font: { color: '#00F0FF', size: 13, family: "'JetBrains Mono', monospace", weight: 'bold' } }, 
            gridcolor: 'rgba(255, 255, 255, 0.12)', 
            color: '#f8fafc', 
            tickfont: { family: "'JetBrains Mono', monospace", color: '#cbd5e1', size: 11 },
            backgroundcolor: 'rgba(15, 23, 42, 0.5)',
            showbackground: true
          },
          yaxis: { 
            title: { text: 'Expiration Date', font: { color: '#00F0FF', size: 13, family: "'JetBrains Mono', monospace", weight: 'bold' } }, 
            gridcolor: 'rgba(255, 255, 255, 0.12)', 
            color: '#f8fafc', 
            tickfont: { family: "'JetBrains Mono', monospace", color: '#cbd5e1', size: 11 },
            backgroundcolor: 'rgba(15, 23, 42, 0.5)',
            showbackground: true
          },
          zaxis: { 
            title: { text: 'Implied Volatility (%)', font: { color: '#00F0FF', size: 13, family: "'JetBrains Mono', monospace", weight: 'bold' } }, 
            gridcolor: 'rgba(255, 255, 255, 0.12)', 
            color: '#f8fafc', 
            tickfont: { family: "'JetBrains Mono', monospace", color: '#cbd5e1', size: 11 },
            backgroundcolor: 'rgba(15, 23, 42, 0.5)',
            showbackground: true
          },
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
      
      const hvLevel = data.desk_metrics?.realized_hv_30d;
      const plotData = [
        {
          x: filtered.map(p => p.strike),
          y: filtered.map(p => p.iv),
          type: 'scatter',
          mode: 'lines+markers',
          name: `Market IV Skew (${activeExp})`,
          line: { color: '#00F0FF', width: 3, shape: 'spline' },
          marker: { 
            size: 7, 
            color: filtered.map(p => p.hedge_state === 'overhedged' ? '#ef4444' : (p.hedge_state === 'underhedged' ? '#10b981' : '#38bdf8'))
          },
          text: filtered.map(p => `${p.strike} (${p.type}): IV ${p.iv}% | Baseline ${p.fit_iv || p.iv}% | ${p.hedge_label || 'Balanced'}`),
          hoverinfo: 'text',
          fill: 'tozeroy',
          fillcolor: 'rgba(6, 182, 212, 0.06)'
        },
        {
          x: filtered.map(p => p.strike),
          y: filtered.map(p => p.fit_iv || p.iv),
          type: 'scatter',
          mode: 'lines',
          name: 'Fair Value Smile Baseline',
          line: { color: 'rgba(255, 255, 255, 0.35)', width: 1.5, dash: 'dash' },
          hoverinfo: 'none'
        }
      ];

      const layout = {
        autosize: true,
        height: 520,
        margin: { l: 50, r: 30, b: 50, t: 30 },
        paper_bgcolor: 'transparent',
        plot_bgcolor: 'transparent',
        title: { text: `Volatility Skew Curve · ${activeExp}`, font: { color: '#f8fafc', family: 'monospace', size: 14 } },
        xaxis: { title: 'Strike Price ($)', gridcolor: '#1e293b', color: '#94a3b8', tickfont: { family: 'monospace' } },
        yaxis: { title: 'Implied Volatility (%)', gridcolor: '#1e293b', color: '#94a3b8', tickfont: { family: 'monospace' } },
        shapes: [
          ...(spot && filtered.length > 0 ? [{
            type: 'line', x0: spot, x1: spot, y0: 0, y1: (Math.max(...filtered.map(p => p.iv)) || 30) * 1.05,
            line: { color: '#fbbf24', width: 2, dash: 'dash' }
          }] : []),
          ...(hvLevel && filtered.length > 0 ? [{
            type: 'line',
            x0: filtered[0].strike,
            x1: filtered[filtered.length - 1].strike,
            y0: hvLevel,
            y1: hvLevel,
            line: { color: '#38bdf8', width: 1.5, dash: 'dot' }
          }] : [])
        ],
        annotations: [
          ...(spot && filtered.length > 0 ? [{
            x: spot, y: Math.max(...filtered.map(p => p.iv)) || 30, text: `Spot $${spot.toFixed(2)}`,
            showarrow: true, arrowcolor: '#fbbf24', font: { color: '#fbbf24', family: 'monospace', size: 11 }
          }] : []),
          ...(hvLevel && filtered.length > 0 ? [{
            x: filtered[filtered.length - 1].strike,
            y: hvLevel,
            text: `30D HV ${hvLevel}%`,
            showarrow: false,
            xanchor: 'right',
            yanchor: 'bottom',
            font: { color: '#38bdf8', family: 'monospace', size: 10 }
          }] : [])
        ]
      };

      try {
        window.Plotly.newPlot(plotRef.current, plotData, layout, { responsive: true, displayModeBar: false });
      } catch (err) {
        console.warn("Plotly render error caught:", err);
      }

    } else if (activeViewMode === 'term_structure') {
      // 3. BUILD TERM STRUCTURE CURVE
      const hvLevel = data.desk_metrics?.realized_hv_30d;
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
        yaxis: { title: 'ATM Implied Volatility (%)', gridcolor: '#1e293b', color: '#94a3b8', tickfont: { family: 'monospace' } },
        shapes: hvLevel ? [{
          type: 'line',
          xref: 'paper',
          x0: 0,
          x1: 1,
          y0: hvLevel,
          y1: hvLevel,
          line: { color: '#38bdf8', width: 1.5, dash: 'dot' }
        }] : [],
        annotations: hvLevel ? [{
          xref: 'paper',
          x: 0.98,
          y: hvLevel,
          text: `30D Realized HV Benchmark (${hvLevel}%)`,
          showarrow: false,
          xanchor: 'right',
          yanchor: 'bottom',
          font: { color: '#38bdf8', family: 'monospace', size: 10 }
        }] : []
      };

      try {
        window.Plotly.newPlot(plotRef.current, plotData, layout, { responsive: true, displayModeBar: false });
      } catch (err) {
        console.warn("Plotly render error caught:", err);
      }

    } else if (activeViewMode === 'heatmap') {
      // 4. BUILD 2D VOLATILITY HEATMAP MATRIX
      const ptMap = new Map();
      surface.forEach(p => {
        if (p && p.expiry && p.strike !== undefined && p.iv !== undefined) {
          ptMap.set(`${p.expiry}_${p.strike}`, p.iv);
        }
      });

      let displayedStrikes = strikes;
      if (heatmapFilter === 'core' && spot) {
        const coreFiltered = strikes.filter(s => Math.abs(s - spot) / spot <= 0.15);
        if (coreFiltered.length >= 5) {
          displayedStrikes = coreFiltered;
        }
      }

      let zData = expirations.map(exp => {
        return displayedStrikes.map(str => {
          const val = ptMap.get(`${exp}_${str}`);
          return (val !== undefined && val !== null && !isNaN(val)) ? val : null;
        });
      });

      // Linear horizontal strike interpolation across missing strikes
      for (let i = 0; i < expirations.length; i++) {
        let lastIdx = -1;
        for (let j = 0; j < displayedStrikes.length; j++) {
          if (zData[i][j] !== null) {
            if (lastIdx !== -1 && j > lastIdx + 1) {
              const startVal = zData[i][lastIdx];
              const endVal = zData[i][j];
              const span = j - lastIdx;
              for (let k = lastIdx + 1; k < j; k++) {
                zData[i][k] = startVal + (endVal - startVal) * ((k - lastIdx) / span);
              }
            }
            lastIdx = j;
          }
        }
        // Outer boundaries flat-hold
        if (lastIdx !== -1) {
          for (let j = lastIdx + 1; j < displayedStrikes.length; j++) {
            zData[i][j] = zData[i][lastIdx];
          }
          const firstVal = zData[i].find(v => v !== null);
          for (let j = 0; j < displayedStrikes.length; j++) {
            if (zData[i][j] === null) zData[i][j] = firstVal;
            else break;
          }
        }
      }

      // Vertical expiration interpolation
      for (let j = 0; j < displayedStrikes.length; j++) {
        let lastIdx = -1;
        for (let i = 0; i < expirations.length; i++) {
          if (zData[i][j] !== null) {
            if (lastIdx !== -1 && i > lastIdx + 1) {
              const startVal = zData[lastIdx][j];
              const endVal = zData[i][j];
              const span = i - lastIdx;
              for (let k = lastIdx + 1; k < i; k++) {
                zData[k][j] = startVal + (endVal - startVal) * ((k - lastIdx) / span);
              }
            }
            lastIdx = i;
          }
        }
        if (lastIdx !== -1) {
          for (let i = lastIdx + 1; i < expirations.length; i++) {
            zData[i][j] = zData[lastIdx][j];
          }
          let firstVal = null;
          for (let i = 0; i < expirations.length; i++) {
            if (zData[i][j] !== null) { firstVal = zData[i][j]; break; }
          }
          if (firstVal !== null) {
            for (let i = 0; i < expirations.length; i++) {
              if (zData[i][j] === null) zData[i][j] = firstVal;
              else break;
            }
          }
        }
      }

      const defaultIv = (data.desk_metrics && data.desk_metrics.atm_iv_30d) || 25.0;
      for (let i = 0; i < expirations.length; i++) {
        for (let j = 0; j < displayedStrikes.length; j++) {
          if (zData[i][j] === null || isNaN(zData[i][j])) {
            zData[i][j] = defaultIv;
          }
        }
      }

      const currentBg = BG_THEMES.find(t => t.id === surfaceBg) || BG_THEMES[0];

      const hmXValues = strikeMode === 'moneyness'
        ? displayedStrikes.map(s => +(s / (spot || 1)).toFixed(3))
        : displayedStrikes;
      const hmXTitle = strikeMode === 'moneyness' ? 'Moneyness (K/S)' : 'Strike Price ($)';
      const spotX = strikeMode === 'moneyness' ? 1.00 : spot;

      const plotData = [{
        z: zData,
        x: hmXValues,
        y: expirations,
        type: 'heatmap',
        colorscale: surfaceColor,
        zsmooth: 'best',
        hoverongaps: false,
        colorbar: {
          title: { text: 'Implied Vol (%)', font: { color: currentBg.text, family: 'monospace', size: 11 } },
          tickfont: { color: currentBg.text, family: 'monospace', size: 10 },
          thickness: 16,
          len: 0.85
        },
        hovertemplate: `<b>${strikeMode === 'moneyness' ? 'Moneyness' : 'Strike'}:</b> %{x}<br><b>Tenor:</b> %{y}<br><b>Implied Vol:</b> %{z:.1f}%<extra></extra>`
      }];

      // Overlay Air Pocket Pinpoints directly onto the Heatmap
      const visibleAirPockets = detectedAirPockets.filter(p => 
        displayedStrikes.some(s => Math.abs(s - p.strike) < 1.0)
      );

      if (visibleAirPockets.length > 0) {
        plotData.push({
          x: visibleAirPockets.map(p => strikeMode === 'moneyness' ? +(p.strike / (spot || 1)).toFixed(3) : p.strike),
          y: visibleAirPockets.map(p => p.expiry),
          type: 'scatter',
          mode: 'markers+text',
          name: '🕳️ Air Pocket (Cheap Vega)',
          text: visibleAirPockets.map(p => `🕳️ $${p.strike} (${p.iv}%)`),
          textposition: 'top center',
          textfont: { color: '#00F0FF', family: 'monospace', size: 11, weight: 'bold' },
          marker: {
            size: 16,
            color: '#00F0FF',
            symbol: 'circle-open',
            line: { color: '#00F0FF', width: 3 }
          },
          hovertemplate: '<b>🕳️ VOLATILITY AIR POCKET</b><br>Strike: $%{x}<br>Tenor: %{y}<br>IV: %{text}<extra></extra>'
        });
      }

      // If a specific hotspot/airpocket is focused, lock with bright crosshair
      if (focusedHotspot && focusedHotspot.strike) {
        plotData.push({
          x: [strikeMode === 'moneyness' ? +(focusedHotspot.strike / (spot || 1)).toFixed(3) : focusedHotspot.strike],
          y: [focusedHotspot.expiry],
          type: 'scatter',
          mode: 'markers+text',
          name: '🎯 Target Focus',
          text: ['🎯 FOCUS LOCK'],
          textposition: 'bottom center',
          textfont: { color: '#00E676', family: 'monospace', size: 11, weight: 'bold' },
          marker: {
            size: 20,
            color: '#00E676',
            symbol: 'cross',
            line: { color: '#ffffff', width: 2 }
          }
        });
      }

      const layout = {
        autosize: true,
        height: 540,
        margin: { l: 80, r: 40, b: 60, t: 50 },
        paper_bgcolor: 'transparent',
        plot_bgcolor: 'transparent',
        title: { text: `Implied Volatility Heatmap Matrix · Strike vs Expiration`, font: { color: currentBg.text, family: 'monospace', size: 14 } },
        xaxis: { 
          title: { text: hmXTitle, font: { color: currentBg.text, size: 12 } }, 
          gridcolor: currentBg.grid, 
          color: currentBg.text, 
          tickfont: { family: 'monospace', color: currentBg.text } 
        },
        yaxis: { 
          title: { text: 'Expiration Tenor', font: { color: currentBg.text, size: 12 } }, 
          gridcolor: currentBg.grid, 
          color: currentBg.text, 
          tickfont: { family: 'monospace', color: currentBg.text },
          type: 'category'
        },
        shapes: spot ? [{
          type: 'line',
          xref: 'x',
          yref: 'paper',
          x0: spotX,
          x1: spotX,
          y0: 0,
          y1: 1,
          line: { color: '#00F0FF', width: 2, dash: 'dash' }
        }] : [],
        annotations: spot ? [{
          xref: 'x',
          yref: 'paper',
          x: spotX,
          y: 1.05,
          text: strikeMode === 'moneyness' ? 'ATM Spot (1.00x)' : `Spot $${spot.toFixed(2)}`,
          showarrow: false,
          font: { color: '#00F0FF', family: 'monospace', size: 11 },
          bgcolor: surfaceBg === '#f8fafc' ? '#e2e8f0' : 'rgba(10, 14, 28, 0.9)',
          bordercolor: '#00F0FF',
          borderwidth: 1,
          borderpad: 4
        }] : []
      };

      try {
        window.Plotly.newPlot(plotRef.current, plotData, layout, { responsive: true, displayModeBar: false });
      } catch (err) {
        console.error("Plotly heatmap render error:", err);
      }
    }
  }, [data, selectedExpiry, activeViewMode, focusedHotspot, plotlyReady, detectedAirPockets, surfaceColor, surfaceBg, cameraPreset, strikeMode, heatmapFilter, showHvPlane]);

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
      {/* INSTITUTIONAL OVERHEDGE / UNDERHEDGE RADAR & TRADER PLAYBOOK               */}
      {/* ========================================================================= */}
      {data.hedging_diagnostics && (
        <div className="vol-hedging-card">
          <div className="hedging-header-row">
            <div className="hedging-title-group">
              <div className="hedging-icon-badge">
                <Shield style={{ width: '22px', height: '22px', color: data.hedging_diagnostics.badge_color }} />
              </div>
              <div>
                <div className="hedging-main-title">
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#ffffff', fontFamily: "'JetBrains Mono', monospace" }}>
                    Institutional Overhedge / Underhedge Radar
                  </h3>
                  <span 
                    className="hedging-state-badge"
                    style={{
                      background: `${data.hedging_diagnostics.badge_color}20`,
                      color: data.hedging_diagnostics.badge_color,
                      borderColor: data.hedging_diagnostics.badge_color
                    }}
                  >
                    {data.hedging_diagnostics.verdict_badge}
                  </span>
                </div>
                <p className="hedging-subtitle">
                  {data.hedging_diagnostics.net_hedging_state}
                </p>
              </div>
            </div>

            <div className="hedging-quick-stats">
              <div className="hedging-stat-chip">
                <span className="lbl">25Δ Put Skew:</span>
                <span className="val" style={{ color: data.hedging_diagnostics.put_skew_25d > 1.25 ? '#ef4444' : '#38bdf8' }}>
                  {data.hedging_diagnostics.put_skew_25d}x ATM
                </span>
              </div>
              <div className="hedging-stat-chip">
                <span className="lbl">25Δ Call Skew:</span>
                <span className="val" style={{ color: data.hedging_diagnostics.call_skew_25d > 1.15 ? '#c084fc' : '#10b981' }}>
                  {data.hedging_diagnostics.call_skew_25d}x ATM
                </span>
              </div>
              <div className="hedging-stat-chip">
                <span className="lbl">Crash Cushion:</span>
                <span className="val" style={{ color: data.hedging_diagnostics.crash_cushion_score >= 70 ? '#10b981' : '#f59e0b' }}>
                  {data.hedging_diagnostics.crash_cushion_score}/100
                </span>
              </div>
              <div className="hedging-stat-chip">
                <span className="lbl">Vanna Risk:</span>
                <span className="val" style={{ color: '#f43f5e' }}>
                  {data.hedging_diagnostics.vanna_squeeze_risk?.split(' ')[0] || 'NORMAL'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowHedgingGuide(prev => !prev)}
                className="hedging-guide-toggle-btn"
                title="Toggle Trader Guide: What does Underhedge / Overhedge mean to a trader?"
              >
                <Info size={13} />
                <span>Trader Guide: What is an Underhedge Valley?</span>
                {showHedgingGuide ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>
            </div>
          </div>

          {/* Collapsible Trader Educational & Tactical Guide */}
          {showHedgingGuide && (
            <div className="hedging-trader-guide-box">
              <div className="guide-box-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Sparkles size={14} style={{ color: '#10b981' }} />
                  <strong style={{ color: '#ffffff', fontSize: '13px', fontFamily: "'JetBrains Mono', monospace" }}>
                    Trader Playbook: What Does an "Underhedge Valley" Mean to You?
                  </strong>
                </div>
                <span className="guide-tag green">TACTICAL DERIVATIVES INTEL</span>
              </div>

              <div className="guide-grid">
                <div className="guide-card">
                  <div className="guide-card-top">
                    <span className="guide-card-icon">🏷️</span>
                    <span className="guide-card-title">1. Cheap Convexity & Vega Discount</span>
                  </div>
                  <p className="guide-card-desc">
                    An <strong>Underhedge Valley</strong> is where market implied volatility (IV) is trading significantly <em>below</em> the theoretical smile baseline.
                    Options here are statistically underpriced: you pay minimal extrinsic value and theta burn for premium leverage.
                  </p>
                </div>

                <div className="guide-card">
                  <div className="guide-card-top">
                    <span className="guide-card-icon">🕳️</span>
                    <span className="guide-card-title">2. Complacency & Air Pocket</span>
                  </div>
                  <p className="guide-card-desc">
                    Dealers and market participants have under-allocated protection to this strike zone. If the stock makes an unexpected move toward this valley, 
                    dealers scramble to re-hedge gamma, triggering a violent <strong>IV expansion kick</strong> that multiplies option gains.
                  </p>
                </div>

                <div className="guide-card">
                  <div className="guide-card-top">
                    <span className="guide-card-icon">⚖️</span>
                    <span className="guide-card-title">3. Asymmetric Risk / Reward</span>
                  </div>
                  <p className="guide-card-desc">
                    Downside risk is strictly limited to the discounted premium paid, while upside payoff is convex. 
                    Buying cheap valley wings allows you to participate in explosive breakout or breakdown moves with superior risk/reward vs flat stock.
                  </p>
                </div>

                <div className="guide-card highlight">
                  <div className="guide-card-top">
                    <span className="guide-card-icon">🎯</span>
                    <span className="guide-card-title">4. Actionable Trader Playbooks</span>
                  </div>
                  <ul className="guide-card-bullets">
                    <li><strong>Long Diagonals / Calendars:</strong> Buy the cheap underhedged month/strike, finance by selling an expensive overhedged strike.</li>
                    <li><strong>Broken-Wing Butterflies:</strong> Buy the underhedged valley wing at a discount and sell adjacent overhedged strikes for credit.</li>
                    <li><strong>Skew Arbitrage:</strong> Exploit the smile dislocation by going long underpriced IV and short overpriced IV.</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Surface Hedging Distribution Spectrum Bar */}
          <div className="hedging-spectrum-wrap">
            <div className="spectrum-labels">
              <span className="spec-lbl-green">
                🟢 Underhedged Valleys: {data.hedging_diagnostics.counts?.underhedged} strikes ({data.hedging_diagnostics.percentages?.underhedged_pct}%) — Cheap Convexity
              </span>
              <span className="spec-lbl-slate">
                ⚖️ Fair Value Balanced: {data.hedging_diagnostics.counts?.balanced} strikes ({data.hedging_diagnostics.percentages?.balanced_pct}%)
              </span>
              <span className="spec-lbl-red">
                🔴 Overhedged Peaks: {data.hedging_diagnostics.counts?.overhedged} strikes ({data.hedging_diagnostics.percentages?.overhedged_pct}%) — Expensive Panic
              </span>
            </div>
            <div className="hedging-bar-track">
              <div 
                className="bar-segment bar-underhedged" 
                style={{ width: `${data.hedging_diagnostics.percentages?.underhedged_pct}%` }} 
                title="Underhedged: Cheap protection / convexity" 
              />
              <div 
                className="bar-segment bar-balanced" 
                style={{ width: `${data.hedging_diagnostics.percentages?.balanced_pct}%` }} 
                title="Balanced: Orderly fair value smile pricing" 
              />
              <div 
                className="bar-segment bar-overhedged" 
                style={{ width: `${data.hedging_diagnostics.percentages?.overhedged_pct}%` }} 
                title="Overhedged: Expensive crash puts / call FOMO" 
              />
            </div>
          </div>

          {/* Dealer Positioning & Flow Narrative */}
          <div className="hedging-dealer-insight">
            <div className="dealer-insight-title">
              <Cpu style={{ width: '15px', height: '15px', color: '#00F0FF' }} />
              <span>Dealer Gamma & Vanna Flow Dynamics:</span>
            </div>
            <p className="dealer-insight-text">
              {data.hedging_diagnostics.dealer_flow_insight}
            </p>
          </div>

          {/* Actionable Overhedged vs Underhedged Strike Targets */}
          <div className="hedging-targets-grid">
            <div className="hedging-target-col overhedged-col">
              <div className="col-header">
                <span className="col-tag red-tag">🔴 OVERHEDGED STRIKES (SELL VOL / CREDIT)</span>
                <span className="col-sub">Overpriced tail panic wings — Sell premium</span>
              </div>
              <div className="target-cards-list">
                {data.hedging_diagnostics.top_overhedged?.map((item, idx) => (
                  <div key={idx} className="target-micro-card">
                    <div className="tmc-top">
                      <span className="tmc-strike">${item.strike} {item.type === 'otm_put' ? 'PUT' : 'CALL'}</span>
                      <span className="tmc-exp">{item.expiry}</span>
                      <span className="tmc-edge">+{item.dislocation_pct}% Rich</span>
                    </div>
                    <div className="tmc-strat">{item.strategy}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="hedging-target-col underhedged-col">
              <div className="col-header">
                <span className="col-tag green-tag">🟢 UNDERHEDGED VALLEYS (BUY CONVEXITY)</span>
                <span className="col-sub">Depressed vol valleys & cheap wings — Buy gamma</span>
              </div>
              <div className="target-cards-list">
                {data.hedging_diagnostics.top_underhedged?.map((item, idx) => (
                  <div key={idx} className="target-micro-card">
                    <div className="tmc-top">
                      <span className="tmc-strike">${item.strike} {item.type === 'otm_put' ? 'PUT' : 'CALL'}</span>
                      <span className="tmc-exp">{item.expiry}</span>
                      <span className="tmc-edge green-edge">{item.dislocation_pct}% Cheap</span>
                    </div>
                    <div className="tmc-strat">{item.strategy}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

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

          {/* 30D REALIZED HV & VOL RISK PREMIUM (VRP) */}
          {(() => {
            const vrp = (desk_metrics?.atm_iv_30d !== undefined && desk_metrics?.realized_hv_30d !== undefined)
              ? Number((desk_metrics.atm_iv_30d - desk_metrics.realized_hv_30d).toFixed(1))
              : null;
            const vrpSign = vrp !== null ? (vrp >= 0 ? `+${vrp}%` : `${vrp}%`) : null;
            const isRich = vrp !== null && vrp > 1.5;
            const isCheap = vrp !== null && vrp < -1.5;
            return (
              <div className="vol-kpi-tile" title="30D Trailing Realized Volatility benchmark vs current 30D ATM Implied Volatility (Volatility Risk Premium)">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="vol-kpi-label">30D Realized HV</span>
                  {vrpSign && (
                    <span 
                      style={{
                        fontFamily: 'monospace',
                        fontSize: '9px',
                        fontWeight: 700,
                        padding: '1px 5px',
                        borderRadius: '4px',
                        background: isRich ? 'rgba(244, 63, 94, 0.15)' : (isCheap ? 'rgba(0, 230, 118, 0.15)' : 'rgba(251, 191, 36, 0.15)'),
                        color: isRich ? '#f43f5e' : (isCheap ? '#00E676' : '#fbbf24'),
                        border: `1px solid ${isRich ? 'rgba(244, 63, 94, 0.3)' : (isCheap ? 'rgba(0, 230, 118, 0.3)' : 'rgba(251, 191, 36, 0.3)')}`
                      }}
                    >
                      VRP {vrpSign}
                    </span>
                  )}
                </div>
                <span className="vol-kpi-val" style={{ color: '#38bdf8' }}>
                  {desk_metrics?.realized_hv_30d?.toFixed(1)}%
                </span>
                <span 
                  className="vol-kpi-sub"
                  style={{
                    color: isRich ? '#f43f5e' : (isCheap ? '#00E676' : '#94a3b8'),
                    fontWeight: isRich || isCheap ? 600 : 400
                  }}
                >
                  {isRich ? `${vrpSign} Overpriced (Sell Vol)` : (isCheap ? `${vrpSign} Cheap Vega (Buy Vol)` : 'Equilibrium (Fair Vol)')}
                </span>
              </div>
            );
          })()}

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
              onClick={() => { setActiveViewMode('3d_surface'); setSurfaceColor('Plasma'); }}
              className={`vol-view-btn ${activeViewMode === '3d_surface' && surfaceColor !== 'HedgingRegimes' ? 'active' : ''}`}
            >
              3D Vol Surface
            </button>
            <button
              onClick={() => { setActiveViewMode('3d_surface'); setSurfaceColor('HedgingRegimes'); }}
              className={`vol-view-btn ${activeViewMode === '3d_surface' && surfaceColor === 'HedgingRegimes' ? 'active' : ''}`}
              style={{
                borderColor: surfaceColor === 'HedgingRegimes' ? '#ef4444' : undefined,
                background: surfaceColor === 'HedgingRegimes' ? 'rgba(239, 68, 68, 0.22)' : undefined,
                color: surfaceColor === 'HedgingRegimes' ? '#f87171' : undefined,
                fontWeight: 800
              }}
            >
              🛡️ Overhedge / Underhedge 3D
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
            <button
              onClick={() => setActiveViewMode('heatmap')}
              className={`vol-view-btn ${activeViewMode === 'heatmap' ? 'active' : ''}`}
            >
              Vol Heatmap
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
            <div className="vol-legend-strip" style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
              <div className="vol-shading-quick-toggle" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.05)', padding: '2px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' }}>
                <button
                  type="button"
                  onClick={() => setSurfaceColor('Plasma')}
                  style={{
                    padding: '3px 8px',
                    borderRadius: '4px',
                    border: 'none',
                    background: surfaceColor !== 'HedgingRegimes' ? '#0284c7' : 'transparent',
                    color: surfaceColor !== 'HedgingRegimes' ? '#fff' : '#94a3b8',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  🌈 Raw IV
                </button>
                <button
                  type="button"
                  onClick={() => setSurfaceColor('HedgingRegimes')}
                  style={{
                    padding: '3px 8px',
                    borderRadius: '4px',
                    border: 'none',
                    background: surfaceColor === 'HedgingRegimes' ? 'linear-gradient(90deg, #ef4444, #10b981)' : 'transparent',
                    color: surfaceColor === 'HedgingRegimes' ? '#fff' : '#94a3b8',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  🛡️ Over/Under Regimes
                </button>
              </div>

              {/* Anti-Overlap 3D Pin Labels Toggle */}
              <button
                type="button"
                onClick={() => setShow3dLabels(prev => !prev)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '4px 9px',
                  borderRadius: '6px',
                  border: show3dLabels ? '1px solid rgba(0, 240, 255, 0.4)' : '1px solid rgba(255, 255, 255, 0.1)',
                  background: show3dLabels ? 'rgba(0, 240, 255, 0.12)' : 'rgba(255, 255, 255, 0.04)',
                  color: show3dLabels ? '#00F0FF' : '#94a3b8',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: "'JetBrains Mono', monospace"
                }}
                title="Toggle text labels on 3D pins to prevent clutter"
              >
                <span>🏷️ Labels: {show3dLabels ? 'ON' : 'OFF'}</span>
              </button>
              {surfaceColor === 'HedgingRegimes' ? (
                <>
                  <div className="vol-legend-item">
                    <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444', marginRight: '5px' }} />
                    🔴 Overhedged Peaks
                  </div>
                  <div className="vol-legend-item">
                    <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: '#334155', marginRight: '5px' }} />
                    ⚖️ Fair Value Smile
                  </div>
                  <div className="vol-legend-item">
                    <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: '#10b981', marginRight: '5px' }} />
                    🟢 Underhedged Valleys
                  </div>
                </>
              ) : (
                <>
                  <div className="vol-legend-item">
                    <span className="vol-legend-dot atm" /> ATM Spine
                  </div>
                  <div className="vol-legend-item">
                    <span className="vol-legend-dot overpriced" /> Overpriced
                  </div>
                  <div className="vol-legend-item">
                    <span className="vol-legend-dot underpriced" /> Underpriced
                  </div>
                </>
              )}
              {focusedHotspot && (
                <span className="vol-focus-badge">
                  🎯 Focus Locked: {focusedHotspot.expiry} (${focusedHotspot.strike})
                </span>
              )}
            </div>
          )}

          {activeViewMode === 'heatmap' && (
            <div className="vol-legend-strip">
              <div className="vol-legend-item">
                <span style={{ display: 'inline-block', width: '9px', height: '9px', borderRadius: '50%', border: '2px solid #00F0FF', marginRight: '5px' }} />
                🕳️ Air Pocket
              </div>
              <div className="vol-legend-item">
                <span style={{ display: 'inline-block', width: '12px', height: '2px', borderTop: '2px dashed #00F0FF', marginRight: '5px' }} />
                Spot Level (${spot?.toFixed(2)})
              </div>
              {focusedHotspot && (
                <span className="vol-focus-badge">
                  🎯 Target Locked: {focusedHotspot.expiry} (${focusedHotspot.strike})
                </span>
              )}
            </div>
          )}

          {/* 3D Surface & Heatmap Advanced Customizer Bar */}
          {(activeViewMode === '3d_surface' || activeViewMode === 'heatmap') && (
            <div className="vol-customizer-bar">
              {/* Camera Presets & Auto-Rotate (3D Surface only) */}
              {activeViewMode === '3d_surface' && (
                <div className="vol-camera-pills">
                  {Object.entries(CAMERA_PRESETS).map(([key, item]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleCameraPreset(key)}
                      className={`vol-camera-btn ${cameraPreset === key && !autoRotate ? 'active' : ''}`}
                      title={`Snap camera to ${item.label}`}
                    >
                      {item.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setAutoRotate(!autoRotate)}
                    className={`vol-rotate-btn ${autoRotate ? 'active' : ''}`}
                    title="Continuous 60fps turntable rotation"
                  >
                    <RotateCw size={11} className={autoRotate ? 'animate-spin' : ''} />
                    {autoRotate ? 'Orbiting' : 'Auto-Rotate'}
                  </button>
                </div>
              )}

              {/* Moneyness vs Strike Price Toggle */}
              <div className="vol-toggle-pill" title="Toggle nominal strike prices ($) vs normalized moneyness (K/S)">
                <button
                  type="button"
                  onClick={() => setStrikeMode('strike')}
                  className={`vol-toggle-btn ${strikeMode === 'strike' ? 'active' : ''}`}
                >
                  Strike ($)
                </button>
                <button
                  type="button"
                  onClick={() => setStrikeMode('moneyness')}
                  className={`vol-toggle-btn ${strikeMode === 'moneyness' ? 'active' : ''}`}
                >
                  Moneyness (K/S)
                </button>
              </div>

              {/* 3D Realized HV Reference Plane Toggle */}
              {activeViewMode === '3d_surface' && (
                <div className="vol-toggle-pill" title="Toggle 30D Realized Volatility horizontal reference floor plane">
                  <button
                    type="button"
                    onClick={() => setShowHvPlane(prev => !prev)}
                    className={`vol-toggle-btn ${showHvPlane ? 'active' : ''}`}
                  >
                    HV Floor: {showHvPlane ? 'ON' : 'OFF'}
                  </button>
                </div>
              )}

              {/* Heatmap Active Core Filter (Heatmap only) */}
              {activeViewMode === 'heatmap' && (
                <div className="vol-toggle-pill" title="Filter heatmap strike coverage">
                  <button
                    type="button"
                    onClick={() => setHeatmapFilter('core')}
                    className={`vol-toggle-btn ${heatmapFilter === 'core' ? 'active' : ''}`}
                  >
                    Core (±15%)
                  </button>
                  <button
                    type="button"
                    onClick={() => setHeatmapFilter('all')}
                    className={`vol-toggle-btn ${heatmapFilter === 'all' ? 'active' : ''}`}
                  >
                    Full Chain
                  </button>
                </div>
              )}

              {/* Color Palette Selector */}
              <div className="vol-customizer-pill">
                <span className="vol-customizer-lbl">
                  <Flame size={12} style={{ color: '#00F0FF' }} />
                  Color:
                </span>
                <select
                  value={surfaceColor}
                  onChange={(e) => setSurfaceColor(e.target.value)}
                  className="vol-customizer-select"
                >
                  {COLOR_PALETTES.map(pal => (
                    <option key={pal.id} value={pal.id}>{pal.label}</option>
                  ))}
                </select>
              </div>

              {/* Canvas Background Theme Selector */}
              <div className="vol-customizer-pill">
                <span className="vol-customizer-lbl">
                  <Layers size={12} style={{ color: '#00F0FF' }} />
                  Bg:
                </span>
                <select
                  value={surfaceBg}
                  onChange={(e) => setSurfaceBg(e.target.value)}
                  className="vol-customizer-select"
                >
                  {BG_THEMES.map(theme => (
                    <option key={theme.id} value={theme.id}>{theme.name}</option>
                  ))}
                </select>
              </div>

              {/* High-Res Chart Snapshot */}
              <button
                type="button"
                onClick={handleExportSnapshot}
                className="vol-snapshot-btn"
                title="Export high-resolution PNG snapshot of the current view"
              >
                <Camera size={12} />
                Snapshot
              </button>
            </div>
          )}
        </div>

        {/* Plotly Canvas Container */}
        <div 
          className="vol-canvas-container"
          style={{
            width: '100%',
            minHeight: '580px',
            background: surfaceBg,
            borderRadius: '12px',
            border: `1px solid ${surfaceBg === '#f8fafc' ? 'rgba(0,0,0,0.15)' : 'rgba(255, 255, 255, 0.08)'}`,
            overflow: 'hidden',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '8px',
            transition: 'background 0.3s ease'
          }}
        >
          <div ref={plotRef} style={{ width: '100%', minHeight: '560px' }} />
        </div>

        {/* AIR POCKET RADAR & DIRECTIVES (Rendered exclusively in Vol Heatmap view) */}
        {activeViewMode === 'heatmap' && detectedAirPockets.length > 0 && (
          <div className="vol-airpocket-deck">
            <div className="vol-airpocket-header">
              <div className="vol-airpocket-title-wrap">
                <span className="vol-airpocket-tag">
                  <Sparkles size={13} />
                  🕳️ AIR POCKET RADAR
                </span>
                <span style={{ fontFamily: 'monospace', fontSize: '12px', color: '#cbd5e1', fontWeight: 600 }}>
                  Implied Volatility Valleys & Cheap Vega Pockets (Trader Playbook)
                </span>
              </div>
              <span style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'monospace' }}>
                {detectedAirPockets.length} Convexity Pockets Detected
              </span>
            </div>

            <div className="vol-airpocket-grid">
              {detectedAirPockets.map((pocket, idx) => (
                <div key={pocket.id || idx} className="vol-airpocket-card">
                  <div>
                    <div className="vol-airpocket-top">
                      <div className="vol-airpocket-coords">
                        ${pocket.strike} Strike
                        <span className="sub">{pocket.expiry} · {pocket.moneyness}x Spot ({pocket.type === 'otm_call' ? 'Call Wing' : 'Put Wing'})</span>
                      </div>
                      <span className="vol-airpocket-discount-pill">
                        -{pocket.edge_pct}% IV Discount
                      </span>
                    </div>

                    <div style={{ margin: '8px 0', display: 'flex', gap: '10px', fontSize: '11px', fontFamily: 'monospace' }}>
                      <span style={{ color: '#00F0FF', fontWeight: 700 }}>Pocket IV: {pocket.iv}%</span>
                      <span style={{ color: '#64748b' }}>Benchmark: {pocket.benchmark_iv}%</span>
                    </div>

                    <div className="vol-airpocket-playbook">
                      <strong>Tactical Edge:</strong> {pocket.playbook}
                    </div>
                  </div>

                  <div className="vol-airpocket-actions">
                    <button
                      type="button"
                      onClick={() => {
                        setFocusedHotspot({ strike: pocket.strike, expiry: pocket.expiry, iv: pocket.iv });
                        if (surfaceCardRef.current) {
                          surfaceCardRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }
                      }}
                      className="vol-airpocket-btn"
                    >
                      <Crosshair size={12} />
                      Lock on Heatmap
                    </button>
                    <a
                      href="#trade-ideas-section"
                      onClick={(e) => {
                        e.preventDefault();
                        const matching = actionable_setups.find(s => 
                          s.expiry?.includes(pocket.expiry) || 
                          (pocket.type === 'otm_call' ? s.name?.includes('Call') || s.action === 'CALL FLY' : s.name?.includes('Put') || s.action === 'CREDIT SPREAD')
                        ) || actionable_setups[0];
                        if (matching) {
                          setHighlightedSetupId(matching.id);
                          setExpandedSetupId(matching.id);
                        }
                        const el = document.getElementById('trade-ideas-section');
                        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }}
                      className="vol-airpocket-btn trade"
                    >
                      Trade Setups ↓
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
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
                              onClick={() => {
                                setExpandedSetupId(isExpanded ? null : (setup.id || idx));
                                setHighlightedSetupId(setup.id || idx);
                              }}
                              className={`vol-matrix-tr ${isExpanded ? 'expanded' : ''} ${highlightedSetupId === (setup.id || idx) ? 'vol-highlighted-row' : ''}`}
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
