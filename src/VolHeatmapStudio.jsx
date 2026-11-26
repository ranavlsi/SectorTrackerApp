import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Flame, Shield, Target, Zap, Waves, DollarSign, Layers,
  Crosshair, BarChart2, Eye, EyeOff, ArrowUpRight, AlertTriangle,
  CheckCircle2, Sparkles, Activity, Info, Play, Pause, Clock
} from 'lucide-react';

// Explicit multi-stop hex arrays prevent Plotly 2.35 named-scale fallback to cream-red
const SEQUENTIAL_SCALES = {
  Plasma: [
    [0.0, '#1e1b4b'],
    [0.2, '#4c1d95'],
    [0.4, '#7e22ce'],
    [0.6, '#be185d'],
    [0.8, '#ea580c'],
    [1.0, '#fde047'],
  ],
  Viridis: [
    [0.0, '#1e1b4b'],
    [0.2, '#312e81'],
    [0.4, '#0f766e'],
    [0.6, '#059669'],
    [0.8, '#84cc16'],
    [1.0, '#fde047'],
  ],
  Inferno: [
    [0.0, '#09090b'],
    [0.2, '#3b0764'],
    [0.4, '#881337'],
    [0.6, '#dc2626'],
    [0.8, '#f59e0b'],
    [1.0, '#fef08a'],
  ],
  Electric: [
    [0.0, '#020617'],
    [0.25, '#1d4ed8'],
    [0.5, '#0891b2'],
    [0.75, '#eab308'],
    [1.0, '#fef9c3'],
  ],
  Cividis: [
    [0.0, '#0f172a'],
    [0.25, '#1e3a5f'],
    [0.5, '#475569'],
    [0.75, '#a16207'],
    [1.0, '#fde047'],
  ],
  Turbo: [
    [0.0, '#1e3a8a'],
    [0.2, '#0284c7'],
    [0.4, '#10b981'],
    [0.6, '#eab308'],
    [0.8, '#f97316'],
    [1.0, '#dc2626'],
  ],
  Hot: [
    [0.0, '#18181b'],
    [0.3, '#991b1b'],
    [0.6, '#ea580c'],
    [0.85, '#facc15'],
    [1.0, '#fef9c3'],
  ],
  Ice: [
    [0.0, '#082f49'],
    [0.25, '#0369a1'],
    [0.55, '#06b6d4'],
    [0.8, '#67e8f9'],
    [1.0, '#ecfeff'],
  ],
  YlOrRd: [
    [0.0, '#1e293b'],
    [0.25, '#92400e'],
    [0.55, '#ea580c'],
    [0.8, '#dc2626'],
    [1.0, '#fecaca'],
  ],
};

function makeDivergingScale(isLight) {
  const center = isLight ? '#e2e8f0' : '#1e293b';
  const negOuter = isLight ? '#059669' : '#10b981';
  const negInner = isLight ? '#0891b2' : '#06b6d4';
  const posInner = isLight ? '#d97706' : '#f59e0b';
  const posOuter = isLight ? '#dc2626' : '#ef4444';
  return [
    [0.0, negOuter],
    [0.26, negInner],
    [0.5, center],
    [0.74, posInner],
    [1.0, posOuter],
  ];
}

function makeVegaScale(isLight) {
  if (isLight) {
    return [
      [0.0, '#f1f5f9'],
      [0.25, '#bae6fd'],
      [0.55, '#0ea5e9'],
      [0.8, '#6366f1'],
      [1.0, '#7e22ce'],
    ];
  }
  return [
    [0.0, '#0f172a'],
    [0.25, '#0c4a6e'],
    [0.55, '#0891b2'],
    [0.8, '#14b8a6'],
    [1.0, '#facc15'],
  ];
}

function hexToRgb(hex) {
  const clean = (hex || '#1e293b').replace('#', '');
  const full = clean.length === 3
    ? clean.split('').map((c) => c + c).join('')
    : clean.padEnd(6, '0').slice(0, 6);
  const num = parseInt(full, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function sampleColorscaleHex(scale, tRaw) {
  const t = Math.max(0, Math.min(1, Number.isFinite(tRaw) ? tRaw : 0.5));
  if (!Array.isArray(scale) || scale.length === 0) return '#1e293b';
  if (t <= scale[0][0]) return scale[0][1];
  if (t >= scale[scale.length - 1][0]) return scale[scale.length - 1][1];
  for (let i = 0; i < scale.length - 1; i++) {
    const [t0, c0] = scale[i];
    const [t1, c1] = scale[i + 1];
    if (t >= t0 && t <= t1) {
      const f = (t - t0) / Math.max(1e-9, t1 - t0);
      const [r0, g0, b0] = hexToRgb(c0);
      const [r1, g1, b1] = hexToRgb(c1);
      const r = Math.round(r0 + (r1 - r0) * f);
      const g = Math.round(g0 + (g1 - g0) * f);
      const b = Math.round(b0 + (b1 - b0) * f);
      return `rgb(${r},${g},${b})`;
    }
  }
  return scale[scale.length - 1][1];
}

function contrastTextColorForScale(scale, tRaw) {
  const t = Math.max(0, Math.min(1, Number.isFinite(tRaw) ? tRaw : 0.5));
  let hex = scale?.[0]?.[1] || '#1e293b';
  for (let i = 0; i < scale.length - 1; i++) {
    const [t0, c0] = scale[i];
    const [t1, c1] = scale[i + 1];
    if (t >= t0 && t <= t1) {
      const f = (t - t0) / Math.max(1e-9, t1 - t0);
      const [r0, g0, b0] = hexToRgb(c0);
      const [r1, g1, b1] = hexToRgb(c1);
      const r = r0 + (r1 - r0) * f;
      const g = g0 + (g1 - g0) * f;
      const b = b0 + (b1 - b0) * f;
      const yiq = (r * 299 + g * 587 + b * 114) / 1000;
      return yiq >= 148 ? '#0f172a' : '#f8fafc';
    }
  }
  const [r, g, b] = hexToRgb(hex);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 148 ? '#0f172a' : '#f8fafc';
}

const LENS_META = [
  {
    id: 'iv',
    label: 'IV Surface',
    shortLabel: 'IV',
    unit: '%',
    icon: Flame,
    desc: 'Arbitrage-free SVI + live mid implied volatility surface (%)',
  },
  {
    id: 'edge',
    label: 'SVI Edge',
    shortLabel: 'SVI Edge',
    unit: 'vp',
    icon: Shield,
    desc: 'Net market-vs-SVI edge after half-spread gating (+ Rich / - Cheap, penny wings zeroed)',
  },
  {
    id: 'vrp',
    label: 'VRP (HAR-YZ)',
    shortLabel: 'VRP',
    unit: 'vp',
    icon: Target,
    desc: 'Implied Vol minus horizon-matched Corsi HAR Yang-Zhang Realized Vol',
  },
  {
    id: 'delta_iv',
    label: 'Interday ΔIV',
    shortLabel: 'Interday ΔIV',
    unit: 'vp',
    icon: Zap,
    desc: 'Multi-day implied volatility move across strikes & expiries (Sticky-Delta vs Sticky-Strike)',
  },
  {
    id: 'local_vol',
    label: 'Local Vol',
    shortLabel: 'Local Vol',
    unit: '%',
    icon: Waves,
    desc: 'Dupire arbitrage-free local volatility σ_loc(K,T) across forward paths',
  },
  {
    id: 'vega_liq',
    label: 'Vega Heat',
    shortLabel: 'Vega Heat',
    unit: '$k',
    icon: DollarSign,
    desc: 'Contract liquidity & institutional vega sensitivity concentration',
  },
];

function formatCellValue(val, lens) {
  if (val === null || val === undefined || !Number.isFinite(val)) return '—';
  if (lens === 'iv' || lens === 'local_vol') return `${val.toFixed(1)}%`;
  if (lens === 'edge' || lens === 'vrp' || lens === 'delta_iv') {
    const sign = val > 0 ? '+' : '';
    return `${sign}${val.toFixed(1)}`;
  }
  if (lens === 'vega_liq') {
    if (Math.abs(val) >= 100) return `${Math.round(val)}`;
    return val.toFixed(1);
  }
  return val.toFixed(1);
}

function getLensNumeric(cell, lens) {
  if (!cell) return null;
  switch (lens) {
    case 'edge':
      return Number.isFinite(cell.edge_vp) ? cell.edge_vp : 0;
    case 'vrp':
      return Number.isFinite(cell.vrp_vp) ? cell.vrp_vp : null;
    case 'delta_iv':
      return Number.isFinite(cell.delta_iv_1d) ? cell.delta_iv_1d : 0;
    case 'local_vol':
      return Number.isFinite(cell.local_vol) ? cell.local_vol : cell.iv;
    case 'vega_liq':
      return Number.isFinite(cell.vega_heat) ? cell.vega_heat : 0;
    case 'iv':
    default:
      return Number.isFinite(cell.iv) ? cell.iv : cell.svi_iv;
  }
}

export default function VolHeatmapStudio({
  data,
  activeData,
  ticker,
  spot,
  surfaceColor,
  setSurfaceColor,
  surfaceBg,
  strikeMode,
  setStrikeMode,
  heatmapFilter,
  setHeatmapFilter,
  volMoveLookback,
  setVolMoveLookback,
  interdayShiftMode,
  setInterdayShiftMode,
  focusedHotspot,
  setFocusedHotspot,
  detectedAirPockets,
  plotlyReady,
  onSwitchTo3DFocus,
  onRegisterExport,
}) {
  const chartRef = useRef(null);
  const suppressColorSyncRef = useRef(false);
  const suppressInterdaySyncRef = useRef(false);
  const lastParentColorRef = useRef(surfaceColor);
  const lastParentInterdayRef = useRef(interdayShiftMode);
  const lastParentStrikeRef = useRef(strikeMode);
  const lastVolMoveRef = useRef(volMoveLookback);
  const lastTickerRef = useRef(ticker);

  const initialLens = interdayShiftMode || (volMoveLookback && volMoveLookback !== 'OFF')
    ? 'delta_iv'
    : surfaceColor === 'HedgingRegimes'
      ? 'edge'
      : surfaceColor === 'LocalVol'
        ? 'local_vol'
        : 'iv';

  const [activeLens, setActiveLens] = useState(initialLens);
  const [coordMode, setCoordMode] = useState('delta');
  const [interdayLookback, setInterdayLookback] = useState(() => (
    ['1D', '2D', '3D', '5D', '10D'].includes(volMoveLookback) ? volMoveLookback : '1D'
  ));
  const [isReplaying, setIsReplaying] = useState(false);
  const [showCellText, setShowCellText] = useState(true);
  const [showMarginals, setShowMarginals] = useState(true);
  const [showInfoGuide, setShowInfoGuide] = useState(false);
  const [guideTab, setGuideTab] = useState('concepts');
  const [selectedCell, setSelectedCell] = useState(null);

  const heatmapPayload = data?.vol_heatmap_v3 || null;
  const interdayMotion = heatmapPayload?.interday_motion || null;
  const lookbackOrder = useMemo(() => (
    interdayMotion?.available && Array.isArray(interdayMotion.lookback_order) && interdayMotion.lookback_order.length > 0
      ? interdayMotion.lookback_order
      : ['1D', '3D', '5D', '10D']
  ), [interdayMotion]);
  const isLightTheme = surfaceBg === '#f8fafc';

  // Sync parent toolbar COLOR -> Studio Lens cleanly without loops
  useEffect(() => {
    if (surfaceColor === lastParentColorRef.current) return;
    lastParentColorRef.current = surfaceColor;
    if (suppressColorSyncRef.current) {
      suppressColorSyncRef.current = false;
      return;
    }
    if (surfaceColor === 'HedgingRegimes') {
      setActiveLens('edge');
    } else if (surfaceColor === 'LocalVol') {
      setActiveLens('local_vol');
    } else if (activeLens === 'edge' || activeLens === 'local_vol') {
      setActiveLens('iv');
    }
  }, [surfaceColor, activeLens]);

  // Sync parent Interday ΔIV toggle -> Studio Lens
  useEffect(() => {
    if (interdayShiftMode === lastParentInterdayRef.current) return;
    lastParentInterdayRef.current = interdayShiftMode;
    if (suppressInterdaySyncRef.current) {
      suppressInterdaySyncRef.current = false;
      return;
    }
    if (interdayShiftMode) {
      setActiveLens('delta_iv');
    } else if (activeLens === 'delta_iv') {
      setActiveLens('iv');
    }
  }, [interdayShiftMode, activeLens]);

  // Keep interdayLookback valid when lookbackOrder changes
  useEffect(() => {
    if (!lookbackOrder.includes(interdayLookback)) {
      setInterdayLookback(lookbackOrder[0] || '1D');
    }
  }, [lookbackOrder, interdayLookback]);

  // Stop replay automatically when leaving Interday ΔIV lens
  useEffect(() => {
    if (activeLens !== 'delta_iv' && isReplaying) {
      setIsReplaying(false);
    }
  }, [activeLens, isReplaying]);

  // Day-by-day chronological replay (10D -> 5D -> 3D -> 2D -> 1D)
  useEffect(() => {
    if (!isReplaying || activeLens !== 'delta_iv' || lookbackOrder.length < 2) return;
    const chrono = [...lookbackOrder].reverse();
    const id = window.setInterval(() => {
      setInterdayLookback((curr) => {
        const idx = chrono.indexOf(curr);
        const nextIdx = idx >= 0 ? (idx + 1) % chrono.length : 0;
        return chrono[nextIdx];
      });
    }, 1300);
    return () => window.clearInterval(id);
  }, [isReplaying, activeLens, lookbackOrder]);

  // Sync parent Vol Move lookback -> ΔIV Lens & Lookback
  useEffect(() => {
    if (volMoveLookback === lastVolMoveRef.current) return;
    lastVolMoveRef.current = volMoveLookback;
    if (volMoveLookback && volMoveLookback !== 'OFF') {
      if (lookbackOrder.includes(volMoveLookback)) {
        setInterdayLookback(volMoveLookback);
      } else {
        setInterdayLookback(lookbackOrder[0] || '1D');
      }
      setIsReplaying(false);
      setActiveLens('delta_iv');
    } else if (!interdayShiftMode && activeLens === 'delta_iv') {
      setIsReplaying(false);
      setActiveLens('iv');
    }
  }, [volMoveLookback, interdayShiftMode, activeLens]);

  // Sync parent Strike/Moneyness toggle -> Coord mode
  useEffect(() => {
    if (strikeMode === lastParentStrikeRef.current) return;
    lastParentStrikeRef.current = strikeMode;
    if (strikeMode === 'strike' || strikeMode === 'moneyness') {
      setCoordMode(strikeMode);
    }
  }, [strikeMode]);

  const handleSelectLens = useCallback((lensId) => {
    setActiveLens(lensId);
    if (lensId === 'edge') {
      if (surfaceColor !== 'HedgingRegimes') {
        suppressColorSyncRef.current = true;
        setSurfaceColor?.('HedgingRegimes');
      }
      if (interdayShiftMode) {
        suppressInterdaySyncRef.current = true;
        setInterdayShiftMode?.(false);
      }
    } else if (lensId === 'local_vol') {
      if (surfaceColor !== 'LocalVol') {
        suppressColorSyncRef.current = true;
        setSurfaceColor?.('LocalVol');
      }
      if (interdayShiftMode) {
        suppressInterdaySyncRef.current = true;
        setInterdayShiftMode?.(false);
      }
    } else if (lensId === 'delta_iv') {
      if (!interdayShiftMode) {
        suppressInterdaySyncRef.current = true;
        setInterdayShiftMode?.(true);
      }
    } else {
      setIsReplaying(false);
      if (surfaceColor === 'HedgingRegimes' || surfaceColor === 'LocalVol') {
        suppressColorSyncRef.current = true;
        setSurfaceColor?.('Plasma');
      }
      if (interdayShiftMode) {
        suppressInterdaySyncRef.current = true;
        setInterdayShiftMode?.(false);
      }
    }
  }, [surfaceColor, setSurfaceColor, interdayShiftMode, setInterdayShiftMode]);

  const handleSelectLookback = useCallback((lb) => {
    setIsReplaying(false);
    setInterdayLookback(lb);
    handleSelectLens('delta_iv');
    if (['1D', '3D', '5D', '10D'].includes(lb)) {
      lastVolMoveRef.current = lb;
      setVolMoveLookback?.(lb);
    }
  }, [handleSelectLens, setVolMoveLookback]);

  const handleToggleReplay = useCallback(() => {
    if (isReplaying) {
      setIsReplaying(false);
      return;
    }
    const chrono = [...lookbackOrder].reverse();
    if (chrono.length > 0) {
      setInterdayLookback(chrono[0]);
    }
    handleSelectLens('delta_iv');
    setIsReplaying(true);
  }, [isReplaying, lookbackOrder, handleSelectLens]);

  const handleSelectCoordMode = useCallback((mode) => {
    setCoordMode(mode);
    if (mode === 'strike' || mode === 'moneyness') {
      lastParentStrikeRef.current = mode;
      setStrikeMode?.(mode);
    }
  }, [setStrikeMode]);

  // Slice grid rows according to active Horizon (1M/3M/6M/1Y/2Y/ALL) via activeData.term_structure
  const slicedView = useMemo(() => {
    if (!heatmapPayload) return null;
    const rawGrid = coordMode === 'delta'
      ? heatmapPayload.delta_grid
      : (heatmapFilter === 'all' ? heatmapPayload.strike_grid_full : heatmapPayload.strike_grid_core);
    if (!rawGrid || !Array.isArray(rawGrid.cells) || rawGrid.cells.length === 0) return null;

    const allExpiries = heatmapPayload.expirations || [];
    const allLabels = heatmapPayload.dte_labels || allExpiries;
    const allHarRows = heatmapPayload.har_rv_by_expiry || [];

    const horizonExpiries = new Set((activeData?.term_structure || []).map((t) => t.expiry));
    let rowIndices = allExpiries
      .map((exp, idx) => (horizonExpiries.size === 0 || horizonExpiries.has(exp) ? idx : -1))
      .filter((idx) => idx >= 0 && rawGrid.cells[idx]);

    if (rowIndices.length === 0) {
      rowIndices = allExpiries.map((_, idx) => idx).filter((idx) => rawGrid.cells[idx]);
    }

    const expirations = rowIndices.map((idx) => allExpiries[idx]);
    const yLabels = rowIndices.map((idx) => allLabels[idx] || allExpiries[idx]);
    const cells = rowIndices.map((idx) => rawGrid.cells[idx]);
    const harRows = rowIndices.map((idx) => allHarRows[idx] || null);

    let xLabels = rawGrid.x_labels || [];
    if (coordMode === 'moneyness' && Array.isArray(rawGrid.moneyness) && rawGrid.moneyness.length === xLabels.length) {
      xLabels = rawGrid.moneyness.map((m) => `${(m * 100).toFixed(1)}%`);
    }

    const activeLbObj = interdayMotion?.available
      ? (interdayMotion.lookbacks?.[interdayLookback] || interdayMotion.lookbacks?.[lookbackOrder[0]] || null)
      : null;
    const matKey = coordMode === 'delta'
      ? 'delta_matrix'
      : (heatmapFilter === 'all' ? 'strike_full_matrix' : 'strike_core_matrix');
    const priorKey = coordMode === 'delta'
      ? 'delta_prior_iv'
      : (heatmapFilter === 'all' ? 'strike_full_prior_iv' : 'strike_core_prior_iv');

    const interdayDeltaMatrix = activeLbObj?.[matKey]
      ? rowIndices.map((idx) => activeLbObj[matKey][idx] || null)
      : null;
    const interdayPriorMatrix = activeLbObj?.[priorKey]
      ? rowIndices.map((idx) => activeLbObj[priorKey][idx] || null)
      : null;
    const interdayExpiryAtmDelta = Array.isArray(activeLbObj?.by_expiry_atm_delta)
      ? rowIndices.map((idx) => activeLbObj.by_expiry_atm_delta[idx] ?? null)
      : null;

    return {
      grid: rawGrid,
      rowIndices,
      expirations,
      yLabels,
      xLabels,
      cells,
      harRows,
      activeLbObj,
      matKey,
      priorKey,
      interdayDeltaMatrix,
      interdayPriorMatrix,
      interdayExpiryAtmDelta,
    };
  }, [heatmapPayload, coordMode, heatmapFilter, activeData, interdayMotion, interdayLookback, lookbackOrder]);

  // Seed default selected cell or handle focusedHotspot changes (Lock on Heatmap / radar)
  useEffect(() => {
    if (!heatmapPayload || !slicedView) return;
    if (focusedHotspot && focusedHotspot.expiry && Number.isFinite(Number(focusedHotspot.strike))) {
      const targetStrike = Number(focusedHotspot.strike);
      // Check if current grid contains a matching expiry row & strike; if delta grid misses strike by >$2, switch to strike mode
      let matched = null;
      const targetRow = slicedView.cells.find((row, rIdx) => slicedView.expirations[rIdx] === focusedHotspot.expiry)
        || slicedView.cells[0];
      if (targetRow) {
        let bestDist = Infinity;
        for (const c of targetRow) {
          const d = Math.abs((c?.strike || 0) - targetStrike);
          if (d < bestDist) {
            bestDist = d;
            matched = c;
          }
        }
        if (coordMode === 'delta' && bestDist > 0.05) {
          setCoordMode('strike');
          setStrikeMode?.('strike');
          return;
        }
        if (matched) {
          setSelectedCell(matched);
          return;
        }
      }
    }

    const tickerChanged = lastTickerRef.current !== ticker;
    if (tickerChanged) {
      lastTickerRef.current = ticker;
    }

    // Default initial cell if nothing selected yet or ticker changed
    setSelectedCell((prev) => {
      if (prev && !tickerChanged) {
        for (const row of slicedView.cells) {
          const found = row.find((c) => c && c.expiry === prev.expiry && Math.abs(c.strike - prev.strike) < 0.05);
          if (found) return found;
        }
      }
      const def = heatmapPayload.default_focus_cell;
      if (def) {
        for (const row of slicedView.cells) {
          const found = row.find((c) => c && c.expiry === def.expiry && Math.abs(c.strike - def.strike) < 0.5);
          if (found) return found;
        }
      }
      const midRow = slicedView.cells[Math.floor(slicedView.cells.length / 2)] || slicedView.cells[0];
      return midRow?.[Math.floor((midRow?.length || 1) / 2)] || null;
    });
  }, [heatmapPayload, focusedHotspot, slicedView, coordMode, spot, setStrikeMode]);

  // Register top Snapshot button export hook cleanly
  useEffect(() => {
    if (!onRegisterExport) return;
    const exporter = () => {
      if (!chartRef.current || !window.Plotly) return;
      window.Plotly.downloadImage(chartRef.current, {
        format: 'png',
        width: 1480,
        height: 820,
        filename: `${ticker || 'TICKER'}_VolHeatmap_${activeLens}_${coordMode}`,
      });
    };
    onRegisterExport(exporter);
    return () => onRegisterExport(null);
  }, [onRegisterExport, ticker, activeLens, coordMode]);

  // Render Plotly Synchronized Matrix + Marginals
  useEffect(() => {
    if (!plotlyReady || !window.Plotly || !chartRef.current || !slicedView) return;

    const {
      xLabels,
      yLabels,
      expirations,
      cells,
      harRows,
      grid,
      activeLbObj,
      interdayDeltaMatrix,
      interdayPriorMatrix,
      interdayExpiryAtmDelta,
    } = slicedView;
    const nRows = cells.length;
    const nCols = xLabels.length;
    if (nRows === 0 || nCols === 0) return;

    const isInterdayActive = activeLens === 'delta_iv';
    const lbTag = activeLbObj?.key || interdayLookback || '1D';
    const lbDate = activeLbObj?.date || '';
    const anchorModeLabel = coordMode === 'delta' ? 'Sticky-Delta Smile Shift' : 'Sticky-Strike Contract Shift';

    const paletteName = SEQUENTIAL_SCALES[surfaceColor] ? surfaceColor : 'Plasma';
    let activeScale = SEQUENTIAL_SCALES[paletteName];
    if (activeLens === 'edge' || activeLens === 'vrp' || activeLens === 'delta_iv') {
      activeScale = makeDivergingScale(isLightTheme);
    } else if (activeLens === 'vega_liq') {
      activeScale = makeVegaScale(isLightTheme);
    }

    const zMatrix = [];
    const customMatrix = [];
    let flatVals = [];

    for (let r = 0; r < nRows; r++) {
      const zRow = [];
      const mRow = [];
      for (let c = 0; c < nCols; c++) {
        const cell = cells[r]?.[c];
        let v = getLensNumeric(cell, activeLens);
        let priorIvNum = cell && Number.isFinite(cell.iv) && Number.isFinite(cell.delta_iv_1d)
          ? Math.max(4.0, cell.iv - cell.delta_iv_1d)
          : null;
        if (isInterdayActive && interdayDeltaMatrix && interdayDeltaMatrix[r]) {
          const idVal = interdayDeltaMatrix[r][c];
          if (idVal !== null && idVal !== undefined && Number.isFinite(idVal)) {
            v = idVal;
          }
          const pVal = interdayPriorMatrix?.[r]?.[c];
          if (pVal !== null && pVal !== undefined && Number.isFinite(pVal)) {
            priorIvNum = pVal;
          } else if (cell && Number.isFinite(cell.iv) && Number.isFinite(v)) {
            priorIvNum = Math.max(4.0, cell.iv - v);
          }
        }
        zRow.push(v);
        if (v !== null && Number.isFinite(v)) flatVals.push(v);

        const spreadStr = cell && Number.isFinite(cell.iv_bid) && Number.isFinite(cell.iv_ask)
          ? `${cell.iv_bid.toFixed(1)}% / ${cell.iv_ask.toFixed(1)}%`
          : 'SVI Smooth';
        const vrpStr = cell && Number.isFinite(cell.vrp_vp)
          ? `${cell.vrp_vp >= 0 ? '+' : ''}${cell.vrp_vp.toFixed(2)} vp (vs ${cell.har_rv?.toFixed(1) || '—'}% HAR)`
          : '—';
        const edgeStr = cell && Number.isFinite(cell.edge_vp)
          ? `${cell.edge_vp >= 0 ? '+' : ''}${cell.edge_vp.toFixed(2)} vp${cell.is_tradable ? ' [TRADABLE]' : ' [FILTERED]'}`
          : '—';
        const lvStr = cell && Number.isFinite(cell.local_vol) ? `${cell.local_vol.toFixed(1)}%` : '—';
        const dValShow = isInterdayActive && Number.isFinite(v) ? v : cell?.delta_iv_1d;
        const dIvStr = Number.isFinite(dValShow)
          ? `${dValShow >= 0 ? '+' : ''}${dValShow.toFixed(2)} vp`
          : '—';
        const priorIvStr = Number.isFinite(priorIvNum) ? `${priorIvNum.toFixed(2)}%` : '—';
        mRow.push({
          expiry: cell?.expiry || expirations[r],
          dte: cell?.dte ?? '',
          strike: cell?.strike ?? '',
          deltaPct: cell && Number.isFinite(cell.delta) ? `${Math.round(cell.delta * 100)}Δ` : '',
          optType: cell?.opt_type || '',
          iv: cell && Number.isFinite(cell.iv) ? `${cell.iv.toFixed(2)}%` : '—',
          priorIv: priorIvStr,
          sviIv: cell && Number.isFinite(cell.svi_iv) ? `${cell.svi_iv.toFixed(2)}%` : '—',
          spreadStr,
          edgeStr,
          vrpStr,
          lvStr,
          dIvStr,
          lbTag,
          lbDate: lbDate ? ` (${lbDate})` : '',
          anchorMode: anchorModeLabel,
          price: cell && Number.isFinite(cell.price) ? `$${cell.price.toFixed(2)}` : '—',
          vega: cell && Number.isFinite(cell.vega) ? cell.vega.toFixed(3) : '—',
          source: cell?.source || 'SVI_FIT',
        });
      }
      zMatrix.push(zRow);
      customMatrix.push(mRow);
    }

    // Domain-appropriate zMin / zMax (robust clipping prevents outlier distortion)
    flatVals.sort((a, b) => a - b);
    let zMin = flatVals.length ? flatVals[0] : 0;
    let zMax = flatVals.length ? flatVals[flatVals.length - 1] : 1;
    let zMid;
    if (activeLens === 'edge' || activeLens === 'vrp' || activeLens === 'delta_iv') {
      const absMax = Math.max(
        activeLens === 'edge' ? 1.5 : activeLens === 'delta_iv' ? 1.0 : 2.0,
        ...flatVals.map((v) => Math.abs(v))
      );
      const q98 = flatVals.length ? Math.abs(flatVals[Math.floor(flatVals.length * 0.98)] || absMax) : absMax;
      const cap = Math.min(absMax, Math.max(q98 * 1.15, activeLens === 'vrp' ? 6.0 : 2.5));
      zMin = -cap;
      zMax = cap;
      zMid = 0;
    } else if (flatVals.length > 4) {
      const p02 = flatVals[Math.floor(flatVals.length * 0.02)];
      const p98 = flatVals[Math.floor(flatVals.length * 0.98)];
      zMin = p02;
      zMax = Math.max(p02 + 0.5, p98 * 1.03);
    }

    const activeLensObj = LENS_META.find((l) => l.id === activeLens) || LENS_META[0];
    const textInk = isLightTheme ? '#0f172a' : '#e2e8f0';
    const subInk = isLightTheme ? '#475569' : '#94a3b8';
    const gridStroke = isLightTheme ? 'rgba(15, 23, 42, 0.10)' : 'rgba(148, 163, 184, 0.14)';
    const pillBg = isLightTheme ? 'rgba(255, 255, 255, 0.92)' : 'rgba(15, 23, 42, 0.90)';

    const traces = [
      {
        type: 'heatmap',
        name: activeLensObj.label,
        x: xLabels,
        y: yLabels,
        z: zMatrix,
        customdata: customMatrix,
        colorscale: activeScale,
        zmin: zMin,
        zmax: zMax,
        ...(zMid !== undefined ? { zmid: zMid } : {}),
        xgap: 2,
        ygap: 2,
        hoverongaps: false,
        showscale: true,
        colorbar: {
          title: {
            text: isInterdayActive ? `${lbTag} ΔIV (vp)` : `${activeLensObj.shortLabel} (${activeLensObj.unit})`,
            font: { size: 10, color: textInk, family: 'JetBrains Mono, monospace' },
          },
          thickness: 12,
          len: showMarginals ? 0.72 : 0.92,
          y: showMarginals ? 0.36 : 0.5,
          x: 1.015,
          tickfont: { size: 10, color: subInk, family: 'JetBrains Mono, monospace' },
          outlinewidth: 0,
        },
        hovertemplate: isInterdayActive
          ? (
            '<b>%{customdata.expiry} (%{customdata.dte}D) · $%{customdata.strike} %{customdata.optType}</b><br>' +
            'Mode: <b>%{customdata.anchorMode}</b> · Delta: <b>%{customdata.deltaPct}</b><br>' +
            'Today IV: <b>%{customdata.iv}</b> · Prior %{customdata.lbTag}%{customdata.lbDate}: <b>%{customdata.priorIv}</b><br>' +
            'Interday ΔIV (%{customdata.lbTag}): <b>%{customdata.dIvStr}</b><br>' +
            'Mid Price: <b>%{customdata.price}</b> · Vega: <b>%{customdata.vega}</b><br>' +
            '<i>Click cell to inspect 10D → 1D IV trajectory</i><extra></extra>'
          )
          : (
            '<b>%{customdata.expiry} (%{customdata.dte}D) · $%{customdata.strike} %{customdata.optType}</b><br>' +
            'Delta: <b>%{customdata.deltaPct}</b> · Mid Price: <b>%{customdata.price}</b> · Vega: <b>%{customdata.vega}</b><br>' +
            'Market/Fit IV: <b>%{customdata.iv}</b> · SVI Fair: <b>%{customdata.sviIv}</b><br>' +
            'Bid / Ask IV: %{customdata.spreadStr}<br>' +
            'SVI Net Edge: <b>%{customdata.edgeStr}</b><br>' +
            'HAR-YZ VRP: <b>%{customdata.vrpStr}</b><br>' +
            '1D ΔIV: <b>%{customdata.dIvStr}</b> · Dupire Local Vol: <b>%{customdata.lvStr}</b><br>' +
            '<i>Click cell to lock Inspector & Spread Desk</i><extra></extra>'
          ),
      },
    ];

    const shapes = [];
    const annotations = [];

    // High-contrast adaptive cell value labels (readable on both indigo and bright yellow stops)
    const shouldDrawLabels = showCellText && nCols <= 15 && nRows <= 28;
    if (shouldDrawLabels) {
      for (let r = 0; r < nRows; r++) {
        for (let c = 0; c < nCols; c++) {
          const val = zMatrix[r][c];
          if (val === null || !Number.isFinite(val)) continue;
          const tNorm = (val - zMin) / Math.max(1e-9, zMax - zMin);
          const ink = contrastTextColorForScale(activeScale, tNorm);
          const cell = cells[r]?.[c];
          const isTradableFlag = activeLens === 'edge' && cell?.is_tradable;
          annotations.push({
            x: xLabels[c],
            y: yLabels[r],
            xref: 'x',
            yref: 'y',
            text: formatCellValue(val, activeLens),
            showarrow: false,
            font: {
              size: nRows > 20 ? 8.8 : (nCols <= 10 ? 9.8 : 8.8),
              color: ink,
              family: 'JetBrains Mono, ui-monospace, monospace',
              weight: isTradableFlag ? 800 : 600,
            },
          });
        }
      }
    }

    // Spot ATM column marker index
    let atmColIdx = -1;
    if (coordMode === 'delta') {
      atmColIdx = xLabels.findIndex((lbl) => lbl === '50Δ');
    } else if (Array.isArray(grid.strikes) && Number.isFinite(spot)) {
      let bestD = Infinity;
      grid.strikes.forEach((k, idx) => {
        const d = Math.abs(k - spot);
        if (d < bestD) {
          bestD = d;
          atmColIdx = idx;
        }
      });
    }

    if (atmColIdx >= 0 && atmColIdx < nCols) {
      shapes.push({
        type: 'line',
        xref: 'x',
        yref: 'y domain',
        x0: xLabels[atmColIdx],
        x1: xLabels[atmColIdx],
        y0: 0,
        y1: 1,
        line: { color: '#38bdf8', width: 2, dash: 'dot' },
      });
      if (!showMarginals) {
        annotations.push({
          x: xLabels[atmColIdx],
          y: 1.03,
          xref: 'x',
          yref: 'y domain',
          text: `Spot $${spot?.toFixed(2)}`,
          showarrow: false,
          bgcolor: pillBg,
          bordercolor: '#38bdf8',
          borderwidth: 1,
          borderpad: 3,
          font: { size: 10, color: '#38bdf8', family: 'JetBrains Mono, monospace', weight: 700 },
        });
      }
    }

    // Focus lock outline around currently inspected cell
    if (selectedCell) {
      const rMatch = expirations.indexOf(selectedCell.expiry);
      if (rMatch >= 0) {
        let cMatch = -1;
        let bestD = Infinity;
        for (let c = 0; c < nCols; c++) {
          const cand = cells[rMatch]?.[c];
          if (!cand) continue;
          const d = Math.abs((cand.strike || 0) - (selectedCell.strike || 0));
          if (d < bestD) {
            bestD = d;
            cMatch = c;
          }
        }
        if (cMatch >= 0) {
          shapes.push({
            type: 'rect',
            xref: 'x',
            yref: 'y',
            x0: cMatch - 0.5,
            x1: cMatch + 0.5,
            y0: rMatch - 0.5,
            y1: rMatch + 0.5,
            line: { color: isLightTheme ? '#0284c7' : '#ffffff', width: 2.5 },
            fillcolor: 'rgba(0,0,0,0)',
          });
        }
      }
    }

    // Subtle crisp borders (max 2) for verified Air Pockets / Top Tradable Edges on iv/edge lenses — NO clipped emoji overlays
    if ((activeLens === 'iv' || activeLens === 'edge') && Array.isArray(heatmapPayload?.top_rich_cells)) {
      const highlightCells = [
        ...(heatmapPayload.top_rich_cells.slice(0, 1) || []),
        ...(heatmapPayload.top_cheap_cells?.slice(0, 1) || []),
      ];
      highlightCells.forEach((hc) => {
        const rIdx = expirations.indexOf(hc.expiry);
        if (rIdx < 0) return;
        let cIdx = -1;
        let bestD = Infinity;
        for (let c = 0; c < nCols; c++) {
          const cand = cells[rIdx]?.[c];
          if (!cand) continue;
          const d = Math.abs((cand.strike || 0) - hc.strike);
          if (d < bestD) {
            bestD = d;
            cIdx = c;
          }
        }
        if (cIdx >= 0 && bestD <= Math.max(1.5, (spot || 100) * 0.015)) {
          shapes.push({
            type: 'rect',
            xref: 'x',
            yref: 'y',
            x0: cIdx - 0.46,
            x1: cIdx + 0.46,
            y0: rIdx - 0.46,
            y1: rIdx + 0.46,
            line: {
              color: hc.edge_vp >= 0 ? '#f97316' : '#10b981',
              width: 2,
              dash: 'dash',
            },
            fillcolor: 'rgba(0,0,0,0)',
          });
        }
      });
    }

    // Top Marginal (Column Smile) + Right Marginal (Term / HAR-YZ / Lens Bar)
    if (showMarginals) {
      const colMeans = xLabels.map((_, c) => {
        const vals = zMatrix.map((row) => row[c]).filter((v) => v !== null && Number.isFinite(v));
        return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
      });
      const frontRowVals = zMatrix[0] || [];

      traces.push({
        type: 'scatter',
        mode: 'lines+markers',
        name: `Mean ${activeLensObj.shortLabel}`,
        x: xLabels,
        y: colMeans,
        xaxis: 'x',
        yaxis: 'y2',
        line: { color: isLightTheme ? '#0284c7' : '#38bdf8', width: 2.2 },
        marker: { size: 5, color: isLightTheme ? '#0284c7' : '#38bdf8' },
        showlegend: false,
        hovertemplate: `%{x} Mean ${activeLensObj.shortLabel}: <b>%{y:.2f}${activeLensObj.unit}</b><extra></extra>`,
      });

      if ((activeLens === 'iv' || activeLens === 'delta_iv') && nRows >= 2) {
        traces.push({
          type: 'scatter',
          mode: 'lines',
          name: `Front (${expirations[0]})`,
          x: xLabels,
          y: frontRowVals,
          xaxis: 'x',
          yaxis: 'y2',
          line: { color: '#f59e0b', width: 1.6, dash: 'dot' },
          showlegend: false,
          hovertemplate: isInterdayActive
            ? `%{x} Front ${expirations[0]} (${lbTag}): <b>%{y:+.2f} vp</b><extra></extra>`
            : `%{x} Front ${expirations[0]}: <b>%{y:.2f}%</b><extra></extra>`,
        });
      }
      if (activeLens === 'edge' || activeLens === 'vrp' || activeLens === 'delta_iv') {
        traces.push({
          type: 'scatter',
          mode: 'lines',
          x: xLabels,
          y: xLabels.map(() => 0),
          xaxis: 'x',
          yaxis: 'y2',
          line: { color: subInk, width: 1, dash: 'dot' },
          showlegend: false,
          hoverinfo: 'skip',
        });
      }

      // Right Marginal: Per-expiry Term / VRP / Edge / ΔIV profile
      let rightVals = [];
      let rightColors = [];
      let rightHover = '';
      if (activeLens === 'vrp') {
        rightVals = harRows.map((hr) => (hr?.vrp_vp ?? 0));
        rightColors = rightVals.map((v) => (v >= 0 ? '#f43f5e' : '#10b981'));
        rightHover = '%{y} · ATM VRP: <b>%{x:+.2f} vp</b><extra></extra>';
      } else if (activeLens === 'delta_iv') {
        rightVals = interdayExpiryAtmDelta
          ? interdayExpiryAtmDelta.map((v, r) => (v !== null && v !== undefined ? v : (harRows[r]?.delta_iv_1d ?? 0)))
          : harRows.map((hr) => (hr?.delta_iv_1d ?? 0));
        rightColors = rightVals.map((v) => (v >= 0 ? '#f97316' : '#10b981'));
        rightHover = `%{y} · ${lbTag} ATM ΔIV: <b>%{x:+.2f} vp</b><extra></extra>`;
      } else if (activeLens === 'edge') {
        rightVals = cells.map((row) => {
          let best = 0;
          row.forEach((c) => {
            if (c?.is_tradable && Math.abs(c.edge_vp || 0) > Math.abs(best)) best = c.edge_vp;
          });
          return best;
        });
        rightColors = rightVals.map((v) => (v > 0 ? '#f97316' : v < 0 ? '#10b981' : subInk));
        rightHover = '%{y} · Peak Net Edge: <b>%{x:+.2f} vp</b><extra></extra>';
      } else if (activeLens === 'vega_liq') {
        rightVals = cells.map((row) => {
          const sumV = row.reduce((acc, c) => acc + (c?.vega_heat || 0), 0);
          return Number((sumV / Math.max(1, row.length)).toFixed(1));
        });
        rightColors = isLightTheme ? '#0284c7' : '#22d3ee';
        rightHover = '%{y} · Avg Vega Heat: <b>%{x:.1f}</b><extra></extra>';
      } else {
        rightVals = harRows.map((hr, r) => (hr?.atm_iv ?? colMeans[0] ?? 0));
        rightColors = isLightTheme ? '#4f46e5' : '#818cf8';
        rightHover = '%{y} · ATM IV: <b>%{x:.1f}%</b><extra></extra>';
      }

      traces.push({
        type: 'bar',
        orientation: 'h',
        y: yLabels,
        x: rightVals,
        xaxis: 'x3',
        yaxis: 'y',
        marker: { color: rightColors, opacity: 0.85 },
        showlegend: false,
        hovertemplate: rightHover,
      });

      if ((activeLens === 'iv' || activeLens === 'local_vol') && harRows.some((hr) => Number.isFinite(hr?.har_rv))) {
        traces.push({
          type: 'scatter',
          mode: 'lines+markers',
          name: 'HAR-YZ RV',
          y: yLabels,
          x: harRows.map((hr) => hr?.har_rv ?? null),
          xaxis: 'x3',
          yaxis: 'y',
          line: { color: '#10b981', width: 2 },
          marker: { symbol: 'diamond', size: 6, color: '#10b981' },
          showlegend: false,
          hovertemplate: '%{y} · HAR-YZ RV: <b>%{x:.1f}%</b><extra></extra>',
        });
      }

      // Marginal subplot titles cleanly positioned in paper coords
      annotations.push({
        xref: 'paper',
        yref: 'paper',
        x: 0.0,
        y: 1.04,
        xanchor: 'left',
        showarrow: false,
        text: activeLens === 'iv'
          ? '<b>Mean Smile</b> (cyan) vs <b>Front Tenor</b> (amber dashed)'
          : activeLens === 'delta_iv'
            ? `<b>${lbTag} Mean ΔIV</b> (cyan) vs <b>Front Tenor</b> (amber dashed)`
            : `<b>Column Profile: Mean ${activeLensObj.label}</b>`,
        font: { size: 10.5, color: subInk, family: 'Inter, system-ui, sans-serif' },
      });

      annotations.push({
        xref: 'paper',
        yref: 'paper',
        x: 0.80,
        y: 0.77,
        xanchor: 'left',
        showarrow: false,
        text: activeLens === 'iv' || activeLens === 'local_vol'
          ? '<b>ATM IV</b> vs <span style="color:#10b981"><b>HAR-RV◆</b></span>'
          : activeLens === 'delta_iv'
            ? `<b>${lbTag} ATM ΔIV by Expiry</b>`
            : `<b>By Expiry (${activeLensObj.unit})</b>`,
        font: { size: 10.5, color: subInk, family: 'Inter, system-ui, sans-serif' },
      });
    }

    const totalHeight = showMarginals
      ? Math.max(495, Math.min(800, 225 + nRows * 28))
      : Math.max(420, Math.min(720, 155 + nRows * 27));

    const layout = {
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: isLightTheme ? '#f8fafc' : '#0b0f19',
      height: totalHeight,
      margin: {
        l: 92,
        r: 72,
        t: showMarginals ? 34 : 26,
        b: 54,
      },
      hovermode: 'closest',
      dragmode: false,
      font: { color: textInk, family: 'Inter, system-ui, sans-serif', size: 11 },
      xaxis: {
        domain: showMarginals ? [0, 0.76] : [0, 1],
        anchor: 'y',
        type: 'category',
        tickangle: nCols > 12 ? -38 : nCols > 10 ? -28 : 0,
        tickfont: { size: nCols > 14 ? 9.2 : 10.5, color: textInk, family: 'JetBrains Mono, monospace' },
        showgrid: false,
        zeroline: false,
      },
      yaxis: {
        domain: showMarginals ? [0, 0.73] : [0, 1],
        anchor: 'x',
        type: 'category',
        autorange: 'reversed',
        tickfont: { size: 10.5, color: textInk, family: 'JetBrains Mono, monospace' },
        showgrid: false,
        zeroline: false,
      },
      ...(showMarginals
        ? {
            yaxis2: {
              domain: [0.78, 0.99],
              anchor: 'x',
              tickfont: { size: 9.5, color: subInk, family: 'JetBrains Mono, monospace' },
              gridcolor: gridStroke,
              zeroline: false,
              nticks: 4,
            },
            xaxis3: {
              domain: [0.80, 0.99],
              anchor: 'y',
              tickfont: { size: 9.5, color: subInk, family: 'JetBrains Mono, monospace' },
              gridcolor: gridStroke,
              zeroline: true,
              zerolinecolor: subInk,
              nticks: 4,
            },
          }
        : {}),
      shapes,
      annotations,
    };

    const config = {
      responsive: true,
      displayModeBar: true,
      displaylogo: false,
      modeBarButtonsToRemove: ['lasso2d', 'select2d', 'autoScale2d'],
    };

    const el = chartRef.current;
    window.Plotly.react(el, traces, layout, config);

    // Click handler on Plotly cells / marginals
    const handleClick = (evt) => {
      const pt = evt?.points?.[0];
      if (!pt) return;
      if (pt.curveNumber === 0) {
        const rIdx = yLabels.indexOf(pt.y);
        const cIdx = xLabels.indexOf(pt.x);
        const clicked = (rIdx >= 0 && cIdx >= 0) ? cells[rIdx]?.[cIdx] : null;
        if (clicked) {
          setSelectedCell(clicked);
          setFocusedHotspot?.({ strike: clicked.strike, expiry: clicked.expiry, iv: clicked.iv });
        }
      } else if (typeof pt.x === 'string' && xLabels.includes(pt.x)) {
        const cIdx = xLabels.indexOf(pt.x);
        const midR = Math.floor(nRows / 2);
        const clicked = cIdx >= 0 ? (cells[midR]?.[cIdx] || cells[0]?.[cIdx]) : null;
        if (clicked) setSelectedCell(clicked);
      } else if (typeof pt.y === 'string' && yLabels.includes(pt.y)) {
        const rIdx = yLabels.indexOf(pt.y);
        const midC = Math.floor(nCols / 2);
        const clicked = rIdx >= 0 ? cells[rIdx]?.[midC] : null;
        if (clicked) setSelectedCell(clicked);
      }
    };

    if (typeof el.removeAllListeners === 'function') {
      el.removeAllListeners('plotly_click');
    }
    if (typeof el.on === 'function') {
      el.on('plotly_click', handleClick);
    }

    return () => {
      if (el && typeof el.removeAllListeners === 'function') {
        el.removeAllListeners('plotly_click');
      }
    };
  }, [
    plotlyReady,
    slicedView,
    activeLens,
    coordMode,
    surfaceColor,
    surfaceBg,
    isLightTheme,
    showCellText,
    showMarginals,
    spot,
    selectedCell,
    heatmapPayload,
    setFocusedHotspot,
  ]);

  const handleChipClick = useCallback((chipCell) => {
    if (!chipCell) return;
    setSelectedCell(chipCell);
    if (coordMode === 'delta') {
      const exactRow = (heatmapPayload?.delta_grid?.cells || []).find((r) => r?.[0]?.expiry === chipCell.expiry) || [];
      const exactInDelta = exactRow.some((c) => Math.abs((c?.strike || 0) - chipCell.strike) <= 0.05);
      if (!exactInDelta) {
        setCoordMode('strike');
        lastParentStrikeRef.current = 'strike';
        setStrikeMode?.('strike');
      }
    }
    if (spot && Math.abs(chipCell.strike - spot) / spot > 0.14 && heatmapFilter !== 'all') {
      setHeatmapFilter?.('all');
    }
    setFocusedHotspot?.({ strike: chipCell.strike, expiry: chipCell.expiry, iv: chipCell.iv });
  }, [coordMode, heatmapPayload, spot, heatmapFilter, setHeatmapFilter, setStrikeMode, setFocusedHotspot]);

  // Multi-day IV trajectory for currently selected cell (10D -> 5D -> 3D -> 2D -> 1D)
  const cellTrajectory = useMemo(() => {
    if (!selectedCell || !slicedView || !interdayMotion?.available) return [];
    const { cells, rowIndices, matKey, priorKey } = slicedView;
    let visR = -1;
    let visC = -1;
    for (let r = 0; r < cells.length; r++) {
      if (cells[r]?.[0]?.expiry !== selectedCell.expiry) continue;
      let bestDist = Infinity;
      for (let c = 0; c < cells[r].length; c++) {
        const cand = cells[r][c];
        if (!cand) continue;
        const d = Math.abs((cand.strike || 0) - (selectedCell.strike || 0));
        if (d < bestDist) {
          bestDist = d;
          visR = r;
          visC = c;
        }
      }
      if (visR >= 0) break;
    }
    if (visR < 0 || visC < 0) return [];
    const origR = rowIndices[visR];
    const chrono = [...lookbackOrder].reverse();
    return chrono
      .map((lb) => {
        const lbData = interdayMotion.lookbacks?.[lb];
        const dv = lbData?.[matKey]?.[origR]?.[visC];
        const piv = lbData?.[priorKey]?.[origR]?.[visC];
        if (dv === null || dv === undefined || !Number.isFinite(dv)) return null;
        return {
          key: lb,
          date: lbData?.date || '',
          delta_iv: Number(dv),
          prior_iv: Number.isFinite(piv) ? Number(piv) : Math.max(4.0, (selectedCell.iv || 20) - Number(dv)),
        };
      })
      .filter(Boolean);
  }, [selectedCell, slicedView, interdayMotion, lookbackOrder]);

  // Build crisp action & spread suggestion for Inspector
  const inspectorAdvice = useMemo(() => {
    if (!selectedCell) return null;
    const { opt_type, strike, expiry, edge_vp, vrp_vp, is_tradable, iv, svi_iv } = selectedCell;
    const isRich = is_tradable && edge_vp >= 0.35;
    const isCheap = is_tradable && edge_vp <= -0.35;
    const highVrp = Number.isFinite(vrp_vp) && vrp_vp >= 2.0;
    const lowVrp = Number.isFinite(vrp_vp) && vrp_vp <= -1.5;

    let action = 'Fairly Priced — Monitor SVI Fit';
    let tone = 'neutral';
    let spread = `Hold / Wait for >= 0.35 vp net edge on ${expiry} $${strike} ${opt_type}`;

    if (isRich) {
      action = `SHORT VOL EDGE (+${edge_vp.toFixed(2)} vp net over SVI)`;
      tone = 'rich';
      spread = `Sell ${expiry} $${strike} ${opt_type} vs adjacent SVI-fair wing (Short Vertical / Fly)`;
    } else if (isCheap) {
      action = `LONG VOL EDGE (${edge_vp.toFixed(2)} vp net under SVI)`;
      tone = 'cheap';
      spread = `Buy ${expiry} $${strike} ${opt_type} vs richer ATM/front leg (Long Calendar / Ratio)`;
    } else if (highVrp) {
      action = `VRP OVERPRICED (+${vrp_vp.toFixed(1)} vp over HAR-YZ RV)`;
      tone = 'rich';
      spread = `Sell defined-risk credit spread centered near ${expiry} $${strike}`;
    } else if (lowVrp) {
      action = `CHEAP GAMMA (${vrp_vp.toFixed(1)} vp vs HAR-YZ RV)`;
      tone = 'cheap';
      spread = `Own convexity via ${expiry} $${strike} ${opt_type} debit spread`;
    }

    return {
      action,
      tone,
      spread,
      gapVp: Number.isFinite(iv) && Number.isFinite(svi_iv) ? iv - svi_iv : 0,
    };
  }, [selectedCell]);

  if (!heatmapPayload || !slicedView) {
    return (
      <div className="vhm-empty-state" data-testid="vol-heatmap-studio">
        <Activity size={20} className="text-sky-400" />
        <div>
          <strong>Vol Heatmap Studio v3.0</strong> is waiting for options chain calibration for {ticker || 'ticker'}.
        </div>
      </div>
    );
  }

  const verdict = heatmapPayload.verdict || {};
  const richCells = heatmapPayload.top_rich_cells || [];
  const cheapCells = heatmapPayload.top_cheap_cells || [];
  const tradableCount = heatmapPayload.tradable_edge_count ?? 0;
  const pennyFilteredCount = heatmapPayload.penny_filtered_count ?? 0;
  const calMetrics = activeData?.calibration_metrics || data?.calibration_metrics || {};
  const harCurve = data?.har_rv_curve || {};
  const staleFiltered = data?.despike_stats?.outliers_removed ?? data?.outliers_removed ?? 0;
  const activeLbObj = slicedView.activeLbObj;
  const activeInterdaySummary = activeLbObj?.summary || null;
  const expandCells = activeLbObj?.top_expanding || [];
  const crushCells = activeLbObj?.top_crushing || [];

  const activeLensObj = LENS_META.find((l) => l.id === activeLens) || LENS_META[0];

  return (
    <div
      className={`vhm-studio ${isLightTheme ? 'vhm-light' : 'vhm-dark'}`}
      data-testid="vol-heatmap-studio"
    >
      {/* 1. Regime & HAR-YZ Verdict Strip */}
      <div className="vhm-verdict-strip" data-testid="vol-heatmap-verdict-strip">
        <div className="vhm-verdict-left">
          <span
            className="vhm-verdict-badge"
            style={{
              backgroundColor: `${verdict.color || '#38bdf8'}22`,
              borderColor: `${verdict.color || '#38bdf8'}66`,
              color: verdict.color || '#38bdf8',
            }}
          >
            {verdict.badge || 'SVI CALIBRATED'}
          </span>
          <span className="vhm-verdict-headline">{verdict.headline || `${ticker} Volatility Surface`}</span>
        </div>
        <div className="vhm-verdict-kpis">
          <div className="vhm-vkpi">
            <span className="vhm-vkpi-lbl">30D ATM IV</span>
            <span className="vhm-vkpi-val">
              {Number.isFinite(verdict.atm_30d) ? `${verdict.atm_30d.toFixed(1)}%` : '—'}
            </span>
          </div>
          <div className="vhm-vkpi">
            <span className="vhm-vkpi-lbl">HAR-YZ 30D</span>
            <span className="vhm-vkpi-val">
              {Number.isFinite(verdict.har_30d) ? `${verdict.har_30d.toFixed(1)}%` : '—'}
            </span>
          </div>
          <div className="vhm-vkpi">
            <span className="vhm-vkpi-lbl">HAR VRP</span>
            <span
              className="vhm-vkpi-val"
              style={{
                color: (verdict.vrp_30d ?? 0) >= 1.5
                  ? '#f97316'
                  : (verdict.vrp_30d ?? 0) <= -1.0
                    ? '#10b981'
                    : '#38bdf8',
              }}
            >
              {Number.isFinite(verdict.vrp_30d) ? `${verdict.vrp_30d >= 0 ? '+' : ''}${verdict.vrp_30d.toFixed(1)} vp` : '—'}
            </span>
          </div>
          <div className="vhm-vkpi">
            <span className="vhm-vkpi-lbl">Tradable Edges</span>
            <span className="vhm-vkpi-val text-emerald-400">
              {tradableCount}
              {pennyFilteredCount > 0 ? (
                <small className="vhm-vkpi-sub"> ({pennyFilteredCount} penny gated)</small>
              ) : null}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Lens Switcher + Coordinate / Display Controls */}
      <div className="vhm-controls-row">
        <div className="vhm-lens-bar" data-testid="vol-heatmap-lens-bar">
          {LENS_META.map((lens) => {
            const Icon = lens.icon;
            const active = activeLens === lens.id;
            return (
              <button
                key={lens.id}
                type="button"
                data-testid={`vhm-lens-${lens.id}`}
                onClick={() => handleSelectLens(lens.id)}
                className={`vhm-pill-btn ${active ? 'vhm-pill-active' : ''}`}
                title={lens.desc}
              >
                <Icon size={13} />
                <span>{lens.label}</span>
              </button>
            );
          })}
        </div>

        <div className="vhm-coord-bar" data-testid="vol-heatmap-coord-bar">
          <div className="vhm-seg-group" title="X-Axis Coordinate System">
            <button
              type="button"
              data-testid="vhm-coord-delta"
              onClick={() => handleSelectCoordMode('delta')}
              className={`vhm-seg-btn ${coordMode === 'delta' ? 'vhm-seg-active' : ''}`}
            >
              10ΔP–10ΔC
            </button>
            <button
              type="button"
              data-testid="vhm-coord-strike"
              onClick={() => handleSelectCoordMode('strike')}
              className={`vhm-seg-btn ${coordMode === 'strike' ? 'vhm-seg-active' : ''}`}
            >
              Strike ($)
            </button>
            <button
              type="button"
              data-testid="vhm-coord-moneyness"
              onClick={() => handleSelectCoordMode('moneyness')}
              className={`vhm-seg-btn ${coordMode === 'moneyness' ? 'vhm-seg-active' : ''}`}
            >
              K/S %
            </button>
          </div>

          <button
            type="button"
            data-testid="vhm-toggle-values"
            onClick={() => setShowCellText((s) => !s)}
            className={`vhm-toggle-btn ${showCellText ? 'vhm-toggle-on' : ''}`}
            title="Show numeric cell labels inside grid"
          >
            {showCellText ? <Eye size={13} /> : <EyeOff size={13} />}
            <span>Values</span>
          </button>

          <button
            type="button"
            data-testid="vhm-toggle-marginals"
            onClick={() => setShowMarginals((s) => !s)}
            className={`vhm-toggle-btn ${showMarginals ? 'vhm-toggle-on' : ''}`}
            title="Synchronized Top Smile & Right Term/HAR-RV Marginals"
          >
            <BarChart2 size={13} />
            <span>Marginals</span>
          </button>

          <button
            type="button"
            data-testid="vhm-info-guide-btn"
            onClick={() => setShowInfoGuide((s) => !s)}
            className={`vhm-toggle-btn ${showInfoGuide ? 'vhm-toggle-on' : ''}`}
            title="Open Local Volatility & Vol Heatmap Info Guide"
          >
            <Info size={13} />
            <span>Info Guide</span>
          </button>
        </div>
      </div>

      {showInfoGuide && (
        <div className="vhm-guide-panel" data-testid="vhm-info-guide-panel">
          <div className="vhm-guide-hdr">
            <div className="vhm-guide-title">
              <Info size={14} className="text-sky-400" />
              <span>Vol Heatmap, Local Vol &amp; Trade Execution Guide</span>
            </div>

            <div className="vhm-guide-tabs">
              <button
                type="button"
                data-testid="vhm-guide-tab-concepts"
                onClick={() => setGuideTab('concepts')}
                className={`vhm-guide-tab ${guideTab === 'concepts' ? 'vhm-guide-tab-active' : ''}`}
              >
                1. VRP, SVI &amp; Local Vol
              </button>
              <button
                type="button"
                data-testid="vhm-guide-tab-playbooks"
                onClick={() => setGuideTab('playbooks')}
                className={`vhm-guide-tab ${guideTab === 'playbooks' ? 'vhm-guide-tab-active' : ''}`}
              >
                2. Trade Playbooks
              </button>
              <button
                type="button"
                data-testid="vhm-guide-tab-checklist"
                onClick={() => setGuideTab('checklist')}
                className={`vhm-guide-tab ${guideTab === 'checklist' ? 'vhm-guide-tab-active' : ''}`}
              >
                3. 5-Step Checklist
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowInfoGuide(false)}
              className="vhm-guide-close"
            >
              Close
            </button>
          </div>

          {guideTab === 'concepts' && (
            <>
              <div className="vhm-guide-grid">
                <div className="vhm-guide-card" data-testid="vhm-guide-card-vrp">
                  <strong>1. What is VRP (Volatility Risk Premium)?</strong>
                  <p>
                    <strong>VRP = Implied Vol (IV) − Realized Vol (HAR-YZ RV)</strong>. Think of it as the insurance markup option buyers pay over what the stock actually moves.
                  </p>
                  <ul className="vhm-guide-list">
                    <li><strong>HAR-YZ RV:</strong> Horizon-matched 5D–180D Corsi HAR Yang-Zhang OHLC realized volatility (captures overnight gaps + intraday range).</li>
                    <li><strong>Positive VRP (+, Orange):</strong> Options are expensive vs. actual movement → favor selling spreads / premium.</li>
                    <li><strong>Negative VRP (−, Green):</strong> Cheap gamma vs. realized movement → favor buying debit spreads / convexity.</li>
                  </ul>
                </div>

                <div className="vhm-guide-card" data-testid="vhm-guide-card-svi">
                  <strong>2. What is SVI (Stochastic Volatility Inspired)?</strong>
                  <p>
                    Gatheral&apos;s 5-parameter arbitrage-free smile curve modeling fair total variance <code>w(k) = σ_IV² · T</code> across strikes so put skew, ATM curvature, and call wings stay smooth.
                  </p>
                  <ul className="vhm-guide-list">
                    <li><strong>5 Parameters:</strong> <code>a</code> level, <code>b</code> wing slope, <code>ρ</code> put/call tilt, <code>m</code> shift, <code>σ</code> ATM bend.</li>
                    <li><strong>SVI Edge = Market IV − SVI Fair − Half Spread:</strong> Flags only real strike dislocations clearing ≥ ±0.35 vp (sub-8Δ / &lt;$0.15 penny wings gated).</li>
                    <li><strong>+Rich (Overhedged) / −Cheap (Underhedged):</strong> Tells you which exact strike is overpriced or underpriced vs. its own smile.</li>
                  </ul>
                </div>

                <div className="vhm-guide-card" data-testid="vhm-guide-card-localvol">
                  <strong>3. What is Local Volatility (σ_loc(K, T))?</strong>
                  <p>
                    <strong>Implied Vol</strong> is the <em>average speed</em> from today to expiration T. <strong>Local Vol</strong> is the <em>instantaneous speed</em> priced specifically at future date T and strike K, stripped of prior path.
                  </p>
                  <ul className="vhm-guide-list">
                    <li><strong>Steep Put Skew:</strong> Spikes ~2x IV slope on 10ΔP–25ΔP crash puts.</li>
                    <li><strong>Event Cliffs:</strong> Drops right after earnings/FOMC once front event variance clears.</li>
                    <li><strong>Contango Lift:</strong> Upward term structure lifts back-month local vol above IV.</li>
                  </ul>
                </div>

                <div className="vhm-guide-card" data-testid="vhm-guide-card-lenses">
                  <strong>4. All 6 Heatmap Lenses, Anchors &amp; Marginals</strong>
                  <ul className="vhm-guide-list">
                    <li><strong>IV / SVI Edge / VRP / Local Vol / Vega Heat:</strong> Switch lenses across surface level, strike mispricing, RV markup, forward cliffs, and OI×Vega depth.</li>
                    <li><strong>Interday ΔIV:</strong> Real Alpaca 1D–10D option bar changes with chronological <strong>▶ Replay</strong>.</li>
                    <li><strong>10ΔP–10ΔC (Sticky-Δ) vs. Strike ($):</strong> Sticky-Δ isolates pure smile repricing independent of spot gaps; Sticky-Strike tracks fixed contracts.</li>
                    <li><strong>Marginals:</strong> Top Mean vs. Front Smile; Right <strong>ATM IV vs. HAR-RV◆</strong> bars.</li>
                  </ul>
                </div>
              </div>

              <div className="vhm-guide-formula" data-testid="vhm-guide-formulas">
                <div><strong>VRP:</strong> <code>VRP(T) = IV(T) − HAR-YZ RV(T)</code></div>
                <div><strong>SVI Smile:</strong> <code>w(k) = a + b · [ ρ(k − m) + √((k − m)² + σ²) ]</code> <span>(enforces butterfly g(k) ≥ 0 &amp; PAVA calendar ∂w/∂T ≥ 0)</span></div>
                <div><strong>Dupire Local Vol:</strong> <code>σ_loc²(k, T) = (∂w/∂T) / [ (1 − k·w'/(2w))² − (w'²/4)(1/w + 1/4) + w''/2 ]</code></div>
              </div>
            </>
          )}

          {guideTab === 'playbooks' && (
            <div className="vhm-playbook-grid" data-testid="vhm-guide-playbooks">
              <div className="vhm-playbook-card">
                <div className="vhm-pb-hdr">
                  <strong>1. Sell Rich VRP / Overhedge Peak</strong>
                  <span className="vhm-pb-tag rich">SHORT VEGA</span>
                </div>
                <div className="vhm-pb-row"><span>Signal:</span> VRP ≥ +2.5 vp (ATM IV &gt; HAR-RV◆), orange <strong>RICH</strong> chip (SVI Edge ≥ +0.40 vp) in 15Δ–35Δ with strong Vega Heat.</div>
                <div className="vhm-pb-row"><span>Trade:</span> <strong>Short Vertical Credit Spread</strong> or <strong>Broken-Wing Butterfly</strong> — sell the rich strike and buy an adjacent fair/cheap wing (never naked sub-8Δ tails).</div>
                <div className="vhm-pb-row"><span>Exit / Risk:</span> Target 40–60% max credit or exit as SVI Edge normalizes toward 0; roll/cut if spot breaks short strike on rising Interday ΔIV.</div>
              </div>

              <div className="vhm-playbook-card">
                <div className="vhm-pb-hdr">
                  <strong>2. Buy Cheap Convexity / Post-Crush</strong>
                  <span className="vhm-pb-tag cheap">LONG GAMMA</span>
                </div>
                <div className="vhm-pb-row"><span>Signal:</span> VRP ≤ −1.5 vp (ATM IV &lt; HAR-RV◆) or green <strong>CHEAP</strong> chip (SVI Edge ≤ −0.40 vp), especially after sharp 1D front vol crush (−5 to −15 vp).</div>
                <div className="vhm-pb-row"><span>Trade:</span> <strong>Long Debit Spread</strong>, <strong>Long Calendar</strong>, or <strong>1×2 Backspread</strong> — own the discounted 15Δ–40Δ valley leg, financed by selling a richer leg.</div>
                <div className="vhm-pb-row"><span>Exit / Risk:</span> Scale out on Interday ΔIV expansion or directional move into strike; risk strictly capped at initial debit paid.</div>
              </div>

              <div className="vhm-playbook-card">
                <div className="vhm-pb-hdr">
                  <strong>3. Event / Forward Vol Cliff Calendar</strong>
                  <span className="vhm-pb-tag event">LOCAL VOL</span>
                </div>
                <div className="vhm-pb-row"><span>Signal:</span> <strong>Local Vol</strong> shows a hot pre-event expiry row followed by a cool post-event row, or Interday ΔIV shows <strong>FRONT STRESS BID</strong> (Term Twist ≥ +2.5 vp).</div>
                <div className="vhm-pb-row"><span>Trade:</span> <strong>Long Calendar</strong> or <strong>Diagonal Spread</strong> — sell the inflated front-event expiry (high local vol) and buy the cooler next expiry.</div>
                <div className="vhm-pb-row"><span>Exit / Risk:</span> Take profits immediately on post-event front crush; avoid holding unhedged short &lt;5 DTE gamma across binary gaps.</div>
              </div>

              <div className="vhm-playbook-card">
                <div className="vhm-pb-hdr">
                  <strong>4. Skew Steepening / Wing Rotation</strong>
                  <span className="vhm-pb-tag skew">SKEW RV</span>
                </div>
                <div className="vhm-pb-row"><span>Signal:</span> Interday <strong>Sticky-Δ</strong> (3D–10D) shows <strong>25Δ Skew Δ ≥ +2.0 vp</strong> while Local Vol spikes on 10ΔP–25ΔP and 25ΔC–10ΔC stays flat/cheap.</div>
                <div className="vhm-pb-row"><span>Trade:</span> <strong>Bullish Risk Reversal / Put Credit</strong> if support holds (sell rich 25ΔP to fund cheap 25ΔC), or <strong>Put Debit Spread</strong> in a downtrend (buy 40ΔP vs rich 15ΔP).</div>
                <div className="vhm-pb-row"><span>Exit / Risk:</span> Keep structures defined-risk; step aside if 10D backwardation + put panic keep accelerating lower.</div>
              </div>

              <div className="vhm-playbook-card">
                <div className="vhm-pb-hdr">
                  <strong>5. Interday Replay Mean-Reversion</strong>
                  <span className="vhm-pb-tag replay">10D → 1D</span>
                </div>
                <div className="vhm-pb-row"><span>Signal:</span> Run <strong>▶ Replay</strong> (10D → 1D) and catch extreme 1D front vol crush below HAR-RV◆, or panic <strong>FRONT STRESS BID</strong> (Term Twist &gt; +3 vp above HAR-RV).</div>
                <div className="vhm-pb-row"><span>Trade:</span> Fade panic spikes with <strong>defined-risk front credit spreads / condors</strong> targeting normalization toward back tenors; fade excess crushes with debit convexity.</div>
                <div className="vhm-pb-row"><span>Exit / Risk:</span> Reduce contract size when HAR-RV &gt; 40%; close once Front-vs-Back Term Twist compresses back toward flat.</div>
              </div>
            </div>
          )}

          {guideTab === 'checklist' && (
            <div className="vhm-checklist-grid" data-testid="vhm-guide-checklist">
              <div className="vhm-check-step">
                <span className="vhm-step-num">1</span>
                <div>
                  <strong>Check Vol Regime (Verdict + HAR-YZ VRP)</strong>
                  <p>Open <strong>VRP (HAR-YZ)</strong>. If ATM IV sits &gt; +2 vp above green HAR-RV◆ diamonds, favor Net Short Vega (credit spreads / calendars). If IV &lt; HAR-RV◆, favor Net Long Gamma/Vega (debit spreads / diagonals).</p>
                </div>
              </div>

              <div className="vhm-check-step">
                <span className="vhm-step-num">2</span>
                <div>
                  <strong>Check Forward Curve (IV Surface vs. Local Vol)</strong>
                  <p>Toggle <strong>Local Vol</strong> to inspect whether front premium is distorted by an upcoming earnings/FOMC cliff. Never buy a hot local-vol expiry naked right before an event crush.</p>
                </div>
              </div>

              <div className="vhm-check-step">
                <span className="vhm-step-num">3</span>
                <div>
                  <strong>Verify Interday Momentum (1D–10D Sticky-Δ)</strong>
                  <p>Click <strong>1D / 3D / 5D / 10D</strong> or <strong>▶ Replay</strong> in Sticky-Δ mode. Confirm whether vol is still expanding (wait for deceleration) or freshly crushed (opportunistic long convexity entry).</p>
                </div>
              </div>

              <div className="vhm-check-step">
                <span className="vhm-step-num">4</span>
                <div>
                  <strong>Filter Execution Quality (SVI Edge + Vega Heat)</strong>
                  <p>Click a <strong>RICH / CHEAP / EXPAND / CRUSH</strong> chip and inspect <strong>Cell Inspector</strong>: verify <code>Tradable</code> status (Net Edge ≥ ±0.35 vp), tight <strong>Bid/Ask IV</strong>, active <strong>Vol/OI</strong> &amp; <strong>Vega Heat</strong>, and coherent <strong>10D → 1D</strong> path.</p>
                </div>
              </div>

              <div className="vhm-check-step">
                <span className="vhm-step-num">5</span>
                <div>
                  <strong>Size Risk via B76 Greeks &amp; Verify 3D Fit</strong>
                  <p>Size spread legs using <strong>B76 Greeks (Vega / Gamma / Theta)</strong> so max loss ≤ 1–2% of equity, avoid unhedged short legs under 7–10 DTE, and click <strong>Inspect on 3D</strong> to confirm smooth surrounding strikes.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2B. Interday Lookback Selector + Replay (Always 1-click accessible) & Decomposition Summary */}
      {interdayMotion?.available && (
        <div className="vhm-interday-wrap">
          <div className="vhm-interday-bar" data-testid="vhm-interday-bar">
            <div className="vhm-interday-bar-left">
              <span className="vhm-interday-title">
                <Clock size={12} className="text-sky-400" />
                <span>Interday IV Move:</span>
              </span>
              <div className="vhm-seg-group">
                {lookbackOrder.map((lb) => {
                  const lbMeta = interdayMotion.lookbacks?.[lb];
                  const isActiveLb = activeLens === 'delta_iv' && interdayLookback === lb;
                  return (
                    <button
                      key={lb}
                      type="button"
                      data-testid={`vhm-lb-${lb}`}
                      onClick={() => handleSelectLookback(lb)}
                      className={`vhm-lb-btn ${isActiveLb ? 'vhm-lb-active' : ''}`}
                      title={lbMeta?.date ? `Compare live surface vs ${lbMeta.date} close ($${lbMeta.spot_then})` : `${lb} lookback`}
                    >
                      <span>{lb}</span>
                      {lbMeta?.date ? <small>{lbMeta.date.slice(5)}</small> : null}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                data-testid="vhm-interday-play"
                onClick={handleToggleReplay}
                className={`vhm-play-btn ${isReplaying ? 'vhm-play-active' : ''}`}
                title="Animate multi-day IV evolution chronologically from 10D -> 1D"
              >
                {isReplaying ? <Pause size={12} /> : <Play size={12} />}
                <span>{isReplaying ? 'Pause' : 'Replay'}</span>
              </button>
            </div>

            <div className="vhm-interday-bar-right">
              <span className="vhm-anchor-badge">
                {coordMode === 'delta' ? 'Sticky-Δ Smile' : 'Sticky-Strike Fixed K'}
              </span>
              {activeLbObj?.matched_contracts > 0 && (
                <span className="vhm-source-pill">
                  {interdayMotion.data_source === 'ALPACA_REAL_BARS' ? 'ALPACA REAL BARS' : 'MODEL FALLBACK'}
                  {' · '}{activeLbObj.matched_contracts} fits
                </span>
              )}
            </div>
          </div>

          {activeLens === 'delta_iv' && activeInterdaySummary && (
            <div className="vhm-interday-summary" data-testid="vhm-interday-summary">
              <div className="vhm-interday-sum-head">
                <span
                  className="vhm-verdict-badge"
                  style={{
                    backgroundColor: `${activeInterdaySummary.regime_color || '#38bdf8'}22`,
                    borderColor: `${activeInterdaySummary.regime_color || '#38bdf8'}66`,
                    color: activeInterdaySummary.regime_color || '#38bdf8',
                  }}
                >
                  {activeInterdaySummary.regime_badge}
                </span>
                <span className="vhm-interday-headline">
                  {activeLbObj?.date ? `${activeLbObj.label}: ` : ''}{activeInterdaySummary.headline}
                </span>
              </div>

              <div className="vhm-decomp-row">
                <div className="vhm-decomp-pill">
                  <span>Put Wing ΔIV</span>
                  <strong className={(activeInterdaySummary.put_wing_delta_iv ?? 0) >= 0 ? 'text-amber-400' : 'text-emerald-400'}>
                    {activeInterdaySummary.put_wing_delta_iv >= 0 ? '+' : ''}{activeInterdaySummary.put_wing_delta_iv?.toFixed(2)} vp
                  </strong>
                </div>
                <div className="vhm-decomp-pill">
                  <span>ATM ΔIV</span>
                  <strong className={(activeInterdaySummary.atm_delta_iv ?? 0) >= 0 ? 'text-amber-400' : 'text-emerald-400'}>
                    {activeInterdaySummary.atm_delta_iv >= 0 ? '+' : ''}{activeInterdaySummary.atm_delta_iv?.toFixed(2)} vp
                  </strong>
                </div>
                <div className="vhm-decomp-pill">
                  <span>Call Wing ΔIV</span>
                  <strong className={(activeInterdaySummary.call_wing_delta_iv ?? 0) >= 0 ? 'text-amber-400' : 'text-emerald-400'}>
                    {activeInterdaySummary.call_wing_delta_iv >= 0 ? '+' : ''}{activeInterdaySummary.call_wing_delta_iv?.toFixed(2)} vp
                  </strong>
                </div>
                <div className="vhm-decomp-pill">
                  <span>25Δ Skew Δ</span>
                  <strong>
                    {activeInterdaySummary.skew_shift_25d >= 0 ? '+' : ''}{activeInterdaySummary.skew_shift_25d?.toFixed(2)} vp
                  </strong>
                </div>
                <div className="vhm-decomp-pill">
                  <span>Front ≤25D</span>
                  <strong className={(activeInterdaySummary.front_delta_iv ?? 0) >= 0 ? 'text-amber-400' : 'text-emerald-400'}>
                    {activeInterdaySummary.front_delta_iv >= 0 ? '+' : ''}{activeInterdaySummary.front_delta_iv?.toFixed(2)} vp
                  </strong>
                </div>
                <div className="vhm-decomp-pill">
                  <span>Back ≥60D</span>
                  <strong className={(activeInterdaySummary.back_delta_iv ?? 0) >= 0 ? 'text-amber-400' : 'text-emerald-400'}>
                    {activeInterdaySummary.back_delta_iv >= 0 ? '+' : ''}{activeInterdaySummary.back_delta_iv?.toFixed(2)} vp
                  </strong>
                </div>
                <div className="vhm-decomp-pill">
                  <span>Term Twist</span>
                  <strong>
                    {activeInterdaySummary.term_twist >= 0 ? '+' : ''}{activeInterdaySummary.term_twist?.toFixed(2)} vp
                  </strong>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. Lens Subtitle & Actionable Strike Chips */}
      <div className="vhm-subbar" data-testid="vol-heatmap-chips">
        <div className="vhm-lens-explain">
          <Info size={13} className="text-sky-400 shrink-0" />
          <span>
            <strong>{activeLensObj.label}:</strong> {activeLensObj.desc}
            {activeLens === 'delta_iv' && activeLbObj?.date
              ? ` · Comparing Today vs ${activeLbObj.label} (Spot $${activeLbObj.spot_then})`
              : ''}
          </span>
        </div>

        <div className="vhm-chips-wrap">
          {activeLens === 'delta_iv' ? (
            expandCells.length === 0 && crushCells.length === 0 ? (
              <span className="vhm-chip-empty">
                <CheckCircle2 size={12} className="text-sky-400" />
                Muted surface drift on {interdayLookback} (&lt; 0.25 vp)
              </span>
            ) : (
              <>
                {expandCells.slice(0, 2).map((c, idx) => (
                  <button
                    key={`exp-${c.expiry}-${c.strike}-${idx}`}
                    type="button"
                    data-testid={`vhm-chip-expand-${idx}`}
                    onClick={() => handleChipClick(c)}
                    className="vhm-chip vhm-chip-rich"
                    title={`Largest ${interdayLookback} IV expansion: ${c.expiry} $${c.strike} ${c.opt_type} (Prior ${c.prior_iv}% -> Today ${c.iv}%)`}
                  >
                    <span>▲ EXPAND {c.expiry} ${c.strike}{c.opt_type === 'CALL' ? 'C' : 'P'}</span>
                    <strong>+{c.delta_iv?.toFixed(2)} vp</strong>
                  </button>
                ))}
                {crushCells.slice(0, 2).map((c, idx) => (
                  <button
                    key={`crush-${c.expiry}-${c.strike}-${idx}`}
                    type="button"
                    data-testid={`vhm-chip-crush-${idx}`}
                    onClick={() => handleChipClick(c)}
                    className="vhm-chip vhm-chip-cheap"
                    title={`Largest ${interdayLookback} IV crush: ${c.expiry} $${c.strike} ${c.opt_type} (Prior ${c.prior_iv}% -> Today ${c.iv}%)`}
                  >
                    <span>▼ CRUSH {c.expiry} ${c.strike}{c.opt_type === 'CALL' ? 'C' : 'P'}</span>
                    <strong>{c.delta_iv?.toFixed(2)} vp</strong>
                  </button>
                ))}
              </>
            )
          ) : richCells.length === 0 && cheapCells.length === 0 ? (
            <span className="vhm-chip-empty">
              <CheckCircle2 size={12} className="text-emerald-400" />
              No SVI net edges &ge; 0.35 vp ({pennyFilteredCount} penny tails gated)
            </span>
          ) : (
            <>
              {richCells.slice(0, 2).map((c, idx) => (
                <button
                  key={`rich-${c.expiry}-${c.strike}-${idx}`}
                  type="button"
                  data-testid={`vhm-chip-rich-${idx}`}
                  onClick={() => handleChipClick(c)}
                  className="vhm-chip vhm-chip-rich"
                  title={`Click to lock ${c.expiry} $${c.strike} ${c.opt_type} (${c.edge_vp >= 0 ? '+' : ''}${c.edge_vp} vp net edge)`}
                >
                  <span>RICH {c.expiry} ${c.strike}{c.opt_type === 'CALL' ? 'C' : 'P'}</span>
                  <strong>+{c.edge_vp?.toFixed(2)} vp</strong>
                </button>
              ))}
              {cheapCells.slice(0, 2).map((c, idx) => (
                <button
                  key={`cheap-${c.expiry}-${c.strike}-${idx}`}
                  type="button"
                  data-testid={`vhm-chip-cheap-${idx}`}
                  onClick={() => handleChipClick(c)}
                  className="vhm-chip vhm-chip-cheap"
                  title={`Click to lock ${c.expiry} $${c.strike} ${c.opt_type} (${c.edge_vp} vp net edge)`}
                >
                  <span>CHEAP {c.expiry} ${c.strike}{c.opt_type === 'CALL' ? 'C' : 'P'}</span>
                  <strong>{c.edge_vp?.toFixed(2)} vp</strong>
                </button>
              ))}
            </>
          )}
        </div>
      </div>

      {/* 4. Synchronized Plotly Heatmap + Marginals Canvas */}
      <div
        className="vhm-canvas-shell"
        data-testid="vol-heatmap-canvas"
        style={{
          background: surfaceBg,
          borderColor: isLightTheme ? 'rgba(15, 23, 42, 0.16)' : 'rgba(255, 255, 255, 0.09)',
        }}
      >
        <div ref={chartRef} style={{ width: '100%' }} />
      </div>

      {/* 5. Bottom Deck: Live Cell Inspector & Spread Desk + Backtest Validation Scorecard */}
      <div className="vhm-bottom-deck">
        {/* Cell Inspector */}
        <div className="vhm-card" data-testid="vol-heatmap-cell-inspector">
          <div className="vhm-card-hdr">
            <div className="vhm-card-title">
              <Crosshair size={15} className="text-sky-400" />
              <span>Cell Inspector &amp; Spread Desk</span>
            </div>
            {selectedCell && (
              <div className="vhm-cell-tag">
                <span>{selectedCell.expiry} ({selectedCell.dte}D)</span>
                <span>·</span>
                <strong>${selectedCell.strike} {selectedCell.opt_type}</strong>
                <span className="vhm-delta-pill">
                  {Number.isFinite(selectedCell.delta) ? `${Math.round(selectedCell.delta * 100)}Δ` : ''}
                </span>
              </div>
            )}
          </div>

          {selectedCell ? (
            <>
              <div className="vhm-insp-grid">
                <div className="vhm-stat">
                  <span className="vhm-stat-lbl">IV (Mkt / SVI)</span>
                  <span className="vhm-stat-val">
                    {selectedCell.iv?.toFixed(2)}% / <small>{selectedCell.svi_iv?.toFixed(2)}%</small>
                  </span>
                </div>
                <div className="vhm-stat">
                  <span className="vhm-stat-lbl">Bid / Ask IV</span>
                  <span className="vhm-stat-val">
                    {Number.isFinite(selectedCell.iv_bid) && Number.isFinite(selectedCell.iv_ask)
                      ? `${selectedCell.iv_bid.toFixed(1)}% / ${selectedCell.iv_ask.toFixed(1)}%`
                      : 'SVI Grid'}
                  </span>
                </div>
                <div className="vhm-stat">
                  <span className="vhm-stat-lbl">Net Edge (vs SVI)</span>
                  <span
                    className="vhm-stat-val"
                    style={{
                      color: selectedCell.is_tradable
                        ? (selectedCell.edge_vp > 0 ? '#f97316' : '#10b981')
                        : undefined,
                    }}
                  >
                    {selectedCell.edge_vp >= 0 ? '+' : ''}{selectedCell.edge_vp?.toFixed(2)} vp
                    <small> ({selectedCell.is_tradable ? 'Tradable' : 'Gated'})</small>
                  </span>
                </div>
                <div className="vhm-stat">
                  <span className="vhm-stat-lbl">HAR-YZ VRP</span>
                  <span
                    className="vhm-stat-val"
                    style={{
                      color: (selectedCell.vrp_vp ?? 0) >= 1.5
                        ? '#f97316'
                        : (selectedCell.vrp_vp ?? 0) <= -1.0
                          ? '#10b981'
                          : undefined,
                    }}
                  >
                    {Number.isFinite(selectedCell.vrp_vp)
                      ? `${selectedCell.vrp_vp >= 0 ? '+' : ''}${selectedCell.vrp_vp.toFixed(2)} vp`
                      : '—'}
                    <small> (RV {selectedCell.har_rv?.toFixed(1)}%)</small>
                  </span>
                </div>
                <div className="vhm-stat">
                  <span className="vhm-stat-lbl">B76 Greeks (V / G / Θ)</span>
                  <span className="vhm-stat-val">
                    {selectedCell.vega?.toFixed(2)} / {selectedCell.gamma?.toFixed(4)} / {selectedCell.theta?.toFixed(2)}
                  </span>
                </div>
                <div className="vhm-stat">
                  <span className="vhm-stat-lbl">Liq (Mid / Vol / OI)</span>
                  <span className="vhm-stat-val">
                    ${selectedCell.price?.toFixed(2)} · {selectedCell.volume ?? 0} / {selectedCell.oi ?? 0}
                  </span>
                </div>
              </div>

              {cellTrajectory.length > 0 && (
                <div className="vhm-cell-traj" data-testid="vhm-cell-trajectory">
                  <div className="vhm-cell-traj-lbl">
                    Multi-Day IV Move ({coordMode === 'delta' ? `${selectedCell.col || ''} Constant-Δ` : `$${selectedCell.strike} Fixed-K`} → Now {selectedCell.iv?.toFixed(1)}%)
                  </div>
                  <div className="vhm-cell-traj-row">
                    {cellTrajectory.map((pt) => {
                      const isExp = pt.delta_iv >= 0;
                      const isSelLb = activeLens === 'delta_iv' && interdayLookback === pt.key;
                      return (
                        <button
                          key={pt.key}
                          type="button"
                          onClick={() => handleSelectLookback(pt.key)}
                          className={`vhm-traj-chip ${isSelLb ? 'vhm-traj-active' : ''}`}
                          title={`Click to inspect ${pt.key} (${pt.date}) matrix — Prior ${pt.prior_iv.toFixed(1)}% -> Now ${selectedCell.iv?.toFixed(1)}%`}
                        >
                          <span className="vhm-traj-k">{pt.key}</span>
                          <span className="vhm-traj-piv">{pt.prior_iv.toFixed(1)}%</span>
                          <strong className={isExp ? 'text-amber-400' : 'text-emerald-400'}>
                            {isExp ? '+' : ''}{pt.delta_iv.toFixed(1)}
                          </strong>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {inspectorAdvice && (
                <div className={`vhm-advice vhm-advice-${inspectorAdvice.tone}`}>
                  <div className="vhm-advice-text">
                    <strong>{inspectorAdvice.action}</strong>
                    <span>{inspectorAdvice.spread}</span>
                  </div>
                  <button
                    type="button"
                    data-testid="vhm-inspect-3d-btn"
                    onClick={() => onSwitchTo3DFocus?.(selectedCell)}
                    className="vhm-3d-btn"
                  >
                    <Layers size={13} />
                    <span>Inspect on 3D</span>
                    <ArrowUpRight size={13} />
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="vhm-empty-note">Click any cell on the matrix to inspect Greeks, spread width, and SVI edge.</div>
          )}
        </div>

        {/* Backtest & Surface Integrity Scorecard */}
        <div className="vhm-card" data-testid="vol-heatmap-scorecard">
          <div className="vhm-card-hdr">
            <div className="vhm-card-title">
              <Sparkles size={15} className="text-emerald-400" />
              <span>Arbitrage &amp; HAR-YZ Validation Scorecard</span>
            </div>
            <span className="vhm-version-pill">{data?.model_version || 'svi_v3_1_hm'}</span>
          </div>

          <div className="vhm-score-grid">
            <div className="vhm-stat">
              <span className="vhm-stat-lbl">Bid-Ask Hit Rate</span>
              <span className="vhm-stat-val text-emerald-400">
                {Number.isFinite(calMetrics.bid_ask_hit_pct) ? `${calMetrics.bid_ask_hit_pct.toFixed(1)}%` : '—'}
              </span>
            </div>
            <div className="vhm-stat">
              <span className="vhm-stat-lbl">Holdout RMSE</span>
              <span className="vhm-stat-val">
                {Number.isFinite(calMetrics.holdout_rmse_vp) ? `${calMetrics.holdout_rmse_vp.toFixed(2)} vp` : '—'}
              </span>
            </div>
            <div className="vhm-stat">
              <span className="vhm-stat-lbl">Butterfly / Cal Arb-Free</span>
              <span className="vhm-stat-val text-emerald-400">
                {calMetrics.butterfly_arb_free_pct ?? 100}% / {calMetrics.calendar_arb_free_pct ?? 100}%
              </span>
            </div>
            <div className="vhm-stat">
              <span className="vhm-stat-lbl">HAR-YZ Multi-Horizon RV</span>
              <span className="vhm-stat-val">
                5D {harCurve.dte_5 ?? '—'}% · 30D {harCurve.dte_30 ?? '—'}% · 90D {harCurve.dte_90 ?? '—'}%
              </span>
            </div>
          </div>

          <div className="vhm-score-foot">
            <span>
              <AlertTriangle size={12} className="inline mr-1 text-amber-400" />
              {staleFiltered > 0 ? `${staleFiltered} stale spikes purged · ` : ''}
              {pennyFilteredCount} sub-8Δ/penny quotes gated · {detectedAirPockets?.length ?? 0} verified pockets
            </span>
            {verdict.backtest_note && (
              <span className="vhm-backtest-note">{verdict.backtest_note}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
