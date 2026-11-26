import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Camera, Info, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';

const LENS_CFG = {
  combined: {
    label: 'Combined Hedge Flow',
    short: 'Combined',
    cbLabel: 'Dealer Flow',
    posLabel: 'DEALER BUY FLOW (+)',
    negLabel: 'DEALER SELL FLOW (-)',
  },
  charm: {
    label: 'Pure Charm Decay',
    short: 'Charm',
    cbLabel: 'Charm Flow',
    posLabel: 'CHARM BUY BID (+)',
    negLabel: 'CHARM SELL DRAG (-)',
  },
  dex: {
    label: 'Net Delta (DEX)',
    short: 'Delta DEX',
    cbLabel: 'Net DEX',
    posLabel: 'NET LONG DELTA (+)',
    negLabel: 'NET SHORT DELTA (-)',
  },
  gex: {
    label: 'Gamma (GEX)',
    short: 'Gamma GEX',
    cbLabel: 'Net GEX',
    posLabel: 'LONG GAMMA PIN (+)',
    negLabel: 'SHORT GAMMA ACCEL (-)',
  },
};

const HEDGE_COLORSCALE = [
  [0.0, '#e11d48'],
  [0.18, '#be123c'],
  [0.35, '#6b1229'],
  [0.46, '#141e30'],
  [0.5, '#070b14'],
  [0.54, '#0c2321'],
  [0.65, '#065f46'],
  [0.82, '#10b981'],
  [1.0, '#00f0ff'],
];

const fmtM = (mVal, suffix = '') => {
  if (mVal === undefined || mVal === null || Number.isNaN(Number(mVal))) return `$0.0M${suffix}`;
  const n = Number(mVal);
  const absN = Math.abs(n);
  const sign = n < 0 ? '-' : '+';
  if (absN >= 1000) return `${sign}$${(absN / 1000).toFixed(2)}B${suffix}`;
  if (absN >= 100) return `${sign}$${absN.toFixed(0)}M${suffix}`;
  if (absN >= 10) return `${sign}$${absN.toFixed(1)}M${suffix}`;
  if (absN >= 0.05) return `${sign}$${absN.toFixed(2)}M${suffix}`;
  return `$0.0M${suffix}`;
};

const fmtCompact = (mVal) => {
  const n = Number(mVal) || 0;
  const absN = Math.abs(n);
  const sign = n < 0 ? '-' : '+';
  if (absN >= 1000) return `${sign}$${(absN / 1000).toFixed(1)}B`;
  if (absN >= 10) return `${sign}$${absN.toFixed(0)}M`;
  return `${sign}$${absN.toFixed(1)}M`;
};

const fmtShs = (shs) => {
  const n = Number(shs) || 0;
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '+';
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(2)}M shs`;
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(0)}K shs`;
  return `${sign}${abs.toFixed(0)} shs`;
};

const computeRobustZMax = (grid) => {
  const vals = [];
  (grid || []).forEach((row) => {
    (row || []).forEach((v) => {
      const a = Math.abs(Number(v) || 0);
      if (a > 0) vals.push(a);
    });
  });
  if (!vals.length) return 10;
  vals.sort((a, b) => a - b);
  const maxAbs = vals[vals.length - 1];
  const p92 = vals[Math.min(vals.length - 1, Math.floor(vals.length * 0.92))];
  return Math.max(0.1, Math.min(maxAbs, Math.max(p92 * 1.15, maxAbs * 0.24)));
};

const isDarkBadge = (bg) => ['#ffffff', '#00e676', '#00E676', '#00f0ff', '#00F0FF', '#fbbf24', '#38bdf8'].includes(bg);

function usePlotWidth(ref) {
  const [w, setW] = useState(1100);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const upd = () => { if (el.clientWidth > 0) setW(el.clientWidth); };
    upd();
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(upd);
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener('resize', upd);
    return () => window.removeEventListener('resize', upd);
  }, [ref]);
  return w;
}

export default function DeltaCharmMapStudio({
  ticker,
  spot,
  hedgeMap,
  keyLevels,
  expectedMove,
  plotlyReady,
}) {
  const [viewMode, setViewMode] = useState('studio'); // 'studio' | 'opex' | 'matrix'
  const [lens, setLens] = useState('combined'); // 'combined' | 'charm' | 'dex' | 'gex'
  const [scope, setScope] = useState('all'); // 'all' | 'weekly' | 'front'
  const [source, setSource] = useState('oi'); // 'oi' | 'vol'
  const [zoomMode, setZoomMode] = useState('smart'); // 'smart' | '5' | '8' | '10'
  const [smoothMode, setSmoothMode] = useState('smooth'); // 'smooth' | 'discrete'
  const [showSignals, setShowSignals] = useState(true);
  const [showLevels, setShowLevels] = useState(true);
  const [showZeroContour, setShowZeroContour] = useState(true);
  const [showGuide, setShowGuide] = useState(false);
  const [copiedKey, setCopiedKey] = useState(null);

  const plotRef = useRef(null);
  const plotWidth = usePlotWidth(plotRef);
  const spotVal = Number(spot || hedgeMap?.spot_price || 0);
  const lensInfo = LENS_CFG[lens] || LENS_CFG.combined;

  const scopeData = useMemo(() => {
    const sc = hedgeMap?.scopes?.[scope];
    if (sc && (sc.price_time_surface?.prices?.length || sc.opex_surface?.strikes?.length)) return sc;
    return hedgeMap?.scopes?.all || null;
  }, [hedgeMap, scope]);

  const pts = scopeData?.price_time_surface || {};
  const opx = scopeData?.opex_surface || {};
  const sum = scopeData?.summary || {};
  const hasLiveVol = Boolean(sum.has_live_vol ?? pts.has_live_vol);
  const useVol = source === 'vol' && hasLiveVol;

  const yBounds = useMemo(() => {
    if (!spotVal) return [0, 100];
    const pArr = pts?.prices || opx?.strikes || [];
    const pLo = pArr.length ? pArr[0] : spotVal * 0.90;
    const pHi = pArr.length ? pArr[pArr.length - 1] : spotVal * 1.10;

    if (zoomMode !== 'smart') {
      const pct = Number(zoomMode) / 100.0;
      return [
        Number(Math.max(pLo, spotVal * (1 - pct)).toFixed(2)),
        Number(Math.min(pHi, spotVal * (1 + pct)).toFixed(2)),
      ];
    }

    const cands = [spotVal * 0.935, spotVal * 1.065];
    if (expectedMove?.range_1d?.length === 2) {
      cands.push(Number(expectedMove.range_1d[0]) * 0.985, Number(expectedMove.range_1d[1]) * 1.015);
    }
    [sum.charm_pin_strike, sum.call_wall, sum.put_wall, sum.zero_gamma, sum.zero_hedge_pivot_5d].forEach((lvl) => {
      const n = Number(lvl);
      if (Number.isFinite(n) && n > 0 && Math.abs(n - spotVal) / spotVal <= 0.095) {
        cands.push(n > spotVal ? n * 1.007 : n * 0.993);
      }
    });
    return [
      Number(Math.max(pLo, Math.min(...cands)).toFixed(2)),
      Number(Math.min(pHi, Math.max(...cands)).toFixed(2)),
    ];
  }, [spotVal, pts, opx, zoomMode, expectedMove, sum]);

  const filteredOpex = useMemo(() => {
    const rawStrikes = opx?.strikes || [];
    const profile = opx?.strikes_profile || [];
    const exps = opx?.expirations || [];
    const [yMin, yMax] = yBounds;

    const getStrikeVal = (row) => {
      if (!row) return 0;
      if (lens === 'charm') return useVol ? row.vol_charm_1d_m : row.charm_1d_m;
      if (lens === 'dex') return useVol ? row.vol_dex_m : row.dex_m;
      if (lens === 'gex') return useVol ? row.vol_gex_m : row.gex_m;
      return useVol ? row.vol_combined_3d_m : row.combined_3d_m;
    };

    const gridKey = (() => {
      const pfx = useVol ? 'vol_' : '';
      if (lens === 'charm') return `${pfx}charm_1d_grid`;
      if (lens === 'dex') return `${pfx}dex_grid`;
      if (lens === 'gex') return `${pfx}gex_grid`;
      return `${pfx}combined_3d_grid`;
    })();
    const fullGrid = opx?.[gridKey] || opx?.combined_3d_grid || [];

    const inRangeIdx = [];
    rawStrikes.forEach((st, idx) => {
      if (st >= yMin && st <= yMax) inRangeIdx.push(idx);
    });
    const baseIdx = inRangeIdx.length >= 6 ? inRangeIdx : rawStrikes.map((_, i) => i);

    let chosenIdx = baseIdx;
    if (baseIdx.length > 30) {
      // Keep highest-impact strikes + nearest spot strikes so chart bars & rows stay readable
      const scored = baseIdx.map((idx) => {
        const st = rawStrikes[idx];
        const val = Math.abs(getStrikeVal(profile[idx]));
        const nearBoost = Math.abs(st - spotVal) / (spotVal || 1) < 0.015 ? 1e6 : 0;
        return { idx, score: val + nearBoost };
      });
      scored.sort((a, b) => b.score - a.score);
      chosenIdx = scored.slice(0, 30).map((x) => x.idx).sort((a, b) => a - b);
    }

    const activeRows = chosenIdx.map((idx) => ({
      ...(profile[idx] || { strike: rawStrikes[idx] }),
      active_val: Number(getStrikeVal(profile[idx]) || 0),
    }));
    const activeGrid = chosenIdx.map((idx) => fullGrid[idx] || exps.map(() => 0));
    return { activeRows, activeGrid, exps, allRangeIdx: baseIdx, fullProfile: profile, fullGrid };
  }, [opx, yBounds, lens, useVol, spotVal]);

  const handleExportPng = () => {
    if (!plotRef.current || !window.Plotly) return;
    try {
      window.Plotly.downloadImage(plotRef.current, {
        format: 'png',
        width: 1440,
        height: 800,
        filename: `${ticker}_delta_charm_studio_v3_${viewMode}_${lens}`,
      });
    } catch (err) {
      console.warn('Export PNG error:', err);
    }
  };

  useEffect(() => {
    const plotEl = plotRef.current;
    if (viewMode === 'matrix') {
      if (plotEl && window.Plotly) window.Plotly.purge(plotEl);
      return undefined;
    }
    if (!plotlyReady || !plotEl || !window.Plotly || !scopeData) return undefined;

    try {
      const isNarrow = plotWidth < 860;
      const leftEnd = isNarrow ? 0.21 : 0.23;
      const centerStart = leftEnd + (isNarrow ? 0.072 : 0.058);
      const centerEnd = isNarrow ? 0.835 : 0.86;
      const badgeX = centerEnd + 0.009;
      const [yMin, yMax] = yBounds;
      const ySpan = Math.max(0.5, yMax - yMin);

      const buildColorbar = (zClipDisp, hmUseB, titleTxt) => {
        const sfx = hmUseB ? 'B' : 'M';
        const rawHalf = Math.max(0.1, zClipDisp * 0.82);
        const niceTick = rawHalf >= 10
          ? Math.max(1, Math.round(rawHalf / (rawHalf >= 100 ? 25 : 5)) * (rawHalf >= 100 ? 25 : 5))
          : Number(rawHalf.toFixed(1));
        return {
          orientation: 'h',
          x: centerEnd,
          xanchor: 'right',
          y: 1.012,
          yanchor: 'bottom',
          len: isNarrow ? 0.30 : 0.24,
          thickness: 8,
          bgcolor: 'rgba(6, 9, 16, 0.75)',
          bordercolor: 'rgba(255, 255, 255, 0.12)',
          borderwidth: 1,
          tickvals: [-niceTick, 0, niceTick],
          ticktext: [`-${niceTick}${sfx}`, `0${sfx}`, `+${niceTick}${sfx}`],
          tickfont: { color: '#cbd5e1', family: 'JetBrains Mono, monospace', size: 8.2 },
          title: {
            text: titleTxt,
            side: 'top',
            font: { color: '#94a3b8', family: 'JetBrains Mono, monospace', size: 8.2 },
          },
        };
      };

      const levelDefs = [
        { key: 'spot', val: spotVal, label: `SPOT $${spotVal.toFixed(1)}`, line: '#ffffff', bg: '#ffffff', w: 2.0, dash: 'dash' },
        { key: 'pin', val: Number(sum.charm_pin_strike), label: `PIN $${Number(sum.charm_pin_strike || 0).toFixed(0)}`, line: '#fbbf24', bg: '#fbbf24', w: 1.4, dash: 'dot' },
        { key: 'cw', val: Number(sum.call_wall), label: `CW $${Number(sum.call_wall || 0).toFixed(0)}`, line: '#ff3366', bg: '#ff3366', w: 1.5, dash: 'dot' },
        { key: 'pw', val: Number(sum.put_wall), label: `PW $${Number(sum.put_wall || 0).toFixed(0)}`, line: '#00E676', bg: '#00E676', w: 1.5, dash: 'dot' },
        { key: 'zg', val: Number(sum.zero_gamma), label: `FLIP $${Number(sum.zero_gamma || 0).toFixed(1)}`, line: '#00F0FF', bg: '#00F0FF', w: 1.5, dash: 'dashdot' },
      ];

      // =========================================================================
      // VIEW 1: STUDIO (Strike Bars | Price x Time-to-OpEx Heatmap | Charm Timeline)
      // =========================================================================
      if (viewMode === 'studio' && pts?.prices?.length) {
        const prices = pts.prices;
        const pctArr = pts.pct_from_spot || prices.map((p) => ((p - spotVal) / (spotVal || 1)) * 100);
        const tLabels = pts.time_labels || [];

        const pfx = useVol ? 'vol_' : '';
        const hmGrid = (
          lens === 'charm' ? pts[`${pfx}charm_flow_m`]
            : lens === 'dex' ? pts[`${pfx}dex_m`]
            : lens === 'gex' ? pts[`${pfx}gex_m`]
            : pts[`${pfx}combined_flow_m`]
        ) || pts.combined_flow_m || [];

        const zClip = computeRobustZMax(hmGrid);
        const hmUseB = zClip >= 1000;
        const zDisp = hmUseB ? hmGrid.map((r) => r.map((v) => v / 1000)) : hmGrid;
        const zClipDisp = hmUseB ? zClip / 1000 : zClip;
        const unitSfx = hmUseB ? '$B' : '$M';

        const ladRows = filteredOpex.activeRows;
        const ladVals = ladRows.map((r) => r.active_val);
        const maxLad = Math.max(...ladVals.map((v) => Math.abs(v)), 0.1);
        const ladUseB = maxLad >= 1000;
        const ladPlotVals = ladUseB ? ladVals.map((v) => v / 1000) : ladVals;

        const hmHover = prices.map((p, rIdx) => {
          const pct = pctArr[rIdx] ?? 0;
          return tLabels.map((tLbl, cIdx) => {
            const rawV = Number(hmGrid[rIdx]?.[cIdx] || 0);
            const meaning = rawV >= 0 ? lensInfo.posLabel : lensInfo.negLabel;
            return (
              `<b>Spot $${p.toFixed(2)} (${pct >= 0 ? '+' : ''}${Number(pct).toFixed(1)}%)</b><br>` +
              `Horizon: <b>${tLbl}</b> · ${scopeData.expiry_label}<br>` +
              `${lensInfo.cbLabel}: <b>${fmtM(rawV)}</b><br>` +
              `<span>${meaning}</span>`
            );
          });
        });

        const slots = pts.timeline_at_spot || [];
        const stepVals = slots.map((s) => Number(s.step_charm_m || 0));
        const cumVals = slots.map((s) => Number(useVol ? (s.vol_cum_charm_m ?? s.cum_charm_m) : s.cum_charm_m || 0));
        const maxClk = Math.max(...cumVals.map(Math.abs), ...stepVals.map(Math.abs), 0.1);
        const clkUseB = maxClk >= 1000;
        const stepPlot = clkUseB ? stepVals.map((v) => v / 1000) : stepVals;
        const cumPlot = clkUseB ? cumVals.map((v) => v / 1000) : cumVals;

        const traces = [
          // 1. Left Strike Pressure Bars
          {
            type: 'bar',
            orientation: 'h',
            name: `${lensInfo.short} Strike Profile`,
            x: ladPlotVals,
            y: ladRows.map((r) => r.strike),
            xaxis: 'x',
            yaxis: 'y',
            showlegend: false,
            marker: {
              color: ladVals.map((v) => (v >= 0 ? 'rgba(0, 230, 118, 0.84)' : 'rgba(255, 51, 102, 0.84)')),
              line: { color: ladVals.map((v) => (v >= 0 ? '#00E676' : '#ff3366')), width: 0.7 },
            },
            customdata: ladRows.map((r) => [fmtM(r.active_val), fmtM(r.charm_1d_m), fmtM(r.dex_m), r.charm_gravity_pct]),
            hovertemplate: '<b>Strike $%{y:.2f}</b><br>' + lensInfo.short + ': <b>%{customdata[0]}</b><br>1D Charm: %{customdata[1]} · DEX: %{customdata[2]}<br>Pin Gravity: <b>%{customdata[3]}%</b><extra></extra>',
          },
          // 2. Charm Pin Gravity Overlay on hidden xaxis4
          {
            type: 'scatter',
            mode: 'lines',
            name: 'Pin Gravity %',
            x: ladRows.map((r) => r.charm_gravity_pct || 0),
            y: ladRows.map((r) => r.strike),
            xaxis: 'x4',
            yaxis: 'y',
            showlegend: false,
            line: { color: 'rgba(251, 191, 36, 0.72)', width: 1.5, dash: 'dot' },
            hoverinfo: 'skip',
          },
          // 3. Center Price x Time-to-OpEx Heatmap
          {
            type: 'heatmap',
            name: lensInfo.label,
            x: tLabels,
            y: prices,
            z: zDisp,
            text: hmHover,
            hoverinfo: 'text',
            xaxis: 'x2',
            yaxis: 'y2',
            zsmooth: smoothMode === 'smooth' ? 'best' : false,
            colorscale: HEDGE_COLORSCALE,
            zmid: 0,
            zmin: -zClipDisp,
            zmax: zClipDisp,
            colorbar: buildColorbar(zClipDisp, hmUseB, `${lensInfo.cbLabel} (${unitSfx})`),
          },
          // 4. Bottom Charm Step Bars
          {
            type: 'bar',
            name: 'Step Charm',
            x: tLabels,
            y: stepPlot,
            xaxis: 'x3',
            yaxis: 'y3',
            showlegend: false,
            marker: { color: stepVals.map((v) => (v >= 0 ? 'rgba(0, 230, 118, 0.65)' : 'rgba(255, 51, 102, 0.65)')) },
            customdata: slots.map((s) => [fmtM(s.step_charm_m), fmtM(s.cum_charm_m)]),
            hovertemplate: '<b>%{x}</b><br>Step Charm: <b>%{customdata[0]}</b> · Cum: <b>%{customdata[1]}</b><extra></extra>',
          },
          // 5. Bottom Cumulative Charm Line
          {
            type: 'scatter',
            mode: 'lines+markers',
            name: 'Cum Charm',
            x: tLabels,
            y: cumPlot,
            xaxis: 'x3',
            yaxis: 'y3',
            showlegend: false,
            line: { color: '#c084fc', width: 2.3 },
            marker: { size: 4.5, color: '#00F0FF' },
            customdata: cumVals.map((v) => fmtM(v)),
            hovertemplate: '<b>%{x} Cum Charm: %{customdata}</b><extra></extra>',
          },
        ];

        // Zero-Hedge Pivot Contour Curve across Time
        if (showZeroContour && Array.isArray(pts.zero_hedge_pivots)) {
          const validPts = pts.zero_hedge_pivots
            .map((pv, i) => ({ t: tLabels[i], p: Number(pv) }))
            .filter((pt) => Number.isFinite(pt.p) && pt.p >= yMin && pt.p <= yMax);
          if (validPts.length >= 2) {
            traces.push({
              type: 'scatter',
              mode: 'lines+markers',
              name: 'Zero-Hedge Pivot',
              x: validPts.map((pt) => pt.t),
              y: validPts.map((pt) => pt.p),
              xaxis: 'x2',
              yaxis: 'y2',
              showlegend: false,
              line: { color: '#00F0FF', width: 2.1, dash: 'dashdot' },
              marker: { size: 5, color: '#00F0FF', line: { color: '#040812', width: 1 } },
              hovertemplate: '<b>Zero-Hedge Equilibrium @ %{x}</b>: $%{y:.2f}<extra></extra>',
            });
          }
        }

        const shapes = [
          {
            type: 'line',
            xref: 'x2',
            yref: 'y2',
            x0: 5.5,
            x1: 5.5,
            y0: yMin,
            y1: yMax,
            line: { color: 'rgba(255, 255, 255, 0.35)', width: 1.3, dash: 'dash' },
          },
          {
            type: 'rect',
            xref: 'x3',
            yref: 'y3 domain',
            x0: 1.6,
            x1: 4.4,
            y0: 0,
            y1: 1,
            fillcolor: 'rgba(192, 132, 252, 0.11)',
            line: { color: 'rgba(192, 132, 252, 0.32)', width: 1, dash: 'dot' },
          },
          {
            type: 'rect',
            xref: 'paper',
            yref: 'paper',
            x0: 0.0,
            x1: leftEnd,
            y0: 0.0,
            y1: 0.175,
            fillcolor: 'rgba(11, 17, 30, 0.94)',
            line: { color: 'rgba(0, 240, 255, 0.28)', width: 1 },
          },
        ];

        const annotations = [
          {
            xref: 'paper',
            yref: 'paper',
            x: 0.0,
            y: 1.015,
            xanchor: 'left',
            yanchor: 'bottom',
            showarrow: false,
            text: `<b>${lensInfo.short.toUpperCase()} (${ladUseB ? '$B' : '$M'})</b>`,
            font: { color: '#94a3b8', size: 8.8, family: 'JetBrains Mono, monospace' },
          },
          {
            xref: 'paper',
            yref: 'paper',
            x: centerStart,
            y: 1.015,
            xanchor: 'left',
            yanchor: 'bottom',
            showarrow: false,
            text: isNarrow ? `<b>2D HEDGE SURFACE (${ticker})</b>` : `<b>PRICE × TIME DEALER FLOW SURFACE · ${ticker}</b>`,
            font: { color: '#e2e8f0', size: 9.5, family: 'JetBrains Mono, monospace' },
          },
          {
            xref: 'paper',
            yref: 'paper',
            x: centerStart,
            y: 0.165,
            xanchor: 'left',
            yanchor: 'bottom',
            showarrow: false,
            text: `<b>CHARM TIMELINE</b> <span style="color:#94a3b8">(13:30-15:30 O'Clock Shaded)</span>`,
            font: { color: '#c084fc', size: isNarrow ? 7.8 : 8.5, family: 'JetBrains Mono, monospace' },
          },
          {
            xref: 'paper',
            yref: 'paper',
            x: 0.008,
            y: 0.165,
            xanchor: 'left',
            yanchor: 'top',
            align: 'left',
            showarrow: false,
            font: { color: '#cbd5e1', size: isNarrow ? 7.6 : 8.3, family: 'JetBrains Mono, monospace' },
            text: isNarrow
              ? `<b style="color:#00F0FF">HEDGE DESK</b><br>` +
                `<b style="color:${sum.regime_color || '#00F0FF'}">${sum.regime_short || 'BALANCED'}</b><br>` +
                `O'Clk: <b>${fmtCompact(sum.oclock_charm_m)}</b><br>` +
                `Pin: <b style="color:#fbbf24">$${Number(sum.charm_pin_strike || 0).toFixed(0)}</b>`
              : `<b style="color:#00F0FF">HEDGE FLOW DESK</b><br>` +
                `Bias: <b style="color:${sum.regime_color || '#00F0FF'}">${sum.regime_short || 'BALANCED'}</b><br>` +
                `O'Clk: <b>${fmtCompact(sum.oclock_charm_m)}</b> · +5D $${Number(sum.zero_hedge_pivot_5d || spotVal).toFixed(1)}<br>` +
                `Peak: <b style="color:#fbbf24">${sum.peak_expiry_label || '--'}</b>`,
          },
        ];

        const placedBadgeNy = [];
        levelDefs.forEach((lvl) => {
          if (!Number.isFinite(lvl.val) || lvl.val < yMin || lvl.val > yMax) return;
          if (!showLevels && lvl.key !== 'spot') return;
          shapes.push({
            type: 'line',
            xref: 'x2',
            yref: 'y2',
            x0: -0.5,
            x1: tLabels.length - 0.5,
            y0: lvl.val,
            y1: lvl.val,
            line: { color: lvl.line, width: lvl.w, dash: lvl.dash },
          });
          if (lvl.key === 'spot') {
            shapes.push({
              type: 'line',
              xref: 'x domain',
              yref: 'y',
              x0: 0,
              x1: 1,
              y0: lvl.val,
              y1: lvl.val,
              line: { color: '#ffffff', width: 1.4, dash: 'dash' },
            });
          }
          const ny = (lvl.val - yMin) / ySpan;
          if (ny >= 0.04 && ny <= 0.96 && !placedBadgeNy.some((p) => Math.abs(p - ny) < 0.09)) {
            placedBadgeNy.push(ny);
            annotations.push({
              xref: 'paper',
              yref: 'y2',
              x: badgeX,
              y: lvl.val,
              xanchor: 'left',
              yanchor: 'middle',
              showarrow: false,
              text: `<b>${lvl.label}</b>`,
              font: { color: isDarkBadge(lvl.bg) ? '#040812' : '#ffffff', size: isNarrow ? 8 : 8.8, family: 'JetBrains Mono, monospace' },
              bgcolor: lvl.bg,
              borderpad: 2.5,
            });
          }
        });

        // Pixel-Exact Non-Overlapping Signal Beacons
        const rawSigs = (pts.trade_signals || []).filter(
          (s) => Number.isFinite(s.price) && s.price >= yMin + 0.04 * ySpan && s.price <= yMax - 0.04 * ySpan
        );
        if (showSignals && rawSigs.length > 0) {
          const marginL = isNarrow ? 54 : 62;
          const marginR = isNarrow ? 76 : 88;
          const marginT = 54;
          const marginB = 34;
          const paperW = Math.max(420, plotWidth - marginL - marginR);
          const paperH = 495 - marginT - marginB;
          const subW = paperW * (centerEnd - centerStart);
          const subH = paperH * (0.98 - 0.29);
          const nCols = Math.max(2, tLabels.length);
          const spotPy = (1 - (spotVal - yMin) / ySpan) * subH;

          // Pre-reserve Spot horizontal line band (for callout pill boxes) + each triangle marker (skipping self)
          const spotBand = { x0: 0, x1: subW, y0: spotPy - 12, y1: spotPy + 12, owner: -1 };
          const reservedRects = [];
          const sigItems = rawSigs.slice(0, 3).map((sig, sIdx) => {
            const xIdx = Number(sig.x_idx ?? 6);
            const mx = ((xIdx + 0.5) / nCols) * subW;
            const my = (1 - (sig.price - yMin) / ySpan) * subH;
            reservedRects.push({ x0: mx - 13, x1: mx + 13, y0: my - 13, y1: my + 13, owner: sIdx });
            const valSig = lens === 'charm' ? sig.charm_m : (lens === 'dex' ? sig.dex_m : (lens === 'gex' ? sig.gex_m : sig.combined_m));
            return { ...sig, sIdx, mx, my, valSig: valSig ?? sig.combined_m, isBuy: (valSig ?? sig.combined_m) >= 0 };
          });

          const activeSigs = [];
          sigItems.forEach((sig) => {
            const labelPlain = `${sig.short_label} · $${sig.price.toFixed(0)} (${fmtCompact(sig.valSig)})`;
            const boxW = labelPlain.length * (isNarrow ? 5.3 : 5.7) + 14;
            const boxH = 21;

            const xOpts = sig.mx > subW * 0.45
              ? [{ ax: -18, xanchor: 'right' }, { ax: -34, xanchor: 'right' }, { ax: 16, xanchor: 'left' }]
              : [{ ax: 18, xanchor: 'left' }, { ax: 34, xanchor: 'left' }, { ax: -16, xanchor: 'right' }];
            const yOpts = [
              { ay: -20, yanchor: 'bottom' },
              { ay: 0, yanchor: 'middle' },
              { ay: 22, yanchor: 'top' },
              { ay: -42, yanchor: 'bottom' },
              { ay: 42, yanchor: 'top' },
            ];

            let chosen = null;
            for (const xc of xOpts) {
              for (const yc of yOpts) {
                const bx0 = xc.xanchor === 'left' ? sig.mx + xc.ax : sig.mx + xc.ax - boxW;
                const bx1 = bx0 + boxW;
                const by0 = yc.yanchor === 'bottom'
                  ? sig.my + yc.ay - boxH
                  : (yc.yanchor === 'top' ? sig.my + yc.ay : sig.my - boxH / 2);
                const by1 = by0 + boxH;
                if (bx0 < 4 || bx1 > subW - 4 || by0 < 4 || by1 > subH - 4) continue;
                // Ensure pill box stays clear of horizontal Spot band
                const hitsSpot = !(bx1 < spotBand.x0 || bx0 > spotBand.x1 || by1 + 3 < spotBand.y0 || by0 - 3 > spotBand.y1);
                if (hitsSpot) continue;
                // Check union of pill box + arrow tip against all OTHER signals and placed annotations
                const ux0 = Math.min(bx0, sig.mx - 10) - 6;
                const ux1 = Math.max(bx1, sig.mx + 10) + 6;
                const uy0 = Math.min(by0, sig.my - 10) - 6;
                const uy1 = Math.max(by1, sig.my + 10) + 6;
                const hit = reservedRects.some((r) => r.owner !== sig.sIdx && !(ux1 < r.x0 || ux0 > r.x1 || uy1 < r.y0 || uy0 > r.y1));
                if (!hit) {
                  chosen = { ...xc, ...yc, ux0, ux1, uy0, uy1 };
                  break;
                }
              }
              if (chosen) break;
            }

            if (chosen) {
              reservedRects.push({ x0: chosen.ux0, x1: chosen.ux1, y0: chosen.uy0, y1: chosen.uy1, owner: sig.sIdx });
              activeSigs.push(sig);
              const brd = sig.isBuy ? '#00E676' : '#ff3366';
              annotations.push({
                xref: 'x2',
                yref: 'y2',
                x: sig.t,
                y: sig.price,
                text: `<b>${sig.short_label}</b> · $${sig.price.toFixed(0)} (${fmtCompact(sig.valSig)})`,
                showarrow: true,
                arrowhead: 2,
                arrowsize: 0.7,
                arrowwidth: 1.2,
                arrowcolor: brd,
                ax: chosen.ax,
                ay: chosen.ay,
                xanchor: chosen.xanchor,
                yanchor: chosen.yanchor,
                font: { color: '#ffffff', size: isNarrow ? 7.6 : 8.4, family: 'JetBrains Mono, monospace' },
                bgcolor: sig.isBuy ? 'rgba(6, 78, 59, 0.94)' : 'rgba(127, 29, 29, 0.94)',
                bordercolor: brd,
                borderwidth: 1,
                borderpad: 2.5,
              });
            }
          });

          const buyB = activeSigs.filter((s) => s.isBuy);
          const sellB = activeSigs.filter((s) => !s.isBuy);
          if (buyB.length) {
            traces.push({
              type: 'scatter',
              mode: 'markers',
              name: 'Buy Beacons',
              x: buyB.map((s) => s.t),
              y: buyB.map((s) => s.price),
              xaxis: 'x2',
              yaxis: 'y2',
              showlegend: false,
              marker: { symbol: 'triangle-up', size: 11, color: '#00E676', line: { color: '#ffffff', width: 1.3 } },
              hovertemplate: '<b>BUY Beacon</b> · $%{y:.2f} @ %{x}<extra></extra>',
            });
          }
          if (sellB.length) {
            traces.push({
              type: 'scatter',
              mode: 'markers',
              name: 'Sell Beacons',
              x: sellB.map((s) => s.t),
              y: sellB.map((s) => s.price),
              xaxis: 'x2',
              yaxis: 'y2',
              showlegend: false,
              marker: { symbol: 'triangle-down', size: 11, color: '#ff3366', line: { color: '#ffffff', width: 1.3 } },
              hovertemplate: '<b>SELL Beacon</b> · $%{y:.2f} @ %{x}<extra></extra>',
            });
          }
        }

        const layout = {
          paper_bgcolor: '#060910',
          plot_bgcolor: '#070b14',
          margin: { l: isNarrow ? 54 : 62, r: isNarrow ? 76 : 88, t: 54, b: 34 },
          hovermode: 'closest',
          dragmode: 'pan',
          hoverlabel: {
            bgcolor: 'rgba(10, 14, 23, 0.96)',
            bordercolor: '#334155',
            font: { family: 'JetBrains Mono, monospace', size: 10.5, color: '#f8fafc' },
          },
          shapes,
          annotations,
          showlegend: false,
          xaxis: {
            domain: [0.0, leftEnd],
            anchor: 'y',
            nticks: 3,
            ticksuffix: ladUseB ? 'B' : 'M',
            tickfont: { color: '#94a3b8', family: 'JetBrains Mono, monospace', size: 8.2 },
            gridcolor: 'rgba(255,255,255,0.05)',
            zeroline: true,
            zerolinecolor: '#64748b',
            zerolinewidth: 1.4,
          },
          xaxis4: {
            overlaying: 'x',
            side: 'top',
            range: [0, 108],
            showticklabels: false,
            showgrid: false,
            zeroline: false,
          },
          yaxis: {
            domain: [0.29, 0.98],
            range: [yMin, yMax],
            tickprefix: '$',
            tickfont: { color: '#cbd5e1', family: 'JetBrains Mono, monospace', size: isNarrow ? 8.8 : 9.6 },
            gridcolor: 'rgba(255,255,255,0.06)',
          },
          xaxis2: {
            domain: [centerStart, centerEnd],
            anchor: 'y2',
            type: 'category',
            categoryorder: 'array',
            categoryarray: tLabels,
            tickfont: { color: '#cbd5e1', family: 'JetBrains Mono, monospace', size: isNarrow ? 8.2 : 9 },
            gridcolor: 'rgba(255,255,255,0.04)',
          },
          yaxis2: {
            domain: [0.29, 0.98],
            range: [yMin, yMax],
            matches: 'y',
            anchor: 'x2',
            showticklabels: false,
            gridcolor: 'rgba(255,255,255,0.05)',
          },
          xaxis3: {
            domain: [centerStart, centerEnd],
            anchor: 'y3',
            type: 'category',
            categoryorder: 'array',
            categoryarray: tLabels,
            showticklabels: false,
            gridcolor: 'rgba(255,255,255,0.05)',
          },
          yaxis3: {
            domain: [0.02, 0.155],
            anchor: 'x3',
            ticksuffix: clkUseB ? 'B' : 'M',
            nticks: 3,
            tickfont: { color: '#94a3b8', family: 'JetBrains Mono, monospace', size: 8.2 },
            gridcolor: 'rgba(255,255,255,0.05)',
            zeroline: true,
            zerolinecolor: '#64748b',
          },
        };

        window.Plotly.react(plotEl, traces, layout, { responsive: true, displayModeBar: false });
        return undefined;
      }

      // =========================================================================
      // VIEW 2: CATEGORICAL OPEX MAP (Strike Bars | Strike x Expiry | Exp Cliff)
      // =========================================================================
      if (viewMode === 'opex' && filteredOpex.activeRows.length && filteredOpex.exps.length) {
        const rows = filteredOpex.activeRows;
        const grid = filteredOpex.activeGrid;
        const exps = filteredOpex.exps;
        const rowLabels = rows.map((r) => `$${r.strike}`);
        const expLabels = exps.map((e) => (e.expiry && e.expiry.length >= 10 ? e.expiry.slice(5).replace('-', '/') : (e.short_label || e.label)));

        const zClip = computeRobustZMax(grid);
        const hmUseB = zClip >= 1000;
        const zDisp = hmUseB ? grid.map((r) => r.map((v) => v / 1000)) : grid;
        const zClipDisp = hmUseB ? zClip / 1000 : zClip;
        const unitSfx = hmUseB ? '$B' : '$M';

        const ladVals = rows.map((r) => r.active_val);
        const maxLad = Math.max(...ladVals.map((v) => Math.abs(v)), 0.1);
        const ladUseB = maxLad >= 1000;
        const ladPlot = ladUseB ? ladVals.map((v) => v / 1000) : ladVals;

        const hmHover = rows.map((r, rIdx) => {
          return exps.map((em, cIdx) => {
            const v = Number(grid[rIdx]?.[cIdx] || 0);
            const meaning = v >= 0 ? lensInfo.posLabel : lensInfo.negLabel;
            return (
              `<b>Strike $${r.strike} (${r.pct_from_spot >= 0 ? '+' : ''}${r.pct_from_spot}%)</b><br>` +
              `Expiry: <b>${em.label}</b><br>` +
              `${lensInfo.cbLabel}: <b>${fmtM(v)}</b><br>` +
              `<span>${meaning}</span>`
            );
          });
        });

        const expBuy = exps.map((e) => Number(e.buy_cushion_m || 0));
        const expSell = exps.map((e) => -Math.abs(Number(e.sell_wall_m || 0)));
        const maxExp = Math.max(...expBuy, ...expSell.map(Math.abs), 0.1);
        const expUseB = maxExp >= 1000;
        const expBuyPlot = expUseB ? expBuy.map((v) => v / 1000) : expBuy;
        const expSellPlot = expUseB ? expSell.map((v) => v / 1000) : expSell;

        const priceToCatIdx = (targetP) => {
          if (!Number.isFinite(targetP) || !rows.length) return null;
          if (targetP < rows[0].strike || targetP > rows[rows.length - 1].strike) return null;
          for (let i = 0; i < rows.length - 1; i++) {
            const a = rows[i].strike;
            const b = rows[i + 1].strike;
            if (targetP >= a && targetP <= b) {
              return b > a ? i + (targetP - a) / (b - a) : i;
            }
          }
          return rows.findIndex((r) => Math.abs(r.strike - targetP) < 1e-6);
        };

        const traces = [
          {
            type: 'bar',
            orientation: 'h',
            name: lensInfo.short,
            x: ladPlot,
            y: rowLabels,
            xaxis: 'x',
            yaxis: 'y',
            showlegend: false,
            marker: {
              color: ladVals.map((v) => (v >= 0 ? 'rgba(0, 230, 118, 0.84)' : 'rgba(255, 51, 102, 0.84)')),
            },
            customdata: rows.map((r) => [fmtM(r.active_val), fmtM(r.charm_1d_m), fmtM(r.dex_m)]),
            hovertemplate: '<b>Strike %{y}</b><br>' + lensInfo.short + ': <b>%{customdata[0]}</b><br>1D Charm: %{customdata[1]} · DEX: %{customdata[2]}<extra></extra>',
          },
          {
            type: 'heatmap',
            name: lensInfo.label,
            x: expLabels,
            y: rowLabels,
            z: zDisp,
            text: hmHover,
            hoverinfo: 'text',
            xaxis: 'x2',
            yaxis: 'y2',
            zsmooth: smoothMode === 'smooth' ? 'best' : false,
            colorscale: HEDGE_COLORSCALE,
            zmid: 0,
            zmin: -zClipDisp,
            zmax: zClipDisp,
            colorbar: buildColorbar(zClipDisp, hmUseB, `${lensInfo.cbLabel} (${unitSfx})`),
          },
          {
            type: 'bar',
            name: 'Buy Cushion',
            x: expLabels,
            y: expBuyPlot,
            xaxis: 'x3',
            yaxis: 'y3',
            showlegend: false,
            marker: { color: 'rgba(0, 230, 118, 0.82)' },
            customdata: expBuy.map((v, i) => [fmtM(v), exps[i].charm_share_pct]),
            hovertemplate: '<b>%{x}</b><br>Buy Cushion: <b>%{customdata[0]}</b> · 1D Charm Share: %{customdata[1]}%<extra></extra>',
          },
          {
            type: 'bar',
            name: 'Sell Wall',
            x: expLabels,
            y: expSellPlot,
            xaxis: 'x3',
            yaxis: 'y3',
            showlegend: false,
            marker: { color: 'rgba(255, 51, 102, 0.82)' },
            customdata: expSell.map((v) => fmtM(v)),
            hovertemplate: '<b>%{x}</b><br>Sell Wall: <b>%{customdata}</b><extra></extra>',
          },
        ];

        const shapes = [
          {
            type: 'rect',
            xref: 'paper',
            yref: 'paper',
            x0: 0.0,
            x1: leftEnd,
            y0: 0.0,
            y1: 0.175,
            fillcolor: 'rgba(11, 17, 30, 0.94)',
            line: { color: 'rgba(192, 132, 252, 0.30)', width: 1 },
          },
        ];

        const annotations = [
          {
            xref: 'paper',
            yref: 'paper',
            x: 0.0,
            y: 1.015,
            xanchor: 'left',
            yanchor: 'bottom',
            showarrow: false,
            text: `<b>${lensInfo.short.toUpperCase()} (${ladUseB ? '$B' : '$M'})</b>`,
            font: { color: '#94a3b8', size: 8.8, family: 'JetBrains Mono, monospace' },
          },
          {
            xref: 'paper',
            yref: 'paper',
            x: centerStart,
            y: 1.015,
            xanchor: 'left',
            yanchor: 'bottom',
            showarrow: false,
            text: isNarrow ? `<b>OPEX MATRIX (${ticker})</b>` : `<b>CATEGORICAL STRIKE × EXPIRY SURFACE · ${ticker}</b>`,
            font: { color: '#e2e8f0', size: 9.5, family: 'JetBrains Mono, monospace' },
          },
          {
            xref: 'paper',
            yref: 'paper',
            x: centerStart,
            y: 0.165,
            xanchor: 'left',
            yanchor: 'bottom',
            showarrow: false,
            text: `<b>OPEX CLIFF</b> <span style="color:#94a3b8">Buy (+) vs Sell (-) Expiration Pressure</span>`,
            font: { color: '#c084fc', size: isNarrow ? 7.8 : 8.5, family: 'JetBrains Mono, monospace' },
          },
          {
            xref: 'paper',
            yref: 'paper',
            x: 0.008,
            y: 0.165,
            xanchor: 'left',
            yanchor: 'top',
            align: 'left',
            showarrow: false,
            font: { color: '#cbd5e1', size: isNarrow ? 7.6 : 8.3, family: 'JetBrains Mono, monospace' },
            text: isNarrow
              ? `<b style="color:#c084fc">OPEX CLIFF</b><br>` +
                `Peak: <b style="color:#fbbf24">${sum.peak_expiry_label || '--'}</b><br>` +
                `≤7D: <b>${sum.weekly_charm_share_pct ?? 0}%</b>`
              : `<b style="color:#c084fc">OPEX CLIFF DESK</b><br>` +
                `Peak: <b style="color:#fbbf24">${sum.peak_expiry_label || '--'}</b><br>` +
                `≤7D Share: <b>${sum.weekly_charm_share_pct ?? 0}%</b><br>` +
                `Net 3D: <b>${fmtCompact(sum.net_3d_hedge_m)}</b>`,
          },
        ];

        const nRows = Math.max(2, rowLabels.length - 1);
        const placedNy = [];
        levelDefs.forEach((lvl) => {
          if (!Number.isFinite(lvl.val)) return;
          if (!showLevels && lvl.key !== 'spot') return;
          const catY = priceToCatIdx(lvl.val);
          if (catY === null || catY < 0 || catY > nRows) return;
          shapes.push({
            type: 'line',
            xref: 'x2',
            yref: 'y2',
            x0: -0.5,
            x1: expLabels.length - 0.5,
            y0: catY,
            y1: catY,
            line: { color: lvl.line, width: lvl.w, dash: lvl.dash },
          });
          const ny = catY / nRows;
          if (ny >= 0.04 && ny <= 0.96 && !placedNy.some((p) => Math.abs(p - ny) < 0.09)) {
            placedNy.push(ny);
            annotations.push({
              xref: 'paper',
              yref: 'y2',
              x: badgeX,
              y: catY,
              xanchor: 'left',
              yanchor: 'middle',
              showarrow: false,
              text: `<b>${lvl.label}</b>`,
              font: { color: isDarkBadge(lvl.bg) ? '#040812' : '#ffffff', size: isNarrow ? 8 : 8.8, family: 'JetBrains Mono, monospace' },
              bgcolor: lvl.bg,
              borderpad: 2.5,
            });
          }
        });

        const layout = {
          paper_bgcolor: '#060910',
          plot_bgcolor: '#070b14',
          margin: { l: isNarrow ? 56 : 64, r: isNarrow ? 76 : 88, t: 54, b: 34 },
          hovermode: 'closest',
          dragmode: 'pan',
          barmode: 'relative',
          hoverlabel: {
            bgcolor: 'rgba(10, 14, 23, 0.96)',
            bordercolor: '#334155',
            font: { family: 'JetBrains Mono, monospace', size: 10.5, color: '#f8fafc' },
          },
          shapes,
          annotations,
          showlegend: false,
          xaxis: {
            domain: [0.0, leftEnd],
            anchor: 'y',
            nticks: 3,
            ticksuffix: ladUseB ? 'B' : 'M',
            tickfont: { color: '#94a3b8', family: 'JetBrains Mono, monospace', size: 8.2 },
            gridcolor: 'rgba(255,255,255,0.05)',
            zeroline: true,
            zerolinecolor: '#64748b',
          },
          yaxis: {
            domain: [0.29, 0.98],
            type: 'category',
            categoryorder: 'array',
            categoryarray: rowLabels,
            tickfont: { color: '#cbd5e1', family: 'JetBrains Mono, monospace', size: isNarrow ? 8.2 : 9 },
            gridcolor: 'rgba(255,255,255,0.04)',
          },
          xaxis2: {
            domain: [centerStart, centerEnd],
            anchor: 'y2',
            type: 'category',
            categoryorder: 'array',
            categoryarray: expLabels,
            tickangle: 0,
            tickfont: { color: '#cbd5e1', family: 'JetBrains Mono, monospace', size: isNarrow ? 7.8 : 8.6 },
            gridcolor: 'rgba(255,255,255,0.04)',
          },
          yaxis2: {
            domain: [0.29, 0.98],
            type: 'category',
            categoryorder: 'array',
            categoryarray: rowLabels,
            matches: 'y',
            anchor: 'x2',
            showticklabels: false,
            gridcolor: 'rgba(255,255,255,0.04)',
          },
          xaxis3: {
            domain: [centerStart, centerEnd],
            anchor: 'y3',
            type: 'category',
            categoryorder: 'array',
            categoryarray: expLabels,
            showticklabels: false,
            gridcolor: 'rgba(255,255,255,0.05)',
          },
          yaxis3: {
            domain: [0.02, 0.155],
            anchor: 'x3',
            ticksuffix: expUseB ? 'B' : 'M',
            nticks: 3,
            tickfont: { color: '#94a3b8', family: 'JetBrains Mono, monospace', size: 8.2 },
            gridcolor: 'rgba(255,255,255,0.05)',
            zeroline: true,
            zerolinecolor: '#64748b',
          },
        };

        window.Plotly.react(plotEl, traces, layout, { responsive: true, displayModeBar: false });
        return undefined;
      }
    } catch (err) {
      console.warn('Delta & Charm Map Studio render error:', err);
    }
    return undefined;
  }, [
    viewMode, lens, scope, source, useVol, zoomMode, smoothMode,
    showSignals, showLevels, showZeroContour, plotlyReady, plotWidth,
    ticker, spotVal, yBounds, scopeData, pts, opx, sum, filteredOpex, lensInfo,
  ]);

  useEffect(() => {
    const el = plotRef.current;
    return () => {
      if (el && window.Plotly) window.Plotly.purge(el);
    };
  }, []);

  if (!hedgeMap || (!hedgeMap.scopes && !hedgeMap.strikes?.length)) {
    return (
      <div className="sg-trace-shell" style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontFamily: 'JetBrains Mono, monospace' }}>
        Loading institutional Delta &amp; Charm Hedge Pressure Studio...
      </div>
    );
  }

  const buyZones = (opx?.top_buy_zones || hedgeMap?.top_buy_zones || []).slice(0, 2);
  const sellZones = (opx?.top_sell_zones || hedgeMap?.top_sell_zones || []).slice(0, 2);
  const matrixZClip = computeRobustZMax(filteredOpex.fullGrid);
  const matrixRowsDesc = [...filteredOpex.allRangeIdx].reverse();

  const findClosestMatrixIdx = (target) => {
    const tgt = Number(target);
    if (!Number.isFinite(tgt) || tgt <= 0 || !matrixRowsDesc.length) return null;
    let bestIdx = null;
    let bestDiff = Infinity;
    matrixRowsDesc.forEach((rIdx) => {
      const st = Number(filteredOpex.fullProfile[rIdx]?.strike);
      const diff = Math.abs(st - tgt);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestIdx = rIdx;
      }
    });
    return spotVal > 0 && bestDiff / spotVal <= 0.015 ? bestIdx : null;
  };

  const spotRowIdx = findClosestMatrixIdx(spotVal);
  const pinRowIdx = findClosestMatrixIdx(sum.charm_pin_strike);
  const cwRowIdx = findClosestMatrixIdx(sum.call_wall);
  const pwRowIdx = findClosestMatrixIdx(sum.put_wall);
  const zgRowIdx = findClosestMatrixIdx(sum.zero_gamma);

  const handleCopyZone = (z, key) => {
    const val = z.combined_3d_m ?? z.combined_pressure_m ?? 0;
    const txt = `${ticker} ${z.action}: $${z.strike} (${z.exp_label || z.expiry}) 3D=${fmtM(val)} · 1DCharm=${fmtM(z.charm_1d_m ?? z.charm_decay_m)}`;
    if (navigator?.clipboard?.writeText) navigator.clipboard.writeText(txt);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  return (
    <div className="sg-trace-shell">
      {/* STRICT 2-ROW INSTITUTIONAL COMMAND BAR */}
      <div className="sg-trace-cmdbar">
        <div className="sg-trace-cmd-row">
          <div className="sg-trace-pill-group">
            <span className="sg-trace-group-lbl">MODE</span>
            <button type="button" onClick={() => setViewMode('studio')} className={`sg-trace-btn ${viewMode === 'studio' ? 'active cyan' : ''}`}>🎯 Studio</button>
            <button type="button" onClick={() => setViewMode('opex')} className={`sg-trace-btn ${viewMode === 'opex' ? 'active cyan' : ''}`}>🗺️ OpEx Map</button>
            <button type="button" onClick={() => setViewMode('matrix')} className={`sg-trace-btn ${viewMode === 'matrix' ? 'active cyan' : ''}`}>📊 Matrix</button>
          </div>

          <div className="sg-trace-pill-group">
            <span className="sg-trace-group-lbl">LENS</span>
            <button type="button" onClick={() => setLens('combined')} className={`sg-trace-btn ${lens === 'combined' ? 'active emerald' : ''}`}>Combined</button>
            <button type="button" onClick={() => setLens('charm')} className={`sg-trace-btn ${lens === 'charm' ? 'active lens-cex' : ''}`}>Charm</button>
            <button type="button" onClick={() => setLens('dex')} className={`sg-trace-btn ${lens === 'dex' ? 'active lens-dex' : ''}`}>Delta</button>
            <button type="button" onClick={() => setLens('gex')} className={`sg-trace-btn ${lens === 'gex' ? 'active lens-gex' : ''}`}>Gamma</button>
          </div>

          <div className="sg-trace-pill-group">
            <span className="sg-trace-group-lbl">SCOPE</span>
            <button type="button" onClick={() => setScope('all')} className={`sg-trace-btn compact ${scope === 'all' ? 'active cyan' : ''}`}>All</button>
            <button type="button" onClick={() => setScope('weekly')} className={`sg-trace-btn compact ${scope === 'weekly' ? 'active cyan' : ''}`}>≤7D</button>
            <button type="button" onClick={() => setScope('front')} className={`sg-trace-btn compact ${scope === 'front' ? 'active cyan' : ''}`}>Front</button>
          </div>

          <div className="sg-trace-pill-group">
            <span className="sg-trace-group-lbl">SRC</span>
            <button type="button" onClick={() => setSource('oi')} className={`sg-trace-btn compact ${source === 'oi' ? 'active emerald' : ''}`}>🏛️ OI</button>
            <button
              type="button"
              onClick={() => hasLiveVol && setSource('vol')}
              className={`sg-trace-btn compact ${useVol ? 'active emerald' : ''}`}
              style={!hasLiveVol ? { opacity: 0.45, cursor: 'not-allowed' } : undefined}
              title={hasLiveVol ? 'Weight heatmap & bars by live intraday option volume' : 'Live contract volume unavailable; showing OI'}
            >
              ⚡ Vol
            </button>
          </div>
        </div>

        <div className="sg-trace-cmd-row secondary">
          <div className="sg-trace-pill-group">
            <span className="sg-trace-group-lbl">ZOOM</span>
            {['smart', '5', '8', '10'].map((zm) => (
              <button key={zm} type="button" onClick={() => setZoomMode(zm)} className={`sg-trace-btn compact ${zoomMode === zm ? 'active cyan' : ''}`}>
                {zm === 'smart' ? 'Smart' : `±${zm}%`}
              </button>
            ))}
          </div>

          {viewMode !== 'matrix' && (
            <div className="sg-trace-pill-group">
              <button
                type="button"
                onClick={() => setSmoothMode((p) => (p === 'smooth' ? 'discrete' : 'smooth'))}
                className={`sg-trace-btn compact ${smoothMode === 'smooth' ? 'active' : ''}`}
              >
                {smoothMode === 'smooth' ? '🌊 Fluid' : '🧱 Grid'}
              </button>
              <button type="button" onClick={() => setShowLevels((p) => !p)} className={`sg-trace-btn compact ${showLevels ? 'active cyan' : ''}`}>
                ≡ Levels
              </button>
              {viewMode === 'studio' && (
                <>
                  <button type="button" onClick={() => setShowSignals((p) => !p)} className={`sg-trace-btn compact ${showSignals ? 'active emerald' : ''}`}>
                    🎯 Signals
                  </button>
                  <button type="button" onClick={() => setShowZeroContour((p) => !p)} className={`sg-trace-btn compact ${showZeroContour ? 'active' : ''}`}>
                    〰️ Zero Pivot
                  </button>
                </>
              )}
            </div>
          )}

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}>
            {viewMode !== 'matrix' && (
              <button type="button" onClick={handleExportPng} className="sg-trace-btn compact" title="Download high-res PNG snapshot">
                <Camera size={12} /> PNG
              </button>
            )}
            <button type="button" onClick={() => setShowGuide((p) => !p)} className={`sg-trace-btn compact ${showGuide ? 'active cyan' : ''}`}>
              <Info size={12} /> Guide {showGuide ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            </button>
          </div>
        </div>
      </div>

      {/* OPTIONAL COLLAPSIBLE DESK GUIDE */}
      {showGuide && (
        <div className="dcm-guide-panel">
          <div>
            <strong>Combined vs Charm vs Delta/Gamma:</strong> <b>Combined</b> computes exact Black-Scholes cumulative dealer stock hedging across both spot moves and time decay (`-(D(S,T-t) - D(S0,T))·S`). <b>Charm</b> isolates pure time-decay dealer flow (`+(1D/3D)` = dealers buying dips; `-(1D/3D)` = dealers selling rallies). <b>p92 Robust Clipping</b> prevents extreme outliers from darkening support zones.
          </div>
        </div>
      )}

      {/* 6 ZERO-TRUNCATION TELEMETRY KPI TILES */}
      <div className="sg-trace-telemetry">
        <div className="sg-tel-tile" style={{ borderLeft: `3px solid ${sum.regime_color || '#00F0FF'}` }}>
          <span className="sg-tel-lbl">HEDGE FLOW REGIME</span>
          <span className="sg-tel-val" style={{ color: sum.regime_color || '#00F0FF' }}>{sum.regime_short || 'BALANCED'}</span>
          <span className="sg-tel-sub">
            {sum.buy_share_pct ?? 50}% Buy · {sum.sell_share_pct ?? 50}% Sell · {scope === 'all' ? `${filteredOpex.exps.length} Exps` : (scope === 'weekly' ? '≤7D' : 'Front')}
          </span>
        </div>

        <div className="sg-tel-tile" style={{ borderLeft: '3px solid #00E676' }}>
          <span className="sg-tel-lbl">3D BUY CUSHION</span>
          <span className="sg-tel-val" style={{ color: '#00E676' }}>{fmtM(sum.total_buy_cushion_m)}</span>
          <span className="sg-tel-sub">
            {buyZones[0] ? `#1 $${buyZones[0].strike} (${fmtCompact(buyZones[0].combined_3d_m)})` : 'Dip Support Sum'}
          </span>
        </div>

        <div className="sg-tel-tile" style={{ borderLeft: '3px solid #ff3366' }}>
          <span className="sg-tel-lbl">3D SELL CEILING</span>
          <span className="sg-tel-val" style={{ color: '#ff3366' }}>{fmtM(-Math.abs(sum.total_sell_wall_m || 0))}</span>
          <span className="sg-tel-sub">
            {sellZones[0] ? `#1 $${sellZones[0].strike} (${fmtCompact(sellZones[0].combined_3d_m)})` : 'Overhead Supply Sum'}
          </span>
        </div>

        <div className="sg-tel-tile" style={{ borderLeft: '3px solid #c084fc' }}>
          <span className="sg-tel-lbl">1D CHARM DRIFT</span>
          <span className="sg-tel-val" style={{ color: (sum.charm_1d_spot_m || 0) >= 0 ? '#00E676' : '#ff3366' }}>
            {fmtM(sum.charm_1d_spot_m)}
          </span>
          <span className="sg-tel-sub">O'Clk {fmtCompact(sum.oclock_charm_m)} · {fmtShs(sum.charm_1d_shares)}</span>
        </div>

        <div className="sg-tel-tile" style={{ borderLeft: '3px solid #fbbf24' }}>
          <span className="sg-tel-lbl">CHARM PIN MAGNET</span>
          <span className="sg-tel-val" style={{ color: '#fbbf24' }}>${Number(sum.charm_pin_strike || spotVal).toFixed(2)}</span>
          <span className="sg-tel-sub">{(sum.charm_pin_dist_pct || 0) >= 0 ? '+' : ''}{sum.charm_pin_dist_pct ?? 0}% vs Spot · Peak Gravity</span>
        </div>

        <div className="sg-tel-tile" style={{ borderLeft: '3px solid #00F0FF' }}>
          <span className="sg-tel-lbl">ZERO-HEDGE PIVOT</span>
          <span className="sg-tel-val" style={{ color: '#00F0FF' }}>${Number(sum.zero_hedge_pivot_now || spotVal).toFixed(2)}</span>
          <span className="sg-tel-sub">+5D Drift → ${Number(sum.zero_hedge_pivot_5d || spotVal).toFixed(2)}</span>
        </div>
      </div>

      {/* CANVAS WORKSPACE: PLOTLY (STUDIO / OPEX MAP) OR SCROLLABLE STICKY MATRIX */}
      <div className="sg-trace-canvas-wrap">
        {viewMode !== 'matrix' ? (
          <div key="dcm-plotly-wrap" ref={plotRef} style={{ width: '100%', height: '495px' }} />
        ) : (
          <div key="dcm-matrix-wrap" className="dcm-matrix-scroll">
            <table className="dcm-matrix-table">
              <thead>
                <tr>
                  <th className="sticky-col">Strike ($)</th>
                  {filteredOpex.exps.map((em) => (
                    <th key={em.expiry}>{em.short_label || em.expiry}</th>
                  ))}
                  <th>Row Net</th>
                </tr>
              </thead>
              <tbody>
                {matrixRowsDesc.map((rIdx) => {
                  const row = filteredOpex.fullProfile[rIdx];
                  const st = row?.strike ?? 0;
                  const cells = filteredOpex.fullGrid[rIdx] || [];
                  const rowNet = cells.reduce((acc, v) => acc + (Number(v) || 0), 0);
                  const isSpot = rIdx === spotRowIdx;
                  const isPin = rIdx === pinRowIdx;
                  const isCW = rIdx === cwRowIdx;
                  const isPW = rIdx === pwRowIdx;
                  const isZG = rIdx === zgRowIdx;

                  return (
                    <tr key={st} className={isSpot ? 'spot-row' : ''}>
                      <td className="sticky-col">
                        <span className="dcm-strike-num">${st}</span>
                        {isSpot && <span className="dcm-m-badge spot">SPOT</span>}
                        {isPin && <span className="dcm-m-badge pin">PIN</span>}
                        {isCW && <span className="dcm-m-badge cw">CW</span>}
                        {isPW && <span className="dcm-m-badge pw">PW</span>}
                        {isZG && <span className="dcm-m-badge zg">FLIP</span>}
                      </td>
                      {filteredOpex.exps.map((em, cIdx) => {
                        const val = Number(cells[cIdx] || 0);
                        const intensity = Math.min(0.55, Math.max(0.06, (Math.abs(val) / (matrixZClip || 1)) * 0.55));
                        const bg = val > 0.01
                          ? `rgba(16, 185, 129, ${intensity})`
                          : (val < -0.01 ? `rgba(244, 63, 94, ${intensity})` : 'transparent');
                        const fg = val > 0.01 ? '#34d399' : (val < -0.01 ? '#fda4af' : '#475569');
                        return (
                          <td key={em.expiry} style={{ backgroundColor: bg, color: fg }}>
                            {Math.abs(val) < 0.01 ? '·' : fmtCompact(val)}
                          </td>
                        );
                      })}
                      <td style={{ color: rowNet >= 0 ? '#00E676' : '#ff3366', fontWeight: 900 }}>
                        {fmtCompact(rowNet)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td className="sticky-col">EXP NET</td>
                  {filteredOpex.exps.map((em, cIdx) => {
                    const colSum = matrixRowsDesc.reduce((acc, rIdx) => acc + Number(filteredOpex.fullGrid[rIdx]?.[cIdx] || 0), 0);
                    return (
                      <td key={em.expiry} style={{ color: colSum >= 0 ? '#00E676' : '#ff3366' }}>
                        {fmtCompact(colSum)}
                      </td>
                    );
                  })}
                  <td style={{ color: (sum.net_3d_hedge_m || 0) >= 0 ? '#00E676' : '#ff3366' }}>
                    {fmtCompact(matrixRowsDesc.reduce((a, rIdx) => a + (filteredOpex.fullGrid[rIdx] || []).reduce((s, v) => s + Number(v || 0), 0), 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        <div className="sg-trace-micro-legend">
          <span><strong style={{ color: '#10b981' }}>■</strong> Dealer Buy Flow (+)</span>
          <span><strong style={{ color: '#e11d48' }}>■</strong> Dealer Sell Flow (-)</span>
          <span><strong style={{ color: '#ffffff' }}>--</strong> Spot (${spotVal.toFixed(2)})</span>
          <span><strong style={{ color: '#fbbf24' }}>••</strong> Charm Pin</span>
          <span><strong style={{ color: '#00F0FF' }}>-•-</strong> Zero-Hedge / Flip</span>
          <span><strong style={{ color: '#c084fc' }}>▬</strong> Cum Charm (O'Clock 13:30-15:30)</span>
        </div>
      </div>

      {/* COMPACT 4x1 ACTIONABLE HEDGE ZONE DECK */}
      <div className="vl-quadrant-grid">
        {buyZones.map((z, idx) => {
          const k = `buy-${idx}`;
          const val = z.combined_3d_m ?? z.combined_pressure_m ?? 0;
          const dist = z.dist_pct ?? (spotVal > 0 ? (((z.strike - spotVal) / spotVal) * 100).toFixed(1) : 0);
          const expShort = z.expiry && String(z.expiry).length >= 10
            ? String(z.expiry).slice(5).replace('-', '/')
            : (z.exp_label || '').slice(0, 8);
          return (
            <div key={k} className="vl-q-card buy">
              <div className="vl-q-top">
                <span className="vl-q-title">BUY #{idx + 1} · ${z.strike}</span>
                <span className="vl-q-badge buy">{dist >= 0 ? '+' : ''}{dist}%</span>
              </div>
              <div className="vl-q-val" style={{ color: '#00E676' }}>{fmtM(val)}</div>
              <div className="dcm-q-meta-row">
                <span className="dcm-q-meta-txt">{expShort} · {fmtCompact(z.charm_1d_m ?? z.charm_decay_m)}/d</span>
                <button type="button" onClick={() => handleCopyZone(z, k)} className="dcm-copy-btn">
                  {copiedKey === k ? <Check size={10} /> : <Copy size={10} />}
                  {copiedKey === k ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
          );
        })}

        {sellZones.map((z, idx) => {
          const k = `sell-${idx}`;
          const val = -Math.abs(z.combined_3d_m ?? z.combined_pressure_m ?? 0);
          const dist = z.dist_pct ?? (spotVal > 0 ? (((z.strike - spotVal) / spotVal) * 100).toFixed(1) : 0);
          const expShort = z.expiry && String(z.expiry).length >= 10
            ? String(z.expiry).slice(5).replace('-', '/')
            : (z.exp_label || '').slice(0, 8);
          return (
            <div key={k} className="vl-q-card sell">
              <div className="vl-q-top">
                <span className="vl-q-title">SELL #{idx + 1} · ${z.strike}</span>
                <span className="vl-q-badge sell">{dist >= 0 ? '+' : ''}{dist}%</span>
              </div>
              <div className="vl-q-val" style={{ color: '#ff3366' }}>{fmtM(val)}</div>
              <div className="dcm-q-meta-row">
                <span className="dcm-q-meta-txt">{expShort} · {fmtCompact(z.charm_1d_m ?? z.charm_decay_m)}/d</span>
                <button type="button" onClick={() => handleCopyZone(z, k)} className="dcm-copy-btn">
                  {copiedKey === k ? <Check size={10} /> : <Copy size={10} />}
                  {copiedKey === k ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
