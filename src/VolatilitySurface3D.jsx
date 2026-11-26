import React, { useState, useEffect, useRef, useMemo } from 'react';
import './VolatilitySurface3D.css';
import VolHeatmapStudio from './VolHeatmapStudio';
import { 
  Loader2, Zap, Target, TrendingUp, TrendingDown, 
  Activity, Compass, Layers, AlertCircle, ArrowUpRight, 
  CheckCircle2, Sliders, Info, Eye, ChevronDown, ChevronUp,
  Crosshair, Shield, Sparkles, Filter, ArrowRight, ShieldCheck,
  Check, Maximize2, Bot, Cpu, Brain, Flame, Camera, RotateCw, Download
} from 'lucide-react';

const COLOR_PALETTES = [
  { id: 'HedgingRegimes', label: '🛡️ Hedging Regimes (Over/Under)' },
  { id: 'LocalVol', label: '🔥 Dupire Local Vol (σ_loc)' },
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
  iso: { eye: { x: 1.72, y: -1.18, z: 0.56 }, label: '📐 Isometric' },
  skew: { eye: { x: 0.05, y: -2.15, z: 0.25 }, label: '📉 Skew Face' },
  term: { eye: { x: 2.15, y: 0.05, z: 0.28 }, label: '⏳ Term Side' },
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

const VolatilitySurface3D = ({ ticker = 'SPY', refreshKey = 0 }) => {
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
  const [showHedgingGuide, setShowHedgingGuide] = useState(false);
  const [showAxesGuide, setShowAxesGuide] = useState(false);
  const [showCalibrationPanel, setShowCalibrationPanel] = useState(false);
  const [showSviChartInfo, setShowSviChartInfo] = useState(true);
  const [highlightedSetupId, setHighlightedSetupId] = useState(null);
  const [focusedHotspot, setFocusedHotspot] = useState(null);
  const [expandedSetupId, setExpandedSetupId] = useState(null);
  const [setupCategory, setSetupCategory] = useState('ALL');
  const [volMoveLookback, setVolMoveLookback] = useState('OFF'); // 'OFF' | 'INTRADAY' | '1D' | '2D' | '3D' | '5D' | '10D'
  const [volMoveColorByDelta, setVolMoveColorByDelta] = useState(false);
  const [interdayShiftMode, setInterdayShiftMode] = useState(false); // true => Motion Engine ON (Intraday Open->Live or Interday 1D-10D)
  const [motionCoordFrame, setMotionCoordFrame] = useState('sticky_strike'); // 'sticky_strike' | 'sticky_delta' | 'spot_slide'
  const [motionVisualStyle, setMotionVisualStyle] = useState('delta_relief'); // 'delta_relief' | 'before_after'
  const [intradayFrameIdx, setIntradayFrameIdx] = useState(-1); // -1 => latest intraday checkpoint
  const [isMotionPlaying, setIsMotionPlaying] = useState(false);
  const [motionPlaySpeed, setMotionPlaySpeed] = useState(900); // 900 (1x) | 480 (2x)
  const [multiDayChartSubmode, setMultiDayChartSubmode] = useState('term_shift'); // 'term_shift' | 'daily_iv_skew'
  const [surfacePrecision, setSurfacePrecision] = useState('exact'); // 'exact' | 'smooth' (exact preserves earnings/event kinks!)
  const [zRelief, setZRelief] = useState('1.15'); // '1.15' | '1.55'
  const [plotlyReady, setPlotlyReady] = useState(Boolean(window.Plotly));
  const plotRef = useRef(null);
  const [plotWidth, setPlotWidth] = useState(0);

  useEffect(() => {
    const el = plotRef.current;
    if (!el) return undefined;
    const upd = () => {
      if (el.clientWidth > 0) setPlotWidth(el.clientWidth);
    };
    upd();
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(upd);
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener('resize', upd);
    return () => window.removeEventListener('resize', upd);
  }, [activeViewMode, loading, error]);
  const surfaceCardRef = useRef(null);
  const rotateAngleRef = useRef(0);
  const animFrameRef = useRef(null);

  // Reset ticker-scoped focus locks & selections whenever switching tickers
  useEffect(() => {
    setFocusedHotspot(null);
    setHighlightedSetupId(null);
    setExpandedSetupId(null);
    setSelectedExpiry('All');
    setIntradayFrameIdx(-1);
    setIsMotionPlaying(false);
  }, [ticker]);

  // Keep motion playback smooth across Intraday checkpoints or Chronological Interday lookbacks
  useEffect(() => {
    if (!isMotionPlaying || !interdayShiftMode || volMoveLookback === 'OFF') return undefined;
    const isIntra = volMoveLookback === 'INTRADAY';
    const cps = data?.intraday_iv_motion?.checkpoints || [];
    const replayOrder = data?.interday_iv_motion?.replay_order || ['10D', '5D', '3D', '2D', '1D'];

    if (isIntra && cps.length < 2) {
      setIsMotionPlaying(false);
      return undefined;
    }
    if (!isIntra && replayOrder.length < 2) {
      setIsMotionPlaying(false);
      return undefined;
    }

    const timer = window.setInterval(() => {
      if (isIntra) {
        setIntradayFrameIdx((prev) => {
          const cur = (prev < 0 || prev >= cps.length) ? 0 : prev;
          return (cur + 1) % cps.length;
        });
      } else {
        setVolMoveLookback((curr) => {
          const idx = replayOrder.indexOf(curr);
          const nextIdx = idx >= 0 ? (idx + 1) % replayOrder.length : 0;
          return replayOrder[nextIdx];
        });
      }
    }, motionPlaySpeed);
    return () => window.clearInterval(timer);
  }, [isMotionPlaying, interdayShiftMode, volMoveLookback, motionPlaySpeed, data]);

  useEffect(() => {
    if (!interdayShiftMode && isMotionPlaying) {
      setIsMotionPlaying(false);
    }
  }, [interdayShiftMode, isMotionPlaying]);

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

    // Exclude noisy expiring-today 0DTE/1DTE stubs (dte <= 1) from the 3D mesh when >= 3 active tenors exist,
    // preventing stale bid/ask 0DTE quotes (e.g. 150%+ IV) from forming a disconnected front-edge cliff.
    const meshCandidateTerm = candidateTerm.filter(t => (t.dte ?? 30) >= 2).length >= 3
      ? candidateTerm.filter(t => (t.dte ?? 30) >= 2)
      : candidateTerm;

    // Select up to 22 benchmark tenors for the 3D Surface mesh so front-month earnings kinks
    // and post-event valleys are rendered with high-resolution term-structure relief!
    const targetTenorCount = tenorHorizon === '1M' ? 14 : (tenorHorizon === '3M' ? 18 : 22);
    let surfaceTerm = meshCandidateTerm;
    if (meshCandidateTerm.length > targetTenorCount) {
      const selectedIndices = new Set([0, meshCandidateTerm.length - 1]);
      // Always preserve the peak ATM IV tenor + its immediate neighbors (so earnings-week hump has full shape)
      let peakIdx = 0;
      let troughIdx = 0;
      for (let i = 1; i < meshCandidateTerm.length; i++) {
        if ((meshCandidateTerm[i].atm_iv || 0) > (meshCandidateTerm[peakIdx].atm_iv || 0)) {
          peakIdx = i;
        }
        if ((meshCandidateTerm[i].atm_iv || 0) < (meshCandidateTerm[troughIdx].atm_iv || 0)) {
          troughIdx = i;
        }
      }
      [peakIdx, troughIdx].forEach(extIdx => {
        selectedIndices.add(extIdx);
        if (extIdx > 0) selectedIndices.add(extIdx - 1);
        if (extIdx < meshCandidateTerm.length - 1) selectedIndices.add(extIdx + 1);
      });

      // Preserve any interior local vol kink (peak) OR valley (trough) plus immediate neighbors so 3D slopes are crisp
      const kinkCandidates = [];
      for (let i = 1; i < meshCandidateTerm.length - 1; i++) {
        const prevT = meshCandidateTerm[i - 1];
        const currT = meshCandidateTerm[i];
        const nextT = meshCandidateTerm[i + 1];
        const dSpan = Math.max(1, (nextT.dte || 1) - (prevT.dte || 0));
        const interpIv = (prevT.atm_iv || 0) + ((nextT.atm_iv || 0) - (prevT.atm_iv || 0)) * (((currT.dte || 0) - (prevT.dte || 0)) / dSpan);
        const dev = (currT.atm_iv || 0) - interpIv;
        if (Math.abs(dev) >= 0.7) {
          kinkCandidates.push({ i, absDev: Math.abs(dev) });
        }
      }
      kinkCandidates.sort((a, b) => b.absDev - a.absDev);
      for (const kc of kinkCandidates) {
        if (selectedIndices.size >= targetTenorCount - 2) break;
        selectedIndices.add(kc.i - 1);
        selectedIndices.add(kc.i);
        selectedIndices.add(kc.i + 1);
      }

      const minD = meshCandidateTerm[0].dte || 2;
      const maxD = meshCandidateTerm[meshCandidateTerm.length - 1].dte || maxDte;

      // Front-loaded power spacing (t^2.1) keeps dense weekly/monthly resolution for earnings kinks & valleys
      for (let k = 1; k < targetTenorCount - 1; k++) {
        if (selectedIndices.size >= targetTenorCount) break;
        const frac = Math.pow(k / (targetTenorCount - 1), 2.1);
        const targetDte = minD + ((maxD - minD) * frac);
        let bestIdx = Math.round((k * (meshCandidateTerm.length - 1)) / (targetTenorCount - 1));
        let bestScore = Infinity;

        for (let idx = 1; idx < meshCandidateTerm.length - 1; idx++) {
          if (selectedIndices.has(idx)) continue;
          const dteDist = Math.abs((meshCandidateTerm[idx].dte || 30) - targetDte);
          const coverageBonus = Math.min(20, (strikeCountByExp.get(meshCandidateTerm[idx].expiry) || 20) * 0.1);
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
        .map(idx => meshCandidateTerm[idx]);
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

  const fetchSurface = React.useCallback(async (forceRefresh = false) => {
    if (!ticker) return;
    setLoading(true);
    setError(null);
    const qs = `ticker=${encodeURIComponent(ticker)}${forceRefresh ? '&refresh=true' : ''}`;
    const candidateUrls = [
      `/api/volatility_surface?${qs}`,
      `http://127.0.0.1:5000/api/volatility_surface?${qs}`,
      `http://localhost:5000/api/volatility_surface?${qs}`
    ];

    let lastErr = null;
    for (let i = 0; i < candidateUrls.length; i++) {
      const url = candidateUrls[i];
      try {
        const response = await fetch(url);
        if (!response.ok) {
          const errData = await response.json().catch(() => null);
          // If client error (e.g. 400 Invalid ticker / No options chain), stop immediately and show server message
          if (response.status >= 400 && response.status < 500 && errData?.error) {
            throw Object.assign(new Error(errData.error), { isClientError: true });
          }
          throw new Error(errData?.error || `HTTP ${response.status}: Failed to load volatility surface for ${ticker}`);
        }
        const result = await response.json();
        if (result && result.surface) {
          setData(result);
          setError(null);
          setLoading(false);
          return;
        } else if (result && result.error) {
          throw Object.assign(new Error(result.error), { isClientError: true });
        }
      } catch (err) {
        lastErr = err;
        if (err?.isClientError) break;
        // Brief pause before trying direct backend fallback URL
        await new Promise(res => setTimeout(res, 250));
      }
    }

    console.error("Error fetching volatility surface", lastErr);
    setError(lastErr?.message || "Failed to load options volatility surface");
    setLoading(false);
  }, [ticker]);

  useEffect(() => {
    fetchSurface(false);
  }, [fetchSurface, refreshKey]);

  // Automatic self-healing retry if browser hit transient "Load failed" / "Failed to fetch" during server/proxy restart
  useEffect(() => {
    if (!error) return;
    const isTransientNetErr = /load failed|failed to fetch|networkerror|http 502|http 503|http 504/i.test(String(error));
    if (!isTransientNetErr) return;
    const retryTimer = setTimeout(() => {
      fetchSurface(false);
    }, 2200);
    return () => clearTimeout(retryTimer);
  }, [error, fetchSurface]);

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

  const heatmapExportRef = useRef(null);
  const handleExportSnapshot = () => {
    if (activeViewMode === 'heatmap' && typeof heatmapExportRef.current === 'function') {
      heatmapExportRef.current();
      return;
    }
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
    if (activeViewMode === 'heatmap') {
      if (plotRef.current && window.Plotly) {
        try { window.Plotly.purge(plotRef.current); } catch (_) {}
      }
      return;
    }
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
      const coreBandPct = tenorHorizon === '1M' ? 0.09 : (tenorHorizon === '3M' ? 0.11 : 0.13);
      let coreStrikes = spot
        ? rawStrikes.filter(s => Math.abs(s - spot) / spot <= coreBandPct)
        : rawStrikes;
      if (coreStrikes.length < 8) {
        coreStrikes = rawStrikes;
      }

      const maxGridStrikes = 34;
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
            const local_vol = Number(((left.local_vol || fit_iv) + w * ((right.local_vol || fit_iv) - (left.local_vol || fit_iv))).toFixed(2));
            const iv_bid = (left.iv_bid && right.iv_bid) ? Number((left.iv_bid + w * (right.iv_bid - left.iv_bid)).toFixed(2)) : null;
            const iv_ask = (left.iv_ask && right.iv_ask) ? Number((left.iv_ask + w * (right.iv_ask - left.iv_ask)).toFixed(2)) : null;
            const dislocation_pct = Number(((left.dislocation_pct || 0) + w * ((right.dislocation_pct || 0) - (left.dislocation_pct || 0))).toFixed(1));
            return {
              expiry: exp,
              dte: left.dte,
              strike: targetStrike,
              iv,
              fit_iv,
              local_vol,
              iv_bid,
              iv_ask,
              dislocation_pct,
              type: targetStrike < (spot || left.strike) ? 'otm_put' : 'otm_call',
              hedge_label: dislocation_pct >= 4 ? 'OVERHEDGED (Rich vs SVI)' : (dislocation_pct <= -4 ? 'UNDERHEDGED (Cheap vs SVI)' : 'BALANCED (Fair SVI Value)')
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

      // Despike isolated single-strike stale quotes (e.g. >12 vol pt needle drop/spike vs neighbors)
      // while preserving genuine market smile curvature and event kinks.
      for (let i = 0; i < expirations.length; i++) {
        for (let j = 1; j < strikes.length - 1; j++) {
          const mid = 0.5 * (zData[i][j - 1] + zData[i][j + 1]);
          if (Math.abs(zData[i][j] - mid) > 12.0) {
            const cell = evalGrid[i][j];
            const fitFallback = (cell && cell.fit_iv && Math.abs(cell.fit_iv - mid) <= 12.0) ? cell.fit_iv : mid;
            zData[i][j] = Number((0.25 * zData[i][j] + 0.75 * fitFallback).toFixed(2));
          }
        }
      }

      // Only apply 2-pass smoothing when user selects Smooth Manifold; Exact Kinks preserves every earnings-week ridge!
      if (surfacePrecision === 'smooth') {
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
      }

      const todayZData = zData.map(row => [...row]);

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

      // Helper: bilinearly resample any backend (srcExps x srcStrikes) motion matrix onto current (expirations x strikes)
      const sampleMotionMatrix = (srcExps, srcStrikes, srcMat, fallbackVal = 0.0) => {
        if (!Array.isArray(srcExps) || !Array.isArray(srcStrikes) || !Array.isArray(srcMat) || srcExps.length === 0 || srcStrikes.length === 0) {
          return expirations.map(() => strikes.map(() => fallbackVal));
        }
        const rowMap = new Map();
        srcExps.forEach((e, idx) => rowMap.set(e, idx));
        const dteIdxPairs = srcExps.map((e, idx) => {
          const tsF = (data.term_structure || []).find(t => t.expiry === e);
          const dVal = tsF?.dte ?? (activeData.term_structure || []).find(t => t.expiry === e)?.dte ?? (idx + 1) * 14;
          return { exp: e, idx, dte: dVal };
        });

        const interpCol = (rowArr, targetK) => {
          if (!Array.isArray(rowArr) || rowArr.length === 0) return fallbackVal;
          if (targetK <= srcStrikes[0]) return Number(rowArr[0] ?? fallbackVal);
          if (targetK >= srcStrikes[srcStrikes.length - 1]) return Number(rowArr[rowArr.length - 1] ?? fallbackVal);
          for (let sIdx = 0; sIdx < srcStrikes.length - 1; sIdx++) {
            const k0 = srcStrikes[sIdx];
            const k1 = srcStrikes[sIdx + 1];
            if (targetK >= k0 && targetK <= k1) {
              const w = (k1 - k0) > 1e-6 ? (targetK - k0) / (k1 - k0) : 0;
              const v0 = Number(rowArr[sIdx] ?? fallbackVal);
              const v1 = Number(rowArr[sIdx + 1] ?? fallbackVal);
              return Number((v0 + w * (v1 - v0)).toFixed(2));
            }
          }
          return fallbackVal;
        };

        return expirations.map((exp) => {
          const exactRowIdx = rowMap.get(exp);
          if (exactRowIdx !== undefined && srcMat[exactRowIdx]) {
            return strikes.map(st => interpCol(srcMat[exactRowIdx], st));
          }
          const tDte = (activeData.term_structure || []).find(t => t.expiry === exp)?.dte ?? 30;
          let lo = dteIdxPairs[0];
          let hi = dteIdxPairs[dteIdxPairs.length - 1];
          for (let r = 0; r < dteIdxPairs.length; r++) {
            if (dteIdxPairs[r].dte <= tDte) lo = dteIdxPairs[r];
            if (dteIdxPairs[r].dte >= tDte) { hi = dteIdxPairs[r]; break; }
          }
          const den = hi.dte - lo.dte;
          const wt = den > 0 ? Math.max(0, Math.min(1, (tDte - lo.dte) / den)) : 0;
          const rLo = srcMat[lo.idx];
          const rHi = srcMat[hi.idx];
          return strikes.map((st) => {
            const v0 = interpCol(rLo, st);
            const v1 = interpCol(rHi, st);
            return Number((v0 + wt * (v1 - v0)).toFixed(2));
          });
        });
      };

      const pickMatrixByFrame = (motionObj) => {
        if (!motionObj) return null;
        if (motionCoordFrame === 'sticky_delta' && motionObj.delta_sticky_delta_matrix) return motionObj.delta_sticky_delta_matrix;
        if (motionCoordFrame === 'spot_slide' && motionObj.delta_spot_slide_matrix) return motionObj.delta_spot_slide_matrix;
        return motionObj.delta_strike_matrix || null;
      };

      // Build Motion ΔIV Surface (True Intraday Open->Live OR Real Interday 1D/2D/3D/5D/10D)
      const intraMotion = data.intraday_iv_motion;
      const interMotionV4 = data.interday_iv_motion;
      const isIntradayMode = volMoveLookback === 'INTRADAY' && Boolean(intraMotion?.available && Array.isArray(intraMotion?.checkpoints) && intraMotion.checkpoints.length > 0);
      const effIntraIdx = isIntradayMode
        ? ((intradayFrameIdx >= 0 && intradayFrameIdx < intraMotion.checkpoints.length) ? intradayFrameIdx : intraMotion.checkpoints.length - 1)
        : -1;
      const activeIntraCp = isIntradayMode ? intraMotion.checkpoints[effIntraIdx] : null;
      const activeInterLbV4 = (!isIntradayMode && volMoveLookback && volMoveLookback !== 'OFF' && interMotionV4?.available)
        ? (interMotionV4.lookbacks?.[volMoveLookback] || null)
        : null;

      const lookbackSnap = (volMoveLookback && volMoveLookback !== 'OFF' && !isIntradayMode)
        ? (activeData.multi_day_vol_movement?.historical_snapshots?.[volMoveLookback]
          || (activeInterLbV4 ? { key: activeInterLbV4.key, label: activeInterLbV4.label, date: activeInterLbV4.date, iv_shift_pts: activeInterLbV4.summary?.atm_delta_iv || 0, skew_shift_pts: activeInterLbV4.summary?.skew_delta || 0 } : null))
        : null;

      const activeMotionMeta = activeIntraCp || activeInterLbV4 || null;
      const hasTrueV4Motion = Boolean(activeIntraCp || activeInterLbV4);
      const realDelta1dInfo = activeData.multi_day_vol_movement?.real_delta_iv_1d;
      let isRealPerContractDelta = hasTrueV4Motion;
      let realPointGrid = null;
      let pastZData = null;
      let deltaIvMatrix = null;
      let currentFrameZData = todayZData.map(r => [...r]);
      let motionZBounds = isIntradayMode ? intraMotion?.z_bounds : (activeInterLbV4 ? interMotionV4?.z_bounds : null);

      if (isIntradayMode && activeIntraCp) {
        const srcExps = intraMotion.grid_expirations || [];
        const srcStrikes = intraMotion.grid_strikes || [];
        const rawDelta = pickMatrixByFrame(activeIntraCp);
        deltaIvMatrix = sampleMotionMatrix(srcExps, srcStrikes, rawDelta, 0.0);
        currentFrameZData = activeIntraCp.iv_matrix
          ? sampleMotionMatrix(srcExps, srcStrikes, activeIntraCp.iv_matrix, 22.0)
          : todayZData.map(r => [...r]);
        pastZData = intraMotion.baseline_iv_matrix
          ? sampleMotionMatrix(srcExps, srcStrikes, intraMotion.baseline_iv_matrix, 22.0)
          : expirations.map((_, i) => strikes.map((__, j) => Number(Math.max(4.0, currentFrameZData[i][j] - deltaIvMatrix[i][j]).toFixed(2))));
      } else if (activeInterLbV4) {
        const srcExps = interMotionV4.grid_expirations || [];
        const srcStrikes = interMotionV4.grid_strikes || [];
        const rawDelta = pickMatrixByFrame(activeInterLbV4);
        deltaIvMatrix = sampleMotionMatrix(srcExps, srcStrikes, rawDelta, 0.0);
        currentFrameZData = interMotionV4.today_iv_matrix
          ? sampleMotionMatrix(srcExps, srcStrikes, interMotionV4.today_iv_matrix, 22.0)
          : todayZData.map(r => [...r]);
        pastZData = activeInterLbV4.prior_iv_matrix
          ? sampleMotionMatrix(srcExps, srcStrikes, activeInterLbV4.prior_iv_matrix, 22.0)
          : expirations.map((_, i) => strikes.map((__, j) => Number(Math.max(4.0, currentFrameZData[i][j] - deltaIvMatrix[i][j]).toFixed(2))));
      } else if (lookbackSnap) {
        const snapTsMap = new Map();
        (lookbackSnap.term_structure || []).forEach(t => snapTsMap.set(t.expiry, t));
        const baseShift = -(lookbackSnap.iv_shift_pts || 0); // past_iv - today_iv
        const skewShift = -(lookbackSnap.skew_shift_pts || 0);

        const fallbackPastZ = expirations.map((exp, i) => {
          const tsPast = snapTsMap.get(exp);
          const tenorDelta = tsPast ? (tsPast.atm_iv - tsPast.today_atm_iv) : baseShift;
          return strikes.map((st, j) => {
            const todayIv = todayZData[i][j];
            const moneynessOffset = spot ? ((st - spot) / spot) : 0;
            const wingTilt = -moneynessOffset * skewShift * 1.4;
            return Number(Math.max(4.0, todayIv + tenorDelta + wingTilt).toFixed(2));
          });
        });

        if (volMoveLookback === '1D' && realDelta1dInfo?.available) {
          isRealPerContractDelta = true;
          realPointGrid = expirations.map((_, i) =>
            strikes.map((__, j) => {
              const p = evalGrid[i][j];
              return Boolean(p && typeof p.real_delta_iv_1d === 'number' && !isNaN(p.real_delta_iv_1d));
            })
          );
          deltaIvMatrix = expirations.map((exp, i) => {
            const row = strikes.map((st, j) => {
              const p = evalGrid[i][j];
              if (p && typeof p.real_delta_iv_1d === 'number' && !isNaN(p.real_delta_iv_1d)) {
                return Number(p.real_delta_iv_1d.toFixed(2));
              }
              return null;
            });
            let lastIdx = -1;
            for (let j = 0; j < strikes.length; j++) {
              if (row[j] !== null) {
                if (lastIdx !== -1 && j > lastIdx + 1) {
                  const v0 = row[lastIdx];
                  const v1 = row[j];
                  for (let k = lastIdx + 1; k < j; k++) {
                    row[k] = Number((v0 + ((v1 - v0) * (k - lastIdx)) / (j - lastIdx)).toFixed(2));
                  }
                }
                lastIdx = j;
              }
            }
            const firstIdx = row.findIndex(v => v !== null);
            if (firstIdx !== -1) {
              for (let j = firstIdx - 1; j >= 0; j--) {
                const fb = todayZData[i][j] - fallbackPastZ[i][j];
                row[j] = Number((0.65 * row[j + 1] + 0.35 * fb).toFixed(2));
              }
              for (let j = lastIdx + 1; j < strikes.length; j++) {
                const fb = todayZData[i][j] - fallbackPastZ[i][j];
                row[j] = Number((0.65 * row[j - 1] + 0.35 * fb).toFixed(2));
              }
            } else {
              for (let j = 0; j < strikes.length; j++) {
                row[j] = Number((todayZData[i][j] - fallbackPastZ[i][j]).toFixed(2));
              }
            }
            return row;
          });
          pastZData = expirations.map((_, i) =>
            strikes.map((__, j) => Number(Math.max(4.0, todayZData[i][j] - deltaIvMatrix[i][j]).toFixed(2)))
          );
        } else {
          pastZData = fallbackPastZ;
          deltaIvMatrix = expirations.map((_, i) =>
            strikes.map((__, j) => Number((todayZData[i][j] - pastZData[i][j]).toFixed(2)))
          );
        }
      }

      const hasMotionLookback = Boolean((isIntradayMode && activeIntraCp) || activeInterLbV4 || lookbackSnap);
      const isBeforeAfterMode = Boolean(interdayShiftMode && hasMotionLookback && motionVisualStyle === 'before_after' && pastZData && deltaIvMatrix);
      const isInterdayDeltaZ = Boolean(interdayShiftMode && hasMotionLookback && !isBeforeAfterMode && deltaIvMatrix);

      if (isInterdayDeltaZ) {
        // Gentle 1-pass Laplacian smoothing on delta manifold for crisp saddle/ridge relief without erasing spikes
        let sm = deltaIvMatrix.map(row => row.map(v => Number(v)));
        for (let pass = 0; pass < 1; pass++) {
          const nextSm = sm.map(row => [...row]);
          for (let i = 0; i < expirations.length; i++) {
            for (let j = 0; j < strikes.length; j++) {
              const c = sm[i][j];
              const l = j > 0 ? sm[i][j - 1] : c;
              const r = j < strikes.length - 1 ? sm[i][j + 1] : c;
              const u = i > 0 ? sm[i - 1][j] : c;
              const d = i < expirations.length - 1 ? sm[i + 1][j] : c;
              nextSm[i][j] = Number((0.62 * c + 0.13 * (l + r) + 0.06 * (u + d)).toFixed(2));
            }
          }
          sm = nextSm;
        }
        deltaIvMatrix = sm;
        zData = deltaIvMatrix.map(row => row.map(v => Number(v)));
      } else if (isBeforeAfterMode) {
        zData = currentFrameZData.map(row => row.map(v => Number(v)));
      }

      const coordTagLabel = motionCoordFrame === 'sticky_delta'
        ? 'Pure Vol (Sticky-Δ)'
        : (motionCoordFrame === 'spot_slide' ? 'Spot-Slide' : 'Sticky-Strike');
      const motionScopeLabel = isIntradayMode
        ? `${activeIntraCp?.label_et || 'Intraday'} vs Open`
        : `${volMoveLookback} Ago`;

      if (hasMotionLookback && (volMoveColorByDelta || isInterdayDeltaZ || isBeforeAfterMode) && deltaIvMatrix) {
        surfaceColorMatrix = deltaIvMatrix;
        surfaceColorscale = [
          [0.0, '#10b981'],  // Deep Vol Crush (Emerald)
          [0.35, '#06b6d4'], // Mild Vol Crush (Cyan)
          [0.50, '#334155'], // Unchanged 0% ΔIV (Slate)
          [0.65, '#f59e0b'], // Mild Vol Expansion (Amber)
          [1.0, '#ef4444']   // Strong Vol Expansion (Crimson)
        ];
        cminVal = motionZBounds ? motionZBounds[0] : -6;
        cmaxVal = motionZBounds ? motionZBounds[1] : 6;
        colorbarTitle = isIntradayMode
          ? `Intraday ${coordTagLabel} ΔIV (%)`
          : (hasTrueV4Motion ? `Real ${volMoveLookback} ${coordTagLabel} ΔIV (%)` : `ΔIV vs ${volMoveLookback} Ago (%)`);
      } else if (surfaceColor === 'LocalVol') {
        surfaceColorMatrix = expirations.map((exp, i) =>
          strikes.map((st, j) => {
            const cell = evalGrid[i][j];
            return cell ? (cell.local_vol || cell.fit_iv || todayZData[i][j]) : todayZData[i][j];
          })
        );
        surfaceColorscale = 'Inferno';
        colorbarTitle = 'Dupire Local Vol (%)';
      } else if (surfaceColor === 'HedgingRegimes') {
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
      } else if (surfaceColor === 'Plasma') {
        surfaceColorscale = [
          [0.0, '#0f172a'],
          [0.16, '#1d4ed8'],
          [0.34, '#06b6d4'],
          [0.52, '#10b981'],
          [0.70, '#f59e0b'],
          [0.86, '#ef4444'],
          [1.0, '#ec4899']
        ];
      }

      // Build continuous log(1 + DTE) Y-axis coordinates so short-dated event kinks & valleys
      // render with true quantitative time-decay geometry instead of compressed categorical steps
      const expDteMap = new Map();
      term_structure.forEach(t => {
        if (t && t.expiry) expDteMap.set(t.expiry, Math.max(1, t.dte ?? 1));
      });
      surface.forEach(p => {
        if (p && p.expiry && !expDteMap.has(p.expiry)) expDteMap.set(p.expiry, Math.max(1, p.dte ?? 1));
      });
      const yExpCoords = [];
      let prevY = -1;
      expirations.forEach((exp, idx) => {
        const dte = expDteMap.get(exp) || (idx + 1) * 7;
        let yVal = Number(Math.log1p(dte).toFixed(4));
        if (yVal <= prevY) yVal = Number((prevY + 0.05).toFixed(4));
        prevY = yVal;
        yExpCoords.push(yVal);
      });
      const expToY = (exp) => {
        const idx = expirations.indexOf(exp);
        if (idx !== -1) return yExpCoords[idx];
        const dte = expDteMap.get(exp);
        return dte ? Number(Math.log1p(dte).toFixed(4)) : (yExpCoords[0] || 0);
      };

      // Select clean, non-overlapping Y-axis tick labels (~7-9 ticks across log(1+DTE))
      const yTickIndices = new Set([0, expirations.length - 1]);
      let lastTickY = yExpCoords[0] ?? 0;
      const minTickGap = ((yExpCoords[yExpCoords.length - 1] ?? 1) - (yExpCoords[0] ?? 0)) / 7.5;
      for (let i = 1; i < expirations.length - 1; i++) {
        if (yExpCoords[i] - lastTickY >= minTickGap) {
          yTickIndices.add(i);
          lastTickY = yExpCoords[i];
        }
      }
      const sortedTickIdx = Array.from(yTickIndices).sort((a, b) => a - b);
      const yTickVals = sortedTickIdx.map(i => yExpCoords[i]);
      const yTickLabels = sortedTickIdx.map(i => {
        const exp = expirations[i];
        const dte = expDteMap.get(exp);
        return dte ? `${dte}D (${exp.slice(5)})` : exp;
      });

      // Rich hover template matrix (uses immutable todayZData so ΔIV mode never corrupts Live IV)
      const hoverTextMatrix = expirations.map((exp, i) => {
        return strikes.map((st, j) => {
          const p = evalGrid[i][j];
          const frameIv = currentFrameZData[i][j];
          const pastIv = pastZData ? pastZData[i][j] : null;
          const dIv = deltaIvMatrix ? deltaIvMatrix[i][j] : null;
          if ((isInterdayDeltaZ || isBeforeAfterMode) && dIv !== null && hasMotionLookback) {
            const regimeTxt = dIv >= 0.4 ? 'Vol Expansion' : (dIv <= -0.4 ? 'Vol Crush' : 'Flat');
            const srcTag = isIntradayMode
              ? `Alpaca 30m Option + SIP Bars (${activeIntraCp?.label_et})`
              : (activeInterLbV4 ? `Alpaca Real Daily Option Bars (${activeInterLbV4.date})` : 'Term/Skew Shift Model');
            const optType = p ? (p.type === 'otm_put' ? 'PUT' : (p.type === 'otm_call' ? 'CALL' : 'ATM')) : 'NODE';
            return `<b>${optType} $${st}</b> (${(st / (spot || 1)).toFixed(2)}x Spot)<br>` +
                   `Tenor: ${exp}${p?.dte ? ` (${p.dte}d)` : ''}<br>` +
                   `<b>${coordTagLabel} ΔIV (${motionScopeLabel}): ${dIv >= 0 ? '+' : ''}${dIv}% (${regimeTxt})</b><br>` +
                   `${isIntradayMode ? activeIntraCp?.label_et : 'Current'} IV: <b>${frameIv}%</b> | ${isIntradayMode ? intraMotion.baseline_label : (lookbackSnap?.label || volMoveLookback)} IV: <b>${pastIv}%</b>` +
                   `<br><i>Source: ${srcTag}</i>`;
          }
          const todayIv = todayZData[i][j];
          const moveLine = (pastIv !== null && dIv !== null && lookbackSnap)
            ? `<br>${lookbackSnap.label} IV: <b>${pastIv}%</b> (Shift: <b>${dIv >= 0 ? '+' : ''}${dIv}%</b>)`
            : '';
          if (!p) {
            return `<b>Strike: $${st}</b> (${(st / (spot || 1)).toFixed(2)}x Spot)<br>Tenor: ${exp}<br>Surface IV: <b>${todayIv}%</b>${moveLine}`;
          }
          const dis = p.dislocation_pct !== undefined ? (p.dislocation_pct > 0 ? `+${p.dislocation_pct}%` : `${p.dislocation_pct}%`) : '0%';
          const state = p.hedge_label || 'BALANCED (Fair SVI Value)';
          const fit = p.fit_iv || todayIv;
          const locV = p.local_vol ? `<br>Dupire Local Vol (σ_loc): <b>${p.local_vol}%</b>` : '';
          const baLine = (p.iv_bid && p.iv_ask) ? `<br>Bid–Ask IV Band: ${p.iv_bid}% – ${p.iv_ask}%` : '';
          const optType = p.type === 'otm_put' ? 'PUT' : (p.type === 'otm_call' ? 'CALL' : 'ATM');
          return `<b>${optType} $${st}</b> (${(st / (spot || 1)).toFixed(2)}x Spot)<br>` +
                 `Tenor: ${p.expiry} (${p.dte}d)<br>` +
                 `Market IV (Mid B76): <b>${todayIv}%</b>${baLine}${moveLine}<br>` +
                 `Arb-Free SVI Fair: <b>${fit}%</b> (${dis})${locV}<br>` +
                 `State: <b>${state}</b>`;
        });
      });

      // Compute robust Z-bounds separately for signed ΔIV mode vs positive IV surface mode
      const flatZ = zData.flat().filter(v => typeof v === 'number' && !isNaN(v)).sort((a, b) => a - b);
      let robustZMin = flatZ.length ? flatZ[0] : (isInterdayDeltaZ ? -3 : 10);
      let robustZMax = flatZ.length ? flatZ[flatZ.length - 1] : (isInterdayDeltaZ ? 3 : 60);
      if (flatZ.length >= 10) {
        const p02 = flatZ[Math.floor(flatZ.length * 0.02)];
        const p95 = flatZ[Math.floor(flatZ.length * 0.95)];
        const p98 = flatZ[Math.floor(flatZ.length * 0.98)];
        if (isInterdayDeltaZ) {
          robustZMin = p02;
          robustZMax = p98;
          if ((flatZ[flatZ.length - 1] - flatZ[0]) > 28.0) {
            const clipLo = Number((p02 - 2.0).toFixed(2));
            const clipHi = Number((p98 + 2.0).toFixed(2));
            zData = zData.map(row => row.map(v => typeof v === 'number' ? Number(Math.max(clipLo, Math.min(clipHi, v)).toFixed(2)) : v));
            robustZMin = clipLo;
            robustZMax = clipHi;
          }
        } else {
          robustZMin = p02;
          if (robustZMax > p95 * 1.85) {
            robustZMax = p98 * 1.08;
            zData = zData.map(row => row.map(v => (typeof v === 'number' && v > robustZMax ? Number(robustZMax.toFixed(2)) : v)));
          }
        }
      }
      let zAxisRange;
      if (isInterdayDeltaZ) {
        if (motionZBounds && motionZBounds.length === 2) {
          zAxisRange = [Number(motionZBounds[0]), Number(motionZBounds[1])];
          const symMax = Math.max(Math.abs(motionZBounds[0]), Math.abs(motionZBounds[1]));
          cminVal = -Number(symMax.toFixed(1));
          cmaxVal = Number(symMax.toFixed(1));
        } else {
          const zPad = Math.max(0.8, (robustZMax - robustZMin) * 0.12);
          zAxisRange = [Number(Math.min(-1.5, robustZMin - zPad).toFixed(2)), Number(Math.max(1.5, robustZMax + zPad).toFixed(2))];
          const symAbs = Math.max(Math.abs(robustZMin), Math.abs(robustZMax));
          cminVal = -Math.max(2.5, Math.min(18.0, Math.ceil(symAbs)));
          cmaxVal = -cminVal;
        }
      } else {
        const zSpan = Math.max(2.0, robustZMax - robustZMin);
        zAxisRange = [Number((robustZMin - zSpan * 0.06).toFixed(2)), Number((robustZMax + zSpan * 0.08).toFixed(2))];
      }

      // Shape-preserving PCHIP (Fritsch-Carlson) Y-axis upsampling (2 sub-steps per tenor span)
      // Connects front-end kinks & valleys into a continuous sculpted surface while passing through EVERY exact market tenor!
      const pchipSubSteps = 3;
      const yMesh = [];
      const zMesh = [];
      const hoverMesh = [];
      const colorMesh = surfaceColorMatrix ? [] : undefined;

      if (yExpCoords.length >= 2) {
        const nY = yExpCoords.length;
        const nX = strikes.length;
        // Precompute PCHIP slopes per strike column
        const slopes = Array.from({ length: nY }, () => new Array(nX).fill(0));
        for (let j = 0; j < nX; j++) {
          const d = [];
          const h = [];
          for (let i = 0; i < nY - 1; i++) {
            const hi = Math.max(1e-4, yExpCoords[i + 1] - yExpCoords[i]);
            h.push(hi);
            d.push((zData[i + 1][j] - zData[i][j]) / hi);
          }
          slopes[0][j] = d[0];
          slopes[nY - 1][j] = d[nY - 2];
          for (let i = 1; i < nY - 1; i++) {
            if (d[i - 1] * d[i] <= 0) {
              slopes[i][j] = 0; // Preserve local extrema (peaks & valleys) with zero overshoot!
            } else {
              const w1 = 2 * h[i] + h[i - 1];
              const w2 = h[i] + 2 * h[i - 1];
              slopes[i][j] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]);
            }
          }
        }

        for (let i = 0; i < nY - 1; i++) {
          const y0 = yExpCoords[i];
          const y1 = yExpCoords[i + 1];
          const h = y1 - y0;
          const dte0 = expDteMap.get(expirations[i]) || 1;
          const dte1 = expDteMap.get(expirations[i + 1]) || dte0;

          for (let s = 0; s < pchipSubSteps; s++) {
            const t = s / pchipSubSteps;
            const yVal = Number((y0 + t * h).toFixed(4));
            yMesh.push(yVal);
            if (s === 0) {
              zMesh.push(zData[i]);
              hoverMesh.push(hoverTextMatrix[i]);
              if (colorMesh) colorMesh.push(surfaceColorMatrix[i]);
            } else {
              const t2 = t * t;
              const t3 = t2 * t;
              const h00 = 2 * t3 - 3 * t2 + 1;
              const h10 = t3 - 2 * t2 + t;
              const h01 = -2 * t3 + 3 * t2;
              const h11 = t3 - t2;
              const interpDte = Math.round(Math.expm1(yVal));
              const rowZ = new Array(nX);
              const rowHover = new Array(nX);
              const rowCol = colorMesh ? new Array(nX) : null;
              for (let j = 0; j < nX; j++) {
                const v = h00 * zData[i][j] + h10 * h * slopes[i][j] + h01 * zData[i + 1][j] + h11 * h * slopes[i + 1][j];
                const clampedV = isInterdayDeltaZ
                  ? Number(Math.max(zAxisRange[0], Math.min(zAxisRange[1], v)).toFixed(2))
                  : Number(Math.max(4.0, Math.min(robustZMax * 1.05, v)).toFixed(2));
                rowZ[j] = clampedV;
                rowHover[j] = isInterdayDeltaZ
                  ? `<b>Strike: $${strikes[j]}</b> (${(strikes[j] / (spot || 1)).toFixed(2)}x Spot)<br>Interpolated Tenor: ~${interpDte}D<br>ΔIV Shift vs ${volMoveLookback}: <b>${clampedV >= 0 ? '+' : ''}${clampedV}%</b>`
                  : `<b>Strike: $${strikes[j]}</b> (${(strikes[j] / (spot || 1)).toFixed(2)}x Spot)<br>Interpolated Tenor: ~${interpDte}D<br>Surface IV: <b>${clampedV}%</b>`;
                if (rowCol) {
                  rowCol[j] = Number((surfaceColorMatrix[i][j] + t * (surfaceColorMatrix[i + 1][j] - surfaceColorMatrix[i][j])).toFixed(2));
                }
              }
              zMesh.push(rowZ);
              hoverMesh.push(rowHover);
              if (colorMesh) colorMesh.push(rowCol);
            }
          }
        }
        // Final real tenor row
        yMesh.push(yExpCoords[nY - 1]);
        zMesh.push(zData[nY - 1]);
        hoverMesh.push(hoverTextMatrix[nY - 1]);
        if (colorMesh) colorMesh.push(surfaceColorMatrix[nY - 1]);
      } else {
        yMesh.push(...yExpCoords);
        zMesh.push(...zData);
        hoverMesh.push(...hoverTextMatrix);
        if (colorMesh) colorMesh.push(...surfaceColorMatrix);
      }

      // Base 3D Surface with High-Relief Terrain Lighting & Crisp Contour Lines
      const baseSurfaceTrace = {
        type: 'surface',
        name: isInterdayDeltaZ
          ? `${coordTagLabel} ΔIV (${motionScopeLabel})`
          : (isBeforeAfterMode ? `${isIntradayMode ? activeIntraCp?.label_et : 'Current'} IV Surface` : 'Today Live Vol Surface'),
        z: zMesh,
        x: xValues,
        y: yMesh,
        colorscale: surfaceColorscale,
        showscale: true,
        opacity: (hasMotionLookback || isBeforeAfterMode) ? 0.88 : 0.95,
        lighting: {
          ambient: 0.52,
          diffuse: 0.95,
          fresnel: 0.35,
          specular: 0.65,
          roughness: 0.28
        },
        lightposition: { x: 100, y: 200, z: 120 },
        hoverinfo: 'text',
        text: hoverMesh,
        colorbar: { 
          title: { text: colorbarTitle, font: { color: currentBg.text, family: "'JetBrains Mono', monospace", size: 10 }, side: 'top' }, 
          tickfont: { color: currentBg.text, family: "'JetBrains Mono', monospace", size: 9.5 },
          orientation: 'h',
          len: 0.34,
          thickness: 10,
          x: 0.99,
          xanchor: 'right',
          y: 1.01,
          yanchor: 'bottom',
          ypad: 4
        },
        contours: {
          x: { show: true, color: 'rgba(255, 255, 255, 0.14)', width: 1 },
          y: { show: true, color: 'rgba(255, 255, 255, 0.16)', width: 1 },
          z: { show: true, usecolormap: true, highlightcolor: '#00F0FF', project: { z: true }, width: 1 }
        }
      };

      if ((surfaceColor === 'HedgingRegimes' || surfaceColor === 'LocalVol' || (hasMotionLookback && (volMoveColorByDelta || isInterdayDeltaZ || isBeforeAfterMode))) && colorMesh) {
        baseSurfaceTrace.surfacecolor = colorMesh;
        if (cminVal !== undefined && cmaxVal !== undefined) {
          baseSurfaceTrace.cmin = cminVal;
          baseSurfaceTrace.cmax = cmaxVal;
        }
      }

      const plotData = [baseSurfaceTrace];

      // Overlay Historical/Open Baseline Surface OR 0.0% Zero-Shift Plane + 3D Vertical Motion Vectors
      if (isInterdayDeltaZ) {
        plotData.push({
          type: 'surface',
          name: '0.0% Zero-Shift Plane',
          x: [xValues[0], xValues[xValues.length - 1]],
          y: [yExpCoords[0], yExpCoords[yExpCoords.length - 1]],
          z: [[0, 0], [0, 0]],
          showscale: false,
          opacity: 0.28,
          colorscale: [[0, '#94a3b8'], [1, '#94a3b8']],
          contours: {
            x: { show: true, color: 'rgba(148, 163, 184, 0.25)', width: 1 },
            y: { show: true, color: 'rgba(148, 163, 184, 0.25)', width: 1 },
            z: { show: false }
          },
          hoverinfo: 'skip'
        });
      } else if ((isBeforeAfterMode || lookbackSnap) && pastZData) {
        plotData.push({
          type: 'surface',
          name: `👻 ${isIntradayMode ? intraMotion.baseline_label : (lookbackSnap?.label || volMoveLookback)} Baseline Surface`,
          z: pastZData,
          x: xValues,
          y: yExpCoords,
          showscale: false,
          opacity: isBeforeAfterMode ? 0.42 : 0.34,
          colorscale: [[0, '#38bdf8'], [1, '#00F0FF']],
          contours: {
            x: { show: true, color: 'rgba(0, 240, 255, 0.55)', width: 1.5 },
            y: { show: true, color: 'rgba(0, 240, 255, 0.55)', width: 1.5 },
            z: { show: false }
          },
          hoverinfo: 'skip'
        });
      }

      // 3D Vertical Motion Flow Vectors (Rising crimson / Crushing emerald stems showing exact ΔIV movement direction)
      if ((isInterdayDeltaZ || isBeforeAfterMode) && deltaIvMatrix && expirations.length >= 2 && strikes.length >= 3) {
        const upX = [], upY = [], upZ = [], upTipX = [], upTipY = [], upTipZ = [], upTipTxt = [];
        const dnX = [], dnY = [], dnZ = [], dnTipX = [], dnTipY = [], dnTipZ = [], dnTipTxt = [];
        const rStep = Math.max(1, Math.floor(expirations.length / 5));
        const cStep = Math.max(1, Math.floor(strikes.length / 7));
        for (let i = 0; i < expirations.length; i += rStep) {
          for (let j = 1; j < strikes.length - 1; j += cStep) {
            const dVal = Number(deltaIvMatrix[i]?.[j] ?? 0);
            if (Math.abs(dVal) < 0.30) continue;
            const z0 = isBeforeAfterMode ? Number(pastZData[i]?.[j] ?? 20) : 0.0;
            const z1 = isBeforeAfterMode ? Number(zData[i]?.[j] ?? 20) : dVal;
            const xv = xValues[j];
            const yv = yExpCoords[i];
            const lbl = `${dVal >= 0 ? '▲' : '▼'} $${strikes[j]} (${expirations[i].slice(5)}): ${dVal >= 0 ? '+' : ''}${dVal.toFixed(1)}%`;
            if (dVal >= 0) {
              upX.push(xv, xv, null); upY.push(yv, yv, null); upZ.push(z0, z1, null);
              upTipX.push(xv); upTipY.push(yv); upTipZ.push(z1); upTipTxt.push(lbl);
            } else {
              dnX.push(xv, xv, null); dnY.push(yv, yv, null); dnZ.push(z0, z1, null);
              dnTipX.push(xv); dnTipY.push(yv); dnTipZ.push(z1); dnTipTxt.push(lbl);
            }
          }
        }
        if (upTipX.length > 0) {
          plotData.push({
            type: 'scatter3d',
            mode: 'lines',
            name: '▲ Rising IV Vectors',
            x: upX, y: upY, z: upZ,
            line: { color: 'rgba(248, 113, 113, 0.85)', width: 3.5 },
            hoverinfo: 'skip'
          });
          plotData.push({
            type: 'scatter3d',
            mode: 'markers',
            name: '▲ IV Expansion Tips',
            x: upTipX, y: upTipY, z: upTipZ,
            marker: { size: 4, color: '#ef4444', symbol: 'diamond', line: { color: '#fff', width: 1 } },
            hoverinfo: 'text',
            hovertext: upTipTxt
          });
        }
        if (dnTipX.length > 0) {
          plotData.push({
            type: 'scatter3d',
            mode: 'lines',
            name: '▼ Crushing IV Vectors',
            x: dnX, y: dnY, z: dnZ,
            line: { color: 'rgba(52, 211, 153, 0.85)', width: 3.5 },
            hoverinfo: 'skip'
          });
          plotData.push({
            type: 'scatter3d',
            mode: 'markers',
            name: '▼ IV Crush Tips',
            x: dnTipX, y: dnTipY, z: dnTipZ,
            marker: { size: 4, color: '#10b981', symbol: 'diamond', line: { color: '#fff', width: 1 } },
            hoverinfo: 'text',
            hovertext: dnTipTxt
          });
        }
      }

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

      const overPositions = ['top center', 'top right', 'top left'];
      const underPositions = ['bottom center', 'bottom left', 'bottom right'];

      if (isInterdayDeltaZ || isBeforeAfterMode) {
        // ΔIV-native pins & ATM spine across BOTH Intraday Open->Live AND Real Interday 1D/2D/3D/5D/10D!
        const pinSource = activeMotionMeta || (isRealPerContractDelta ? realDelta1dInfo : null);
        if (pinSource) {
          const topExpPins = (pinSource.top_expanding || [])
            .filter(h => expSet.has(h.expiry) && h.strike >= minGridStrike && h.strike <= maxGridStrike)
            .slice(0, 3);
          const topCrushPins = (pinSource.top_crushing || [])
            .filter(h => expSet.has(h.expiry) && h.strike >= minGridStrike && h.strike <= maxGridStrike)
            .slice(0, 3);

          if (topExpPins.length > 0) {
            plotData.push({
              type: 'scatter3d',
              mode: show3dLabels ? 'markers+text' : 'markers',
              name: '🔥 Vol Expansion Peaks',
              x: topExpPins.map(h => strikeMode === 'moneyness' ? +(h.strike / (spot || 1)).toFixed(3) : h.strike),
              y: topExpPins.map(h => expToY(h.expiry)),
              z: topExpPins.map(h => +(getSurfaceZAt(h.expiry, h.strike, isBeforeAfterMode ? (h.iv_now || 25) : h.delta_iv) + 0.4).toFixed(2)),
              text: topExpPins.map(h => `$${h.strike} (${h.delta_iv >= 0 ? '+' : ''}${Number(h.delta_iv).toFixed(1)}%)`),
              textposition: topExpPins.map((_, idx) => overPositions[idx % overPositions.length]),
              textfont: { color: '#f87171', family: "'JetBrains Mono', monospace", size: 11, weight: 'bold' },
              hoverinfo: 'text',
              hovertext: topExpPins.map(h =>
                `<b>🔥 VOL EXPANSION PEAK</b><br>` +
                `${h.type} $${h.strike} (${h.expiry} · ${h.dte}D)<br>` +
                `ΔIV (${motionScopeLabel}): <b>${h.delta_iv >= 0 ? '+' : ''}${h.delta_iv}%</b><br>` +
                `IV: <b>${h.iv_now}%</b> (Base: ${h.iv_prev}%)`
              ),
              marker: { size: 7, color: '#ef4444', symbol: 'diamond', line: { color: '#ffffff', width: 1.5 } }
            });
          }

          if (topCrushPins.length > 0) {
            plotData.push({
              type: 'scatter3d',
              mode: show3dLabels ? 'markers+text' : 'markers',
              name: '🧊 Vol Crush / Lagging Pockets',
              x: topCrushPins.map(h => strikeMode === 'moneyness' ? +(h.strike / (spot || 1)).toFixed(3) : h.strike),
              y: topCrushPins.map(h => expToY(h.expiry)),
              z: topCrushPins.map(h => +(getSurfaceZAt(h.expiry, h.strike, isBeforeAfterMode ? (h.iv_now || 20) : h.delta_iv) - 0.35).toFixed(2)),
              text: topCrushPins.map(h => `$${h.strike} (${h.delta_iv >= 0 ? '+' : ''}${Number(h.delta_iv).toFixed(1)}%)`),
              textposition: topCrushPins.map((_, idx) => underPositions[idx % underPositions.length]),
              textfont: { color: '#34d399', family: "'JetBrains Mono', monospace", size: 11, weight: 'bold' },
              hoverinfo: 'text',
              hovertext: topCrushPins.map(h =>
                `<b>🧊 VOL CRUSH / LAGGING STRIKE</b><br>` +
                `${h.type} $${h.strike} (${h.expiry} · ${h.dte}D)<br>` +
                `ΔIV (${motionScopeLabel}): <b>${h.delta_iv >= 0 ? '+' : ''}${h.delta_iv}%</b><br>` +
                `IV: <b>${h.iv_now}%</b> (Base: ${h.iv_prev}%)`
              ),
              marker: { size: 7, color: '#10b981', symbol: 'diamond', line: { color: '#ffffff', width: 1.5 } }
            });
          }
        }

        if (term_structure.length > 0 && spot) {
          const activeSpotLine = (isIntradayMode && activeIntraCp?.spot) ? activeIntraCp.spot : spot;
          const clampedSpot = Math.min(maxGridStrike, Math.max(minGridStrike, activeSpotLine));
          const atmX = strikeMode === 'moneyness' ? +(clampedSpot / (spot || 1)).toFixed(3) : clampedSpot;
          const ridgeTerms = term_structure.filter(ts => expSet.has(ts.expiry));
          if (ridgeTerms.length > 0) {
            plotData.push({
              type: 'scatter3d',
              mode: 'lines+markers',
              name: isBeforeAfterMode ? 'ATM Spot Spine' : 'ATM ΔIV Spine',
              x: ridgeTerms.map(() => atmX),
              y: ridgeTerms.map(ts => expToY(ts.expiry)),
              z: ridgeTerms.map(ts => +(getSurfaceZAt(ts.expiry, clampedSpot, 0) + 0.14).toFixed(2)),
              line: { color: '#fbbf24', width: 5 },
              marker: { size: 4, color: '#fbbf24' }
            });
          }
        }
      } else {
        // Floating 3D Overhedge / Underhedge Radar Callout Pins (Spaced >=7% apart so text never hits Kinks or ATM Spine)
        const rawTopOver = activeData.hedging_diagnostics?.top_overhedged || [];
        const rawTopUnder = activeData.hedging_diagnostics?.top_underhedged || [];
        const pickSpacedPins = (pool) => {
          const filtered = pool.filter(h => expSet.has(h.expiry) && h.strike >= minGridStrike && h.strike <= maxGridStrike);
          const picked = [];
          for (const item of filtered) {
            if (picked.some(p => Math.abs(p.strike - item.strike) / Math.max(spot || 1, 1) < 0.06)) continue;
            picked.push(item);
            if (picked.length >= 2) break;
          }
          return picked;
        };
        const topOver = pickSpacedPins(rawTopOver);
        const topUnder = pickSpacedPins(rawTopUnder);

        if (topOver.length > 0) {
          plotData.push({
            type: 'scatter3d',
            mode: show3dLabels ? 'markers+text' : 'markers',
            name: '🔴 Overhedged Peaks',
            x: topOver.map(h => strikeMode === 'moneyness' ? +(h.strike / (spot || 1)).toFixed(3) : h.strike),
            y: topOver.map(h => expToY(h.expiry)),
            z: topOver.map(h => +(getSurfaceZAt(h.expiry, h.strike, h.iv) + 1.05).toFixed(2)),
            text: topOver.map(h => `$${h.strike} (+${Math.round(h.dislocation_pct)}%)`),
            textposition: topOver.map((_, idx) => overPositions[idx % overPositions.length]),
            textfont: { color: '#f87171', family: "'JetBrains Mono', monospace", size: 10.5, weight: 'bold' },
            hoverinfo: 'text',
            hovertext: topOver.map(h => 
              `<b>🔴 OVERHEDGED PEAK (Rich Premium)</b><br>` +
              `Strike: <b>$${h.strike}</b> (${h.type === 'otm_put' ? 'PUT' : 'CALL'})<br>` +
              `Expiry: <b>${h.expiry}</b><br>` +
              `Market IV: <b>${h.iv}%</b> (SVI Fair: ${h.fit_iv || h.iv}%)<br>` +
              `Dislocation: <b>+${h.dislocation_pct}% Rich</b><br>` +
              `<i>Strategy: ${h.strategy || 'Sell Vol / Credit Spread'}</i>`
            ),
            marker: { size: 6.5, color: '#ef4444', symbol: 'diamond', line: { color: '#ffffff', width: 1.5 } }
          });
        }

        if (topUnder.length > 0) {
          plotData.push({
            type: 'scatter3d',
            mode: show3dLabels ? 'markers+text' : 'markers',
            name: '🟢 Underhedged Valleys',
            x: topUnder.map(h => strikeMode === 'moneyness' ? +(h.strike / (spot || 1)).toFixed(3) : h.strike),
            y: topUnder.map(h => expToY(h.expiry)),
            z: topUnder.map(h => +(getSurfaceZAt(h.expiry, h.strike, h.iv) - 0.65).toFixed(2)),
            text: topUnder.map(h => `$${h.strike} (${Math.round(h.dislocation_pct)}%)`),
            textposition: topUnder.map((_, idx) => underPositions[idx % underPositions.length]),
            textfont: { color: '#4ade80', family: "'JetBrains Mono', monospace", size: 10.5, weight: 'bold' },
            hoverinfo: 'text',
            hovertext: topUnder.map(h => 
              `<b>🟢 UNDERHEDGED VOL VALLEY (Cheap Convexity)</b><br>` +
              `Strike: <b>$${h.strike}</b> (${h.type === 'otm_put' ? 'PUT' : 'CALL'})<br>` +
              `Expiry: <b>${h.expiry}</b><br>` +
              `Market IV: <b>${h.iv}%</b> (SVI Fair: ${h.fit_iv || h.iv}%)<br>` +
              `Dislocation: <b>${h.dislocation_pct}% Cheap</b><br>` +
              `<b>Trader Meaning:</b> Statistical IV discount. Buy cheap gamma/vega with asymmetric upside.<br>` +
              `<i>Strategy: ${h.strategy || 'Buy Cheap Wings / Diagonal'}</i>`
            ),
            marker: { size: 6.5, color: '#10b981', symbol: 'diamond', line: { color: '#ffffff', width: 1.5 } }
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
            y: [yExpCoords[0], yExpCoords[yExpCoords.length - 1]],
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
              y: ridgeTerms.map(ts => expToY(ts.expiry)),
              z: ridgeTerms.map(ts => +(getSurfaceZAt(ts.expiry, clampedSpot, ts.atm_iv) + 0.25).toFixed(2)),
              line: { color: '#fbbf24', width: 5 },
              marker: { size: 4, color: '#fbbf24' }
            });
          }
        }

        // Highlight Earnings / Event Vol Kink Ridges (peaks) AND Vol Valleys (troughs) across the 3D surface
        if (term_structure.length >= 3) {
          const kinkTenors = [];
          const valleyTenors = [];
          for (let i = 1; i < term_structure.length - 1; i++) {
            const prevT = term_structure[i - 1];
            const currT = term_structure[i];
            const nextT = term_structure[i + 1];
            if (!expSet.has(currT.expiry)) continue;
            const dSpan = Math.max(1, (nextT.dte || 1) - (prevT.dte || 0));
            const interpIv = (prevT.atm_iv || 0) + ((nextT.atm_iv || 0) - (prevT.atm_iv || 0)) * (((currT.dte || 0) - (prevT.dte || 0)) / dSpan);
            const kinkPts = (currT.atm_iv || 0) - interpIv;
            if (kinkPts >= 0.7 && (currT.atm_iv || 0) >= (prevT.atm_iv || 0) && (currT.atm_iv || 0) > (nextT.atm_iv || 0)) {
              kinkTenors.push({ ...currT, kinkPts: Number(kinkPts.toFixed(1)) });
            } else if (kinkPts <= -0.7 && (currT.atm_iv || 0) <= (prevT.atm_iv || 0) && (currT.atm_iv || 0) < (nextT.atm_iv || 0)) {
              valleyTenors.push({ ...currT, valleyPts: Number(Math.abs(kinkPts).toFixed(1)) });
            }
          }
          kinkTenors.sort((a, b) => b.kinkPts - a.kinkPts).slice(0, 2).forEach((kt, kIdx) => {
            const expIdx = expirations.indexOf(kt.expiry);
            if (expIdx === -1) return;
            plotData.push({
              type: 'scatter3d',
              mode: 'lines',
              name: kIdx === 0 ? `⚡ Event Vol Kink (${kt.expiry} • +${kt.kinkPts}%)` : `⚡ Vol Kink (${kt.expiry})`,
              x: xValues,
              y: xValues.map(() => yExpCoords[expIdx]),
              z: zData[expIdx].map(v => +(v + 0.35).toFixed(2)),
              line: { color: '#ff007a', width: 6 },
              hoverinfo: 'name+x+z'
            });
          });
          valleyTenors.sort((a, b) => b.valleyPts - a.valleyPts).slice(0, 1).forEach((vt) => {
            const expIdx = expirations.indexOf(vt.expiry);
            if (expIdx === -1) return;
            plotData.push({
              type: 'scatter3d',
              mode: 'lines',
              name: `🕳️ Vol Valley (${vt.expiry} • -${vt.valleyPts}%)`,
              x: xValues,
              y: xValues.map(() => yExpCoords[expIdx]),
              z: zData[expIdx].map(v => +(v + 0.35).toFixed(2)),
              line: { color: '#00f0ff', width: 6 },
              hoverinfo: 'name+x+z'
            });
          });
        }
      }

      // If a trade setup or ΔIV strike is focused, render an illuminated radar target marker clamped to the grid
      if (focusedHotspot && focusedHotspot.strike) {
        const matchedExpiry = expirations.find(e => e === focusedHotspot.expiry) || expirations[0];
        const clampedFocusStrike = Math.min(maxGridStrike, Math.max(minGridStrike, focusedHotspot.strike));
        if (matchedExpiry) {
          plotData.push({
            type: 'scatter3d',
            mode: 'markers+text',
            name: '🎯 Target Lock',
            x: [strikeMode === 'moneyness' ? +(clampedFocusStrike / (spot || 1)).toFixed(3) : clampedFocusStrike],
            y: [expToY(matchedExpiry)],
            z: [isInterdayDeltaZ
              ? +(getSurfaceZAt(matchedExpiry, clampedFocusStrike, 0) + 0.35).toFixed(2)
              : +(getSurfaceZAt(matchedExpiry, clampedFocusStrike, focusedHotspot.iv || 20) + 0.8).toFixed(2)],
            text: [`🎯 $${focusedHotspot.strike}`],
            textposition: 'top center',
            textfont: { color: '#00F0FF', family: 'monospace', size: 12 },
            marker: { size: 10, color: '#00F0FF', symbol: 'cross', line: { color: '#ffffff', width: 2 } }
          });
        }
      }

      const cameraEye = focusedHotspot
        ? { x: 1.28, y: 1.28, z: 0.86 }
        : ((isInterdayDeltaZ || isBeforeAfterMode) ? { x: 1.72, y: 1.68, z: 0.78 } : (CAMERA_PRESETS[cameraPreset]?.eye || { x: 1.55, y: 1.55, z: 0.68 }));

      const layout = {
        autosize: true,
        height: 560,
        margin: { l: 4, r: 4, b: 4, t: 38 },
        paper_bgcolor: 'transparent',
        plot_bgcolor: 'transparent',
        showlegend: false,
        uirevision: `vol-surface-3d-${ticker}-${surfaceBg}`,
        scene: {
          uirevision: `vol-surface-3d-scene-${ticker}`,
          aspectmode: 'manual',
          aspectratio: { x: 1.32, y: 1.22, z: zRelief === '1.55' ? 1.50 : 1.08 },
          xaxis: { 
            title: { text: xAxisTitle, font: { color: '#00F0FF', size: 11, family: "'JetBrains Mono', monospace", weight: 'bold' } }, 
            gridcolor: 'rgba(255, 255, 255, 0.10)', 
            color: '#f8fafc', 
            tickfont: { family: "'JetBrains Mono', monospace", color: '#cbd5e1', size: 10 },
            backgroundcolor: 'rgba(15, 23, 42, 0.45)',
            showbackground: true
          },
          yaxis: { 
            title: { text: 'Tenor (Log DTE)', font: { color: '#00F0FF', size: 11, family: "'JetBrains Mono', monospace", weight: 'bold' } }, 
            tickmode: 'array',
            tickvals: yTickVals,
            ticktext: yTickLabels,
            gridcolor: 'rgba(255, 255, 255, 0.10)', 
            color: '#f8fafc', 
            tickfont: { family: "'JetBrains Mono', monospace", color: '#cbd5e1', size: 10 },
            backgroundcolor: 'rgba(15, 23, 42, 0.45)',
            showbackground: true
          },
          zaxis: { 
            title: { text: isInterdayDeltaZ ? `${coordTagLabel} ΔIV (${motionScopeLabel}) %` : 'Implied Vol (%)', font: { color: isInterdayDeltaZ ? '#fbbf24' : '#00F0FF', size: 11, family: "'JetBrains Mono', monospace", weight: 'bold' } }, 
            range: zAxisRange,
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
        window.Plotly.react(plotRef.current, plotData, layout, { responsive: true, displayModeBar: false });
      } catch (err) {
        try {
          window.Plotly.newPlot(plotRef.current, plotData, layout, { responsive: true, displayModeBar: false });
        } catch (err2) {
          console.warn("Plotly render error caught:", err2 || err);
        }
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
      const activeSvi = (activeData.svi_slices || []).find(s => s.expiry === activeExp) || null;

      // Identify clearest tradable Rich (+SVI) and Cheap (-SVI) strikes near core spot band
      const coreCands = filtered.filter(p => !spot || Math.abs(p.strike - spot) / spot <= 0.16);
      const edgePool = coreCands.length >= 6 ? coreCands : filtered;
      const getEdgeScore = (p) => Number(p.residual_vp ?? p.dislocation_pct ?? 0);
      const richCands = edgePool.filter(p => p.hedge_state === 'overhedged' || getEdgeScore(p) >= 0.45);
      const cheapCands = edgePool.filter(p => p.hedge_state === 'underhedged' || getEdgeScore(p) <= -0.45);
      const richPt = (richCands.filter(p => p.hedge_state === 'overhedged').length
        ? richCands.filter(p => p.hedge_state === 'overhedged')
        : richCands).sort((a, b) => getEdgeScore(b) - getEdgeScore(a))[0] || null;
      const cheapPt = (cheapCands.filter(p => p.hedge_state === 'underhedged').length
        ? cheapCands.filter(p => p.hedge_state === 'underhedged')
        : cheapCands).sort((a, b) => getEdgeScore(a) - getEdgeScore(b))[0] || null;

      const hasBidAsk = filtered.some(p => p.iv_bid && p.iv_ask);
      const plotData = [
        {
          x: filtered.map(p => p.strike),
          y: filtered.map(p => p.fit_iv || p.iv),
          type: 'scatter',
          mode: 'lines',
          name: `Arb-Free SVI Fair Fit (${activeExp})`,
          line: { color: '#fbbf24', width: 2.8 },
          hoverinfo: 'none'
        },
        {
          x: filtered.map(p => p.strike),
          y: filtered.map(p => p.iv),
          type: 'scatter',
          mode: 'markers',
          name: `Market Mid B76 IV (${activeExp}${activeTermMeta?.dte ? ` · ${activeTermMeta.dte}D` : ''})`,
          ...(hasBidAsk ? {
            error_y: {
              type: 'data',
              symmetric: false,
              array: filtered.map(p => p.iv_ask ? Math.max(0.05, +(p.iv_ask - p.iv).toFixed(2)) : 0),
              arrayminus: filtered.map(p => p.iv_bid ? Math.max(0.05, +(p.iv - p.iv_bid).toFixed(2)) : 0),
              color: 'rgba(148, 163, 184, 0.42)',
              thickness: 1.2,
              width: 2
            }
          } : {}),
          marker: { 
            size: 6.5, 
            color: filtered.map(p => p.hedge_state === 'overhedged' ? '#ef4444' : (p.hedge_state === 'underhedged' ? '#10b981' : '#00F0FF')),
            line: { color: '#0f172a', width: 1 }
          },
          text: filtered.map(p => {
            const rv = getEdgeScore(p);
            const sigLine = (p.hedge_state === 'overhedged' || rv > 0.35)
              ? '🔴 RICH vs SVI Fair → SELL VOL / Credit Spread'
              : ((p.hedge_state === 'underhedged' || rv < -0.35)
                ? '🟢 CHEAP vs SVI Fair → BUY VOL / Debit Spread'
                : '⚖️ FAIRLY PRICED (On SVI Smile / Inside Spread)');
            return (
              `<b>Strike $${p.strike} (${p.type === 'otm_put' ? 'OTM PUT' : (p.type === 'otm_call' ? 'OTM CALL' : 'ATM')})</b><br>` +
              `Tenor: ${p.expiry} (${p.dte}D)<br>` +
              `Market Mid IV: <b>${p.iv}%</b>${(p.iv_bid && p.iv_ask) ? ` (Bid ${p.iv_bid}% – Ask ${p.iv_ask}%)` : ''}<br>` +
              `Arb-Free SVI Fit: <b>${p.fit_iv || p.iv}%</b>${p.local_vol ? ` | Local Vol: <b>${p.local_vol}%</b>` : ''}<br>` +
              `Dislocation: <b>${p.dislocation_pct > 0 ? `+${p.dislocation_pct}%` : `${p.dislocation_pct || 0}%`}</b> (${rv >= 0 ? '+' : ''}${rv.toFixed(2)}v)<br>` +
              `Trade Signal: <b>${sigLine}</b>`
            );
          }),
          hoverinfo: 'text'
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

      const skewAnnotations = [];
      const containerW = plotWidth || plotRef.current?.clientWidth || 950;
      const isNarrowSkew = containerW < 780;
      const xSpanSkew = Math.max(1, maxXStrike - minXStrike);
      let maxAnchorSlot = 0;
      const placedAnchors = [];
      const minSepSkew = isNarrowSkew ? 0.28 : 0.22;
      const addAnchorBadge = (xVal, label, bgColor, textColor = '#040812') => {
        if (!xVal || xVal < minXStrike || xVal > maxXStrike) return;
        const nx = (xVal - minXStrike) / xSpanSkew;
        let slot = 0;
        while (placedAnchors.some(a => a.slot === slot && Math.abs(a.nx - nx) < minSepSkew) && slot < 3) {
          slot += 1;
        }
        if (slot > maxAnchorSlot) maxAnchorSlot = slot;
        placedAnchors.push({ nx, slot });
        skewAnnotations.push({
          xref: 'x',
          yref: 'paper',
          x: xVal,
          y: 1.01,
          yanchor: 'bottom',
          xanchor: nx < 0.08 ? 'left' : (nx > 0.92 ? 'right' : 'center'),
          yshift: slot * 19,
          text: `<b>${label}</b>`,
          showarrow: false,
          font: { color: textColor, size: isNarrowSkew ? 8.3 : 9, family: "'JetBrains Mono', monospace" },
          bgcolor: bgColor,
          borderpad: 2.5
        });
      };

      if (put25Strike && put25Iv) addAnchorBadge(put25Strike, `25Δ PUT $${put25Strike} (${put25Iv}%)`, '#f43f5e', '#ffffff');
      if (spot && atmIvVal) addAnchorBadge(spot, `SPOT $${spot.toFixed(1)} (${atmIvVal}%)`, '#fbbf24', '#040812');
      if (call25Strike && call25Iv) addAnchorBadge(call25Strike, `25Δ CALL $${call25Strike} (${call25Iv}%)`, '#10b981', '#040812');

      if (hvLevel && hvLevel >= minY && hvLevel <= maxY && filtered.length > 0) {
        skewAnnotations.push({
          xref: 'paper',
          yref: 'y',
          x: 0.01,
          y: hvLevel,
          xanchor: 'left',
          yanchor: 'bottom',
          yshift: 3,
          text: `<b>30D HV ${hvLevel}% (VRP Floor)</b>`,
          showarrow: false,
          font: { color: '#7dd3fc', size: 9, family: "'JetBrains Mono', monospace" },
          bgcolor: 'rgba(7, 11, 20, 0.88)',
          bordercolor: 'rgba(56, 189, 248, 0.45)',
          borderwidth: 1,
          borderpad: 2.5
        });
      }

      if (showSviChartInfo) {
        const sviParamLine = activeSvi
          ? `<br><span style="color:#94a3b8">SVI(${activeExp}): ρ ${activeSvi.svi_rho} · σ ${activeSvi.svi_sigma} · b ${activeSvi.svi_b}</span>`
          : '';
        skewAnnotations.push({
          xref: 'paper',
          yref: 'paper',
          x: 0.99,
          y: 0.97,
          xanchor: 'right',
          yanchor: 'top',
          align: 'left',
          text:
            `<b style="color:#fbbf24">🟡 ARB-FREE SVI FAIR FIT</b><br>` +
            `Gold Line = Arbitrage-free fair IV smile<br>` +
            `<span style="color:#fda4af">🔴 ABOVE Gold → Rich (SELL Vol / Spreads)</span><br>` +
            `<span style="color:#6ee7b7">🟢 BELOW Gold → Cheap (BUY Vol / Spreads)</span><br>` +
            `<span style="color:#7dd3fc">🔵 ON Gold → Fair Value (Inside Spread)</span>` +
            sviParamLine,
          showarrow: false,
          font: { color: '#e2e8f0', size: 9.2, family: "'JetBrains Mono', monospace" },
          bgcolor: 'rgba(7, 11, 20, 0.92)',
          bordercolor: 'rgba(251, 191, 36, 0.45)',
          borderwidth: 1,
          borderpad: 6
        });

        if (richPt) {
          const rNx = (richPt.strike - minXStrike) / xSpanSkew;
          const rDiff = Math.abs(getEdgeScore(richPt));
          skewAnnotations.push({
            xref: 'x',
            yref: 'y',
            x: richPt.strike,
            y: richPt.iv,
            xanchor: rNx > 0.72 ? 'right' : (rNx < 0.14 ? 'left' : 'center'),
            ax: rNx > 0.72 ? -34 : 0,
            ay: -28,
            showarrow: true,
            arrowhead: 2,
            arrowsize: 0.9,
            arrowwidth: 1.4,
            arrowcolor: '#ef4444',
            text: `<b>🔴 RICH $${richPt.strike} (+${rDiff.toFixed(1)}v) · SELL VOL</b>`,
            font: { color: '#fda4af', size: 9, family: "'JetBrains Mono', monospace" },
            bgcolor: 'rgba(7, 11, 20, 0.92)',
            bordercolor: '#ef4444',
            borderwidth: 1,
            borderpad: 2.5
          });
        }

        if (cheapPt && (!richPt || Math.abs(cheapPt.strike - richPt.strike) / xSpanSkew > 0.08 || Math.abs(cheapPt.iv - richPt.iv) > 2.0)) {
          const cNx = (cheapPt.strike - minXStrike) / xSpanSkew;
          const cDiff = Math.abs(getEdgeScore(cheapPt));
          skewAnnotations.push({
            xref: 'x',
            yref: 'y',
            x: cheapPt.strike,
            y: cheapPt.iv,
            xanchor: cNx > 0.72 ? 'right' : (cNx < 0.14 ? 'left' : 'center'),
            ax: cNx > 0.72 ? -34 : 0,
            ay: 30,
            showarrow: true,
            arrowhead: 2,
            arrowsize: 0.9,
            arrowwidth: 1.4,
            arrowcolor: '#10b981',
            text: `<b>🟢 CHEAP $${cheapPt.strike} (-${cDiff.toFixed(1)}v) · BUY VOL</b>`,
            font: { color: '#6ee7b7', size: 9, family: "'JetBrains Mono', monospace" },
            bgcolor: 'rgba(7, 11, 20, 0.92)',
            bordercolor: '#10b981',
            borderwidth: 1,
            borderpad: 2.5
          });
        }
      }

      const skewTopMargin = maxAnchorSlot >= 2 ? (isNarrowSkew ? 132 : 120) : 104;
      const skewLegendY = maxAnchorSlot >= 2 ? (isNarrowSkew ? 1.26 : 1.24) : 1.18;

      const layout = {
        autosize: true,
        ...(containerW > 100 ? { width: containerW } : {}),
        height: 555,
        margin: { l: 58, r: 22, b: 54, t: skewTopMargin },
        paper_bgcolor: 'transparent',
        plot_bgcolor: '#090d16',
        legend: {
          orientation: 'h',
          x: 0,
          xanchor: 'left',
          y: skewLegendY,
          yanchor: 'bottom',
          font: { color: '#cbd5e1', family: "'JetBrains Mono', monospace", size: 9.5 },
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
        annotations: skewAnnotations
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
        height: 520,
        margin: { l: 58, r: 22, b: 54, t: 74 },
        paper_bgcolor: 'transparent',
        plot_bgcolor: '#090d16',
        legend: {
          orientation: 'h',
          x: 0,
          xanchor: 'left',
          y: 1.04,
          yanchor: 'bottom',
          font: { color: '#cbd5e1', family: "'JetBrains Mono', monospace", size: 9.5 },
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
      // 4. BUILD 2D VOLATILITY HEATMAP MATRIX (OR INTERDAY ΔIV MATRIX WHEN ⚡ INTERDAY ΔIV IS ON)
      const expirations = allExpirations;
      const hmLookbackSnap = (volMoveLookback && volMoveLookback !== 'OFF')
        ? activeData.multi_day_vol_movement?.historical_snapshots?.[volMoveLookback]
        : null;
      const useDeltaHeatmap = Boolean(interdayShiftMode && hmLookbackSnap);
      const hmRealDelta1d = activeData.multi_day_vol_movement?.real_delta_iv_1d;
      const isReal1dHm = Boolean(useDeltaHeatmap && volMoveLookback === '1D' && hmRealDelta1d?.available);

      const ptMap = new Map();
      const fullPtMap = new Map();
      surface.forEach(p => {
        if (p && p.expiry && p.strike !== undefined) {
          fullPtMap.set(`${p.expiry}_${p.strike}`, p);
          if (p.iv !== undefined) ptMap.set(`${p.expiry}_${p.strike}`, p.iv);
        }
      });

      let displayedStrikes = rawStrikes;
      if (heatmapFilter === 'core' && spot) {
        const coreFiltered = rawStrikes.filter(s => Math.abs(s - spot) / spot <= 0.15);
        if (coreFiltered.length >= 5) {
          displayedStrikes = coreFiltered;
        }
      }

      let ivZData = expirations.map(exp => {
        return displayedStrikes.map(str => {
          const val = ptMap.get(`${exp}_${str}`);
          return (val !== undefined && val !== null && !isNaN(val)) ? val : null;
        });
      });

      const fillMatrix2D = (mat, fallbackVal = 25.0) => {
        for (let i = 0; i < expirations.length; i++) {
          let lastIdx = -1;
          for (let j = 0; j < displayedStrikes.length; j++) {
            if (mat[i][j] !== null) {
              if (lastIdx !== -1 && j > lastIdx + 1) {
                const startVal = mat[i][lastIdx];
                const endVal = mat[i][j];
                const span = j - lastIdx;
                for (let k = lastIdx + 1; k < j; k++) {
                  mat[i][k] = startVal + (endVal - startVal) * ((k - lastIdx) / span);
                }
              }
              lastIdx = j;
            }
          }
          if (lastIdx !== -1) {
            for (let j = lastIdx + 1; j < displayedStrikes.length; j++) {
              mat[i][j] = mat[i][lastIdx];
            }
            const firstVal = mat[i].find(v => v !== null);
            for (let j = 0; j < displayedStrikes.length; j++) {
              if (mat[i][j] === null) mat[i][j] = firstVal;
              else break;
            }
          }
        }
        for (let j = 0; j < displayedStrikes.length; j++) {
          let lastIdx = -1;
          for (let i = 0; i < expirations.length; i++) {
            if (mat[i][j] !== null) {
              if (lastIdx !== -1 && i > lastIdx + 1) {
                const startVal = mat[lastIdx][j];
                const endVal = mat[i][j];
                const span = i - lastIdx;
                for (let k = lastIdx + 1; k < i; k++) {
                  mat[k][j] = startVal + (endVal - startVal) * ((k - lastIdx) / span);
                }
              }
              lastIdx = i;
            }
          }
          if (lastIdx !== -1) {
            for (let i = lastIdx + 1; i < expirations.length; i++) {
              mat[i][j] = mat[lastIdx][j];
            }
            let firstVal = null;
            for (let i = 0; i < expirations.length; i++) {
              if (mat[i][j] !== null) { firstVal = mat[i][j]; break; }
            }
            if (firstVal !== null) {
              for (let i = 0; i < expirations.length; i++) {
                if (mat[i][j] === null) mat[i][j] = firstVal;
                else break;
              }
            }
          }
        }
        for (let i = 0; i < expirations.length; i++) {
          for (let j = 0; j < displayedStrikes.length; j++) {
            if (mat[i][j] === null || isNaN(mat[i][j])) mat[i][j] = fallbackVal;
            else mat[i][j] = Number(mat[i][j].toFixed(2));
          }
        }
      };

      fillMatrix2D(ivZData, (data.desk_metrics && data.desk_metrics.atm_iv_30d) || 25.0);

      let zData = ivZData;
      if (surfaceColor === 'LocalVol' && !useDeltaHeatmap) {
        const lvZ = expirations.map(exp =>
          displayedStrikes.map(str => {
            const fp = fullPtMap.get(`${exp}_${str}`);
            return (fp && fp.local_vol) ? fp.local_vol : null;
          })
        );
        fillMatrix2D(lvZ, (data.desk_metrics && data.desk_metrics.atm_iv_30d) || 25.0);
        zData = lvZ;
      }
      let hmHoverMatrix = null;
      let hmColorscale = surfaceColor === 'HedgingRegimes' ? 'Viridis' : (surfaceColor === 'LocalVol' ? 'Inferno' : surfaceColor);
      let hmZMin;
      let hmZMax;
      let hmZMid;
      let hmColorbarTitle = surfaceColor === 'LocalVol' ? 'Dupire Local Vol (%)' : 'Implied Vol (%)';
      let hmChartTitle = surfaceColor === 'LocalVol'
        ? `Dupire Local Volatility (σ_loc) Heatmap · Strike vs Expiration`
        : `Implied Volatility Heatmap Matrix · Strike Price vs Expiration Tenor`;

      if (useDeltaHeatmap) {
        const snapTsMap = new Map();
        (hmLookbackSnap.term_structure || []).forEach(t => snapTsMap.set(t.expiry, t));
        const baseShift = -(hmLookbackSnap.iv_shift_pts || 0);
        const skewShift = -(hmLookbackSnap.skew_shift_pts || 0);

        const fbDelta = expirations.map((exp, i) => {
          const tsPast = snapTsMap.get(exp);
          const tenorDelta = tsPast ? (tsPast.today_atm_iv - tsPast.atm_iv) : -baseShift;
          return displayedStrikes.map(st => {
            const moneynessOffset = spot ? ((st - spot) / spot) : 0;
            const wingTilt = moneynessOffset * skewShift * 1.4;
            return Number((tenorDelta + wingTilt).toFixed(2));
          });
        });

        let deltaMat;
        if (isReal1dHm) {
          deltaMat = expirations.map((exp, i) =>
            displayedStrikes.map((st, j) => {
              const p = fullPtMap.get(`${exp}_${st}`);
              return (p && typeof p.real_delta_iv_1d === 'number' && !isNaN(p.real_delta_iv_1d))
                ? Number(p.real_delta_iv_1d.toFixed(2))
                : null;
            })
          );
          // Blend missing rows/edges toward modeled shift only where contract history wasn't directly matched
          for (let i = 0; i < expirations.length; i++) {
            const hasAny = deltaMat[i].some(v => v !== null);
            if (!hasAny) {
              deltaMat[i] = [...fbDelta[i]];
            }
          }
          fillMatrix2D(deltaMat, hmRealDelta1d.atm_delta_iv || 0.0);
        } else {
          deltaMat = fbDelta;
        }

        // Gentle 1-pass Laplacian smoothing for clean regional heat zones across Strike x Expiration
        const smHm = deltaMat.map(row => [...row]);
        for (let i = 0; i < expirations.length; i++) {
          for (let j = 0; j < displayedStrikes.length; j++) {
            const c = deltaMat[i][j];
            const l = j > 0 ? deltaMat[i][j - 1] : c;
            const r = j < displayedStrikes.length - 1 ? deltaMat[i][j + 1] : c;
            const u = i > 0 ? deltaMat[i - 1][j] : c;
            const d = i < expirations.length - 1 ? deltaMat[i + 1][j] : c;
            smHm[i][j] = Number((0.56 * c + 0.14 * (l + r) + 0.08 * (u + d)).toFixed(2));
          }
        }
        zData = smHm;
        const flatAbs = zData.flat().filter(v => typeof v === 'number' && !isNaN(v)).map(Math.abs);
        const maxAbs = flatAbs.length ? Math.max(...flatAbs.sort((a, b) => a - b).slice(0, Math.max(1, Math.floor(flatAbs.length * 0.98)))) : 4.0;
        const cBound = Math.max(2.5, Math.min(18.0, Math.ceil(maxAbs)));
        hmZMin = -cBound;
        hmZMax = cBound;
        hmZMid = 0;
        hmColorscale = [
          [0.0, '#10b981'],
          [0.35, '#06b6d4'],
          [0.50, '#1e293b'],
          [0.65, '#f59e0b'],
          [1.0, '#ef4444']
        ];
        hmColorbarTitle = isReal1dHm ? 'Real 1D ΔIV (%)' : `ΔIV (${volMoveLookback})`;
        hmChartTitle = `Interday ΔIV Matrix (${volMoveLookback} vs Live · ${isReal1dHm ? 'Real Per-Contract Repricing' : 'Term/Skew Model'})`;

        hmHoverMatrix = expirations.map((exp, i) =>
          displayedStrikes.map((st, j) => {
            const p = fullPtMap.get(`${exp}_${st}`);
            const dVal = zData[i][j];
            const todayIv = ivZData[i][j];
            const priorIv = Number(Math.max(4.0, todayIv - dVal).toFixed(2));
            const volStr = (p && p.contract_vol > 0) ? `<br>Today Vol: <b>${p.contract_vol.toLocaleString()}</b>` : '';
            const srcTag = (p && typeof p.real_delta_iv_1d === 'number' && isReal1dHm)
              ? 'Real Per-Contract Repricing'
              : (isReal1dHm ? 'Interpolated from Live Contracts' : 'Term/Skew Shift Model');
            return `<b>Strike: $${st}</b> | Exp: <b>${exp}</b><br>` +
                   `<b>ΔIV (${volMoveLookback}): ${dVal >= 0 ? '+' : ''}${dVal}%</b><br>` +
                   `Today IV: <b>${todayIv}%</b> | Prior IV: <b>${priorIv}%</b>` +
                   volStr +
                   `<br><i>${srcTag}</i>`;
          })
        );
      }

      const currentBg = BG_THEMES.find(t => t.id === surfaceBg) || BG_THEMES[0];

      const hmXValues = strikeMode === 'moneyness'
        ? displayedStrikes.map(s => +(s / (spot || 1)).toFixed(3))
        : displayedStrikes;
      const hmXTitle = strikeMode === 'moneyness' ? 'Moneyness (K/S)' : 'Strike Price ($)';
      const spotX = strikeMode === 'moneyness' ? 1.00 : spot;

      const hmTrace = {
        z: zData,
        x: hmXValues,
        y: expirations,
        type: 'heatmap',
        colorscale: hmColorscale,
        zsmooth: false,
        hoverongaps: false,
        colorbar: {
          title: { text: hmColorbarTitle, font: { color: useDeltaHeatmap ? '#fbbf24' : '#00F0FF', family: "'JetBrains Mono', monospace", size: 10, weight: 'bold' }, side: 'top' },
          tickfont: { color: '#f8fafc', family: "'JetBrains Mono', monospace", size: 9.5 },
          orientation: 'h',
          thickness: 10,
          len: 0.34,
          x: 0.99,
          xanchor: 'right',
          y: 1.03,
          yanchor: 'bottom',
          ypad: 4
        }
      };
      if (useDeltaHeatmap) {
        hmTrace.zmin = hmZMin;
        hmTrace.zmax = hmZMax;
        hmTrace.zmid = hmZMid;
        hmTrace.hoverinfo = 'text';
        hmTrace.text = hmHoverMatrix;
      } else {
        hmTrace.hovertemplate = `<b>Strike Price:</b> %{x}<br><b>Expiration:</b> %{y}<br><b>Implied Volatility:</b> %{z:.1f}%<extra></extra>`;
      }

      const plotData = [hmTrace];

      // Overlay Spatially Separated Air Pocket Pinpoints onto Heatmap (Zero overlapping circles/labels)
      const rawVisiblePockets = !useDeltaHeatmap
        ? detectedAirPockets.filter(p => displayedStrikes.some(s => Math.abs(s - p.strike) < 1.0))
        : [];
      const visibleAirPockets = [];
      const minHmSep = Math.max(8.0, (spot || 100) * 0.045);
      for (const pk of rawVisiblePockets) {
        const collides = visibleAirPockets.some(existing =>
          existing.expiry === pk.expiry && Math.abs(existing.strike - pk.strike) < minHmSep
        );
        if (!collides) visibleAirPockets.push(pk);
      }

      if (visibleAirPockets.length > 0) {
        const pocketPositions = ['top left', 'bottom right', 'top right', 'bottom left'];
        plotData.push({
          x: visibleAirPockets.map(p => strikeMode === 'moneyness' ? +(p.strike / (spot || 1)).toFixed(3) : p.strike),
          y: visibleAirPockets.map(p => p.expiry),
          type: 'scatter',
          mode: 'markers+text',
          name: '🕳️ Vol Air Pocket (Cheap Vega)',
          text: visibleAirPockets.map(p => `$${p.strike} (${p.iv}%)`),
          textposition: visibleAirPockets.map((_, idx) => pocketPositions[idx % pocketPositions.length]),
          textfont: { color: '#00F0FF', family: "'JetBrains Mono', monospace", size: 10.5, weight: 'bold' },
          marker: {
            size: 13,
            color: '#00F0FF',
            symbol: 'circle-open',
            line: { color: '#00F0FF', width: 2.5 }
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
          textfont: { color: '#00E676', family: "'JetBrains Mono', monospace", size: 11, weight: 'bold' },
          marker: {
            size: 18,
            color: '#00E676',
            symbol: 'cross',
            line: { color: '#ffffff', width: 2 }
          }
        });
      }

      const layout = {
        autosize: true,
        height: 540,
        margin: { l: 84, r: 18, b: 54, t: 60 },
        paper_bgcolor: 'transparent',
        plot_bgcolor: '#090d16',
        showlegend: false,
        xaxis: { 
          title: { text: hmXTitle, font: { color: '#00F0FF', size: 12, family: "'JetBrains Mono', monospace", weight: 'bold' } }, 
          gridcolor: 'rgba(255, 255, 255, 0.12)', 
          color: '#f8fafc', 
          tickfont: { family: "'JetBrains Mono', monospace", color: '#cbd5e1', size: 10.5 } 
        },
        yaxis: { 
          title: { text: 'Expiration Tenor', font: { color: '#00F0FF', size: 12, family: "'JetBrains Mono', monospace", weight: 'bold' } }, 
          gridcolor: 'rgba(255, 255, 255, 0.12)', 
          color: '#f8fafc', 
          tickfont: { family: "'JetBrains Mono', monospace", color: '#cbd5e1', size: 10 },
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
          y: 1.04,
          yanchor: 'bottom',
          text: strikeMode === 'moneyness' ? 'Spot 1.00x' : `Spot $${spot.toFixed(2)}`,
          showarrow: false,
          font: { color: '#00F0FF', family: "'JetBrains Mono', monospace", size: 10.5, weight: 'bold' },
          bgcolor: 'rgba(15, 23, 42, 0.96)',
          bordercolor: '#00F0FF',
          borderwidth: 1,
          borderpad: 3
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

      const xsAll = scatterPts.map(p => p.spot_return_pct);
      const ysAll = scatterPts.map(p => p.vol_change_pct);
      const minXSc = xsAll.length ? Math.min(...xsAll, -1.5) : -3.5;
      const maxXSc = xsAll.length ? Math.max(...xsAll, 1.5) : 3.5;
      const minYSc = ysAll.length ? Math.min(...ysAll, -5.0) : -8.0;
      const maxYSc = ysAll.length ? Math.max(...ysAll, 5.0) : 8.0;
      const xPadSc = Math.max(0.6, (maxXSc - minXSc) * 0.22);
      const yPadSc = Math.max(1.5, (maxYSc - minYSc) * 0.24);

      const layout = {
        autosize: true,
        height: 520,
        margin: { l: 58, r: 22, b: 54, t: 62 },
        paper_bgcolor: 'transparent',
        plot_bgcolor: '#090d16',
        xaxis: { 
          title: { text: 'Daily Underlying Spot Return (%)', font: { color: '#00F0FF', size: 12, family: "'JetBrains Mono', monospace", weight: 'bold' } }, 
          gridcolor: 'rgba(255, 255, 255, 0.10)', 
          color: '#f8fafc', 
          tickfont: { family: "'JetBrains Mono', monospace", color: '#cbd5e1', size: 10.5 },
          zerolinecolor: 'rgba(203, 213, 225, 0.45)',
          zerolinewidth: 1.5,
          range: [+(minXSc - xPadSc).toFixed(2), +(maxXSc + xPadSc).toFixed(2)]
        },
        yaxis: { 
          title: { text: 'Daily Volatility Change (%)', font: { color: '#00F0FF', size: 12, family: "'JetBrains Mono', monospace", weight: 'bold' } }, 
          gridcolor: 'rgba(255, 255, 255, 0.10)', 
          color: '#f8fafc', 
          tickfont: { family: "'JetBrains Mono', monospace", color: '#cbd5e1', size: 10.5 },
          zerolinecolor: 'rgba(203, 213, 225, 0.45)',
          zerolinewidth: 1.5,
          range: [+(minYSc - yPadSc).toFixed(2), +(maxYSc + yPadSc).toFixed(2)]
        },
        legend: {
          orientation: 'h',
          x: 0,
          y: 1.03,
          yanchor: 'bottom',
          font: { color: '#ffffff', family: "'JetBrains Mono', monospace", size: 9.5 },
          bgcolor: 'rgba(15, 23, 42, 0.85)',
          bordercolor: 'rgba(255, 255, 255, 0.12)',
          borderwidth: 1
        },
        annotations: [
          {
            xref: 'paper', yref: 'paper', x: 0.015, y: 0.985,
            text: `<b>Q1 PUT PANIC</b> (${putPanic.length}d · ${q1Pct}%)`,
            showarrow: false, xanchor: 'left', yanchor: 'top',
            font: { color: '#ef4444', family: "'JetBrains Mono', monospace", size: 9.5 },
            bgcolor: 'rgba(15, 23, 42, 0.78)', bordercolor: 'rgba(239, 68, 68, 0.45)', borderwidth: 1, borderpad: 3
          },
          {
            xref: 'paper', yref: 'paper', x: 0.985, y: 0.985,
            text: `<b>Q2 CALL SQUEEZE</b> (${callSqueeze.length}d · ${q2Pct}%)`,
            showarrow: false, xanchor: 'right', yanchor: 'top',
            font: { color: '#10b981', family: "'JetBrains Mono', monospace", size: 9.5 },
            bgcolor: 'rgba(15, 23, 42, 0.78)', bordercolor: 'rgba(16, 185, 129, 0.45)', borderwidth: 1, borderpad: 3
          },
          {
            xref: 'paper', yref: 'paper', x: 0.015, y: 0.015,
            text: `<b>Q3 DRIFT</b> (${sinkingDrift.length}d · ${q3Pct}%)`,
            showarrow: false, xanchor: 'left', yanchor: 'bottom',
            font: { color: '#94a3b8', family: "'JetBrains Mono', monospace", size: 9.5 },
            bgcolor: 'rgba(15, 23, 42, 0.78)', bordercolor: 'rgba(148, 163, 184, 0.45)', borderwidth: 1, borderpad: 3
          },
          {
            xref: 'paper', yref: 'paper', x: 0.985, y: 0.015,
            text: `<b>Q4 VOL CRUSH</b> (${volCrushRally.length}d · ${q4Pct}%)`,
            showarrow: false, xanchor: 'right', yanchor: 'bottom',
            font: { color: '#38bdf8', family: "'JetBrains Mono', monospace", size: 9.5 },
            bgcolor: 'rgba(15, 23, 42, 0.78)', bordercolor: 'rgba(56, 189, 248, 0.45)', borderwidth: 1, borderpad: 3
          }
        ]
      };

      try {
        window.Plotly.newPlot(plotRef.current, plotData, layout, { responsive: true, displayModeBar: false });
      } catch (err) {
        console.error("Plotly scatter render error:", err);
      }
    } else if (activeViewMode === 'vol_movement') {
      // 6. BUILD MULTI-DAY VOLATILITY MOVEMENT & TERM STRUCTURE SHIFT CHART
      const mv = activeData.multi_day_vol_movement || data?.multi_day_vol_movement || {};
      const snaps = mv.historical_snapshots || {};
      const dailyChron = [...(mv.daily_tape || [])].reverse();
      const activeExpSet = new Set(term_structure.map(ts => ts.expiry));

      if (multiDayChartSubmode === 'daily_iv_skew' && dailyChron.length >= 2) {
        const xDates = dailyChron.map(d => d.days_ago === 0 ? `Today (${d.date.slice(5)})` : `${d.date.slice(5)} (-${d.days_ago}D)`);
        const ivY = dailyChron.map(d => d.atm_iv_30d);
        const hvY = dailyChron.map(d => d.hv_10d);
        const skewY = dailyChron.map(d => d.skew_25d);
        const chgY = dailyChron.map(d => d.iv_chg_1d || 0);

        const plotData = [
          {
            x: xDates,
            y: ivY,
            type: 'scatter',
            mode: 'lines+markers',
            name: '30D ATM Implied Vol (%)',
            line: { color: '#00F0FF', width: 3.5, shape: 'spline', smoothing: 0.45 },
            marker: { size: 8, color: '#00F0FF', line: { color: '#0f172a', width: 1.5 } },
            hovertemplate: '<b>%{x}</b><br>30D ATM IV: <b>%{y:.2f}%</b><extra></extra>'
          },
          {
            x: xDates,
            y: hvY,
            type: 'scatter',
            mode: 'lines+markers',
            name: '10D Realized HV (%)',
            line: { color: '#a855f7', width: 2.5, dash: 'dash', shape: 'spline', smoothing: 0.45 },
            marker: { size: 6, color: '#a855f7' },
            hovertemplate: '<b>%{x}</b><br>10D Realized HV: <b>%{y:.1f}%</b><extra></extra>'
          },
          {
            x: xDates,
            y: skewY,
            yaxis: 'y2',
            type: 'scatter',
            mode: 'lines+markers',
            name: '25Δ Put/Call Skew (%)',
            line: { color: '#fbbf24', width: 2, dash: 'dot' },
            marker: { size: 6, color: '#fbbf24', symbol: 'diamond' },
            hovertemplate: '<b>%{x}</b><br>25Δ Skew: <b>%{y:+.2f}%</b><extra></extra>'
          },
          {
            x: xDates,
            y: chgY,
            yaxis: 'y2',
            type: 'bar',
            name: 'Daily 1D ΔIV Shift (pts)',
            marker: {
              color: chgY.map(v => v >= 0 ? 'rgba(239, 68, 68, 0.55)' : 'rgba(16, 185, 129, 0.55)'),
              line: {
                color: chgY.map(v => v >= 0 ? '#ef4444' : '#10b981'),
                width: 1
              }
            },
            hovertemplate: '<b>%{x}</b><br>1D IV Change: <b>%{y:+.2f}%</b><extra></extra>'
          }
        ];

        const layout = {
          autosize: true,
          height: 520,
          margin: { l: 58, r: 58, b: 56, t: 82 },
          paper_bgcolor: 'transparent',
          plot_bgcolor: '#090d16',
          legend: {
            orientation: 'h',
            x: 0,
            y: 1.04,
            yanchor: 'bottom',
            font: { color: '#cbd5e1', family: "'JetBrains Mono', monospace", size: 10 },
            bgcolor: 'rgba(15, 23, 42, 0.82)'
          },
          xaxis: {
            title: { text: 'Recent Trading Sessions (Last 10 Days → Today)', font: { color: '#00F0FF', family: "'JetBrains Mono', monospace", size: 11.5 } },
            gridcolor: 'rgba(255, 255, 255, 0.08)',
            color: '#cbd5e1',
            tickfont: { family: "'JetBrains Mono', monospace", size: 10 }
          },
          yaxis: {
            title: { text: 'Implied / Realized Volatility (%)', font: { color: '#00F0FF', family: "'JetBrains Mono', monospace", size: 11.5 } },
            gridcolor: 'rgba(255, 255, 255, 0.08)',
            color: '#f8fafc',
            tickfont: { family: "'JetBrains Mono', monospace", size: 10.5 }
          },
          yaxis2: {
            title: { text: '25Δ Skew & 1D ΔIV Shift (%)', font: { color: '#fbbf24', family: "'JetBrains Mono', monospace", size: 10.5 } },
            overlaying: 'y',
            side: 'right',
            showgrid: false,
            color: '#fbbf24',
            tickfont: { family: "'JetBrains Mono', monospace", size: 10 },
            zeroline: true,
            zerolinecolor: 'rgba(255,255,255,0.2)'
          }
        };

        try {
          window.Plotly.newPlot(plotRef.current, plotData, layout, { responsive: true, displayModeBar: false });
        } catch (err) {
          console.warn("Plotly multi-day daily_iv_skew render error:", err);
        }
      } else {
        // Default: Multi-Day Term Structure Evolution (Today vs 1D, 3D, 5D, 10D Ago) + Per-Tenor ΔIV Shift Bars
        const xLabels = term_structure.map(ts => `${ts.dte}D (${ts.expiry.slice(5)})`);
        const todayY = term_structure.map(ts => ts.atm_iv);
        const activeLbKey = (volMoveLookback && volMoveLookback !== 'OFF' && snaps[volMoveLookback]) ? volMoveLookback : '3D';
        const refSnap = snaps[activeLbKey] || snaps['3D'] || snaps['1D'] || null;

        const plotData = [
          {
            x: xLabels,
            y: todayY,
            type: 'scatter',
            mode: 'lines+markers',
            name: 'Today (Live ATM IV)',
            line: { color: '#00F0FF', width: 3.8, shape: 'spline', smoothing: 0.5 },
            marker: { size: 8, color: '#00F0FF', line: { color: '#ffffff', width: 1 } },
            hovertemplate: '<b>%{x}</b><br>Today Live IV: <b>%{y:.2f}%</b><extra></extra>'
          }
        ];

        const curveStyles = [
          { key: '1D', color: '#34d399', dash: 'solid', width: 2.2 },
          { key: '3D', color: '#fbbf24', dash: 'dash', width: 2.5 },
          { key: '5D', color: '#a855f7', dash: 'dot', width: 2.2 },
          { key: '10D', color: '#94a3b8', dash: 'dashdot', width: 2.0 }
        ];

        curveStyles.forEach(cs => {
          const sObj = snaps[cs.key];
          if (!sObj || !Array.isArray(sObj.term_structure)) return;
          const mapByExp = new Map(sObj.term_structure.map(item => [item.expiry, item]));
          const ySeries = term_structure.map(ts => {
            const matched = mapByExp.get(ts.expiry);
            return matched ? matched.atm_iv : ts.atm_iv;
          });
          plotData.push({
            x: xLabels,
            y: ySeries,
            type: 'scatter',
            mode: 'lines+markers',
            name: `${sObj.label} (30D: ${sObj.atm_iv_30d}%)`,
            line: { color: cs.color, width: cs.width, dash: cs.dash, shape: 'spline', smoothing: 0.5 },
            marker: { size: 5, color: cs.color },
            opacity: (volMoveLookback === 'OFF' || volMoveLookback === cs.key) ? 0.95 : 0.45,
            hovertemplate: `<b>%{x}</b><br>${sObj.label} IV: <b>%{y:.2f}%</b><extra></extra>`
          });
        });

        if (refSnap && Array.isArray(refSnap.term_structure)) {
          const refMap = new Map(refSnap.term_structure.map(item => [item.expiry, item]));
          const deltaBars = term_structure.map(ts => {
            const m = refMap.get(ts.expiry);
            return m ? m.iv_change : 0;
          });
          plotData.push({
            x: xLabels,
            y: deltaBars,
            yaxis: 'y2',
            type: 'bar',
            name: `ΔIV Shift vs ${refSnap.label} (pts)`,
            marker: {
              color: deltaBars.map(v => v >= 0 ? 'rgba(239, 68, 68, 0.42)' : 'rgba(16, 185, 129, 0.42)'),
              line: {
                color: deltaBars.map(v => v >= 0 ? '#ef4444' : '#10b981'),
                width: 1.2
              }
            },
            hovertemplate: `<b>%{x}</b><br>ΔIV vs ${refSnap.label}: <b>%{y:+.2f}%</b><extra></extra>`
          });
        }

        const deltaRangePad = (refSnap && Array.isArray(refSnap.term_structure))
          ? Math.max(2.0, ...term_structure.map(ts => {
              const m = refSnap.term_structure.find(item => item.expiry === ts.expiry);
              return Math.abs(m ? m.iv_change : 0);
            }))
          : 4.0;
        const layout = {
          autosize: true,
          height: 520,
          margin: { l: 58, r: 58, b: 56, t: 88 },
          paper_bgcolor: 'transparent',
          plot_bgcolor: '#090d16',
          legend: {
            orientation: 'h',
            x: 0,
            y: 1.04,
            yanchor: 'bottom',
            font: { color: '#cbd5e1', family: "'JetBrains Mono', monospace", size: 9.5 },
            bgcolor: 'rgba(15, 23, 42, 0.82)'
          },
          xaxis: {
            title: { text: 'Expiration Tenor (DTE & Date)', font: { color: '#00F0FF', family: "'JetBrains Mono', monospace", size: 11.5 } },
            gridcolor: 'rgba(255, 255, 255, 0.08)',
            color: '#cbd5e1',
            tickfont: { family: "'JetBrains Mono', monospace", size: 10 }
          },
          yaxis: {
            title: { text: 'ATM Implied Volatility (%)', font: { color: '#00F0FF', family: "'JetBrains Mono', monospace", size: 11.5 } },
            gridcolor: 'rgba(255, 255, 255, 0.08)',
            color: '#f8fafc',
            tickfont: { family: "'JetBrains Mono', monospace", size: 10.5 }
          },
          yaxis2: {
            title: { text: `Net ΔIV Shift vs ${refSnap ? refSnap.key : '3D'} Ago (%)`, font: { color: '#f59e0b', family: "'JetBrains Mono', monospace", size: 10.5 } },
            overlaying: 'y',
            side: 'right',
            showgrid: false,
            color: '#f59e0b',
            tickfont: { family: "'JetBrains Mono', monospace", size: 10 },
            zeroline: true,
            zerolinecolor: 'rgba(255,255,255,0.22)',
            range: [+( -deltaRangePad * 1.15).toFixed(1), +(deltaRangePad * 1.25).toFixed(1)]
          }
        };

        try {
          window.Plotly.newPlot(plotRef.current, plotData, layout, { responsive: true, displayModeBar: false });
        } catch (err) {
          console.warn("Plotly multi-day term_shift render error:", err);
        }
      }
    }
  }, [data, horizonData, tenorHorizon, selectedExpiry, activeViewMode, focusedHotspot, plotlyReady, plotWidth, detectedAirPockets, surfaceColor, surfaceBg, cameraPreset, strikeMode, heatmapFilter, showHvPlane, show3dLabels, showSviChartInfo, volMoveLookback, volMoveColorByDelta, interdayShiftMode, motionCoordFrame, motionVisualStyle, intradayFrameIdx, multiDayChartSubmode, surfacePrecision, zRelief]);

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
        <p style={{ fontFamily: 'monospace', fontSize: '12px', color: '#94a3b8', margin: '0 0 14px 0' }}>
          Check that options contracts are active and liquid for this symbol.
        </p>
        <button
          type="button"
          onClick={() => fetchSurface(true)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 16px',
            borderRadius: '8px',
            border: '1px solid rgba(0, 240, 255, 0.45)',
            background: 'rgba(0, 240, 255, 0.14)',
            color: '#00F0FF',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '12px',
            fontWeight: 800,
            cursor: 'pointer'
          }}
        >
          <RotateCw size={13} />
          Retry Loading {ticker} Surface
        </button>
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
      {/* 1. FIRST: 3D VOLATILITY SURFACE STUDIO & DESK KPIS (SURFACE-FIRST)     */}
      {/* ========================================================================= */}
      <div 
        ref={surfaceCardRef}
        className="vol-surface-card"
        style={{
          background: '#0a0e17',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '16px',
          padding: '18px',
          boxShadow: '0 12px 36px rgba(0, 0, 0, 0.5)',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px'
        }}
      >
        {/* Studio Header: Title + Calibration Proof Pill + Axes Guide + Horizon Selector */}
        <div 
          className="vol-surface-header"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '10px',
            paddingBottom: '12px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
          }}
        >
          <div className="vol-surface-title-wrap" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <Compass style={{ width: '17px', height: '17px', color: '#00F0FF' }} />
            <h3 style={{ margin: 0, fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#00F0FF' }}>
              3D Volatility Surface Studio · {ticker} ({horizon_meta?.label || '2 Years'})
            </h3>
            <span style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '10.5px',
              padding: '3px 8px',
              borderRadius: '6px',
              background: 'rgba(0, 240, 255, 0.12)',
              border: '1px solid rgba(0, 240, 255, 0.35)',
              color: '#00F0FF',
              fontWeight: 700
            }}>
              {availableExpirations.length} Exps · {horizon_meta?.min_dte || 1}D–{horizon_meta?.max_dte || 730}D
            </span>

            {activeData.calibration_metrics && (
              <button
                type="button"
                onClick={() => setShowCalibrationPanel(prev => !prev)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '3px 9px',
                  borderRadius: '6px',
                  border: showCalibrationPanel ? '1px solid #00E676' : '1px solid rgba(16, 185, 129, 0.4)',
                  background: showCalibrationPanel ? 'rgba(16, 185, 129, 0.22)' : 'rgba(16, 185, 129, 0.10)',
                  color: '#34d399',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '10.5px',
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
                title="Inspect live SVI Arbitrage-Free Calibration Scorecard & 5Y Empirical Benchmarks"
              >
                <ShieldCheck size={12} />
                SVI Arb-Free · RMSE {activeData.calibration_metrics.holdout_rmse_vp}v · No-Arb {activeData.calibration_metrics.butterfly_arb_free_pct}%
                {showCalibrationPanel ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
            )}

            <button
              type="button"
              data-testid="vol-surface-info-guide-btn"
              onClick={() => setShowAxesGuide(prev => !prev)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 8px',
                borderRadius: '6px',
                border: showAxesGuide ? '1px solid #00F0FF' : '1px solid rgba(255,255,255,0.14)',
                background: showAxesGuide ? 'rgba(0, 240, 255, 0.14)' : 'rgba(255,255,255,0.04)',
                color: showAxesGuide ? '#00F0FF' : '#94a3b8',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '10.5px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
              title="Toggle Surface, Axes & Local Volatility Info Guide"
            >
              <Info size={12} />
              Info Guide
            </button>

            <a
              href="#trade-ideas-section"
              onClick={(e) => {
                e.preventDefault();
                const el = document.getElementById('trade-ideas-section');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '10.5px',
                fontWeight: 700,
                color: '#38bdf8',
                textDecoration: 'underline',
                textUnderlineOffset: '2px'
              }}
            >
              Trade Ideas ↓
            </a>
          </div>

          {/* Interactive Tenor Horizon Selector (1M, 3M, 6M, 1Y, 2Y, All LEAPS) */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            flexWrap: 'wrap',
            background: 'rgba(15, 23, 42, 0.92)',
            padding: '4px 7px',
            borderRadius: '8px',
            border: '1px solid rgba(0, 240, 255, 0.28)'
          }}>
            <span style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '10px',
              fontWeight: 800,
              color: '#94a3b8',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              paddingLeft: '2px'
            }}>
              ⏳ Horizon:
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
                    fontSize: '10.5px',
                    fontWeight: 800,
                    padding: '4px 9px',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    border: isSelected ? '1px solid #00F0FF' : '1px solid rgba(255,255,255,0.08)',
                    background: isSelected
                      ? 'linear-gradient(135deg, rgba(0, 240, 255, 0.28), rgba(59, 130, 246, 0.32))'
                      : 'rgba(255, 255, 255, 0.04)',
                    color: isSelected ? '#ffffff' : '#94a3b8',
                    boxShadow: isSelected ? '0 0 10px rgba(0, 240, 255, 0.25)' : 'none'
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Collapsible Live SVI Calibration & 5Y Multi-Backtest Scorecard Drawer */}
        {showCalibrationPanel && activeData.calibration_metrics && (() => {
          const cm = activeData.calibration_metrics;
          const eb = cm.empirical_benchmarks || {};
          return (
            <div className="vol-calibration-drawer">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', fontWeight: 800, color: '#34d399' }}>
                  🔬 LIVE SURFACE CALIBRATION & 5-YEAR EMPIRICAL SCORECARD ({ticker})
                </span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10.5px', color: '#94a3b8' }}>
                  {cm.model_name} · {cm.slices_calibrated} slices · {cm.total_contracts_used} live B76 contracts ({cm.fit_ms_per_slice} ms/slice)
                </span>
              </div>
              <div className="vol-cal-grid">
                <div className="vol-cal-metric">
                  <span className="k">Holdout RMSE / MedAE</span>
                  <span className="v">{cm.holdout_rmse_vp}v / {cm.holdout_medae_vp}v</span>
                  <span className="s">{cm.holdout_strikes_tested} unseen test strikes (Legacy: 5.35v)</span>
                </div>
                <div className="vol-cal-metric">
                  <span className="k">Bid–Ask Containment</span>
                  <span className="v" style={{ color: '#00F0FF' }}>{cm.bid_ask_hit_pct}%</span>
                  <span className="s">vs Legacy 21.7% (Direct B76 Mid Solver)</span>
                </div>
                <div className="vol-cal-metric">
                  <span className="k">No-Arbitrage Guarantees</span>
                  <span className="v">{cm.butterfly_arb_free_pct}% Bfly · {cm.calendar_arb_free_pct}% Cal</span>
                  <span className="s">Dupire σ_loc Stable: {cm.dupire_stable_pct}%</span>
                </div>
                <div className="vol-cal-metric">
                  <span className="k">ATM Put-Call Parity Gap</span>
                  <span className="v" style={{ color: '#fbbf24' }}>{cm.atm_parity_gap_vp}v</span>
                  <span className="s">Legacy Vendor Gap was {cm.legacy_atm_gap_vp}v (Solved F_T=${cm.spot_parity_reconciled})</span>
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', paddingTop: '6px', borderTop: '1px solid rgba(255,255,255,0.07)', fontFamily: "'JetBrains Mono', monospace", fontSize: '10.5px', color: '#cbd5e1' }}>
                <span style={{ color: '#00F0FF', fontWeight: 800 }}>5Y Empirical Strategy Backtest ({eb.sample_period}):</span>
                <span>• Contango VRP≥+3v Carry: <strong style={{ color: '#34d399' }}>{eb.short_vrp3_contango_win_pct}% win ({Number(eb.short_vrp3_contango_carry_vp) >= 0 ? '+' : ''}{Number(eb.short_vrp3_contango_carry_vp || 0).toFixed(2)}v avg)</strong></span>
                <span>• Backwardation 10D Crush: <strong style={{ color: '#fbbf24' }}>{eb.backwardation_10d_crush_pct}% ({eb.backwardation_10d_avg_crush_vp}v avg)</strong></span>
                <span>• Low IVP≤15% 21D Expand: <strong style={{ color: '#38bdf8' }}>{eb.low_ivp_le15_expand_pct}%</strong></span>
                <span>• RV Estimator: <strong style={{ color: '#c084fc' }}>{eb.rv_winner}</strong></span>
              </div>
            </div>
          );
        })()}

        {/* Collapsible Surface, Axes, Local Vol & Heatmap Lenses Info Guide */}
        {showAxesGuide && (
          <div
            data-testid="vol-surface-info-guide-panel"
            style={{
              background: 'rgba(15, 23, 42, 0.85)',
              border: '1px solid rgba(0, 240, 255, 0.25)',
              borderRadius: '12px',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Info size={16} color="#00F0FF" />
                <span style={{ color: '#00F0FF', fontFamily: "'JetBrains Mono', monospace", fontWeight: 'bold', fontSize: '12px', textTransform: 'uppercase' }}>
                  3D Vol Surface, Dupire Local Vol &amp; Heatmap Info Guide ({ticker}):
                </span>
              </div>
              <span style={{ color: '#94a3b8', fontSize: '11px', fontFamily: "'JetBrains Mono', monospace" }}>
                Axes · VRP · SVI · Local Vol · Playbooks
              </span>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '10px'
            }}>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '9px 11px', borderRadius: '8px', borderLeft: '3px solid #00F0FF' }}>
                <strong style={{ color: '#00F0FF', fontSize: '11.5px', display: 'block', marginBottom: '3px' }}>1. X-Axis (Left-to-Right)</strong>
                <span style={{ color: '#cbd5e1', fontSize: '11px', lineHeight: '1.35', display: 'block' }}>
                  <strong>Strike Prices ($):</strong> OTM Puts left, ATM Spot (${spot?.toFixed(2)}) center, OTM Calls right.
                </span>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '9px 11px', borderRadius: '8px', borderLeft: '3px solid #fbbf24' }}>
                <strong style={{ color: '#fbbf24', fontSize: '11.5px', display: 'block', marginBottom: '3px' }}>2. Y-Axis (Front-to-Back)</strong>
                <span style={{ color: '#cbd5e1', fontSize: '11px', lineHeight: '1.35', display: 'block' }}>
                  <strong>Expiration Dates ({horizon_meta?.label || '1–2 Years'}):</strong> Near-term weeklies in front out to {horizon_meta?.max_dte || 730}D LEAPS in back.
                </span>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '9px 11px', borderRadius: '8px', borderLeft: '3px solid #10b981' }}>
                <strong style={{ color: '#10b981', fontSize: '11.5px', display: 'block', marginBottom: '3px' }}>3. Z-Axis (Vertical Height)</strong>
                <span style={{ color: '#cbd5e1', fontSize: '11px', lineHeight: '1.35', display: 'block' }}>
                  <strong>Implied Volatility (%):</strong> Higher peaks = expensive premium. Valleys = cheap convexity.
                </span>
              </div>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '10px'
            }}>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '9px 11px', borderRadius: '8px', borderLeft: '3px solid #f59e0b' }}>
                <strong style={{ color: '#fbbf24', fontSize: '11.5px', display: 'block', marginBottom: '3px' }}>4. What is VRP (Volatility Risk Premium)?</strong>
                <span style={{ color: '#cbd5e1', fontSize: '11px', lineHeight: '1.4', display: 'block' }}>
                  <strong>VRP = Implied Vol (IV) − HAR-YZ Realized Vol (RV):</strong> The insurance markup buyers pay over actual stock movement. <strong>VRP &gt; 0</strong> = expensive options (sell spreads/premium); <strong>VRP &lt; 0</strong> = discounted gamma (buy debit spreads/convexity).
                </span>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '9px 11px', borderRadius: '8px', borderLeft: '3px solid #34d399' }}>
                <strong style={{ color: '#34d399', fontSize: '11.5px', display: 'block', marginBottom: '3px' }}>5. What is SVI (Stochastic Volatility Inspired)?</strong>
                <span style={{ color: '#cbd5e1', fontSize: '11px', lineHeight: '1.4', display: 'block' }}>
                  Gatheral&apos;s 5-parameter arbitrage-free smile curve (<code>a, b, ρ, m, σ</code>) fitting fair total variance across strikes. <strong>SVI Edge</strong> measures <code>Market IV − SVI Fair − Half Spread</code> (sub-8Δ penny wings gated) to isolate Overhedged (+) vs. Underhedged (−) strikes.
                </span>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '9px 11px', borderRadius: '8px', borderLeft: '3px solid #38bdf8' }}>
                <strong style={{ color: '#38bdf8', fontSize: '11.5px', display: 'block', marginBottom: '3px' }}>6. What is Local Volatility (σ_loc(K, T))?</strong>
                <span style={{ color: '#cbd5e1', fontSize: '11px', lineHeight: '1.4', display: 'block' }}>
                  Instantaneous future volatility priced <strong>at date T and price K</strong> (stripped of prior path). Think of <strong>IV</strong> as <em>average speed</em> to T, vs. <strong>Local Vol</strong> as <em>instantaneous speed</em> right at (K, T) — ~2× steeper downside skew and sharp post-event drops.
                </span>
              </div>
            </div>

            <div style={{
              background: 'rgba(2, 6, 23, 0.65)',
              border: '1px solid rgba(56, 189, 248, 0.2)',
              borderRadius: '8px',
              padding: '8px 11px',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '10.5px',
              color: '#94a3b8',
              lineHeight: '1.5',
              display: 'flex',
              flexDirection: 'column',
              gap: '2px'
            }}>
              <div><strong style={{ color: '#fbbf24' }}>VRP:</strong> IV(T) − HAR-YZ RV(T) · <strong style={{ color: '#34d399' }}>SVI Smile:</strong> w(k) = a + b · [ ρ(k − m) + √((k − m)² + σ²) ]</div>
              <div><strong style={{ color: '#38bdf8' }}>Dupire Local Vol (w = σ_IV²·T):</strong> σ_loc²(k, T) = (∂w/∂T) / [ (1 − k·w'/(2w))² − (w'²/4)(1/w + 1/4) + w''/2 ] · <span style={{ color: '#34d399' }}>Butterfly g(k) ≥ 0 &amp; PAVA ∂w/∂T ≥ 0 enforced.</span></div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '2px' }}>
              <span style={{ color: '#34d399', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: '11px', textTransform: 'uppercase' }}>
                How to Use This Data to Take a Trade (4 Core Playbooks + Gate):
              </span>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '8px'
              }}>
                <div style={{ background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.28)', padding: '8px 10px', borderRadius: '8px' }}>
                  <strong style={{ color: '#fb923c', fontSize: '11px', display: 'block', marginBottom: '3px' }}>A. Sell Rich VRP / Overhedge Peak</strong>
                  <span style={{ color: '#cbd5e1', fontSize: '10.5px', lineHeight: '1.4', display: 'block' }}>
                    <strong>Trigger:</strong> VRP ≥ +2.5v &amp; SVI Edge ≥ +0.40v (<code>RICH</code> chip). <strong>Trade:</strong> Short Vertical Credit Spread or Broken-Wing Fly selling the rich strike vs. adjacent fair wing; exit at 40–60% credit.
                  </span>
                </div>

                <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.28)', padding: '8px 10px', borderRadius: '8px' }}>
                  <strong style={{ color: '#34d399', fontSize: '11px', display: 'block', marginBottom: '3px' }}>B. Buy Cheap Convexity / Post-Crush</strong>
                  <span style={{ color: '#cbd5e1', fontSize: '10.5px', lineHeight: '1.4', display: 'block' }}>
                    <strong>Trigger:</strong> VRP ≤ −1.5v or <code>CHEAP</code> chip (Edge ≤ −0.40v) after a front vol crush. <strong>Trade:</strong> Long Debit Spread, Calendar, or 1×2 Backspread owning the discounted 15Δ–40Δ valley leg.
                  </span>
                </div>

                <div style={{ background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.28)', padding: '8px 10px', borderRadius: '8px' }}>
                  <strong style={{ color: '#38bdf8', fontSize: '11px', display: 'block', marginBottom: '3px' }}>C. Local Vol Event Cliff Calendar</strong>
                  <span style={{ color: '#cbd5e1', fontSize: '10.5px', lineHeight: '1.4', display: 'block' }}>
                    <strong>Trigger:</strong> Hot pre-event Local Vol row above cool post-event row (Term Twist ≥ +2.5v). <strong>Trade:</strong> Sell hot front expiry vs. cooler back expiry; take profits on post-event crush.
                  </span>
                </div>

                <div style={{ background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.28)', padding: '8px 10px', borderRadius: '8px' }}>
                  <strong style={{ color: '#c084fc', fontSize: '11px', display: 'block', marginBottom: '3px' }}>D. 4-Gate Execution Checklist</strong>
                  <span style={{ color: '#cbd5e1', fontSize: '10.5px', lineHeight: '1.4', display: 'block' }}>
                    1) Align with HAR-YZ VRP · 2) Check 1D–10D Interday <code>Sticky-Δ</code> trend · 3) Require <code>Tradable</code> liquidity &amp; tight Bid/Ask · 4) Size by B76 Vega/Theta (≤ 1–2% risk) &amp; Inspect on 3D.
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* QUANT VOLATILITY DESK KPI STRIP (8 Tiles, Clean 4x2 Grid, Zero Clipping) */}
        <div className="vol-kpis-grid">
          {/* SPOT PRICE */}
          <div className="vol-kpi-tile">
            <span className="vol-kpi-label">Parity Spot</span>
            <span className="vol-kpi-val">${spot?.toFixed(2)}</span>
            <span className="vol-kpi-sub">B76 Forward Anchor</span>
          </div>

          {/* 30D ATM IV */}
          <div className="vol-kpi-tile featured">
            <span className="vol-kpi-label">30D ATM IV {desk_metrics?.iv_percentile_1y !== undefined ? `(IVP ${Math.round(desk_metrics.iv_percentile_1y)}%)` : ''}</span>
            <span className="vol-kpi-val cyan">
              {desk_metrics?.atm_iv_30d?.toFixed(1)}%
            </span>
            <span className="vol-kpi-sub cyan">SVI Calibrated ATM</span>
          </div>

          {/* 30D REALIZED HV (YANG-ZHANG) & VRP */}
          {(() => {
            const vrp = (desk_metrics?.atm_iv_30d !== undefined && desk_metrics?.realized_hv_30d !== undefined)
              ? Number((desk_metrics.atm_iv_30d - desk_metrics.realized_hv_30d).toFixed(1))
              : null;
            const vrpSign = vrp !== null ? (vrp >= 0 ? `+${vrp}v` : `${vrp}v`) : null;
            const isRich = vrp !== null && vrp >= 3.0;
            const isCheap = vrp !== null && vrp < -1.5;
            return (
              <div className="vol-kpi-tile" title="30D Yang-Zhang OHLC Realized Volatility vs 30D ATM IV (Close-to-Close: shows unbiased gap-adjusted RV)">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '4px' }}>
                  <span className="vol-kpi-label">30D YZ Realized HV</span>
                  {vrpSign && (
                    <span 
                      style={{
                        fontFamily: 'monospace',
                        fontSize: '9px',
                        fontWeight: 700,
                        padding: '1px 5px',
                        borderRadius: '4px',
                        whiteSpace: 'nowrap',
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
                  {isRich ? `${vrpSign} Rich (Sell Vol)` : (isCheap ? `${vrpSign} Discounted` : `Equilibrium (C-C ${desk_metrics?.realized_hv_cc_30d || '--'}%)`)}
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

          {/* MULTI-DAY VOL MOVEMENT (LAST FEW DAYS) */}
          {(() => {
            const mvSum = data?.multi_day_vol_movement?.summary || {};
            const chg3d = Number(mvSum.iv_chg_3d ?? 0);
            const chg1d = Number(mvSum.iv_chg_1d ?? 0);
            const chg5d = Number(mvSum.iv_chg_5d ?? 0);
            const valClass = chg3d >= 1.5 ? 'rose' : (chg3d <= -1.5 ? 'emerald' : 'cyan');
            return (
              <div
                className="vol-kpi-tile"
                onClick={() => setActiveViewMode('vol_movement')}
                style={{ cursor: 'pointer', border: activeViewMode === 'vol_movement' ? '1px solid rgba(56, 189, 248, 0.5)' : undefined }}
                title="Click to inspect Multi-Day Volatility Movement (1D / 3D / 5D / 10D)"
              >
                <span className="vol-kpi-label">3D / 5D Vol Move</span>
                <span className={`vol-kpi-val ${valClass}`}>
                  {chg3d >= 0 ? `+${chg3d.toFixed(1)}%` : `${chg3d.toFixed(1)}%`}
                </span>
                <span className="vol-kpi-sub">
                  1D: {chg1d >= 0 ? `+${chg1d.toFixed(1)}%` : `${chg1d.toFixed(1)}%`} · 5D: {chg5d >= 0 ? `+${chg5d.toFixed(1)}%` : `${chg5d.toFixed(1)}%`}
                </span>
              </div>
            );
          })()}
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
              onClick={() => { setActiveViewMode('3d_surface'); if (surfaceColor === 'HedgingRegimes' || surfaceColor === 'LocalVol') setSurfaceColor('Plasma'); }}
              className={`vol-view-btn ${activeViewMode === '3d_surface' && surfaceColor !== 'HedgingRegimes' && surfaceColor !== 'LocalVol' ? 'active' : ''}`}
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
              onClick={() => { setActiveViewMode('3d_surface'); setSurfaceColor('LocalVol'); }}
              className={`vol-view-btn ${activeViewMode === '3d_surface' && surfaceColor === 'LocalVol' ? 'active' : ''}`}
              style={{
                borderColor: surfaceColor === 'LocalVol' ? '#f59e0b' : 'rgba(245, 158, 11, 0.35)',
                background: surfaceColor === 'LocalVol' ? 'rgba(245, 158, 11, 0.22)' : 'rgba(245, 158, 11, 0.06)',
                color: surfaceColor === 'LocalVol' ? '#fbbf24' : '#fcd34d',
                fontWeight: 800
              }}
            >
              🔥 Dupire Local Vol 3D
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
            <button
              onClick={() => setActiveViewMode('vol_movement')}
              className={`vol-view-btn ${activeViewMode === 'vol_movement' ? 'active' : ''}`}
              style={{
                borderColor: activeViewMode === 'vol_movement' ? '#38bdf8' : 'rgba(56, 189, 248, 0.35)',
                background: activeViewMode === 'vol_movement' ? 'rgba(56, 189, 248, 0.22)' : 'rgba(56, 189, 248, 0.06)',
                color: activeViewMode === 'vol_movement' ? '#38bdf8' : '#7dd3fc',
                fontWeight: 800
              }}
            >
              📈 Last Few Days Vol Move
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

          {(activeViewMode === '3d_surface' || activeViewMode === 'heatmap') && (
            <div className="vol-legend-strip" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              {activeViewMode === '3d_surface' && (
                <div className="vol-shading-quick-toggle" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.05)', padding: '2px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <button
                    type="button"
                    onClick={() => setSurfaceColor('Plasma')}
                    style={{
                      padding: '3px 8px',
                      borderRadius: '4px',
                      border: 'none',
                      background: (surfaceColor !== 'HedgingRegimes' && surfaceColor !== 'LocalVol') ? '#0284c7' : 'transparent',
                      color: (surfaceColor !== 'HedgingRegimes' && surfaceColor !== 'LocalVol') ? '#fff' : '#94a3b8',
                      fontSize: '10.5px',
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
                      fontSize: '10.5px',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    🛡️ Over/Under
                  </button>
                  <button
                    type="button"
                    onClick={() => setSurfaceColor('LocalVol')}
                    style={{
                      padding: '3px 8px',
                      borderRadius: '4px',
                      border: 'none',
                      background: surfaceColor === 'LocalVol' ? 'rgba(245, 158, 11, 0.35)' : 'transparent',
                      color: surfaceColor === 'LocalVol' ? '#fbbf24' : '#94a3b8',
                      fontSize: '10.5px',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                    title="Shade 3D Manifold by closed-form Dupire Local Volatility σ_loc(K, T)"
                  >
                    🔥 Local Vol
                  </button>
                </div>
              )}

              {/* Ghost Surface & Intraday / Interday ΔIV Motion Selector (shared across 3D Surface & 2D Heatmap) */}
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  flexWrap: 'wrap',
                  background: 'rgba(15, 23, 42, 0.85)',
                  padding: '3px 6px',
                  borderRadius: '7px',
                  border: volMoveLookback !== 'OFF' ? '1px solid rgba(56, 189, 248, 0.5)' : '1px solid rgba(255, 255, 255, 0.12)',
                  fontFamily: "'JetBrains Mono', monospace"
                }}
                title="Inspect real Intraday (09:30 Open → Close/Live) or Multi-Day (1D–10D) implied volatility movement"
              >
                <span style={{ fontSize: '10px', color: '#7dd3fc', fontWeight: 800, marginRight: '2px' }}>
                  👻 Vol Move:
                </span>
                {[
                  { id: 'OFF', label: 'Off' },
                  { id: 'INTRADAY', label: '⏱ Intraday' },
                  { id: '1D', label: '1D' },
                  { id: '2D', label: '2D' },
                  { id: '3D', label: '3D' },
                  { id: '5D', label: '5D' },
                  { id: '10D', label: '10D' }
                ].map(opt => {
                  const isSelected = volMoveLookback === opt.id;
                  const intraDisabled = opt.id === 'INTRADAY' && !data?.intraday_iv_motion?.available;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      disabled={intraDisabled}
                      onClick={() => {
                        setIsMotionPlaying(false);
                        setVolMoveLookback(opt.id);
                        if (opt.id === 'OFF') {
                          setVolMoveColorByDelta(false);
                          setInterdayShiftMode(false);
                        } else {
                          if (opt.id === 'INTRADAY') {
                            setIntradayFrameIdx(-1);
                            setInterdayShiftMode(true);
                          } else if (activeViewMode === 'heatmap') {
                            setInterdayShiftMode(true);
                          }
                        }
                      }}
                      style={{
                        padding: '2px 7px',
                        borderRadius: '4px',
                        border: isSelected ? '1px solid rgba(56, 189, 248, 0.6)' : 'none',
                        background: isSelected ? 'rgba(56, 189, 248, 0.22)' : 'transparent',
                        color: intraDisabled ? '#475569' : (isSelected ? '#38bdf8' : '#94a3b8'),
                        fontSize: '10.5px',
                        fontWeight: isSelected ? 800 : 600,
                        cursor: intraDisabled ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
                <button
                  type="button"
                  data-testid="toggle-motion-surface"
                  onClick={() => {
                    const next = !interdayShiftMode;
                    setIsMotionPlaying(false);
                    setInterdayShiftMode(next);
                    if (next && volMoveLookback === 'OFF') {
                      if (data?.intraday_iv_motion?.available) {
                        setVolMoveLookback('INTRADAY');
                        setIntradayFrameIdx(-1);
                      } else {
                        setVolMoveLookback('1D');
                      }
                    }
                  }}
                  style={{
                    marginLeft: '4px',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    border: interdayShiftMode ? '1px solid rgba(251, 191, 36, 0.7)' : '1px solid rgba(255,255,255,0.15)',
                    background: interdayShiftMode ? 'rgba(251, 191, 36, 0.22)' : 'rgba(255,255,255,0.05)',
                    color: interdayShiftMode ? '#fbbf24' : '#cbd5e1',
                    fontSize: '10.5px',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                  title="Plot real ΔIV Motion Surface (Intraday 30m trajectory or 1D–10D bars) with 3D flow vectors"
                >
                  ⚡ ΔIV Motion Surface: {interdayShiftMode ? 'ON' : 'OFF'}
                </button>
                {activeViewMode === '3d_surface' && volMoveLookback !== 'OFF' && !interdayShiftMode && (
                  <button
                    type="button"
                    onClick={() => setVolMoveColorByDelta(prev => !prev)}
                    style={{
                      marginLeft: '4px',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      border: volMoveColorByDelta ? '1px solid rgba(244, 63, 94, 0.6)' : '1px solid rgba(255,255,255,0.15)',
                      background: volMoveColorByDelta ? 'linear-gradient(90deg, rgba(16,185,129,0.28), rgba(244,63,94,0.28))' : 'rgba(255,255,255,0.05)',
                      color: volMoveColorByDelta ? '#fda4af' : '#cbd5e1',
                      fontSize: '10.5px',
                      fontWeight: 800,
                      cursor: 'pointer'
                    }}
                    title="Color the 3D surface directly by ΔIV change vs the selected lookback (Red = IV Expansion, Green = IV Crush)"
                  >
                    🌊 Shade 3D by ΔIV: {volMoveColorByDelta ? 'ON' : 'OFF'}
                  </button>
                )}
              </div>

              {activeViewMode === '3d_surface' && (
                <>
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

                  {/* Exact Kinks vs Smooth Manifold Toggle */}
                  <button
                    type="button"
                    onClick={() => setSurfacePrecision(prev => (prev === 'exact' ? 'smooth' : 'exact'))}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '4px 9px',
                      borderRadius: '6px',
                      border: surfacePrecision === 'exact' ? '1px solid rgba(236, 72, 153, 0.55)' : '1px solid rgba(255, 255, 255, 0.12)',
                      background: surfacePrecision === 'exact' ? 'rgba(236, 72, 153, 0.16)' : 'rgba(255, 255, 255, 0.04)',
                      color: surfacePrecision === 'exact' ? '#f472b6' : '#94a3b8',
                      fontSize: '11px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      fontFamily: "'JetBrains Mono', monospace"
                    }}
                    title="Exact Kinks disables cross-tenor blur so earnings-week humps and spikes remain 100% sharp"
                  >
                    <span>{surfacePrecision === 'exact' ? '⚡ Exact Kinks' : '🌊 Smooth'}</span>
                  </button>

                  {/* 3D Vertical Z-Relief Toggle */}
                  <button
                    type="button"
                    onClick={() => setZRelief(prev => (prev === '1.55' ? '1.15' : '1.55'))}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '4px 9px',
                      borderRadius: '6px',
                      border: zRelief === '1.55' ? '1px solid rgba(251, 191, 36, 0.55)' : '1px solid rgba(255, 255, 255, 0.12)',
                      background: zRelief === '1.55' ? 'rgba(251, 191, 36, 0.14)' : 'rgba(255, 255, 255, 0.04)',
                      color: zRelief === '1.55' ? '#fbbf24' : '#cbd5e1',
                      fontSize: '11px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      fontFamily: "'JetBrains Mono', monospace"
                    }}
                    title="Boost 3D vertical elevation to inspect earnings humps and wing skews"
                  >
                    <span>⛰️ Relief {zRelief === '1.55' ? '1.5x' : '1.1x'}</span>
                  </button>
                </>
              )}

              {focusedHotspot && (
                <button
                  type="button"
                  onClick={() => setFocusedHotspot(null)}
                  className="vol-focus-badge"
                  style={{ cursor: 'pointer', border: '1px solid rgba(0, 240, 255, 0.5)' }}
                  title="Click to clear Focus Lock"
                >
                  🎯 Target: {focusedHotspot.expiry} (${focusedHotspot.strike}) ×
                </button>
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
                  <button
                    type="button"
                    data-testid="svi-chart-info-toggle"
                    onClick={() => setShowSviChartInfo(v => !v)}
                    style={{
                      padding: '3px 9px',
                      borderRadius: '5px',
                      cursor: 'pointer',
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: '10px',
                      fontWeight: 800,
                      border: `1px solid ${showSviChartInfo ? '#fbbf24' : 'rgba(148, 163, 184, 0.3)'}`,
                      background: showSviChartInfo ? 'rgba(251, 191, 36, 0.18)' : 'rgba(15, 23, 42, 0.75)',
                      color: showSviChartInfo ? '#fde68a' : '#94a3b8'
                    }}
                  >
                    🏷️ SVI On-Chart Info: {showSviChartInfo ? 'ON' : 'OFF'}
                  </button>
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

        {/* Multi-Day Vol Movement Control & Telemetry Strip */}
        {activeViewMode === 'vol_movement' && (() => {
          const mvSum = data?.multi_day_vol_movement?.summary || {};
          const chg1d = Number(mvSum.iv_chg_1d ?? 0);
          const chg3d = Number(mvSum.iv_chg_3d ?? 0);
          const chg5d = Number(mvSum.iv_chg_5d ?? 0);
          const chg10d = Number(mvSum.iv_chg_10d ?? 0);
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
                background: 'rgba(15, 23, 42, 0.90)',
                border: '1px solid rgba(56, 189, 248, 0.32)',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '11px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ color: '#38bdf8', fontWeight: 800 }}>
                  📈 MULTI-DAY VOLATILITY MOVEMENT · {ticker}
                </span>
                <div style={{ display: 'inline-flex', gap: '4px', background: 'rgba(255,255,255,0.05)', padding: '2px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <button
                    type="button"
                    onClick={() => setMultiDayChartSubmode('term_shift')}
                    style={{
                      padding: '3px 9px',
                      borderRadius: '4px',
                      border: 'none',
                      background: multiDayChartSubmode === 'term_shift' ? '#0284c7' : 'transparent',
                      color: multiDayChartSubmode === 'term_shift' ? '#fff' : '#94a3b8',
                      fontSize: '10.5px',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    ⏳ Term Structure Shift (Today vs 1D/3D/5D/10D)
                  </button>
                  <button
                    type="button"
                    onClick={() => setMultiDayChartSubmode('daily_iv_skew')}
                    style={{
                      padding: '3px 9px',
                      borderRadius: '4px',
                      border: 'none',
                      background: multiDayChartSubmode === 'daily_iv_skew' ? '#0284c7' : 'transparent',
                      color: multiDayChartSubmode === 'daily_iv_skew' ? '#fff' : '#94a3b8',
                      fontSize: '10.5px',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    📊 Last 10 Days ATM IV, HV & 25Δ Skew Tape
                  </button>
                </div>
                {multiDayChartSubmode === 'term_shift' && (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginLeft: '4px' }}>
                    <span style={{ color: '#94a3b8', fontSize: '10px' }}>ΔIV Bars vs:</span>
                    {['1D', '3D', '5D', '10D'].map(lb => {
                      const activeLb = (volMoveLookback === 'OFF' ? '3D' : volMoveLookback) === lb;
                      return (
                        <button
                          key={lb}
                          type="button"
                          onClick={() => setVolMoveLookback(lb)}
                          style={{
                            padding: '2px 7px',
                            borderRadius: '4px',
                            border: activeLb ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.1)',
                            background: activeLb ? 'rgba(56,189,248,0.2)' : 'rgba(255,255,255,0.04)',
                            color: activeLb ? '#38bdf8' : '#94a3b8',
                            fontSize: '10px',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          {lb} Ago
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ padding: '3px 8px', borderRadius: '5px', background: 'rgba(15,23,42,0.8)', border: `1px solid ${mvSum.momentum_color || '#38bdf8'}`, color: mvSum.momentum_color || '#38bdf8', fontWeight: 800 }}>
                  {mvSum.momentum_regime || '⚖️ Vol Stable'}
                </span>
                <span style={{ padding: '3px 8px', borderRadius: '5px', background: chg1d >= 0 ? 'rgba(244,63,94,0.14)' : 'rgba(16,185,129,0.14)', color: chg1d >= 0 ? '#fda4af' : '#6ee7b7' }}>
                  1D: <strong>{chg1d >= 0 ? `+${chg1d.toFixed(2)}%` : `${chg1d.toFixed(2)}%`}</strong>
                </span>
                <span style={{ padding: '3px 8px', borderRadius: '5px', background: chg3d >= 0 ? 'rgba(244,63,94,0.14)' : 'rgba(16,185,129,0.14)', color: chg3d >= 0 ? '#fda4af' : '#6ee7b7' }}>
                  3D: <strong>{chg3d >= 0 ? `+${chg3d.toFixed(2)}%` : `${chg3d.toFixed(2)}%`}</strong>
                </span>
                <span style={{ padding: '3px 8px', borderRadius: '5px', background: chg5d >= 0 ? 'rgba(244,63,94,0.14)' : 'rgba(16,185,129,0.14)', color: chg5d >= 0 ? '#fda4af' : '#6ee7b7' }}>
                  5D: <strong>{chg5d >= 0 ? `+${chg5d.toFixed(2)}%` : `${chg5d.toFixed(2)}%`}</strong>
                </span>
                <span style={{ padding: '3px 8px', borderRadius: '5px', background: chg10d >= 0 ? 'rgba(244,63,94,0.14)' : 'rgba(16,185,129,0.14)', color: chg10d >= 0 ? '#fda4af' : '#6ee7b7' }}>
                  10D: <strong>{chg10d >= 0 ? `+${chg10d.toFixed(2)}%` : `${chg10d.toFixed(2)}%`}</strong>
                </span>
              </div>
            </div>
          );
        })()}

        {/* 3D VOLATILITY SHIFT ANATOMY & ANALYSIS CARD (How Vol Shifted Across Level, Term Structure & Skew) */}
        {(activeViewMode === '3d_surface' || activeViewMode === 'vol_movement') && data?.multi_day_vol_movement && (() => {
          const mv = data.multi_day_vol_movement;
          const mvSum = mv.summary || {};
          const snaps = mv.historical_snapshots || {};
          const effLb = (volMoveLookback === 'OFF' || volMoveLookback === 'INTRADAY') ? '1D' : volMoveLookback;
          const activeSnap = snaps[effLb] || snaps['1D'] || snaps['3D'] || {};
          const snapTs = activeSnap.term_structure || [];

          // Compute Front (<=35D), Belly (36-120D), and Back/LEAPS (>120D) ΔIV shifts
          const getTenorDelta = (item) => {
            if (!item) return 0;
            if (item.iv_change !== undefined && item.iv_change !== null) return Number(item.iv_change);
            if (item.iv_delta !== undefined && item.iv_delta !== null) return Number(item.iv_delta);
            if (item.today_atm_iv !== undefined && item.atm_iv !== undefined) {
              return Number((Number(item.today_atm_iv) - Number(item.atm_iv)).toFixed(2));
            }
            return 0;
          };

          const ivNow = Number(mvSum.atm_iv_current ?? desk_metrics?.atm_iv_30d ?? 20);
          const ivPast = Number(activeSnap.atm_iv_30d ?? activeSnap.atm_iv ?? ivNow);
          const ivShift = Number(activeSnap.iv_shift_pts ?? activeSnap.iv_change ?? (ivNow - ivPast));
          const ivRelPct = ivPast > 0 ? ((ivShift / ivPast) * 100) : 0;

          const frontPts = snapTs.filter(t => (t.dte ?? 30) <= 35);
          const bellyPts = snapTs.filter(t => (t.dte ?? 30) > 35 && (t.dte ?? 30) <= 120);
          const backPts = snapTs.filter(t => (t.dte ?? 30) > 120);

          const avgDelta = (arr, fallbackWeight = 1.0) => arr.length > 0
            ? arr.reduce((acc, item) => acc + getTenorDelta(item), 0) / arr.length
            : Number((ivShift * fallbackWeight).toFixed(2));

          const frontDelta = avgDelta(frontPts, 1.25);
          const bellyDelta = avgDelta(bellyPts.length > 0 ? bellyPts : snapTs, 0.85);
          const backDelta = avgDelta(backPts.length > 0 ? backPts : snapTs.slice(-2), 0.45);
          const frontVsBackTwist = frontDelta - backDelta;

          // Find max expanding & max crushing/lagging tenor across the active horizon
          const horizonExpSet = new Set((activeData.term_structure || []).map(t => t.expiry));
          const horizonSnapTs = snapTs.filter(t => horizonExpSet.size === 0 || horizonExpSet.has(t.expiry));
          const poolForExtremes = horizonSnapTs.length > 0 ? horizonSnapTs : snapTs;
          const sortedByDelta = [...poolForExtremes].sort((a, b) => Math.abs(getTenorDelta(b)) - Math.abs(getTenorDelta(a)));
          const maxExpander = sortedByDelta[0] || null;
          const maxExpanderDelta = getTenorDelta(maxExpander);

          const skewNow = Number(mvSum.skew_current ?? desk_metrics?.skew_spread ?? 0);
          const skewPast = Number(activeSnap.skew_25d ?? skewNow);
          const skewShift = Number(activeSnap.skew_shift_pts ?? activeSnap.skew_change ?? (skewNow - skewPast));
          const spotShiftPct = Number(activeSnap.spot_shift_pct ?? activeSnap.spot_change_pct ?? 0);
          const hv10 = Number(mvSum.hv_10d || desk_metrics?.realized_hv_30d || 20);
          const ivHvSpread10d = ivNow - hv10;

          // 1. Diagnose Term Structure Twist
          let twistBadge = '🌊 PARALLEL CURVE SHIFT';
          let twistColor = '#38bdf8';
          let twistDesc = `Front (${frontDelta >= 0 ? '+' : ''}${frontDelta.toFixed(2)}%) and Back LEAPS (${backDelta >= 0 ? '+' : ''}${backDelta.toFixed(2)}%) shifted in tandem.`;
          if (frontVsBackTwist >= 1.0) {
            twistBadge = '🔥 FRONT-END BID (BEAR FLATTENING)';
            twistColor = '#f43f5e';
            twistDesc = `Front-month IV shifted ${frontVsBackTwist >= 0 ? '+' : ''}${frontVsBackTwist.toFixed(2)}% faster than LEAPS (${frontDelta >= 0 ? '+' : ''}${frontDelta.toFixed(1)}% vs ${backDelta >= 0 ? '+' : ''}${backDelta.toFixed(1)}%), signaling urgent near-term event/gamma demand.`;
          } else if (frontVsBackTwist <= -1.0) {
            twistBadge = '🧊 FRONT VOL CRUSH (CONTANGO STEEPENING)';
            twistColor = '#10b981';
            twistDesc = `Front-month IV compressed ${Math.abs(frontVsBackTwist).toFixed(2)}% more than back tenors (${frontDelta.toFixed(1)}% vs ${backDelta >= 0 ? '+' : ''}${backDelta.toFixed(1)}%) as near-term event risk cleared.`;
          } else if (backDelta >= 1.2 && backDelta > frontDelta + 0.5) {
            twistBadge = '📈 BACK-END LEAPS RE-RATING';
            twistColor = '#a855f7';
            twistDesc = `Deferred LEAPS IV expanded +${backDelta.toFixed(2)}% vs Front ${frontDelta >= 0 ? '+' : ''}${frontDelta.toFixed(2)}%, reflecting institutional long-horizon vega accumulation.`;
          }

          // 2. Diagnose Wing & Skew Rotation
          let skewBadge = '⚖️ BALANCED SMILE SHIFT';
          let skewColor = '#38bdf8';
          let skewDesc = `25Δ Put-Call Skew shifted ${skewShift >= 0 ? '+' : ''}${skewShift.toFixed(2)}% while spot moved ${spotShiftPct >= 0 ? '+' : ''}${spotShiftPct.toFixed(2)}%.`;
          if (skewShift >= 0.8 && spotShiftPct <= 0) {
            skewBadge = '🛡️ DOWNSIDE HEDGE BIDDING (PUT WING LIFT)';
            skewColor = '#f43f5e';
            skewDesc = `Put wing IV lifted +${skewShift.toFixed(2)}% over calls on a ${spotShiftPct.toFixed(2)}% spot pullback — institutions are actively paying up for downside tail protection.`;
          } else if (skewShift <= -0.6 && spotShiftPct >= 0) {
            skewBadge = '🚀 CALL WING BID / PUT SKEW CRUSH';
            skewColor = '#10b981';
            skewDesc = `25Δ Put Skew flattened ${skewShift.toFixed(2)}% alongside a +${spotShiftPct.toFixed(2)}% spot rally — upside call demand is outpacing downside hedging.`;
          } else if (skewShift >= 0.8 && spotShiftPct > 0) {
            skewBadge = '⚠️ HEDGED RALLY (PUT SKEW RISING ON UP-TAPE)';
            skewColor = '#fbbf24';
            skewDesc = `Spot rose +${spotShiftPct.toFixed(2)}% yet 25Δ Put Skew steepened +${skewShift.toFixed(2)}% — dealers/funds are buying protective collars into strength.`;
          } else if (skewShift <= -0.6 && spotShiftPct < 0) {
            skewBadge = '💎 PUT MONETIZATION (SKEW COMPRESSING ON DIP)';
            skewColor = '#00F0FF';
            skewDesc = `Despite spot dipping ${spotShiftPct.toFixed(2)}%, put skew compressed ${skewShift.toFixed(2)}% — traders are taking profits on existing downside hedges.`;
          }

          // 3. Actionable Quant Playbook based on 3D Shift
          let shiftPlaybookTitle = ' Balanced Relative-Value Spread Carry';
          let shiftPlaybookAction = `Surface shifted ${ivShift >= 0 ? '+' : ''}${ivShift.toFixed(2)}% vs ${effLb} ago. Favor defined-risk vertical spreads or iron condors anchored near highest-dislocation strikes.`;
          if (ivShift >= 1.5 && frontVsBackTwist >= 0.8) {
            shiftPlaybookTitle = 'Sell Rich Front Vega / Long Calendar & Diagonal Spreads';
            shiftPlaybookAction = `Front IV surged +${frontDelta.toFixed(2)}% (${effLb}) while back tenors lagged (+${backDelta.toFixed(2)}%). Sell elevated front-month strangles/credit spreads or enter Long Calendar/Diagonal spreads (short ≤30D / long 60–120D).`;
          } else if (ivShift >= 1.5 && skewShift >= 0.7) {
            shiftPlaybookTitle = 'Harvest Steepened Put Skew (Bull Put Spreads / Risk Reversals)';
            shiftPlaybookAction = `30D IV expanded +${ivShift.toFixed(2)}% with 25Δ Put Skew steepening +${skewShift.toFixed(2)}%. Sell rich OTM 25Δ Put Credit Spreads or finance OTM Call Debits via Bullish Risk Reversals.`;
          } else if (ivShift <= -1.5) {
            shiftPlaybookTitle = 'Accumulate Cheap Convexity (Long Debit Spreads / Backspreads)';
            shiftPlaybookAction = `Implied Vol crushed ${ivShift.toFixed(2)}% over the last ${effLb} (now ${ivNow.toFixed(1)}% vs ${hv10.toFixed(1)}% 10D Realized HV). Buy underpriced directional call/put debit spreads or long straddles before vol mean-reverts.`;
          }

          // Compact bar when on 3D surface and lookback is OFF, with 1-click expand
          if (activeViewMode === '3d_surface' && volMoveLookback === 'OFF') {
            return (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '10px',
                  padding: '9px 14px',
                  borderRadius: '10px',
                  background: 'rgba(15, 23, 42, 0.88)',
                  border: '1px solid rgba(56, 189, 248, 0.28)',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '11px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ color: '#38bdf8', fontWeight: 800 }}>
                    🧭 3D VOL SHIFT DIGEST (3D AGO → NOW):
                  </span>
                  <span style={{ padding: '2px 7px', borderRadius: '4px', background: ivShift >= 0 ? 'rgba(244,63,94,0.16)' : 'rgba(16,185,129,0.16)', color: ivShift >= 0 ? '#fda4af' : '#6ee7b7', fontWeight: 800 }}>
                    ATM IV: {ivPast.toFixed(1)}% → {ivNow.toFixed(1)}% ({ivShift >= 0 ? `+${ivShift.toFixed(2)}%` : `${ivShift.toFixed(2)}%`})
                  </span>
                  <span style={{ padding: '2px 7px', borderRadius: '4px', background: 'rgba(15,23,42,0.9)', border: `1px solid ${twistColor}`, color: twistColor, fontWeight: 700 }}>
                    {twistBadge}
                  </span>
                  <span style={{ padding: '2px 7px', borderRadius: '4px', background: 'rgba(15,23,42,0.9)', border: `1px solid ${skewColor}`, color: skewColor, fontWeight: 700 }}>
                    {skewBadge}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: '#94a3b8', fontSize: '10px' }}>Inspect 3D Shift Card & Ghost Mesh:</span>
                  {['1D', '3D', '5D', '10D'].map(lb => (
                    <button
                      key={lb}
                      type="button"
                      onClick={() => setVolMoveLookback(lb)}
                      style={{
                        padding: '3px 8px',
                        borderRadius: '5px',
                        border: '1px solid rgba(56, 189, 248, 0.4)',
                        background: 'rgba(56, 189, 248, 0.14)',
                        color: '#38bdf8',
                        fontSize: '10.5px',
                        fontWeight: 800,
                        cursor: 'pointer'
                      }}
                    >
                      👻 {lb} Shift
                    </button>
                  ))}
                </div>
              </div>
            );
          }

          return (
            <div
              style={{
                background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.95) 0%, rgba(9, 14, 28, 0.95) 100%)',
                border: `1px solid ${mvSum.momentum_color || '#38bdf8'}`,
                borderRadius: '12px',
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)'
              }}
            >
              {/* Top Header Row of the 3D Vol Shift Card */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '12.5px', fontWeight: 800, color: '#00F0FF', fontFamily: "'JetBrains Mono', monospace" }}>
                    🧭 3D VOLATILITY SHIFT ANALYSIS ({activeSnap.label || `${effLb} Ago`} · {activeSnap.date || ''} → Today)
                  </span>
                  <span
                    style={{
                      padding: '2px 9px',
                      borderRadius: '999px',
                      background: 'rgba(15, 23, 42, 0.9)',
                      border: `1px solid ${mvSum.momentum_color || '#38bdf8'}`,
                      color: mvSum.momentum_color || '#38bdf8',
                      fontSize: '10.5px',
                      fontWeight: 800,
                      fontFamily: "'JetBrains Mono', monospace"
                    }}
                  >
                    {mvSum.momentum_regime || '⚖️ Vol Stable'}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap', fontFamily: "'JetBrains Mono', monospace" }}>
                  <span style={{ fontSize: '10px', color: '#94a3b8' }}>Compare Shift vs:</span>
                  {['1D', '3D', '5D', '10D'].map(lb => {
                    const isSel = effLb === lb;
                    return (
                      <button
                        key={lb}
                        type="button"
                        onClick={() => setVolMoveLookback(lb)}
                        style={{
                          padding: '3px 8px',
                          borderRadius: '5px',
                          border: isSel ? '1px solid #00F0FF' : '1px solid rgba(255,255,255,0.12)',
                          background: isSel ? 'rgba(0, 240, 255, 0.18)' : 'rgba(255,255,255,0.04)',
                          color: isSel ? '#00F0FF' : '#cbd5e1',
                          fontSize: '10.5px',
                          fontWeight: 800,
                          cursor: 'pointer'
                        }}
                      >
                        {lb} Ago
                      </button>
                    );
                  })}
                  {activeViewMode === '3d_surface' && (
                    <>
                      <button
                        type="button"
                        onClick={() => setVolMoveColorByDelta(prev => !prev)}
                        style={{
                          padding: '3px 8px',
                          borderRadius: '5px',
                          border: volMoveColorByDelta ? '1px solid #f43f5e' : '1px solid rgba(255,255,255,0.15)',
                          background: volMoveColorByDelta ? 'rgba(244, 63, 94, 0.22)' : 'rgba(255,255,255,0.05)',
                          color: volMoveColorByDelta ? '#fda4af' : '#cbd5e1',
                          fontSize: '10.5px',
                          fontWeight: 800,
                          cursor: 'pointer'
                        }}
                      >
                        🌊 Color 3D by ΔIV: {volMoveColorByDelta ? 'ON' : 'OFF'}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setVolMoveLookback('OFF'); setVolMoveColorByDelta(false); }}
                        style={{
                          padding: '3px 8px',
                          borderRadius: '5px',
                          border: '1px solid rgba(255,255,255,0.12)',
                          background: 'rgba(255,255,255,0.04)',
                          color: '#94a3b8',
                          fontSize: '10px',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                        title="Hide 3D Ghost Overlay and collapse card"
                      >
                        Hide Overlay
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* 4-Pillar Anatomy Grid: How the 3D Surface Shifted */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(245px, 1fr))', gap: '10px' }}>
                {/* Card 1: Parallel Level Shift (ATM Spine) */}
                <div
                  style={{
                    padding: '11px 13px',
                    borderRadius: '9px',
                    background: 'rgba(30, 41, 59, 0.55)',
                    border: `1px solid ${ivShift >= 0.5 ? 'rgba(244,63,94,0.35)' : (ivShift <= -0.5 ? 'rgba(16,185,129,0.35)' : 'rgba(148,163,184,0.25)')}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: "'JetBrains Mono', monospace" }}>
                    <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#94a3b8' }}>
                      1️⃣ PARALLEL LEVEL SHIFT (ATM)
                    </span>
                    <span
                      style={{
                        fontSize: '10.5px',
                        fontWeight: 800,
                        padding: '1px 6px',
                        borderRadius: '4px',
                        background: ivShift >= 0 ? 'rgba(244,63,94,0.18)' : 'rgba(16,185,129,0.18)',
                        color: ivShift >= 0 ? '#fda4af' : '#6ee7b7'
                      }}
                    >
                      {ivShift >= 0 ? `+${ivShift.toFixed(2)}%` : `${ivShift.toFixed(2)}%`} ({ivRelPct >= 0 ? `+${ivRelPct.toFixed(1)}%` : `${ivRelPct.toFixed(1)}%`} rel)
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: '#f8fafc', fontWeight: 800 }}>
                    <span>{effLb} Ago: {ivPast.toFixed(2)}%</span>
                    <span style={{ color: '#00F0FF' }}>→ Now: {ivNow.toFixed(2)}%</span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#cbd5e1', lineHeight: 1.4 }}>
                    10D Realized HV is <strong>{hv10.toFixed(1)}%</strong> ({ivHvSpread10d >= 0 ? `IV trades +${ivHvSpread10d.toFixed(1)}% rich above realized` : `IV trades ${ivHvSpread10d.toFixed(1)}% discounted below realized`}).
                  </div>
                </div>

                {/* Card 2: Term Structure Twist (Front vs Belly vs Back) */}
                <div
                  style={{
                    padding: '11px 13px',
                    borderRadius: '9px',
                    background: 'rgba(30, 41, 59, 0.55)',
                    border: `1px solid ${twistColor}55`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: "'JetBrains Mono', monospace" }}>
                    <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#94a3b8' }}>
                      2️⃣ TERM STRUCTURE TWIST
                    </span>
                    <span style={{ fontSize: '10px', fontWeight: 800, color: twistColor }}>
                      {twistBadge}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: '#e2e8f0' }}>
                    <span>Front ≤35D: <strong style={{ color: frontDelta >= 0 ? '#fda4af' : '#6ee7b7' }}>{frontDelta >= 0 ? `+${frontDelta.toFixed(1)}%` : `${frontDelta.toFixed(1)}%`}</strong></span>
                    <span>Belly: <strong style={{ color: bellyDelta >= 0 ? '#fda4af' : '#6ee7b7' }}>{bellyDelta >= 0 ? `+${bellyDelta.toFixed(1)}%` : `${bellyDelta.toFixed(1)}%`}</strong></span>
                    <span>LEAPS: <strong style={{ color: backDelta >= 0 ? '#fda4af' : '#6ee7b7' }}>{backDelta >= 0 ? `+${backDelta.toFixed(1)}%` : `${backDelta.toFixed(1)}%`}</strong></span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#cbd5e1', lineHeight: 1.4 }}>
                    {twistDesc}
                  </div>
                </div>

                {/* Card 3: Wing & Skew Rotation (25Δ Put vs Call) */}
                <div
                  style={{
                    padding: '11px 13px',
                    borderRadius: '9px',
                    background: 'rgba(30, 41, 59, 0.55)',
                    border: `1px solid ${skewColor}55`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: "'JetBrains Mono', monospace" }}>
                    <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#94a3b8' }}>
                      3️⃣ WING & 25Δ SKEW ROTATION
                    </span>
                    <span style={{ fontSize: '10px', fontWeight: 800, color: skewColor }}>
                      {skewBadge}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: "'JetBrains Mono', monospace", fontSize: '11.5px', color: '#e2e8f0' }}>
                    <span>25Δ Skew: <strong>{skewPast.toFixed(2)}% → {skewNow.toFixed(2)}%</strong> ({skewShift >= 0 ? `+${skewShift.toFixed(2)}%` : `${skewShift.toFixed(2)}%`})</span>
                    <span>Spot: <strong style={{ color: spotShiftPct >= 0 ? '#34d399' : '#f87171' }}>{spotShiftPct >= 0 ? `+${spotShiftPct.toFixed(2)}%` : `${spotShiftPct.toFixed(2)}%`}</strong></span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#cbd5e1', lineHeight: 1.4 }}>
                    {skewDesc}
                  </div>
                </div>

                {/* Card 4: Peak Tenor Shifters & Actionable Quant Playbook */}
                <div
                  style={{
                    padding: '11px 13px',
                    borderRadius: '9px',
                    background: 'rgba(30, 41, 59, 0.55)',
                    border: '1px solid rgba(0, 240, 255, 0.35)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: "'JetBrains Mono', monospace" }}>
                    <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#00F0FF' }}>
                      4️⃣ QUANT SHIFT PLAYBOOK
                    </span>
                    {maxExpander && (
                      <span style={{ fontSize: '10px', color: maxExpanderDelta >= 0 ? '#fda4af' : '#6ee7b7', fontWeight: 700 }}>
                        Peak Shift: {maxExpander.expiry} ({maxExpander.dte}D · {maxExpanderDelta >= 0 ? `+${maxExpanderDelta.toFixed(2)}%` : `${maxExpanderDelta.toFixed(2)}%`})
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '11.5px', fontWeight: 800, color: '#f8fafc', fontFamily: "'JetBrains Mono', monospace" }}>
                    🎯 {shiftPlaybookTitle}
                  </div>
                  <div style={{ fontSize: '11px', color: '#cbd5e1', lineHeight: 1.4 }}>
                    {shiftPlaybookAction}
                  </div>
                </div>
              </div>

              {/* 5. ACTIONABLE VOL-SHIFT NEXT TRADE VERDICT (LONG vs SHORT) */}
              {(() => {
                const svCorr = Number(desk_metrics?.spot_vol_corr ?? -0.55);
                let dirScore = 0;
                const reasons = [];

                if (svCorr >= 0.15) {
                  if (ivShift >= 1.2 && spotShiftPct >= 0) {
                    dirScore += 2;
                    reasons.push(`Call-squeeze regime (+${ivShift.toFixed(1)}% IV + Spot ↑)`);
                  } else if (ivShift <= -1.2 && spotShiftPct < 0) {
                    dirScore -= 1.5;
                    reasons.push(`Call-squeeze unwind (${ivShift.toFixed(1)}% IV)`);
                  }
                } else {
                  if (ivShift <= -0.8) {
                    dirScore += 2;
                    reasons.push(`Vol crush (${ivShift.toFixed(1)}% IV) fuels Vanna dealer buybacks`);
                  } else if (ivShift >= 1.2) {
                    dirScore -= 2;
                    reasons.push(`Vol spike (+${ivShift.toFixed(1)}% IV) forces dealer delta selling`);
                  }
                }

                if (skewShift <= -0.5) {
                  dirScore += 1.5;
                  reasons.push(`Put skew unwinding (${skewShift.toFixed(1)}%)`);
                } else if (skewShift >= 0.6) {
                  dirScore -= 1.5;
                  reasons.push(`Put tail demand rising (+${skewShift.toFixed(1)}% skew)`);
                }

                if (frontVsBackTwist <= -0.8 && ivShift <= 0) {
                  dirScore += 1;
                  reasons.push('Front-month contango steepening');
                } else if (frontVsBackTwist >= 0.8 && ivShift > 0) {
                  dirScore -= 1;
                  reasons.push('Front-month backwardation stress');
                }

                if (spotShiftPct >= 0.5 && ivShift <= 0.2) dirScore += 1;
                if (spotShiftPct <= -0.5 && ivShift >= 0.2) dirScore -= 1;

                const confidence = Math.min(92, Math.max(48, Math.round(52 + Math.abs(dirScore) * 8.5)));
                const targetTenor = maxExpander ? `${maxExpander.expiry} (${maxExpander.dte}D)` : '30D–45D Monthly';

                let verdictLabel = 'NEUTRAL / RANGE CHOP';
                let verdictBadge = '🟡 NEUTRAL · SELL VOL / WAIT';
                let verdictColor = '#fbbf24';
                let structure = ivHvSpread10d >= 2.5
                  ? `Iron Condor / Short Strangle around $${(spot || 100).toFixed(0)}`
                  : 'Wait for ±1.0% IV break or Vol Trigger flip';
                let invalidation = `Exit if 1D IV spikes > +1.5% or Spot breaks ±1.5%`;

                if (dirScore >= 1.5) {
                  verdictLabel = 'GO LONG (BULLISH)';
                  verdictBadge = '🟢 GO LONG';
                  verdictColor = '#00E676';
                  structure = ivHvSpread10d >= 3.0
                    ? `Bull Put Credit Spread (Sell ATM/OTM Put) to capture rich VRP + Vanna tailwind`
                    : `Bull Call Debit Spread (${targetTenor}) to ride upward drift`;
                  invalidation = `Invalidate if ${effLb} IV reverses > +1.5% or Put Skew spikes > +0.8%`;
                } else if (dirScore <= -1.5) {
                  verdictLabel = 'GO SHORT / HEDGE (BEARISH)';
                  verdictBadge = '🔴 GO SHORT';
                  verdictColor = '#f43f5e';
                  structure = ivHvSpread10d >= 4.0
                    ? `Bear Call Credit Spread (Sell OTM Call) to fade elevated IV on rallies`
                    : `Bear Put Debit Spread (${targetTenor}) for downside convexity`;
                  invalidation = `Invalidate if IV crushes < -1.0% and Spot reclaims prior session high`;
                }

                return (
                  <div
                    style={{
                      marginTop: '10px',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      background: `linear-gradient(135deg, ${verdictColor}14 0%, rgba(15, 23, 42, 0.9) 100%)`,
                      border: `1px solid ${verdictColor}55`,
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: '1 1 380px' }}>
                      <span
                        style={{
                          padding: '6px 12px',
                          borderRadius: '8px',
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: '12px',
                          fontWeight: 900,
                          background: `${verdictColor}22`,
                          color: verdictColor,
                          border: `1px solid ${verdictColor}66`,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {verdictBadge} ({confidence}% Conf.)
                      </span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 800, color: '#f8fafc', fontFamily: "'JetBrains Mono', monospace" }}>
                          Next Trade ({effLb} Vol Shift): {verdictLabel} → {structure}
                        </div>
                        <div style={{ fontSize: '11px', color: '#cbd5e1' }}>
                          {reasons.length > 0 ? reasons.join(' · ') : `Balanced ${effLb} vol shift (${ivShift >= 0 ? '+' : ''}${ivShift.toFixed(1)}% IV, ${skewShift >= 0 ? '+' : ''}${skewShift.toFixed(1)}% Skew).`}
                        </div>
                      </div>
                    </div>

                    <div style={{ fontSize: '10.5px', fontFamily: "'JetBrains Mono', monospace", color: '#94a3b8', textAlign: 'right' }}>
                      <div>Target Tenor: <strong style={{ color: '#e2e8f0' }}>{targetTenor}</strong></div>
                      <div>Guardrail: <span style={{ color: '#fbbf24' }}>{invalidation}</span></div>
                    </div>
                  </div>
                );
              })()}
            </div>
          );
        })()}

        {/* Real Intraday & Interday ΔIV Motion Control Deck + Sticky-Delta Decomposition Strip */}
        {(activeViewMode === '3d_surface' || activeViewMode === 'heatmap') && interdayShiftMode && (() => {
          const mv = data?.multi_day_vol_movement;
          const intraM = data?.intraday_iv_motion;
          const interV4 = data?.interday_iv_motion;
          const r1d = mv?.real_delta_iv_1d;

          const isIntra = volMoveLookback === 'INTRADAY' && Boolean(intraM?.available && intraM?.checkpoints?.length);
          const cps = isIntra ? (intraM.checkpoints || []) : [];
          const effCpIdx = isIntra ? ((intradayFrameIdx >= 0 && intradayFrameIdx < cps.length) ? intradayFrameIdx : cps.length - 1) : 0;
          const activeCp = isIntra ? cps[effCpIdx] : null;

          const replayOrder = (interV4?.available && Array.isArray(interV4.replay_order) && interV4.replay_order.length > 0)
            ? interV4.replay_order
            : ['10D', '5D', '3D', '2D', '1D'];
          const activeInterLb = !isIntra && interV4?.available ? (interV4.lookbacks?.[volMoveLookback] || null) : null;
          const snap = !isIntra ? mv?.historical_snapshots?.[volMoveLookback === 'OFF' ? '1D' : volMoveLookback] : null;
          const isRealV4 = Boolean(activeCp || activeInterLb);
          const isReal1d = Boolean(!isIntra && !activeInterLb && volMoveLookback === '1D' && r1d?.available);

          const mSum = activeCp?.summary || activeInterLb?.summary || null;
          const totalAtmD = Number(mSum?.atm_delta_iv ?? (isReal1d ? r1d.atm_delta_iv : (snap?.iv_shift_pts ?? 0)));
          const pureAtmD = Number(mSum?.pure_vol_atm_delta ?? totalAtmD);
          const slideAtmD = Number(mSum?.spot_slide_atm_delta ?? 0);
          const putD = Number(mSum?.put_wing_delta_iv ?? (isReal1d ? r1d.put_wing_delta_iv : (snap ? +(Number(snap.iv_shift_pts || 0) + Number(snap.skew_shift_pts || 0) * 0.55).toFixed(2) : 0)));
          const callD = Number(mSum?.call_wing_delta_iv ?? (isReal1d ? r1d.call_wing_delta_iv : (snap ? +(Number(snap.iv_shift_pts || 0) - Number(snap.skew_shift_pts || 0) * 0.45).toFixed(2) : 0)));
          const twist = Number(mSum?.term_twist ?? (isReal1d ? r1d.term_twist : (snap?.slope_shift_pts ?? 0)));
          const spotChg = Number(mSum?.spot_chg_pct ?? (isReal1d ? r1d.spot_chg_1d_pct : (snap?.spot_shift_pct ?? 0)));
          const regimeBadge = mSum?.regime_badge || (isReal1d ? r1d.regime_headline : null);
          const regimeColor = mSum?.regime_color || (isReal1d ? r1d.regime_color : '#38bdf8');
          const takeawayTxt = mSum?.takeaway || (isReal1d ? r1d.actionable_takeaway : null);
          const topExp = activeCp?.top_expanding || activeInterLb?.top_expanding || (isReal1d ? (r1d.top_expanding || []) : []);
          const topCrush = activeCp?.top_crushing || activeInterLb?.top_crushing || (isReal1d ? (r1d.top_crushing || []) : []);

          const fmtSigned = (v) => `${Number(v) >= 0 ? '+' : ''}${Number(v).toFixed(2)}%`;

          // Build timeline points for the interactive SVG sparkline & scrubber
          const timelinePts = isIntra
            ? (intraM.trajectory_tape || cps.map((c, idx) => ({ idx, label_et: c.label_et, spot: c.spot, spot_chg_pct: c.spot_chg_from_open_pct, atm_iv_30d: c.atm_iv_30d, atm_delta_iv: c.summary?.atm_delta_iv ?? 0, pure_vol_atm_delta: c.summary?.pure_vol_atm_delta ?? 0 })))
            : (interV4?.available
              ? replayOrder.map((lbK, idx) => {
                  const lbObj = interV4.lookbacks?.[lbK];
                  return {
                    idx,
                    lbKey: lbK,
                    label_et: `${lbK} (${lbObj?.date?.slice(5) || ''})`,
                    spot: lbObj?.spot_then || spot,
                    spot_chg_pct: -(lbObj?.summary?.spot_chg_pct || 0),
                    atm_iv_30d: lbObj?.atm_iv_then || 22,
                    atm_delta_iv: lbObj?.summary?.atm_delta_iv || 0,
                    pure_vol_atm_delta: lbObj?.summary?.pure_vol_atm_delta || 0,
                  };
                })
              : []);

          const activeTimelineIdx = isIntra
            ? effCpIdx
            : Math.max(0, replayOrder.indexOf(volMoveLookback));

          // SVG dual-series path generator (normalized Spot vs ATM IV trajectory)
          const svgW = 340;
          const svgH = 44;
          const buildSvgPath = (vals) => {
            if (!vals || vals.length < 2) return { path: '', pts: [] };
            const minV = Math.min(...vals);
            const maxV = Math.max(...vals);
            const span = Math.max(0.05, maxV - minV);
            const coords = vals.map((v, i) => {
              const x = 6 + (i * (svgW - 12)) / (vals.length - 1);
              const y = svgH - 6 - ((v - minV) / span) * (svgH - 12);
              return [Number(x.toFixed(1)), Number(y.toFixed(1))];
            });
            const path = coords.map((pt, idx) => `${idx === 0 ? 'M' : 'L'}${pt[0]},${pt[1]}`).join(' ');
            return { path, pts: coords };
          };
          const ivCurveSvg = buildSvgPath(timelinePts.map(p => Number(p.atm_iv_30d || 20)));
          const spotCurveSvg = buildSvgPath(timelinePts.map(p => Number(p.spot || spot || 100)));
          const curSvgCoord = ivCurveSvg.pts[activeTimelineIdx] || null;

          return (
            <div
              data-testid="real-delta-iv-strip"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                padding: '10px 14px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.96), rgba(30, 41, 59, 0.90))',
                border: (isRealV4 || isReal1d) ? '1px solid rgba(16, 185, 129, 0.45)' : '1px solid rgba(251, 191, 36, 0.4)',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '11px'
              }}
            >
              {/* Row 1: Data Source Badge, Coordinate Frame Switcher & 3D Visual Style */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap' }}>
                  <span
                    data-testid="motion-source-badge"
                    style={{
                      padding: '3px 8px',
                      borderRadius: '5px',
                      background: (isRealV4 || isReal1d) ? 'rgba(16, 185, 129, 0.18)' : 'rgba(251, 191, 36, 0.16)',
                      color: (isRealV4 || isReal1d) ? '#34d399' : '#fbbf24',
                      border: (isRealV4 || isReal1d) ? '1px solid rgba(16, 185, 129, 0.45)' : '1px solid rgba(251, 191, 36, 0.45)',
                      fontWeight: 800
                    }}
                  >
                    {isIntra
                      ? `🟢 REAL INTRADAY 30M (${cps.length} checkpoints · ${intraM.session_date} · n=${activeCp?.matched_contracts ?? 0})`
                      : (activeInterLb
                        ? `🟢 REAL INTERDAY BARS (${activeInterLb.label} · n=${activeInterLb.matched_contracts})`
                        : (isReal1d ? `🟢 REAL PER-CONTRACT 1D ΔIV (${r1d.matched_nodes} live contracts)` : `📐 MODELED ${volMoveLookback} ΔIV SURFACE`))}
                  </span>
                  {regimeBadge && (
                    <span
                      style={{
                        padding: '3px 8px',
                        borderRadius: '5px',
                        background: 'rgba(15, 23, 42, 0.85)',
                        border: `1px solid ${regimeColor}`,
                        color: regimeColor,
                        fontWeight: 800
                      }}
                    >
                      {regimeBadge}
                    </span>
                  )}
                  <span style={{ color: spotChg >= 0 ? '#34d399' : '#f87171', fontWeight: 700 }}>
                    {isIntra
                      ? `Spot: $${intraM.open_spot} → $${activeCp?.spot?.toFixed(2)} (${fmtSigned(spotChg)})`
                      : `Spot vs ${volMoveLookback}: $${activeInterLb?.spot_then ?? snap?.spot ?? '--'} → $${spot?.toFixed?.(2) ?? spot} (${fmtSigned(spotChg)})`}
                  </span>
                </div>

                {/* Right Controls: Coordinate Frame + Visual Style + 2D Toggle */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  {isRealV4 && activeViewMode === '3d_surface' && (
                    <>
                      <div style={{ display: 'inline-flex', background: 'rgba(15, 23, 42, 0.85)', padding: '2px', borderRadius: '5px', border: '1px solid rgba(255,255,255,0.12)' }} title="Separate fixed-strike contract ΔIV into Pure Vol Repricing (Sticky-Δ) vs Mechanical Spot-Slide along the smile">
                        {[
                          { id: 'sticky_strike', label: 'Sticky-Strike' },
                          { id: 'sticky_delta', label: 'Pure Vol (Sticky-Δ)' },
                          { id: 'spot_slide', label: 'Spot-Slide' }
                        ].map(cf => (
                          <button
                            key={cf.id}
                            type="button"
                            onClick={() => setMotionCoordFrame(cf.id)}
                            style={{
                              padding: '2px 7px',
                              borderRadius: '4px',
                              border: 'none',
                              background: motionCoordFrame === cf.id ? 'rgba(0, 240, 255, 0.22)' : 'transparent',
                              color: motionCoordFrame === cf.id ? '#00F0FF' : '#94a3b8',
                              fontSize: '10px',
                              fontWeight: 800,
                              cursor: 'pointer'
                            }}
                          >
                            {cf.label}
                          </button>
                        ))}
                      </div>
                      <div style={{ display: 'inline-flex', background: 'rgba(15, 23, 42, 0.85)', padding: '2px', borderRadius: '5px', border: '1px solid rgba(255,255,255,0.12)' }}>
                        {[
                          { id: 'delta_relief', label: '⚡ ΔIV + Vectors' },
                          { id: 'before_after', label: '👻 Before → After' }
                        ].map(vs => (
                          <button
                            key={vs.id}
                            type="button"
                            onClick={() => setMotionVisualStyle(vs.id)}
                            style={{
                              padding: '2px 7px',
                              borderRadius: '4px',
                              border: 'none',
                              background: motionVisualStyle === vs.id ? 'rgba(251, 191, 36, 0.22)' : 'transparent',
                              color: motionVisualStyle === vs.id ? '#fbbf24' : '#94a3b8',
                              fontSize: '10px',
                              fontWeight: 800,
                              cursor: 'pointer'
                            }}
                          >
                            {vs.label}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                  <button
                    type="button"
                    data-testid="toggle-delta-iv-view"
                    onClick={() => setActiveViewMode(activeViewMode === '3d_surface' ? 'heatmap' : '3d_surface')}
                    style={{
                      padding: '3px 9px',
                      borderRadius: '5px',
                      border: '1px solid rgba(56, 189, 248, 0.55)',
                      background: 'rgba(56, 189, 248, 0.16)',
                      color: '#38bdf8',
                      fontWeight: 800,
                      fontSize: '10.5px',
                      cursor: 'pointer'
                    }}
                  >
                    {activeViewMode === '3d_surface' ? '📊 2D Matrix' : '🧊 3D Motion'}
                  </button>
                </div>
              </div>

              {/* Row 2: Interactive Time-Lapse Replay Deck + Synchronized Spot-vs-IV Trajectory Sparkline */}
              {timelinePts.length >= 2 && activeViewMode === '3d_surface' && (
                <div
                  data-testid="motion-replay-deck"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '10px',
                    padding: '7px 10px',
                    borderRadius: '8px',
                    background: 'rgba(2, 6, 23, 0.65)',
                    border: '1px solid rgba(56, 189, 248, 0.22)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 380px', minWidth: '280px' }}>
                    <button
                      type="button"
                      data-testid="motion-play-btn"
                      onClick={() => {
                        if (!isMotionPlaying && isIntra && effCpIdx >= cps.length - 1) {
                          setIntradayFrameIdx(0);
                        }
                        setIsMotionPlaying(prev => !prev);
                      }}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        border: isMotionPlaying ? '1px solid rgba(251, 191, 36, 0.7)' : '1px solid rgba(56, 189, 248, 0.6)',
                        background: isMotionPlaying ? 'rgba(251, 191, 36, 0.2)' : 'rgba(56, 189, 248, 0.16)',
                        color: isMotionPlaying ? '#fbbf24' : '#38bdf8',
                        fontWeight: 900,
                        fontSize: '10.5px',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {isMotionPlaying ? '⏸ Pause' : (isIntra ? '▶ Play Session' : '▶ Play 10D→1D')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setMotionPlaySpeed(s => (s === 900 ? 480 : 900))}
                      style={{
                        padding: '3px 6px',
                        borderRadius: '5px',
                        border: '1px solid rgba(255,255,255,0.14)',
                        background: 'rgba(255,255,255,0.04)',
                        color: '#94a3b8',
                        fontSize: '10px',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                      title="Toggle replay speed (1x / 2x)"
                    >
                      {motionPlaySpeed === 900 ? '1x' : '2x'}
                    </button>
                    <input
                      type="range"
                      data-testid="motion-scrubber"
                      min={0}
                      max={timelinePts.length - 1}
                      value={activeTimelineIdx}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setIsMotionPlaying(false);
                        if (isIntra) {
                          setIntradayFrameIdx(val);
                        } else if (replayOrder[val]) {
                          setVolMoveLookback(replayOrder[val]);
                        }
                      }}
                      style={{ flex: 1, accentColor: '#00F0FF', cursor: 'pointer', minWidth: '120px' }}
                    />
                    <span
                      data-testid="motion-frame-label"
                      style={{
                        padding: '2px 8px',
                        borderRadius: '5px',
                        background: 'rgba(0, 240, 255, 0.14)',
                        border: '1px solid rgba(0, 240, 255, 0.4)',
                        color: '#00F0FF',
                        fontWeight: 900,
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {isIntra ? `${activeCp?.label_et} (${effCpIdx + 1}/${cps.length})` : `${volMoveLookback} Ago (${activeInterLb?.date || ''})`}
                    </span>
                  </div>

                  {/* Synchronized Clickable Dual-Line SVG Sparkline (Cyan Dashed = Spot Path, Amber = 30D ATM IV) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', fontSize: '9.5px', color: '#94a3b8', lineHeight: 1.25 }}>
                      <span><span style={{ color: '#fbbf24' }}>━</span> ATM IV: <b style={{ color: '#f8fafc' }}>{timelinePts[activeTimelineIdx]?.atm_iv_30d?.toFixed?.(1) ?? '--'}%</b></span>
                      <span><span style={{ color: '#00F0FF' }}>╌</span> Spot: <b style={{ color: '#f8fafc' }}>${timelinePts[activeTimelineIdx]?.spot?.toFixed?.(2) ?? '--'}</b></span>
                    </div>
                    <svg
                      width={svgW}
                      height={svgH}
                      viewBox={`0 0 ${svgW} ${svgH}`}
                      style={{ background: 'rgba(15, 23, 42, 0.9)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer', overflow: 'visible' }}
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const relX = Math.max(0, Math.min(1, (e.clientX - rect.left) / Math.max(1, rect.width)));
                        const pickIdx = Math.round(relX * (timelinePts.length - 1));
                        setIsMotionPlaying(false);
                        if (isIntra) {
                          setIntradayFrameIdx(pickIdx);
                        } else if (replayOrder[pickIdx]) {
                          setVolMoveLookback(replayOrder[pickIdx]);
                        }
                      }}
                      title="Click anywhere along the session trajectory to jump to that timestamp"
                    >
                      {spotCurveSvg.path && (
                        <path d={spotCurveSvg.path} fill="none" stroke="#00F0FF" strokeWidth="1.5" strokeDasharray="3,2.5" opacity="0.72" />
                      )}
                      {ivCurveSvg.path && (
                        <path d={ivCurveSvg.path} fill="none" stroke="#fbbf24" strokeWidth="2.2" />
                      )}
                      {curSvgCoord && (
                        <>
                          <line x1={curSvgCoord[0]} y1={2} x2={curSvgCoord[0]} y2={svgH - 2} stroke="#00F0FF" strokeWidth="1.4" opacity="0.8" />
                          <circle cx={curSvgCoord[0]} cy={curSvgCoord[1]} r="4" fill="#fbbf24" stroke="#ffffff" strokeWidth="1.4" />
                        </>
                      )}
                    </svg>
                  </div>
                </div>
              )}

              {/* Row 3: Exact Sticky-Strike = Pure Vol (Sticky-Δ) + Spot-Slide Decomposition KPIs */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <span style={{ padding: '2px 7px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', color: '#f8fafc' }} title="Total Fixed-Strike ATM ΔIV = Pure Vol Repricing + Spot-Slide">
                    ATM ΔIV: <b style={{ color: totalAtmD >= 0 ? '#fbbf24' : '#34d399' }}>{fmtSigned(totalAtmD)}</b>
                    {isRealV4 && (
                      <span style={{ color: '#94a3b8' }}> = Pure <b style={{ color: pureAtmD >= 0 ? '#f87171' : '#34d399' }}>{fmtSigned(pureAtmD)}</b> + Slide <b style={{ color: '#7dd3fc' }}>{fmtSigned(slideAtmD)}</b></span>
                    )}
                  </span>
                  <span style={{ padding: '2px 7px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', color: '#e2e8f0' }}>
                    Put Wing: <b style={{ color: putD >= 0 ? '#f87171' : '#34d399' }}>{fmtSigned(putD)}</b>
                  </span>
                  <span style={{ padding: '2px 7px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', color: '#e2e8f0' }}>
                    Call Wing: <b style={{ color: callD >= 0 ? '#f87171' : '#34d399' }}>{fmtSigned(callD)}</b>
                  </span>
                  <span style={{ padding: '2px 7px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', color: '#e2e8f0' }}>
                    Front−Back Twist: <b style={{ color: '#7dd3fc' }}>{fmtSigned(twist)}</b>
                  </span>
                  {isIntra && (
                    <>
                      <span style={{ padding: '2px 7px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', color: '#cbd5e1' }}>
                        Session Range: <b style={{ color: '#fbbf24' }}>{intraM.intraday_vol_range_vp?.toFixed(2)}vp</b> ({intraM.low_atm_iv?.toFixed(1)}%→{intraM.high_atm_iv?.toFixed(1)}%)
                      </span>
                      <span style={{ padding: '2px 7px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', color: '#cbd5e1' }}>
                        1h Vel: <b style={{ color: intraM.intraday_velocity_1h_vp >= 0 ? '#f87171' : '#34d399' }}>{fmtSigned(intraM.intraday_velocity_1h_vp)}</b>
                      </span>
                    </>
                  )}
                </div>
              </div>

              {(takeawayTxt || topExp.length > 0 || topCrush.length > 0) && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', paddingTop: '4px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                  <span style={{ color: '#cbd5e1', fontSize: '10.5px', maxWidth: '680px', lineHeight: 1.35 }}>
                    {takeawayTxt || 'Active surface movement decomposed across Put Wing, ATM, Call Wing, and Front-to-Back Term Slope.'}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                    {topExp.slice(0, 3).map((item, idx) => {
                      const isLocked = focusedHotspot?.strike === item.strike && focusedHotspot?.expiry === item.expiry;
                      return (
                        <button
                          key={`exp-${idx}`}
                          type="button"
                          onClick={() => setFocusedHotspot(isLocked ? null : { expiry: item.expiry, strike: item.strike, iv: item.iv_now })}
                          style={{
                            padding: '2px 7px',
                            borderRadius: '4px',
                            border: isLocked ? '1px solid #00F0FF' : '1px solid rgba(239, 68, 68, 0.5)',
                            background: isLocked ? 'rgba(0, 240, 255, 0.18)' : 'rgba(239, 68, 68, 0.14)',
                            color: '#fda4af',
                            fontSize: '10px',
                            fontWeight: 800,
                            cursor: 'pointer'
                          }}
                          title={`Lock target on ${item.expiry} $${item.strike} ${item.type} (Base IV ${item.iv_prev}% → ${item.iv_now}%)`}
                        >
                          🔥 ${item.strike} {item.expiry.slice(5)} ({item.delta_iv >= 0 ? '+' : ''}{Number(item.delta_iv).toFixed(1)}%)
                        </button>
                      );
                    })}
                    {topCrush.slice(0, 3).map((item, idx) => {
                      const isLocked = focusedHotspot?.strike === item.strike && focusedHotspot?.expiry === item.expiry;
                      return (
                        <button
                          key={`cr-${idx}`}
                          type="button"
                          onClick={() => setFocusedHotspot(isLocked ? null : { expiry: item.expiry, strike: item.strike, iv: item.iv_now })}
                          style={{
                            padding: '2px 7px',
                            borderRadius: '4px',
                            border: isLocked ? '1px solid #00F0FF' : '1px solid rgba(16, 185, 129, 0.5)',
                            background: isLocked ? 'rgba(0, 240, 255, 0.18)' : 'rgba(16, 185, 129, 0.14)',
                            color: '#6ee7b7',
                            fontSize: '10px',
                            fontWeight: 800,
                            cursor: 'pointer'
                          }}
                          title={`Lock target on ${item.expiry} $${item.strike} ${item.type} (Base IV ${item.iv_prev}% → ${item.iv_now}%)`}
                        >
                          🧊 ${item.strike} {item.expiry.slice(5)} ({item.delta_iv >= 0 ? '+' : ''}{Number(item.delta_iv).toFixed(1)}%)
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* Non-Overlapping Spot-Vol Regime Status Ribbon (when Spot-Vol Scatter is active) */}
        {activeViewMode === 'spot_vol_scatter' && (() => {
          const svc = Number(desk_metrics?.spot_vol_corr ?? -0.55);
          const svColor = svc >= 0.15 ? '#10b981' : (svc <= -0.15 ? '#38bdf8' : '#fbbf24');
          const svLabel = svc >= 0.15
            ? 'POSITIVE SPOT-VOL REGIME (Call Squeeze Heavy)'
            : (svc <= -0.15 ? 'CLASSIC EQUITY HEDGING REGIME (Inverse Correlation)' : 'DECOUPLED / SKEW BREAKDOWN REGIME');
          return (
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '8px',
              padding: '8px 12px',
              borderRadius: '9px',
              background: 'rgba(15, 23, 42, 0.9)',
              border: `1px solid ${svColor}55`,
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '11px'
            }}>
              <span style={{ color: '#ffffff', fontWeight: 800 }}>
                📊 Spot-Vol Correlation · {ticker} (ρ = {svc > 0 ? `+${svc.toFixed(2)}` : svc.toFixed(2)})
              </span>
              <span style={{ color: svColor, fontWeight: 800 }}>
                {svLabel}
              </span>
            </div>
          );
        })()}

        {/* Multi-Day Vol Movement Banner (Heatmap Studio renders its own synchronized header) */}

        {activeViewMode === 'vol_movement' && (
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '8px',
            padding: '7px 12px',
            borderRadius: '8px',
            background: 'rgba(15, 23, 42, 0.85)',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '11px',
            color: '#e2e8f0'
          }}>
            <span style={{ fontWeight: 800 }}>
              {multiDayChartSubmode === 'daily_iv_skew'
                ? `Last 10 Days Volatility Trajectory · 30D ATM IV vs 10D Realized HV & 25Δ Skew (${ticker})`
                : `Multi-Day Term Structure Evolution · Today vs 1D, 3D, 5D & 10D Ago (${ticker})`}
            </span>
            <span style={{ color: '#94a3b8', fontSize: '10px' }}>Dual-Axis Curve + ΔIV Bars</span>
          </div>
        )}

        {activeViewMode === 'heatmap' ? (
          <VolHeatmapStudio
            data={data}
            activeData={horizonData || data}
            ticker={ticker}
            spot={spot}
            surfaceColor={surfaceColor}
            setSurfaceColor={setSurfaceColor}
            surfaceBg={surfaceBg}
            strikeMode={strikeMode}
            setStrikeMode={setStrikeMode}
            heatmapFilter={heatmapFilter}
            setHeatmapFilter={setHeatmapFilter}
            volMoveLookback={volMoveLookback}
            setVolMoveLookback={setVolMoveLookback}
            interdayShiftMode={interdayShiftMode}
            setInterdayShiftMode={setInterdayShiftMode}
            focusedHotspot={focusedHotspot}
            setFocusedHotspot={setFocusedHotspot}
            detectedAirPockets={detectedAirPockets}
            plotlyReady={plotlyReady}
            onSwitchTo3DFocus={(cell) => {
              if (cell) {
                setFocusedHotspot({ strike: cell.strike, expiry: cell.expiry, iv: cell.iv });
              }
              setActiveViewMode('3d_surface');
            }}
            onRegisterExport={(fn) => {
              heatmapExportRef.current = fn;
            }}
          />
        ) : (
          /* Plotly Canvas Container (Unique key + userSelect none prevents SVG IndexSizeError) */
          <div 
            key={`vol-canvas-${activeViewMode}`}
            className="vol-canvas-container"
            style={{
              width: '100%',
              minHeight: activeViewMode === '3d_surface' ? '568px' : '532px',
              background: surfaceBg,
              borderRadius: '12px',
              border: `1px solid ${surfaceBg === '#f8fafc' ? 'rgba(0,0,0,0.15)' : 'rgba(255, 255, 255, 0.08)'}`,
              overflow: 'hidden',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              padding: '6px',
              userSelect: 'none',
              transition: 'background 0.3s ease'
            }}
          >
            <div ref={plotRef} style={{ width: '100%', minHeight: activeViewMode === '3d_surface' ? '556px' : (activeViewMode === '2d_skew' ? '555px' : '520px') }} />
          </div>
        )}

        {/* Arb-Free SVI Fair Fit Live Playbook Deck (2D Skew Curve) */}
        {activeViewMode === '2d_skew' && (() => {
          const tsList = activeData.term_structure || [];
          const bench30 = tsList.length > 0
            ? tsList.reduce((p, c) => Math.abs((c.dte || 30) - 30) < Math.abs((p.dte || 30) - 30) ? c : p, tsList[0])
            : null;
          const activeExp = (selectedExpiry === 'All' || !availableExpirations.includes(selectedExpiry))
            ? (bench30?.expiry || availableExpirations[0])
            : selectedExpiry;
          const activeTs = tsList.find(t => t.expiry === activeExp) || bench30 || {};
          const activeSvi = (activeData.svi_slices || []).find(s => s.expiry === activeExp) || null;
          const hvVal = Number(desk_metrics?.realized_hv_30d || 20);
          const atmVal = Number(activeTs.atm_iv || desk_metrics?.atm_iv_30d || hvVal);
          const vrpVal = +(atmVal - hvVal).toFixed(1);
          const skewVal = Number(activeTs.skew_25d ?? desk_metrics?.skew_spread ?? 0);

          const expPts = (activeData.surface || [])
            .filter(p => p.expiry === activeExp && (!spot || Math.abs(p.strike - spot) / spot <= 0.16));
          const getScore = (p) => Number(p.residual_vp ?? p.dislocation_pct ?? 0);
          const richPool = expPts.filter(p => p.hedge_state === 'overhedged' || getScore(p) >= 0.45);
          const cheapPool = expPts.filter(p => p.hedge_state === 'underhedged' || getScore(p) <= -0.45);
          const topRich = (richPool.filter(p => p.hedge_state === 'overhedged').length ? richPool.filter(p => p.hedge_state === 'overhedged') : richPool)
            .sort((a, b) => getScore(b) - getScore(a))[0] || null;
          const topCheap = (cheapPool.filter(p => p.hedge_state === 'underhedged').length ? cheapPool.filter(p => p.hedge_state === 'underhedged') : cheapPool)
            .sort((a, b) => getScore(a) - getScore(b))[0] || null;

          return (
            <div
              data-testid="svi-fair-fit-deck"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                gap: '10px',
                marginTop: '4px'
              }}
            >
              <div
                data-testid="svi-card-what"
                style={{
                  background: 'rgba(10, 15, 28, 0.92)',
                  border: '1px solid rgba(251, 191, 36, 0.35)',
                  borderLeft: '3px solid #fbbf24',
                  borderRadius: '10px',
                  padding: '10px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <strong style={{ color: '#fbbf24', fontSize: '11.5px', fontFamily: "'JetBrains Mono', monospace" }}>
                    🟡 What Is Arb-Free SVI Fair Fit?
                  </strong>
                  <span style={{ fontSize: '9.5px', color: '#fde68a', fontFamily: "'JetBrains Mono', monospace", background: 'rgba(251,191,36,0.12)', padding: '2px 6px', borderRadius: '4px' }}>
                    {activeExp} · RMSE {activeData.calibration_metrics?.holdout_rmse_vp ?? '--'}v
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '11px', color: '#cbd5e1', lineHeight: 1.45 }}>
                  The gold curve is Gatheral&apos;s 5-parameter <strong>Stochastic Volatility Inspired (SVI)</strong> theoretical fair IV smile — stripping bid-ask quote noise and enforcing butterfly &amp; calendar no-arbitrage bounds across strikes.
                </p>
                {activeSvi && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', fontSize: '10px', fontFamily: "'JetBrains Mono', monospace", color: '#94a3b8' }}>
                    <span>a <b>{activeSvi.svi_a}</b></span>
                    <span>b <b>{activeSvi.svi_b}</b></span>
                    <span>ρ <b style={{ color: '#f43f5e' }}>{activeSvi.svi_rho}</b></span>
                    <span>m <b>{activeSvi.svi_m}</b></span>
                    <span>σ <b>{activeSvi.svi_sigma}</b></span>
                    <span>Fwd <b>${activeSvi.forward}</b></span>
                  </div>
                )}
              </div>

              <div
                data-testid="svi-card-howto"
                style={{
                  background: 'rgba(10, 15, 28, 0.92)',
                  border: '1px solid rgba(0, 240, 255, 0.28)',
                  borderLeft: '3px solid #00F0FF',
                  borderRadius: '10px',
                  padding: '10px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <strong style={{ color: '#00F0FF', fontSize: '11.5px', fontFamily: "'JetBrains Mono', monospace" }}>
                    🎯 How to Trade Dots vs. Gold SVI Curve
                  </strong>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px', color: '#cbd5e1', lineHeight: 1.4 }}>
                  <span><strong style={{ color: '#fda4af' }}>🔴 Dot ABOVE Gold:</strong> Implied Vol is rich / overhedged → <strong>SELL</strong> option premium (Credit Spreads / Short Wings).</span>
                  <span><strong style={{ color: '#6ee7b7' }}>🟢 Dot BELOW Gold:</strong> Implied Vol is cheap / underhedged → <strong>BUY</strong> option convexity (Debit Spreads / Long Wings).</span>
                  <span><strong style={{ color: '#7dd3fc' }}>⚖️ Pair Both:</strong> Buy Cheap (−SVI) strike + Sell Rich (+SVI) strike on the same expiry to capture pure smile mispricing.</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '2px', fontSize: '10px', fontFamily: "'JetBrains Mono', monospace" }}>
                  {topRich && (
                    <span style={{ padding: '2px 7px', borderRadius: '4px', background: 'rgba(239,68,68,0.14)', border: '1px solid rgba(239,68,68,0.38)', color: '#fda4af' }}>
                      SELL ${topRich.strike} (+{Math.abs(getScore(topRich)).toFixed(1)}v vs SVI)
                    </span>
                  )}
                  {topCheap && (
                    <span style={{ padding: '2px 7px', borderRadius: '4px', background: 'rgba(16,185,129,0.14)', border: '1px solid rgba(16,185,129,0.38)', color: '#6ee7b7' }}>
                      BUY ${topCheap.strike} (-{Math.abs(getScore(topCheap)).toFixed(1)}v vs SVI)
                    </span>
                  )}
                </div>
              </div>

              <div
                data-testid="svi-card-vrp"
                style={{
                  background: 'rgba(10, 15, 28, 0.92)',
                  border: `1px solid ${vrpVal >= 1.5 ? 'rgba(244,63,94,0.35)' : (vrpVal <= -1.5 ? 'rgba(16,185,129,0.35)' : 'rgba(56,189,248,0.35)')}`,
                  borderLeft: `3px solid ${vrpVal >= 1.5 ? '#f43f5e' : (vrpVal <= -1.5 ? '#10b981' : '#38bdf8')}`,
                  borderRadius: '10px',
                  padding: '10px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <strong style={{ color: '#38bdf8', fontSize: '11.5px', fontFamily: "'JetBrains Mono', monospace" }}>
                    📊 Live VRP &amp; Skew Trade Posture
                  </strong>
                  <span style={{ fontSize: '9.5px', fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color: vrpVal >= 0 ? '#fda4af' : '#6ee7b7', background: 'rgba(15,23,42,0.85)', padding: '2px 6px', borderRadius: '4px' }}>
                    VRP {vrpVal >= 0 ? `+${vrpVal}v` : `${vrpVal}v`}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '11px', color: '#cbd5e1', lineHeight: 1.45 }}>
                  SVI ATM IV (<strong>{atmVal.toFixed(1)}%</strong>) vs. 30D Realized HV Floor (<strong>{hvVal.toFixed(1)}%</strong>){' '}
                  {vrpVal >= 1.5
                    ? `shows rich Variance Risk Premium (+${vrpVal}v): favor selling high-skew OTM spreads above SVI fair.`
                    : (vrpVal <= -1.5
                      ? `is trading below realized movement (${vrpVal}v): favor buying cheap under-SVI debit spreads or straddles.`
                      : `is near fair equilibrium vs realized vol: focus on relative-value strike selection against the Gold SVI curve.`)}
                </p>
                <div style={{ fontSize: '10px', fontFamily: "'JetBrains Mono', monospace", color: '#94a3b8' }}>
                  25Δ Put−Call Skew: <strong style={{ color: skewVal >= 5 ? '#f43f5e' : '#00F0FF' }}>{skewVal >= 0 ? `+${skewVal}%` : `${skewVal}%`}</strong>
                  {skewVal >= 5 ? ' (Steep downside put demand)' : (skewVal <= 1 ? ' (Flat / call wing bid)' : ' (Normal equity skew)')}
                </div>
              </div>
            </div>
          );
        })()}

        {/* Studio Micro-Legend Strip below Canvas (replaces WebGL top-left legend box that overlapped peaks) */}
        {activeViewMode === '3d_surface' && (
          <div className="vol-canvas-micro-legend">
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <span><span style={{ color: '#fbbf24' }}>━●━</span> {interdayShiftMode ? (motionVisualStyle === 'before_after' ? 'ATM Spot Spine' : 'ATM ΔIV Spine') : 'ATM SVI Ridge Spine'}</span>
              {interdayShiftMode ? (
                <>
                  <span><span style={{ color: '#ef4444' }}>▲</span> Rising IV Vector</span>
                  <span><span style={{ color: '#10b981' }}>▼</span> Crushing IV Vector</span>
                  <span><span style={{ color: '#94a3b8' }}>▭</span> {motionVisualStyle === 'before_after' ? 'Baseline Ghost Mesh' : '0.0% Zero-Shift Plane'}</span>
                </>
              ) : (
                <>
                  <span><span style={{ color: '#ef4444' }}>◆</span> Overhedged Rich (+SVI)</span>
                  <span><span style={{ color: '#10b981' }}>◆</span> Underhedged Cheap (-SVI)</span>
                  <span><span style={{ color: '#ff007a' }}>━━</span> Event Kink</span>
                  <span><span style={{ color: '#00f0ff' }}>━━</span> Vol Valley</span>
                  {showHvPlane && <span><span style={{ color: '#38bdf8' }}>▭</span> 30D Yang-Zhang HV Floor ({desk_metrics?.realized_hv_30d}%)</span>}
                </>
              )}
              {surfaceColor === 'LocalVol' && !interdayShiftMode && (
                <span style={{ color: '#fbbf24', fontWeight: 700 }}>🔥 Shaded by Dupire Local Vol σ_loc(K,T)</span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#64748b' }}>
              {focusedHotspot && <span style={{ color: '#00F0FF', fontWeight: 700 }}>✚ Target: ${focusedHotspot.strike} ({focusedHotspot.expiry})</span>}
              <span>Drag orbit · Scroll zoom</span>
            </div>
          </div>
        )}

        {/* MULTI-DAY VOLATILITY MOVEMENT SCORECARD & LAST-10-SESSIONS TAPE DECK */}
        {(activeViewMode === 'vol_movement' || (activeViewMode === '3d_surface' && volMoveLookback !== 'OFF')) && data?.multi_day_vol_movement && (() => {
          const mv = data.multi_day_vol_movement;
          const mvSum = mv.summary || {};
          const snaps = mv.historical_snapshots || {};
          const rawTape = mv.daily_tape || [];
          const tape = (rawTape.length >= 2 && (rawTape[0].days_ago ?? 0) > (rawTape[rawTape.length - 1].days_ago ?? 0))
            ? rawTape.slice().reverse()
            : rawTape; // Ensure newest session is always first

          return (
            <div
              style={{
                background: 'rgba(15, 23, 42, 0.92)',
                border: `1px solid ${mvSum.momentum_color || '#38bdf8'}`,
                borderRadius: '12px',
                padding: '16px 18px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
                marginTop: '12px'
              }}
            >
              {/* Header & Desk Takeaway */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: '#ffffff', fontFamily: "'JetBrains Mono', monospace" }}>
                      📅 HOW {ticker} VOLATILITY IS MOVING (LAST FEW DAYS)
                    </span>
                    <span
                      style={{
                        padding: '2px 9px',
                        borderRadius: '999px',
                        background: 'rgba(15, 23, 42, 0.85)',
                        border: `1px solid ${mvSum.momentum_color || '#38bdf8'}`,
                        color: mvSum.momentum_color || '#38bdf8',
                        fontSize: '11px',
                        fontWeight: 800,
                        fontFamily: "'JetBrains Mono', monospace"
                      }}
                    >
                      {mvSum.momentum_regime || '⚖️ Vol Stable'}
                    </span>
                  </div>
                  <span style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: 1.45 }}>
                    {mvSum.momentum_takeaway}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  {activeViewMode === '3d_surface' ? (
                    <button
                      type="button"
                      onClick={() => setActiveViewMode('vol_movement')}
                      style={{
                        padding: '5px 10px',
                        borderRadius: '6px',
                        border: '1px solid rgba(56, 189, 248, 0.45)',
                        background: 'rgba(56, 189, 248, 0.16)',
                        color: '#38bdf8',
                        fontSize: '11px',
                        fontWeight: 800,
                        cursor: 'pointer',
                        fontFamily: "'JetBrains Mono', monospace"
                      }}
                    >
                      📈 Open Full Multi-Day Vol Charts
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        if (volMoveLookback === 'OFF') setVolMoveLookback('3D');
                        setActiveViewMode('3d_surface');
                      }}
                      style={{
                        padding: '5px 10px',
                        borderRadius: '6px',
                        border: '1px solid rgba(0, 240, 255, 0.45)',
                        background: 'rgba(0, 240, 255, 0.14)',
                        color: '#00F0FF',
                        fontSize: '11px',
                        fontWeight: 800,
                        cursor: 'pointer',
                        fontFamily: "'JetBrains Mono', monospace"
                      }}
                    >
                      👻 View 3D Ghost Surface Overlay
                    </button>
                  )}
                </div>
              </div>

              {/* 4 Lookback Snapshot Cards (1D / 3D / 5D / 10D Ago vs Today) */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '10px' }}>
                {['1D', '3D', '5D', '10D'].map(lb => {
                  const s = snaps[lb];
                  if (!s) return null;
                  const ivChg = Number(s.iv_shift_pts ?? s.iv_change ?? 0);
                  const skewChg = Number(s.skew_shift_pts ?? s.skew_change ?? 0);
                  const spotChg = Number(s.spot_shift_pct ?? s.spot_change_pct ?? 0);
                  const pastAtmIv = Number(s.atm_iv_30d ?? s.atm_iv ?? 0);
                  const isUp = ivChg > 0;
                  const isSelected = volMoveLookback === lb;
                  return (
                    <div
                      key={lb}
                      onClick={() => setVolMoveLookback(lb)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '9px',
                        background: isSelected ? 'rgba(56, 189, 248, 0.12)' : 'rgba(30, 41, 59, 0.65)',
                        border: isSelected ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.08)',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '5px',
                        fontFamily: "'JetBrains Mono', monospace"
                      }}
                      title={`Click to set ${lb} Ago as the active reference overlay`}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', fontWeight: 800, color: isSelected ? '#38bdf8' : '#94a3b8' }}>
                          {s.label}
                        </span>
                        <span
                          style={{
                            fontSize: '11.5px',
                            fontWeight: 800,
                            padding: '1px 6px',
                            borderRadius: '4px',
                            background: ivChg >= 0.5 ? 'rgba(244,63,94,0.18)' : (ivChg <= -0.5 ? 'rgba(16,185,129,0.18)' : 'rgba(148,163,184,0.15)'),
                            color: ivChg >= 0.5 ? '#fda4af' : (ivChg <= -0.5 ? '#6ee7b7' : '#e2e8f0')
                          }}
                        >
                          {isUp ? `+${ivChg.toFixed(2)}%` : `${ivChg.toFixed(2)}%`} IV
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#e2e8f0' }}>
                        <span>Past ATM IV: <strong>{pastAtmIv.toFixed(1)}%</strong></span>
                        <span>Now: <strong>{Number(mvSum.atm_iv_current || 0).toFixed(1)}%</strong></span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#94a3b8' }}>
                        <span>Spot vs {lb}: <strong style={{ color: spotChg >= 0 ? '#34d399' : '#f87171' }}>{spotChg >= 0 ? `+${spotChg.toFixed(2)}%` : `${spotChg.toFixed(2)}%`}</strong></span>
                        <span>25Δ Skew Δ: <strong style={{ color: skewChg >= 0 ? '#fbbf24' : '#38bdf8' }}>{skewChg >= 0 ? `+${skewChg.toFixed(2)}%` : `${skewChg.toFixed(2)}%`}</strong></span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Last 10 Trading Sessions Volatility Tape Table — Compact Zero-Overflow Layout */}
              {tape.length > 0 && (
                <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: "'JetBrains Mono', monospace", fontSize: '10px' }}>
                    <thead>
                      <tr style={{ background: 'rgba(15, 23, 42, 0.95)', color: '#94a3b8', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                        <th style={{ padding: '6px 5px', whiteSpace: 'nowrap' }}>Date</th>
                        <th style={{ padding: '6px 5px', whiteSpace: 'nowrap' }}>Spot</th>
                        <th style={{ padding: '6px 5px', whiteSpace: 'nowrap' }}>1D%</th>
                        <th style={{ padding: '6px 5px', whiteSpace: 'nowrap' }}>30D IV</th>
                        <th style={{ padding: '6px 5px', whiteSpace: 'nowrap' }}>1D Δ</th>
                        <th style={{ padding: '6px 5px', whiteSpace: 'nowrap' }}>To Now</th>
                        <th style={{ padding: '6px 5px', whiteSpace: 'nowrap' }}>10D HV</th>
                        <th style={{ padding: '6px 5px', whiteSpace: 'nowrap' }}>25Δ Sk</th>
                        <th style={{ padding: '6px 5px', whiteSpace: 'nowrap' }}>Regime</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tape.map((row, idx) => {
                        const dIv = Number(row.iv_chg_1d || 0);
                        const sChg = Number(row.spot_chg_1d_pct || 0);
                        const shiftNow = Number(row.iv_shift_to_today || 0);
                        const rawBadge = String(row.regime_badge || '⚖️ Stable');
                        const compactBadge = rawBadge
                          .replace('Stable Variance', 'Stable')
                          .replace('Vol Expansion', 'Vol Bid')
                          .replace('Vol Crush', 'Crush')
                          .replace('Call Squeeze Bid', 'Call Bid')
                          .replace('Put Hedge Bid', 'Put Bid');
                        return (
                          <tr
                            key={row.date || idx}
                            style={{
                              borderBottom: '1px solid rgba(255,255,255,0.05)',
                              background: idx === 0 ? 'rgba(0, 240, 255, 0.06)' : (idx % 2 === 0 ? 'rgba(30, 41, 59, 0.35)' : 'transparent')
                            }}
                          >
                            <td style={{ padding: '5px 5px', whiteSpace: 'nowrap', fontWeight: idx === 0 ? 800 : 600, color: idx === 0 ? '#00F0FF' : '#e2e8f0' }}>
                              {String(row.date || '').slice(5)}{idx === 0 ? ' ★' : ''}
                            </td>
                            <td style={{ padding: '5px 5px', whiteSpace: 'nowrap', color: '#f8fafc' }}>
                              ${Number(row.spot || 0).toFixed(2)}
                            </td>
                            <td style={{ padding: '5px 5px', whiteSpace: 'nowrap', color: sChg >= 0 ? '#34d399' : '#f87171', fontWeight: 700 }}>
                              {sChg >= 0 ? `+${sChg.toFixed(2)}%` : `${sChg.toFixed(2)}%`}
                            </td>
                            <td style={{ padding: '5px 5px', whiteSpace: 'nowrap', color: '#38bdf8', fontWeight: 800 }}>
                              {Number(row.atm_iv_30d || 0).toFixed(1)}%
                            </td>
                            <td style={{ padding: '5px 5px', whiteSpace: 'nowrap', color: dIv > 0 ? '#fda4af' : (dIv < 0 ? '#6ee7b7' : '#94a3b8'), fontWeight: 700 }}>
                              {dIv > 0 ? `+${dIv.toFixed(1)}%` : `${dIv.toFixed(1)}%`}
                            </td>
                            <td style={{ padding: '5px 5px', whiteSpace: 'nowrap', color: shiftNow > 0 ? '#fda4af' : (shiftNow < 0 ? '#6ee7b7' : '#94a3b8') }}>
                              {idx === 0 ? '—' : (shiftNow > 0 ? `+${shiftNow.toFixed(1)}%` : `${shiftNow.toFixed(1)}%`)}
                            </td>
                            <td style={{ padding: '5px 5px', whiteSpace: 'nowrap', color: '#cbd5e1' }}>
                              {Number(row.hv_10d || 0).toFixed(1)}%
                            </td>
                            <td style={{ padding: '5px 5px', whiteSpace: 'nowrap', color: '#fbbf24' }}>
                              {Number(row.skew_25d || 0) >= 0 ? `+${Number(row.skew_25d || 0).toFixed(1)}%` : `${Number(row.skew_25d || 0).toFixed(1)}%`}
                            </td>
                            <td style={{ padding: '5px 5px', whiteSpace: 'nowrap' }}>
                              <span
                                title={rawBadge}
                                style={{
                                  display: 'inline-block',
                                  whiteSpace: 'nowrap',
                                  padding: '2px 5px',
                                  borderRadius: '4px',
                                  background: 'rgba(15, 23, 42, 0.75)',
                                  border: `1px solid ${row.regime_color || '#64748b'}`,
                                  color: row.regime_color || '#cbd5e1',
                                  fontSize: '9.5px',
                                  fontWeight: 700
                                }}
                              >
                                {compactBadge}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })()}

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
                        if (spot && Math.abs(pocket.strike - spot) / spot > 0.14) {
                          setHeatmapFilter('all');
                        }
                        setActiveViewMode('heatmap');
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
      {/* 2. SECOND: INSTITUTIONAL OVERHEDGE / UNDERHEDGE RADAR & PLAYBOOK       */}
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
                  <div
                    key={idx}
                    className="target-micro-card"
                    onClick={() => {
                      setActiveViewMode('3d_surface');
                      setFocusedHotspot({ expiry: item.expiry, strike: item.strike, iv: item.iv });
                      if (surfaceCardRef.current) surfaceCardRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                    title="Click to lock & inspect this Overhedged Peak in the 3D Surface"
                  >
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
                  <div
                    key={idx}
                    className="target-micro-card"
                    onClick={() => {
                      setActiveViewMode('3d_surface');
                      setFocusedHotspot({ expiry: item.expiry, strike: item.strike, iv: item.iv });
                      if (surfaceCardRef.current) surfaceCardRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                    title="Click to lock & inspect this Underhedged Valley in the 3D Surface"
                  >
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
      {/* 3. THIRD: QUANT AI VOLATILITY INTELLIGENCE · SURFACE SYNTHESIS         */}
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
      {/* 4. FOURTH: ACTIONABLE VOLATILITY TRADE SETUPS MATRIX TABLE             */}
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

              {/* Actionable Setups Institutional Table — Zero-Overflow Responsive Layout */}
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
                <table className="vol-matrix-table" style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: 0, textAlign: 'left' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'center', width: '14%' }}>Action</th>
                      <th style={{ width: '21%' }}>Strategy & Structure</th>
                      <th style={{ width: '18%' }}>Tenor & Strikes</th>
                      <th style={{ width: '25%' }}>B76 Greeks & Edge</th>
                      <th style={{ textAlign: 'center', width: '11%' }}>PoP / R:R</th>
                      <th style={{ textAlign: 'right', width: '11%' }}>3D Focus</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSetups.length === 0 ? (
                      <tr>
                        <td colSpan="6" style={{ padding: '32px', textAlign: 'center', color: '#94a3b8', fontFamily: 'monospace' }}>
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
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                                  <span className={`vol-action-badge ${badgeClass}`} style={{ fontSize: '9.5px', padding: '3px 7px' }}>
                                    <span className={`vol-action-dot ${badgeClass}`} />
                                    {setup.action}
                                  </span>
                                  <span className="vol-action-badge-sub" style={{ fontSize: '8.5px' }}>
                                    {setup.badge}
                                  </span>
                                </div>
                              </td>

                              {/* 2. Strategy Name & Concrete Structure */}
                              <td>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                  <span className="vol-strategy-title" style={{ fontSize: '12px', lineHeight: 1.25 }}>
                                    {setup.name}
                                  </span>
                                  <span className="vol-strategy-structure" style={{ fontSize: '11px' }}>
                                    {setup.structure}
                                  </span>
                                  {setup.category && (
                                    <span className="vol-strategy-cat-pill" style={{ marginLeft: 0, width: 'fit-content' }}>
                                      {setup.category}
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* 3. Tenor, Strikes & Range */}
                              <td style={{ fontFamily: 'monospace' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                  <span style={{ color: '#ffffff', fontWeight: 700, fontSize: '11px' }}>
                                    {setup.expiry} <span style={{ color: '#00F0FF' }}>({typeof setup.dte === 'number' ? `${setup.dte}D` : (setup.dte || 'Target')})</span>
                                  </span>
                                  <span style={{ color: '#fbbf24', fontWeight: 700, fontSize: '11px' }}>{setup.strikes}</span>
                                  <span style={{ color: '#94a3b8', fontSize: '9.5px' }}>
                                    {setup.moneyness || 'ATM Centered'}
                                  </span>
                                </div>
                              </td>

                              {/* 4. Black-76 Greeks Profile & Quantitative Edge */}
                              <td>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                                    {setup.edge_metric && (
                                      <span className="vol-ai-live-tag" style={{ fontSize: '9px', padding: '2px 6px' }}>
                                        {setup.edge_metric}
                                      </span>
                                    )}
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
                                  <p style={{ margin: 0, color: '#cbd5e1', fontSize: '11px', lineHeight: 1.35, fontFamily: '-apple-system, sans-serif' }}>
                                    {setup.edge}
                                  </p>
                                </div>
                              </td>

                              {/* 5. Modeled PoP / R:R */}
                              <td style={{ textAlign: 'center', fontFamily: 'monospace' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                                  <span style={{ fontSize: '11.5px', fontWeight: 800, color: '#ffffff' }}>
                                    {setup.pop_est || (popNum ? `${popNum}% PoP` : 'Defined')}
                                  </span>
                                  <div className="vol-pop-bar-wrap" style={{ width: '64px' }}>
                                    <div 
                                      className="vol-pop-bar-fill"
                                      style={{ width: `${popNum}%` }}
                                    />
                                  </div>
                                  <span style={{ fontSize: '9.5px', color: '#94a3b8' }}>
                                    R:R {setup.rr_ratio || '1 : 2.5'}
                                  </span>
                                </div>
                              </td>

                              {/* 6. Interactive Focus in 3D & Expand Trigger */}
                              <td style={{ textAlign: 'right' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                                  {setup.target_point && (
                                    <button
                                      onClick={(e) => handleFocusTrade(e, setup.target_point)}
                                      title="Orient 3D Volatility Surface camera directly to this setup"
                                      className="vol-focus-btn"
                                      style={{ padding: '4px 8px', fontSize: '10px' }}
                                    >
                                      <Crosshair style={{ width: '11px', height: '11px' }} />
                                      3D
                                    </button>
                                  )}
                                  <span style={{ fontSize: '9.5px', color: '#94a3b8', display: 'inline-flex', alignItems: 'center', gap: '2px', fontFamily: 'monospace' }}>
                                    {isExpanded ? 'Hide' : 'Legs'}
                                    {isExpanded ? <ChevronUp style={{ width: '13px', height: '13px' }} /> : <ChevronDown style={{ width: '13px', height: '13px' }} />}
                                  </span>
                                </div>
                              </td>
                            </tr>

                            {/* Expandable Institutional Trade Architecture Drawer */}
                            {isExpanded && (
                              <tr>
                                <td colSpan="6" className="vol-drawer-cell">
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
