import React, { useEffect, useMemo, useRef, useState } from 'react';
import './GexProfiler.css';

function usePlotWidth(ref) {
  const [w, setW] = useState(1100);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const upd = () => {
      if (el.clientWidth > 0) setW(el.clientWidth);
    };
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

const isDarkBadgeText = (hex) => {
  const s = String(hex || '').toLowerCase();
  return s === '#ffffff' || s === '#00e676' || s === '#00f0ff' || s === '#fbbf24' || s === '#38bdf8' || s === '#10b981';
};

export default function CumulativeGexStudio({
  ticker,
  spot,
  rawProfile = [],
  spotgammaTrace,
  keyLevels = {},
  totals = {},
  expectedMove,
  selectedExpiry = 'ALL',
  plotlyReady,
  formatDollarGex,
}) {
  const [lens, setLens] = useState('spot_curve'); // 'spot_curve' | 'strike_integral'
  const [rangePct, setRangePct] = useState(0.12); // 0.06 | 0.10 | 0.12 | 1.0
  const [showStrikeBars, setShowStrikeBars] = useState(true);
  const [showCallPut, setShowCallPut] = useState(false);
  const [showIvStress, setShowIvStress] = useState(false);
  const [showLevels, setShowLevels] = useState(true);

  const plotRef = useRef(null);
  const plotWidth = usePlotWidth(plotRef);
  const isNarrow = plotWidth < 760;
  const plotHeightPx = 490;
  const spotVal = Number(spot) || Number(spotgammaTrace?.spot_price) || 0;

  const model = useMemo(() => {
    const sortedRaw = [...(rawProfile || [])]
      .filter((p) => Number.isFinite(Number(p?.strike)))
      .sort((a, b) => Number(a.strike) - Number(b.strike));

    // Precompute full-chain running strike integrals BEFORE range slicing so zoom preserves true cumulative depth
    let runNet = 0;
    let runCall = 0;
    let runPut = 0;
    const integralAll = sortedRaw.map((p) => {
      const k = Number(p.strike);
      const ng = Number(p.net_gex || 0);
      const cg = Number(p.call_gex || 0);
      const pg = Number(p.put_gex || 0);
      runNet += ng;
      runCall += cg;
      runPut += pg;
      const cumNet = Number.isFinite(Number(p.cumulative_gex)) ? Number(p.cumulative_gex) : runNet;
      const cumCall = Number.isFinite(Number(p.cumulative_call_gex)) ? Number(p.cumulative_call_gex) : runCall;
      const cumPut = Number.isFinite(Number(p.cumulative_put_gex)) ? Number(p.cumulative_put_gex) : runPut;
      const pct = spotVal > 0 ? ((k - spotVal) / spotVal) * 100 : 0;
      return {
        x: k,
        pct,
        y: cumNet,
        callY: cumCall,
        putY: cumPut,
        strikeNet: ng,
        strikeCall: cg,
        strikePut: pg,
        oi: (Number(p.call_oi) || 0) + (Number(p.put_oi) || 0),
        vol: (Number(p.call_vol) || 0) + (Number(p.put_vol) || 0),
      };
    });

    const bsCurveRaw = [...(spotgammaTrace?.curve || [])]
      .filter((pt) => Number.isFinite(Number(pt?.price)))
      .sort((a, b) => Number(a.price) - Number(b.price))
      .map((pt) => ({
        x: Number(pt.price),
        pct: Number(pt.pct_from_spot ?? (spotVal > 0 ? ((Number(pt.price) - spotVal) / spotVal) * 100 : 0)),
        y: Number(pt.net_gex || 0),
        callY: Number(pt.call_gex || 0),
        putY: Number(pt.put_gex || 0),
        ivDn: Number(pt.net_gex_iv_down ?? pt.net_gex ?? 0),
        ivUp: Number(pt.net_gex_iv_up ?? pt.net_gex ?? 0),
      }));

    const effLens = lens === 'spot_curve' && bsCurveRaw.length >= 3 ? 'spot_curve' : 'strike_integral';
    const baseSeries = effLens === 'spot_curve' ? bsCurveRaw : integralAll;

    const filterByRange = (arr, xKey = 'x') => {
      if (!spotVal || rangePct >= 0.99) return arr;
      const lo = spotVal * (1 - rangePct);
      const hi = spotVal * (1 + rangePct);
      const sub = arr.filter((pt) => pt[xKey] >= lo && pt[xKey] <= hi);
      return sub.length >= 3 ? sub : arr;
    };

    const rawVis = filterByRange(baseSeries, 'x');
    const visBars = filterByRange(integralAll, 'x');

    // Compute local slope ($ per +1% spot move) along the active curve
    const visPoints = rawVis.map((pt, i) => {
      const i0 = Math.max(0, i - 1);
      const i1 = Math.min(rawVis.length - 1, i + 1);
      let slope1Pct = 0;
      if (i1 > i0 && spotVal > 0) {
        const dxPct = ((rawVis[i1].x - rawVis[i0].x) / spotVal) * 100;
        if (Math.abs(dxPct) > 1e-6) {
          slope1Pct = (rawVis[i1].y - rawVis[i0].y) / dxPct;
        }
      }
      return { ...pt, slope1Pct };
    });

    // Exact zero-crossing scan within visible curve
    const zeroCrossings = [];
    for (let i = 0; i < visPoints.length - 1; i += 1) {
      const p1 = visPoints[i];
      const p2 = visPoints[i + 1];
      if ((p1.y < 0 && p2.y > 0) || (p1.y > 0 && p2.y < 0) || (p1.y === 0 && p2.y !== 0)) {
        const dy = p2.y - p1.y;
        if (Math.abs(dy) > 1e-9) {
          const w = Math.max(0, Math.min(1, -p1.y / dy));
          zeroCrossings.push(Number((p1.x + w * (p2.x - p1.x)).toFixed(2)));
        }
      }
    }

    // Also compute zero crossings on full baseSeries in case flip sits slightly outside zoomed range
    const fullCrossings = [];
    for (let i = 0; i < baseSeries.length - 1; i += 1) {
      const p1 = baseSeries[i];
      const p2 = baseSeries[i + 1];
      if ((p1.y < 0 && p2.y > 0) || (p1.y > 0 && p2.y < 0)) {
        const dy = p2.y - p1.y;
        if (Math.abs(dy) > 1e-9) {
          const w = Math.max(0, Math.min(1, -p1.y / dy));
          fullCrossings.push(Number((p1.x + w * (p2.x - p1.x)).toFixed(2)));
        }
      }
    }

    const nearestOf = (arr) => (arr.length ? arr.reduce((a, b) => (Math.abs(b - spotVal) < Math.abs(a - spotVal) ? b : a)) : null);
    const traceZgFound = Boolean(spotgammaTrace?.trace_zero_gamma_found && spotgammaTrace?.trace_zero_gamma != null);
    const traceZg = traceZgFound ? Number(spotgammaTrace.trace_zero_gamma) : null;
    const localFlip = keyLevels?.zero_gamma ? Number(keyLevels.zero_gamma) : null;

    let effectiveFlip = null;
    let flipLabel = 'No Flip ±22%';
    if (effLens === 'spot_curve') {
      effectiveFlip = traceZg ?? nearestOf(fullCrossings) ?? localFlip;
      if (traceZg != null) {
        flipLabel = `BS Vol Trigger $${traceZg.toFixed(2)}`;
      } else if (nearestOf(fullCrossings) != null) {
        flipLabel = `BS Flip $${nearestOf(fullCrossings).toFixed(2)}`;
      } else {
        flipLabel = spotgammaTrace?.trace_zero_gamma_note || (localFlip ? `Ref Local Flip $${localFlip.toFixed(2)}` : 'No Flip ±22%');
      }
    } else {
      const integralCross = nearestOf(fullCrossings);
      effectiveFlip = integralCross ?? localFlip;
      flipLabel = integralCross != null
        ? `Cum Zero Cross $${integralCross.toFixed(2)}`
        : (localFlip ? `Net Flip Ref $${localFlip.toFixed(2)}` : 'No Cum Zero Cross');
    }

    // Closest point to spot on active curve
    const atSpotPt = visPoints.length
      ? visPoints.reduce((best, cur) => (Math.abs(cur.x - spotVal) < Math.abs(best.x - spotVal) ? cur : best), visPoints[0])
      : null;

    const spotCurveGex = effLens === 'spot_curve'
      ? Number(spotgammaTrace?.current_spot_gex ?? atSpotPt?.y ?? totals?.total_net_gex ?? 0)
      : Number(totals?.total_net_gex ?? atSpotPt?.y ?? 0);

    const cumAtSpot = integralAll.length
      ? integralAll.reduce((best, cur) => (Math.abs(cur.x - spotVal) < Math.abs(best.x - spotVal) ? cur : best), integralAll[0])?.y || 0
      : 0;

    const totalNetGex = Number(totals?.total_net_gex ?? spotCurveGex);
    const regimeRefGex = effLens === 'spot_curve' ? spotCurveGex : totalNetGex;
    const aboveFlip = effectiveFlip ? spotVal >= effectiveFlip : regimeRefGex >= 0;

    let regimeState = 'transitional';
    let regimeBadge = '⚖️ TRANSITIONAL GAMMA BOUNDARY';
    let regimeColor = '#38bdf8';
    if (regimeRefGex >= 0 && aboveFlip) {
      regimeState = 'positive';
      regimeBadge = '🟢 POSITIVE GAMMA ZONE (STABILIZING)';
      regimeColor = '#00E676';
    } else if (regimeRefGex < 0 && (!effectiveFlip || spotVal < effectiveFlip)) {
      regimeState = 'negative';
      regimeBadge = '🌪️ NEGATIVE GAMMA ZONE (ACCELERATING)';
      regimeColor = '#f43f5e';
    } else if (regimeRefGex >= 0 && effectiveFlip && spotVal < effectiveFlip) {
      regimeState = 'transitional';
      regimeBadge = '⚖️ TRANSITIONAL BOUNDARY (LONG BOOK BELOW FLIP)';
      regimeColor = '#fbbf24';
    } else if (regimeRefGex < 0 && effectiveFlip && spotVal >= effectiveFlip) {
      regimeState = 'transitional';
      regimeBadge = '⚖️ TRANSITIONAL BOUNDARY (SHORT BOOK ABOVE FLIP)';
      regimeColor = '#fbbf24';
    }

    const peakPt = visPoints.length ? visPoints.reduce((a, b) => (b.y > a.y ? b : a), visPoints[0]) : null;
    const troughPt = visPoints.length ? visPoints.reduce((a, b) => (b.y < a.y ? b : a), visPoints[0]) : null;

    // Determine Y scaling cleanly across active visible traces
    const yCandidates = [];
    visPoints.forEach((pt) => {
      yCandidates.push(Math.abs(pt.y));
      if (showCallPut) {
        yCandidates.push(Math.abs(pt.callY), Math.abs(pt.putY));
      }
      if (showIvStress && effLens === 'spot_curve') {
        yCandidates.push(Math.abs(pt.ivDn), Math.abs(pt.ivUp));
      }
    });
    const maxAbsY = Math.max(...yCandidates, 1e6);
    const useB = maxAbsY >= 1e9;
    const yScale = useB ? 1e9 : 1e6;
    const yUnit = useB ? 'B' : 'M';

    const maxAbsBar = Math.max(...visBars.map((b) => Math.abs(b.strikeNet)), 1e5);
    const barUseB = maxAbsBar >= 1e9;
    const barScale = barUseB ? 1e9 : 1e6;
    const barUnit = barUseB ? 'B' : 'M';

    const ivDnFlip = spotgammaTrace?.iv_stress_curves?.shifts?.['-3']?.zero_gamma ?? null;
    const ivUpFlip = spotgammaTrace?.iv_stress_curves?.shifts?.['3']?.zero_gamma ?? null;

    // 4-Zone structural breakdown (always monotonically ordered!)
    const pwRaw = Number(keyLevels?.put_wall || 0);
    const cwRaw = Number(keyLevels?.call_wall || 0);
    const pw = pwRaw > 0 ? pwRaw : (spotVal * 0.96);
    const cw = cwRaw > pw ? cwRaw : (spotVal * 1.04);

    // Pick curve representative value for any price S inside a zone
    const evalCurveAt = (targetP) => {
      if (!baseSeries.length) return 0;
      const nearest = baseSeries.reduce((a, b) => (Math.abs(b.x - targetP) < Math.abs(a.x - targetP) ? b : a), baseSeries[0]);
      return nearest.y;
    };
    const avgCurveIn = (lo, hi) => {
      const sub = baseSeries.filter((p) => p.x >= lo && p.x <= hi);
      if (!sub.length) return evalCurveAt((lo + hi) * 0.5);
      return sub.reduce((acc, p) => acc + p.y, 0) / sub.length;
    };

    const hasInnerFlip = effectiveFlip != null && effectiveFlip > pw + 0.01 && effectiveFlip < cw - 0.01;
    const midSplit = hasInnerFlip ? effectiveFlip : Number(((pw + cw) / 2).toFixed(2));
    const midLabel = hasInnerFlip ? `Flip $${midSplit.toFixed(1)}` : `Mid $${midSplit.toFixed(1)}`;

    const zone1Gex = evalCurveAt(pw * 0.985);
    const zone2Gex = avgCurveIn(pw, midSplit);
    const zone3Gex = avgCurveIn(midSplit, cw);
    const zone4Gex = evalCurveAt(cw * 1.015);

    const zones = [
      {
        id: 'cgex-zone-below-pw',
        title: `Below Put Wall (< $${pw.toFixed(0)})`,
        rangeText: `< $${pw.toFixed(1)}`,
        bias: zone1Gex >= 0 ? 'BUY CUSHION' : 'CASCADE ZONE',
        biasType: zone1Gex >= 0 ? 'buy' : 'sell',
        isSpotHere: spotVal < pw,
        val: zone1Gex,
        metaLabel: 'Wall Floor GEX',
        why: zone1Gex >= 0
          ? `Long gamma extends past Put Wall ($${pw.toFixed(0)}): dealer dip-buying cushions early breakdowns.`
          : `Sub-Put-Wall short gamma pocket: losing $${pw.toFixed(0)} forces pro-cyclical dealer selling into falling spot.`,
      },
      {
        id: 'cgex-zone-pw-flip',
        title: hasInnerFlip ? `Put Wall → Flip ($${pw.toFixed(0)} – $${midSplit.toFixed(1)})` : `Lower Collar ($${pw.toFixed(0)} – ${midLabel})`,
        rangeText: `$${pw.toFixed(1)} – $${midSplit.toFixed(1)}`,
        bias: zone2Gex >= 0 ? 'ABSORBING BUFFER' : 'VOL EXPANSION',
        biasType: zone2Gex >= 0 ? 'buy' : 'sell',
        isSpotHere: spotVal >= pw && spotVal < midSplit,
        val: zone2Gex,
        metaLabel: 'Corridor Avg GEX',
        why: hasInnerFlip
          ? `Short-gamma acceleration lane below Flip ($${midSplit.toFixed(1)}): swings widen until Put Wall ($${pw.toFixed(0)}) demand steps in.`
          : (zone2Gex >= 0
            ? `Positive lower-collar buffer between Put Wall ($${pw.toFixed(0)}) and $${midSplit.toFixed(1)} dampens intraday pullbacks.`
            : `Negative lower-collar dealer gamma requires active short hedging on dips toward $${pw.toFixed(0)}.`),
      },
      {
        id: 'cgex-zone-flip-cw',
        title: hasInnerFlip ? `Flip → Call Wall ($${midSplit.toFixed(1)} – $${cw.toFixed(0)})` : `Upper Collar (${midLabel} – $${cw.toFixed(0)})`,
        rangeText: `$${midSplit.toFixed(1)} – $${cw.toFixed(1)}`,
        bias: zone3Gex >= 0 ? 'PINNING / MEAN-REV' : 'TREND FUEL',
        biasType: zone3Gex >= 0 ? 'buy' : 'sell',
        isSpotHere: spotVal >= midSplit && spotVal <= cw,
        val: zone3Gex,
        metaLabel: 'Corridor Avg GEX',
        why: zone3Gex >= 0
          ? `Stabilizing long-gamma sweet spot: dealers buy dips and sell rallies, pulling spot toward Call Wall ($${cw.toFixed(0)}).`
          : `Steep slope toward Call Wall ($${cw.toFixed(0)}): short-gamma dealers must chase upside pushes until resistance builds.`,
      },
      {
        id: 'cgex-zone-above-cw',
        title: `Above Call Wall (> $${cw.toFixed(0)})`,
        rangeText: `> $${cw.toFixed(1)}`,
        bias: zone4Gex >= 0 ? 'OVERHEAD SUPPLY' : 'SQUEEZE BREAKOUT',
        biasType: zone4Gex >= 0 ? 'buy' : 'sell',
        isSpotHere: spotVal > cw,
        val: zone4Gex,
        metaLabel: 'Post-Wall GEX',
        why: zone4Gex >= 0
          ? `Heavy Call Wall ($${cw.toFixed(0)}) supply caps upside momentum as dealers sell strength into calls.`
          : `Above Call Wall ($${cw.toFixed(0)}) flips dealers short gamma overhead — sustained breaks can fuel fast short covering.`,
      },
    ];

    const flipDistPct = effectiveFlip && spotVal > 0 ? ((spotVal - effectiveFlip) / effectiveFlip) * 100 : null;
    const scopeLabel = selectedExpiry === 'ALL'
      ? 'All Expirations'
      : (selectedExpiry === 'FRONT' ? 'Front 0-5 DTE' : `Exp ${selectedExpiry}`);

    return {
      effLens,
      visPoints,
      visBars,
      zeroCrossings,
      effectiveFlip,
      flipLabel,
      flipDistPct,
      atSpotPt,
      spotCurveGex,
      cumAtSpot,
      totalNetGex,
      regimeState,
      regimeBadge,
      regimeColor,
      peakPt,
      troughPt,
      yScale,
      yUnit,
      barScale,
      barUnit,
      maxAbsBar,
      ivDnFlip,
      ivUpFlip,
      zones,
      scopeLabel,
    };
  }, [rawProfile, spotgammaTrace, keyLevels, totals, spotVal, lens, rangePct, showCallPut, showIvStress, selectedExpiry]);

  useEffect(() => {
    if (!plotlyReady || !window.Plotly || !plotRef.current || !model.visPoints.length) return undefined;
    const plotEl = plotRef.current;

    try {
      const {
        effLens,
        visPoints,
        visBars,
        zeroCrossings,
        effectiveFlip,
        yScale,
        yUnit,
        barScale,
        barUnit,
        maxAbsBar,
        scopeLabel,
      } = model;

      const xs = visPoints.map((p) => p.x);
      const yMain = visPoints.map((p) => p.y / yScale);
      const yPosFill = visPoints.map((p) => Math.max(0, p.y) / yScale);
      const yNegFill = visPoints.map((p) => Math.min(0, p.y) / yScale);

      const traces = [
        // Split shaded fills (emerald above $0, rose below $0)
        {
          type: 'scatter',
          mode: 'lines',
          x: xs,
          y: yPosFill,
          fill: 'tozeroy',
          fillcolor: 'rgba(16, 185, 129, 0.14)',
          line: { width: 0 },
          hoverinfo: 'skip',
          showlegend: false,
        },
        {
          type: 'scatter',
          mode: 'lines',
          x: xs,
          y: yNegFill,
          fill: 'tozeroy',
          fillcolor: 'rgba(244, 63, 94, 0.14)',
          line: { width: 0 },
          hoverinfo: 'skip',
          showlegend: false,
        },
      ];

      // Optional per-strike Net GEX bar histogram behind curve
      if (showStrikeBars && visBars.length) {
        traces.push({
          type: 'bar',
          name: `Strike Net GEX ($${barUnit})`,
          x: visBars.map((b) => b.x),
          y: visBars.map((b) => b.strikeNet / barScale),
          yaxis: 'y2',
          marker: {
            color: visBars.map((b) => (b.strikeNet >= 0 ? 'rgba(16, 185, 129, 0.42)' : 'rgba(244, 63, 94, 0.42)')),
            line: { width: 0 },
          },
          customdata: visBars.map((b) => [
            formatDollarGex(b.strikeNet),
            formatDollarGex(b.strikeCall),
            formatDollarGex(b.strikePut),
          ]),
          hovertemplate: `Strike Net: <b>%{customdata[0]}</b> (C %{customdata[1]} / P %{customdata[2]})<extra></extra>`,
        });
      }

      // Optional Call vs Put Cumulative Decomposition
      if (showCallPut) {
        traces.push({
          type: 'scatter',
          mode: 'lines',
          name: effLens === 'spot_curve' ? 'Call GEX(S)' : 'Cum Call GEX',
          x: xs,
          y: visPoints.map((p) => p.callY / yScale),
          line: { color: '#10b981', width: 1.8, dash: 'dot' },
          customdata: visPoints.map((p) => [formatDollarGex(p.callY)]),
          hovertemplate: `Call GEX: <b>%{customdata[0]}</b><extra></extra>`,
        });
        traces.push({
          type: 'scatter',
          mode: 'lines',
          name: effLens === 'spot_curve' ? 'Put GEX(S)' : 'Cum Put GEX',
          x: xs,
          y: visPoints.map((p) => p.putY / yScale),
          line: { color: '#f43f5e', width: 1.8, dash: 'dot' },
          customdata: visPoints.map((p) => [formatDollarGex(p.putY)]),
          hovertemplate: `Put GEX: <b>%{customdata[0]}</b><extra></extra>`,
        });
      }

      // Optional ±3% IV Stress Fan (only on BS Spot GEX(S))
      if (showIvStress && effLens === 'spot_curve') {
        traces.push({
          type: 'scatter',
          mode: 'lines',
          name: '−3% IV Crush',
          x: xs,
          y: visPoints.map((p) => p.ivDn / yScale),
          line: { color: '#38bdf8', width: 1.9, dash: 'dash' },
          customdata: visPoints.map((p) => [formatDollarGex(p.ivDn)]),
          hovertemplate: `−3% IV Crush: <b>%{customdata[0]}</b><extra></extra>`,
        });
        traces.push({
          type: 'scatter',
          mode: 'lines',
          name: '+3% IV Spike',
          x: xs,
          y: visPoints.map((p) => p.ivUp / yScale),
          line: { color: '#f59e0b', width: 1.9, dash: 'dash' },
          customdata: visPoints.map((p) => [formatDollarGex(p.ivUp)]),
          hovertemplate: `+3% IV Spike: <b>%{customdata[0]}</b><extra></extra>`,
        });
      }

      // Primary Cumulative Curve
      traces.push({
        type: 'scatter',
        mode: 'lines',
        name: effLens === 'spot_curve' ? 'BS Spot GEX(S)' : 'Cumulative Strike GEX',
        x: xs,
        y: yMain,
        line: { color: '#00F0FF', width: 3 },
        customdata: visPoints.map((p) => [
          formatDollarGex(p.y),
          `${p.pct >= 0 ? '+' : ''}${p.pct.toFixed(1)}% vs Spot`,
          formatDollarGex(p.slope1Pct),
          p.y >= 0 ? 'Long Gamma (Stabilizing)' : 'Short Gamma (Accelerating)',
        ]),
        hovertemplate:
          `${effLens === 'spot_curve' ? 'Spot GEX(S)' : 'Cum GEX'}: <b>%{customdata[0]}</b> (%{customdata[1]})<br>` +
          `Slope (Speed): <b>%{customdata[2]}/1%</b> · %{customdata[3]}<extra></extra>`,
      });

      // Exact Zero-Crossing Diamond Markers
      if (zeroCrossings.length) {
        traces.push({
          type: 'scatter',
          mode: 'markers',
          name: 'Zero-Gamma Flip',
          x: zeroCrossings,
          y: zeroCrossings.map(() => 0),
          marker: {
            symbol: 'diamond',
            size: 11,
            color: '#fbbf24',
            line: { color: '#ffffff', width: 1.5 },
          },
          hovertemplate: `<b>Zero-Gamma Crossing</b> at $%{x:.2f} ($0 Net GEX)<extra></extra>`,
        });
      }

      // Shapes & Collision-Free Top-Margin Staggered Level Badges
      const xMin = Math.min(...xs);
      const xMax = Math.max(...xs);
      const xSpan = Math.max(1e-6, xMax - xMin);
      const shapes = [
        {
          type: 'line',
          xref: 'paper',
          yref: 'y',
          x0: 0,
          x1: 1,
          y0: 0,
          y1: 0,
          line: { color: '#64748b', width: 1.6 },
        },
      ];
      const annotations = [];
      let maxSlot = 0;

      if (showLevels) {
        if (expectedMove?.range_1d?.length === 2) {
          const emLo = Math.max(xMin, Number(expectedMove.range_1d[0]));
          const emHi = Math.min(xMax, Number(expectedMove.range_1d[1]));
          if (emHi > emLo) {
            shapes.push({
              type: 'rect',
              xref: 'x',
              yref: 'paper',
              x0: emLo,
              x1: emHi,
              y0: 0,
              y1: 1,
              fillcolor: 'rgba(56, 189, 248, 0.055)',
              line: { color: 'rgba(56, 189, 248, 0.22)', width: 1, dash: 'dot' },
            });
          }
        }

        const placed = [];
        const minSep = isNarrow ? 0.19 : 0.145;
        const addLevel = (xVal, label, color, dash = 'dash', width = 1.6) => {
          if (!Number.isFinite(xVal) || xVal < xMin || xVal > xMax) return;
          shapes.push({
            type: 'line',
            xref: 'x',
            yref: 'paper',
            x0: xVal,
            x1: xVal,
            y0: 0,
            y1: 1,
            line: { color, width, dash },
          });
          const nx = (xVal - xMin) / xSpan;
          let slot = 0;
          while (placed.some((p) => p.slot === slot && Math.abs(p.nx - nx) < minSep) && slot < 3) {
            slot += 1;
          }
          if (slot > maxSlot) maxSlot = slot;
          placed.push({ nx, slot });
          annotations.push({
            xref: 'x',
            yref: 'paper',
            x: xVal,
            y: 1.01,
            yanchor: 'bottom',
            xanchor: nx < 0.08 ? 'left' : (nx > 0.92 ? 'right' : 'center'),
            yshift: slot * 19,
            text: `<b>${label}</b>`,
            showarrow: false,
            font: {
              color: isDarkBadgeText(color) ? '#040812' : '#ffffff',
              size: isNarrow ? 8.3 : 9,
              family: 'JetBrains Mono, monospace',
            },
            bgcolor: color,
            borderpad: 2.5,
          });
        };

        if (keyLevels?.put_wall) addLevel(Number(keyLevels.put_wall), `PW $${Number(keyLevels.put_wall).toFixed(0)}`, '#f43f5e', 'dot', 1.7);
        if (spotVal > 0) addLevel(spotVal, `SPOT $${spotVal.toFixed(2)}`, '#ffffff', 'dash', 2.2);
        if (keyLevels?.call_wall) addLevel(Number(keyLevels.call_wall), `CW $${Number(keyLevels.call_wall).toFixed(0)}`, '#00E676', 'dot', 1.7);
        if (effectiveFlip && (!spotVal || Math.abs(effectiveFlip - spotVal) > 0.05)) {
          addLevel(effectiveFlip, `FLIP $${effectiveFlip.toFixed(2)}`, '#fbbf24', 'dashdot', 1.8);
        }
      }

      const barAxisMax = Math.max(1e-3, (maxAbsBar / barScale) * 2.5);
      const topMargin = maxSlot >= 3 ? 114 : (maxSlot >= 2 ? 98 : 82);
      const legendY = maxSlot >= 3 ? 1.32 : (maxSlot >= 2 ? 1.24 : 1.18);

      const layout = {
        paper_bgcolor: '#060910',
        plot_bgcolor: '#070b14',
        height: plotHeightPx,
        margin: {
          l: isNarrow ? 58 : 66,
          r: showStrikeBars ? (isNarrow ? 52 : 60) : 24,
          t: topMargin,
          b: 48,
        },
        hovermode: 'x unified',
        hoverlabel: {
          bgcolor: 'rgba(10, 14, 23, 0.96)',
          bordercolor: '#334155',
          font: { family: 'JetBrains Mono, monospace', size: 10.5, color: '#f8fafc' },
        },
        shapes,
        annotations,
        showlegend: true,
        legend: {
          orientation: 'h',
          x: 0,
          y: legendY,
          yanchor: 'bottom',
          font: { color: '#cbd5e1', family: 'JetBrains Mono, monospace', size: isNarrow ? 8.8 : 9.8 },
          bgcolor: 'rgba(6, 9, 16, 0.72)',
        },
        xaxis: {
          title: {
            text: `${effLens === 'spot_curve' ? 'Simulated Underlying Price ($)' : 'Option Strike Price ($)'} · ${scopeLabel}`,
            font: { color: '#94a3b8', family: 'JetBrains Mono, monospace', size: 9.8 },
            standoff: 8,
          },
          range: [xMin, xMax],
          tickprefix: '$',
          tickfont: { color: '#cbd5e1', family: 'JetBrains Mono, monospace', size: isNarrow ? 9 : 10 },
          gridcolor: 'rgba(255,255,255,0.05)',
        },
        yaxis: {
          title: {
            text: `${effLens === 'spot_curve' ? 'Portfolio Net GEX(S)' : 'Cumulative Strike GEX'} ($${yUnit})`,
            font: { color: '#94a3b8', family: 'JetBrains Mono, monospace', size: 9.8 },
            standoff: 6,
          },
          tickprefix: '$',
          ticksuffix: yUnit,
          tickfont: { color: '#cbd5e1', family: 'JetBrains Mono, monospace', size: isNarrow ? 9 : 10 },
          gridcolor: 'rgba(255,255,255,0.06)',
          zeroline: false,
        },
        ...(showStrikeBars ? {
          yaxis2: {
            title: {
              text: `Strike GEX ($${barUnit})`,
              font: { color: '#64748b', family: 'JetBrains Mono, monospace', size: 9 },
            },
            overlaying: 'y',
            side: 'right',
            range: [-barAxisMax, barAxisMax],
            tickprefix: '$',
            ticksuffix: barUnit,
            tickfont: { color: '#64748b', family: 'JetBrains Mono, monospace', size: 8.8 },
            showgrid: false,
            zeroline: false,
          },
        } : {}),
      };

      window.Plotly.react(plotEl, traces, layout, { responsive: true, displayModeBar: false });
    } catch (err) {
      console.warn('CumulativeGexStudio Plotly error:', err);
    }

    return undefined;
  }, [plotlyReady, plotWidth, plotHeightPx, model, showStrikeBars, showCallPut, showIvStress, showLevels, spotVal, keyLevels, expectedMove, formatDollarGex]);

  if (!spotgammaTrace?.curve?.length && !(rawProfile || []).length) {
    return (
      <div className="cgex-empty">
        Cumulative GEX surface is unavailable for this ticker / expiration.
      </div>
    );
  }

  return (
    <div className="cgex-studio" data-testid="cumulative-gex-studio">
      {/* Studio Toolbar */}
      <div className="cgex-toolbar" data-testid="cgex-toolbar">
        <div className="cgex-toolbar-group">
          <span className="cgex-lbl">LENS:</span>
          <button
            type="button"
            data-testid="cgex-lens-spot"
            onClick={() => setLens('spot_curve')}
            className={`sg-trace-btn compact ${model.effLens === 'spot_curve' ? 'active cyan' : ''}`}
            title="Portfolio Net Gamma recalculated across underlying price S (SpotGamma Vol Trigger curve)"
          >
            📈 BS Spot GEX(S)
          </button>
          <button
            type="button"
            data-testid="cgex-lens-integral"
            onClick={() => setLens('strike_integral')}
            className={`sg-trace-btn compact ${model.effLens === 'strike_integral' ? 'active purple' : ''}`}
            title="Left-to-right running sum of per-strike Net GEX across the chain"
          >
            ∑ Strike Integral
          </button>
        </div>

        <div className="cgex-toolbar-group">
          <span className="cgex-lbl">RANGE:</span>
          {[
            { pct: 0.06, label: '±6%', id: 'cgex-range-6' },
            { pct: 0.10, label: '±10%', id: 'cgex-range-10' },
            { pct: 0.12, label: '±12%', id: 'cgex-range-12' },
            { pct: 1.0, label: 'Full', id: 'cgex-range-full' },
          ].map((opt) => (
            <button
              key={opt.id}
              type="button"
              data-testid={opt.id}
              onClick={() => setRangePct(opt.pct)}
              className={`sg-trace-btn compact ${rangePct === opt.pct ? 'active emerald' : ''}`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="cgex-toolbar-group">
          <button
            type="button"
            data-testid="cgex-toggle-bars"
            onClick={() => setShowStrikeBars((v) => !v)}
            className={`sg-trace-btn compact ${showStrikeBars ? 'active cyan' : ''}`}
          >
            📊 Strike GEX Bars
          </button>
          <button
            type="button"
            data-testid="cgex-toggle-cp"
            onClick={() => setShowCallPut((v) => !v)}
            className={`sg-trace-btn compact ${showCallPut ? 'active emerald' : ''}`}
          >
            📐 Call / Put Split
          </button>
          {model.effLens === 'spot_curve' && (
            <button
              type="button"
              data-testid="cgex-toggle-iv"
              onClick={() => setShowIvStress((v) => !v)}
              className={`sg-trace-btn compact ${showIvStress ? 'active amber' : ''}`}
            >
              🌡️ ±3% IV Stress
            </button>
          )}
          <button
            type="button"
            data-testid="cgex-toggle-levels"
            onClick={() => setShowLevels((v) => !v)}
            className={`sg-trace-btn compact ${showLevels ? 'active cyan' : ''}`}
          >
            🎯 Levels
          </button>
        </div>
      </div>

      {/* Main Plotly Canvas */}
      <div className="cgex-canvas-wrap">
        <div
          ref={plotRef}
          data-testid="cgex-plot-canvas"
          style={{ width: '100%', height: `${plotHeightPx}px` }}
        />
      </div>

      {/* Micro-Legend */}
      <div className="cgex-micro-legend" data-testid="cgex-micro-legend">
        <span><b style={{ color: '#00F0FF' }}>CYAN CURVE</b> {model.effLens === 'spot_curve' ? 'Portfolio Net GEX(S)' : 'Running Strike Integral'}</span>
        <span>·</span>
        <span><b style={{ color: '#10b981' }}>GREEN FILL</b> Long Gamma (&gt;$0, Stabilizing)</span>
        <span>·</span>
        <span><b style={{ color: '#f43f5e' }}>ROSE FILL</b> Short Gamma (&lt;$0, Accelerating)</span>
        <span>·</span>
        <span><b style={{ color: '#fbbf24' }}>◆ GOLD</b> Zero-Gamma Crossing</span>
        {showIvStress && model.effLens === 'spot_curve' && (
          <>
            <span>·</span>
            <span><b style={{ color: '#38bdf8' }}>−3% IV</b> / <b style={{ color: '#f59e0b' }}>+3% IV</b> Regime Shift</span>
          </>
        )}
      </div>

      {/* Live Telemetry Brief */}
      <div className="cgex-brief" data-testid="cgex-brief" style={{ borderColor: `${model.regimeColor}44` }}>
        <div className="cgex-brief-head">
          <div className="cgex-brief-title">
            {model.effLens === 'spot_curve' ? 'PORTFOLIO BS CUMULATIVE GEX(S) BRIEF' : 'CUMULATIVE STRIKE INTEGRAL BRIEF'} · {ticker}
          </div>
          <span
            className="cgex-regime-pill"
            data-testid="cgex-regime-badge"
            style={{
              color: model.regimeColor,
              borderColor: `${model.regimeColor}66`,
              backgroundColor: `${model.regimeColor}1A`,
            }}
          >
            {model.regimeBadge}
          </span>
        </div>

        <div className="cgex-brief-chips">
          <span className="cgex-chip scope">{model.scopeLabel}</span>
          <span className="cgex-chip">
            Spot GEX(S): <b style={{ color: model.spotCurveGex >= 0 ? '#00E676' : '#f43f5e' }}>{formatDollarGex(model.spotCurveGex)}</b>
          </span>
          <span className="cgex-chip">
            Total Chain Net: <b style={{ color: model.totalNetGex >= 0 ? '#00E676' : '#f43f5e' }}>{formatDollarGex(model.totalNetGex)}</b>
          </span>
          <span className="cgex-chip flip">
            {model.flipLabel}
            {model.flipDistPct != null ? ` (${model.flipDistPct >= 0 ? '+' : ''}${model.flipDistPct.toFixed(1)}%)` : ''}
          </span>
          {model.atSpotPt && (
            <span className="cgex-chip">
              Local Slope (Speed): <b style={{ color: model.atSpotPt.slope1Pct >= 0 ? '#38bdf8' : '#f59e0b' }}>{formatDollarGex(model.atSpotPt.slope1Pct)} / +1%</b>
            </span>
          )}
          {model.peakPt && (
            <span className="cgex-chip">
              Peak Cushion: <b style={{ color: '#00E676' }}>${model.peakPt.x.toFixed(1)} ({formatDollarGex(model.peakPt.y)})</b>
            </span>
          )}
          {model.troughPt && (
            <span className="cgex-chip">
              Deepest Trough: <b style={{ color: '#f43f5e' }}>${model.troughPt.x.toFixed(1)} ({formatDollarGex(model.troughPt.y)})</b>
            </span>
          )}
          {showIvStress && model.effLens === 'spot_curve' && (
            <span className="cgex-chip iv">
              IV Flip Shift: <b>−3% IV {model.ivDnFlip ? `$${model.ivDnFlip}` : 'None'}</b> · <b>+3% IV {model.ivUpFlip ? `$${model.ivUpFlip}` : 'None'}</b>
            </span>
          )}
        </div>

        <div className="cgex-brief-read" data-testid="cgex-brief-read">
          <strong>Cumulative Read:</strong>{' '}
          {model.regimeState === 'positive' && (
            <>
              At <b>${spotVal.toFixed(2)}</b>, {ticker} sits inside <b>Positive Gamma</b> ({formatDollarGex(model.spotCurveGex)}
              {model.effectiveFlip ? `, +${Math.abs(model.flipDistPct || 0).toFixed(1)}% above Flip $${model.effectiveFlip.toFixed(2)}` : ''})
              — market makers dampen volatility by buying dips toward Put Wall (${Number(keyLevels?.put_wall || 0).toFixed(0)}) and selling into Call Wall (${Number(keyLevels?.call_wall || 0).toFixed(0)}).
            </>
          )}
          {model.regimeState === 'negative' && (
            <>
              At <b>${spotVal.toFixed(2)}</b>, {ticker} is in <b>Negative Gamma</b> ({formatDollarGex(model.spotCurveGex)}
              {model.effectiveFlip ? `, ${model.flipDistPct?.toFixed(1)}% vs Flip $${model.effectiveFlip.toFixed(2)}` : ''})
              — dealers hedge pro-cyclically (selling weakness, chasing rallies), amplifying swing velocity across the ${Number(keyLevels?.put_wall || 0).toFixed(0)}–${Number(keyLevels?.call_wall || 0).toFixed(0)} corridor.
            </>
          )}
          {model.regimeState === 'transitional' && (
            <>
              At <b>${spotVal.toFixed(2)}</b>, {ticker} sits right at a <b>Transitional Inflection Boundary</b>: aggregate chain GEX is{' '}
              <b>{formatDollarGex(model.totalNetGex)}</b> while Flip sits at <b>${model.effectiveFlip ? model.effectiveFlip.toFixed(2) : '--'}</b>{' '}
              ({model.flipDistPct != null ? `${model.flipDistPct >= 0 ? '+' : ''}${model.flipDistPct.toFixed(1)}%` : 'near spot'}) — expect regime flips if spot crosses ${model.effectiveFlip ? model.effectiveFlip.toFixed(2) : spotVal.toFixed(2)} or IV shifts ±3%.
            </>
          )}
        </div>
      </div>

      {/* 4-Zone Structural Breakdown (Symmetric 2x2) */}
      <div className="cgex-zones-grid" data-testid="cgex-zones">
        {model.zones.map((z) => (
          <div
            key={z.id}
            data-testid={z.id}
            className={`cgex-zone-card ${z.biasType} ${z.isSpotHere ? 'is-spot' : ''}`}
          >
            <div className="cgex-zone-top">
              <span className="cgex-zone-title">{z.title}</span>
              <div className="cgex-zone-badges">
                {z.isSpotHere && (
                  <span className="cgex-spot-here-pill" data-testid="cgex-spot-here-badge">● SPOT HERE</span>
                )}
                <span className={`cgex-zone-bias ${z.biasType}`}>{z.bias}</span>
              </div>
            </div>
            <div className="cgex-zone-mid">
              <strong className="cgex-zone-val" style={{ color: z.val >= 0 ? '#00E676' : '#f43f5e' }}>
                {formatDollarGex(z.val)}
              </strong>
              <span className="cgex-zone-meta">{z.metaLabel} · Range {z.rangeText}</span>
            </div>
            <div className="cgex-zone-why">
              <strong>Why:</strong> {z.why}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
