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

const HORIZON_OPTIONS = [
  { id: '1M', label: '1 Month', short: '1M', maxDte: 35, desc: 'Near-Term Weekly & Monthly Gamma (≤35 DTE)' },
  { id: '3M', label: '3 Months', short: '3M', maxDte: 100, desc: 'Quarterly Earnings & Swing Horizon (≤100 DTE)' },
  { id: '6M', label: '6 Months', short: '6M', maxDte: 195, desc: 'Semi-Annual Structural Horizon (≤195 DTE)' },
  { id: '1Y', label: '1 Year', short: '1Y', maxDte: 390, desc: '1-Year Institutional Curve (≤390 DTE)' },
  { id: '2Y', label: '2 Years', short: '2Y', maxDte: 800, desc: '1–2 Year Multi-Cycle LEAPS Manifold (≤800 DTE)' },
  { id: 'ALL', label: 'All LEAPS', short: 'ALL', maxDte: 9999, desc: 'Full Available Multi-Year Option Chain' }
];

const VolatilitySurface3D = ({ ticker = 'SPY' }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [tenorHorizon, setTenorHorizon] = useState('2Y'); // '1M' | '3M' | '6M' | '1Y' | '2Y' | 'ALL'
  const [selectedExpiry, setSelectedExpiry] = useState('All');
  const [activeViewMode, setActiveViewMode] = useState('3d_surface'); // '3d_surface' | 'heatmap' | '2d_skew' | 'term_structure'
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

  // Dynamically slice surface, term structure, hotspots, and hedging diagnostics to the chosen Tenor Horizon (1M, 3M, 6M, 1Y, 2Y, ALL)
  const horizonData = useMemo(() => {
    if (!data || !data.surface || data.surface.length === 0) return data;

    const horizonMeta = HORIZON_OPTIONS.find(h => h.id === tenorHorizon) || HORIZON_OPTIONS[4];
    const maxDte = horizonMeta.maxDte;

    const allTerm = data.term_structure || [];
    let candidateTerm = allTerm.filter(t => (t.dte ?? 30) <= maxDte);
    if (candidateTerm.length < 2 && allTerm.length >= 2) {
      candidateTerm = allTerm.slice(0, 2);
    }

    // Count strike coverage per expiration so we prefer standard liquid monthly OpEx over thin weekly/EOM stubs when sampling for 3D surface
    const strikeCountByExp = new Map();
    data.surface.forEach(p => {
      strikeCountByExp.set(p.expiry, (strikeCountByExp.get(p.expiry) || 0) + 1);
    });

    // Select up to 9 evenly-spaced benchmark tenors specifically for the 3D Surface mesh so it stays silky smooth,
    // while keeping ALL candidateTerm expirations for the 2D Term Structure and 2D Skew dropdown!
    const targetTenorCount = tenorHorizon === '1M' ? 7 : (tenorHorizon === '3M' ? 8 : 9);
    let surfaceTerm = candidateTerm;
    if (candidateTerm.length > targetTenorCount) {
      const selectedIndices = new Set([0, candidateTerm.length - 1]);
      // Always preserve the peak ATM IV tenor (e.g. earnings event spike) so 3D surface never misses it
      let peakIdx = 0;
      for (let i = 1; i < candidateTerm.length; i++) {
        if ((candidateTerm[i].atm_iv || 0) > (candidateTerm[peakIdx].atm_iv || 0)) {
          peakIdx = i;
        }
      }
      selectedIndices.add(peakIdx);

      const minD = candidateTerm[0].dte || 1;
      const maxD = candidateTerm[candidateTerm.length - 1].dte || maxDte;

      for (let k = 1; k < targetTenorCount - 1; k++) {
        if (selectedIndices.size >= targetTenorCount) break;
        const targetDte = minD + ((maxD - minD) * (k / (targetTenorCount - 1)));
        let bestIdx = Math.round((k * (candidateTerm.length - 1)) / (targetTenorCount - 1));
        let bestScore = Infinity;

        for (let idx = 1; idx < candidateTerm.length - 1; idx++) {
          if (selectedIndices.has(idx)) continue;
          const dteDist = Math.abs((candidateTerm[idx].dte || 30) - targetDte);
          const coverageBonus = Math.min(20, (strikeCountByExp.get(candidateTerm[idx].expiry) || 20) * 0.1);
          const score = dteDist - coverageBonus * 0.15;
          if (score < bestScore) {
            bestScore = score;
            bestIdx = idx;
          }
        }
        selectedIndices.add(bestIdx);
      }
      surfaceTerm = Array.from(selectedIndices)
        .sort((a, b) => a - b)
        .map(idx => candidateTerm[idx]);
    }

    const fullHorizonExpiries = new Set(candidateTerm.map(t => t.expiry));
    const surfaceExpiriesList = surfaceTerm.map(t => t.expiry);
    let filteredSurface = data.surface.filter(p =>
      fullHorizonExpiries.size > 0 ? fullHorizonExpiries.has(p.expiry) : (p.dte ?? 30) <= maxDte
    );
    if (filteredSurface.length === 0) {
      filteredSurface = data.surface;
    }

    const activeExpirySet = new Set(filteredSurface.map(p => p.expiry));
    const filteredHotspots = (data.hotspots || [])
      .filter(h => activeExpirySet.has(h.expiry))
      .sort((a, b) => (b.edge_pct || 0) - (a.edge_pct || 0))
      .slice(0, 6);

    // Recompute horizon-scoped hedging diagnostics counts & top pins
    let updatedHedging = data.hedging_diagnostics;
    if (data.hedging_diagnostics) {
      const overCount = filteredSurface.filter(p => p.hedge_state === 'overhedged').length;
      const underCount = filteredSurface.filter(p => p.hedge_state === 'underhedged').length;
      const balCount = filteredSurface.filter(p => p.hedge_state === 'balanced').length;
      const totalPts = filteredSurface.length || 1;

      const overPool = data.hedging_diagnostics.all_overhedged || data.hedging_diagnostics.top_overhedged || [];
      const underPool = data.hedging_diagnostics.all_underhedged || data.hedging_diagnostics.top_underhedged || [];

      const topOverFiltered = overPool.filter(p => activeExpirySet.has(p.expiry)).slice(0, 4);
      const topUnderFiltered = underPool.filter(p => activeExpirySet.has(p.expiry)).slice(0, 4);

      updatedHedging = {
        ...data.hedging_diagnostics,
        counts: {
          overhedged: overCount,
          underhedged: underCount,
          balanced: balCount,
          total: filteredSurface.length
        },
        percentages: {
          overhedged_pct: Number(((overCount / totalPts) * 100).toFixed(1)),
          underhedged_pct: Number(((underCount / totalPts) * 100).toFixed(1)),
          balanced_pct: Number(((balCount / totalPts) * 100).toFixed(1))
        },
        top_overhedged: topOverFiltered,
        top_underhedged: topUnderFiltered
      };
    }

    // Recompute event-aware & stub-aware term structure slope across the selected horizon
    let updatedMetrics = { ...(data.desk_metrics || {}) };
    if (candidateTerm.length >= 2) {
      const ivs = candidateTerm.map(t => t.atm_iv);
      const dtes = candidateTerm.map(t => t.dte || 30);
      const backIv = ivs[ivs.length - 1];
      const peakIv = Math.max(...ivs);
      const peakIdx = ivs.indexOf(peakIv);
      const peakDte = dtes[peakIdx];
      const isEventSpike = peakDte <= 35 && peakIv >= backIv + 3.0 && peakIdx < ivs.length - 1;

      let horizonSlope = 0;
      if (isEventSpike) {
        horizonSlope = Number((backIv - peakIv).toFixed(2));
      } else {
        const liquidFront = candidateTerm.find(t => (t.dte || 0) >= 5 && (t.dte || 0) <= 18);
        const effFront = liquidFront ? liquidFront.atm_iv : (dtes[0] <= 3 && ivs.length > 1 ? ivs[1] : ivs[0]);
        horizonSlope = Number((backIv - effFront).toFixed(2));
      }
      updatedMetrics.term_structure_slope = horizonSlope;
      updatedMetrics.term_structure_regime = horizonSlope < -1.2 ? 'Backwardation' : (horizonSlope > 1.2 ? 'Contango' : 'Flat');
    }

    const maxDteActual = candidateTerm.length > 0
      ? candidateTerm[candidateTerm.length - 1].dte
      : Math.max(...filteredSurface.map(p => p.dte || 30));
    const minDteActual = candidateTerm.length > 0
      ? candidateTerm[0].dte
      : Math.min(...filteredSurface.map(p => p.dte || 1));

    return {
      ...data,
      surface: filteredSurface,
      term_structure: candidateTerm,
      surface_expirations: surfaceExpiriesList,
      hotspots: filteredHotspots,
      hedging_diagnostics: updatedHedging,
      desk_metrics: updatedMetrics,
      horizon_meta: {
        ...horizonMeta,
        expiries_count: candidateTerm.length,
        surface_tenors_count: surfaceExpiriesList.length,
        total_in_horizon: candidateTerm.length,
        total_expiries_available: new Set(data.surface.map(p => p.expiry)).size,
        min_dte: minDteActual,
        max_dte: maxDteActual
      }
    };
  }, [data, tenorHorizon]);

  // Algorithmic Air Pocket Scanner (Cheapest Volatility Valleys across the Active Horizon Surface)
  const detectedAirPockets = useMemo(() => {
    const activeData = horizonData || data;
    if (!activeData || !activeData.surface || activeData.surface.length === 0) return [];

    const spotPrice = activeData.spot || 100;
    const underpriced = (activeData.hotspots || [])
      .filter(h => h.type === 'underpriced')
      .map(h => ({
        id: h.id || `pocket-${h.expiry}-${h.strike}`,
        expiry: h.expiry,
        strike: h.strike,
        iv: h.iv,
        benchmark_iv: h.benchmark_iv || (activeData.desk_metrics?.atm_iv_30d || 25.0),
        edge_pct: h.edge_pct || 20.0,
        type: h.strike < spotPrice ? 'otm_put' : 'otm_call',
        moneyness: (h.strike / spotPrice).toFixed(2),
        playbook: h.strike < spotPrice 
          ? `Downside wing depression. Buy $${h.strike}P put calendar or debit spread; sell higher strike puts to harvest cheap tail convexity.`
          : `Upside call wing depression. Buy $${h.strike}C call spread or broken-wing fly; capture upside expansion at steep vega discount.`
      }));

    // Find genuine model-calibrated air pockets (depressed vol valleys)
    const valleys = [];
    (activeData.surface || []).forEach(p => {
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
  }, [horizonData, data]);

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
        if (!response.ok) {
          const errData = await response.json().catch(() => null);
          throw new Error(errData?.error || `HTTP ${response.status}: Failed to load volatility surface for ${ticker}`);
        }
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
    const activeData = horizonData || data;
    if (!activeData || !activeData.surface || activeData.surface.length === 0 || !plotRef.current || !window.Plotly) {
      return;
    }

    try {
      window.Plotly.purge(plotRef.current);
    } catch (e) {
      // ignore
    }

    const { spot, surface, term_structure = [], hotspots = [] } = activeData;
    const allExpirations = [...new Set(surface.map(item => item.expiry))].sort();
    const rawStrikes = [...new Set(surface.map(item => item.strike))].sort((a,b) => a - b);

    if (activeViewMode === '3d_surface') {
      const expirations = (activeData.surface_expirations && activeData.surface_expirations.length >= 2)
        ? activeData.surface_expirations
        : allExpirations;
      // 1. BUILD CLEAN INSTITUTIONAL 3D VOLATILITY SURFACE MANIFOLD
      // Restrict 3D surface strike axis to the liquid core band (±15% around spot) and ~26 evenly-spaced strike nodes
      // so 300+ multi-year strikes never create a dense wireframe "mash" or flat boundary shelves.
      const coreBandPct = tenorHorizon === '1M' ? 0.12 : (tenorHorizon === '3M' ? 0.15 : 0.18);
      let coreStrikes = spot
        ? rawStrikes.filter(s => Math.abs(s - spot) / spot <= coreBandPct)
        : rawStrikes;
      if (coreStrikes.length < 8) {
        coreStrikes = rawStrikes;
      }

      const maxGridStrikes = 26;
      let strikes = coreStrikes;
      if (coreStrikes.length > maxGridStrikes) {
        const sampled = new Set();
        for (let k = 0; k < maxGridStrikes; k++) {
          const idx = Math.round((k * (coreStrikes.length - 1)) / (maxGridStrikes - 1));
          sampled.add(coreStrikes[idx]);
        }
        // Always include the strike closest to ATM spot
        if (spot) {
          const atmSt = coreStrikes.reduce((prev, curr) => Math.abs(curr - spot) < Math.abs(prev - spot) ? curr : prev, coreStrikes[0]);
          sampled.add(atmSt);
        }
        strikes = Array.from(sampled).sort((a, b) => a - b);
      }

      // Group points by expiration sorted by strike for continuous smile interpolation
      const ptsByExp = new Map();
      expirations.forEach(exp => ptsByExp.set(exp, []));
      surface.forEach(p => {
        if (p && p.expiry && ptsByExp.has(p.expiry)) {
          ptsByExp.get(p.expiry).push(p);
        }
      });
      ptsByExp.forEach(arr => arr.sort((a, b) => a.strike - b.strike));

      // Helper to evaluate IV & dislocation at any strike along an expiration's smile
      const evalExpAtStrike = (exp, targetStrike) => {
        const arr = ptsByExp.get(exp) || [];
        if (arr.length === 0) return null;
        // Exact or very close match
        for (let i = 0; i < arr.length; i++) {
          if (Math.abs(arr[i].strike - targetStrike) < 1e-4) {
            return arr[i];
          }
        }
        // If outside this expiration's traded strike range, return null so vertical tenor interpolation handles it smoothly
        if (targetStrike < arr[0].strike || targetStrike > arr[arr.length - 1].strike) {
          return null;
        }
        // Linear interpolation between bracketing strikes on this expiration
        for (let i = 0; i < arr.length - 1; i++) {
          const left = arr[i];
          const right = arr[i + 1];
          if (targetStrike >= left.strike && targetStrike <= right.strike) {
            const w = (right.strike - left.strike) > 0 ? (targetStrike - left.strike) / (right.strike - left.strike) : 0;
            const iv = Number((left.iv + w * (right.iv - left.iv)).toFixed(2));
            const fit_iv = Number(((left.fit_iv || left.iv) + w * ((right.fit_iv || right.iv) - (left.fit_iv || left.iv))).toFixed(2));
            const dislocation_pct = Number(((left.dislocation_pct || 0) + w * ((right.dislocation_pct || 0) - (left.dislocation_pct || 0))).toFixed(1));
            return {
              expiry: exp,
              dte: left.dte,
              strike: targetStrike,
              iv,
              fit_iv,
              dislocation_pct,
              type: targetStrike < (spot || left.strike) ? 'otm_put' : 'otm_call',
              hedge_label: dislocation_pct >= 5 ? 'OVERHEDGED (Rich)' : (dislocation_pct <= -5 ? 'UNDERHEDGED (Cheap)' : 'BALANCED (Fair Value)')
            };
          }
        }
        return null;
      };

      const evalGrid = expirations.map(exp => strikes.map(st => evalExpAtStrike(exp, st)));
      let zData = evalGrid.map(row => row.map(cell => (cell ? cell.iv : null)));

      // Build a reference mean smile profile across strikes from expirations that cover each strike
      const defaultIv = (activeData.desk_metrics && activeData.desk_metrics.atm_iv_30d) || 25.0;
      const refProfile = strikes.map((_, j) => {
        const vals = [];
        for (let i = 0; i < expirations.length; i++) {
          if (zData[i][j] !== null && !isNaN(zData[i][j])) vals.push(zData[i][j]);
        }
        return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : defaultIv;
      });

      // Smoothly fill any missing outer wings on narrower near-term expirations by anchoring to that
      // expiration's outermost valid strike and following the reference smile slope (zero cliffs, zero flat shelves)
      for (let i = 0; i < expirations.length; i++) {
        let firstValidIdx = -1;
        let lastValidIdx = -1;
        for (let j = 0; j < strikes.length; j++) {
          if (zData[i][j] !== null && !isNaN(zData[i][j])) {
            if (firstValidIdx === -1) firstValidIdx = j;
            lastValidIdx = j;
          }
        }
        if (firstValidIdx === -1) {
          for (let j = 0; j < strikes.length; j++) zData[i][j] = refProfile[j];
          continue;
        }
        // Fill left wing (lower strikes) preserving continuous slope from firstValidIdx
        for (let j = firstValidIdx - 1; j >= 0; j--) {
          const slopeDelta = refProfile[j] - refProfile[j + 1];
          zData[i][j] = Math.max(5.0, zData[i][j + 1] + slopeDelta * 0.85);
        }
        // Fill right wing (higher strikes) preserving continuous slope from lastValidIdx
        for (let j = lastValidIdx + 1; j < strikes.length; j++) {
          const slopeDelta = refProfile[j] - refProfile[j - 1];
          zData[i][j] = Math.max(5.0, zData[i][j - 1] + slopeDelta * 0.85);
        }
        // Fill any internal gaps linearly
        let prevIdx = firstValidIdx;
        for (let j = firstValidIdx + 1; j <= lastValidIdx; j++) {
          if (zData[i][j] !== null && !isNaN(zData[i][j])) {
            if (j > prevIdx + 1) {
              const startV = zData[i][prevIdx];
              const endV = zData[i][j];
              for (let k = prevIdx + 1; k < j; k++) {
                zData[i][k] = startV + ((endV - startV) * (k - prevIdx)) / (j - prevIdx);
              }
            }
            prevIdx = j;
          }
        }
      }

      // Gentle 2-pass Savitzky-Golay / Gaussian smoothing kernel to produce a silky institutional manifold
      for (let pass = 0; pass < 2; pass++) {
        const nextZ = zData.map(row => [...row]);
        for (let i = 0; i < expirations.length; i++) {
          for (let j = 0; j < strikes.length; j++) {
            const c = zData[i][j];
            const l = j > 0 ? zData[i][j - 1] : c;
            const r = j < strikes.length - 1 ? zData[i][j + 1] : c;
            const u = i > 0 ? zData[i - 1][j] : c;
            const d = i < expirations.length - 1 ? zData[i + 1][j] : c;
            nextZ[i][j] = Number((0.50 * c + 0.17 * l + 0.17 * r + 0.08 * u + 0.08 * d).toFixed(2));
          }
        }
        zData = nextZ;
      }

      const xValues = strikeMode === 'moneyness' 
        ? strikes.map(s => +(s / (spot || 1)).toFixed(3)) 
        : strikes;
      const xAxisTitle = strikeMode === 'moneyness' ? 'Moneyness (K/S)' : 'Strike Price ($)';

      const currentBg = BG_THEMES.find(t => t.id === surfaceBg) || BG_THEMES[0];

      let surfaceColorscale = surfaceColor;
      let surfaceColorMatrix = undefined;
      let cminVal = undefined;
      let cmaxVal = undefined;
      let colorbarTitle = 'Implied Vol (%)';

      if (surfaceColor === 'HedgingRegimes') {
        surfaceColorMatrix = expirations.map((exp, i) => {
          return strikes.map((st, j) => {
            const cell = evalGrid[i][j];
            return cell ? (cell.dislocation_pct || 0) : 0;
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
      const hoverTextMatrix = expirations.map((exp, i) => {
        return strikes.map((st, j) => {
          const p = evalGrid[i][j];
          const surfIv = zData[i][j];
          if (!p) {
            return `<b>Strike: $${st}</b> (${(st / (spot || 1)).toFixed(2)}x Spot)<br>Tenor: ${exp}<br>Surface IV: <b>${surfIv}%</b>`;
          }
          const dis = p.dislocation_pct !== undefined ? (p.dislocation_pct > 0 ? `+${p.dislocation_pct}%` : `${p.dislocation_pct}%`) : '0%';
          const state = p.hedge_label || 'BALANCED (Fair Value)';
          const fit = p.fit_iv || surfIv;
          const optType = p.type === 'otm_put' ? 'PUT' : (p.type === 'otm_call' ? 'CALL' : 'ATM');
          return `<b>${optType} $${st}</b> (${(st / (spot || 1)).toFixed(2)}x Spot)<br>` +
                 `Tenor: ${p.expiry} (${p.dte}d)<br>` +
                 `Market IV: <b>${surfIv}%</b><br>` +
                 `Smile Baseline: ${fit}%<br>` +
                 `Dislocation: <b>${dis}</b><br>` +
                 `State: <b>${state}</b>`;
        });
      });

      // Base 3D Surface with HD Mesh Lighting & Subtle Institutional Contour Lines
      const baseSurfaceTrace = {
        type: 'surface',
        z: zData,
        x: xValues,
        y: expirations,
        colorscale: surfaceColorscale,
        showscale: true,
        opacity: 0.93,
        lighting: {
          ambient: 0.85,
          diffuse: 0.90,
          fresnel: 0.25,
          specular: 0.45,
          roughness: 0.32
        },
        hoverinfo: 'text',
        text: hoverTextMatrix,
        colorbar: { 
          title: { text: colorbarTitle, font: { color: currentBg.text, family: 'monospace', size: 11 } }, 
          tickfont: { color: currentBg.text, family: 'monospace', size: 10 },
          len: 0.78,
          thickness: 14,
          xpad: 10
        },
        contours: {
          x: { show: true, color: 'rgba(255, 255, 255, 0.08)', width: 1 },
          y: { show: true, color: 'rgba(255, 255, 255, 0.12)', width: 1 },
          z: { show: true, usecolormap: true, highlightcolor: '#00F0FF', project: { z: true }, width: 1 }
        }
      };

      if (surfaceColor === 'HedgingRegimes' && surfaceColorMatrix) {
        baseSurfaceTrace.surfacecolor = surfaceColorMatrix;
        baseSurfaceTrace.cmin = cminVal;
        baseSurfaceTrace.cmax = cmaxVal;
      }

      const plotData = [baseSurfaceTrace];

      // Helper to get smoothed surface Z height at any (expiry, strike) within the 3D grid
      const minGridStrike = strikes[0];
      const maxGridStrike = strikes[strikes.length - 1];
      const expSet = new Set(expirations);
      const getSurfaceZAt = (exp, strikeVal, fallbackIv) => {
        const eIdx = expirations.indexOf(exp);
        if (eIdx === -1) return fallbackIv;
        // Find bracketing strikes in `strikes`
        for (let j = 0; j < strikes.length - 1; j++) {
          if (strikeVal >= strikes[j] && strikeVal <= strikes[j + 1]) {
            const w = (strikes[j + 1] - strikes[j]) > 0 ? (strikeVal - strikes[j]) / (strikes[j + 1] - strikes[j]) : 0;
            return zData[eIdx][j] + w * (zData[eIdx][j + 1] - zData[eIdx][j]);
          }
        }
        return fallbackIv;
      };

      // Floating 3D Overhedge / Underhedge Radar Callout Pins (Strictly Clamped to Core Surface Grid & Deduplicated)
      const rawTopOver = activeData.hedging_diagnostics?.top_overhedged || [];
      const rawTopUnder = activeData.hedging_diagnostics?.top_underhedged || [];
      const topOver = rawTopOver
        .filter(h => expSet.has(h.expiry) && h.strike >= minGridStrike && h.strike <= maxGridStrike)
        .slice(0, 3);
      const topUnder = rawTopUnder
        .filter(h => expSet.has(h.expiry) && h.strike >= minGridStrike && h.strike <= maxGridStrike)
        .slice(0, 3);

      const overPositions = ['top center', 'top right', 'top left'];
      const underPositions = ['bottom center', 'bottom left', 'bottom right'];

      if (topOver.length > 0) {
        plotData.push({
          type: 'scatter3d',
          mode: show3dLabels ? 'markers+text' : 'markers',
          name: '🔴 Overhedged Peaks',
          x: topOver.map(h => strikeMode === 'moneyness' ? +(h.strike / (spot || 1)).toFixed(3) : h.strike),
          y: topOver.map(h => h.expiry),
          z: topOver.map(h => +(getSurfaceZAt(h.expiry, h.strike, h.iv) + 0.6).toFixed(2)),
          text: topOver.map(h => `$${h.strike} (+${Math.round(h.dislocation_pct)}%)`),
          textposition: topOver.map((_, idx) => overPositions[idx % overPositions.length]),
          textfont: { color: '#f87171', family: "'JetBrains Mono', monospace", size: 11, weight: 'bold' },
          hoverinfo: 'text',
          hovertext: topOver.map(h => 
            `<b>🔴 OVERHEDGED PEAK (Rich Premium)</b><br>` +
            `Strike: <b>$${h.strike}</b> (${h.type === 'otm_put' ? 'PUT' : 'CALL'})<br>` +
            `Expiry: <b>${h.expiry}</b><br>` +
            `Market IV: <b>${h.iv}%</b> (Baseline: ${h.fit_iv || h.iv}%)<br>` +
            `Dislocation: <b>+${h.dislocation_pct}% Rich</b><br>` +
            `<i>Strategy: ${h.strategy || 'Sell Vol / Credit Spread'}</i>`
          ),
          marker: { size: 7, color: '#ef4444', symbol: 'diamond', line: { color: '#ffffff', width: 1.5 } }
        });
      }

      if (topUnder.length > 0) {
        plotData.push({
          type: 'scatter3d',
          mode: show3dLabels ? 'markers+text' : 'markers',
          name: '🟢 Underhedged Valleys',
          x: topUnder.map(h => strikeMode === 'moneyness' ? +(h.strike / (spot || 1)).toFixed(3) : h.strike),
          y: topUnder.map(h => h.expiry),
          z: topUnder.map(h => +(getSurfaceZAt(h.expiry, h.strike, h.iv) - 0.5).toFixed(2)),
          text: topUnder.map(h => `$${h.strike} (${Math.round(h.dislocation_pct)}%)`),
          textposition: topUnder.map((_, idx) => underPositions[idx % underPositions.length]),
          textfont: { color: '#4ade80', family: "'JetBrains Mono', monospace", size: 11, weight: 'bold' },
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
          marker: { size: 7, color: '#10b981', symbol: 'diamond', line: { color: '#ffffff', width: 1.5 } }
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
          opacity: 0.20,
          colorscale: [[0, '#38bdf8'], [1, '#38bdf8']],
          hoverinfo: 'text',
          text: [
            [planeLabel, planeLabel],
            [planeLabel, planeLabel]
          ]
        });
      }

      // Golden ATM Ridge Line (snapped to the smoothed surface spine)
      if (term_structure.length > 0 && spot) {
        const clampedSpot = Math.min(maxGridStrike, Math.max(minGridStrike, spot));
        const atmX = strikeMode === 'moneyness' ? 1.00 : clampedSpot;
        const ridgeTerms = term_structure.filter(ts => expSet.has(ts.expiry));
        if (ridgeTerms.length > 0) {
          plotData.push({
            type: 'scatter3d',
            mode: 'lines+markers',
            name: 'ATM Ridge Spine',
            x: ridgeTerms.map(() => atmX),
            y: ridgeTerms.map(ts => ts.expiry),
            z: ridgeTerms.map(ts => +(getSurfaceZAt(ts.expiry, clampedSpot, ts.atm_iv) + 0.25).toFixed(2)),
            line: { color: '#fbbf24', width: 5 },
            marker: { size: 4, color: '#fbbf24' }
          });
        }
      }

      // If a trade setup is focused, render an illuminated radar target marker clamped to the grid
      if (focusedHotspot && focusedHotspot.strike) {
        const matchedExpiry = expirations.find(e => e === focusedHotspot.expiry) || expirations[0];
        const clampedFocusStrike = Math.min(maxGridStrike, Math.max(minGridStrike, focusedHotspot.strike));
        if (matchedExpiry) {
          plotData.push({
            type: 'scatter3d',
            mode: 'markers+text',
            name: '🎯 Target Lock',
            x: [strikeMode === 'moneyness' ? +(clampedFocusStrike / (spot || 1)).toFixed(3) : clampedFocusStrike],
            y: [matchedExpiry],
            z: [+(getSurfaceZAt(matchedExpiry, clampedFocusStrike, focusedHotspot.iv || 20) + 0.8).toFixed(2)],
            text: [`🎯 $${focusedHotspot.strike}`],
            textposition: 'top center',
            textfont: { color: '#00F0FF', family: 'monospace', size: 12 },
            marker: { size: 10, color: '#00F0FF', symbol: 'cross', line: { color: '#ffffff', width: 2 } }
          });
        }
      }

      const cameraEye = focusedHotspot
        ? { x: 1.15, y: 1.15, z: 0.82 }
        : (CAMERA_PRESETS[cameraPreset]?.eye || { x: 1.55, y: 1.55, z: 0.68 });

      const layout = {
        autosize: true,
        height: 640,
        margin: { l: 0, r: 0, b: 0, t: 0 },
        paper_bgcolor: 'transparent',
        plot_bgcolor: 'transparent',
        showlegend: true,
        legend: { 
          font: { color: '#ffffff', family: "'JetBrains Mono', monospace", size: 11, weight: 'bold' }, 
          x: 0.01, 
          y: 0.99,
          bgcolor: 'rgba(15, 23, 42, 0.82)',
          bordercolor: 'rgba(255, 255, 255, 0.12)',
          borderwidth: 1
        },
        scene: {
          aspectmode: 'manual',
          aspectratio: { x: 1.35, y: 1.25, z: 0.72 },
          xaxis: { 
            title: { text: xAxisTitle, font: { color: '#00F0FF', size: 12, family: "'JetBrains Mono', monospace", weight: 'bold' } }, 
            gridcolor: 'rgba(255, 255, 255, 0.10)', 
            color: '#f8fafc', 
            tickfont: { family: "'JetBrains Mono', monospace", color: '#cbd5e1', size: 10 },
            backgroundcolor: 'rgba(15, 23, 42, 0.45)',
            showbackground: true
          },
          yaxis: { 
            title: { text: 'Expiration Tenor', font: { color: '#00F0FF', size: 12, family: "'JetBrains Mono', monospace", weight: 'bold' } }, 
            gridcolor: 'rgba(255, 255, 255, 0.10)', 
            color: '#f8fafc', 
            tickfont: { family: "'JetBrains Mono', monospace", color: '#cbd5e1', size: 10 },
            backgroundcolor: 'rgba(15, 23, 42, 0.45)',
            showbackground: true
          },
          zaxis: { 
            title: { text: 'Implied Volatility (%)', font: { color: '#00F0FF', size: 12, family: "'JetBrains Mono', monospace", weight: 'bold' } }, 
            gridcolor: 'rgba(255, 255, 255, 0.10)', 
            color: '#f8fafc', 
            tickfont: { family: "'JetBrains Mono', monospace", color: '#cbd5e1', size: 10 },
            backgroundcolor: 'rgba(15, 23, 42, 0.45)',
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
      // 2. BUILD INSTITUTIONAL 2D VOLATILITY SKEW SLICE (+ MULTI-TENOR BENCHMARK OVERLAY)
      const expirations = allExpirations;
      const bench30Term = term_structure.length > 0
        ? term_structure.reduce((prev, curr) => Math.abs((curr.dte || 30) - 30) < Math.abs((prev.dte || 30) - 30) ? curr : prev, term_structure[0])
        : null;
      const defaultBenchmarkExp = bench30Term?.expiry || expirations[Math.min(2, expirations.length - 1)] || expirations[0];
      const isMultiTenorMode = selectedExpiry === 'All' || !expirations.includes(selectedExpiry);
      const activeExp = isMultiTenorMode ? defaultBenchmarkExp : selectedExpiry;
      const activeTermMeta = term_structure.find(t => t.expiry === activeExp);

      // Filter to liquid tradable core band (±22% of spot) so deep illiquid LEAPS tails don't squash the smile
      const filterCoreBand = (pts) => {
        const sorted = [...pts].sort((a, b) => a.strike - b.strike);
        if (!spot || sorted.length <= 10) return sorted;
        const core = sorted.filter(p => Math.abs(p.strike - spot) / spot <= 0.22);
        return core.length >= 6 ? core : sorted;
      };

      const filtered = filterCoreBand(surface.filter(p => p.expiry === activeExp));
      const hvLevel = activeData.desk_metrics?.realized_hv_30d;

      const plotData = [
        {
          x: filtered.map(p => p.strike),
          y: filtered.map(p => p.iv),
          type: 'scatter',
          mode: 'lines+markers',
          name: `Market Smile (${activeExp}${activeTermMeta?.dte ? ` · ${activeTermMeta.dte}D` : ''})`,
          line: { color: '#00F0FF', width: 3.5, shape: 'spline', smoothing: 0.6 },
          marker: { 
            size: 7, 
            color: filtered.map(p => p.hedge_state === 'overhedged' ? '#ef4444' : (p.hedge_state === 'underhedged' ? '#10b981' : '#00F0FF')),
            line: { color: '#0f172a', width: 1 }
          },
          text: filtered.map(p => (
            `<b>Strike $${p.strike} (${p.type === 'otm_put' ? 'OTM PUT' : (p.type === 'otm_call' ? 'OTM CALL' : 'ATM')})</b><br>` +
            `Tenor: ${p.expiry} (${p.dte}D)<br>` +
            `Market IV: <b>${p.iv}%</b> | Wing-Damped Baseline: <b>${p.fit_iv || p.iv}%</b><br>` +
            `Dislocation: <b>${p.dislocation_pct > 0 ? `+${p.dislocation_pct}%` : `${p.dislocation_pct || 0}%`}</b> (${p.hedge_label || 'Balanced'})`
          )),
          hoverinfo: 'text'
        },
        {
          x: filtered.map(p => p.strike),
          y: filtered.map(p => p.fit_iv || p.iv),
          type: 'scatter',
          mode: 'lines',
          name: `Fair Smile Fit`,
          line: { color: 'rgba(255, 255, 255, 0.45)', width: 2, dash: 'dash' },
          hoverinfo: 'none'
        }
      ];

      // In 'All' (Multi-Tenor Benchmark) mode, overlay Front (~10D), Quarter (~90D), and Long (~250D) reference smiles
      const allYValues = [...filtered.map(p => p.iv), ...filtered.map(p => p.fit_iv || p.iv)];
      if (isMultiTenorMode && term_structure.length >= 3) {
        const compTargets = [
          { label: 'Front', targetDte: 10, color: '#f43f5e', dash: 'dot' },
          { label: 'Quarter', targetDte: 90, color: '#a855f7', dash: 'dashdot' },
          { label: 'LEAPS', targetDte: 250, color: '#10b981', dash: 'dot' }
        ];
        const usedExps = new Set([activeExp]);
        compTargets.forEach(ct => {
          const best = term_structure.reduce((prev, curr) => (
            Math.abs((curr.dte || 30) - ct.targetDte) < Math.abs((prev.dte || 30) - ct.targetDte) ? curr : prev
          ), term_structure[0]);
          if (best && !usedExps.has(best.expiry)) {
            usedExps.add(best.expiry);
            const compPts = filterCoreBand(surface.filter(p => p.expiry === best.expiry));
            if (compPts.length >= 5) {
              compPts.forEach(cp => allYValues.push(cp.iv));
              plotData.push({
                x: compPts.map(p => p.strike),
                y: compPts.map(p => p.iv),
                type: 'scatter',
                mode: 'lines',
                name: `${ct.label} (${best.dte}D)`,
                line: { color: ct.color, width: 2, dash: ct.dash, shape: 'spline', smoothing: 0.6 },
                opacity: 0.82,
                text: compPts.map(p => `<b>${best.expiry} (${best.dte}D)</b> · Strike $${p.strike}: IV <b>${p.iv}%</b>`),
                hoverinfo: 'text'
              });
            }
          }
        });
      }

      const put25Strike = activeTermMeta?.put_25d_strike;
      const call25Strike = activeTermMeta?.call_25d_strike;
      const put25Iv = activeTermMeta?.put_25d_iv;
      const call25Iv = activeTermMeta?.call_25d_iv;
      const atmIvVal = activeTermMeta?.atm_iv;

      const minXStrike = filtered.length > 0 ? filtered[0].strike : (spot ? spot * 0.85 : 0);
      const maxXStrike = filtered.length > 0 ? filtered[filtered.length - 1].strike : (spot ? spot * 1.15 : 100);

      // Plot glowing diamond markers for 25D Put, ATM, and 25D Call (no floating text boxes that can collide!)
      if (put25Strike && put25Iv && put25Strike >= minXStrike && put25Strike <= maxXStrike) {
        allYValues.push(put25Iv);
        plotData.push({
          x: [put25Strike],
          y: [put25Iv],
          type: 'scatter',
          mode: 'markers',
          name: `25Δ Put ($${put25Strike} · ${put25Iv}%)`,
          marker: { size: 11, color: '#f43f5e', symbol: 'diamond', line: { color: '#ffffff', width: 1.5 } },
          text: [`<b>25Δ OTM Put Anchor</b><br>Strike: $${put25Strike}<br>IV: <b>${put25Iv}%</b>`],
          hoverinfo: 'text'
        });
      }
      if (spot && atmIvVal && spot >= minXStrike && spot <= maxXStrike) {
        allYValues.push(atmIvVal);
        plotData.push({
          x: [spot],
          y: [atmIvVal],
          type: 'scatter',
          mode: 'markers',
          name: `ATM Spot ($${spot.toFixed(2)} · ${atmIvVal}%)`,
          marker: { size: 11, color: '#fbbf24', symbol: 'diamond', line: { color: '#ffffff', width: 1.5 } },
          text: [`<b>ATM Spot Anchor</b><br>Spot: $${spot.toFixed(2)}<br>ATM IV: <b>${atmIvVal}%</b>`],
          hoverinfo: 'text'
        });
      }
      if (call25Strike && call25Iv && call25Strike >= minXStrike && call25Strike <= maxXStrike) {
        allYValues.push(call25Iv);
        plotData.push({
          x: [call25Strike],
          y: [call25Iv],
          type: 'scatter',
          mode: 'markers',
          name: `25Δ Call ($${call25Strike} · ${call25Iv}%)`,
          marker: { size: 11, color: '#10b981', symbol: 'diamond', line: { color: '#ffffff', width: 1.5 } },
          text: [`<b>25Δ OTM Call Anchor</b><br>Strike: $${call25Strike}<br>IV: <b>${call25Iv}%</b>`],
          hoverinfo: 'text'
        });
      }

      if (hvLevel) allYValues.push(hvLevel);
      const rawMinY = allYValues.length > 0 ? Math.min(...allYValues) : 12;
      const rawMaxY = allYValues.length > 0 ? Math.max(...allYValues) : 40;
      const yPad = Math.max(2.5, (rawMaxY - rawMinY) * 0.18);
      const minY = Math.max(1, +(rawMinY - yPad).toFixed(1));
      const maxY = +(rawMaxY + yPad).toFixed(1);

      const layout = {
        autosize: true,
        height: 530,
        margin: { l: 62, r: 28, b: 56, t: 52 },
        paper_bgcolor: 'transparent',
        plot_bgcolor: '#090d16',
        legend: {
          orientation: 'h',
          x: 0,
          xanchor: 'left',
          y: 1.03,
          yanchor: 'bottom',
          font: { color: '#cbd5e1', family: "'JetBrains Mono', monospace", size: 10 },
          bgcolor: 'rgba(15, 23, 42, 0.78)',
          bordercolor: 'rgba(255, 255, 255, 0.08)',
          borderwidth: 1
        },
        xaxis: {
          title: { text: 'Strike Price ($)', font: { color: '#00F0FF', family: "'JetBrains Mono', monospace", size: 12 }, standoff: 10 },
          gridcolor: 'rgba(255, 255, 255, 0.08)',
          color: '#cbd5e1',
          tickfont: { family: "'JetBrains Mono', monospace", size: 11 }
        },
        yaxis: {
          title: { text: 'Implied Volatility (%)', font: { color: '#00F0FF', family: "'JetBrains Mono', monospace", size: 12 } },
          gridcolor: 'rgba(255, 255, 255, 0.08)',
          color: '#cbd5e1',
          tickfont: { family: "'JetBrains Mono', monospace", size: 11 },
          range: [minY, maxY]
        },
        shapes: [
          ...(spot && filtered.length > 0 ? [{
            type: 'line', x0: spot, x1: spot, y0: minY, y1: maxY,
            line: { color: 'rgba(251, 191, 36, 0.65)', width: 1.75, dash: 'dash' }
          }] : []),
          ...(put25Strike && filtered.length > 0 && put25Strike >= minXStrike ? [{
            type: 'line', x0: put25Strike, x1: put25Strike, y0: minY, y1: maxY,
            line: { color: 'rgba(244, 63, 94, 0.38)', width: 1.25, dash: 'dot' }
          }] : []),
          ...(call25Strike && filtered.length > 0 && call25Strike <= maxXStrike ? [{
            type: 'line', x0: call25Strike, x1: call25Strike, y0: minY, y1: maxY,
            line: { color: 'rgba(16, 185, 129, 0.38)', width: 1.25, dash: 'dot' }
          }] : []),
          ...(hvLevel && filtered.length > 0 ? [{
            type: 'line',
            x0: minXStrike,
            x1: maxXStrike,
            y0: hvLevel,
            y1: hvLevel,
            line: { color: 'rgba(56, 189, 248, 0.55)', width: 1.5, dash: 'dot' }
          }] : [])
        ],
        annotations: []
      };

      try {
        window.Plotly.newPlot(plotRef.current, plotData, layout, { responsive: true, displayModeBar: false });
      } catch (err) {
        console.warn("Plotly render error caught:", err);
      }

    } else if (activeViewMode === 'term_structure') {
      // 3. BUILD INSTITUTIONAL TERM STRUCTURE CURVE (ATM + 25D PUT + 25D CALL + EVENT PEAK)
      const hvLevel = activeData.desk_metrics?.realized_hv_30d;
      const xLabels = term_structure.map(ts => `${ts.dte}D`);

      let peakIdx = 0;
      term_structure.forEach((ts, idx) => {
        if ((ts.atm_iv || 0) > (term_structure[peakIdx]?.atm_iv || 0)) peakIdx = idx;
      });

      const atmY = term_structure.map(ts => ts.atm_iv);
      const put25Y = term_structure.map(ts => ts.put_25d_iv || ts.atm_iv);
      const call25Y = term_structure.map(ts => ts.call_25d_iv || ts.atm_iv);
      const allTermY = [...atmY, ...put25Y, ...call25Y, ...(hvLevel ? [hvLevel] : [])].filter(v => v !== undefined && !isNaN(v));
      const rawMinTerm = allTermY.length > 0 ? Math.min(...allTermY) : 12;
      const rawMaxTerm = allTermY.length > 0 ? Math.max(...allTermY) : 40;
      const termPad = Math.max(2.5, (rawMaxTerm - rawMinTerm) * 0.18);
      const minTermY = Math.max(1, +(rawMinTerm - termPad).toFixed(1));
      const maxTermY = +(rawMaxTerm + termPad).toFixed(1);

      const peakTs = term_structure[peakIdx];

      const plotData = [
        {
          x: xLabels,
          y: atmY,
          type: 'scatter',
          mode: 'lines+markers',
          name: 'ATM Implied Vol (%)',
          line: { color: '#a855f7', width: 3.5, shape: 'spline', smoothing: 0.55 },
          marker: {
            size: term_structure.map((_, idx) => idx === peakIdx ? 11 : 7),
            color: term_structure.map((_, idx) => idx === peakIdx ? '#f59e0b' : '#c084fc'),
            symbol: term_structure.map((_, idx) => idx === peakIdx ? 'diamond' : 'circle'),
            line: { color: '#ffffff', width: 1 }
          },
          hovertext: term_structure.map(ts => (
            `<b>Tenor: ${ts.expiry} (${ts.dte} DTE)</b><br>` +
            `ATM IV: <b>${ts.atm_iv}%</b><br>` +
            `Implied Move: <b>±${ts.expected_move_pct}% (±$${ts.expected_move_pts})</b><br>` +
            `25Δ Put IV: ${ts.put_25d_iv || ts.atm_iv}% | 25Δ Call IV: ${ts.call_25d_iv || ts.atm_iv}%<br>` +
            `25Δ Skew Spread: <b>+${ts.skew_25d ?? 0}%</b>`
          )),
          hoverinfo: 'text'
        },
        {
          x: xLabels,
          y: put25Y,
          type: 'scatter',
          mode: 'lines',
          name: '25Δ OTM Put Skew IV (%)',
          line: { color: '#f43f5e', width: 2, dash: 'dash', shape: 'spline', smoothing: 0.55 },
          opacity: 0.85,
          hoverinfo: 'skip'
        },
        {
          x: xLabels,
          y: call25Y,
          type: 'scatter',
          mode: 'lines',
          name: '25Δ OTM Call Wing IV (%)',
          line: { color: '#10b981', width: 2, dash: 'dot', shape: 'spline', smoothing: 0.55 },
          opacity: 0.85,
          hoverinfo: 'skip'
        },
        ...(peakTs ? [{
          x: [xLabels[peakIdx]],
          y: [peakTs.atm_iv],
          type: 'scatter',
          mode: 'markers',
          name: `Peak Event IV (${peakTs.atm_iv}% @ ${peakTs.dte}D · ±${peakTs.expected_move_pct}%)`,
          marker: { size: 12, color: '#f59e0b', symbol: 'diamond', line: { color: '#ffffff', width: 1.5 } },
          hoverinfo: 'skip'
        }] : [])
      ];

      const layout = {
        autosize: true,
        height: 530,
        margin: { l: 62, r: 28, b: 58, t: 52 },
        paper_bgcolor: 'transparent',
        plot_bgcolor: '#090d16',
        legend: {
          orientation: 'h',
          x: 0,
          xanchor: 'left',
          y: 1.03,
          yanchor: 'bottom',
          font: { color: '#cbd5e1', family: "'JetBrains Mono', monospace", size: 10 },
          bgcolor: 'rgba(15, 23, 42, 0.78)',
          bordercolor: 'rgba(255, 255, 255, 0.08)',
          borderwidth: 1
        },
        xaxis: {
          title: { text: 'Expiration Tenor (Days to Expiration)', font: { color: '#00F0FF', family: "'JetBrains Mono', monospace", size: 12 }, standoff: 10 },
          gridcolor: 'rgba(255, 255, 255, 0.08)',
          color: '#cbd5e1',
          tickmode: 'auto',
          nticks: 15,
          tickangle: 0,
          tickfont: { family: "'JetBrains Mono', monospace", size: 10.5 }
        },
        yaxis: {
          title: { text: 'Implied Volatility (%)', font: { color: '#00F0FF', family: "'JetBrains Mono', monospace", size: 12 } },
          gridcolor: 'rgba(255, 255, 255, 0.08)',
          color: '#cbd5e1',
          tickfont: { family: "'JetBrains Mono', monospace", size: 11 },
          range: [minTermY, maxTermY]
        },
        shapes: hvLevel ? [{
          type: 'line',
          xref: 'paper',
          x0: 0,
          x1: 1,
          y0: hvLevel,
          y1: hvLevel,
          line: { color: 'rgba(56, 189, 248, 0.55)', width: 1.5, dash: 'dot' }
        }] : [],
        annotations: []
      };

      try {
        window.Plotly.newPlot(plotRef.current, plotData, layout, { responsive: true, displayModeBar: false });
      } catch (err) {
        console.warn("Plotly render error caught:", err);
      }

    } else if (activeViewMode === 'heatmap') {
      // 4. BUILD 2D VOLATILITY HEATMAP MATRIX
      const expirations = allExpirations;
      const ptMap = new Map();
      surface.forEach(p => {
        if (p && p.expiry && p.strike !== undefined && p.iv !== undefined) {
          ptMap.set(`${p.expiry}_${p.strike}`, p.iv);
        }
      });

      let displayedStrikes = rawStrikes;
      if (heatmapFilter === 'core' && spot) {
        const coreFiltered = rawStrikes.filter(s => Math.abs(s - spot) / spot <= 0.15);
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
        colorscale: surfaceColor === 'HedgingRegimes' ? 'Viridis' : surfaceColor,
        zsmooth: false, // Disables blur smoothing for crisp matrix grid cells!
        hoverongaps: false,
        colorbar: {
          title: { text: 'Implied Vol (%)', font: { color: '#00F0FF', family: "'JetBrains Mono', monospace", size: 12, weight: 'bold' } },
          tickfont: { color: '#f8fafc', family: "'JetBrains Mono', monospace", size: 11 },
          thickness: 16,
          len: 0.90
        },
        hovertemplate: `<b>Strike Price:</b> %{x}<br><b>Expiration:</b> %{y}<br><b>Implied Volatility:</b> %{z:.1f}%<extra></extra>`
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
          name: '🕳️ Vol Air Pocket (Cheap Vega)',
          text: visibleAirPockets.map(p => `🕳️ $${p.strike} (${p.iv}%)`),
          textposition: 'top center',
          textfont: { color: '#00F0FF', family: "'JetBrains Mono', monospace", size: 12, weight: 'bold' },
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
          textfont: { color: '#00E676', family: "'JetBrains Mono', monospace", size: 12, weight: 'bold' },
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
        height: 580,
        margin: { l: 90, r: 40, b: 60, t: 50 },
        paper_bgcolor: 'transparent',
        plot_bgcolor: '#090d16',
        title: { text: `Implied Volatility Heatmap Matrix · Strike Price vs Expiration Tenor`, font: { color: '#ffffff', family: "'JetBrains Mono', monospace", size: 14, weight: 'bold' } },
        xaxis: { 
          title: { text: hmXTitle, font: { color: '#00F0FF', size: 13, family: "'JetBrains Mono', monospace", weight: 'bold' } }, 
          gridcolor: 'rgba(255, 255, 255, 0.12)', 
          color: '#f8fafc', 
          tickfont: { family: "'JetBrains Mono', monospace", color: '#cbd5e1', size: 11 } 
        },
        yaxis: { 
          title: { text: 'Expiration Tenor', font: { color: '#00F0FF', size: 13, family: "'JetBrains Mono', monospace", weight: 'bold' } }, 
          gridcolor: 'rgba(255, 255, 255, 0.12)', 
          color: '#f8fafc', 
          tickfont: { family: "'JetBrains Mono', monospace", color: '#cbd5e1', size: 11 },
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
          line: { color: '#00F0FF', width: 2.5, dash: 'dash' }
        }] : [],
        annotations: spot ? [{
          xref: 'x',
          yref: 'paper',
          x: spotX,
          y: 1.05,
          text: strikeMode === 'moneyness' ? 'ATM Spot (1.00x)' : `Spot Price $${spot.toFixed(2)}`,
          showarrow: false,
          font: { color: '#00F0FF', family: "'JetBrains Mono', monospace", size: 11, weight: 'bold' },
          bgcolor: 'rgba(15, 23, 42, 0.95)',
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

    } else if (activeViewMode === 'spot_vol_scatter') {
      // 5. BUILD SPOT-VOL CORRELATION 2D SCATTER PLOT & TRENDLINE
      const scatterPts = data.spot_vol_scatter || [];
      const spotVolCorr = data.desk_metrics?.spot_vol_corr ?? -0.65;

      // Group points by quadrant for crisp color markers
      const putPanic = scatterPts.filter(p => p.spot_return_pct < 0 && p.vol_change_pct > 0);
      const callSqueeze = scatterPts.filter(p => p.spot_return_pct > 0 && p.vol_change_pct > 0);
      const volCrushRally = scatterPts.filter(p => p.spot_return_pct > 0 && p.vol_change_pct <= 0);
      const sinkingDrift = scatterPts.filter(p => p.spot_return_pct <= 0 && p.vol_change_pct <= 0);

      // Compute Linear Regression OLS Trendline
      let trendX = [-3, 3];
      let trendY = [3 * spotVolCorr, -3 * spotVolCorr];
      if (scatterPts.length >= 5) {
        const xVals = scatterPts.map(p => p.spot_return_pct);
        const yVals = scatterPts.map(p => p.vol_change_pct);
        const minX = Math.min(...xVals);
        const maxX = Math.max(...xVals);
        const meanX = xVals.reduce((a, b) => a + b, 0) / xVals.length;
        const meanY = yVals.reduce((a, b) => a + b, 0) / yVals.length;
        let num = 0, den = 0;
        for (let i = 0; i < xVals.length; i++) {
          num += (xVals[i] - meanX) * (yVals[i] - meanY);
          den += (xVals[i] - meanX) ** 2;
        }
        const beta = den !== 0 ? num / den : 0;
        const alpha = meanY - beta * meanX;
        trendX = [minX * 1.1, maxX * 1.1];
        trendY = [alpha + beta * trendX[0], alpha + beta * trendX[1]];
      }

      const plotData = [
        {
          x: putPanic.map(p => p.spot_return_pct),
          y: putPanic.map(p => p.vol_change_pct),
          type: 'scatter',
          mode: 'markers',
          name: `🚨 Put Panic (${putPanic.length} days)`,
          marker: { size: 10, color: '#ef4444', symbol: 'circle', line: { color: '#ffffff', width: 1 } },
          text: putPanic.map(p => `${p.date}: Spot ${p.spot_return_pct}% | Vol ${p.vol_change_pct > 0 ? '+' : ''}${p.vol_change_pct}%`),
          hoverinfo: 'text'
        },
        {
          x: callSqueeze.map(p => p.spot_return_pct),
          y: callSqueeze.map(p => p.vol_change_pct),
          type: 'scatter',
          mode: 'markers',
          name: `🚀 Call Squeeze (${callSqueeze.length} days)`,
          marker: { size: 11, color: '#10b981', symbol: 'diamond', line: { color: '#ffffff', width: 1 } },
          text: callSqueeze.map(p => `${p.date}: Spot +${p.spot_return_pct}% | Vol +${p.vol_change_pct}%`),
          hoverinfo: 'text'
        },
        {
          x: volCrushRally.map(p => p.spot_return_pct),
          y: volCrushRally.map(p => p.vol_change_pct),
          type: 'scatter',
          mode: 'markers',
          name: `🟢 Normal Rally (${volCrushRally.length} days)`,
          marker: { size: 9, color: '#38bdf8', symbol: 'circle', line: { color: '#ffffff', width: 1 } },
          text: volCrushRally.map(p => `${p.date}: Spot +${p.spot_return_pct}% | Vol ${p.vol_change_pct}%`),
          hoverinfo: 'text'
        },
        {
          x: sinkingDrift.map(p => p.spot_return_pct),
          y: sinkingDrift.map(p => p.vol_change_pct),
          type: 'scatter',
          mode: 'markers',
          name: `📉 Sinking Drift (${sinkingDrift.length} days)`,
          marker: { size: 8, color: '#94a3b8', symbol: 'square', line: { color: '#ffffff', width: 1 } },
          text: sinkingDrift.map(p => `${p.date}: Spot ${p.spot_return_pct}% | Vol ${p.vol_change_pct}%`),
          hoverinfo: 'text'
        },
        {
          x: trendX,
          y: trendY,
          type: 'scatter',
          mode: 'lines',
          name: `OLS Slope (ρ = ${spotVolCorr > 0 ? '+' : ''}${spotVolCorr})`,
          line: { color: spotVolCorr >= 0.15 ? '#10b981' : (spotVolCorr <= -0.15 ? '#38bdf8' : '#fbbf24'), width: 3, dash: 'dash' },
          hoverinfo: 'none'
        }
      ];

      // Calculate quadrant percentages & day counts for on-chart overlay badges
      const totalScatterDays = scatterPts.length || 1;
      const q1Pct = ((putPanic.length / totalScatterDays) * 100).toFixed(1);
      const q2Pct = ((callSqueeze.length / totalScatterDays) * 100).toFixed(1);
      const q3Pct = ((sinkingDrift.length / totalScatterDays) * 100).toFixed(1);
      const q4Pct = ((volCrushRally.length / totalScatterDays) * 100).toFixed(1);

      // Quant regime text title
      let regimeSummaryTitle = 'NORMAL EQUITY REGIME';
      let regimeColor = '#38bdf8';
      if (spotVolCorr >= 0.15) {
        regimeSummaryTitle = '🔥 POSITIVE SPOT-VOL REGIME (Call Squeeze Heavy)';
        regimeColor = '#10b981';
      } else if (spotVolCorr <= -0.15) {
        regimeSummaryTitle = '🛡️ CLASSIC EQUITY HEDGING REGIME (Strong Inverse Correlation)';
        regimeColor = '#38bdf8';
      } else {
        regimeSummaryTitle = '⚡ DECOUPLED / SKEW BREAKDOWN REGIME';
        regimeColor = '#fbbf24';
      }

      const layout = {
        autosize: true,
        height: 560,
        margin: { l: 60, r: 40, b: 60, t: 60 },
        paper_bgcolor: 'transparent',
        plot_bgcolor: '#090d16',
        title: { 
          text: `Spot-Vol Correlation Scatter Plot · ${ticker} (ρ = ${spotVolCorr > 0 ? '+' : ''}${spotVolCorr})`, 
          font: { color: '#ffffff', family: "'JetBrains Mono', monospace", size: 14, weight: 'bold' } 
        },
        xaxis: { 
          title: { text: 'Daily Underlying Spot Return (%)', font: { color: '#00F0FF', size: 13, family: "'JetBrains Mono', monospace", weight: 'bold' } }, 
          gridcolor: 'rgba(255, 255, 255, 0.12)', 
          color: '#f8fafc', 
          tickfont: { family: "'JetBrains Mono', monospace", color: '#cbd5e1', size: 11 },
          zerolinecolor: '#cbd5e1',
          zerolinewidth: 1.5
        },
        yaxis: { 
          title: { text: 'Daily Volatility Change (%)', font: { color: '#00F0FF', size: 13, family: "'JetBrains Mono', monospace", weight: 'bold' } }, 
          gridcolor: 'rgba(255, 255, 255, 0.12)', 
          color: '#f8fafc', 
          tickfont: { family: "'JetBrains Mono', monospace", color: '#cbd5e1', size: 11 },
          zerolinecolor: '#cbd5e1',
          zerolinewidth: 1.5
        },
        legend: {
          font: { color: '#ffffff', family: "'JetBrains Mono', monospace", size: 11 },
          bgcolor: 'rgba(15, 23, 42, 0.85)',
          bordercolor: 'rgba(255, 255, 255, 0.15)',
          borderwidth: 1
        },
        annotations: [
          // Top-Center Regime Summary Banner
          {
            xref: 'paper',
            yref: 'paper',
            x: 0.50,
            y: 1.08,
            text: `<b>${regimeSummaryTitle}</b> | Pearson Correlation (ρ): <b>${spotVolCorr > 0 ? '+' : ''}${spotVolCorr}</b>`,
            showarrow: false,
            xanchor: 'center',
            yanchor: 'bottom',
            font: { color: '#ffffff', family: "'JetBrains Mono', monospace", size: 11 },
            bgcolor: 'rgba(15, 23, 42, 0.95)',
            bordercolor: regimeColor,
            borderwidth: 1.5,
            borderpad: 5
          },
          // Quadrant 1 (Top-Left): Put Panic (Spot < 0, Vol > 0)
          {
            xref: 'paper',
            yref: 'paper',
            x: 0.02,
            y: 0.96,
            text: `<b>🚨 Q1: PUT PANIC ZONE</b><br>Spot ↓ / Vol ↑<br><b>${putPanic.length} days (${q1Pct}%)</b>`,
            showarrow: false,
            xanchor: 'left',
            yanchor: 'top',
            font: { color: '#ef4444', family: "'JetBrains Mono', monospace", size: 10 },
            bgcolor: 'rgba(239, 68, 68, 0.12)',
            bordercolor: 'rgba(239, 68, 68, 0.4)',
            borderwidth: 1,
            borderpad: 5
          },
          // Quadrant 2 (Top-Right): Call Squeeze (Spot > 0, Vol > 0)
          {
            xref: 'paper',
            yref: 'paper',
            x: 0.98,
            y: 0.96,
            text: `<b>🚀 Q2: CALL SQUEEZE ZONE</b><br>Spot ↑ / Vol ↑<br><b>${callSqueeze.length} days (${q2Pct}%)</b>`,
            showarrow: false,
            xanchor: 'right',
            yanchor: 'top',
            font: { color: '#10b981', family: "'JetBrains Mono', monospace", size: 10 },
            bgcolor: 'rgba(16, 185, 129, 0.12)',
            bordercolor: 'rgba(16, 185, 129, 0.4)',
            borderwidth: 1,
            borderpad: 5
          },
          // Quadrant 3 (Bottom-Left): Sinking Drift (Spot < 0, Vol < 0)
          {
            xref: 'paper',
            yref: 'paper',
            x: 0.02,
            y: 0.04,
            text: `<b>📉 Q3: SINKING DRIFT ZONE</b><br>Spot ↓ / Vol ↓<br><b>${sinkingDrift.length} days (${q3Pct}%)</b>`,
            showarrow: false,
            xanchor: 'left',
            yanchor: 'bottom',
            font: { color: '#94a3b8', family: "'JetBrains Mono', monospace", size: 10 },
            bgcolor: 'rgba(148, 163, 184, 0.12)',
            bordercolor: 'rgba(148, 163, 184, 0.4)',
            borderwidth: 1,
            borderpad: 5
          },
          // Quadrant 4 (Bottom-Right): Vol-Crush Rally (Spot > 0, Vol < 0)
          {
            xref: 'paper',
            yref: 'paper',
            x: 0.98,
            y: 0.04,
            text: `<b>🟢 Q4: NORMAL RALLYS / VOL CRUSH</b><br>Spot ↑ / Vol ↓<br><b>${volCrushRally.length} days (${q4Pct}%)</b>`,
            showarrow: false,
            xanchor: 'right',
            yanchor: 'bottom',
            font: { color: '#38bdf8', family: "'JetBrains Mono', monospace", size: 10 },
            bgcolor: 'rgba(56, 189, 248, 0.12)',
            bordercolor: 'rgba(56, 189, 248, 0.4)',
            borderwidth: 1,
            borderpad: 5
          }
        ]
      };

      try {
        window.Plotly.newPlot(plotRef.current, plotData, layout, { responsive: true, displayModeBar: false });
      } catch (err) {
        console.error("Plotly scatter render error:", err);
      }
    }
  }, [data, horizonData, tenorHorizon, selectedExpiry, activeViewMode, focusedHotspot, plotlyReady, detectedAirPockets, surfaceColor, surfaceBg, cameraPreset, strikeMode, heatmapFilter, showHvPlane, show3dLabels]);

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
          Calibrating Multi-Year Quant Volatility Manifold for {ticker}...
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

  const activeData = horizonData || data;
  const { spot, desk_metrics = {}, actionable_setups = [], hotspots = [], ai_vol_intelligence = null, horizon_meta = null } = activeData;
  const availableExpirations = [...new Set(activeData.surface.map(item => item.expiry))].sort();

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
                🟢 Underhedged Valleys: {activeData.hedging_diagnostics?.counts?.underhedged} strikes ({activeData.hedging_diagnostics?.percentages?.underhedged_pct}%) — Cheap Convexity
              </span>
              <span className="spec-lbl-slate">
                ⚖️ Fair Value Balanced: {activeData.hedging_diagnostics?.counts?.balanced} strikes ({activeData.hedging_diagnostics?.percentages?.balanced_pct}%)
              </span>
              <span className="spec-lbl-red">
                🔴 Overhedged Peaks: {activeData.hedging_diagnostics?.counts?.overhedged} strikes ({activeData.hedging_diagnostics?.percentages?.overhedged_pct}%) — Expensive Panic
              </span>
            </div>
            <div className="hedging-bar-track">
              <div 
                className="bar-segment bar-underhedged" 
                style={{ width: `${activeData.hedging_diagnostics?.percentages?.underhedged_pct}%` }} 
                title="Underhedged: Cheap protection / convexity" 
              />
              <div 
                className="bar-segment bar-balanced" 
                style={{ width: `${activeData.hedging_diagnostics?.percentages?.balanced_pct}%` }} 
                title="Balanced: Orderly fair value smile pricing" 
              />
              <div 
                className="bar-segment bar-overhedged" 
                style={{ width: `${activeData.hedging_diagnostics?.percentages?.overhedged_pct}%` }} 
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
              {activeData.hedging_diagnostics?.dealer_flow_insight}
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
                {activeData.hedging_diagnostics?.top_overhedged?.map((item, idx) => (
                  <div key={idx} className="target-micro-card">
                    <div className="tmc-top">
                      <span className="tmc-strike">${item.strike} {item.type === 'otm_put' ? 'PUT' : 'CALL'}</span>
                      <span className="tmc-exp">{item.expiry} {item.dte ? `(${item.dte}d)` : ''}</span>
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
                {activeData.hedging_diagnostics?.top_underhedged?.map((item, idx) => (
                  <div key={idx} className="target-micro-card">
                    <div className="tmc-top">
                      <span className="tmc-strike">${item.strike} {item.type === 'otm_put' ? 'PUT' : 'CALL'}</span>
                      <span className="tmc-exp">{item.expiry} {item.dte ? `(${item.dte}d)` : ''}</span>
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
        {/* Quick Visual Cheat Sheet: How to Read the 3D Volatility Surface */}
        <div style={{
          background: 'rgba(15, 23, 42, 0.85)',
          border: '1px solid rgba(0, 240, 255, 0.25)',
          borderRadius: '12px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Info size={18} color="#00F0FF" />
              <span style={{ color: '#00F0FF', fontFamily: "'JetBrains Mono', monospace", fontWeight: 'bold', fontSize: '13px', textTransform: 'uppercase' }}>
                How to Read the 3D Volatility Surface ({ticker}):
              </span>
            </div>
            <span style={{ color: '#94a3b8', fontSize: '11px', fontFamily: "'JetBrains Mono', monospace" }}>
              3 Axes Breakdown
            </span>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '12px'
          }}>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px 12px', borderRadius: '8px', borderLeft: '3px solid #00F0FF' }}>
              <strong style={{ color: '#00F0FF', fontSize: '12px', display: 'block', marginBottom: '4px' }}>1. X-Axis (Left-to-Right)</strong>
              <span style={{ color: '#cbd5e1', fontSize: '11px', lineHeight: '1.4', display: 'block' }}>
                <strong>Strike Prices ($):</strong> OTM Puts on the left, ATM Spot (${spot?.toFixed(2)}) in center, OTM Calls on the right.
              </span>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px 12px', borderRadius: '8px', borderLeft: '3px solid #fbbf24' }}>
              <strong style={{ color: '#fbbf24', fontSize: '12px', display: 'block', marginBottom: '4px' }}>2. Y-Axis (Front-to-Back)</strong>
              <span style={{ color: '#cbd5e1', fontSize: '11px', lineHeight: '1.4', display: 'block' }}>
                <strong>Expiration Dates ({horizon_meta?.label || '1–2 Years'}):</strong> Near-term weeklies in front out to {horizon_meta?.max_dte || 730}D LEAPS in back.
              </span>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px 12px', borderRadius: '8px', borderLeft: '3px solid #10b981' }}>
              <strong style={{ color: '#10b981', fontSize: '12px', display: 'block', marginBottom: '4px' }}>3. Z-Axis (Vertical Height)</strong>
              <span style={{ color: '#cbd5e1', fontSize: '11px', lineHeight: '1.4', display: 'block' }}>
                <strong>Implied Volatility (%):</strong> Higher peaks = expensive option premium. Low valleys = cheap option premium.
              </span>
            </div>
          </div>
        </div>
        {/* Section Title + Multi-Year Horizon Selector (1M, 3M, 6M, 1Y, 2Y, All LEAPS) */}
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
          <div className="vol-surface-title-wrap" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <Compass style={{ width: '18px', height: '18px', color: '#00F0FF' }} />
            <h3 style={{ margin: 0, fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#00F0FF' }}>
              Quantitative Volatility Surface & Smile Topology ({horizon_meta?.label || '2 Years'})
            </h3>
            <span style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '11px',
              padding: '3px 9px',
              borderRadius: '6px',
              background: 'rgba(0, 240, 255, 0.12)',
              border: '1px solid rgba(0, 240, 255, 0.35)',
              color: '#00F0FF',
              fontWeight: 700
            }}>
              {availableExpirations.length} Expirations · {horizon_meta?.min_dte || 1}D to {horizon_meta?.max_dte || 730}D ({availableExpirations[0]} → {availableExpirations[availableExpirations.length - 1]})
            </span>
          </div>

          {/* Interactive Tenor Horizon Selector (1M, 3M, 6M, 1Y, 2Y, All LEAPS) */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexWrap: 'wrap',
            background: 'rgba(15, 23, 42, 0.92)',
            padding: '5px 8px',
            borderRadius: '10px',
            border: '1px solid rgba(0, 240, 255, 0.3)'
          }}>
            <span style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '11px',
              fontWeight: 800,
              color: '#94a3b8',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              paddingLeft: '4px'
            }}>
              ⏳ Surface Horizon:
            </span>
            {HORIZON_OPTIONS.map(opt => {
              const isSelected = tenorHorizon === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setTenorHorizon(opt.id);
                    setSelectedExpiry('All');
                    setFocusedHotspot(null);
                  }}
                  title={opt.desc}
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '11px',
                    fontWeight: 800,
                    padding: '5px 11px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    border: isSelected ? '1px solid #00F0FF' : '1px solid rgba(255,255,255,0.08)',
                    background: isSelected
                      ? 'linear-gradient(135deg, rgba(0, 240, 255, 0.28), rgba(59, 130, 246, 0.32))'
                      : 'rgba(255, 255, 255, 0.04)',
                    color: isSelected ? '#ffffff' : '#94a3b8',
                    boxShadow: isSelected ? '0 0 12px rgba(0, 240, 255, 0.25)' : 'none'
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
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
            <span className="vol-kpi-label">Term Regime ({tenorHorizon})</span>
            <span className={`vol-kpi-val ${desk_metrics?.term_structure_regime === 'Backwardation' ? 'rose' : 'purple'}`}>
              {desk_metrics?.term_structure_regime}
            </span>
            <span className="vol-kpi-sub">
              {desk_metrics?.term_structure_slope > 0 ? `+${desk_metrics?.term_structure_slope}% Slope` : `${desk_metrics?.term_structure_slope}% Slope`} ({availableExpirations.length} Tenors)
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

          {/* SPOT-VOL CORRELATION */}
          <div className="vol-kpi-tile">
            <span className="vol-kpi-label">Spot-Vol Corr</span>
            <span className={`vol-kpi-val ${
              (desk_metrics?.spot_vol_corr ?? -0.65) >= 0.15 ? 'emerald' : ((desk_metrics?.spot_vol_corr ?? -0.65) <= -0.15 ? 'purple' : 'amber')
            }`}>
              {(desk_metrics?.spot_vol_corr ?? -0.65) > 0 ? `+${(desk_metrics?.spot_vol_corr ?? -0.65).toFixed(2)}` : (desk_metrics?.spot_vol_corr ?? -0.65).toFixed(2)}
            </span>
            <span className="vol-kpi-sub">
              {desk_metrics?.spot_vol_badge || 'Equity Leverage'}
            </span>
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
            <button
              onClick={() => setActiveViewMode('spot_vol_scatter')}
              className={`vol-view-btn ${activeViewMode === 'spot_vol_scatter' ? 'active' : ''}`}
            >
              📊 Spot-Vol Scatter
            </button>
          </div>

          {activeViewMode === '2d_skew' && (
            <select 
              value={selectedExpiry} 
              onChange={(e) => setSelectedExpiry(e.target.value)}
              className="vol-expiry-select"
            >
              <option value="All">📊 30D Benchmark + Multi-Tenor Overlay</option>
              {availableExpirations.map(exp => {
                const tsItem = (activeData.term_structure || []).find(t => t.expiry === exp);
                const labelSuffix = tsItem ? ` (${tsItem.dte}D · ATM ${tsItem.atm_iv}%)` : '';
                return (
                  <option key={exp} value={exp}>{exp}{labelSuffix}</option>
                );
              })}
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

        {/* Clean Non-Overlapping Telemetry Strip for 2D Skew & Term Structure */}
        {(activeViewMode === '2d_skew' || activeViewMode === 'term_structure') && (() => {
          const tsList = activeData.term_structure || [];
          const bench30 = tsList.length > 0
            ? tsList.reduce((p, c) => Math.abs((c.dte || 30) - 30) < Math.abs((p.dte || 30) - 30) ? c : p, tsList[0])
            : null;
          const activeExp = (selectedExpiry === 'All' || !availableExpirations.includes(selectedExpiry))
            ? (bench30?.expiry || availableExpirations[0])
            : selectedExpiry;
          const activeTs = tsList.find(t => t.expiry === activeExp) || bench30 || {};
          const peakTs = tsList.length > 0
            ? tsList.reduce((p, c) => (c.atm_iv || 0) > (p.atm_iv || 0) ? c : p, tsList[0])
            : null;

          if (activeViewMode === '2d_skew') {
            return (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '10px',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  background: 'rgba(15, 23, 42, 0.85)',
                  border: '1px solid rgba(0, 240, 255, 0.22)',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '11px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ color: '#00F0FF', fontWeight: 800 }}>
                    2D VOLATILITY SKEW · {activeExp} ({activeTs.dte || 30}D)
                  </span>
                  {selectedExpiry === 'All' && (
                    <span style={{ color: '#94a3b8', fontSize: '10px' }}>
                      (+ Front / Quarter / LEAPS Multi-Tenor Overlay)
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  {activeTs.put_25d_strike && (
                    <span style={{ padding: '3px 8px', borderRadius: '5px', background: 'rgba(244,63,94,0.14)', border: '1px solid rgba(244,63,94,0.35)', color: '#fda4af' }}>
                      25Δ Put: <strong>${activeTs.put_25d_strike} ({activeTs.put_25d_iv}%)</strong>
                    </span>
                  )}
                  {spot && (
                    <span style={{ padding: '3px 8px', borderRadius: '5px', background: 'rgba(251,191,36,0.14)', border: '1px solid rgba(251,191,36,0.35)', color: '#fde68a' }}>
                      ATM Spot: <strong>${spot.toFixed(2)} ({activeTs.atm_iv || '--'}%)</strong>
                    </span>
                  )}
                  {activeTs.call_25d_strike && (
                    <span style={{ padding: '3px 8px', borderRadius: '5px', background: 'rgba(16,185,129,0.14)', border: '1px solid rgba(16,185,129,0.35)', color: '#6ee7b7' }}>
                      25Δ Call: <strong>${activeTs.call_25d_strike} ({activeTs.call_25d_iv}%)</strong>
                    </span>
                  )}
                  <span style={{ padding: '3px 8px', borderRadius: '5px', background: 'rgba(0,240,255,0.12)', border: '1px solid rgba(0,240,255,0.3)', color: '#00F0FF' }}>
                    25Δ Skew: <strong>{(activeTs.skew_25d ?? desk_metrics?.skew_spread ?? 0) >= 0 ? '+' : ''}{activeTs.skew_25d ?? desk_metrics?.skew_spread ?? 0}%</strong>
                  </span>
                </div>
              </div>
            );
          }

          return (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '10px',
                padding: '10px 14px',
                borderRadius: '10px',
                background: 'rgba(15, 23, 42, 0.85)',
                border: '1px solid rgba(168, 85, 247, 0.28)',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '11px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ color: '#c084fc', fontWeight: 800 }}>
                  IV TERM STRUCTURE · {activeData.horizon_meta?.label || tenorHorizon} ({tsList.length} EXPIRATIONS)
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ padding: '3px 8px', borderRadius: '5px', background: 'rgba(168,85,247,0.14)', border: '1px solid rgba(168,85,247,0.35)', color: '#e9d5ff' }}>
                  Regime: <strong>{desk_metrics?.term_structure_regime || 'Flat'} ({(desk_metrics?.term_structure_slope || 0) > 0 ? '+' : ''}{desk_metrics?.term_structure_slope || 0}% Slope)</strong>
                </span>
                {peakTs && (
                  <span style={{ padding: '3px 8px', borderRadius: '5px', background: 'rgba(245,158,11,0.14)', border: '1px solid rgba(245,158,11,0.35)', color: '#fde68a' }}>
                    Peak IV: <strong>{peakTs.atm_iv}% @ {peakTs.dte}D (±{peakTs.expected_move_pct}%)</strong>
                  </span>
                )}
                {desk_metrics?.realized_hv_30d && (
                  <span style={{ padding: '3px 8px', borderRadius: '5px', background: 'rgba(56,189,248,0.14)', border: '1px solid rgba(56,189,248,0.35)', color: '#7dd3fc' }}>
                    30D Realized HV: <strong>{desk_metrics.realized_hv_30d}%</strong>
                  </span>
                )}
              </div>
            </div>
          );
        })()}

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

        {/* REGIME RATIONALE BREAKDOWN DECK (Rendered exclusively in Spot-Vol Scatter view) */}
        {activeViewMode === 'spot_vol_scatter' && (() => {
          const scatterPts = data?.spot_vol_scatter || [];
          const spotVolCorr = data.desk_metrics?.spot_vol_corr ?? -0.65;
          const isDecoupled = spotVolCorr > -0.15 && spotVolCorr < 0.15;
          const isCallSqueeze = spotVolCorr >= 0.15;
          const isInverse = spotVolCorr <= -0.15;

          return (
            <div 
              style={{
                background: 'rgba(15, 23, 42, 0.90)',
                border: `1px solid ${isDecoupled ? '#fbbf24' : (isCallSqueeze ? '#10b981' : '#38bdf8')}`,
                borderRadius: '12px',
                padding: '18px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
                marginTop: '12px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Sparkles size={16} color={isDecoupled ? '#fbbf24' : (isCallSqueeze ? '#10b981' : '#38bdf8')} />
                  <strong style={{ color: '#ffffff', fontSize: '14px', fontFamily: "'JetBrains Mono', monospace" }}>
                    Why is {ticker}'s Spot-Vol Relationship {isDecoupled ? 'DECOUPLED (ρ ≈ 0.00)' : (isCallSqueeze ? 'POSITIVE (Call Squeeze Heavy)' : 'INVERSE / HEDGED (Classic Equity)')}?
                  </strong>
                </div>
                <span 
                  style={{
                    padding: '3px 10px',
                    borderRadius: '6px',
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '11px',
                    fontWeight: 'bold',
                    background: isDecoupled ? 'rgba(251, 191, 36, 0.15)' : (isCallSqueeze ? 'rgba(16, 185, 129, 0.15)' : 'rgba(56, 189, 248, 0.15)'),
                    color: isDecoupled ? '#fbbf24' : (isCallSqueeze ? '#10b981' : '#38bdf8'),
                    border: `1px solid ${isDecoupled ? 'rgba(251, 191, 36, 0.3)' : (isCallSqueeze ? 'rgba(16, 185, 129, 0.3)' : 'rgba(56, 189, 248, 0.3)')}`
                  }}
                >
                  ρ = {spotVolCorr > 0 ? '+' : ''}{spotVolCorr}
                </span>
              </div>

              {isDecoupled && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px', borderLeft: '3px solid #fbbf24' }}>
                    <strong style={{ color: '#fbbf24', fontSize: '12px', display: 'block', marginBottom: '4px' }}>1. Binary Event / Catalyst Waiting</strong>
                    <span style={{ color: '#cbd5e1', fontSize: '11px', lineHeight: '1.4', display: 'block' }}>
                      Option IV stays bid or fixed regardless of small price fluctuations because market participants are waiting for an imminent macro event, earnings announcement, or regulatory approval.
                    </span>
                  </div>

                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px', borderLeft: '3px solid #fbbf24' }}>
                    <strong style={{ color: '#fbbf24', fontSize: '12px', display: 'block', marginBottom: '4px' }}>2. Dealer Gamma Neutralization</strong>
                    <span style={{ color: '#cbd5e1', fontSize: '11px', lineHeight: '1.4', display: 'block' }}>
                      Market makers are holding balanced long/short delta positions, preventing volatility from expanding when the stock dips or contracting when it rallies.
                    </span>
                  </div>

                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px', borderLeft: '3px solid #fbbf24' }}>
                    <strong style={{ color: '#fbbf24', fontSize: '12px', display: 'block', marginBottom: '4px' }}>3. Consolidation & Microstructure Drift</strong>
                    <span style={{ color: '#cbd5e1', fontSize: '11px', lineHeight: '1.4', display: 'block' }}>
                      The stock is drifting within a range without clear institutional panics or aggressive FOMO call buying, keeping options vega demand flat across price moves.
                    </span>
                  </div>

                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px', borderLeft: '3px solid #fbbf24' }}>
                    <strong style={{ color: '#fbbf24', fontSize: '12px', display: 'block', marginBottom: '4px' }}>💡 Trader Takeaway</strong>
                    <span style={{ color: '#cbd5e1', fontSize: '11px', lineHeight: '1.4', display: 'block' }}>
                      Standard put hedges may not spike as expected during sell-offs. Consider gamma-neutral calendar spreads or multi-leg butterflies to exploit static IV pricing.
                    </span>
                  </div>
                </div>
              )}

              {isCallSqueeze && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px', borderLeft: '3px solid #10b981' }}>
                    <strong style={{ color: '#10b981', fontSize: '12px', display: 'block', marginBottom: '4px' }}>1. Aggressive Upside Call Buying (FOMO)</strong>
                    <span style={{ color: '#cbd5e1', fontSize: '11px', lineHeight: '1.4', display: 'block' }}>
                      Retail and institutional traders are aggressively buying OTM call options as the stock surges, driving up call IV alongside spot price.
                    </span>
                  </div>

                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px', borderLeft: '3px solid #10b981' }}>
                    <strong style={{ color: '#10b981', fontSize: '12px', display: 'block', marginBottom: '4px' }}>2. Dealer Short Gamma Acceleration</strong>
                    <span style={{ color: '#cbd5e1', fontSize: '11px', lineHeight: '1.4', display: 'block' }}>
                      Dealers who are short upside calls must buy underlying shares as the stock rises to stay delta-neutral, creating a self-reinforcing upward melt-up.
                    </span>
                  </div>
                </div>
              )}

              {/* VOLATILITY EXHAUSTION & PRICE IMPACT BOUNDARY CORRIDOR */}
              {(() => {
                const currentSpot = spot || 100;
                // Compute linear regression slope (Beta) & Volatility Exhaustion Boundaries
                const xVals = scatterPts.map(p => p.spot_return_pct);
                const yVals = scatterPts.map(p => p.vol_change_pct);
                let beta = 0;
                if (xVals.length >= 5) {
                  const meanX = xVals.reduce((a, b) => a + b, 0) / xVals.length;
                  const meanY = yVals.reduce((a, b) => a + b, 0) / yVals.length;
                  let num = 0, den = 0;
                  for (let i = 0; i < xVals.length; i++) {
                    num += (xVals[i] - meanX) * (yVals[i] - meanY);
                    den += (xVals[i] - meanX) ** 2;
                  }
                  beta = den !== 0 ? num / den : 0;
                }

                // Compute 90th percentile historical upside/downside moves for robust baseline boundary
                const upsideMoves = xVals.filter(x => x > 0).sort((a, b) => a - b);
                const downsideMoves = xVals.filter(x => x < 0).sort((a, b) => a - b);

                const getPercentile = (arr, p) => {
                  if (!arr.length) return 2.5;
                  const idx = Math.floor(arr.length * p);
                  return arr[Math.min(idx, arr.length - 1)];
                };

                const robustUpsidePct = upsideMoves.length ? getPercentile(upsideMoves, 0.90) : 3.0;
                const robustDownsidePct = downsideMoves.length ? getPercentile(downsideMoves, 0.10) : -3.0;

                const volCapUpsidePrice = +(currentSpot * (1 + robustUpsidePct / 100)).toFixed(2);
                const volExhaustionDownsidePrice = +(currentSpot * (1 + robustDownsidePct / 100)).toFixed(2);

                const ivChangePer1PctMove = (Math.abs(beta) < 0.01 && beta !== 0) 
                  ? beta.toFixed(3) 
                  : beta.toFixed(2);

                return (
                  <div 
                    style={{
                      background: 'rgba(6, 182, 212, 0.06)',
                      border: '1px solid rgba(0, 240, 255, 0.25)',
                      borderRadius: '10px',
                      padding: '14px',
                      marginTop: '6px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                      <Activity size={15} color="#00F0FF" />
                      <strong style={{ color: '#ffffff', fontSize: '13px', fontFamily: "'JetBrains Mono', monospace" }}>
                        📊 Volatility Sensitivity & Terminal Price Impact Boundaries:
                      </strong>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
                      <div style={{ background: 'rgba(15, 23, 42, 0.8)', padding: '10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <span style={{ color: '#94a3b8', fontSize: '11px', display: 'block', fontFamily: 'monospace' }}>1% Spot Sensitivity (Beta)</span>
                        <span style={{ color: beta < 0 ? '#38bdf8' : '#10b981', fontSize: '14px', fontWeight: 'bold', fontFamily: 'monospace' }}>
                          {beta > 0 ? `+${ivChangePer1PctMove}%` : `${ivChangePer1PctMove}%`} IV
                        </span>
                        <span style={{ color: '#64748b', fontSize: '10px', display: 'block', marginTop: '2px' }}>
                          Expected IV shift per 1% stock return
                        </span>
                      </div>

                      <div style={{ background: 'rgba(15, 23, 42, 0.8)', padding: '10px', borderRadius: '6px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                        <span style={{ color: '#10b981', fontSize: '11px', display: 'block', fontFamily: 'monospace' }}>Upside Vol-Crush Cap (90th Pct)</span>
                        <span style={{ color: '#ffffff', fontSize: '14px', fontWeight: 'bold', fontFamily: 'monospace' }}>
                          ${volCapUpsidePrice} <span style={{ fontSize: '11px', color: '#10b981' }}>(+{robustUpsidePct.toFixed(1)}%)</span>
                        </span>
                        <span style={{ color: '#94a3b8', fontSize: '10px', display: 'block', marginTop: '2px' }}>
                          Beyond ${volCapUpsidePrice}, IV expansion saturates / crushes
                        </span>
                      </div>

                      <div style={{ background: 'rgba(15, 23, 42, 0.8)', padding: '10px', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                        <span style={{ color: '#ef4444', fontSize: '11px', display: 'block', fontFamily: 'monospace' }}>Downside Vol Panic Floor (90th Pct)</span>
                        <span style={{ color: '#ffffff', fontSize: '14px', fontWeight: 'bold', fontFamily: 'monospace' }}>
                          ${volExhaustionDownsidePrice} <span style={{ fontSize: '11px', color: '#ef4444' }}>({robustDownsidePct.toFixed(1)}%)</span>
                        </span>
                        <span style={{ color: '#94a3b8', fontSize: '10px', display: 'block', marginTop: '2px' }}>
                          Below ${volExhaustionDownsidePrice}, put panic saturates / flattens
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          );
        })()}

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
